import { $, browser } from '@wdio/globals'
import type { TestCustomer } from '../support/customers.js'

/**
 * The checkout form: name, e-mail and "Place order". It is only visible while the bag
 * has items, and it hides itself after a confirmed order.
 */
export class CheckoutForm {
  get root() {
    return $('#checkout-form')
  }

  private get nameField() {
    return $('#customer-name')
  }

  private get emailField() {
    return $('#customer-email')
  }

  private get placeOrderButton() {
    return $('.place-order-button')
  }

  /** Fills in the customer's details without submitting. */
  async fill(customer: TestCustomer): Promise<void> {
    await this.nameField.setValue(customer.name)
    await this.emailField.setValue(customer.email)
  }

  /** Fills in the details and clicks "Place order". */
  async placeOrder(customer: TestCustomer): Promise<void> {
    await this.fill(customer)
    await this.placeOrderButton.click()
  }

  /**
   * True when the browser's own form validation accepts the fields (required, minlength,
   * type="email"). When false, clicking "Place order" sends nothing to the server.
   */
  async isValid(): Promise<boolean> {
    return browser.execute(() => (document.querySelector('#checkout-form') as HTMLFormElement).checkValidity())
  }
}
