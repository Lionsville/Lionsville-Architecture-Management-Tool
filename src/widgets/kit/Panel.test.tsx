// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/** The one panel: a name that wraps and can be pressed where it may change, tabs, a foot that helps or undoes. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { Panel, PanelDockProvider, PanelName, PanelSection } from './Panel'

afterEach(() => cleanup())

const TABS = [{ value: 'properties', label: 'Properties' }, { value: 'comments', label: 'Comments', count: 2 }]

describe('the panel', () => {
  it('starts typing the name when asked, for what was just made', () => {
    renderShell(<Panel kind="Step" name="New step" onRename={vi.fn()} renameAtOnce renameRequest={1}>rows</Panel>)
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Change the name' }))
  })

  it('says the kind, the name and one line of facts, and is a landmark by the name', () => {
    renderShell(<Panel kind="Application" name="Billing" facts="Live · 6 lines">rows</Panel>)
    const panel = screen.getByRole('complementary', { name: 'Billing' })
    expect(within(panel).getByText('Application')).toBeTruthy()
    expect(within(panel).getByRole('heading', { name: 'Billing' })).toBeTruthy()
    expect(within(panel).getByText('Live · 6 lines')).toBeTruthy()
  })

  it('draws no edit, no tabs, no foot and no close where none is handed in', () => {
    renderShell(<Panel kind="Application" name="Billing">rows</Panel>)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(document.querySelector('.kit-panel__foot')).toBeNull()
  })

  it('switches tabs and says the count', () => {
    const onTab = vi.fn()
    renderShell(<Panel kind="K" name="N" tabs={TABS} tab="properties" onTab={onTab}>rows</Panel>)
    fireEvent.click(screen.getByRole('tab', { name: /Comments/ }))
    expect(onTab).toHaveBeenCalledWith('comments')
    expect(screen.getByRole('tab', { name: /Comments\s*2/ })).toBeTruthy()
  })

  it('is 320 by default, 520 when wide, and a dragged width wins', () => {
    const { rerender } = renderShell(<Panel kind="K" name="N">rows</Panel>)
    const panel = () => screen.getByRole('complementary')
    expect(panel().hasAttribute('data-wide')).toBe(false)
    rerender(<Panel kind="K" name="N" wide>rows</Panel>)
    expect(panel().hasAttribute('data-wide')).toBe(true)
    rerender(<Panel kind="K" name="N" width={444}>rows</Panel>)
    expect(panel().style.getPropertyValue('--kit-panel-w')).toBe('444px')
  })

  it('folds to a way back, and closes', () => {
    const onCollapse = vi.fn()
    const onClose = vi.fn()
    const { rerender } = renderShell(<Panel kind="K" name="N" onCollapse={onCollapse} onClose={onClose}>rows</Panel>)
    fireEvent.click(screen.getByRole('button', { name: 'Fold the panel away' }))
    expect(onCollapse).toHaveBeenCalledWith(true)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
    rerender(<Panel kind="K" name="N" collapsed onCollapse={onCollapse}>rows</Panel>)
    expect(screen.queryByText('rows')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show the panel' }))
    expect(onCollapse).toHaveBeenLastCalledWith(false)
  })
})

describe('the foot', () => {
  it('shows the last change with its Undo', () => {
    const onUndo = vi.fn()
    renderShell(<Panel kind="K" name="N" undo={{ word: 'Lifecycle set to Live', onUndo }}>rows</Panel>)
    expect(screen.getByText(/Lifecycle set to Live/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onUndo).toHaveBeenCalled()
  })

  it('shows help for the field in focus in place of that, and keeps a link to more', () => {
    const onPress = vi.fn()
    renderShell(<Panel kind="K" name="N" help="What this field means" undo={{ word: 'Changed', onUndo: () => undefined }} helpLink={{ label: 'Help', onPress }}>rows</Panel>)
    expect(screen.getByText('What this field means')).toBeTruthy()
    expect(screen.queryByText(/Changed/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Help' }))
    expect(onPress).toHaveBeenCalled()
  })
})

describe('the name', () => {
  const press = () => fireEvent.click(screen.getByRole('button', { name: /Change the name/ }))
  const field = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Change the name' })

  it('commits on Enter, without a line break, and gives the focus back', () => {
    const onRename = vi.fn()
    renderShell(<Panel kind="K" name="Billing" onRename={onRename}>rows</Panel>)
    press()
    fireEvent.change(field(), { target: { value: ' Invoicing ' } })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(onRename).toHaveBeenCalledWith('Invoicing')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Change the name/ }))
  })

  it('puts it back on Esc', () => {
    const onRename = vi.fn()
    renderShell(<Panel kind="K" name="Billing" onRename={onRename}>rows</Panel>)
    press()
    fireEvent.change(field(), { target: { value: 'Other' } })
    fireEvent.keyDown(field(), { key: 'Escape' })
    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: /Billing/ })).toBeTruthy()
  })

  it('commits on leaving, and an empty or unchanged name is no change', () => {
    const onRename = vi.fn()
    renderShell(<Panel kind="K" name="Billing" onRename={onRename}>rows</Panel>)
    press()
    fireEvent.change(field(), { target: { value: '   ' } })
    fireEvent.blur(field())
    press()
    fireEvent.blur(field())
    expect(onRename).not.toHaveBeenCalled()
  })

  it('stays open on a refusal, saying why and keeping what was typed', () => {
    renderShell(<Panel kind="K" name="Billing" onRename={() => 'That name is taken.'}>rows</Panel>)
    press()
    fireEvent.change(field(), { target: { value: 'Taken' } })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(screen.getByRole('alert').textContent).toBe('That name is taken.')
    expect(field().value).toBe('Taken')
    expect(field().getAttribute('aria-invalid')).toBe('true')
  })

  it('drops what was being typed when the selection moves on', () => {
    const { rerender } = renderShell(<Panel kind="K" name="Billing" onRename={() => undefined}>rows</Panel>)
    press()
    rerender(<Panel kind="K" name="Rating" onRename={() => undefined}>rows</Panel>)
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})

