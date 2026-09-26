// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The business architecture, on one page (ADR-0012 §6).
 *
 * A page, not a canvas: no React Flow, no drag, no router, no geometry. Every
 * position on it is derived from the model's own trees by `business/sheet.ts`
 * and this file turns that answer into boxes — a cell into a chevron, a depth
 * into a card. The split is deliberate: the arithmetic is tested in node, and
 * a second drawing of the same page (the PNG an agent asks for) cannot drift
 * from the first, because there is only one answer to draw.
 *
 * Four bands, top to bottom and left to right: the stakeholder rail down the
 * side, the journey across the top with a row per lane, the responsibility
 * areas as columns, and what nobody has mapped to a domain yet.
 *
 * **Every band can be written as well as read.** Beta 1 drew all of this and
 * offered nothing to make it with, so the only authors were a file and an
 * agent; the first person to try the beta hit that in the first minute. Each
 * *+* here is one `Command` through the session — undoable, with an Activity
 * line — and each one selects what it just made and puts the cursor in its
 * name, so the whole gesture is click, type, Enter. Under `readOnly` not one
 * of them is rendered.
 *
 * **The areas are packed, not three columns.** How many columns is what the
 * width has room for, or what the sheet fixes; an area takes the columns the
 * sheet says it does, with one column of capabilities per column it takes;
 * and the page measures each card and drops it at the lowest place it fits,
 * in the sheet's own order (`business/grid.packAreas`). The first sheet
 * drawn for a real organisation had eleven areas of very different sizes in
 * three tall columns, and a CSS grid after it left the whole of a row empty
 * under its shortest card — which is why the cards are placed by hand.
 *
 * **On paper, the page is landscape.** A sheet of paper has two sides, and
 * the first real sheet — fifteen areas of a column each — came out three
 * deep down an A2, a portrait page on a landscape canvas. So on paper an
 * area nobody has made wider or narrower is given the columns that bring
 * the page under the short side (`business/grid.fitSpans`), worked out from
 * what each area holds rather than measured, because the fit decides what
 * to draw and the measuring comes after. A span a person set is kept, one
 * column included. The window (`fit`) has no short side, and there the
 * spans are the sheet's own.
 *
 * The rail and the details are the page's own: one eye hides both, and each
 * has a seam to drag. The glass beside the eye finds anything the page draws
 * by name (`business/find.ts`) and takes you to it: selected, scrolled into
 * view, and ringed for a moment — a wall-sized sheet in a laptop window is
 * mostly off screen, and a name is how a person knows what they are after. A picture of the page can be asked for at the width of
 * a sheet of paper, and the page lays itself out at that width for the
 * capture — an A1 print tiles wider than a laptop window does.
 *
 * A fullscreen dialog, and it takes `windowChrome` for the reason the other
 * pages do: the shell toolbar's drag strip stays live underneath it, and
 * Electron computes drag regions from geometry rather than from what is
 * painted on top.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Popover from '@mui/material/Popover'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import type { DesignDiagram, DesignElement, DesignModel, ElementId } from '../../model'
