// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Who answers for each record on this board (ADR-0012 §10).
 *
 * The whole of federation, as far as the editor is concerned: one question,
 * asked per element. The editor may not know a scope tree exists, so the
 * list of fields and the words come from `projects/` and the way out comes
 * from the shell — which is the one thing that knows how to open a scope.
 */
import { useMemo } from 'react'
import type { Translate } from '../i18n'
import type { EditorOwnership, StandInNote } from '../editor'
import type { Relation } from '../model'
import { describeLeverage, leverageOf } from '../model'
import { FIXED_ON_A_STANDIN, mayEdit } from '../projects/mayEdit'
import { CHECK_LABEL, identityFindings, offeredBeyond } from '../projects/checks'
import { standInOf } from '../projects/library'
import type { ScopeIndex } from '../projects/scopeIndex'
import type { ScopePath } from '../projects/scopePath'
import type { InitialPage } from './App'
import type { ProjectSaver } from './useDocumentSession'
import type { Gestures } from './useGestures'
import type { Library } from './useLibrary'
import type { ModelSession } from './useModelSession'
import { useOwnerDescriptions } from './useOwnerDescriptions'

export function useWorkspaceOwnership(deps: {
  session: ModelSession
  scope: ScopePath
  index: ScopeIndex
  projects: ProjectSaver
  onOpenScope: ((path: ScopePath, page?: InitialPage) => void) | undefined
  rowsThrough: Relation[]
  scopeLabel: (path: ScopePath) => string
  gestureOffers: Gestures['offers']
  gestureChoose: Gestures['choose']
  addExisting: Library['open']
  s: Translate
}): EditorOwnership {
  const {
    session, scope, index, projects, onOpenScope, rowsThrough, scopeLabel, gestureOffers, gestureChoose, addExisting, s,
  } = deps
  /**
   * What the owners say about the stand-ins drawn here (ADR-0012 §3): read
   * from the owning scopes, shown on the card and in the panel, never kept.
   */
  const ownerDescriptions = useOwnerDescriptions({
    scope, index,
    ...(projects.load ? { load: projects.load } : {}),
    ...(projects.descriptions ? { descriptions: projects.descriptions } : {}),
  })

  const notes = useStandInNotes(index, scope, s, ownerDescriptions)

  return useMemo<EditorOwnership>(() => ({
    ownerOf: (elementId) => ownerAnswer(elementId, { session, scope, index, ownerDescriptions, onOpenScope, s }),
    noteFor: (elementId) => notes.get(elementId),
    // What a platform is filed under and what it is, off the index (ADR-0013,
    // ADR-0014): the deployment boxes nest by the platform tree and draw a
    // box only for a place, and a landscape holds stand-ins of the platforms
    // it stands on — both facts are the scope's that defines them.
    platformTree: {
      parentOf: (platformId) => index.lookup(platformId)?.parentId,
      archetypeOf: (platformId) => index.lookup(platformId)?.platformArchetype,
      outsideOf: (platformId) => index.lookup(platformId)?.outside,
    },
    // Who uses a service from another team (ADR-0014), off the rows the whole
    // tree holds: what the *Shared* tick says beside itself.
    offeredBeyond: (serviceId) => (index.lookup(serviceId)?.kind === 'platformService'
      ? offeredBeyond(index, serviceId).outside.map((one) => one.name)
      : undefined),
    // What an application leverages (ADR-0014), over the tree's rows — what
    // realises a service is the platform scope's row — and named off the
    // index, since the platform behind a service need not be drawn here.
    leverageOf: (applicationId) => describeLeverage(
      leverageOf(session.model, applicationId, { elsewhere: rowsThrough }),
      (id) => index.lookup(id)?.name ?? session.model.elements.find((held) => held.id === id)?.name,
    ),
    // The technology the rest of the organisation defines (ADR-0017): every
    // platform and service another scope answers for, named with its scope,
    // and the stand-in this scope would keep of one.
    technology: {
      elsewhere: technologyElsewhere(index, scope, scopeLabel),
      standInFor: (id) => {
        const entry = index.lookup(id)
        const ref = entry?.master ?? entry?.cachedRef
        return entry && ref !== undefined ? standInOf(entry, ref) : undefined
      },
    },
    gestures: {
      offered: (elementId) => gestureOffers(elementId).length > 0,
      label: s('gesture.move'),
      tip: s('gesture.moveTip'),
      onMove: (elementId) => gestureChoose(elementId),
    },
    onAddExisting: addExisting,
  }), [session, scope, index, notes, rowsThrough, onOpenScope, s, gestureOffers, gestureChoose, addExisting, ownerDescriptions, scopeLabel])
}

