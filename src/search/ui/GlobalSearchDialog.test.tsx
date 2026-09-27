// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The wide finder: grouped hits, the keyboard driving the list from the field,
 * and a chosen hit handed back whole so the caller can open what it is about.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { translator } from '../../i18n'
import type { HostModel } from '../../model/hostModel'
import type { Adr } from '../../decisions/adr'
import { chipOf, GlobalSearchDialog } from './GlobalSearchDialog'
import type { SearchHit } from '../search'
import { treeSources } from '../search'
import { renderShell } from '../../app/testing/renderShell'

afterEach(() => cleanup())

const element = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id, name, kind: 'application', lifecycle: 'live', isManaged: true, aspects: {}, ...over,
}) as HostModel['elements'][number]

const model: HostModel = {
  name: 'Landscape', 
  elements: [
    element('billing', 'Billing', { technology: 'Kafka' }),
    element('crm', 'CRM', { description: 'Publishes customer events on Kafka.' }),
  ],
  relations: [], diagrams: [],
  decisions: [{ id: 'adr-1', number: 1, title: 'Use Kafka for events', status: 'accepted', date: '2026-09-01', body: '', signers: [] }],
}
const ancestorDecisions: Adr[] = [
  { id: 'adr-g', number: 1, title: 'One message broker for the group', status: 'proposed', date: '2026-09-01', body: 'Kafka, not RabbitMQ.', signers: [] },
]
const observation = {
  id: 'ob-1', number: 4, title: 'Kafka lag every Monday', date: '2026-09-01', impact: 'critical' as const, seen: 1,
  body: '', history: [],
}
const sources = treeSources({
  scope: 'shop', model: { ...model, observations: [observation] },
  above: [{ path: '', decisions: ancestorDecisions }],
  tree: [{ path: 'shop/warehouse', model: { elements: [], observations: [{ ...observation, id: 'ob-w', title: 'Kafka topic full' }] } }],
})
const NAMES: Record<string, string> = { '': 'Acme', shop: 'Shop', 'shop/warehouse': 'Warehouse' }
const scopeLabel = (path: string) => NAMES[path] ?? path
const dialog = (over: { onChoose?: () => void; onClose?: () => void } = {}) => (
  <GlobalSearchDialog open sources={sources} scopeLabel={scopeLabel} onClose={over.onClose ?? (() => {})} onChoose={over.onChoose ?? (() => {})} s={translator('en')} />
)

describe('GlobalSearchDialog, as axe reads it', () => {
  it('finds nothing with hits in groups, nor with none', async () => {
    renderShell(dialog())
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'kafka' } })
    expect(screen.getAllByRole('group').length).toBeGreaterThan(1)
    expect(await axeFindings()).toEqual([])
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } })
    expect(await axeFindings()).toEqual([])
  })
})

describe('GlobalSearchDialog', () => {
  it('groups hits by kind, and says what each is and which scope holds it', () => {
    renderShell(dialog())
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'kafka' } })
    expect(screen.getAllByRole('option')).toHaveLength(6)
    for (const heading of ['Elements', 'Documentation', 'Decisions', 'Observations']) expect(screen.getByText(heading)).toBeTruthy()
    // The kind within the kind, and where a record stands.
    expect(screen.getAllByText('Application').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Critical')).toHaveLength(2)
    expect(screen.getAllByText('OB-0004')).toHaveLength(2)
    // Which scope: this one, the one above, and one elsewhere in the tree.
    expect(screen.getByText(/^Acme · Kafka, not RabbitMQ/)).toBeTruthy()
    expect(screen.getAllByText(/^Shop/).length).toBeGreaterThan(0)
    expect(screen.getByText(/^Warehouse/)).toBeTruthy()
  })

  it('names its headings in Dutch and German too', () => {
    renderShell(<GlobalSearchDialog open sources={sources} scopeLabel={scopeLabel} onClose={() => {}} onChoose={() => {}} s={translator('nl')} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'kafka' } })
    expect(screen.getByText('Waarnemingen')).toBeTruthy()
    cleanup()
    renderShell(<GlobalSearchDialog open sources={sources} scopeLabel={scopeLabel} onClose={() => {}} onChoose={() => {}} s={translator('de')} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'kafka' } })
    expect(screen.getByText('Beobachtungen')).toBeTruthy()
  })

  it('Enter takes the highlighted hit and closes; the arrows move the highlight', () => {
    const onChoose = vi.fn()
    const onClose = vi.fn()
    renderShell(dialog({ onChoose, onClose }))
    const field = screen.getByRole('combobox')
    fireEvent.change(field, { target: { value: 'kafka' } })
    fireEvent.keyDown(field, { key: 'ArrowDown' })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ kind: 'documentation', id: 'crm', scope: 'shop', opens: { page: 'document', id: 'crm' } }))
    expect(onClose).toHaveBeenCalled()
  })

  it('says so when nothing matches', () => {
    renderShell(dialog())
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } })
    expect(screen.getByText('Nothing matches “zzz”.')).toBeTruthy()
  })
})

describe('what the chip beside a title says', () => {
  const s = translator('en')
  const hit = (over: Partial<SearchHit>): SearchHit => ({
    kind: 'element', id: 'x', title: 'X', about: [], snippet: '', opens: { page: 'element', id: 'x' }, ...over,
  })

  it('names the kind within the kind', () => {
    expect(chipOf(hit({ variant: 'platformService' }), s)).toBe('Platform service')
    expect(chipOf(hit({ kind: 'view', variant: 'map' }), s)).toBe('Enterprise map')
    expect(chipOf(hit({ kind: 'relation', variant: 'hostedOn' }), s)).toBe('Hosted on')
    expect(chipOf(hit({ kind: 'view', variant: 'somethingNew' }), s)).toBeUndefined()
    expect(chipOf(hit({}), s)).toBeUndefined()
  })

  it('says where a record stands, in its own module\'s words', () => {
    expect(chipOf(hit({ kind: 'decision', status: 'accepted' }), s)).toBe('Accepted')
    expect(chipOf(hit({ kind: 'observation', status: 'archived' }), s)).toBe('Archived')
    expect(chipOf(hit({ kind: 'experiment', status: 'refuted' }), s)).toBe('Refuted')
    expect(chipOf(hit({ kind: 'milestone', status: 'late' }), s)).toBe('late')
  })

  it('is what a click takes, too', () => {
    const onChoose = vi.fn()
    renderShell(dialog({ onChoose }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'topic full' } })
    fireEvent.mouseMove(screen.getByRole('option'))
    fireEvent.click(screen.getByRole('option'))
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ id: 'ob-w', scope: 'shop/warehouse' }))
  })
})
