import { $, browser } from '@wdio/globals'
import { CartPanel } from '../components/CartPanel.js'
import { CheckoutForm } from '../components/CheckoutForm.js'
import { ProductList } from '../components/ProductList.js'

/**
 * The demo shop's single page, made of components: the product list, the bag and the
 * checkout form, plus the heading and the status message they share.
 *
 * Specs use this class and its components only: no selectors or browser scripts in specs.
 */
export class StorePage {
  readonly products = new ProductList()
  readonly cart = new CartPanel()
  readonly checkout = new CheckoutForm()

  get heading() {
    return $('h1')
  }

  /** The status line: "Field Notebook added to your bag.", order confirmations and errors. */
  get message() {
    return $('#message')
  }

  /** Opens the shop and returns the page, so a spec can write `const store = await new StorePage().open()`. */
  async open(): Promise<this> {
    await browser.url('/')
    return this
  }
}
