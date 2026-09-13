/**
 * The enterprise map, on one page (ADR-0012 §6, §9).
 *
 * A page, not a canvas, for the reason the sheet is one: every mark on it is
 * derived from the function tree and the `supports` and `assigned` rows by
 * `business/map.ts`, and this file turns that answer into a table — a row per
 * function, a column per application the rows name, a mark where one supports
 * the other. The arithmetic is tested in node; what this pins is what a reader
 * is promised on screen.
 *
 * Read left to right: the capability, indented by its depth; a column per
 * application, grouped under the scope that owns it, with a filled mark on
 * the capability it supports and a hollow one on every section above it —
 * the roll-up, so a reader sees at the top of an area what the whole area
 * leans on; then *people*, one column, because "done by hand" is one answer
 * rather than an organisation chart; then *coverage*, which is the gap — said
 * on a capability as a word, and on a section as a count of the capabilities
 * under it that nothing and nobody covers.
 *
 * It is mostly read. What it can change is a capability, through the same
 * inspector the sheet docks: choose a row and its fields are on the right,
 * *Supported by…* included, so the gap can be closed from the page that
 * shows it. Under `readOnly` the inspector reads and nothing else changes.
 *
 * A fullscreen dialog, and it takes `windowChrome` for the reason the other
 * pages do: the shell toolbar's drag strip stays live underneath it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import type { DesignDiagram, DesignModel, ElementId, Relation } from '../../model'
import { useStrings } from '../../i18n'
import { plural } from '../../i18n/strings'
import type { Translate } from '../../i18n'
import { NO_WINDOW_CHROME, barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { BackIcon } from '../../widgets/icons'
import { PageDialog } from '../../widgets/PageDialog'
import { mapPage } from '../map'
import type { LaidOutMap, MapColumn, MapDescribe, MapRow } from '../map'
import { captureSheet } from './captureSheet'
import { FunctionInspector } from './FunctionInspector'
import type { FunctionInspectorProps, SheetActions } from './FunctionInspector'
import type { SheetHandle } from './SheetPage'

export type MapPageProps = {
  open: boolean
  model: DesignModel
  /** Absent while the page is closing, or when the map was deleted under it. */
  map: DesignDiagram | undefined
  readOnly: boolean
  /** The sheet's actions, because a capability is edited the same way from either page. */
  actions: SheetActions
  onClose(): void
  windowChrome?: WindowChrome
  /** The page, as the agent's renderer reaches it — the same handle the sheet hands over. */
  onHandle?(handle: SheetHandle | undefined): void
  /** Who answers for a record on this page, where it is not this scope (ADR-0012 §10). */
  ownerOf?: FunctionInspectorProps['ownerOf']
  /**
   * Rows written in another scope of the same organisation (ADR-0012 §2) —
   * see `mapPage`. A STABLE array, for the reason the sheet's is: it is a
   * dependency of the page's one memo.
   */
  elsewhere?: readonly Relation[]
  /** Names and owners for the applications the rows name; see `mapPage`. Stable, likewise. */
  describe?: MapDescribe
  /** The day the map counts rows on, where the map itself names none. */
  today?: string
}

/** The first column's width, which is sticky and so has to be a number. */
const FUNCTION_WIDTH = 260
/** How tall a rotated application name may be before it is cut. */
const HEADING_HEIGHT = 150
const CELL = 30

