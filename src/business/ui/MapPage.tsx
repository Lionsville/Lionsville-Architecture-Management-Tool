// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Coverage: the second reading of the sheet's layer (ADR-0012 §6, §9), the one
 * crossing nothing else draws: which system on which capability, and what has
 * none. Same address and same kind of view as the enterprise map always was; what
 * changed is that it is reached from the sheet's own switch, and that a scope with
 * several maps keeps them under that switch's menu.
 *
 * Every mark is derived from the function tree and the `supports` and `assigned`
 * rows by `business/map.ts`. The arithmetic is tested in node; this is the kit's
 * Matrix over it, with the answer pinned beside the name, so the column the page is
 * for is the first thing kept rather than the first lost.
 *
 * A press selects and only selects, since a press that writes is how a reader
 * changes the model; Space links or unlinks where the row is this scope's to write,
 * and each is one step with its Undo. An empty map is a statement and a way to
 * start, because no one having started is not 142 faults.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import type { DesignDiagram, DesignModel, ElementId, Relation } from '../../model'
import type { AspectScale } from '../../model/aspectScale'
import { formatDay } from '../../i18n/dates'
import { useStrings } from '../../i18n'
import { plural } from '../../i18n/strings'
import type { Translate } from '../../i18n'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { Band } from '../../widgets/kit/Band'
import { Button } from '../../widgets/kit/Button'
import { DayControl } from '../../widgets/kit/DayControl'
import type { DayGroup } from '../../widgets/kit/DayControl'
import { List } from '../../widgets/kit/List'
import { Mark } from '../../widgets/kit/Mark'
import { Matrix } from '../../widgets/kit/Matrix'
import type { MatrixCell } from '../../widgets/kit/Matrix'
import { MoreMenu } from '../../widgets/kit/Menu'
import type { MenuEntry } from '../../widgets/kit/Menu'
import { PageDialog } from '../../widgets/PageDialog'
import { PageState } from '../../widgets/kit/PageState'
import { Panel, PanelSection } from '../../widgets/kit/Panel'
import { Segmented } from '../../widgets/kit/Segmented'
import { Toast } from '../../widgets/kit/Toast'
import type { ToastWords } from '../../widgets/kit/Toast'
import { ViewBar, ViewBarButton } from '../../widgets/kit/ViewBar'
import { Dialog } from '../../widgets/kit/Dialog'
import { TextField, TextInput } from '../../widgets/kit/Field'
import { SeamResizer } from '../../widgets/SeamResizer'
import { useSelectRequest } from '../../widgets/useSelectRequest'
import type { SelectRequest } from '../../widgets/useSelectRequest'
import { locatedRing, useLocated } from '../../widgets/useLocated'
import { captureSheet } from '../../widgets/capturePage'
import { usePlaceReading, usePlaceTabFor } from '../../widgets/placeTab'
import { matchesQuery } from '../../model/textSearch'
import { paperWidth } from '../grid'
import { mapPage } from '../map'
import type { LaidOutMap, MapDescribe, MapRow } from '../map'
import { FunctionInspector, INSPECTOR_WIDTH } from './FunctionInspector'
import type { FunctionInspectorProps, SheetActions, SheetDomains, SheetResponsible, Supporter } from './FunctionInspector'
import { ReadingSwitch } from './SheetBar'
import type { OtherView, SheetReading } from './SheetBar'
import { SheetExportDialog } from './SheetExportDialog'
import type { ExportLayout } from './SheetExportDialog'
import { InlineFrame, fileSafe, settled } from './SheetPage'
import type { SheetCaptureOptions, SheetHandle } from './SheetPage'
import './Sheet.css'

