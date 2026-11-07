// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/** Where a record stands, the one next question, what holds it, and the sentence when it is over. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { NextStep, StepLadder } from './NextStep'
import type { Step } from './NextStep'

afterEach(() => cleanup())

const STEPS: Step[] = [
  { id: 'proposed', label: 'Proposed', state: 'done' },
  { id: 'review', label: 'Under review', state: 'current' },
  { id: 'accepted', label: 'Accepted', state: 'todo' },
]

describe('next step', () => {
  it('says where it stands in words, with the current one marked for a screen reader', () => {
    renderShell(<StepLadder steps={STEPS} />)
    expect(screen.getByRole('list', { name: 'Where it stands' })).toBeTruthy()
    expect(screen.getByText('Under review').closest('li')?.getAttribute('aria-current')).toBe('step')
    expect(screen.getByText('Proposed').closest('li')?.textContent).toContain('done')
  })

  it('lays the steps down a preview’s facts as well as along a card', () => {
    renderShell(<StepLadder steps={STEPS} orientation="down" label="Where it stands now" />)
    expect(screen.getByRole('list', { name: 'Where it stands now' }).dataset.orientation).toBe('down')
  })

  it('asks one question with its verb', () => {
    const onPress = vi.fn()
    renderShell(<NextStep steps={STEPS} question="Is this accepted?" actions={[{ label: 'Accept', onPress, primary: true }]} />)
    expect(screen.getByText('Is this accepted?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(onPress).toHaveBeenCalled()
  })

  it('holds a held verb, says how many in words, and every hold goes somewhere', () => {
    const onPress = vi.fn()
    const toFix = vi.fn()
    renderShell(
      <NextStep
        question="Is this accepted?" actions={[{ label: 'Accept', onPress, held: true }, { label: 'Reject…', onPress: () => undefined }]}
        holds={[{ label: 'Consequences are empty', onPress: toFix }, { label: 'No reviewer has signed' }]}
      />,
    )
    const accept = screen.getByRole('button', { name: 'Accept' })
    expect(accept.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(accept)
    expect(onPress).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Reject…' }).getAttribute('aria-disabled')).toBeNull()
    expect(screen.getByText('2 holding it')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Consequences are empty' }))
    expect(toFix).toHaveBeenCalled()
    expect(screen.getByText('No reviewer has signed')).toBeTruthy()
  })

  it('lets a held verb go once nothing holds it', () => {
    const onPress = vi.fn()
    renderShell(<NextStep question="Q" actions={[{ label: 'Accept', onPress, held: true }]} holds={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(onPress).toHaveBeenCalled()
  })

  it('is one sentence once the life has ended, with no card', () => {
    renderShell(<NextStep steps={STEPS} question="Q" actions={[{ label: 'Accept', onPress: () => undefined }]} ended="Accepted 10 Feb 2026." />)
    expect(screen.getByText('Accepted 10 Feb 2026.')).toBeTruthy()
    expect(screen.queryByText('Q')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('still reads for somebody who may not act: the screen hands in no verbs', () => {
    renderShell(<NextStep question="Is this accepted?" />)
    expect(screen.getByText('Is this accepted?')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('goes in a preview’s foot without its box', () => {
    const { container } = renderShell(<NextStep inline question="Why does this happen?" actions={[{ label: 'Ask why', primary: true, onPress: () => undefined }]} />)
    expect(container.querySelector('.kit-next__card')).toBeNull()
    expect(screen.getByRole('button', { name: 'Ask why' })).toBeTruthy()
  })

  it('passes axe', async () => {
    renderShell(<NextStep steps={STEPS} question="Q" actions={[{ label: 'Accept', onPress: () => undefined, held: true }]} holds={[{ label: 'One', onPress: () => undefined }]} />)
    expect(await axeFindings()).toEqual([])
  })
})