export function MapPage(props: MapPageProps) {
  const { model, map, readOnly, actions } = props
  const { t } = useStrings()
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const bar = barChromeFor(chrome)
  const [selectedId, setSelectedId] = useState<ElementId | undefined>(undefined)
  const theme = useTheme()
  const page = useRef<HTMLDivElement | null>(null)

  const onHandle = props.onHandle
  const mapId = map?.id
  const capture = useCallback(async (options: { maxPixels: number }) => {
    const node = page.current
    if (!node) throw new Error('MapPage: the page is not on screen')
    return captureSheet(node, { ...options, background: theme.palette.background.default })
  }, [theme])
  useEffect(() => {
    if (!onHandle) return undefined
    if (!props.open || mapId === undefined) { onHandle(undefined); return undefined }
    onHandle({ diagramId: mapId, capture })
    return () => onHandle(undefined)
  }, [onHandle, props.open, mapId, capture])

  const laidOut = useMemo(
    () => (map
      ? mapPage(model, map, {
        ...(props.elsewhere ? { elsewhere: props.elsewhere } : {}),
        ...(props.describe ? { describe: props.describe } : {}),
        ...(props.today !== undefined ? { today: props.today } : {}),
      })
      : undefined),
    [model, map, props.elsewhere, props.describe, props.today],
  )
  const selected = selectedId === undefined
    ? undefined
    : model.elements.find((element) => element.id === selectedId)
  const held = useMemo(() => new Set(model.elements.map((element) => element.id)), [model.elements])

  return (
    <PageDialog
      open={props.open}
      topInset={chrome.topInset}
      onClose={props.onClose}
      aria-label={t('map.page')}
    >
      <Box
        data-testid="map-topbar"
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5, minHeight: 48, flexShrink: 0,
          pl: `${12 + bar.controlsInset}px`,
          WebkitAppRegion: bar.draggable ? 'drag' : undefined,
          '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
          borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper',
        }}
      >
        <Tooltip title={t('map.close')}>
          <IconButton size="small" aria-label={t('map.close')} onClick={props.onClose}>
            <BackIcon />
          </IconButton>
        </Tooltip>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{map?.name ?? t('map.page')}</Typography>
        {laidOut && laidOut.rows.length > 0 && (
          <Typography data-testid="map-summary" sx={{ fontSize: 11, color: 'text.secondary', ml: 1 }}>
            {t('map.summary', laidOut.counts)}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
      </Box>

      <Box ref={page} sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex' }}>
        <Box data-testid="map-body" sx={{ flex: '1 1 auto', minWidth: 0, overflow: 'auto', p: 2 }}>
          {laidOut && laidOut.rows.length > 0 ? (
            <Grid
              laidOut={laidOut}
              onSelect={setSelectedId}
              onOpen={(id) => { if (held.has(id)) actions.onOpenElement(id) }}
              openable={(id) => held.has(id)}
              t={t}
            />
          ) : (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{t('map.noFunctions')}</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>{t('map.noFunctionsHint')}</Typography>
            </Box>
          )}
        </Box>

        <FunctionInspector
          element={selected}
          model={model}
          readOnly={readOnly}
          actions={actions}
          onRemoved={() => setSelectedId(undefined)}
          ownerOf={props.ownerOf}
        />
      </Box>
    </PageDialog>
  )
}

/**
 * The table. A real `<table>`, because a screen reader reads a matrix as one
 * and because sticky headings on two axes are what a table element gives for
 * free; the sheet's bands are boxes because nothing on a sheet is a matrix.
 */
function Grid({ laidOut, onSelect, onOpen, openable, t }: {
  laidOut: LaidOutMap
  onSelect(id: ElementId): void
  onOpen(id: ElementId): void
  openable(id: ElementId): boolean
  t: Translate
}) {
  const theme = useTheme()
  const { rows, groups, columns } = laidOut
  // A heading row for the owners only when there is something to say: one
  // group with no name is this scope's own systems, and a band saying so
  // above every column would be a band saying nothing.
  const grouped = groups.length > 1 || groups.some((group) => group.where !== undefined)
  const line = `1px solid ${theme.palette.divider}`
  const sticky = { position: 'sticky' as const, bgcolor: 'background.default', zIndex: 1 }
  const head = { ...sticky, top: 0, zIndex: 2 }
  /** The fixed headings, in the small capitals the sheet's bands use. */
  const label = {
    verticalAlign: 'bottom', px: 1, pb: 0.5, fontSize: 10, fontWeight: 700,
    letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary',
  } as const

  return (
    <Box
      component="table"
      data-testid="map-grid"
      sx={{
        borderCollapse: 'separate', borderSpacing: 0, fontSize: 11.5,
        '& th, & td': { p: 0, borderBottom: line, whiteSpace: 'nowrap' },
        '& td': { height: CELL, textAlign: 'center' },
      }}
    >
      <thead>
        {grouped && (
          <tr>
            <th style={{ width: FUNCTION_WIDTH, minWidth: FUNCTION_WIDTH }} />
            {groups.map((group, index) => (
              <Box
                component="th"
                key={group.where ?? '__own'}
                colSpan={group.columns.length}
                data-testid={`map-owner-${index}`}
                sx={{ ...head, ...label, textAlign: 'center', borderLeft: line }}
              >
                {group.where ?? t('map.thisScope')}
              </Box>
            ))}
            <th colSpan={2} />
          </tr>
        )}
        <tr>
          <Box
            component="th"
            sx={{ ...head, ...label, left: 0, zIndex: 3, textAlign: 'left', width: FUNCTION_WIDTH, minWidth: FUNCTION_WIDTH }}
          >
            {t('map.function')}
          </Box>
          {columns.map((column) => (
            <Heading key={column.id} column={column} onOpen={onOpen} openable={openable(column.id)} t={t} />
          ))}
          <Box component="th" sx={{ ...head, ...label, textAlign: 'center', minWidth: 56, borderLeft: line }}>
            {t('map.people')}
          </Box>
          <Box component="th" sx={{ ...head, ...label, textAlign: 'left', minWidth: 96, pl: 1.5 }}>
            {t('map.coverage')}
          </Box>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Line key={row.element.id} row={row} columns={columns} onSelect={onSelect} sticky={sticky} t={t} />
        ))}
      </tbody>
    </Box>
  )
}

