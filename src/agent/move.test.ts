// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent's move (ADR-0038 §3, §4, §7): an observation to another scope,
 * said before by `move.plan` — every link it cuts, the number it will have,
 * the comments that go — and landed through a host that writes several
 * scopes as one, or refused `agent.scopeNotOpen` where the host cannot.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import { summarise } from '../model/activity'
import type { Comment } from '../model/comment'
import type { HostModel } from '../model/hostModel'
import { idPolicy } from '../model/keys'
import { fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import type { Cause, Observation, ScopeAnalysis, Solution } from '../model/observation'
import { apply } from '../model/reducer'
import { isScopeBelow } from '../observations/observation'
import { answer } from './answer'
import type { WriteView } from './commandFor'
import { handle } from './handle'
import type { SessionView } from './handle'
import type { AcrossWork, ChangeAcross, ChangedAcross } from './merge'
import { OBSERVATIONS_METHOD } from './method'
import { REFUSAL_SENTENCE, toolSpec } from './tools'
import type { AgentAnswer } from './tools'
import type { TreeView } from './tree'

const DAY = '2026-10-16'
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
const comment = (id: string, about: string): Comment => ({ id, about: { kind: 'observation', id: about }, by: { person: 'pe-1' }, at: `${DAY}T09:00:00Z`, body: id })

const OPEN = 'acme/claims'
const INTAKE = 'acme/claims/intake'
const BILLING = 'acme/billing'

/** The scope open: three observations, one explained by a cause on a root a solution addresses. */
const claims: HostModel = {
  name: 'Claims', elements: [], relations: [], diagrams: [],
  observations: [observation('ob-1', 1, { seen: 4 }), observation('ob-2', 2), observation('ob-3', 3, { archived: true })],
  causes: [
    cause('ca-1', 1, [{ id: 'ob-1', strength: 'strong' }]),
    cause('ca-2', 2, [{ id: 'ca-1', strength: 'normal' }], { root: true }),
  ],
  solutions: [solution('so-1', 1, [{ id: 'ca-2', strength: 'strong' }])],
  comments: [comment('cm-1', 'ob-1')],
}
const intake = analysis(INTAKE, { observations: [observation('in-1', 1), observation('in-2', 2)] })

const tree: Pick<TreeView, 'lookup' | 'initiativesBelow' | 'analysisBelow' | 'explainedFromAbove' | 'rowsTo' | 'scopes'> = {
  lookup: () => undefined,
  initiativesBelow: () => [],
  rowsTo: () => [],
  analysisBelow: (path) => [analysis(OPEN, { observations: claims.observations }), intake].filter((one) => isScopeBelow(one.scope, path)),
  explainedFromAbove: () => new Map(),
  // Billing holds no analysis yet: a move into it is planned all the same.
  scopes: () => ['', 'acme', OPEN, INTAKE, BILLING].map((path) => ({ path, name: path, views: 0 })),
}

function view(model: Model = fromArrays(claims), over: Partial<WriteView> = {}): WriteView {
  return {
    model, current: () => toArrays(model), activeDiagramId: '', scopePath: OPEN, ancestorDecisions: [],
    ids: idPolicy(() => []), makeId: (prefix) => `${prefix}-new`, today: () => DAY,
    translate: DEFAULT_TRANSLATE, containerName: (name) => name, tree, ...over,
  }
}
const parse = (held: AgentAnswer): Record<string, unknown> => {
  if (!held.ok || held.content[0].type !== 'text') throw new Error(`not an answer: ${JSON.stringify(held)}`)
  return JSON.parse(held.content[0].text) as Record<string, unknown>
}
const plan = (args: unknown, at: WriteView = view()) => parse(answer('move.plan', args, at))

function session(over: Partial<SessionView> = {}): SessionView {
  let model: Model = fromArrays(claims)
  return {
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
      return toArrays(model)
    },
    ids: idPolicy(() => []),
    makeId: (prefix) => `${prefix}-new`,
    today: () => DAY,
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => name,
    revision: () => 3,
    history: () => [{ at: 1, origin: 'agent', summary: summarise([], model), commands: [] }],
    undo: () => {},
    images: () => [],
    save: () => Promise.resolve(),
    tree: { ...tree, register: () => [], findings: () => [], read: () => Promise.resolve(undefined) },
    ...over,
  }
}

