// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What an automated accessibility check finds on the screen a test drew.
 *
 * axe-core, run over the document a jsdom test rendered, against the WCAG 2.0
 * and 2.1 success criteria at levels A and AA and nothing else — the level the
 * accessibility statement speaks about, so a finding here is a finding there.
 * The answer is a list of sentences, one per element that fails a rule, so a
 * test says `expect(await axeFindings()).toEqual([])` and a failure reads as
 * what to fix rather than as a count.
 *
 * Two rules are off, each for a reason jsdom gives rather than a choice:
 *
 * - `color-contrast` needs the colours the browser painted, and jsdom lays
 *   nothing out; axe answers "incomplete" for every text node. The contrast of
 *   the theme's own pairs is computed in `app/theme.contrast.test.ts` instead.
 * - `target-size` is WCAG 2.2, not 2.1, and measures boxes jsdom never sizes.
 *
 * The whole document by default, because a dialog, a menu and a popover are
 * portalled to `body` and a check over the test's container would never see
 * them.
 */
import axe from 'axe-core'

const LEVELS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

const OFF_UNDER_JSDOM = {
  'color-contrast': { enabled: false },
  'target-size': { enabled: false },
}

/** One element failing one rule, said the way a person fixing it wants to read it. */
function sentence(rule: axe.Result, node: axe.NodeResult): string {
  const where = node.target.map(String).join(' ')
  const html = node.html.length > 140 ? `${node.html.slice(0, 140)}…` : node.html
  return `${rule.id}: ${rule.help} — ${where} ${html}`
}

/**
 * Every WCAG 2.1 A/AA violation axe finds under `root`, one sentence each.
 * Empty is accessible as far as a machine can tell, which is not the whole of
 * accessible: the keyboard audit is the other half.
 */
export async function axeFindings(root: Element = document.body): Promise<string[]> {
  const result = await axe.run(root, {
    runOnly: { type: 'tag', values: LEVELS },
    rules: OFF_UNDER_JSDOM,
    resultTypes: ['violations'],
  })
  return result.violations.flatMap((rule) => rule.nodes.map((node) => sentence(rule, node)))
}
