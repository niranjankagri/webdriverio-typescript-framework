import { browser } from '@wdio/globals'

/** An order as the demo shop's API returns it. */
export interface Order {
  id: string
  productId: string
  customerName: string
  email: string
  totalCents: number
}

/**
 * Reads an order straight from the shop's API (GET /api/orders/:id), from the test process,
 * so a spec can check that what the page confirmed was really stored by the server.
 */
export async function getOrder(orderId: string): Promise<Order> {
  const response = await fetch(new URL(`/api/orders/${orderId}`, browser.options.baseUrl))
  if (!response.ok) throw new Error(`GET /api/orders/${orderId} answered ${response.status}`)
  const payload = (await response.json()) as { order: Order }
  return payload.order
}
