// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The register: every application, service and platform in the organisation on
 * one page, a tab each (ADR-0012 §2, §9; ADR-0014 §2.6). The technology register
 * was a page of its own that shared this table, and a column cannot be read down
 * when it means two things; its old address lands on the Services tab.
 *
 * **Derived, and nothing commits it.** Every row is a definition somewhere in the
 * tree, every number beside it is computed from the same index, and the findings
 * column reads what the Checks page lists, so the two cannot disagree. The page
 * cannot disagree with the folders, because it is the folders.
 *
 * **Composed as every list is** (`widgets/kit/README.md`): what it shows is in the
 * address, `listed` keeps the rows, `FilterWords` and `List` draw them, and pressing
 * a row opens the `Preview`, which says what opening does in words. There is no
 * button on a row, because twenty repeated buttons are noise and two ways to open
 * told apart only by a tooltip are a trap.
 *
 * It lives in `app/organisation/` and not in `projects/ui/`: the index belongs to
 * `projects`, which may not import React. The arithmetic is `register.ts`,
 * `registerView.ts` and `projects/technologyRegister.ts`, pure and tested in node.
 */
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Language, Translate } from '../../i18n'
import { plural } from '../../i18n/strings'
import type { ElementId } from '../../model'
import type { PersonRef } from '../../model/person'
import { CHECK_LIST_WORDS, CHECK_CATALOGUE } from '../../model/checkCatalogue'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import type { TechnologyRow } from '../../projects/technologyRegister'
import type { WindowChrome } from '../../platform/windowChrome'
import { PageDialog } from '../../widgets/PageDialog'
import { usePlaceListView, usePlaceTab } from '../../widgets/placeTab'
import { Button } from '../../widgets/kit/Button'
import type { FilterChoice, FilterField } from '../../widgets/kit/FilterWords'
import { List } from '../../widgets/kit/List'
import type { ListColumn, ListGroup } from '../../widgets/kit/List'
import { useDensity } from '../../widgets/kit/density'
import { didYouMean, FRESH_VIEW, listed } from '../../widgets/kit/listView'
import type { ListHow, ListView } from '../../widgets/kit/listView'
import { Mark } from '../../widgets/kit/Mark'
import { PageState } from '../../widgets/kit/PageState'
import { Preview, PreviewFact } from '../../widgets/kit/Preview'
import { askToEdit } from '../../widgets/kit/editOnArrival'
import { RecordActions } from '../../widgets/kit/RecordActions'
import { ListPage } from '../../widgets/kit/ListPage'
import type { ListPageProps } from '../../widgets/kit/ListPage'
import { Tabs } from '../../widgets/kit/Tabs'
import { Toast } from '../../widgets/kit/Toast'
import type { ToastWords } from '../../widgets/kit/Toast'

import { useCheckMarking } from '../checkMarking'
import { FindingActions } from './FindingActions'
import type { RegisterRow } from './register'
import { applicationHow, findingsByRecord, isRegisterTab, platformHow, platformsOf, serviceHow, servicesOf, weightsOf } from './registerView'
import type { RegisterTab, RegisterWords } from './registerView'
import { coverageSentence, registerWords } from './registerWords'
import type { CheckInstance } from './treeChecks'
import './RegisterPage.css'

type Open = (scope: ScopePath, id: ElementId) => void

