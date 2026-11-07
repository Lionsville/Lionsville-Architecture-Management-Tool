// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An agent keeps a scope's principles as a person does (ADR-0041 §13): groups made,
 * renamed, ordered and removed, principles filed and moved between them, related,
 * merged and removed, their aspects, citations taken back and made as a decision or
 * an observation is written, each one step that names itself in Activity, and each
 * usable in a batch. `everyWrite.test.ts` holds each to the agent's mark.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATE } from '../../i18n/strings'
import { summarise } from '../../model/activity'
import { idPolicy } from '../../model/keys'
import { citationList, commentList, fromArrays, principlesOf, toArrays } from '../../model/normalised'
import type { Model } from '../../model/normalised'
import type { Principle } from '../../model/principle'
import { apply } from '../../model/reducer'
import type { TreeRecords } from '../../model/treeRecords'
import { commandFor } from '../commandFor'
import type { Prepared, WriteView } from '../commandFor'
import { handle } from '../handle'
import type { SessionView } from '../handle'
import type { AgentAnswer, ToolName } from '../tools'

const principle = (id: string, number: number, over: Partial<Principle> = {}): Principle => ({
  id, number, title: id, statement: `${id} says`, groups: [], regime: 'flexible', status: 'candidate', lastAspect: 2,
  aspects: [{ id: `${id}-a1`, number: 1, text: `${id} one`, nature: 'design' }, { id: `${id}-a2`, number: 2, text: `${id} two`, nature: 'design' }],
  ...over,
})

const start = (): Model => fromArrays({
  name: 'Scope', elements: [], relations: [], diagrams: [],
  principleGroups: [{ id: 'pg-sec', name: 'Security' }, { id: 'pg-cost', name: 'Cost' }],
  principles: [
    principle('pr-a', 1, { groups: ['pg-sec'] }), principle('pr-b', 2, { groups: ['pg-sec', 'pg-cost'] }),
    principle('pr-acc', 3, { status: 'accepted', regime: 'fixed' }),
  ],
  decisions: [{ id: 'adr-1', number: 1, title: 'A decision', status: 'proposed', date: '2026-10-01', body: '' }],
  observations: [{ id: 'ob-1', number: 1, title: 'Seen', date: '2026-10-01', impact: 'minor', seen: 1, body: '', history: [] }],
} as never)

const above: Principle = principle('pr-org', 1)
const records: TreeRecords = {
  principleScopes: () => ['', 'here'], principlesAt: (path) => (path === '' ? { principles: [above], groups: [] } : { principles: [], groups: [] }),
  inForce: () => [{ scope: '', via: 'above', principle: above }], topics: () => [], blocks: () => [], evaluations: () => [],
  citations: () => [{ scope: 'other', citation: { id: 'ci-far', about: { kind: 'element', id: 'e' }, principle: { scope: 'here', id: 'pr-acc' }, stance: 'supports', on: '2026-10-01' } }],
}

function viewOf(model: Model): WriteView {
  let made = 0
  return {
    model, current: () => toArrays(model), activeDiagramId: '', scopePath: 'here', ancestorDecisions: [],
    ids: idPolicy(() => []), makeId: (prefix: string) => { made += 1; return `${prefix}-new-${made}` }, today: () => '2026-11-07',
    translate: DEFAULT_TRANSLATE, containerName: (name: string) => name, tree: { records: () => records, lookup: () => undefined },
  } as unknown as WriteView
}

function write(tool: ToolName, args: unknown, model = start()): { after: Model; said: Record<string, unknown>; prepared: Prepared } {
  const prepared = commandFor(tool, args, viewOf(model))
  if ('ok' in prepared) throw new Error(JSON.stringify(prepared))
  const landed = apply(model, prepared.command)
  if (!landed.ok) throw new Error(landed.reason)
  const first = (prepared.answer as Extract<AgentAnswer, { ok: true }>).content[0] as { text: string }
  return { after: landed.model, said: JSON.parse(first.text) as Record<string, unknown>, prepared }
}

const refusal = (tool: ToolName, args: unknown, model = start()) => {
  const prepared = commandFor(tool, args, viewOf(model))
  if (!('ok' in prepared)) return apply(model, prepared.command).ok ? undefined : (apply(model, prepared.command) as { reason: string }).reason
  return prepared.ok ? undefined : prepared.refusal
}

const groupsOf = (model: Model) => model.principleGroups ?? []
const names = (model: Model, id: string) => principlesOf(model)[id].groups.map((group) => groupsOf(model).find((one) => one.id === group)?.name)

