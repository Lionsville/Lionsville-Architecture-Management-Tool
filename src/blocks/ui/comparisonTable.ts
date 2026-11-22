// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A comparison carried out (ADR-0043, amended 22 November 2026): the reading the
 * grid draws (`readComparison`), as a table — the options across in rank order,
 * then each one's rank, fit and whether it was chosen, then a row per capability
 * with whether it is a must, what is needed here, and each option's coverage and
 * note. Every level is said as a figure out of four beside its word, so a
 * spreadsheet can count it. Written as tab-separated text to paste and as CSV to
 * save; the words are handed in, so this stays pure.
 */
import type { BlockLevel } from '../../model/types'
import type { ComparisonReading } from './comparisonReading'

export type TableWords = {
  readonly capability: string
  readonly must: string
  readonly needed: string
  readonly rank: string
  readonly fit: string
  readonly chosen: string
  readonly note: string
  readonly needWord: (level: BlockLevel) => string
  readonly coverWord: (level: BlockLevel) => string
  readonly fitWord: (option: ComparisonReading['options'][number]) => string
  readonly short: (count: number) => string
}

const level = (value: BlockLevel, word: string) => `${value}/4 ${word}`

export function comparisonTable(reading: ComparisonReading, words: TableWords): string[][] {
  const { options } = reading
  const pad = ['', '']
  const across = (each: (option: ComparisonReading['options'][number]) => readonly [string, string]) => options.flatMap((option) => [...each(option)])
  return [
    [words.capability, words.must, words.needed, ...across((option) => [option.sbb.name, `${option.sbb.name}: ${words.note}`])],
    [words.rank, ...pad, ...across((option) => [String(option.rank), ''])],
    [words.fit, ...pad, ...across((option) => [words.fitWord(option), ''])],
    [words.chosen, ...pad, ...across((option) => [option.chosen ? words.chosen : '', ''])],
    ...reading.capabilities.map((row) => [
      row.capability.text, row.capability.must ? words.must : '', level(row.need, words.needWord(row.need)),
      ...across((option) => {
        const cell = row.cells[option.sbb.id]!
        return [[level(cell.level, words.coverWord(cell.level)), cell.short > 0 ? words.short(cell.short) : ''].filter(Boolean).join(', '), cell.how ?? '']
      }),
    ]),
  ]
}

/** Tab-separated, as a spreadsheet or a document's table takes a paste: a tab or a line inside a cell becomes a space. */
export function asTabbed(table: readonly (readonly string[])[]): string {
  return `${table.map((row) => row.map((one) => one.replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n')}\n`
}

/** The cells of a CSV: quoted where a comma, a quote or a line would break it. */
function csvCell(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function asCsv(table: readonly (readonly string[])[]): string {
  return `${table.map((row) => row.map(csvCell).join(',')).join('\n')}\n`
}

/** A file's name for a comparison: the block and the scope, in letters and digits. */
export function comparisonFileName(block: string, scope: string): string {
  const slug = (text: string) => text.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase()
  return `${[slug(block), slug(scope)].filter(Boolean).join('-') || 'comparison'}.csv`
}
