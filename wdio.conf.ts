import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { browser } from '@wdio/globals'
import {
  safeFileSegment,
  sanitizeDiagnosticText,
  sanitizeUrl,
  summarizeLogEvent,
  summarizeNetworkEvent,
  type DiagnosticLog,
  type DiagnosticNetworkEvent,
} from './test/support/diagnostics.js'

const requestedBrowsers = process.env.BROWSERS?.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean)
const browserNames = requestedBrowsers?.length ? requestedBrowsers : ['chrome']
const supportedBrowsers = new Set(['chrome', 'firefox'])
const unsupportedBrowsers = browserNames.filter((name) => !supportedBrowsers.has(name))
const networkEventNames = [
  'network.beforeRequestSent',
  'network.responseCompleted',
  'network.fetchError',
] as const

let browserLogs: DiagnosticLog[] = []
let networkEvents: DiagnosticNetworkEvent[] = []
let logCaptureStatus = 'not started'
let networkCaptureStatus = 'not started'

function retain<T>(entries: T[], entry: T): void {
  entries.push(entry)
  if (entries.length > 250) entries.shift()
}

const onBrowserLog = (entry: unknown) => retain(browserLogs, summarizeLogEvent(entry))
const onNetworkEvent = (name: string) => (entry: unknown) => retain(networkEvents, summarizeNetworkEvent(name, entry))
const onRequestStart = onNetworkEvent('network.beforeRequestSent')
const onResponse = onNetworkEvent('network.responseCompleted')
const onRequestFailure = onNetworkEvent('network.fetchError')

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
  before: async () => {
    if (!browser.isBidi) {
      logCaptureStatus = 'unavailable: this session does not support WebDriver BiDi'
      networkCaptureStatus = 'unavailable: this session does not support WebDriver BiDi'
      return
    }

    try {
      await browser.sessionSubscribe({ events: ['log.entryAdded'] })
      browser.on('log.entryAdded', onBrowserLog)
      logCaptureStatus = 'active'
    } catch (error) {
      logCaptureStatus = `unavailable: ${sanitizeDiagnosticText(String(error))}`
    }

    try {
      await browser.sessionSubscribe({ events: [...networkEventNames] })
      browser.on(networkEventNames[0], onRequestStart)
      browser.on(networkEventNames[1], onResponse)
      browser.on(networkEventNames[2], onRequestFailure)
      networkCaptureStatus = 'active'
    } catch (error) {
      networkCaptureStatus = `unavailable: ${sanitizeDiagnosticText(String(error))}`
    }
  },
  beforeTest: () => {
    browserLogs = []
    networkEvents = []
  },
  afterTest: async (_test, _context, { error }) => {
    if (!error) return

    const capturedAt = new Date()
    const timestamp = capturedAt.toISOString().replace(/[:.]/g, '-')
    const capabilities = browser.capabilities as unknown as Record<string, unknown>
    const browserName = String(capabilities.browserName ?? 'unknown')
    const browserVersion = String(capabilities.browserVersion ?? 'unknown')
    const testTitle = _test.title || 'untitled test'
    const evidenceDirectory = join(
      process.cwd(),
      'artifacts',
      'failures',
      `${timestamp}-${safeFileSegment(testTitle)}-${safeFileSegment(browserName)}`,
    )
    const screenshotPath = join(evidenceDirectory, 'screenshot.png')
    let pageUrl: string | null = null
    let pageUrlError: string | null = null
    let screenshotError: string | null = null

    try {
      await mkdir(evidenceDirectory, { recursive: true })
    } catch (directoryError) {
      console.warn('Could not create failure artifact directory:', directoryError)
      return
    }

    try {
      pageUrl = sanitizeUrl(await browser.getUrl())
    } catch (captureError) {
      pageUrlError = sanitizeDiagnosticText(String(captureError))
    }

    try {
      await browser.saveScreenshot(screenshotPath)
    } catch (captureError) {
      screenshotError = sanitizeDiagnosticText(String(captureError))
    }

    const errorText = error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
      : String(error)
    const manifest = {
      capturedAt: capturedAt.toISOString(),
      test: sanitizeDiagnosticText(testTitle),
      browser: {
        name: sanitizeDiagnosticText(browserName),
        version: sanitizeDiagnosticText(browserVersion),
        sessionId: browser.sessionId ? sanitizeDiagnosticText(browser.sessionId) : null,
      },
      pageUrl,
      pageUrlError,
      error: sanitizeDiagnosticText(errorText),
      capture: {
        consoleLogs: logCaptureStatus,
        networkEvents: networkCaptureStatus,
      },
      logs: browserLogs,
      network: networkEvents,
      screenshot: screenshotError ? null : 'screenshot.png',
      screenshotError,
    }

    try {
      await writeFile(join(evidenceDirectory, 'run.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
      console.info(`Failure evidence saved to ${evidenceDirectory}`)
    } catch (manifestError) {
      console.warn('Could not save failure metadata:', manifestError)
    }
  },
  after: async () => {
    if (!browser.isBidi) return
    browser.off('log.entryAdded', onBrowserLog)
    browser.off(networkEventNames[0], onRequestStart)
    browser.off(networkEventNames[1], onResponse)
    browser.off(networkEventNames[2], onRequestFailure)
  },
}
