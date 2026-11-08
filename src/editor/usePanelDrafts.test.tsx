// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/** The board's selection, changed by the person, asks first about a draft on the panel it would put away. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { useState } from 'react'
import { renderShell } from '../app/testing/renderShell'
import { DraftArea, DraftQuestion, draftHeld, useDraft } from '../widgets/kit/drafts'
import { usePanelDrafts } from './usePanelDrafts'
import type { PanelDrafts } from './usePanelDrafts'
import { EMPTY_SELECTION, selectElement } from './useEditorState'
import type { Selection } from './useEditorState'

afterEach(() => cleanup())

function Draft() { useDraft(true); return null }

/** A board's selection and its panel, with a draft on the panel while `writing`. */
function Board({ writing, seen }: { writing: boolean; seen: (panel: PanelDrafts, selection: Selection) => void }) {
  const [selection, setSelection] = useState<Selection>(selectElement('a'))
  const panel = usePanelDrafts({ selection, setSelection })
  seen(panel, selection)
  return <DraftArea surface={panel.surface}>{writing && <Draft />}</DraftArea>
}

function mount(writing: boolean) {
  let panel: PanelDrafts | undefined
  let selection: Selection | undefined
  const seen = vi.fn((p: PanelDrafts, s: Selection) => { panel = p; selection = s })
  renderShell(<><DraftQuestion /><Board writing={writing} seen={seen} /></>)
  return { choose: (next: Selection) => act(() => panel!.choose(next)), selection: () => selection }
}

const asked = () => screen.queryByRole('heading', { name: 'Leave with a draft?' })

describe('the person’s selection on a board', () => {
  it('moves at once with nothing written on the panel', () => {
    const board = mount(false)
    board.choose(selectElement('b'))
    expect(asked()).toBeNull()
    expect(board.selection()).toEqual(selectElement('b'))
  })

  it('asks before another card or the empty board puts the panel away, and Keep writing keeps the selection', () => {
    const board = mount(true)
    board.choose(selectElement('b'))
    // The canvas says a press more than once: asked once.
    board.choose(selectElement('b'))
    expect(screen.getAllByRole('heading', { name: 'Leave with a draft?' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Keep writing' }))
    expect(board.selection()).toEqual(selectElement('a'))
    expect(draftHeld()).toBe(true)
    board.choose(EMPTY_SELECTION)
    fireEvent.click(screen.getByRole('button', { name: 'Leave and drop it' }))
    expect(board.selection()).toEqual(EMPTY_SELECTION)
  })

  it('does not ask about the selection it already has', () => {
    const board = mount(true)
    board.choose(selectElement('a'))
    expect(asked()).toBeNull()
  })
})
