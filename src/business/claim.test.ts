// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Command } from '../model/commands'
import type { DesignElement } from '../model/types'
import { claimCommand, isAbove } from './claim'
import type { ClaimEntry } from './claim'
import { area, capability } from './testFixtures'

/** The organisation defines Billing and Invoicing under it; acme/retail is the domain taking them up. */
const BILLING: ClaimEntry = { id: 'billing', kind: 'function', name: 'Billing', master: '' }
const INVOICING: ClaimEntry = { id: 'invoicing', kind: 'function', name: 'Invoicing', master: '', parentId: 'billing' }
const standIn = (entry: ClaimEntry): DesignElement => ({
  id: entry.id, kind: entry.kind, name: entry.name, ref: entry.master, lifecycle: 'live', isManaged: false, aspects: {},
})
const claim = (entry: ClaimEntry, elements: DesignElement[] = [], sheet?: { id: string; areas?: string[] }) => claimCommand({
  entry, scope: 'acme/retail', model: { elements }, standIn: standIn(entry), ...(sheet ? { sheet } : {}),
})
const commands = (command: Command): Command[] => (command.type === 'transaction' ? command.commands : [command])

describe('isAbove', () => {
  it('is strictly above: the organisation over everything, a path over the ones filed under it', () => {
    expect(isAbove('', 'acme')).toBe(true)
    expect(isAbove('acme', 'acme/retail')).toBe(true)
    expect(isAbove('acme', 'acme')).toBe(false)
    expect(isAbove('acme/retail', 'acme')).toBe(false)
    expect(isAbove('acme/re', 'acme/retail')).toBe(false)
  })
})

describe('claimCommand', () => {
  it('takes a root up as a stand-in, and puts it on the list of a sheet that lists its areas', () => {
    const plan = claim(BILLING, [area('own', 'Own work')], { id: 'sh', areas: ['own'] })
    if (!('command' in plan)) throw new Error(JSON.stringify(plan))
    expect(plan.drawnOn).toBe('sh')
    expect(commands(plan.command)).toEqual([
      { type: 'element.create', element: standIn(BILLING) },
      { type: 'diagram.update', id: 'sh', patch: { areas: ['own', 'billing'] } },
    ])
  })

  it('writes the stand-in alone on a sheet that draws every root', () => {
    const plan = claim(BILLING, [], { id: 'sh' })
    if (!('command' in plan)) throw new Error(JSON.stringify(plan))
    expect(plan.command).toEqual({ type: 'element.create', element: standIn(BILLING) })
    expect(plan.drawnOn).toBe('sh')
  })

  it('files a capability under its parent where this scope holds the parent, and leaves the sheet alone', () => {
    const plan = claim(INVOICING, [{ ...area('billing', 'Billing'), ref: '' }, capability('mine', 'Own', 'billing', { order: 1 })], { id: 'sh', areas: ['billing'] })
    if (!('command' in plan)) throw new Error(JSON.stringify(plan))
    expect(plan.parentId).toBe('billing')
    expect(plan.drawnOn).toBeUndefined()
    expect(commands(plan.command)).toEqual([{ type: 'element.create', element: { ...standIn(INVOICING), parentId: 'billing', order: 2 } }])
  })

  it('makes a capability whose parent this scope does not hold a root of its own', () => {
    const plan = claim(INVOICING, [], { id: 'sh', areas: [] })
    if (!('command' in plan)) throw new Error(JSON.stringify(plan))
    expect(plan.parentId).toBeUndefined()
    expect(commands(plan.command)[1]).toEqual({ type: 'diagram.update', id: 'sh', patch: { areas: ['invoicing'] } })
  })

  it('takes in what it already took up under it, off every sheet’s list, as one step', () => {
    const invoicing = { ...capability('invoicing', 'Invoicing', 'billing'), parentId: undefined, ref: '' }
    const own = area('own', 'Own work')
    const other = { id: 'sh-2', kind: 'sheet' as const, name: 'Other', areas: ['invoicing'], members: [] }
    const plan = claimCommand({
      entry: BILLING, scope: 'acme/retail', standIn: standIn(BILLING),
      model: { elements: [own, invoicing], diagrams: [other] },
      sheet: { id: 'sh', areas: ['own', 'invoicing'] },
      parentOf: (id) => (id === 'invoicing' ? 'billing' : undefined),
    })
    if (!('command' in plan)) throw new Error(JSON.stringify(plan))
    expect(plan.adopted).toEqual(['invoicing'])
    expect(plan.command.type).toBe('transaction')
    expect(commands(plan.command)).toEqual([
      { type: 'element.create', element: standIn(BILLING) },
      { type: 'element.update', id: 'invoicing', patch: { parentId: 'billing' } },
      { type: 'diagram.update', id: 'sh-2', patch: { areas: [] } },
      { type: 'diagram.update', id: 'sh', patch: { areas: ['own', 'billing'] } },
    ])
  })

  it('marks the step as the agent’s when asked', () => {
    const plan = claimCommand({ entry: BILLING, scope: 'acme/retail', model: { elements: [] }, standIn: standIn(BILLING), origin: 'agent', sheet: { id: 'sh', areas: [] } })
    if (!('command' in plan)) throw new Error(JSON.stringify(plan))
    expect(plan.command.origin).toBe('agent')
  })

  it('refuses a function of a scope beside or below, saying where it is defined', () => {
    expect(claim({ ...BILLING, master: 'acme/wholesale' })).toEqual({ refused: 'claim.notAbove', detail: 'billing is defined in "acme/wholesale"' })
    expect(claim({ ...BILLING, master: 'acme/retail/shops' })).toMatchObject({ refused: 'claim.notAbove' })
    expect(claim({ ...BILLING, master: undefined })).toMatchObject({ refused: 'claim.notAbove' })
  })

  it('refuses a function this scope defines', () => {
    expect(claim({ ...BILLING, master: 'acme/retail' })).toMatchObject({ refused: 'claim.definedHere' })
    expect(claim(BILLING, [area('billing', 'Billing')])).toMatchObject({ refused: 'claim.definedHere' })
  })

  it('answers that one held as a stand-in already is held, and refuses what is not a function or not known', () => {
    expect(claim(BILLING, [{ ...area('billing', 'Billing'), ref: '' }])).toEqual({ already: true })
    expect(claim({ ...BILLING, kind: 'application' })).toMatchObject({ refused: 'claim.notAFunction' })
    expect(claimCommand({ entry: undefined, scope: 'acme', model: { elements: [] }, standIn: standIn(BILLING) })).toEqual({ refused: 'claim.unknown' })
  })
})
