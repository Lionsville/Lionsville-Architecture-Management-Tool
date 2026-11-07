// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The Checks page: a work list over a home (ADR-0036, amended 11 October 2026 and
 * for 4.0.0). What was found comes first, fixes before reviews before notes, and
 * it opens on the first fix. Found nothing folds into one line, and grouped by
 * category every check is there, because a check that finds nothing is still worth
 * knowing about. The notes fold, remembered for the session, as in every list.
 *
 * **Picking a check** shows what the catalogue says of it and what is found of it:
 * Found, one line per finding, naming the subject alone since the check names the
 * problem, grouped by what the check knows; and Accepted, what was marked, each with
 * its reason, its day and *Take back*. Pressing a finding shows what puts it right
 * in the row: its one-field fix where it has one, and the way to where it is fixed,
 * with a band that carries the finding along (`FindingBand`).
 *
 * **Marking is ticks and one reason**, with the explanation still in view, one step
 * in each scope that keeps them. One dialog per finding is why none was ever marked
 * at the size findings come in. A fix has no box: a contradiction cannot be accepted.
 * A reader sees no boxes, and an agent reads marks and makes none.
 *
 * What only an open scope can work out is not counted here
 * (`treeChecks.FOUND_WHERE_OPEN`), and the page says so in words with a way there.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { StringKey, Translate } from '../../i18n'
