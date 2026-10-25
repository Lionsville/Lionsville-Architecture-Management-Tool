// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the open scope's inspector says about building blocks (ADR-0043 §8),
 * off the tree's index: the choices an element is the solution of, and the
 * way to a block's page, which is the organisation's and over its home.
 */
import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { BlockFactsProvider } from '../../blocks/ui/BlockFacts'
import type { BlockFactsAccess } from '../../blocks/ui/BlockFacts'
import { solutionsChosenAs } from '../../projects/chosenSolutions'
import { flattenScopes } from '../../projects/scope'
import { scopeDisplayName } from '../../projects/scopeLabel'
import type { ScopePath } from '../../projects/scopePath'
import type { WorkspaceParts } from '../workspaceParts'

export function ScopeBlockFacts({ parts, children }: { parts: WorkspaceParts; children: ReactNode }) {
  const { index, scopes, groupName } = parts.props.tree
  const { onOpenBlock } = parts.props.navigation
  const listed = useMemo(() => flattenScopes(scopes), [scopes])
  const scopeName = useCallback((path: ScopePath) => scopeDisplayName(path, listed, groupName), [listed, groupName])
  const facts = useMemo<BlockFactsAccess | undefined>(() => (onOpenBlock ? {
    chosenAs: (element) => solutionsChosenAs(index, element).map((one) => ({
      block: one.block.id, blockName: one.block.name, sbb: one.sbb, scope: one.scope, scopeName: scopeName(one.scope),
    })),
    openBlock: onOpenBlock,
  } : undefined), [index, scopeName, onOpenBlock])
  return <BlockFactsProvider value={facts}>{children}</BlockFactsProvider>
}
