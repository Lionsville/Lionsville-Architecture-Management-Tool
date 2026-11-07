// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { Mark, MARK_KINDS } from './Mark'

afterEach(cleanup)

describe('Mark', () => {
  it('is the closed set the design system lists', () => {
    expect(MARK_KINDS).toEqual([
      'managed', 'partial', 'risk', 'none', 'unset', 'fix', 'review', 'note',
      'cov-apps', 'cov-moving', 'cov-people', 'cov-none', 'agree', 'agent', 'look', 'exception',
    ])
  })

  it('draws every kind in tokens, never a literal colour', () => {
    const { container } = renderShell(<>{MARK_KINDS.map((kind) => <Mark key={kind} kind={kind} />)}</>)
    const painted = [...container.querySelectorAll('svg *')].flatMap((part) => [part.getAttribute('fill'), part.getAttribute('stroke')])
    for (const paint of painted) {
      if (paint !== null && paint !== 'none') expect(paint).toMatch(/^var\(--[a-z0-9-]+\)$/)
    }
  })

  it('tells the kinds of a family apart by shape, so it reads in greyscale', () => {
    const { container } = renderShell(<>{MARK_KINDS.map((kind) => <Mark key={kind} kind={kind} />)}</>)
    const shape = (kind: string) => (container.querySelector(`[data-kind="${kind}"]`)?.innerHTML ?? '').replace(/var\(--[a-z0-9-]+\)/g, '')
    for (const family of [['managed', 'partial', 'risk', 'none', 'unset'], ['fix', 'review', 'note'], ['cov-apps', 'cov-moving', 'cov-people', 'cov-none']]) {
      expect(new Set(family.map(shape)).size).toBe(family.length)
    }
  })

  it('is named where it stands alone, and out of the tree beside a word', async () => {
    renderShell(<>
      <Mark kind="risk" label="At risk" size={12} />
      <span><Mark kind="fix" /> Fix this</span>
    </>)
    const named = screen.getByRole('img', { name: 'At risk' })
    expect(named.dataset.size).toBe('12')
    expect(document.querySelector('[data-kind="fix"]')?.getAttribute('aria-hidden')).toBe('true')
    expect(await axeFindings()).toEqual([])
  })
})
