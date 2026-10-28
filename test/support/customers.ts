import { randomUUID } from 'node:crypto'

export interface TestCustomer {
  name: string
  email: string
}

export function createTestCustomer(): TestCustomer {
  const id = randomUUID().slice(0, 8)
  return {
    name: `Taylor ${id}`,
    email: `qa+${id}@example.test`,
  }
}