export type MapPageProps = {
  open: boolean
  /** Drawn in the tab rather than as a page over the editor (ADR-0016). */
  inline?: boolean
  model: DesignModel
  /** Absent while the page is closing, or when the map was deleted under it. */
  map: DesignDiagram | undefined
  readOnly: boolean
  /** The sheet's actions, because a capability is edited the same way from either page. */
  actions: SheetActions
  onClose(): void
  windowChrome?: WindowChrome
  /** The page, as the agent's renderer reaches it: the same handle the sheet hands over. */
  onHandle?(handle: SheetHandle | undefined): void
  /** Who answers for a record on this page, where it is not this scope (ADR-0012 §10). */
  ownerOf?: FunctionInspectorProps['ownerOf']
  /** Rows written in another scope of the same organisation (ADR-0012 §2). A STABLE array. */
  elsewhere?: readonly Relation[]
  /** Names and owners for the applications the rows name. Stable, likewise. */
  describe?: MapDescribe
  /** The day the map counts rows on, where the map itself names none. */
  today?: string
  /** Every application in the organisation, for *Supported by…* and *Columns: all*. */
  applications?: readonly Supporter[]
  /** The way to an element's own page. Absent = no *Page ›*. */
  onOpenDocumentation?(id: ElementId): void
  /** Select this, where the map draws it as a row. */
  select?: SelectRequest
  responsible?: SheetResponsible
  domains?: SheetDomains
  scales?: readonly AspectScale[]
  days?: readonly DayGroup[]
  /** The sheet's other readings: to this scope's sheet, made where it has none and the person may. */
  onSheet?(): void
  /** Every map in this scope, to change between them. */
  maps?: readonly OtherView[]
  onOpenMap?(id: string): void
  /** A second map, which a tab no longer offers here. Absent under `readOnly`. */
  onCreateMap?(): void
  /** Rename, its title block, its removal: the tab's own menu, since it shares the sheet's tab. */
  onRename?(name: string): void
  onSettings?(): void
  onDelete?(): void
  /** Open an application in the scope that keeps it, wherever that is. */
  onOpenApplication?(id: ElementId): void
  onUndo?(): void
  onSave?(doc: { name: string; bytes: Uint8Array; mediaType: 'image/png' }): void
}

type Filter = 'all' | 'gaps' | 'overlaps'
type Pick = { kind: 'row'; id: ElementId } | { kind: 'column'; id: ElementId }

const EXPORT_MAX_PIXELS = 40_000_000
/** Two levels fit one page on a real tree; the next is one press away. */
const OPENING_LEVEL = 2

/** The rows folded at a level: those with something under them at that depth or deeper. */
function foldedAt(rows: readonly MapRow[], level: number): string[] {
  return rows.filter((row) => !row.leaf && row.depth >= level - 1).map((row) => row.element.id)
}

/** The sentence over the page, with the total, so nobody adds it up. */
function summaryOf(map: LaidOutMap, t: Translate): string {
  const { covered, manual, uncovered } = map.counts
  return t('map.sentence', { answered: covered + manual, total: covered + manual + uncovered, covered, manual, uncovered })
}

/** Which rows a filter keeps, as a list of one line each. */
function filtered(rows: readonly MapRow[], filter: Filter, query: string): MapRow[] {
  return rows.filter((row) => {
    if (!row.leaf) return false
    if (filter === 'gaps' && row.coverage !== 'uncovered') return false
    if (filter === 'overlaps' && row.supportedBy.length < 2) return false
    return query.trim() === '' || matchesQuery(query, [row.element.name])
  })
}

function verdict(row: MapRow, t: Translate) {
  if (!row.leaf) {
    const leaves = row.leafCount
    const answered = leaves - row.gaps
    return <span className="map-verdict" data-gap={row.gaps > 0 || undefined}>{t('map.ofLeaves', { answered, total: leaves })}</span>
  }
  if (row.coverage === 'uncovered') return <span className="map-verdict" data-gap="">{t('map.nothing')}</span>
  if (row.coverage === 'manual') return <span className="map-verdict">{t('map.byPeople')}</span>
  return <span className="map-verdict">{plural(t, { one: 'map.systemsOne', other: 'map.systemsOther' }, row.supportedBy.length)}</span>
}

