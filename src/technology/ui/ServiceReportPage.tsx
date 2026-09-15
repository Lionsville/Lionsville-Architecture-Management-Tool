/**
 * One platform service, on one page (ADR-0014 §2.8).
 *
 * The platform report's other side. Reached from the service's own chip the
 * way the platform's is, and created by nobody: every mark on it is derived
 * from the rows by `model/serviceReport`, so opening it is the whole of
 * making it. What it is for is the question a platform team owns — *this is
 * being withdrawn; who leans on it* — so it reads top to bottom as that
 * answer: the service and whether it is shared, who maintains it, what
 * realises it this year, who consumes it and from which scopes, and last
 * what would be stranded on the day it goes.
 *
 * It is all read. What a person changes about a service is changed on the
 * board, where the rows are; a name here opens the thing\'s page where this
 * scope holds it.
 */
import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import type { DesignModel, ElementId, Relation } from '../../model'
import { serviceReport } from '../../model'
import type { PlatformDescribe, PlatformEnd, ServiceConsumer, ServiceReport } from '../../model'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { NO_WINDOW_CHROME, barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { BackIcon } from '../../widgets/icons'
import { PageDialog } from '../../widgets/PageDialog'

export type ServiceReportPageProps = {
  open: boolean
  model: DesignModel
  /** The service being read. Absent while the page is closing. */
  serviceId: ElementId | undefined
  onClose(): void
  windowChrome?: WindowChrome
  /** Rows written in another scope that name this service (ADR-0012 §2). A STABLE array. */
  elsewhere?: readonly Relation[]
  /** Names and owners for the ids the rows name. Stable, likewise. */
  describe?: PlatformDescribe
  /** The day it is read. */
  today?: string
  /** The way to an element\'s own page. Absent = names are not links. */
  onOpenDocumentation?(id: ElementId): void
}

export function ServiceReportPage(props: ServiceReportPageProps) {
  const { model, serviceId } = props
  const { t } = useStrings()
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const bar = barChromeFor(chrome)

  const report = useMemo(
    () => (serviceId === undefined
      ? undefined
      : serviceReport(model, serviceId, {
        ...(props.elsewhere ? { elsewhere: props.elsewhere } : {}),
        ...(props.describe ? { describe: props.describe } : {}),
        ...(props.today !== undefined ? { today: props.today } : {}),
      })),
    [model, serviceId, props.elsewhere, props.describe, props.today],
  )
  const held = useMemo(() => new Set(model.elements.map((element) => element.id)), [model.elements])
  const open = props.onOpenDocumentation
  const openable = (end: PlatformEnd) => open !== undefined && held.has(end.id)

  return (
    <PageDialog open={props.open} topInset={chrome.topInset} onClose={props.onClose} aria-label={t('service.page')}>
      <Box
        data-testid="service-topbar"
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5, minHeight: 48, flexShrink: 0,
          pl: `${12 + bar.controlsInset}px`,
          WebkitAppRegion: bar.draggable ? 'drag' : undefined,
          '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
          borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper',
        }}
      >
        <Tooltip title={t('service.close')}>
          <IconButton size="small" aria-label={t('service.close')} onClick={props.onClose}>
            <BackIcon />
          </IconButton>
        </Tooltip>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t('service.page')}</Typography>
        {report && (
          <Typography data-testid="service-summary" sx={{ fontSize: 11, color: 'text.secondary', ml: 1 }}>
            {t('service.summary', { consumers: report.counts.consumers, scopes: report.scopes.length, stranded: report.counts.stranded })}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
      </Box>

      <Box data-testid="service-body" sx={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', p: 2 }}>
        {report ? (
          <Body report={report} openable={openable} onOpen={(id) => open?.(id)} t={t} />
        ) : (
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary', py: 6, textAlign: 'center' }}>
            {t('service.noService')}
          </Typography>
        )}
      </Box>
    </PageDialog>
  )
}

function Body({ report, openable, onOpen, t }: {
  report: ServiceReport
  openable(end: PlatformEnd): boolean
  onOpen(id: ElementId): void
  t: Translate
}) {
  const { service } = report
  const lists: { key: string; titleKey: Parameters<Translate>[0]; ends: PlatformEnd[]; emptyKey: Parameters<Translate>[0] }[] = [
    { key: 'maintainers', titleKey: 'service.maintainers', ends: report.maintainers, emptyKey: 'service.nobody' },
    { key: 'realisedBy', titleKey: 'service.realisedBy', ends: report.realisedBy, emptyKey: 'service.nothingRealises' },
  ]
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 1100 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography data-testid="service-name" sx={{ fontSize: 18, fontWeight: 700 }}>{service.name}</Typography>
        <Chip size="small" label={service.shared ? t('service.shared') : t('service.ownTeam')} sx={{ height: 20, fontSize: 11 }} />
        {service.retiredOn && (
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('service.goesOn', { day: service.retiredOn })}</Typography>
        )}
        {service.where && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{service.where}</Typography>}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
        {lists.map((list) => (
          <Box key={list.key} data-testid={`service-${list.key}`}>
            <Caption text={t(list.titleKey)} />
            {list.ends.length === 0 ? (
              <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>{t(list.emptyKey)}</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {list.ends.map((end) => <Name key={end.id} end={end} openable={openable(end)} onOpen={onOpen} t={t} />)}
              </Box>
            )}
          </Box>
        ))}
      </Box>

      <Box data-testid="service-consumers">
        <Caption text={t('service.consumers')} />
        {report.consumers.length === 0 ? (
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary', py: 2 }}>{t('service.noConsumers')}</Typography>
        ) : (
          <Consumers consumers={report.consumers} stranded={new Set(report.stranded.map((one) => one.id))} openable={openable} onOpen={onOpen} t={t} />
        )}
      </Box>
    </Box>
  )
}

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

