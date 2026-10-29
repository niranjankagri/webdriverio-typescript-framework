import { expect } from '@wdio/globals'
import { StorePage } from '../pages/StorePage.js'
import { expectNoJavaScriptErrors, orderRequestWasSent, waitForOrderResponse } from '../support/browser-checks.js'
import { createTestCustomer } from '../support/customers.js'
import { FIELD_NOTEBOOK } from '../support/products.js'
import { getOrder } from '../support/shop-api.js'

/** Placing an order: the happy path, the stored order, and the two layers of validation. */
describe('the local shop checkout', () => {
  let store: StorePage

  beforeEach(async () => {
    store = await new StorePage().open()
  })

  it('[TC-101] [smoke] displays the local shop', async () => {
    await expect(store.heading).toHaveText('Useful things for a focused day.')
  })

  it('[TC-102] [regression] confirms an order for the customer who placed it', async () => {
    const customer = createTestCustomer()

    await store.products.addToBag(FIELD_NOTEBOOK.id)
    await expect(store.cart.count).toHaveText('1')
    await expect(store.checkout.root).toBeDisplayed()

    await store.checkout.placeOrder(customer)

    await expect(store.message).toHaveText(expect.stringContaining(`confirmed for ${customer.email}`))
    await expect(store.checkout.root).not.toBeDisplayed()
    await waitForOrderResponse(201)
    await expectNoJavaScriptErrors()
  })

  it('[TC-107] [regression] stores the confirmed order on the server', async () => {
    // given: a confirmed order
    const customer = createTestCustomer()
    await store.products.addToBag(FIELD_NOTEBOOK.id)
    await store.checkout.placeOrder(customer)
    await expect(store.message).toHaveText(expect.stringContaining('confirmed'))

    // when: the order id from the confirmation is looked up through the API
    const orderId = /Order (\w+) confirmed/.exec(await store.message.getText())?.[1]
    expect(orderId).toBeDefined()
    const order = await getOrder(orderId as string)

    // then: the server stored what the shopper entered (name trimmed, e-mail lower-cased) and the price
    expect(order).toMatchObject({ productId: FIELD_NOTEBOOK.id, customerName: customer.name, email: customer.email, totalCents: 1299 })
  })

  it('[TC-109] [regression] shows the server\'s message when it rejects the order', async () => {
    // A name of two spaces and one letter passes the browser's minlength="2", but the server
    // trims it to one letter and answers 422: the page must show the server's reason.
    await store.products.addToBag(FIELD_NOTEBOOK.id)
    await store.checkout.placeOrder({ name: '  A', email: 'qa@example.test' })

    await waitForOrderResponse(422)
    await expect(store.message).toHaveText('Enter a valid product, name, and email address.')
    await expect(store.checkout.root).toBeDisplayed()
  })

  it('[TC-110] [regression] does not send an order the browser\'s form validation rejects', async () => {
    await store.products.addToBag(FIELD_NOTEBOOK.id)
    await store.checkout.fill({ name: 'Taylor', email: 'not-an-email' })

    expect(await store.checkout.isValid()).toBe(false)
    await store.checkout.placeOrder({ name: 'Taylor', email: 'not-an-email' })

    await expect(store.message).not.toHaveText(expect.stringContaining('confirmed'))
    expect(await orderRequestWasSent()).toBe(false)
  })
})
