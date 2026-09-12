// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { translator } from '../../i18n'
import { ScopeSettingsDialog } from './ScopeSettingsDialog'
import type { ScopeSummary } from '../../projects/scope'
import type { ScopeSettingsPatch } from '../App'
import { renderShell } from '../testing/renderShell'

afterEach(() => cleanup())

const s = translator('en')

function open(target: Partial<ScopeSummary> = {}) {
  const onSave = vi.fn<(path: string, patch: ScopeSettingsPatch) => void>()
  const onCancel = vi.fn()
  renderShell(
    <ScopeSettingsDialog
      target={{ path: 'acme', name: 'Acme', diagrams: 0, children: [], ...target }}
      onSave={onSave}
      onCancel={onCancel}
      s={s}
    />,
  )
  return { onSave, onCancel }
}

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }))

describe('ScopeSettingsDialog', () => {
  it('opens on what the scope already says about itself', () => {
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
   * The address is how everything underneath is filed. Saying so on screen is
   * cheaper than someone discovering it by renaming and watching nothing move.
   */
  it('says out loud that the address does not change', () => {
    open({ path: 'acme/rail' })
    expect(screen.getByText(/The address \(acme\/rail\) does not change/)).toBeDefined()
  })

  /** The root has no segment to show, and `/` is where it is. */
  it('names the root by the folder it is', () => {
    open({ path: '', name: 'Acme Logistics' })
    expect(screen.getByText(/The address \(\/\) does not change/)).toBeDefined()
  })

  /**
   * A patch and not a record: the scope also holds a model, decisions and plans
   * this dialog does not show, and a save that handed back a whole record
   * rebuilt from the fields would drop every one of them.
   */
  it('hands back a patch at the path it was opened on, and takes a client apart from the name', () => {
    const { onSave } = open({ kind: 'domain' })
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: ' Acme Logistics BV ' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Acme Rail  ' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Rolling stock.' } })
    save()
    expect(onSave).toHaveBeenCalledWith('acme', {
      name: '  Acme Rail  ',
      client: ' Acme Logistics BV ',
      description: 'Rolling stock.',
      links: [],
      kind: 'domain',
    })
  })

  it('adds a link, and the caller labels it with its own address', () => {
    const { onSave } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Add a link' }))
    fireEvent.change(screen.getByLabelText('Address'), {
      target: { value: 'https://example.test/wiki' },
    })
    save()
    expect(onSave.mock.calls[0][1].links)
      .toEqual([{ label: '', url: 'https://example.test/wiki' }])
  })

  it('flags an address it will not render', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Add a link' }))
    fireEvent.change(screen.getByLabelText('Address'), {
      target: { value: 'javascript:alert(1)' },
    })
    expect(screen.getByText('Needs to start with http:// or https://')).toBeDefined()
  })

  it('removes a link', () => {
    const { onSave } = open({ links: [{ label: 'Wiki', url: 'https://example.test/wiki' }] })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Wiki' }))
    save()
    expect(onSave.mock.calls[0][1].links).toEqual([])
  })

  it('refuses a nameless scope', () => {
    open()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } })
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

/**
 * A move, which is the one thing this dialog asks that is not a field edit.
 *
 * The dialog says *where*; the caller performs it, because changing an address
 * is a store operation — save there, remove here — and this component has no
 * store. What is pinned here is that it asks only when it can, and answers only
 * when the answer changed.
 */
describe('ScopeSettingsDialog — filed under', () => {
  const tree: ScopeSummary = {
    path: '', name: 'Acme Logistics', diagrams: 0, children: [
      { path: 'acme', name: 'Acme', diagrams: 0, children: [
        { path: 'acme/rail', name: 'Rail', diagrams: 1, children: [] },
      ] },
      { path: 'globex', name: 'Globex', diagrams: 0, children: [] },
    ],
  }

  function openWithTree(target: Partial<ScopeSummary> = {}) {
    const onSave = vi.fn<(path: string, patch: ScopeSettingsPatch) => void>()
    renderShell(
      <ScopeSettingsDialog
        target={{ path: 'acme', name: 'Acme', diagrams: 0, children: [], ...target }}
        tree={tree}
        onSave={onSave}
        onCancel={() => {}}
        s={s}
      />,
    )
    return { onSave }
  }

  it('does not ask where the root goes, because there is nowhere above it', () => {
    openWithTree({ path: '', name: 'Acme Logistics' })
    expect(screen.queryByLabelText('Filed under')).toBeNull()
  })

  it('does not ask at all when it was given no tree to offer', () => {
    open()
    expect(screen.queryByLabelText('Filed under')).toBeNull()
  })

  it('says nothing about the parent when the parent did not change', () => {
    const { onSave } = openWithTree()
    save()
    expect(onSave.mock.calls[0][1].parent).toBeUndefined()
  })

  it('hands back the new parent when it did', () => {
    const { onSave } = openWithTree()
    fireEvent.mouseDown(screen.getByLabelText('Filed under'))
    fireEvent.click(screen.getByRole('option', { name: 'Globex' }))
    save()
    expect(onSave).toHaveBeenCalledWith('acme', expect.objectContaining({ parent: 'globex' }))
  })

  /** A scope filed under itself, or under its own child, has no address at all. */
  it('offers neither the scope itself nor anything inside it', () => {
    openWithTree()
    fireEvent.mouseDown(screen.getByLabelText('Filed under'))
    const options = screen.getAllByRole('option').map((one) => one.textContent?.trim())
    expect(options).toContain('Globex')
    expect(options).not.toContain('Acme')
    expect(options).not.toContain('Rail')
  })

  it('offers the kind as a word, and hands it back', () => {
    const { onSave } = openWithTree({ kind: 'domain' })
    fireEvent.mouseDown(screen.getByLabelText('What this is'))
    fireEvent.click(screen.getByRole('option', { name: 'Programme' }))
    save()
    expect(onSave).toHaveBeenCalledWith('acme', expect.objectContaining({ kind: 'programme' }))
  })
})
