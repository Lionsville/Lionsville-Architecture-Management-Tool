// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *New unit*, asked for on the organisation chart (ADR-0036, as built
 * 3.6.2): the type, of only those that may sit there; the name; the domains
 * it serves, asked only at the top or for a type that spans; and the scope it
 * is filed in, which defaults with the parent or the one domain it serves
 * (`newUnit.ts`) and may be any scope the person may write.
 *
 * **Where nothing may sit**, the dialog says why instead — no type may sit in
 * the parent's type, or there are no unit types at all — and offers the way
 * to change that: the operating model, or a library to start from.
 *
 * Creating is the caller's (`useNewUnit`): one step in the scope it is filed
 * in. A refusal is said here, and the dialog stays open on what was typed.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { UnitType } from '../../model/operatingModel'
import type { ScopePath } from '../../projects/scopePath'
import { PickToAdd } from '../../widgets/PickToAdd'
import { scopeChoices } from './choices'
import { asksServes, filedInChoice, filedInDefault } from './newUnit'

/** Where the unit is asked for: inside a unit, or — no parent — at the top. */
export type NewUnitPlace = { parent?: { id: string; name: string; typeName: string; scope: ScopePath | undefined } }

/** What the dialog hands back to be made. */
export type NewUnitForm = { unitTypeId: string; name: string; serves: ScopePath[]; filedIn: ScopePath }

/** Why nothing may be made here, and the way to change it. */
export type NewUnitNone = { reason: string; link: string; onLink: () => void }

export type NewUnitDialogProps = {
  place: NewUnitPlace
  /** The types that may sit there, in rank order; empty with `none`. */
  types: readonly UnitType[]
  none?: NewUnitNone | undefined
  /** Every scope, in the tree's order: the domains it may serve. */
  scopes: readonly ScopePath[]
  /** The scopes the person may write, in the tree's order: where it may be filed. */
  writable: readonly ScopePath[]
  /** The scope the chart is open in. */
  chartScope: ScopePath
  scopeLabel: (path: ScopePath) => string
  /** Make it: nothing where it was made, otherwise what to say. */
  onCreate: (form: NewUnitForm) => Promise<string | undefined>
  onClose: () => void
  s: Translate
}

export function NewUnitDialog(props: NewUnitDialogProps) {
  const { place, none, s, onClose } = props
  const parent = place.parent
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth data-testid="new-unit-dialog" data-guide="chart.newUnit">
      <DialogTitle sx={{ fontSize: 16 }}>{parent ? s('chart.addTitleInside', { name: parent.name }) : s('chart.addTitleTop')}</DialogTitle>
      {none ? <NothingMaySit none={none} onClose={onClose} s={s} /> : <NewUnitForm {...props} />}
    </Dialog>
  )
}

/** Why no unit may be made here, and the way to the place that changes it. */
function NothingMaySit({ none, onClose, s }: { none: NewUnitNone; onClose: () => void; s: Translate }) {
  return (
    <>
      <DialogContent>
        <Typography sx={{ fontSize: 13 }} data-testid="new-unit-none">{none.reason}</Typography>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose}>{s('chart.addCancel')}</Button>
        <Button size="small" variant="contained" onClick={() => { onClose(); none.onLink() }} data-testid="new-unit-link">{none.link}</Button>
      </DialogActions>
    </>
  )
}

