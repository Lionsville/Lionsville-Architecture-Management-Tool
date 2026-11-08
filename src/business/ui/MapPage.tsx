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
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import type { DesignDiagram, DesignElement, DesignModel, ElementId, Relation } from '../../model'
import type { AspectScale } from '../../model/aspectScale'
import { useStrings } from '../../i18n'
import { plural } from '../../i18n/strings'
import type { Translate } from '../../i18n'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
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
import { ViewBar, ViewBarButton, ViewBarLabelled } from '../../widgets/kit/ViewBar'
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
import { rootsOfKind } from '../sheetDiagram'
import { OrderList } from './SheetSettingsDialog'
import type { LaidOutMap, MapDescribe, MapRow } from '../map'
import { FunctionInspector, INSPECTOR_WIDTH } from './FunctionInspector'
import type { FunctionInspectorProps, SheetActions, SheetDomains, SheetResponsible, Supporter } from './FunctionInspector'
import { ReadingSwitch } from './SheetBar'
import type { OtherView, SheetReading } from './SheetBar'
import { SheetExportDialog } from './SheetExportDialog'
import type { ExportLayout } from './SheetExportDialog'
import { InlineFrame, LookBand, fileSafe, settled } from './SheetPage'
import type { SheetCaptureOptions, SheetHandle } from './SheetPage'
import { claimKey } from '../../widgets/kit/keys'
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
  /** Rename and removal: the tab's own menu, since it shares the sheet's tab. */
  onRename?(name: string): void
  onDelete?(): void
  /** The map's own fields: which areas it draws, the day it is saved on, its title block. */
  onUpdate?(patch: Partial<Pick<DesignDiagram, 'areas' | 'asOf' | 'author' | 'client' | 'documentDate' | 'showTitleBlock'>>): void
  /** Open an application in the scope that keeps it, wherever that is. */
  onOpenApplication?(id: ElementId): void
  onUndo?(): void
  onSave?(doc: { name: string; bytes: Uint8Array; mediaType: 'image/png' }): void
}

type Filter = 'all' | 'gaps' | 'overlaps'
type Picked = { kind: 'row'; id: ElementId } | { kind: 'column'; id: ElementId }

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

/** What a row and a cell come to, and what Space does on one. */
function useCells(laidOut: LaidOutMap | undefined, props: MapPageProps, t: Translate, setToast: (toast: ToastWords) => void) {
  const { model, actions } = props
  const rowById = useMemo(() => new Map(laidOut?.rows.map((row) => [row.element.id, row]) ?? []), [laidOut])
  const cellOf = useCallback((rowId: string, columnId: string): MatrixCell | null => {
    const row = rowById.get(rowId)
    const column = laidOut?.columns.find((one) => one.id === columnId)
    if (!row || !column || !row.supportedBy.includes(columnId)) return null
    if (row.leaf) return { show: <Mark kind="cov-apps" />, meaning: t('map.supportsTip', { application: column.name, function: row.element.name }) }
    // The number shown is in the name, so what a voice hears holds what the eye reads (WCAG 2.5.3).
    const count = row.counts?.[columnId] ?? 1
    return { show: <span className="map-count">{count}</span>, meaning: t('map.rolledUpTip', { count, application: column.name, function: row.element.name }) }
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
  }, [rowById, laidOut, model.relations, actions, t, props.onUndo, setToast])
  return { rowById, cellOf, toggle }
}

/** The ⋯: what the tab's own menu was, and which columns. A reader keeps only what changes nothing. */
function moreOfMap(props: MapPageProps, readOnly: boolean, t: Translate, at: { allColumns: boolean; onAllColumns(all: boolean): void; onRename(): void; onDraws(): void }): MenuEntry[] {
  const reads: MenuEntry[] = props.applications?.length ? [{ label: t(at.allColumns ? 'map.columnsUsed' : 'map.columnsAll'), onSelect: () => at.onAllColumns(!at.allColumns) }] : []
  if (readOnly) return reads
  return [
    ...(props.onCreateMap ? [{ label: t('map.newMap'), onSelect: props.onCreateMap }] : []),
    ...(props.onRename && props.map ? [{ label: t('map.rename'), onSelect: at.onRename }] : []),
    ...(props.onUpdate ? [{ label: t('map.draws'), onSelect: at.onDraws }] : []),
    ...reads,
    ...(props.onDelete ? [{ label: t('map.delete'), onSelect: props.onDelete, final: true }] : []),
  ]
}

