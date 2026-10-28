import { browser, expect } from '@wdio/globals'
import { StorePage } from '../pages/StorePage.js'
import { createTestCustomer } from '../support/customers.js'

describe('the local shop checkout', () => {
  const store = new StorePage()

  beforeEach(async () => {
    await store.open()
  })

  it('[TC-101] [smoke] displays the local shop', async () => {
    await expect(store.heading).toHaveText('Useful things for a focused day.')
  })

  it('[TC-102] [regression] confirms an order for the customer who placed it', async () => {
    const customer = createTestCustomer()

    await expect(store.heading).toHaveText('Useful things for a focused day.')
    await store.addFieldNotebook()
    await expect(store.cartCount).toHaveText('1')
    await expect(store.checkoutForm).toBeDisplayed()

    await store.placeOrder(customer)

    await expect(store.orderMessage).toHaveText(expect.stringContaining(`confirmed for ${customer.email}`))
    await expect(store.checkoutForm).not.toBeDisplayed()

    await browser.waitUntil(async () => {
      const events = await browser.getCapturedNetworkEvents()
      return events.some((event) => (
        event.event === 'network.responseCompleted'
        && event.method === 'POST'
        && event.url?.includes('/api/orders')
        && event.status === 201
      ))
    }, {
      timeout: 5_000,
      timeoutMsg: 'Expected the checkout order request to complete with HTTP 201',
    })

    const browserErrors = (await browser.getCapturedBrowserLogs()).filter((entry) => (
      entry.type === 'javascript' && entry.level === 'error'
    ))
    await expect(browserErrors).toEqual([])
  })
})
