// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A list of findings, the one every screen draws (ADR-0036, amended 11
 * October 2026: findings you can act on).
 *
 * **Grouped, weighed and folded.** One row per check: the mark of its weight
 * — fix, review or note — its name and how many, folded shut. Fix comes
 * first, then review, then note, in the order the groups are handed in. The
 * notes wait behind *Show notes (N)*: information that may well be intended
 * is there for whoever asks, and does not read as a list of faults.
 *
 * **An instance opens its explanation.** Pressing one puts it in the list's
 * place: the instance in its own sentence, why the check matters, how to fix
 * it, and the actions that fix it or open where it is fixed. *All findings*
 * goes back, to the instance it came from. A finding the actions put right
 * leaves the list, and its explanation with it.
 *
 * **It knows no model** — the import matrix keeps the widgets below it. The
 * groups come grouped (`model/checkCatalogue.groupByCheck`), the words come
 * as keys in one table (`CHECK_LIST_WORDS`), each instance's sentence comes
 * from the screen that found it, and each action from what that screen does
 * for it: a press, a choice between several, or nothing where it has nothing
 * to do it with. An action with nothing behind it is no button at all, never
 * a dead one.
 *
 * **Folds and notes are the session's** (`sessionMemory.ts`): kept under the
 * key a screen gives, for as long as the window is open, and never saved.
 *
 * **A finding marked as intended is not in the groups** (`model/checkMarks`):
 * the screen splits its findings and hands in only those still shown. What
 * was marked has a place under the groups (`accepted`), and an explanation
 * one under its actions (`more`) — where *Accepted (N)* and *Mark as
 * intended…* go.
 */
import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import FormControlLabel from '@mui/material/FormControlLabel'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { useStrings } from '../i18n'
import type { StringKey, Translate } from '../i18n'
import { plural } from '../i18n/strings'
import { useSessionSet } from './sessionMemory'

/** How much a check matters, as the catalogue weighs it: what a mark is drawn for. */
export type FindingWeight = 'fix' | 'review' | 'note'

/** What a list says besides the findings: the model's `CHECK_LIST_WORDS` is the table. */
export type FindingsWords<A extends string> = {
  readonly weight: Readonly<Record<FindingWeight, { readonly name: StringKey; readonly about: StringKey }>>
  readonly category: Readonly<Record<string, StringKey>>
  readonly action: Readonly<Record<A, StringKey>>
  readonly toLookAt: StringKey
  readonly notes: { readonly one: StringKey; readonly other: StringKey }
  readonly showNotes: StringKey
  readonly why: StringKey
  readonly how: StringKey
  readonly back: StringKey
}

/** One check's findings, as `groupByCheck` hands them over. */
export type FindingsGroup<F, A extends string> = {
  readonly key: string
  readonly weight: FindingWeight
  readonly category: string
  readonly entry: { readonly name: StringKey; readonly why: StringKey; readonly how: StringKey; readonly actions: readonly A[] }
  readonly findings: readonly F[]
  readonly count: number
}

/** One of several things an action can be done to: one of two units, an application of either. */
export type FindingChoice = { readonly key: string; readonly label: string; readonly group?: string; readonly run: () => void }

/** What a screen does for an action on one finding: a press, or a choice of several. */
export type FindingDoing = (() => void) | readonly FindingChoice[]

/** Each action a screen can do, for a finding: what it does, or nothing where it cannot do it for this one. */
export type FindingActions<F, A extends string> = Partial<Record<A, (finding: F) => FindingDoing | undefined>>

export type FindingsListProps<F, A extends string> = {
  groups: readonly FindingsGroup<F, A>[]
  words: FindingsWords<A>
  /** The instance in a sentence: the screen's own, as it said it before. */
  sentence: (finding: F) => string
  /** What tells one finding from another in this list, for as long as it is found. */
  keyOf: (finding: F) => string
  actions?: FindingActions<F, A>
  /** What an instance carries for something outside to point at it by: `data-finding`, a test id. */
  attributesOf?: (finding: F) => Readonly<Record<string, string>>
  /** Said where nothing is found; nothing where absent. */
  empty?: ReactNode
  /** Where the session keeps this list's folds and whether its notes are shown; the list's own where absent. */
  remember?: string
  /** An instance opened, or none: a screen that marks what a finding is about on its page. */
  onPick?: (finding: F | undefined) => void
  /** More for an instance, under its actions: the place a mark as intended goes. */
  more?: (finding: F, group: FindingsGroup<F, A>) => ReactNode
  /** What was marked as intended, under the groups — said even where nothing else is found. */
  accepted?: ReactNode
  testId?: string
}