export type RegisterPageProps = {
  open: boolean
  onClose: () => void
  rows: readonly RegisterRow[]
  technology: readonly TechnologyRow[]
  /** Every finding the Checks page lists here: what the Findings column counts. */
  instances: readonly CheckInstance[]
  /** How many scopes are at or under this home: what the sentence over the list is out of. */
  scopes: number
  index: Pick<ScopeIndex, 'lookup' | 'assignments' | 'rowsOf' | 'units'> | undefined
  today: string
  language: Language
  scopeName: (path: ScopePath) => string
  /** What the address or a way in asked for: a tab, a record. */
  request?: { readonly tab?: string; readonly select?: string; readonly nonce: number } | undefined
  /** Open the scope that answers for a row, with the element selected: *Open on its board*. */
  onOpen?: Open
  /** Open the row's page, its record and its document: *Record page*. */
  onOpenPage?: Open
  /** A row two scopes both define: open the scope that should yield, with *Link* pending (ADR-0012 §10). */
  onLink?: (scope: ScopePath, id: ElementId, to: ScopePath) => void
  /** Who would be stranded if this went: the service's report, or the platform's. */
  onReport?: (kind: 'service' | 'platform', scope: ScopePath, id: ElementId) => void
  /** The check in Checks, on this finding. */
  onSeeInChecks?: (instance: CheckInstance) => void
  /** Nothing yet: where a first step is. */
  onHome?: () => void
  readOnly?: boolean
  personName?: (ref: PersonRef) => string
  s: Translate
  windowChrome?: WindowChrome
}

/** A column with what its cell draws. */
type Drawn<R> = ListColumn & { readonly cell: (row: R) => ReactNode; readonly startsHidden?: boolean }

type Shown = RegisterRow | TechnologyRow

/** The mark and the count of each weight on a row; notes stay in the preview, since they may well be intended. */
function Weights({ held, s }: { held: readonly CheckInstance[] | undefined; s: Translate }) {
  const { fix, review } = weightsOf(held)
  return (
    <span className="org-weights">
      {fix > 0 && <span className="org-weights__one"><Mark kind="fix" label={s('check.weight.fix')} />{fix}</span>}
      {review > 0 && <span className="org-weights__one"><Mark kind="review" label={s('check.weight.review')} />{review}</span>}
    </span>
  )
}

function applicationColumns(words: RegisterWords, found: ReadonlyMap<string, readonly CheckInstance[]>, s: Translate): readonly Drawn<RegisterRow>[] {
  const keptIn = (row: RegisterRow) => (row.master !== undefined ? words.scopeName(row.master) : words.nobody)
  return [
    { id: 'master', label: s('register.colMaster'), sortable: true, guide: 'register.colMaster', cell: keptIn },
    { id: 'category', label: s('register.colCategory'), sortable: true, cell: (row) => row.category },
    { id: 'lifecycle', label: s('register.colLifecycle'), sortable: true, cell: (row) => words.lifecycle(row) },
    { id: 'owner', label: s('register.colOwner'), sortable: true, cell: (row) => words.owner(row) },
    { id: 'vendor', label: s('register.colVendor'), sortable: true, startsHidden: true, cell: (row) => row.vendor },
    { id: 'technology', label: s('register.colTechnology'), sortable: true, startsHidden: true, cell: (row) => row.technology },
    { id: 'drawn', label: s('register.colDrawn'), sortable: true, startsHidden: true, guide: 'register.colDrawn', cell: (row) => (row.drawnIn.length > 0 ? row.drawnIn.map(words.scopeName).join(', ') : s('register.drawnNowhere')) },
    { id: 'findings', label: s('register.colFindings'), sortable: true, width: 'minmax(64px, 96px)', guide: 'register.colFindings', cell: (row) => <Weights held={found.get(row.id)} s={s} /> },
  ]
}

function serviceColumns(words: RegisterWords, found: ReadonlyMap<string, readonly CheckInstance[]>, s: Translate): readonly Drawn<TechnologyRow>[] {
  const offered = (row: TechnologyRow) => (found.get(row.id) ?? []).some((one) => one.key === 'check.offeredNotShared')
  const keptIn = (row: TechnologyRow) => (row.master !== undefined ? words.scopeName(row.master) : words.nobody)
  return [
    { id: 'master', label: s('register.colMaster'), sortable: true, startsHidden: true, guide: 'technologyRegister.colMaster', cell: keptIn },
    { id: 'maintained', label: s('register.colMaintained'), sortable: true, cell: words.maintainedBy },
    { id: 'shared', label: s('techRegister.colShared'), sortable: true, cell: (row) => words.shared(row, offered(row)) },
    { id: 'used', label: s('register.colUsed'), sortable: true, startsHidden: true, cell: (row) => usedBy(row, s) },
    { id: 'delivered', label: s('register.colDelivered'), sortable: true, cell: words.deliveredBy },
    { id: 'findings', label: s('register.colFindings'), sortable: true, width: 'minmax(64px, 96px)', guide: 'technologyRegister.colFindings', cell: (row) => <Weights held={found.get(row.id)} s={s} /> },
  ]
}

