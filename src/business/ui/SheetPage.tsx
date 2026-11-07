// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The business architecture, on one page (ADR-0012 §6).
 *
 * A page, not a canvas: no React Flow, no drag, no router, no geometry. Every
 * position on it is derived from the model's own trees by `business/sheet.ts`,
 * and this file turns that answer into rows. The split is deliberate: the
 * arithmetic is tested in node, and a second drawing of the same page (the PNG an
 * agent asks for) cannot drift from the first, because there is only one answer.
 *
 * **Three readings of one layer.** *Names* is a reflowing grid of one-line rows
 * under area headings, downward only. *Overview* is every area on one screen, one
 * square per capability. *Coverage* is the crossing (`MapPage`), which keeps its
 * own address. Colour is one question at a time over the same layout
 * (`business/lens.ts`), and a day is read as a look: nothing can change while
 * looking at another one.
 *
 * **The window reflows and paper packs.** A sheet's paper, columns and an area's
 * width say how the *picture* is laid out and have no say over the screen, which
 * is why a window never scrolls sideways. For a picture the page lays itself out
 * at that width, with everything unfolded, and packs the areas by measuring them
 * (`business/grid`), since the fit decides what to draw and the measuring follows.
 *
 * **Every band can be written as well as read.** Each *+* is one `Command` through
 * the session, undoable with an Activity line, and selects what it made with the
 * cursor in its name. Under `readOnly`, and under a look, none of them is rendered.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import type { DesignDiagram, DesignElement, DesignModel, ElementId, Relation } from '../../model'
import type { AspectScale } from '../../model/aspectScale'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { plural } from '../../i18n/strings'
import { formatDay } from '../../i18n/dates'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { Band } from '../../widgets/kit/Band'
import { Button } from '../../widgets/kit/Button'
import { ColourMenu } from '../../widgets/kit/ColourMenu'
import { DayControl } from '../../widgets/kit/DayControl'
import type { DayGroup } from '../../widgets/kit/DayControl'
import { KeyStrip } from '../../widgets/kit/KeyStrip'
import type { KeyValue } from '../../widgets/kit/KeyStrip'
import type { MenuEntry } from '../../widgets/kit/Menu'
import { PageDialog } from '../../widgets/PageDialog'
import { SeamResizer } from '../../widgets/SeamResizer'
import { useSelectRequest } from '../../widgets/useSelectRequest'
import type { SelectRequest } from '../../widgets/useSelectRequest'
import { locatedRing, useLocated } from '../../widgets/useLocated'
import { usePlaceReading, usePlaceTab } from '../../widgets/placeTab'
import { useSessionSet } from '../../widgets/sessionMemory'
import { captureSheet } from '../../widgets/capturePage'
import type { PageCaptureOptions, PageHandle } from '../../widgets/capturePage'
import { lazyPart } from '../../widgets/lazyPart'
import { ArrivingDialog } from '../../widgets/Arriving'
import {
  AREA_COLUMN, fitSpans, isPaperSize, packAreas, paperHeight, paperOfWidth, paperWidth, sheetColumns, sheetPaper, spanOf,
} from '../grid'
import { coverageOf } from '../coverage'
import type { FunctionCoverage } from '../coverage'
import { DEFAULT_LENS, isSheetLens, lensCounts, lensValue, sheetLenses } from '../lens'
import type { LensFacts, LensValue, SheetLens } from '../lens'
import { liveRows } from '../map'
import type { MapDescribe } from '../map'
import { sheetPage } from '../sheet'
import type { SheetArea } from '../sheet'
import { drawnOnSheet, findOnSheet } from '../find'
import { leavesOfArea, rowAbove, rowsOfArea } from '../sheetRows'
import type { SheetRow } from '../sheetRows'
import { FunctionInspector, INSPECTOR_WIDTH } from './FunctionInspector'
import type { FunctionInspectorProps, NewLane, SheetActions, SheetDomains, SheetResponsible, Supporter } from './FunctionInspector'
import { useWho } from './Responsible'
import { AreaBlock, OverviewTile, onRowKeys } from './SheetRows'
import type { Answered, RowContext } from './SheetRows'
import { AreaAdds, EmptySheet } from './SheetAuthor'
import type { Author, SheetClaims } from './SheetAuthor'
import { JourneyBand } from './SheetJourney'
import { SheetRail } from './SheetRail'
import { FindBar } from './SheetFind'
import { ReadingSwitch, SheetBar } from './SheetBar'
import type { SheetReading } from './SheetBar'
import { LaneDialog } from './LaneDialog'
import { SheetExportDialog } from './SheetExportDialog'
import type { ExportLayout } from './SheetExportDialog'
import type { SheetSettingsDialog as SheetSettingsDialogShape } from './SheetSettingsDialog'
import { lensWord, lookOf, valueWord } from './sheetLook'
import { useRail } from './useRail'
import './Sheet.css'

