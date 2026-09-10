/**
 * The read tier: what an agent is told when it asks about the landscape.
 *
 * Pure. Every answer is built over the indexed model and the group's decision
 * list, in the landscape's own terms — an application, a connection, a
 * decision — never in the canvas's. Nothing here changes anything, which is
 * why it can be tested in node against the generated landscape with no session
 * at all.
 *
 * Answers are JSON. A model reads a table of elements as readily as a person
 * reads a list, and JSON is what every client passes through untouched; the
 * one text field a person also reads, a description or a decision's body, is
 * markdown inside it.
 */
import type { Adr } from '../model/adr'
import type { HostModel } from '../model/fromInterchange'
import type { Diagram, Model } from '../model/normalised'
import { decisionsOf, placementList, transitionList } from '../model/normalised'
import { today } from '../model/lifecycle'
import { findTransition, transitionLabel } from '../model/transition'
import type { Transition } from '../model/transition'
import { findings } from '../model/checks'
import { portsOf } from '../model/porting'
import { matchesQuery } from '../model/textSearch'
import type { DesignConnection, DesignElement, ElementId } from '../model/types'
import { businessCaseFence, computeBusinessCase, readBusinessCase } from '../documentation/businessCase'
import { formatAdrNumber } from '../decisions/adr'
import { SEARCH_LIMIT_PER_KIND, searchAll, snippet } from '../search/search'
import type { AgentAnswer, ToolName } from './tools'
import { checkArguments, json, refused, text, toolSpec } from './tools'

/** The tools this file answers: the read tier, by name. */
export type ReadTool = Extract<ToolName,
  'project.current' | 'elements.list' | 'element.describe' | 'connections.list' | 'diagrams.list'
  | 'decisions.list' | 'decision.read' | 'plans.list' | 'plan.read' | 'roadmap.check' | 'search' | 'project.export'>

/**
 * What the read tier needs to know. The session offers both shapes of the
 * model and this takes both: the indexed one is what a lookup by id wants, the
 * arrays are what the search index is cached against.
 */
export type ReadView = {
  readonly model: Model
  /** The same model as the file has it. Cached by the session, so cheap to ask for. */
  readonly current: () => HostModel
  readonly activeDiagramId: string
  /** The group's own records, which are not on the model. */
  readonly groupDecisions: readonly Adr[]
}

type Args = Record<string, unknown>