function platformColumns(words: RegisterWords, found: ReadonlyMap<string, readonly CheckInstance[]>, s: Translate): readonly Drawn<TechnologyRow>[] {
  const keptIn = (row: TechnologyRow) => (row.master !== undefined ? words.scopeName(row.master) : words.nobody)
  return [
    { id: 'archetype', label: s('register.colArchetype'), sortable: true, cell: words.archetype },
    { id: 'partOf', label: s('register.colPartOf'), sortable: true, cell: words.partOf },
    { id: 'hosts', label: s('register.colHosts'), sortable: true, width: 'minmax(64px, 120px)', cell: (row) => row.hosts },
    { id: 'delivers', label: s('register.colDelivers'), sortable: true, cell: words.delivers },
    { id: 'master', label: s('register.colMaster'), sortable: true, startsHidden: true, guide: 'technologyRegister.colMaster', cell: keptIn },
    { id: 'findings', label: s('register.colFindings'), sortable: true, width: 'minmax(64px, 96px)', guide: 'technologyRegister.colFindings', cell: (row) => <Weights held={found.get(row.id)} s={s} /> },
  ]
}

function usedBy(row: TechnologyRow, s: Translate): string {
  const { applications, scopes } = row.consumers
  // Counted words each, so one application in one scope does not read as plural.
  return s('register.usedBy', {
    applications: plural(s, { one: 'register.applicationsOne', other: 'register.applicationsOther' }, applications),
    scopes: plural(s, { one: 'register.scopesOne', other: 'register.scopesOther' }, scopes),
  })
}

function filterFields(tab: RegisterTab, rows: readonly Shown[], words: RegisterWords, s: Translate): readonly FilterField[] {
  const findings: FilterField = {
    id: 'findings', label: s('register.colFindings'),
    options: [{ value: 'yes', label: s('register.withFindings') }, { value: 'no', label: s('register.withoutFindings') }],
  }
  if (tab === 'applications') {
    const apps = rows as readonly RegisterRow[]
    const distinct = (read: (row: RegisterRow) => string | undefined) => [...new Set(apps.map(read).filter((one): one is string => Boolean(one)))].sort()
    return [
      { id: 'lifecycle', label: s('register.colLifecycle'), options: (['planned', 'live', 'retiring', 'retired'] as const).map((value) => ({ value, label: s(`lifecycle.${value}`) })) },
      {
        id: 'owner', label: s('register.colOwner'), options: [
          { value: 'nobody', label: s('register.nobody') }, { value: 'unit', label: s('register.ownerIsUnit') },
          { value: 'named', label: s('register.ownerIsName') }, { value: 'outside', label: s('register.ownerIsOutside') },
        ],
      },
      { id: 'category', label: s('register.colCategory'), options: distinct((row) => row.category).map((value) => ({ value, label: value })) },
      { id: 'master', label: s('register.colMaster'), options: distinct((row) => row.master).map((value) => ({ value, label: words.scopeName(value) })) },
      findings,
    ]
  }
  if (tab === 'services') {
    return [
      { id: 'shared', label: s('techRegister.colShared'), options: [
        { value: 'shared', label: s('techRegister.shared') }, { value: 'offered', label: s('register.notMarkedShared') }, { value: 'own', label: s('techRegister.ownTeam') },
      ] },
      { id: 'delivered', label: s('register.colDelivered'), options: [{ value: 'yes', label: s('register.deliveredYes') }, { value: 'no', label: s('register.nothing') }] },
      findings,
    ]
  }
  return [
    { id: 'archetype', label: s('register.colArchetype'), options: (['place', 'service', 'network'] as const).map((value) => ({ value, label: s(`platformArchetype.${value}`) })) },
    findings,
  ]
}

