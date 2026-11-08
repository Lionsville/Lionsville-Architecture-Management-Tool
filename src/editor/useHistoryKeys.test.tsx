// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/** ⌘Z on a place with no canvas: the same three chords, on the same terms. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { EditorHistory } from './props'
import { useHistoryKeys } from './useHistoryKeys'

afterEach(() => cleanup())

function Place({ history, readOnly = false }: { history: EditorHistory; readOnly?: boolean }) {
  const ref = useHistoryKeys(history, readOnly)
  return <div ref={ref} data-testid="place"><input aria-label="field" /></div>
}

function mount(over: Partial<EditorHistory> = {}, readOnly = false) {
  const history = { undo: vi.fn(), redo: vi.fn(), canUndo: true, canRedo: true, ...over }
  const view = render(<Place history={history} readOnly={readOnly} />)
  // jsdom lays nothing out: a rect says the place is on screen.
  view.getByTestId('place').getClientRects = () => [{}] as unknown as DOMRectList
  return { history, ...view }
}

// jsdom's platform is neither Mac nor Windows, and its Mod is Ctrl.
const mod = { ctrlKey: true }

describe('useHistoryKeys', () => {
  it('undoes and redoes from the place itself and from nowhere in particular', () => {
    const { history, getByTestId } = mount()
    fireEvent.keyDown(getByTestId('place'), { key: 'z', ...mod })
    expect(history.undo).toHaveBeenCalledOnce()
    fireEvent.keyDown(document.body, { key: 'z', shiftKey: true, ...mod })
    expect(history.redo).toHaveBeenCalledOnce()
  })

  it('leaves a field its keys, the host its menu, and read-only nothing to step', () => {
    const typed = mount()
    fireEvent.keyDown(typed.getByLabelText('field'), { key: 'z', ...mod })
    expect(typed.history.undo).not.toHaveBeenCalled()
    cleanup()
    const owned = mount({ keysOwnedByHost: true })
    fireEvent.keyDown(owned.getByTestId('place'), { key: 'z', ...mod })
    expect(owned.history.undo).not.toHaveBeenCalled()
    cleanup()
    const read = mount({}, true)
    fireEvent.keyDown(read.getByTestId('place'), { key: 'z', ...mod })
    expect(read.history.undo).not.toHaveBeenCalled()
  })
})
