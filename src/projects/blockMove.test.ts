// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A building block moved to another scope (ADR-0043, amended 24 November
 * 2026). Two properties carry the rest, as they do for a gesture: **the
 * target is written first and the source last**, pinned here rather than
 * inferred from a hook, and **every no is a value**. Each scope's step is
 * also put through the writer, so what is planned is what lands.
 */
import { describe, expect, it } from 'vitest'
import type { Adr } from '../model/adr'
import type { Citation } from '../model/citable'
import type { Comment } from '../model/comment'
import type { Command } from '../model/commands'
import type { Evaluation } from '../model/evaluation'
import type { HostModel } from '../model/hostModel'
import type { ImageEntry } from '../model/imageName'
import { fromArrays, toArrays } from '../model/normalised'
import { apply } from '../model/reducer'
import { connection, diagram, element, placement } from '../model/testFixtures'
import type { DesignElement } from '../model/types'
import { planBlockMove, stillNamed } from './blockMove'
import type { BlockMovePlan, BlockMoveRequest, BlockMoveScope } from './blockMove'

const GATEWAY: DesignElement = {
  id: 'blk-gw', kind: 'buildingBlock', name: 'Message gateway', lifecycle: 'live', isManaged: false, aspects: {},
  description: 'What it is.\n\n![Routing](image:routing.png)\n',
  capabilities: [{ id: 'cap-route', text: 'Routes by content', aspect: { scope: '', id: 'pr-1', number: 1 } }],
  contexts: [{ id: 'cx-partners', name: 'Many partners', needs: { 'cap-route': 4 } }],
  sbbs: [{ id: 'sb-a', name: 'Broker A', sort: 'product', status: 'candidate' }],
}

const AT = '2026-11-20T09:00:00.000Z'
const asked: Comment = { id: 'cm-1', about: { kind: 'element', id: 'blk-gw' }, by: { person: 'pe-1' }, at: AT, body: 'Who runs this?' }
const answered: Comment = { ...asked, id: 'cm-2', by: { person: 'pe-2' }, body: 'Integration does.', replyTo: 'cm-1' }
const elsewhere: Comment = { ...asked, id: 'cm-9', about: { kind: 'element', id: 'app-broker' }, body: 'Not the block\'s.' }

const supports: Citation = { id: 'ci-1', about: { kind: 'element', id: 'blk-gw' }, principle: { scope: '', id: 'pr-1' }, stance: 'supports', on: '2026-11-02' }
const other: Citation = { ...supports, id: 'ci-9', about: { kind: 'element', id: 'app-broker' } }

const compared = (over: Partial<Evaluation> = {}): Evaluation => ({
  id: 'topics.integration~blk-gw', block: { scope: 'topics/integration', id: 'blk-gw' }, contexts: ['cx-partners'], options: ['sb-a'],
  coverage: { 'sb-a': { 'cap-route': { level: 4, how: 'Out of the box' } } }, chosen: 'sb-a', decidedBy: 'adr-1', ...over,
})

const chose: Adr = {
  id: 'adr-1', number: 1, title: 'Choose Broker A', status: 'accepted', date: '2026-11-10', body: '', signers: [],
  chooses: { evaluation: 'topics.integration~blk-gw', option: 'sb-a' },
}

const picture = (name: string, digest: string): ImageEntry => ({
  name, mediaType: 'image/png', size: 10, width: 4, height: 3, contentAddress: `sha256:${digest.repeat(64)}`,
})

const model = (over: Partial<HostModel> = {}): HostModel => ({ name: 'Scope', elements: [], relations: [], diagrams: [], ...over })

/** A topic keeps the block, cited and commented on; two scopes compare its options, one of them decided. */
function tree(over: Partial<Record<string, Partial<BlockMoveScope>>> = {}): BlockMoveScope[] {
  const scopes: BlockMoveScope[] = [
    { path: '', model: model({ name: 'Acme' }) },
    {
      path: 'topics/integration',
      model: model({ elements: [GATEWAY, element('app-broker')], comments: [asked, elsewhere, answered], citations: [supports, other] }),
      images: [picture('routing.png', 'a')],
    },
    { path: 'topics/security', model: model(), images: [] },
    { path: 'sales', model: model({ evaluations: [compared()], decisions: [chose] }) },
    { path: 'stock', model: model({ evaluations: [compared({ id: '-~blk-other', block: { scope: '', id: 'blk-other' }, chosen: undefined, decidedBy: undefined }), compared({ chosen: undefined, decidedBy: undefined })] }) },
  ]
  return scopes.map((scope) => ({ ...scope, ...over[scope.path] }))
}

