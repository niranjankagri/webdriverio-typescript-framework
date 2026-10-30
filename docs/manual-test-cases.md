# Manual test cases

The test cases this framework automates, written as a tester would run them by hand. Every case has
an ID; the automated test that covers it carries the same ID in its name, so a failing test in a
report leads straight to the case below, and the case says which test automates it.

| ID range | Area | Automated in |
|---|---|---|
| TC-101 to TC-110 | Demo shop in the browser (UI) | `test/specs/*.e2e.ts` (WebdriverIO, Chrome + Firefox) |
| TC-201 to TC-210 | Demo shop REST API | `test/demo/server.test.ts` (node:test) and `api-tests/karate/.../demo-shop.feature` (Karate) |

Not listed here, on purpose: the framework's own unit tests (`test/support/diagnostics.test.ts`,
`test/scripts/*.test.ts`) check helper code, not the shop; `test/failure-demo/evidence.e2e.ts` fails
on purpose to show the failure evidence.

## Setup for manual runs

1. `npm ci`, then `npm run demo`.
2. Open <http://127.0.0.1:4173> in Chrome or Firefox. The shop keeps orders in memory: restart it
   for a clean state.
3. For the API cases use curl, Postman or similar against `http://127.0.0.1:4173`.

Catalogue (fixed): Field Notebook `$12.99` (`field-notebook`), Desk Lamp `$34.99` (`desk-lamp`),
Travel Mug `$18.99` (`travel-mug`).

## Summary

| ID | Title | Type | Priority | Automated by |
|---|---|---|---|---|
| TC-101 | Shop page opens with its heading | Smoke | High | `checkout.e2e.ts` › `[TC-101] [smoke] displays the local shop` |
| TC-102 | A valid order is confirmed for the customer | Regression | High | `checkout.e2e.ts` › `[TC-102] ...` |
| TC-103 | Catalogue lists every product with its price | Smoke | High | `catalog.e2e.ts` › `[TC-103] ...` |
| TC-104 | Bag adds up lines, item count and total | Regression | High | `cart.e2e.ts` › `[TC-104] ...` |
| TC-105 | Bag starts empty, without checkout form or total | Smoke | Medium | `cart.e2e.ts` › `[TC-105] ...` |
| TC-106 | Two different products: one-item-per-order rule explained | Regression | Medium | `cart.e2e.ts` › `[TC-106] ...` |
| TC-107 | Confirmed order is stored on the server | Regression | High | `checkout.e2e.ts` › `[TC-107] ...` |
| TC-108 | Catalogue failure shows a clear message | Regression | Medium | `catalog.e2e.ts` › `[TC-108] ...` |
| TC-109 | Server rejection (422) is shown to the shopper | Regression | High | `checkout.e2e.ts` › `[TC-109] ...` |
| TC-110 | Invalid e-mail is stopped by the browser, no order sent | Regression | High | `checkout.e2e.ts` › `[TC-110] ...` |
| TC-201 | Health endpoint reports status, not cached | API | Medium | `server.test.ts` › `[TC-201] ...` |
| TC-202 | Product endpoint returns the fixed catalogue | API | High | `server.test.ts` › `[TC-202] ...`; Karate `[TC-202]` |
| TC-203 | Order is created, normalised and read back | API | High | `server.test.ts` › `[TC-203] ...`; Karate `[TC-203]` |
| TC-204 | Malformed JSON and wrong field types: 400 | API | Medium | `server.test.ts` › `[TC-204] ...` |
| TC-205 | Invalid product, name or e-mail: 422 | API | High | `server.test.ts` › `[TC-205] ...`; Karate `[TC-205]` |
| TC-206 | Unknown order 404, unsupported method 405 | API | Medium | `server.test.ts` › `[TC-206] ...` |
| TC-207 | Oversized order (Content-Length): 413, nothing stored | API / Security | High | `server.test.ts` › `[TC-207] ...`; Karate `[TC-207]` |
| TC-208 | Oversized order streamed without Content-Length: 413 | API / Security | Medium | `server.test.ts` › `[TC-208] ...` |
| TC-209 | Order just under the size limit is accepted | API | Low | `server.test.ts` › `[TC-209] ...` |
| TC-210 | Root URL serves the shop page | API | Low | `server.test.ts` › `[TC-210] ...` |

