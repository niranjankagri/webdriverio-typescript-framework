const secretName = /(?:authorization|password|passcode|secret|token|api[_-]?key)/i
const secretAssignment = /((?:authorization|password|passcode|secret|token|api[_-]?key)\s*[:=]\s*)(?:bearer\s+)?(?:"[^"]*"|'[^']*'|[^\s,;&}]+)/gi
const sensitiveQueryValue = /([?&](?:authorization|password|passcode|secret|token|api[_-]?key)=)[^&#\s]*/gi
const emailAddress = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi

export interface DiagnosticLog {
  timestamp: string
  level: string
  type: string
  text: string
}

export interface DiagnosticNetworkEvent {
  timestamp: string
  event: string
  method: string | null
  url: string | null
  status: number | null
  error: string | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function dateValue(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString()
  if (typeof value === 'string' && value.length > 0) return value
  return new Date().toISOString()
}

export function sanitizeDiagnosticText(value: string): string {
  return value
    .replace(sensitiveQueryValue, '$1[REDACTED]')
    .replace(secretAssignment, '$1[REDACTED]')
    .replace(emailAddress, '[REDACTED_EMAIL]')
    .slice(0, 4_000)
}

export function sanitizeUrl(value: string): string {
  try {
    const url = new URL(value)
    if (url.username || url.password) {
      url.username = ''
      url.password = ''
    }
    for (const key of url.searchParams.keys()) {
      if (secretName.test(key) || /^email$/i.test(key)) url.searchParams.set(key, '[REDACTED]')
    }
    return sanitizeDiagnosticText(url.toString())
  } catch {
    return sanitizeDiagnosticText(value)
  }
}

export function safeFileSegment(value: string): string {
  const safe = sanitizeDiagnosticText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
  return safe || 'unknown'
}

export function summarizeLogEvent(value: unknown): DiagnosticLog {
  const entry = asRecord(value)
  const text = stringValue(entry.text) ?? ''
  return {
    timestamp: dateValue(entry.timestamp),
    level: stringValue(entry.level) ?? 'info',
    type: stringValue(entry.type) ?? 'unknown',
    text: sanitizeDiagnosticText(text),
  }
}

export function summarizeNetworkEvent(eventName: string, value: unknown): DiagnosticNetworkEvent {
  const entry = asRecord(value)
  const request = asRecord(entry.request)
  const response = asRecord(entry.response)
  const status = response.status
  const method = stringValue(request.method)
  const url = stringValue(request.url)
  const errorText = stringValue(entry.errorText) ?? stringValue(entry.error)

  return {
    timestamp: dateValue(entry.timestamp),
    event: eventName,
    method,
    url: url ? sanitizeUrl(url) : null,
    status: typeof status === 'number' ? status : null,
    error: errorText ? sanitizeDiagnosticText(errorText) : null,
  }
}
