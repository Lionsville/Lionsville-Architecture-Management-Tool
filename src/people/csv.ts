// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * People brought into the register from a table (ADR-0036): one row per
 * person — a name, a work address where there is one, and a kind — as a
 * spreadsheet saves it, separated by commas or, as Dutch and German
 * spreadsheets save it, by semicolons.
 *
 * **Every row goes through the same check as every other way in**
 * (`duplicates.ts`): a row that is plainly someone already there — the same
 * address, or the one entry of the same name — is **matched** to them and
 * adds nobody; a row that only may be someone is **flagged**, and the person
 * importing decides; a row nobody resembles is **new**. Rows are checked
 * against each other too, so a list that names one person twice adds them
 * once.
 */
import { possibleDuplicates } from './duplicates'
import type { PossibleDuplicate } from './duplicates'
import type { NewPerson, Person, PersonKind } from './person'
import { isEmail, normalEmail, normalName } from './person'

/** One row as read: what it says, and which line of the text it was. */
export type CsvRow = { line: number; name: string; email?: string; kind?: PersonKind }

/** What a row comes to against the register. */
export type RowMatch =
  /** Someone already there: nobody is added. */
  | { row: CsvRow; as: 'matched'; person: Person }
  /** Someone who may already be there: the person importing decides. */
  | { row: CsvRow; as: 'flagged'; candidates: readonly PossibleDuplicate[] }
  /** Nobody like them: added. */
  | { row: CsvRow; as: 'new' }
  /** A row that names nobody, or whose address is none: skipped. */
  | { row: CsvRow; as: 'invalid'; why: 'noName' | 'badEmail' }

/** One line of separated values into its cells: quotes around a cell, `""` for a quote inside one. */
function cellsOf(line: string, separator: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let at = 0; at < line.length; at++) {
    const character = line[at]
    if (quoted) {
      if (character === '"' && line[at + 1] === '"') {
        cell += '"'
        at++
      } else if (character === '"') quoted = false
      else cell += character
    } else if (character === '"' && cell.trim() === '') {
      quoted = true
      cell = ''
    } else if (character === separator) {
      cells.push(cell.trim())
      cell = ''
    } else cell += character
  }
  cells.push(cell.trim())
  return cells
}

/** Semicolons where a line has more of them than commas: how a spreadsheet in a comma-decimal language saves. */
function separatorOf(lines: readonly string[]): string {
  const first = lines[0] ?? ''
  return (first.split(';').length > first.split(',').length) ? ';' : ','
}

const NAME_HEADINGS = ['name', 'naam', 'full name', 'volledige naam']
const EMAIL_HEADINGS = ['email', 'e-mail', 'work address', 'address', 'mail', 'werkadres', 'adres', 'e-mail-adresse', 'arbeitsadresse']
const KIND_HEADINGS = ['kind', 'soort', 'art', 'type']

function kindOf(cell: string | undefined): PersonKind | undefined {
  const said = (cell ?? '').trim().toLowerCase()
  if (['external', 'extern', 'externe', 'externer'].includes(said)) return 'external'
  if (['internal', 'intern', 'interne', 'interner'].includes(said)) return 'internal'
  return undefined
}

/**
 * The rows a text holds. A first line whose cells name the columns says
 * which is which; without one, the columns are name, address, kind.
 */
export function readCsv(text: string): CsvRow[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const filled = lines.map((line, at) => ({ line, at })).filter(({ line }) => line.trim() !== '')
  if (filled.length === 0) return []
  const separator = separatorOf(filled.map(({ line }) => line))
  const first = cellsOf(filled[0].line, separator).map((cell) => cell.toLowerCase())
  const heading = first.some((cell) => NAME_HEADINGS.includes(cell))
  const column = (names: readonly string[], otherwise: number) => {
    const found = first.findIndex((cell) => names.includes(cell))
    return heading ? found : otherwise
  }
  const at = { name: column(NAME_HEADINGS, 0), email: column(EMAIL_HEADINGS, 1), kind: column(KIND_HEADINGS, 2) }
  return filled.slice(heading ? 1 : 0).map(({ line, at: index }) => {
    const cells = cellsOf(line, separator)
    const email = at.email >= 0 ? cells[at.email]?.trim() : undefined
    const kind = at.kind >= 0 ? kindOf(cells[at.kind]) : undefined
    return {
      line: index + 1, name: normalName(cells[at.name] ?? ''),
      ...(email ? { email } : {}),
      ...(kind ? { kind } : {}),
    }
  })
}

/** A row as the register would take it. */
export function newPersonOf(row: CsvRow): NewPerson {
  return { name: row.name, ...(row.email ? { email: row.email } : {}), ...(row.kind ? { kind: row.kind } : {}) }
}

/**
 * Each row against the register and the rows before it. A row the same as an
 * earlier one in the list — new, or flagged and so perhaps added — is matched
 * to nobody yet and flagged, so the person importing sees the list names them
 * twice. A row is matched to an entry only where it can be nobody else: the
 * same address, or the same name with no other address beside it; two people
 * may share a name, and a different address says they may.
 */
export function matchRows(rows: readonly CsvRow[], people: readonly Person[]): RowMatch[] {
  const earlier: Person[] = []
  return rows.map((row): RowMatch => {
    if (!row.name) return { row, as: 'invalid', why: 'noName' }
    if (row.email && !isEmail(row.email)) return { row, as: 'invalid', why: 'badEmail' }
    const candidates = possibleDuplicates({ name: row.name, ...(row.email ? { email: row.email } : {}) }, [...people, ...earlier])
    const fromList = candidates.filter((one) => earlier.includes(one.person))
    const there = candidates.filter((one) => !earlier.includes(one.person))
    const sameEmail = there.filter((one) => one.sign === 'sameEmail')
    const sameName = there.filter((one) => one.sign === 'sameName')
    const otherAddress = (one: PossibleDuplicate) => Boolean(row.email && one.person.email && normalEmail(row.email) !== one.person.email)
    const sure = sameEmail.length === 1 ? sameEmail[0]
      : sameEmail.length === 0 && sameName.length === 1 && !otherAddress(sameName[0]) ? sameName[0] : undefined
    if (fromList.length === 0 && sure) return { row, as: 'matched', person: sure.person }
    earlier.push({
      id: `row-${row.line}`, name: row.name, pseudonym: '', kind: row.kind ?? 'internal', state: 'active',
      ...(row.email ? { email: normalEmail(row.email) } : {}),
    })
    return candidates.length > 0 ? { row, as: 'flagged', candidates } : { row, as: 'new' }
  })
}
