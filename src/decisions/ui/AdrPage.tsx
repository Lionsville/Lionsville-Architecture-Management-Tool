// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every architecture decision here, read by whether it is in force: one list
 * under *Still open*, *In force* and *Ended*, a row the number and the title and
 * nothing else, so a status is said once. What a record is about is a filter and
 * no longer the shape of the page; every application is still in it, and those
 * that have left the model, since a record about them is history.
 *
 * Selecting a row opens it large over the list (`AdrRecord`), and writing it is a
 * full window (`AdrWriting`). A new record opens ready to write.
 *
 * **One list** (ADR-0012 §7). This scope's records are one array on its model,
 * told apart by `subjectId` — absent means the record is about the scope
 * itself, and any element it knows may be the subject of one — and they go
 * back whole (`onProjectDecisionsChange`) so the caller commits one model
 * change. The scopes above have a fold each at the foot of the list: read up
 * the tree, read-only here, with a way to open the scope that holds them. **A
 * record is edited where it lives**, which is the same rule `mayEdit` applies
 * to an element.
 *
 * The page never writes anywhere itself.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LanguageProvider } from '../../i18n'
import type { Language, Translate } from '../../i18n'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import {
  formatAdrNumber, isAdrLocked, newAdr, nextAdrNumber, removeAdr, setAdrStatus, sortAdrs, updateAdr,
} from '../adr'
import type { Adr, AdrGateItem, AdrPatch, AdrStatus } from '../adr'
import { ABOUT_THE_SCOPE, aboutOf, aboutOptions, STANDING_LABEL, STANDINGS, standingOf } from '../adrList'
import type { AboutGroup } from '../adrList'
import type { HostModel } from '../../model/hostModel'
import type { WindowChrome } from '../../platform/windowChrome'
import { PageDialog } from '../../widgets/PageDialog'
import { Button } from '../../widgets/kit/Button'
import { FilterWords } from '../../widgets/kit/FilterWords'
import type { FilterField } from '../../widgets/kit/FilterWords'
import { List } from '../../widgets/kit/List'
import type { ListGroup, ListRow } from '../../widgets/kit/List'
import { FRESH_VIEW, listed } from '../../widgets/kit/listView'
import type { ListView } from '../../widgets/kit/listView'
import { PageState } from '../../widgets/kit/PageState'
import type { DocumentImages } from '../../documentation/ui/MarkdownEditor'
import type { MakeId } from '../../model/keys'
import { DeleteDialog, MoveDialogs, NewAdrDialog, SupersedeDialog } from './AdrDialogs'
import { signerText } from './AdrParts'
import { AdrRecord } from './AdrRecord'
import { AdrWriting } from './AdrWriting'
import { usePersonNames } from '../../people/ui/names'
import type { AncestorRecords } from '../adrScope'
import './AdrPage.css'

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
  /** Copy a link to this record and show it (ADR-0033, amended); absent, the reader offers none. */
  onCopyLink?: (adrId: string) => void
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
  /** The window's own chrome: writing covers the rows, so its bar takes over what they do for the window. */
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
 * An opening starts on the list (`start`) — unless it asked for a record, which
 * it goes to (`onto`) once per request. The records change with every save, and
 * going back to that one on each would take a person off the record they moved
 * to. A request is the record and its number (`nonce`): the same record asked for
 * again, after the person has moved off it, is a new number and lands. It waits
 * for the record to be there, so a list that arrives late still lands.
 *
 * The record on show goes to `onShown` whenever it changes, with the number
 * of the request it landed on — what the agent is told the page is on,
 * rather than the record last asked for.
 */