/** What a list of rows is called, by what kept them. */
function listTitle(filter: Filter, counts: { gaps: number; overlaps: number }, t: Translate): string {
  if (filter === 'gaps') return t('map.filterGaps', { count: counts.gaps })
  return filter === 'overlaps' ? t('map.filterOverlaps', { count: counts.overlaps }) : t('map.function')
}

/** The bar: the reading, which rows, the day, and what else can be done with this map. */
function MapBar({ props, readOnly, t, at }: {
  props: MapPageProps
  readOnly: boolean
  t: Translate
  at: {
    hasRows: boolean; counts: { all: number; gaps: number; overlaps: number }; filter: Filter; onFilter(filter: Filter): void
    level: number; onLevel(level: number): void; day: string | undefined; onDay(day: string | undefined): void
    finding: boolean; onFinding(): void; onExport(): void; onRename(): void; onDraws(): void
    allColumns: boolean; onAllColumns(all: boolean): void; onReading(reading: SheetReading): void
  }
}) {
  const { map } = props
  const moreItems = moreOfMap(props, readOnly, t, at)
  const others = props.maps && props.onOpenMap ? { others: { views: props.maps, onOpen: props.onOpenMap } } : {}
  return (
    <div data-testid="map-topbar">
      <ViewBar
        label={map?.name ?? t('map.page')}
        reading={props.onSheet || (props.maps?.length ?? 0) > 1 ? <ReadingSwitch value="coverage" onChange={at.onReading} canCover t={t} guide="map.reading" {...others} /> : undefined}
        show={at.hasRows ? (
          <>
            <Segmented
              label={t('map.filter')} value={at.filter} onChange={at.onFilter} data-guide="map.filter"
              options={[
                { value: 'all', label: t('map.filterAll', { count: at.counts.all }) },
                { value: 'gaps', label: t('map.filterGaps', { count: at.counts.gaps }) },
                { value: 'overlaps', label: t('map.filterOverlaps', { count: at.counts.overlaps }) },
              ]}
            />
            {at.filter === 'all' && (
              <ViewBarLabelled label={t('map.levels')} data-testid="map-levels">
                <Segmented
                  label={t('map.levels')} value={String(at.level)} onChange={(to) => at.onLevel(Number(to))} data-guide="map.levels"
                  options={[1, 2, 3].map((one) => ({ value: String(one), label: String(one) }))}
                />
              </ViewBarLabelled>
            )}
          </>
        ) : undefined}
        day={<DayControl data-guide="map.day" day={at.day} groups={props.days ?? []} onChange={at.onDay} />}
        find={<ViewBarButton on={at.finding} aria-pressed={at.finding} onClick={at.onFinding}>{t('sheet.findWord')}</ViewBarButton>}
        exportAs={props.onSave && <ViewBarButton onClick={at.onExport}>{t('map.export')}</ViewBarButton>}
        more={moreItems.length > 0 ? <MoreMenu items={moreItems} label={t('sheet.more')} /> : undefined}
      />
    </div>
  )
}

