/**
 * The register: every application in the organisation, on one page
 * (ADR-0012 §2, §9).
 *
 * **Derived, and nothing commits it.** There is no register file and no owner
 * field: every row here is a definition somewhere in the tree, keyed by id,
 * and every finding beside it is computed from the same index. What that buys
 * is the property a materialised list cannot have — the page cannot disagree
 * with the folders, because it is the folders.
 *
 * **It lives in `app/organisation/` and not in `projects/ui/`.** The index it
 * reads belongs to `projects`, and a page under `projects/ui/` would be the
 * first React in a module the import matrix keeps clear of it — `projects` may
 * not import React at all, which is what lets `scopeIndex`, `checks` and
 * `gestures` be tested in node with plain objects. The arithmetic is
 * `register.ts` beside this file, pure and tested the same way; this draws it.
 *
 * A full-window page like the others: it takes the window chrome, works in
 * both themes, and `readOnly` hides the one thing on it that writes.
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
import type { ElementId } from '../../model'
import { CHECK_LABEL } from '../../projects/checks'
import type { ScopePath } from '../../projects/scopePath'
import { NO_WINDOW_CHROME, barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { PageDialog } from '../../widgets/PageDialog'
import { isUnattributed, matchingRows, registerSummary, sortRows } from './register'
import type { RegisterRow } from './register'

export type RegisterPageProps = {
  open: boolean
  onClose: () => void
  /** Every application in the tree, with its findings (`register.ts`). */
  rows: readonly RegisterRow[]
  /** What the root is called on screen, since its path is the empty string. */
  organisation: string
  /**
   * Open the scope that answers for a row, with the element selected. Through
   * the shell's own open, never through the store: entering a scope is the
   * shell's act.
   */
  onOpen?: (scope: ScopePath, id: ElementId) => void
  /**
   * Resolve a conflict: open the scope that should yield, with *link* pending
   * (ADR-0012 §10). A gesture is applied by the session that holds the scope,
   * so asking for one from here is asking that session to ask.
   */
  onLink?: (scope: ScopePath, id: ElementId, to: ScopePath) => void
  readOnly?: boolean
  s: Translate
  windowChrome?: WindowChrome
}

