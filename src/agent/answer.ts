// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import type { HostModel } from '../model/hostModel'
import type { Diagram, Model } from '../model/normalised'
import { decisionsOf, groupsOf, placedList, placedOn, toArrays, transitionList } from '../model/normalised'
import { hostingOf } from '../model/hosting'
import { consumersOf, leverageOf, platformsBehind } from '../model/leverage'
import { platformReport } from '../model/platformReport'
import type { PlatformDescription, PlatformEnd } from '../model/platformReport'
import { serviceReport } from '../model/serviceReport'
import { descendantPlatforms } from '../model/hosting'
import type { PlatformTree } from '../model/hosting'
import { today } from '../model/lifecycle'
import { findTransition, transitionLabel } from '../model/transition'
import type { Transition } from '../model/transition'
import { findings } from '../model/checks'
import { ELEMENT_KINDS } from '../model/kinds'
import { portsOf } from '../model/porting'
import { matchesQuery } from '../model/textSearch'
import type { DesignElement, ElementId, Relation } from '../model/types'
import { businessCaseFence, computeBusinessCase, readBusinessCase } from '../documentation/businessCase'
import { formatAdrNumber } from '../decisions/adr'
import { SEARCH_LIMIT_PER_KIND, searchAll, snippet } from '../search/search'
import type { AgentAnswer, ToolName } from './tools'
import { checkArguments, json, refused, text, toolSpec } from './tools'
import { identityOf } from './tree'
import type { TreeView } from './tree'
import { causeList, experimentList, observationList, observationsOf, solutionList } from '../model/normalised'
import type { Experiment, Solution } from '../model/observation'
import {
  alternatives, experimentsFor, formatExperimentNumber, formatSolutionNumber, isLive, openItems, seenSinceImplemented,
  solutionGate, solutionPhase, solutionQuestions,
} from '../observations/solution'
import type { SolutionContext, SolutionPlan } from '../observations/solution'
import type { Cause, Observation } from '../model/observation'
import {
  absorbedBy, explainedBy, formatCauseNumber, formatObservationNumber, isMerged, isRootCause,
} from '../observations/observation'