function useOpening(deps: {
  open: boolean
  request: { id: string | undefined; nonce: number | undefined }
  records: readonly Adr[]
  selectedId: string | null
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
  const shown = records.some((a) => a.id === selectedId) ? selectedId ?? undefined : undefined
  useEffect(() => {
    if (open) latest.current.onShown?.(shown, landed)
  }, [open, shown, landed])
}

/** A row in the list: the record, and the scope above that keeps it, where one does. */
type Listed = { adr: Adr; above?: AncestorRecords }

const ABOUT_GROUP: Record<Exclude<AboutGroup, 'scope'>, Parameters<Translate>[0]> = {
  withRecords: 'adr.aboutWithRecords',
  none: 'adr.aboutNone',
  removed: 'adr.scopeRemoved',
}

/** What the list shows of the view it is on: the groups in order, what a preview walks, the folds, and the About filter. */
function useAdrList(view: ListView, props: Pick<AdrPageProps, 'model' | 'groupName' | 'ancestors' | 's' | 'language'>) {
  const { model, groupName, ancestors = [], s, language } = props
  const names = usePersonNames()
  const projectDecisions = useMemo(() => model.decisions ?? [], [model.decisions])
  /**
   * What a record here can be ABOUT (ADR-0012 §7): every application, because
   * that is where one is usually filed — plus anything else that already has a
   * record, because a decision about a capability or a journey step is now an
   * ordinary thing to write.
   */
  const subjects = useMemo(() => {
    const withRecords = new Set(projectDecisions.map((adr) => adr.subjectId).filter(Boolean))
    return model.elements
      .filter((e) => e.kind === 'application' || withRecords.has(e.id))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [model.elements, projectDecisions])

  const aboutFilter: FilterField = useMemo(() => ({
    id: 'about', label: s('adr.aboutField'), narrow: subjects.length > 8,
    options: aboutOptions(projectDecisions, subjects).map((one) => {
      const label = one.group === 'scope' ? s('adr.aboutScope') : one.name ?? one.value
      return {
        value: one.value, label, word: s('adr.aboutWord', { about: label }),
        ...(one.count > 0 ? { count: one.count } : {}),
        ...(one.group !== 'scope' ? { group: s(ABOUT_GROUP[one.group]) } : {}),
      }
    }),
  }), [projectDecisions, subjects, s])

  const how = useMemo(() => ({
    words: ({ adr }: Listed) => [adr.title, adr.body, formatAdrNumber(adr.number), ...adr.signers.map((one) => signerText(one, names))],
    filterBy: { about: ({ adr, above }: Listed) => (above ? [] : [aboutOf(adr)]) },
    language,
  }), [names, language])

  const finding = view.find.trim() !== ''
  const narrowed = finding || Object.keys(view.filters).length > 0
  const groups = useMemo<readonly ListGroup[]>(() => {
    const rowOf = ({ adr, above }: Listed): ListRow => ({
      id: adr.id, code: formatAdrNumber(adr.number), text: adr.title,
      // A find spans the folds, so a hit says where it was kept.
      ...(above && finding ? { note: above.name } : {}),
    })
    const kept = (items: readonly Listed[]) => listed(items, view, how).flatMap((group) => group.rows)
    const own = kept(sortAdrs(projectDecisions).map((adr) => ({ adr })))
    return [
      ...STANDINGS.map((standing) => ({
        id: standing, label: s(STANDING_LABEL[standing]),
        rows: own.filter(({ adr }) => standingOf(adr.status) === standing).map(rowOf),
      })).filter((group) => !narrowed || group.rows.length > 0),
      ...ancestors.map((above) => ({
        id: `from:${above.path}`, label: s('adr.scopeFrom', { scope: above.name || above.path || groupName || s('adr.scopeGroup') }),
        rows: kept(sortAdrs(above.decisions).map((adr) => ({ adr, above }))).map(rowOf),
      })).filter((group) => group.rows.length > 0),
    ]
  }, [ancestors, finding, groupName, how, narrowed, projectDecisions, s, view])
  const ids = useMemo(() => groups.flatMap((group) => group.rows.map((row) => row.id)), [groups])
  const folds = useMemo(() => (finding ? [] : ancestors.map((above) => `from:${above.path}`)), [ancestors, finding])
  return { subjects, aboutFilter, groups, ids, folds, finding }
}

/**
 * The record being written. A new one is held here, `fresh`, until Save makes
 * it, so Cancel on a record that was never saved leaves nothing behind: no empty
 * proposal in the list and no step to undo.
 */
function useAdrPen(deps: {
  projectDecisions: readonly Adr[]
  update: (adr: Adr, patch: AdrPatch) => void
  write: (next: Adr[]) => void
  nameOf: Parameters<typeof updateAdr>[3]
  onMade: (id: string) => void
}) {
  const [writing, setWriting] = useState<{ id: string; at?: AdrGateItem; fresh?: Adr } | undefined>(undefined)
  const written = writing?.fresh ?? (writing ? deps.projectDecisions.find((adr) => adr.id === writing.id) : undefined)
  return {
    writing,
    written,
    write: (id: string, at?: AdrGateItem) => setWriting({ id, ...(at ? { at } : {}) }),
    startFresh: (fresh: Adr) => setWriting({ id: fresh.id, fresh }),
    save: (adr: Adr, patch: AdrPatch) => {
      if (writing?.fresh === undefined) deps.update(adr, patch)
      else {
        deps.write(updateAdr([...deps.projectDecisions, adr], adr.id, patch, deps.nameOf))
        deps.onMade(adr.id)
      }
      setWriting(undefined)
    },
    cancel: () => setWriting(undefined),
  }
}

/** The moves and the changes, each said to the page's dialogs or written whole. A record is edited where it lives (ADR-0012 §7). */
function useAdrChanges(deps: {
  projectDecisions: readonly Adr[]
  aboveOf: (adr: Adr) => AncestorRecords | undefined
  listOf: (adr: Adr) => readonly Adr[]
  write: (next: Adr[]) => void
  today: () => string
  nameOf: Parameters<typeof updateAdr>[3]
}) {
  const { aboveOf, listOf, write, today, nameOf } = deps
  const [superseding, setSuperseding] = useState<Adr | undefined>(undefined)
  const [deleting, setDeleting] = useState<Adr | undefined>(undefined)
  // The two moves that lock a record for good ask once more: acceptance
  // confirms, rejection and withdrawal ask why.
  const [accepting, setAccepting] = useState<Adr | undefined>(undefined)
  const [rejecting, setRejecting] = useState<Adr | undefined>(undefined)
  const commit = (adr: Adr, next: Adr[]) => { if (!aboveOf(adr)) write(next) }
  return {
    superseding, setSuperseding, deleting, setDeleting, accepting, rejecting,
    cancelMove: () => { setAccepting(undefined); setRejecting(undefined) },
    // A verdict given to a person picked from the register writes the name they signed with (ADR-0036 §8).
    update: (adr: Adr, patch: AdrPatch) => commit(adr, updateAdr(listOf(adr), adr.id, patch, nameOf)),
    move: (adr: Adr, next: AdrStatus) => {
      if (next === 'superseded') setSuperseding(adr)
      else if (next === 'accepted') setAccepting(adr)
      else if (next === 'rejected') setRejecting(adr)
      else commit(adr, setAdrStatus(listOf(adr), adr.id, next, today()))
    },
    accept: (adr: Adr) => {
      commit(adr, movedFirst(setAdrStatus(listOf(adr), adr.id, 'accepted', today()), adr.id))
      setAccepting(undefined)
    },
    reject: (adr: Adr, reason: string) => {
      commit(adr, setAdrStatus(listOf(adr), adr.id, 'rejected', today(), { reason }))
      setRejecting(undefined)
    },
    supersede: (adr: Adr, successorId: string) => {
      commit(adr, setAdrStatus(listOf(adr), adr.id, 'superseded', today(), { supersededBy: successorId }))
      setSuperseding(undefined)
    },
    remove: (adr: Adr) => {
      commit(adr, removeAdr(listOf(adr), adr.id))
      setDeleting(undefined)
    },
  }
}

/** Where a record leads, as far as the host can go. An ancestor's has no history here: its files are in another scope's folder. */
function whereItLeads(page: AdrPageProps, selected: Adr | undefined, above: AncestorRecords | undefined) {
  const { model, onClose } = page
  const leaving = <T,>(go: ((value: T) => void) | undefined) => (go ? (value: T) => { onClose(); go(value) } : undefined)
  const toElement = leaving(page.onOpenElement)
  const toPlan = above ? undefined : leaving(page.onOpenPlan)
  const toSolution = above ? undefined : leaving(page.onOpenSolution)
  return {
    ...(page.onOpenHistory && selected && !above ? { onHistory: () => page.onOpenHistory?.(selected.id) } : {}),
    ...(page.onCopyLink && selected ? { onCopyLink: () => page.onCopyLink?.(selected.id) } : {}),
    ...(toElement ? { onElementLink: toElement } : {}),
    ...(toPlan ? { plans: { list: model.transitions ?? [], onOpen: toPlan } } : {}),
    // Derived, as the plans are: the solution names its record, and the record reads the name back (ADR-0026).
    ...(toSolution ? { solutions: { list: model.solutions ?? [], onOpen: toSolution } } : {}),
  }
}

/** The record up, with what the host offers on it. */
function OpenRecord({ selected, above, ids, listOf, subjects, changes, onWrite, onSelect, page }: {
  selected: Adr | undefined
  above: AncestorRecords | undefined
  ids: readonly string[]
  listOf: (adr: Adr) => readonly Adr[]
  subjects: readonly { id: string; name: string }[]
  changes: ReturnType<typeof useAdrChanges>
  onWrite: (id: string, at?: AdrGateItem) => void
  onSelect: (id: string | null) => void
  page: AdrPageProps
}) {
  const { s, model, onClose, onOpenScope, groupName } = page
  const subject = selected?.subjectId
  return (
    <AdrRecord
      adr={selected}
      ids={ids}
      list={selected ? listOf(selected) : []}
      locked={(page.readOnly ?? false) || above !== undefined}
      {...(above ? {
        above: {
          name: above.name || above.path || groupName || s('adr.scopeGroup'), path: above.path,
          ...(onOpenScope && selected ? { onOpen: () => { onClose(); onOpenScope(above.path, selected.id) } } : {}),
        },
      } : {})}
      {...(subject ? { about: subjects.find((one) => one.id === subject)?.name ?? subject } : {})}
      s={s}
      language={page.language}
      elements={above ? [] : model.elements}
      renderMarkdown={page.renderMarkdown}
      onSelect={onSelect}
      onWrite={(at) => { if (selected) onWrite(selected.id, at) }}
      onStatus={(next) => { if (selected) changes.move(selected, next) }}
      onDelete={() => changes.setDeleting(selected)}
      {...whereItLeads(page, selected, above)}
    />
  )
}

export function AdrPage(props: AdrPageProps) {
  const {
    open, onClose, model, ancestors = [], onProjectDecisionsChange,
    initialAdrId, initialNonce, readOnly = false, s, today, makeId,
  } = props
  const names = usePersonNames()
  const projectDecisions = useMemo(() => model.decisions ?? [], [model.decisions])
  const [view, setView] = useState<ListView>(FRESH_VIEW)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const { subjects, aboutFilter, groups, ids, folds, finding } = useAdrList(view, props)

  const allRecords = useMemo(
    () => [...ancestors.flatMap((one) => one.decisions), ...projectDecisions],
    [ancestors, projectDecisions],
  )
  const aboveOf = useCallback(
    (adr: Adr) => ancestors.find((one) => one.decisions.some((held) => held.id === adr.id)),
    [ancestors],
  )
  /** The list a record sits in, where links and the gate read it. */
  const listOf = useCallback((adr: Adr) => aboveOf(adr)?.decisions ?? projectDecisions, [aboveOf, projectDecisions])
  const selected = selectedId ? allRecords.find((a) => a.id === selectedId) : undefined
  const changes = useAdrChanges({ projectDecisions, aboveOf, listOf, write: onProjectDecisionsChange, today, nameOf: names.nameOf })
  const pen = useAdrPen({ projectDecisions, update: changes.update, write: onProjectDecisionsChange, nameOf: names.nameOf, onMade: (id) => { setView(FRESH_VIEW); setSelectedId(id) } })

  useOpening({
    open, request: { id: initialAdrId, nonce: initialNonce }, records: allRecords, selectedId, onShown: props.onShown,
    start: () => { setView(FRESH_VIEW); setSelectedId(null) },
    onto: (target) => { setView(FRESH_VIEW); setSelectedId(target.id) },
  })

  const create = (title: string, about: string, replaces?: Adr) => {
    const fresh = newAdr({
      id: makeId('adr'), number: nextAdrNumber(projectDecisions), title, date: today(), t: s,
      ...(about !== ABOUT_THE_SCOPE ? { subjectId: about } : {}),
    })
    setCreating(false)
    pen.startFresh(replaces ? { ...fresh, supersedes: [replaces.id] } : fresh)
  }

  const { writing, written } = pen
  // A record locked while it is written, by somebody else: there is nothing left to type into.
  const stillWriting = written !== undefined && !readOnly && !isAdrLocked(written)
  const onlyAbout = view.filters.about?.length === 1 ? view.filters.about[0] : undefined
  const { superseding, deleting } = changes

  return (
    <PageDialog open={open} topInset={0} onClose={onClose} aria-label={s('adr.title')}>
      <LanguageProvider language={props.language}>
        {allRecords.length === 0
          ? (
            <PageState
              state="empty"
              title={s('adr.emptyTitle', { scope: model.name || s('adr.scopeThis') })}
              body={s('adr.emptyBody')}
              {...(readOnly ? {} : { action: { label: s('adr.new'), onPress: () => setCreating(true), dataGuide: 'decisions.new' } })}
            />
          )
          : (
            <div className="adr-page">
              <div className="adr-page__inner">
                <header className="adr-page__head">
                  <h1>{s('adr.title')}</h1>
                  {!readOnly && <Button variant="primary" onClick={() => setCreating(true)} data-guide="decisions.new">{s('adr.new')}</Button>}
                </header>
                <FilterWords
                  find={view.find}
                  onFind={(find) => setView((was) => ({ ...was, find }))}
                  findLabel={s('adr.searchPlaceholder')}
                  fields={[aboutFilter]}
                  filters={view.filters}
                  onFilters={(filters) => setView((was) => ({ ...was, filters }))}
                  dataGuide="decisions.filter"
                />
                <div data-testid="adr-list">
                  <List
                    key={folds.join()}
                    label={s('adr.title')}
                    groups={groups}
                    selectedId={selectedId}
                    onOpen={setSelectedId}
                    defaultFolded={folds}
                    empty={<p className="adr-note">{finding ? s('adr.searchEmpty', { query: view.find.trim() }) : s('adr.listEmpty')}</p>}
                    dataGuide="decisions.list"
                    rowGuide="decisions.row"
                  />
                </div>
              </div>
            </div>
          )}

        <OpenRecord
          selected={selected}
          above={selected ? aboveOf(selected) : undefined}
          ids={ids}
          listOf={listOf}
          subjects={subjects}
          changes={changes}
          onWrite={pen.write}
          onSelect={setSelectedId}
          page={props}
        />

        {stillWriting && (
          <AdrWriting
            key={written.id}
            adr={written}
            list={projectDecisions}
            {...(writing?.at ? { at: writing.at } : {})}
            s={s}
            language={props.language}
            today={today}
            elements={model.elements}
            renderMarkdown={props.renderMarkdown}
            {...(props.onAddImage ? { onAddImage: props.onAddImage } : {})}
            {...(props.images ? { images: props.images } : {})}
            unsaved={writing?.fresh !== undefined}
            onSave={(patch) => pen.save(written, patch)}
            onCancel={pen.cancel}
          />
        )}

        <NewAdrDialog
          open={creating}
          subjects={[{ value: ABOUT_THE_SCOPE, label: s('adr.aboutScope') }, ...subjects.map((one) => ({ value: one.id, label: one.name }))]}
          {...(onlyAbout ? { about: onlyAbout } : {})}
          onCancel={() => setCreating(false)}
          onCreate={create}
          s={s}
        />
        <SupersedeDialog
          target={superseding}
          candidates={superseding ? listOf(superseding).filter((a) => a.id !== superseding.id && a.status === 'accepted') : []}
          onCancel={() => changes.setSuperseding(undefined)}
          onConfirm={(id) => { if (superseding) changes.supersede(superseding, id) }}
          {...(superseding && !aboveOf(superseding) ? { onWriteReplacement: () => { changes.setSuperseding(undefined); create(s('adr.replacementTitle', { name: superseding.title }), superseding.subjectId ?? ABOUT_THE_SCOPE, superseding) } } : {})}
          s={s}
        />
        <MoveDialogs
          accepting={changes.accepting} rejecting={changes.rejecting} listOf={listOf} s={s}
          onAccept={changes.accept} onReject={changes.reject}
          onCancel={changes.cancelMove}
        />
        <DeleteDialog
          target={deleting}
          onCancel={() => changes.setDeleting(undefined)}
          onConfirm={() => {
            if (!deleting) return
            changes.remove(deleting)
            if (selectedId === deleting.id) setSelectedId(null)
          }}
          s={s}
        />
      </LanguageProvider>
    </PageDialog>
  )
}