import { useStrings } from '../../i18n'
import { plural } from '../../i18n/strings'
import type { Translate } from '../../i18n'
import { NO_WINDOW_CHROME, barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { BackIcon, ExportIcon, EyeIcon, SearchIcon, SlidersIcon } from '../../widgets/icons'
import { PageDialog } from '../../widgets/PageDialog'
import { SeamResizer } from '../../widgets/SeamResizer'
import {
  AREA_COLUMN, MAX_SPAN, fitSpans, isPaperSize, packAreas, paperHeight, paperOfWidth, paperWidth, sheetColumns, sheetPaper,
  sheetPaperWidth, spanOf, withSpan,
} from '../grid'
import { sheetPage } from '../sheet'
import { findOnSheet } from '../find'
import type { SheetBand, SheetHit } from '../find'
import type { Relation } from '../../model'
import type { SheetActor, SheetArea, SheetCapability, SheetJourney, SheetLane, SheetStep } from '../sheet'
import type { PageCaptureOptions, PageHandle } from '../../widgets/capturePage'
import { captureSheet } from '../../widgets/capturePage'
import { FunctionInspector, INSPECTOR_WIDTH } from './FunctionInspector'
import type { FunctionInspectorProps, NewLane, SheetActions, Supporter } from './FunctionInspector'
import { LaneDialog } from './LaneDialog'
import { SheetExportDialog } from './SheetExportDialog'
import type { ExportLayout } from './SheetExportDialog'
import { SheetSettingsDialog } from './SheetSettingsDialog'

export type SheetPageProps = {
  open: boolean
  /**
   * Drawn in the tab rather than as a page over the editor (ADR-0016): no
   * dialog, no back button, no window chrome — the tab strip is the way out.
   */
  inline?: boolean
  model: DesignModel
  /** Absent while the page is closing, or when the sheet was deleted under it. */
  sheet: DesignDiagram | undefined
  readOnly: boolean
  actions: SheetActions
  onClose(): void
  windowChrome?: WindowChrome
  /**
   * The page, as the agent's renderer reaches it (ADR-0007): handed over while
   * one is on screen and withdrawn when it goes, the way the editor hands the
   * workspace its own handle. Absent = nothing can ask for a picture.
   */
  onHandle?(handle: SheetHandle | undefined): void
  /**
   * Who answers for a record on this page, where it is not this scope
   * (ADR-0012 §10). Passed straight to the inspector; see it for the shape and
   * for why `business` is handed the answer rather than working it out.
   */
  ownerOf?: FunctionInspectorProps['ownerOf']
  /**
   * Rows written in another scope of the same organisation (ADR-0012 §2) —
   * see `sheetPage`. The `supports` rows behind "2 apps" under a capability
   * this scope defines are usually a landscape's, not this page's.
   *
   * It has to be a STABLE array: it is a dependency of the page's one memo,
   * and a fresh one per render would lay the whole sheet out per render.
   */
  elsewhere?: readonly Relation[]
  /** Every application in the organisation, for *Supported by…*. See the inspector. */
  applications?: readonly Supporter[]
  /** The way to an element's own page. Absent = no *Details ›* on the inspector. */
  onOpenDocumentation?(id: ElementId): void
  /**
   * Hand a picture of the page to the person (ADR-0003's gateway, behind the
   * host). Absent = no *Save as a picture…* on the bar.
   */
  onSave?(doc: { name: string; bytes: Uint8Array; mediaType: 'image/png' }): void
}

/** What only the drawn page can do: hand over what it looks like. */
/** The handle every laid-out page hands over; the sheet's was the first (`widgets/capturePage`). */
export type SheetHandle = PageHandle
export type SheetCaptureOptions = PageCaptureOptions

/** The rail, the lane labels and the notch: the design's own numbers, in one place. */
const RAIL = { default: 178, min: 120, max: 420 } as const
const LANE_LABEL_WIDTH = 136
const NOTCH = 9
/** The column the *+ phase* sits in, kept off the phases so the row lines up. */
const ADD_COLUMN = 72
const CHEVRON = `polygon(0 0, calc(100% - ${NOTCH}px) 0, 100% 50%, calc(100% - ${NOTCH}px) 100%, 0 100%)`
/** The body's padding above and below the canvas, and the gap over the areas: what the paper's height is not for. */
const PAGE_MARGINS = 32 + 24

export function SheetPage(props: SheetPageProps) {
  const { model, sheet, readOnly, actions } = props
  const { t } = useStrings()
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const bar = barChromeFor(chrome)
  const [selectedId, setSelectedId] = useState<ElementId | undefined>(undefined)
  /**
   * A nonce rather than a flag: "put the cursor in the name" asked twice is
   * two requests, and the inspector is not remounted between two things made
   * one after the other.
   */
  const [nameFocus, setNameFocus] = useState(0)
  const [laneOpen, setLaneOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  /**
   * The rail and the details, together: one eye for both, because "give me
   * the whole width for the page" is one wish and was two toggles. The
   * page's own rather than the sheet's, since it says nothing about what the
   * sheet is of; `showActors` on the sheet still takes the rail off for good.
   */
  const [panelsShown, setPanelsShown] = useState(true)
  /** The finder under the glass: where it is anchored while open, and what is typed in it. */
  const [findAnchor, setFindAnchor] = useState<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  /**
   * The thing the finder last took you to, ringed until the timer clears it.
   * Drawn as one rule on the page keyed by the id rather than a prop through
   * seven kinds of card, because it is a moment's emphasis and not state any
   * card has a say in.
   */
  const [locatedId, setLocatedId] = useState<ElementId | undefined>(undefined)
  const locatedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(locatedTimer.current), [])
  const [railWidth, setRailWidth] = useState<number>(RAIL.default)
  const [detailsWidth, setDetailsWidth] = useState<number>(INSPECTOR_WIDTH.default)
  /**
   * While a picture is being drawn: the page laid out for it rather than for
   * the window — no details panel, nothing scrolling, and at `width` when a
   * paper size asked for one. Cleared the moment the capture returns.
   */
  const [exporting, setExporting] = useState<{ width?: number } | undefined>(undefined)
  const theme = useTheme()
  const page = useRef<HTMLDivElement | null>(null)
  const bodyWidth = useMeasuredWidth()
  const cards = useMeasuredHeights()
  const above = useMeasuredHeight()

  /**
   * The handle, while a sheet is up. Withdrawn on the way out so a request
   * that arrives after the page has closed is refused rather than answered
   * with a picture of nothing.
   */
  const onHandle = props.onHandle
  const sheetId = sheet?.id
  const capture = useCallback(async (options: SheetCaptureOptions) => {
    const node = page.current
    if (!node) throw new Error('SheetPage: the page is not on screen')
    // Laid out for the picture first, and given two frames to be: the grid
    // is measured by a ResizeObserver and drawn by React, and neither has
    // run between a state change and the next line of this function.
    setExporting({ ...(options.width !== undefined ? { width: options.width } : {}) })
    try {
      await settled()
      return await captureSheet(node, {
        maxPixels: options.maxPixels, background: theme.palette.background.default,
      })
    } finally {
      setExporting(undefined)
    }
  }, [theme])
  useEffect(() => {
    if (!onHandle) return undefined
    if (!props.open || sheetId === undefined) { onHandle(undefined); return undefined }
    onHandle({ diagramId: sheetId, capture })
    return () => onHandle(undefined)
  }, [onHandle, props.open, sheetId, capture])

  const laidOut = useMemo(
    () => (sheet ? sheetPage(model, sheet, props.elsewhere) : undefined),
    [model, sheet, props.elsewhere],
  )
  const selected = selectedId === undefined
    ? undefined
    : model.elements.find((element) => element.id === selectedId)

  /** What every gesture that makes something ends with. */
  const made = useCallback((id: ElementId | undefined) => {
    if (id === undefined) return
    setSelectedId(id)
    setNameFocus((nonce) => nonce + 1)
  }, [])

  const author = readOnly ? undefined : { t, made, actions }

  const hits = useMemo(
    () => (laidOut && findAnchor ? findOnSheet(laidOut, query) : []),
    [laidOut, findAnchor, query],
  )
  const closeFinder = useCallback(() => { setFindAnchor(null); setQuery('') }, [])
  /** Select it, bring it on screen, and ring it for a moment. */
  const locate = useCallback((id: ElementId) => {
    closeFinder()
    setSelectedId(id)
    setLocatedId(id)
    clearTimeout(locatedTimer.current)
    locatedTimer.current = setTimeout(() => setLocatedId(undefined), LOCATED_FOR_MS)
    // The card carries its id as data, so the page can find it without a ref
    // per card; jsdom has no scrollIntoView, hence the optional call.
    const node = page.current?.querySelector<HTMLElement>(`[data-element-id="${id}"]`)
    node?.scrollIntoView?.({ block: 'center', inline: 'center', behavior: 'smooth' })
  }, [closeFinder])

  /**
   * The width the page is laid out at: what a picture asked for, else the
   * sheet's own paper, else the window. The grid gets it less the body's
   * padding, which the observer counts and the grid does not. A canvas wider
   * than the window scrolls sideways, which is what a wall-sized page in a
   * laptop window is.
   */
  const layoutWidth = exporting?.width ?? (sheet ? sheetPaperWidth(sheet) : undefined)
  const gridWidth = (layoutWidth ?? bodyWidth.width) - 32
  const columns = sheet ? sheetColumns(sheet, gridWidth) : 1
  /**
   * The paper the page is on, for its short side: the one a picture asked
   * for, else the sheet's own; a picture at a width that is no paper's is
   * still fitted to the sheet's height. None for the window.
   */
  const paper = sheet
    ? (exporting?.width !== undefined ? paperOfWidth(exporting.width) : undefined) ?? sheetPaper(sheet)
    : undefined
  const fitted = useMemo(() => {
    if (!laidOut || !sheet || paper === undefined) return undefined
    const target = paperHeight(paper) - above.height - PAGE_MARGINS
    return fitSpans(laidOut.areas.map((area) => ({
      id: area.element.id,
      groupings: area.groupings.map((group) => group.capabilities.length),
      loose: area.capabilities.length,
      ...(sheet.areaSpans?.[area.element.id] !== undefined ? { fixed: sheet.areaSpans[area.element.id] } : {}),
    })), columns, Math.max(0, target))
  }, [laidOut, sheet, paper, columns, above.height])
  const packed = useMemo(() => (laidOut && sheet
    ? packAreas(laidOut.areas.map((area) => ({
      id: area.element.id,
      span: fitted?.[area.element.id] ?? spanOf(sheet, area.element.id, columns),
      height: cards.heights[area.element.id] ?? 0,
    })), columns)
    : undefined), [laidOut, sheet, fitted, columns, cards.heights])
  const fixedWidth = layoutWidth
    ?? (sheet?.columns !== undefined ? columns * (AREA_COLUMN.min + AREA_COLUMN.gap) - AREA_COLUMN.gap + 32 : undefined)
  const panels = panelsShown && !exporting

  const exportPng = useCallback(async (layout: ExportLayout) => {
    if (!sheet || !props.onSave) return
    const shot = await capture({
      maxPixels: EXPORT_MAX_PIXELS,
      ...(layout === 'screen' ? {} : { width: paperWidth(layout) }),
    })
    props.onSave({ name: `${fileSafe(sheet.name)}.png`, bytes: shot.png, mediaType: 'image/png' })
  }, [sheet, props.onSave, capture])

  const Frame = props.inline ? InlineFrame : PageDialog
  return (
    <Frame
      open={props.open}
      topInset={chrome.topInset}
      onClose={props.onClose}
      aria-label={t('sheet.page')}
    >
      <Box
        data-testid="sheet-topbar"
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5, minHeight: 48, flexShrink: 0,
          pl: props.inline ? undefined : `${12 + bar.controlsInset}px`,
          WebkitAppRegion: !props.inline && bar.draggable ? 'drag' : undefined,
          '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
          borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper',
        }}
      >
        {!props.inline && (
          <Tooltip title={t('sheet.close')}>
            <IconButton size="small" aria-label={t('sheet.close')} onClick={props.onClose}>
              <BackIcon />
            </IconButton>
          </Tooltip>
        )}
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{sheet?.name ?? t('sheet.page')}</Typography>
        <Box sx={{ flex: 1 }} />
        {sheet && (
          <Tooltip title={t('sheet.find')}>
            <IconButton
              size="small"
              aria-label={t('sheet.find')}
              aria-expanded={Boolean(findAnchor)}
              onClick={(event) => setFindAnchor(event.currentTarget)}
            >
              <SearchIcon size={16} />
            </IconButton>
          </Tooltip>
        )}
        {sheet && (
          <Tooltip title={panelsShown ? t('sheet.hidePanels') : t('sheet.showPanels')}>
            <IconButton
              size="small"
              aria-label={panelsShown ? t('sheet.hidePanels') : t('sheet.showPanels')}
              aria-pressed={!panelsShown}
              onClick={() => setPanelsShown((shown) => !shown)}
            >
              <EyeIcon />
            </IconButton>
          </Tooltip>
        )}
        {sheet && props.onSave && (
          <Tooltip title={t('sheet.export')}>
            <IconButton size="small" aria-label={t('sheet.export')} onClick={() => setExportOpen(true)}>
              <ExportIcon />
            </IconButton>
          </Tooltip>
        )}
        {!readOnly && sheet && (
          <Tooltip title={t('sheet.settings')}>
            <IconButton
              size="small" aria-label={t('sheet.settings')} onClick={() => setSettingsOpen(true)}
            >
              <SlidersIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Popover
        open={Boolean(findAnchor)}
        anchorEl={findAnchor}
        onClose={closeFinder}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 0.5, width: 320 } } }}
      >
        <Finder query={query} hits={hits} onQuery={setQuery} onPick={locate} t={t} />
      </Popover>

      <Box
        ref={page}
        sx={{
          ...(exporting
            // Laid out for the picture: nothing scrolls, so the node's scroll
            // size is the page's whole size, which is what the capture reads.
            ? { display: 'flex', alignItems: 'stretch', flex: 'none', ...(exporting.width !== undefined ? { width: exporting.width } : {}) }
            : { flex: '1 1 auto', minHeight: 0, display: 'flex' }),
          ...(locatedId !== undefined && !exporting ? {
            [`& [data-element-id="${locatedId}"]`]: {
              outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2,
              borderRadius: 1,
            },
          } : {}),
        }}
      >
        {laidOut && sheet?.showActors !== false && panels && (
          <>
            <Rail actors={laidOut.actors} width={railWidth} onSelect={setSelectedId} author={author} t={t} />
            <SeamResizer
              orientation="vertical" region="before"
              value={railWidth} min={RAIL.min} max={RAIL.max} defaultValue={RAIL.default}
              onChange={setRailWidth} label={t('sheet.resizeRail')}
            />
          </>
        )}
        {laidOut && sheet?.showActors !== false && exporting && (
          <Rail actors={laidOut.actors} width={railWidth} onSelect={setSelectedId} author={undefined} t={t} />
        )}

        <Box
          ref={bodyWidth.ref}
          data-testid="sheet-body"
          sx={exporting
            ? { flex: '1 1 auto', minWidth: 0, overflow: 'visible', p: 2 }
            : { flex: '1 1 auto', minWidth: 0, overflow: 'auto', p: 2 }}
        >
        <Box
          data-testid="sheet-canvas"
          data-width={fixedWidth !== undefined ? fixedWidth - 32 : 'fit'}
          sx={fixedWidth !== undefined ? { width: fixedWidth - 32, minWidth: fixedWidth - 32 } : undefined}
        >
          {/* Measured, because the paper's short side is for the areas less this. */}
          <Box ref={above.ref} data-testid="sheet-above">
          {laidOut?.journey ? (
            <JourneyBand
              journey={laidOut.journey}
              onSelect={setSelectedId}
              onNewLane={() => setLaneOpen(true)}
              author={author}
              t={t}
            />
          ) : (
            <Empty
              text={t('sheet.noJourney')}
              action={author && (
                <Add
                  label={t('sheet.newJourney')}
                  title={t('sheet.newJourney')}
                  onClick={() => author.made(author.actions.addJourney({
                    journey: t('sheet.nameJourney'), phase: t('sheet.nameFirstPhase'),
                  }))}
                />
              )}
            />
          )}
          </Box>

          {laidOut && sheet && packed && laidOut.areas.length > 0 ? (
            <>
              <Box
                data-testid="sheet-areas"
                data-columns={columns}
                sx={{ mt: 3, position: 'relative', height: packed.height }}
              >
                {laidOut.areas.map((area) => {
                  const at = packed.placed.find((held) => held.id === area.element.id)
                  if (!at) return null
                  // The column pitch is a column and a gap; a card is its
                  // span of pitches less the last gap. In percentages, so a
                  // resize moves the cards before the heights are re-measured.
                  const pitch = `(100% + ${AREA_COLUMN.gap}px) / ${columns}`
                  return (
                    <AreaCard
                      key={area.element.id} area={area}
                      span={at.span}
                      place={{
                        left: `calc(${pitch} * ${at.column})`,
                        width: `calc(${pitch} * ${at.span} - ${AREA_COLUMN.gap}px)`,
                        top: at.top,
                      }}
                      measure={cards.observe}
                      onSpan={author && columns > 1
                        ? (span) => actions.updateSheet({ areaSpans: withSpan(sheet.areaSpans, area.element.id, span) })
                        : undefined}
                      onSelect={setSelectedId} author={author} t={t}
                    />
                  )
                })}
              </Box>
              {author && (
                <Box sx={{ mt: 1.5, display: 'flex' }}>
                  <Add
                    label={t('sheet.addArea')}
                    title={t('sheet.newArea')}
                    onClick={() => author.made(author.actions.addArea(t('sheet.nameArea')))}
                    sx={{ py: 0.75, px: 1.5 }}
                  />
                </Box>
              )}
            </>
          ) : (
            <Empty
              text={t('sheet.noAreas')}
              hint={t('sheet.emptyHint')}
              action={author && (
                <Add
                  label={t('sheet.newArea')}
                  title={t('sheet.newArea')}
                  onClick={() => author.made(author.actions.addArea(t('sheet.nameArea')))}
                />
              )}
            />
          )}

          {laidOut && laidOut.unmapped.length > 0 && (
            <UnmappedBand elements={laidOut.unmapped} onSelect={setSelectedId} t={t} />
          )}
        </Box>
        </Box>

        {panels && (
          <>
            <SeamResizer
              orientation="vertical" region="after"
              value={detailsWidth} min={INSPECTOR_WIDTH.min} max={INSPECTOR_WIDTH.max}
              defaultValue={INSPECTOR_WIDTH.default}
              onChange={setDetailsWidth} label={t('sheet.resizeDetails')}
            />
            <FunctionInspector
              element={selected}
              model={model}
              readOnly={readOnly}
              actions={actions}
              width={detailsWidth}
              applications={props.applications}
              onOpenDocumentation={props.onOpenDocumentation}
              elsewhere={props.elsewhere}
              nameFocus={nameFocus}
              onRemoved={() => setSelectedId(undefined)}
              ownerOf={props.ownerOf}
            />
          </>
        )}
      </Box>

      {laneOpen && laidOut?.journey && (
        <LaneDialog
          model={model}
          phases={laidOut.journey.phases}
          onCancel={() => setLaneOpen(false)}
          onConfirm={(lane: NewLane) => {
            setLaneOpen(false)
            made(actions.addLane(lane))
          }}
        />
      )}
      {settingsOpen && sheet && (
        <SheetSettingsDialog
          model={model}
          sheet={sheet}
          actions={actions}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {exportOpen && sheet && (
        <SheetExportDialog
          initial={isPaperSize(sheet.paper) ? sheet.paper : 'screen'}
          onExport={exportPng}
          onClose={() => setExportOpen(false)}
        />
      )}
    </Frame>
  )
}

