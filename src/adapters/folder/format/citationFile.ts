// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The citations of principles by a scope's records, as files (ADR-0041 §7,
 * §14): one file per citing record, as a record's comments are kept.
 *
 * ```
 * _citations/<kind>-<id>.json   one record's citations, in the order they were made
 * ```
 *
 * **Why the underscore**, as `_comments/` says: a child scope's folder name is
 * a slug and cannot hold one. **Why one file per record**: a record's
 * citations travel with it — taken with it when it goes, carried by a move and
 * a merge — and a file per record is what a move takes and a merge rewrites.
 *
 * Forgiving in one direction, as the other codecs are: a row without an id, a
 * principle, a stance of the table or a day is passed over; a file that is not
 * a list is said, so the scope opens to be read and not written.
 */
import { CITATION_STANCES } from '../../../model/citable'
import type { Citation, CitationStance } from '../../../model/citable'
import type { HostModel } from '../../../model/hostModel'
import { isDay } from '../../../model/lifecycle'
import { isRecordKind } from '../../../model/recordKey'
import type { RecordKey } from '../../../model/recordKey'
import { parseJson, stableJson } from '../../../projects/text'

/** The folder the citations are kept in. Not a slug, so never a scope's name. */
export const CITATIONS_FOLDER = '_citations'

const FILE = /^_citations\/([A-Za-z]+)-([^/]+)\.json$/

/** The file a record's citations are kept in. */
export function citationsPath(about: RecordKey): string {
  return `${CITATIONS_FOLDER}/${about.kind}-${encodeURIComponent(about.id)}.json`
}

/** The record a citations file is about, by its name; nothing for a path that is not one. */
export function citingOf(path: string): RecordKey | undefined {
  const match = FILE.exec(path)
  if (!match || !isRecordKind(match[1])) return undefined
  try {
    return { kind: match[1], id: decodeURIComponent(match[2]) }
  } catch {
    return undefined
  }
}

export function isCitationsPath(path: string): boolean {
  return citingOf(path) !== undefined
}

/** The citations' files, one per citing record, in the order the citations were made. */
export function citationFiles(model: Pick<HostModel, 'citations'>): { path: string; text: string }[] {
  const files = new Map<string, Omit<Citation, 'about'>[]>()
  for (const citation of model.citations ?? []) {
    const { about, ...row } = citation
    const path = citationsPath(about)
    files.set(path, [...files.get(path) ?? [], row])
  }
  return [...files].map(([path, rows]) => ({ path, text: stableJson(rows) }))
}

function rowsIn(text: string): unknown[] | undefined {
  const held = parseJson(text)
  return Array.isArray(held) ? held : undefined
}

/** Whether a citations file is there and is not a list — the file a save must not write over. */
export function citationFileUnreadable(text: string | undefined): boolean {
  return text !== undefined && rowsIn(text) === undefined
}

const said = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value : undefined)

function citationOf(row: unknown, about: RecordKey): Citation | undefined {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return undefined
  const held = row as Record<string, unknown>
  const principle = held.principle as Record<string, unknown> | undefined
  const id = said(held.id)
  const principleId = said(principle?.id)
  const stance = held.stance as CitationStance
  if (!id || !principleId || !CITATION_STANCES.includes(stance) || !isDay(held.on)) return undefined
  const aspect = typeof held.aspect === 'number' && Number.isInteger(held.aspect) && held.aspect > 0 ? held.aspect : undefined
  const reason = said(held.reason)
  return {
    id, about,
    // The organisation's path is the empty string, which a hand-edited file may leave out.
    principle: { scope: typeof principle?.scope === 'string' ? principle.scope : '', id: principleId },
    ...(aspect !== undefined ? { aspect } : {}),
    stance,
    ...(reason !== undefined ? { reason } : {}),
    on: held.on as string,
  }
}

/** The citations out of their files, by path, in path order; one id said twice is kept once. */
export function citationsFrom(paths: readonly string[], textAt: (path: string) => string | undefined): Pick<HostModel, 'citations'> {
  const seen = new Set<string>()
  const citations: Citation[] = []
  for (const path of [...paths].filter(isCitationsPath).sort()) {
    const about = citingOf(path)!
    const text = textAt(path)
    for (const row of (text === undefined ? undefined : rowsIn(text)) ?? []) {
      const citation = citationOf(row, about)
      if (!citation || seen.has(citation.id)) continue
      seen.add(citation.id)
      citations.push(citation)
    }
  }
  return citations.length ? { citations } : {}
}
