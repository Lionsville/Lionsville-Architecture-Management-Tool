// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Move the people* (ADR-0036 §6): every assignment in a unit or a role that
 * ends, each with a suggestion a person accepts or changes, and one action
 * that writes all the ends and beginnings as one step.
 *
 * Nobody's new place is guessed: a row with no suggestion only ends, and
 * every row may be put anywhere the units on offer hold a role that day.
 * Nothing is written until *Write as one step*. The list is the plan page's
 * and the operating model page's alike — a role that ends, and a role taken
 * out of a unit type — and each says which ends it lists.
 *
 * **A manager where the scope is only read** (ADR-0036 §12): the rows of
 * the units they manage are theirs to move — to places in those units, a
 * managing role only strictly below one they hold — and only those are
 * written; every other row is shown and left as it is.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import { addDays } from '../../model/transition'
import { mayChangeIn } from '../../model/managing'
import type { ManagesPeople } from '../../model/managing'
import { samePlace } from '../../model/reorganisation'
import type { PeopleChoice, PeopleMove, Place } from '../../model/reorganisation'
import { personOf, shareOf } from '../../model/units'
import type { PeopleMoved } from './landPeopleMoves'

/** What the list names things by: the register's names, the organisation's words. */
export type MoveNames = {
  person: (id: string) => string
  unit: (id: string) => string
  role: (id: string) => string
  /** The id that answers for an id: the entry a merge kept (ADR-0036 §9). */
  canonical: (id: string) => string
}

export type MovePeopleProps = {
  moves: readonly PeopleMove[]
  /** The places a row may go to from the day after its last. */
  placesFor: (move: PeopleMove) => readonly Place[]
  names: MoveNames
  readOnly: boolean
  /** Whose people the person manages, where the scope is only read to them: their rows are still theirs to move. */
  manages?: ManagesPeople
  /** Write the rows as one step; answers where it went. */
  onWrite: (rows: { move: PeopleMove; choice: PeopleChoice }[]) => Promise<PeopleMoved>
  s: Translate
}

const END = 'end'

const valueOf = (choice: PeopleChoice): string => (choice === END ? END : `${choice.unitId}|${choice.roleId}`)

function choiceOf(value: string): PeopleChoice {
  if (value === END) return END
  const [unitId, roleId] = value.split('|')
  return { unitId, roleId }
}

/** A row's choice: what the person chose, or the suggestion where it may be taken, or only the end. */
function chosen(move: PeopleMove, choices: ReadonlyMap<string, PeopleChoice>, placeable: (place: Place) => boolean): PeopleChoice {
  return choices.get(move.assignment.id) ?? (move.suggestion && placeable(move.suggestion) ? move.suggestion : END)
}

export function MovePeople({ moves, placesFor, names, readOnly, manages, onWrite, s }: MovePeopleProps) {
  const [choices, setChoices] = useState<ReadonlyMap<string, PeopleChoice>>(new Map())
  const [said, setSaid] = useState<{ text: string; tone: 'ok' | 'error' } | undefined>(undefined)
  const [writing, setWriting] = useState(false)
  // Everything where the scope may be written; a manager's own units' where it is only read.
  const placeable = (place: Place) => !readOnly || mayChangeIn(manages, place.unitId, place.roleId)
  const movable = (move: PeopleMove) => placeable({ unitId: move.assignment.unitId, roleId: move.assignment.roleId })
  const writable = moves.some(movable)
  // A row shown and not moved says its suggestion as it is; one that is moved takes only a place that may be.
  const choiceFor = (move: PeopleMove) => chosen(move, choices, movable(move) ? placeable : () => true)
  const write = async () => {
    setWriting(true)
    const answer = await onWrite(moves.filter(movable).map((move) => ({ move, choice: choiceFor(move) })))
    setWriting(false)
    setChoices(new Map())
    if (!answer.ok) {
      setSaid({ text: s(answer.reason === 'shell.scopeReadOnly' ? 'move.refusedReadOnly' : 'move.refused'), tone: 'error' })
      return
    }
    const key = answer.changed.length > 1 ? 'move.writtenAcross' : 'move.written'
    setSaid({ text: s(key, { ended: answer.ended, begun: answer.begun, scopes: answer.changed.length }), tone: 'ok' })
  }
  return (
    <Box data-testid="move-people">
      {moves.length === 0 && <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{s('move.nobody')}</Typography>}
      {moves.length > 0 && (
        <Box component="table" sx={TABLE}>
          <thead>
            <tr><th>{s('move.person')}</th><th>{s('move.holds')}</th><th>{s('move.next')}</th><th>{s('move.why')}</th></tr>
          </thead>
          <tbody>
            {moves.map((move) => (
              <Row key={move.assignment.id} move={move} choice={choiceFor(move)} names={names}
                places={movable(move) ? placesFor(move).filter(placeable) : placesFor(move)}
                readOnly={!movable(move)} placeable={placeable}
                onChoose={(choice) => setChoices((was) => new Map(was).set(move.assignment.id, choice))} s={s} />
            ))}
          </tbody>
        </Box>
      )}
      {writable && (
        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          <Button size="small" onClick={() => setChoices(new Map())} data-testid="move-accept">{s('move.acceptAll')}</Button>
          <Button size="small" variant="contained" disabled={writing} onClick={() => { void write() }} data-testid="move-write">{s('move.write')}</Button>
        </Box>
      )}
      {said && (
        <Typography sx={{ fontSize: 12, mt: 0.75, color: said.tone === 'error' ? 'error.main' : 'text.secondary' }} role="status" data-testid="move-said">
          {said.text}
        </Typography>
      )}
    </Box>
  )
}

