// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation's policy for the register (ADR-0036 §10): how long a
 * leaver's name is kept, how long the forgotten entry after that, and what an
 * agent sees. A setting of the organisation's, not a step; read-only where
 * the organisation's settings are not this person's to change.
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { AGENT_SEES } from '../policy'
import type { AgentSees, PeoplePolicy } from '../policy'
import type { Translate } from '../shown'
import type { PeopleRegisterAccess, Saying } from './access'
import { Section } from './parts'

const SEES_LABEL = { names: 'people.agentsNames', pseudonyms: 'people.agentsPseudonyms' } as const

function days(text: string): number | undefined {
  const value = Number(text)
  return text.trim() !== '' && Number.isInteger(value) && value >= 0 ? value : undefined
}

export function PolicyPanel({ register, saying, s }: { register: PeopleRegisterAccess; saying: Saying; s: Translate }) {
  const [keep, setKeep] = useState(String(register.policy.keepNameDays))
  const [remove, setRemove] = useState(String(register.policy.removeAfterDays))
  const [sees, setSees] = useState<AgentSees>(register.policy.agentsSee)
  const { policy } = register
  useEffect(() => {
    setKeep(String(policy.keepNameDays))
    setRemove(String(policy.removeAfterDays))
    setSees(policy.agentsSee)
  }, [policy])
  const change: Partial<PeoplePolicy> = {
    ...(days(keep) !== undefined ? { keepNameDays: days(keep) } : {}),
    ...(days(remove) !== undefined ? { removeAfterDays: days(remove) } : {}),
    agentsSee: sees,
  }
  const changed = change.keepNameDays !== policy.keepNameDays || change.removeAfterDays !== policy.removeAfterDays || sees !== policy.agentsSee
  const save = () => { void saying.run(register.setPolicy(change).then(() => ({})), () => s('people.policySaved')) }
  return (
    <Section title={s('people.policy')}>
      <Box data-testid="people-policy" data-guide="people.policy" sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1, alignItems: 'center' }}>
        <Typography component="label" htmlFor="people-keep" sx={{ fontSize: 12 }}>{s('people.keepName')}</Typography>
        <TextField id="people-keep" size="small" type="number" value={keep} disabled={register.readOnly} onChange={(event) => setKeep(event.target.value)}
          sx={{ width: 110 }} slotProps={{ htmlInput: { min: 0, 'aria-label': `${s('people.keepName')} (${s('people.days')})` } }} />
        <Typography component="label" htmlFor="people-remove" sx={{ fontSize: 12 }}>{s('people.removeAfter')}</Typography>
        <TextField id="people-remove" size="small" type="number" value={remove} disabled={register.readOnly} onChange={(event) => setRemove(event.target.value)}
          sx={{ width: 110 }} slotProps={{ htmlInput: { min: 0, 'aria-label': `${s('people.removeAfter')} (${s('people.days')})` } }} />
        <Typography component="label" htmlFor="people-sees" sx={{ fontSize: 12 }}>{s('people.agentsSee')}</Typography>
        <TextField id="people-sees" size="small" select value={sees} disabled={register.readOnly} onChange={(event) => setSees(event.target.value as AgentSees)}
          sx={{ width: 110 }} slotProps={{ select: { inputProps: { 'aria-label': s('people.agentsSee') } } }}>
          {AGENT_SEES.map((one) => <MenuItem key={one} value={one}>{s(SEES_LABEL[one])}</MenuItem>)}
        </TextField>
      </Box>
      {!register.readOnly && (
        <Button size="small" variant="outlined" disabled={!changed} onClick={save} sx={{ mt: 1 }} data-testid="people-policy-save">
          {s('people.save')}
        </Button>
      )}
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>{s('people.policyNote')}</Typography>
    </Section>
  )
}