export type { SheetClaims } from './SheetAuthor'

/** A sheet's settings are drawn only while they are open (`widgets/lazyPart`). */
const SheetSettingsDialog = lazyPart<ComponentProps<typeof SheetSettingsDialogShape>>(
  () => import('./SheetSettingsDialog').then((held) => held.SheetSettingsDialog), { fallback: () => <ArrivingDialog /> },
)

export type SheetPageProps = {
  open: boolean
  /** Drawn in the tab rather than as a page over the editor (ADR-0016). */
  inline?: boolean
  model: DesignModel
  /** Absent while the page is closing, or when the sheet was deleted under it. */
  sheet: DesignDiagram | undefined
  readOnly: boolean
  actions: SheetActions
  onClose(): void
  windowChrome?: WindowChrome
  /** The page, as the agent's renderer reaches it (ADR-0007). Absent = nothing can ask for a picture. */
  onHandle?(handle: SheetHandle | undefined): void
  /** Who answers for a record on this page, where it is not this scope (ADR-0012 §10). */
  ownerOf?: FunctionInspectorProps['ownerOf']
  /**
   * Rows written in another scope of the same organisation (ADR-0012 §2). It has
   * to be a STABLE array: it is a dependency of the page's one memo.
   */
  elsewhere?: readonly Relation[]
  /** Every application in the organisation, for *Supported by…*. */
  applications?: readonly Supporter[]
  /** Who may be made responsible for a function, and what they are called (ADR-0036, amended). Absent: no *Who answers*. */
  responsible?: SheetResponsible
  /** The functions a scope below holds a stand-in of (ADR-0040 §6). A STABLE set. */
  takenUp?: ReadonlySet<ElementId>
  /** Which domains a function is handed to and taken up by (ADR-0040 §4, §5). Absent: no *Domains*. */
  domains?: SheetDomains
  /** The functions of the sheets above this scope may take up (ADR-0040 §5). */
  claims?: SheetClaims
  /** The way to an element's own page. Absent = no *Page ›*. */
  onOpenDocumentation?(id: ElementId): void
  /** Hand a picture of the page to the person. Absent = no *Picture…*. */
  onSave?(doc: { name: string; bytes: Uint8Array; mediaType: 'image/png' }): void
  /** Select this, where the page draws it: a place opened with something selected on it. */
  select?: SelectRequest
  /** Where the rail's and the rows' folds are remembered for the session: the view's key. */
  remember?: string
  /** A short note to the person. */
  notify?(message: string): void
  /** The organisation's numeric scales (ADR-0046), each a question to colour by. */
  scales?: readonly AspectScale[]
  /** Names, owners and dates of what the rows name and this scope may not hold. */
  describe?: MapDescribe
  /** Today, so a sheet and its Coverage count the same rows. Absent counts every row. */
  today?: string
  /** The days worth looking at: each plan's. */
  days?: readonly DayGroup[]
  /** To the Coverage reading: this scope's map, made on first use where the person may. Absent: nowhere to go. */
  onCoverage?(): void
}

/** The handle every laid-out page hands over; the sheet's was the first (`widgets/capturePage`). */
export type SheetHandle = PageHandle
export type SheetCaptureOptions = PageCaptureOptions

const RAIL = { default: 200, min: 120, max: 420 } as const
/** The body's padding above and below the canvas: what the paper's height is not for. */
const PAGE_MARGINS = 32 + 24
/** The most pixels a picture may have: an A0 at two pixels per point, and the ratio falls on a taller page. */
const EXPORT_MAX_PIXELS = 40_000_000

const NOTHING_COVERS: FunctionCoverage = { supportedBy: [], assignedTo: [], coverage: 'uncovered' }

/** A name the file system will take, from what the sheet is called. */
export function fileSafe(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'sheet'
}

/** Four frames from now: React has drawn at the new width, the observers have measured, and React has packed. */
export function settled(): Promise<void> {
  const frame = typeof requestAnimationFrame === 'function'
    ? (fn: () => void) => { requestAnimationFrame(fn) }
    : (fn: () => void) => { setTimeout(fn, 0) }
  return new Promise((resolve) => frame(() => frame(() => frame(() => frame(resolve)))))
}

/** The page in the tab: the same column, with no dialog around it. */
export function InlineFrame({ children }: { children?: ReactNode; open?: boolean; topInset?: number; onClose?(): void; 'aria-label'?: string }) {
  return <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 }}>{children}</Box>
}