/** A thing\'s name: a way to its page where this scope holds it, a word otherwise. */
function Name({ end, openable, onOpen, t }: {
  end: PlatformEnd
  openable: boolean
  onOpen(id: ElementId): void
  t: Translate
}) {
  const label = end.known ? end.name : `${end.name} — ${t('service.unknown')}`
  return (
    <Tooltip title={end.where ? `${label} · ${end.where}` : label}>
      <Box
        component={openable ? 'button' : 'span'}
        type={openable ? 'button' : undefined}
        onClick={openable ? () => onOpen(end.id) : undefined}
        aria-label={openable ? t('service.open', { name: end.name }) : undefined}
        data-testid={`service-name-${end.id}`}
        sx={{
          font: 'inherit', fontSize: 12, appearance: 'none', bgcolor: 'transparent', border: 0, p: 0,
          color: end.known ? 'inherit' : 'text.disabled', fontStyle: end.known ? 'normal' : 'italic',
          cursor: openable ? 'pointer' : 'default', textAlign: 'left', whiteSpace: 'nowrap',
          '&:hover': openable ? { textDecoration: 'underline' } : undefined,
        }}
      >
        {end.name}
      </Box>
    </Tooltip>
  )
}

/**
 * Who leans on it: one row per application, with the container the row was
 * written from, the scope it came from, and whether it would be stranded on
 * the day the service goes. A real table, for the map\'s reason.
 */
function Consumers({ consumers, stranded, openable, onOpen, t }: {
  consumers: readonly ServiceConsumer[]
  stranded: ReadonlySet<ElementId>
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
      data-testid="service-grid"
      sx={{
        borderCollapse: 'collapse', fontSize: 11.5, width: '100%',
        '& td': { px: 1, height: 30, borderTop: line, whiteSpace: 'nowrap' },
      }}
    >
      <thead>
        <tr>
          <Box component="th" sx={head}>{t('service.consumer')}</Box>
          <Box component="th" sx={head}>{t('service.via')}</Box>
          <Box component="th" sx={head}>{t('service.fromScope')}</Box>
          <Box component="th" sx={head}>{t('service.stranded')}</Box>
        </tr>
      </thead>
      <tbody>
        {consumers.map((consumer) => (
          <Box component="tr" key={consumer.id} data-testid={`service-consumer-${consumer.id}`}>
            <td><Name end={consumer} openable={openable(consumer)} onOpen={onOpen} t={t} /></td>
            <Box component="td" sx={{ color: 'text.secondary' }}>{consumer.via?.name ?? ''}</Box>
            <Box component="td" sx={{ color: 'text.secondary' }}>{consumer.where ?? t('service.thisScope')}</Box>
            <Box component="td" sx={{ color: stranded.has(consumer.id) ? 'warning.main' : 'text.secondary' }}>
              {stranded.has(consumer.id) ? t('service.strandedYes') : t('service.strandedNo')}
            </Box>
          </Box>
        ))}
      </tbody>
    </Box>
  )
}