---

## UI

### TC-101 Shop page opens with its heading

| Field | Value |
|---|---|
| Type / priority | Smoke / High |
| Automated by | `test/specs/checkout.e2e.ts` › `[TC-101] [smoke] displays the local shop` |
| Preconditions | Demo shop running |

| # | Step | Expected result |
|---|---|---|
| 1 | Open <http://127.0.0.1:4173> | Page loads without errors |
| 2 | Look at the main heading | "Useful things for a focused day." |

### TC-102 A valid order is confirmed for the customer

| Field | Value |
|---|---|
| Type / priority | Regression / High |
| Automated by | `test/specs/checkout.e2e.ts` › `[TC-102] [regression] confirms an order for the customer who placed it` |
| Preconditions | Demo shop open, bag empty |
| Test data | Name `Taylor 1a2b3c4d`, e-mail `qa+1a2b3c4d@example.test` (any unique values) |

| # | Step | Expected result |
|---|---|---|
| 1 | Click **Add to bag** on Field Notebook | Bag count shows `1`; the checkout form appears |
| 2 | Enter the name and e-mail, click **Place order** | Message "Order XXXXXXXX confirmed for qa+1a2b3c4d@example.test." (8-character id) |
| 3 | Look at the checkout area | Checkout form is hidden again |
| 4 | Browser DevTools: Network and Console | `POST /api/orders` answered `201`; no JavaScript errors |

### TC-103 Catalogue lists every product with its price

| Field | Value |
|---|---|
| Type / priority | Smoke / High |
| Automated by | `test/specs/catalog.e2e.ts` › `[TC-103] [smoke] lists every product with its price` |
| Preconditions | Demo shop running |

| # | Step | Expected result |
|---|---|---|
| 1 | Open the shop | The count above the grid reads "3 useful things" |
| 2 | Read the product cards in order | Field Notebook `$12.99`, Desk Lamp `$34.99`, Travel Mug `$18.99` |

### TC-104 Bag adds up lines, item count and total

| Field | Value |
|---|---|
| Type / priority | Regression / High |
| Automated by | `test/specs/cart.e2e.ts` › `[TC-104] [regression] adds up lines, count and total for several products` |
| Preconditions | Demo shop open, bag empty |

| # | Step | Expected result |
|---|---|---|
| 1 | Click **Add to bag** on Field Notebook twice | |
| 2 | Click **Add to bag** on Desk Lamp | Message "Desk Lamp added to your bag." |
| 3 | Read the bag lines | "Field Notebook × 2 $25.98" and "Desk Lamp × 1 $34.99" |
| 4 | Read the bag badge (and its screen-reader label) | `3`, label "3 items" |
| 5 | Read the total | "Total $60.97" |

### TC-105 Bag starts empty, without checkout form or total

| Field | Value |
|---|---|
| Type / priority | Smoke / Medium |
| Automated by | `test/specs/cart.e2e.ts` › `[TC-105] [smoke] starts empty, without a checkout form or total` |
| Preconditions | Fresh page load |

| # | Step | Expected result |
|---|---|---|
| 1 | Open the shop | Bag badge shows `0`; note "Your bag is waiting for something useful." |
| 2 | Look for the total and the checkout form | Neither is shown |

### TC-106 Two different products: one-item-per-order rule explained

| Field | Value |
|---|---|
| Type / priority | Regression / Medium |
| Automated by | `test/specs/cart.e2e.ts` › `[TC-106] [regression] explains the one-item-per-order rule instead of ordering` |
| Preconditions | Demo shop open, bag empty |

| # | Step | Expected result |
|---|---|---|
| 1 | Add Field Notebook and Desk Lamp to the bag | Two lines in the bag |
| 2 | Enter a valid name and e-mail, click **Place order** | Message "This first shop slice supports one item per order." |
| 3 | DevTools Network | No `POST /api/orders` was sent |

### TC-107 Confirmed order is stored on the server

