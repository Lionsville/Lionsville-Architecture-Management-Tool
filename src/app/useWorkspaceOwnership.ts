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
import { createElement, useMemo } from 'react'
import type { ComponentProps } from 'react'
import type { Translate } from '../i18n'
import type { AnsweredBy, EditorOwnership, StandInNote } from '../editor'
import type { DesignElement } from '../model'
import type { HostModel } from '../model/hostModel'
import { isBlankRef } from '../model/person'
import { applicationOwnersOn } from '../model/owners'
import { isUnit } from '../model/units'
import { organisationHere } from './units/organisationHere'
import { platformTreeOf } from './platformTree'
import type { Relation } from '../model'
import { describeLeverage, leverageOf } from '../model'
import { FIXED_ON_A_STANDIN, mayEdit } from '../projects/mayEdit'
import { CHECK_LABEL, identityFindings, offeredBeyond } from '../projects/checks'
import { standInOf } from '../projects/library'
import type { ScopeIndex } from '../projects/scopeIndex'
import type { ScopePath } from '../projects/scopePath'
import { ancestorScopes } from '../projects/scopePath'
import type { InitialPage } from './App'
import type { ScopeReader } from '../projects/scopeAccess'
import type { Gestures } from './useGestures'
import type { Library } from './useLibrary'
import type { ModelSession } from './useModelSession'
import { useOwnerDescriptions } from './useOwnerDescriptions'
import type { PeopleRegisterAccess } from '../people/ui/access'
import { lazyPart } from '../widgets/lazyPart'
import type { UnitSection as UnitSectionShape } from './units/UnitSection'
import type { WriteIn } from './units/writeIn'

/**
 * An actor's unit section, with its dialogs to assign and to declare an
 * interaction, arrives with the first actor's record that draws it
 * (`widgets/lazyPart`): a board is drawn without it.
 */
const UnitSection = lazyPart<ComponentProps<typeof UnitSectionShape>>(
  () => import('./units/UnitSection').then((held) => held.UnitSection),
)

export function useWorkspaceOwnership(deps: {
  session: ModelSession
  scope: ScopePath
  index: ScopeIndex
  /** How many answers the index's source has given (`IndexHook.answered`). */
  indexAnswered?: number
  scopes: ScopeReader
  onOpenScope: ((path: ScopePath, page?: InitialPage) => void) | undefined
  rowsThrough: Relation[]
  scopeLabel: (path: ScopePath) => string
  gestureOffers: Gestures['offers']
  gestureChoose: Gestures['choose']
  addExisting: Library['open']
  /**
   * What an actor's unit section is drawn with (ADR-0036 §3): the register,
   * today and the day the board is looked at (ADR-0027), fresh ids, every
   * scope's path.
   */
  units: {
    people: PeopleRegisterAccess | undefined; today: string; day?: string; makeId: (prefix: string) => string; scopePaths: readonly ScopePath[]
    /** A link kept in another scope, written there (`units/writeIn.ts`): a capability elsewhere picked for *Responsible for*. */
    writeIn?: WriteIn
  }
  s: Translate
}): EditorOwnership {
  const {
    session, scope, index, indexAnswered, scopes, onOpenScope, rowsThrough, scopeLabel, gestureOffers, gestureChoose, addExisting, units, s,
  } = deps
  /**
   * What the owners say about the stand-ins drawn here (ADR-0012 §3): read
   * from the owning scopes, shown on the card and in the panel, never kept.
   */
  const ownerDescriptions = useOwnerDescriptions({ scope, index, answered: indexAnswered, scopes })

  const notes = useStandInNotes(index, scope, s, ownerDescriptions)

  return useMemo<EditorOwnership>(() => ({
    ownerOf: (elementId) => ownerAnswer(elementId, { session, scope, index, ownerDescriptions, onOpenScope, s }),
    noteFor: (elementId) => notes.get(elementId),
    // What a platform is filed under, what it is and when it goes, off the
    // index (ADR-0013, ADR-0014): the deployment boxes nest by the platform
    // tree and draw a box only for a place, a landscape holds stand-ins of
    // the platforms it stands on, and the checks date a stand-in by its
    // master (ADR-0012 §3) — all facts of the scope that defines them.
    platformTree: platformTreeOf(index),
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
    // The actors the scopes above keep (ADR-0012 §4), for *Belongs to*: an
    // outside application in a landscape usually belongs to one of the
    // organisation's parties, which the landscape need not hold a record of.
    parties: partiesAbove(index, scope, scopeLabel),
    gestures: {
      offered: (elementId) => gestureOffers(elementId).length > 0,
      label: s('gesture.move'),
      tip: s('gesture.moveTip'),
      onMove: (elementId) => gestureChoose(elementId),
    },
    onAddExisting: addExisting,
    // An actor as a unit (ADR-0036 §3): drawn here, because all of it is the
    // organisation's — and first in its inspector where it is one, an actor
    // with a type (as built 3.6.1); an actor without one keeps the element's order.
    unitSection: (element, readOnly) => ({
      section: createElement(UnitSection, {
        element, readOnly, scope, model: session.model, index, dispatch: session.dispatch, makeId: units.makeId,
        newRowId: () => session.ids.connection(),
        people: units.people, today: units.today, ...(units.day !== undefined ? { day: units.day } : {}), scopeLabel, scopes: units.scopePaths, s,
        ...(units.writeIn ? { writeIn: units.writeIn } : {}),
      }),
      leads: isUnit(element),
    }),
    // Who answers for a record beyond its own field (ADR-0036 §8): a stand-in's master, and the rule.
    answeredBy: (element) => answeredByOf(element, { session, scope, index, today: units.today }),
    // What a delete's confirmation calls the roles a unit takes with it (ADR-0036, amended 12 October 2026):
    // the organisation's, with this scope's session laid over it, read when it is asked.
    roles: {
      name: (roleId) => organisationOver(index, scope, session.current()).organisation.roles.find((role) => role.id === roleId)?.name,
      today: units.today,
    },
  }), [session, scope, index, notes, rowsThrough, onOpenScope, s, gestureOffers, gestureChoose, addExisting, ownerDescriptions, scopeLabel, units])
}

