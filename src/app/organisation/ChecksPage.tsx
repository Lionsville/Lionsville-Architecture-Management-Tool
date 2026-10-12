// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The Checks page: every check the app makes, over a home (ADR-0036,
 * amended 11 October 2026; scene 9 of the operating model's structure).
 *
 * Each list of findings in the app shows what is found where a person is; this
 * page shows the checks themselves. **Every check, by category** — the
 * landscape, plans and dates, the organisation, teams and systems, analysis —
 * with its weight's mark, its name and how many are found, none included,
 * because a check that finds nothing is still worth knowing about. Fix before
 * review before note within a category; the notes hidden until asked for, as
 * in every list (`sessionMemory.ts`: for the session, under the home).
 *
 * **Picking a check** shows what the catalogue says of it — why it matters and
 * how to fix it — then every instance found at or under this home, each in its
 * scope and opening where it is fixed, and the ones marked as intended, each
 * with its reason, its day and *Take back*. A review or a note may be marked
 * from here as from any list; a fix may not, and the page says why.
 *
 * What only an open scope can work out is not counted here
 * (`treeChecks.FOUND_WHERE_OPEN`): the check is listed with its explanation
 * and a line saying where it is found.
 *
 * A full-window page over the home, as the registers are: below the home's bar,
 * window chrome on its own bar, both themes, and nothing on it that writes but
 * a mark — which the marking handed down decides (`checkMarking.tsx`) — and
 * *Remove the assignment* on one whose unit is not there: no screen of the
 * unit is left to fix it from (ADR-0036, amended 12 October 2026).
 */
