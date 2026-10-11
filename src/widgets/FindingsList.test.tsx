// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The one list of findings: grouped by check and folded, fix before review
 * before note, the notes behind their switch, an instance opening its
 * explanation with the actions the screen wired and no others, and the
 * folds kept for the session where the shell keeps them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { axeFindings } from '../app/testing/axe'
import { renderShell } from '../app/testing/renderShell'
import { CHECK_LIST_WORDS, groupByCheck } from '../model/checkCatalogue'
import type { CheckKey } from '../model/checkCatalogue'
import { FindingsList } from './FindingsList'
import type { FindingActions } from './FindingsList'
import { SessionMemoryContext } from './sessionMemory'
import type { SessionMemory } from './sessionMemory'

afterEach(() => cleanup())

type Found = { key: CheckKey; id: string; text: string }

const FOUND: Found[] = [
  { key: 'check.interactionUnused', id: 'i-billing', text: 'Integration Platform and Billing declare As a service, and no interface runs between them.' },
  { key: 'check.interfaceUndeclared', id: 'f-1', text: 'Order Service → Freight Booking runs from Digital Sales to Carriers.' },
  { key: 'check.unitMisplaced', id: 'cl', text: 'Carriers is a Cluster and may not sit where it is filed' },
  { key: 'check.interactionUnused', id: 'i-service', text: 'Integration Platform and Service declare As a service, and no interface runs between them.' },
  { key: 'check.interfaceUndeclared', id: 'f-2', text: 'Mobile App → Track & Trace Portal runs from Digital Sales to Tracking.' },
]

function List({ found = FOUND, actions, onPick, remember }: {
  found?: Found[]; actions?: FindingActions<Found, string>; onPick?: (finding: Found | undefined) => void; remember?: string
}) {
  return (
    <FindingsList
      groups={groupByCheck(found)} words={CHECK_LIST_WORDS} sentence={(one) => one.text} keyOf={(one) => one.id}
      attributesOf={(one) => ({ 'data-testid': `found-${one.id}` })} empty={<span>Nothing found.</span>}
      {...(actions ? { actions } : {})} {...(onPick ? { onPick } : {})} {...(remember ? { remember } : {})} testId="findings"
    />
  )
}

const groupRows = () => screen.getAllByTestId('findings-group')

