import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { products } from './catalog.js'

interface OrderRequest {
  productId: string
  customerName: string
  email: string
}

interface Order extends OrderRequest {
  id: string
  createdAt: string
  totalCents: number
}

const publicDirectory = fileURLToPath(new URL('./public/', import.meta.url))
const orders = new Map<string, Order>()
const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(body))
}

function readJson(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = []
    let size = 0

    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 10_000) {
        rejectBody(new Error('Request body is too large.'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })

    request.on('end', () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown)
      } catch {
        rejectBody(new Error('Request body must be valid JSON.'))
      }
    })

    request.on('error', rejectBody)
  })
}

function isOrderRequest(value: unknown): value is OrderRequest {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Record<string, unknown>
  return typeof candidate.productId === 'string'
    && typeof candidate.customerName === 'string'
    && typeof candidate.email === 'string'
}

async function serveAsset(pathname: string, response: ServerResponse): Promise<void> {
  const assetName = pathname === '/' ? 'index.html' : pathname.slice(1)
  const filePath = resolve(publicDirectory, assetName)
  if (!filePath.startsWith(publicDirectory)) {
    response.writeHead(404).end()
    return
  }

  try {
    const body = await readFile(filePath)
    response.writeHead(200, {
      'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff',
    })
    response.end(body)
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  }
}

export function createDemoServer() {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')

    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, { status: 'ok', orderCount: orders.size })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/products') {
      sendJson(response, 200, { products })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/orders') {
      let body: unknown
      try {
        body = await readJson(request)
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid request.' })
        return
      }

      if (!isOrderRequest(body)) {
        sendJson(response, 400, { error: 'Product, name, and email are required.' })
        return
      }

      const product = products.find((candidate) => candidate.id === body.productId)
      const customerName = body.customerName.trim()
      const email = body.email.trim().toLowerCase()
      if (!product || customerName.length < 2 || customerName.length > 80 || !/^\S+@\S+\.\S+$/.test(email)) {
        sendJson(response, 422, { error: 'Enter a valid product, name, and email address.' })
        return
      }

      const order: Order = {
        id: randomUUID().slice(0, 8).toUpperCase(),
        productId: product.id,
        customerName,
        email,
        createdAt: new Date().toISOString(),
        totalCents: product.priceCents,
      }
      orders.set(order.id, order)
      sendJson(response, 201, { order })
      return
    }

    const orderMatch = request.method === 'GET' ? url.pathname.match(/^\/api\/orders\/([A-Z0-9]+)$/) : null
    if (orderMatch) {
      const order = orders.get(orderMatch[1] ?? '')
      if (!order) {
        sendJson(response, 404, { error: 'Order not found.' })
        return
      }
      sendJson(response, 200, { order })
      return
    }

    if (request.method === 'GET') {
      await serveAsset(url.pathname, response)
      return
    }

    sendJson(response, 405, { error: 'Method not allowed.' })
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173)
  const server = createDemoServer()
  server.listen(port, '127.0.0.1', () => {
    console.log(`Demo shop listening at http://127.0.0.1:${port}`)
  })

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => server.close(() => process.exit(0)))
  }
}
