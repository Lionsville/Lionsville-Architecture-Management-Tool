// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The second tab: responsibilities against roles (ADR-0036 §2). A row per
 * responsibility, grouped as the organisation groups them; a column per role,
 * headed by its short name. Pressing a cell takes the role's part in that
 * responsibility to the next letter — none, R, A, C, I — and a row that is not
 * exactly one role's A says so in its last column. A flag, never a refusal.
 *
 * Over it, a way of looking (`matrixView`): the roles and groups kept, and
 * whether it goes in the organisation's own order or by name. In the own
 * order a group's heading moves the group up or down (`moveGroup`); a role or
 * a responsibility moves in its inspector, opened by pressing its column's
 * heading or its row's name. The check still reads every role,
 * kept or not.
 */
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { HTMLAttributes, Key } from 'react'
import type { Command } from '../../model/commands'
import type { MakeId } from '../../model/keys'
import { accountableFor, raciOf } from '../../model/operatingModel'
import type { Raci, Responsibility, Role } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import type { Translate } from '../../i18n'
import { cycleRaci, moveGroup, newResponsibility } from '../edit'
import type { OperatingModel } from '../edit'
import { groupsOf, matrixOf, roleHeading } from '../matrixView'
import type { MatrixOrder, MatrixView } from '../matrixView'

type Props = {
  model: OperatingModel
  readOnly: boolean
  selected: string | undefined
  onSelect(id: string | undefined): void
  dispatch(command: Command): void
  makeId: MakeId
  /** Kept by the page, so leaving the tab and coming back keeps it. */
  view: MatrixView
  onView(view: MatrixView): void
}

const cell = { border: 1, borderColor: 'divider', p: 0.25, textAlign: 'center', fontSize: 12 } as const

export function RaciMatrix({ model, readOnly, selected, onSelect, dispatch, makeId, view, onView }: Props) {
  const { t } = useStrings()
  const { roles, groups } = matrixOf(model, view)
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
        <>
        <MatrixLook model={model} view={view} onView={onView} />
        {groups.length === 0 && model.responsibilities.length > 0 && (
          <Typography color="text.secondary" sx={{ mb: 1 }}>{t('operating.filterEmpty')}</Typography>
        )}
        <Box component="table" data-guide="operating.matrix" sx={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <Box component="th" sx={{ ...cell, border: 0 }} />
              {roles.map((role) => (
                <Box component="th" key={role.id} scope="col" sx={{ ...cell, fontWeight: 700, minWidth: 34, bgcolor: selected === role.id ? 'action.selected' : undefined }}>
                  <Tooltip title={role.name}>
                    <Button
                      size="small" onClick={() => onSelect(role.id)} aria-pressed={selected === role.id} aria-label={role.name}
                      data-testid={`heading-${role.id}`}
                      sx={{ textTransform: 'none', p: 0, minWidth: 0, fontWeight: 700, fontSize: 12, color: 'text.primary' }}
                    >
                      {roleHeading(role)}
                    </Button>
                  </Tooltip>
                </Box>
              ))}
              <Box component="th" scope="col" sx={{ ...cell, textAlign: 'left' }}>{t('operating.check')}</Box>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ group, responsibilities }) => [
              <tr key={`group-${group}`}>
                <Box component="th" colSpan={roles.length + 2} scope="colgroup"
                  sx={{ ...cell, textAlign: 'left', bgcolor: 'action.hover', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {group || t('operating.noGroup')}
                  {group && view.order === 'own' && !readOnly && <GroupMoves group={group} model={model} dispatch={dispatch} />}
                </Box>
              </tr>,
              ...responsibilities.map((responsibility) => (
                <Row
                  key={responsibility.id} responsibility={responsibility} roles={roles} allRoles={model.roles} readOnly={readOnly}
                  picked={selected === responsibility.id} onSelect={onSelect} dispatch={dispatch} t={t}
                />
              )),
            ])}
          </tbody>
        </Box>
        </>
      )}
    </Box>
  )
}