describe('an agent\'s groups of principles', () => {
  it('makes, renames, orders and removes them, the list being the whole of it', () => {
    const { after, said } = write('principleGroups.set', { groups: [{ name: 'Data' }, { id: 'pg-cost', name: 'Money' }] })
    expect(groupsOf(after).map((one) => one.name)).toEqual(['Data', 'Money'])
    expect(groupsOf(after)[1].id).toBe('pg-cost')
    expect(said).toMatchObject({ removed: ['Security'], takenOff: ['pr-a', 'pr-b'] })
    // A removed group is taken off its principles, and none of them goes.
    expect(names(after, 'pr-b')).toEqual(['Money'])
    expect(names(after, 'pr-a')).toEqual([])
    expect(principlesOf(after)['pr-a']).toBeDefined()
  })

  it('takes a name it holds for that group, whatever its case, and refuses what it cannot tell apart', () => {
    expect(groupsOf(write('principleGroups.set', { groups: [{ name: 'cost' }] }).after)[0].id).toBe('pg-cost')
    expect(refusal('principleGroups.set', { groups: [{ name: ' ' }] })).toBe('agent.badArguments')
    expect(refusal('principleGroups.set', { groups: [{ name: 'A' }, { name: 'a' }] })).toBe('agent.badArguments')
    expect(refusal('principleGroups.set', { groups: [{ id: 'pg-none', name: 'A' }] })).toBe('agent.unknownId')
  })

  it('files a new principle under a group, making one it has not got, in one step named for the principle', () => {
    const model = start()
    const { after, prepared } = write('principle.add', { title: 'New', statement: 'Says.', aspects: ['One'], groups: ['security', 'Data'] }, model)
    const id = Object.keys(principlesOf(after)).find((one) => one.startsWith('pr-new'))!
    expect(names(after, id)).toEqual(['Security', 'Data'])
    expect(groupsOf(after).map((one) => one.name)).toEqual(['Security', 'Cost', 'Data'])
    expect(summarise([prepared.command], model).key).toBe('activity.principleAdded')
    expect(prepared.command.origin).toBe('agent')
  })

  it('moves a principle between groups, and off them all', () => {
    expect(names(write('principle.update', { id: 'pr-a', groups: ['Cost'] }).after, 'pr-a')).toEqual(['Cost'])
    expect(names(write('principle.update', { id: 'pr-a', groups: [] }).after, 'pr-a')).toEqual([])
  })

  it('reads in Activity as a change of the groups', () => {
    const model = start()
    expect(summarise([write('principleGroups.set', { groups: [{ name: 'Data' }] }, model).prepared.command], model).key).toBe('activity.principleGroups')
  })
})

