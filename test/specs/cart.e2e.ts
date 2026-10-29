import { expect } from '@wdio/globals'
import { StorePage } from '../pages/StorePage.js'
import { orderRequestWasSent } from '../support/browser-checks.js'
import { createTestCustomer } from '../support/customers.js'
import { DESK_LAMP, FIELD_NOTEBOOK } from '../support/products.js'

/** The bag: empty state, lines and total, and the shop's one-item-per-order rule. */
describe('the bag', () => {
  let store: StorePage

  beforeEach(async () => {
    store = await new StorePage().open()
    await store.products.waitForCards(3)
  })

  it('[TC-105] [smoke] starts empty, without a checkout form or total', async () => {
    await expect(store.cart.count).toHaveText('0')
    await expect(store.cart.emptyNote).toBeDisplayed()
    await expect(store.cart.total).not.toBeDisplayed()
    await expect(store.checkout.root).not.toBeDisplayed()
  })

  it('[TC-104] [regression] adds up lines, count and total for several products', async () => {
    // when: two notebooks and a lamp go into the bag
    await store.products.addToBag(FIELD_NOTEBOOK.id)
    await store.products.addToBag(FIELD_NOTEBOOK.id)
    await store.products.addToBag(DESK_LAMP.id)

    // then: one line per product with its quantity, and the sum of all of them
    expect(await store.cart.lines()).toEqual(['Field Notebook × 2 $25.98', 'Desk Lamp × 1 $34.99'])
    await expect(store.cart.count).toHaveText('3')
    // The badge's label for screen readers says the same as the number.
    await expect(store.cart.count).toHaveAttribute('aria-label', '3 items')
    await expect(store.cart.total).toHaveText('Total $60.97')
    await expect(store.message).toHaveText('Desk Lamp added to your bag.')
  })

  it('[TC-106] [regression] explains the one-item-per-order rule instead of ordering', async () => {
    await store.products.addToBag(FIELD_NOTEBOOK.id)
    await store.products.addToBag(DESK_LAMP.id)

    await store.checkout.placeOrder(createTestCustomer())

    await expect(store.message).toHaveText('This first shop slice supports one item per order.')
    expect(await orderRequestWasSent()).toBe(false)
  })
})