/** The page in the tab: the same column, with no dialog around it. */
export function InlineFrame({ children }: { children?: React.ReactNode; open?: boolean; topInset?: number; onClose?(): void; 'aria-label'?: string }) {
  return <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 }}>{children}</Box>
}

/**
 * The most pixels a picture for a person may have. An A0 at two pixels per
 * point is about 9,000 wide, which is inside what browsers rasterise; the
 * budget lets the ratio fall below two on a page taller than that rather
 * than refusing it.
 */
const EXPORT_MAX_PIXELS = 40_000_000

/** A name the file system will take, from what the sheet is called. */
function fileSafe(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'sheet'
}

/**
 * Four frames from now: React has drawn at the new width, the observers have
 * measured the cards at it, React has packed them from those heights, and
 * that is on screen.
 */
function settled(): Promise<void> {
  const frame = typeof requestAnimationFrame === 'function'
    ? (fn: () => void) => { requestAnimationFrame(fn) }
    : (fn: () => void) => { setTimeout(fn, 0) }
  return new Promise((resolve) => frame(() => frame(() => frame(() => frame(resolve)))))
}

/**
 * How tall each area card is, kept up to date — what the packing needs and
 * CSS cannot say. One observer for every card; a card that leaves the page
 * leaves the map. Without a `ResizeObserver` (a test) every height is 0 and
 * the cards pack at the top, which the tests do not look at.
 */
