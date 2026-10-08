// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every architecture decision in one place: the tree of where they live down
 * the left, the records of the chosen place in the middle, the one you are
 * reading on the right — a reading pane, the way a mail client is laid out.
 *
 * **One list** (ADR-0012 §7). This scope's records are one array on its model,
 * told apart by `subjectId` — absent means the record is about the scope
 * itself, and any element it knows may be the subject of one — and they go
 * back whole (`onProjectDecisionsChange`) so the caller commits one model
 * change. What used to be a second list, the group's, is now a section per
 * ancestor: read up the tree, read-only here, with a way to open the scope
 * that holds them. **A record is edited where it lives**, which is the same
 * rule `mayEdit` applies to an element.
 *
 * The page never writes anywhere itself.
 *
 * A fullscreen dialog for the same two reasons as the documentation page: it
 * portals out of the editor's DOM so the canvas's shortcuts cannot reach a
 * reader, and it covers the whole window, so its top bar takes over the
 * window's two jobs — keep clear of the traffic lights, and be the surface the
 * window is dragged by.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { LanguageProvider } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { matchesQuery } from '../../model'
import type { Language, Translate } from '../../i18n'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import {
  adrsFor, formatAdrNumber, newAdr, nextAdrNumber, removeAdr, setAdrStatus, sortAdrs, updateAdr,
} from '../adr'
import type { Adr, AdrPatch, AdrStatus } from '../adr'
import type { HostModel } from '../../model/hostModel'
import { NO_WINDOW_CHROME, barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { PageDialog } from '../../widgets/PageDialog'
import type { DocumentImages } from '../../documentation/ui/DocumentSource'
import type { MakeId } from '../../model/keys'
import { NewAdrDialog, SupersedeDialog } from './AdrDialogs'
import { AdrRecordList, AdrTopBar, AdrTree, FromAboveBanner, MoveDialogs } from './AdrPageParts'
import { AdrReader } from './AdrReader'
import {
  fromScope, projectScopeOf, scopeFromPath, scopeSubjectId,
} from '../adrScope'
import type { AncestorRecords, ScopeKey } from '../adrScope'

export type AdrPageProps = {
  open: boolean
  onClose: () => void
  model: HostModel
  groupName: string
  /**
   * The scopes above this one and the records they hold, nearest first
   * (ADR-0012 §7). Read-only here; {@link AdrPageProps.onOpenScope} is how a
   * person gets to where one can be edited.
   */
  ancestors?: readonly AncestorRecords[]
  /**
   * Open one of those scopes on the record read here, where it can be edited.
   * Absent where the host cannot — a test, a page with nowhere to go.
   */
  onOpenScope?: (path: string, id: string) => void
  onProjectDecisionsChange: (next: Adr[]) => void
  /** Open straight onto this record — from the search, a link, or an agent. */
  initialAdrId?: string
  /** The request's own number: the same record asked for again is a new one, and lands again. */
  initialNonce?: number
  /**
   * Which record is on show, whenever that changes, with the number of the
   * request the page has landed on: what the agent is told the page is on.
   */
  onShown?: (adrId: string | undefined, nonce: number | undefined) => void
  readOnly?: boolean
  s: Translate
  language: Language
  makeId: MakeId
  /** `yyyy-mm-dd`. Injected: a clock inside a component cannot be tested. */
  today: () => string
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  /** An element link in a record was followed; the page closes and the caller opens that element. */
  onOpenElement?: (elementId: string) => void
  /** The host keeps a history and can show this record's (ADR-0008). Only a project's records have one. */
  onOpenHistory?: (adrId: string) => void
  /** A picture into the project, and the project's pictures (ADR-0009); handed on to the record. */
  onAddImage?: (file: File) => Promise<string | undefined>
  images?: DocumentImages
  /** A plan resting on a record was followed; the page closes and the caller opens that plan (ADR-0010). */
  onOpenPlan?: (transitionId: string) => void
  /**
   * The solution a record was decided for was followed (ADR-0026); the page
   * closes and the caller opens the observations page on it.
   */
  onOpenSolution?: (solutionId: string) => void
  /**
   * Where this scope sits, drawn by the caller — the shell's crumbs, which
   * know the tree and how to go home. Absent, the bar names the organisation
   * and the scope, leaving out whichever has no name.
   */
  crumbs?: ReactNode
  windowChrome?: WindowChrome
}

/**
 * The list with the record that moved first, when a move supersedes others.
 *
 * The list goes back whole and is said as one change per record in the
 * list's order (`decisionsToCommands`); a writer that checks each move
 * against the records as they stand (ADR-0008) must see the successor
 * accepted before the records it supersedes are marked. The model's own
 * order is not a command, so nothing else moves.
 */
function movedFirst(list: readonly Adr[], id: string): Adr[] {
  const moved = list.find((adr) => adr.id === id)
  return moved ? [moved, ...list.filter((adr) => adr.id !== id)] : [...list]
}

/**
 * Where an opening lands, and what the host is told it shows.
 *
 * Each opening starts on the landscape's newest record (`start`) — unless
 * it asked for one, which it goes to (`onto`) once per request. The records
 * change with every save, and going back to that one on each would take a
 * person off the record they moved to, closing its editor mid-sentence. A
 * request is the record and its number (`nonce`): the same record asked for
 * again, after the person has moved off it, is a new number and lands. It
 * waits for the record to be there, so a list that arrives late still lands.
 *
 * The record on show goes to `onShown` whenever it changes, with the number
 * of the request it landed on — what the agent is told the page is on,
 * rather than the record last asked for.
 */
function useOpening(deps: {
  open: boolean
  request: { id: string | undefined; nonce: number | undefined }
  records: readonly Adr[]
  selectedId: string | undefined
  start: () => void
  onto: (target: Adr) => void
  onShown: ((id: string | undefined, nonce: number | undefined) => void) | undefined
}) {
  const { open, records, selectedId } = deps
  const { id, nonce } = deps.request
  const [landed, setLanded] = useState<number | undefined>(undefined)
  const honoured = useRef<{ id: string; nonce: number | undefined } | undefined>(undefined)
  const latest = useRef(deps)
  latest.current = deps
  useEffect(() => {
    if (!open || id) return
    latest.current.start()
    setLanded(nonce)
  }, [open, id, nonce])
  useEffect(() => {
    if (!open) { honoured.current = undefined; return }
    if (!id || (honoured.current?.id === id && honoured.current.nonce === nonce)) return
    const target = records.find((a) => a.id === id)
    if (!target) return
    honoured.current = { id, nonce }
    latest.current.onto(target)
    setLanded(nonce)
  }, [open, id, nonce, records])
  const shown = records.some((a) => a.id === selectedId) ? selectedId : undefined
  useEffect(() => {
    if (open) latest.current.onShown?.(shown, landed)
  }, [open, shown, landed])
}

export function AdrPage(props: AdrPageProps) {
  const {
    open, onClose, model, groupName, ancestors = [], onOpenScope, onProjectDecisionsChange,
    initialAdrId, initialNonce, readOnly = false, s, today, makeId,
  } = props
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const bar = barChromeFor(chrome)
  const projectDecisions = useMemo(() => model.decisions ?? [], [model.decisions])

  const [scope, setScope] = useState<ScopeKey>('landscape')
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [superseding, setSuperseding] = useState<Adr | undefined>(undefined)
  const [deleting, setDeleting] = useState<Adr | undefined>(undefined)
  // The two moves that lock a record for good ask once more: acceptance
  // confirms, rejection and withdrawal ask why.
  const [accepting, setAccepting] = useState<Adr | undefined>(undefined)
  const [rejecting, setRejecting] = useState<Adr | undefined>(undefined)

  // --- where things are ---------------------------------------------------------

  /**
   * What a record here can be ABOUT (ADR-0012 §7): every application, because
   * that is where one is usually filed and the tree is the place to make one —
   * plus anything else that already has a record, because a decision about a
   * capability or a journey step is now an ordinary thing to write.
   */
  const subjects = useMemo(() => {
    const withRecords = new Set(projectDecisions
      .map((adr) => adr.subjectId)
      .filter((id): id is string => Boolean(id)))
    return model.elements
      .filter((e) => e.kind === 'application' || withRecords.has(e.id))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [model.elements, projectDecisions])
  const subjectIds = useMemo(() => new Set(subjects.map((one) => one.id)), [subjects])
  // Records about something that has since left the model. They are history
  // and stay findable; hiding them would be losing them quietly.
  const orphanIds = useMemo(
    () => [...new Set(projectDecisions.map((a) => a.subjectId).filter((id): id is string => Boolean(id) && !subjectIds.has(id!)))],
    [projectDecisions, subjectIds],
  )

  /** An ancestor's list by path, or nothing where the key is not one. */
  const ancestorAt = useCallback(
    (key: ScopeKey): AncestorRecords | undefined => {
      const path = scopeFromPath(key)
      return path === undefined ? undefined : ancestors.find((one) => one.path === path)
    },
    [ancestors],
  )
  const owningList = useCallback(
    (key: ScopeKey): readonly Adr[] => ancestorAt(key)?.decisions ?? projectDecisions,
    [ancestorAt, projectDecisions],
  )
  const scopedList = useCallback(
    (key: ScopeKey): Adr[] => {
      const held = ancestorAt(key)
      return held ? [...held.decisions] : adrsFor(projectDecisions, scopeSubjectId(key))
    },
    [ancestorAt, projectDecisions],
  )
  const scopeOfRecord = useCallback(
    (adr: Adr): ScopeKey => {
      const from = ancestors.find((one) => one.decisions.some((held) => held.id === adr.id))
      return from ? fromScope(from.path) : projectScopeOf(adr)
    },
    [ancestors],
  )
  /**
   * A record is edited where it lives (ADR-0012 §7), so an ancestor's is
   * read-only here and there is nothing to commit for it — the page offers to
   * open that scope instead.
   */
  const commitList = useCallback((key: ScopeKey, next: Adr[]) => {
    if (scopeFromPath(key) !== undefined) return
    onProjectDecisionsChange(next)
  }, [onProjectDecisionsChange])

  const day = (value: string) => formatDay(value, props.language)
  const scopeLabel = (key: ScopeKey): string => {
    const from = ancestorAt(key)
    if (from) return from.name || from.path || groupName || s('adr.scopeGroup')
    if (key === 'landscape') return model.name || s('adr.scopeLandscape')
    const id = scopeSubjectId(key)!
    return subjects.find((one) => one.id === id)?.name ?? id
  }
  /** An ancestor's records are not this scope's to change. */
  const lockedAt = (key: ScopeKey): boolean => readOnly || scopeFromPath(key) !== undefined

  // --- selection -------------------------------------------------------------------

  const allRecords = useMemo(
    () => [...ancestors.flatMap((one) => one.decisions), ...projectDecisions],
    [ancestors, projectDecisions],
  )
  const selected = selectedId ? allRecords.find((a) => a.id === selectedId) : undefined

  // Each opening starts on the landscape's newest record, or stands in the
  // scope of the one it asked for with it selected.
  useOpening({
    open, request: { id: initialAdrId, nonce: initialNonce }, records: allRecords, selectedId, onShown: props.onShown,
    start: () => {
      setScope('landscape')
      setQuery('')
      setSelectedId(sortAdrs(scopedList('landscape'))[0]?.id)
    },
    onto: (target) => {
      setScope(scopeOfRecord(target))
      setSelectedId(target.id)
      setQuery('')
    },
  })

  const trimmed = query.trim()
  const shown: { adr: Adr; scope: ScopeKey }[] = useMemo(() => {
    if (trimmed) {
      return allRecords
        .filter((adr) => matchesQuery(trimmed, [adr.title, adr.body, formatAdrNumber(adr.number), ...adr.signers.map((x) => x.name)]))
        .map((adr) => ({ adr, scope: scopeOfRecord(adr) }))
    }
    return sortAdrs(scopedList(scope)).map((adr) => ({ adr, scope }))
  }, [trimmed, allRecords, scopeOfRecord, scopedList, scope])

  const chooseScope = (key: ScopeKey) => {
    setScope(key)
    setQuery('')
    // Land on the newest record of the place you just walked into.
    setSelectedId(sortAdrs(scopedList(key))[0]?.id)
  }
  const chooseRecord = (adr: Adr, where: ScopeKey) => {
    setScope(where)
    setSelectedId(adr.id)
  }

  // --- changes ----------------------------------------------------------------------

  const create = (title: string) => {
    const list = owningList(scope)
    const fresh = newAdr({
      id: makeId('adr'), number: nextAdrNumber(list), title, date: today(), t: s,
      subjectId: scopeSubjectId(scope),
    })
    commitList(scope, [...list, fresh])
    setCreating(false)
    setQuery('')
    setSelectedId(fresh.id)
  }

  const update = (adr: Adr, patch: AdrPatch) => {
    const key = scopeOfRecord(adr)
    commitList(key, updateAdr(owningList(key), adr.id, patch))
  }

  const move = (adr: Adr, next: AdrStatus) => {
    if (next === 'superseded') { setSuperseding(adr); return }
    if (next === 'accepted') { setAccepting(adr); return }
    if (next === 'rejected') { setRejecting(adr); return }
    const key = scopeOfRecord(adr)
    commitList(key, setAdrStatus(owningList(key), adr.id, next, today()))
  }

  const accept = (adr: Adr) => {
    const key = scopeOfRecord(adr)
    commitList(key, movedFirst(setAdrStatus(owningList(key), adr.id, 'accepted', today()), adr.id))
    setAccepting(undefined)
  }

  const reject = (adr: Adr, reason: string) => {
    const key = scopeOfRecord(adr)
    commitList(key, setAdrStatus(owningList(key), adr.id, 'rejected', today(), { reason }))
    setRejecting(undefined)
  }

  const supersede = (adr: Adr, successorId: string) => {
    const key = scopeOfRecord(adr)
    commitList(key, setAdrStatus(owningList(key), adr.id, 'superseded', today(), { supersededBy: successorId }))
    setSuperseding(undefined)
  }

  const remove = (adr: Adr) => {
    const key = scopeOfRecord(adr)
    commitList(key, removeAdr(owningList(key), adr.id))
    setDeleting(undefined)
    if (selectedId === adr.id) setSelectedId(undefined)
  }

  const followElement = props.onOpenElement
    ? (elementId: string) => { onClose(); props.onOpenElement?.(elementId) }
    : undefined

  // --- the tree --------------------------------------------------------------------

  const count = (key: ScopeKey) => scopedList(key).length
  const fromAbove = selected ? ancestorAt(scopeOfRecord(selected)) : undefined

  return (
    <PageDialog
      open={open}
      topInset={chrome.topInset}
      onClose={onClose}
      aria-label={s('adr.title')}
    >
      <LanguageProvider language={props.language}>
        <AdrTopBar
          bar={bar} crumbs={props.crumbs} names={[groupName, model.name]} readOnly={readOnly} s={s}
          onClose={onClose} onNew={() => setCreating(true)}
        />

        {/* ---- three columns ---- */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '240px 320px minmax(0, 1fr)', flex: 1, minHeight: 0 }}>
          <AdrTree
            modelName={model.name} subjects={subjects} orphanIds={orphanIds} ancestors={ancestors}
            selected={trimmed ? undefined : scope} count={count} onChoose={chooseScope} s={s}
          />

          <AdrRecordList
            query={query} onQuery={setQuery} shown={shown} selectedId={selectedId}
            describe={(adr, where) => [trimmed ? scopeLabel(where) : undefined, day(adr.date)].filter(Boolean).join(' · ')}
            empty={trimmed ? s('adr.searchEmpty', { query: trimmed }) : s('adr.listEmpty')}
            onChoose={chooseRecord} s={s}
          />

          {/* the record */}
          <Box sx={{ minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Read here, edited where it lives (ADR-0012 §7) — the same
                sentence a stand-in's inspector says about a field another
                scope answers for, and the same way out. */}
            {selected && fromAbove && (
              <FromAboveBanner
                scopeName={scopeLabel(scopeOfRecord(selected))} s={s}
                onOpen={onOpenScope ? () => { onClose(); onOpenScope(fromAbove.path, selected.id) } : undefined}
              />
            )}
            {selected ? (
              <AdrReader
                key={selected.id}
                adr={selected}
                list={owningList(scopeOfRecord(selected))}
                readOnly={lockedAt(scopeOfRecord(selected))}
                s={s}
                language={props.language}
                today={today}
                elements={fromAbove ? [] : model.elements}
                renderMarkdown={props.renderMarkdown}
                onAddImage={lockedAt(scopeOfRecord(selected)) ? undefined : props.onAddImage}
                images={props.images}
                onUpdate={(patch) => update(selected, patch)}
                onStatus={(next) => move(selected, next)}
                onDelete={() => setDeleting(selected)}
                // An ancestor's records are files in another scope's folder,
                // which this scope's history does not cover; only this scope's
                // own have one to show from here.
                onHistory={props.onOpenHistory && !fromAbove
                  ? () => props.onOpenHistory?.(selected.id)
                  : undefined}
                onSelect={(id) => {
                  const target = allRecords.find((a) => a.id === id)
                  if (target) chooseRecord(target, scopeOfRecord(target))
                }}
                onElementLink={followElement}
                plans={props.onOpenPlan && !fromAbove
                  ? { list: model.transitions ?? [], onOpen: (id) => { onClose(); props.onOpenPlan?.(id) } }
                  : undefined}
                // Derived, as the plans are: the solution names its record,
                // and the record reads the name back (ADR-0026).
                solutions={props.onOpenSolution && !fromAbove
                  ? { list: model.solutions ?? [], onOpen: (id) => { onClose(); props.onOpenSolution?.(id) } }
                  : undefined}
              />
            ) : (
              <Box sx={{ p: 5, color: 'text.secondary' }}>
                <Typography>{s('adr.noneSelected')}</Typography>
              </Box>
            )}
          </Box>
        </Box>

        <NewAdrDialog open={creating} onCancel={() => setCreating(false)} onCreate={create} s={s} />
        <SupersedeDialog
          target={superseding}
          candidates={superseding
            ? owningList(scopeOfRecord(superseding)).filter((a) => a.id !== superseding.id && a.status === 'accepted')
            : []}
          onCancel={() => setSuperseding(undefined)}
          onConfirm={(id) => superseding && supersede(superseding, id)}
          s={s}
        />
        <MoveDialogs
          accepting={accepting} rejecting={rejecting} listOf={(adr) => owningList(scopeOfRecord(adr))} s={s}
          onAccept={accept} onReject={reject}
          onCancel={() => { setAccepting(undefined); setRejecting(undefined) }}
        />
        <ConfirmDialog
          open={Boolean(deleting)}
          // The number and the title: a person confirming a delete should not
          // have to remember which record ADR-0007 was.
          title={deleting ? s('adr.deleteTitle', { name: `${formatAdrNumber(deleting.number)} ${deleting.title}` }) : ''}
          body={s('adr.deleteBody')}
          confirmLabel={s('adr.delete')}
          cancelLabel={s('common.cancel')}
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => deleting && remove(deleting)}
        />
      </LanguageProvider>
    </PageDialog>
  )
}