const picturesIn = (document: string) => [...document.matchAll(/\(image:([^)]+)\)/g)].map((match) => match[1])

const request = (over: Partial<BlockMoveRequest> = {}): BlockMoveRequest => ({
  block: 'blk-gw', from: 'topics/integration', to: 'topics/security', scopes: tree(), picturesIn, ...over,
})

const planned = (answer: BlockMovePlan) => {
  if (!answer.ok) throw new Error(`refused: ${answer.refusal}`)
  return answer
}

/** A scope's model once its step has landed: the writer takes the step, or the test fails. */
function landed(scopes: readonly BlockMoveScope[], path: string, command: Command): HostModel {
  const result = apply(fromArrays(scopes.find((scope) => scope.path === path)!.model), command)
  if (!result.ok) throw new Error(`refused in ${path || '/'}: ${result.reason}`)
  return toArrays(result.model)
}

const flat = (command: Command): Command[] => (command.type === 'transaction' ? command.commands.flatMap(flat) : [command])

describe('a building block moved to another scope', () => {
  it('writes the target first, then each scope that compares it, and the source last', () => {
    const plan = planned(planBlockMove(request()))
    expect(plan.writes.map((write) => write.path)).toEqual(['topics/security', 'sales', 'stock', 'topics/integration'])
    expect(plan).toMatchObject({ name: 'Message gateway', standIn: false, comments: 2, citations: 1, compared: ['sales', 'stock'] })
  })

  it('arrives whole: its document, its requirements and catalogue, the principles it cites and its thread', () => {
    const scopes = tree()
    const plan = planned(planBlockMove(request({ scopes })))
    expect(flat(plan.writes[0].command).map((command) => command.type)).toEqual(['element.create', 'citation.add', 'comment.add', 'comment.add'])
    const target = landed(scopes, 'topics/security', plan.writes[0].command)
    expect(target.elements).toEqual([GATEWAY])
    expect(target.citations).toEqual([supports])
    // Each comment says the scope it was written in; a reply stays under what it answers.
    expect(target.comments).toEqual([
      { ...asked, from: { kind: 'element', id: 'blk-gw', scope: 'topics/integration' } },
      { ...answered, from: { kind: 'element', id: 'blk-gw', scope: 'topics/integration' } },
    ])
  })

  it('leaves the source without the block, its citations and its thread, and with everything else', () => {
    const scopes = tree()
    const plan = planned(planBlockMove(request({ scopes })))
    const last = plan.writes.at(-1)!
    expect(flat(last.command).map((command) => command.type)).toEqual(['citation.remove', 'comment.take', 'comment.take', 'element.delete'])
    const source = landed(scopes, 'topics/integration', last.command)
    expect(source.elements.map((one) => one.id)).toEqual(['app-broker'])
    expect(source.comments).toEqual([elsewhere])
    expect(source.citations).toEqual([other])
  })

  it('names the block\'s new place in every comparison, where it stood, with its ratings and choice, and in the decision that chose', () => {
    const scopes = tree()
    const plan = planned(planBlockMove(request({ scopes })))
    const sales = landed(scopes, 'sales', plan.writes[1].command)
    expect(sales.evaluations).toEqual([compared({ id: 'topics.security~blk-gw', block: { scope: 'topics/security', id: 'blk-gw' } })])
    expect(sales.decisions![0].chooses).toEqual({ evaluation: 'topics.security~blk-gw', option: 'sb-a' })
    // Another block's comparison is not touched, and this one keeps its place after it.
    const stock = landed(scopes, 'stock', plan.writes[2].command)
    expect(stock.evaluations!.map((one) => one.id)).toEqual(['-~blk-other', 'topics.security~blk-gw'])
  })

  it('says the organisation\'s own scope as the id does', () => {
    const scopes = tree()
    const plan = planned(planBlockMove(request({ scopes, to: '' })))
    const sales = landed(scopes, 'sales', plan.writes.find((write) => write.path === 'sales')!.command)
    expect(sales.evaluations![0]).toMatchObject({ id: '-~blk-gw', block: { scope: '', id: 'blk-gw' } })
  })

  it('writes a scope once where it is the target or the source and compares the block too', () => {
    const own = compared({ chosen: undefined, decidedBy: undefined })
    const scopes = tree({
      'topics/integration': { model: model({ elements: [GATEWAY], evaluations: [own] }) },
      sales: { model: model({ evaluations: [own] }) },
    })
    const plan = planned(planBlockMove(request({ scopes, to: 'sales' })))
    expect(plan.writes.map((write) => write.path)).toEqual(['sales', 'stock', 'topics/integration'])
    expect(landed(scopes, 'sales', plan.writes[0].command)).toMatchObject({ elements: [{ id: 'blk-gw' }], evaluations: [{ id: 'sales~blk-gw' }] })
    const source = landed(scopes, 'topics/integration', plan.writes[2].command)
    expect(source).toMatchObject({ elements: [], evaluations: [{ id: 'sales~blk-gw', block: { scope: 'sales', id: 'blk-gw' } }] })
  })

  it('leaves a stand-in where a view of the source draws the block, without the block\'s own text', () => {
    const drawn = model({
      elements: [GATEWAY, element('app-broker')], relations: [connection('c#1', 'app-broker', 'blk-gw')],
      diagrams: [diagram('landscape', { placements: [placement('blk-gw'), placement('app-broker')] })],
      comments: [asked], citations: [supports],
    })
    const scopes = tree({ 'topics/integration': { model: drawn } })
    const plan = planned(planBlockMove(request({ scopes })))
    expect(plan.standIn).toBe(true)
    const last = plan.writes.at(-1)!
    expect(flat(last.command).map((command) => command.type)).toEqual(['citation.remove', 'comment.take', 'element.update', 'element.link'])
    const source = landed(scopes, 'topics/integration', last.command)
    expect(source.elements[0]).toEqual({ id: 'blk-gw', kind: 'buildingBlock', name: 'Message gateway', ref: 'topics/security', lifecycle: 'live', isManaged: false, aspects: {} })
    // Its card and its line stay where they were drawn.
    expect(source.relations).toHaveLength(1)
    expect(source.diagrams[0].members.map((one) => one.id)).toContain('blk-gw')
    expect(source.comments ?? []).toEqual([])
    expect(source.citations ?? []).toEqual([])
  })

  it('counts a block as still named by a view, a connection or an element under it, and by nothing else', () => {
    expect(stillNamed(model({ elements: [GATEWAY], comments: [asked], citations: [supports] }), 'blk-gw')).toBe(false)
    expect(stillNamed(model({ elements: [GATEWAY], diagrams: [diagram('landscape', { placements: [placement('blk-gw')] })] }), 'blk-gw')).toBe(true)
    expect(stillNamed(model({ elements: [GATEWAY, element('a')], relations: [connection('c#1', 'a', 'blk-gw')] }), 'blk-gw')).toBe(true)
    expect(stillNamed(model({ elements: [GATEWAY, element('part', { kind: 'component', parentId: 'blk-gw' })] }), 'blk-gw')).toBe(true)
  })

  it('becomes the definition where the target drew it as a stand-in, sitting where it sat there', () => {
    const standIn: DesignElement = { id: 'blk-gw', kind: 'buildingBlock', name: 'Message gateway', ref: 'topics/integration', lifecycle: 'live', isManaged: false, aspects: {}, parentId: 'group', order: 2 }
    const cited: Citation = { ...supports, id: 'ci-there' }
    const scopes = tree({
      'topics/integration': { model: model({ elements: [{ ...GATEWAY, parentId: 'gone' }], citations: [supports] }), images: [picture('routing.png', 'a')] },
      'topics/security': { model: model({ elements: [element('group'), standIn], citations: [cited] }) },
    })
    const plan = planned(planBlockMove(request({ scopes })))
    const target = landed(scopes, 'topics/security', plan.writes[0].command)
    expect(target.elements[1]).toEqual({ ...GATEWAY, parentId: 'group', order: 2 })
    // What the target already said of it is said once.
    expect(target.citations).toEqual([cited])
  })

  it('drops a place on the source\'s trees the target does not hold', () => {
    const scopes = tree({ 'topics/integration': { model: model({ elements: [{ ...GATEWAY, parentId: 'gone', order: 3, lane: 'lane' }] }) } })
    const plan = planned(planBlockMove(request({ scopes, picturesIn: undefined })))
    expect(landed(scopes, 'topics/security', plan.writes[0].command).elements).toEqual([GATEWAY])
  })

  it('brings a comment home without a from, and keeps the first place one came from', () => {
    const back: Comment = { ...asked, from: { kind: 'element', id: 'blk-gw', scope: 'topics/security' } }
    const merged: Comment = { ...asked, id: 'cm-3', from: { kind: 'element', id: 'blk-old' } }
    const scopes = tree({ 'topics/integration': { model: model({ elements: [GATEWAY], comments: [back, merged] }) } })
    const plan = planned(planBlockMove(request({ scopes, picturesIn: undefined })))
    expect(landed(scopes, 'topics/security', plan.writes[0].command).comments).toEqual([
      asked, { ...merged, from: { kind: 'element', id: 'blk-old', scope: 'topics/integration' } },
    ])
  })

  it('asks for the pictures its document names that the target does not hold yet', () => {
    expect(planned(planBlockMove(request())).pictures).toEqual([picture('routing.png', 'a')])
    // The same picture already there, a name the source's library does not hold, and nobody reading the document: nothing to carry.
    expect(planned(planBlockMove(request({ scopes: tree({ 'topics/security': { images: [picture('routing.png', 'a')] } }) }))).pictures).toEqual([])
    expect(planned(planBlockMove(request({ scopes: tree({ 'topics/integration': { images: [] } }) }))).pictures).toEqual([])
    expect(planned(planBlockMove(request({ picturesIn: undefined }))).pictures).toEqual([])
  })
})

