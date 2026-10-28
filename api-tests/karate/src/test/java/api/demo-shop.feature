Feature: Northstar Supply API

Background:
  * url baseUrl

Scenario: list the deterministic product catalog
  Given path 'api', 'products'
  When method get
  Then status 200
  And match response.products[*].id contains ['field-notebook', 'desk-lamp', 'travel-mug']
  And match each response.products contains { id: '#string', name: '#string', priceCents: '#number' }

Scenario: create an order and read it back by ID
  Given path 'api', 'orders'
  And request { productId: 'field-notebook', customerName: 'Taylor Karate', email: 'qa+karate@example.test' }
  When method post
  Then status 201
  And match response.order contains { productId: 'field-notebook', customerName: 'Taylor Karate', email: 'qa+karate@example.test', totalCents: 1299 }
  And match response.order.id == '#regex [A-Z0-9]+'
  * def orderId = response.order.id

  Given path 'api', 'orders', orderId
  When method get
  Then status 200
  And match response.order.id == orderId
  And match response.order.email == 'qa+karate@example.test'

Scenario: reject an invalid product and email
  Given path 'api', 'orders'
  And request { productId: 'unknown-product', customerName: 'Taylor Karate', email: 'not-an-email' }
  When method post
  Then status 422
  And match response.error == 'Enter a valid product, name, and email address.'