/** What a column is about: every capability it supports, and those it is the only system for. */
function ColumnPanel({ id, map, known, onOpen, onClose, onSelect, width, t }: {
  id: ElementId
  map: LaidOutMap
  known: boolean
  onOpen: (() => void) | undefined
  onClose(): void
  onSelect(id: ElementId): void
  width: number
  t: Translate
}) {
  const name = map.columns.find((column) => column.id === id)?.name ?? id
  const where = map.columns.find((column) => column.id === id)?.where
  const supported = map.rows.filter((row) => row.leaf && row.supportedBy.includes(id))
  const only = supported.filter((row) => row.supportedBy.length === 1)
  const list = (rows: readonly MapRow[]) => rows.map((row) => (
    <div className="sheet-held" key={row.element.id}>
      <button type="button" className="sheet-page__link sheet-held__name" onClick={() => onSelect(row.element.id)}>{row.element.name}</button>
    </div>
  ))
  return (
    <div className="sheet-panel__testid" data-testid="map-column-panel">
      <Panel
        kind={t('map.system')} name={name} width={width} onClose={onClose}
        {...(where !== undefined ? { facts: where } : {})}
        status={known ? undefined : t('map.unknownApplication')}
        actions={onOpen && <button type="button" className="sheet-page__link" aria-label={t('sheet.open', { name })} onClick={onOpen}>{t('map.openApplication')}</button>}
      >
        <PanelSection title={t('map.supports')} aside={String(supported.length)}>{list(supported)}</PanelSection>
        {only.length > 0 && <PanelSection title={t('map.onlySystem')} aside={String(only.length)}>{list(only)}</PanelSection>}
      </Panel>
    </div>
  )
}

