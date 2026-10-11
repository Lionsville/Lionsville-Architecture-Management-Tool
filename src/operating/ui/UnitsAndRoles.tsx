// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The first tab: the unit types as cards — where each may sit, the roles it
 * holds and how many of each — the roles, and the rules the model reads.
 * Pressing a card or a role picks it for the inspector beside.
 */
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Command } from '../../model/commands'
import type { MakeId } from '../../model/keys'
import { OPERATING_RULE_KINDS, slotRange } from '../../model/operatingModel'
import type { OperatingRuleKind, Role, UnitType } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import { newRole, newUnitType, setRule } from '../edit'
import type { CommandOf, OperatingModel } from '../edit'

type Props = {
  model: OperatingModel
  readOnly: boolean
  selected: string | undefined
  onSelect(id: string | undefined): void
  dispatch(command: Command): void
  makeId: MakeId
  /** Where the page sends a person with nothing in it yet. */
  onOpenLibraries?(): void
}

const heading = { fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mt: 2, mb: 1 } as const

export function UnitsAndRoles({ model, readOnly, selected, onSelect, dispatch, makeId, onOpenLibraries }: Props) {
  const { t } = useStrings()
  const add = (command: CommandOf<'unitType.add'> | CommandOf<'role.add'>) => {
    dispatch(command)
    onSelect(command.type === 'unitType.add' ? command.unitType.id : command.role.id)
  }
  const held = new Set(model.unitTypes.flatMap((type) => type.slots.map((slot) => slot.role)))
  const loose = model.roles.filter((role) => !held.has(role.id))
  return (
    <Box>
      {onOpenLibraries && (
        <Box sx={{ mb: 2 }}>
          <Typography color="text.secondary">{t('operating.empty')}</Typography>
          <Button size="small" onClick={onOpenLibraries} sx={{ textTransform: 'none', px: 0 }}>{t('operating.emptyLibraries')}</Button>
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography component="h2" sx={{ ...heading, mt: 0, mb: 0 }}>{t('operating.unitTypes')}</Typography>
        {!readOnly && (
          <Button size="small" variant="outlined" data-guide="operating.newUnitType" sx={{ textTransform: 'none' }}
            onClick={() => add(newUnitType(t('operating.newUnitTypeName'), makeId, model))}>
            {t('operating.newUnitType')}
          </Button>
        )}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
        {model.unitTypes.map((type) => (
          <TypeCard key={type.id} type={type} model={model} selected={selected} onSelect={onSelect} />
        ))}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 3 }}>
        <Typography component="h2" sx={{ ...heading, mt: 0, mb: 0 }}>{t('operating.roles')}</Typography>
        {!readOnly && (
          <Button size="small" variant="outlined" data-guide="operating.newRole" sx={{ textTransform: 'none' }}
            onClick={() => add(newRole(t('operating.newRoleName'), makeId, model))}>
            {t('operating.newRole')}
          </Button>
        )}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
        {model.roles.map((role) => <RoleChip key={role.id} role={role} selected={selected === role.id} onSelect={onSelect} />)}
      </Box>
      {loose.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {t('operating.looseRoles')}: {loose.map((role) => role.name).join(', ')}
        </Typography>
      )}

      <Rules model={model} readOnly={readOnly} dispatch={dispatch} />
    </Box>
  )
}

