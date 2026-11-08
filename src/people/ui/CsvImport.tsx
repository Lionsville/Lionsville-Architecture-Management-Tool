// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A list of people brought into the register (ADR-0036 §9): pasted, or read
 * from a file, and every row checked against the register before anyone is
 * added. A row that is plainly somebody already there adds nobody; a row
 * that only may be is flagged, with what tells them apart, and added only where
 * the person ticks *Add anyway*; a row nobody resembles is added. The tally says
 * what the button will do before it is pressed.
 */
import { useMemo, useState } from 'react'
import { plural } from '../../i18n/strings'
import { Dialog } from '../../widgets/kit/Dialog'
import { TextField } from '../../widgets/kit/Field'
import { matchRows, newPersonOf, readCsv } from '../csv'
import type { RowMatch } from '../csv'
import { shownEntry, shownText } from '../shown'
import type { Translate } from '../shown'
import type { PeopleRegisterAccess, Saying } from './access'
import { SIGN_LABEL, tellsApart } from './AddPerson'

function result(match: RowMatch, register: PeopleRegisterAccess, s: Translate): string {
  switch (match.as) {
    case 'matched': return s('people.csvMatched', { name: shownText(shownEntry(match.person), s) })
    case 'flagged': return s('people.csvFlagged', {
      names: match.candidates.map((one) => `${shownText(shownEntry(one.person), s)} (${tellsApart(one.person, register, s)}), ${s(SIGN_LABEL[one.sign])}`).join('; '),
    })
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
  const tally = (as: RowMatch['as']) => matches.filter((one) => one.as === as).length
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
    <Dialog
      open={open} size="l" title={s('people.csvTitle')} onClose={onClose} working={busy}
      actions={{
        cancel: { onClick: onClose, label: s('people.cancel') },
        outcome: { disabled: adding.length === 0, working: busy, onClick: () => { void add() }, 'data-testid': 'people-csv-add', label: plural(s, { one: 'people.csvImportOne', other: 'people.csvImportOther' }, adding.length) },
      }}
    >
      <div className="people-stack">
        <p className="people-note">{s('people.csvLead')}</p>
        <TextField label={s('people.csvRows')} rows={5} value={text} onChange={setText} data-testid="people-csv-text" />
        {readText && (
          <div>
            <label className="people-link">
              {s('people.csvChoose')}
              <input
                hidden type="file" accept=".csv,text/csv,text/plain"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void readText(file).then(setText, () => setText(''))
                }}
              />
            </label>
          </div>
        )}
        {matches.length > 0 && (
          <table className="people-csv" data-testid="people-csv-rows">
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
                  <td>{result(one, register, s)}</td>
                  <td>
                    {one.as === 'flagged' && (
                      <input
                        type="checkbox" checked={anyway.has(one.row.line)} onChange={(event) => tick(one.row.line, event.target.checked)}
                        aria-label={`${s('people.csvAddAnyway')}: ${one.row.name}`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {matches.length > 0 && (
          <p className="people-note" role="status" data-testid="people-csv-tally">
            {s('people.csvTally', { fresh: tally('new'), decide: tally('flagged'), there: tally('matched') })}
          </p>
        )}
        {matches.length > 0 && adding.length === 0 && <p className="people-note">{s('people.csvNothing')}</p>}
      </div>
    </Dialog>
  )
}
