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
 * **The areas are a grid, not three columns.** How many columns is what the
 * width has room for, or what the sheet fixes; an area takes the columns the
 * sheet says it does and lays its capabilities side by side inside them; and
 * the browser packs the cards densely in the sheet's own order
 * (`business/grid.ts`). The first sheet drawn for a real organisation had
 * eleven areas of very different sizes in three tall columns, and that is
 * the layout this replaces.
 *
 * The rail and the details are the page's own: one eye hides both, and each
 * has a seam to drag. A picture of the page can be asked for at the width of
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
import { BackIcon, ExportIcon, EyeIcon, SlidersIcon } from '../../widgets/icons'
import { PageDialog } from '../../widgets/PageDialog'
import { SeamResizer } from '../../widgets/SeamResizer'
import { AREA_COLUMN, MAX_SPAN, paperWidth, sheetColumns, spanOf, withSpan } from '../grid'
import { sheetPage } from '../sheet'
import type { Relation } from '../../model'
import type { SheetActor, SheetArea, SheetCapability, SheetJourney, SheetLane, SheetStep } from '../sheet'
import type { SheetShot } from './captureSheet'
import { captureSheet } from './captureSheet'
import { FunctionInspector, INSPECTOR_WIDTH } from './FunctionInspector'
import type { FunctionInspectorProps, NewLane, SheetActions, Supporter } from './FunctionInspector'
import { LaneDialog } from './LaneDialog'
import { SheetExportDialog } from './SheetExportDialog'
import type { ExportLayout } from './SheetExportDialog'
import { SheetSettingsDialog } from './SheetSettingsDialog'

export type SheetPageProps = {
  open: boolean
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
export type SheetHandle = {
  /** Which sheet is on screen, so a caller can tell it is the one it asked for. */
  readonly diagramId: string
  capture(options: SheetCaptureOptions): Promise<SheetShot>
}

export type SheetCaptureOptions = {
  maxPixels: number
  /**
   * Lay the page out at this width in CSS pixels before drawing it — the
   * long side of an A1 is 3179 (`business/grid.paperWidth`). Absent draws
   * the page as it stands, at the window's width.
   */
  width?: number
}

/** The rail, the lane labels and the notch: the design's own numbers, in one place. */
const RAIL = { default: 178, min: 120, max: 420 } as const
const LANE_LABEL_WIDTH = 136
const NOTCH = 9
/** The column the *+ phase* sits in, kept off the phases so the row lines up. */
const ADD_COLUMN = 72
const CHEVRON = `polygon(0 0, calc(100% - ${NOTCH}px) 0, 100% 50%, calc(100% - ${NOTCH}px) 100%, 0 100%)`

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

  /**
   * The grid's width: what the page is being drawn for, or what the body
   * measures — less its own padding, which the observer counts and the grid
   * does not get.
   */
  const gridWidth = (exporting?.width ?? bodyWidth.width) - 32
  const columns = sheet ? sheetColumns(sheet, gridWidth) : 1
  const fixedWidth = exporting?.width
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

  return (
    <PageDialog
      open={props.open}
      topInset={chrome.topInset}
      onClose={props.onClose}
      aria-label={t('sheet.page')}
    >
      <Box
        data-testid="sheet-topbar"
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5, minHeight: 48, flexShrink: 0,
          pl: `${12 + bar.controlsInset}px`,
          WebkitAppRegion: bar.draggable ? 'drag' : undefined,
          '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
          borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper',
        }}
      >
        <Tooltip title={t('sheet.close')}>
          <IconButton size="small" aria-label={t('sheet.close')} onClick={props.onClose}>
            <BackIcon />
          </IconButton>
        </Tooltip>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{sheet?.name ?? t('sheet.page')}</Typography>
        <Box sx={{ flex: 1 }} />
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

      <Box
        ref={page}
        sx={exporting
          // Laid out for the picture: nothing scrolls, so the node's scroll
          // size is the page's whole size, which is what the capture reads.
          ? { display: 'flex', alignItems: 'stretch', flex: 'none', ...(exporting.width !== undefined ? { width: exporting.width } : {}) }
          : { flex: '1 1 auto', minHeight: 0, display: 'flex' }}
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
        <Box sx={fixedWidth !== undefined ? { width: fixedWidth - 32, minWidth: fixedWidth - 32 } : undefined}>
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

          {laidOut && sheet && laidOut.areas.length > 0 ? (
            <Box
              data-testid="sheet-areas"
              data-columns={columns}
              sx={{
                mt: 3, display: 'grid', gap: `${AREA_COLUMN.gap}px`,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                // Dense: a one-column area after a two-column one fills the
                // hole beside it rather than starting a new row. The order
                // is the sheet's own, which is the priority.
                gridAutoFlow: 'dense',
                alignItems: 'start',
              }}
            >
              {laidOut.areas.map((area) => (
                <AreaCard
                  key={area.element.id} area={area}
                  span={spanOf(sheet, area.element.id, columns)}
                  onSpan={author && columns > 1
                    ? (span) => actions.updateSheet({ areaSpans: withSpan(sheet.areaSpans, area.element.id, span) })
                    : undefined}
                  onSelect={setSelectedId} author={author} t={t}
                />
              ))}
              {author && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                  <Add
                    label={t('sheet.addArea')}
                    title={t('sheet.newArea')}
                    onClick={() => author.made(author.actions.addArea(t('sheet.nameArea')))}
                    sx={{ py: 0.75, px: 1.5 }}
                  />
                </Box>
              )}
            </Box>
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
        <SheetExportDialog onExport={exportPng} onClose={() => setExportOpen(false)} />
      )}
    </PageDialog>
  )
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

