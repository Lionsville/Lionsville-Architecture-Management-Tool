// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * `principles.list`, `topics.list` and `blocks.list` (ADR-0041, ADR-0042,
 * ADR-0043): the 3.8.0 records over the whole tree, answered off the tree
 * view's `records` — the same fold the pages read — with nothing open. Each
 * takes `scope` as a filter, as every tree-wide read does.
 */
import { percent, ranking } from '../model/evaluation'
import type { HostModel } from '../model/hostModel'
import { principleUse } from '../principles/principle'
import { suggestPrinciples } from '../principles/suggest'
import type { Adr } from '../model/adr'
import type { Citation } from '../model/citable'
import type { Principle, PrincipleGroup, PrincipleRef } from '../model/principle'
import type { TreeRecords } from '../model/treeRecords'
import type { DesignElement } from '../model/types'
import type { AgentAnswer } from './tools'
import { checkArguments, json, refused, toolSpec } from './tools'
import type { TreeView } from './tree'
import { scopeAsked, withoutScope } from './tree'

type Args = Record<string, unknown>

/** Nothing to give: a shell built before these records lends none, and says so rather than refusing. */
const NONE: TreeRecords = {
  principleScopes: () => [], principlesAt: () => ({ principles: [], groups: [] }), inForce: () => [],
  topics: () => [], blocks: () => [], evaluations: () => [], citations: () => [],
}

/** The open scope, as a read lays it over the index: what was just written reads back. */
export type OpenRecords = { readonly path: string; readonly current: Pick<HostModel, 'principles' | 'principleGroups' | 'citations' | 'decisions'> }

/** The tree's records, the open scope's principles and citations as its session holds them. */
function recordsOf(tree: TreeView | undefined, open?: OpenRecords): TreeRecords {
  const held = tree?.records?.() ?? NONE
  if (!open) return held
  const principles = open.current.principles ?? []
  const below = (path: string) => path === open.path || open.path === '' || path.startsWith(`${open.path}/`)
  return {
    ...held,
    principleScopes: () => [...new Set([...held.principleScopes(), ...(principles.length || open.current.principleGroups?.length ? [open.path] : [])])],
    principlesAt: (path) => (path === open.path ? { principles, groups: open.current.principleGroups ?? [] } : held.principlesAt(path)),
    inForce: (path) => {
      const others = held.inForce(path).filter((one) => one.scope !== open.path)
      const via = held.inForce(path).find((one) => one.scope === open.path)?.via ?? (path === open.path ? 'here' : below(path) ? 'above' : undefined)
      return via ? [...others, ...principles.filter((one) => one.mergedInto === undefined).map((principle) => ({ scope: open.path, via, principle }))] : others
    },
    citations: () => [
      ...held.citations().filter((one) => one.scope !== open.path),
      ...(open.current.citations ?? []).map((citation) => ({ scope: open.path, citation })),
    ],
  }
}

/** A principle as an answer says it: its aspects numbered under it, its groups by name. */
function said(principle: Principle, groups: readonly PrincipleGroup[]) {
  return {
    id: principle.id, number: principle.number, title: principle.title, statement: principle.statement,
    status: principle.status, regime: principle.regime,
    ...(principle.aspects.length ? { aspects: principle.aspects.map((one) => ({ number: one.number, text: one.text })) } : {}),
    ...(principle.groups?.length ? { groups: principle.groups.map((id) => groups.find((one) => one.id === id)?.name ?? id) } : {}),
    ...(principle.rationale ? { rationale: principle.rationale } : {}),
    ...(principle.implications ? { implications: principle.implications } : {}),
  }
}

