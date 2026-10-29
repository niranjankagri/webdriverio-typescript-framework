// Prints a short Markdown report of the JUnit results: totals per browser and, for every
// failing test, its name and the assertion message. CI appends it to the job page
// ($GITHUB_STEP_SUMMARY), so a failure can be read without downloading any artifact.
//
//   node scripts/junit-summary.mjs [directory]     (default: artifacts/test-results)
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ENTITIES = { '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&#xA;': '\n', '&#10;': '\n', '&amp;': '&' }
const decode = (text) => text.replace(/&quot;|&apos;|&lt;|&gt;|&#xA;|&#10;|&amp;/g, (entity) => ENTITIES[entity])
const attribute = (tag, name) => decode(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? '')

/** The test cases of one JUnit document: name, time and failure message (if any). */
export function parseTestCases(xml) {
  const cases = []
  for (const match of xml.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const [, attributes, , inner = ''] = match
    const failure = /<(failure|error)\b([^>]*)/.exec(inner)
    cases.push({
      name: attribute(attributes, 'name'),
      seconds: Number(attribute(attributes, 'time')) || 0,
      skipped: /<skipped\b/.test(inner),
      failure: failure ? attribute(failure[2], 'message') || failure[1] : null,
    })
  }
  return cases
}

/** The Markdown report for a set of { file, cases }. */
export function summarize(results) {
  if (!results.length) return '### Browser tests\n\nNo JUnit results were written (the run stopped before any test).\n'
  const lines = ['### Browser tests', '', '| Results file | Passed | Failed | Skipped |', '|---|---|---|---|']
  const failures = []
  for (const { file, cases } of results) {
    const failed = cases.filter((c) => c.failure)
    const skipped = cases.filter((c) => c.skipped)
    lines.push(`| ${file} | ${cases.length - failed.length - skipped.length} | ${failed.length} | ${skipped.length} |`)
    for (const c of failed) failures.push({ file, ...c })
  }
  if (!failures.length) return `${lines.join('\n')}\n\nAll tests passed.\n`
  lines.push('', '#### Failures', '')
  for (const f of failures) {
    // The first lines of the message say what was expected and what the page showed.
    const message = f.failure.split('\n').filter(Boolean).slice(0, 4).join('\n')
    lines.push(`- **${f.name}** (${f.file})`, '', '  ```', ...message.split('\n').map((l) => `  ${l}`), '  ```', '')
  }
  lines.push('Screenshots and `run.json` (console and network summaries) are in the `evidence-<browser>` artifact, under `failures/`.')
  return `${lines.join('\n')}\n`
}

async function main(directory) {
  let names = []
  try {
    names = (await readdir(directory)).filter((n) => n.endsWith('.xml')).sort()
  } catch {
    // no results directory: summarize() says so
  }
  const results = []
  for (const file of names) results.push({ file, cases: parseTestCases(await readFile(join(directory, file), 'utf8')) })
  process.stdout.write(summarize(results))
}

// Run main() only when started as a script, not when the tests import this module.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main(process.argv[2] ?? 'artifacts/test-results')