/** The crossing itself, with the answer pinned beside the name. */
function CoverageMatrix({ laidOut, name, cells, folded, pick, onPick, onColumn, onFold, readOnly, version, t }: {
  laidOut: LaidOutMap
  name: string
  cells: ReturnType<typeof useCells>
  folded: readonly string[]
  pick: Picked | undefined
  onPick(id: ElementId): void
  onColumn(id: ElementId): void
  onFold(row: string, folded: boolean): void
  readOnly: boolean
  /** A new value starts the folds again from `folded`. */
  version: string
  t: Translate
}) {
  const { rowById } = cells
  const banded = laidOut.groups.length > 1 || laidOut.groups.some((group) => group.where !== undefined)
  const peopleOf = (id: string) => {
    const row = rowById.get(id)
    if (!row || row.assignedTo.length === 0) return null
    const says = t('map.peopleTip', { names: row.assignedNames.join(', ') })
    return <span title={says}>{row.leaf ? <Mark kind="cov-people" label={says} /> : row.assignedTo.length}</span>
  }
  const answerOf = (id: string) => { const row = rowById.get(id); return row ? verdict(row, t) : null }
  return (
    <div data-testid="map-grid" data-guide="map.grid" style={{ display: 'contents' }}>
      <Matrix
        key={version} label={name} rowHeading={t('map.function')} rotateHeads
        rows={laidOut.rows.map((row) => ({ id: row.element.id, label: row.element.name, ...(row.parentId !== undefined ? { parent: row.parentId } : {}) }))}
        columns={laidOut.columns.map((column) => ({
          id: column.id, label: column.known ? column.name : `${column.name} (${t('map.unknownApplication')})`,
          ...(banded ? { group: column.where ?? OWN_GROUP } : {}),
        }))}
        {...(banded ? { columnGroups: laidOut.groups.map((group) => ({ id: group.where ?? OWN_GROUP, label: group.where ?? t('map.thisScope') })), groupBand: true } : {})}
        cellOf={cells.cellOf}
        answers={[{ label: t('map.covered'), of: answerOf }, { label: t('map.people'), of: peopleOf }]}
        defaultFoldedRows={folded} onFoldRow={onFold}
        {...(pick?.kind === 'row' ? { selected: { row: pick.id, column: '' } } : {})}
        onSelect={({ row }) => onPick(row)} onOpenRow={onPick} openFoldable onOpenColumn={onColumn}
        {...(!readOnly ? { keys: [' '], onKey: ({ row, column }: { row: string; column: string }) => cells.toggle(row, column), hint: t('map.keyHint') } : {})}
        dataGuide="map.matrix"
      />
    </div>
  )
}

/** What fills the page: nothing to map, nothing linked, the matrix, or the rows a filter keeps. */
function MapBody({ laidOut, props, readOnly, firstLeaf, matched, title, pick, onStart, onPick, matrix, t }: {
  laidOut: LaidOutMap | undefined
  props: MapPageProps
  readOnly: boolean
  firstLeaf: ElementId | undefined
  matched: readonly MapRow[] | undefined
  title: string
  pick: Picked | undefined
  onStart(id: ElementId): void
  onPick(id: ElementId): void
  matrix: ReactNode
  t: Translate
}) {
  if (!laidOut || laidOut.rows.length === 0) {
    return (
      <PageState
        state="empty" title={t('map.noFunctions')} body={t('map.noFunctionsHint')}
        {...(props.onSheet ? { action: { label: t('map.toSheet'), onPress: () => props.onSheet?.() } } : {})}
      />
    )
  }
  if (laidOut.counts.covered + laidOut.counts.manual === 0) {
    return (
      <PageState
        state="empty" title={t('map.nobodyYet', { count: laidOut.counts.uncovered })} body={t('map.noApplications')}
        {...(!readOnly && firstLeaf !== undefined ? { action: { label: t('map.startLinking'), onPress: () => onStart(firstLeaf) } } : {})}
      />
    )
  }
  if (!matched) return matrix
  const byId = new Map(props.model.elements.map((one) => [one.id, one]))
  const whereOf = (element: DesignElement) => {
    const names: string[] = []
    for (let at = element.parentId === undefined ? undefined : byId.get(element.parentId); at && names.length < 8; at = at.parentId === undefined ? undefined : byId.get(at.parentId)) names.unshift(at.name)
    return names.join(' › ')
  }
  return (
    <div className="map-list">
      <List
        label={title}
        groups={[{ id: 'rows', label: '', rows: matched.map((row) => ({
          id: row.element.id, text: row.element.name,
          // What answers it, or, where nothing does, where it sits: the word nothing on every row of Gaps says what the filter already said.
          note: row.supportedBy.length > 0 ? row.supportedBy.map((id) => laidOut.columns.find((one) => one.id === id)?.name ?? id).join(', ') : whereOf(row.element),
        })) }]}
        selectedId={pick?.kind === 'row' ? pick.id : null} onOpen={onPick}
        empty={<PageState compact state="empty" title={t('sheet.findNone')} />}
      />
    </div>
  )
}