export function listPrinciples(tree: TreeView | undefined, rawArgs: unknown, open?: OpenRecords): AgentAnswer {
  const wrong = checkArguments(toolSpec('principles.list').inputSchema, withoutScope(rawArgs))
  if (wrong) return refused('agent.badArguments', wrong)
  const records = recordsOf(tree, open)
  const scope = scopeAsked(rawArgs)
  const live = (list: readonly Principle[]) => list.filter((one) => one.mergedInto === undefined)
  if (scope !== undefined && (rawArgs as Args).own !== true) {
    return json({
      scope,
      principles: records.inForce(scope).map((one) => ({ scope: one.scope, via: one.via, ...said(one.principle, records.principlesAt(one.scope).groups) })),
    })
  }
  const scopes = scope !== undefined ? [scope] : records.principleScopes()
  return json({
    scopes: scopes.map((path) => {
      const kept = records.principlesAt(path)
      return { scope: path, groups: kept.groups, principles: live(kept.principles).map((one) => said(one, kept.groups)) }
    }),
  })
}

/** One principle whole, with how it is used: `scope` names where it is kept, and the open scope is the default. */
export function readPrinciple(tree: TreeView | undefined, rawArgs: unknown, open?: OpenRecords): AgentAnswer {
  const wrong = checkArguments(toolSpec('principle.read').inputSchema, withoutScope(rawArgs))
  if (wrong) return refused('agent.badArguments', wrong)
  const records = recordsOf(tree, open)
  const id = (rawArgs as Args).id as string
  const asked = scopeAsked(rawArgs)
  const scopes = asked !== undefined ? [asked] : [...(open ? [open.path] : []), ...records.principleScopes()]
  const scope = scopes.find((path) => records.principlesAt(path).principles.some((one) => one.id === id))
  if (scope === undefined) return refused('agent.unknownId', `principle ${id}`)
  const kept = records.principlesAt(scope)
  const principle = kept.principles.find((one) => one.id === id)!
  const citations = records.citations()
    .filter((one) => one.citation.principle.scope === scope && one.citation.principle.id === id)
    .map(({ scope: by, citation }) => ({ ...citation, scope: by }))
  return json({
    scope, ...said(principle, kept.groups), lastAspect: principle.lastAspect,
    aspects: principle.aspects,
    ...(principle.keywords?.length ? { keywords: principle.keywords } : {}),
    ...(principle.question ? { question: principle.question } : {}),
    ...(principle.acceptedOn ? { acceptedOn: principle.acceptedOn } : {}),
    ...(principle.relations?.length ? { relations: principle.relations } : {}),
    ...(principle.sharpened?.length ? { sharpened: principle.sharpened } : {}),
    ...(principle.mergedInto ? { mergedInto: principle.mergedInto } : {}),
    use: principleUse({ scope, id }, citations as never),
    citations,
  })
}

/** What other records about the same subject cite (§9): a decision about an element and the element read each other's. */
function nearby(about: { kind: string; id: string }, citations: readonly Citation[], decisions: readonly Pick<Adr, 'id' | 'subjectId'>[]): PrincipleRef[] {
  const subjectOf = (record: { kind: string; id: string }) => (record.kind === 'element' ? record.id : record.kind === 'decision' ? decisions.find((one) => one.id === record.id)?.subjectId : undefined)
  const subject = subjectOf(about)
  if (subject === undefined) return []
  return citations.filter((one) => !(one.about.kind === about.kind && one.about.id === about.id) && subjectOf(one.about) === subject).map((one) => one.principle)
}

