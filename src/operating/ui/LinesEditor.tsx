// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where the holders of a role report, edited (ADR-0039 §2, §7, amended 17
 * October 2026): one row for a line manager's line and one for a functional
 * line, each naming the role reported to, whether it is in the same unit or
 * found above, and the days it runs. Drawn in the role's inspector for the
 * role itself, wherever it is held, and under each slot of a unit type for
 * the units of that type — where the row shows the role's own line as what
 * holds until the slot says otherwise, and may say *by nesting* to take it
 * away for this type.
 *
 * A line the host says would close a loop, or one from a role to itself in
 * the same unit, is refused and said why, and not written.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { LINE_KINDS, linesWith } from '../../model/operatingModel'
import type { LineKind, ReportsTo, Role, RoleId } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'

export type LinesEditorProps = {
  /** The role whose holders report: its lines are never offered to itself in the same unit twice. */
  roleId: RoleId
  /** The role's name, said in every control's name. */
  name: string
  /** The lines said here. */
  said: readonly ReportsTo[]
  /** What holds until this place says otherwise: the role's own lines, under a slot. Absent on the role itself. */
  inherited?: readonly ReportsTo[]
  roles: readonly Role[]
  readOnly: boolean
  /** Writes the lines as they would be, or says why they are refused, in which case nothing is written. */
  onChange: (next: ReportsTo[] | undefined) => string | undefined
  testId: string
}

/** A select's value for a row: nothing said, by nesting, or a role. */
const NESTING = '\u0000nesting'

export function LinesEditor({ roleId, name, said, inherited, roles, readOnly, onChange, testId }: LinesEditorProps) {
  const { t } = useStrings()
  const [refused, setRefused] = useState<string | undefined>(undefined)
  const write = (kind: LineKind, line: ReportsTo | undefined) => setRefused(onChange(linesWith(said, kind, line)))
  return (
    <Box data-testid={testId} sx={{ display: 'grid', gap: 0.75 }}>
      {LINE_KINDS.map((kind) => (
        <LineRow
          key={kind} kind={kind} roleId={roleId} name={name} roles={roles} readOnly={readOnly} t={t}
          line={said.find((one) => one.kind === kind)} under={inherited?.find((one) => one.kind === kind)} onSlot={inherited !== undefined}
          onWrite={(line) => write(kind, line)}
        />
      ))}
      {refused && <Typography role="alert" variant="caption" color="error" sx={{ display: 'block' }} data-testid="operating-line-refused">{refused}</Typography>}
    </Box>
  )
}

function LineRow({ kind, roleId, name, roles, readOnly, line, under, onSlot, onWrite, t }: {
  kind: LineKind; roleId: RoleId; name: string; roles: readonly Role[]; readOnly: boolean
  line: ReportsTo | undefined; under: ReportsTo | undefined; onSlot: boolean
  onWrite: (line: ReportsTo | undefined) => void; t: Translate
}) {
  const kindWord = t(kind === 'solid' ? 'operating.lineSolid' : 'operating.lineDotted')
  const roleName = (id: string | undefined) => (id === undefined ? '' : roles.find((one) => one.id === id)?.name ?? id)
  const value = line ? (line.role ?? NESTING) : ''
  const change = (patch: Partial<ReportsTo>) => {
    if (!line) return
    const next: ReportsTo = { ...line, ...patch }
    for (const key of ['from', 'until'] as const) if (next[key] === '') delete next[key]
    if (next.within !== true) delete next.within
    onWrite(next)
  }
  // What a row says where nothing is said here: on a slot, the role's own line or none; on the role, no line.
  const nothingSaid = onSlot
    ? (under?.role !== undefined ? t('operating.reportsToAsRoleIs', { target: roleName(under.role) }) : t('operating.reportsToAsRole'))
    : t('operating.reportsToNone')
  const label = `${name}: ${t('operating.reportsTo')} (${kindWord})`
  return (
    <Box data-testid="operating-line-row" data-kind={kind} data-said={line ? 'true' : undefined}>
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        <Typography variant="caption" sx={{ width: 84, flexShrink: 0, color: 'text.secondary' }}>{kindWord}</Typography>
        <TextField select size="small" label={t('operating.reportsTo')} value={value} disabled={readOnly} sx={{ flex: 1 }}
          slotProps={{ htmlInput: { 'aria-label': label } }}
          onChange={(event) => {
            const picked = event.target.value
            if (picked === '') onWrite(undefined)
            else if (picked === NESTING) onWrite({ kind })
            else onWrite({ ...(line ?? { kind }), role: picked, kind })
          }}>
          <MenuItem value="">{nothingSaid}</MenuItem>
          {onSlot && <MenuItem value={NESTING}>{t('operating.reportsToNesting')}</MenuItem>}
          {roles.map((role) => <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>)}
        </TextField>
      </Box>
      {line?.role !== undefined && (
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, pl: '88px', flexWrap: 'wrap' }}>
          <TextField select size="small" label={t('operating.lineWhere')} value={line.within ? 'within' : 'up'} disabled={readOnly} sx={{ flex: '1 1 100%' }}
            slotProps={{ htmlInput: { 'aria-label': `${name}: ${t('operating.lineWhere')} (${kindWord})` } }}
            onChange={(event) => change({ within: event.target.value === 'within' ? true : undefined })}>
            <MenuItem value="up">{t('operating.lineUp')}</MenuItem>
            <MenuItem value="within" disabled={line.role === roleId}>{t('operating.lineWithin')}</MenuItem>
          </TextField>
          <TextField size="small" type="date" label={t('operating.lineFrom')} value={line.from ?? ''} disabled={readOnly} sx={{ flex: 1 }}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': `${name}: ${t('operating.lineFrom')} (${kindWord})` } }}
            onChange={(event) => change({ from: event.target.value })} />
          <TextField size="small" type="date" label={t('operating.lineUntil')} value={line.until ?? ''} disabled={readOnly} sx={{ flex: 1 }}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': `${name}: ${t('operating.lineUntil')} (${kindWord})` } }}
            onChange={(event) => change({ until: event.target.value })} />
        </Box>
      )}
    </Box>
  )
}
