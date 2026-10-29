import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'
// @ts-expect-error -- a plain JavaScript module (scripts/ is not compiled), used here as is
import { clearJUnitFiles, mergeJUnitFiles } from '../../scripts/merge-junit.mjs'

/** A JUnit file as WebdriverIO's reporter writes it for one spec worker. */
function part(suiteName: string, tests: number, failures: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="${tests}" failures="${failures}" errors="0" skipped="0">
  <testsuite name="${suiteName}" timestamp="2026-10-29T14:01:54" time="1" tests="${tests}" failures="${failures}" errors="0" skipped="0">
    <testcase classname="chrome.the_bag" name="TC 105 smoke starts empty" time="0.1"/>
  </testsuite>
</testsuites>
`
}

describe('mergeJUnitFiles', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'junit-merge-'))
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('combines the per-worker files of each browser into one run file and removes the parts', async () => {
    await writeFile(join(directory, 'results-0-0-chrome.xml'), part('the bag', 3, 0))
    await writeFile(join(directory, 'results-0-1-chrome.xml'), part('the product catalogue', 2, 1))
    await writeFile(join(directory, 'results-0-0-firefox.xml'), part('the bag', 3, 0))

    await mergeJUnitFiles(directory)

    assert.deepEqual((await readdir(directory)).sort(), ['results-chrome.xml', 'results-firefox.xml'])
    const chrome = await readFile(join(directory, 'results-chrome.xml'), 'utf8')
    assert.match(chrome, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<testsuites tests="5" failures="1" errors="0" skipped="0">/)
    assert.equal((chrome.match(/<testsuite[\s>]/g) ?? []).length, 2)
    assert.ok(chrome.indexOf('the bag') < chrome.indexOf('the product catalogue'), 'worker order kept')
  })

  it('does nothing when there are no results', async () => {
    assert.deepEqual(await mergeJUnitFiles(join(directory, 'missing')), [])
  })

  it('clears the result files of an earlier run', async () => {
    await writeFile(join(directory, 'results-chrome.xml'), part('old run', 1, 0))
    await writeFile(join(directory, 'notes.txt'), 'kept')

    await clearJUnitFiles(directory)

    assert.deepEqual(await readdir(directory), ['notes.txt'])
  })
})