function groupChoices(tab: RegisterTab, s: Translate): readonly FilterChoice[] {
  const master = { id: 'master', label: s('register.colMaster') }
  const findings = { id: 'findings', label: s('register.colFindings') }
  if (tab === 'applications') return [master, { id: 'category', label: s('register.colCategory') }, { id: 'lifecycle', label: s('register.colLifecycle') }, { id: 'owner', label: s('register.colOwner') }, findings]
  if (tab === 'services') return [master, { id: 'maintained', label: s('register.colMaintained') }, findings]
  return [{ id: 'archetype', label: s('register.colArchetype') }, master, { id: 'partOf', label: s('register.colPartOf') }, findings]
}

const EMPTY_TITLE = { applications: 'register.emptyTitle', services: 'register.emptyServices', platforms: 'register.emptyPlatforms' } as const
const ITEM_LABEL = { applications: 'register.colName', services: 'register.colService', platforms: 'register.colPlatform' } as const
/** Under twelve rows there is nothing to narrow, so Filter and Group stay away; which columns show is still asked of View. */
const FEW = 12

/** What the register says over its list: a `ListPage`'s head. */
type RegisterHead = Pick<ListPageProps, 'title' | 'about' | 'tabs' | 'testId' | 'headTestId'>

function RegisterList<R extends Shown>({ head, tab, rows, how, columns, view, setView, words, s }: {
  head: RegisterHead
  tab: RegisterTab; rows: readonly R[]; how: ListHow<R>; columns: readonly Drawn<R>[]; view: ListView; setView: (next: ListView) => void
  words: RegisterWords; s: Translate
}) {
  const [density, setDensity] = useDensity()
  const shownIds = view.columns ?? columns.filter((column) => !column.startsHidden).map((column) => column.id)
  const shownColumns = columns.filter((column) => shownIds.includes(column.id))
  // Find covers every shown column, the hidden ones too since what they hold can be asked for.
  const groups = useMemo(() => listed(rows, view, how), [rows, view, how])
  const drawn = useMemo<readonly ListGroup[]>(() => groups.map((group) => ({
    id: group.id, label: group.label,
    rows: group.rows.map((row) => ({
      id: row.id, text: row.name,
      cells: Object.fromEntries(shownColumns.map((column) => [column.id, <span key={column.id} className="org-cell">{column.cell(row)}</span>])),
    })),
  })), [groups, shownColumns])
  const count = groups.reduce((sum, group) => sum + group.rows.length, 0)
  const few = rows.length < FEW && Object.keys(view.filters).length === 0 && !view.group
  const named = tab === 'applications' ? 'register' : 'technologyRegister'
  const nearest = view.find && count === 0 ? didYouMean(view.find, rows.flatMap((row) => how.words(row))) : null
  return (
    <ListPage
      {...head}
      filter={{
        find: view.find, onFind: (find) => setView({ ...view, find }), findLabel: s('register.find'),
        ...(few ? {} : {
          fields: filterFields(tab, rows, words, s), filters: view.filters, onFilters: (filters: ListView['filters']) => setView({ ...view, filters }),
          groups: groupChoices(tab, s), group: view.group, onGroup: (group: string | null) => setView({ ...view, group }),
        }),
        columns: columns.map(({ id, label }) => ({ id, label })), shownColumns: shownIds, onColumns: (next) => setView({ ...view, columns: next }),
        density, onDensity: setDensity, onReset: () => setView(FRESH_VIEW),
        shown: { count, total: rows.length },
      }}
      listTestId={tab === 'applications' ? 'register-table' : 'technology-register-table'}
    >
      <List
        label={s(ITEM_LABEL[tab])} groups={drawn} density={density} columns={shownColumns} itemLabel={s(ITEM_LABEL[tab])} itemSortable
        sort={view.sort ?? { column: '', descending: false }} onSort={(sort) => setView({ ...view, sort: sort.column === '' && !sort.descending ? null : sort })}
        selectedId={view.select} onOpen={(id) => setView({ ...view, select: id })}
        rowGuide={`${named}.row`}
        empty={(
          <p className="org-page__nomatch" role="status">
            {s('register.noMatchAll', { query: view.find.trim() })}{' '}
            {nearest && <Button variant="quiet" onClick={() => setView({ ...view, find: nearest })}>{s('register.didYouMean', { word: nearest })}</Button>}
            <Button variant="quiet" onClick={() => setView({ ...view, find: '', filters: {} })}>{s('register.clearFind')}</Button>
          </p>
        )}
      />
    </ListPage>
  )
}

