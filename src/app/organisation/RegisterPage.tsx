// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The registers: every application in the organisation on one page (ADR-0012
 * §2, §9), and every platform service and platform on another (ADR-0014
 * §2.6). One page, drawn twice — what differs between them is a small
 * configuration each (`APPLICATIONS`, `TECHNOLOGY`), and the rest is written
 * once.
 *
 * **Derived, and nothing commits them.** There is no register file and no
 * owner field: every row is a definition somewhere in the tree, keyed by id,
 * and every finding and number beside it — who maintains a service, who
 * consumes it and from how many scopes, what realises it, what a platform
 * hosts with everything filed under it — is computed from the same index.
 * What that buys is the property a materialised list cannot have — the page
 * cannot disagree with the folders, because it is the folders.
 *
 * The technology register answers a platform organisation's own questions:
 * what does the platform team offer, what can my team leverage, who else uses
 * this, and which service is being offered without anybody having said so.
 * The services come first when ordered by kind, because they are what a team
 * asks for; the platforms are what delivers them this year.
 *
 * **It lives in `app/organisation/` and not in `projects/ui/`.** The index it
 * reads belongs to `projects`, and a page under `projects/ui/` would be the
 * first React in a module the import matrix keeps clear of it — `projects` may
 * not import React at all, which is what lets `scopeIndex`, `checks` and
 * `gestures` be tested in node with plain objects. The arithmetic is
 * `register.ts` beside this file and `projects/technologyRegister.ts`, pure
 * and tested the same way; this draws it.
 *
 * A full-window page like the others: it takes the window chrome, works in
 * both themes, and `readOnly` hides the one thing on it that writes — the
 * application register's *link*; the technology register has nothing that
 * writes at all.
 */
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
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
import type { StringKey, Translate } from '../../i18n'
import { PLATFORM_ARCHETYPE_LABEL } from '../../model'
import type { ElementId } from '../../model'
import { KIND_LABEL_KEYS } from '../../model/kinds'
import { CHECK_LABEL } from '../../projects/checks'
import type { Finding } from '../../projects/checks'
import type { ScopePath } from '../../projects/scopePath'
import { NO_WINDOW_CHROME, barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { PageDialog } from '../../widgets/PageDialog'
import { matchingTechnology, sortTechnology, technologySummary } from '../../projects/technologyRegister'
import type { TechnologyOrder, TechnologyRow, TechnologySummary } from '../../projects/technologyRegister'
import { isUnattributed, matchingRows, registerSummary, sortRows } from './register'
import type { RegisterRow, RegisterSummary } from './register'

type Open = (scope: ScopePath, id: ElementId) => void

/** What both pages are handed. */
type PageProps<R> = {
  open: boolean
  onClose: () => void
  /** Every row in the tree, with its findings. */
  rows: readonly R[]
  /** What the root is called on screen, since its path is the empty string. */
  organisation: string
  /**
   * Open the scope that answers for a row, with the element selected. Through
   * the shell's own open, never through the store: entering a scope is the
   * shell's act.
   */
  onOpen?: Open
  /**
   * Open the row's page — its record and its document — in the scope that
   * answers for it. The name is the way in, because a register is a list of
   * things to read about; *Open* beside it lands on the board instead.
   */
  onOpenPage?: Open
  s: Translate
  windowChrome?: WindowChrome
}

export type RegisterPageProps = PageProps<RegisterRow> & {
  /**
   * Resolve a conflict: open the scope that should yield, with *link* pending
   * (ADR-0012 §10). A gesture is applied by the session that holds the scope,
   * so asking for one from here is asking that session to ask.
   */
  onLink?: (scope: ScopePath, id: ElementId, to: ScopePath) => void
  readOnly?: boolean
}

export type TechnologyPageProps = PageProps<TechnologyRow>

/** Every application in the tree, with its findings (`register.ts`). */
export function RegisterPage(props: RegisterPageProps) {
  return <Register {...props} config={APPLICATIONS} />
}

/** Every service and platform in the tree, with its findings (`technologyRegister.ts`). */
export function TechnologyPage(props: TechnologyPageProps) {
  return <Register {...props} config={TECHNOLOGY} />
}

/** What every register row carries, whatever it lists. */
type Listed = {
  id: ElementId
  name: string
  master?: ScopePath
  outside?: true
  party?: string
  findings: readonly Finding[]
}

/** A number the page says, as its two plural keys and where it is read from. */
type Counted<Summary> = { one: StringKey; other: StringKey; of: (summary: Summary) => number }

type ChipLine = { key: string; text: string }

/**
 * What one register is: its words, its orders, its arithmetic, and the
 * columns between *answered for by* and *findings*, which are the only ones
 * that differ.
 */
type RegisterConfig<R extends Listed, Order extends string, Summary> = {
  /** The test-id prefix of the page's parts (`<page>-topbar`), and of a row's (`<row>-row-<id>`). */
  page: string
  row: string
  title: StringKey
  what: StringKey
  empty: StringKey
  noMatch: StringKey
  /** What the findings line says when there are none. */
  settled: StringKey
  nameColumn: StringKey
  maxWidth: number
  /** Set where the table is wide enough to scroll sideways rather than squeeze its findings off the page. */
  minWidth?: number
  /** Room after each cell, where the columns are many. */
  gutter?: number
  orders: readonly { value: Order; label: StringKey }[]
  order: Order
  summarise(rows: readonly R[]): Summary
  matching(rows: readonly R[], query: string): R[]
  sort(rows: readonly R[], order: Order): R[]
  /** The counts beside the title, always said. */
  counts: readonly Counted<Summary>[]
  /** The findings under the introduction, said where there are any. */
  findings: readonly Counted<Summary>[]
  columns: readonly { header: StringKey; cell(row: R, s: Translate, organisation: string): ReactNode }[]
  /** Beside the name, where the row says what sort of thing it is. */
  badge?(row: R, s: Translate): ReactNode
  /** Under the name, after who it belongs to. */
  note?(row: R, s: Translate): ReactNode
  /** Chips derived from the row rather than from a finding. */
  chips?(row: R, s: Translate): ChipLine[]
  /** The finding keys whose chip is a warning. */
  warning: ReadonlySet<string>
}

const APPLICATIONS: RegisterConfig<RegisterRow, 'name' | 'scope', RegisterSummary> = {
  page: 'register',
  row: 'register',
  title: 'register.title',
  what: 'register.what',
  empty: 'register.empty',
  noMatch: 'register.noMatch',
  settled: 'register.settled',
  nameColumn: 'register.colName',
  maxWidth: 1080,
  orders: [
    { value: 'name', label: 'register.byName' },
    { value: 'scope', label: 'register.byScope' },
  ],
  order: 'name',
  summarise: registerSummary,
  matching: matchingRows,
  sort: sortRows,
  counts: [
    { one: 'register.applicationsOne', other: 'register.applicationsOther', of: (summary) => summary.applications },
    { one: 'register.ownedOne', other: 'register.ownedOther', of: (summary) => summary.ownedByADomain },
    { one: 'register.outsideOne', other: 'register.outsideOther', of: (summary) => summary.outside },
  ],
  findings: [
    { one: 'register.definedTwiceOne', other: 'register.definedTwiceOther', of: (summary) => summary.definedTwice },
    { one: 'register.unattributedOne', other: 'register.unattributedOther', of: (summary) => summary.unattributed },
    { one: 'register.staleOne', other: 'register.staleOther', of: (summary) => summary.stale },
  ],
  columns: [
    {
      header: 'register.colDrawn',
      cell: (row, s, organisation) => (row.drawnIn.length === 0 ? (
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('register.drawnNowhere')}</Typography>
      ) : (
        <Tooltip title={row.drawnIn.map((path) => path || organisation).join(' · ')}>
          <Typography sx={{ fontSize: 12, cursor: 'default' }}>
            {plural(s, { one: 'register.drawnOne', other: 'register.drawnOther' }, row.drawnIn.length)}
          </Typography>
        </Tooltip>
      )),
    },
  ],
  // Derived from the record rather than from a scope's document findings: the
  // register is about the whole tree, and the index carries both halves (§9).
  chips: (row, s) => (isUnattributed(row)
    ? [{ key: 'check.unattributed', text: s(CHECK_LABEL['check.unattributed'], { name: row.name, scope: '', count: 0 }) }]
    : []),
  warning: new Set(['check.conflict']),
}

