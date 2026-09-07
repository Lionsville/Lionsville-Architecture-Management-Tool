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
import { decisionsOf, placementList } from '../model/normalised'
import { matchesQuery } from '../model/textSearch'
import type { DesignConnection, DesignElement, ElementId } from '../model/types'
import { searchAll } from '../search/search'
import type { AgentAnswer, ToolName } from './tools'
import { checkArguments, json, refused, toolSpec } from './tools'

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

export function answer(tool: ToolName, rawArgs: unknown, view: ReadView): AgentAnswer {
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