function useMeasuredHeights(): {
  observe: (id: ElementId, node: HTMLDivElement | null) => void
  heights: Readonly<Record<ElementId, number>>
} {
  const [heights, setHeights] = useState<Readonly<Record<ElementId, number>>>({})
  const observer = useRef<ResizeObserver | undefined>(undefined)
  const ids = useRef(new WeakMap<Element, ElementId>())
  const nodes = useRef(new Map<ElementId, Element>())
  const observe = useCallback((id: ElementId, node: HTMLDivElement | null) => {
    if (typeof ResizeObserver === 'undefined') return
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
    const before = nodes.current.get(id)
    if (before && before !== node) { observer.current.unobserve(before); nodes.current.delete(id) }
    if (!node) return
    ids.current.set(node, id)
    nodes.current.set(id, node)
    observer.current.observe(node)
  }, [])
  return { observe, heights }
}

/**
 * How wide an element is, kept up to date. The grid needs a number to fit
 * its columns to, and CSS alone cannot tell a card how many columns it may
 * span. Without a `ResizeObserver` (a test) the width stays 0, which the
 * arithmetic reads as one column.
 */
function useMeasuredWidth(): { ref: (node: HTMLDivElement | null) => void; width: number } {
  const { ref, size } = useMeasuredSize('width')
  return { ref, width: size }
}