const TABLE = {
  width: '100%', borderCollapse: 'collapse', fontSize: 12, lineHeight: 1.3,
  '& td, & th': { py: 0.5, pr: 1.5, textAlign: 'left', verticalAlign: 'middle' },
  '& th': { fontSize: 11, color: 'text.secondary', fontWeight: 700 },
  '& tr + tr td': { borderTop: 1, borderColor: 'divider' },
  '& .MuiSelect-select': { fontSize: 12, py: 0.25 },
} as const

function Row({ move, choice, places, names, readOnly, placeable, onChoose, s }: {
  move: PeopleMove; choice: PeopleChoice; places: readonly Place[]; names: MoveNames; readOnly: boolean
  placeable: (place: Place) => boolean; onChoose: (choice: PeopleChoice) => void; s: Translate
}) {
  const { assignment, lastDay } = move
  const suggestion = move.suggestion && (readOnly || placeable(move.suggestion)) ? move.suggestion : undefined
  const share = shareOf(assignment)
  const offered = suggestion && !places.some((one) => samePlace(one, suggestion)) ? [suggestion, ...places] : [...places]
  const label = (place: Place) => s('move.place', { role: names.role(place.roleId), unit: names.unit(place.unitId) })
  const why = [
    ...(move.unitEnds ? [s('move.whyUnit', { unit: names.unit(assignment.unitId), day: lastDay })] : []),
    ...(move.roleEnds ? [s('move.whyRole', { role: names.role(assignment.roleId), day: lastDay })] : []),
    ...(move.slotEnds ? [s('move.whySlot', { role: names.role(assignment.roleId) })] : []),
  ]
  return (
    <tr data-testid={`move-row-${assignment.id}`}>
      <td>{names.person(personOf(assignment))}</td>
      <td>{label({ unitId: assignment.unitId, roleId: assignment.roleId })}{share < 1 ? ` · ${Math.round(share * 100)}%` : ''}</td>
      <td>
        <TextField select size="small" variant="standard" value={valueOf(choice)} disabled={readOnly} sx={{ minWidth: 200 }}
          onChange={(event) => onChoose(choiceOf(event.target.value))}
          slotProps={{ htmlInput: { 'aria-label': s('move.nextFor', { person: names.person(personOf(assignment)), day: addDays(lastDay, 1) }) } }}>
          {offered.map((place) => (
            <MenuItem key={valueOf(place)} value={valueOf(place)}>
              {samePlace(place, suggestion) ? s('move.suggested', { place: label(place) }) : label(place)}
            </MenuItem>
          ))}
          <MenuItem value={END}>{s('move.endOnly', { day: lastDay })}</MenuItem>
        </TextField>
      </td>
      <td style={{ color: 'inherit' }}><Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{why.join(' · ')}</Typography></td>
    </tr>
  )
}
