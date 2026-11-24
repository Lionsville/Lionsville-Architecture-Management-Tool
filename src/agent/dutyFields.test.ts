// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A role described and a duty said more of, at the agent (ADR-0052): written
 * by `role.add`, `role.update` and `raci.set`, read by the two lists, the
 * search, the export and a script, and refused where the source cannot keep
 * a part yet.
 */
import { describe, expect, it } from 'vitest'
import type { HostModel } from '../model/hostModel'
import type { Duty } from '../model/operatingModel'
import { codeMode } from './code/query'
import { hostOver, said, sessionOver, shellOver } from './code/testing/codeHost'
import { handle } from './handle'
import type { SessionView } from './handle'

const ORDER: Duty = { responsibility: 'rs-order', raci: 'A', alsoResponsible: true, certainty: 'confirmed', source: 'Role book, page 4' }

const ORGANISATION: HostModel = {
  name: 'Acme Logistics', elements: [], relations: [], diagrams: [],
  roles: [
    { id: 'ro-dev', name: 'Developer', duties: [{ responsibility: 'rs-order', raci: 'R' }] },
    { id: 'ro-po', name: 'Product owner', order: 1, description: 'Keeps the **backlog** in a sensible order.', duties: [ORDER] },
  ],
  responsibilities: [{ id: 'rs-order', name: 'Order the backlog' }, { id: 'rs-plan', name: 'Plan the interval', order: 1 }],
}

const open = (host: HostModel = ORGANISATION) => sessionOver(host, '', {})
const ask = (tool: string, args: unknown, on: SessionView) => handle({ id: '1', tool, args }, on)
const wrong = async (tool: string, args: unknown, on: SessionView) => {
  const out = await ask(tool, args, on)
  return out.ok ? undefined : { key: out.refusal, detail: out.detail ?? '' }
}
const dutiesOf = (on: ReturnType<typeof open>, id: string) => on.current().roles!.find((one) => one.id === id)!.duties
const set = (on: SessionView, ...cells: object[]) => ask('raci.set', { cells }, on)
const PO = { roleId: 'ro-po', responsibilityId: 'rs-order' }
const DEV = { roleId: 'ro-dev', responsibilityId: 'rs-order' }

describe('a role', () => {
  it('is described, and a blank or a null takes the description away', async () => {
    const on = open()
    const added = said(await ask('role.add', { name: 'Coach', description: '## Does\n\nHelps.' }, on))
    expect(added).toMatchObject({ described: true })
    expect(on.current().roles!.at(-1)!.description).toBe('## Does\n\nHelps.')
    expect(said(await ask('role.update', { id: added.id, description: null }, on))).not.toHaveProperty('described')
    expect(on.current().roles!.at(-1)).not.toHaveProperty('description')
    await ask('role.update', { id: 'ro-po', description: ' ' }, on)
    expect(on.current().roles![1]).not.toHaveProperty('description')
  })

  it('keeps what a list of letters does not say, and drops a mark with the letter', async () => {
    const on = open()
    await ask('role.update', { id: 'ro-po', duties: [{ responsibilityId: 'rs-order', raci: 'A' }, { responsibilityId: 'rs-plan', raci: 'C' }] }, on)
    expect(dutiesOf(on, 'ro-po')).toEqual([ORDER, { responsibility: 'rs-plan', raci: 'C' }])
    await ask('role.update', { id: 'ro-po', duties: [{ responsibilityId: 'rs-order', raci: 'R' }] }, on)
    expect(dutiesOf(on, 'ro-po')).toEqual([{ responsibility: 'rs-order', raci: 'R', source: 'Role book, page 4' }])
  })

  it('says the fields of a duty, and null or blank clears them', async () => {
    const on = open()
    const duty = { responsibilityId: 'rs-plan', raci: 'A', alsoResponsible: true, certainty: 'assumed', source: ' Interview ' }
    expect(said(await ask('role.add', { name: 'Coach', duties: [duty] }, on)).duties)
      .toEqual([{ ...duty, responsibility: 'Plan the interval', source: 'Interview' }])
    await ask('role.update', { id: 'ro-po', duties: [{ responsibilityId: 'rs-order', raci: 'A', alsoResponsible: false, certainty: null, source: '' }] }, on)
    expect(dutiesOf(on, 'ro-po')).toEqual([{ responsibility: 'rs-order', raci: 'A' }])
  })

  it('is refused also responsible beside another letter, an unknown mark and no letter', async () => {
    const on = open()
    const refuse = (duty: object) => wrong('role.update', { id: 'ro-dev', duties: [{ responsibilityId: 'rs-order', ...duty }] }, on)
    expect(await refuse({ raci: 'R', alsoResponsible: true })).toEqual({
      key: 'agent.badArguments', detail: 'duties[0]: alsoResponsible is said beside an A, and the letter is R',
    })
    expect((await refuse({ raci: 'R', certainty: 'sure' }))?.key).toBe('agent.badArguments')
    expect((await refuse({ raci: null }))?.key).toBe('agent.badArguments')
    expect(on.history()).toHaveLength(0)
  })
})