| Field | Value |
|---|---|
| Type / priority | Regression / High |
| Automated by | `test/specs/checkout.e2e.ts` › `[TC-107] [regression] stores the confirmed order on the server` |
| Preconditions | Demo shop open, bag empty |

| # | Step | Expected result |
|---|---|---|
| 1 | Order Field Notebook as in TC-102 | Confirmation shows the order id, e.g. `K3P9Q2ZD` |
| 2 | Open `http://127.0.0.1:4173/api/orders/<id>` | `200`; `productId` `field-notebook`, the entered name, the e-mail in lower case, `totalCents` `1299` |

### TC-108 Catalogue failure shows a clear message

| Field | Value |
|---|---|
| Type / priority | Regression / Medium |
| Automated by | `test/specs/catalog.e2e.ts` › `[TC-108] [regression] says so when the catalogue cannot be loaded` (mocks the request in the browser) |
| Preconditions | Way to make `GET /api/products` fail: DevTools › Network › right-click the request › **Block request URL**, or an override returning `500` |

| # | Step | Expected result |
|---|---|---|
| 1 | Make `/api/products` answer `500`, reload the shop | Count text "Products are unavailable" |
| 2 | Read the status message | "Product request failed with 500." (no empty, silent shop) |

### TC-109 Server rejection (422) is shown to the shopper

