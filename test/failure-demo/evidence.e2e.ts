import { expect } from '@wdio/globals'
import { StorePage } from '../pages/StorePage.js'
import { createTestCustomer } from '../support/customers.js'
import { FIELD_NOTEBOOK } from '../support/products.js'

/**
 * A test that FAILS ON PURPOSE, to show what a failed run leaves behind (screenshot,
 * sanitized run.json with console and network summaries, JUnit failure, Allure attachments).
 * It is not part of the normal suite or CI: run it with `npm run test:failure-demo`.
 */
describe('failure evidence demo', () => {
  it('[DEMO] [failure-demo] expects a confirmation the shop never shows', async () => {
    const store = await new StorePage().open()
    const customer = createTestCustomer()
    await store.products.addToBag(FIELD_NOTEBOOK.id)
    await store.checkout.placeOrder(customer)

    // The real message is "Order <id> confirmed for <email>."; this expectation is wrong on purpose.
    await expect(store.message).toHaveText('Thank you, your parcel is on its way!', { wait: 2_000 })
  })
})