describe('a cell', () => {
  it('changes a field without its letter, and the other fields stay', async () => {
    const on = open()
    const out = said(await set(on, { ...PO, certainty: 'assumed' }, { ...DEV, source: 'Interview' }))
    expect(out).toMatchObject({ set: 2, changed: [{ ...PO, raci: 'A', was: 'A', fields: ['certainty'] }, { ...DEV, raci: 'R', was: 'R', fields: ['source'] }] })
    expect(dutiesOf(on, 'ro-po')).toEqual([{ ...ORDER, certainty: 'assumed' }])
    expect(dutiesOf(on, 'ro-dev')).toEqual([{ responsibility: 'rs-order', raci: 'R', source: 'Interview' }])
    // Two roles in one step, neither a letter.
    expect(on.history()[0].summary).toEqual({ key: 'activity.raciSet', count: 2 })
  })

  it('clears a field by null, keeps everything on the same letter, and goes whole', async () => {
    const on = open()
    expect(said(await set(on, { ...PO, raci: 'A' }))).toMatchObject({ set: 0, unchanged: 1 })
    await set(on, { ...PO, raci: 'A', alsoResponsible: null, source: null })
    expect(dutiesOf(on, 'ro-po')).toEqual([{ responsibility: 'rs-order', raci: 'A', certainty: 'confirmed' }])
    expect(said(await set(on, { ...PO, raci: null })).changed).toEqual([{ ...PO, raci: null, was: 'A' }])
    expect(dutiesOf(on, 'ro-po')).toEqual([])
  })

  it('takes the mark away with the letter unless it says one, and names what went', async () => {
    const on = open()
    expect(said(await set(on, { ...PO, raci: 'C' })).changed).toEqual([{ ...PO, raci: 'C', was: 'A', fields: ['alsoResponsible', 'certainty'] }])
    expect(dutiesOf(on, 'ro-po')).toEqual([{ responsibility: 'rs-order', raci: 'C', source: 'Role book, page 4' }])
    await set(on, { ...PO, raci: 'A', alsoResponsible: true, certainty: 'assumed' })
    expect(dutiesOf(on, 'ro-po')).toEqual([{ ...ORDER, certainty: 'assumed' }])
  })

  it('says everything wrong at once, and lands nothing', async () => {
    const on = open()
    const bad = await wrong('raci.set', { cells: [
      { ...DEV, alsoResponsible: true },
      { roleId: 'ro-dev', responsibilityId: 'rs-plan', source: 'Interview' },
      { ...PO },
      { roleId: 'ro-po', responsibilityId: 'rs-plan', raci: null, certainty: 'assumed' },
    ] }, on)
    expect(bad?.key).toBe('agent.badArguments')
    for (const part of [
      'cells[0]: alsoResponsible is said beside an A, and the letter is R', 'cells[1]: Developer has no letter in it: give raci',
      'cells[2]: says nothing to set', 'cells[3]: a cell that is cleared says nothing else',
    ]) expect(bad?.detail).toContain(part)
    expect(on.history()).toHaveLength(0)
  })
})

describe('the lists', () => {
  const rows = async (args: object, on = open()) => said(await ask('roles.list', args, on)).roles as Record<string, unknown>[]

  it('are in the organisation\'s order, and describe a role only when asked', async () => {
    const all = await rows({})
    expect(all.map((one) => one.id)).toEqual(['ro-po', 'ro-dev'])
    expect(all[0]).toMatchObject({ described: true, duties: [{ raci: 'A', alsoResponsible: true, certainty: 'confirmed', source: 'Role book, page 4' }] })
    expect(all[0]).not.toHaveProperty('description')
    expect(await rows({ fields: ['name', 'description'] })).toEqual([
      { id: 'ro-po', name: 'Product owner', description: 'Keeps the **backlog** in a sensible order.' }, { id: 'ro-dev', name: 'Developer' },
    ])
    expect(await rows({ id: 'ro-po' })).toMatchObject([{ id: 'ro-po', description: 'Keeps the **backlog** in a sensible order.' }])
    expect((await wrong('roles.list', { id: 'ro-x' }, open()))?.key).toBe('agent.unknownId')
  })

  it('page descriptions like anything else', async () => {
    const on = open()
    const first = said(await ask('roles.list', { fields: ['description'], limit: 1 }, on))
    const second = said(await ask('roles.list', { fields: ['description'], limit: 1, cursor: first.next }, on))
    expect([...(first.roles as object[]), ...(second.roles as object[])]).toHaveLength(2)
    expect(second).not.toHaveProperty('moved')
  })

  it('say who is responsible as well as who is accountable', async () => {
    const list = said(await ask('responsibilities.list', {}, open())).responsibilities as Record<string, unknown>[]
    expect(list.map((one) => one.id)).toEqual(['rs-plan', 'rs-order'])
    expect(list[0]).toMatchObject({ accountable: [], responsible: [] })
    expect(list[1]).toMatchObject({
      raci: [{ roleId: 'ro-po', raci: 'A', alsoResponsible: true, certainty: 'confirmed', source: 'Role book, page 4' }, { roleId: 'ro-dev', raci: 'R' }],
      accountable: [{ id: 'ro-po', name: 'Product owner' }],
      responsible: [{ id: 'ro-po', name: 'Product owner' }, { id: 'ro-dev', name: 'Developer' }],
    })
  })
})

