const productContainer = document.querySelector('#products')
const itemCount = document.querySelector('#item-count')
const cartCount = document.querySelector('#cart-count')
const cartEmpty = document.querySelector('#cart-empty')
const cartItems = document.querySelector('#cart-items')
const cartTotal = document.querySelector('#cart-total')
const checkoutForm = document.querySelector('#checkout-form')
const message = document.querySelector('#message')
const cart = new Map()

const money = (cents) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
}).format(cents / 100)

function setMessage(text, state = 'success') {
  message.textContent = text
  message.dataset.state = state
}

function renderCart() {
  const entries = [...cart.values()]
  const count = entries.reduce((sum, entry) => sum + entry.quantity, 0)
  const total = entries.reduce((sum, entry) => sum + entry.product.priceCents * entry.quantity, 0)

  cartCount.textContent = String(count)
  cartCount.setAttribute('aria-label', `${count} ${count === 1 ? 'item' : 'items'}`)
  cartEmpty.hidden = count > 0
  checkoutForm.hidden = count === 0
  cartTotal.hidden = count === 0
  cartTotal.textContent = `Total ${money(total)}`
  cartItems.replaceChildren(...entries.map(({ product, quantity }) => {
    const item = document.createElement('li')
    item.className = 'cart-item'
    const label = document.createElement('span')
    label.textContent = `${product.name} × ${quantity}`
    const price = document.createElement('span')
    price.textContent = money(product.priceCents * quantity)
    item.append(label, price)
    return item
  }))
}

function renderProducts(products) {
  itemCount.textContent = `${products.length} useful things`
  productContainer.replaceChildren(...products.map((product) => {
    const card = document.createElement('article')
    card.className = 'product-card'

    const artwork = document.createElement('div')
    artwork.className = 'product-art'
    artwork.setAttribute('aria-hidden', 'true')
    artwork.textContent = product.name.split(' ').map((part) => part[0]).join('').slice(0, 2)

    const title = document.createElement('h3')
    title.textContent = product.name
    const description = document.createElement('p')
    description.textContent = product.description
    const footer = document.createElement('div')
    footer.className = 'product-footer'
    const price = document.createElement('span')
    price.className = 'price'
    price.textContent = money(product.priceCents)

    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = 'Add to bag'
    button.setAttribute('aria-label', `Add ${product.name} to bag`)
    button.dataset.testid = `add-${product.id}`
    button.addEventListener('click', () => {
      const current = cart.get(product.id)
      cart.set(product.id, { product, quantity: (current?.quantity ?? 0) + 1 })
      renderCart()
      setMessage(`${product.name} added to your bag.`)
    })

    footer.append(price, button)
    card.append(artwork, title, description, footer)
    return card
  }))
}

async function loadProducts() {
  try {
    const response = await fetch('/api/products')
    if (!response.ok) throw new Error(`Product request failed with ${response.status}.`)
    const payload = await response.json()
    renderProducts(payload.products)
  } catch (error) {
    itemCount.textContent = 'Products are unavailable'
    setMessage(error instanceof Error ? error.message : 'Could not load products.', 'error')
  }
}

checkoutForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const firstEntry = cart.values().next().value
  if (!firstEntry || cart.size !== 1 || firstEntry.quantity !== 1) {
    setMessage('This first shop slice supports one item per order.', 'error')
    return
  }

  const formData = new FormData(checkoutForm)
  const submitButton = checkoutForm.querySelector('button[type="submit"]')
  submitButton.disabled = true
  setMessage('Placing your order…')

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productId: firstEntry.product.id,
        customerName: formData.get('customerName'),
        email: formData.get('email'),
      }),
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error ?? `Order request failed with ${response.status}.`)

    checkoutForm.hidden = true
    setMessage(`Order ${payload.order.id} confirmed for ${payload.order.email}.`)
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'Could not place the order.', 'error')
  } finally {
    submitButton.disabled = false
  }
})

renderCart()
loadProducts()
