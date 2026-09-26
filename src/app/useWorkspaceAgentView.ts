// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent's view of this session (ADR-0007, ADR-0019): what the handler
 * needs from the session, and the two things only this screen knows — which
 * page is up, and how to show another. Handed up to the shell, which binds
 * the seam, and taken back when the workspace goes.
 */
import { useEffect, useMemo } from 'react'
import type { RefObject } from 'react'
import type { Translate } from '../i18n'
import type { Adr } from '../decisions/adr'
import type { DesignElement, Relation } from '../model'
import type { RendererView } from '../agent/renderer'
import type { Destination } from '../agent/screen'
import { coverageOf, unmappedFunctions } from '../business'
import { documentFindings, identityFindings } from '../projects/checks'
import { standInOf } from '../projects/library'
import { mayApplyPatch } from '../projects/mayEdit'
import { flattenScopes } from '../projects/scope'
import type { ScopeSummary } from '../projects/scope'
import type { ScopeIndex } from '../projects/scopeIndex'
import { ancestorScopes } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import { technologyRows } from '../projects/technologyRegister'
import type { WorkspaceAgentView } from './useAgentShell'
import type { MakeId } from './useDiagramActions'
import type { ProjectSaver } from './useDocumentSession'
import type { ModelSession } from './useModelSession'
import type { WorkspacePages } from './useWorkspacePages'

export function useWorkspaceAgentView(deps: {
  session: ModelSession
  scope: ScopePath
  /** Read through the ref so a rebuilt index reaches a request arriving between two renders. */
  indexRef: RefObject<ScopeIndex>
  rowsElsewhereRef: RefObject<Relation[]>
  scopes: ScopeSummary
  projects: ProjectSaver
  ancestorRecords: readonly Adr[]
  readOnly: boolean
  documentStatus: string
  renderer: RendererView
  save: () => Promise<void>
  pages: WorkspacePages
  showElement: (id: string) => void
  openDocumentation: (elementId?: string, diagramId?: string) => void
  makeId: MakeId
  today: () => string
  s: Translate
  onAgentSession: ((view: WorkspaceAgentView | undefined) => void) | undefined
}): void {
  const {
    session, scope, indexRef, rowsElsewhereRef, scopes, projects, ancestorRecords, readOnly, documentStatus,
    renderer, save, pages, showElement, openDocumentation, makeId, today, s, onAgentSession,
  } = deps
  const { page, openView, openDecisions, openRoadmap, closePages, openPlatformReport, openServiceReport } = pages
  const openPlan = pages.plans.openPlan
  const agentView = useMemo<WorkspaceAgentView>(() => ({
    ...throughSession(session),
    scopePath: () => scope,
    ancestorDecisions: () => ancestorRecords,
    /**
     * Why nothing may change right now: a source that is read-only, or a person
     * deciding which version of the project stands. An agent can do what a
     * person can (ADR-0011) and no more, so a source nobody may write to is a
     * source an agent may not write to either — and it is the one of the two
     * that does not go away by itself, so it is answered first.
     */
    blocked: () => {
      if (readOnly) return 'agent.readOnly'
      return documentStatus === 'conflict' ? 'agent.conflict' : undefined
    },
    makeId,
    today,
    translate: s,
    containerName: (name: string) => s('shell.containerDiagram', { name }),
    ...recordRules(session, scope, indexRef),
    renderer,
    save,
    page,
    show: showOn(pages, showElement, openDocumentation),
    tree: agentTree({ session, scope, indexRef, rowsElsewhereRef, scopes, projects }),
  }), [
    session, scope, ancestorRecords, documentStatus, readOnly, makeId, today, s, renderer, save, scopes, projects,
    page, openPlan, openView, openDecisions, openRoadmap, closePages, showElement, openDocumentation,
    openPlatformReport, openServiceReport, indexRef, rowsElsewhereRef,
  ])
  useEffect(() => {
    onAgentSession?.(agentView)
    return () => onAgentSession?.(undefined)
  }, [onAgentSession, agentView])
}

/**
 * Show a view or a page of the open scope, as the agent asks for one
 * (ADR-0019). The destination has been checked against the model already.
 */
function showOn(
  pages: WorkspacePages,
  showElement: (id: string) => void,
  openDocumentation: (elementId?: string, diagramId?: string) => void,
): WorkspaceAgentView['show'] {
  const { openView, openDecisions, openRoadmap, closePages, openPlatformReport, openServiceReport } = pages
  const openPlan = pages.plans.openPlan
  return (to: Destination & { scope: string }) => {
    switch (to.page) {
      case 'board': case 'sheet': case 'map': case 'technology':
        if (to.id !== undefined) openView(to.id)
        break
      case 'decisions': openDecisions(to.id); break
      case 'roadmap': openRoadmap(); break
      case 'plan': openRoadmap(); if (to.id !== undefined) openPlan(to.id); break
      case 'element': closePages(); if (to.id !== undefined) showElement(to.id); break
      case 'document': closePages(); openDocumentation(to.id); break
      case 'documentation': closePages(); openDocumentation(); break
      case 'platform': if (to.id !== undefined) openPlatformReport(to.id); break
      case 'service': if (to.id !== undefined) openServiceReport(to.id); break
      default: closePages()
    }
  }
}

