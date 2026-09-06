// @vitest-environment jsdom
/**
 * The strip that appears when the folder has a second author.
 *
 * Two states, and the difference between them is the whole design: with nothing
 * unsaved, taking their version costs nothing; with unsaved work, one of the
 * two versions is about to stop existing and only a person may choose which.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { translator } from '../i18n'
import { DiskChangeNotice } from './DiskChangeNotice'
import { renderShell } from './testing/renderShell'

afterEach(() => cleanup())

const s = translator('en')

function show(status: 'clean' | 'dirty' | 'external-changed' | 'conflict') {
  const actions = { takeTheirs: vi.fn(), keepMine: vi.fn(), saveCopy: vi.fn() }
  renderShell(
    <DiskChangeNotice
      status={status}
      onTakeTheirs={actions.takeTheirs}
      onKeepMine={actions.keepMine}
      onSaveCopy={actions.saveCopy}
      s={s}
    />,
  )
  return actions
}

describe('DiskChangeNotice', () => {
  it('says nothing while the document is this session’s alone', () => {
    show('clean')
    expect(screen.queryByTestId('disk-change-notice')).toBeNull()
    cleanup()
    show('dirty')
    expect(screen.queryByTestId('disk-change-notice')).toBeNull()
  })

  it('offers their version first when nothing here is unsaved', () => {
    show('external-changed')
    expect(screen.getByTestId('disk-change-notice').textContent).toContain('changed on disk')
    expect(screen.getByText('Take theirs')).toBeDefined()
    expect(screen.queryByText('Save a copy…')).toBeNull()
  })

  it('offers all three when both sides changed', () => {
    // No "merge" button, because there is no merge: the choice is which version
    // survives, and a fourth button would be the one place this app lied.
    show('conflict')
    for (const label of ['Take theirs', 'Keep mine', 'Save a copy…']) {
      expect(screen.getByText(label), label).toBeDefined()
    }
  })

  it('hands every choice back to the caller', () => {
    const actions = show('conflict')
    fireEvent.click(screen.getByText('Take theirs'))
    fireEvent.click(screen.getByText('Keep mine'))
    fireEvent.click(screen.getByText('Save a copy…'))

    expect(actions.takeTheirs).toHaveBeenCalled()
    expect(actions.keepMine).toHaveBeenCalled()
    expect(actions.saveCopy).toHaveBeenCalled()
  })
})