describe('as a whole', () => {
  it('says it is loading rather than drawing rows', () => {
    renderShell(<Panel kind="K" name="N" loading>rows</Panel>)
    expect(screen.queryByText('rows')).toBeNull()
    expect(screen.getByRole('region', { name: 'N' }).getAttribute('aria-busy')).toBe('true')
  })

  it('passes axe, with tabs, sections, an edit and a foot', async () => {
    renderShell(
      <Panel kind="Application" name="Billing" onRename={() => undefined} facts="Live" status="Kept at Acme" tabs={TABS} tab="properties" onTab={() => undefined} undo={{ word: 'Changed', onUndo: () => undefined }} onClose={() => undefined} onCollapse={() => undefined}>
        <PanelSection title="Runs on" aside="4 of 4">rows</PanelSection>
      </Panel>,
    )
    expect(screen.getByRole('heading', { name: 'Runs on' })).toBeTruthy()
    expect(screen.getByText('4 of 4')).toBeTruthy()
    expect(await axeFindings()).toEqual([])
  })
})

describe('in a dock', () => {
  const dock = (claim = vi.fn(() => () => {})) => ({ width: 444, onCollapse: vi.fn(), dataGuide: 'board.inspector', claim })

  it('takes its width, its fold and its name from the column, and says it is there', () => {
    const held = dock()
    renderShell(<PanelDockProvider value={held}><Panel kind="Application" name="Billing" /></PanelDockProvider>)
    expect(held.claim).toHaveBeenCalledTimes(1)
    const aside = screen.getByRole('complementary', { name: 'Billing' })
    expect(aside.getAttribute('data-guide')).toBe('board.inspector')
    expect(aside.style.getPropertyValue('--kit-panel-w')).toBe('444px')
    fireEvent.click(screen.getByRole('button', { name: 'Fold the panel away' }))
    expect(held.onCollapse).toHaveBeenCalledWith(true)
  })

  it('opens its name for typing on a new request, and none on the first or read-only', () => {
    const view = renderShell(<Panel kind="Application" name="Billing" onRename={vi.fn()} renameRequest={1} />)
    expect(screen.queryByRole('textbox')).toBeNull()
    view.rerender(<Panel kind="Application" name="Billing" onRename={vi.fn()} renameRequest={2} />)
    expect(screen.getByRole('textbox', { name: 'Change the name' })).toBe(document.activeElement)
    view.rerender(<Panel kind="Application" name="Other" renameRequest={3} />)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('reads as a word inside a heading of its own, unheaded', () => {
    renderShell(<h1><PanelName name="Billing" unheaded /></h1>)
    expect(screen.getAllByRole('heading')).toHaveLength(1)
  })
})
