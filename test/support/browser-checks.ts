import { browser, expect } from '@wdio/globals'

/**
 * Checks on what happened inside the browser, read from the network events and console
 * logs that FailureDiagnostics captures for every test (see wdio.conf.ts).
 */

/** Waits until the page's own POST /api/orders request has completed with the given status. */
export async function waitForOrderResponse(status: number): Promise<void> {
  await browser.waitUntil(async () => {
    const events = await browser.getCapturedNetworkEvents()
    return events.some((event) => (
      event.event === 'network.responseCompleted'
      && event.method === 'POST'
      && event.url?.includes('/api/orders')
      && event.status === status
    ))
  }, {
    timeout: 5_000,
    timeoutMsg: `Expected the checkout order request to complete with HTTP ${status}`,
  })
}

/** True when the page sent any POST /api/orders request at all. */
export async function orderRequestWasSent(): Promise<boolean> {
  const events = await browser.getCapturedNetworkEvents()
  return events.some((event) => event.method === 'POST' && event.url?.includes('/api/orders'))
}

/** Fails the test if the page logged a JavaScript error. */
export async function expectNoJavaScriptErrors(): Promise<void> {
  const errors = (await browser.getCapturedBrowserLogs()).filter((entry) => entry.type === 'javascript' && entry.level === 'error')
  await expect(errors).toEqual([])
}

/**
 * Makes the shop's GET /api/products request fail with HTTP 500, before the page loads.
 * browser.mock intercepts the request inside the browser (WebDriver BiDi), so the demo
 * server itself stays untouched. Call restore() on the result after the test.
 */
export async function failProductsRequest() {
  const mock = await browser.mock('**/api/products', { method: 'get' })
  mock.respond({ error: 'Service unavailable' }, { statusCode: 500 })
  return mock
}
