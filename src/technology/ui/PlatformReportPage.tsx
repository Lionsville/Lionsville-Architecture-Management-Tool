/**
 * One platform, on one page (ADR-0013, redone).
 *
 * A REPORT, not a view. The first cut made it the fourth laid-out view kind,
 * offered beside the sheet and the map — which promised a picture and gave a
 * table of text. It is reached from the platform\'s own card and from the
 * finding that names it, has no tab, and is created by nobody: everything on
 * it is derived from the rows by `model/platformReport`, so opening it is the
 * whole of making it.
 *
 * What it is for is one question: *this is being retired; what is on it.* So
 * it reads top to bottom as that answer — the platform and its sort, then what
 * is filed under it, what it stands on, what runs on it and what uses it, and
 * last the container interfaces that cross it, each with the application
 * interface it is part of. That last table is what makes a retirement legible:
 * not eleven rows, but these interfaces, between these applications.
 *
 * It is all read. What a person changes about a platform is changed on the
 * board, where the rows are drawn; a name here opens the thing\'s page where
 * this scope holds it. A fullscreen dialog, and it takes `windowChrome` for
 * the reason the other pages do: the shell toolbar\'s drag strip stays live
 * underneath it.
 */
import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import type { DesignModel, ElementId, Relation } from '../../model'
import { platformReport } from '../../model'
import type { PlatformDescribe, PlatformEnd, PlatformLanding, PlatformReport } from '../../model'
import { PLATFORM_ARCHETYPE_LABEL } from '../../model'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { NO_WINDOW_CHROME, barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { BackIcon } from '../../widgets/icons'
import { PageDialog } from '../../widgets/PageDialog'

export type PlatformReportPageProps = {
  open: boolean
  model: DesignModel
  /** The platform being read. Absent while the page is closing. */
  platformId: ElementId | undefined
  onClose(): void
  windowChrome?: WindowChrome
  /**
   * Rows written in another scope that name this platform (ADR-0012 §2) —
   * see `platformReport`. A STABLE array, for the reason the map's is.
   */
  elsewhere?: readonly Relation[]
  /** Names and owners for the ids the rows name; see `platformReport`. Stable, likewise. */
  describe?: PlatformDescribe
  /** The day it is read. */
  today?: string
  /** The way to an element's own page. Absent = names are not links. */
  onOpenDocumentation?(id: ElementId): void
}

export function PlatformReportPage(props: PlatformReportPageProps) {
  const { model, platformId } = props
  const { t } = useStrings()
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const bar = barChromeFor(chrome)

  const report = useMemo(
    () => (platformId === undefined
      ? undefined
      : platformReport(model, platformId, {
        ...(props.elsewhere ? { elsewhere: props.elsewhere } : {}),
        ...(props.describe ? { describe: props.describe } : {}),
        ...(props.today !== undefined ? { today: props.today } : {}),
      })),
    [model, platformId, props.elsewhere, props.describe, props.today],
  )
  const held = useMemo(() => new Set(model.elements.map((element) => element.id)), [model.elements])
  const open = props.onOpenDocumentation
  const openable = (end: PlatformEnd) => open !== undefined && held.has(end.id)

  return (
    <PageDialog
      open={props.open}
      topInset={chrome.topInset}
      onClose={props.onClose}
      aria-label={t('technology.page')}
    >
      <Box
        data-testid="technology-topbar"
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5, minHeight: 48, flexShrink: 0,
          pl: `${12 + bar.controlsInset}px`,
          WebkitAppRegion: bar.draggable ? 'drag' : undefined,
          '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
          borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper',
        }}
      >
        <Tooltip title={t('technology.close')}>
          <IconButton size="small" aria-label={t('technology.close')} onClick={props.onClose}>
            <BackIcon />
          </IconButton>
        </Tooltip>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t('technology.page')}</Typography>
        {report && (
          <Typography data-testid="technology-summary" sx={{ fontSize: 11, color: 'text.secondary', ml: 1 }}>
            {t('technology.summary', report.counts)}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
      </Box>

      <Box data-testid="technology-body" sx={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', p: 2 }}>
        {report ? (
          <Body report={report} openable={openable} onOpen={(id) => open?.(id)} t={t} />
        ) : (
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary', py: 6, textAlign: 'center' }}>
            {t('technology.noPlatform')}
          </Typography>
        )}
      </Box>
    </PageDialog>
  )
}

function Body({ report, openable, onOpen, t }: {
  report: PlatformReport
  openable(end: PlatformEnd): boolean
  onOpen(id: ElementId): void
  t: Translate
}) {
  const { platform } = report
  const lists: { key: string; titleKey: Parameters<Translate>[0]; ends: PlatformEnd[] }[] = [
    { key: 'standsOn', titleKey: 'technology.standsOn', ends: report.standsOn },
    { key: 'children', titleKey: 'technology.children', ends: report.children },
    { key: 'hosted', titleKey: 'technology.hosted', ends: report.hosted },
    { key: 'users', titleKey: 'technology.users', ends: report.users },
  ]
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 1100 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography data-testid="technology-platform" sx={{ fontSize: 18, fontWeight: 700 }}>{platform.name}</Typography>
        <Chip size="small" label={t(PLATFORM_ARCHETYPE_LABEL[platform.platformArchetype])} sx={{ height: 20, fontSize: 11 }} />
        {platform.where && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{platform.where}</Typography>}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
        {lists.map((list) => (
          <Box key={list.key} data-testid={`technology-${list.key}`}>
            <Caption text={t(list.titleKey)} />
            {list.ends.length === 0 ? (
              <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>{t('technology.nothing')}</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {list.ends.map((end) => <Name key={end.id} end={end} openable={openable(end)} onOpen={onOpen} t={t} />)}
              </Box>
            )}
          </Box>
        ))}
      </Box>

      <Box data-testid="technology-landings">
        <Caption text={t('technology.landings')} />
        {report.landings.length === 0 ? (
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary', py: 2 }}>{t('technology.noLandings')}</Typography>
        ) : (
          <Landings landings={report.landings} openable={openable} onOpen={onOpen} t={t} />
        )}
      </Box>
    </Box>
  )
}

