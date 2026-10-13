// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Served by*, on a scope's home and in its settings (ADR-0036, amended 11
 * October 2026): the units whose `scopes` name the scope, in the one order,
 * each with its type, who holds its managing role today and where it is
 * filed where that is not here; *+ Unit*, which picks one from the whole
 * organisation; and the domain's owner, worked out and never kept.
 *
 * The same field a unit's *Serves* edits, from this end: adding or taking a
 * unit off is a step in the scope that keeps the unit, so it is offered only
 * where that scope is the person's to change. A name opens the unit where it
 * is kept — on that scope's organisation chart, chosen, where it has one —
 * whose inspector says the same thing from the other end; in the settings
 * dialog too, which is left for it (`onLeave`).
 */
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import { plural } from '../../i18n/strings'
import { pickedPerson } from '../../model/person'
import { usePersonNames } from '../../people/ui/names'
import type { ScopePath } from '../../projects/scopePath'
import { PickToAdd } from '../../widgets/PickToAdd'
import { pickableBy } from './servedByView'
import type { ServedByAccess } from './useServedBy'

const HEADING = { fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' } as const
const QUIET = { fontSize: 12, color: 'text.secondary' } as const

export function ServedBy({ scope, servedBy, scopeName, compact, onLeave, s }: {
  scope: ScopePath
  servedBy: ServedByAccess | undefined
  scopeName: (path: ScopePath) => string
  /** In the settings dialog: no heading of the home's size. */
  compact?: boolean
  /** What opening a unit leaves first: the settings dialog, closed. */
  onLeave?: () => void
  s: Translate
}) {
  const names = usePersonNames()
  const view = servedBy?.of(scope)
  // Nothing at the organisation, which is no domain (`servedByOf`).
  if (!servedBy || !view) return null
  const here = scopeName(scope)
  const person = (id: string) => names.text(pickedPerson(id))
  // A unit kept where the person may only read is offered, and said so: adding it would be a step there.
  const choices = pickableBy(view.choices, servedBy.mayChange, { s })
  return (
    <Box data-testid="served-by" data-guide="org.servedBy" sx={compact ? undefined : { mb: 3, maxWidth: 720 }}>
      <Typography component="h2" sx={compact ? { fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: 'text.secondary' } : HEADING}>
        {s('org.servedBy')}
      </Typography>
      <Typography sx={{ ...QUIET, mb: 0.75 }}>{s('org.servedByHint', { scope: here })}</Typography>
      {view.rows.length === 0 && <Typography sx={QUIET} data-testid="served-by-none">{s('org.servedByNone', { scope: here })}</Typography>}
      {view.rows.map((row) => (
        <Box key={row.id} data-testid="served-by-row" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', my: 0.25 }}>
          <Typography sx={{ fontSize: 13 }}>
            <Box component="span" sx={{ color: 'text.secondary' }}>{row.type ? `${row.type} · ` : ''}</Box>
            <Link
              component="button" type="button" underline="hover" data-testid="served-by-unit"
              onClick={() => { onLeave?.(); servedBy.open(row.id) }} sx={{ fontSize: 13, verticalAlign: 'baseline' }}
            >
              {row.name}
            </Link>
          </Typography>
          <Typography sx={QUIET}>
            {[
              row.managers.length ? row.managers.map(person).join(', ') : s('org.servedByNoManager'),
              row.filedIn !== scope ? s('pick.filedIn', { scope: scopeName(row.filedIn) }) : '',
            ].filter(Boolean).join(' · ')}
          </Typography>
          {row.mayStop && servedBy.mayChange(row.id) && (
            <IconButton
              size="small" aria-label={s('org.servedByRemove', { unit: row.name, scope: here })}
              onClick={() => servedBy.remove(scope, row.id)} sx={{ p: 0.25, fontSize: 12 }}
            >
              ✕
            </IconButton>
          )}
        </Box>
      ))}
      {view.through > 0 && (
        <Typography sx={QUIET}>{plural(s, { one: 'org.servedByThroughOne', other: 'org.servedByThroughOther' }, view.through)}</Typography>
      )}
      <PickToAdd
        options={choices} label={s('org.servedByAdd')} field={s('pick.findUnit')} nothing={s('pick.noUnit')}
        onPick={(unitId) => servedBy.add(scope, unitId)} testId="served-by-add"
        // Open even where nothing may be picked: the list says why each may not.
        disabled={choices.length === 0}
      />
      {view.owner && (
        <Typography sx={{ fontSize: 13, mt: 0.75 }} data-testid="served-by-owner">
          {view.owner.unit === undefined
            ? s('org.domainOwnerNoUnit', { role: view.owner.role })
            : view.owner.people.length === 0
              ? s('org.domainOwnerVacant', { role: view.owner.role, unit: view.owner.unit })
              : s('org.domainOwner', { people: view.owner.people.map(person).join(', '), role: view.owner.role, unit: view.owner.unit })}
        </Typography>
      )}
    </Box>
  )
}