/** What is known of a record, beside its findings. */
function factsOf(tab: RegisterTab, row: Shown, words: RegisterWords, s: Translate): ReactNode {
  const fact = (label: string, value: ReactNode) => (value === undefined || value === '' ? null : <PreviewFact key={label} label={label}>{value}</PreviewFact>)
  const kept = fact(s('register.colMaster'), row.master !== undefined ? words.scopeName(row.master) : words.nobody)
  const drawn = fact(s('register.colDrawn'), row.drawnIn.length > 0 ? row.drawnIn.map(words.scopeName).join(', ') : s('register.drawnNowhere'))
  if (tab === 'applications') {
    const app = row as RegisterRow
    return (
      <>
        {kept}
        {fact(s('register.colOwner'), words.owner(app))}
        {fact(s('register.colCategory'), app.category)}
        {fact(s('register.colLifecycle'), words.lifecycle(app))}
        {fact(s('register.colVendor'), app.vendor)}
        {fact(s('register.colTechnology'), app.technology)}
        {fact(s('register.colHostedOn'), app.hostedOn?.join(', '))}
        {fact(s('register.colUses'), app.uses?.join(', '))}
        {drawn}
      </>
    )
  }
  const tech = row as TechnologyRow
  if (tab === 'services') {
    return (
      <>
        {kept}
        {fact(s('register.colMaintained'), words.maintainedBy(tech))}
        {fact(s('register.colUsed'), usedBy(tech, s))}
        {fact(s('register.colDelivered'), words.deliveredBy(tech))}
        {drawn}
      </>
    )
  }
  return (
    <>
      {kept}
      {fact(s('register.colArchetype'), words.archetype(tech))}
      {fact(s('register.colPartOf'), words.partOf(tech))}
      {fact(s('register.colHosts'), tech.hosts)}
      {fact(s('register.colDelivers'), words.delivers(tech))}
      {tech.service && fact(s('register.colForService'), tech.service.name)}
      {tech.maintainers.length > 0 && fact(s('register.colMaintained'), words.maintainedBy(tech))}
      {drawn}
    </>
  )
}

