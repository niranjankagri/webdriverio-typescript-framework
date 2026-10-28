export interface Product {
  id: string
  name: string
  description: string
  priceCents: number
}

export const products: Product[] = [
  {
    id: 'field-notebook',
    name: 'Field Notebook',
    description: 'A sturdy notebook for plans, notes, and small ideas.',
    priceCents: 1299,
  },
  {
    id: 'desk-lamp',
    name: 'Desk Lamp',
    description: 'A warm, adjustable light for focused work.',
    priceCents: 3499,
  },
  {
    id: 'travel-mug',
    name: 'Travel Mug',
    description: 'A double-wall mug for coffee on the move.',
    priceCents: 1899,
  },
]
