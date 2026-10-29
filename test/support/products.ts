/**
 * The demo shop's catalogue as the shopper should see it (names and US-dollar prices).
 * Kept as test data, separate from the app's own src/demo/catalog.ts, so a change in
 * the app's catalogue shows up as a failing test instead of silently passing.
 */
export const CATALOGUE = [
  { id: 'field-notebook', name: 'Field Notebook', price: '$12.99' },
  { id: 'desk-lamp', name: 'Desk Lamp', price: '$34.99' },
  { id: 'travel-mug', name: 'Travel Mug', price: '$18.99' },
] as const

export const FIELD_NOTEBOOK = CATALOGUE[0]
export const DESK_LAMP = CATALOGUE[1]
