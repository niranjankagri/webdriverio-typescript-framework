import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { browser } from '@wdio/globals'

const requestedBrowsers = process.env.BROWSERS?.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean)
const browserNames = requestedBrowsers?.length ? requestedBrowsers : ['chrome']
const supportedBrowsers = new Set(['chrome', 'firefox'])
const unsupportedBrowsers = browserNames.filter((name) => !supportedBrowsers.has(name))

if (unsupportedBrowsers.length > 0) {
  throw new Error(`Unsupported browser(s): ${unsupportedBrowsers.join(', ')}. Choose chrome or firefox.`)
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
  },
  afterTest: async (_test, _context, { error }) => {
    if (!error) return

    const browserName = String(browser.capabilities.browserName ?? 'unknown').replace(/[^a-z0-9-]/gi, '-')
    const evidenceDirectory = join(process.cwd(), 'artifacts', 'screenshots')
    const fileName = `${new Date().toISOString().replace(/[:.]/g, '-')}-${browserName}.png`

    try {
      await mkdir(evidenceDirectory, { recursive: true })
      await browser.saveScreenshot(join(evidenceDirectory, fileName))
      console.info(`Failure screenshot saved to artifacts/screenshots/${fileName}`)
    } catch (captureError) {
      console.warn('Could not save failure screenshot:', captureError)
    }
  },
}
