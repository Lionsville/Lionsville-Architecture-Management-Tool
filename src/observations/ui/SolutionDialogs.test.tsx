// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { translator } from '../../i18n'
import { renderShell } from '../../app/testing/renderShell'
import type { Cause } from '../observation'
import { NewSolutionDialog } from './SolutionDialogs'

afterEach(cleanup)

const s = translator('en')
const cause = (id: string): Cause => ({ id, number: 1, title: 'The evening crew leaves before the last truck', root: true }) as Cause

function dialog(causes: readonly Cause[], causeId: string, onCreate = vi.fn()) {
  return <NewSolutionDialog open causes={causes} causeId={causeId} onCancel={() => {}} onCreate={onCreate} renderMarkdown={(md) => md} s={s} />
}

describe('the new solution form', () => {
  it('keeps what is being typed when the causes are read again under it, and starts afresh for another cause', () => {
    const onCreate = vi.fn()
    const view = renderShell(dialog([cause('ca-1')], 'ca-1', onCreate))
    const title = () => screen.getByRole('textbox', { name: /^Title/ })
    fireEvent.change(title(), { target: { value: 'One dock schedule' } })
    // The tree read again: the same causes in a new list, as every step of a colleague's hands them.
    view.rerender(dialog([cause('ca-1')], 'ca-1', onCreate))
    expect((title() as HTMLInputElement).value).toBe('One dock schedule')
    fireEvent.click(screen.getByTestId('new-solution-create'))
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ title: 'One dock schedule', addresses: [{ id: 'ca-1', strength: 'strong' }] }))
    view.rerender(dialog([cause('ca-1'), cause('ca-2')], 'ca-2', onCreate))
    expect((title() as HTMLInputElement).value).toBe('')
  })
})