describe('a move that is refused', () => {
  const refused = (over: Partial<BlockMoveRequest>) => planBlockMove(request(over))

  it('to the scope the block is kept in', () => {
    expect(refused({ to: 'topics/integration' })).toEqual({ ok: false, refusal: 'sameScope', scope: 'topics/integration' })
  })

  it('from or to a scope that is not there', () => {
    expect(refused({ to: 'topics/nowhere' })).toEqual({ ok: false, refusal: 'unknownScope', scope: 'topics/nowhere' })
    expect(refused({ from: 'topics/nowhere' })).toEqual({ ok: false, refusal: 'unknownScope', scope: 'topics/nowhere' })
  })

  it('of a block the source does not define: none by that id, a stand-in, or another kind', () => {
    expect(refused({ block: 'blk-none' })).toMatchObject({ refusal: 'unknownBlock' })
    expect(refused({ block: 'app-broker' })).toMatchObject({ refusal: 'unknownBlock' })
    const scopes = tree({ 'topics/integration': { model: model({ elements: [{ ...GATEWAY, ref: 'sales' }] }) } })
    expect(refused({ scopes })).toMatchObject({ refusal: 'unknownBlock' })
  })

  it('into a scope that already defines a record under its id', () => {
    const scopes = tree({ 'topics/security': { model: model({ elements: [{ ...GATEWAY, name: 'Another gateway' }] }) } })
    expect(refused({ scopes })).toEqual({ ok: false, refusal: 'taken', scope: 'topics/security' })
  })

  it('past a scope that would hold two comparisons of it', () => {
    const stale = compared({ id: 'topics.security~blk-gw', block: { scope: 'topics/security', id: 'blk-gw' }, chosen: undefined, decidedBy: undefined })
    const scopes = tree({ sales: { model: model({ evaluations: [compared(), stale] }) } })
    expect(refused({ scopes })).toEqual({ ok: false, refusal: 'comparedTwice', scope: 'sales' })
  })

  it('with a picture the target holds another of under the same name', () => {
    const scopes = tree({ 'topics/security': { images: [picture('Routing.png', 'b')] } })
    expect(refused({ scopes })).toEqual({ ok: false, refusal: 'pictureTaken', scope: 'topics/security', picture: 'routing.png' })
  })
})
