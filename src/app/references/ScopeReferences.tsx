// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a document in the open scope may refer to, and how each `ref` in it
 * is drawn (ADR-0043 §9–§10): the catalogue off the scope's session, the
 * principles in force here and the tree's index, the open scope's own
 * blocks and evaluations as its session holds them; and the drawings, read
 * the same way each time a document is drawn. Under the principles, which it
 * reads.
 */
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { ReferencesProvider } from '../../documentation/ui/References'
import type { ReferencesAccess } from '../../documentation/ui/References'
import type { Evaluation } from '../../model/evaluation'
import { usePrinciples } from '../../principles/ui/PrinciplesContext'
import { flattenScopes } from '../../projects/scope'
import { scopeDisplayName } from '../../projects/scopeLabel'
import type { KeptBlock, KeptEvaluation } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import type { WorkspaceParts } from '../workspaceParts'
import { drawRef } from './RefDrawings'
import type { RefReads } from './RefDrawings'
import { referablesIn } from '../../search/referables'

/** How many of an evaluation's entries are read back for the one a pin names, newest first. */
const PINNED_LOOKBACK = 20

/** The tree's blocks and evaluations with the open scope's own as its session holds them now. */
function overlaid(parts: WorkspaceParts): { blocks: KeptBlock[]; evaluations: KeptEvaluation[] } {
  const here = parts.props.project.path
  const { index } = parts.props.tree
  const model = parts.session.model
  return {
    blocks: [
      ...index.buildingBlocks().filter((one) => one.scope !== here),
      ...model.elements.filter((one) => one.kind === 'buildingBlock' && one.ref === undefined).map((block) => ({ scope: here, block })),
    ],
    evaluations: [
      ...index.evaluations().filter((one) => one.scope !== here),
      ...(model.evaluations ?? []).map((evaluation) => ({ scope: here, evaluation })),
    ],
  }
}

export function ScopeReferences({ parts, children }: { parts: WorkspaceParts; children: ReactNode }) {
  const principles = usePrinciples()
  const { t: s } = useStrings()
  const { session, props, pages } = parts
  const here = props.project.path
  const { scopes: tree, groupName } = props.tree
  const { onOpenScope, onOpenBlock } = props.navigation
  const repositories = props.source.repositories
  const history = props.snapshots.history
  const listed = useMemo(() => flattenScopes(tree), [tree])
  const access = useMemo<ReferencesAccess>(() => {
    const scopeLabel = (path: ScopePath) => scopeDisplayName(path, listed, groupName)
    const { blocks, evaluations } = overlaid(parts)
    const stoodAt = async (scope: ScopePath, evaluation: Evaluation, at: string): Promise<Evaluation | 'changed' | 'same'> => {
      const id = listed.find((one) => one.path === scope)?.id
      if (id === undefined) return 'changed'
      if ((await repositories.scopes.state(id))?.revision === at) return 'same'
      if (!history) return 'changed'
      const page = await history.entries({ scopes: [id], record: { kind: 'evaluation', id: evaluation.id }, limit: PINNED_LOOKBACK })
      for (const entry of page.entries) {
        const state = await history.stateAt(id, entry.id)
        if (state?.revision === at) return state.model.evaluations?.find((one) => one.id === evaluation.id) ?? 'changed'
      }
      return 'changed'
    }
    const reads: RefReads = {
      principle: (scope, id) => principles?.own(scope).principles.find((one) => one.id === id),
      openPrinciple: (scope, id) => (scope === here ? pages.openPrinciples(id) : onOpenScope?.(scope, { page: 'principles', id })),
      block: (id) => blocks.find((one) => one.block.id === id),
      evaluation: (block, scope) => evaluations.find((one) => one.scope === scope && one.evaluation.block.id === block)?.evaluation,
      openBlock: (block, scope) => onOpenBlock?.(block, scope),
      stoodAt,
      records: {
        decision: (id) => session.model.decisions?.find((one) => one.id === id),
        openDecision: (id) => pages.openDecisions(id),
        observation: (id) => session.model.observations?.find((one) => one.id === id),
        openObservation: (id) => pages.openObservations(id),
      },
    }
    return {
      referables: () => referablesIn({
        model: session.model,
        principles: principles?.inForce(here).map((one) => ({ scope: one.scope, principle: one.principle })) ?? [],
        blocks, evaluations, scopeLabel, s,
      }),
      draw: (fields) => drawRef(fields, reads, s, scopeLabel),
    }
    // The parts are read through when drawn; these are what says a drawing is stale.
  }, [session.model, principles, props.tree.index, listed, groupName, here, s, repositories, history, onOpenScope, onOpenBlock, pages])
  return <ReferencesProvider value={access}>{children}</ReferencesProvider>
}