export function MapPage(props: MapPageProps) {
  const { model, map, actions } = props
  const { t, language } = useStrings()
  const theme = useTheme()
  const page = useRef<HTMLDivElement | null>(null)
  const [pick, setPick] = useState<Pick | undefined>(undefined)
  const [detailsWidth, setDetailsWidth] = useState<number>(INSPECTOR_WIDTH.default)
  const [level, setLevel] = useState(OPENING_LEVEL)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [finding, setFinding] = useState(false)
  const [allColumns, setAllColumns] = useState(false)
  const [renaming, setRenaming] = useState<string | undefined>(undefined)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState<ToastWords | null>(null)
  const [reading, changeReading] = usePlaceReading()
  const sheetLevel = usePlaceTabFor('sheet')
  const lookDay = reading.day
  const looking = lookDay !== undefined && lookDay !== map?.asOf
  const readOnly = props.readOnly || looking
  const chooseDay = (day: string | undefined) => {
    const { day: _was, ...rest } = reading
    changeReading(day !== undefined ? { ...rest, day } : rest)
  }

  const onHandle = props.onHandle
  const mapId = map?.id
  // `width` is the sheet's: a map is a table, and its width is its columns'. Everything unfolded for a picture.
  const capture = useCallback(async (options: SheetCaptureOptions) => {
    const node = page.current
    if (!node) throw new Error('MapPage: the page is not on screen')
    setExporting(true)
    try {
      await settled()
      return await captureSheet(node, { maxPixels: options.maxPixels, background: theme.palette.background.default })
    } finally {
      setExporting(false)
    }
  }, [theme])
  useEffect(() => {
    if (!onHandle) return undefined
    if (!props.open || mapId === undefined) { onHandle(undefined); return undefined }
    const selectedId = pick?.id
    onHandle({ diagramId: mapId, capture, ...(selectedId !== undefined ? { selectedId } : {}) })
    return () => onHandle(undefined)
  }, [onHandle, props.open, mapId, capture, pick])

  const laidOut = useMemo(
    () => (map
      ? mapPage(model, lookDay !== undefined ? { ...map, asOf: lookDay } : map, {
        ...(props.elsewhere ? { elsewhere: props.elsewhere } : {}),
        ...(props.describe ? { describe: props.describe } : {}),
        ...(props.today !== undefined ? { today: props.today } : {}),
        ...(allColumns && props.applications ? { allApplications: props.applications } : {}),
      })
      : undefined),
    [model, map, lookDay, props.elsewhere, props.describe, props.today, allColumns, props.applications],
  )
  const selected = pick?.kind === 'row' ? model.elements.find((element) => element.id === pick.id) : undefined
  const held = useMemo(() => new Set(model.elements.map((element) => element.id)), [model.elements])
  const { locatedId, locate } = useLocated(page, (id) => setPick({ kind: 'row', id }))
  useSelectRequest(props.select, laidOut && ((id) => laidOut.rows.some((row) => row.element.id === id)), locate)

  // A row asked for from outside has nothing folded over it.
  const [unfolded, setUnfolded] = useState<ReadonlySet<ElementId>>(new Set())
  useEffect(() => {
    if (pick?.kind !== 'row' || !laidOut) return
    const chain = new Set(unfolded)
    for (let at = model.elements.find((element) => element.id === pick.id)?.parentId; at !== undefined;) {
      chain.add(at)
      at = model.elements.find((element) => element.id === at)?.parentId
    }
    if (chain.size !== unfolded.size) setUnfolded(chain)
    // Once per pick: a person folding a row again afterwards is not undone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick])
  const rowById = useMemo(() => new Map(laidOut?.rows.map((row) => [row.element.id, row]) ?? []), [laidOut])

  const cellOf = useCallback((rowId: string, columnId: string): MatrixCell | null => {
    const row = rowById.get(rowId)
    const column = laidOut?.columns.find((one) => one.id === columnId)
    if (!row || !column || !row.supportedBy.includes(columnId)) return null
    if (row.leaf) {
      return { show: <Mark kind="cov-apps" />, meaning: t('map.supportsTip', { application: column.name, function: row.element.name }) }
    }
    const under = row.counts?.[columnId] ?? 1
    return { show: <span className="map-count">{under}</span>, meaning: t('map.rolledUpTip', { application: column.name, function: row.element.name }) }
  }, [rowById, laidOut, t])

  /** Space on a cell: one step with its Undo, written here, where this scope can take it away again. */
  const toggle = useCallback((rowId: string, columnId: string) => {
    const row = rowById.get(rowId)
    const column = laidOut?.columns.find((one) => one.id === columnId)
    if (!row || !column || !row.leaf) return
    const on = !row.supportedBy.includes(columnId)
    if (!on && !model.relations.some((relation) => relation.type === 'supports' && relation.sourceId === columnId && relation.targetId === rowId)) {
      setToast({ key: Date.now(), message: t('map.keptElsewhere', { application: column.name }) })
      return
    }
    actions.setCoverage({ type: 'supports', sourceId: columnId, functionId: rowId, on })
    setToast({
      key: Date.now(),
      message: t(on ? 'map.linked' : 'map.unlinked', { application: column.name, function: row.element.name }),
      ...(props.onUndo ? { undo: { onPress: props.onUndo } } : {}),
    })
  }, [rowById, laidOut, model.relations, actions, t, props.onUndo])

  const moreItems: MenuEntry[] = [
    ...(!readOnly && props.onCreateMap ? [{ label: t('map.newMap'), onSelect: props.onCreateMap }] : []),
    ...(!readOnly && props.onRename && map ? [{ label: t('map.rename'), onSelect: () => setRenaming(map.name) }] : []),
    ...(!readOnly && props.onSettings ? [{ label: t('map.settings'), onSelect: props.onSettings }] : []),
    ...(allColumnsEntry(props.applications, allColumns, setAllColumns, t)),
    ...(!readOnly && props.onDelete ? [{ label: t('map.delete'), onSelect: props.onDelete, final: true }] : []),
  ]

  const exportPng = async (layout: ExportLayout) => {
    if (!map || !props.onSave) return
    const shot = await capture({ maxPixels: EXPORT_MAX_PIXELS, ...(layout === 'screen' ? {} : { width: paperWidth(layout) }) })
    props.onSave({ name: `${fileSafe(map.name)}.png`, bytes: shot.png, mediaType: 'image/png' })
  }

  const hasRows = (laidOut?.rows.length ?? 0) > 0
  const nothingLinked = hasRows && laidOut !== undefined && laidOut.counts.covered + laidOut.counts.manual === 0
  const matched = useMemo(() => filtered(laidOut?.rows ?? [], filter, query), [laidOut, filter, query])
  const firstLeaf = laidOut?.rows.find((row) => row.leaf)?.element.id
  const counts = useMemo(() => ({
    gaps: filtered(laidOut?.rows ?? [], 'gaps', '').length,
    overlaps: filtered(laidOut?.rows ?? [], 'overlaps', '').length,
    all: laidOut?.rows.filter((row) => row.leaf).length ?? 0,
  }), [laidOut])

  const onReadingPress = (to: SheetReading) => { if (to !== 'coverage') { sheetLevel(to); props.onSheet?.() } }
  const columnPicked = pick?.kind === 'column' ? pick.id : undefined
  const Frame = props.inline ? InlineFrame : PageDialog
  const inMatrix = laidOut && hasRows && !nothingLinked && filter === 'all' && query.trim() === ''
  const foldedRows = exporting || !laidOut ? [] : foldedAt(laidOut.rows, level).filter((id) => !unfolded.has(id))
  return (
    <Frame open={props.open} topInset={(props.windowChrome ?? NO_WINDOW_CHROME).topInset} onClose={props.onClose} aria-label={t('map.page')}>
      <div data-testid="map-topbar">
        <ViewBar
          label={map?.name ?? t('map.page')}
          reading={(
            <ReadingSwitch
              value="coverage" onChange={onReadingPress} canCover t={t} guide="map.reading"
              {...(props.maps && props.onOpenMap ? { others: { views: props.maps, onOpen: props.onOpenMap } } : {})}
            />
          )}
          show={hasRows && !nothingLinked ? (
            <>
              <Segmented
                label={t('map.filter')} value={filter} onChange={setFilter} data-guide="map.filter"
                options={[
                  { value: 'all', label: t('map.filterAll', { count: counts.all }) },
                  { value: 'gaps', label: t('map.filterGaps', { count: counts.gaps }) },
                  { value: 'overlaps', label: t('map.filterOverlaps', { count: counts.overlaps }) },
                ]}
              />
              {filter === 'all' && (
                <Segmented
                  label={t('map.levels')} value={String(level)} onChange={(to) => { setLevel(Number(to)); setUnfolded(new Set()) }} data-guide="map.levels"
                  options={[1, 2, 3].map((one) => ({ value: String(one), label: String(one) }))}
                />
              )}
            </>
          ) : undefined}
          day={<DayControl data-guide="map.day" day={lookDay ?? map?.asOf} groups={props.days ?? []} onChange={chooseDay} />}
          find={<ViewBarButton on={finding} aria-pressed={finding} onClick={() => { setFinding(!finding); setQuery('') }}>{t('sheet.findWord')}</ViewBarButton>}
          exportAs={props.onSave && <ViewBarButton onClick={() => setExportOpen(true)}>{t('map.export')}</ViewBarButton>}
          more={moreItems.length > 0 ? <MoreMenu items={moreItems} label={t('sheet.more')} /> : undefined}
        />
      </div>
      {looking && (
        <Band
          tone="looking" title={t('sheet.looking', { day: formatDay(lookDay, language) })} detail={t('sheet.lookingDetail')}
          action={<Button variant="plain" size="small" onClick={() => chooseDay(undefined)}>{t('sheet.lookingBack')}</Button>}
        />
      )}
      {finding && (
        <div className="sheet-find" role="search">
          <span className="sheet-find__field">
            <TextInput autoFocus value={query} placeholder={t('sheet.findPlaceholder')} aria-label={t('sheet.find')} onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setFinding(false); setQuery('') } }}
            />
          </span>
          {query.trim() !== '' && <span className="sheet-find__count" role="status">{matched.length === 0 ? t('sheet.findNone') : t('sheet.findCount', { count: matched.length })}</span>}
        </div>
      )}
      {laidOut && hasRows && !nothingLinked && (
        <div className="map-page__line">
          <span className="map-page__summary" data-testid="map-summary" data-guide="map.summary">{summaryOf(laidOut, t)}</span>
          <span data-testid="map-legend">{t('map.legend')}</span>
        </div>
      )}
      <Box ref={page} className="sheet-page" data-exporting={exporting ? '' : undefined} sx={exporting ? undefined : locatedRing(locatedId)}>
        <div className="sheet-page__work">
          <div className="map-page__grid" data-testid="map-body">
            {!laidOut || !hasRows
              ? (
                <PageState
                  state="empty" title={t('map.noFunctions')} body={t('map.noFunctionsHint')}
                  {...(props.onSheet ? { action: { label: t('map.toSheet'), onPress: () => props.onSheet?.() } } : {})}
                />
              )
              : nothingLinked
                ? (
                  <PageState
                    state="empty" title={t('map.nobodyYet', { count: laidOut.counts.uncovered })} body={t('map.noApplications')}
                    {...(!readOnly && firstLeaf !== undefined ? { action: { label: t('map.startLinking'), onPress: () => setPick({ kind: 'row', id: firstLeaf }) } } : {})}
                  />
                )
                : inMatrix
                  ? (
                    <div data-testid="map-grid" data-guide="map.grid" style={{ display: 'contents' }}>
                      <Matrix
                        key={`${level}:${exporting}`}
                        label={map?.name ?? t('map.page')} rowHeading={t('map.function')} rotateHeads
                        rows={laidOut.rows.map((row) => ({ id: row.element.id, label: row.element.name, ...(row.parentId !== undefined ? { parent: row.parentId } : {}) }))}
                        columns={laidOut.columns.map((column) => ({ id: column.id, label: column.known ? column.name : `${column.name} (${t('map.unknownApplication')})`, ...(column.where !== undefined ? { group: column.where } : laidOut.groups.length > 1 ? { group: OWN_GROUP } : {}) }))}
                        {...(laidOut.groups.length > 1 || laidOut.groups.some((group) => group.where !== undefined)
                          ? { columnGroups: laidOut.groups.map((group) => ({ id: group.where ?? OWN_GROUP, label: group.where ?? t('map.thisScope') })), groupBand: true }
                          : {})}
                        cellOf={cellOf}
                        answers={[
                          { label: t('map.covered'), of: (id: string) => { const row = rowById.get(id); return row ? verdict(row, t) : null } },
                          { label: t('map.people'), of: (id: string) => {
                            const row = rowById.get(id)
                            if (!row || row.assignedTo.length === 0) return null
                            return row.leaf
                              ? <span title={t('map.peopleTip', { names: row.assignedNames.join(', ') })}><Mark kind="cov-people" label={t('map.peopleTip', { names: row.assignedNames.join(', ') })} /></span>
                              : <span title={t('map.peopleTip', { names: row.assignedNames.join(', ') })}>{row.assignedTo.length}</span>
                          } },
                        ]}
                        defaultFoldedRows={foldedRows}
                        {...(pick?.kind === 'row' ? { selected: { row: pick.id, column: '' } } : {})}
                        onSelect={({ row }) => setPick({ kind: 'row', id: row })}
                        onOpenRow={(id) => setPick({ kind: 'row', id })} openFoldable
                        onOpenColumn={(id) => setPick({ kind: 'column', id })}
                        {...(!readOnly ? { keys: [' '], onKey: ({ row, column }: { row: string; column: string }) => toggle(row, column), hint: t('map.keyHint') } : {})}
                        dataGuide="map.matrix"
                      />
                    </div>
                  )
                  : (
                    <div className="map-list">
                      <List
                        label={filter === 'gaps' ? t('map.filterGaps', { count: counts.gaps }) : filter === 'overlaps' ? t('map.filterOverlaps', { count: counts.overlaps }) : t('map.function')}
                        groups={[{ id: 'rows', label: '', rows: matched.map((row) => ({ id: row.element.id, text: row.element.name, note: row.supportedBy.length > 0 ? row.supportedBy.map((id) => laidOut.columns.find((one) => one.id === id)?.name ?? id).join(', ') : t('map.nothing') })) }]}
                        selectedId={pick?.kind === 'row' ? pick.id : null}
                        onOpen={(id) => setPick({ kind: 'row', id })}
                        empty={<PageState compact state="empty" title={t('sheet.findNone')} />}
                      />
                    </div>
                  )}
          </div>
          {selected && !exporting && (
            <div className="sheet-page__over">
              <SeamResizer
                orientation="vertical" region="after" value={detailsWidth} min={INSPECTOR_WIDTH.min} max={INSPECTOR_WIDTH.max}
                defaultValue={INSPECTOR_WIDTH.default} onChange={setDetailsWidth} label={t('sheet.resizeDetails')}
              />
              <FunctionInspector
                element={selected} model={model} readOnly={readOnly} actions={actions} width={detailsWidth}
                applications={props.applications} onOpenDocumentation={props.onOpenDocumentation} elsewhere={props.elsewhere}
                onRemoved={() => setPick(undefined)} onClose={() => setPick(undefined)} onSelect={(id) => setPick({ kind: 'row', id })}
                ownerOf={props.ownerOf} responsible={props.responsible} domains={props.domains} scales={props.scales ?? []} describe={props.describe}
              />
            </div>
          )}
          {columnPicked !== undefined && laidOut && !exporting && (
            <div className="sheet-page__over">
              <ColumnPanel
                id={columnPicked} map={laidOut} known={laidOut.columns.find((one) => one.id === columnPicked)?.known ?? false} width={detailsWidth}
                onClose={() => setPick(undefined)} onSelect={(id) => setPick({ kind: 'row', id })} t={t}
                onOpen={props.onOpenApplication ? () => props.onOpenApplication?.(columnPicked) : held.has(columnPicked) ? () => actions.onOpenElement(columnPicked) : undefined}
              />
            </div>
          )}
        </div>
      </Box>
      {exportOpen && map && (
        <SheetExportDialog initial="screen" onExport={exportPng} onClose={() => setExportOpen(false)} title={t('map.exportTitle')} hint={t('map.exportHint')} />
      )}
      {renaming !== undefined && (
        <RenameDialog name={renaming} onChange={setRenaming} onCancel={() => setRenaming(undefined)} onDone={() => { if (renaming.trim() !== '') props.onRename?.(renaming.trim()); setRenaming(undefined) }} t={t} />
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </Frame>
  )
}

/** The group a column kept in this scope falls under, where others fall under theirs. */
const OWN_GROUP = '__own'

function allColumnsEntry(applications: readonly Supporter[] | undefined, all: boolean, set: (all: boolean) => void, t: Translate): MenuEntry[] {
  if (!applications?.length) return []
  return [{ label: t(all ? 'map.columnsUsed' : 'map.columnsAll'), onSelect: () => set(!all) }]
}

function RenameDialog({ name, onChange, onCancel, onDone, t }: { name: string; onChange(name: string): void; onCancel(): void; onDone(): void; t: Translate }) {
  return (
    <Dialog
      open title={t('map.rename')} onClose={onCancel} onSubmit={onDone}
      actions={<><Button onClick={onCancel}>{t('common.cancel')}</Button><Button variant="primary" type="submit">{t('common.save')}</Button></>}
    >
      <TextField label={t('common.name')} value={name} onChange={onChange} autoFocus />
    </Dialog>
  )
}
