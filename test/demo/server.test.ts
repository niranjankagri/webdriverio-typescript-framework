import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createDemoServer } from '../../src/demo/server.js'

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

test('root route serves the demo shop page', async () => {
  const response = await fetch(`${baseUrl}/`)
  const html = await response.text()

  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') ?? '', /text\/html/)
  assert.match(html, /Useful things for a focused day\./)
})
