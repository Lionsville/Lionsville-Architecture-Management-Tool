/**
 * The technology register: every platform service and platform in the
 * organisation, on one page (ADR-0014 §2.6).
 *
 * **Derived, and nothing commits it.** Every row is a definition somewhere
 * in the tree, keyed by id, and every number beside it — who maintains a
 * service, who consumes it and from how many scopes, what realises it, what a
 * platform hosts with everything filed under it — is read off the same index
 * the application register reads. The page cannot disagree with the folders,
 * because it is the folders.
 *
 * What it is for is a platform organisation's own questions: what does the
 * platform team offer, what can my team leverage, who else uses this, and
 * which service is being offered without anybody having said so. The
 * services come first when ordered by kind, because they are what a team
 * asks for; the platforms are what delivers them this year.
 *
 * Under `app/organisation/` beside the application register, for the reason
 * that one gives: the index belongs to `projects`, which may not import
 * React. The arithmetic is `technologyRegister.ts`, pure and tested; this
 * draws it. A full-window page like the others: window chrome, both themes,
 * nothing on it that writes.
 */
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { plural } from '../../i18n/strings'
import type { Translate } from '../../i18n'
import { PLATFORM_ARCHETYPE_LABEL } from '../../model'
import type { ElementId } from '../../model'
import { KIND_LABEL_KEYS } from '../../model/kinds'
import { CHECK_LABEL } from '../../projects/checks'
import type { ScopePath } from '../../projects/scopePath'
import { NO_WINDOW_CHROME, barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { PageDialog } from '../../widgets/PageDialog'
import { matchingTechnology, sortTechnology, technologySummary } from './technologyRegister'
import type { TechnologyOrder, TechnologyRow, TechnologySummary } from './technologyRegister'

export type TechnologyPageProps = {
  open: boolean
  onClose: () => void
  /** Every service and platform in the tree, with its findings (`technologyRegister.ts`). */
  rows: readonly TechnologyRow[]
  /** What the root is called on screen, since its path is the empty string. */
  organisation: string
  /** Open the scope that answers for a row, with the element selected. */
  onOpen?: (scope: ScopePath, id: ElementId) => void
  /** Open the row's page — its record and its document — in the scope that answers for it. */
  onOpenPage?: (scope: ScopePath, id: ElementId) => void
  s: Translate
  windowChrome?: WindowChrome
}

export function TechnologyPage(props: TechnologyPageProps) {
  const { open, onClose, rows, organisation, onOpen, onOpenPage, s } = props
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const bar = barChromeFor(chrome)
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState<TechnologyOrder>('kind')

  const shown = useMemo(() => sortTechnology(matchingTechnology(rows, query), order), [rows, query, order])
  const summary = useMemo(() => technologySummary(rows), [rows])
  const label = (path: ScopePath | undefined) => (path === undefined ? s('register.nobody') : path || organisation)

  const counts = [
    plural(s, { one: 'techRegister.servicesOne', other: 'techRegister.servicesOther' }, summary.services),
    plural(s, { one: 'techRegister.platformsOne', other: 'techRegister.platformsOther' }, summary.platforms),
    plural(s, { one: 'techRegister.sharedOne', other: 'techRegister.sharedOther' }, summary.shared),
  ].join(' · ')

  return (
    <PageDialog open={open} topInset={chrome.topInset} onClose={onClose} aria-label={s('techRegister.title')}>
      <Box
        data-testid="technology-register-topbar"
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5,
          pl: `${12 + bar.controlsInset}px`,
          WebkitAppRegion: bar.draggable ? 'drag' : undefined,
          '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
          minHeight: 48, borderBottom: 1, borderColor: 'divider',
          bgcolor: 'background.paper', flexShrink: 0,
        }}
      >
        <Tooltip title={s('common.close')}>
          <IconButton size="small" aria-label={s('common.close')} onClick={onClose}>
            <Box component="span" aria-hidden sx={{ display: 'inline-block', width: 18, textAlign: 'center', fontSize: 16, lineHeight: 1 }}>
              ‹
            </Box>
          </IconButton>
        </Tooltip>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{s('techRegister.title')}</Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{counts}</Typography>
        <Box sx={{ flex: 1 }} />
        <TextField
          size="small"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={s('register.filter')}
          slotProps={{ htmlInput: { 'aria-label': s('register.filter'), autoComplete: 'off' } }}
          sx={{ width: 220 }}
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={order}
          onChange={(_e, next: TechnologyOrder | null) => { if (next) setOrder(next) }}
          aria-label={s('register.order')}
        >
          <ToggleButton value="kind" sx={{ fontSize: 11, py: 0.25, px: 1 }}>{s('techRegister.byKind')}</ToggleButton>
          <ToggleButton value="name" sx={{ fontSize: 11, py: 0.25, px: 1 }}>{s('register.byName')}</ToggleButton>
          <ToggleButton value="scope" sx={{ fontSize: 11, py: 0.25, px: 1 }}>{s('register.byScope')}</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 3, py: 2 }}>
        <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>{s('techRegister.what')}</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2 }} data-testid="technology-register-findings">
            {findingLine(summary, s)}
          </Typography>

          {rows.length === 0 && <Typography sx={{ fontSize: 13 }}>{s('techRegister.empty')}</Typography>}
          {rows.length > 0 && shown.length === 0 && (
            <Typography sx={{ fontSize: 13 }}>{s('techRegister.noMatch', { query: query.trim() })}</Typography>
          )}

          {shown.length > 0 && (
            <Box component="table" data-testid="technology-register-table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <Box component="thead">
                <Box component="tr" sx={{ '& th': { textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'text.secondary', borderBottom: 1, borderColor: 'divider', py: 0.75, textTransform: 'uppercase', letterSpacing: 0.6 } }}>
                  <Box component="th">{s('techRegister.colName')}</Box>
                  <Box component="th">{s('register.colMaster')}</Box>
                  <Box component="th">{s('techRegister.colWho')}</Box>
                  <Box component="th">{s('techRegister.colShared')}</Box>
                  <Box component="th">{s('techRegister.colUse')}</Box>
                  <Box component="th">{s('techRegister.colRealised')}</Box>
                  <Box component="th">{s('register.colFindings')}</Box>
                  <Box component="th" />
                </Box>
              </Box>
              <Box component="tbody">
                {shown.map((row) => (
                  <Row key={row.id} row={row} label={label} onOpen={onOpen} onOpenPage={onOpenPage} s={s} />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </PageDialog>
  )
}

/** "1 offered, not marked shared · 2 with nothing realising them", or that there is nothing. */
function findingLine(summary: TechnologySummary, s: Translate): string {
  const parts = [
    summary.offeredNotShared > 0
      ? plural(s, { one: 'techRegister.offeredOne', other: 'techRegister.offeredOther' }, summary.offeredNotShared) : '',
    summary.unrealised > 0
      ? plural(s, { one: 'techRegister.unrealisedOne', other: 'techRegister.unrealisedOther' }, summary.unrealised) : '',
    summary.definedTwice > 0
      ? plural(s, { one: 'register.definedTwiceOne', other: 'register.definedTwiceOther' }, summary.definedTwice) : '',
    summary.stale > 0
      ? plural(s, { one: 'register.staleOne', other: 'register.staleOther' }, summary.stale) : '',
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : s('techRegister.settled')
}

const quiet = { fontSize: 12, color: 'text.secondary' } as const

function Row({ row, label, onOpen, onOpenPage, s }: {
  row: TechnologyRow
  label: (path: ScopePath | undefined) => string
  onOpen?: (scope: ScopePath, id: ElementId) => void
  onOpenPage?: (scope: ScopePath, id: ElementId) => void
  s: Translate
}) {
  const service = row.kind === 'platformService'
  const chips = row.findings.map((finding) => ({
    key: finding.key,
    text: s(CHECK_LABEL[finding.key], {
      name: finding.name, scope: label(finding.scopes?.[0]), detail: finding.detail ?? '', count: 0,
    }),
  }))
  const names = (held: readonly { name: string }[]) => held.map((one) => one.name).join(', ')

  return (
    <Box
      component="tr"
      data-testid={`technology-row-${row.id}`}
      sx={{ '& td': { borderBottom: 1, borderColor: 'divider', py: 0.75, verticalAlign: 'top', pr: 1.5 } }}
    >
      <Box component="td">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          {onOpenPage && row.master !== undefined ? (
            <Tooltip title={s('register.pageRow', { name: row.name })}>
              <Typography
                component="button"
                type="button"
                data-testid={`technology-page-${row.id}`}
                onClick={() => onOpenPage(row.master!, row.id)}
                sx={{
                  fontSize: 13, fontWeight: 600, p: 0, border: 0, bgcolor: 'transparent',
                  color: 'text.primary', cursor: 'pointer', textAlign: 'left', font: 'inherit',
                  '&:hover': { color: 'primary.main', textDecoration: 'underline' },
                }}
              >
                {row.name}
              </Typography>
            </Tooltip>
          ) : (
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{row.name}</Typography>
          )}
          <Chip
            size="small"
            variant={service ? 'filled' : 'outlined'}
            label={service ? s(KIND_LABEL_KEYS.platformService) : s(PLATFORM_ARCHETYPE_LABEL[row.platformArchetype ?? 'service'])}
            sx={{ height: 18, fontSize: 10 }}
          />
        </Box>
        {row.outside && (
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {row.party !== undefined ? s('register.outsideParty', { name: row.party }) : s('register.outsideUnattributed')}
          </Typography>
        )}
        {!service && row.service && (
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{s('techRegister.forService', { name: row.service.name })}</Typography>
        )}
      </Box>
      <Box component="td">
        <Typography sx={{ fontSize: 12 }} data-testid={`technology-master-${row.id}`}>{label(row.master)}</Typography>
      </Box>
      <Box component="td">
        <Typography sx={quiet} data-testid={`technology-who-${row.id}`}>
          {service
            ? (row.maintainers.length ? names(row.maintainers) : s('techRegister.nobodyMaintains'))
            : [
              row.maintainers.length ? names(row.maintainers) : '',
              row.partOf ? s('techRegister.partOf', { name: row.partOf.name }) : '',
            ].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
      <Box component="td">
        {service && (
          <Typography sx={quiet} data-testid={`technology-shared-${row.id}`}>
            {row.shared ? s('techRegister.shared') : s('techRegister.ownTeam')}
          </Typography>
        )}
      </Box>
      <Box component="td">
        <Typography sx={quiet} data-testid={`technology-use-${row.id}`}>
          {service
            ? [
              plural(s, { one: 'register.applicationsOne', other: 'register.applicationsOther' }, row.consumers.applications),
              plural(s, { one: 'register.drawnOne', other: 'register.drawnOther' }, row.consumers.scopes),
            ].join(' · ')
            : plural(s, { one: 'techRegister.hostsOne', other: 'techRegister.hostsOther' }, row.hosts)}
        </Typography>
      </Box>
      <Box component="td">
        <Typography sx={quiet} data-testid={`technology-realised-${row.id}`}>
          {service
            ? (row.realisedBy.length ? names(row.realisedBy) : s('techRegister.unrealised'))
            : (row.realises.length ? names(row.realises) : s('techRegister.realisesNothing'))}
        </Typography>
      </Box>
      <Box component="td">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              size="small"
              color={chip.key === 'check.conflict' || chip.key === 'check.offeredNotShared' ? 'warning' : 'default'}
              variant="outlined"
              label={chip.text}
              sx={{ height: 20, fontSize: 10 }}
            />
          ))}
        </Box>
      </Box>
      <Box component="td" sx={{ whiteSpace: 'nowrap' }}>
        {onOpen && row.master !== undefined && (
          <Tooltip title={s('register.openRow', { name: row.name })}>
            <Button
              size="small"
              color="inherit"
              sx={{ fontSize: 11, minWidth: 0, px: 1 }}
              data-testid={`technology-open-${row.id}`}
              onClick={() => onOpen(row.master!, row.id)}
            >
              {s('picker.open')}
            </Button>
          </Tooltip>
        )}
      </Box>
    </Box>
  )
}
