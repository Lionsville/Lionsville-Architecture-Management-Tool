// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, screen, waitFor } from '@testing-library/react'
import { renderShell } from '../testing/renderShell'
import { DraftQuestion, useDraft } from '../../widgets/kit/drafts'
import type { HostCommand } from '../../platform/hostCommands'
import { ClosingSaving } from './ClosingSaving'

afterEach(() => cleanup())

function stream() {
  const listeners = new Set<(command: HostCommand) => void>()
  return {
    on: (listener: (command: HostCommand) => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    send: (command: HostCommand) => { act(() => { for (const listener of listeners) listener(command) }) },
  }
}

describe('the page’s half of a closing window', () => {
  it('says Saving… while the window waits for a write, and stops where it was kept open', async () => {
    const host = stream()
    renderShell(<ClosingSaving on={host.on} />)
    host.send({ type: 'closing', saving: true })
    expect(await screen.findByText('The window closes as soon as your changes are written.')).toBeTruthy()
    host.send({ type: 'closing', saving: false })
    await waitFor(() => { expect(screen.queryByText('The window closes as soon as your changes are written.')).toBeNull() })
  })

  it('lets the window go at once where no draft is held by the time it is asked', () => {
    const host = stream()
    const leave = vi.fn()
    renderShell(<ClosingSaving on={host.on} leave={leave} />)
    host.send({ type: 'closeAsked' })
    expect(leave).toHaveBeenCalledTimes(1)
  })

  it('asks its own question over a draft, and lets the window go only where the person leaves it', async () => {
    const host = stream()
    const leave = vi.fn()
    renderShell(<><DraftQuestion /><ClosingSaving on={host.on} leave={leave} /></>)
    const draft = renderHook(() => useDraft(true))
    host.send({ type: 'closeAsked' })
    expect(await screen.findByTestId('draft-question')).toBeTruthy()
    expect(leave).not.toHaveBeenCalled()
    act(() => { screen.getByTestId('draft-leave').click() })
    expect(leave).toHaveBeenCalledTimes(1)
    draft.unmount()
  })
})
