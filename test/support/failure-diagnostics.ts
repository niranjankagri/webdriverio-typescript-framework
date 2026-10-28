import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  safeFileSegment,
  sanitizeDiagnosticText,
  sanitizeUrl,
  summarizeLogEvent,
  summarizeNetworkEvent,
  type DiagnosticLog,
  type DiagnosticNetworkEvent,
} from './diagnostics.js'

const networkEventNames = [
  'network.beforeRequestSent',
  'network.responseCompleted',
  'network.fetchError',
] as const

export interface DiagnosticsBrowser {
  isBidi: boolean
  capabilities: Record<string, unknown>
  sessionId?: string
  sessionSubscribe(options: { events: string[] }): Promise<unknown>
  on(eventName: string, listener: (event: unknown) => void): unknown
  off(eventName: string, listener: (event: unknown) => void): unknown
  getUrl(): Promise<string>
  saveScreenshot(path: string): Promise<unknown>
}

export class FailureDiagnostics {
  private logs: DiagnosticLog[] = []
  private network: DiagnosticNetworkEvent[] = []
  private logCaptureStatus = 'not started'
  private networkCaptureStatus = 'not started'
  private logListenerAttached = false
  private networkListenersAttached = false

  private readonly onLog = (event: unknown): void => {
    this.retain(this.logs, summarizeLogEvent(event))
  }

  private readonly onRequestStart = (event: unknown): void => {
    this.retain(this.network, summarizeNetworkEvent(networkEventNames[0], event))
  }

  private readonly onResponse = (event: unknown): void => {
    this.retain(this.network, summarizeNetworkEvent(networkEventNames[1], event))
  }

  private readonly onRequestFailure = (event: unknown): void => {
    this.retain(this.network, summarizeNetworkEvent(networkEventNames[2], event))
  }

  private retain<T>(entries: T[], entry: T): void {
    entries.push(entry)
    if (entries.length > 250) entries.shift()
  }

  async start(browser: DiagnosticsBrowser): Promise<void> {
    this.reset()
    this.logCaptureStatus = 'unavailable: this session does not support WebDriver BiDi'
    this.networkCaptureStatus = 'unavailable: this session does not support WebDriver BiDi'
    if (!browser.isBidi) return

    try {
      await browser.sessionSubscribe({ events: ['log.entryAdded'] })
      browser.on('log.entryAdded', this.onLog)
      this.logListenerAttached = true
      this.logCaptureStatus = 'active'
    } catch (error) {
      this.logCaptureStatus = `unavailable: ${sanitizeDiagnosticText(String(error))}`
    }

    try {
      await browser.sessionSubscribe({ events: [...networkEventNames] })
      browser.on(networkEventNames[0], this.onRequestStart)
      browser.on(networkEventNames[1], this.onResponse)
      browser.on(networkEventNames[2], this.onRequestFailure)
      this.networkListenersAttached = true
      this.networkCaptureStatus = 'active'
    } catch (error) {
      this.networkCaptureStatus = `unavailable: ${sanitizeDiagnosticText(String(error))}`
    }
  }

  reset(): void {
    this.logs = []
    this.network = []
  }

  async captureFailure(
    browser: DiagnosticsBrowser,
    testTitle: string,
    error: unknown,
    outputDirectory: string,
    capturedAt = new Date(),
  ): Promise<string> {
    const timestamp = capturedAt.toISOString().replace(/[:.]/g, '-')
    const browserName = String(browser.capabilities.browserName ?? 'unknown')
    const evidenceDirectory = join(
      outputDirectory,
      'artifacts',
      'failures',
      `${timestamp}-${safeFileSegment(testTitle || 'untitled-test')}-${safeFileSegment(browserName)}`,
    )
    const screenshotPath = join(evidenceDirectory, 'screenshot.png')
    await mkdir(evidenceDirectory, { recursive: true })

    let pageUrl: string | null = null
    let pageUrlError: string | null = null
    let screenshotError: string | null = null
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
      test: sanitizeDiagnosticText(testTitle || 'untitled test'),
      browser: {
        name: sanitizeDiagnosticText(browserName),
        version: sanitizeDiagnosticText(String(browser.capabilities.browserVersion ?? 'unknown')),
        sessionId: browser.sessionId ? sanitizeDiagnosticText(browser.sessionId) : null,
      },
      pageUrl,
      pageUrlError,
      error: sanitizeDiagnosticText(errorText),
      capture: {
        consoleLogs: this.logCaptureStatus,
        networkEvents: this.networkCaptureStatus,
      },
      logs: this.logs,
      network: this.network,
      screenshot: screenshotError ? null : 'screenshot.png',
      screenshotError,
    }

    await writeFile(join(evidenceDirectory, 'run.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    return evidenceDirectory
  }

  stop(browser: DiagnosticsBrowser): void {
    if (this.logListenerAttached) browser.off('log.entryAdded', this.onLog)
    if (this.networkListenersAttached) {
      browser.off(networkEventNames[0], this.onRequestStart)
      browser.off(networkEventNames[1], this.onResponse)
      browser.off(networkEventNames[2], this.onRequestFailure)
    }
    this.logListenerAttached = false
    this.networkListenersAttached = false
  }
}