/** The set's own word for the notes shown, beside the checks unfolded; no check's key is this. */
const NOTES_SHOWN = '\u0000notes'

const MARK: Record<FindingWeight, { glyph: string; sx: object }> = {
  fix: { glyph: '●', sx: { color: 'error.main' } },
  review: { glyph: '▲', sx: { color: 'warning.main' } },
  note: { glyph: 'i', sx: { color: 'text.secondary', fontStyle: 'italic', fontFamily: 'Georgia, serif', fontWeight: 700 } },
}

/** Read by a screen reader and nobody else. */
const HIDDEN = {
  border: 0, clip: 'rect(0 0 0 0)', height: '1px', margin: '-1px', overflow: 'hidden', padding: 0, position: 'absolute',
  whiteSpace: 'nowrap', width: '1px',
} as const

const SMALL = { fontSize: 12 } as const
const QUIET = { fontSize: 11.5, color: 'text.secondary' } as const

/** A weight's mark: its glyph in its colour, its name for a screen reader. */
function Mark({ weight, name }: { weight: FindingWeight; name: string }) {
  return (
    <>
      <Box component="span" aria-hidden data-weight={weight} sx={{ display: 'inline-block', width: 14, textAlign: 'center', fontSize: 11, flex: 'none', ...MARK[weight].sx }}>
        {MARK[weight].glyph}
      </Box>
      <Box component="span" sx={HIDDEN}>{name}</Box>
    </>
  )
}

type Picked = { group: string; key: string }

export function FindingsList<F, A extends string>(props: FindingsListProps<F, A>) {
  const { t } = useStrings()
  const { groups, words, keyOf } = props
  const [held, setHeld] = useSessionSet(props.remember)
  const [picked, setPicked] = useState<Picked | undefined>(undefined)
  const root = useRef<HTMLDivElement | null>(null)
  const back = useRef<string | undefined>(undefined)
  const group = picked && groups.find((one) => one.key === picked.group)
  const finding = group?.findings.find((one) => keyOf(one) === picked?.key)
  const { onPick } = props
  // Put right by one of its actions, or gone for any reason: the list again, the focus on it.
  useEffect(() => {
    if (picked && finding === undefined) {
      setPicked(undefined)
      onPick?.(undefined)
      root.current?.focus()
    }
  }, [picked, finding, onPick])
  // Back from an explanation: the focus on the instance it was opened from.
  useEffect(() => {
    const key = back.current
    if (picked || key === undefined) return
    back.current = undefined
    const instance = [...root.current?.querySelectorAll<HTMLElement>('[data-instance]') ?? []].find((one) => one.dataset.instance === key)
    instance?.focus()
  }, [picked])
  const open = (one: FindingsGroup<F, A>, at: F) => {
    setPicked({ group: one.key, key: keyOf(at) })
    onPick?.(at)
  }
  const close = () => {
    back.current = picked?.key
    setPicked(undefined)
    onPick?.(undefined)
  }
  const toggle = (key: string) => {
    const next = new Set(held)
    if (!next.delete(key)) next.add(key)
    setHeld(next)
  }
  return (
    <Box ref={root} tabIndex={-1} data-testid={props.testId} sx={{ outline: 'none' }}>
      {group && finding !== undefined
        ? <Explanation {...props} group={group} finding={finding} onBack={close} t={t} />
        : groups.length === 0
          ? <>{props.empty}{props.accepted}</>
          : <Groups {...props} held={held} onToggle={toggle} onOpen={open} words={words} t={t} />}
    </Box>
  )
}

