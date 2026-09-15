/**
 * One platform, on one page (ADR-0013).
 *
 * A page, not a canvas, for the reason the map is one: every mark on it is
 * derived from the rows that name the platform by `model/technologyDiagram`,
 * and this file turns that answer into lists — what stands on it, what uses
 * it, what it stands on and what is under it. The arithmetic is tested in
 * node; what this pins is what a reader is promised on screen.
 *
 * Read top to bottom: the platform and its sort, then the four short lists.
 *
 * It is all read. What a person changes about a platform is changed on the
 * landscape, where the rows are drawn; a name here opens the thing's page
 * where this scope holds it. A fullscreen dialog, and it takes `windowChrome`
 * for the reason the other pages do: the shell toolbar's drag strip stays
 * live underneath it.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import type { DesignDiagram, DesignModel, ElementId, Relation } from '../../model'
import { technologyPage } from '../../model'
import type { LaidOutTechnology, TechnologyDescribe, TechnologyEnd } from '../../model'
import { PLATFORM_CATEGORY_LABEL } from '../../model'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { NO_WINDOW_CHROME, barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { BackIcon } from '../../widgets/icons'
import { PageDialog } from '../../widgets/PageDialog'
import { captureSheet } from '../../business'
import type { SheetHandle } from '../../business'

type CaptureOptions = Parameters<SheetHandle['capture']>[0]

export type TechnologyPageProps = {
  open: boolean
  model: DesignModel
  /** Absent while the page is closing, or when the view was deleted under it. */
  view: DesignDiagram | undefined
  onClose(): void
  windowChrome?: WindowChrome
  /** The page, as the agent's renderer reaches it — the same handle the sheet hands over. */
  onHandle?(handle: SheetHandle | undefined): void
  /**
   * Rows written in another scope that name this platform (ADR-0012 §2) —
   * see `technologyPage`. A STABLE array, for the reason the map's is.
   */
  elsewhere?: readonly Relation[]
  /** Names and owners for the ids the rows name; see `technologyPage`. Stable, likewise. */
  describe?: TechnologyDescribe
  /** The day the view shows, where the view itself names none. */
  today?: string
  /** The way to an element's own page. Absent = names are not links. */
  onOpenDocumentation?(id: ElementId): void
}

export function TechnologyPage(props: TechnologyPageProps) {
  const { model, view } = props
  const { t } = useStrings()
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const bar = barChromeFor(chrome)
  const theme = useTheme()
  const page = useRef<HTMLDivElement | null>(null)

  const onHandle = props.onHandle
  const viewId = view?.id
  const capture = useCallback(async (options: CaptureOptions) => {
    const node = page.current
    if (!node) throw new Error('TechnologyPage: the page is not on screen')
    return captureSheet(node, { ...options, background: theme.palette.background.default })
  }, [theme])
  useEffect(() => {
    if (!onHandle) return undefined
    if (!props.open || viewId === undefined) { onHandle(undefined); return undefined }
    onHandle({ diagramId: viewId, capture })
    return () => onHandle(undefined)
  }, [onHandle, props.open, viewId, capture])

  const laidOut = useMemo(
    () => (view
      ? technologyPage(model, view, {
        ...(props.elsewhere ? { elsewhere: props.elsewhere } : {}),
        ...(props.describe ? { describe: props.describe } : {}),
        ...(props.today !== undefined ? { today: props.today } : {}),
      })
      : undefined),
    [model, view, props.elsewhere, props.describe, props.today],
  )
  const held = useMemo(() => new Set(model.elements.map((element) => element.id)), [model.elements])
  const open = props.onOpenDocumentation
  const openable = (end: TechnologyEnd) => open !== undefined && held.has(end.id)

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
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{view?.name ?? t('technology.page')}</Typography>
        {laidOut && (
          <Typography data-testid="technology-summary" sx={{ fontSize: 11, color: 'text.secondary', ml: 1 }}>
            {t('technology.summary', laidOut.counts)}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
      </Box>

      <Box ref={page} data-testid="technology-body" sx={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', p: 2 }}>
        {laidOut ? (
          <Body laidOut={laidOut} openable={openable} onOpen={(id) => open?.(id)} t={t} />
        ) : (
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary', py: 6, textAlign: 'center' }}>
            {t('technology.noPlatform')}
          </Typography>
        )}
      </Box>
    </PageDialog>
  )
}

function Body({ laidOut, openable, onOpen, t }: {
  laidOut: LaidOutTechnology
  openable(end: TechnologyEnd): boolean
  onOpen(id: ElementId): void
  t: Translate
}) {
  const { platform } = laidOut
  const lists: { key: string; titleKey: Parameters<Translate>[0]; ends: TechnologyEnd[] }[] = [
    { key: 'standsOn', titleKey: 'technology.standsOn', ends: laidOut.standsOn },
    { key: 'children', titleKey: 'technology.children', ends: laidOut.children },
    { key: 'hosted', titleKey: 'technology.hosted', ends: laidOut.hosted },
    { key: 'users', titleKey: 'technology.users', ends: laidOut.users },
  ]
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 1100 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography data-testid="technology-platform" sx={{ fontSize: 18, fontWeight: 700 }}>{platform.name}</Typography>
        <Chip size="small" label={t(PLATFORM_CATEGORY_LABEL[platform.platformCategory])} sx={{ height: 20, fontSize: 11 }} />
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
  end: TechnologyEnd
  openable: boolean
  onOpen(id: ElementId): void
  t: Translate
}) {
  const label = end.known ? end.name : `${end.name} — ${t('technology.unknown')}`
  return (
    <Tooltip title={end.where ? `${label} · ${end.where}` : label}>
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
      </Box>
    </Tooltip>
  )
}
