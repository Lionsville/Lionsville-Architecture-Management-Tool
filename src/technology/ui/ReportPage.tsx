// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One platform, or one platform service, on one page (ADR-0013, redone;
 * ADR-0014 §2.8). One page, drawn twice — what differs between the two is a
 * small configuration each (`PLATFORM`, `SERVICE`), and the rest is written
 * once.
 *
 * A REPORT, not a view. The first cut made the platform's the fourth laid-out
 * view kind, offered beside the sheet and the map — which promised a picture
 * and gave a table of text. Each is reached from the thing's own card or chip
 * and from the finding that names it, has no tab, and is created by nobody:
 * everything on it is derived from the rows by `model/platformReport` or
 * `model/serviceReport`, so opening it is the whole of making it.
 *
 * Each is for one question, and reads top to bottom as its answer. The
 * platform's is *this is being retired; what is on it*: the platform and its
 * sort, then what is filed under it, what it stands on, what runs on it and
 * what uses it, and last the container interfaces that cross it, each with
 * the application interface it is part of. That last table is what makes a
 * retirement legible: not eleven rows, but these interfaces, between these
 * applications. The service's is the question a platform team owns — *this is
 * being withdrawn; who leans on it*: the service and whether it is shared, who
 * maintains it, what realises it this year, who consumes it and from which
 * scopes, and last what would be stranded on the day it goes.
 *
 * It is all read. What a person changes is changed on the board, where the
 * rows are drawn; a name here opens the thing's page where this scope holds
 * it. A fullscreen dialog, and it takes `windowChrome` for the reason the
 * other pages do: the shell toolbar's drag strip stays live underneath it.
 */
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import type { DesignModel, ElementId, Relation } from '../../model'
import { platformReport, serviceReport } from '../../model'
import type { PlatformDescribe, PlatformEnd, PlatformReport, ServiceReport } from '../../model'
import { PLATFORM_ARCHETYPE_LABEL } from '../../model'
import { useStrings } from '../../i18n'
import type { StringKey, Translate } from '../../i18n'
import { NO_WINDOW_CHROME, barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { BackIcon } from '../../widgets/icons'
import { PageDialog } from '../../widgets/PageDialog'

/** What both pages are handed, bar the id of the thing being read. */
type PageProps = {
  open: boolean
  model: DesignModel
  onClose(): void
  windowChrome?: WindowChrome
  /**
   * Rows written in another scope that name the thing being read (ADR-0012
   * §2) — see `platformReport`. A STABLE array, for the reason the map's is.
   */
  elsewhere?: readonly Relation[]
  /** Names and owners for the ids the rows name; see `platformReport`. Stable, likewise. */
  describe?: PlatformDescribe
  /** The day it is read. */
  today?: string
  /** The way to an element's own page. Absent = names are not links. */
  onOpenDocumentation?(id: ElementId): void
}

export type PlatformReportPageProps = PageProps & {
  /** The platform being read. Absent while the page is closing. */
  platformId: ElementId | undefined
}

export type ServiceReportPageProps = PageProps & {
  /** The service being read. Absent while the page is closing. */
  serviceId: ElementId | undefined
}

export function PlatformReportPage({ platformId, ...props }: PlatformReportPageProps) {
  return <Report {...props} subjectId={platformId} config={PLATFORM} />
}

export function ServiceReportPage({ serviceId, ...props }: ServiceReportPageProps) {
  return <Report {...props} subjectId={serviceId} config={SERVICE} />
}

/** One of the small lists above the table: a caption, the names, or what it says when there are none. */
type NameList = { key: string; title: StringKey; ends: readonly PlatformEnd[]; empty: StringKey }

/** Draws one end as a name, a way to its page where this scope holds it. */
type NameOf = (end: PlatformEnd) => ReactNode

/**
 * What one report is: its words, its arithmetic, its heading, its lists and
 * its table. `prefix` is the test-id prefix of every part (`<prefix>-topbar`).
 */
type ReportConfig<R> = {
  prefix: string
  /** The test id of the heading that names the thing. */
  heading: string
  page: StringKey
  close: StringKey
  /** What the body says for an id this scope does not hold. */
  none: StringKey
  unknown: StringKey
  open: StringKey
  report(
    model: DesignModel,
    id: ElementId,
    options: { elsewhere?: readonly Relation[]; describe?: PlatformDescribe; today?: string },
  ): R | undefined
  summary(report: R, t: Translate): string
  /** The name, the chip beside it, and the quiet lines after that, where there are any. */
  head(report: R, t: Translate): { name: string; chip: string; notes: readonly (string | undefined)[] }
  lists(report: R): readonly NameList[]
  /** The table at the foot, as a real `<table>` for the map's reason: a screen reader reads a matrix as one. */
  table: {
    key: string
    caption: StringKey
    empty: StringKey
    /** A column's heading; `null` is a column with none. */
    headers: readonly (StringKey | null)[]
    rows(report: R, name: NameOf, t: Translate): ReactNode[]
  }
}

const PLATFORM: ReportConfig<PlatformReport> = {
  prefix: 'technology',
  heading: 'technology-platform',
  page: 'technology.page',
  close: 'technology.close',
  none: 'technology.noPlatform',
  unknown: 'technology.unknown',
  open: 'technology.open',
  report: platformReport,
  summary: (report, t) => t('technology.summary', report.counts),
  head: (report, t) => ({
    name: report.platform.name,
    chip: t(PLATFORM_ARCHETYPE_LABEL[report.platform.platformArchetype]),
    notes: [report.platform.where],
  }),
  lists: (report) => [
    { key: 'standsOn', title: 'technology.standsOn', ends: report.standsOn, empty: 'technology.nothing' },
    { key: 'children', title: 'technology.children', ends: report.children, empty: 'technology.nothing' },
    { key: 'hosted', title: 'technology.hosted', ends: report.hosted, empty: 'technology.nothing' },
    { key: 'users', title: 'technology.users', ends: report.users, empty: 'technology.nothing' },
  ],
  // What crosses it: one row per container interface landing on something
  // hosted here, with the application interface it is part of beside it. The
  // interface column is what makes the list legible — eleven container lines
  // are a list, three interfaces between four applications are a decision.
  table: {
    key: 'landings',
    caption: 'technology.landings',
    empty: 'technology.noLandings',
    headers: ['technology.from', null, 'technology.to', 'technology.protocol', 'technology.partOf'],
    rows: (report, name, t) => report.landings.map((landing) => (
      <Box component="tr" key={landing.relation.id} data-testid={`technology-landing-${landing.relation.id}`}>
        <td>{name(landing.source)}</td>
        <Box component="td" sx={{ textAlign: 'center', color: 'text.secondary' }}>
          {landing.relation.isBidirectional === true ? '↔' : '→'}
        </Box>
        <td>{name(landing.target)}</td>
        <Box component="td" sx={{ color: 'text.secondary' }}>
          {[landing.relation.protocol, landing.relation.technology].filter(Boolean).join(' · ')}
        </Box>
        <Box component="td" sx={{ color: 'text.secondary' }}>
          {landing.partOf ? landing.partOf.label ?? landing.partOf.id : t('technology.itsOwn')}
        </Box>
      </Box>
    )),
  },
}

const SERVICE: ReportConfig<ServiceReport> = {
  prefix: 'service',
  heading: 'service-name',
  page: 'service.page',
  close: 'service.close',
  none: 'service.noService',
  unknown: 'service.unknown',
  open: 'service.open',
  report: serviceReport,
  summary: (report, t) => t('service.summary', {
    consumers: report.counts.consumers, scopes: report.scopes.length, stranded: report.counts.stranded,
  }),
  head: (report, t) => ({
    name: report.service.name,
    chip: report.service.shared ? t('service.shared') : t('service.ownTeam'),
    notes: [
      report.service.retiredOn ? t('service.goesOn', { day: report.service.retiredOn }) : undefined,
      report.service.where,
    ],
  }),
  lists: (report) => [
    { key: 'maintainers', title: 'service.maintainers', ends: report.maintainers, empty: 'service.nobody' },
    { key: 'realisedBy', title: 'service.realisedBy', ends: report.realisedBy, empty: 'service.nothingRealises' },
  ],
  // Who leans on it: one row per application, with the container the row was
  // written from, the scope it came from, and whether it would be stranded on
  // the day the service goes.
  table: {
    key: 'consumers',
    caption: 'service.consumers',
    empty: 'service.noConsumers',
    headers: ['service.consumer', 'service.via', 'service.fromScope', 'service.stranded'],
    rows: (report, name, t) => {
      const stranded = new Set(report.stranded.map((one) => one.id))
      return report.consumers.map((consumer) => (
        <Box component="tr" key={consumer.id} data-testid={`service-consumer-${consumer.id}`}>
          <td>{name(consumer)}</td>
          <Box component="td" sx={{ color: 'text.secondary' }}>{consumer.via?.name ?? ''}</Box>
          <Box component="td" sx={{ color: 'text.secondary' }}>{consumer.where ?? t('service.thisScope')}</Box>
          <Box component="td" sx={{ color: stranded.has(consumer.id) ? 'warning.main' : 'text.secondary' }}>
            {stranded.has(consumer.id) ? t('service.strandedYes') : t('service.strandedNo')}
          </Box>
        </Box>
      ))
    },
  },
}

function Report<R>(props: PageProps & { subjectId: ElementId | undefined; config: ReportConfig<R> }) {
  const { model, subjectId, config } = props
  const { t } = useStrings()
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const bar = barChromeFor(chrome)

  const report = useMemo(
    () => (subjectId === undefined
      ? undefined
      : config.report(model, subjectId, {
        ...(props.elsewhere ? { elsewhere: props.elsewhere } : {}),
        ...(props.describe ? { describe: props.describe } : {}),
        ...(props.today !== undefined ? { today: props.today } : {}),
      })),
    [config, model, subjectId, props.elsewhere, props.describe, props.today],
  )
  const held = useMemo(() => new Set(model.elements.map((element) => element.id)), [model.elements])
  const open = props.onOpenDocumentation
  const openable = (end: PlatformEnd) => open !== undefined && held.has(end.id)

  return (
    <PageDialog
      open={props.open}
      topInset={chrome.topInset}
      onClose={props.onClose}
      aria-label={t(config.page)}
    >
      <Box
        data-testid={`${config.prefix}-topbar`}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5, minHeight: 48, flexShrink: 0,
          pl: `${12 + bar.controlsInset}px`,
          WebkitAppRegion: bar.draggable ? 'drag' : undefined,
          '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
          borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper',
        }}
      >
        <Tooltip title={t(config.close)}>
          <IconButton size="small" aria-label={t(config.close)} onClick={props.onClose}>
            <BackIcon />
          </IconButton>
        </Tooltip>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t(config.page)}</Typography>
        {report && (
          <Typography data-testid={`${config.prefix}-summary`} sx={{ fontSize: 11, color: 'text.secondary', ml: 1 }}>
            {config.summary(report, t)}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
      </Box>

      <Box data-testid={`${config.prefix}-body`} sx={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', p: 2 }}>
        {report ? (
          <Body config={config} report={report} openable={openable} onOpen={(id) => open?.(id)} t={t} />
        ) : (
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary', py: 6, textAlign: 'center' }}>
            {t(config.none)}
          </Typography>
        )}
      </Box>
    </PageDialog>
  )
}

function Body<R>({ config, report, openable, onOpen, t }: {
  config: ReportConfig<R>
  report: R
  openable(end: PlatformEnd): boolean
  onOpen(id: ElementId): void
  t: Translate
}) {
  const head = config.head(report, t)
  const name: NameOf = (end) => (
    <Name key={end.id} end={end} openable={openable(end)} onOpen={onOpen} config={config} t={t} />
  )
  const table = config.table
  const rows = table.rows(report, name, t)
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 1100 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography data-testid={config.heading} sx={{ fontSize: 18, fontWeight: 700 }}>{head.name}</Typography>
        <Chip size="small" label={head.chip} sx={{ height: 20, fontSize: 11 }} />
        {head.notes.map((note, at) => note && (
          <Typography key={at} sx={{ fontSize: 11, color: 'text.secondary' }}>{note}</Typography>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
        {config.lists(report).map((list) => (
          <Box key={list.key} data-testid={`${config.prefix}-${list.key}`}>
            <Caption text={t(list.title)} />
            {list.ends.length === 0 ? (
              <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>{t(list.empty)}</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {list.ends.map(name)}
              </Box>
            )}
          </Box>
        ))}
      </Box>

      <Box data-testid={`${config.prefix}-${table.key}`}>
        <Caption text={t(table.caption)} />
        {rows.length === 0 ? (
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary', py: 2 }}>{t(table.empty)}</Typography>
        ) : (
          <Grid id={`${config.prefix}-grid`} headers={table.headers} t={t}>{rows}</Grid>
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

/**
 * A thing's name: a way to its page where this scope holds it, a word
 * otherwise. The application beside it and the descendant it sits on are a
 * platform report's; a service's ends carry neither.
 */
function Name({ end, openable, onOpen, config, t }: {
  end: PlatformEnd
  openable: boolean
  onOpen(id: ElementId): void
  config: { prefix: string; unknown: StringKey; open: StringKey }
  t: Translate
}) {
  const label = end.known ? end.name : `${end.name} — ${t(config.unknown)}`
  const within = end.application ? `${label} · ${end.application.name}` : label
  const where = end.place ? `${within} · ${t('technology.on', { name: end.place.name })}` : within
  return (
    <Tooltip title={end.where ? `${where} · ${end.where}` : where}>
      <Box
        component={openable ? 'button' : 'span'}
        type={openable ? 'button' : undefined}
        onClick={openable ? () => onOpen(end.id) : undefined}
        aria-label={openable ? t(config.open, { name: end.name }) : undefined}
        data-testid={`${config.prefix}-name-${end.id}`}
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
        {/* The descendant it actually sits on (ADR-0014 §2.7): a container in
            the namespace, on the cluster's report. */}
        {end.place && (
          <Box component="span" sx={{ color: 'text.secondary' }}>{` · ${t('technology.on', { name: end.place.name })}`}</Box>
        )}
      </Box>
    </Tooltip>
  )
}

/** The table at the foot of a report: its headings in small capitals, a rule above every row. */
function Grid({ id, headers, t, children }: {
  id: string
  headers: readonly (StringKey | null)[]
  t: Translate
  children: ReactNode
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
      data-testid={id}
      sx={{
        borderCollapse: 'collapse', fontSize: 11.5, width: '100%',
        '& td': { px: 1, height: 30, borderTop: line, whiteSpace: 'nowrap' },
      }}
    >
      <thead>
        <tr>
          {headers.map((header, at) => (header === null
            ? <th key={at} />
            : <Box component="th" key={header} sx={head}>{t(header)}</Box>))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </Box>
  )
}
