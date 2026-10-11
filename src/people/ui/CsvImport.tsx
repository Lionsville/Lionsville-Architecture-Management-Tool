// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A list of people brought into the register (ADR-0036 §9): pasted, or read
 * from a file, and every row checked against the register before anyone is
 * added. A row that is plainly somebody already there adds nobody; a row
 * that only may be is flagged, and added only where the person ticks *Add
 * anyway*; a row nobody resembles is added.
 */
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { plural } from '../../i18n/strings'
import { matchRows, newPersonOf, readCsv } from '../csv'
import type { RowMatch } from '../csv'
import { shownEntry, shownText } from '../shown'
import type { Translate } from '../shown'
import type { PeopleRegisterAccess, Saying } from './access'

function result(match: RowMatch, s: Translate): string {
  switch (match.as) {
    case 'matched': return s('people.csvMatched', { name: shownText(shownEntry(match.person), s) })
    case 'flagged': return s('people.csvFlagged', { names: match.candidates.map((one) => shownText(shownEntry(one.person), s)).join(', ') })
    case 'new': return s('people.csvNew')
    default: return s(match.why === 'noName' ? 'people.csvNoName' : 'people.csvBadEmail')
  }
}

export function CsvImport({ open, register, saying, readText, onClose, s }: {
  open: boolean
  register: PeopleRegisterAccess
  saying: Saying
  /** A chosen file's text, where the host can read one; pasting works everywhere. */
  readText?: (file: Blob) => Promise<string>
  onClose: () => void
  s: Translate
}) {
  const [text, setText] = useState('')
  const [anyway, setAnyway] = useState<ReadonlySet<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const matches = useMemo(() => matchRows(readCsv(text), register.people ?? []), [text, register.people])
  const adding = matches.filter((one) => one.as === 'new' || (one.as === 'flagged' && anyway.has(one.row.line)))
  const tick = (line: number, on: boolean) => setAnyway((was) => {
    const next = new Set(was)
    if (on) next.add(line)
    else next.delete(line)
    return next
  })
  const add = async () => {
    setBusy(true)
    let added = 0
    for (const one of adding) {
      if (await saying.run(register.add(newPersonOf(one.row)), () => '')) added += 1
    }
    setBusy(false)
    await saying.run(Promise.resolve({}), () => plural(s, { one: 'people.csvDoneOne', other: 'people.csvDoneOther' }, added))
    setText('')
    setAnyway(new Set())
    onClose()
  }
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontSize: 16 }}>{s('people.csvTitle')}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 13, mb: 1.5 }}>{s('people.csvLead')}</Typography>
        <TextField fullWidth multiline minRows={4} maxRows={10} label={s('people.csvRows')} value={text}
          onChange={(event) => setText(event.target.value)} slotProps={{ htmlInput: { 'data-testid': 'people-csv-text' } }} />
        {readText && (
          <Button component="label" size="small" sx={{ mt: 1 }}>
            {s('people.csvChoose')}
            <input hidden type="file" accept=".csv,text/csv,text/plain"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void readText(file).then(setText, () => setText(''))
              }} />
          </Button>
        )}
        {matches.length > 0 && (
          <Box component="table" data-testid="people-csv-rows" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, mt: 2, '& th, & td': { textAlign: 'left', py: 0.5, pr: 1, borderBottom: 1, borderColor: 'divider' } }}>
            <thead>
              <tr>
                <th>{s('people.csvColLine')}</th>
                <th>{s('people.csvColRow')}</th>
                <th>{s('people.csvColResult')}</th>
                <th>{s('people.csvAddAnyway')}</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((one) => (
                <tr key={one.row.line}>
                  <td>{one.row.line}</td>
                  <td>{[one.row.name, one.row.email].filter(Boolean).join(' · ')}</td>
                  <td>{result(one, s)}</td>
                  <td>
                    {one.as === 'flagged' && (
                      <Checkbox size="small" checked={anyway.has(one.row.line)} onChange={(event) => tick(one.row.line, event.target.checked)}
                        slotProps={{ input: { 'aria-label': `${s('people.csvAddAnyway')}: ${one.row.name}` } }} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Box>
        )}
        {matches.length > 0 && adding.length === 0 && <Typography sx={{ fontSize: 12, mt: 1 }}>{s('people.csvNothing')}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{s('people.cancel')}</Button>
        <Button variant="contained" disabled={adding.length === 0 || busy} onClick={() => { void add() }} data-testid="people-csv-add">
          {plural(s, { one: 'people.csvImportOne', other: 'people.csvImportOther' }, adding.length)}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