/**
 * The tree, for the agent (ADR-0012, step 13). Through the ref, as
 * `ownedElsewhere` is, so a rebuilt index reaches a request arriving
 * between two renders. The findings are the tree's plus the open scope's
 * own document's, the way its page shows them; another scope's document
 * findings would be a load per call, and the identity findings about it
 * are in the same list already.
 */
function agentTree(at: {
  session: ModelSession
  scope: ScopePath
  indexRef: RefObject<ScopeIndex>
  rowsElsewhereRef: RefObject<Relation[]>
  scopes: ScopeSummary
  projects: ProjectSaver
}): WorkspaceAgentView['tree'] {
  const { session, scope, indexRef, rowsElsewhereRef, scopes, projects } = at
  return {
    scopes: () => flattenScopes(scopes).map((held) => ({
      path: held.path, name: held.name, ...(held.kind ? { kind: held.kind } : {}), views: held.diagrams,
    })),
    lookup: (id) => indexRef.current.lookup(id),
    register: () => indexRef.current.register(),
    technology: () => technologyRows(indexRef.current, identityFindings(indexRef.current)),
    initiativesBelow: (path) => indexRef.current.initiativesBelow(path),
    observationsBelow: (path) => indexRef.current.observationsBelow(path),
    rowsTo: (id, types) => indexRef.current.rowsTo(id, types).map((row) => row.relation),
    findings: () => {
      const model = session.current()
      const coverage = coverageOf(model.relations, rowsElsewhereRef.current)
      return [
        ...identityFindings(indexRef.current),
        ...documentFindings({
          scope, model, index: indexRef.current,
          business: {
            unmapped: unmappedFunctions(model.elements).map((held) => held.id),
            uncovered: model.elements
              .filter((held) => held.kind === 'function' && (coverage.get(held.id)?.coverage ?? 'uncovered') === 'uncovered')
              .map((held) => held.id),
          },
        }),
      ]
    },
    // A read for one call, the scope and its ancestors' records: what the
    // open scope was handed at open, done again for the one asked about.
    read: async (path) => {
      const load = projects.load
      if (!load) return undefined
      const held = await load(path)
      if (!held) return undefined
      const above = await Promise.all(ancestorScopes(path).map((one) => load(one)))
      return {
        model: held.model,
        activeDiagramId: held.activeDiagramId,
        ancestorDecisions: above.flatMap((one) => one?.model.decisions ?? []),
      }
    },
  }
}

/**
 * ADR-0012 §10, as the agent's half of the one rule: what the inspector greys
 * out is what an `element.update` is refused for, and the stand-in a
 * technology.use writes for a target another scope defines (ADR-0020) is the
 * same record the inspector's picker writes. Read through the ref so a rebuilt
 * index reaches a request arriving between two renders.
 */
function recordRules(
  session: ModelSession, scope: ScopePath, indexRef: RefObject<ScopeIndex>,
): Pick<WorkspaceAgentView, 'ownedElsewhere' | 'standInFor'> {
  return {
    ownedElsewhere: (id: string, patch: Partial<DesignElement>) => {
      const held = session.indexed().elements[id]
      const answer = mayApplyPatch(patch, id, scope, indexRef.current, held)
      return answer === true ? undefined : { owner: answer.owner }
    },
    standInFor: (id: string) => {
      const entry = indexRef.current.lookup(id)
      const ref = entry?.master ?? entry?.cachedRef
      return entry && ref !== undefined ? standInOf(entry, ref) : undefined
    },
  }
}

/** What the handler reads and writes through the session: the model, the one way in, and the log. */
function throughSession(session: ModelSession): Pick<
  WorkspaceAgentView,
  'indexed' | 'current' | 'activeDiagramId' | 'dispatch' | 'ids' | 'revision' | 'history' | 'undo' | 'images' | 'addImage'
> {
  return {
    indexed: session.indexed,
    current: session.current,
    activeDiagramId: session.currentActiveId,
    dispatch: session.dispatch,
    ids: session.ids,
    revision: session.revision,
    history: session.history,
    undo: session.undo,
    images: session.currentImages,
    addImage: (image) => session.setImageLibrary((library) => [...library, image]),
  }
}
