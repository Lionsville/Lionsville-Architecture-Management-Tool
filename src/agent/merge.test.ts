// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent's merge (ADR-0035 §6): several observations or causes folded
 * into one survivor, the values it keeps, the links that move and the ones
 * that stay, said before by `merge.plan` — one command where only the scope
 * open is written, and one step on every scope through a host that writes
 * several, or `agent.scopeNotOpen` where the host cannot.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import { summarise } from '../model/activity'
import type { Command } from '../model/commands'
import type { HostModel } from '../model/hostModel'
import { idPolicy } from '../model/keys'
import { fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import type { Cause, Observation, ScopeAnalysis, Solution } from '../model/observation'
import { apply } from '../model/reducer'
import { isScopeBelow } from '../observations/observation'
import { answer } from './answer'
import { commandFor } from './commandFor'
import type { Prepared, WriteView } from './commandFor'
import { handle } from './handle'
import type { SessionView } from './handle'
import type { AcrossWork, ChangeAcross, ChangedAcross } from './merge'
import { MERGE_LINK_SENTENCE, REFUSAL_SENTENCE } from './tools'
import type { AgentAnswer, ToolName } from './tools'
import type { TreeView } from './tree'

const observation = (id: string, number: number, over: Partial<Observation> = {}): Observation => ({
  id, number, title: `Observation ${number}`, date: '2026-09-05', impact: 'minor', seen: 1, body: '',
  history: [{ date: '2026-09-01', kind: 'recorded' }], ...over,
})
const cause = (id: string, number: number, explains: Cause['explains'] = [], over: Partial<Cause> = {}): Cause => ({
  id, number, title: `Cause ${number}`, state: 'assumed', body: '', explains, ...over,
})
const solution = (id: string, number: number, addresses: Solution['addresses']): Solution => ({
  id, number, title: `Solution ${number}`, state: 'idea', addresses, validatedWith: [], attempts: [], body: '', history: [],
})
const analysis = (scope: string, over: Partial<ScopeAnalysis> = {}): ScopeAnalysis => ({
  scope, observations: [], causes: [], solutions: [], experiments: [], ...over,
})

const OPEN = 'acme/claims'
const INTAKE = 'acme/claims/intake'

/** The scope open: four observations, five causes in two chains, and a solution on one root. */
const claims: HostModel = {
  name: 'Claims', elements: [], relations: [], diagrams: [],
  observations: [
    observation('ob-1', 1, { seen: 2 }), observation('ob-2', 2, { date: '2026-09-01' }), observation('ob-3', 3),
    observation('ob-4', 4, { archived: true }),
  ],
  causes: [
    cause('ca-1', 1, [{ id: 'ob-1', strength: 'strong' }]),
    cause('ca-2', 2, [{ id: 'ob-2', strength: 'normal' }]),
    cause('ca-3', 3, [{ id: 'ca-1', strength: 'normal' }], { root: true }),
    cause('ca-4', 4, [{ id: 'ob-1', strength: 'normal' }, { id: 'ob-3', strength: 'weak' }]),
    cause('ca-5', 5, [{ id: 'ca-4', strength: 'normal' }], { root: true }),
  ],
  solutions: [solution('so-1', 1, [{ id: 'ca-5', strength: 'strong' }])],
}

/** The organisation explains a cause of the scope open (ADR-0032 §4). */
const orgCause = cause('org-ca-1', 1, [{ id: 'ca-2', scope: OPEN, strength: 'strong' }])
const organisation = analysis('', { causes: [orgCause] })
const intake = analysis(INTAKE, {
  observations: [observation('in-1', 1, { seen: 3 })],
  causes: [cause('in-ca-1', 1, [{ id: 'in-1', strength: 'normal' }])],
})
/** What the tree last read of the scope open: stale, so a merge must read the session's instead. */
const staleClaims = analysis(OPEN, { observations: [observation('ob-1', 1)] })

const tree: Pick<TreeView, 'lookup' | 'initiativesBelow' | 'analysisBelow' | 'explainedFromAbove' | 'rowsTo'> = {
  lookup: () => undefined,
  initiativesBelow: () => [],
  rowsTo: () => [],
  analysisBelow: (path) => [staleClaims, intake].filter((one) => isScopeBelow(one.scope, path)),
  explainedFromAbove: (path) => new Map(path === OPEN ? [['ca-2', [{ scope: '', cause: orgCause, strength: 'strong' as const }]]] : []),
}

let counter = 0
function view(model: Model, over: Partial<WriteView> = {}): WriteView {
  return {
    model, current: () => toArrays(model), activeDiagramId: '', scopePath: OPEN, ancestorDecisions: [],
    ids: idPolicy(() => []), makeId: (prefix) => `${prefix}-new-${++counter}`, today: () => '2026-10-08',
    translate: DEFAULT_TRANSLATE, containerName: (name) => name, tree, ...over,
  }
}

const parse = (held: AgentAnswer): Record<string, unknown> => {
  if (!held.ok || held.content[0].type !== 'text') throw new Error(`not an answer: ${JSON.stringify(held)}`)
  return JSON.parse(held.content[0].text) as Record<string, unknown>
}
const prepared = (out: Prepared | AgentAnswer): Prepared => {
  if ('ok' in out) throw new Error(`refused: ${JSON.stringify(out)}`)
  return out
}
function write(tool: ToolName, args: unknown, model: Model = fromArrays(claims)): { model: Model; said: Record<string, unknown>; command: Command } {
  const out = prepared(commandFor(tool, args, view(model)))
  const applied = apply(model, out.command)
  if (!applied.ok) throw new Error(`reducer refused: ${applied.reason}`)
  return { model: applied.model, said: parse(out.answer), command: out.command }
}
function refusal(tool: ToolName, args: unknown, model: Model = fromArrays(claims)): { refusal: string; detail?: string } {
  const out = commandFor(tool, args, view(model))
  if (!('ok' in out) || out.ok) throw new Error(`not refused: ${JSON.stringify(out)}`)
  return { refusal: out.refusal, ...(out.detail !== undefined ? { detail: out.detail } : {}) }
}
const plan = (args: unknown) => parse(answer('merge.plan', args, view(fromArrays(claims))))

const key = (holder: string, target: string) => `explains:${holder}>${target}`

describe('observation.merge in the scope open', () => {
  it('folds several into the survivor with the values given, as one transaction of the agent’s', () => {
    const { model, said, command } = write('observation.merge', {
      into: 'OB-1', absorb: [{ id: 'ob-2' }, { id: 'OB-3' }], values: { title: 'Claims stall at intake', date: '2026-09-01', where: 'Intake desk' },
    })
    expect(command).toMatchObject({ type: 'transaction', origin: 'agent' })
    const survivor = model.observations!['ob-1']
    expect(survivor).toMatchObject({ title: 'Claims stall at intake', date: '2026-09-01', where: 'Intake desk', seen: 4 })
    expect(survivor.history.slice(-2)).toEqual([
      { date: '2026-10-08', kind: 'absorbed', id: 'ob-2', seen: 1 }, { date: '2026-10-08', kind: 'absorbed', id: 'ob-3', seen: 1 },
    ])
    expect(model.observations!['ob-3'].history.at(-1)).toEqual({ date: '2026-10-08', kind: 'merged', id: 'ob-1' })
    // What explained an absorbed one explains the survivor; the stronger link is kept where both had one.
    expect(model.causes!['ca-2'].explains).toEqual([{ id: 'ob-1', strength: 'normal' }])
    expect(model.causes!['ca-4'].explains).toEqual([{ id: 'ob-1', strength: 'normal' }])
    expect(said).toMatchObject({ id: 'ob-1', seen: 4, absorbed: [{ scope: OPEN, id: 'ob-2', label: 'OB-0002' }, { scope: OPEN, id: 'ob-3', label: 'OB-0003' }] })
    expect(said).not.toHaveProperty('stayed')
  })

  it('keeps a link where it is when links says move false, and says it stayed', () => {
    const row = key(`${OPEN}#ca-2`, `${OPEN}#ob-2`)
    const { model, said } = write('observation.merge', { into: 'ob-1', absorb: [{ id: 'ob-2' }], links: [{ key: row, move: false }] })
    expect(model.causes!['ca-2'].explains).toEqual([{ id: 'ob-2', strength: 'normal' }])
    expect(said.stayed).toEqual([{ key: row, unticked: true }])
  })

  it('chooses the strength where a link lands', () => {
    const row = key(`${OPEN}#ca-2`, `${OPEN}#ob-2`)
    const { model } = write('observation.merge', { into: 'ob-1', absorb: [{ id: 'ob-2' }], links: [{ key: row, strength: 'weak' }] })
    expect(model.causes!['ca-2'].explains).toEqual([{ id: 'ob-1', strength: 'weak' }])
  })

  it('still takes the old arguments: id into into, and fromScope writing only the survivor', () => {
    expect(write('observation.merge', { id: 'ob-2', into: 'ob-1' }).model.observations!['ob-1'].seen).toBe(3)
    const { model, said } = write('observation.merge', { id: 'in-1', into: 'ob-1', fromScope: INTAKE })
    expect(said).toMatchObject({ id: 'ob-1', seen: 5 })
    expect(model.observations!['ob-1'].history.at(-1)).toEqual({ date: '2026-10-08', kind: 'absorbed', id: 'in-1', scope: INTAKE, seen: 3 })
    expect(refusal('observation.merge', { id: 'in-9', into: 'ob-1', fromScope: INTAKE }).refusal).toBe('agent.unknownId')
    expect(refusal('observation.merge', { id: 'in-1', into: 'ob-9', fromScope: INTAKE }).refusal).toBe('agent.unknownId')
    const once = write('observation.merge', { id: 'in-1', into: 'ob-1', fromScope: INTAKE }).model
    expect(refusal('observation.merge', { id: 'in-1', into: 'ob-1', fromScope: INTAKE }, once).refusal).toBe('agent.badArguments')
  })

  it('refuses a merge as a whole with a key and a sentence for each way it can be', () => {
    expect(refusal('observation.merge', { into: 'ob-1', absorb: [] }).refusal).toBe('merge.nothing')
    expect(refusal('observation.merge', { into: 'ob-1' }).refusal).toBe('merge.nothing')
    expect(refusal('observation.merge', { into: 'ob-1', absorb: [{ id: 'ob-1' }] }).refusal).toBe('merge.survivorAbsorbed')
    expect(refusal('observation.merge', { into: 'ob-1', absorb: [{ id: 'ob-4' }] })).toEqual({ refusal: 'merge.archived', detail: `OB-0004 in ${OPEN}` })
    expect(refusal('observation.merge', { into: 'ob-1', absorb: [{ id: 'ob-2' }], values: { date: 'soon' } }).refusal).toBe('merge.notADay')
    expect(refusal('observation.merge', { into: 'ob-1', absorb: [{ id: 'ob-9' }] }).refusal).toBe('agent.unknownId')
    const once = write('observation.merge', { into: 'ob-1', absorb: [{ id: 'ob-2' }] }).model
    expect(refusal('observation.merge', { into: 'ob-3', absorb: [{ id: 'ob-2' }] }, once).refusal).toBe('merge.merged')
    for (const key of ['merge.nothing', 'merge.merged', 'merge.archived', 'merge.survivorAbsorbed', 'merge.notADay', 'merge.unverified', 'merge.linkForbidden'] as const) {
      expect(REFUSAL_SENTENCE[key]).toMatch(/\.$/)
    }
  })

  it('refuses values that are blank or that a merged observation does not say', () => {
    expect(refusal('observation.merge', { into: 'ob-1', absorb: [{ id: 'ob-2' }], values: { by: ' ' } }).detail).toBe('values.by must not be blank')
    // The schema refuses another kind's field; merge.plan takes both kinds' and refuses it itself.
    expect(refusal('observation.merge', { into: 'ob-1', absorb: [{ id: 'ob-2' }], values: { state: 'verified' } }).refusal).toBe('agent.badArguments')
    expect(answer('merge.plan', { kind: 'observation', into: 'ob-1', absorb: [{ id: 'ob-2' }], values: { state: 'verified' } }, view(fromArrays(claims))))
      .toEqual({ ok: false, refusal: 'agent.badArguments', detail: 'values.state is not something a merged observation says' })
    // A null is a field not given, as everywhere in the vocabulary.
    expect(write('observation.merge', { into: 'ob-1', absorb: [{ id: 'ob-2' }], values: { title: null } }).model.observations!['ob-1'].title).toBe('Observation 1')
  })

  it('refuses a key no row has, and a row asked to move where the tree forbids it', () => {
    expect(refusal('observation.merge', { into: 'ob-1', absorb: [{ id: 'ob-2' }], links: [{ key: 'explains:x>y' }] }).refusal).toBe('agent.badArguments')
    const forbidden = refusal('observation.merge', {
      into: 'ob-1', absorb: [{ id: 'in-1', scope: INTAKE }], links: [{ key: key(`${INTAKE}#in-ca-1`, `${INTAKE}#in-1`), move: true }],
    })
    expect(forbidden).toEqual({ refusal: 'merge.linkForbidden', detail: `${key(`${INTAKE}#in-ca-1`, `${INTAKE}#in-1`)}: ${MERGE_LINK_SENTENCE.observationElsewhere}` })
  })
})

describe('merge.plan', () => {
  it('says every row, where it lands and whether it moves, and which scopes the merge writes', () => {
    const said = plan({ kind: 'observation', into: 'ob-1', absorb: [{ id: 'ob-2' }] })
    expect(said).toMatchObject({
      kind: 'observation', survivor: { scope: OPEN, id: 'ob-1', label: 'OB-0001' }, writes: [OPEN], elsewhere: false,
      links: [{
        key: key(`${OPEN}#ca-2`, `${OPEN}#ob-2`), kind: 'explains', holder: { id: 'ca-2', label: 'CA-0002' },
        into: { holder: { id: 'ca-2' }, target: { id: 'ob-1', label: 'OB-0001' } }, strength: 'normal', offered: 'normal', moves: true,
      }],
    })
    expect(said).not.toHaveProperty('refused')
  })

  it('says why a row stays, in the link form’s words, and that the merge writes another scope', () => {
    const said = plan({ kind: 'observation', into: 'ob-1', absorb: [{ id: 'in-1', scope: INTAKE }] }) as { links: { refusal?: string; why?: string; moves: boolean }[]; writes: string[]; elsewhere: boolean }
    expect(said.links).toEqual([expect.objectContaining({ refusal: 'observationElsewhere', why: MERGE_LINK_SENTENCE.observationElsewhere, moves: false })])
    expect(said.writes).toEqual([OPEN, INTAKE])
    expect(said.elsewhere).toBe(true)
  })

  it('says the refusal a merge would meet, with the rows all the same', () => {
    const said = plan({ kind: 'cause', into: 'ca-1', absorb: [{ id: 'ca-4' }], values: { root: true } })
    expect(said).toMatchObject({ refused: 'command.rootExplained', why: REFUSAL_SENTENCE['command.rootExplained'] })
    expect((said.links as unknown[]).length).toBe(3)
    expect(plan({ kind: 'cause', into: 'ca-1', absorb: [] })).toMatchObject({ refused: 'merge.nothing', links: [] })
    expect(plan({ kind: 'observation', into: 'ob-1', absorb: [{ id: 'ob-2' }], links: [{ key: 'nope' }] })).toMatchObject({ refused: 'agent.badArguments' })
  })

  it('is a read: answered for a scope not open and while nothing may be changed', async () => {
    const at = session({ blocked: () => 'agent.readOnly' })
    const out = await handle({ id: '1', tool: 'merge.plan', args: { kind: 'observation', into: 'ob-1', absorb: [{ id: 'ob-2' }] } }, at)
    expect(parse(out)).toMatchObject({ writes: [OPEN] })
  })
})

describe('cause.merge in the scope open', () => {
  it('moves what the absorbed cause explains and what explains it, keeping the stronger where both had one', () => {
    const { model, said } = write('cause.merge', { into: 'CA-1', absorb: [{ id: 'CA-4' }] })
    expect(model.causes!['ca-1'].explains).toEqual([{ id: 'ob-1', strength: 'strong' }, { id: 'ob-3', strength: 'weak' }])
    expect(model.causes!['ca-5'].explains).toEqual([{ id: 'ca-1', strength: 'normal' }])
    expect(model.causes!['ca-4'].history).toEqual([{ date: '2026-10-08', kind: 'merged', id: 'ca-1' }])
    expect(model.causes!['ca-1'].history).toEqual([{ date: '2026-10-08', kind: 'absorbed', id: 'ca-4' }])
    expect(said).toMatchObject({ id: 'ca-1', label: 'CA-0001', absorbed: [{ id: 'ca-4', label: 'CA-0004' }] })

    const listed = parse(answer('causes.list', {}, view(model))) as { causes: { id: string }[] }
    expect(listed.causes.map((one) => one.id)).toEqual(['ca-1', 'ca-2', 'ca-3', 'ca-5'])
    const all = parse(answer('causes.list', { includeMerged: true }, view(model))) as { causes: { id: string; mergedInto?: string }[] }
    expect(all.causes.find((one) => one.id === 'ca-4')).toMatchObject({ mergedInto: 'ca-1' })
    expect(parse(answer('cause.read', { id: 'ca-1' }, view(model)))).toMatchObject({ history: [{ kind: 'absorbed', id: 'ca-4' }] })
  })

  it('moves a solution to a surviving root cause', () => {
    const { model } = write('cause.merge', { into: 'RC-3', absorb: [{ id: 'RC-5' }] })
    expect(model.solutions!['so-1'].addresses).toEqual([{ id: 'ca-3', strength: 'strong' }])
    expect(model.causes!['ca-3'].explains).toEqual([{ id: 'ca-1', strength: 'normal' }, { id: 'ca-4', strength: 'normal' }])
  })

  it('refuses with the root steps’ keys, without the evidence, and values a cause does not say', () => {
    expect(refusal('cause.merge', { into: 'ca-1', absorb: [{ id: 'ca-4' }], values: { root: true } }).refusal).toBe('command.rootExplained')
    expect(refusal('cause.merge', { into: 'ca-5', absorb: [{ id: 'ca-3' }], values: { root: false } }).refusal).toBe('command.rootAddressed')
    expect(refusal('cause.merge', { into: 'ca-1', absorb: [{ id: 'ca-4' }], values: { state: 'verified' } }).refusal).toBe('merge.unverified')
    expect(answer('merge.plan', { kind: 'cause', into: 'ca-1', absorb: [{ id: 'ca-4' }], values: { impact: 'major' } }, view(fromArrays(claims))))
      .toMatchObject({ refusal: 'agent.badArguments', detail: 'values.impact is not something a merged cause says' })
    expect(refusal('cause.merge', { into: 'ca-1', absorb: [{ id: 'ca-4' }], values: { title: '' } }).detail).toBe('values.title must not be blank')
    const once = write('cause.merge', { into: 'ca-1', absorb: [{ id: 'ca-4' }] }).model
    expect(refusal('cause.merge', { into: 'ca-2', absorb: [{ id: 'ca-4' }] }, once).refusal).toBe('merge.merged')
  })

  it('refuses a merge that would move a link of a scope above, unless that link stays', () => {
    const above = key('#org-ca-1', `${OPEN}#ca-2`)
    expect(plan({ kind: 'cause', into: 'ca-1', absorb: [{ id: 'ca-2' }] })).toMatchObject({ writes: [OPEN, ''], elsewhere: true })
    const refused = refusal('cause.merge', { into: 'ca-1', absorb: [{ id: 'ca-2' }] })
    expect(refused.refusal).toBe('agent.scopeNotOpen')
    expect(refused.detail).toContain('this merge writes the organisation as well as acme/claims')
    const { model } = write('cause.merge', { into: 'ca-1', absorb: [{ id: 'ca-2' }], links: [{ key: above, move: false }] })
    expect(model.causes!['ca-1'].explains).toEqual([{ id: 'ob-1', strength: 'strong' }, { id: 'ob-2', strength: 'normal' }])
  })
})

describe('reads of what was merged', () => {
  it('says where an observation went when its survivor lives in another scope', () => {
    const merged = fromArrays({ ...claims, observations: [observation('ob-1', 1, { history: [{ date: '2026-10-08', kind: 'merged', id: 'x-1', scope: INTAKE }] })] })
    const listed = parse(answer('observations.list', { includeMerged: true }, view(merged))) as { observations: unknown[] }
    expect(listed.observations).toEqual([expect.objectContaining({ id: 'ob-1', mergedInto: 'x-1', mergedIntoScope: INTAKE })])
    expect((parse(answer('observations.list', {}, view(merged))) as { observations: unknown[] }).observations).toEqual([])
  })
})

// --- across scopes, through the host --------------------------------------------------------

/** The session over the scope open, with `changeAcross` over the fixtures where it is given. */
function session(over: Partial<SessionView> = {}): SessionView & { model: () => Model } {
  let model: Model = fromArrays(claims)
  let revision = 0
  return {
    model: () => model,
    indexed: () => model,
    current: () => toArrays(model),
    activeDiagramId: () => '',
    scopePath: () => OPEN,
    ancestorDecisions: () => [],
    blocked: () => undefined,
    dispatch: (command) => {
      const result = apply(model, command)
      if (!result.ok) return undefined
      model = result.model
      revision += 1
      return toArrays(model)
    },
    ids: idPolicy(() => []),
    makeId: (prefix) => `${prefix}-new-1`,
    today: () => '2026-10-08',
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => name,
    revision: () => revision,
    history: () => [{ at: 1, origin: 'agent', summary: summarise([], model), commands: [] }],
    undo: () => {},
    images: () => [],
    save: () => Promise.resolve(),
    tree: { ...tree, scopes: () => [], register: () => [], findings: () => [], read: () => Promise.resolve(undefined) },
    ...over,
  }
}

const work = (one: ScopeAnalysis): AcrossWork => ({
  observations: [...one.observations], causes: [...one.causes], solutions: [...one.solutions], experiments: [...one.experiments],
})

/** A host that writes several scopes: what it was asked to read, and what each scope became. */
function host(held: Map<string, AcrossWork>, answer?: ChangedAcross) {
  const asked: string[][] = []
  const written = new Map<string, AcrossWork>()
  const changeAcross: ChangeAcross = (paths, change) => {
    asked.push([...paths])
    const next = change(new Map(paths.flatMap((path) => (held.has(path) ? [[path, held.get(path)!] as const] : []))))
    if (next === undefined) return Promise.resolve({ ok: false, reason: 'unchanged' })
    if ('refused' in next) return Promise.resolve({ ok: false, reason: 'refused', refused: next.refused })
    for (const [path, lists] of next) written.set(path, lists)
    return Promise.resolve(answer ?? { ok: true, changed: [...next.keys()] })
  }
  return { asked, written, changeAcross }
}

const everyScope = () => new Map<string, AcrossWork>([
  ['', work(organisation)], ['acme', work(analysis('acme'))], [OPEN, work(analysis(OPEN, toArrays(fromArrays(claims)) as Partial<ScopeAnalysis>))],
  [INTAKE, work(intake)],
])

describe('a merge across scopes', () => {
  it('is refused agent.scopeNotOpen where the host writes only the scope open, and inside a batch', async () => {
    const refused = refusal('observation.merge', { into: 'ob-1', absorb: [{ id: 'in-1', scope: INTAKE }] })
    expect(refused.refusal).toBe('agent.scopeNotOpen')
    expect(refused.detail).toContain(INTAKE)
    const { changeAcross } = host(everyScope())
    const out = await handle({
      id: '1', tool: 'batch', args: { steps: [{ tool: 'observation.merge', args: { into: 'ob-1', absorb: [{ id: 'in-1', scope: INTAKE }] } }] },
    }, session({ changeAcross }))
    expect(out).toMatchObject({ ok: false, refusal: 'agent.scopeNotOpen' })
  })

  it('lands through a host that writes several scopes, every record written where it lives', async () => {
    const { asked, written, changeAcross } = host(everyScope())
    const at = session({ changeAcross })
    const out = await handle({ id: '1', tool: 'observation.merge', args: { into: 'ob-1', absorb: [{ id: 'in-1', scope: INTAKE }] } }, at)
    expect(asked).toEqual([['', 'acme', OPEN, INTAKE]])
    expect([...written.keys()]).toEqual([OPEN, INTAKE])
    expect(written.get(OPEN)!.observations.find((one) => one.id === 'ob-1')).toMatchObject({ seen: 5 })
    expect(written.get(INTAKE)!.observations[0].history.at(-1)).toEqual({ date: '2026-10-08', kind: 'merged', id: 'ob-1', scope: OPEN })
    // A cause explains observations of its own scope only: the link stays where it was.
    expect(written.get(INTAKE)!.causes[0].explains).toEqual([{ id: 'in-1', strength: 'normal' }])
    expect(parse(out)).toMatchObject({
      scope: OPEN, id: 'ob-1', label: 'OB-0001', absorbed: [{ scope: INTAKE, id: 'in-1' }], changed: [OPEN, INTAKE],
      stayed: [{ key: key(`${INTAKE}#in-ca-1`, `${INTAKE}#in-1`), refusal: 'observationElsewhere' }], revision: 0,
    })
  })

  it('moves a link of the scope above with the cause it names', async () => {
    const { written, changeAcross } = host(everyScope())
    const out = await handle({ id: '1', tool: 'cause.merge', args: { into: 'ca-1', absorb: [{ id: 'ca-2' }] } }, session({ changeAcross }))
    expect(out.ok).toBe(true)
    expect(written.get('')!.causes[0].explains).toEqual([{ id: 'ca-1', scope: OPEN, strength: 'strong' }])
  })

  it('plans again over what the host read, and is refused where that has changed', async () => {
    const held = everyScope()
    held.set(INTAKE, { ...work(intake), observations: [observation('in-1', 1, { archived: true })] })
    const { changeAcross } = host(held)
    const out = await handle({ id: '1', tool: 'observation.merge', args: { into: 'ob-1', absorb: [{ id: 'in-1', scope: INTAKE }] } }, session({ changeAcross }))
    expect(out).toMatchObject({ ok: false, refusal: 'merge.archived' })
  })

  it.each([
    [{ ok: false, reason: 'shell.scopeReadOnly', scope: INTAKE }, 'agent.readOnly'],
    [{ ok: false, reason: 'shell.scopeMoved' }, 'agent.stale'],
    [{ ok: false, reason: 'gone' }, 'agent.unknownScope'],
    [{ ok: false, reason: 'readOnly' }, 'agent.readOnly'],
    [{ ok: false, reason: 'partial', changed: [INTAKE] }, 'agent.saveFailed'],
    [{ ok: false, reason: 'command.gone' }, 'command.gone'],
    [{ ok: false, reason: 'unchanged' }, 'agent.badArguments'],
  ] as const)('answers a host that did not write it (%o) with %s', async (landed, expected) => {
    const { changeAcross } = host(everyScope(), landed as ChangedAcross)
    const out = await handle({ id: '1', tool: 'observation.merge', args: { into: 'ob-1', absorb: [{ id: 'in-1', scope: INTAKE }] } }, session({ changeAcross }))
    expect(out).toMatchObject({ ok: false, refusal: expected })
  })

  it('says when the scope open holds its part unwritten', async () => {
    const { changeAcross } = host(everyScope(), { ok: true, changed: [OPEN, INTAKE], unsaved: true })
    const out = await handle({ id: '1', tool: 'observation.merge', args: { into: 'ob-1', absorb: [{ id: 'in-1', scope: INTAKE }] } }, session({ changeAcross }))
    expect(parse(out)).toMatchObject({ unsaved: true })
  })

  it('leaves a merge inside the scope open to the session, as one step undo takes back', async () => {
    const { asked, changeAcross } = host(everyScope())
    const at = session({ changeAcross })
    const out = await handle({ id: '1', tool: 'observation.merge', args: { into: 'ob-1', absorb: [{ id: 'ob-2' }] } }, at)
    expect(asked).toEqual([])
    expect(parse(out)).toMatchObject({ id: 'ob-1', seen: 3, revision: 1 })
    expect(at.model().observations!['ob-2'].history.at(-1)).toMatchObject({ kind: 'merged', id: 'ob-1' })
    // A refusal is the write tier's too, never the host's to meet.
    expect(await handle({ id: '2', tool: 'observation.merge', args: { into: 'ob-1', absorb: [] } }, at)).toMatchObject({ refusal: 'merge.nothing' })
    expect(asked).toEqual([])
  })
})