/** How tall one block is, kept up to date: what sits above the areas, so the paper's height less it is theirs. */
function useMeasuredHeight(): { ref: (node: HTMLDivElement | null) => void; height: number } {
  const { ref, size } = useMeasuredSize('height')
  return { ref, height: size }
}

/** One side of one box, measured the way the cards are; the width counts the body's padding back in. */
function useMeasuredSize(side: 'width' | 'height'): { ref: (node: HTMLDivElement | null) => void; size: number } {
  const [size, setSize] = useState(0)
  const observer = useRef<ResizeObserver | undefined>(undefined)
  const ref = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect()
    observer.current = undefined
    if (!node || typeof ResizeObserver === 'undefined') return
    setSize(side === 'width' ? node.clientWidth : node.clientHeight)
    const held = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) setSize(Math.round(box[side]) + (side === 'width' ? 32 : 0))
    })
    held.observe(node)
    observer.current = held
  }, [side])
  return { ref, size }
}

/**
 * What a gesture needs to make something, or nothing at all under `readOnly`.
 *
 * One object rather than a `readOnly` prop threaded through every band: a
 * band that cannot reach the actions cannot offer a *+*, which is a stronger
 * guarantee than remembering to write the flag into each one.
 */
type Author = { t: Translate; made(id: ElementId | undefined): void; actions: SheetActions }

/** The one shape every *+* on this page has. */
function Add({ label, title, onClick, disabled, sx }: {
  label: string
  /** What it says out loud — which of the many *+*s this is, and on what. */
  title: string
  onClick(): void
  disabled?: boolean
  sx?: SxProps<Theme>
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={title}
      title={title}
      disabled={disabled}
      // A picture of the page leaves these out (`captureSheet`): an exported
      // business architecture should show the architecture, not the tool.
      data-sheet-add
      onClick={onClick}
      sx={{
        // The same `buttontext` trap the cards fell into: `font: inherit` does
        // not bring the colour with it.
        appearance: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit',
        bgcolor: 'transparent', border: '1px dashed', borderColor: 'divider', borderRadius: 0.75,
        px: 0.75, py: 0.25, fontSize: 10, whiteSpace: 'nowrap', opacity: 0.55,
        '&:hover': { opacity: 1, borderStyle: 'solid' },
        '&:disabled': { opacity: 0.25, cursor: 'default', borderStyle: 'dashed' },
        ...sx,
      }}
    >
      {label}
    </Box>
  )
}

// --- finding something on the page -----------------------------------------

/** How long the ring stays on what the finder took you to. */
const LOCATED_FOR_MS = 3000
/** Rows the finder lists before it asks for another word. */
const FINDER_ROWS = 12

const BAND_LABEL: Record<SheetBand, Parameters<Translate>[0]> = {
  actor: 'sheet.bandActor',
  phase: 'sheet.bandPhase',
  step: 'sheet.bandStep',
  area: 'sheet.bandArea',
  grouping: 'sheet.bandGrouping',
  capability: 'sheet.bandCapability',
  unmapped: 'sheet.bandUnmapped',
}

/**
 * The finder: one field, and under it the hits in the page's own order, each
 * saying which band it is in and what it sits in. Enter takes the first, so
 * "type three letters, Enter" is the whole gesture for a name you know; the
 * list is capped rather than scrolled, because a longer list is a request for
 * one more word, not for a scrollbar.
 */
