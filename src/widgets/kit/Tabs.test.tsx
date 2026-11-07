// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { rovedIndex } from './roving'
import { TabPanel, Tabs } from './Tabs'

afterEach(cleanup)

const ITEMS = [
  { value: 'apps', label: 'Applications', count: 20 },
  { value: 'services', label: 'Services', count: 9 },
  { value: 'gone', label: 'Nothing here', hidden: true },
  { value: 'platforms', label: 'Platforms' },
]

function Live({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('apps')
  return (
    <>
      <Tabs id="sections" label="Sections" items={ITEMS} value={value} data-guide="sections" onChange={(next) => { setValue(next); onChange?.(next) }} />
      <TabPanel id="sections" value={value}>{value} shown</TabPanel>
    </>
  )
}

describe('Tabs', () => {
  it('names each with its count, leaves out what has nothing, and ties tab to panel', async () => {
    renderShell(<Live />)
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Applications 20', 'Services 9', 'Platforms'])
    expect(screen.getByRole('tablist').dataset.guide).toBe('sections')
    expect(screen.getByRole('tabpanel', { name: 'Applications 20' }).textContent).toBe('apps shown')
    expect(await axeFindings()).toEqual([])
  })

  it('puts only the tab that is on in the tab order', () => {
    renderShell(<Live />)
    expect(screen.getAllByRole('tab').map((tab) => tab.tabIndex)).toEqual([0, -1, -1])
  })

  it('moves and chooses with the arrows, wrapping, with Home and End', () => {
    const changed = vi.fn()
    renderShell(<Live onChange={changed} />)
    const first = screen.getByRole('tab', { name: 'Applications 20' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Services 9' }))
    expect(changed).toHaveBeenLastCalledWith('services')
    fireEvent.keyDown(document.activeElement as Element, { key: 'End' })
    expect(changed).toHaveBeenLastCalledWith('platforms')
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowRight' })
    expect(changed).toHaveBeenLastCalledWith('apps')
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowLeft' })
    expect(changed).toHaveBeenLastCalledWith('platforms')
    fireEvent.keyDown(document.activeElement as Element, { key: 'Home' })
    expect(changed).toHaveBeenLastCalledWith('apps')
    changed.mockClear()
    fireEvent.keyDown(document.activeElement as Element, { key: 'a' })
    expect(changed).not.toHaveBeenCalled()
  })

  it('answers a press, once, and not on the tab already on', () => {
    const changed = vi.fn()
    renderShell(<Live onChange={changed} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Applications 20' }))
    expect(changed).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('tab', { name: 'Platforms' }))
    expect(changed).toHaveBeenCalledWith('platforms')
    expect(screen.getByRole('tabpanel').textContent).toBe('platforms shown')
  })

  it('works with no panel to name', async () => {
    renderShell(<Tabs label="Sections" items={ITEMS} value="unknown" onChange={() => {}} />)
    expect(screen.getAllByRole('tab')[0]?.tabIndex).toBe(0)
    expect(screen.getAllByRole('tab')[0]?.hasAttribute('aria-controls')).toBe(false)
    expect(await axeFindings()).toEqual([])
  })
})

describe('rovedIndex', () => {
  it('wraps, ends, and leaves other keys alone', () => {
    expect(rovedIndex('ArrowDown', 2, 3)).toBe(0)
    expect(rovedIndex('ArrowUp', 0, 3)).toBe(2)
    expect(rovedIndex('Home', 2, 3)).toBe(0)
    expect(rovedIndex('End', 0, 3)).toBe(2)
    expect(rovedIndex('Enter', 0, 3)).toBeUndefined()
    expect(rovedIndex('ArrowDown', 0, 0)).toBeUndefined()
  })

  it('carries a stable name per tab where a screen gives one', () => {
    renderShell(<Tabs label="Stages" value="a" onChange={() => {}} items={[{ value: 'a', label: 'A', guide: 'x.a', testId: 'tab-a' }]} />)
    expect(screen.getByTestId('tab-a').getAttribute('data-guide')).toBe('x.a')
  })

  it('steps down a size when its tabs do not fit the strip, and not when they do', () => {
    const wide = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-tight') ? 280 : 340
    })
    const room = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(296)
    renderShell(<Tabs label="Sections" items={ITEMS} value="apps" onChange={() => {}} />)
    expect(screen.getByRole('tablist').hasAttribute('data-tight')).toBe(true)
    cleanup()
    room.mockReturnValue(400)
    renderShell(<Tabs label="Sections" items={ITEMS} value="apps" onChange={() => {}} />)
    expect(screen.getByRole('tablist').hasAttribute('data-tight')).toBe(false)
    wide.mockRestore(); room.mockRestore()
  })
})
