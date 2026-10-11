// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The second tab: responsibilities against roles (ADR-0036 §2). A row per
 * responsibility, grouped as the organisation groups them; a column per role,
 * headed by its short name. Pressing a cell takes the role's part in that
 * responsibility to the next letter — none, R, A, C, I — and a row that is not
 * exactly one role's A says so in its last column. A flag, never a refusal.
 */
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Command } from '../../model/commands'
import type { MakeId } from '../../model/keys'
import { accountableFor, raciOf, responsibilityGroups } from '../../model/operatingModel'
import type { Raci, Responsibility, Role } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { cycleRaci, newResponsibility } from '../edit'
import type { OperatingModel } from '../edit'

type Props = {
  model: OperatingModel
  readOnly: boolean
  selected: string | undefined
  onSelect(id: string | undefined): void
  dispatch(command: Command): void
  makeId: MakeId
}

const cell = { border: 1, borderColor: 'divider', p: 0.25, textAlign: 'center', fontSize: 12 } as const

export function RaciMatrix({ model, readOnly, selected, onSelect, dispatch, makeId }: Props) {
  const { t } = useStrings()
  const groups = responsibilityGroups(model.responsibilities)
  const addResponsibility = () => {
    const command = newResponsibility(t('operating.newResponsibilityName'), makeId, undefined, model)
    dispatch(command)
    onSelect(command.responsibility.id)
  }
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        {!readOnly && (
          <Button size="small" variant="outlined" data-guide="operating.newResponsibility" sx={{ textTransform: 'none' }} onClick={addResponsibility}>
            {t('operating.newResponsibility')}
          </Button>
        )}
        <Typography variant="caption" color="text.secondary">{t('operating.raciHint')}</Typography>
      </Box>
      {model.roles.length === 0 ? (
        <Typography color="text.secondary">{t('operating.noRolesForMatrix')}</Typography>
      ) : (
        <Box component="table" data-guide="operating.matrix" sx={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <Box component="th" sx={{ ...cell, border: 0 }} />
              {model.roles.map((role) => (
                <Box component="th" key={role.id} scope="col" sx={{ ...cell, fontWeight: 700, minWidth: 34 }}>
                  <Tooltip title={role.name}><span>{role.short || role.name}</span></Tooltip>
                </Box>
              ))}
              <Box component="th" scope="col" sx={{ ...cell, textAlign: 'left' }}>{t('operating.check')}</Box>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ group, responsibilities }) => [
              <tr key={`group-${group}`}>
                <Box component="th" colSpan={model.roles.length + 2} scope="colgroup"
                  sx={{ ...cell, textAlign: 'left', bgcolor: 'action.hover', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {group || t('operating.noGroup')}
                </Box>
              </tr>,
              ...responsibilities.map((responsibility) => (
                <Row
                  key={responsibility.id} responsibility={responsibility} roles={model.roles} readOnly={readOnly}
                  picked={selected === responsibility.id} onSelect={onSelect} dispatch={dispatch} t={t}
                />
              )),
            ])}
          </tbody>
        </Box>
      )}
    </Box>
  )
}

/** What a responsibility's last column says: its one A, or that it has none or several. */
export function accountability(responsibility: string, roles: readonly Role[], t: Translate): { ok: boolean; text: string } {
  const accountable = accountableFor(roles, responsibility)
  if (accountable.length === 1) return { ok: true, text: t('operating.accountableOne', { role: accountable[0].name }) }
  if (accountable.length === 0) return { ok: false, text: t('operating.accountableNone') }
  return { ok: false, text: t('operating.accountableMany', { count: accountable.length }) }
}

const RACI_WORD: Record<Raci, 'operating.raci.R' | 'operating.raci.A' | 'operating.raci.C' | 'operating.raci.I'> = {
  R: 'operating.raci.R', A: 'operating.raci.A', C: 'operating.raci.C', I: 'operating.raci.I',
}

function Row(props: {
  responsibility: Responsibility; roles: readonly Role[]; readOnly: boolean; picked: boolean
  onSelect(id: string): void; dispatch(command: Command): void; t: Translate
}) {
  const { responsibility, roles, readOnly, picked, onSelect, dispatch, t } = props
  const check = accountability(responsibility.id, roles, t)
  return (
    <tr>
      <Box component="th" scope="row" sx={{ ...cell, textAlign: 'left', fontWeight: 400, whiteSpace: 'nowrap', bgcolor: picked ? 'action.selected' : undefined }}>
        <Button
          size="small" onClick={() => onSelect(responsibility.id)} aria-pressed={picked}
          sx={{ textTransform: 'none', p: 0, minWidth: 0, color: 'text.primary', justifyContent: 'flex-start' }}
        >
          {responsibility.name}
        </Button>
      </Box>
      {roles.map((role) => {
        const raci = raciOf(role, responsibility.id)
        const label = t('operating.cell', { responsibility: responsibility.name, role: role.name, raci: raci ? t(RACI_WORD[raci]) : t('operating.raciNone') })
        return (
          <Box component="td" key={role.id} sx={{ ...cell, bgcolor: raci === 'A' ? 'text.primary' : undefined }}>
            <Button
              size="small" aria-label={label} title={label} disabled={readOnly} data-guide="operating.cell"
              data-testid={`cell-${responsibility.id}-${role.id}`}
              onClick={() => dispatch(cycleRaci(role, responsibility.id))}
              sx={{ minWidth: 28, height: 24, p: 0, fontWeight: 700, color: raci === 'A' ? 'background.paper' : 'text.primary', '&.Mui-disabled': { color: raci === 'A' ? 'background.paper' : 'text.primary' } }}
            >
              {raci ?? ''}
            </Button>
          </Box>
        )
      })}
      <Box component="td" sx={{ ...cell, textAlign: 'left', whiteSpace: 'nowrap', color: check.ok ? 'text.secondary' : 'error.main' }}>
        {check.text}
      </Box>
    </tr>
  )
}