describe('an agent\'s principles', () => {
  it('sharpens an accepted one only with a note, and keeps the note', () => {
    expect(refusal('principle.update', { id: 'pr-acc', statement: 'Other words' })).toBe('command.sharpenNote')
    const { after } = write('principle.update', { id: 'pr-acc', statement: 'Other words', note: 'Said better' })
    expect(principlesOf(after)['pr-acc'].sharpened).toEqual([{ on: '2026-11-07', note: 'Said better' }])
  })

  it('adds, changes and removes aspects, a removed number never given again', () => {
    const removed = write('aspect.remove', { principle: 'pr-a', number: 2 }).after
    const added = write('aspect.add', { principle: 'pr-a', text: 'Three', nature: 'behaviour', signal: 'A count' }, removed)
    expect(added.said).toMatchObject({ aspect: 3 })
    expect(principlesOf(added.after)['pr-a'].aspects.map((one) => [one.number, one.text, one.nature])).toEqual([[1, 'pr-a one', 'design'], [3, 'Three', 'behaviour']])
    expect(principlesOf(write('aspect.update', { principle: 'pr-a', number: 1, text: 'Changed' }).after)['pr-a'].aspects[0].text).toBe('Changed')
    expect(refusal('aspect.update', { principle: 'pr-a', number: 9, text: 'x' })).toBe('agent.unknownId')
    expect(refusal('aspect.remove', { principle: 'pr-acc', number: 1 })).toBe('command.sharpenNote')
  })

  it('refuses taking the last aspect', () => {
    const left = write('aspect.remove', { principle: 'pr-a', number: 2 }).after
    expect(refusal('aspect.remove', { principle: 'pr-a', number: 1 }, left)).toBe('command.aspectsEmpty')
  })

  it('relates one to another here or above, never to itself or sideways', () => {
    const { after } = write('principle.relate', { id: 'pr-a', kind: 'refines', to: { scope: '', id: 'pr-org' } })
    expect(principlesOf(after)['pr-a'].relations).toEqual([{ kind: 'refines', to: { scope: '', id: 'pr-org' } }])
    const taken = write('principle.unrelate', { id: 'pr-a', kind: 'refines', to: { scope: '', id: 'pr-org' } }, after).after
    expect(principlesOf(taken)['pr-a'].relations).toBeUndefined()
    expect(refusal('principle.relate', { id: 'pr-a', kind: 'tension', to: { id: 'pr-a' } })).toBe('agent.badArguments')
    expect(refusal('principle.relate', { id: 'pr-a', kind: 'tension', to: { scope: 'sideways', id: 'x' } })).toBe('agent.badArguments')
    expect(refusal('principle.relate', { id: 'pr-a', kind: 'tension', to: { scope: '', id: 'pr-none' } })).toBe('agent.unknownId')
    expect(refusal('principle.unrelate', { id: 'pr-a', kind: 'tension', to: { id: 'pr-b' } })).toBe('agent.unknownId')
  })

  it('merges, and says which citations other scopes keep', () => {
    const { after, said } = write('principle.merge', { into: 'pr-a', from: ['pr-acc'] })
    expect(principlesOf(after)['pr-acc'].mergedInto).toBe('pr-a')
    expect(said.citedElsewhere).toEqual([{ scope: 'other', principle: 'pr-acc' }])
    expect(refusal('principle.merge', { into: 'pr-a', from: ['pr-a'] })).toBe('agent.badArguments')
    expect(refusal('principle.update', { id: 'pr-acc', title: 'Again' }, after)).toBe('agent.badArguments')
  })

  it('removes one nothing cites, with its comments, and refuses one any scope does', () => {
    const model = fromArrays({ ...toArrays(start()), comments: [{ id: 'cm-1', about: { kind: 'principle', id: 'pr-a' }, by: { person: 'pe-1' }, at: '2026-10-01T10:00:00Z', body: 'Said' }] } as never)
    const { after } = write('principle.remove', { id: 'pr-a' }, model)
    expect(principlesOf(after)['pr-a']).toBeUndefined()
    expect(commentList(after)).toEqual([])
    expect(refusal('principle.remove', { id: 'pr-acc' })).toBe('agent.principleCited')
    const cited = write('citation.add', { about: { kind: 'observation', id: 'ob-1' }, principle: { id: 'pr-b' }, stance: 'holds' }).after
    expect(refusal('principle.remove', { id: 'pr-b' }, cited)).toBe('agent.principleCited')
  })
})

describe('an agent citing', () => {
  it('cites as a decision is proposed or changed, and as an observation is recorded or corrected, in one step', () => {
    const proposed = write('decision.propose', { title: 'Buy it', principles: [{ id: 'pr-a' }, { scope: '', id: 'pr-org', aspect: 1 }] })
    expect(citationList(proposed.after).map((one) => [one.about.kind, one.principle.id, one.stance, one.aspect])).toEqual([['decision', 'pr-a', 'supports', undefined], ['decision', 'pr-org', 'supports', 1]])
    expect(citationList(proposed.after)[0].about.id).toBe(proposed.said.id)
    expect(proposed.said.cited).toHaveLength(2)
    expect(citationList(write('decision.update', { id: 'adr-1', title: 'Other', principles: [{ id: 'pr-a', stance: 'deviates', reason: 'Because' }] }).after)[0]).toMatchObject({ stance: 'deviates', reason: 'Because' })
    const recorded = write('observation.record', { title: 'Seen it', where: 'Desk', by: 'Ada', principles: [{ id: 'pr-a', stance: 'chafes' }] })
    expect(citationList(recorded.after)[0]).toMatchObject({ about: { kind: 'observation' }, stance: 'chafes' })
    expect(citationList(write('observation.update', { id: 'ob-1', title: 'Other', principles: [{ id: 'pr-a' }] }).after)[0]).toMatchObject({ stance: 'holds' })
  })

  it('cites with nothing else to change', () => {
    expect(citationList(write('decision.update', { id: 'adr-1', principles: [{ id: 'pr-a' }] }).after)).toHaveLength(1)
    expect(citationList(write('observation.update', { id: 'ob-1', principles: [{ id: 'pr-a' }] }).after)).toHaveLength(1)
  })

  it('asks what the principle says, before the step: fixed, retired, gone, not here', () => {
    expect(refusal('decision.propose', { title: 'X', principles: [{ id: 'pr-acc', stance: 'deviates', reason: 'Why' }] })).toBe('agent.badArguments')
    expect(refusal('decision.propose', { title: 'X', principles: [{ id: 'pr-a', stance: 'deviates' }] })).toBe('agent.badArguments')
    expect(refusal('decision.propose', { title: 'X', principles: [{ id: 'pr-none' }] })).toBe('agent.unknownId')
    expect(refusal('observation.update', { id: 'ob-1', principles: [{ id: 'pr-a', stance: 'supports' }] })).toBe('agent.badArguments')
    expect(refusal('citation.add', { about: { kind: 'decision', id: 'adr-1' }, principle: { scope: 'other', id: 'pr-far' }, stance: 'supports' })).toBe('agent.unknownId')
    const retired = write('principle.update', { id: 'pr-a', status: 'retired' }).after
    expect(refusal('citation.add', { about: { kind: 'decision', id: 'adr-1' }, principle: { id: 'pr-a' }, stance: 'supports' }, retired)).toBe('agent.badArguments')
  })

  it('takes a citation back', () => {
    const { after } = write('citation.add', { about: { kind: 'observation', id: 'ob-1' }, principle: { id: 'pr-a' }, stance: 'holds' })
    const id = citationList(after)[0].id
    expect(citationList(write('principle.uncite', { id }, after).after)).toEqual([])
    expect(refusal('principle.uncite', { id: 'ci-none' })).toBe('agent.unknownId')
  })
})