/** The roles and groups kept, and the order: what `matrixView` is told. */
function MatrixLook({ model, view, onView }: { model: OperatingModel; view: MatrixView; onView(view: MatrixView): void }) {
  const { t } = useStrings()
  const groups = groupsOf(model.responsibilities)
  const groupName = (group: string) => group || t('operating.noGroup')
  // A box on each option, a picture of the `aria-selected` the option already says.
  const ticked = (optionProps: HTMLAttributes<HTMLLIElement> & { key: Key }, label: string, selected: boolean) => {
    const { key, ...rest } = optionProps
    return (
      <li key={key} {...rest}>
        <Checkbox size="small" checked={selected} aria-hidden slotProps={{ input: { disabled: true, tabIndex: -1 } }} sx={{ p: 0.25, mr: 0.5 }} />
        {label}
      </li>
    )
  }
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1 }}>
      <Autocomplete
        multiple disableCloseOnSelect size="small" limitTags={3} data-guide="operating.filterRoles"
        options={[...model.roles].sort((a, b) => a.name.localeCompare(b.name))}
        getOptionLabel={(role) => role.name}
        renderOption={(optionProps, role, { selected }) => ticked(optionProps, role.name, selected)}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        value={model.roles.filter((role) => view.roles.includes(role.id))}
        onChange={(_e, value) => onView({ ...view, roles: value.map((role) => role.id) })}
        renderInput={(params) => <TextField {...params} label={t('operating.filterRoles')} placeholder={view.roles.length ? '' : t('operating.filterAll')} />}
        sx={{ minWidth: 240, maxWidth: 480 }}
      />
      <Autocomplete
        multiple disableCloseOnSelect size="small" limitTags={3} data-guide="operating.filterGroups"
        options={groups} getOptionLabel={groupName}
        renderOption={(optionProps, group, { selected }) => ticked(optionProps, groupName(group), selected)}
        value={groups.filter((group) => view.groups.includes(group))}
        onChange={(_e, value) => onView({ ...view, groups: value })}
        renderInput={(params) => <TextField {...params} label={t('operating.filterGroups')} placeholder={view.groups.length ? '' : t('operating.filterAll')} />}
        sx={{ minWidth: 200, maxWidth: 420 }}
      />
      <ToggleButtonGroup
        exclusive size="small" value={view.order} aria-label={t('operating.matrixOrder')} data-guide="operating.matrixOrder"
        onChange={(_e, order: MatrixOrder | null) => { if (order) onView({ ...view, order }) }}
      >
        <ToggleButton value="own" sx={{ textTransform: 'none', py: 0.25 }}>{t('operating.orderOwn')}</ToggleButton>
        <ToggleButton value="name" sx={{ textTransform: 'none', py: 0.25 }}>{t('operating.orderName')}</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  )
}

/** A group's heading's ↑ and ↓: the group past the one beside it, one step each. */
function GroupMoves({ group, model, dispatch }: { group: string; model: OperatingModel; dispatch(command: Command): void }) {
  const { t } = useStrings()
  const up = moveGroup(model, group, -1)
  const down = moveGroup(model, group, 1)
  const arrow = { minWidth: 24, p: 0, ml: 0.25, lineHeight: 1.4, fontSize: 14, color: 'text.secondary' } as const
  return (
    <Box component="span" data-guide="operating.groupOrder" sx={{ ml: 1 }}>
      <Button size="small" aria-label={t('operating.groupUp', { group })} title={t('operating.groupUp', { group })} disabled={!up}
        onClick={() => up && dispatch(up)} sx={arrow}>↑</Button>
      <Button size="small" aria-label={t('operating.groupDown', { group })} title={t('operating.groupDown', { group })} disabled={!down}
        onClick={() => down && dispatch(down)} sx={arrow}>↓</Button>
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
  responsibility: Responsibility; roles: readonly Role[]; allRoles: readonly Role[]; readOnly: boolean; picked: boolean
  onSelect(id: string): void; dispatch(command: Command): void; t: Translate
}) {
  const { responsibility, roles, allRoles, readOnly, picked, onSelect, dispatch, t } = props
  const check = accountability(responsibility.id, allRoles, t)
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
