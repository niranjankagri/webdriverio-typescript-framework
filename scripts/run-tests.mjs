import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'

const projectDirectory = process.cwd()
const cliPath = 'node_modules/@wdio/cli/bin/wdio.js'

function findAvailablePort() {
  return new Promise((resolvePort, rejectPort) => {
    const probe = createServer()
    probe.once('error', rejectPort)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      if (!address || typeof address === 'string') {
        probe.close(() => rejectPort(new Error('Could not determine a local port for the demo server.')))
        return
      }
      probe.close((error) => error ? rejectPort(error) : resolvePort(address.port))
    })
  })
}

function startDemoServer(port) {
  const server = spawn(process.execPath, ['--import', 'tsx', 'src/demo/server.ts'], {
    cwd: projectDirectory,
    env: { ...process.env, PORT: String(port) },
    stdio: 'inherit',
  })
  return server
}

async function waitForHealth(server, baseUrl) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Demo server exited before becoming ready (exit ${server.exitCode}).`)
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(800) })
      if (response.ok) {
        console.info(`Demo server ready at ${baseUrl}`)
        return
      }
    } catch {
      // The server is still starting. Retry until the readiness deadline.
    }
    await delay(150)
  }

  throw new Error(`Demo server did not become healthy at ${baseUrl} within 10 seconds.`)
}

async function stopDemoServer(server) {
  if (server.exitCode !== null) return

  await new Promise((resolveStop) => {
    const timeout = setTimeout(() => {
      server.kill()
      resolveStop()
    }, 3_000)
    server.once('exit', () => {
      clearTimeout(timeout)
      resolveStop()
    })
    server.kill('SIGTERM')
  })
}

function runWebdriverIO(baseUrl) {
  return new Promise((resolveCode, rejectRun) => {
    const runner = spawn(process.execPath, [cliPath, 'run', './wdio.conf.ts'], {
      cwd: projectDirectory,
      env: { ...process.env, BASE_URL: baseUrl },
      stdio: 'inherit',
    })
    runner.once('error', rejectRun)
    runner.once('exit', (code) => resolveCode(code ?? 1))
  })
}

let demoServer
try {
  let baseUrl = process.env.BASE_URL
  if (!baseUrl) {
    const port = process.env.PORT ? Number(process.env.PORT) : await findAvailablePort()
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error(`PORT must be an integer between 1 and 65535; received "${process.env.PORT}".`)
    }
    baseUrl = `http://127.0.0.1:${port}`
    demoServer = startDemoServer(port)
    await waitForHealth(demoServer, baseUrl)
  }

  process.exitCode = await runWebdriverIO(baseUrl)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  if (demoServer) await stopDemoServer(demoServer)
}
