# WebdriverIO + TypeScript Framework

A small, production-minded browser automation project built to make the code easy to review.

## First slice

- A local demo shop with deterministic product data.
- WebdriverIO's local runner with Mocha and TypeScript.
- One customer journey, implemented with page objects and isolated test data.
- Useful failure evidence and browser/network diagnostics as the project grows.

There is intentionally no CI workflow in this repository yet. The framework is being built and reviewed in small commits before automation is added.

## Design principles

- Keep selectors and page actions in page objects; keep business intent in specs.
- Give each test its own data so order and browser choice do not affect the result.
- Prefer explicit waits and observable application behavior over fixed sleeps.
- Capture evidence when a test fails, and make it clear which browser produced it.
- Keep the demo app local and dependency-light so the suite is reproducible.

## Planned layout

```text
src/
  demo/                 # Local demo shop
  pages/                # Page objects
  support/              # Test data and diagnostic helpers
test/specs/             # End-to-end scenarios
artifacts/              # Generated run evidence (ignored by Git)
```

## Requirements

- Node.js 22.19 or newer
- npm
- Chrome and Firefox for the planned cross-browser run

## Development status

The first runnable slice includes the local shop and a page-object checkout scenario.

Start the demo app in one terminal:

```sh
npm ci
npm run demo
```

Run the WebdriverIO suite in another terminal:

```sh
npm test
```

Chrome is the default browser. Set `BROWSERS=chrome,firefox` to run the same scenario in both browsers. The demo listens on `127.0.0.1:4173`; if you change its port with `PORT`, set `BASE_URL` to the matching local URL for the test run.
