import { browser } from '@wdio/globals'
import { FailureDiagnostics, type DiagnosticsBrowser } from './test/support/failure-diagnostics.js'

const requestedBrowsers = process.env.BROWSERS?.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean)
const browserNames = requestedBrowsers?.length ? requestedBrowsers : ['chrome']
const supportedBrowsers = new Set(['chrome', 'firefox'])
const unsupportedBrowsers = browserNames.filter((name) => !supportedBrowsers.has(name))
const testCategory = process.env.TEST_CATEGORY?.trim().toLowerCase()
const supportedCategories = new Set(['smoke', 'regression'])
const failureDiagnostics = new FailureDiagnostics()
const diagnosticsBrowser = browser as unknown as DiagnosticsBrowser

if (unsupportedBrowsers.length > 0) {
  throw new Error(`Unsupported browser(s): ${unsupportedBrowsers.join(', ')}. Choose chrome or firefox.`)
}

if (testCategory && !supportedCategories.has(testCategory)) {
  throw new Error('Unsupported test category "' + testCategory + '". Choose smoke or regression.')
}

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./test/specs/**/*.e2e.ts'],
  maxInstances: 1,
  capabilities: browserNames.map((browserName) => ({ browserName })),
  logLevel: 'warn',
  baseUrl: process.env.BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 4173}`,
  waitforTimeout: 5_000,
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 30_000,
    ...(testCategory ? { grep: new RegExp('\\\\[' + testCategory + '\\\\]', 'i') } : {}),
  },
  before: async () => failureDiagnostics.start(diagnosticsBrowser),
  beforeTest: () => failureDiagnostics.reset(),
  afterTest: async (_test, _context, { error }) => {
    if (!error) return

    try {
      const directory = await failureDiagnostics.captureFailure(
        diagnosticsBrowser,
        _test.title,
        error,
        process.cwd(),
      )
      console.info(`Failure evidence saved to ${directory}`)
    } catch (captureError) {
      console.warn('Could not save failure evidence:', captureError)
    }
  },
  after: () => failureDiagnostics.stop(diagnosticsBrowser),
}