/** The organisation with this scope's session laid over it, once per index and model: a panel asks on every render. */
function organisationOver(index: ScopeIndex, scope: ScopePath, model: HostModel): ReturnType<typeof organisationHere> {
  const held = laidOver.get(model)
  if (held && held.index === index && held.scope === scope) return held.over
  const over = organisationHere(index, scope, model)
  laidOver.set(model, { index, scope, over })
  return over
}
const laidOver = new WeakMap<HostModel, { index: ScopeIndex; scope: ScopePath; over: ReturnType<typeof organisationHere> }>()

/**
 * Who answers for a record beyond its own owner field (ADR-0036 §2, §8).
 *
 * A stand-in carries no owner (ADR-0012 §3): the one its master names is
 * read off the index, as an id or the text written there, and the register
 * names it. An application nobody wrote an owner on is owned, on the day,
 * by whoever holds the role the organisation's `applicationOwner` rule names
 * in the unit it belongs to (`partyId`) — worked out over the tree with this
 * scope's session laid over it, so an assignment made a second ago counts,
 * and never stored.
 */
export function answeredByOf(element: DesignElement, at: {
  session: Pick<ModelSession, 'current'>; scope: ScopePath; index: ScopeIndex; today: string
}): AnsweredBy | undefined {
  const entry = element.ref !== undefined ? at.index.lookup(element.id) : undefined
  const master = entry?.owner !== undefined ? { owner: entry.owner } : {}
  const written = element.ref !== undefined ? entry?.owner : element.owner
  const partyId = element.ref !== undefined ? entry?.partyId : element.partyId
  if (element.kind !== 'application' || !isBlankRef(written) || partyId === undefined) {
    return entry?.owner !== undefined ? master : undefined
  }
  const model = at.session.current()
  const { organisation } = organisationOver(at.index, at.scope, model)
  const rules = at.scope === '' ? model.operatingRules : at.index.operatingModel().operatingRules
  const found = applicationOwnersOn(organisation, rules, { partyId }, at.today)
  if (found.length === 0) return entry?.owner !== undefined ? master : undefined
  const role = organisation.roles.find((one) => one.id === found[0].roleId)?.name ?? found[0].roleId
  const unit = organisation.units.find((one) => one.id === partyId)?.name ?? partyId
  return { ...master, workedOut: { people: found.map((one) => one.person), role, unit, day: at.today } }
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
 * The actors the scopes above this one keep (ADR-0012 §4), nearest scope
 * first, named with the scope that keeps them. Not a sibling's or a child's:
 * what a scope can see is itself and what it is filed under.
 */
export function partiesAbove(index: ScopeIndex, scope: ScopePath, scopeLabel: (path: ScopePath) => string) {
  const above = ancestorScopes(scope)
  const actors = index.entries().filter((entry) => entry.kind === 'actor' && entry.master !== undefined)
  return above.flatMap((path) => actors
    .filter((entry) => entry.master === path)
    .map((entry) => ({ id: entry.id, name: entry.name, where: scopeLabel(path) })))
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
