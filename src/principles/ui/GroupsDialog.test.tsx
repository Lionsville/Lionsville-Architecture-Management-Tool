// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/** A scope's groups of principles, edited in a dialog and written as one change when saved. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import { GroupsDialog } from './GroupsDialog'
import { PrinciplesProvider } from './PrinciplesContext'

afterEach(() => cleanup())

function show() {
  const setGroups = vi.fn()
  const onClose = vi.fn()
  const access = {
    setGroups,
    own: () => ({
      groups: [{ id: 'a', name: 'Security' }, { id: 'b', name: 'Data' }],
      principles: [{ id: 'p1', groups: ['a'] }, { id: 'p2', groups: ['a'], mergedInto: 'p1' }],
    }),
  } as never
  renderShell(<PrinciplesProvider value={access}><GroupsDialog open scope="" onClose={onClose} /></PrinciplesProvider>)
  return { setGroups, onClose }
}

const names = (saved: { name: string }[]) => saved.map((one) => one.name)

describe('the groups of principles', () => {
  it('counts what a group holds, leaving out a merged principle', () => {
    show()
    expect(screen.getByTestId('group-a').textContent).toContain('1')
  })

  it('moves one up and down, by button or by a drag, and saves the order', () => {
    const { setGroups, onClose } = show()
    const first = within(screen.getByTestId('group-a'))
    fireEvent.click(first.getByRole('button', { name: 'Move down' }))
    fireEvent.click(within(screen.getByTestId('group-a')).getByRole('button', { name: 'Move up' }))
    fireEvent.dragStart(screen.getByTestId('group-a'))
    fireEvent.dragOver(screen.getByTestId('group-b'))
    fireEvent.drop(screen.getByTestId('group-b'))
    fireEvent.click(screen.getByTestId('groups-save'))
    expect(names(setGroups.mock.calls[0][1])).toEqual(['Data', 'Security'])
    expect(onClose).toHaveBeenCalled()
  })

  it('renames, describes, takes one out, and leaves out one added and never named', () => {
    const { setGroups } = show()
    const [name, description] = within(screen.getByTestId('group-a')).getAllByRole('textbox')
    fireEvent.change(name, { target: { value: 'Safety' } })
    fireEvent.change(description, { target: { value: 'Why' } })
    fireEvent.change(description, { target: { value: '' } })
    fireEvent.click(within(screen.getByTestId('group-b')).getByRole('button', { name: 'Remove this group' }))
    fireEvent.click(screen.getByTestId('group-add'))
    fireEvent.click(screen.getByTestId('groups-save'))
    expect(names(setGroups.mock.calls[0][1])).toEqual(['Safety'])
  })

  it('writes nothing when cancelled, and draws nothing with no principles to keep', () => {
    const { setGroups, onClose } = show()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(setGroups).not.toHaveBeenCalled()
    cleanup()
    renderShell(<GroupsDialog open scope="" onClose={() => {}} />)
    expect(screen.queryByTestId('group-add')).toBeNull()
  })
})
