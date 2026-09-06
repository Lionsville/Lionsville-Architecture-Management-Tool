// @vitest-environment jsdom
/**
 * Where the projects are, said on the screen that lists them.
 *
 * "Where is my work?" is the question this whole phase is about, and the picker
 * is where it gets asked. Three states, and the difference between them is the
 * point: a browser tab cannot offer a folder at all, a desktop that has not
 * been given one keeps projects inside the app, and one that has says which
 * folder — by the name the user gave it, not by a path nobody reads.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { translator } from '../../i18n'
import { ProjectPicker } from './ProjectPicker'
import { renderShell } from '../testing/renderShell'

afterEach(() => cleanup())

const s = translator('en')

function show(over: {
  workingDirectory?: { name: string }
  onChooseWorkingDirectory?: () => void
}) {
  renderShell(
    <ProjectPicker
      projects={{ list: () => Promise.resolve([]), remove: () => Promise.resolve() }}
      groups={{ list: () => Promise.resolve([]) }}
      onApplyGroupSettings={() => {}}
      examples={[]}
      order="name"
      onOrderChange={() => {}}
      onOpen={() => {}}
      onCreate={() => {}}
      onCopyExample={() => {}}
      onFailure={() => {}}
      language="en"
      s={s}
      {...over}
    />,
  )
}

describe('ProjectPicker — the working folder', () => {
  it('says nothing about folders in a browser tab', () => {
    // Offering a button that cannot work is worse than offering nothing.
    show({})
    expect(screen.queryByTestId('working-directory')).toBeNull()
  })

  it('says where the projects are when there is a folder', () => {
    show({ workingDirectory: { name: 'Architecture' }, onChooseWorkingDirectory: () => {} })
    expect(screen.getByTestId('working-directory').textContent).toContain('Architecture')
    expect(screen.getByText('Change…')).toBeDefined()
  })

  it('says they are inside the app when there is not', () => {
    show({ onChooseWorkingDirectory: () => {} })
    expect(screen.getByTestId('working-directory').textContent).toContain('inside the app')
    expect(screen.getByText('Choose folder…')).toBeDefined()
  })

  it('asks the caller to choose, because a dialog is not this screen’s to open', () => {
    const choose = vi.fn()
    show({ onChooseWorkingDirectory: choose })
    fireEvent.click(screen.getByText('Choose folder…'))
    expect(choose).toHaveBeenCalled()
  })
})
