// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's architecture principles, as files (ADR-0041 §14):
 *
 * ```
 * _principles/0001-reuse-before-buy.md   one principle: its fields above, its statement below
 * _principles/groups.json                 the scope's groups, in their order
 * ```
 *
 * **Why the underscore**, as `_operating/` and `_comments/` say: a child
 * scope's folder name is a slug and cannot hold one, so no tree already has a
 * scope here, and format 15 takes the folder without moving anybody's scope.
 *
 * **The statement is the body**, as a decision's is: markdown a person reads
 * first. Everything else — the aspects with their numbers, the groups, the
 * regime and status, the notes it was sharpened with, its relations — is
 * front matter, rows where there are several, because a number that is never
 * reused is worth more kept exactly than written as a list a person might
 * renumber by hand. Rationale and implications are front matter too, quoted
 * where they run over lines, so a heading in a statement is never taken for
 * one of them.
 *
 * Forgiving in one direction, as the other codecs are: one exact shape is
 * written, and what can be read of a hand-edited one is read. A principle with
 * no id, no number or no title is passed over; an aspect without a number or
 * words is; a regime, a status or a nature that is none of the words reads as
 * the first of them. A groups file that is not a list is said, so the scope
 * opens to be read and not written: a save would write the groups empty.
 */
import type { HostModel } from '../../../model/hostModel'
import { slug } from '../../../model/keys'
import { ASPECT_NATURES, PRINCIPLE_REGIMES, PRINCIPLE_RELATION_KINDS, PRINCIPLE_STATUSES } from '../../../model/principle'
import type { Aspect, Principle, PrincipleGroup, PrincipleRelation, Sharpening } from '../../../model/principle'
import { parseJson, stableJson } from '../../../projects/text'
import {
  frontMatterNumber, frontMatterRows, frontMatterString, frontMatterText, markdownBody, readFrontMatter,
} from './fileText'
import type { FrontMatterScalar } from './fileText'

/** The folder a scope keeps its principles in. Not a slug, so never a scope's name. */
export const PRINCIPLES_FOLDER = '_principles'

export const PRINCIPLE_GROUPS_FILE = `${PRINCIPLES_FOLDER}/groups.json`

/** The list files the format writes under the folder, beside one file per principle. */
export const PRINCIPLE_LIST_FILES: readonly string[] = [PRINCIPLE_GROUPS_FILE]

const PRINCIPLE_NAME = /^\d{1,6}-.*\.md$/

function numberPrefix(number: number): string {
  return String(number).padStart(4, '0')
}

export function principlePath(principle: Pick<Principle, 'number' | 'title'>): string {
  const stem = slug(principle.title) || 'principle'
  return `${PRINCIPLES_FOLDER}/${numberPrefix(principle.number)}-${stem}.md`
}

/** Whether a path of the scope is one principle's file. */
export function isPrinciplePath(path: string): boolean {
  const [folder, name, ...rest] = path.split('/')
  return folder === PRINCIPLES_FOLDER && rest.length === 0 && name !== undefined && PRINCIPLE_NAME.test(name)
}

/** A list of words as one field: separated by commas, which a keyword or an id never holds. */
function joined(list: readonly string[] | undefined): string | undefined {
  const kept = (list ?? []).map((one) => one.replace(/,/g, ' ').trim()).filter(Boolean)
  return kept.length ? kept.join(', ') : undefined
}

function split(text: string | undefined): string[] {
  return (text ?? '').split(',').map((one) => one.trim()).filter(Boolean)
}

export function principleFileText(principle: Principle): string {
  const fields = frontMatterText({
    id: principle.id,
    number: principle.number,
    title: principle.title,
    regime: principle.regime,
    status: principle.status,
    question: principle.question,
    acceptedOn: principle.acceptedOn,
    groups: joined(principle.groups),
    keywords: joined(principle.keywords),
    lastAspect: principle.lastAspect,
    aspects: principle.aspects.map((one) => ({
      id: one.id, number: one.number, nature: one.nature, text: one.text, signal: one.signal, steering: one.steering,
    })),
    rationale: principle.rationale,
    implications: principle.implications,
    relations: (principle.relations ?? []).map((one) => ({ kind: one.kind, scope: one.to.scope, id: one.to.id })),
    sharpened: (principle.sharpened ?? []).map((one) => ({ on: one.on, note: one.note })),
    mergedInto: principle.mergedInto,
  })
  return `${fields}\n${principle.statement}\n`
}

const said = (value: FrontMatterScalar | undefined): string | undefined => {
  if (value === undefined) return undefined
  const text = String(value)
  return text.trim() ? text : undefined
}

function oneOf<T extends string>(value: string | undefined, words: readonly T[]): T {
  return words.includes(value as T) ? value as T : words[0]
}

function aspectOf(row: Record<string, FrontMatterScalar>): Aspect[] {
  const number = typeof row.number === 'number' ? row.number : Number(row.number)
  const text = said(row.text)
  const id = said(row.id)
  if (!Number.isInteger(number) || number < 1 || !text || !id) return []
  const signal = said(row.signal)
  const steering = said(row.steering)
  return [{
    id, number, text, nature: oneOf(said(row.nature), ASPECT_NATURES),
    ...(signal !== undefined ? { signal } : {}), ...(steering !== undefined ? { steering } : {}),
  }]
}

