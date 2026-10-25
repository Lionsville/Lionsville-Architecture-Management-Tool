// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The catalogue a document in a scope may refer to (ADR-0043 §9): the
 * scope's views and elements, the principles in force there and each of
 * their aspects, every building block's requirements and every scope's
 * evaluation of one, and the scope's decisions and observations — each with
 * the markdown that refers to it (`documentation/references.ts`).
 */
import type { Translate } from '../../i18n'
import { STATUS_LABEL } from '../../decisions/adrScope'
import { formatAdrNumber } from '../../decisions/adr'
import { formatObservationNumber } from '../../observations/observation'
import type { HostModel } from '../../model/hostModel'
import { kindLabel } from '../../model/kinds'
import { formatAspectNumber, formatPrincipleNumber } from '../../model/principle'
import type { Principle } from '../../model/principle'
import { principleRef, refFence } from '../../documentation/references'
import type { Referable } from '../../documentation/references'
import type { KeptBlock, KeptEvaluation } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'

export type ReferablesFrom = {
  /** The open scope's model. */
  model: Pick<HostModel, 'diagrams' | 'elements' | 'decisions' | 'observations'>
  /** The principles in force here, each with the scope that keeps it. */
  principles: readonly { scope: ScopePath; principle: Principle }[]
  blocks: readonly KeptBlock[]
  evaluations: readonly KeptEvaluation[]
  scopeLabel: (path: ScopePath) => string
  s: Translate
}

function principleReferables(from: ReferablesFrom): Referable[] {
  return from.principles.filter((one) => one.principle.mergedInto === undefined).flatMap(({ scope, principle }) => {
    const ref = principleRef(scope, principle.id)
    const detail = from.scopeLabel(scope)
    return [
      { kind: 'principle' as const, key: ref, label: `${formatPrincipleNumber(principle.number)} ${principle.title}`, detail, markdown: refFence([['principle', ref]]), block: true },
      ...principle.aspects.map((aspect) => ({
        kind: 'principle' as const, key: `${ref}#${aspect.number}`, label: `${formatAspectNumber(principle.number, aspect.number)} ${aspect.text}`, detail,
        markdown: refFence([['principle', ref], ['aspect', String(aspect.number)]]), block: true,
      })),
    ]
  })
}

function evaluationReferables(from: ReferablesFrom): Referable[] {
  const { s } = from
  const names = new Map(from.blocks.map((one) => [one.block.id, one.block.name]))
  return [
    ...from.blocks.map(({ block, scope }) => ({
      kind: 'evaluation' as const, key: block.id, label: block.name, detail: s('refs.requirementsIn', { scope: from.scopeLabel(scope) }),
      markdown: refFence([['evaluation', block.id]]), block: true,
    })),
    ...from.evaluations.filter((one) => names.has(one.evaluation.block.id)).map(({ scope, evaluation }) => ({
      kind: 'evaluation' as const, key: `${evaluation.block.id}@${scope}`,
      label: s('refs.evaluationIn', { block: names.get(evaluation.block.id)!, scope: from.scopeLabel(scope) }),
      markdown: refFence([['evaluation', evaluation.block.id], ['scope', scope]]), block: true,
    })),
  ]
}

/** Everything a document here may refer to, in the order the catalogue keeps. */
export function referablesIn(from: ReferablesFrom): Referable[] {
  const { model, s } = from
  return [
    ...model.diagrams.map((diagram): Referable => ({ kind: 'view', key: diagram.id, label: diagram.name, markdown: `![${diagram.name}](view:${diagram.id})`, block: true })),
    ...model.elements.map((element): Referable => ({ kind: 'element', key: element.id, label: element.name, detail: kindLabel(element.kind, s), markdown: `[[${element.name}]]`, block: false })),
    ...principleReferables(from),
    ...evaluationReferables(from),
    ...(model.decisions ?? []).map((decision): Referable => ({
      kind: 'decision', key: decision.id, label: `${formatAdrNumber(decision.number)} ${decision.title}`, detail: s(STATUS_LABEL[decision.status]),
      markdown: refFence([['decision', decision.id]]), block: true,
    })),
    ...(model.observations ?? []).map((observation): Referable => ({
      kind: 'observation', key: observation.id, label: `${formatObservationNumber(observation.number)} ${observation.title}`,
      markdown: refFence([['observation', observation.id]]), block: true,
    })),
  ]
}