export function RegisterPage(props: RegisterPageProps) {
  const { open, onClose, rows, technology, instances, scopes, index, today, language, scopeName, request, onOpen, onOpenPage, onLink, onReport, onSeeInChecks, onHome, s } = props
  const readOnly = props.readOnly ?? false
  const [rawTab, setRawTab] = usePlaceTab('applications', 'register')
  const tab: RegisterTab = isRegisterTab(rawTab) ? rawTab : 'applications'
  const [view, setView] = usePlaceListView('register')
  const marking = useCheckMarking()
  const [toast, setToast] = useState<ToastWords | null>(null)

  // A way in to a tab or a record: asked once per request.
  useEffect(() => {
    if (!request) return
    if (request.tab) setRawTab(request.tab)
    if (request.select !== undefined) setView({ ...view, select: request.select })
    // Only on a request: the view changing must not ask again.
  }, [request?.nonce])

  const found = useMemo(() => findingsByRecord(instances), [instances])
  const words = useMemo(() => registerWords(s, language, scopeName, props.personName), [s, language, scopeName, props.personName])
  const applicationsHow = useMemo(() => applicationHow(words, found, language), [words, found, language])
  const servicesHow = useMemo(() => serviceHow(words, found, language), [words, found, language])
  const platformsHow = useMemo(() => platformHow(words, found, language), [words, found, language])
  const services = useMemo(() => servicesOf(technology), [technology])
  const platforms = useMemo(() => platformsOf(technology), [technology])
  const shown = ({ applications: rows, services, platforms } satisfies Record<RegisterTab, readonly Shown[]>)[tab] as readonly Shown[]

  const ids = useMemo(() => {
    const how: Record<RegisterTab, unknown> = { applications: applicationsHow, services: servicesHow, platforms: platformsHow }
    return listed(shown, view, how[tab] as ListHow<Shown>).flatMap((group) => group.rows.map((row) => row.id))
  }, [shown, view, tab, applicationsHow, servicesHow, platformsHow])
  const current = view.select !== null ? shown.find((row) => row.id === view.select) : undefined
  const nothingAtAll = rows.length === 0 && technology.length === 0
  const chooseTab = (next: string) => {
    setRawTab(next)
    // Another list: what narrowed this one means nothing there.
    setView(FRESH_VIEW)
  }

  // The register's head, the same over its list and over a tab with nothing in it yet.
  const head: RegisterHead = {
    title: s('register.title'), testId: 'register-page', headTestId: tab === 'applications' ? 'register-topbar' : 'technology-register-topbar',
    about: <span data-testid="register-findings">{coverageSentence(tab, rows, technology, scopes, s)}</span>,
    ...(nothingAtAll ? {} : {
      tabs: (
        <Tabs
          label={s('register.title')} value={tab} onChange={chooseTab} data-guide="register.tabs"
          items={[
            { value: 'applications', label: s('register.tabApplications'), count: rows.length },
            { value: 'services', label: s('register.tabServices'), count: services.length },
            { value: 'platforms', label: s('register.tabPlatforms'), count: platforms.length },
          ]}
        />
      ),
    }),
  }
  return (
    <PageDialog open={open} onClose={onClose} aria-label={s('register.title')}>
      {nothingAtAll || shown.length === 0 ? (
        <ListPage {...head}>
          <PageState
            state="empty" title={s(EMPTY_TITLE[tab])} body={s('register.emptyBody')}
            {...(onHome ? { action: { label: s('register.emptyGo'), onPress: onHome } } : {})}
          />
        </ListPage>
      ) : tab === 'applications' ? (
        <RegisterList head={head} tab={tab} rows={rows} how={applicationsHow} columns={applicationColumns(words, found, s)} view={view} setView={setView} words={words} s={s} />
      ) : tab === 'services' ? (
        <RegisterList head={head} tab={tab} rows={services} how={servicesHow} columns={serviceColumns(words, found, s)} view={view} setView={setView} words={words} s={s} />
      ) : (
        <RegisterList head={head} tab={tab} rows={platforms} how={platformsHow} columns={platformColumns(words, found, s)} view={view} setView={setView} words={words} s={s} />
      )}
      <RecordPreview
        tab={tab} ids={ids} current={current} words={words} onSelect={(id) => setView({ ...view, select: id })} s={s}
        onOpen={onOpen} onOpenPage={onOpenPage} onReport={onReport} readOnly={readOnly}
      >
        {current && (
          <RecordFindings
            held={found.get(current.id) ?? []} index={index} marking={readOnly ? undefined : marking} today={today}
            onLink={readOnly ? undefined : onLink} onSeeInChecks={onSeeInChecks} onFixed={(done) => setToast({ key: Date.now(), message: done.message, undo: { onPress: done.back, shared: true } })} s={s}
          />
        )}
      </RecordPreview>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </PageDialog>
  )
}