import { CHECK_CATEGORY_LABEL, CHECK_LIST_WORDS, CHECK_WEIGHT_LABEL, CHECK_WEIGHTS } from '../../model/checkCatalogue'
import type { CheckKey, CheckWeight } from '../../model/checkCatalogue'
import { CHECK_MARK_WORDS, checkMarkId } from '../../model/checkMarks'
import type { KeptCheckMark } from '../../model/checkMarks'
import type { ScopeIndex } from '../../projects/scopeIndex'
import { ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import type { WindowChrome } from '../../platform/windowChrome'
import { useStrings } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { PageDialog } from '../../widgets/PageDialog'
import { usePlaceListView, usePlaceTab } from '../../widgets/placeTab'
import { useSessionSet } from '../../widgets/sessionMemory'
import { Button } from '../../widgets/kit/Button'
import { FilterWords } from '../../widgets/kit/FilterWords'
import { TextInput } from '../../widgets/kit/Field'
import { List } from '../../widgets/kit/List'
import type { ListColumn, ListGroup, ListRow } from '../../widgets/kit/List'
import { useListDensity } from '../../widgets/kit/listDensity'
import { listed } from '../../widgets/kit/listView'
import type { ListView } from '../../widgets/kit/listView'
import { Mark } from '../../widgets/kit/Mark'
import { MenuButton } from '../../widgets/kit/Menu'
import { PageState } from '../../widgets/kit/PageState'
import { Panel, PanelSection } from '../../widgets/kit/Panel'
import { Toast } from '../../widgets/kit/Toast'
import type { ToastWords } from '../../widgets/kit/Toast'
import { useCheckMarking } from '../checkMarking'
import type { CheckMarking } from '../checkMarking'
import { firstCheck, foundGroups, heldByTwo, WORK_GROUPS, workSections } from './checksView'
import type { WorkGroup, WorkSection } from './checksView'
import { FindingActions } from './FindingActions'
import type { FindingActionsProps, FixDone } from './FindingActions'
import { weightCount } from './NeedsAttention'
import type { CheckInstance, CheckPlace, CheckRow } from './treeChecks'
import './RegisterPage.css'
import './ChecksPage.css'

export type ChecksPageProps = {
  open: boolean
  onClose: () => void
  /** Every check by category, with what is found of it and what was marked (`treeChecks.checksByCategory`). */
  rows: readonly { category: CheckRow['entry']['category']; rows: readonly CheckRow[] }[]
  /** What is found, by weight: the sentence in the head. */
  counts: Readonly<Record<CheckWeight, number>>
  /** What the page was asked to pick — a check's key — by a count on the home, a link or an agent, and the finding to come back to. */
  request?: { readonly select?: string; readonly finding?: string; readonly nonce?: number } | undefined
  /** Where the session keeps whether the notes are unfolded: the home's. */
  remember: string
  /** The home this page is over, and every scope it could be over instead. */
  at?: ScopePath
  scopes?: readonly { readonly path: ScopePath; readonly name: string; readonly depth: number }[]
  onScope?: (path: ScopePath) => void
  scopeName: (path: ScopePath) => string
  index?: Pick<ScopeIndex, 'lookup' | 'assignments' | 'rowsOf' | 'units'> | undefined
  today?: string
  /** Go where an instance is fixed. The check and the instance start the walk through it. */
  onGo: (place: CheckPlace, row?: CheckRow, instance?: CheckInstance) => void
  onLink?: ((scope: ScopePath, id: string, to: ScopePath) => void) | undefined
  /** What the fixes that make a record need. */
  fixes?: Pick<FindingActionsProps, 'makeId' | 'people' | 'modelOf'>
  /** Open this home's scope: where the checks only it can work out are counted. */
  onOpenScope?: (() => void) | undefined
  s: Translate
  windowChrome?: WindowChrome
}

const SECTION_FOLDED: ReadonlySet<WorkSection['kind']> = new Set(['note', 'nothing', 'notCounted'])
/** The set's word that the person unfolded the notes for this session. */
const NOTES_OPEN = 'notesOpen'
const WORK_FIELD = 'by'

const toWeight = (key: WorkGroup, s: Translate) => s(`checks.group.${key}`)

function sectionLabel(section: WorkSection, scopeName: (path: ScopePath) => string, s: Translate): string {
  switch (section.kind) {
    case 'fix': case 'review': case 'note': return s(`checks.section.${section.kind}`)
    case 'nothing': return s('checks.section.nothing')
    case 'notCounted': return s('checks.section.notCounted')
    case 'category': return s(CHECK_CATEGORY_LABEL[section.category ?? 'landscape'])
    case 'scope': return scopeName(section.scope ?? ROOT_SCOPE)
    case 'all': return ''
  }
}

/** The sentence in the head: what there is to do, and where most of it is. */
function workSentence(counts: Readonly<Record<CheckWeight, number>>, reviews: readonly CheckRow[], s: Translate): string {
  const parts = CHECK_WEIGHTS.filter((weight) => counts[weight] > 0).map((weight) => {
    const said = weightCount(weight, counts[weight], s)
    const held = weight === 'review' ? heldByTwo(reviews) : undefined
    return held !== undefined ? s('checks.heldByTwo', { said, held }) : said
  })
  return parts.length > 0 ? `${parts.join('. ')}.` : s('checks.nothing')
}

/** A reason, and the press that marks: the explanation stays in view while deciding. */
function MarkForm({ count, onMark, onCancel, s }: { count: number; onMark: (reason: string) => void; onCancel?: () => void; s: Translate }) {
  const [reason, setReason] = useState('')
  return (
    <span className="checks-mark" data-testid="checks-mark-form">
      <span className="checks-mark__reason">
        <TextInput aria-label={s(CHECK_MARK_WORDS.reason)} placeholder={s(CHECK_MARK_WORDS.reason)} value={reason} onChange={(event) => setReason(event.target.value)} />
      </span>
      <Button variant="primary" data-guide="findings.markIntended" data-testid="checks-mark" onClick={() => onMark(reason)}>{s('checks.markN', { count })}</Button>
      {onCancel && <Button variant="quiet" onClick={onCancel}>{s('common.cancel')}</Button>}
      <span className="checks-mark__returns">{s('checks.markReturns')}</span>
    </span>
  )
}

/** What the rows of a found list name, for the heading over them. */
function subjectWord(row: CheckRow, index: ChecksPageProps['index']): StringKey {
  const first = row.shown[0]
  // A line is named by what it says, and an element is only where it starts.
  const about = first && 'subject' in first.finding && first.finding.subject === 'relation' ? undefined : first?.about
  switch (about !== undefined ? index?.lookup(about)?.kind : undefined) {
    case 'application': return 'register.colName'
    case 'actor': return 'checks.colUnit'
    case 'platform': return 'register.colPlatform'
    case 'platformService': return 'register.colService'
    default: return 'checks.colSubject'
  }
}

/** Everything found of one check, as the shared list. */
function FoundList({ row, view, setView, ask, marking, index, today, onGo, onLink, fixes, onFixed, onMarked, scopeName, s }: {
  row: CheckRow; view: ListView; setView: (next: ListView) => void; ask: string | undefined; marking: CheckMarking | undefined
  index: ChecksPageProps['index']; today: string; onGo: ChecksPageProps['onGo']; onLink: ChecksPageProps['onLink']; fixes: ChecksPageProps['fixes']
  onFixed: (done: FixDone) => void; onMarked: (marks: readonly KeptCheckMark[]) => void; scopeName: (path: ScopePath) => string; s: Translate
}) {
  const [density] = useListDensity()
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set())
  const [pressed, setPressed] = useState<string | null>(ask ?? null)
  const [marking1, setMarking1] = useState(false)
  useEffect(() => { setTicked(new Set()); setPressed(ask ?? null) }, [row.key, ask])
  useEffect(() => setMarking1(false), [pressed])
  const fix = row.entry.weight === 'fix'
  const markable = (one: CheckInstance) => !fix && marking?.markableIn(one.finding, one.checkedIn) !== undefined
  const canTick = row.shown.some(markable)
  const how = useMemo(() => ({
    words: (one: CheckInstance) => [one.subject ?? one.text, one.text, one.under ?? '', one.scope !== undefined ? scopeName(one.scope) : '', one.role ?? '', one.unitType ?? ''],
    groupBy: {
      role: (one: CheckInstance) => ({ id: one.role ?? '', label: one.role ?? '' }),
      unitType: (one: CheckInstance) => ({ id: one.unitType ?? '', label: one.unitType ?? '' }),
      master: (one: CheckInstance) => ({ id: one.scope ?? '', label: one.scope !== undefined ? scopeName(one.scope) : '' }),
    },
    sortBy: { '': (one: CheckInstance) => one.subject ?? one.text, under: (one: CheckInstance) => one.under ?? null, master: (one: CheckInstance) => (one.scope !== undefined ? scopeName(one.scope) : null) },
  }), [scopeName])
  const groups = useMemo(() => listed(row.shown, view, how), [row.shown, view, how])
  const hasUnder = row.shown.some((one) => one.under !== undefined)
  const columns: readonly ListColumn[] = [
    ...(hasUnder ? [{ id: 'under', label: s('checks.colUnder'), sortable: true }] : []),
    { id: 'master', label: s('register.colMaster'), sortable: true },
  ]
  const anyWithoutSubject = row.shown.some((one) => one.subject === undefined)
  const mark = (some: readonly CheckInstance[], reason: string) => {
    if (!marking) return
    void marking.markAll(some.map(({ finding, checkedIn }) => ({ finding, checkedIn })), reason).then((made) => {
      setTicked(new Set())
      setMarking1(false)
      if (made.length > 0) onMarked(made)
      return undefined
    })
  }
  const drawn: readonly ListGroup[] = groups.map((group) => ({
    id: group.id, label: group.label,
    rows: group.rows.map((one): ListRow => ({
      id: one.id, text: one.subject ?? one.text, attributes: one.attributes,
      cells: { under: one.under, master: one.scope !== undefined ? scopeName(one.scope) : undefined },
      actions: (
        <span className="org-finding" data-testid="checks-row-actions">
          <p className="checks-page__text">{one.text}</p>
          <span className="org-finding__acts">
            {index && (
              <FindingActions
                instance={one} index={index} marking={marking} today={today} onOpen={(held) => held.opens && onGo(held.opens, row, held)}
                {...(onLink ? { onLink } : {})} {...fixes} onFixed={onFixed} s={s}
              />
            )}
            {markable(one) && !marking1 && <Button data-guide="findings.markIntended" onClick={() => setMarking1(true)}>{s(CHECK_MARK_WORDS.open)}</Button>}
          </span>
          {markable(one) && marking1 && <MarkForm count={1} onMark={(reason) => mark([one], reason)} onCancel={() => setMarking1(false)} s={s} />}
        </span>
      ),
    })),
  }))
  const choices = foundGroups(row.shown).map((id) => ({ id, label: s(`checks.foundBy.${id}`) }))
  const count = groups.reduce((sum, group) => sum + group.rows.length, 0)
  return (
    <div data-testid="checks-instances">
      <FilterWords
        find={view.find} onFind={(find) => setView({ ...view, find })} findLabel={s('checks.findIn', { count: row.shown.length })}
        {...(choices.length > 0 ? { groups: choices, group: view.group, onGroup: (group: string | null) => setView({ ...view, group }) } : {})}
        shown={{ count, total: row.shown.length }}
      />
      <List
        label={s('checks.foundLabel')} groups={drawn} wrap={anyWithoutSubject} density={density} columns={columns} itemLabel={s(subjectWord(row, index))} itemSortable
        sort={view.sort} onSort={(sort) => setView({ ...view, sort })} selectedId={pressed} onOpen={(id) => setPressed((was) => (was === id ? null : id))}
        rowGuide="checks.instance"
        {...(canTick ? {
          checked: ticked, onCheckedChange: setTicked,
          bulkActions: <MarkForm count={ticked.size} onMark={(reason) => mark(row.shown.filter((one) => ticked.has(one.id) && markable(one)), reason)} s={s} />,
        } : {})}
        empty={<p className="org-page__nomatch" role="status">{s('checks.noneMatch')}</p>}
      />
    </div>
  )
}