function relationOf(row: Record<string, FrontMatterScalar>): PrincipleRelation[] {
  const kind = said(row.kind)
  const id = said(row.id)
  if (!id || !PRINCIPLE_RELATION_KINDS.includes(kind as PrincipleRelation['kind'])) return []
  // The organisation's path is the empty string, written as nothing.
  return [{ kind: kind as PrincipleRelation['kind'], to: { scope: said(row.scope) ?? '', id } }]
}

function sharpeningOf(row: Record<string, FrontMatterScalar>): Sharpening[] {
  const on = said(row.on)
  const note = said(row.note)
  return on && note ? [{ on, note }] : []
}

/** One principle out of its file's text; `undefined` where it has no id, number or title. */
export function principleFromFile(text: string, _path: string): Principle | undefined {
  void _path
  const { fields, body } = readFrontMatter(text)
  const id = frontMatterString(fields, 'id')
  const number = frontMatterNumber(fields, 'number')
  const title = frontMatterString(fields, 'title')?.trim()
  if (!id || number === undefined || !Number.isInteger(number) || number < 1 || !title) return undefined
  const aspects = frontMatterRows(fields, 'aspects').flatMap(aspectOf)
  const highest = aspects.reduce((max, one) => Math.max(max, one.number), 0)
  const optional = (key: string) => {
    const value = frontMatterString(fields, key)
    return value?.trim() ? { [key]: value } : {}
  }
  const keywords = split(frontMatterString(fields, 'keywords'))
  const relations = frontMatterRows(fields, 'relations').flatMap(relationOf)
  const sharpened = frontMatterRows(fields, 'sharpened').flatMap(sharpeningOf)
  return {
    id, number, title,
    // The blank line after the fields, and the one newline the writer ends with, are the file's.
    statement: markdownBody(body).replace(/^\n/, '').replace(/\n$/, ''),
    ...optional('rationale'),
    ...optional('implications'),
    ...(keywords.length ? { keywords } : {}),
    aspects,
    // Never below what the aspects say, so a hand-edited file cannot have a number given again.
    lastAspect: Math.max(frontMatterNumber(fields, 'lastAspect') ?? 0, highest),
    groups: split(frontMatterString(fields, 'groups')),
    regime: oneOf(frontMatterString(fields, 'regime'), PRINCIPLE_REGIMES),
    status: oneOf(frontMatterString(fields, 'status'), PRINCIPLE_STATUSES),
    ...optional('question'),
    ...optional('acceptedOn'),
    ...(relations.length ? { relations } : {}),
    ...(sharpened.length ? { sharpened } : {}),
    ...optional('mergedInto'),
  } as Principle
}

/** The groups' file, where the model carries any. An absent or empty list writes no file. */
export function principleGroupFiles(model: Pick<HostModel, 'principleGroups'>): { path: string; text: string }[] {
  return model.principleGroups?.length ? [{ path: PRINCIPLE_GROUPS_FILE, text: stableJson(model.principleGroups) }] : []
}

function rowsIn(text: string | undefined): Record<string, unknown>[] | undefined {
  if (text === undefined) return []
  const held = parseJson(text)
  if (!Array.isArray(held)) return undefined
  return held.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row))
}

/** Whether the groups' file is there and is not a list — the file a save must not write over. */
export function principleGroupsUnreadable(text: string | undefined): boolean {
  return text !== undefined && rowsIn(text) === undefined
}

/** The groups out of their file, in order; one id said twice is kept once, as the first row says it. */
export function principleGroupsFrom(textAt: (path: string) => string | undefined): Pick<HostModel, 'principleGroups'> {
  const seen = new Set<string>()
  const groups = (rowsIn(textAt(PRINCIPLE_GROUPS_FILE)) ?? []).flatMap((row): PrincipleGroup[] => {
    const id = typeof row.id === 'string' ? row.id.trim() : ''
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!id || !name || seen.has(id)) return []
    seen.add(id)
    const description = typeof row.description === 'string' && row.description.trim() ? row.description : undefined
    return [{ id, name, ...(description !== undefined ? { description } : {}) }]
  })
  return groups.length ? { principleGroups: groups } : {}
}

/** Every principle among the files, in number order; a file that is not one is passed over. */
export function principlesFrom(files: readonly { path: string; text?: string }[]): Pick<HostModel, 'principles'> {
  const found: Principle[] = []
  for (const file of files) {
    if (!isPrinciplePath(file.path) || file.text === undefined) continue
    const principle = principleFromFile(file.text, file.path)
    if (principle) found.push(principle)
  }
  return found.length ? { principles: found.sort((a, b) => a.number - b.number) } : {}
}

/** The principles' files, one each. */
export function principleFiles(model: Pick<HostModel, 'principles'>): { path: string; text: string }[] {
  return (model.principles ?? []).map((one) => ({ path: principlePath(one), text: principleFileText(one) }))
}
