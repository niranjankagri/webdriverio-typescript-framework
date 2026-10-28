import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { FailureDiagnostics, type DiagnosticsBrowser } from './failure-diagnostics.js'
import {
  safeFileSegment,
  sanitizeDiagnosticText,
  sanitizeUrl,
  summarizeLogEvent,
  summarizeNetworkEvent,
} from './diagnostics.js'

test('redacts credentials and email addresses from diagnostic text', () => {
  const result = sanitizeDiagnosticText(
    'Authorization: Bearer abc123 password="secret value" email=qa@example.test',
  )

  assert.equal(result.includes('abc123'), false)
  assert.equal(result.includes('secret value'), false)
  assert.equal(result.includes('qa@example.test'), false)
  assert.match(result, /\[REDACTED_EMAIL\]/)
})

test('redacts credential aliases and preserves the surrounding diagnostic text', () => {
  const result = sanitizeDiagnosticText(
    'api_key=key-one api-key: key-two apikey=key-three apiXkey=ordinary Authorization: Bearer bearer-value passcode="two words" password="secret value" passcode=\'single quoted secret\' https://shop.example.test/?token=long-token&api-key=other-key&apikey=querysecret&apiXkey=query-safe&view=compact',
  )

  for (const secret of ['key-one', 'key-two', 'key-three', 'bearer-value', 'two words', 'words', 'secret value', 'value', 'single quoted secret', 'querysecret', 'other-key']) {
    assert.equal(result.includes(secret), false)
  }
  assert.match(result, /api_key=\[REDACTED\]/)
  assert.match(result, /api-key: \[REDACTED\]/)
  assert.match(result, /apikey=\[REDACTED\]/)
  assert.match(result, /apiXkey=ordinary/)
  assert.match(result, /apiXkey=query-safe/)
  assert.match(result, /Authorization: \[REDACTED\]/)
  assert.match(result, /view=compact/)
})

test('redacts sensitive URL parameters and URL credentials', () => {
  const result = sanitizeUrl('https://alice:secret@shop.example.test/orders?access_token=abc&view=compact')

  assert.equal(result.includes('alice'), false)
  assert.equal(result.includes('secret'), false)
  assert.equal(result.includes('abc'), false)
  assert.match(result, /view=compact/)
})

test('redacts email and API key query parameters while preserving safe URL values', () => {
  const result = new URL(sanitizeUrl(
    'https://shop.example.test/orders?email=qa%40example.test&api_key=private-key&email_backup=safe-value&backup_email=also-safe&view=compact',
  ))

  assert.equal(result.searchParams.get('email'), '[REDACTED]')
  assert.equal(result.searchParams.get('api_key'), '[REDACTED]')
  assert.equal(result.searchParams.get('email_backup'), 'safe-value')
  assert.equal(result.searchParams.get('backup_email'), 'also-safe')
  assert.equal(result.searchParams.get('view'), 'compact')
})

test('preserves ordinary URLs and sanitizes credentials in malformed URL text', () => {
  const ordinaryUrl = 'https://shop.example.test/orders?view=compact'
  assert.equal(sanitizeUrl(ordinaryUrl), ordinaryUrl)

  const fallback = sanitizeUrl('Authorization=private-token for qa@example.test')
  assert.equal(fallback.includes('private-token'), false)
  assert.equal(fallback.includes('qa@example.test'), false)
})

test('redacts usernames and passwords independently in URLs', () => {
  const usernameOnly = new URL(sanitizeUrl('https://alice@shop.example.test/orders'))
  const passwordOnly = new URL(sanitizeUrl('https://:private-password@shop.example.test/orders'))

  assert.equal(usernameOnly.username, '')
  assert.equal(usernameOnly.password, '')
  assert.equal(passwordOnly.username, '')
  assert.equal(passwordOnly.password, '')
  assert.equal(passwordOnly.toString().includes('private-password'), false)
})

test('summarizes console and network events without copying headers or bodies', () => {
  const log = summarizeLogEvent({
    timestamp: 1_800_000_000_000,
    level: 'error',
    type: 'javascript',
    text: 'request failed for qa@example.test',
  })
  const network = summarizeNetworkEvent('network.responseCompleted', {
    timestamp: 1_800_000_000_000,
    request: { method: 'POST', url: 'http://127.0.0.1/api/orders?token=abc' },
    response: { status: 201, headers: [{ name: 'authorization', value: 'private' }] },
  })

  assert.equal(log.level, 'error')
  assert.match(log.text, /\[REDACTED_EMAIL\]/)
  assert.equal(network.method, 'POST')
  assert.equal(network.status, 201)
  assert.equal(network.url?.includes('abc'), false)
  assert.equal('headers' in network, false)
  assert.equal(safeFileSegment('Checkout / user@example.test'), 'checkout-redacted-email')
})