describe('a list of findings', () => {
  it('groups by check, folded, fix before review before note, with the notes hidden and counted', async () => {
    renderShell(<List />)
    expect(groupRows()).toHaveLength(2)
    // The weight is said to a screen reader; the mark is drawn.
    expect(groupRows()[0]!.textContent).toMatch(/^▸●Fix.*\(1\)$/)
    expect(groupRows()[1]!.textContent).toMatch(/^▸▲ReviewInterface with no interaction declared\(2\)$/)
    for (const row of groupRows()) expect(row.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText(/Order Service/)).toBeNull()
    expect(screen.getByTestId('findings-summary').textContent).toBe('3 to look at · 2 notes')
    expect(screen.getByRole('switch', { name: 'Show notes (2)' })).toBeTruthy()
    expect(screen.getByTestId('findings-legend').textContent).toContain('Note: Information, often intended')
    expect(await axeFindings()).toEqual([])
  })

  it('unfolds a check to its instances, and shows the notes when asked', async () => {
    renderShell(<List />)
    const review = groupRows()[1]!
    review.focus()
    expect(document.activeElement).toBe(review)
    fireEvent.click(review)
    expect(review.getAttribute('aria-expanded')).toBe('true')
    const listed = document.getElementById(review.getAttribute('aria-controls')!)!
    expect(within(listed).getAllByRole('button').map((one) => one.textContent)).toEqual([FOUND[1]!.text, FOUND[4]!.text])
    expect(screen.getByTestId('found-f-1').getAttribute('data-guide')).toBe('findings.instance')
    fireEvent.click(screen.getByRole('switch', { name: 'Show notes (2)' }))
    expect(groupRows().map((row) => row.textContent)).toEqual([
      expect.stringContaining('A unit'), expect.stringContaining('Interface with no interaction declared'),
      expect.stringMatching(/^▸iNoteInteraction not used by any interface\(2\)$/),
    ])
    fireEvent.click(review)
    expect(screen.queryByTestId('found-f-1')).toBeNull()
    expect(await axeFindings()).toEqual([])
  })

  it('opens an instance\'s explanation, with only the actions the screen wired, and goes back to it', async () => {
    const remove = vi.fn()
    const onPick = vi.fn()
    renderShell(<List actions={{ removeInteraction: (one) => () => remove(one.id), openUnits: () => undefined }} onPick={onPick} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Show notes (2)' }))
    fireEvent.click(groupRows()[2]!)
    fireEvent.click(screen.getByTestId('found-i-service'))
    expect(onPick).toHaveBeenLastCalledWith(FOUND[3])
    const explanation = screen.getByRole('region', { name: 'Interaction not used by any interface' })
    expect(document.activeElement).toBe(within(explanation).getByRole('heading', { name: 'Interaction not used by any interface' }))
    expect(screen.getByTestId('finding-weight').textContent).toBe('iNote · Teams and systems')
    expect(screen.getByTestId('finding-sentence').textContent).toBe(FOUND[3]!.text)
    expect(screen.getByTestId('finding-why').textContent).toMatch(/^Two units declare that they work together/)
    expect(screen.getByTestId('finding-how').textContent).toMatch(/^If the interface exists, model it/)
    // Remove is wired; Model the missing interface is not, and Open the two units has nothing to open here.
    expect(within(explanation).getAllByRole('button').map((one) => one.textContent)).toEqual(['←All findings', 'Remove the declaration'])
    expect(await axeFindings()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Remove the declaration' }))
    expect(remove).toHaveBeenCalledWith('i-service')
    fireEvent.click(screen.getByRole('button', { name: /All findings/ }))
    expect(onPick).toHaveBeenLastCalledWith(undefined)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('found-i-service')))
  })

  it('offers a choice where an action can be done to several things', async () => {
    const opened: string[] = []
    renderShell(<List actions={{
      openUnits: () => ['ip', 'billing'].map((id) => ({ key: id, label: id === 'ip' ? 'Integration Platform' : 'Billing', run: () => opened.push(id) })),
      modelInterface: () => [{ key: 'order', label: 'Order Service', group: 'Digital Sales', run: () => opened.push('order') }],
    }} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Show notes (2)' }))
    fireEvent.click(groupRows()[2]!)
    fireEvent.click(screen.getByTestId('found-i-billing'))
    const units = screen.getByRole('button', { name: 'Open the two units' })
    expect(units.getAttribute('aria-haspopup')).toBe('menu')
    fireEvent.click(units)
    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map((one) => one.textContent)).toEqual(['Integration Platform', 'Billing'])
    expect(await axeFindings()).toEqual([])
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Billing' }))
    expect(opened).toEqual(['billing'])
    fireEvent.click(screen.getByRole('button', { name: 'Model the missing interface…' }))
    expect(within(await screen.findByRole('menu')).getByRole('menuitem').textContent).toBe('Order ServiceDigital Sales')
  })

  it('goes back to the list when the finding it explains is put right', async () => {
    function Fixing() {
      const [found, setFound] = useState(FOUND)
      return <List found={found} actions={{ declareInteraction: (one) => () => setFound((all) => all.filter((held) => held.id !== one.id)) }} />
    }
    renderShell(<Fixing />)
    fireEvent.click(groupRows()[1]!)
    fireEvent.click(screen.getByTestId('found-f-2'))
    fireEvent.click(screen.getByRole('button', { name: 'Declare an interaction…' }))
    await waitFor(() => expect(screen.queryByTestId('finding-explanation')).toBeNull())
    expect(groupRows()[1]!.textContent).toMatch(/\(1\)$/)
    expect(document.activeElement).toBe(screen.getByTestId('findings'))
  })

  it('keeps its folds and its notes for the session where the shell keeps them, under its own key', () => {
    const kept = new Map<string, ReadonlySet<string>>()
    const memory: SessionMemory = { keep: (key, held) => kept.set(key, new Set(held)), recall: (key) => kept.get(key) }
    const first = renderShell(<SessionMemoryContext.Provider value={memory}><List remember="here" /></SessionMemoryContext.Provider>)
    fireEvent.click(groupRows()[0]!)
    fireEvent.click(screen.getByRole('switch', { name: 'Show notes (2)' }))
    first.unmount()
    renderShell(<SessionMemoryContext.Provider value={memory}><List remember="here" /></SessionMemoryContext.Provider>)
    expect(groupRows().map((row) => row.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false'])
    cleanup()
    renderShell(<SessionMemoryContext.Provider value={memory}><List remember="elsewhere" /></SessionMemoryContext.Provider>)
    expect(groupRows()).toHaveLength(2)
  })

  it('says what it is given to say where nothing is found', () => {
    renderShell(<List found={[]} />)
    expect(screen.getByTestId('findings').textContent).toBe('Nothing found.')
    expect(screen.queryByTestId('findings-summary')).toBeNull()
  })
})