/** How tall each area is while a picture is packing them; one observer for all of them. */
function useMeasuredHeights() {
  const [heights, setHeights] = useState<Readonly<Record<ElementId, number>>>({})
  const observer = useRef<ResizeObserver | undefined>(undefined)
  const ids = useRef(new WeakMap<Element, ElementId>())
  const observe = useCallback((id: ElementId, node: HTMLElement | null) => {
    if (typeof ResizeObserver === 'undefined' || !node) return
    observer.current ??= new ResizeObserver((entries) => {
      setHeights((held) => {
        let next: Record<ElementId, number> | undefined
        for (const entry of entries) {
          const at = ids.current.get(entry.target)
          if (at === undefined) continue
          const height = Math.round(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height)
          if (held[at] === height) continue
          next ??= { ...held }
          next[at] = height
        }
        return next ?? held
      })
    })
    ids.current.set(node, id)
    observer.current.observe(node)
  }, [])
  return { observe, heights }
}

/** What an application's dates say on the day read: on its way out, wherever it is kept. */
export function retiringOn(model: Pick<DesignModel, 'elements'>, describe: MapDescribe | undefined) {
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  return (id: ElementId): boolean => {
    const own = byId.get(id)
    if (own?.lifecycle === 'retiring' || own?.lifecycleDates?.retiring !== undefined) return true
    const said = describe?.(id)
    return said?.retiring !== undefined || said?.retired !== undefined
  }
}

function answeredOf(leaves: readonly ElementId[], coverage: (id: ElementId) => FunctionCoverage, retiring: (id: ElementId) => boolean): Answered {
  const counts = lensCounts(leaves.map((id) => lensValue({ id } as DesignElement, 'coveredBy', { coverage, retiring })))
  const parts = ['apps', 'moving', 'people', 'none'].flatMap((value) => ((counts.get(value) ?? 0) > 0 ? [{ value, count: counts.get(value)! }] : []))
  return { answered: leaves.length - (counts.get('none') ?? 0), total: leaves.length, parts }
}