/** The groups, the notes behind their switch, and what the marks mean. */
function Groups<F, A extends string>(props: FindingsListProps<F, A> & {
  held: ReadonlySet<string>; onToggle: (key: string) => void; onOpen: (group: FindingsGroup<F, A>, finding: F) => void; t: Translate
}) {
  const { groups, words, held, t } = props
  const notes = groups.filter((one) => one.weight === 'note').reduce((sum, one) => sum + one.count, 0)
  const looking = groups.filter((one) => one.weight !== 'note').reduce((sum, one) => sum + one.count, 0)
  const notesShown = held.has(NOTES_SHOWN)
  const shown = groups.filter((one) => notesShown || one.weight !== 'note')
  const weights = (['fix', 'review', 'note'] as const).filter((weight) => groups.some((one) => one.weight === weight))
  return (
    <>
      <Typography sx={QUIET} data-testid="findings-summary">
        {[looking > 0 ? t(words.toLookAt, { count: looking }) : '', notes > 0 ? plural(t, words.notes, notes) : ''].filter(Boolean).join(' · ')}
      </Typography>
      <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {shown.map((group) => <Group key={group.key} {...props} group={group} open={held.has(group.key)} />)}
      </Box>
      {props.accepted}
      {notes > 0 && (
        <FormControlLabel
          data-guide="findings.showNotes" data-testid="findings-show-notes"
          control={<Switch size="small" checked={notesShown} onChange={() => props.onToggle(NOTES_SHOWN)} />}
          label={<Typography sx={SMALL}>{t(words.showNotes, { count: notes })}</Typography>}
          sx={{ mt: 0.5, ml: 0 }}
        />
      )}
      <Box component="ul" data-testid="findings-legend" sx={{ listStyle: 'none', p: 0, m: 0, mt: 0.5, display: 'flex', flexWrap: 'wrap', columnGap: 1.5 }}>
        {weights.map((weight) => (
          <Box component="li" key={weight} sx={{ ...QUIET, display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
            <Box component="span" aria-hidden sx={{ fontSize: 11, ...MARK[weight].sx }}>{MARK[weight].glyph}</Box>
            {t(words.weight[weight].name)}: {t(words.weight[weight].about)}
          </Box>
        ))}
      </Box>
    </>
  )
}

/** One check: its row, and its instances while it is open. */
function Group<F, A extends string>(props: FindingsListProps<F, A> & {
  group: FindingsGroup<F, A>; open: boolean; onToggle: (key: string) => void; onOpen: (group: FindingsGroup<F, A>, finding: F) => void; t: Translate
}) {
  const { group, open, words, keyOf, sentence, attributesOf, t } = props
  const id = useId()
  return (
    <Box component="li" data-check={group.key} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <ButtonBase
        aria-expanded={open} aria-controls={id} onClick={() => props.onToggle(group.key)}
        data-guide="findings.group" data-testid="findings-group"
        sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, width: '100%', justifyContent: 'flex-start', textAlign: 'left', py: 0.5, fontSize: 12.5, '&:hover .findings-name': { textDecoration: 'underline' } }}
      >
        <Box component="span" aria-hidden sx={{ width: 10, flex: 'none', color: 'text.secondary', fontSize: 10 }}>{open ? '▾' : '▸'}</Box>
        <Mark weight={group.weight} name={t(words.weight[group.weight].name)} />
        <Box component="span" className="findings-name" sx={{ flex: 1, minWidth: 0 }}>{t(group.entry.name)}</Box>
        <Box component="span" sx={{ color: 'text.secondary', flex: 'none' }}>({group.count})</Box>
      </ButtonBase>
      {open && (
        <Box component="ul" id={id} sx={{ listStyle: 'none', m: 0, mb: 0.5, pl: 3.25, pr: 0 }}>
          {group.findings.map((finding, at) => {
            const key = keyOf(finding)
            return (
              <Box component="li" key={`${key}\u0000${at}`} sx={{ py: 0.25 }}>
                <ButtonBase
                  {...attributesOf?.(finding)} data-instance={key} data-guide="findings.instance" onClick={() => props.onOpen(group, finding)}
                  sx={{ ...SMALL, display: 'block', textAlign: 'left', width: '100%', '&:hover': { textDecoration: 'underline' } }}
                >
                  {sentence(finding)}
                </ButtonBase>
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}

/** An instance in the list's place: what it is, why it matters, how to fix it, and what fixes it. */
function Explanation<F, A extends string>(props: FindingsListProps<F, A> & {
  group: FindingsGroup<F, A>; finding: F; onBack: () => void; t: Translate
}) {
  const { group, finding, words, t } = props
  const title = useRef<HTMLHeadingElement | null>(null)
  const titleId = useId()
  useEffect(() => { title.current?.focus() }, [])
  const doable = group.entry.actions.flatMap((action) => {
    const doing = props.actions?.[action]?.(finding)
    return doing === undefined || (Array.isArray(doing) && doing.length === 0) ? [] : [{ action, doing }]
  })
  const heading = { fontSize: 12, fontWeight: 700, color: 'text.secondary', mt: 1.25, mb: 0.25 } as const
  return (
    <Box role="region" aria-labelledby={titleId} data-testid="finding-explanation" data-check={group.key}>
      <Button size="small" onClick={props.onBack} data-guide="findings.back" data-testid="findings-back" sx={{ fontSize: 11.5, px: 0.5, minWidth: 0 }}>
        <Box component="span" aria-hidden sx={{ mr: 0.5 }}>{'←'}</Box>{t(words.back)}
      </Button>
      <Typography sx={{ ...QUIET, display: 'flex', alignItems: 'baseline', gap: 0.5, mt: 0.5 }} data-testid="finding-weight">
        <Box component="span" aria-hidden sx={{ fontSize: 11, ...MARK[group.weight].sx }}>{MARK[group.weight].glyph}</Box>
        {t(words.weight[group.weight].name)} · {t(words.category[group.category])}
      </Typography>
      <Typography component="h3" id={titleId} ref={title} tabIndex={-1} sx={{ fontSize: 15, fontWeight: 700, outline: 'none' }}>
        {t(group.entry.name)}
      </Typography>
      <Typography sx={{ fontSize: 12.5, fontWeight: 600, mt: 0.5 }} data-testid="finding-sentence">{props.sentence(finding)}</Typography>
      <Typography component="h4" sx={heading}>{t(words.why)}</Typography>
      <Typography sx={SMALL} data-testid="finding-why">{t(group.entry.why)}</Typography>
      <Typography component="h4" sx={heading}>{t(words.how)}</Typography>
      <Typography sx={SMALL} data-testid="finding-how">{t(group.entry.how)}</Typography>
      {doable.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.25 }}>
          {doable.map(({ action, doing }, at) => (
            <Action key={action} action={action} label={t(words.action[action])} doing={doing} first={at === 0} />
          ))}
        </Box>
      )}
      {props.more?.(finding, group)}
    </Box>
  )
}

/** One action: a button that does it, or one that offers the things it can be done to. */
function Action({ action, label, doing, first }: { action: string; label: string; doing: FindingDoing; first: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const menuId = useId()
  const common = {
    size: 'small' as const, variant: first ? 'contained' as const : 'outlined' as const,
    'data-guide': 'findings.action', 'data-action': action, 'data-testid': `finding-action-${action}`,
    sx: { fontSize: 11.5, textTransform: 'none' },
  }
  if (typeof doing === 'function') return <Button {...common} onClick={doing}>{label}</Button>
  return (
    <>
      <Button {...common} aria-haspopup="menu" aria-expanded={anchor !== null} aria-controls={anchor ? menuId : undefined}
        onClick={(event) => setAnchor(event.currentTarget)}>
        {label}
      </Button>
      <Menu id={menuId} anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        {doing.map((one) => (
          <MenuItem key={one.key} dense data-testid={`finding-choice-${one.key}`} onClick={() => { setAnchor(null); one.run() }}>
            {one.label}
            {one.group !== undefined && <Box component="span" sx={{ ...QUIET, ml: 1 }}>{one.group}</Box>}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