/** What may apply to what is being written (§9): the one function the page's *May apply* reads. */
export function suggestPrinciplesFor(tree: TreeView | undefined, rawArgs: unknown, open?: OpenRecords): AgentAnswer {
  const wrong = checkArguments(toolSpec('principles.suggest').inputSchema, withoutScope(rawArgs))
  if (wrong) return refused('agent.badArguments', wrong)
  const records = recordsOf(tree, open)
  const scope = scopeAsked(rawArgs) ?? open?.path
  if (scope === undefined) return refused('agent.badArguments', 'nothing is open: say which scope with scope')
  const args = rawArgs as Args
  const about = args.about as { kind: string; id: string } | undefined
  const here = records.citations().filter((one) => one.scope === scope).map((one) => one.citation)
  const inForce = records.inForce(scope).map((one) => ({ scope: one.scope, principle: one.principle, groups: records.principlesAt(one.scope).groups }))
  const found = suggestPrinciples({
    text: args.text as string,
    inForce,
    alreadyCited: about ? here.filter((one) => one.about.kind === about.kind && one.about.id === about.id).map((one) => one.principle) : [],
    citedNearby: about ? nearby(about, here, open?.path === scope ? open.current.decisions ?? [] : []) : [],
    ...(typeof args.limit === 'number' ? { limit: args.limit } : {}),
  })
  return json({
    scope,
    suggestions: found.map((one) => ({
      scope: one.ref.scope, id: one.ref.id, number: one.principle.number, title: one.principle.title, regime: one.principle.regime,
      ...(one.aspect ? { aspect: one.aspect.number } : {}), matched: one.matched, why: one.why,
    })),
  })
}

export function listTopics(tree: TreeView | undefined, rawArgs: unknown): AgentAnswer {
  const wrong = checkArguments(toolSpec('topics.list').inputSchema, withoutScope(rawArgs))
  if (wrong) return refused('agent.badArguments', wrong)
  const records = recordsOf(tree)
  const scope = scopeAsked(rawArgs)
  const topics = records.topics().filter((one) => scope === undefined || one.relevantTo.includes(scope))
  return json({ topics: topics.map((one) => ({ ...one, links: [...one.links] })) })
}

/** A block as an answer says it: requirements and catalogue, the words a person wrote. */
function blockSaid(block: DesignElement) {
  return {
    id: block.id, name: block.name,
    ...(block.description ? { description: block.description } : {}),
    capabilities: (block.capabilities ?? []).map((one) => ({ id: one.id, text: one.text, ...(one.must ? { must: true } : {}) })),
    contexts: (block.contexts ?? []).map((one) => ({ id: one.id, name: one.name, needs: one.needs })),
    solutions: (block.sbbs ?? []).map((one) => ({
      id: one.id, name: one.name, sort: one.sort, status: one.status,
      ...(one.supplier ? { supplier: one.supplier } : {}), ...(one.elements?.length ? { elements: one.elements } : {}),
    })),
  }
}

export function listBlocks(tree: TreeView | undefined, rawArgs: unknown): AgentAnswer {
  const wrong = checkArguments(toolSpec('blocks.list').inputSchema, withoutScope(rawArgs))
  if (wrong) return refused('agent.badArguments', wrong)
  const records = recordsOf(tree)
  const scope = scopeAsked(rawArgs)
  const id = (rawArgs as Args | undefined)?.id as string | undefined
  const evaluations = records.evaluations()
  const blocks = records.blocks()
    .filter((one) => id === undefined || one.block.id === id)
    .filter((one) => scope === undefined || one.scope === scope
      || evaluations.some((held) => held.scope === scope && held.evaluation.block.id === one.block.id))
  if (id !== undefined && blocks.length === 0) return refused('agent.unknownId', `building block ${id}`)
  return json({
    blocks: blocks.map(({ scope: keptIn, block }) => ({
      scope: keptIn,
      ...blockSaid(block),
      evaluations: evaluations
        .filter((held) => held.evaluation.block.scope === keptIn && held.evaluation.block.id === block.id)
        .map(({ scope: by, evaluation }) => ({
          scope: by, contexts: evaluation.contexts,
          options: ranking(block, evaluation).map(({ sbb, fit }) => ({
            solution: sbb.id, name: sbb.name,
            ...(fit.fit !== undefined ? { fit: percent(fit.fit) } : {}),
            ...(fit.failsMust.length ? { failsMust: fit.failsMust } : {}),
          })),
          ...(evaluation.chosen ? { chosen: evaluation.chosen } : {}),
          ...(evaluation.decidedBy ? { decidedBy: evaluation.decidedBy } : {}),
        })),
    })),
  })
}
