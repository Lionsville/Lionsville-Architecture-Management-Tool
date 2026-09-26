// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The workspace's requests INTO the editor: show this element, open the
 * documentation on that one.
 *
 * Each carries a nonce, because "show this one" asked twice is two requests
 * and a prop that did not change is none. Held above everything else in the
 * workspace, because the agent's renderer view points with the first and the
 * sheet's coverage links land on the second when no board draws the element
 * at all.
 */
import { useCallback, useState } from 'react'
import type { RefObject } from 'react'
import type { Translate } from '../i18n'
import type { ScopeIndex } from '../projects/scopeIndex'
import type { ScopePath } from '../projects/scopePath'
import type { InitialPage } from './App'
import type { ModelSession } from './useModelSession'
import type { Notify } from './useToasts'

export type FocusRequest = { id: string; nonce: number }
export type DocumentationRequest = { elementId?: string; diagramId?: string; nonce: number }

export type WorkspaceRequests = {
  focus: FocusRequest | undefined
  documentation: DocumentationRequest | undefined
  /** Select an element on the board that draws it. */
  focusElement: (id: string) => void
  /** `diagramId` is the view the reader came from — a sheet, whose neighbours the page then lists. */
  openDocumentation: (elementId?: string, diagramId?: string) => void
}

export function useWorkspaceRequests(deps: {
  session: ModelSession
  scope: ScopePath
  /** The index by reference: it is rebuilt under a live session (ADR-0012 §2). */
  indexRef: RefObject<ScopeIndex>
  onOpenScope: ((path: ScopePath, page?: InitialPage) => void) | undefined
  notify: Notify
  s: Translate
}): WorkspaceRequests {
  const { session, scope, indexRef, onOpenScope, notify, s } = deps
  const [focus, setFocus] = useState<FocusRequest | undefined>(undefined)
  const focusElement = useCallback((id: string) => {
    setFocus((prev) => ({ id, nonce: (prev?.nonce ?? 0) + 1 }))
  }, [])
  const [documentation, setDocumentation] = useState<DocumentationRequest | undefined>(undefined)
  const openDocumentation = useCallback((elementId?: string, diagramId?: string) => {
    const model = session.current()
    if (model.elements.length === 0) { notify(s('shell.noElements'), 'info'); return }
    // A stand-in's page is the owner's page: the description is maintained
    // where the thing is defined (ADR-0012 §3), so the page opens there.
    const held = elementId !== undefined ? model.elements.find((element) => element.id === elementId) : undefined
    const master = held?.ref !== undefined ? indexRef.current.lookup(held.id)?.master : undefined
    if (elementId !== undefined && master !== undefined && master !== scope && onOpenScope) {
      onOpenScope(master, { page: 'document', id: elementId })
      return
    }
    setDocumentation((prev) => ({ elementId, diagramId, nonce: (prev?.nonce ?? 0) + 1 }))
  }, [session, notify, s, scope, onOpenScope, indexRef])
  return { focus, documentation, focusElement, openDocumentation }
}