import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import { CHECK_ACTION_LABEL, CHECK_CATEGORY_LABEL, CHECK_LIST_WORDS, CHECK_WEIGHT_LABEL, CHECK_WEIGHTS } from '../../model/checkCatalogue'
import type { CheckCategory, CheckKey, CheckWeight } from '../../model/checkCatalogue'
import { CHECK_MARK_WORDS, checkMarkId } from '../../model/checkMarks'
import type { ScopePath } from '../../projects/scopePath'
import { barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { AcceptedFindings, MarkAsIntended } from '../../widgets/FindingMarks'
import { WEIGHT_MARK } from '../../widgets/FindingsList'
import { PageDialog } from '../../widgets/PageDialog'
import { useSessionSet } from '../../widgets/sessionMemory'
import { useCheckMarking } from '../checkMarking'
import type { CheckMarking } from '../checkMarking'
import { weightCount } from './NeedsAttention'
import type { CheckInstance, CheckPlace, CheckRow } from './treeChecks'

export type ChecksPageProps = {
  open: boolean
  onClose: () => void
  /** Every check by category, with what is found of it and what was marked (`treeChecks.checksByCategory`). */
  rows: readonly { category: CheckCategory; rows: readonly CheckRow[] }[]
  /** What is found, by weight: the bar's line. */
  counts: Readonly<Record<CheckWeight, number>>
  /** What the page was asked to pick — a check's key — by a count on the home or by an agent. */
  request?: { readonly select?: string } | undefined
  /** Where the session keeps the weights shown: the home's. */
  remember: string
  scopeName: (path: ScopePath) => string
  /** Go where an instance is fixed. */
  onGo: (place: CheckPlace) => void
  s: Translate
  windowChrome: WindowChrome
}

/** The set's own word that the person chose the weights: until then, fix and review. */
const CHOSEN = 'chosen'
const SHOWN_FIRST: readonly CheckWeight[] = ['fix', 'review']

const QUIET = { fontSize: 12, color: 'text.secondary' } as const
/** Read by a screen reader and nobody else; in pixels, because a width of 1 is all of it to the theme. */
const HIDDEN = {
  border: 0, clip: 'rect(0 0 0 0)', height: '1px', margin: '-1px', overflow: 'hidden', padding: 0, position: 'absolute', whiteSpace: 'nowrap', width: '1px',
} as const
const HEADING = { fontSize: 12, fontWeight: 700, color: 'text.secondary', mt: 1.5, mb: 0.25 } as const

/** The weights shown, kept for the session: fix and review until the person chooses. */
function useWeightsShown(remember: string): [readonly CheckWeight[], (next: readonly CheckWeight[]) => void] {
  const [held, setHeld] = useSessionSet(remember)
  const shown = held.has(CHOSEN) ? CHECK_WEIGHTS.filter((weight) => held.has(weight)) : SHOWN_FIRST
  return [shown, (next) => setHeld(new Set([CHOSEN, ...next]))]
}

export function ChecksPage(props: ChecksPageProps) {
  const { rows, counts, request, s } = props
  const marking = useCheckMarking()
  const [shown, setShown] = useWeightsShown(props.remember)
  const every = useMemo(() => rows.flatMap((one) => one.rows), [rows])
  const [picked, setPicked] = useState<CheckKey | undefined>(undefined)
  // Asked for a check: that one, with its weight shown.
  useEffect(() => {
    const asked = every.find((row) => row.key === request?.select)
    if (!asked) return
    setPicked(asked.key)
    if (!shown.includes(asked.entry.weight)) setShown([...shown, asked.entry.weight])
    // Only on a request: the weights changing must not pick the asked one again.
  }, [request, every])
  const visible = every.filter((row) => shown.includes(row.entry.weight))
  const current = every.find((row) => row.key === picked) ?? visible.find((row) => row.shown.length > 0) ?? visible[0]
  const chrome = props.windowChrome
  const bar = barChromeFor(chrome)
  return (
    <PageDialog open={props.open} topInset={chrome.topInset} onClose={props.onClose} aria-label={s('checks.title')}>
      <Box
        data-testid="checks-topbar"
        sx={{
          display: 'flex', flexWrap: 'wrap', rowGap: 0.5, alignItems: 'center', gap: 1, px: 1.5, pl: `${12 + bar.controlsInset}px`,
          WebkitAppRegion: bar.draggable ? 'drag' : undefined, '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
          minHeight: 48, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0,
        }}
      >
        <Tooltip title={s('common.close')}>
          <IconButton size="small" aria-label={s('common.close')} onClick={props.onClose}>
            <Box component="span" aria-hidden sx={{ display: 'inline-block', width: 18, textAlign: 'center', fontSize: 16, lineHeight: 1 }}>‹</Box>
          </IconButton>
        </Tooltip>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{s('checks.title')}</Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }} data-testid="checks-counts">{countsLine(counts, s)}</Typography>
        <Box sx={{ flex: 1 }} />
        <ToggleButtonGroup size="small" value={shown} onChange={(_event, next: CheckWeight[]) => setShown(next)} aria-label={s('checks.show')}>
          {CHECK_WEIGHTS.map((weight) => (
            <ToggleButton key={weight} value={weight} data-guide="checks.weight" data-testid={`checks-weight-${weight}`} sx={{ fontSize: 11, py: 0.25, px: 1, gap: 0.5, textTransform: 'none' }}>
              <Box component="span" aria-hidden sx={{ fontSize: 10, ...WEIGHT_MARK[weight].sx }}>{WEIGHT_MARK[weight].glyph}</Box>
              {s(CHECK_WEIGHT_LABEL[weight].name)} ({counts[weight]})
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: { xs: 2, sm: 3 }, py: 2 }}>
        <Box sx={{ maxWidth: 1180, mx: 'auto', display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start' }}>
          <Box component="section" aria-label={s('checks.title')} sx={{ flex: '1 1 420px', minWidth: 0 }}>
            <Typography sx={{ ...QUIET, mb: 1 }}>{s('checks.what')}</Typography>
            {visible.length === 0 && <Typography sx={{ fontSize: 13 }}>{s('checks.noneShown')}</Typography>}
            {rows.map(({ category, rows: some }) => {
              const here = some.filter((row) => shown.includes(row.entry.weight))
              return here.length === 0 ? null : (
                <Box key={category} sx={{ mb: 2 }}>
                  <Typography component="h2" sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.5 }}>
                    {s(CHECK_CATEGORY_LABEL[category])}
                  </Typography>
                  <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                    {here.map((row) => <CheckLine key={row.key} row={row} picked={row.key === current?.key} onPick={() => setPicked(row.key)} s={s} />)}
                  </Box>
                </Box>
              )
            })}
          </Box>
          <Box component="aside" aria-live="polite" sx={{ flex: '1 1 340px', maxWidth: { md: 480 }, minWidth: 0, position: { md: 'sticky' }, top: 0 }}>
            {current && <CheckDetail row={current} marking={marking} scopeName={props.scopeName} onGo={props.onGo} s={s} />}
          </Box>
        </Box>
      </Box>
    </PageDialog>
  )
}