/** The small capitals the sheet's bands and the map's headings use. */
function Caption({ text }: { text: string }) {
  return (
    <Typography sx={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      color: 'text.secondary', mb: 0.5,
    }}>
      {text}
    </Typography>
  )
}

/** A thing's name: a way to its page where this scope holds it, a word otherwise. */
function Name({ end, openable, onOpen, t }: {
  end: PlatformEnd
  openable: boolean
  onOpen(id: ElementId): void
  t: Translate
}) {
  const label = end.known ? end.name : `${end.name} — ${t('technology.unknown')}`
  const where = end.application ? `${label} · ${end.application.name}` : label
  return (
    <Tooltip title={end.where ? `${where} · ${end.where}` : where}>
      <Box
        component={openable ? 'button' : 'span'}
        type={openable ? 'button' : undefined}
        onClick={openable ? () => onOpen(end.id) : undefined}
        aria-label={openable ? t('technology.open', { name: end.name }) : undefined}
        data-testid={`technology-name-${end.id}`}
        sx={{
          font: 'inherit', fontSize: 12, appearance: 'none', bgcolor: 'transparent', border: 0, p: 0,
          color: end.known ? 'inherit' : 'text.disabled', fontStyle: end.known ? 'normal' : 'italic',
          cursor: openable ? 'pointer' : 'default', textAlign: 'left', whiteSpace: 'nowrap',
          '&:hover': openable ? { textDecoration: 'underline' } : undefined,
        }}
      >
        {end.name}
        {end.application && (
          <Box component="span" sx={{ color: 'text.secondary' }}>{` · ${end.application.name}`}</Box>
        )}
      </Box>
    </Tooltip>
  )
}

/**
 * What crosses it: one row per container interface landing on something hosted
 * here, with the application interface it is part of beside it.
 *
 * A real `<table>`, for the map's reason: a screen reader reads a matrix as
 * one. The interface column is what makes the list legible — eleven container
 * lines are a list, three interfaces between four applications are a decision.
 */
function Landings({ landings, openable, onOpen, t }: {
  landings: readonly PlatformLanding[]
  openable(end: PlatformEnd): boolean
  onOpen(id: ElementId): void
  t: Translate
}) {
  const theme = useTheme()
  const line = `1px solid ${theme.palette.divider}`
  const head = {
    textAlign: 'left', px: 1, pb: 0.5, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
    textTransform: 'uppercase', color: 'text.secondary', whiteSpace: 'nowrap',
  } as const
  return (
    <Box
      component="table"
      data-testid="technology-grid"
      sx={{
        borderCollapse: 'collapse', fontSize: 11.5, width: '100%',
        '& td': { px: 1, height: 30, borderTop: line, whiteSpace: 'nowrap' },
      }}
    >
      <thead>
        <tr>
          <Box component="th" sx={head}>{t('technology.from')}</Box>
          <th />
          <Box component="th" sx={head}>{t('technology.to')}</Box>
          <Box component="th" sx={head}>{t('technology.protocol')}</Box>
          <Box component="th" sx={head}>{t('technology.partOf')}</Box>
        </tr>
      </thead>
      <tbody>
        {landings.map((landing) => (
          <Box component="tr" key={landing.relation.id} data-testid={`technology-landing-${landing.relation.id}`}>
            <td><Name end={landing.source} openable={openable(landing.source)} onOpen={onOpen} t={t} /></td>
            <Box component="td" sx={{ textAlign: 'center', color: 'text.secondary' }}>
              {landing.relation.isBidirectional === true ? '↔' : '→'}
            </Box>
            <td><Name end={landing.target} openable={openable(landing.target)} onOpen={onOpen} t={t} /></td>
            <Box component="td" sx={{ color: 'text.secondary' }}>
              {[landing.relation.protocol, landing.relation.technology].filter(Boolean).join(' · ')}
            </Box>
            <Box component="td" sx={{ color: 'text.secondary' }}>
              {landing.partOf ? landing.partOf.label ?? landing.partOf.id : t('technology.itsOwn')}
            </Box>
          </Box>
        ))}
      </tbody>
    </Box>
  )
}