function TypeCard({ type, model, selected, onSelect }: { type: UnitType; model: OperatingModel; selected: string | undefined; onSelect(id: string): void }) {
  const { t } = useStrings()
  const typeName = (id: string) => model.unitTypes.find((one) => one.id === id)?.name ?? id
  const where = [...(type.top ? [t('operating.atTheTop')] : []), ...type.within.map(typeName)]
  const on = selected === type.id
  return (
    <Box
      data-testid={`unit-type-${type.id}`}
      sx={{
        width: 260, border: 1, borderColor: on ? 'primary.main' : 'divider', borderRadius: 1, p: 1.25,
        bgcolor: 'background.paper', boxShadow: on ? 2 : 0,
      }}
    >
      <Button
        onClick={() => onSelect(type.id)} aria-pressed={on}
        sx={{ p: 0, minWidth: 0, textTransform: 'none', fontWeight: 700, fontSize: 14, justifyContent: 'flex-start', color: 'text.primary' }}
      >
        {type.name}
      </Button>
      {type.spans && <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>{t('operating.spansBadge')}</Typography>}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {t('operating.sitsIn', { where: where.length ? where.join(', ') : t('operating.nowhere') })}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
        {type.slots.map((slot, index) => {
          const role = model.roles.find((one) => one.id === slot.role)
          return (
            <Button
              key={`${slot.role}-${index}`} size="small" variant="outlined" onClick={() => onSelect(slot.role)}
              aria-pressed={selected === slot.role}
              sx={{ textTransform: 'none', py: 0, px: 0.75, minWidth: 0, fontSize: 12, borderColor: selected === slot.role ? 'primary.main' : 'divider' }}
            >
              {role?.name ?? slot.role}
              {role?.manages && <Box component="span" sx={{ ml: 0.5, fontSize: 10, color: 'primary.main' }}>{t('operating.managesBadge')}</Box>}
              <Box component="span" sx={{ ml: 0.5, color: 'text.secondary' }}>{slotRange(slot)}</Box>
            </Button>
          )
        })}
      </Box>
      {type.limit !== undefined && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{t('operating.limitLine', { count: type.limit })}</Typography>
      )}
    </Box>
  )
}

function RoleChip({ role, selected, onSelect }: { role: Role; selected: boolean; onSelect(id: string): void }) {
  const { t } = useStrings()
  return (
    <Button
      size="small" variant={selected ? 'contained' : 'outlined'} onClick={() => onSelect(role.id)} aria-pressed={selected}
      data-testid={`role-${role.id}`} sx={{ textTransform: 'none', py: 0.25 }}
    >
      {role.name}
      {role.short && <Box component="span" sx={{ ml: 0.75, fontSize: 11 }}>{role.short}</Box>}
      {role.manages && <Box component="span" sx={{ ml: 0.75, fontSize: 10 }}>{t('operating.managesBadge')}</Box>}
    </Button>
  )
}

const RULE_WORDS = {
  applicationOwner: ['operating.rule.applicationOwner', 'operating.rule.applicationOwnerAfter'],
  domainOwner: ['operating.rule.domainOwner', 'operating.rule.domainOwnerAfter'],
} as const satisfies Record<OperatingRuleKind, readonly [string, string]>

/** The two rules: which role's holder an application's owner, and a domain's, is. */
function Rules({ model, readOnly, dispatch }: { model: OperatingModel; readOnly: boolean; dispatch(command: Command): void }) {
  const { t } = useStrings()
  const NONE = ''
  return (
    <Box data-guide="operating.rules" sx={{ mt: 3 }}>
      <Typography component="h2" sx={heading}>{t('operating.rules')}</Typography>
      {OPERATING_RULE_KINDS.map((kind) => {
        const [before, after] = RULE_WORDS[kind]
        const role = model.operatingRules.find((rule) => rule.id === kind)?.role ?? NONE
        return (
          <Box key={kind} sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, my: 0.75, fontSize: 14 }}>
            <span>{t(before)}</span>
            <TextField
              select size="small" value={role} disabled={readOnly}
              slotProps={{ htmlInput: { 'aria-label': t(before) } }}
              sx={{ minWidth: 180 }}
              onChange={(event) => {
                const next = setRule(model.operatingRules, kind, event.target.value === NONE ? undefined : event.target.value)
                if (next) dispatch(next)
              }}
            >
              <MenuItem value={NONE}><em>{t('operating.rule.none')}</em></MenuItem>
              {model.roles.map((one) => <MenuItem key={one.id} value={one.id}>{one.name}</MenuItem>)}
            </TextField>
            <span>{t(after)}</span>
          </Box>
        )
      })}
      <Typography variant="caption" color="text.secondary">{t('operating.rulesHint')}</Typography>
    </Box>
  )
}
