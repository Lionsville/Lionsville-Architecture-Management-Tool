// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A chapter of a building block's document, by its heading (ADR-0043 §2, amended
 * 24 November 2026): a capability's own text — what it asks, why, its pictures —
 * is a chapter of the block's document, as a usage context's is, so it is read,
 * searched, kept and carried out with the document and needs no field of its own.
 * A chapter runs from its heading to the next heading of its level or above; a
 * line inside a fenced block is never a heading.
 *
 * Pure.
 */
import type { BlockCapability, DesignElement } from './types'

/** The heading a capability's chapter has: a level under a usage context's, which a block's document already uses. */
export function requirementHeading(capability: Pick<BlockCapability, 'text'>): string {
  return `### ${capability.text.trim()}`
}

const HEADING = /^(#{1,6})\s+\S/
const FENCE = /^\s*(```|~~~)/

/** Each line's heading level, 0 where it is none or sits inside a fenced block. */
function levels(lines: readonly string[]): number[] {
  let fenced = false
  return lines.map((line) => {
    if (FENCE.test(line)) { fenced = !fenced; return 0 }
    return fenced ? 0 : HEADING.exec(line.trim())?.[1]?.length ?? 0
  })
}

/** Where a chapter stands: its heading's line, and the line its body ends before. */
function span(lines: readonly string[], heading: string): { at: number; end: number } | undefined {
  const level = levels(lines)
  const wanted = heading.trim()
  const at = lines.findIndex((line, index) => level[index]! > 0 && line.trim() === wanted)
  if (at < 0) return undefined
  const next = level.findIndex((one, index) => index > at && one > 0 && one <= level[at]!)
  return { at, end: next < 0 ? lines.length : next }
}

/** A chapter's body, without its heading; `undefined` where the document has no such chapter. */
export function chapterBody(document: string, heading: string): string | undefined {
  const lines = document.split('\n')
  const found = span(lines, heading)
  return found ? lines.slice(found.at + 1, found.end).join('\n').trim() : undefined
}

/** Lines put together again as a document: one empty line between the parts, none at either end but the last newline. */
function joined(parts: readonly string[]): string {
  const kept = parts.map((one) => one.replace(/^\n+|\s+$/g, '')).filter((one) => one.trim().length > 0)
  return kept.length ? `${kept.join('\n\n')}\n` : ''
}

/**
 * The document with a chapter's body as given: written over the one it has,
 * taken out with its heading where the body is empty, and added where it has
 * none — at the end of the chapter `under` names, which is made at the end of
 * the document where that is missing too.
 */
export function withChapterBody(document: string, heading: string, body: string, under?: string): string {
  const lines = document.split('\n')
  const text = body.trim()
  const chapter = text ? `${heading.trim()}\n\n${text}` : ''
  const found = span(lines, heading)
  if (found) return joined([lines.slice(0, found.at).join('\n'), chapter, lines.slice(found.end).join('\n')])
  if (!text) return document
  const parent = under ? span(lines, under) : undefined
  if (parent) return joined([lines.slice(0, parent.end).join('\n'), chapter, lines.slice(parent.end).join('\n')])
  return joined([document, under ? `${under.trim()}\n\n${chapter}` : chapter])
}

/** The document with a chapter's heading said anew, its body as it was; unchanged where it has no such chapter. */
export function withChapterRenamed(document: string, from: string, to: string): string {
  const lines = document.split('\n')
  const found = span(lines, from)
  if (!found || from.trim() === to.trim()) return document
  return [...lines.slice(0, found.at), to.trim(), ...lines.slice(found.at + 1)].join('\n')
}

/** A capability as its editor leaves it: its line, and its chapter where that was written. */
export type CapabilityEdit = {
  readonly text: string
  readonly must: boolean
  readonly aspect?: BlockCapability['aspect'] | undefined
  /** The chapter's body; absent, the chapter is not written, only carried to the new heading. */
  readonly body?: string | undefined
}

/**
 * A block with one capability edited, as one patch: the line in its list, and
 * in the document its chapter under the new words — written over where a body
 * is handed in, under the heading `under` where the document had none for it.
 * The document is in the patch only where it changes.
 */
export function withCapability(
  held: Pick<DesignElement, 'capabilities' | 'description'>, id: string, edit: CapabilityEdit, under: string,
): { capabilities: BlockCapability[]; description?: string } {
  const was = (held.capabilities ?? []).find((one) => one.id === id)
  const text = edit.text.trim()
  const next: BlockCapability = { id, text, ...(edit.must ? { must: true as const } : {}), ...(was?.function ? { function: was.function } : {}), ...(edit.aspect ? { aspect: edit.aspect } : {}) }
  const capabilities = (held.capabilities ?? []).map((one) => (one.id === id ? next : one))
  const before = held.description ?? ''
  const renamed = was ? withChapterRenamed(before, requirementHeading(was), requirementHeading(next)) : before
  const written = edit.body === undefined ? renamed : withChapterBody(renamed, requirementHeading(next), edit.body, under)
  return { capabilities, ...(written !== before ? { description: written } : {}) }
}
