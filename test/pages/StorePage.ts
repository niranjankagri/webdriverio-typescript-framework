import { $, browser } from '@wdio/globals'
import type { TestCustomer } from '../support/customers.js'

export class StorePage {
  get heading() {
    return $('h1')
  }

  get cartCount() {
    return $('#cart-count')
  }

  get checkoutForm() {
    return $('#checkout-form')
  }

  get orderMessage() {
    return $('#message')
  }

  async open(): Promise<void> {
    await browser.url('/')
  }

  async addFieldNotebook(): Promise<void> {
    await $('[data-testid="add-field-notebook"]').click()
  }

  async placeOrder(customer: TestCustomer): Promise<void> {
    await $('#customer-name').setValue(customer.name)
    await $('#customer-email').setValue(customer.email)
    await $('.place-order-button').click()
  }
}
