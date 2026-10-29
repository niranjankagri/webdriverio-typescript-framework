import assert from 'node:assert/strict'
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http'
import { after, before, test } from 'node:test'
import { createDemoServer, MAX_BODY_BYTES } from '../../src/demo/server.js'

const server = createDemoServer()
let baseUrl: string

before(async () => {
  await new Promise<void>((resolveStart, rejectStart) => {
    server.once('error', rejectStart)
    server.listen(0, '127.0.0.1', resolveStart)
  })

  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => error ? rejectClose(error) : resolveClose())
    server.closeAllConnections()
  })
})

test('health endpoint reports a healthy service without caching', async () => {
  const response = await fetch(`${baseUrl}/api/health`)
  const payload = await response.json() as { status: string; orderCount: number }

  assert.equal(response.status, 200)
  assert.equal(payload.status, 'ok')
  assert.equal(typeof payload.orderCount, 'number')
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('product endpoint returns the deterministic catalog', async () => {
  const response = await fetch(`${baseUrl}/api/products`)
  const payload = await response.json() as { products: Array<{ id: string; priceCents: number }> }

  assert.equal(response.status, 200)
  assert.equal(payload.products.length, 3)
  assert.deepEqual(payload.products[0], {
    id: 'field-notebook',
    name: 'Field Notebook',
    description: 'A sturdy notebook for plans, notes, and small ideas.',
    priceCents: 1299,
  })
})

test('order endpoint normalizes customer data and supports readback', async () => {
  const createResponse = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      productId: 'field-notebook',
      customerName: '  Ada Lovelace  ',
      email: ' ADA@EXAMPLE.COM ',
    }),
  })
  const created = await createResponse.json() as { order: { id: string; customerName: string; email: string; totalCents: number } }

  assert.equal(createResponse.status, 201)
  assert.equal(created.order.customerName, 'Ada Lovelace')
  assert.equal(created.order.email, 'ada@example.com')
  assert.equal(created.order.totalCents, 1299)
  assert.match(created.order.id, /^[A-Z0-9]{8}$/)

  const readResponse = await fetch(`${baseUrl}/api/orders/${created.order.id}`)
  const read = await readResponse.json() as { order: typeof created.order }
  assert.equal(readResponse.status, 200)
  assert.deepEqual(read.order, created.order)
})

test('order endpoint rejects malformed JSON and invalid request shapes', async () => {
  const malformedResponse = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  })
  assert.equal(malformedResponse.status, 400)
  assert.deepEqual(await malformedResponse.json(), { error: 'Request body must be valid JSON.' })

  const shapeResponse = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productId: 'field-notebook', customerName: 12, email: 'ada@example.com' }),
  })
  assert.equal(shapeResponse.status, 400)
  assert.deepEqual(await shapeResponse.json(), { error: 'Product, name, and email are required.' })
})

test('order endpoint validates product, name, and email values', async () => {
  const invalidOrders = [
    { productId: 'missing-product', customerName: 'Ada Lovelace', email: 'ada@example.com' },
    { productId: 'field-notebook', customerName: 'A', email: 'ada@example.com' },
    { productId: 'field-notebook', customerName: 'Ada Lovelace', email: 'not-an-email' },
  ]

  for (const order of invalidOrders) {
    const response = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(order),
    })
    assert.equal(response.status, 422)
    assert.deepEqual(await response.json(), { error: 'Enter a valid product, name, and email address.' })
  }
})

test('unknown orders and unsupported methods return the expected errors', async () => {
  const missingResponse = await fetch(`${baseUrl}/api/orders/MISSING01`)
  assert.equal(missingResponse.status, 404)
  assert.deepEqual(await missingResponse.json(), { error: 'Order not found.' })

  const methodResponse = await fetch(`${baseUrl}/api/products`, { method: 'POST' })
  assert.equal(methodResponse.status, 405)
  assert.deepEqual(await methodResponse.json(), { error: 'Method not allowed.' })
})

/** POSTs a body in chunks without a Content-Length header, the way a streaming client does. */
function postChunked(path: string, chunks: string[]): Promise<{ status: number; headers: IncomingHttpHeaders; body: string }> {
  return new Promise((resolvePost, rejectPost) => {
    const request = httpRequest(`${baseUrl}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'transfer-encoding': 'chunked' } }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (part: string) => { body += part })
      response.on('end', () => resolvePost({ status: response.statusCode ?? 0, headers: response.headers, body }))
    })
    request.on('error', rejectPost)
    for (const chunk of chunks) request.write(chunk)
    request.end()
  })
}

async function orderCount(): Promise<number> {
  const payload = await (await fetch(`${baseUrl}/api/health`)).json() as { orderCount: number }
  return payload.orderCount
}

test('an oversized order announced by Content-Length gets 413 and stores nothing', async () => {
  const before = await orderCount()
  const response = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productId: 'field-notebook', customerName: 'x'.repeat(MAX_BODY_BYTES), email: 'big@example.com' }),
  })

  assert.equal(response.status, 413)
  assert.deepEqual(await response.json(), { error: `Request body is too large (limit ${MAX_BODY_BYTES} bytes).` })
  assert.equal(response.headers.get('connection'), 'close')
  assert.equal(await orderCount(), before)
})

test('an oversized order streamed without Content-Length gets 413 instead of a reset connection', async () => {
  // Regression: the server used to destroy the request when the limit was passed, so a
  // streaming client got ECONNRESET and no answer at all.
  const piece = 'x'.repeat(4_000)
  const result = await postChunked('/api/orders', [`{"productId":"field-notebook","customerName":"`, piece, piece, piece, `","email":"big@example.com"}`])

  assert.equal(result.status, 413)
  assert.deepEqual(JSON.parse(result.body), { error: `Request body is too large (limit ${MAX_BODY_BYTES} bytes).` })
})

test('an order just under the size limit is still accepted', async () => {
  const order = JSON.stringify({ productId: 'field-notebook', customerName: 'Ada Lovelace', email: 'ada@example.com' })
  // JSON allows whitespace around values: pad the body to one byte below the limit.
  const body = order.replace('{', '{' + ' '.repeat(MAX_BODY_BYTES - order.length - 1))
  assert.equal(Buffer.byteLength(body), MAX_BODY_BYTES - 1)

  const response = await fetch(`${baseUrl}/api/orders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
  assert.equal(response.status, 201)
})

test('root route serves the demo shop page', async () => {
  const response = await fetch(`${baseUrl}/`)
  const html = await response.text()

  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') ?? '', /text\/html/)
  assert.match(html, /Useful things for a focused day\./)
})