const quiet = { fontSize: 12, color: 'text.secondary' } as const
const names = (held: readonly { name: string }[]) => held.map((one) => one.name).join(', ')
const isService = (row: TechnologyRow) => row.kind === 'platformService'

const TECHNOLOGY: RegisterConfig<TechnologyRow, TechnologyOrder, TechnologySummary> = {
  page: 'technology-register',
  row: 'technology',
  title: 'techRegister.title',
  what: 'techRegister.what',
  empty: 'techRegister.empty',
  noMatch: 'techRegister.noMatch',
  settled: 'techRegister.settled',
  nameColumn: 'techRegister.colName',
  maxWidth: 1180,
  // Eight columns: at half a screen the table scrolls sideways rather than
  // pushing its findings column off the page.
  minWidth: 960,
  gutter: 1.5,
  orders: [
    { value: 'kind', label: 'techRegister.byKind' },
    { value: 'name', label: 'register.byName' },
    { value: 'scope', label: 'register.byScope' },
  ],
  order: 'kind',
  summarise: technologySummary,
  matching: matchingTechnology,
  sort: sortTechnology,
  counts: [
    { one: 'techRegister.servicesOne', other: 'techRegister.servicesOther', of: (summary) => summary.services },
    { one: 'techRegister.platformsOne', other: 'techRegister.platformsOther', of: (summary) => summary.platforms },
    { one: 'techRegister.sharedOne', other: 'techRegister.sharedOther', of: (summary) => summary.shared },
  ],
  findings: [
    { one: 'techRegister.offeredOne', other: 'techRegister.offeredOther', of: (summary) => summary.offeredNotShared },
    { one: 'techRegister.unrealisedOne', other: 'techRegister.unrealisedOther', of: (summary) => summary.unrealised },
    { one: 'register.definedTwiceOne', other: 'register.definedTwiceOther', of: (summary) => summary.definedTwice },
    { one: 'register.staleOne', other: 'register.staleOther', of: (summary) => summary.stale },
  ],
  columns: [
    {
      header: 'techRegister.colWho',
      cell: (row, s) => (
        <Typography sx={quiet} data-testid={`technology-who-${row.id}`}>
          {isService(row)
            ? (row.maintainers.length ? names(row.maintainers) : s('techRegister.nobodyMaintains'))
            : [
              row.maintainers.length ? names(row.maintainers) : '',
              row.partOf ? s('techRegister.partOf', { name: row.partOf.name }) : '',
            ].filter(Boolean).join(' · ')}
        </Typography>
      ),
    },
    {
      header: 'techRegister.colShared',
      cell: (row, s) => isService(row) && (
        <Typography sx={quiet} data-testid={`technology-shared-${row.id}`}>
          {row.shared ? s('techRegister.shared') : s('techRegister.ownTeam')}
        </Typography>
      ),
    },
    {
      header: 'techRegister.colUse',
      cell: (row, s) => (
        <Typography sx={quiet} data-testid={`technology-use-${row.id}`}>
          {isService(row)
            ? [
              plural(s, { one: 'register.applicationsOne', other: 'register.applicationsOther' }, row.consumers.applications),
              plural(s, { one: 'register.drawnOne', other: 'register.drawnOther' }, row.consumers.scopes),
            ].join(' · ')
            : plural(s, { one: 'techRegister.hostsOne', other: 'techRegister.hostsOther' }, row.hosts)}
        </Typography>
      ),
    },
    {
      header: 'techRegister.colRealised',
      cell: (row, s) => (
        <Typography sx={quiet} data-testid={`technology-realised-${row.id}`}>
          {isService(row)
            ? (row.realisedBy.length ? names(row.realisedBy) : s('techRegister.unrealised'))
            : (row.realises.length ? names(row.realises) : s('techRegister.realisesNothing'))}
        </Typography>
      ),
    },
  ],
  badge: (row, s) => (
    <Chip
      size="small"
      variant={isService(row) ? 'filled' : 'outlined'}
      label={isService(row) ? s(KIND_LABEL_KEYS.platformService) : s(PLATFORM_ARCHETYPE_LABEL[row.platformArchetype ?? 'service'])}
      sx={{ height: 18, fontSize: 10 }}
    />
  ),
  note: (row, s) => !isService(row) && row.service && (
    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{s('techRegister.forService', { name: row.service.name })}</Typography>
  ),
  warning: new Set(['check.conflict', 'check.offeredNotShared']),
}

