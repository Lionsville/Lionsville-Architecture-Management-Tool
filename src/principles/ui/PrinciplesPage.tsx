// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's principles (ADR-0041): one quiet line per principle, grouped in
 * the order the scope keeps, with the regime in words; then the principles in
 * force here from the scopes above and from the topics relevant here, each
 * under where it comes from. The reader on the right shows one.
 *
 * A page over a home, reached from its card, never the first view: its script
 * arrives when it is first opened.
 */
import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import ListItemButton from '@mui/material/ListItemButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import { matchesQuery } from '../../model/textSearch'
import { barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { PageDialog } from '../../widgets/PageDialog'
import { SearchIcon } from '../../widgets/icons'
import { PageClose } from '../../widgets/PageClose'
import { SeamResizer } from '../../widgets/SeamResizer'
import { useSeamWidth } from '../../widgets/useSeamWidth'
import { formatAspectNumber, formatPrincipleNumber, groupedPrinciples, PRINCIPLE_STATUSES } from '../principle'
import type { Principle, PrincipleGroup, PrincipleRef, PrincipleStatus } from '../principle'
import type { PrincipleInForce } from '../suggest'
import { GroupsDialog } from './GroupsDialog'
import { PrincipleEditor } from './PrincipleEditor'
import { PrincipleReader } from './PrincipleReader'
import { usePrinciples } from './PrinciplesContext'
import type { PrinciplesAccess } from './PrinciplesContext'
import { REGIME_WORD, STATUS_WORD } from './words'

export type PrinciplesPageProps = {
  open: boolean
  onClose: () => void
  /** The scope whose principles these are: the one open. */
  scope: string
  /** A principle of the scope to pick when the page opens, by id. */
  select?: string
  /** The request's number: asking for the same principle again is a new request. */
  nonce?: number
  windowChrome: WindowChrome
}

const MONO = { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' } as const

/** A principle's words, for the search: its number, its aspects' numbers, its words and keywords. */
function searchTerms(principle: Principle): string[] {
  return [
    formatPrincipleNumber(principle.number), principle.title, principle.statement, ...(principle.keywords ?? []),
    ...principle.aspects.flatMap((one) => [formatAspectNumber(principle.number, one.number), one.text]),
  ]
}

export function PrinciplesPage({ open, onClose, scope, select, nonce, windowChrome }: PrinciplesPageProps) {
  const access = usePrinciples()
  const { t } = useStrings()
  const bar = barChromeFor(windowChrome)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<PrincipleStatus | 'all'>('all')
  const [picked, setPicked] = useState<PrincipleRef | undefined>(undefined)
  const [editing, setEditing] = useState<{ principle?: Principle; scope: string } | undefined>(undefined)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [listWidth, setListWidth] = useSeamWidth('principles.list', 400)
  useEffect(() => {
    if (open && select) setPicked({ scope, id: select })
  }, [open, select, scope, nonce])
  const version = access?.version ?? 0
  const own = useMemo(() => access?.own(scope) ?? { principles: [], groups: [] }, [access, scope, version])
  const inForce = useMemo(() => access?.inForce(scope) ?? [], [access, scope, version])
  if (!access) return null
  const keep = (principle: Principle) => (status === 'all' ? principle.status !== 'retired' || query.trim() !== '' : principle.status === status)
    && matchesQuery(query, searchTerms(principle))
  const ownShown = own.principles.filter(keep)
  const sections = groupedPrinciples(ownShown, own.groups)
  const elsewhere = otherSources(access, scope, inForce.filter((one) => one.scope !== scope && keep(one.principle)))
  const current = picked ? access.find(picked) : undefined
  const first = current ?? (sections[0]?.principles[0] ? { scope, principle: sections[0].principles[0], groups: own.groups } : undefined)
  const label = access.scopeLabel(scope)
  return (
    <PageDialog open={open} topInset={windowChrome.topInset} onClose={onClose} aria-label={t('principles.title')}>
      <Box
        data-testid="principles-topbar"
        sx={{
          display: 'flex', flexWrap: 'wrap', rowGap: 0.5, alignItems: 'center', gap: 1, px: 1.5, pl: `${12 + bar.controlsInset}px`,
          WebkitAppRegion: bar.draggable ? 'drag' : undefined, '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
          minHeight: 48, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0,
        }}
      >
        <Tooltip title={t('common.close')}>
          <IconButton size="small" aria-label={t('common.close')} onClick={onClose}>
            <Box component="span" aria-hidden sx={{ display: 'inline-block', width: 18, textAlign: 'center', fontSize: 16, lineHeight: 1 }}>‹</Box>
          </IconButton>
        </Tooltip>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{t('principles.title')}</Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{label}</Typography>
        <Box sx={{ flex: 1 }} />
        <TextField
          size="small" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('principles.search')}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon size={14} /></InputAdornment> }, htmlInput: { 'aria-label': t('principles.search'), 'data-testid': 'principles-search' } }}
          sx={{ width: 220, '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }}
        />
        <TextField
          select size="small" value={status} onChange={(event) => setStatus(event.target.value as PrincipleStatus | 'all')}
          label={t('principles.statusFilter')} sx={{ width: 150, '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }}
          slotProps={{ htmlInput: { 'data-testid': 'principles-status' } }}
        >
          <MenuItem value="all">{t('principles.statusAll')}</MenuItem>
          {PRINCIPLE_STATUSES.map((one) => <MenuItem key={one} value={one}>{t(STATUS_WORD[one])}</MenuItem>)}
        </TextField>
        {access.mayWrite(scope) && (
          <>
            <Button size="small" onClick={() => setGroupsOpen(true)} data-testid="principles-groups">{t('principles.manageGroups')}</Button>
            <Button size="small" variant="contained" onClick={() => setEditing({ scope })} data-testid="principles-new" data-guide="principles.new">{t('principles.new')}</Button>
          </>
        )}
        <PageClose onClose={onClose} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: `${listWidth}px auto minmax(0, 1fr)`, flex: 1, minHeight: 0 }}>
        <Box sx={{ overflow: 'auto', bgcolor: 'background.paper' }} data-testid="principles-list">
          {sections.length === 0 && elsewhere.length === 0 && (
            <Typography sx={{ p: 2, fontSize: 13, color: 'text.secondary' }}>
              {query.trim() ? t('principles.searchEmpty', { query }) : t('principles.empty')}
            </Typography>
          )}
          {sections.map(({ group, principles }) => (
            <Section key={group?.id ?? '-'} heading={group?.name ?? t('principles.ungrouped')}>
              {principles.map((principle) => (
                <Line key={principle.id} principle={principle} selected={first?.scope === scope && first.principle.id === principle.id} onPick={() => setPicked({ scope, id: principle.id })} />
              ))}
            </Section>
          ))}
          {elsewhere.map(({ heading, items }) => (
            <Section key={heading} heading={heading} quiet>
              {items.map((one) => (
                <Line key={`${one.scope}/${one.principle.id}`} principle={one.principle} selected={first?.scope === one.scope && first.principle.id === one.principle.id} onPick={() => setPicked({ scope: one.scope, id: one.principle.id })} />
              ))}
            </Section>
          ))}
        </Box>
        <SeamResizer orientation="vertical" region="before" value={listWidth} min={260} max={720} defaultValue={400} onChange={setListWidth} label={t('common.resizeColumn')} />
        <Box sx={{ overflow: 'auto', minWidth: 0 }}>
          {first ? (
            <PrincipleReader
              key={`${first.scope}/${first.principle.id}`}
              found={first}
              here={scope}
              onEdit={() => setEditing({ principle: first.principle, scope: first.scope })}
              onPick={(ref) => setPicked(ref)}
            />
          ) : (
            <Typography sx={{ p: 3, color: 'text.secondary', fontSize: 14 }}>{t('principles.noneSelected')}</Typography>
          )}
        </Box>
      </Box>
      {editing && (
        <PrincipleEditor
          open scope={editing.scope} {...(editing.principle ? { principle: editing.principle } : {})}
          onClose={(made) => { setEditing(undefined); if (made) setPicked({ scope: editing.scope, id: made }) }}
        />
      )}
      <GroupsDialog open={groupsOpen} scope={scope} onClose={() => setGroupsOpen(false)} />
    </PageDialog>
  )
}