/**
 * What was marked as intended under one check, as the same list Found is: one line
 * a finding, its reason and day beside it, and *Take back* with the sentence once
 * the line is pressed rather than a button on every line.
 */
function AcceptedList({ row, index, marking, scopeName, s }: {
  row: CheckRow; index: ChecksPageProps['index']; marking: CheckMarking | undefined; scopeName: (path: ScopePath) => string; s: Translate
}) {
  const { language } = useStrings()
  const [density] = useListDensity()
  const [pressed, setPressed] = useState<string | null>(null)
  const rows = row.marked.map(({ instance, mark, keptIn }): ListRow => {
    const takeBack = marking?.mayTakeBack(keptIn) ? () => { void marking.takeBack({ scope: keptIn, mark }) } : undefined
    return {
      id: `${keptIn}\u0000${checkMarkId(mark)}\u0000${instance.id}`, text: instance.subject ?? instance.text,
      cells: {
        reason: <span data-testid="accepted-reason">{mark.reason ? `\u201c${mark.reason}\u201d` : s(CHECK_MARK_WORDS.noReason)}</span>,
        on: formatDay(mark.on, language),
        master: instance.scope !== undefined ? scopeName(instance.scope) : undefined,
      },
      actions: (
        <span className="org-finding">
          <p className="checks-page__text">{instance.text}</p>
          {takeBack && (
            <span className="org-finding__acts">
              <Button data-guide="findings.takeBack" data-testid="finding-take-back" onClick={takeBack}>{s(CHECK_MARK_WORDS.takeBack)}</Button>
            </span>
          )}
        </span>
      ),
    }
  })
  const columns: readonly ListColumn[] = [
    { id: 'reason', label: s('checks.colReason') },
    { id: 'on', label: s('checks.colMarked'), width: 'minmax(96px, 140px)' },
    { id: 'master', label: s('register.colMaster') },
  ]
  return (
    <div data-testid="checks-accepted">
      <List
        label={s('checks.tabAccepted')} groups={[{ id: 'all', label: '', rows }]} density={density} columns={columns} itemLabel={s(subjectWord(row, index))}
        selectedId={pressed} onOpen={(id) => setPressed((was) => (was === id ? null : id))}
      />
    </div>
  )
}

