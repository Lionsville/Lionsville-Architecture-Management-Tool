// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** The two rules the model reads: which role's holder an application's owner is, and a domain's. */
import Box from '@mui/material/Box'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Command } from '../../model/commands'
import { OPERATING_RULE_KINDS } from '../../model/operatingModel'
import type { OperatingRuleKind } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import { setRule } from '../edit'
import type { OperatingModel } from '../edit'

/** A heading on the tab: small capitals over what it names. */
export const HEADING = { fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mt: 2, mb: 1 } as const

const RULE_WORDS = {
  applicationOwner: ['operating.rule.applicationOwner', 'operating.rule.applicationOwnerAfter'],
  domainOwner: ['operating.rule.domainOwner', 'operating.rule.domainOwnerAfter'],
} as const satisfies Record<OperatingRuleKind, readonly [string, string]>

export function Rules({ model, readOnly, dispatch }: { model: OperatingModel; readOnly: boolean; dispatch(command: Command): void }) {
  const { t } = useStrings()
  const NONE = ''
  return (
    <Box data-guide="operating.rules" sx={{ mt: 3 }}>
      <Typography component="h2" sx={HEADING}>{t('operating.rules')}</Typography>
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