| Field | Value |
|---|---|
| Type / priority | Regression / High |
| Automated by | `test/specs/checkout.e2e.ts` › `[TC-109] [regression] shows the server's message when it rejects the order` |
| Preconditions | Field Notebook in the bag |
| Test data | Name `"  A"` (two spaces + one letter: passes the browser's 2-character minimum, the server trims it to 1), e-mail `qa@example.test` |

| # | Step | Expected result |
|---|---|---|
| 1 | Enter the name and e-mail, click **Place order** | `POST /api/orders` answered `422` |
| 2 | Read the message | "Enter a valid product, name, and email address." |
| 3 | Look at the form | Still shown, so the shopper can correct the input |

### TC-110 Invalid e-mail is stopped by the browser, no order sent

| Field | Value |
|---|---|
| Type / priority | Regression / High |
| Automated by | `test/specs/checkout.e2e.ts` › `[TC-110] [regression] does not send an order the browser's form validation rejects` |
| Preconditions | Field Notebook in the bag |
| Test data | Name `Taylor`, e-mail `not-an-email` |

| # | Step | Expected result |
|---|---|---|
| 1 | Enter the data, click **Place order** | The browser marks the e-mail field invalid |
| 2 | Read the message; DevTools Network | No confirmation; no `POST /api/orders` sent |

---

## API

All requests go to `http://127.0.0.1:4173`; bodies are JSON (`Content-Type: application/json`).

### TC-201 Health endpoint reports status, not cached

| Field | Value |
|---|---|
| Type / priority | API / Medium |
| Automated by | `test/demo/server.test.ts` › `[TC-201] health endpoint reports a healthy service without caching` |

| # | Step | Expected result |
|---|---|---|
| 1 | `GET /api/health` | `200`, `{"status":"ok","orderCount":<number>}`, header `Cache-Control: no-store` |

### TC-202 Product endpoint returns the fixed catalogue

| Field | Value |
|---|---|
| Type / priority | API / High |
| Automated by | `server.test.ts` › `[TC-202] product endpoint returns the deterministic catalog`; Karate `[TC-202] list the deterministic product catalog` |

| # | Step | Expected result |
|---|---|---|
| 1 | `GET /api/products` | `200`, 3 products: `field-notebook`, `desk-lamp`, `travel-mug` |
| 2 | Check every product | Has `id` (string), `name` (string), `priceCents` (number); first is Field Notebook, `1299`, with its description |

### TC-203 Order is created, normalised and read back

| Field | Value |
|---|---|
| Type / priority | API / High |
| Automated by | `server.test.ts` › `[TC-203] order endpoint normalizes customer data and supports readback`; Karate `[TC-203] create an order and read it back by ID` |
| Test data | `{"productId":"field-notebook","customerName":"  Ada Lovelace  ","email":" ADA@EXAMPLE.COM "}` |

| # | Step | Expected result |
|---|---|---|
| 1 | `POST /api/orders` with the body | `201`; `order.customerName` `Ada Lovelace` (trimmed), `order.email` `ada@example.com` (trimmed, lower case), `totalCents` `1299`, `id` 8 characters A-Z/0-9 |
| 2 | `GET /api/orders/<id>` | `200`, the same order |

### TC-204 Malformed JSON and wrong field types: 400

| Field | Value |
|---|---|
| Type / priority | API / Medium |
| Automated by | `server.test.ts` › `[TC-204] order endpoint rejects malformed JSON and invalid request shapes` |

| # | Step | Expected result |
|---|---|---|
| 1 | `POST /api/orders` with body `{` | `400`, `{"error":"Request body must be valid JSON."}` |
| 2 | `POST /api/orders` with `customerName` as number `12` | `400`, `{"error":"Product, name, and email are required."}` |

### TC-205 Invalid product, name or e-mail: 422

| Field | Value |
|---|---|
| Type / priority | API / High |
| Automated by | `server.test.ts` › `[TC-205] order endpoint validates product, name, and email values`; Karate `[TC-205] reject an invalid product and email` |

| # | Step | Expected result |
|---|---|---|
| 1 | `POST /api/orders` with `productId` `missing-product` | `422`, `{"error":"Enter a valid product, name, and email address."}` |
| 2 | Same with `customerName` `A` (1 character) | `422`, same message |
| 3 | Same with `email` `not-an-email` | `422`, same message |

### TC-206 Unknown order 404, unsupported method 405

| Field | Value |
|---|---|
| Type / priority | API / Medium |
| Automated by | `server.test.ts` › `[TC-206] unknown orders and unsupported methods return the expected errors` |

| # | Step | Expected result |
|---|---|---|
| 1 | `GET /api/orders/MISSING01` | `404`, `{"error":"Order not found."}` |
| 2 | `POST /api/products` | `405`, `{"error":"Method not allowed."}` |

### TC-207 Oversized order (Content-Length): 413, nothing stored

| Field | Value |
|---|---|
| Type / priority | API / Security / High |
| Automated by | `server.test.ts` › `[TC-207] an oversized order announced by Content-Length gets 413 and stores nothing`; Karate `[TC-207] refuse an oversized order with 413 Payload Too Large` |
| Test data | Order with a `customerName` of 12,000 characters (limit: 10,000 bytes per body) |

| # | Step | Expected result |
|---|---|---|
| 1 | Note `orderCount` from `GET /api/health` | e.g. `4` |
| 2 | `POST /api/orders` with the oversized body | `413`, `{"error":"Request body is too large (limit 10000 bytes)."}`, header `Connection: close` |
| 3 | `GET /api/health` again | `orderCount` unchanged |

### TC-208 Oversized order streamed without Content-Length: 413

| Field | Value |
|---|---|
| Type / priority | API / Security / Medium |
| Automated by | `server.test.ts` › `[TC-208] an oversized order streamed without Content-Length gets 413 instead of a reset connection` |
| Test data | 12,000-byte body sent with `Transfer-Encoding: chunked` (e.g. `curl -H "Transfer-Encoding: chunked" --data-binary @big.json`) |

| # | Step | Expected result |
|---|---|---|
| 1 | Send the chunked body to `POST /api/orders` | An answer arrives (no connection reset): `413` with the size-limit message |

### TC-209 Order just under the size limit is accepted

| Field | Value |
|---|---|
| Type / priority | API / Low |
| Automated by | `server.test.ts` › `[TC-209] an order just under the size limit is still accepted` |
| Test data | A valid order padded with spaces to 9,999 bytes |

| # | Step | Expected result |
|---|---|---|
| 1 | `POST /api/orders` with the padded body | `201` (the limit is not off by one) |

### TC-210 Root URL serves the shop page

| Field | Value |
|---|---|
| Type / priority | API / Low |
| Automated by | `server.test.ts` › `[TC-210] root route serves the demo shop page` |

| # | Step | Expected result |
|---|---|---|
| 1 | `GET /` | `200`, `Content-Type: text/html`, the shop page |