/** The check picked: what the catalogue says of it, what is found, and what was marked as intended. */
function CheckReader({ row, tab, setTab, view, setView, finding, marking, index, today, onGo, onLink, fixes, onOpenScope, onFixed, onMarked, scopeName, s }: {
  row: CheckRow; tab: string; setTab: (tab: string) => void; view: ListView; setView: (next: ListView) => void; finding: string | undefined
  marking: CheckMarking | undefined; index: ChecksPageProps['index']; today: string; onGo: ChecksPageProps['onGo']; onLink: ChecksPageProps['onLink']; fixes: ChecksPageProps['fixes']; onOpenScope: ChecksPageProps['onOpenScope']
  onFixed: (done: FixDone) => void; onMarked: (marks: readonly KeptCheckMark[]) => void; scopeName: (path: ScopePath) => string; s: Translate
}) {
  const { entry } = row
  const fix = entry.weight === 'fix'
  const accepted = !fix && tab === 'accepted'
  const tabs = [
    // A check not counted here has found nothing that can be said here, which is not none.
    { value: 'found', label: s('checks.tabFound'), ...(row.counted ? { count: row.shown.length } : {}) },
    ...(fix ? [] : [{ value: 'accepted', label: s('checks.tabAccepted'), count: row.marked.length }]),
  ]
  return (
    <div className="checks-page__reader" data-testid="checks-detail" data-check={row.key} aria-live="polite">
      <Panel
        kind={`${s(CHECK_WEIGHT_LABEL[entry.weight].name)} · ${s(CHECK_CATEGORY_LABEL[entry.category])}`} kindIcon={<Mark kind={entry.weight} />} name={s(entry.name)}
        tabs={tabs} tab={accepted ? 'accepted' : 'found'} onTab={setTab}
      >
        <PanelSection>
          <p className="checks-page__text" data-testid="checks-why">{s(entry.why)}</p>
          <p className="checks-page__text" data-testid="checks-how"><span className="checks-page__label">{s(CHECK_LIST_WORDS.how)}: </span>{s(entry.how)}</p>
          {fix && <p className="checks-page__text checks-page__quiet" data-testid="checks-never">{s(CHECK_MARK_WORDS.never)}</p>}
        </PanelSection>
        {!row.counted ? (
          <PanelSection>
            <p className="checks-page__text" data-testid="checks-where-open">{s('checks.whereOpen')}</p>
            {onOpenScope && <Button onClick={onOpenScope}>{s('checks.openToCount')}</Button>}
          </PanelSection>
        ) : accepted ? (
          <AcceptedList row={row} index={index} marking={marking} scopeName={scopeName} s={s} />
        ) : row.shown.length === 0 ? (
          <PanelSection><p className="checks-page__text checks-page__quiet">{s('checks.none')}</p></PanelSection>
        ) : (
          <FoundList
            row={row} view={view} setView={setView} ask={finding} marking={marking} index={index} today={today}
            onGo={onGo} onLink={onLink} fixes={fixes} onFixed={onFixed} onMarked={onMarked} scopeName={scopeName} s={s}
          />
        )}
      </Panel>
    </div>
  )
}