/**
 * What every card on this board says about a record another scope defines
 * (ADR-0012 §3, §9) — one entry per stand-in, and one fold over the tree.
 *
 * Keyed on the INDEX and not on the model, which is what makes it affordable:
 * the index is rebuilt twice a session, so a card's note is the same object
 * from one keystroke to the next and `React.memo` below the canvas holds.
 * Computing a note per element per derive is precisely what ADR-0004
 * measured and took out of this path.
 *
 * The consequence is that a record linked a second ago draws as a definition
 * until the tree is read again. The inspector beside it says otherwise at
 * once, because it asks the live record; that difference is the right way
 * round — the panel is where a person is looking.
 */
function useStandInNotes(
  index: ScopeIndex, scope: ScopePath, s: Translate, ownerDescriptions: ReadonlyMap<string, string>,
): ReadonlyMap<string, StandInNote> {
  return useMemo(() => {
    const bySubject = new Map<string, string>()
    for (const finding of identityFindings(index)) {
      if (finding.scope !== scope || bySubject.has(finding.id)) continue
      bySubject.set(finding.id, s(CHECK_LABEL[finding.key], {
        name: finding.name,
        scope: finding.scopes?.[0] || s('common.organisation'),
        detail: finding.detail ?? '',
      }))
    }
    const found = new Map<string, StandInNote>()
    for (const entry of index.entries()) {
      if (!entry.drawnIn.includes(scope)) continue
      const owner = entry.master ?? ''
      const warning = bySubject.get(entry.id)
      const description = ownerDescriptions.get(entry.id)
      found.set(entry.id, {
        from: s('standIn.from', { scope: owner || s('common.organisation') }),
        ...(warning !== undefined ? { warning } : {}),
        ...(description !== undefined ? { description } : {}),
      })
    }
    return found
  }, [index, scope, s, ownerDescriptions])
}

/** Who answers for one record, and the ways to them — or nothing, where this scope does. */
function ownerAnswer(elementId: string, at: {
  session: ModelSession
  scope: ScopePath
  index: ScopeIndex
  ownerDescriptions: ReadonlyMap<string, string>
  onOpenScope: ((path: ScopePath, page?: InitialPage) => void) | undefined
  s: Translate
}): ReturnType<EditorOwnership['ownerOf']> {
  const { session, scope, index, ownerDescriptions, onOpenScope, s } = at
  const held = session.indexed().elements[elementId]
  const rights = mayEdit(elementId, scope, index, held)
  if (rights.all) return undefined
  // The scope this record SAYS defines it, where the tree cannot say —
  // a dangling stand-in still points somewhere, and the cached path is
  // the only address anybody wrote down.
  const owner = rights.owner ?? held?.ref
  const description = ownerDescriptions.get(elementId)
  return {
    label: owner === undefined ? s('common.organisation') : owner || s('common.organisation'),
    fields: FIXED_ON_A_STANDIN,
    ...(description !== undefined ? { description } : {}),
    // A stand-in nobody defines has nowhere to go, and offering to open
    // the scope its cache names would be offering a folder that is not
    // there. *Link* is the repair, and it is step 10's.
    ...(rights.owner !== undefined && onOpenScope
      ? {
        onOpen: () => onOpenScope(rights.owner!),
        onShow: () => onOpenScope(rights.owner!, { page: 'element', id: elementId }),
        onDocument: () => onOpenScope(rights.owner!, { page: 'document', id: elementId }),
      }
      : {}),
  }
}

/**
 * The technology the rest of the organisation defines (ADR-0017): every
 * platform and service another scope answers for, named with its scope.
 */
function technologyElsewhere(index: ScopeIndex, scope: ScopePath, scopeLabel: (path: ScopePath) => string) {
  return index.entries()
    .filter((entry) => (entry.kind === 'platform' || entry.kind === 'platformService')
      && entry.master !== undefined && entry.master !== scope)
    .map((entry) => ({
      id: entry.id, name: entry.name, kind: entry.kind as 'platform' | 'platformService',
      place: entry.platformArchetype === 'place', where: scopeLabel(entry.master!),
      // What an offering is and what delivers it, for *Uses* and the
      // landscape's shared row (ADR-0020): the other scope's rows, off
      // the index rather than a load per scope.
      ...(entry.shared ? { shared: true as const } : {}),
      ...(entry.kind === 'platformService'
        ? { realisedBy: [...new Set(index.rowsTo(entry.id, ['realises']).map(({ relation }) => relation.sourceId))] }
        : {}),
    }))
}
