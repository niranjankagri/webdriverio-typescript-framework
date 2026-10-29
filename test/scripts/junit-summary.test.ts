import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
// @ts-expect-error -- a plain JavaScript module (scripts/ is not compiled), used here as is
import { parseTestCases, summarize } from '../../scripts/junit-summary.mjs'

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="3" failures="1" errors="0" skipped="1">
  <testsuite name="the bag" tests="3" failures="1" errors="0" skipped="1">
    <testcase classname="chrome.the_bag" name="TC 105 smoke starts empty" time="0.4"/>
    <testcase classname="chrome.the_bag" name="TC 104 regression adds up" time="1.2">
      <failure message="Expect $(\`#cart-total\`) to have text&#xA;&#xA;Expected: &quot;Total $60.97&quot;&#xA;Received: &quot;Total $47.98&quot;"/>
      <system-out><![CDATA[COMMAND: GET /session/...]]></system-out>
    </testcase>
    <testcase classname="chrome.the_bag" name="TC 106 regression one item" time="0"><skipped/></testcase>
  </testsuite>
</testsuites>`

describe('junit-summary', () => {
  it('reads every test case with its failure message decoded', () => {
    const cases = parseTestCases(xml)
    assert.equal(cases.length, 3)
    assert.equal(cases[0].failure, null)
    assert.equal(cases[1].failure, 'Expect $(`#cart-total`) to have text\n\nExpected: "Total $60.97"\nReceived: "Total $47.98"')
    assert.equal(cases[2].skipped, true)
  })

  it('reports totals and each failure with expected and received values', () => {
    const report = summarize([{ file: 'results-chrome.xml', cases: parseTestCases(xml) }])
    assert.match(report, /\| results-chrome.xml \| 1 \| 1 \| 1 \|/)
    assert.match(report, /- \*\*TC 104 regression adds up\*\* \(results-chrome.xml\)/)
    assert.match(report, /Expected: "Total \$60.97"\n {2}Received: "Total \$47.98"/)
    assert.match(report, /evidence-<browser>/)
  })

  it('says when all tests passed, and when there are no results at all', () => {
    const passed = summarize([{ file: 'results-firefox.xml', cases: [{ name: 'TC 101', seconds: 1, skipped: false, failure: null }] }])
    assert.match(passed, /All tests passed\./)
    assert.match(summarize([]), /No JUnit results were written/)
  })
})
