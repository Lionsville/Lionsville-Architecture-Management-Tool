// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderShell } from '../testing/renderShell'
import { translator } from '../../i18n'
import type { Principle } from '../../model/principle'
import type { ScopePrinciples } from '../../projects/scopeIndex'
import { principleCounts, PrinciplesCard } from './PrinciplesCard'

afterEach(cleanup)

const one = (id: string, over: Partial<Principle> = {}): Principle => ({
  id, number: 1, title: id, statement: '', aspects: [{ id: 'a', number: 1, text: 'x', nature: 'design' }], lastAspect: 1,
  groups: [], regime: 'flexible', status: 'accepted', ...over,
})
const at: Record<string, ScopePrinciples> = {
  '': { principles: [one('org-1'), one('org-2', { status: 'retired' })], groups: [] },
  acme: { principles: [one('acme-1'), one('acme-2', { mergedInto: 'acme-1' })], groups: [] },
  'acme/rail': { principles: [one('rail-1'), one('rail-2', { status: 'candidate' })], groups: [] },
}
const principlesAt = (path: string) => at[path] ?? { principles: [], groups: [] }

describe('the Principles card (ADR-0041 §12)', () => {
  it('counts the scope\'s own standing principles and those in force from above, retired and absorbed ones left out', () => {
    expect(principleCounts('acme/rail', principlesAt)).toEqual({ own: 2, inForce: 4 })
    expect(principleCounts('', principlesAt)).toEqual({ own: 1, inForce: 1 })
    expect(principleCounts('elsewhere', principlesAt)).toEqual({ own: 0, inForce: 1 })
  })

  it('counts a topic\'s principles in force where the topic is relevant, once (ADR-0042 §4)', () => {
    const withTopic = (path: string) => (path === 'topics/security' ? { principles: [one('sec-1'), one('sec-2')], groups: [] } : principlesAt(path))
    expect(principleCounts('acme/rail', withTopic, ['topics/security', 'acme'])).toEqual({ own: 2, inForce: 6 })
  })

  it('says how many, and opens the page', () => {
    const onOpen = vi.fn()
    renderShell(<PrinciplesCard at="acme/rail" principlesAt={principlesAt} onOpen={onOpen} s={translator('en')} />)
    expect(screen.getByText('2 here · 4 in force')).toBeTruthy()
    fireEvent.click(screen.getByTestId('open-principles'))
    expect(onOpen).toHaveBeenCalled()
  })

  it('says none is written where nothing is in force', () => {
    renderShell(<PrinciplesCard at="x" principlesAt={() => ({ principles: [], groups: [] })} onOpen={() => {}} s={translator('en')} />)
    expect(screen.getByText('None written yet')).toBeTruthy()
  })
})