const work = (one: ScopeAnalysis): AcrossWork => ({
  observations: [...one.observations], causes: [...one.causes], solutions: [...one.solutions], experiments: [...one.experiments],
  ...(one.comments ? { comments: [...one.comments] } : {}),
})
const everyScope = () => new Map<string, AcrossWork>([
  ['', work(analysis(''))], ['acme', work(analysis('acme'))],
  [OPEN, work(analysis(OPEN, toArrays(fromArrays(claims)) as Partial<ScopeAnalysis>))],
  [INTAKE, work({ ...intake, comments: [] })], [BILLING, work(analysis(BILLING, { comments: [] }))],
])

/** A host that writes several scopes: what it was asked to read, and what each scope became. */
function host(held: Map<string, AcrossWork>, answered?: ChangedAcross) {
  const asked: string[][] = []
  const written = new Map<string, AcrossWork>()
  const changeAcross: ChangeAcross = (paths, change) => {
    asked.push([...paths])
    const next = change(new Map(paths.flatMap((path) => (held.has(path) ? [[path, held.get(path)!] as const] : []))))
    if (next === undefined) return Promise.resolve({ ok: false, reason: 'unchanged' })
    if ('refused' in next) return Promise.resolve({ ok: false, reason: 'refused', refused: next.refused })
    for (const [path, lists] of next) written.set(path, lists)
    return Promise.resolve(answered ?? { ok: true, changed: [...next.keys()] })
  }
  return { asked, written, changeAcross }
}

describe('move.plan', () => {
  it('says the number it would have, the scopes it writes, the comments that go and every link it cuts', () => {
    expect(plan({ id: 'OB-1', to: INTAKE })).toEqual({
      observation: { scope: OPEN, id: 'ob-1', label: 'OB-0001', title: 'Observation 1' },
      to: INTAKE,
      label: 'OB-0003',
      writes: [OPEN, INTAKE],
      comments: 1,
      cut: [{
        cause: { scope: OPEN, id: 'ca-1', label: 'CA-0001', title: 'Cause 1' },
        strength: 'strong',
        solutions: [{ scope: OPEN, id: 'so-1', label: 'SO-0001', title: 'Solution 1' }],
      }],
    })
  })

  it('plans a move into a scope that holds nothing yet', () => {
    expect(plan({ id: 'ob-2', to: BILLING })).toMatchObject({ label: 'OB-0001', writes: [OPEN, BILLING], cut: [] })
  })

  it('says the refusal a move would meet, with the links all the same', () => {
    expect(plan({ id: 'ob-1', to: OPEN })).toMatchObject({ refused: 'move.sameScope', why: REFUSAL_SENTENCE['move.sameScope'], cut: [expect.anything()] })
    expect(plan({ id: 'ob-3', to: INTAKE })).toMatchObject({ refused: 'move.archived' })
    expect(plan({ id: 'ob-1', to: 'nowhere' })).toMatchObject({ refused: 'move.unknownScope' })
    expect(plan({ id: 'ob-9', to: INTAKE })).toMatchObject({ refused: 'agent.unknownId' })
  })

  it('is a read: answered for a scope not open', () => {
    expect(toolSpec('move.plan').tier).toBe('read')
    const below = fromArrays({ name: 'Intake', elements: [], relations: [], diagrams: [], observations: [...intake.observations] })
    expect(plan({ id: 'in-1', to: OPEN }, view(below, { scopePath: INTAKE }))).toMatchObject({ label: 'OB-0004', writes: [INTAKE, OPEN] })
  })
})