function Register<R extends Listed, Order extends string, Summary>(props: PageProps<R> & {
  config: RegisterConfig<R, Order, Summary>
  onLink?: RegisterPageProps['onLink']
  readOnly?: boolean
}) {
  const { config, open, onClose, rows, organisation, onOpen, onOpenPage, onLink, readOnly = false, s } = props
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const bar = barChromeFor(chrome)
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState<Order>(config.order)

  const shown = useMemo(
    () => config.sort(config.matching(rows, query), order),
    [config, rows, query, order],
  )
  const summary = useMemo(() => config.summarise(rows), [config, rows])
  const label = (path: ScopePath | undefined) => (
    path === undefined ? s('register.nobody') : path || organisation
  )

  const counts = config.counts.map((count) => plural(s, count, count.of(summary))).join(' · ')

  const table = (
    <Box
      component="table"
      data-testid={`${config.page}-table`}
      sx={{ width: '100%', minWidth: config.minWidth, borderCollapse: 'collapse', fontSize: 13 }}
    >
      <Box component="thead">
        <Box component="tr" sx={{ '& th': { textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'text.secondary', borderBottom: 1, borderColor: 'divider', py: 0.75, textTransform: 'uppercase', letterSpacing: 0.6 } }}>
          <Box component="th">{s(config.nameColumn)}</Box>
          <Box component="th">{s('register.colMaster')}</Box>
          {config.columns.map((column) => <Box component="th" key={column.header}>{s(column.header)}</Box>)}
          <Box component="th">{s('register.colFindings')}</Box>
          <Box component="th" />
        </Box>
      </Box>
      <Box component="tbody">
        {shown.map((row) => (
          <Row
            key={row.id}
            config={config}
            row={row}
            label={label}
            organisation={organisation}
            onOpen={onOpen}
            onOpenPage={onOpenPage}
            onLink={readOnly ? undefined : onLink}
            s={s}
          />
        ))}
      </Box>
    </Box>
  )

  return (
    <PageDialog open={open} topInset={chrome.topInset} onClose={onClose} aria-label={s(config.title)}>
      <Box
        data-testid={`${config.page}-topbar`}
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
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{s(config.title)}</Typography>
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
          onChange={(_e, next: Order | null) => { if (next) setOrder(next) }}
          aria-label={s('register.order')}
        >
          {config.orders.map((one) => (
            <ToggleButton key={one.value} value={one.value} sx={{ fontSize: 11, py: 0.25, px: 1 }}>
              {s(one.label)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 3, py: 2 }}>
        <Box sx={{ maxWidth: config.maxWidth, mx: 'auto' }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
            {s(config.what)}
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2 }} data-testid={`${config.page}-findings`}>
            {findingLine(config, summary, s)}
          </Typography>

          {rows.length === 0 && (
            <Typography sx={{ fontSize: 13 }}>{s(config.empty)}</Typography>
          )}
          {rows.length > 0 && shown.length === 0 && (
            <Typography sx={{ fontSize: 13 }}>{s(config.noMatch, { query: query.trim() })}</Typography>
          )}

          {shown.length > 0 && (config.minWidth === undefined ? table : <Box sx={{ overflowX: 'auto' }}>{table}</Box>)}
        </Box>
      </Box>
    </PageDialog>
  )
}

/** "1 defined twice · 2 outside and unattributed", or that there is nothing. */
function findingLine<Summary>(
  config: { findings: readonly Counted<Summary>[]; settled: StringKey },
  summary: Summary,
  s: Translate,
): string {
  const parts = config.findings
    .map((finding) => {
      const count = finding.of(summary)
      return count > 0 ? plural(s, finding, count) : ''
    })
    .filter(Boolean)
  return parts.length ? parts.join(' · ') : s(config.settled)
}

function Row<R extends Listed, Order extends string, Summary>({ config, row, label, organisation, onOpen, onOpenPage, onLink, s }: {
  config: RegisterConfig<R, Order, Summary>
  row: R
  label: (path: ScopePath | undefined) => string
  organisation: string
  onOpen?: Open
  onOpenPage?: Open
  onLink?: RegisterPageProps['onLink']
  s: Translate
}) {
  const prefix = config.row
  const conflict = row.findings.find((finding) => finding.key === 'check.conflict')
  const chips: ChipLine[] = row.findings.map((finding) => ({
    key: finding.key,
    text: s(CHECK_LABEL[finding.key], {
      name: finding.name,
      scope: label(finding.scopes?.[0]),
      detail: finding.detail ?? '',
      count: 0,
    }),
  }))
  if (config.chips) chips.push(...config.chips(row, s))

  const name = onOpenPage && row.master !== undefined ? (
    <Tooltip title={s('register.pageRow', { name: row.name })}>
      <Typography
        component="button"
        type="button"
        data-testid={`${prefix}-page-${row.id}`}
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
  )

  return (
    <Box
      component="tr"
      data-testid={`${prefix}-row-${row.id}`}
      sx={{
        '& td': {
          borderBottom: 1, borderColor: 'divider', py: 0.75, verticalAlign: 'top',
          ...(config.gutter !== undefined ? { pr: config.gutter } : {}),
        },
      }}
    >
      <Box component="td">
        {config.badge ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            {name}
            {config.badge(row, s)}
          </Box>
        ) : name}
        {row.outside && (
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {row.party !== undefined
              ? s('register.outsideParty', { name: row.party })
              : s('register.outsideUnattributed')}
          </Typography>
        )}
        {config.note?.(row, s)}
      </Box>
      <Box component="td">
        <Typography sx={{ fontSize: 12 }} data-testid={`${prefix}-master-${row.id}`}>
          {label(row.master)}
        </Typography>
      </Box>
      {config.columns.map((column) => (
        <Box component="td" key={column.header}>{column.cell(row, s, organisation)}</Box>
      ))}
      <Box component="td">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              size="small"
              color={config.warning.has(chip.key) ? 'warning' : 'default'}
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
              data-testid={`${prefix}-open-${row.id}`}
              onClick={() => onOpen(row.master!, row.id)}
            >
              {s('picker.open')}
            </Button>
          </Tooltip>
        )}
        {/* A conflict is two definitions at the same depth, and *link* is how
            one of them stops being one. Offered on the OTHER scope — the one
            the index did not make the master — because that is the record
            that yields. */}
        {onLink && conflict && conflict.scopes?.[0] !== undefined && (
          <Tooltip title={s('register.linkRowTip', { scope: label(conflict.scopes[0]) })}>
            <Button
              size="small"
              color="inherit"
              sx={{ fontSize: 11, minWidth: 0, px: 1 }}
              data-testid={`${prefix}-link-${row.id}`}
              onClick={() => onLink(conflict.scopes![0], row.id, conflict.scope)}
            >
              {s('register.linkRow')}
            </Button>
          </Tooltip>
        )}
      </Box>
    </Box>
  )
}
