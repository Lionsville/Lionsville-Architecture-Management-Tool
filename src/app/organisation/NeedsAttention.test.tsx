// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The home's findings, in the one list (3.6.1): grouped by check and folded,
 * the notes hidden, and an instance's explanation offering the ways to where
 * it is fixed — a finding about something on a view opens the view, one about
 * the operating model its page, any other its record — and nothing the host
 * cannot open. Until 3.6.1 each row was itself the way there; these tests
 * pressed the row and now press the action in its explanation.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { translator } from '../../i18n'
import { axeFindings } from '../testing/axe'
import { renderShell } from '../testing/renderShell'
import { NeedsAttention } from './NeedsAttention'
import type { AttentionItem } from './attention'

afterEach(() => cleanup())

const s = translator('en')

/** Unfold a check by its name and open one of its instances by the row's test id. */
function openInstance(check: RegExp, row: string) {
  fireEvent.click(screen.getByRole('button', { name: check }))
  fireEvent.click(screen.getByTestId(row))
  return screen.getByTestId('finding-explanation')
}

const actionsIn = (explanation: HTMLElement) => within(explanation).queryAllByRole('button').map((one) => one.textContent).filter((text) => !text?.includes('All findings'))

describe('NeedsAttention', () => {
  it('groups the findings by check, folded, with the notes hidden and each row saying its kind', async () => {
    const items: AttentionItem[] = [
      { key: 'check.notDrawn', kind: 'notDrawn', scope: 'retail', id: 'wms', text: 'WMS is drawn on no board' },
      { key: 'check.dangling', kind: 'dangling', scope: 'retail', id: 'crm', text: 'An element' },
      { key: 'check.unattributed', kind: 'unattributed', scope: 'retail', id: 'post', text: 'Post office' },
    ]
    renderShell(<NeedsAttention items={items} at="" onOpen={vi.fn()} s={s} />)
    expect(screen.getAllByTestId('findings-group').map((row) => row.textContent)).toEqual([
      expect.stringContaining('A stand-in of something nothing defines(1)'), expect.stringContaining('An outside application with no party(1)'),
    ])
    expect(screen.queryByTestId('attention-retail-crm')).toBeNull()
    fireEvent.click(screen.getByRole('switch', { name: 'Show notes (1)' }))
    fireEvent.click(screen.getByRole('button', { name: /Not on any view yet/ }))
    expect(screen.getByTestId('attention-retail-wms').getAttribute('data-finding')).toBe('notDrawn')
    expect(await axeFindings()).toEqual([])
  })

  it('opens a drawing for a shape on it, and the element for an element', () => {
    const onOpen = vi.fn()
    const onOpenView = vi.fn()
    renderShell(
      <NeedsAttention
        items={[
          { key: 'check.drawingLinkMissing', kind: 'drawingLinkMissing', scope: 'retail', id: 'ctx:b', view: 'ctx', text: 'A shape' },
          { key: 'check.dangling', kind: 'dangling', scope: 'retail', id: 'crm', text: 'An element' },
        ]}
        at="" onOpen={onOpen} onOpenView={onOpenView} s={s}
      />,
    )
    const shape = openInstance(/A drawing points at something not here/, 'attention-retail-ctx:b')
    expect(actionsIn(shape)).toEqual(['Open the drawing'])
    fireEvent.click(within(shape).getByRole('button', { name: 'Open the drawing' }))
    expect(onOpenView).toHaveBeenCalledWith('retail', 'ctx')
    expect(onOpen).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /All findings/ }))
    const element = openInstance(/A stand-in of something nothing defines/, 'attention-retail-crm')
    fireEvent.click(within(element).getByRole('button', { name: 'Open it' }))
    expect(onOpen).toHaveBeenCalledWith('retail', 'crm')
  })

  it('opens a finding about the operating model on its page, and offers nothing the host cannot open', () => {
    const onOpen = vi.fn()
    const onOpenOperating = vi.fn()
    const items = [{ key: 'check.unitTypeNowhere' as const, kind: 'unitTypeNowhere', scope: '', id: 'ut-guild', page: 'operating' as const, text: 'Guild sits nowhere' }]
    renderShell(<NeedsAttention items={items} at="" onOpen={onOpen} onOpenOperating={onOpenOperating} s={s} />)
    fireEvent.click(within(openInstance(/A unit type that sits nowhere/, 'attention--ut-guild')).getByRole('button', { name: 'Open the unit type' }))
    expect(onOpenOperating).toHaveBeenCalledWith('ut-guild')
    expect(onOpen).not.toHaveBeenCalled()
    cleanup()
    renderShell(<NeedsAttention items={items} at="" onOpen={onOpen} s={s} />)
    expect(actionsIn(openInstance(/A unit type that sits nowhere/, 'attention--ut-guild'))).toEqual([])
  })

  it('opens the other definition of a thing kept twice, and offers Link… where the home may be written', async () => {
    const onOpen = vi.fn()
    const onLink = vi.fn()
    const items: AttentionItem[] = [{ key: 'check.conflict', kind: 'conflict', scope: 'retail', id: 'erp', elsewhere: 'finance', text: 'ERP is defined twice' }]
    renderShell(<NeedsAttention items={items} at="" onOpen={onOpen} onLink={onLink} writable s={s} />)
    const explanation = openInstance(/Two scopes define the same thing/, 'attention-retail-erp')
    expect(actionsIn(explanation)).toEqual(['Link…', 'Open it', 'Open the definition'])
    expect(await axeFindings()).toEqual([])
    fireEvent.click(within(explanation).getByRole('button', { name: 'Open the definition' }))
    expect(onOpen).toHaveBeenCalledWith('finance', 'erp')
    fireEvent.click(within(explanation).getByRole('button', { name: 'Link…' }))
    expect(onLink).toHaveBeenCalledWith('finance', 'erp', 'retail')
    cleanup()
    renderShell(<NeedsAttention items={items} at="" onOpen={onOpen} onLink={onLink} writable={false} s={s} />)
    expect(actionsIn(openInstance(/Two scopes define the same thing/, 'attention-retail-erp'))).toEqual(['Open it', 'Open the definition'])
  })

  it('opens the unit a finding of the organisation is about, and the record of one about something it serves', () => {
    const onOpen = vi.fn()
    const items: AttentionItem[] = [
      { key: 'check.roleVacant', kind: 'roleVacant', scope: 'retail', id: 'u-carriers', text: 'Carriers is short of a Product Owner' },
      { key: 'check.unitNotServing', kind: 'unitNotServing', scope: 'retail', id: 'price', text: 'Carriers is responsible for Price freight' },
    ]
    renderShell(<NeedsAttention items={items} at="" onOpen={onOpen} s={s} />)
    const vacant = openInstance(/A role short of people/, 'attention-retail-u-carriers')
    expect(actionsIn(vacant)).toEqual(['Open the unit'])
    fireEvent.click(within(vacant).getByRole('button', { name: 'Open the unit' }))
    expect(onOpen).toHaveBeenCalledWith('retail', 'u-carriers')
    fireEvent.click(screen.getByRole('button', { name: /All findings/ }))
    expect(actionsIn(openInstance(/Responsible outside the domains it serves/, 'attention-retail-price'))).toEqual(['Open it'])
  })
})
