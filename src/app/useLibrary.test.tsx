// @vitest-environment jsdom
/**
 * The register as a library, wired (ADR-0012 §2, §3).
 *
 * The rule under test is the one the arithmetic pins in `projects/library`,
 * seen from the session: drawing what another scope defines writes THIS scope
 * a stand-in and nothing else, one command, one undo step; a record held here
 * is only placed; and an application nobody defines is a question whose two
 * answers are a definition here or one more stand-in.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import { translator } from '../i18n'
import type { DesignElement } from '../model'
import type { HostModel } from '../model/fromInterchange'
import type { ScopeSnapshot } from '../projects/scope'
import { indexScopes } from '../projects/scopeIndex'
import { useModelSession } from './useModelSession'
import type { ModelSession } from './useModelSession'
import { useLibrary } from './useLibrary'
import type { Library } from './useLibrary'

afterEach(() => cleanup())

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over }
}

/** This scope: one application of its own, and a landscape drawing it. */
function model(): HostModel {
  return {
    name: 'Retail',
    elements: [element('pos', { name: 'Point of sale' }), element('crm', { name: 'CRM', ref: '' })],
    relations: [],
    diagrams: [
      laidOut({ id: 'd1', kind: 'layer7', name: 'Landscape', placements: [{ id: 'pos', x: 0, y: 0 }] }),
      laidOut({ id: 'sheet', kind: 'sheet', name: 'Sheet', placements: [] }),
    ],
  }
}

/** The tree around it: the organisation, a domain beneath, and one nobody defines. */
const index = indexScopes([
  { path: '', model: { elements: [element('crm', { name: 'CRM' })], relations: [] } },
  { path: 'acme/retail', model: { elements: model().elements, relations: [] } },
  { path: 'acme/retail/stores', model: { elements: [element('shelf', { name: 'Shelf planner' })], relations: [] } },
  { path: 'acme/finance', model: { elements: [element('ledger', { name: 'Ledger', ref: 'acme/accounting' })], relations: [] } },
])

function mount(activeDiagramId = 'd1') {
  const focus = vi.fn()
  const notify = vi.fn()
  let library!: Library
  let session!: ModelSession
  function Host() {
    session = useModelSession({
      initialProject: { path: 'acme/retail', model: model(), activeDiagramId, logoLibrary: [] } as ScopeSnapshot,
      notify: vi.fn(), s: translator('en'),
    })
    library = useLibrary({
      session, scope: 'acme/retail', index, notify, s: translator('en'), focus,
      scopeLabel: (path) => path || 'Acme',
    })
    return null
  }
  render(<Host />)
  const current = () => session.current()
  const drawn = (id: string) => current().diagrams[0].members.some((member) => member.id === id)
  const held = (id: string) => current().elements.find((one) => one.id === id)
  return { focus, notify, lib: () => library, session: () => session, current, drawn, held }
}

describe('useLibrary', () => {
  it('lists every application in the organisation that is not on this board', () => {
    const host = mount()
    act(() => host.lib().open())
    const choice = host.lib().choice
    expect(choice?.kind).toBe('picking')
    if (choice?.kind !== 'picking') return
    expect(choice.rows.map((row) => row.id)).toEqual(['crm', 'ledger', 'shelf'])
    expect(choice.rows.find((row) => row.id === 'crm')?.held).toBe(true)
  })

  it('draws what a scope beneath defines as a stand-in, in the external band, and claims nothing', () => {
    const host = mount()
    act(() => host.lib().open())
    act(() => host.lib().pick('shelf'))
    expect(host.held('shelf')).toMatchObject({ name: 'Shelf planner', ref: 'acme/retail/stores', isManaged: false })
    expect(host.current().diagrams[0].members.find((member) => member.id === 'shelf')?.zone).toBe('externalSystems')
    expect(host.focus).toHaveBeenCalledWith('shelf')
    expect(host.notify).toHaveBeenCalledWith(
      'Shelf planner is on the board, standing in for the record in acme/retail/stores', 'success',
    )
    expect(host.lib().choice).toBeUndefined()
    // One step: undo takes the record and its place back together.
    act(() => { host.session().undo() })
    expect(host.held('shelf')).toBeUndefined()
    expect(host.drawn('shelf')).toBe(false)
  })

  it('only places a record this scope holds already', () => {
    const host = mount()
    act(() => host.lib().open())
    act(() => host.lib().pick('crm'))
    expect(host.drawn('crm')).toBe(true)
    expect(host.held('crm')).toMatchObject({ name: 'CRM', ref: '' })
    expect(host.notify).toHaveBeenCalledWith('CRM is on the board', 'success')
  })

  it('asks about one nobody defines, and a yes makes this scope its owner', () => {
    const host = mount()
    act(() => host.lib().open())
    act(() => host.lib().pick('ledger'))
    expect(host.lib().choice).toEqual({ kind: 'asking', id: 'ledger', name: 'Ledger', canDrawOnly: true })
    expect(host.held('ledger')).toBeUndefined()
    act(() => host.lib().own())
    expect(host.held('ledger')).toMatchObject({ name: 'Ledger', isManaged: true })
    expect(host.held('ledger')?.ref).toBeUndefined()
    expect(host.current().diagrams[0].members.find((member) => member.id === 'ledger')?.zone).toBe('landscape')
    expect(host.notify).toHaveBeenCalledWith('This scope answers for Ledger now', 'success')
  })

  it('and a no draws one more stand-in at the address the others carry', () => {
    const host = mount()
    act(() => host.lib().open())
    act(() => host.lib().pick('ledger'))
    act(() => host.lib().drawOnly())
    expect(host.held('ledger')).toMatchObject({ name: 'Ledger', ref: 'acme/accounting' })
    expect(host.drawn('ledger')).toBe(true)
  })

  it('lets the question go unanswered', () => {
    const host = mount()
    act(() => host.lib().open())
    act(() => host.lib().pick('ledger'))
    act(() => host.lib().close())
    expect(host.lib().choice).toBeUndefined()
    expect(host.held('ledger')).toBeUndefined()
  })

  it('says why when the pick cannot land, and offers nothing over a view that draws no cards', () => {
    const host = mount()
    act(() => host.lib().open())
    act(() => host.lib().pick('pos'))
    expect(host.notify).toHaveBeenCalledWith('Point of sale is on this board already.', 'warning')
    expect(host.lib().choice).toBeUndefined()

    const sheet = mount('sheet')
    act(() => sheet.lib().open())
    act(() => sheet.lib().pick('shelf'))
    expect(sheet.notify).toHaveBeenCalledWith('A card is drawn on a landscape or a container view.', 'warning')
    expect(sheet.held('shelf')).toBeUndefined()
  })
})