/** The picture of the map, for an agent and for a person: unfolded, and nothing scrolling. */
function useMapPicture(props: MapPageProps, node: { current: HTMLDivElement | null }, selectedId: ElementId | undefined) {
  const theme = useTheme()
  const [exporting, setExporting] = useState(false)
  const capture = useCallback(async (options: SheetCaptureOptions) => {
    if (!node.current) throw new Error('MapPage: the page is not on screen')
    setExporting(true)
    try {
      await settled()
      return await captureSheet(node.current, { maxPixels: options.maxPixels, background: theme.palette.background.default })
    } finally {
      setExporting(false)
    }
  }, [theme, node])
  const { onHandle, map, open } = props
  const mapId = map?.id
  useEffect(() => {
    if (!onHandle) return undefined
    if (!open || mapId === undefined) { onHandle(undefined); return undefined }
    onHandle({ diagramId: mapId, capture, ...(selectedId !== undefined ? { selectedId } : {}) })
    return () => onHandle(undefined)
  }, [onHandle, open, mapId, capture, selectedId])
  const exportPng = async (layout: ExportLayout) => {
    if (!map || !props.onSave) return
    const shot = await capture({ maxPixels: EXPORT_MAX_PIXELS, ...(layout === 'screen' ? {} : { width: paperWidth(layout) }) })
    props.onSave({ name: `${fileSafe(map.name)}.png`, bytes: shot.png, mediaType: 'image/png' })
  }
  return { exporting, exportPng }
}

/** What is open beyond the level: by hand, or because a row was asked for that sat under it. */
function useUnfolded(model: DesignModel) {
  const [unfolded, setUnfolded] = useState<ReadonlySet<ElementId>>(new Set())
  const [revealed, setRevealed] = useState(0)
  /** A row picked from outside the matrix has nothing folded over it, and the matrix starts again from that. */
  const reveal = (id: ElementId) => {
    const chain = new Set(unfolded)
    for (let at = model.elements.find((element) => element.id === id)?.parentId; at !== undefined;) {
      chain.add(at)
      at = model.elements.find((element) => element.id === at)?.parentId
    }
    setUnfolded(chain)
    setRevealed((count) => count + 1)
  }
  const onFold = (row: string, folded: boolean) => {
    const next = new Set(unfolded)
    if (folded) next.delete(row)
    else next.add(row)
    setUnfolded(next)
  }
  return { unfolded, revealed, reveal, onFold, reset: () => setUnfolded(new Set()) }
}

/** The panels over the page, on what is picked: a capability, or a system. */
function MapPanels({ pick, laidOut, props, readOnly, width, onWidth, onPick, onClose, t }: {
  pick: Picked | undefined
  laidOut: LaidOutMap | undefined
  props: MapPageProps
  readOnly: boolean
  width: number
  onWidth(width: number): void
  onPick(id: ElementId): void
  onClose(): void
  t: Translate
}) {
  const { model, actions } = props
  if (pick?.kind === 'column' && laidOut) {
    const heldHere = model.elements.some((element) => element.id === pick.id)
    const open = props.onOpenApplication ? () => props.onOpenApplication?.(pick.id) : heldHere ? () => actions.onOpenElement(pick.id) : undefined
    return (
      <div className="map-page__dock">
        <ColumnPanel
          id={pick.id} map={laidOut} known={laidOut.columns.find((one) => one.id === pick.id)?.known ?? false} width={width}
          onClose={onClose} onSelect={onPick} t={t} onOpen={open}
        />
      </div>
    )
  }
  const selected = pick?.kind === 'row' ? model.elements.find((element) => element.id === pick.id) : undefined
  if (!selected) return null
  return (
    <div className="map-page__dock">
      <SeamResizer
        orientation="vertical" region="after" value={width} min={INSPECTOR_WIDTH.min} max={INSPECTOR_WIDTH.max}
        defaultValue={INSPECTOR_WIDTH.default} onChange={onWidth} label={t('sheet.resizeDetails')}
      />
      <FunctionInspector
        element={selected} model={model} readOnly={readOnly} actions={actions} width={width}
        applications={props.applications} onOpenDocumentation={props.onOpenDocumentation} elsewhere={props.elsewhere}
        onRemoved={onClose} onClose={onClose} onSelect={onPick} ownerOf={props.ownerOf} responsible={props.responsible}
        domains={props.domains} scales={props.scales ?? []} describe={props.describe}
      />
    </div>
  )
}