describe('in a batch, and read back', () => {
  /** A session over a model, enough for the handler: what lands is one transaction, kept here. */
  function session(): { view: SessionView; landed: () => Model; steps: unknown[] } {
    let model = start()
    const steps: unknown[] = []
    let made = 0
    const view = {
      indexed: () => model, current: () => toArrays(model), scopePath: () => 'here', activeDiagramId: () => '', ancestorDecisions: () => [],
      ids: idPolicy(() => []), makeId: (prefix: string) => { made += 1; return `${prefix}-b${made}` }, today: () => '2026-11-07', translate: DEFAULT_TRANSLATE,
      containerName: (name: string) => name, images: () => [], revision: () => steps.length, blocked: () => undefined,
      dispatch: (command: never) => {
        const landed = apply(model, command)
        if (!landed.ok) throw new Error(landed.reason)
        model = landed.model
        steps.push(command)
        return toArrays(model)
      },
    } as unknown as SessionView
    return { view, landed: () => model, steps }
  }
  const text = (answer: AgentAnswer) => {
    if (!answer.ok) throw new Error(JSON.stringify(answer))
    return JSON.parse((answer.content[0] as { text: string }).text) as Record<string, unknown>
  }

  it('makes a group, files a new principle under it and moves another there, as one step', async () => {
    const { view, landed, steps } = session()
    const answer = await handle({ id: '1', tool: 'batch', args: { steps: [
      { tool: 'principleGroups.set', args: { groups: [{ name: 'Data' }, { id: 'pg-sec', name: 'Security' }, { id: 'pg-cost', name: 'Cost' }] } },
      { tool: 'principle.add', args: { title: 'New', statement: 'Says.', aspects: ['One'], groups: ['Data'] } },
      { tool: 'principle.update', args: { id: 'pr-a', groups: ['Data'] } },
      { tool: 'aspect.add', args: { principle: 'pr-a', text: 'Three' } },
      { tool: 'decision.propose', args: { title: 'Cites it', principles: [{ id: 'pr-a' }] } },
    ] } }, view)
    expect(answer.ok).toBe(true)
    expect(steps).toHaveLength(1)
    expect(groupsOf(landed())[0].name).toBe('Data')
    expect(names(landed(), 'pr-a')).toEqual(['Data'])
    expect(citationList(landed())).toHaveLength(1)
  })

  it('reads a principle written a moment ago, with its citations, and suggests by its words', async () => {
    const { view } = session()
    await handle({ id: '1', tool: 'citation.add', args: { about: { kind: 'observation', id: 'ob-1' }, principle: { id: 'pr-a' }, stance: 'chafes' } }, view)
    const read = text(await handle({ id: '1', tool: 'principle.read', args: { id: 'pr-a' } }, view))
    expect(read).toMatchObject({ scope: 'here', title: 'pr-a', groups: ['Security'], use: { tested: 1, chafes: 1 } })
    expect((read.citations as { id: string }[])[0].id).toBeDefined()
    expect((await handle({ id: '1', tool: 'principle.read', args: { id: 'pr-none' } }, view))).toMatchObject({ ok: false, refusal: 'agent.unknownId' })
    const named = await handle({ id: '1', tool: 'principle.add', args: { title: 'Buy before build', statement: 'Compare products before building anything.', aspects: ['Compare'] } }, view)
    const found = text(await handle({ id: '1', tool: 'principles.suggest', args: { text: 'We should compare products for billing' } }, view))
    expect((found.suggestions as { id: string; matched: string[] }[])[0]).toMatchObject({ id: text(named).id, matched: expect.arrayContaining(['compare', 'product']) })
  })
})