/** An application's name, on end, so forty of them fit across a page. */
function Heading({ column, onOpen, openable, t }: {
  column: MapColumn
  onOpen(id: ElementId): void
  openable: boolean
  t: Translate
}) {
  const label = column.known ? column.name : `${column.name} — ${t('map.unknownApplication')}`
  return (
    <Box
      component="th"
      data-testid={`map-column-${column.id}`}
      sx={{
        position: 'sticky', top: 0, zIndex: 2, bgcolor: 'background.default',
        height: HEADING_HEIGHT, verticalAlign: 'bottom', width: CELL, minWidth: CELL, maxWidth: CELL,
      }}
    >
      <Tooltip title={label}>
        <Box
          component={openable ? 'button' : 'span'}
          type={openable ? 'button' : undefined}
          onClick={openable ? () => onOpen(column.id) : undefined}
          aria-label={openable ? t('sheet.open', { name: column.name }) : undefined}
          sx={{
            display: 'inline-block', writingMode: 'vertical-rl', transform: 'rotate(180deg)',
            maxHeight: HEADING_HEIGHT - 8, overflow: 'hidden', textOverflow: 'ellipsis',
            font: 'inherit', fontSize: 11, lineHeight: `${CELL}px`, textAlign: 'left',
            color: column.known ? 'inherit' : 'text.disabled',
            fontStyle: column.known ? 'normal' : 'italic',
            appearance: 'none', bgcolor: 'transparent', border: 0, p: 0,
            cursor: openable ? 'pointer' : 'default',
            '&:hover': openable ? { textDecoration: 'underline' } : undefined,
          }}
        >
          {column.name}
        </Box>
      </Tooltip>
    </Box>
  )
}

function Line({ row, columns, onSelect, sticky, t }: {
  row: MapRow
  columns: readonly MapColumn[]
  onSelect(id: ElementId): void
  sticky: object
  t: Translate
}) {
  const theme = useTheme()
  const section = !row.leaf
  const name = row.element.name
  const supports = new Set(row.supportedBy)

  const verdict = row.leaf
    ? row.coverage === 'uncovered'
      ? { text: t('map.uncovered'), colour: 'warning.main' }
      : row.coverage === 'manual'
        ? { text: t('map.byPeople'), colour: 'text.secondary' }
        : undefined
    : row.gaps > 0
      ? { text: plural(t, { one: 'map.gapsOne', other: 'map.gapsOther' }, row.gaps), colour: 'warning.main' }
      : undefined

  return (
    <Box
      component="tr"
      data-testid={`map-row-${row.element.id}`}
      sx={section ? { bgcolor: alpha(theme.palette.text.primary, row.depth === 0 ? 0.06 : 0.03) } : undefined}
    >
      <Box component="td" sx={{ ...sticky, left: 0, textAlign: 'left', bgcolor: 'background.default' }}>
        <Box
          component="button"
          type="button"
          onClick={() => onSelect(row.element.id)}
          sx={{
            appearance: 'none', font: 'inherit', color: 'inherit', bgcolor: 'transparent', border: 0,
            cursor: 'pointer', textAlign: 'left', width: '100%', height: CELL, px: 1,
            pl: 1 + row.depth * 1.5, fontWeight: row.depth === 0 ? 700 : section ? 600 : 400,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {name}
        </Box>
      </Box>
      {columns.map((column) => {
        const marked = supports.has(column.id)
        const tip = marked
          ? t(section ? 'map.rolledUpTip' : 'map.supportsTip', { application: column.name, function: name })
          : ''
        return (
          <Box
            component="td"
            key={column.id}
            data-testid={`map-cell-${row.element.id}-${column.id}`}
            data-mark={marked ? (section ? 'rolled-up' : 'supports') : undefined}
            title={tip || undefined}
            sx={{ borderLeft: `1px solid ${theme.palette.divider}` }}
          >
            {marked && (
              <Box
                component="span"
                sx={{
                  display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
                  bgcolor: section ? 'transparent' : 'primary.main',
                  border: section ? 1.5 : 0, borderColor: 'primary.main', borderStyle: 'solid',
                }}
              />
            )}
          </Box>
        )
      })}
      <Box
        component="td"
        data-testid={`map-people-${row.element.id}`}
        title={row.assignedTo.length > 0 ? t('map.peopleTip', { names: row.assignedTo.join(', ') }) : undefined}
        sx={{ borderLeft: `1px solid ${theme.palette.divider}`, px: 1 }}
      >
        {row.assignedTo.length > 0 && (
          <Box
            component="span"
            sx={{
              display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
              bgcolor: section ? 'transparent' : 'text.secondary',
              border: section ? 1.5 : 0, borderColor: 'text.secondary', borderStyle: 'solid',
            }}
          />
        )}
      </Box>
      <Box
        component="td"
        data-testid={`map-coverage-${row.element.id}`}
        sx={{ textAlign: 'left', pl: 1.5, pr: 1, fontSize: 10.5, color: verdict?.colour }}
      >
        {verdict?.text ?? ''}
      </Box>
    </Box>
  )
}