/** The dialogs of the bar, and the toast of a link. */
function MapDialogs({ map, props, exportOpen, onExportClose, exportPng, renaming, onRenaming, drawsOpen, onDrawsClose, readOnly, t }: {
  map: DesignDiagram | undefined
  props: MapPageProps
  exportOpen: boolean
  onExportClose(): void
  exportPng(layout: ExportLayout): Promise<void>
  renaming: string | undefined
  onRenaming(name: string | undefined): void
  drawsOpen: boolean
  onDrawsClose(): void
  readOnly: boolean
  t: Translate
}) {
  return (
    <>
      {exportOpen && map && (
        <SheetExportDialog
          name={map.name} initial="screen" onExport={exportPng} onClose={onExportClose} hint={t('map.exportHint')}
          {...(!readOnly && props.onUpdate ? { titleBlock: { map, onChange: props.onUpdate } } : {})}
        />
      )}
      {drawsOpen && map && props.onUpdate && (
        <MapDrawsDialog map={map} model={props.model} onOrder={(areas) => props.onUpdate?.({ areas })} onClose={onDrawsClose} t={t} />
      )}
      {renaming !== undefined && (
        <RenameDialog
          name={renaming} onChange={onRenaming} onCancel={() => onRenaming(undefined)} t={t}
          onDone={() => { if (renaming.trim() !== '') props.onRename?.(renaming.trim()); onRenaming(undefined) }}
        />
      )}
    </>
  )
}

function MapFind({ query, count, onQuery, onClose, t }: { query: string; count: number; onQuery(query: string): void; onClose(): void; t: Translate }) {
  return (
    <div className="sheet-find" role="search">
      <span className="sheet-find__field">
        <TextInput
          autoFocus value={query} placeholder={t('sheet.findPlaceholder')} aria-label={t('sheet.find')} onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Escape') { claimKey(event); onClose() } }}
        />
      </span>
      {query.trim() !== '' && <span className="sheet-find__count" role="status">{count === 0 ? t('sheet.findNone') : t('sheet.findCount', { count })}</span>}
    </div>
  )
}

/** The sentence over the page and the map's own legend, which stays on the page. */
function MapLine({ laidOut, legend, t }: { laidOut: LaidOutMap; legend: boolean; t: Translate }) {
  return (
    <div className="map-page__line">
      <span className="map-page__summary" data-testid="map-summary" data-guide="map.summary">{summaryOf(laidOut, t)}</span>
      {/* The legend is the matrix's: a list of gaps or overlaps draws none of its marks. */}
      {legend && <span data-testid="map-legend">{t('map.legend')}</span>}
    </div>
  )
}

/** A day looked at: one press back, and who may keep it on the view. */
function MapLook({ day, props, onBack, t }: { day: string; props: MapPageProps; onBack(): void; t: Translate }) {
  const { readOnly, onUpdate } = props
  return <LookBand day={day} onBack={onBack} t={t} {...(!readOnly && onUpdate ? { onKeep: () => { onUpdate({ asOf: day }); onBack() } } : {})} />
}

/** The day looked at, in the address, and that nothing is written while it lasts. */
function useMapDay(props: MapPageProps) {
  const [reading, changeReading] = usePlaceReading()
  const lookDay = reading.day
  const looking = lookDay !== undefined && lookDay !== props.map?.asOf
  const chooseDay = (day: string | undefined) => {
    const { day: _was, ...rest } = reading
    changeReading(day !== undefined ? { ...rest, day } : rest)
  }
  return { lookDay, look: looking ? lookDay : undefined, readOnly: props.readOnly || looking, chooseDay }
}

