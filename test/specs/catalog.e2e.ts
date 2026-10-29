import { expect } from '@wdio/globals'
import { StorePage } from '../pages/StorePage.js'
import { failProductsRequest } from '../support/browser-checks.js'
import { CATALOGUE } from '../support/products.js'

/** The product catalogue: what the shopper sees, and what happens when it can't load. */
describe('the product catalogue', () => {
  it('[TC-103] [smoke] lists every product with its price', async () => {
    const store = await new StorePage().open()

    await store.products.waitForCards(CATALOGUE.length)
    await expect(store.products.summary).toHaveText(`${CATALOGUE.length} useful things`)
    expect(await store.products.cardViews()).toEqual(CATALOGUE.map(({ name, price }) => ({ name, price })))
  })

  it('[TC-108] [regression] says so when the catalogue cannot be loaded', async () => {
    // given: the products request fails (intercepted in the browser before the page loads)
    const mock = await failProductsRequest()
    try {
      // when
      const store = await new StorePage().open()

      // then: a clear message instead of an empty shop
      await expect(store.products.summary).toHaveText('Products are unavailable')
      await expect(store.message).toHaveText('Product request failed with 500.')
    } finally {
      await mock.restore()
    }
  })
})