function Finder({ query, hits, onQuery, onPick, t }: {
  query: string
  hits: readonly SheetHit[]
  onQuery(query: string): void
  onPick(id: ElementId): void
  t: Translate
}) {
  const shown = hits.slice(0, FINDER_ROWS)
  return (
    <Box data-testid="sheet-finder" sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <SearchIcon size={14} />
        <InputBase
          autoFocus
          fullWidth
          value={query}
          placeholder={t('sheet.findPlaceholder')}
          inputProps={{ 'aria-label': t('sheet.find') }}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && shown[0]) { event.preventDefault(); onPick(shown[0].element.id) }
          }}
          sx={{ fontSize: 13 }}
        />
      </Box>
      {/* What the list says about itself sits beside it: a listbox holds
          options and nothing else, or a screen reader counts the sentence as
          one. */}
      {shown.length === 0 && (
        <Typography sx={{ px: 1.5, pt: 1.5, pb: 1, fontSize: 12, color: 'text.secondary' }}>
          {t('sheet.findNone')}
        </Typography>
      )}
      <Box role="listbox" aria-label={t('sheet.find')} sx={{ py: 0.5, maxHeight: 360, overflow: 'auto' }}>
        {shown.map((hit) => (
          <Box
            key={hit.element.id}
            component="button"
            type="button"
            role="option"
            aria-selected={false}
            data-testid={`sheet-find-${hit.element.id}`}
            onClick={() => onPick(hit.element.id)}
            sx={{
              appearance: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit',
              display: 'flex', alignItems: 'baseline', gap: 1, width: '100%', textAlign: 'left',
              background: 'none', border: 0, px: 1.5, py: 0.5,
              '&:hover, &:focus-visible': { bgcolor: 'action.hover', outline: 'none' },
            }}
          >
            <Typography sx={{ fontSize: 12.5, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {hit.element.name}
            </Typography>
            <Typography sx={{ fontSize: 10, color: 'text.secondary', whiteSpace: 'nowrap' }}>
              {t(BAND_LABEL[hit.band])}{hit.within !== undefined ? ` · ${hit.within}` : ''}
            </Typography>
          </Box>
        ))}
      </Box>
      {hits.length > shown.length && (
        <Typography sx={{ px: 1.5, pb: 1.25, fontSize: 10.5, color: 'text.secondary' }}>
          {t('sheet.findMore', { count: hits.length - shown.length })}
        </Typography>
      )}
    </Box>
  )
}

// --- the stakeholder rail ---------------------------------------------------

/**
 * The actor tree down the side.
 *
 * A row with something under it is a heading and a row without one is an
 * entry — read off the next row's depth rather than stored, because "has
 * children" is a fact about the tree and not a second field to keep in step.
 * A group takes a stakeholder once, after its last member, addressed to the
 * group — not on every row: at the rail's width a button beside each name
 * left the names wrapping word by word under their own chips. A top-level
 * actor with nothing under it is an entry, and becomes a group through the
 * inspector's parent field; the one at the bottom makes a new group.
 */
function Rail({ actors, width, onSelect, author, t }: {
  actors: readonly SheetActor[]
  width: number
  onSelect(id: ElementId): void
  author: Author | undefined
  t: Translate
}) {
  return (
    <Box
      data-testid="sheet-rail"
      sx={{
        width, flex: `0 0 ${width}px`, overflow: 'auto',
        bgcolor: 'background.paper', px: 1.5, py: 2,
      }}
    >
      <Typography sx={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'text.secondary', mb: 1,
      }}>
        {t('sheet.stakeholders')}
      </Typography>
      {actors.length === 0 && (
        <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
          {t('sheet.noStakeholders')}
        </Typography>
      )}
      {actors.map((row, index) => {
        const heading = (actors[index + 1]?.depth ?? 0) > row.depth
        // The group this row belongs to is the nearest row at depth 0 at or
        // above it; the add line goes after the group's last member.
        const group = row.depth === 0 ? row : [...actors.slice(0, index)].reverse().find((r) => r.depth === 0) ?? row
        const endsGroup = row.depth > 0 && (actors[index + 1]?.depth ?? 0) === 0
        const add = author && endsGroup && (
          <Box sx={{ pl: 1.25, py: 0.25 }}>
            <Add
              label={t('sheet.addStakeholder')}
              title={t('sheet.addStakeholderTo', { name: group.element.name })}
              onClick={() => author.made(author.actions.addElement({
                kind: 'actor', name: t('sheet.nameStakeholder'), parentId: group.element.id,
              }))}
              sx={{ px: 0.4, py: 0, fontSize: 9 }}
            />
          </Box>
        )
        return (
          <Fragment key={row.element.id}>
          <Box
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              pl: row.depth * 1.25,
              ...(heading ? { mt: 1.5, mb: 0.5 } : { py: 0.25 }),
            }}
          >
            <Box
              component="button"
              type="button"
              data-testid={`sheet-actor-${row.element.id}`}
              data-element-id={row.element.id}
              onClick={() => onSelect(row.element.id)}
              sx={{
                appearance: 'none', cursor: 'pointer', font: 'inherit',
                background: 'none', border: 0, p: 0, textAlign: 'left', minWidth: 0, flex: 1,
                // A button's text is the browser's `buttontext` unless it is
                // told otherwise: inherit, or a heading loses its own colour.
                ...(heading
                  ? {
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'text.secondary',
                  }
                  : { fontSize: 11.5, color: 'inherit' }),
              }}
            >
              {row.element.name}
            </Box>
            {row.outside && (
              <Chip
                size="small"
                variant="outlined"
                label={t('sheet.outside')}
                sx={{ height: 16, fontSize: 9, '& .MuiChip-label': { px: 0.5 } }}
              />
            )}
          </Box>
          {add}
          </Fragment>
        )
      })}
      {author && (
        <Box sx={{ mt: 1.5 }}>
          <Add
            label={t('sheet.addGroup')}
            title={t('sheet.addGroupHint')}
            onClick={() => author.made(author.actions.addElement({
              kind: 'actor', name: t('sheet.nameGroup'),
            }))}
          />
        </Box>
      )}
    </Box>
  )
}

// --- the journey ------------------------------------------------------------