/** How many rows each filter keeps, and which rows a list shows instead of the matrix. */
function useMapRows(laidOut: LaidOutMap | undefined, filter: Filter, query: string) {
  const rows = useMemo(() => laidOut?.rows ?? [], [laidOut])
  const counts = useMemo(() => ({
    gaps: filtered(rows, 'gaps', '').length, overlaps: filtered(rows, 'overlaps', '').length, all: rows.filter((row) => row.leaf).length,
  }), [rows])
  const listed = filter !== 'all' || query.trim() !== ''
  const matched = useMemo(() => (listed ? filtered(rows, filter, query) : undefined), [listed, rows, filter, query])
  return { rows, counts, matched, hasRows: rows.length > 0 && laidOut !== undefined && laidOut.counts.covered + laidOut.counts.manual > 0 }
}

/**
 * The map's rows, on the day looked at, with each owner's columns together and
 * in the order they first came: a column that moves when a link is made takes the
 * cell under the cursor with it.
 */
function useLaidOutMap(props: MapPageProps, day: string | undefined, allColumns: boolean) {
  const { model, map, elsewhere, describe, today, applications } = props
  const ranks = useRef(new Map<ElementId, number>())
  const laidOut = useMemo(
    () => (map
      ? mapPage(model, day !== undefined ? { ...map, asOf: day } : map, {
        ...(elsewhere ? { elsewhere } : {}),
        ...(describe ? { describe } : {}),
        ...(today !== undefined ? { today } : {}),
        ...(allColumns && applications ? { allApplications: applications } : {}),
      })
      : undefined),
    [model, map, day, elsewhere, describe, today, allColumns, applications],
  )
  return useMemo(() => {
    if (!laidOut) return undefined
    const ranked = (id: ElementId) => {
      if (!ranks.current.has(id)) ranks.current.set(id, ranks.current.size)
      return ranks.current.get(id) ?? 0
    }
    const groups = laidOut.groups
      .map((group) => ({ group, rank: ranked(`group:${group.where ?? OWN_GROUP}`) }))
      .sort((a, b) => a.rank - b.rank)
      .map(({ group }) => ({ ...group, columns: group.columns.map((column) => ({ column, rank: ranked(column.id) })).sort((a, b) => a.rank - b.rank).map((held) => held.column) }))
    return { ...laidOut, groups, columns: groups.flatMap((group) => group.columns) }
  }, [laidOut])
}