describe('observation.move', () => {
  it('is refused agent.scopeNotOpen where the host writes only the scope open, and inside a batch', async () => {
    const out = await handle({ id: '1', tool: 'observation.move', args: { id: 'ob-1', to: INTAKE } }, session())
    expect(out).toMatchObject({ ok: false, refusal: 'agent.scopeNotOpen' })
    const { changeAcross } = host(everyScope())
    const batched = await handle({ id: '2', tool: 'batch', args: { steps: [{ tool: 'observation.move', args: { id: 'ob-1', to: INTAKE } }] } }, session({ changeAcross }))
    expect(batched.ok).toBe(false)
  })

  it('refuses before anything is read where the plan does', async () => {
    const { asked, changeAcross } = host(everyScope())
    expect(await handle({ id: '1', tool: 'observation.move', args: { id: 'ob-3', to: INTAKE } }, session({ changeAcross })))
      .toMatchObject({ ok: false, refusal: 'move.archived' })
    expect(await handle({ id: '2', tool: 'observation.move', args: { id: 'ob-1', to: OPEN } }, session({ changeAcross })))
      .toMatchObject({ ok: false, refusal: 'move.sameScope' })
    expect(asked).toEqual([])
  })

  it('lands through a host that writes several scopes: the record, its tombstone, its thread, and what it cut', async () => {
    const { asked, written, changeAcross } = host(everyScope())
    const out = await handle({ id: '1', tool: 'observation.move', args: { id: 'OB-1', to: INTAKE } }, session({ changeAcross }))
    expect(asked).toEqual([['', 'acme', OPEN, INTAKE]])
    expect([...written.keys()]).toEqual([OPEN, INTAKE])
    expect(written.get(INTAKE)!.observations.at(-1)).toMatchObject({
      id: 'ob-1', number: 3, seen: 4, history: [{ date: '2026-09-01', kind: 'recorded' }, { date: DAY, kind: 'movedIn', id: 'ob-1', scope: OPEN, number: 1 }],
    })
    expect(written.get(OPEN)!.observations[0].history.at(-1)).toEqual({ date: DAY, kind: 'moved', id: 'ob-1', scope: INTAKE, number: 3 })
    expect(written.get(OPEN)!.comments).toEqual([])
    expect(written.get(INTAKE)!.comments).toEqual([{ ...comment('cm-1', 'ob-1'), from: { kind: 'observation', id: 'ob-1', scope: OPEN } }])
    // The link stays on its cause, naming the tombstone.
    expect(written.get(OPEN)!.causes[0].explains).toEqual([{ id: 'ob-1', strength: 'strong' }])
    expect(parse(out)).toMatchObject({
      id: 'ob-1', label: 'OB-0003', scope: INTAKE, from: { scope: OPEN, label: 'OB-0001' }, changed: [OPEN, INTAKE],
      cut: [{ cause: { id: 'ca-1' }, strength: 'strong' }], comments: 1, revision: 3,
    })
  })

  it('plans again over what the host read, and is refused where that has changed', async () => {
    const held = everyScope()
    held.set(INTAKE, { ...held.get(INTAKE)!, observations: [observation('ob-1', 1)] })
    const { changeAcross } = host(held)
    const out = await handle({ id: '1', tool: 'observation.move', args: { id: 'ob-1', to: INTAKE } }, session({ changeAcross }))
    expect(out).toMatchObject({ ok: false, refusal: 'command.taken' })
  })

  it.each([
    [{ ok: false, reason: 'shell.scopeReadOnly', scope: INTAKE }, 'agent.readOnly'],
    [{ ok: false, reason: 'shell.scopeMoved' }, 'agent.stale'],
    [{ ok: false, reason: 'gone' }, 'move.unknownScope'],
    [{ ok: false, reason: 'partial', changed: [INTAKE] }, 'agent.saveFailed'],
  ] as const)('answers a host that did not write it (%o) with %s', async (landed, expected) => {
    const { changeAcross } = host(everyScope(), landed as ChangedAcross)
    const out = await handle({ id: '1', tool: 'observation.move', args: { id: 'ob-1', to: INTAKE } }, session({ changeAcross }))
    expect(out).toMatchObject({ ok: false, refusal: expected })
  })

  it('says where a tombstone went when it is read', () => {
    const moved = fromArrays({ ...claims, observations: [observation('ob-1', 1, { history: [{ date: DAY, kind: 'moved', id: 'ob-1', scope: INTAKE, number: 3 }] })] })
    const listed = parse(answer('observations.list', { includeMerged: true }, view(moved))) as { observations: unknown[] }
    expect(listed.observations).toEqual([expect.objectContaining({ id: 'ob-1', movedTo: INTAKE, movedToLabel: 'OB-0003' })])
    expect((parse(answer('observations.list', {}, view(moved))) as { observations: unknown[] }).observations).toEqual([])
  })

  it('is said in the method: a move cuts the links that explain it, and move.plan says which first', () => {
    expect(OBSERVATIONS_METHOD).toContain('a move cuts every link that explains it')
    expect(OBSERVATIONS_METHOD).toContain('move.plan says which first')
    expect(toolSpec('observation.move').description).toContain('Not solution.move')
  })
})