/** Which level the numbers are of, said in the head, and how to widen or narrow it. */
function ScopeOfChecks({ at, scopes, onScope, scopeName, s }: {
  at: ScopePath; scopes: ChecksPageProps['scopes']; onScope: ChecksPageProps['onScope']; scopeName: (path: ScopePath) => string; s: Translate
}) {
  const label = at === ROOT_SCOPE ? s('checks.wholeOrganisation') : s('checks.andBelow', { scope: scopeName(at) })
  if (!scopes || scopes.length < 2) return <span className="org-page__covers">{label}</span>
  const items = scopes.map((one) => ({
    label: `${'\u2003'.repeat(one.depth)}${one.path === ROOT_SCOPE ? s('checks.wholeOrganisation') : one.name}`,
    checked: one.path === at, onSelect: () => onScope?.(one.path),
  }))
  return <span className="checks-page__scope"><MenuButton label={label} items={items} data-guide="checks.scope" /></span>
}

export function ChecksPage(props: ChecksPageProps) {
  const { rows, counts, request, s, at = ROOT_SCOPE, scopes, onScope, scopeName, index, today = '', onGo, onLink, onOpenScope } = props
  const marking = useCheckMarking()
  const [density, setDensity] = useListDensity()
  const [view, setView] = usePlaceListView('checks')
  const [tab, setTab] = usePlaceTab('found')
  const [toast, setToast] = useState<ToastWords | null>(null)
  const [session, setSession] = useSessionSet(props.remember)
  const every = useMemo(() => rows.flatMap((one) => one.rows), [rows])
  const by = (view.filters[WORK_FIELD]?.[0] ?? 'weight') as WorkGroup
  const sections = useMemo(() => workSections(rows, by), [rows, by])

  const asked = every.find((row) => row.key === request?.select)
  // Asked for a check: that one, with its section unfolded to show it.
  const lastAsked = useRef<unknown>(undefined)
  useEffect(() => {
    if (!asked || lastAsked.current === request) return
    lastAsked.current = request
    if (view.select !== asked.key) setView({ ...view, select: asked.key })
  }, [request, asked])

  const picked = every.find((row) => row.key === view.select)
  const firstKey = useMemo(() => firstCheck(rows), [rows])
  const current = picked ?? every.find((row) => row.key === firstKey)
  const reviews = useMemo(() => every.filter((row) => row.entry.weight === 'review' && row.shown.length > 0), [every])

  const groups: readonly ListGroup[] = sections.map((section) => ({
    id: section.id, label: sectionLabel(section, scopeName, s), count: section.count,
    rows: section.rows.map((row): ListRow => ({
      id: section.kind === 'scope' ? `${row.key}@${section.scope ?? ''}` : row.key,
      attributes: { 'data-testid': `checks-row-${row.key}`, 'data-check': row.key },
      text: s(row.entry.name), mark: <Mark kind={row.entry.weight} label={s(CHECK_WEIGHT_LABEL[row.entry.weight].name)} />,
      // Under its own heading the words would say the heading again on every line.
      ...(row.counted ? { note: String(row.shown.length) } : section.kind === 'notCounted' ? {} : { note: s('checks.openToCount') }),
    })),
  }))
  const selectedId = current && by === 'scope'
    ? groups.flatMap((group) => group.rows).find((row) => row.id.startsWith(`${current.key}@`))?.id ?? null
    : current?.key ?? null
  const notesOpen = session.has(NOTES_OPEN)
  // Said of every section there could be: the list reads this once, and the checks may still be being read then.
  const showing = asked ? sectionKindOf(asked) : undefined
  const folded = [...SECTION_FOLDED].filter((kind) => kind !== showing && !(kind === 'note' && notesOpen))
  const onFixed = (done: FixDone) => setToast({ key: Date.now(), message: done.message, undo: { onPress: done.back, shared: true } })
  const onMarked = (made: readonly KeptCheckMark[]) => {
    // Stay on the check: the result of the act does not leave the screen.
    if (current && view.select !== current.key) setView({ ...view, select: current.key })
    setToast({ key: Date.now(), message: s('checks.marked', { count: made.length }), undo: { onPress: () => { void marking?.takeBackAll(made) }, shared: true } })
  }
  const chooseCheck = (id: string) => {
    const key = id.includes('@') ? id.slice(0, id.indexOf('@')) as CheckKey : id as CheckKey
    // What narrowed one check's list means nothing on the next.
    setView({ ...view, select: key, find: '', group: null, sort: null })
    setTab('found')
  }
  const total = counts.fix + counts.review + counts.note
  return (
    <PageDialog open={props.open} onClose={props.onClose} aria-label={s('checks.title')}>
      <div className="org-page">
        <div className="org-page__head" data-testid="checks-topbar">
          <div className="org-page__title">
            <h1 className="org-page__name">{s('checks.title')}</h1>
            <ScopeOfChecks at={at} scopes={scopes} onScope={onScope} scopeName={scopeName} s={s} />
            <span className="org-page__covers" data-testid="checks-counts">{workSentence(counts, reviews, s)}</span>
          </div>
        </div>
        <FilterWords
          noFind dataGuide="checks.weight" find="" onFind={() => {}}
          groups={WORK_GROUPS.map((id) => ({ id, label: toWeight(id, s) }))} group={by === 'none' ? null : by}
          onGroup={(group) => setView({ ...view, filters: { ...view.filters, [WORK_FIELD]: [group ?? 'none'] } })}
          density={density} onDensity={setDensity}
        />
        <div className="checks-page__work">
          <section className="checks-page__list" aria-label={s('checks.title')}>
            {counts.fix === 0 && total > 0 && (
              <p className="checks-clear" data-testid="checks-no-fix"><Mark kind="agree" /><span><strong>{s('checks.noFixTitle')}</strong> {s('checks.noFixBody')}</span></p>
            )}
            <List
              key={`${by}-${showing ?? ''}`} label={s('checks.title')} groups={groups} density={density} selectedId={selectedId} onOpen={chooseCheck}
              defaultFolded={folded} rowGuide="checks.row"
              onFold={(id, isFolded) => { if (id === 'note') setSession(new Set(isFolded ? [...session].filter((one) => one !== NOTES_OPEN) : [...session, NOTES_OPEN])) }}
            />
          </section>
          {current ? (
            <CheckReader
              row={current} tab={tab} setTab={setTab} view={view} setView={setView} finding={request?.finding}
              marking={marking} index={index} today={today} onGo={onGo} onLink={onLink} fixes={props.fixes} onOpenScope={onOpenScope}
              onFixed={onFixed} onMarked={onMarked} scopeName={scopeName} s={s}
            />
          ) : (
            <div className="checks-page__reader">
              <PageState
                state="empty" title={at === ROOT_SCOPE ? s('checks.clearTitleWhole') : s('checks.clearTitle', { scope: scopeName(at) })}
                body={s('checks.clearBody', { ran: every.filter((row) => row.counted).length, only: every.filter((row) => !row.counted).length })}
                {...(onOpenScope ? { action: { label: s('checks.openToCount'), onPress: onOpenScope } } : {})}
              />
            </div>
          )}
        </div>
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </PageDialog>
  )
}

function sectionKindOf(row: CheckRow): WorkSection['kind'] {
  if (!row.counted) return 'notCounted'
  return row.shown.length === 0 ? 'nothing' : row.entry.weight
}