function JourneyBand({ journey, onSelect, onNewLane, author, t }: {
  journey: SheetJourney
  onSelect(id: ElementId): void
  onNewLane(): void
  author: Author | undefined
  t: Translate
}) {
  return (
    <Box data-testid="sheet-journey">
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Box sx={{ flex: `0 0 ${LANE_LABEL_WIDTH}px` }} />
        {journey.phases.map((phase) => (
          <Box
            key={phase.id}
            data-testid={`sheet-phase-${phase.id}`}
            data-element-id={phase.id}
            component="button"
            type="button"
            onClick={() => onSelect(phase.id)}
            sx={{
              appearance: 'none', cursor: 'pointer', font: 'inherit',
              flex: 1, minWidth: 0, textAlign: 'center', px: 1, py: 0.5, border: 0,
              bgcolor: 'primary.main', color: 'primary.contrastText',
              borderRadius: '3px 3px 0 0',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}
          >
            {phase.name}
          </Box>
        ))}
        {author && (
          <Box sx={{ flex: `0 0 ${ADD_COLUMN}px`, display: 'flex', alignItems: 'center' }}>
            <Add
              label={t('sheet.addPhase')}
              title={t('sheet.addPhaseTo', { name: journey.element.name })}
              onClick={() => author.made(author.actions.addElement({
                kind: 'step', name: t('sheet.namePhase'), parentId: journey.element.id,
              }))}
            />
          </Box>
        )}
      </Box>
      {journey.lanes.map((lane, index) => (
        <LaneRow
          key={lane.actorId ?? 'common'}
          lane={lane}
          phases={journey.phases}
          first={index === 0}
          onSelect={onSelect}
          author={author}
          t={t}
        />
      ))}
      {author && (
        <Box sx={{ display: 'flex', borderTop: 1, borderColor: 'divider', pt: 1 }}>
          <Box sx={{ flex: `0 0 ${LANE_LABEL_WIDTH}px`, pr: 1 }}>
            <Add label={t('sheet.addLane')} title={t('sheet.addLane')} onClick={onNewLane} />
          </Box>
        </Box>
      )}
    </Box>
  )
}

function LaneRow({ lane, phases, first, onSelect, author, t }: {
  lane: SheetLane
  phases: readonly DesignElement[]
  first: boolean
  onSelect(id: ElementId): void
  author: Author | undefined
  t: Translate
}) {
  const laneName = lane.actor?.name ?? (first ? t('sheet.commonLane') : lane.actorId ?? '')
  return (
    <Box
      data-testid={`sheet-lane-${lane.actorId ?? 'common'}`}
      sx={{ display: 'flex', gap: 0.5, borderTop: first ? 0 : 1, borderColor: 'divider' }}
    >
      <Box sx={{
        flex: `0 0 ${LANE_LABEL_WIDTH}px`, display: 'flex', alignItems: 'center', pr: 1, py: 1,
      }}>
        <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{laneName}</Typography>
      </Box>
      {lane.cells.map((cell, index) => (
        <Box
          key={cell.phaseId}
          data-testid={`sheet-cell-${lane.actorId ?? 'common'}-${cell.phaseId}`}
          sx={{
            flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center',
            gap: 0.5, py: 1, minHeight: 40,
          }}
        >
          {cell.steps.map((step) => (
            <Chevron key={step.element.id} step={step} onSelect={onSelect} t={t} />
          ))}
          {cell.passThrough && (
            <Box
              data-testid={`sheet-passthrough-${lane.actorId ?? 'common'}-${cell.phaseId}`}
              role="img"
              aria-label={t('sheet.passThrough')}
              sx={{ borderTop: '1px dashed', borderColor: 'divider', mx: 1 }}
            />
          )}
          {author && (
            <Add
              label={t('sheet.addStep')}
              title={t('sheet.addStepTo', {
                phase: phases[index]?.name ?? cell.phaseId, lane: laneName,
              })}
              onClick={() => author.made(author.actions.addElement({
                kind: 'step',
                name: t('sheet.nameStep'),
                parentId: cell.phaseId,
                ...(lane.actorId !== undefined ? { lane: lane.actorId } : {}),
              }))}
              sx={{ alignSelf: 'flex-start' }}
            />
          )}
        </Box>
      ))}
      {/* The column the *+ phase* stands in, so every row lines up under it. */}
      {author && <Box sx={{ flex: `0 0 ${ADD_COLUMN}px` }} />}
    </Box>
  )
}

/** One step. Outside the organisation, it is drawn as a dashed outline. */
function Chevron({ step, onSelect, t }: {
  step: SheetStep
  onSelect(id: ElementId): void
  t: Translate
}) {
  return (
    <Box
      component="button"
      type="button"
      data-testid={`sheet-step-${step.element.id}`}
      data-element-id={step.element.id}
      aria-label={step.outside ? t('sheet.outsideStep', { name: step.element.name }) : step.element.name}
      onClick={() => onSelect(step.element.id)}
      sx={{
        appearance: 'none', textAlign: 'left', cursor: 'pointer', font: 'inherit',
        display: 'flex', alignItems: 'center', minHeight: 40, px: 1, pr: `${NOTCH + 8}px`,
        bgcolor: 'background.paper',
        border: 1, borderStyle: step.outside ? 'dashed' : 'solid', borderColor: 'divider',
        color: step.outside ? 'text.secondary' : 'text.primary',
        fontSize: 10, lineHeight: 1.25,
        clipPath: CHEVRON,
      }}
    >
      {step.element.name}
    </Box>
  )
}

// --- the areas --------------------------------------------------------------

/**
 * The capabilities of a grouping, or an area's loose ones: one column per
 * column the area takes, so *wider* adds exactly one column of them. Fitting
 * as many as the width allowed went from one column to three in a step.
 */
const capabilityGrid = (span: number) => ({
  display: 'grid', gap: 0.75, gridTemplateColumns: `repeat(${span}, minmax(0, 1fr))`, alignItems: 'start',
})

function AreaCard({ area, span, place, measure, onSpan, onSelect, author, t }: {
  area: SheetArea
  /** How many columns of the grid it takes. */
  span: number
  /** Where the packing put it. */
  place: { left: string; width: string; top: number }
  /** Tell the page how tall it is, for the packing. */
  measure(id: ElementId, node: HTMLDivElement | null): void
  /** Make it wider or narrower — absent where the grid has one column, or under `readOnly`. */
  onSpan?(span: number): void
  onSelect(id: ElementId): void
  author: Author | undefined
  t: Translate
}) {
  return (
    <Box
      ref={(node: HTMLDivElement | null) => measure(area.element.id, node)}
      data-testid={`sheet-area-${area.element.id}`}
      data-element-id={area.element.id}
      data-span={span}
      data-column={place.left}
      sx={{
        border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden',
        bgcolor: 'background.paper', minWidth: 0, boxSizing: 'border-box',
        position: 'absolute', left: place.left, width: place.width, top: place.top,
      }}
    >
      <Box
        onClick={() => onSelect(area.element.id)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, cursor: 'pointer',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16),
        }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 700, flex: 1, minWidth: 0 }}>
          {area.element.name}
        </Typography>
        {area.domain !== undefined && (
          <Chip size="small" label={area.domain} sx={{ height: 18, fontSize: 9.5 }} />
        )}
        {onSpan && (
          <Box
            data-sheet-add
            onClick={(event) => event.stopPropagation()}
            sx={{ display: 'flex', gap: 0.25, ml: 0.5, flexShrink: 0 }}
          >
            <Add
              label="−" title={t('sheet.narrower', { name: area.element.name })}
              disabled={span <= 1} onClick={() => onSpan(span - 1)} sx={{ px: 0.6, lineHeight: 1.3 }}
            />
            <Add
              label="+" title={t('sheet.wider', { name: area.element.name })}
              disabled={span >= MAX_SPAN} onClick={() => onSpan(span + 1)} sx={{ px: 0.6, lineHeight: 1.3 }}
            />
          </Box>
        )}
      </Box>
      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {area.groupings.map((group) => (
          <Box
            key={group.element.id}
            data-testid={`sheet-grouping-${group.element.id}`}
            data-element-id={group.element.id}
            sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}
          >
            <Box
              component="button"
              type="button"
              onClick={() => onSelect(group.element.id)}
              sx={{
                appearance: 'none', cursor: 'pointer', font: 'inherit', background: 'none',
                border: 0, p: 0, mb: 0.75, textAlign: 'left', width: '100%',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'text.secondary',
              }}
            >
              {group.element.name}
            </Box>
            <Box sx={capabilityGrid(span)}>
              {group.capabilities.map((capability) => (
                <CapabilityCard
                  key={capability.element.id}
                  capability={capability}
                  onSelect={onSelect}
                  t={t}
                />
              ))}
              {author && (
                <Add
                  label={t('sheet.addCapability')}
                  title={t('sheet.addCapabilityTo', { name: group.element.name })}
                  onClick={() => author.made(author.actions.addElement({
                    kind: 'function',
                    name: t('sheet.nameCapability'),
                    parentId: group.element.id,
                  }))}
                  sx={{ alignSelf: 'flex-start' }}
                />
              )}
            </Box>
          </Box>
        ))}
        {/* The area's own leaves, after the boxes: a column reads as structure
            and then the capabilities nobody has grouped yet. */}
        {area.capabilities.length > 0 && (
          <Box sx={capabilityGrid(span)}>
            {area.capabilities.map((capability) => (
              <CapabilityCard
                key={capability.element.id}
                capability={capability}
                onSelect={onSelect}
                t={t}
              />
            ))}
          </Box>
        )}
        {author && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Add
              label={t('sheet.addGrouping')}
              title={t('sheet.addGroupingTo', { name: area.element.name })}
              onClick={() => author.made(author.actions.addElement({
                kind: 'function', name: t('sheet.nameGrouping'), parentId: area.element.id,
              }))}
            />
            <Add
              label={t('sheet.addCapability')}
              title={t('sheet.addCapabilityTo', { name: area.element.name })}
              onClick={() => author.made(author.actions.addElement({
                kind: 'function', name: t('sheet.nameCapability'), parentId: area.element.id,
              }))}
            />
          </Box>
        )}
      </Box>
    </Box>
  )
}