/** The tools this file answers: the read tier, by name. */
export type ReadTool = Extract<ToolName,
  'project.current' | 'elements.list' | 'element.describe' | 'connections.list' | 'diagrams.list'
  | 'decisions.list' | 'decision.read' | 'plans.list' | 'plan.read' | 'roadmap.check' | 'search' | 'project.export'
  | 'platform.report' | 'service.report'
  | 'observations.list' | 'observation.read' | 'causes.list' | 'cause.read'
  | 'solutions.list' | 'solution.read' | 'experiments.list' | 'experiment.read'>

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
  /**
   * Where this scope is in the tree (ADR-0012 §1). The empty string is the
   * organisation, which is what `project.current` says when a client asks where
   * it is working.
   */
  readonly scopePath: string
  /** The records of the scope above this one, which are not on this model. */
  readonly ancestorDecisions: readonly Adr[]
  /** The tree, for who answers for an id (ADR-0012 §9). Absent where there is none. */
  readonly tree?: Pick<TreeView, 'lookup' | 'initiativesBelow' | 'observationsBelow' | 'rowsTo'>
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
        path: view.scopePath,
        description: model.description,
        elements: model.order.elements.length,
        connections: model.order.relations.length,
        diagrams: model.order.diagrams.map((id) => diagramLine(model.diagrams[id], view.activeDiagramId)),
        decisions: model.order.decisions.length + view.ancestorDecisions.length,
        activeDiagramId: view.activeDiagramId,
      })

    case 'elements.list': {
      const diagram = args.diagramId === undefined ? undefined : model.diagrams[args.diagramId as string]
      if (args.diagramId !== undefined && !diagram) return refused('agent.unknownId', `diagram ${String(args.diagramId)}`)
      // The children of one node in a tree — a function's capabilities, a
      // phase's steps — which is how an agent walks a sheet without listing
      // the whole business layer and filtering it by hand.
      const parentId = args.parentId as string | undefined
      if (parentId !== undefined && !model.elements[parentId]) return refused('agent.unknownId', `element ${parentId}`)
      const limit = (args.limit as number | undefined) ?? 200
      const rows: ReturnType<typeof elementLine>[] = []
      let total = 0
      for (const id of diagram ? diagram.order.members : model.order.elements) {
        const element = model.elements[id]
        if (!element) continue
        if (args.kind !== undefined && element.kind !== args.kind) continue
        if (parentId !== undefined && element.parentId !== parentId) continue
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
        // Said out loud beside `ref`, which is the path and not the fact
        // (ADR-0012 §3). What it costs a reader to work out from a field that
        // is usually absent is exactly what `element.update` refuses on.
        standIn: element.ref !== undefined,
        // Who answers for it across the organisation, and who else draws it
        // (ADR-0012 §9) — the element's page header, said to an agent.
        identity: identityOf(view.tree, element.id),
        // `parent`, not `parentApplication`: one field says what a thing sits
        // inside whatever kind it is (ADR-0012 §3) — a component's
        // application, a function's area, a step's phase, an actor's group.
        parent: element.parentId ? nameOf(model, element.parentId) : undefined,
        // Where it runs (ADR-0013, redone). An application answers with the
        // roll-up over its components, because that is where the rows are and
        // an application is not deployed anywhere itself; one with no
        // components answers with its own row, and a component always does.
        // And, apart from the derived line, what was SAID (ADR-0020): the
        // uses rows as written, so a client can tell the two apart.
        ...(element.kind === 'application' || element.kind === 'component'
          ? { runsOn: runsOn(model, element.id), uses: usesOf(model, element, view), leverages: leverages(model, element.id, view) }
          : {}),
        // The technology layer, said from either side (ADR-0014): what a
        // service is maintained by, realised by and consumed by; what a
        // platform realises and sits in. Over the tree's rows where there is
        // a tree, since the consumers are the landscapes' rows.
        ...(element.kind === 'platformService' ? serviceSide(model, element, view) : {}),
        ...(element.kind === 'platform' ? platformSide(model, element, view) : {}),
        connections: model.order.relations
          .map((id) => model.relations[id])
          .filter((c) => c.sourceId === element.id || c.targetId === element.id)
          .map((c) => connectionLine(model, c)),
        drawnOn: model.order.diagrams.flatMap((diagramId) => {
          const diagram = model.diagrams[diagramId]
          const placement = placedOn(diagram, element.id)!
          if (!placement) return []
          // A group goes out under its NAME: that is what `group` and
          // `element.place` take, and what a reader has seen on the board. The
          // id is the model's (ADR-0012 §6).
          const { id, group, ...rest } = placement
          return [{
            diagramId,
            name: diagram.name,
            // `elementId`, not `id`: the answer is a published shape, and the
            // id in it is the element's, not the row's.
            elementId: id,
            ...rest,
            ...(group !== undefined
              ? { domainGroup: groupsOf(diagram)[group]?.name ?? group }
              : {}),
          }]
        }),
        decisions: model.order.decisions
          .map((id) => decisionsOf(model)[id])
          .filter((adr) => adr.subjectId === element.id)
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
        if (diagram && !(placedOn(diagram, c.sourceId) && placedOn(diagram, c.targetId))) continue
        total += 1
        if (rows.length < limit) rows.push(connectionLine(model, c, dated))
      }
      return json({ total, shown: rows.length, connections: rows })
    }

    case 'diagrams.list':
      return json({
        diagrams: model.order.diagrams.map((id) => diagramLine(model.diagrams[id], view.activeDiagramId)),
      })

    case 'observations.list': {
      const impact = args.impact as string | undefined
      const analysed = args.analysed as boolean | undefined
      const own = observationList(model)
      const causes = causeList(model)
      const wanted = (observation: Observation, scope?: string) => {
        if (impact !== undefined && observation.impact !== impact) return false
        if (analysed === undefined) return true
        return (explainedBy(causes, observation.id, scope).length > 0) === analysed
      }
      const rows = own
        .filter((one) => args.includeMerged === true || !isMerged(own, one.id))
        .filter((one) => args.includeArchived === true || !one.archived)
        .filter((one) => wanted(one))
        .map((one) => observationLine(one, causes, own))
      const fromBelow = (view.tree?.observationsBelow?.(view.scopePath) ?? [])
        .filter(({ scope, observation }) => !absorbedBy(own, observation.id, scope) && !observation.archived && wanted(observation, scope))
        .map(({ scope, observation }) => ({ scope, ...observationLine(observation, causes, own, scope) }))
      return json({ observations: rows, ...(fromBelow.length > 0 ? { fromBelow } : {}) })
    }

    case 'observation.read': {
      const own = observationList(model)
      const observation = findObservation(own, args.id as string)
      if (!observation) return refused('agent.unknownId', `observation ${String(args.id)}`)
      return json({ ...observationLine(observation, causeList(model), own), body: observation.body, history: observation.history })
    }

    case 'causes.list': {
      const state = args.state as string | undefined
      const causes = causeList(model)
      return json({
        causes: causes
          .filter((one) => state === undefined || one.state === state)
          .filter((one) => args.root !== true || isRootCause(one, causes))
          .map((one) => causeLine(one, causes, model)),
      })
    }

    case 'cause.read': {
      const causes = causeList(model)
      const cause = findCause(causes, args.id as string)
      if (!cause) return refused('agent.unknownId', `cause ${String(args.id)}`)
      return json({ ...causeLine(cause, causes, model), body: cause.body })
    }

    case 'solutions.list': {
      const phase = args.phase as string | undefined
      const causeId = args.causeId as string | undefined
      const cause = causeId === undefined ? undefined : findCause(causeList(model), causeId)
      if (causeId !== undefined && !cause) return refused('agent.unknownId', `cause ${causeId}`)
      const facts = solutionFacts(view)
      return json({
        solutions: solutionList(model)
          .filter((one) => args.includeDropped === true || isLive(one) || phase === 'dropped')
          .filter((one) => phase === undefined || solutionPhase(one, facts.context.plans) === phase)
          .filter((one) => !cause || one.addresses.some((address) => address.id === cause.id))
          .map((one) => solutionLine(one, facts)),
      })
    }

    case 'solution.read': {
      const facts = solutionFacts(view)
      const solution = findSolution(facts.solutions, args.id as string)
      if (!solution) return refused('agent.unknownId', `solution ${String(args.id)}`)
      return json({
        ...solutionLine(solution, facts),
        alternatives: alternatives(solution, facts.solutions).map((one) => ({
          id: one.id, label: formatSolutionNumber(one.number), title: one.title, phase: solutionPhase(one, facts.context.plans),
          ...(one.dropNote ? { dropNote: one.dropNote } : {}),
        })),
        body: solution.body,
        history: solution.history,
      })
    }

    case 'experiments.list': {
      const facts = solutionFacts(view)
      const solutionId = args.solutionId as string | undefined
      const solution = solutionId === undefined ? undefined : findSolution(facts.solutions, solutionId)
      if (solutionId !== undefined && !solution) return refused('agent.unknownId', `solution ${solutionId}`)
      return json({
        experiments: experimentList(model)
          .filter((one) => args.outcome === undefined || one.outcome === args.outcome)
          .filter((one) => !solution || one.tests.includes(solution.id))
          .map((one) => experimentLine(one, facts.solutions)),
      })
    }

    case 'experiment.read': {
      const facts = solutionFacts(view)
      const experiment = findExperiment(experimentList(model), args.id as string)
      if (!experiment) return refused('agent.unknownId', `experiment ${String(args.id)}`)
      return json({ ...experimentLine(experiment, facts.solutions), body: experiment.body })
    }

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
      // The initiatives filed below this scope (ADR-0012 §7): what the
      // roadmap draws under its own plans, said with where each lives.
      const fromBelow = (view.tree?.initiativesBelow(view.scopePath) ?? [])
        .filter(({ transition }) => wanted === undefined || transition.status === wanted)
        .map(({ scope, transition }) => ({
          scope,
          id: transition.id,
          label: transitionLabel(transition),
          title: transition.title,
          status: transition.status,
          ...(transition.from ? { from: transition.from } : {}),
          ...(transition.to ? { to: transition.to } : {}),
          ...(transition.owner ? { owner: transition.owner } : {}),
        }))
      return json({ plans: rows, ...(fromBelow.length > 0 ? { fromBelow } : {}) })
    }

    case 'plan.read': {
      const plan = findTransition(transitionList(model), args.id as string)
      if (!plan) return refused('agent.unknownId', `plan ${String(args.id)}`)
      return json(planEntry(plan, view.current()))
    }

    case 'roadmap.check': {
      const arrays = view.current()
      return json({
        // Over the platform tree the index holds (ADR-0014 §2.7): a stand-in
        // of a namespace carries no `parentId` of its own.
        findings: findings({ model: arrays, today: today(), platformTree: treeOf(view) }),
        // Said in the answer, not only in the tool's description: an agent that
        // reads an empty list must not conclude the landscape is current.
        note: 'These are contradictions between dates. They cannot tell you whether a landscape is out of date.',
      })
    }

    /**
     * One platform, and what would be left standing if it went (ADR-0013).
     *
     * A report and not a view: the first cut made it the fourth laid-out view
     * kind, which promised a picture and gave a table. Answered here so an
     * agent reads exactly what the person reading the page reads.
     */
    case 'platform.report': {
      const id = args.platformId as string
      const platform = model.elements[id]
      if (!platform) return refused('agent.unknownId', `element ${id}`)
      if (platform.kind !== 'platform') {
        return refused('agent.badArguments', `${id} is a ${platform.kind}, not a platform`)
      }
      // Told what the tree knows about every id the rows name (ADR-0012 §2),
      // and handed the rows the rest of the tree wrote about the platform and
      // what is filed under it (ADR-0014 §2.7).
      const arrays = view.current()
      const describe = (held: string): PlatformDescription | undefined => {
        const entry = view.tree?.lookup(held)
        if (!entry) return undefined
        return {
          name: entry.name, kind: entry.kind,
          ...(entry.master !== undefined && entry.master !== view.scopePath ? { where: entry.master } : {}),
          ...(entry.platformArchetype !== undefined ? { platformArchetype: entry.platformArchetype } : {}),
          ...(entry.parentId !== undefined ? { parentId: entry.parentId } : {}),
          ...(entry.outside ? { outside: entry.outside } : {}),
        }
      }
      const about = [id, ...descendantPlatforms(arrays.elements, id, treeOf(view)).map((one) => one.id)]
      const report = platformReport(arrays, id, { today: today(), describe, elsewhere: rowsAbout(view, about) })!
      const end = (one: PlatformEnd) => ({
        id: one.id,
        name: one.name,
        known: one.known,
        ...(one.kind !== undefined ? { kind: one.kind } : {}),
        ...(one.application !== undefined ? { application: one.application } : {}),
        ...(one.place !== undefined ? { place: one.place } : {}),
      })
      return json({
        platform: { id: report.platform.id, name: report.platform.name, platformArchetype: report.platform.platformArchetype },
        children: report.children.map(end),
        standsOn: report.standsOn.map(end),
        hosted: report.hosted.map(end),
        users: report.users.map(end),
        landings: report.landings.map((landing) => ({
          id: landing.relation.id,
          source: end(landing.source),
          target: end(landing.target),
          on: end(landing.on),
          ...(landing.relation.protocol !== undefined ? { protocol: landing.relation.protocol } : {}),
          ...(landing.relation.technology !== undefined ? { technology: landing.relation.technology } : {}),
          ...(landing.partOf !== undefined ? { partOf: landing.partOf } : {}),
        })),
        counts: report.counts,
      })
    }

    /**
     * One service, and what would be stranded if it were withdrawn
     * (ADR-0014): the platform report's other side, over the tree's rows,
     * since the consumers are the landscapes' rows.
     */
    case 'service.report': {
      const id = args.serviceId as string
      const service = model.elements[id]
      if (!service) return refused('agent.unknownId', `element ${id}`)
      if (service.kind !== 'platformService') {
        return refused('agent.badArguments', `${id} is a ${service.kind}, not a platformService`)
      }
      const describe = (held: string): PlatformDescription | undefined => {
        const entry = view.tree?.lookup(held)
        if (!entry) return undefined
        return {
          name: entry.name, kind: entry.kind,
          ...(entry.master !== undefined && entry.master !== view.scopePath ? { where: entry.master } : {}),
        }
      }
      const report = serviceReport(view.current(), id, { today: today(), describe, elsewhere: rowsAbout(view, [id]) })!
      const end = (one: PlatformEnd) => ({
        id: one.id, name: one.name, known: one.known,
        ...(one.kind !== undefined ? { kind: one.kind } : {}),
        ...(one.where !== undefined ? { scope: one.where } : {}),
      })
      return json({
        service: { id: report.service.id, name: report.service.name, shared: report.service.shared, ...(report.service.retiredOn ? { retiredOn: report.service.retiredOn } : {}) },
        maintainers: report.maintainers.map(end),
        realisedBy: report.realisedBy.map(end),
        consumers: report.consumers.map((one) => ({ ...end(one), ...(one.via ? { via: one.via } : {}) })),
        scopes: report.scopes,
        stranded: report.stranded.map((one) => one.id),
        counts: report.counts,
      })
    }

    case 'decisions.list': {
      const scope = args.scope as 'group' | 'landscape' | 'application' | undefined
      const rows: ReturnType<typeof decisionLine>[] = []
      if (scope === undefined || scope === 'group') {
        if (args.subjectId === undefined) {
          for (const adr of view.ancestorDecisions) rows.push(decisionLine(adr, 'group'))
        }
      }
      for (const id of model.order.decisions) {
        const adr = decisionsOf(model)[id]
        const own = adr.subjectId ? 'application' : 'landscape'
        if (scope !== undefined && scope !== own) continue
        if (args.subjectId !== undefined && adr.subjectId !== args.subjectId) continue
        rows.push(decisionLine(adr, own))
      }
      return json({ decisions: rows })
    }

    case 'decision.read': {
      const id = args.id as string
      const own = decisionsOf(model)[id]
      const adr = own ?? view.ancestorDecisions.find((held) => held.id === id)
      if (!adr) return refused('agent.unknownId', `decision ${id}`)
      const scope = own ? (adr.subjectId ? 'application' : 'landscape') : 'group'
      return json({
        ...adr,
        label: formatAdrNumber(adr.number),
        scope,
        application: adr.subjectId ? nameOf(model, adr.subjectId) : undefined,
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
          // `above` is what the app calls a record from a scope above this one
          // since the three decision lists became one (ADR-0012 §7); the
          // protocol still says `group`, which `decisions.list`'s own `scope`
          // enum says too. Both change together, in the agent's own stretch.
          ...searchAll({ model: view.current(), ancestorDecisions: view.ancestorDecisions, query, limitPerKind: limit })
            .map((hit) => (hit.kind === 'adr' && hit.scope === 'above' ? { ...hit, scope: 'group' } : hit)),
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
  const lines: string[] = [`# ${model.name}`, '', `Scope: ${view.scopePath || '/'}`, '']
  if (model.description) lines.push(model.description, '')

  // Every kind, so nothing the model can hold is left out of a document meant
  // for diffing against one somebody wrote (ADR-0012 §4).
  const kinds = ELEMENT_KINDS
  lines.push('## Elements', '')
  for (const kind of kinds) {
    const rows = model.order.elements.map((id) => model.elements[id]).filter((e) => e.kind === kind)
    if (rows.length === 0) continue
    lines.push(`### ${kind}`, '', ...table(
      ['id', 'name', 'lifecycle', 'dates', 'successor', 'owner', 'category', 'vendor', 'technology', 'parent'],
      rows.map((e) => [e.id, e.name, e.lifecycle, dates(e), e.successorId, e.owner, e.category, e.vendor, e.technology, e.parentId]),
    ))
  }

  lines.push('## Connections', '', ...table(
    ['id', 'type', 'from', 'to', 'label', 'protocol', 'both ways', 'valid from', 'valid until'],
    model.order.relations.map((id) => model.relations[id])
      .map((c) => [c.id, c.type, `${name(c.sourceId)} (${c.sourceId})`, `${name(c.targetId)} (${c.targetId})`, c.label, c.protocol, c.isBidirectional ? 'yes' : '', c.validFrom, c.validUntil]),
  ))

  lines.push('## Diagrams', '', ...table(
    ['id', 'name', 'kind', 'about', 'as of', 'elements'],
    model.order.diagrams.map((id) => model.diagrams[id])
      .map((d) => [d.id, d.name, d.kind, d.applicationElementId ? name(d.applicationElementId) : '', d.asOf, placedList(d).length]),
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
    ...view.ancestorDecisions.map((adr) => ({ adr, scope: 'group' })),
    ...model.order.decisions.map((id) => ({ adr: own[id], scope: own[id].subjectId ? 'application' : 'landscape' })),
  ]
  lines.push('## Decisions', '', ...table(
    ['id', 'label', 'scope', 'application', 'title', 'status', 'date', 'supersedes by'],
    decisions.map(({ adr, scope }) => [adr.id, formatAdrNumber(adr.number), scope, adr.subjectId ? name(adr.subjectId) : '', adr.title, adr.status, adr.date, adr.supersededBy]),
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
/** An observation by its id or by what people call it — `OB-3`, `ob-0003`, or the bare number. */
export function findObservation(list: readonly Observation[], idOrLabel: string): Observation | undefined {
  const held = list.find((one) => one.id === idOrLabel)
  if (held) return held
  const number = /^(?:ob-?)?(\d+)$/i.exec(idOrLabel.trim())
  return number ? list.find((one) => one.number === Number(number[1])) : undefined
}

export function findSolution(list: readonly Solution[], idOrLabel: string): Solution | undefined {
  const held = list.find((one) => one.id === idOrLabel)
  if (held) return held
  const number = /^(?:so-?)?(\d+)$/i.exec(idOrLabel.trim())
  return number ? list.find((one) => one.number === Number(number[1])) : undefined
}

export function findExperiment(list: readonly Experiment[], idOrLabel: string): Experiment | undefined {
  const held = list.find((one) => one.id === idOrLabel)
  if (held) return held
  const number = /^(?:ex-?)?(\d+)$/i.exec(idOrLabel.trim())
  return number ? list.find((one) => one.number === Number(number[1])) : undefined
}

/** What every solution answer reads from the scope, gathered once (ADR-0026). */
export type SolutionFacts = {
  model: Model
  solutions: Solution[]
  context: SolutionContext
  shared: ReturnType<NonNullable<TreeView['observationsBelow']>>
}

export function solutionFacts(view: Pick<ReadView, 'model' | 'tree' | 'scopePath'>): SolutionFacts {
  const { model } = view
  const plans: SolutionPlan[] = transitionList(model).map((one) => ({
    id: one.id, status: one.status, ...(one.to ? { to: one.to } : {}), elements: one.elements,
  }))
  return {
    model,
    solutions: solutionList(model),
    context: {
      causes: causeList(model),
      experiments: experimentList(model),
      decisions: Object.values(decisionsOf(model)).map((one) => ({ id: one.id, status: one.status })),
      plans,
    },
    shared: view.tree?.observationsBelow?.(view.scopePath) ?? [],
  }
}

/**
 * One solution as a list answers it (ADR-0026): its phase, what it addresses,
 * what the next gate still needs, the questions its record asks, and — once
 * implemented — any sighting since.
 */
export function solutionLine(solution: Solution, facts: SolutionFacts) {
  const { model, context } = facts
  const causes = context.causes
  const gate = solutionGate(solution, context)
  const decision = solution.decision ? decisionsOf(model)[solution.decision] : undefined
  const plan = solution.plan ? transitionList(model).find((one) => one.id === solution.plan) : undefined
  const analysis = { observations: observationList(model), causes: [...causes] }
  const seenAgain = seenSinceImplemented(solution, analysis, facts.shared, context.plans)
  return {
    id: solution.id,
    label: formatSolutionNumber(solution.number),
    title: solution.title,
    state: solution.state,
    phase: solutionPhase(solution, context.plans),
    ...(solution.benefit ? { benefit: solution.benefit } : {}),
    ...(solution.cost ? { cost: solution.cost } : {}),
    addresses: solution.addresses.map((address) => {
      const cause = causes.find((one) => one.id === address.id)
      return {
        id: address.id, strength: address.strength,
        ...(cause ? { label: formatCauseNumber(cause.number), title: cause.title, root: isRootCause(cause, causes) } : {}),
      }
    }),
    validatedWith: solution.validatedWith,
    attempts: solution.attempts,
    ...(solution.noneKnown ? { noneKnown: true } : {}),
    ...(solution.whyNow ? { whyNow: solution.whyNow } : {}),
    ...(solution.waived ? { waived: solution.waived } : {}),
    ...(solution.state === 'dropped' ? { droppedFrom: solution.droppedFrom, dropNote: solution.dropNote } : {}),
    experiments: experimentsFor(context.experiments, solution.id).map((one) => ({
      id: one.id, label: formatExperimentNumber(one.number), title: one.title, outcome: one.outcome,
    })),
    ...(solution.decision ? { decision: { id: solution.decision, ...(decision ? { label: formatAdrNumber(decision.number), status: decision.status } : {}) } } : {}),
    ...(solution.plan ? { plan: { id: solution.plan, ...(plan ? { label: transitionLabel(plan), status: plan.status } : {}) } } : {}),
    ...(gate ? { next: { to: gate.to, open: openItems(gate) } } : {}),
    questions: solutionQuestions(solution, context),
    ...(seenAgain.length ? { seenSinceImplemented: seenAgain } : {}),
  }
}

/** One experiment as a list answers it. */
export function experimentLine(experiment: Experiment, solutions: readonly Solution[]) {
  return {
    id: experiment.id,
    label: formatExperimentNumber(experiment.number),
    title: experiment.title,
    outcome: experiment.outcome,
    hypothesis: experiment.hypothesis,
    ...(experiment.measure ? { measure: experiment.measure } : {}),
    ...(experiment.where ? { where: experiment.where } : {}),
    ...(experiment.by ? { by: experiment.by } : {}),
    ...(experiment.from ? { from: experiment.from } : {}),
    ...(experiment.to ? { to: experiment.to } : {}),
    ...(experiment.result ? { result: experiment.result } : {}),
    tests: experiment.tests.map((id) => {
      const solution = solutions.find((one) => one.id === id)
      return { id, ...(solution ? { label: formatSolutionNumber(solution.number), title: solution.title, state: solution.state } : {}) }
    }),
  }
}

export function findCause(list: readonly Cause[], idOrLabel: string): Cause | undefined {
  const held = list.find((one) => one.id === idOrLabel)
  if (held) return held
  const number = /^(?:ca-?)?(\d+)$/i.exec(idOrLabel.trim())
  return number ? list.find((one) => one.number === Number(number[1])) : undefined
}

/** One observation as a list answers it, with the causes of this scope that explain it (ADR-0021). */
export function observationLine(observation: Observation, causes: readonly Cause[], own: readonly Observation[], scope?: string) {
  const merged = scope === undefined ? absorbedBy(own, observation.id) : undefined
  return {
    id: observation.id,
    label: formatObservationNumber(observation.number),
    title: observation.title,
    date: observation.date,
    ...(observation.where ? { where: observation.where } : {}),
    ...(observation.by ? { by: observation.by } : {}),
    impact: observation.impact,
    seen: observation.seen,
    shared: observation.shared === true,
    ...(observation.archived ? { archived: true } : {}),
    ...(merged ? { mergedInto: merged.id } : {}),
    causes: explainedBy(causes, observation.id, scope).map((cause) => ({
      id: cause.id,
      label: formatCauseNumber(cause.number),
      title: cause.title,
      strength: cause.explains.find((link) => link.id === observation.id && link.scope === scope)?.strength,
    })),
  }
}

/** One cause as a list answers it: what it explains, what explains it, and whether it is a root (ADR-0021). */
export function causeLine(cause: Cause, causes: readonly Cause[], model: Model) {
  const observations = observationsOf(model)
  return {
    id: cause.id,
    label: formatCauseNumber(cause.number),
    title: cause.title,
    state: cause.state,
    root: isRootCause(cause, causes),
    explains: cause.explains.map((link) => {
      const held = link.scope === undefined ? observations[link.id] ?? causes.find((one) => one.id === link.id) : undefined
      return {
        id: link.id,
        ...(link.scope !== undefined ? { scope: link.scope } : {}),
        strength: link.strength,
        ...(held ? { title: held.title, label: 'number' in held && 'state' in held ? formatCauseNumber(held.number) : formatObservationNumber(held.number) } : {}),
      }
    }),
    explainedBy: explainedBy(causes, cause.id).map((other) => ({ id: other.id, label: formatCauseNumber(other.number), title: other.title })),
  }
}

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
    ...(plan.initiative ? { initiative: true } : {}),
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
    platformArchetype: element.platformArchetype,
    shared: element.shared,
    owner: element.owner,
    lifecycleDates: element.lifecycleDates,
    successorId: element.successorId,
    parentId: element.parentId,
    // The tree fields and the ownership fact, because a sheet is laid out from
    // them and a list is how an agent checks what it just set.
    order: element.order,
    lane: element.lane,
    outside: element.outside,
    partyId: element.partyId,
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

/**
 * Where something runs, said the way an agent reads it: the platforms by name,
 * and where the answer came from (ADR-0013, redone).
 */
function runsOn(model: Model, elementId: string) {
  const hosting = hostingOf(toArrays(model), elementId)
  return {
    platforms: hosting.platformIds.map((id) => ({ id, name: nameOf(model, id) })),
    from: hosting.from,
    ...(hosting.from === 'containers' ? { containers: hosting.containers } : {}),
  }
}

/**
 * The `uses` rows as written (ADR-0020): the element's own, and for an
 * application its containers' with the container named — ids and names, and
 * where a stand-in is answered for. Separate from `leverages`, which is
 * what the rows amount to.
 */
function usesOf(model: Model, element: DesignElement, view: ReadView) {
  const rows = model.order.relations.map((id) => model.relations[id]).filter((row) => row.type === 'uses')
  const containers = element.kind === 'application'
    ? model.order.elements.map((id) => model.elements[id]).filter((held) => held.kind === 'component' && held.parentId === element.id)
    : []
  const said: { row: Relation; through?: ElementId }[] = [
    ...rows.filter((row) => row.sourceId === element.id).map((row) => ({ row })),
    ...containers.flatMap((container) => rows.filter((row) => row.sourceId === container.id).map((row) => ({ row, through: container.id }))),
  ]
  return said.map(({ row, through }) => {
    const held = model.elements[row.targetId]
    const where = held?.ref !== undefined ? view.tree?.lookup(row.targetId)?.master ?? held.ref : undefined
    return {
      id: row.targetId,
      name: held?.name ?? view.tree?.lookup(row.targetId)?.name,
      ...(where !== undefined ? { where } : {}),
      ...(through !== undefined ? { through } : {}),
    }
  })
}

/** The rows the rest of the tree wrote about an id, where there is a tree to ask. */
function rowsAbout(view: ReadView, ids: readonly string[]): Relation[] {
  return ids.flatMap((id) => [...(view.tree?.rowsTo?.(id) ?? [])])
}

/** The platform tree as the index holds it (ADR-0014 §2.7), for the readers that walk it. */
function treeOf(view: ReadView): PlatformTree {
  return {
    parentOf: (id) => view.tree?.lookup(id)?.parentId,
    archetypeOf: (id) => view.tree?.lookup(id)?.platformArchetype,
    outsideOf: (id) => view.tree?.lookup(id)?.outside,
  }
}

/**
 * What an application leverages (ADR-0014): the services it uses, each with
 * the platforms behind it, and any platform it binds to directly — beside
 * `runsOn`, which is where its containers sit.
 */
function leverages(model: Model, applicationId: string, view: ReadView) {
  const arrays = toArrays(model)
  const used = leverageOf(arrays, applicationId)
  const behind = rowsAbout(view, used.services.map((one) => one.id))
  const leverage = leverageOf(arrays, applicationId, { elsewhere: behind })
  const named = (id: string) => ({ id, name: nameOf(model, id) ?? view.tree?.lookup(id)?.name })
  return {
    services: leverage.services.map((one) => ({ ...named(one.id), platforms: one.platformIds.map(named) })),
    platforms: leverage.platformIds.map(named),
  }
}

function serviceSide(model: Model, service: DesignElement, view: ReadView) {
  const arrays = toArrays(model)
  const elsewhere = rowsAbout(view, [service.id])
  const rows = [...arrays.relations, ...elsewhere]
  const named = (id: string) => ({ id, name: nameOf(model, id) ?? view.tree?.lookup(id)?.name })
  const maintainers = [...new Set(rows.filter((row) => row.type === 'assigned' && row.targetId === service.id).map((row) => row.sourceId))]
  return {
    maintainedBy: maintainers.map(named),
    shared: service.shared === true,
    realisedBy: platformsBehind(arrays, service.id, { elsewhere }).map(named),
    consumers: consumersOf(arrays, service.id, { elsewhere }).map(named),
  }
}

function platformSide(model: Model, platform: DesignElement, view: ReadView) {
  const arrays = toArrays(model)
  const named = (id: string) => ({ id, name: nameOf(model, id) ?? view.tree?.lookup(id)?.name })
  return {
    realises: arrays.relations
      .filter((row) => row.type === 'realises' && row.sourceId === platform.id)
      .map((row) => named(row.targetId)),
    ...(platform.parentId !== undefined ? { partOf: named(platform.parentId) } : {}),
  }
}

function connectionLine(model: Model, c: Relation, dated?: Map<string, Transition>) {
  const plan = dated?.get(c.id)
  // Where it landed, and what landed on it (ADR-0013). An application line
  // carries its refinements nested rather than as ids, because the question
  // an agent asks next is always what they say — and a landed line says which
  // interface it is part of, so the two directions read from either end.
  const landings = model.order.relations
    .map((id) => model.relations[id])
    .filter((row) => row.refines === c.id)
  return {
    id: c.id,
    // What the row means (ADR-0012 §5). The list is still called `connections`
    // because the tool that answers it is, and a tool name is published surface.
    type: c.type,
    sourceId: c.sourceId,
    source: nameOf(model, c.sourceId),
    targetId: c.targetId,
    target: nameOf(model, c.targetId),
    label: c.label,
    protocol: c.protocol,
    technology: c.technology,
    isBidirectional: c.isBidirectional,
    validFrom: c.validFrom,
    validUntil: c.validUntil,
    ...(c.refines !== undefined ? { refines: c.refines } : {}),
    ...(landings.length > 0
      ? {
        refinements: landings.map((row) => ({
          id: row.id,
          sourceId: row.sourceId,
          source: nameOf(model, row.sourceId),
          targetId: row.targetId,
          target: nameOf(model, row.targetId),
          protocol: row.protocol,
          technology: row.technology,
        })),
      }
      : {}),
    ...(plan ? { planId: plan.id, plan: transitionLabel(plan) } : {}),
  }
}

function diagramLine(diagram: Diagram, activeDiagramId: string) {
  return {
    id: diagram.id,
    name: diagram.name,
    kind: diagram.kind,
    applicationElementId: diagram.applicationElementId,
    elements: placedList(diagram).length,
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
    subjectId: adr.subjectId,
  }
}
