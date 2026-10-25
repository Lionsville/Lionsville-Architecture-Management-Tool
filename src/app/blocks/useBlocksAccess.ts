// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The building blocks, wired (ADR-0043): read off the tree's index — every
 * block where it is kept, every scope's evaluation of one — and written as
 * steps in the scope that keeps the record, under its rights
 * (`units/writeIn.ts`): a block's requirements and catalogue where the block
 * is kept, an evaluation and the decision it becomes where the scope that is
 * choosing is. Nothing is open on a home, so there is no session to go
 * through; the tree is read again once a step lands.
 */
import { useMemo, useRef } from 'react'
import type { Translate } from '../../i18n'
import { blockDecision, supportsCopied } from '../../decisions/blockDecision'
import { replacement } from '../../model/commands'
import type { Command } from '../../model/commands'
import { evaluationId, startedEvaluation } from '../../model/evaluation'
import type { Evaluation } from '../../model/evaluation'
import { formatAspectNumber, formatPrincipleNumber } from '../../model/principle'
import type { DesignElement } from '../../model/types'
import { flattenScopes } from '../../projects/scope'
import type { ScopeSnapshot, ScopeSummary } from '../../projects/scope'
import { readScope } from '../../projects/scopeAccess'
import type { ScopeIndex } from '../../projects/scopeIndex'
import { scopeDisplayName } from '../../projects/scopeLabel'
import { ancestorScopes, isWithinScope, ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { choosableScopes, topicsInForce } from '../../projects/topics'
import type { BlocksAccess, EvaluationRow } from '../../blocks/ui/BlocksContext'
import type { InitialPage } from '../App'
import type { BelowScopes } from '../useChangeBelow'
import { refusalKey, writeIn } from '../units/writeIn'

export type BlocksDeps = {
  tree: ScopeSummary
  index: Pick<ScopeIndex, 'buildingBlocks' | 'evaluations' | 'principlesAt' | 'citations' | 'entries' | 'lookup'>
  scopes: BelowScopes
  writable: (path: ScopePath) => boolean
  /** The tree read again, and the index with it, once a step lands. */
  written: () => void
  notify: (message: string, severity: 'success' | 'error' | 'warning') => void
  today: string
  makeId: (prefix: string) => string
  /** Open a scope on a page, as the cards do. */
  open: (path: ScopePath, page?: InitialPage) => void
  /** A block's page over the home, on a scope's evaluation where one is named. */
  openBlock: (block: string, evaluation?: ScopePath) => void
  s: Translate
}

/** A change to one scope, worked out from what it holds: landed and the tree read again, or its refusal said. */
async function land(deps: BlocksDeps, path: ScopePath, change: (held: ScopeSnapshot) => readonly Command[] | undefined): Promise<boolean> {
  const written = await writeIn(deps, path, change)
  if (written.ok) deps.written()
  const key = refusalKey(written)
  if (key) deps.notify(deps.s(key), 'error')
  return written.ok
}

/** An evaluation without the keys said empty, as the record keeps it. */
function kept(evaluation: Evaluation): Evaluation {
  return Object.fromEntries(Object.entries(evaluation).filter(([, value]) => value !== undefined)) as Evaluation
}

type Reads = Pick<BlocksAccess, 'blocks' | 'block' | 'evaluationsOf' | 'blocksAt' | 'scopeLabel' | 'aspectLabel' | 'citationsOf' | 'aspectChoices' | 'elementName' | 'elementChoices' | 'placeChoices' | 'evaluateChoices'>

function reads(deps: BlocksDeps): Reads {
  const scopes = flattenScopes(deps.tree)
  const rootName = deps.tree.name.trim() || deps.s('common.organisation')
  const scopeLabel = (path: ScopePath) => (path === ROOT_SCOPE ? rootName : scopeDisplayName(path, scopes, rootName))
  const blocks = deps.index.buildingBlocks()
  const byId = new Map(blocks.map((one) => [one.block.id, one]))
  const evaluations = deps.index.evaluations()
  const evaluationsOf = (block: string): EvaluationRow[] => evaluations.filter((one) => one.evaluation.block.id === block)
  const principleOf = (scope: ScopePath, id: string) => deps.index.principlesAt(scope).principles.find((one) => one.id === id)
  return {
    blocks: () => blocks,
    block: (id) => byId.get(id),
    evaluationsOf,
    blocksAt: (path) => {
      const kept = blocks.filter((one) => isWithinScope(one.scope, path))
      const evaluated = blocks.filter((one) => !kept.includes(one) && evaluationsOf(one.block.id).some((held) => isWithinScope(held.scope, path)))
      return { kept, evaluated }
    },
    scopeLabel,
    aspectLabel: (aspect) => {
      const principle = principleOf(aspect.scope, aspect.id)
      return principle ? { label: formatAspectNumber(principle.number, aspect.number), title: principle.title } : undefined
    },
    citationsOf: (block) => deps.index.citations()
      .filter(({ citation }) => citation.about.kind === 'element' && citation.about.id === block)
      .map(({ citation }) => {
        const principle = principleOf(citation.principle.scope, citation.principle.id)
        return { label: principle ? `${formatPrincipleNumber(principle.number)} ${principle.title}` : citation.principle.id, stance: citation.stance }
      }),
    aspectChoices: (scope) => [...new Set([scope, ...ancestorScopes(scope), ...topicsInForce(scope, scopes, deps.today)])]
      .flatMap((at) => deps.index.principlesAt(at).principles.filter((one) => one.mergedInto === undefined && one.status !== 'retired').flatMap((principle) => principle.aspects.map((aspect) => ({
        aspect: { scope: at, id: principle.id, number: aspect.number }, label: `${formatAspectNumber(principle.number, aspect.number)} ${aspect.text}`,
      })))),
    elementName: (id) => deps.index.lookup(id)?.name ?? id,
    elementChoices: () => deps.index.entries()
      .filter((one) => one.kind === 'application' || one.kind === 'platform' || one.kind === 'platformService')
      .map((one) => ({ id: one.id, name: one.name })).sort((a, b) => a.name.localeCompare(b.name)),
    placeChoices: () => choosableScopes(scopes, scopeLabel, true),
    evaluateChoices: (block) => {
      const taken = new Set(evaluationsOf(block).map((one) => one.scope))
      return choosableScopes(scopes, scopeLabel, false).filter((one) => !taken.has(one.path))
    },
  }
}

export function blocksAccess(deps: BlocksDeps, version: number): BlocksAccess {
  const read = reads(deps)
  return {
    version,
    ...read,
    mayWrite: deps.writable,
    create: async (scope, name) => {
      const id = deps.makeId('blk')
      const element: DesignElement = { id, kind: 'buildingBlock', name: name.trim(), lifecycle: 'live', isManaged: false, aspects: {} }
      return await land(deps, scope, () => [{ type: 'element.create', element }]) ? id : undefined
    },
    document: async (block) => {
      const row = read.block(block)
      if (!row) return undefined
      try {
        const held = await readScope(deps.scopes, row.scope)
        return held?.model.elements.find((one) => one.id === block)?.description ?? ''
      } catch {
        deps.notify(deps.s('blocks.documentUnread'), 'error')
        return undefined
      }
    },
    update: (block, patch) => {
      const row = read.block(block)
      if (!row) return
      void land(deps, row.scope, (held) => {
        const element = held.model.elements.find((one) => one.id === block)
        return element ? [{ type: 'element.update', id: block, patch: typeof patch === 'function' ? patch(element) : patch }] : undefined
      })
    },
    evaluate: async (block, scope, contexts, copyFrom) => {
      const row = read.block(block)
      if (!row) return false
      const copied = copyFrom === undefined ? undefined : read.evaluationsOf(block).find((one) => one.scope === copyFrom)?.evaluation
      const evaluation = startedEvaluation({ scope: row.scope, id: block }, contexts, copied)
      return land(deps, scope, () => [{ type: 'evaluation.add', evaluation }])
    },
    updateEvaluation: (scope, next) => {
      void land(deps, scope, (held) => {
        const before = held.model.evaluations?.find((one) => one.id === next.id)
        return before ? [{ type: 'evaluation.update', id: next.id, patch: replacement(before, kept(next)) }] : undefined
      })
    },
    removeEvaluation: (scope, id) => { void land(deps, scope, () => [{ type: 'evaluation.remove', id }]) },
    propose: async (scope, block, option) => {
      const row = read.block(block)
      const evaluation = row ? read.evaluationsOf(block).find((one) => one.scope === scope)?.evaluation : undefined
      if (!row || !evaluation || evaluation.id !== evaluationId(evaluation.block)) return undefined
      let made: string | undefined
      const landed = await land(deps, scope, (held) => {
        const decision = blockDecision({
          block: row.block, evaluation, option, id: deps.makeId('adr'), date: deps.today, s: deps.s,
          scope: {
            path: held.path, name: read.scopeLabel(scope), decisions: held.model.decisions ?? [], keepsBlock: held.model.elements.some((one) => one.id === row.block.id),
            ...(held.revision ? { revision: held.revision } : {}),
          },
        })
        made = decision.id
        return [{ type: 'decision.add', decision }, ...supportsCopied(deps.index.citations(), { scope: row.scope, id: row.block.id }, decision.id, deps.makeId, deps.today)]
      })
      return landed ? made : undefined
    },
    openDecision: (scope, id) => deps.open(scope, { page: 'decisions', id }),
    openBlock: deps.openBlock,
    makeId: deps.makeId,
    today: () => deps.today,
  }
}

/** The access, made again when the tree or the index is read again; the rest read through a ref. */
export function useBlocksAccess(deps: BlocksDeps): BlocksAccess {
  const latest = useRef(deps)
  latest.current = deps
  const version = useRef(0)
  const { tree, index, today } = deps
  return useMemo(() => {
    version.current += 1
    return blocksAccess({
      ...latest.current,
      written: () => latest.current.written(),
      open: (path, page) => latest.current.open(path, page),
      openBlock: (block, evaluation) => latest.current.openBlock(block, evaluation),
    }, version.current)
  }, [tree, index, today])
}
