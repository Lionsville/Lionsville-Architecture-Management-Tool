// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { madrTemplate } from './adr'
import { EN } from './strings/en'
import { joinSections, sectionOfGate, shownText, splitSections, templateTexts, withText, writtenBody } from './adrSections'

const t = ((key: keyof typeof EN, values?: Record<string, unknown>) => String(EN[key]).replace('{n}', String(values?.n ?? ''))) as never

describe('a body cut into sections', () => {
  it('puts every body back to the character', () => {
    for (const body of [madrTemplate(t), '', 'No heading.\n', 'Before\n\n## One\n\ntext\n### Two\nmore', '## A\n```\n## not one\n```\n']) {
      expect(joinSections(splitSections(body))).toBe(body)
    }
  })

  it('does not take a heading in a fenced block for one', () => {
    expect(splitSections('## A\n```\n## not one\n```\n').map((one) => one.name)).toEqual(['A'])
  })

  it('keeps the next heading on its own line whatever was typed', () => {
    const sections = splitSections('## A\n\nold\n\n## B\n\nb\n')
    const body = joinSections(withText(sections, 0, 'new'))
    expect(body).toBe('## A\n\nnew\n\n## B\n\nb\n')
    expect(splitSections(body).map((one) => one.name)).toEqual(['A', 'B'])
  })

  it('shows what was written without the file\'s blank lines', () => {
    expect(shownText(splitSections('## A\n\nsome\ntext\n\n')[0]!)).toBe('some\ntext')
  })

  it('knows the template\'s own text, heading by heading', () => {
    expect(templateTexts(t).get('Decision Drivers')).toContain('A force')
  })

  it('reads only what was written: the template and empty sections are left out', () => {
    const body = madrTemplate(t).replace('## Context and Problem Statement\n\n', '## Context and Problem Statement\n\nRates are copied by hand.\n\n')
    const read = writtenBody(body, t)
    expect(read).toContain('Rates are copied by hand.')
    expect(read).not.toContain('Decision Drivers')
    expect(read).not.toContain('Option 1')
    expect(writtenBody('## Mine\n\nkept\n\n## Empty\n', t)).toBe('## Mine\n\nkept\n\n')
  })

  it('finds the section a line of the gate is answered in, shorter headings too', () => {
    const sections = splitSections('## Context\n\na\n\n## Considered Options\n\n* x\n\n## Decision Outcome\n\ny\n\n### Consequences\n\nz\n')
    expect(sectionOfGate(sections, 'context')).toBe(0)
    expect(sectionOfGate(sections, 'options')).toBe(1)
    expect(sectionOfGate(sections, 'outcome')).toBe(2)
    expect(sectionOfGate(sections, 'consequence')).toBe(3)
    expect(sectionOfGate(sections, 'approved')).toBeUndefined()
  })
})
