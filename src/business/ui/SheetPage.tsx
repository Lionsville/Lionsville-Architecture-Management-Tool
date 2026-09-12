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
 * A fullscreen dialog, and it takes `windowChrome` for the reason the other
 * pages do: the shell toolbar's drag strip stays live underneath it, and
 * Electron computes drag regions from geometry rather than from what is
 * painted on top.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import type { DesignDiagram, DesignElement, DesignModel, ElementId } from '../../model'
import { useStrings } from '../../i18n'
import { plural } from '../../i18n/strings'
import type { Translate } from '../../i18n'
import { NO_WINDOW_CHROME, barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { BackIcon, EyeIcon } from '../../widgets/icons'
import { PageDialog } from '../../widgets/PageDialog'
import { sheetPage } from '../sheet'
import type { SheetActor, SheetArea, SheetCapability, SheetJourney, SheetLane, SheetStep } from '../sheet'
import type { SheetShot } from './captureSheet'
import { captureSheet } from './captureSheet'
import { FunctionInspector } from './FunctionInspector'
import type { SheetActions } from './FunctionInspector'

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
}

/** What only the drawn page can do: hand over what it looks like. */
export type SheetHandle = {
  /** Which sheet is on screen, so a caller can tell it is the one it asked for. */
  readonly diagramId: string
  capture(options: { maxPixels: number }): Promise<SheetShot>
}

/** The rail, the lane labels and the notch: the design's own numbers, in one place. */
const RAIL_WIDTH = 178
const LANE_LABEL_WIDTH = 136
const NOTCH = 9
const CHEVRON = `polygon(0 0, calc(100% - ${NOTCH}px) 0, 100% 50%, calc(100% - ${NOTCH}px) 100%, 0 100%)`

export function SheetPage(props: SheetPageProps) {
  const { model, sheet, readOnly, actions } = props
  const { t } = useStrings()
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const bar = barChromeFor(chrome)
  const [selectedId, setSelectedId] = useState<ElementId | undefined>(undefined)
  const theme = useTheme()
  const page = useRef<HTMLDivElement | null>(null)

  /**
   * The handle, while a sheet is up. Withdrawn on the way out so a request
   * that arrives after the page has closed is refused rather than answered
   * with a picture of nothing.
   */
  const onHandle = props.onHandle
  const sheetId = sheet?.id
  const capture = useCallback(async (options: { maxPixels: number }) => {
    const node = page.current
    if (!node) throw new Error('SheetPage: the page is not on screen')
    return captureSheet(node, { ...options, background: theme.palette.background.default })
  }, [theme])
  useEffect(() => {
    if (!onHandle) return undefined
    if (!props.open || sheetId === undefined) { onHandle(undefined); return undefined }
    onHandle({ diagramId: sheetId, capture })
    return () => onHandle(undefined)
  }, [onHandle, props.open, sheetId, capture])

  const laidOut = useMemo(
    () => (sheet ? sheetPage(model, sheet) : undefined),
    [model, sheet],
  )
  const selected = selectedId === undefined
    ? undefined
    : model.elements.find((element) => element.id === selectedId)

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
        {!readOnly && sheet && (
          <Tooltip title={sheet.showActors === false ? t('sheet.showRail') : t('sheet.hideRail')}>
            <IconButton
              size="small"
              aria-label={sheet.showActors === false ? t('sheet.showRail') : t('sheet.hideRail')}
              onClick={() => actions.updateSheet({ showActors: sheet.showActors === false })}
            >
              <EyeIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box ref={page} sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex' }}>
        {laidOut && laidOut.actors.length > 0 && <Rail actors={laidOut.actors} t={t} />}

        <Box data-testid="sheet-body" sx={{ flex: '1 1 auto', minWidth: 0, overflow: 'auto', p: 2 }}>
          {laidOut?.journey
            ? <JourneyBand journey={laidOut.journey} onSelect={setSelectedId} t={t} />
            : <Empty text={t('sheet.noJourney')} />}

          {laidOut && laidOut.areas.length > 0 ? (
            <Box
              data-testid="sheet-areas"
              sx={{
                mt: 3, display: 'grid', gap: 1.5,
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              }}
            >
              {laidOut.areas.map((area) => (
                <AreaCard key={area.element.id} area={area} onSelect={setSelectedId} t={t} />
              ))}
            </Box>
          ) : <Empty text={t('sheet.noAreas')} hint={t('sheet.emptyHint')} />}

          {laidOut && laidOut.unmapped.length > 0 && (
            <UnmappedBand elements={laidOut.unmapped} onSelect={setSelectedId} t={t} />
          )}
        </Box>

        <FunctionInspector
          element={selected}
          model={model}
          readOnly={readOnly}
          actions={actions}
        />
      </Box>
    </PageDialog>
  )
}

// --- the stakeholder rail ---------------------------------------------------

/**
 * The actor tree down the side.
 *
 * A row with something under it is a heading and a row without one is an
 * entry — read off the next row's depth rather than stored, because "has
 * children" is a fact about the tree and not a second field to keep in step.
 */
function Rail({ actors, t }: { actors: readonly SheetActor[]; t: Translate }) {
  return (
    <Box
      data-testid="sheet-rail"
      sx={{
        width: RAIL_WIDTH, flex: `0 0 ${RAIL_WIDTH}px`, overflow: 'auto',
        borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper', px: 1.5, py: 2,
      }}
    >
      <Typography sx={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'text.secondary', mb: 1,
      }}>
        {t('sheet.stakeholders')}
      </Typography>
      {actors.map((row, index) => {
        const heading = (actors[index + 1]?.depth ?? 0) > row.depth
        return heading ? (
          <Typography
            key={row.element.id}
            sx={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'text.secondary', mt: 1.5, mb: 0.5, pl: row.depth * 1.25,
            }}
          >
            {row.element.name}
          </Typography>
        ) : (
          <Box
            key={row.element.id}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25, pl: row.depth * 1.25 }}
          >
            <Typography sx={{ fontSize: 11.5, minWidth: 0 }}>{row.element.name}</Typography>
            {row.outside && (
              <Chip
                size="small"
                variant="outlined"
                label={t('sheet.outside')}
                sx={{ height: 16, fontSize: 9, '& .MuiChip-label': { px: 0.5 } }}
              />
            )}
          </Box>
        )
      })}
    </Box>
  )
}