/** The principles in force here from elsewhere, under where each comes from: the scopes above, nearest first, then the topics. */
function otherSources(access: PrinciplesAccess, here: string, list: readonly PrincipleInForce[]) {
  const by = new Map<string, PrincipleInForce[]>()
  for (const one of list) {
    const from = access.sourceOf(here, one.scope)
    // The section's heading, said by `Section`: where it comes from, and the scope.
    const heading = `${from.kind === 'topic' ? 'topic' : 'above'}\u0000${one.scope}`
    by.set(heading, [...(by.get(heading) ?? []), one])
  }
  return [...by.entries()].map(([heading, items]) => ({ heading, items: items.sort((a, b) => a.principle.number - b.principle.number) }))
}

function Section({ heading, quiet = false, children }: { heading: string; quiet?: boolean; children: React.ReactNode }) {
  const access = usePrinciples()
  const { t } = useStrings()
  const [kind, scope] = heading.includes('\u0000') ? heading.split('\u0000') as [string, string] : ['', '']
  const said = kind === 'topic'
    ? t('principles.fromTopicHeading', { scope: access?.scopeLabel(scope) ?? scope })
    : kind === 'above' ? t('principles.fromHeading', { scope: access?.scopeLabel(scope) ?? scope }) : heading
  return (
    <Box component="section" sx={{ pb: 0.5 }}>
      <Typography component="h2" sx={{ m: 0, px: 2, pt: 1.5, pb: 0.5, fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: quiet ? 'text.secondary' : 'text.primary' }}>
        {said}
      </Typography>
      {children}
    </Box>
  )
}

/** One quiet line: the number, the title, and the regime in words — or *Candidate* while it is one. */
function Line({ principle, selected, onPick }: { principle: Principle; selected: boolean; onPick: () => void }) {
  const { t } = useStrings()
  const retired = principle.status === 'retired'
  return (
    <ListItemButton selected={selected} onClick={onPick} data-testid={`principle-row-${principle.id}`} sx={{ py: 0.5, px: 2, gap: 1.5, color: retired ? 'text.secondary' : 'text.primary' }}>
      <Box component="span" sx={MONO}>{formatPrincipleNumber(principle.number)}</Box>
      <Box component="span" sx={{ flex: 1, fontSize: 13 }}>{principle.title}</Box>
      <Box component="span" sx={{ fontSize: 11, color: principle.status === 'candidate' ? 'info.main' : 'text.secondary', whiteSpace: 'nowrap' }}>
        {principle.status === 'accepted' ? t(REGIME_WORD[principle.regime]) : t(STATUS_WORD[principle.status])}
      </Box>
    </ListItemButton>
  )
}

export type { PrincipleGroup }