/** Two frames from now: React has drawn, and the observer has measured. */
function settled(): Promise<void> {
  const frame = typeof requestAnimationFrame === 'function'
    ? (fn: () => void) => { requestAnimationFrame(fn) }
    : (fn: () => void) => { setTimeout(fn, 0) }
  return new Promise((resolve) => frame(() => frame(resolve)))
}

/**
 * How wide an element is, kept up to date. The grid needs a number to fit
 * its columns to, and CSS alone cannot tell a card how many columns it may
 * span. Without a `ResizeObserver` (a test) the width stays 0, which the
 * arithmetic reads as one column.
 */
function useMeasuredWidth(): { ref: (node: HTMLDivElement | null) => void; width: number } {
  const [width, setWidth] = useState(0)
  const observer = useRef<ResizeObserver | undefined>(undefined)
  const ref = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect()
    observer.current = undefined
    if (!node || typeof ResizeObserver === 'undefined') return
    setWidth(node.clientWidth)
    const held = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) setWidth(Math.round(box.width) + 32)
    })
    held.observe(node)
    observer.current = held
  }, [])
  return { ref, width }
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

/** The capabilities of a grouping, or an area's loose ones, side by side where the box is wide enough. */
const CAPABILITY_GRID = {
  display: 'grid', gap: 0.75, gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', alignItems: 'start',
} as const

function AreaCard({ area, span, onSpan, onSelect, author, t }: {
  area: SheetArea
  /** How many columns of the grid it takes. */
  span: number
  /** Make it wider or narrower — absent where the grid has one column, or under `readOnly`. */
  onSpan?(span: number): void
  onSelect(id: ElementId): void
  author: Author | undefined
  t: Translate
}) {
  return (
    <Box
      data-testid={`sheet-area-${area.element.id}`}
      data-span={span}
      sx={{
        border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden',
        bgcolor: 'background.paper', gridColumn: `span ${span}`, minWidth: 0,
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
            <Box sx={CAPABILITY_GRID}>
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
          <Box sx={CAPABILITY_GRID}>
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
