import { browser } from '@wdio/globals'
import { addAttachment, addFeature, addTestId } from '@wdio/allure-reporter'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { FailureDiagnostics, type DiagnosticsBrowser } from './test/support/failure-diagnostics.js'

const requestedBrowsers = process.env.BROWSERS?.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean)
const browserNames = requestedBrowsers?.length ? requestedBrowsers : ['chrome']
const supportedBrowsers = new Set(['chrome', 'firefox'])
const unsupportedBrowsers = browserNames.filter((name) => !supportedBrowsers.has(name))
const testCategory = process.env.TEST_CATEGORY?.trim().toLowerCase()
const headless = ['1', 'true'].includes(process.env.HEADLESS?.trim().toLowerCase() ?? '')
const chromeNoSandbox = headless && ['1', 'true'].includes(process.env.CHROME_NO_SANDBOX?.trim().toLowerCase() ?? '')
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
  // WDIO_SPECS runs other spec files instead, e.g. the failure demo (npm run test:failure-demo).
  specs: process.env.WDIO_SPECS ? [process.env.WDIO_SPECS] : ['./test/specs/**/*.e2e.ts'],
  maxInstances: 1,
  capabilities: browserNames.map((browserName) => {
    if (!headless) return { browserName }
    if (browserName === 'chrome') {
      return {
        browserName,
        'goog:chromeOptions': { args: ['--headless=new', ...(chromeNoSandbox ? ['--no-sandbox'] : [])] },
      }
    }
    return { browserName, 'moz:firefoxOptions': { args: ['-headless'] } }
  }),
  logLevel: 'warn',
  baseUrl: process.env.BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 4173}`,
  waitforTimeout: 5_000,
  framework: 'mocha',
  reporters: [
    'spec',
    ['junit', {
      outputDir: 'artifacts/test-results',
      outputFileFormat: ({ cid, capabilities }) => {
        const browserName = 'browserName' in capabilities ? capabilities.browserName : 'browser'
        return `results-${cid}-${String(browserName)}.xml`
      },
    }],
    ['allure', {
      outputDir: 'artifacts/allure-results',
      disableWebdriverStepsReporting: true,
      reportedEnvironmentVars: {
        NODE_VERSION: process.version,
        BROWSERS: browserNames.join(', '),
      },
    }],
  ],
  mochaOpts: {
    ui: 'bdd',
    timeout: 30_000,
    ...(testCategory ? { grep: new RegExp('\\[' + testCategory + '\\]', 'i') } : {}),
  },
  before: async () => failureDiagnostics.start(diagnosticsBrowser),
  beforeTest: async (_test) => {
    failureDiagnostics.reset()
    // The spec's describe() title ("the bag", "the product catalogue" ...) groups tests in Allure.
    await addFeature(_test.parent || 'Demo shop')
    const testId = /\[(TC-\d+)\]/i.exec(_test.title)?.[1]
    if (testId) await addTestId(testId)
  },
  afterTest: async (_test, _context, { error }) => {
    if (!error) return

    try {
      const directory = await failureDiagnostics.captureFailure(
        diagnosticsBrowser,
        _test.title,
        error,
        process.cwd(),
      )
      const manifest = JSON.parse(await readFile(join(directory, 'run.json'), 'utf8')) as {
        screenshot: string | null
      }
      await addAttachment('Failure diagnostics', manifest, 'application/json')
      if (manifest.screenshot) {
        await addAttachment('Failure screenshot', await readFile(join(directory, manifest.screenshot)), 'image/png')
      }
      console.info(`Failure evidence saved to ${directory}`)
    } catch (captureError) {
      console.warn('Could not save failure evidence:', captureError)
    }
  },
  after: () => failureDiagnostics.stop(diagnosticsBrowser),
}
