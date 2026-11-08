// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every way from one record page to another that the host hands a page — a
 * decision's *Decided for* and *Linked to*, History…, an observation's plan, a
 * report's element — passes no frame, so the frame's guard never hears it. Each
 * is handed over already asking about a draft (`guarded`, `kit/drafts`). A new
 * `onOpen…` wired here without it drops a comment being written with no
 * question, and fails this test.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./WorkspacePages.tsx', import.meta.url)), 'utf8')

/** Each `onOpen…` handed to a page, as a prop or a key, with what it is given up to the end of the next line. */
function handedOver(text: string): { name: string; given: string }[] {
  const found: { name: string; given: string }[] = []
  const lines = text.split('\n')
  lines.forEach((line, at) => {
    for (const match of line.matchAll(/\b(onOpen[A-Z]\w*)(?:=\{|: )/g)) {
      const rest = line.slice((match.index ?? 0) + match[0].length)
      found.push({ name: match[1]!, given: `${rest}\n${lines[at + 1] ?? ''}` })
    }
  })
  return found
}

describe('the ways between record pages', () => {
  it('finds the ways it guards', () => {
    const names = handedOver(source).map((one) => one.name)
    expect(names).toEqual(expect.arrayContaining(['onOpenSolution', 'onOpenPlan', 'onOpenHistory', 'onOpenDecision', 'onOpenElement']))
  })

  it.each(handedOver(source).map((one) => [one.name, one.given] as const))('hands %s over through the draft guard', (_name, given) => {
    // `guarded(` before the first arrow: the guard wraps the move, not a move that then asks.
    const arrow = given.indexOf('=>')
    const guard = given.indexOf('guarded(')
    expect(guard).toBeGreaterThanOrEqual(0)
    if (arrow >= 0) expect(guard).toBeLessThan(arrow)
  })
})
