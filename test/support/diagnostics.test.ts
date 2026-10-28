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

test('redacts sensitive URL parameters and URL credentials', () => {
  const result = sanitizeUrl('https://alice:secret@shop.example.test/orders?access_token=abc&view=compact')

  assert.equal(result.includes('alice'), false)
  assert.equal(result.includes('secret'), false)
  assert.equal(result.includes('abc'), false)
  assert.match(result, /view=compact/)
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

class FakeBrowser extends EventEmitter implements DiagnosticsBrowser {
  isBidi = true
  capabilities = { browserName: 'chrome', browserVersion: '130.0' }
  sessionId = 'session-123'
  subscriptions: string[][] = []

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