export function answer(tool: ReadTool, rawArgs: unknown, view: ReadView): AgentAnswer {
  const wrong = checkArguments(toolSpec(tool).inputSchema, rawArgs)
  if (wrong) return refused('agent.badArguments', wrong)
  const args = (rawArgs ?? {}) as Args
  const { model } = view

  switch (tool) {
    case 'project.current':
      return json({
        name: model.name,
        group: model.customerName,
        description: model.description,
        elements: model.order.elements.length,
        connections: model.order.relations.length,
        diagrams: model.order.diagrams.map((id) => diagramLine(model.diagrams[id], view.activeDiagramId)),
        decisions: model.order.decisions.length + view.groupDecisions.length,
        activeDiagramId: view.activeDiagramId,
      })

    case 'elements.list': {
      const diagram = args.diagramId === undefined ? undefined : model.diagrams[args.diagramId as string]
      if (args.diagramId !== undefined && !diagram) return refused('agent.unknownId', `diagram ${String(args.diagramId)}`)
      const limit = (args.limit as number | undefined) ?? 200
      const rows: ReturnType<typeof elementLine>[] = []
      let total = 0
      for (const id of diagram ? diagram.order.placements : model.order.elements) {
        const element = model.elements[id]
        if (!element) continue
        if (args.kind !== undefined && element.kind !== args.kind) continue
        if (args.query !== undefined && !matchesQuery(args.query as string,
          [element.name, element.category, element.vendor, element.technology])) continue
        total += 1
        if (rows.length < limit) rows.push(elementLine(element))
      }
      return json({ total, shown: rows.length, elements: rows })
    }

    case 'element.describe': {
      const element = model.elements[args.id as string]
      if (!element) return refused('agent.unknownId', `element ${String(args.id)}`)
      return json({
        ...element,
        parentApplication: element.parentApplicationId
          ? nameOf(model, element.parentApplicationId) : undefined,
        connections: model.order.relations
          .map((id) => model.relations[id])
          .filter((c) => c.sourceId === element.id || c.targetId === element.id)
          .map((c) => connectionLine(model, c)),
        drawnOn: model.order.diagrams.flatMap((diagramId) => {
          const placement = model.diagrams[diagramId].placements[element.id]
          return placement ? [{ diagramId, name: model.diagrams[diagramId].name, ...placement }] : []
        }),
        decisions: model.order.decisions
          .map((id) => decisionsOf(model)[id])
          .filter((adr) => adr.applicationId === element.id)
          .map((adr) => decisionLine(adr, 'application')),
      })
    }

    case 'connections.list': {
      const limit = (args.limit as number | undefined) ?? 500
      const diagram = args.diagramId === undefined ? undefined : model.diagrams[args.diagramId as string]
      if (args.diagramId !== undefined && !diagram) return refused('agent.unknownId', `diagram ${String(args.diagramId)}`)
      if (args.elementId !== undefined && !model.elements[args.elementId as string]) {
        return refused('agent.unknownId', `element ${String(args.elementId)}`)
      }
      const rows: ReturnType<typeof connectionLine>[] = []
      const dated = datedBy(model, view.current())
      let total = 0
      for (const id of model.order.relations) {
        const c = model.relations[id]
        if (args.elementId !== undefined && c.sourceId !== args.elementId && c.targetId !== args.elementId) continue
        if (diagram && !(diagram.placements[c.sourceId] && diagram.placements[c.targetId])) continue
        total += 1
        if (rows.length < limit) rows.push(connectionLine(model, c, dated))
      }
      return json({ total, shown: rows.length, connections: rows })
    }

    case 'diagrams.list':
      return json({
        diagrams: model.order.diagrams.map((id) => diagramLine(model.diagrams[id], view.activeDiagramId)),
      })

    case 'plans.list': {
      const wanted = args.status as string | undefined
      const touching = args.elementId as string | undefined
      const arrays = view.current()
      const rows = transitionList(model)
        .filter((plan) => (wanted === undefined || plan.status === wanted))
        .filter((plan) => (
          touching === undefined || plan.elements.some((one) => one.elementId === touching)
        ))
        .map((plan) => planEntry(plan, arrays))
      return json({ plans: rows })
    }

    case 'plan.read': {
      const plan = findTransition(transitionList(model), args.id as string)
      if (!plan) return refused('agent.unknownId', `plan ${String(args.id)}`)
      return json(planEntry(plan, view.current()))
    }

    case 'roadmap.check': {
      const arrays = view.current()
      return json({
        findings: findings({ model: arrays, today: today() }),
        // Said in the answer, not only in the tool's description: an agent that
        // reads an empty list must not conclude the landscape is current.
        note: 'These are contradictions between dates. They cannot tell you whether a landscape is out of date.',
      })
    }

    case 'decisions.list': {
      const scope = args.scope as 'group' | 'landscape' | 'application' | undefined
      const rows: ReturnType<typeof decisionLine>[] = []
      if (scope === undefined || scope === 'group') {
        if (args.applicationId === undefined) {
          for (const adr of view.groupDecisions) rows.push(decisionLine(adr, 'group'))
        }
      }
      for (const id of model.order.decisions) {
        const adr = decisionsOf(model)[id]
        const own = adr.applicationId ? 'application' : 'landscape'
        if (scope !== undefined && scope !== own) continue
        if (args.applicationId !== undefined && adr.applicationId !== args.applicationId) continue
        rows.push(decisionLine(adr, own))
      }
      return json({ decisions: rows })
    }

    case 'decision.read': {
      const id = args.id as string
      const own = decisionsOf(model)[id]
      const adr = own ?? view.groupDecisions.find((held) => held.id === id)
      if (!adr) return refused('agent.unknownId', `decision ${id}`)
      const scope = own ? (adr.applicationId ? 'application' : 'landscape') : 'group'
      return json({
        ...adr,
        label: formatAdrNumber(adr.number),
        scope,
        application: adr.applicationId ? nameOf(model, adr.applicationId) : undefined,
      })
    }

    case 'search': {
      const query = args.query as string
      const limit = (args.limit as number | undefined) ?? SEARCH_LIMIT_PER_KIND
      // Plans are not in the app's index yet; the same rule for "found",
      // applied here, so an agent's search covers them as well.
      const plans = transitionList(model)
        .filter((plan) => matchesQuery(query, [transitionLabel(plan), plan.title, plan.owner, plan.body, ...plan.milestones.map((m) => m.name)]))
        .slice(0, limit)
        .map((plan) => ({
          kind: 'plan' as const, planId: plan.id, label: transitionLabel(plan), title: plan.title, status: plan.status,
          snippet: snippet(plan.body, query),
        }))
      return json({
        hits: [
          ...searchAll({ model: view.current(), groupDecisions: view.groupDecisions, query, limitPerKind: limit }),
          ...plans,
        ],
      })
    }

    case 'project.export':
      return args.format === 'json' ? json(view.current()) : text(exportMarkdown(model, view))
  }
}

