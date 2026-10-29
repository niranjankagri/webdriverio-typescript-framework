# WebdriverIO + TypeScript Automation Framework

[![CI](https://github.com/niranjankagri/webdriverio-typescript-framework/actions/workflows/ci.yml/badge.svg)](https://github.com/niranjankagri/webdriverio-typescript-framework/actions/workflows/ci.yml)

A portfolio-ready browser automation framework built with WebdriverIO, TypeScript, and a local demo shop. It demonstrates maintainable page objects, isolated test data, cross-browser execution, useful failure diagnostics, and API contract checks.

## What’s included

- A deterministic demo shop with product and order APIs.
- Smoke and checkout regression scenarios written with Mocha and page objects.
- Chrome and Firefox support, including headless runs.
- Fast HTTP route tests using Node’s built-in test runner.
- JUnit and Allure reports, with sanitized failure details and screenshots when available.
- Optional Karate API contracts and Stryker mutation testing for diagnostic redaction.
- A quality catalog that maps test cases to requirements for Quality Intelligence imports.

There is intentionally no CI workflow in this repository yet. The project is developed and reviewed in small changes before automation is added.

## Requirements

- Node.js 22.19 or newer and npm.
- Chrome for the default test run; Firefox is also required for cross-browser runs.
- Java 17 and Maven only if you want to run the optional Karate suite.

## Run the browser tests

Install dependencies and run the complete WebdriverIO suite:

```sh
npm ci
npm test
```

The test runner starts the demo shop on an available local port, waits for its health endpoint, runs the tests, and stops the server. The default run uses Chrome.

```sh
npm run test:smoke          # Fast page-load check
npm run test:regression     # Checkout journey
npm run test:headless       # Chrome in headless mode
npm run test:cross-browser  # Chrome and Firefox
npm run test:api            # Demo shop HTTP routes; no browser or Maven required
npm run typecheck           # TypeScript validation
npm run test:unit           # Diagnostic sanitization checks
```

To combine a category and browser list, use:

```sh
node ./scripts/run-tests.mjs smoke --browsers chrome,firefox
```

For restricted local environments where headless Chrome cannot create sandboxed processes, set `CHROME_NO_SANDBOX=true`. This option disables Chrome’s sandbox and is intended only for trusted local test content.

To run the demo shop manually, use `npm run demo`. It listens on `127.0.0.1:4173` by default; set `PORT` to change the port. Set `BASE_URL` to run WebdriverIO against an already-running compatible shop.

## API contracts

The optional Karate suite checks catalog responses, order creation and readback, and invalid-order handling. Start the demo shop in one terminal, then run the API suite in another:

```sh
npm run demo
npm run test:karate
```

The suite defaults to `http://127.0.0.1:4173`; set `BASE_URL` to target another compatible service. Karate writes its HTML report under `api-tests/karate/target/karate-reports/`.

## Reports and diagnostics

Each WebdriverIO run writes one JUnit XML file per browser under `artifacts/test-results/` and Allure result files under `artifacts/allure-results/`. Allure results include stable test IDs and browser and Node.js metadata. If a test fails, the framework attempts to save a screenshot and a sanitized `run.json` under `artifacts/failures/`.

The failure manifest can include the test name, browser and version, page URL, error, and summaries of browser-console and network events. It omits request and response bodies, headers, and cookies; common credential fields and email addresses are redacted. The manifest also records when WebDriver BiDi log or network capture is unavailable.

If the Allure CLI is installed, generate a browsable report with:

```sh
allure generate artifacts/allure-results --clean -o artifacts/allure-report
```

## Mutation checks

Run Stryker against the diagnostic sanitizers:

```sh
npm run test:mutation
```

The run requires a 75% minimum mutation score and writes HTML and JSON reports under `artifacts/mutation/`.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every pull request and push to `main`, by hand, and every Monday night:

| Job | What it runs |
|---|---|
| Typecheck, unit and API tests | `tsc --noEmit`, the diagnostics unit tests and the demo-shop API tests |
| Karate API contracts | Starts the demo shop and runs the Karate suite (report kept as an artifact) |
| Browser tests (chrome, firefox) | `npm run test:headless -- --browsers <browser>`; JUnit XML, Allure results and failure evidence are kept as artifacts |

Dependabot proposes npm, Maven and GitHub Actions updates once a month (`.github/dependabot.yml`).

## Quality Intelligence

`quality/catalog.toml` maps smoke and checkout tests to stable IDs and demo-shop requirements. To import a local run into [Automation Coverage & Quality Intelligence](https://github.com/niranjankagri/automation-coverage-quality-intelligence), run these commands from that repository. Replace `/path/to/webdriverio-typescript-framework` with this checkout’s path:

```sh
qi history import /path/to/webdriverio-typescript-framework/artifacts/test-results \
  --catalog /path/to/webdriverio-typescript-framework/quality/catalog.toml
qi dashboard --catalog /path/to/webdriverio-typescript-framework/quality/catalog.toml
```

## Project layout

```text
api-tests/karate/       Optional API contract suite
quality/                Test-to-requirement catalog
scripts/                Local WebdriverIO runner
src/demo/               Demo shop and static assets
test/pages/              Page objects
test/specs/              End-to-end scenarios
test/support/            Test data and failure diagnostics
artifacts/               Generated reports and failure evidence
```
