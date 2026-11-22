// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A host for code mode's tests: two scopes of Acme Logistics over the real
 * reducer and the real handler, one of them open, the way the app holds
 * them — and a list of what the host was told about each script.
 */
import { DEFAULT_TRANSLATE } from '../../../i18n/strings'
import { summarise } from '../../../model/activity'
import type { Command } from '../../../model/commands'
import type { HostModel } from '../../../model/hostModel'
import { idPolicy } from '../../../model/keys'
import { fromArrays, toArrays } from '../../../model/normalised'
import type { Model } from '../../../model/normalised'
import type { Observation } from '../../../model/observation'
import { apply } from '../../../model/reducer'
import { Driving } from '../../driving'
import { handle, withNames } from '../../handle'
import type { HistoryEntry, SessionView } from '../../handle'
import type { PeopleView } from '../../../agent/people'
import type { ShellView } from '../../shell'
import type { AgentAnswer } from '../../tools'
import type { TreeView } from '../../tree'
import type { CodeHost, ScriptReport } from '../host'
import { DESKTOP_LIMITS } from '../limits'
import type { ScriptLimits } from '../limits'
import { quickjsSandbox } from '../quickjs'

const application = (id: string, name: string, over: object = {}) => ({
  id, kind: 'application' as const, name, lifecycle: 'live' as const, isManaged: true, aspects: {}, ...over,
})

const observation = (id: string, number: number, over: Partial<Observation> = {}): Observation => ({
  id, number, title: `Observation ${number}`, date: '2026-09-01', impact: 'minor', seen: 1, body: '',
  history: [{ date: '2026-09-01', kind: 'recorded' }], ...over,
})

/** `acme/retail`, the scope open: three applications, one with nobody answering for it, and what was seen about them. */
export const RETAIL: HostModel = {
  name: 'Retail',
  elements: [
    application('wms', 'Warehouse system'),
    application('pos', 'Point of sale', { owner: { person: 'pe-pia' } }),
    application('loyalty', 'Loyalty', { owner: 'Marketing' }),
  ],
  relations: [],
  diagrams: [],
  observations: [
    observation('ob-1', 1, { title: 'Picking lists late', about: ['wms'], impact: 'major' }),
    observation('ob-2', 2, { title: 'Till freezes', about: ['pos'] }),
    observation('ob-3', 3, { title: 'Old stock counts', about: ['wms'], archived: true }),
  ],
}

/** `acme/finance`, a scope beside it: read from where it is kept, never open. */
export const FINANCE: HostModel = {
  name: 'Finance',
  elements: [application('erp', 'Finance system'), application('billing', 'Billing', { owner: 'Finance desk' })],
  relations: [],
  diagrams: [],
  observations: [observation('ob-1', 1, { title: 'Invoices sent twice', about: ['erp'] })],
}

export const SCOPES: Readonly<Record<string, HostModel>> = { 'acme/retail': RETAIL, 'acme/finance': FINANCE }

function tree(): TreeView {
  return {
    scopes: () => [
      { path: '', name: 'Acme Logistics', kind: 'organisation', views: 0 },
      ...Object.entries(SCOPES).map(([path, model]) => ({ path, name: model.name, kind: 'landscape', views: 0 })),
    ],
    lookup: () => undefined,
    register: () => [],
    findings: () => [],
    initiativesBelow: () => [],
    read: (path) => {
      const model = SCOPES[path]
      return Promise.resolve(model ? { model, activeDiagramId: '', ancestorDecisions: [] } : undefined)
    },
  }
}

/** A session over the real reducer, a step a dispatch: what the workspace binds, minus React. */
export function sessionOver(host: HostModel, path: string, over: Partial<SessionView> = {}): SessionView & { history(): readonly HistoryEntry[]; model(): Model } {
  let model = fromArrays(host)
  let revision = 0
  let counter = 0
  const past: HistoryEntry[] = []
  return {
    model: () => model,
    indexed: () => model,
    current: () => toArrays(model),
    activeDiagramId: () => '',
    scopePath: () => path,
    ancestorDecisions: () => [],
    blocked: () => undefined,
    dispatch: (command: Command) => {
      const result = apply(model, command)
      if (!result.ok) return undefined
      past.push({ at: 1_800_000_000_000 + past.length, summary: summarise([command], model), commands: [command], ...(command.origin ? { origin: command.origin } : {}) })
      model = result.model
      revision += 1
      return toArrays(model)
    },
    ids: idPolicy(() => [...model.order.elements, ...model.order.relations, ...model.order.diagrams]),
    makeId: (prefix) => `${prefix}-${++counter}`,
    today: () => '2026-11-22',
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => `${name} · containers`,
    revision: () => revision,
    history: () => past,
    undo: () => {},
    images: () => [],
    save: () => Promise.resolve(),
    tree: tree(),
    ...over,
  }
}

export function shellOver(people?: PeopleView): ShellView {
  return {
    tree: tree(),
    ...(people ? { people } : {}),
    screen: () => ({}),
    open: () => {},
    client: () => 'a test client',
    driving: new Driving(),
  }
}

const sandbox = quickjsSandbox()

export type TestHost = CodeHost & {
  readonly session: ReturnType<typeof sessionOver>
  /** Every line the host was told about a script. */
  readonly lines: ScriptReport[]
  /** Every inner call the host answered, by tool. */
  readonly asked: string[]
}

/** Code mode's host as the app fills it: the open scope's session, the handler, and nothing landed by a call out of a script. */
export function hostOver(parts: { limits?: Partial<ScriptLimits>; shell?: ShellView; session?: ReturnType<typeof sessionOver>; holder?: string } = {}): TestHost {
  const session = parts.session ?? sessionOver(RETAIL, 'acme/retail')
  const shell = parts.shell ?? shellOver()
  const lines: ScriptReport[] = []
  const asked: string[] = []
  return {
    session, lines, asked,
    holder: parts.holder ?? 'somebody',
    limits: { ...DESKTOP_LIMITS, ...parts.limits },
    sandbox: () => Promise.resolve(sandbox),
    ask: (request, over) => {
      asked.push(request.tool)
      return handle(request, over ? over(session) : session, shell)
    },
    named: (answer) => withNames(answer, session, shell),
    report: (line) => { lines.push(line) },
  }
}

/** A code tool's answer, parsed; a refusal thrown as its key and detail. */
export function said(answer: AgentAnswer): Record<string, unknown> {
  if (!answer.ok) throw new Error(`${answer.refusal}: ${answer.detail ?? ''}`)
  const block = answer.content[0]
  if (!block || block.type !== 'text') throw new Error('not text')
  return JSON.parse(block.text) as Record<string, unknown>
}