/** What a gesture on the page means: the rows and how they fold, named, walked and added to. */
function usePageSelection(model: DesignModel, remember: string | undefined) {
  const [selectedId, setSelectedId] = useState<ElementId | undefined>(undefined)
  const [naming, setNaming] = useState<{ id: ElementId; fresh: boolean; nonce: number } | undefined>(undefined)
  const [folded, setFolded] = useSessionSet(remember !== undefined ? `${remember}:folds` : undefined)
  const [journeyOpen, setJourneyOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(false)
  const toggleFold = useCallback((id: ElementId) => {
    const next = new Set(folded)
    if (!next.delete(id)) next.add(id)
    setFolded(next)
  }, [folded, setFolded])
  /** Whatever is to be seen has its band open and nothing folded above it. */
  const reveal = useCallback((id: ElementId) => {
    const element = model.elements.find((held) => held.id === id)
    if (element?.kind === 'step') setJourneyOpen(true)
    if (element?.kind === 'actor') setRailOpen(true)
    if (element?.kind !== 'function' || folded.size === 0) return
    const next = new Set(folded)
    for (let at = element.parentId; at !== undefined;) {
      next.delete(at)
      at = model.elements.find((held) => held.id === at)?.parentId
    }
    if (next.size !== folded.size) setFolded(next)
  }, [model.elements, folded, setFolded])
  const select = useCallback((id: ElementId | undefined) => {
    setSelectedId(id)
    if (id !== undefined) reveal(id)
  }, [reveal])
  const made = useCallback((id: ElementId | undefined) => {
    if (id === undefined) return
    setSelectedId(id)
    setNaming((was) => ({ id, fresh: true, nonce: (was?.nonce ?? 0) + 1 }))
    reveal(id)
  }, [reveal])
  const name = useCallback((id: ElementId) => {
    setNaming((was) => ({ id, fresh: false, nonce: (was?.nonce ?? 0) + 1 }))
  }, [])
  return { selectedId, select, naming, setNaming, made, name, folded, toggleFold, journeyOpen, setJourneyOpen, railOpen, setRailOpen }
}

export function SheetPage(props: SheetPageProps) {
  const { model, sheet, actions } = props
  const { t, language } = useStrings()
  const theme = useTheme()
  const page = useRef<HTMLDivElement | null>(null)
  // The reader's, and in the address: a link and an agent reach them, and a look writes nothing.
  const [tab, chooseTab] = usePlaceTab('names')
  const level = tab === 'overview' ? 'overview' : 'names'
  const [reading, changeReading] = usePlaceReading()
  const scales = useMemo(() => props.scales ?? [], [props.scales])

  // The day: a look when it is not what the view is saved on, and a look writes nothing (ADR-0027, amended).
  const day = reading.day ?? sheet?.asOf
  const looking = reading.day !== undefined && reading.day !== sheet?.asOf
  const readOnly = props.readOnly || looking

  const lensAsked = reading.colour ?? sheet?.colourBy
  const lens: SheetLens | undefined = lensAsked === 'none'
    ? undefined
    : isSheetLens(lensAsked, scales) ? lensAsked : DEFAULT_LENS
  const [only, setOnly] = useState<string | undefined>(undefined)

  const [laneOpen, setLaneOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [finding, setFinding] = useState(false)
  const [query, setQuery] = useState('')
  const [findAt, setFindAt] = useState<number | undefined>(undefined)
  const [railWidth, setRailWidth] = useState<number>(RAIL.default)
  const [detailsWidth, setDetailsWidth] = useState<number>(INSPECTOR_WIDTH.default)
  const [exporting, setExporting] = useState<{ width?: number } | undefined>(undefined)
  const cards = useMeasuredHeights()

  const rail = useRail(model, { remember: props.remember, readOnly, sheet, notify: props.notify, note: t('sheet.nowAUnit') })
  const asOf = day ?? props.today
  const live = useMemo(() => {
    const [relations, elsewhere] = liveRows(model, asOf, { elsewhere: props.elsewhere ?? [], ...(props.describe ? { describe: props.describe } : {}) })
    return { relations, elsewhere }
  }, [model, asOf, props.elsewhere, props.describe])
  const laidOut = useMemo(
    () => (sheet ? sheetPage({ elements: model.elements, relations: live.relations }, sheet, live.elsewhere, rail.options, props.takenUp) : undefined),
    [model.elements, live, sheet, rail.options, props.takenUp],
  )
  const covering = useMemo(() => coverageOf(live.relations, live.elsewhere), [live])
  const liveModel = useMemo(() => ({ ...model, relations: live.relations }), [model, live.relations])
  const who = useWho(liveModel, live.elsewhere, props.responsible, lens === 'who')

  const selection = usePageSelection(model, props.remember)
  const { selectedId, select, naming, setNaming, made, folded, toggleFold, journeyOpen, setJourneyOpen, railOpen, setRailOpen } = selection
  const selected = selectedId === undefined ? undefined : model.elements.find((element) => element.id === selectedId)

  const onHandle = props.onHandle
  const sheetId = sheet?.id
  const capture = useCallback(async (options: SheetCaptureOptions) => {
    const node = page.current
    if (!node) throw new Error('SheetPage: the page is not on screen')
    setExporting({ ...(options.width !== undefined ? { width: options.width } : {}) })
    try {
      await settled()
      return await captureSheet(node, { maxPixels: options.maxPixels, background: theme.palette.background.default })
    } finally {
      setExporting(undefined)
    }
  }, [theme])
  useEffect(() => {
    if (!onHandle) return undefined
    if (!props.open || sheetId === undefined) { onHandle(undefined); return undefined }
    onHandle({ diagramId: sheetId, capture, ...(selectedId !== undefined ? { selectedId } : {}) })
    return () => onHandle(undefined)
  }, [onHandle, props.open, sheetId, capture, selectedId])

  const { locatedId, locate: bringOn } = useLocated(page, select)
  useSelectRequest(props.select, laidOut && ((id) => drawnOnSheet(laidOut).some((hit) => hit.element.id === id)), bringOn)

  const hits = useMemo(() => (laidOut && finding ? findOnSheet(laidOut, query) : []), [laidOut, finding, query])
  const lit = useMemo(() => (finding && query.trim() !== '' ? new Set(hits.map((hit) => hit.element.id)) : undefined), [finding, query, hits])
  const closeFinder = useCallback(() => { setFinding(false); setQuery(''); setFindAt(undefined) }, [])
  const walkTo = (to: number) => {
    setFindAt(to)
    const hit = hits[to]
    if (hit) bringOn(hit.element.id)
  }

  const coverageAt = useCallback((id: ElementId) => covering.get(id) ?? NOTHING_COVERS, [covering])
  const retiring = useMemo(() => retiringOn(model, props.describe), [model, props.describe])
  const facts: LensFacts = useMemo(() => ({
    coverage: coverageAt, retiring, scales,
    ...(props.domains ? { takenUpBy: props.domains.takenUpBy } : {}),
  }), [coverageAt, retiring, scales, props.domains])
  const valueOf = useCallback((element: DesignElement): LensValue | undefined => (lens ? lensValue(element, lens, facts) : undefined), [lens, facts])

  const areaRows = useMemo(() => new Map((laidOut?.areas ?? []).map((area) => [area.element.id, rowsOfArea(area)])), [laidOut])
  const byId = useMemo(() => new Map(model.elements.map((element) => [element.id, element])), [model.elements])
  const allLeaves = useMemo(() => [...areaRows.entries()].flatMap(([area, rows]) => {
    const leaves = leavesOfArea(rows)
    return leaves.length > 0 ? leaves : [area]
  }), [areaRows])

  const keyValues: KeyValue[] = useMemo(() => {
    if (!lens) return []
    const counts = lensCounts(allLeaves.flatMap((id) => { const element = byId.get(id); return element ? [lensValue(element, lens, facts)] : [] }))
    return [...counts].map(([value, count]) => {
      const look = lookOf(lens, { value, ...(lens.startsWith('aspect:') && value !== 'unrated' ? { heat: headingHeat(scales, lens, value) } : {}) })
      return { id: value, label: valueWord(lens, value, t), count, ...(look.mark ? { mark: look.mark } : {}), ...(look.colour && !look.hollow ? { swatch: look.colour } : {}) }
    })
  }, [lens, allLeaves, byId, facts, scales, t])

  const author: Author | undefined = readOnly ? undefined : { t, made, actions }

  const named = useCallback((id: ElementId) => (
    props.domains?.name(id) ?? props.describe?.(id)?.name ?? byId.get(id)?.name ?? props.responsible?.name(id) ?? id
  ), [props.domains, props.describe, props.responsible, byId])
  const namedFact = useCallback((id: ElementId) => {
    // A path holds a slash, or is the organisation's own; an element's id holds neither, and the domains speak in paths.
    if (lens === 'domains' && props.domains) return props.domains.name(id)
    return props.describe?.(id)?.name ?? byId.get(id)?.name ?? named(id)
  }, [lens, props.domains, props.describe, byId, named])

  const onNamed: RowContext['onNamed'] = (id, name, then) => {
    const element = byId.get(id)
    const fresh = naming?.fresh === true
    setNaming(undefined)
    if (!element) return
    if (name !== element.name) actions.updateElement(id, { name })
    if (then === 'next' && fresh && element.kind === 'function') {
      made(actions.addElement({ kind: 'function', name: t('sheet.nameCapability'), ...(element.parentId !== undefined ? { parentId: element.parentId } : {}) }))
    }
    if (then === 'under' && fresh) {
      const rows = element.parentId !== undefined ? rowsFor(areaRows, id) : []
      const above = rowAbove(rows, id)
      if (above) actions.updateElement(id, { parentId: above.element.id })
    }
  }

  const context: RowContext = {
    lens, valueOf, named: namedFact, who, selectedId, only, hits: lit, folded, answers: (id) => coverageAt(id).coverage !== 'uncovered',
    onFold: toggleFold, onSelect: select, naming: naming && !readOnly ? { id: naming.id } : undefined, onNamed, onName: selection.name, t,
    ...(author ? {
      onAddUnder: (parent: DesignElement) => made(actions.addElement({ kind: 'function', name: t('sheet.nameCapability'), parentId: parent.id })),
    } : {}),
  }

  const paper = sheet ? (exporting?.width !== undefined ? paperOfWidth(exporting.width) : undefined) ?? sheetPaper(sheet) : undefined
  const pictureWidth = exporting ? exporting.width ?? (paper !== undefined ? paperWidth(paper) : undefined) : undefined
  const columns = sheet && pictureWidth !== undefined ? sheetColumns(sheet, pictureWidth - 32) : 1
  const fitted = useMemo(() => {
    if (!exporting || !laidOut || !sheet || paper === undefined) return undefined
    return fitSpans(laidOut.areas.map((area) => ({
      id: area.element.id,
      groupings: area.groupings.map((group) => group.capabilities.length),
      loose: area.capabilities.length,
      ...(sheet.areaSpans?.[area.element.id] !== undefined ? { fixed: sheet.areaSpans[area.element.id] } : {}),
    })), columns, Math.max(0, paperHeight(paper) - PAGE_MARGINS))
  }, [exporting, laidOut, sheet, paper, columns])
  const packed = useMemo(() => (exporting && laidOut && sheet
    ? packAreas(laidOut.areas.map((area) => ({
      id: area.element.id,
      span: fitted?.[area.element.id] ?? spanOf(sheet, area.element.id, columns),
      height: cards.heights[area.element.id] ?? 0,
    })), columns)
    : undefined), [exporting, laidOut, sheet, fitted, columns, cards.heights])

  const exportPng = useCallback(async (layout: ExportLayout) => {
    if (!sheet || !props.onSave) return
    const shot = await capture({ maxPixels: EXPORT_MAX_PIXELS, ...(layout === 'screen' ? {} : { width: paperWidth(layout) }) })
    props.onSave({ name: `${fileSafe(sheet.name)}.png`, bytes: shot.png, mediaType: 'image/png' })
  }, [sheet, props.onSave, capture])

  const more: MenuEntry[] = [
    ...(props.onSave ? [{ label: t('sheet.export'), onSelect: () => setExportOpen(true) }] : []),
    ...(!readOnly && sheet ? [{ label: t('sheet.settings'), onSelect: () => setSettingsOpen(true) }] : []),
  ]
  const onReadingPress = (to: SheetReading) => {
    if (to === 'coverage') props.onCoverage?.()
    else chooseTab(to)
  }
  const areaOf = (area: SheetArea) => {
    const rows = areaRows.get(area.element.id) ?? []
    const leaves = leavesOfArea(rows)
    return { rows, leaves: leaves.length > 0 ? leaves : [area.element.id] }
  }
  const openArea = (id: ElementId) => {
    chooseTab('names')
    requestAnimationFrame?.(() => bringOn(id))
  }
  const owned = (area: SheetArea) => props.ownerOf?.(area.element.id)
  const own = (laidOut?.areas ?? []).filter((area) => !owned(area))
  const standIns = (laidOut?.areas ?? []).filter((area) => owned(area))

  const block = (area: SheetArea, position?: ComponentProps<typeof AreaBlock>['position'], span?: number) => {
    const { rows, leaves } = areaOf(area)
    const domain = area.domain
    const broken = domain !== undefined && props.domains?.known && !props.domains.known(domain)
    const owner = owned(area)
    return (
      <AreaBlock
        key={area.element.id} area={area} rows={rows} answered={answeredOf(leaves, coverageAt, retiring)} context={exporting ? { ...context, folded: new Set(), onAddUnder: undefined, naming: undefined } : context}
        {...(position ? { position } : {})} {...(span !== undefined ? { width: span } : {})}
        {...(broken ? { problem: t('sheet.domainGone', { name: props.domains?.name(domain) ?? domain }) } : {})}
        {...(owner ? { standIn: t('standIn.definedIn', { scope: owner.label }) } : {})}
      >
        {exporting && <span ref={(node) => cards.observe(area.element.id, node?.parentElement ?? null)} hidden />}
      </AreaBlock>
    )
  }

  const leaveLook = () => { const { day: _was, ...rest } = reading; changeReading(rest) }
  const Frame = props.inline ? InlineFrame : PageDialog
  const unmapped = laidOut?.unmapped ?? []
  const panelUp = selected !== undefined && !exporting
  return (
    <Frame open={props.open} topInset={(props.windowChrome ?? NO_WINDOW_CHROME).topInset} onClose={props.onClose} aria-label={t('sheet.page')}>
      <SheetBar
        t={t}
        reading={(
          <ReadingSwitch value={level} onChange={onReadingPress} canCover={props.onCoverage !== undefined} t={t} guide="sheet.reading" />
        )}
        {...(sheet ? {
          colour: (
            <ColourMenu
              data-guide="sheet.showResponsible"
              questions={sheetLenses(scales, { who: props.responsible !== undefined, domains: props.domains !== undefined }).map((id) => ({ id, label: lensWord(id, scales, t) }))}
              value={lens} onChange={(to) => { setOnly(undefined); changeReading({ ...reading, colour: to ?? 'none' }) }}
            />
          ),
          day: (
            <DayControl
              data-guide="sheet.day" day={day} groups={props.days ?? []}
              onChange={(to) => { const { day: _was, ...rest } = reading; const asked = to ?? (sheet.asOf !== undefined ? props.today : undefined); changeReading(asked !== undefined ? { ...rest, day: asked } : rest) }}
            />
          ),
          ...(laidOut?.journey ? { journey: { shown: journeyOpen, onShown: setJourneyOpen } } : {}),
          ...(sheet.showActors !== false ? { stakeholders: { shown: railOpen, onShown: setRailOpen } } : {}),
        } : {})}
        finding={finding} onFind={() => (finding ? closeFinder() : setFinding(true))} more={more}
      />
      {looking && reading.day !== undefined && (
        <Band
          tone="looking" title={t('sheet.looking', { day: formatDay(reading.day, language) })} detail={t('sheet.lookingDetail')}
          action={(
            <>
              <Button variant="plain" size="small" onClick={leaveLook}>{t('sheet.lookingBack')}</Button>
              {!props.readOnly && <Button variant="quiet" size="small" onClick={() => { actions.updateSheet({ asOf: reading.day }); leaveLook() }}>{t('sheet.lookingKeep')}</Button>}
            </>
          )}
        />
      )}
      {finding && <FindBar query={query} hits={hits} at={findAt} onQuery={(to) => { setQuery(to); setFindAt(undefined) }} onWalk={walkTo} onClose={closeFinder} t={t} />}

      <Box
        ref={page} className="sheet-page" data-exporting={exporting ? '' : undefined}
        style={exporting?.width !== undefined ? { width: exporting.width } : undefined}
        sx={exporting ? undefined : locatedRing(locatedId)}
      >
        {laidOut?.journey && (journeyOpen || !exporting) && (
          <JourneyBand
            journey={laidOut.journey} open={journeyOpen || exporting !== undefined} onOpen={setJourneyOpen}
            selectedId={selectedId} onSelect={select} onNewLane={() => setLaneOpen(true)} author={author} t={t}
          />
        )}
        {(laidOut?.areas.length ?? 0) > 0 && lens && (
          <div className="sheet-page__keyRow">
            <KeyStrip
              values={keyValues} pressed={only} onPress={setOnly} data-guide="sheet.key"
              {...(!props.readOnly && sheet && lens !== sheet.colourBy && !(sheet.colourBy === undefined && lens === DEFAULT_LENS)
                ? { onKeep: () => actions.updateSheet({ colourBy: lens as DesignDiagram['colourBy'] }) }
                : {})}
            />
            {unmapped.length > 0 && (
              <button type="button" className="sheet-page__link sheet-page__keyEnd" onClick={() => document.getElementById('sheet-unmapped')?.scrollIntoView?.()}>
                {plural(t, { one: 'sheet.unmappedJumpOne', other: 'sheet.unmappedJumpOther' }, unmapped.length)}
              </button>
            )}
          </div>
        )}

        <div className="sheet-page__work">
          {laidOut && sheet?.showActors !== false && (railOpen || exporting) && (
            <>
              <SheetRail
                actors={laidOut.actors} width={railWidth} selectedId={selectedId} onSelect={select} t={t}
                author={exporting ? undefined : author} {...(exporting ? {} : { units: rail.units(laidOut) })}
              />
              {!exporting && (
                <SeamResizer
                  orientation="vertical" region="before" value={railWidth} min={RAIL.min} max={RAIL.max} defaultValue={RAIL.default}
                  onChange={setRailWidth} label={t('sheet.resizeRail')}
                />
              )}
            </>
          )}
          <div
            className="sheet-page__body" data-testid="sheet-body" onKeyDown={(event) => onRowKeys(event, context)}
          >
            <div data-testid="sheet-canvas" data-guide="sheet.canvas" className="sheet-rows" data-finding={lit ? '' : undefined}>
              {!laidOut?.journey && author && (laidOut?.areas.length ?? 0) > 0 && (
                <div className="sheet-adds">
                  <Button variant="quiet" size="small" onClick={() => made(actions.addJourney({ journey: t('sheet.nameJourney'), phase: t('sheet.nameFirstPhase') }))}>{t('sheet.newJourney')}</Button>
                </div>
              )}
              {laidOut && (laidOut.areas.length === 0
                ? <EmptySheet author={author} claims={props.claims} t={t} />
                : level === 'overview' && !exporting
                  ? (
                    <div className="sheet-tiles">
                      {laidOut.areas.map((area) => {
                        const { rows, leaves } = areaOf(area)
                        return (
                          <OverviewTile
                            key={area.element.id} area={area} answered={answeredOf(leaves, coverageAt, retiring)} lens={lens} valueOf={valueOf}
                            leaves={leaves.flatMap((id) => { const element = byId.get(id); return element ? [element] : [] })}
                            items={rows.length} onOpen={openArea} t={t}
                          />
                        )
                      })}
                    </div>
                  )
                  : exporting && packed
                    ? (
                      <div className="sheet-areas__packed" data-testid="sheet-areas" data-columns={columns} style={{ height: packed.height }}>
                        {laidOut.areas.map((area) => {
                          const at = packed.placed.find((held) => held.id === area.element.id)
                          if (!at) return null
                          const pitch = `(100% + ${AREA_COLUMN.gap}px) / ${columns}`
                          return block(area, { left: `calc(${pitch} * ${at.column})`, width: `calc(${pitch} * ${at.span} - ${AREA_COLUMN.gap}px)`, top: at.top }, at.span)
                        })}
                      </div>
                    )
                    : (
                      <>
                        <div className="sheet-areas" data-testid="sheet-areas">{own.map((area) => block(area))}</div>
                        {standIns.length > 0 && (
                          <>
                            <h3 className="sheet-areas__heading">{t('sheet.takenUpSection')}</h3>
                            <div className="sheet-areas">{standIns.map((area) => block(area))}</div>
                          </>
                        )}
                      </>
                    ))}
              {author && (laidOut?.areas.length ?? 0) > 0 && <AreaAdds author={author} claims={props.claims} label={t('sheet.addArea')} />}
              {unmapped.length > 0 && level !== 'overview' && <UnmappedBand elements={unmapped} selectedId={selectedId} onSelect={select} t={t} />}
            </div>
          </div>
          {panelUp && (
            <div className="sheet-page__over">
              <SeamResizer
                orientation="vertical" region="after" value={detailsWidth} min={INSPECTOR_WIDTH.min} max={INSPECTOR_WIDTH.max}
                defaultValue={INSPECTOR_WIDTH.default} onChange={setDetailsWidth} label={t('sheet.resizeDetails')}
              />
              <FunctionInspector
                element={selected} model={model} readOnly={readOnly} actions={actions} width={detailsWidth}
                applications={props.applications} onOpenDocumentation={props.onOpenDocumentation} elsewhere={props.elsewhere}
                {...(naming && naming.id === selected?.id && selected.kind !== 'function' ? { nameFocus: naming.nonce } : {})}
                responsible={props.responsible} domains={props.domains} ownerOf={props.ownerOf} scales={scales}
                describe={props.describe} today={asOf}
                onClose={() => select(undefined)} onRemoved={() => select(undefined)} onSelect={select}
                columnsInPrint={sheet ? { span: sheet.areaSpans?.[selected.id] ?? 1, onSpan: (areaSpans) => actions.updateSheet({ areaSpans }), spans: sheet.areaSpans, drawn: laidOut?.areas.some((area) => area.element.id === selected.id) ?? false } : undefined}
              />
            </div>
          )}
        </div>
      </Box>

      {laneOpen && laidOut?.journey && (
        <LaneDialog
          model={model} phases={laidOut.journey.phases} onCancel={() => setLaneOpen(false)}
          onConfirm={(lane: NewLane) => { setLaneOpen(false); made(actions.addLane(lane)) }}
        />
      )}
      {settingsOpen && sheet && <SheetSettingsDialog model={model} sheet={sheet} actions={actions} onClose={() => setSettingsOpen(false)} />}
      {exportOpen && sheet && (
        <SheetExportDialog
          initial={isPaperSize(sheet.paper) ? sheet.paper : 'screen'} onExport={exportPng} onClose={() => setExportOpen(false)}
          {...(!props.readOnly ? { sheet, actions } : {})}
        />
      )}
    </Frame>
  )
}

/** The rows of the area a function sits in. */
function rowsFor(areas: ReadonlyMap<ElementId, readonly SheetRow[]>, id: ElementId): readonly SheetRow[] {
  for (const rows of areas.values()) if (rows.some((row) => row.element.id === id)) return rows
  return []
}

/** A rating on the key takes the step its rows draw. */
function headingHeat(scales: readonly AspectScale[], lens: string, value: string): number {
  const held = lensValue({ id: '', kind: 'function', ratings: { [lens.slice('aspect:'.length)]: Number(value) } } as unknown as DesignElement, lens as SheetLens, { coverage: () => NOTHING_COVERS, retiring: () => false, scales })
  return held.heat ?? 1
}

function UnmappedBand({ elements, selectedId, onSelect, t }: {
  elements: readonly DesignElement[]
  selectedId: ElementId | undefined
  onSelect(id: ElementId): void
  t: Translate
}) {
  return (
    <div className="sheet-unmapped" id="sheet-unmapped" data-testid="sheet-unmapped" data-guide="sheet.unmapped">
      <div className="sheet-unmapped__title">{t('sheet.unmapped')} · {t('sheet.unmappedCount', { count: elements.length })}</div>
      <div>{t('sheet.unmappedSay')}</div>
      <div className="sheet-unmapped__rows">
        {elements.map((element) => (
          <button
            type="button" key={element.id} className="sheet-unmapped__row" data-testid={`sheet-unmapped-${element.id}`} data-element-id={element.id}
            aria-current={selectedId === element.id || undefined} onClick={() => onSelect(element.id)}
          >{element.name}</button>
        ))}
      </div>
    </div>
  )
}
