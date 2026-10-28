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

Install the pinned dependencies and run the end-to-end suite:

```sh
npm ci
npm test
```

`npm test` starts the demo shop on an available local port, waits for its health endpoint, runs WebdriverIO, and stops the server. Run the focused diagnostics checks with `npm run test:unit`. To run the shop by itself for manual browsing, use:

```sh
npm run demo
```

Run only the fast store-page check with `npm run test:smoke`, or run the full checkout journey with `npm run test:regression`. `npm test` runs both categories.

Each WebdriverIO run writes a JUnit XML report per browser under `artifacts/test-results/`. The report is suitable for test dashboards and is ignored by Git along with failure evidence.

### Quality Intelligence

The optional `quality/catalog.toml` maps the smoke and checkout tests to stable test IDs and demo-shop requirements. To add a local run to [Automation Coverage & Quality Intelligence](https://github.com/niranjankagri/automation-coverage-quality-intelligence), run these commands from its checkout, replacing `/path/to/webdriverio-typescript-framework` with this repository's path:

```sh
qi history import /path/to/webdriverio-typescript-framework/artifacts/test-results \\
  --catalog /path/to/webdriverio-typescript-framework/quality/catalog.toml
qi dashboard --catalog /path/to/webdriverio-typescript-framework/quality/catalog.toml
```

Chrome is the default browser. Set `BROWSERS=chrome,firefox` to run the same scenario in both browsers. Set `BASE_URL` to point the suite at an already-running demo or another compatible environment. For manual browsing, the demo listens on `127.0.0.1:4173`; `PORT` can change that port.

## Failure evidence

Failed WebdriverIO tests write a screenshot and `run.json` under `artifacts/failures/`. The manifest records the test, browser and version, current page URL, error, and up to 250 browser-console and network event summaries. Network summaries keep method, sanitized URL, response status, and fetch errors; they omit request and response bodies, headers, and cookies. Common credential fields and email addresses are redacted before the manifest is written. The manifest reports when WebDriver BiDi log or network capture is unavailable.