export function MapPage(props: MapPageProps) {
  const { model, map } = props
  const { t } = useStrings()
  const page = useRef<HTMLDivElement | null>(null)
  const [pick, setPick] = useState<Picked | undefined>(undefined)
  const [detailsWidth, setDetailsWidth] = useState<number>(INSPECTOR_WIDTH.default)
  const [level, setLevel] = useState(OPENING_LEVEL)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [finding, setFinding] = useState(false)
  const [allColumns, setAllColumns] = useState(false)
  const [renaming, setRenaming] = useState<string | undefined>(undefined)
  const [exportOpen, setExportOpen] = useState(false)
  const [drawsOpen, setDrawsOpen] = useState(false)
  const [toast, setToast] = useState<ToastWords | null>(null)
  const sheetLevel = usePlaceTabFor('sheet')
  const { lookDay, look, readOnly, chooseDay } = useMapDay(props)
  const { exporting, exportPng } = useMapPicture(props, page, pick?.id)
  const laidOut = useLaidOutMap(props, lookDay, allColumns)
  const folds = useUnfolded(model)
  const pickRow = (id: ElementId) => { setPick({ kind: 'row', id }); folds.reveal(id) }
  const { locatedId, locate } = useLocated(page, pickRow, 'data-kit-row')
  useSelectRequest(props.select, laidOut && ((id) => laidOut.rows.some((row) => row.element.id === id)), locate)
  const cells = useCells(laidOut, props, t, setToast)

  const { rows, counts, matched, hasRows } = useMapRows(laidOut, filter, query)
  const Frame = props.inline ? InlineFrame : PageDialog
  const closeFind = () => { setFinding(false); setQuery('') }
  const name = map?.name ?? t('map.page')
  const topInset = (props.windowChrome ?? NO_WINDOW_CHROME).topInset
  return (
    <Frame open={props.open} topInset={topInset} onClose={props.onClose} aria-label={t('map.page')}>
      <MapBar
        props={props} readOnly={readOnly} t={t}
        at={{
          hasRows, counts, filter, onFilter: setFilter, level, onLevel: (to) => { setLevel(to); folds.reset() },
          day: lookDay ?? map?.asOf, onDay: chooseDay, finding, onFinding: () => (finding ? closeFind() : setFinding(true)),
          onExport: () => setExportOpen(true), onRename: () => setRenaming(map?.name), onDraws: () => setDrawsOpen(true),
          allColumns, onAllColumns: setAllColumns,
          onReading: (to) => { if (to !== 'coverage') { sheetLevel(to); props.onSheet?.() } },
        }}
      />
      {look !== undefined && <MapLook day={look} props={props} onBack={() => chooseDay(undefined)} t={t} />}
      {finding && <MapFind query={query} count={matched?.length ?? 0} onQuery={setQuery} onClose={closeFind} t={t} />}
      {laidOut && hasRows && <MapLine laidOut={laidOut} legend={filter === 'all'} t={t} />}
      <Box ref={page} className="sheet-page" data-exporting={exporting ? '' : undefined} sx={exporting ? undefined : locatedRing(locatedId, 'data-kit-row')}>
        <div className="sheet-page__work">
          <div className="map-page__grid" data-testid="map-body">
            <MapBody
              laidOut={laidOut} props={props} readOnly={readOnly} firstLeaf={rows.find((row) => row.leaf)?.element.id} matched={matched} pick={pick}
              title={listTitle(filter, counts, t)}
              onStart={pickRow} onPick={pickRow} t={t}
              matrix={laidOut && (
                <CoverageMatrix
                  laidOut={laidOut} name={name} cells={cells} pick={pick} readOnly={readOnly} t={t}
                  folded={exporting ? [] : foldedAt(rows, level).filter((id) => !folds.unfolded.has(id))} version={`${level}:${exporting}:${folds.revealed}`}
                  onPick={(id) => setPick({ kind: 'row', id })} onColumn={(id) => setPick({ kind: 'column', id })} onFold={folds.onFold}
                />
              )}
            />
          </div>
          {!exporting && (
            <MapPanels
              pick={pick} laidOut={laidOut} props={props} readOnly={readOnly} width={detailsWidth} onWidth={setDetailsWidth}
              onPick={pickRow} onClose={() => setPick(undefined)} t={t}
            />
          )}
        </div>
      </Box>
      <MapDialogs
        map={map} props={props} exportOpen={exportOpen} onExportClose={() => setExportOpen(false)} exportPng={exportPng} renaming={renaming} onRenaming={setRenaming}
        drawsOpen={drawsOpen} onDrawsClose={() => setDrawsOpen(false)} readOnly={readOnly} t={t}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </Frame>
  )
}

/** Which areas a map draws, which the model and the agent could always say and the page could not. */
function MapDrawsDialog({ map, model, onOrder, onClose, t }: { map: DesignDiagram; model: DesignModel; onOrder(areas: string[]): void; onClose(): void; t: Translate }) {
  const roots = rootsOfKind(model.elements, 'function').map((root) => root.id)
  const drawn = map.areas ?? roots
  return (
    <Dialog open size="m" title={t('map.draws')} onClose={onClose} actions={<Button onClick={onClose}>{t('common.close')}</Button>}>
      <OrderList
        heading={t('sheet.settingsAreas')} order={drawn} extra={roots.filter((id) => !drawn.includes(id))}
        named={(id) => model.elements.find((held) => held.id === id)?.name ?? id}
        onOrder={onOrder} drawWord={(name) => t('sheet.settingsDraw', { name })} t={t}
      />
    </Dialog>
  )
}

/** The group a column kept in this scope falls under, where others fall under theirs. */
const OWN_GROUP = '__own'

function RenameDialog({ name, onChange, onCancel, onDone, t }: { name: string; onChange(name: string): void; onCancel(): void; onDone(): void; t: Translate }) {
  return (
    <Dialog
      open title={t('map.rename')} onClose={onCancel} onSubmit={onDone}
      actions={<><Button variant="quiet" onClick={onCancel}>{t('common.cancel')}</Button><Button variant="primary" type="submit">{t('common.save')}</Button></>}
    >
      <TextField label={t('common.name')} value={name} onChange={onChange} autoFocus />
    </Dialog>
  )
}
