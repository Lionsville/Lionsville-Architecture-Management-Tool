// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { translator } from '../../i18n'
import { GroupSettingsDialog } from './GroupSettingsDialog'
import type { GroupProfile } from '../../projects/group'
import { renderShell } from '../testing/renderShell'

afterEach(() => cleanup())

const s = translator('en')

function open(target: Partial<GroupProfile> = {}) {
  const onSave = vi.fn<(profile: GroupProfile) => void>()
  const onCancel = vi.fn()
  renderShell(
    <GroupSettingsDialog
      target={{ group: 'acme', name: 'Acme', ...target }}
      onSave={onSave}
      onCancel={onCancel}
      s={s}
    />,
  )
  return { onSave, onCancel }
}

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }))

describe('GroupSettingsDialog', () => {
  it('opens on what the group already says about itself', () => {
    open({
      name: 'Acme Logistics',
      description: 'Rail freight.',
      links: [{ label: 'Wiki', url: 'https://example.test/wiki' }],
    })
    expect(screen.getByDisplayValue('Acme Logistics')).toBeDefined()
    expect(screen.getByDisplayValue('Rail freight.')).toBeDefined()
    expect(screen.getByDisplayValue('https://example.test/wiki')).toBeDefined()
  })

  /**
   * The address is how every project underneath is filed. Saying so on screen
   * is cheaper than someone discovering it by renaming and watching nothing
   * move.
   */
  it('says out loud that the address does not change', () => {
    open({ group: 'acme/rail' })
    expect(screen.getByText(/The address \(acme\/rail\) does not change/)).toBeDefined()
  })

  /**
   * The dialog shows the name, the client, the description and the links. The
   * decisions ride on the same record, unseen — and a save that rebuilt the
   * record from the fields alone used to drop them.
   */
  it('keeps what it does not show, and takes a client apart from the name', () => {
    const decisions = [{
      id: 'g-1', number: 1, title: 'One tenant', status: 'proposed', date: '2026-09-01', body: '',
    }] as unknown as GroupProfile['decisions']
    const { onSave } = open({ decisions })
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: ' Acme Logistics BV ' } })
    save()
    expect(onSave).toHaveBeenCalledWith({
      group: 'acme', name: 'Acme', client: 'Acme Logistics BV', decisions,
    })
  })

  it('hands back a trimmed profile under the group it was opened on', () => {
    const { onSave } = open()
    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: '  Acme Rail  ' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Rolling stock.' } })
    save()
    expect(onSave).toHaveBeenCalledWith({
      group: 'acme', name: 'Acme Rail', description: 'Rolling stock.',
    })
  })

  it('adds a link, and labels it with its own address when nobody labelled it', () => {
    const { onSave } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Add a link' }))
    fireEvent.change(screen.getByLabelText('Address'), {
      target: { value: 'https://example.test/wiki' },
    })
    save()
    expect(onSave.mock.calls[0][0].links).toEqual([
      { label: 'https://example.test/wiki', url: 'https://example.test/wiki' },
    ])
  })

  it('flags an address it will not render, and drops it on save', () => {
    const { onSave } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Add a link' }))
    fireEvent.change(screen.getByLabelText('Address'), {
      target: { value: 'javascript:alert(1)' },
    })
    expect(screen.getByText('Needs to start with http:// or https://')).toBeDefined()
    save()
    expect('links' in onSave.mock.calls[0][0]).toBe(false)
  })

  it('removes a link', () => {
    const { onSave } = open({ links: [{ label: 'Wiki', url: 'https://example.test/wiki' }] })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Wiki' }))
    save()
    expect('links' in onSave.mock.calls[0][0]).toBe(false)
  })

  it('refuses a nameless group', () => {
    open()
    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: '  ' } })
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
