// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAgentDialogFollowsPlace } from './AppFrame'

function server(dialogOpen: boolean, closeDialog: () => void) {
  return { agentServer: { dialogOpen, closeDialog } } as unknown as Parameters<typeof useAgentDialogFollowsPlace>[0]
}

describe('the agent dialog and the place it was opened on', () => {
  it('stays open where it was opened, and shuts once the person goes elsewhere', () => {
    const close = vi.fn()
    const { rerender } = renderHook(({ open, place }) => useAgentDialogFollowsPlace(server(open, close), place), {
      initialProps: { open: false, place: 'agents' },
    })
    // The agents address lands on the home and opens the dialog in one go.
    rerender({ open: true, place: 'home' })
    rerender({ open: true, place: 'home' })
    expect(close).not.toHaveBeenCalled()
    rerender({ open: true, place: 'roadmap' })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('asks nothing of a dialog that is shut', () => {
    const close = vi.fn()
    const { rerender } = renderHook(({ place }) => useAgentDialogFollowsPlace(server(false, close), place), { initialProps: { place: 'a' } })
    rerender({ place: 'b' })
    expect(close).not.toHaveBeenCalled()
  })
})