describe('elsewhere', () => {
  it('a search finds a description, and the export carries every field', async () => {
    const on = open()
    expect(said(await ask('search', { query: 'sensible' }, on)).hits).toMatchObject([{ kind: 'role', id: 'ro-po' }])
    expect(said(await ask('project.export', { format: 'json' }, on))).toMatchObject({ roles: [{ id: 'ro-dev' }, { duties: [ORDER] }] })
  })

  it('a batch says the fields of what its earlier steps made', async () => {
    const on = open()
    said(await ask('batch', { steps: [
      { tool: 'role.add', args: { name: 'Coach', description: 'Helps.' } },
      { tool: 'raci.set', args: { cells: [{ roleId: { $ref: 'steps[0].id' }, responsibilityId: 'rs-plan', raci: 'A', alsoResponsible: true, source: 'Role book' }] } },
    ] }, on))
    expect(on.history()).toHaveLength(1)
    expect(on.current().roles!.at(-1)).toMatchObject({
      description: 'Helps.', duties: [{ responsibility: 'rs-plan', raci: 'A', alsoResponsible: true, source: 'Role book' }],
    })
  })

  it('a script tries them and runs them', async () => {
    const on = open()
    const host = hostOver({ session: on, shell: shellOver() })
    const mode = codeMode()
    const tried = said(await mode.answer({ id: '1', tool: 'simulate', args: { script: `
      const role = await lv.roles.add({ name: "Coach", description: "Helps." })
      await lv.raci.set({ cells: [{ roleId: "ro-dev", responsibilityId: "rs-order", certainty: "assumed" }] })
      const [read] = (await lv.roles.list({ id: role.id })).roles
      return read.description
    ` } }, host))
    expect(tried).toMatchObject({ result: 'Helps.', refusals: [] })
    said(await mode.answer({ id: '2', tool: 'run', args: { token: tried.token } }, host))
    expect(dutiesOf(on, 'ro-dev')).toEqual([{ responsibility: 'rs-order', raci: 'R', certainty: 'assumed' }])
  })

  it('a part the source cannot keep is refused in its words, and the rest goes on', async () => {
    const at = (part: string): SessionView => ({ ...open(), unkept: (asked) => (asked === part ? 'Elsewhere cannot keep it yet.' : undefined) })
    const refuse = async (part: string, tool: string, args: object) => wrong(tool, args, at(part))
    expect(await refuse('role.description', 'role.add', { name: 'Coach', description: 'x' }))
      .toEqual({ key: 'agent.notKeptHere', detail: '"description": Elsewhere cannot keep it yet.' })
    expect((await refuse('role.description', 'role.update', { id: 'ro-po', description: null }))?.key).toBe('agent.notKeptHere')
    for (const [field, value] of [['alsoResponsible', true], ['certainty', 'assumed'], ['source', 'x']] as const) {
      const part = `duty.${field}`
      expect((await refuse(part, 'raci.set', { cells: [{ ...PO, raci: 'A', [field]: value }] }))?.detail).toBe(`"${field}": Elsewhere cannot keep it yet.`)
      expect((await refuse(part, 'role.update', { id: 'ro-po', duties: [{ responsibilityId: 'rs-order', raci: 'A', [field]: value }] }))?.key).toBe('agent.notKeptHere')
      expect((await ask('raci.set', { cells: [{ ...PO, raci: 'C' }] }, at(part))).ok).toBe(true)
    }
    expect((await ask('role.add', { name: 'Coach', duties: [{ responsibilityId: 'rs-plan', raci: 'A' }] }, at('role.description'))).ok).toBe(true)
  })
})