/** "3 to fix · 31 to review · 44 notes", or that nothing is found. */
function countsLine(counts: Readonly<Record<CheckWeight, number>>, s: Translate): string {
  const parts = CHECK_WEIGHTS.filter((weight) => counts[weight] > 0).map((weight) => weightCount(weight, counts[weight], s))
  return parts.length > 0 ? parts.join(' · ') : s('checks.nothing')
}

/** One check's row: its weight's mark, its name and how many are found — or that it is not counted here. */
function CheckLine({ row, picked, onPick, s }: { row: CheckRow; picked: boolean; onPick: () => void; s: Translate }) {
  const { weight } = row.entry
  return (
    <Box component="li" sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <ButtonBase
        onClick={onPick} aria-pressed={picked} data-guide="checks.row" data-testid={`checks-row-${row.key}`} data-check={row.key}
        sx={{
          display: 'flex', alignItems: 'baseline', gap: 0.75, width: '100%', justifyContent: 'flex-start', textAlign: 'left', py: 0.75, px: 0.75,
          fontSize: 13, borderRadius: 1, bgcolor: picked ? 'action.selected' : undefined, '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Box component="span" aria-hidden sx={{ width: 14, textAlign: 'center', fontSize: 11, flex: 'none', ...WEIGHT_MARK[weight].sx }}>{WEIGHT_MARK[weight].glyph}</Box>
        <Box component="span" sx={HIDDEN}>{s(CHECK_WEIGHT_LABEL[weight].name)}</Box>
        <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{s(row.entry.name)}</Box>
        {row.counted
          ? <Box component="span" sx={{ flex: 'none', color: row.shown.length > 0 ? 'text.primary' : 'text.secondary' }}>{row.shown.length}</Box>
          : <Box component="span" title={s('checks.notCounted')} sx={{ flex: 'none', color: 'text.secondary' }}><span aria-hidden>–</span><Box component="span" sx={HIDDEN}>{s('checks.notCounted')}</Box></Box>}
      </ButtonBase>
    </Box>
  )
}

/** The check picked: what the catalogue says of it, where it is found, and what was marked as intended. */
function CheckDetail({ row, marking, scopeName, onGo, s }: {
  row: CheckRow; marking: CheckMarking | undefined; scopeName: (path: ScopePath) => string; onGo: (place: CheckPlace) => void; s: Translate
}) {
  const { entry } = row
  return (
    <Box data-testid="checks-detail" data-check={row.key} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, bgcolor: 'background.paper' }}>
      <Typography sx={{ ...QUIET, display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
        <Box component="span" aria-hidden sx={{ fontSize: 11, ...WEIGHT_MARK[entry.weight].sx }}>{WEIGHT_MARK[entry.weight].glyph}</Box>
        {s(CHECK_WEIGHT_LABEL[entry.weight].name)} · {s(CHECK_CATEGORY_LABEL[entry.category])}
      </Typography>
      <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700 }} data-testid="checks-name">{s(entry.name)}</Typography>
      <Typography component="h3" sx={HEADING}>{s(CHECK_LIST_WORDS.why)}</Typography>
      <Typography sx={{ fontSize: 12.5 }} data-testid="checks-why">{s(entry.why)}</Typography>
      <Typography component="h3" sx={HEADING}>{s(CHECK_LIST_WORDS.how)}</Typography>
      <Typography sx={{ fontSize: 12.5 }} data-testid="checks-how">{s(entry.how)}</Typography>
      <Typography component="h3" sx={HEADING}>{s('checks.found', { count: row.shown.length })}</Typography>
      {!row.counted
        ? <Typography sx={QUIET} data-testid="checks-where-open">{s('checks.whereOpen')}</Typography>
        : row.shown.length === 0
          ? <Typography sx={QUIET}>{s('checks.none')}</Typography>
          : (
            <>
              <Box component="ul" data-testid="checks-instances" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                {row.shown.map((instance) => (
                  <Instance key={instance.id} instance={instance} marking={entry.weight === 'fix' ? undefined : marking} fixing={marking} scopeName={scopeName} onGo={onGo} s={s} />
                ))}
              </Box>
              <Typography sx={{ ...QUIET, mt: 0.5 }}>{s('checks.opens')}</Typography>
            </>
          )}
      {entry.weight === 'fix'
        ? <Typography sx={{ ...QUIET, mt: 1.5 }} data-testid="checks-never">{s(CHECK_MARK_WORDS.never)}</Typography>
        : (
          <AcceptedFindings
            unfolded words={CHECK_MARK_WORDS} testId="checks-accepted"
            items={row.marked.map(({ instance, mark, keptIn }) => ({
              key: `${keptIn}\u0000${checkMarkId(mark)}\u0000${instance.id}`,
              sentence: instance.scope !== undefined ? `${instance.text} (${s('checks.in', { scope: scopeName(instance.scope) })})` : instance.text,
              reason: mark.reason, on: mark.on,
              onTakeBack: marking?.mayTakeBack(keptIn) ? () => marking.takeBack({ scope: keptIn, mark }) : undefined,
            }))}
          />
        )}
    </Box>
  )
}

