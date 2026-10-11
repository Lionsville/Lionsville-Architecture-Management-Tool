// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The observations page's one dialog shell, and the dialogs drawn in it as a
 * person meets them: a click beside it never loses what is written, Escape
 * does not once something is, Enter answers it from a single-line field, and
 * a submit pressed too early says what is missing rather than being greyed out.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import TextField from '@mui/material/TextField'
import { translator } from '../../i18n'
import { newCause } from '../observation'
import { renderShell } from '../../app/testing/renderShell'
import { FormDialog } from './FormDialog'
import { AddressDialog, DropDialog, NewExperimentDialog } from './SolutionDialogs'
import { VerifyDialog } from './ObservationDialogs'

afterEach(() => cleanup())

const s = translator('en')

function shell(over: { dirty?: boolean; problem?: string; onEnter?: () => void } = {}) {
  const onCancel = vi.fn()
  const onSubmit = vi.fn()
  renderShell(
    <FormDialog open title="Ask" intro="Why?" dirty={over.dirty} onCancel={onCancel} onSubmit={onSubmit} submitLabel="Answer" problem={over.problem} s={s}>
      <TextField label="One line" slotProps={{ htmlInput: { 'data-testid': 'one' } }} />
      <TextField label="Several" multiline slotProps={{ htmlInput: { 'data-testid': 'several' } }} />
      <TextField
        label="Own" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); over.onEnter?.() } }}
        slotProps={{ htmlInput: { 'data-testid': 'own' } }}
      />
    </FormDialog>,
  )
  return { onCancel, onSubmit }
}

const container = () => document.querySelector<HTMLElement>('.MuiDialog-container')!

describe('the form shell', () => {
  it('is named by its title, with Cancel left of the submit, in sentence case', () => {
    shell()
    const dialog = screen.getByRole('dialog', { name: 'Ask' })
    expect(within(dialog).getAllByRole('button').map((one) => one.textContent)).toEqual(['Cancel', 'Answer'])
    expect(dialog.textContent).toContain('Why?')
  })

  it('does not close on a click beside it', () => {
    const { onCancel } = shell()
    fireEvent.mouseDown(container())
    fireEvent.click(container())
    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Ask' })).toBeTruthy()
  })

  it('closes on Escape while nothing is written, and not once something is', () => {
    const clean = shell()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(clean.onCancel).toHaveBeenCalledTimes(1)
    cleanup()
    const dirty = shell({ dirty: true })
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(dirty.onCancel).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(dirty.onCancel).toHaveBeenCalledTimes(1)
  })

  it('answers on Enter from a single-line field, not from several lines nor a field that takes Enter itself', () => {
    const onEnter = vi.fn()
    const { onSubmit } = shell({ onEnter })
    fireEvent.keyDown(screen.getByTestId('several'), { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByTestId('own'), { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onEnter).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(screen.getByTestId('one'), { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('says what stops the submit at the footer’s left, and nothing while nothing does', () => {
    shell()
    expect(screen.queryByRole('alert')).toBeNull()
    cleanup()
    shell({ problem: '1 field needs filling in.' })
    expect(screen.getByRole('alert').textContent).toBe('1 field needs filling in.')
  })
})

describe('the dialogs in it', () => {
  it('plans an experiment once its title and hypothesis are said, and says which are missing when pressed early', () => {
    const onCreate = vi.fn()
    renderShell(<NewExperimentDialog subject={{ id: 's1', label: 'SO-0001 One desk' }} onCancel={() => {}} onCreate={onCreate} s={s} />)
    expect(screen.getByRole('dialog', { name: 'Plan an experiment for SO-0001 One desk' })).toBeTruthy()
    expect(screen.getByText('What is tried, in a few words. e.g. Two weeks at one desk')).toBeTruthy()
    fireEvent.click(screen.getByTestId('new-experiment-create'))
    expect(onCreate).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('2 fields need filling in.')
    expect(screen.getByText('Say what the experiment is.')).toBeTruthy()
    fireEvent.change(screen.getByTestId('new-experiment-title'), { target: { value: 'Two weeks at one desk' } })
    fireEvent.change(screen.getByTestId('new-experiment-hypothesis'), { target: { value: 'If one desk, then fewer calls' } })
    fireEvent.keyDown(screen.getByTestId('new-experiment-title'), { key: 'Enter' })
    expect(onCreate).toHaveBeenCalledWith({ title: 'Two weeks at one desk', hypothesis: 'If one desk, then fewer calls', measure: '' })
  })

  it('addresses a cause picked from the same list the link dialog has, with its strength', () => {
    const onConfirm = vi.fn()
    const causes = [1, 2].map((number) => ({ ...newCause({ id: `c${number}`, number, title: `Cause ${number}`, t: s }), root: true as const }))
    renderShell(<AddressDialog subject={{ id: 's1', label: 'SO-0001' }} candidates={causes} onCancel={() => {}} onConfirm={onConfirm} s={s} />)
    fireEvent.click(screen.getByRole('button', { name: 'Address' }))
    expect(screen.getByRole('alert').textContent).toBe('Choose a root cause to address.')
    fireEvent.change(screen.getByRole('textbox', { name: 'Find a cause by number or words' }), { target: { value: 'Cause 2' } })
    fireEvent.click(screen.getByRole('radio', { name: /Cause 2/ }))
    expect(screen.getByRole('combobox', { name: 'Strength' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Address' }))
    expect(onConfirm).toHaveBeenCalledWith({ causeId: 'c2', strength: 'strong' })
  })

  it('asks why a solution is dropped, and what confirmed a cause, before it takes the answer', () => {
    const onDrop = vi.fn()
    renderShell(<DropDialog subject={{ id: 's1', label: 'SO-0001' }} onCancel={() => {}} onConfirm={onDrop} s={s} />)
    fireEvent.click(screen.getByTestId('drop-confirm'))
    expect(onDrop).not.toHaveBeenCalled()
    expect(screen.getByText('Say why it is dropped.')).toBeTruthy()
    cleanup()
    const onVerify = vi.fn()
    renderShell(<VerifyDialog subject={{ id: 'c1', label: 'CA-0001' }} onCancel={() => {}} onConfirm={onVerify} s={s} />)
    expect((screen.getByTestId('verify-answer') as HTMLTextAreaElement).required).toBe(true)
    fireEvent.click(screen.getByTestId('verify-confirm'))
    expect(screen.getByText('Say what confirmed it.')).toBeTruthy()
    fireEvent.change(screen.getByTestId('verify-answer'), { target: { value: 'The logs' } })
    fireEvent.click(screen.getByTestId('verify-confirm'))
    expect(onVerify).toHaveBeenCalledWith('The logs')
  })
})