test('handles empty and unexpected diagnostic event values with stable defaults', () => {
  const emptyLog = summarizeLogEvent(null)
  const stringLog = summarizeLogEvent({ timestamp: '2026-10-28T10:00:00.000Z', level: '', type: '', text: 42 })
  const emptyStrings = summarizeLogEvent({ timestamp: '', level: '', type: '', text: '' })
  const network = summarizeNetworkEvent('network.fetchError', {
    timestamp: '2026-10-28T10:00:00.000Z',
    error: 'request failed for password=private',
  })

  assert.equal(emptyLog.level, 'info')
  assert.equal(emptyLog.type, 'unknown')
  assert.equal(emptyLog.text, '')
  assert.equal(emptyLog.timestamp.endsWith('Z'), true)
  assert.equal(stringLog.timestamp, '2026-10-28T10:00:00.000Z')
  assert.equal(stringLog.text, '')
  assert.equal(emptyStrings.level, 'info')
  assert.equal(emptyStrings.type, 'unknown')
  assert.notEqual(emptyStrings.timestamp, '')
  assert.equal(network.method, null)
  assert.equal(network.url, null)
  assert.equal(network.status, null)
  assert.equal(network.error?.includes('private'), false)
  assert.equal(network.event, 'network.fetchError')
})

test('keeps file segments bounded and gives punctuation-only names a fallback', () => {
  assert.equal(safeFileSegment('!@#$%^&*()'), 'unknown')
  assert.equal(safeFileSegment('a'.repeat(80)).length, 64)
  assert.equal(sanitizeDiagnosticText('a'.repeat(4_100)).length, 4_000)
})

class FakeBrowser extends EventEmitter implements DiagnosticsBrowser {
  isBidi = true
  capabilities = { browserName: 'chrome', browserVersion: '130.0' }
  sessionId = 'session-123'
  subscriptions: string[][] = []
  commands = new Map<string, (...args: unknown[]) => unknown>()

  addCommand(name: string, callback: (...args: unknown[]) => unknown): void {
    this.commands.set(name, callback)
  }

  async sessionSubscribe(options: { events: string[] }): Promise<unknown> {
    this.subscriptions.push(options.events)
    return { subscription: 'subscribed' }
  }

  async getUrl(): Promise<string> {
    return 'http://127.0.0.1/orders?email=qa@example.test&token=private-token'
  }

  async saveScreenshot(path: string): Promise<void> {
    await writeFile(path, Buffer.from('screenshot-placeholder'))
  }
}

test('central listener writes sanitized screenshot metadata and captured events', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'wdio-failure-evidence-'))
  const browser = new FakeBrowser()
  const diagnostics = new FailureDiagnostics()

  try {
    await diagnostics.start(browser)
    browser.emit('log.entryAdded', {
      timestamp: 1_800_000_000_000,
      level: 'error',
      type: 'javascript',
      text: 'password=secret-value for qa@example.test',
    })
    browser.emit('network.responseCompleted', {
      timestamp: 1_800_000_000_000,
      request: { method: 'POST', url: 'http://127.0.0.1/api/orders?token=private-token' },
      response: { status: 201, headers: [{ name: 'authorization', value: 'private-header' }] },
    })

    const directory = await diagnostics.captureFailure(
      browser,
      'Checkout for qa@example.test',
      new Error('Checkout failed for qa@example.test token=private-token'),
      outputDirectory,
      new Date('2026-10-28T10:00:00.000Z'),
    )
    const manifest = JSON.parse(await readFile(join(directory, 'run.json'), 'utf8')) as {
      browser: { name: string; version: string }
      pageUrl: string
      capture: { consoleLogs: string; networkEvents: string }
      error: string
      logs: Array<{ text: string }>
      network: Array<{ method: string; status: number; url: string }>
    }

    assert.equal(browser.subscriptions.length, 2)
    assert.equal(manifest.browser.name, 'chrome')
    assert.equal(manifest.browser.version, '130.0')
    assert.equal(manifest.capture.consoleLogs, 'active')
    assert.equal(manifest.capture.networkEvents, 'active')
    assert.equal(manifest.network[0]?.method, 'POST')
    assert.equal(manifest.network[0]?.status, 201)
    assert.equal(manifest.pageUrl.includes('private-token'), false)
    assert.equal(manifest.error.includes('private-token'), false)
    assert.equal(manifest.logs[0]?.text.includes('secret-value'), false)
    assert.equal(manifest.logs[0]?.text.includes('qa@example.test'), false)
    assert.equal(manifest.network[0]?.url.includes('private-token'), false)
    assert.equal(JSON.stringify(manifest).includes('private-header'), false)
    assert.equal(await readFile(join(directory, 'screenshot.png'), 'utf8'), 'screenshot-placeholder')
  } finally {
    diagnostics.stop(browser)
    await rm(outputDirectory, { recursive: true, force: true })
  }
})
