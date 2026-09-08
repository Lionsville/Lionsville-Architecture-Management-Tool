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
import { searchAll } from '../search/search'
import type { AgentAnswer, ToolName } from './tools'
import { checkArguments, json, refused, toolSpec } from './tools'

/** The tools this file answers: the read tier, by name. */
export type ReadTool = Extract<ToolName,
  'project.current' | 'elements.list' | 'element.describe' | 'connections.list' | 'diagrams.list'
  | 'decisions.list' | 'decision.read' | 'plans.list' | 'plan.read' | 'roadmap.check' | 'search'>

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
        connections: model.order.connections.length,
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
        connections: model.order.connections
          .map((id) => model.connections[id])
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
      let total = 0
      for (const id of model.order.connections) {
        const c = model.connections[id]
        if (args.elementId !== undefined && c.sourceId !== args.elementId && c.targetId !== args.elementId) continue
        if (diagram && !(diagram.placements[c.sourceId] && diagram.placements[c.targetId])) continue
        total += 1
        if (rows.length < limit) rows.push(connectionLine(model, c))
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
        scope,
        application: adr.applicationId ? nameOf(model, adr.applicationId) : undefined,
      })
    }

    case 'search':
      return json({
        hits: searchAll({
          model: view.current(),
          groupDecisions: view.groupDecisions,
          query: args.query as string,
          limitPerKind: args.limit as number | undefined,
        }),
      })
  }
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
    parentApplicationId: element.parentApplicationId,
    hasDescription: Boolean(element.description?.trim()),
  }
}

function connectionLine(model: Model, c: DesignConnection) {
  return {
    id: c.id,
    sourceId: c.sourceId,
    source: nameOf(model, c.sourceId),
    targetId: c.targetId,
    target: nameOf(model, c.targetId),
    label: c.label,
    protocol: c.protocol,
    isBidirectional: c.isBidirectional,
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
    title: adr.title,
    status: adr.status,
    date: adr.date,
    scope,
    applicationId: adr.applicationId,
  }
}
