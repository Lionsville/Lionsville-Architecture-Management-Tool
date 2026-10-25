// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The open scope's principles (ADR-0041), in the workspace: the access every
 * principles screen reads, handed down once over the workspace so a reader
 * that cites one mounts its section and nothing else, and the page itself —
 * reached from its card on the scope's home or from a link, never the first
 * view, so its script arrives when it is first opened.
 */
import { useCallback, useMemo } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import type { PrinciplesPage as PrinciplesPageShape } from '../../principles/ui/PrinciplesPage'
import { PrinciplesProvider } from '../../principles/ui/PrinciplesContext'
import { flattenScopes } from '../../projects/scope'
import { scopeDisplayName } from '../../projects/scopeLabel'
import type { ScopePath } from '../../projects/scopePath'
import { lazyPart } from '../../widgets/lazyPart'
import { arrivingPage } from '../../widgets/Arriving'
import type { WorkspaceParts } from '../workspaceParts'
import { usePrinciplesAccess } from './usePrinciplesAccess'

const PrinciplesPage = lazyPart<ComponentProps<typeof PrinciplesPageShape>>(
  () => import('../../principles/ui/PrinciplesPage').then((held) => held.PrinciplesPage), { until: (props) => props.open, fallback: arrivingPage },
)

/** The open scope's principles, and those above it, for every screen under the workspace. */
export function ScopePrinciples({ parts, children }: { parts: WorkspaceParts; children: ReactNode }) {
  const { session, props, pages, readOnly } = parts
  const scope = props.project.path
  const { scopes, groupName } = props.tree
  const listed = useMemo(() => flattenScopes(scopes), [scopes])
  const scopeLabel = useCallback((path: ScopePath) => scopeDisplayName(path, listed, groupName), [listed, groupName])
  const { onOpenScope } = props.navigation
  const access = usePrinciplesAccess({
    session: { model: session.model, indexed: session.indexed, dispatch: session.dispatch, readOnly },
    scope,
    index: props.tree.index,
    scopeLabel,
    makeId: props.shell.makeId,
    today: parts.today,
    openHere: pages.openPrinciples,
    openDecision: pages.openDecisions,
    t: props.shell.s,
    ...(onOpenScope ? { openThere: (path: ScopePath, id: string) => onOpenScope(path, { page: 'principles', id }) } : {}),
  })
  return <PrinciplesProvider value={access}>{children}</PrinciplesProvider>
}

/** The page, up while the workspace says so, on the principle it was asked to open on. */
export function PrinciplesPages({ parts }: { parts: WorkspaceParts }) {
  const { pages, props, pageChrome } = parts
  const page = pages.principlesPage
  return (
    <PrinciplesPage
      open={page.open}
      scope={props.project.path}
      {...(page.id !== undefined ? { select: page.id } : {})}
      nonce={page.nonce}
      onClose={() => { pages.closePrinciples(); pages.leaveIfNothingToDraw() }}
      windowChrome={pageChrome}
    />
  )
}