function NewUnitForm({ place, types, scopes, writable, chartScope, scopeLabel, onCreate, onClose, s }: NewUnitDialogProps) {
  const parent = place.parent
  const [typeId, setTypeId] = useState(types[0]?.id ?? '')
  const [name, setName] = useState('')
  const [serves, setServes] = useState<ScopePath[]>([])
  const [filed, setFiled] = useState<ScopePath | undefined>(undefined)
  const [said, setSaid] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const type = types.find((one) => one.id === typeId)
  const spans = type?.spans === true
  const asked = asksServes(type, parent !== undefined)
  const servesNow = asked ? (spans ? serves : serves.slice(0, 1)) : []
  const preferred = filedInDefault({ parentScope: parent?.scope, underParent: parent !== undefined, serves: servesNow, spans, chartScope })
  const fallback = filedInChoice(preferred, chartScope, writable)
  const filedIn = filed !== undefined && writable.includes(filed) ? filed : fallback
  const ready = name.trim() !== '' && type !== undefined && filedIn !== undefined && !busy
  const create = () => {
    if (!ready || filedIn === undefined) return
    setBusy(true)
    void onCreate({ unitTypeId: typeId, name: name.trim(), serves: servesNow, filedIn }).then((refused) => {
      setBusy(false)
      if (refused === undefined) onClose()
      else setSaid(refused)
    })
  }
  return (
    <>
      <DialogContent sx={{ display: 'grid', gap: 1.25, pt: '8px !important' }}>
        <TextField
          size="small" select label={s('chart.addType')} value={typeId} onChange={(event) => setTypeId(event.target.value)}
          helperText={parent ? s('chart.addTypesIn', { type: parent.typeName }) : s('chart.addTypesTop')}
          slotProps={{ htmlInput: { 'data-testid': 'new-unit-type' } }}
        >
          {types.map((one) => <MenuItem key={one.id} value={one.id}>{one.name}</MenuItem>)}
        </TextField>
        <TextField
          size="small" label={s('chart.addName')} value={name} autoFocus onChange={(event) => setName(event.target.value)}
          // Consumed: an Enter left to the browser becomes a press of whatever button takes the focus next.
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); create() } }}
          slotProps={{ htmlInput: { 'data-testid': 'new-unit-name' } }}
        />
        {asked
          ? <ServesField serves={servesNow} spans={spans} scopes={scopes} scopeLabel={scopeLabel} onChange={setServes} s={s} />
          : <Typography sx={{ fontSize: 12, color: 'text.secondary' }} data-testid="new-unit-through">{s('chart.addServesThrough', { name: parent?.name ?? '' })}</Typography>}
        <TextField
          size="small" select label={s('chart.addFiledIn')} value={filedIn ?? ''} onChange={(event) => setFiled(event.target.value)}
          disabled={filedIn === undefined}
          helperText={filedIn === undefined ? s('chart.addFiledNowhere') : s(parent ? 'chart.addFiledInParent' : 'chart.addFiledInTop')}
          slotProps={{ htmlInput: { 'data-testid': 'new-unit-filed' } }}
        >
          {writable.map((path) => (
            <MenuItem key={path} value={path}>{path === preferred ? s('chart.addDefault', { scope: scopeLabel(path) }) : scopeLabel(path)}</MenuItem>
          ))}
        </TextField>
        {filedIn !== undefined && (
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('chart.addOneStep', { scope: scopeLabel(filedIn) })}</Typography>
        )}
        {said && <Typography role="status" data-testid="new-unit-said" sx={{ fontSize: 12, color: 'error.main' }}>{said}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose}>{s('chart.addCancel')}</Button>
        <Button size="small" variant="contained" disabled={!ready} onClick={create} data-testid="new-unit-create">{s('chart.addCreate')}</Button>
      </DialogActions>
    </>
  )
}

/** The domains a new unit serves: none yet, one, or — for a type that spans — several, picked from the scope tree. */
function ServesField({ serves, spans, scopes, scopeLabel, onChange, s }: {
  serves: readonly ScopePath[]; spans: boolean; scopes: readonly ScopePath[]; scopeLabel: (path: ScopePath) => string
  onChange: (next: ScopePath[]) => void; s: Translate
}) {
  const more = spans || serves.length === 0
  return (
    <Box data-testid="new-unit-serves">
      <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{s(spans ? 'chart.addServesMany' : 'chart.addServes')}</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center', mt: 0.25 }}>
        {serves.length === 0 && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('chart.addServesNone')}</Typography>}
        {serves.map((path) => (
          <Chip
            key={path} size="small" label={scopeLabel(path)} data-testid="new-unit-serves-chip"
            onDelete={() => onChange(serves.filter((one) => one !== path))}
          />
        ))}
        {more && (
          <PickToAdd
            options={scopeChoices({ scopes, leave: serves, scopeName: scopeLabel, s })} label={s('chart.addServesAdd')}
            field={s('pick.findScope')} nothing={s('pick.noScope')} testId="new-unit-serves-add"
            onPick={(path) => onChange([...serves, path])}
          />
        )}
      </Box>
    </Box>
  )
}
