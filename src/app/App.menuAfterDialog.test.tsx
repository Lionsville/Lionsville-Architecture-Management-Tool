// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The ⋯ menu stays shut behind a dialog that *Enter* closed.
 *
 * A dialog opened from the menu hands the focus back to the ⋯ button when it
 * closes, and it closes inside the keydown of the *Enter* that confirmed it.
 * A browser then delivers the same key's keypress to what has the focus now,
 * and a button takes an *Enter* keypress as a press: the menu opened again,
 * behind the next dialog, and stayed open over the page for the whole load.
 *
 * jsdom does not turn a keypress into a click, so `pressEnter` does what the
 * browser does: the keydown to the field, and — unless the keydown's default
 * was prevented, which is what suppresses the keypress in a browser — the
 * keypress to whatever holds the focus after it, pressed where that is a
 * button.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import type { ScopeSnapshot } from '../projects/scope'
import { sealBytes } from '../projects/sealedFile'
import { workingFileBytes } from '../adapters/folder/format/workingFile'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return { ...actual, SolutionDesignEditor: () => <div data-testid="editor" /> }
})

afterEach(() => cleanup())

const project = (name: string, path: string): ScopeSnapshot => ({
  path,
  model: {
    name, elements: [], relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

/** *Enter* on `field`, as a browser delivers it. */
function pressEnter(field: HTMLElement): void {
  const proceeded = fireEvent.keyDown(field, { key: 'Enter', code: 'Enter', keyCode: 13 })
  if (!proceeded) return
  const focused = document.activeElement
  if (!(focused instanceof HTMLElement)) return
  if (fireEvent.keyPress(focused, { key: 'Enter', code: 'Enter', keyCode: 13, charCode: 13 })
    && focused instanceof HTMLButtonElement) {
    fireEvent.click(focused)
  }
}

const menuOpen = () => screen.queryByTestId('overflow-menu') !== null
  && screen.getByTestId('overflow-menu').querySelector('[role="menu"]') !== null

describe('the ⋯ menu, after a sealed working file is opened from it', () => {
  it('stays shut when the password is confirmed with Enter and the file replaces the scope', async () => {
    const view = renderApp({ boot: { initialProject: project('Landscape', 'acme/landscape') } })
    const sealed = await sealBytes(
      workingFileBytes([project('From a colleague', 'x')]), 'correct horse', { iterations: 1_000 },
    )
    view.documents.readBytes = () => Promise.resolve(new Uint8Array(sealed))

    const more = await screen.findByTestId('overflow-button')
    // A pointer's press focuses the button it presses; fireEvent's does not.
    more.focus()
    fireEvent.click(more)
    fireEvent.click(await screen.findByText('Open…'))
    await waitFor(() => expect(menuOpen()).toBe(false))
    await waitFor(() => expect(document.activeElement).toBe(more))

    fireEvent.change(screen.getByTestId('document-input'), {
      target: { files: [new File([sealed as BlobPart], 'theirs.lvarch')] },
    })
    const password = await screen.findByTestId('password')
    fireEvent.change(password, { target: { value: 'correct horse' } })
    pressEnter(password)

    fireEvent.click(await screen.findByTestId('open-into-here'))
    await waitFor(() => expect(screen.getByText(/theirs\.lvarch/)).toBeDefined())
    expect(menuOpen()).toBe(false)
  })
})
