// WebdriverIO's JUnit reporter writes one file per spec worker: results-<cid>-<browser>.xml.
// Tools that read "one file = one run" (Quality Intelligence, many CI dashboards) would then see a
// single test run as several. mergeJUnitFiles() combines the files of each browser into one
// results-<browser>.xml with every <testsuite> under one <testsuites>, and removes the parts.
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const PART = /^results-(\d+-\d+)-(.+)\.xml$/

/** The <testsuite> elements of one JUnit file, as text. */
export function testSuitesOf(xml) {
  return xml.match(/<testsuite[\s>][\s\S]*?<\/testsuite>/g) ?? []
}

/** Adds up an attribute (tests, failures, errors, skipped) over the given <testsuite> elements. */
function total(suites, attribute) {
  let sum = 0
  for (const suite of suites) {
    const match = suite.match(new RegExp(`^<testsuite[^>]*\\s${attribute}="(\\d+)"`))
    sum += match ? Number(match[1]) : 0
  }
  return sum
}

/** One JUnit document with all the given suites. */
export function mergeSuites(suites) {
  const counts = ['tests', 'failures', 'errors', 'skipped'].map((name) => `${name}="${total(suites, name)}"`).join(' ')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites ${counts}>\n  ${suites.join('\n  ')}\n</testsuites>\n`
}

/**
 * Merges the per-worker files in a directory into one file per browser.
 * @returns {Promise<string[]>} the files written
 */
export async function mergeJUnitFiles(directory) {
  let names
  try {
    names = await readdir(directory)
  } catch {
    return [] // no results (for example the run failed before any test started)
  }
  // Group the parts by browser, keeping the worker order (0-0, 0-1, ...).
  const byBrowser = new Map()
  for (const name of names.sort()) {
    const match = PART.exec(name)
    if (!match) continue
    const browser = match[2]
    if (!byBrowser.has(browser)) byBrowser.set(browser, [])
    byBrowser.get(browser).push(name)
  }
  const written = []
  for (const [browser, parts] of byBrowser) {
    const suites = []
    for (const part of parts) suites.push(...testSuitesOf(await readFile(join(directory, part), 'utf8')))
    const target = join(directory, `results-${browser}.xml`)
    await writeFile(target, mergeSuites(suites), 'utf8')
    for (const part of parts) await rm(join(directory, part))
    written.push(target)
  }
  return written
}

/** Removes the result files of earlier runs, so a new run never mixes with old results. */
export async function clearJUnitFiles(directory) {
  let names
  try {
    names = await readdir(directory)
  } catch {
    return
  }
  for (const name of names) if (name.endsWith('.xml')) await rm(join(directory, name))
}