function CapabilityCard({ capability, onSelect, t }: {
  capability: SheetCapability
  onSelect(id: ElementId): void
  t: Translate
}) {
  const { coverage } = capability
  const label = coverage.coverage === 'covered'
    ? plural(t, { one: 'sheet.appsOne', other: 'sheet.appsOther' }, coverage.supportedBy.length)
    : coverage.coverage === 'manual' ? t('sheet.people') : t('sheet.nothingYet')
  const colour = coverage.coverage === 'covered'
    ? 'primary.main'
    : coverage.coverage === 'manual' ? 'text.secondary' : 'warning.main'

  return (
    <Box
      component="button"
      type="button"
      data-testid={`sheet-capability-${capability.element.id}`}
      data-element-id={capability.element.id}
      onClick={() => onSelect(capability.element.id)}
      sx={{
        // `font: inherit` does not bring the colour with it: a button's text is
        // the browser's `buttontext`, black in every theme, which on the dark
        // ground is a card with a coverage line and no name.
        appearance: 'none', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', width: '100%',
        // A refinement of a capability sits one step in, so the tree is
        // readable without a second kind of card for it.
        ml: (capability.depth - 1) * 1.5,
        bgcolor: 'background.default', border: 1, borderColor: 'divider', borderRadius: 0.75,
        px: 1, py: 0.75,
      }}
    >
      <Typography sx={{ fontSize: 11.5 }}>{capability.element.name}</Typography>
      <Typography data-testid={`sheet-coverage-${capability.element.id}`} sx={{ fontSize: 10, color: colour }}>
        {label}
      </Typography>
    </Box>
  )
}

// --- what nobody has placed yet ---------------------------------------------

function UnmappedBand({ elements, onSelect, t }: {
  elements: readonly DesignElement[]
  onSelect(id: ElementId): void
  t: Translate
}) {
  return (
    <Box
      data-testid="sheet-unmapped"
      sx={{
        mt: 3, p: 1.5, borderRadius: 1,
        border: '1px dashed', borderColor: 'warning.main',
        bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700 }}>{t('sheet.unmapped')}</Typography>
        <Chip
          size="small"
          label={t('sheet.unmappedCount', { count: elements.length })}
          sx={{ height: 18, fontSize: 9.5 }}
        />
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {elements.map((element) => (
          <Box
            key={element.id}
            component="button"
            type="button"
            data-testid={`sheet-unmapped-${element.id}`}
            data-element-id={element.id}
            onClick={() => onSelect(element.id)}
            sx={{
              // The same `buttontext` trap as the capability card: inherit the colour too.
              appearance: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit',
              bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 0.75,
              px: 1, py: 0.5, fontSize: 11.5,
            }}
          >
            {element.name}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function Empty({ text, hint, action }: { text: string; hint?: string; action?: ReactNode }) {
  return (
    <Box sx={{ py: 3 }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{text}</Typography>
      {hint && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{hint}</Typography>}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Box>
  )
}