export function RegisterPage(props: RegisterPageProps) {
  const { open, onClose, rows, organisation, onOpen, onLink, readOnly = false, s } = props
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const bar = barChromeFor(chrome)
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState<'name' | 'scope'>('name')

  const shown = useMemo(
    () => sortRows(matchingRows(rows, query), order),
    [rows, query, order],
  )
  const summary = useMemo(() => registerSummary(rows), [rows])
  const label = (path: ScopePath | undefined) => (
    path === undefined ? s('register.nobody') : path || organisation
  )

  const counts = [
    plural(s, { one: 'register.applicationsOne', other: 'register.applicationsOther' }, summary.applications),
    plural(s, { one: 'register.ownedOne', other: 'register.ownedOther' }, summary.ownedByADomain),
    plural(s, { one: 'register.outsideOne', other: 'register.outsideOther' }, summary.outside),
  ].join(' · ')

  return (
    <PageDialog open={open} topInset={chrome.topInset} onClose={onClose} aria-label={s('register.title')}>
      <Box
        data-testid="register-topbar"
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
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{s('register.title')}</Typography>
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
          onChange={(_e, next: 'name' | 'scope' | null) => { if (next) setOrder(next) }}
          aria-label={s('register.order')}
        >
          <ToggleButton value="name" sx={{ fontSize: 11, py: 0.25, px: 1 }}>
            {s('register.byName')}
          </ToggleButton>
          <ToggleButton value="scope" sx={{ fontSize: 11, py: 0.25, px: 1 }}>
            {s('register.byScope')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 3, py: 2 }}>
        <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
            {s('register.what')}
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2 }} data-testid="register-findings">
            {findingLine(summary, s)}
          </Typography>

          {rows.length === 0 && (
            <Typography sx={{ fontSize: 13 }}>{s('register.empty')}</Typography>
          )}
          {rows.length > 0 && shown.length === 0 && (
            <Typography sx={{ fontSize: 13 }}>{s('register.noMatch', { query: query.trim() })}</Typography>
          )}

          {shown.length > 0 && (
            <Box
              component="table"
              data-testid="register-table"
              sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
            >
              <Box component="thead">
                <Box component="tr" sx={{ '& th': { textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'text.secondary', borderBottom: 1, borderColor: 'divider', py: 0.75, textTransform: 'uppercase', letterSpacing: 0.6 } }}>
                  <Box component="th">{s('register.colName')}</Box>
                  <Box component="th">{s('register.colMaster')}</Box>
                  <Box component="th">{s('register.colDrawn')}</Box>
                  <Box component="th">{s('register.colFindings')}</Box>
                  <Box component="th" />
                </Box>
              </Box>
              <Box component="tbody">
                {shown.map((row) => (
                  <Row
                    key={row.id}
                    row={row}
                    label={label}
                    organisation={organisation}
                    onOpen={onOpen}
                    onLink={readOnly ? undefined : onLink}
                    s={s}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </PageDialog>
  )
}

/** "1 defined twice · 2 outside and unattributed", or that there is nothing. */
function findingLine(summary: ReturnType<typeof registerSummary>, s: Translate): string {
  const parts = [
    summary.definedTwice > 0
      ? plural(s, { one: 'register.definedTwiceOne', other: 'register.definedTwiceOther' }, summary.definedTwice)
      : '',
    summary.unattributed > 0
      ? plural(s, { one: 'register.unattributedOne', other: 'register.unattributedOther' }, summary.unattributed)
      : '',
    summary.stale > 0
      ? plural(s, { one: 'register.staleOne', other: 'register.staleOther' }, summary.stale)
      : '',
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : s('register.settled')
}

function Row({ row, label, organisation, onOpen, onLink, s }: {
  row: RegisterRow
  label: (path: ScopePath | undefined) => string
  organisation: string
  onOpen?: (scope: ScopePath, id: ElementId) => void
  onLink?: (scope: ScopePath, id: ElementId, to: ScopePath) => void
  s: Translate
}) {
  const conflict = row.findings.find((finding) => finding.key === 'check.conflict')
  const chips: { key: string; text: string }[] = row.findings.map((finding) => ({
    key: finding.key,
    text: s(CHECK_LABEL[finding.key], {
      name: finding.name,
      scope: label(finding.scopes?.[0]),
      count: 0,
    }),
  }))
  // Derived from the record rather than from a scope's document findings: the
  // register is about the whole tree, and the index carries both halves (§9).
  if (isUnattributed(row)) {
    chips.push({ key: 'check.unattributed', text: s(CHECK_LABEL['check.unattributed'], { name: row.name, scope: '', count: 0 }) })
  }

  return (
    <Box
      component="tr"
      data-testid={`register-row-${row.id}`}
      sx={{ '& td': { borderBottom: 1, borderColor: 'divider', py: 0.75, verticalAlign: 'top' } }}
    >
      <Box component="td">
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{row.name}</Typography>
        {row.outside && (
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {row.party !== undefined
              ? s('register.outsideParty', { name: row.party })
              : s('register.outsideUnattributed')}
          </Typography>
        )}
      </Box>
      <Box component="td">
        <Typography sx={{ fontSize: 12 }} data-testid={`register-master-${row.id}`}>
          {label(row.master)}
        </Typography>
      </Box>
      <Box component="td">
        {row.drawnIn.length === 0 ? (
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('register.drawnNowhere')}</Typography>
        ) : (
          <Tooltip title={row.drawnIn.map((path) => path || organisation).join(' · ')}>
            <Typography sx={{ fontSize: 12, cursor: 'default' }}>
              {plural(s, { one: 'register.drawnOne', other: 'register.drawnOther' }, row.drawnIn.length)}
            </Typography>
          </Tooltip>
        )}
      </Box>
      <Box component="td">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              size="small"
              color={chip.key === 'check.conflict' ? 'warning' : 'default'}
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
              data-testid={`register-open-${row.id}`}
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
              data-testid={`register-link-${row.id}`}
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
