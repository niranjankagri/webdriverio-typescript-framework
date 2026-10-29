import { $, $$ } from '@wdio/globals'

/** One product card as the shopper sees it. */
export interface ProductCardView {
  name: string
  price: string
}

/**
 * The product catalogue: the "N useful things" summary and one card per product.
 * Locators stay in here, so specs talk about products, not CSS selectors.
 */
export class ProductList {
  /** "3 useful things", or "Products are unavailable" when the catalogue failed to load. */
  get summary() {
    return $('#item-count')
  }

  private get cards() {
    return $$('#products .product-card')
  }

  /** Name and price of every card, in page order. */
  async cardViews(): Promise<ProductCardView[]> {
    const views: ProductCardView[] = []
    for (const card of await this.cards) {
      views.push({
        name: await card.$('h3').getText(),
        price: await card.$('.price').getText(),
      })
    }
    return views
  }

  /** Waits until the catalogue has rendered the given number of cards. */
  async waitForCards(count: number): Promise<void> {
    await this.summary.waitUntil(async () => (await this.cards).length === count, {
      timeoutMsg: `Expected ${count} product cards`,
    })
  }

  /**
   * Clicks "Add to bag" on a product. The buttons carry data-testid="add-<product id>",
   * the most stable hook the page offers (independent of the visible text).
   */
  async addToBag(productId: string): Promise<void> {
    await $(`[data-testid="add-${productId}"]`).click()
  }
}