// --- the whole project as one document ---------------------------------------------

/**
 * The landscape as markdown, one table per kind of thing, for diffing against
 * a document a person wrote. Ids are in every row so a line of the export can
 * be turned back into a call; the bodies — descriptions, decisions, plans —
 * are left out, because they are markdown already and each is one call away.
 */
function exportMarkdown(model: Model, view: ReadView): string {
  const cell = (value: unknown): string => (value === undefined || value === null || value === '' ? '' : String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' '))
  const table = (header: string[], rows: unknown[][]): string[] => (rows.length === 0 ? ['_None._', ''] : [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
    '',
  ])
  const dates = (element: DesignElement): string => {
    const held = element.lifecycleDates ?? {}
    return ['live', 'retiring', 'retired'].filter((phase) => held[phase as keyof typeof held])
      .map((phase) => `${phase} ${held[phase as keyof typeof held]}`).join(', ')
  }
  const name = (id: string): string => model.elements[id]?.name ?? id
  const lines: string[] = [`# ${model.name}`, '', `Group: ${model.customerName}`, '']
  if (model.description) lines.push(model.description, '')

  const kinds = ['actor', 'inputChannel', 'application', 'component', 'externalSystem', 'managementTool'] as const
  lines.push('## Elements', '')
  for (const kind of kinds) {
    const rows = model.order.elements.map((id) => model.elements[id]).filter((e) => e.kind === kind)
    if (rows.length === 0) continue
    lines.push(`### ${kind}`, '', ...table(
      ['id', 'name', 'lifecycle', 'dates', 'successor', 'owner', 'category', 'vendor', 'technology', 'parent'],
      rows.map((e) => [e.id, e.name, e.lifecycle, dates(e), e.successorId, e.owner, e.category, e.vendor, e.technology, e.parentApplicationId]),
    ))
  }

  lines.push('## Connections', '', ...table(
    ['id', 'from', 'to', 'label', 'protocol', 'both ways', 'valid from', 'valid until'],
    model.order.relations.map((id) => model.relations[id])
      .map((c) => [c.id, `${name(c.sourceId)} (${c.sourceId})`, `${name(c.targetId)} (${c.targetId})`, c.label, c.protocol, c.isBidirectional ? 'yes' : '', c.validFrom, c.validUntil]),
  ))

  lines.push('## Diagrams', '', ...table(
    ['id', 'name', 'kind', 'about', 'as of', 'elements'],
    model.order.diagrams.map((id) => model.diagrams[id])
      .map((d) => [d.id, d.name, d.kind, d.applicationElementId ? name(d.applicationElementId) : '', d.asOf, placementList(d).length]),
  ))

  const plans = transitionList(model)
  lines.push('## Plans', '', ...table(
    ['id', 'label', 'title', 'status', 'from', 'to', 'owner', 'introduces', 'retires', 'changes', 'decisions', 'milestones'],
    plans.map((p) => [
      p.id, transitionLabel(p), p.title, p.status, p.from, p.to, p.owner,
      p.elements.filter((e) => e.role === 'introduces').map((e) => e.elementId).join(', '),
      p.elements.filter((e) => e.role === 'retires').map((e) => e.elementId).join(', '),
      p.elements.filter((e) => e.role === 'changes').map((e) => e.elementId).join(', '),
      p.decisions.join(', '),
      p.milestones.map((m) => `${m.date} ${m.name}`).join('; '),
    ]),
  ))

  const own = decisionsOf(model)
  const decisions = [
    ...view.groupDecisions.map((adr) => ({ adr, scope: 'group' })),
    ...model.order.decisions.map((id) => ({ adr: own[id], scope: own[id].applicationId ? 'application' : 'landscape' })),
  ]
  lines.push('## Decisions', '', ...table(
    ['id', 'label', 'scope', 'application', 'title', 'status', 'date', 'supersedes by'],
    decisions.map(({ adr, scope }) => [adr.id, formatAdrNumber(adr.number), scope, adr.applicationId ? name(adr.applicationId) : '', adr.title, adr.status, adr.date, adr.supersededBy]),
  ))
  return lines.join('\n')
}

// --- the lines an answer is made of ----------------------------------------------

function nameOf(model: Model, id: ElementId): string | undefined {
  return model.elements[id]?.name
}

/**
 * One plan as every plan-tool answers it: the record, the interfaces derived
 * from the lines (ADR-0010), and the business case the body computes — so a
 * caller that wrote a fence reads back what the page will show without
 * opening the page.
 */
