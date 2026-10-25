// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * `principles.list`, `topics.list` and `blocks.list` (ADR-0041, ADR-0042,
 * ADR-0043): the 3.8.0 records over the whole tree, answered off the tree
 * view's `records` — the same fold the pages read — with nothing open. Each
 * takes `scope` as a filter, as every tree-wide read does.
 */
import { percent, ranking } from '../model/evaluation'
import type { Principle, PrincipleGroup } from '../model/principle'
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

const recordsOf = (tree: TreeView | undefined): TreeRecords => tree?.records?.() ?? NONE

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

export function listPrinciples(tree: TreeView | undefined, rawArgs: unknown): AgentAnswer {
  const wrong = checkArguments(toolSpec('principles.list').inputSchema, withoutScope(rawArgs))
  if (wrong) return refused('agent.badArguments', wrong)
  const records = recordsOf(tree)
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
      return { scope: path, groups: kept.groups.map((one) => one.name), principles: live(kept.principles).map((one) => said(one, kept.groups)) }
    }),
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