/**
 * The assignment an instance would remove, and the scope that keeps it: one
 * whose unit is not there, where the person may change that scope.
 */
function removable(instance: CheckInstance, marking: CheckMarking | undefined): { scope: ScopePath; id: string } | undefined {
  if (instance.key !== 'check.assignmentOrphaned' || instance.scope === undefined || !marking?.mayChange(instance.scope)) return undefined
  const id = 'fields' in instance.finding ? instance.finding.fields?.[0] : undefined
  return id !== undefined ? { scope: instance.scope, id } : undefined
}

/**
 * One instance: its sentence, opening where it is fixed; the scope it is in;
 * *Remove the assignment* where that fixes it; and *Mark as intended…* where
 * it may be — never for a fix.
 */
function Instance({ instance, marking, fixing, scopeName, onGo, s }: {
  /** `marking` for a mark, where one may be made; `fixing` for the fix, whatever the weight. */
  instance: CheckInstance; marking: CheckMarking | undefined; fixing: CheckMarking | undefined; scopeName: (path: ScopePath) => string; onGo: (place: CheckPlace) => void; s: Translate
}) {
  const { opens } = instance
  const markable = marking?.markableIn(instance.finding, instance.checkedIn) !== undefined
  const remove = removable(instance, fixing)
  return (
    <Box component="li" sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {opens
          ? (
            <ButtonBase
              {...instance.attributes} data-guide="checks.instance" onClick={() => onGo(opens)}
              sx={{ fontSize: 12.5, display: 'block', textAlign: 'left', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
            >
              {instance.text}
            </ButtonBase>
          )
          : <Typography {...instance.attributes} sx={{ fontSize: 12.5 }}>{instance.text}</Typography>}
        {instance.scope !== undefined && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{s('checks.in', { scope: scopeName(instance.scope) })}</Typography>}
      </Box>
      {remove && fixing && (
        <Button
          size="small" color="error" sx={{ flex: 'none', textTransform: 'none' }} data-testid="checks-remove-assignment"
          onClick={() => fixing.removeAssignment(remove.scope, remove.id)}
        >
          {s(CHECK_ACTION_LABEL.removeAssignment)}
        </Button>
      )}
      {markable && marking && (
        <MarkAsIntended inline words={CHECK_MARK_WORDS} sentence={instance.text} onMark={(reason) => marking.mark(instance.finding, reason, instance.checkedIn)} />
      )}
    </Box>
  )
}