export function planEntry(plan: Transition, arrays: HostModel) {
  const named = new Map(arrays.elements.map((element) => [element.id, element.name]))
  return {
    id: plan.id,
    label: transitionLabel(plan),
    title: plan.title,
    status: plan.status,
    ...(plan.from ? { from: plan.from } : {}),
    ...(plan.to ? { to: plan.to } : {}),
    ...(plan.owner ? { owner: plan.owner } : {}),
    elements: plan.elements,
    decisions: plan.decisions,
    milestones: plan.milestones,
    // Derived from the lines, not stored (ADR-0010): what the plan page shows.
    interfaces: portsOf(arrays, plan).map((port) => ({
      connectionId: port.from.id,
      from: port.fromElementId,
      counterpart: named.get(port.counterpartId) ?? port.counterpartId,
      counterpartId: port.counterpartId,
      ...(port.from.label ? { label: port.from.label } : {}),
      ...(port.from.protocol ? { protocol: port.from.protocol } : {}),
      ...(port.to ? { to: port.to.sourceId === port.counterpartId ? port.to.targetId : port.to.sourceId } : {}),
      ...(port.on ? { on: port.on } : {}),
      ...(port.closedOn ? { closedOn: port.closedOn } : {}),
    })),
    businessCase: businessCaseOf(plan.body),
    body: plan.body,
  }
}

/**
 * What the body's ```business-case fence computes, or why it does not.
 *
 * The same reader and the same arithmetic as the page, so the numbers here are
 * the numbers there. The shape is said back beside the result because a caller
 * that got `noLines` is about to write the fence and needs to know that the
 * first table is the money, one row per line and one column per period, and
 * the second is the scorecard with a weight and a one-to-five score per row.
 */
function businessCaseOf(body: string) {
  const fence = businessCaseFence(body)
  if (fence === undefined) return { state: 'noFence' as const }
  const held = readBusinessCase(fence)
  if (!held.lines.length) {
    return {
      state: 'noLines' as const,
      note: 'The fence has no money table. Keys first (currency, discount rate), then a table whose first column '
        + 'names a line and whose other columns are periods, then a table of criteria with a weight and a score out of 5.',
    }
  }
  const result = computeBusinessCase(held)
  return {
    state: 'computed' as const,
    ...(held.currency ? { currency: held.currency } : {}),
    ...(held.discountRate !== undefined ? { discountRate: held.discountRate } : {}),
    periods: held.periods,
    lines: held.lines,
    criteria: held.criteria,
    ...result,
    ...(held.discountRate === undefined ? { note: 'No discount rate, so no net present value.' } : {}),
  }
}

function elementLine(element: DesignElement) {
  return {
    id: element.id,
    name: element.name,
    kind: element.kind,
    lifecycle: element.lifecycle,
    category: element.category,
    vendor: element.vendor,
    technology: element.technology,
    owner: element.owner,
    lifecycleDates: element.lifecycleDates,
    successorId: element.successorId,
    parentApplicationId: element.parentApplicationId,
    hasDescription: Boolean(element.description?.trim()),
  }
}

/**
 * Which plan dated each line, derived the way the plan page derives its
 * table (ADR-0010): a port closes the original and opens the twin, so both
 * are that plan's. Built once per answer, not once per line.
 */
function datedBy(model: Model, arrays: HostModel): Map<string, Transition> {
  const out = new Map<string, Transition>()
  for (const plan of transitionList(model)) {
    for (const port of portsOf(arrays, plan)) {
      if (port.on === undefined || !port.to) continue
      out.set(port.from.id, plan)
      out.set(port.to.id, plan)
    }
  }
  return out
}

function connectionLine(model: Model, c: DesignConnection, dated?: Map<string, Transition>) {
  const plan = dated?.get(c.id)
  return {
    id: c.id,
    sourceId: c.sourceId,
    source: nameOf(model, c.sourceId),
    targetId: c.targetId,
    target: nameOf(model, c.targetId),
    label: c.label,
    protocol: c.protocol,
    isBidirectional: c.isBidirectional,
    validFrom: c.validFrom,
    validUntil: c.validUntil,
    ...(plan ? { planId: plan.id, plan: transitionLabel(plan) } : {}),
  }
}

function diagramLine(diagram: Diagram, activeDiagramId: string) {
  return {
    id: diagram.id,
    name: diagram.name,
    kind: diagram.kind,
    applicationElementId: diagram.applicationElementId,
    elements: placementList(diagram).length,
    active: diagram.id === activeDiagramId,
  }
}

function decisionLine(adr: Adr, scope: 'group' | 'landscape' | 'application') {
  return {
    id: adr.id,
    number: adr.number,
    label: formatAdrNumber(adr.number),
    title: adr.title,
    status: adr.status,
    date: adr.date,
    scope,
    applicationId: adr.applicationId,
  }
}