// --- the journey ------------------------------------------------------------

function JourneyBand({ journey, onSelect, t }: {
  journey: SheetJourney
  onSelect(id: ElementId): void
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
            sx={{
              flex: 1, minWidth: 0, textAlign: 'center', px: 1, py: 0.5,
              bgcolor: 'primary.main', color: 'primary.contrastText',
              borderRadius: '3px 3px 0 0',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}
          >
            {phase.name}
          </Box>
        ))}
      </Box>
      {journey.lanes.map((lane, index) => (
        <LaneRow key={lane.actorId ?? 'common'} lane={lane} first={index === 0} onSelect={onSelect} t={t} />
      ))}
    </Box>
  )
}

function LaneRow({ lane, first, onSelect, t }: {
  lane: SheetLane
  first: boolean
  onSelect(id: ElementId): void
  t: Translate
}) {
  return (
    <Box
      data-testid={`sheet-lane-${lane.actorId ?? 'common'}`}
      sx={{ display: 'flex', gap: 0.5, borderTop: first ? 0 : 1, borderColor: 'divider' }}
    >
      <Box sx={{
        flex: `0 0 ${LANE_LABEL_WIDTH}px`, display: 'flex', alignItems: 'center', pr: 1, py: 1,
      }}>
        <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
          {lane.actor?.name ?? (first ? t('sheet.commonLane') : lane.actorId)}
        </Typography>
      </Box>
      {lane.cells.map((cell) => (
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
        </Box>
      ))}
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

function AreaCard({ area, onSelect, t }: {
  area: SheetArea
  onSelect(id: ElementId): void
  t: Translate
}) {
  return (
    <Box
      data-testid={`sheet-area-${area.element.id}`}
      sx={{
        border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden',
        bgcolor: 'background.paper',
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
      </Box>
      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {area.groupings.map((group) => (
          <Box
            key={group.element.id}
            data-testid={`sheet-grouping-${group.element.id}`}
            sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}
          >
            <Typography sx={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'text.secondary', mb: 0.75,
            }}>
              {group.element.name}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {group.capabilities.map((capability) => (
                <CapabilityCard
                  key={capability.element.id}
                  capability={capability}
                  onSelect={onSelect}
                  t={t}
                />
              ))}
            </Box>
          </Box>
        ))}
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

function Empty({ text, hint }: { text: string; hint?: string }) {
  return (
    <Box sx={{ py: 3 }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{text}</Typography>
      {hint && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{hint}</Typography>}
    </Box>
  )
}