const LIST_WORD = { applications: 'register.listApplications', services: 'register.listServices', platforms: 'register.listPlatforms' } as const

/** A record, large: its facts and findings, and the ways on from it said in words. */
function RecordPreview({ tab, ids, current, words, onSelect, onOpen, onOpenPage, onReport, readOnly, children, s }: {
  tab: RegisterTab; ids: readonly string[]; current: Shown | undefined; words: RegisterWords
  onSelect: (id: string | null) => void; onOpen: Open | undefined; onOpenPage: Open | undefined; onReport: RegisterPageProps['onReport']; readOnly: boolean; children: ReactNode; s: Translate
}) {
  const master = current?.master
  const openGuide = tab === 'applications' ? 'register.openRow' : 'technologyRegister.openRow'
  return (
    <Preview
      ids={ids} currentId={current ? current.id : null} onSelect={onSelect} title={current?.name ?? ''} listWord={s(LIST_WORD[tab])}
      facts={current ? factsOf(tab, current, words, s) : undefined}
      {...(current && master !== undefined && onOpenPage ? { openFull: { onPress: () => onOpenPage(master, current.id), testId: `register-page-${current.id}` } } : {})}
      {...(current && master !== undefined ? {
        actions: (
          <RecordActions
            // A record's text and facts are written on its page: ✎ Edit opens it there, already writing.
            {...(onOpenPage && !readOnly ? { edit: { onPress: () => { askToEdit('document', current.id); onOpenPage(master, current.id) }, testId: `register-edit-${current.id}` } } : {})}
            verbs={(
              <>
                {tab !== 'applications' && onReport && (
                  <Button variant="quiet" onClick={() => onReport(tab === 'services' ? 'service' : 'platform', master, current.id)} data-testid="register-report">
                    {s(tab === 'services' ? 'register.serviceReport' : 'register.platformReport')}
                  </Button>
                )}
                {onOpen && <Button variant="quiet" data-guide={openGuide} data-testid={`register-open-${current.id}`} onClick={() => onOpen(master, current.id)}>{s('register.openOnBoard')}</Button>}
              </>
            )}
          />
        ),
      } : {})}
    >
      {children}
    </Preview>
  )
}

/** What the checks say about one record, each with what puts it right and the way to its check. */
function RecordFindings({ held, index, marking, today, onLink, onSeeInChecks, onFixed, s }: {
  held: readonly CheckInstance[]; index: RegisterPageProps['index']; marking: ReturnType<typeof useCheckMarking>; today: string
  onLink: RegisterPageProps['onLink']; onSeeInChecks: RegisterPageProps['onSeeInChecks']; onFixed: Parameters<typeof FindingActions>[0]['onFixed']; s: Translate
}) {
  if (held.length === 0) return <p className="org-cell-quiet">{s('register.noFindings')}</p>
  return (
    <>
      {held.map((one) => {
        const entry = CHECK_CATALOGUE[one.key]
        return (
          <div className="org-finding" key={one.id} data-finding={one.attributes['data-finding']}>
            <div className="org-finding__line"><Mark kind={entry.weight} label={s(CHECK_LIST_WORDS.weight[entry.weight].name)} /><span>{one.text}</span></div>
            <p className="org-finding__why">{s(entry.why)}</p>
            <span className="org-finding__acts">
              {index && (
                <FindingActions instance={one} index={index} marking={marking} today={today} {...(onLink ? { onLink } : {})} onFixed={onFixed} s={s} />
              )}
              {onSeeInChecks && <Button variant="quiet" onClick={() => onSeeInChecks(one)}>{s('register.seeInChecks')}</Button>}
            </span>
          </div>
        )
      })}
    </>
  )
}
