import type { DiagnosticLog, DiagnosticNetworkEvent } from './diagnostics.js'

declare global {
  namespace WebdriverIO {
    interface Browser {
      getCapturedNetworkEvents(): Promise<DiagnosticNetworkEvent[]>
      getCapturedBrowserLogs(): Promise<DiagnosticLog[]>
    }
  }
}

export {}
