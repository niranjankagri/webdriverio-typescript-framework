import { $, $$ } from '@wdio/globals'

/**
 * The bag (cart) in the side panel: item count badge, the lines, the total, and the
 * "empty" note that is shown instead of them when nothing has been added.
 */
export class CartPanel {
  /** The badge with the number of items, e.g. "2". Its aria-label reads "2 items". */
  get count() {
    return $('#cart-count')
  }

  /** The note shown while the bag is empty. */
  get emptyNote() {
    return $('#cart-empty')
  }

  /** "Total $47.98"; hidden while the bag is empty. */
  get total() {
    return $('#cart-total')
  }

  /** The text of every line, e.g. "Field Notebook × 1 $12.99" (name, quantity, line price). */
  async lines(): Promise<string[]> {
    const texts: string[] = []
    for (const line of await $$('#cart-items .cart-item')) {
      texts.push((await line.getText()).replace(/\s+/g, ' ').trim())
    }
    return texts
  }
}
