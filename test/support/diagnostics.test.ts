import assert from 'node:assert/strict'
import { test } from 'node:test'
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
