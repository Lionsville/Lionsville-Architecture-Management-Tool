// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a document may refer to, and the words that refer to it (ADR-0043
 * §9, §10).
 *
 * A document says *which* thing and the thing's own editor says *what* it
 * is: an element by `[[Name]]`, a view by `![name](view:<id>)`, and anything
 * else by one `ref` fence on lines of its own, drawn from the model each time
 * it is read:
 *
 *     ```ref
 *     principle: <scope>/<id>    (the bare id at the organisation)
 *     aspect: <n>                (optional)
 *     ```
 *     ```ref
 *     evaluation: <block id>     (the block's requirements)
 *     scope: <path>              (that scope's evaluation)
 *     at: <revision>             (optional: as it stood then)
 *     ```
 *     ```ref
 *     decision: <id>             (or observation: <id>; scope: <path> where another's)
 *     ```
 *
 * One catalogue answers the editor's *Insert ▾*, the completion while typing
 * and the agent's `references.list`, so a person and an agent refer to the
 * same things in the same words. A reference to something gone is a line
 * that says so, never an error.
 *
 * Pure.
 */
import { matchesQuery } from '../model/textSearch'

export type ReferableKind = 'view' | 'element' | 'principle' | 'evaluation' | 'decision' | 'observation'

/** The kinds in the order the menu and the completion list them. */
export const REFERABLE_KINDS: readonly ReferableKind[] = ['view', 'element', 'principle', 'evaluation', 'decision', 'observation']

export type Referable = {
  kind: ReferableKind
  /** Unique within its kind. */
  key: string
  /** What the list shows: `PR-0006 Every system we buy…`. */
  label: string
  /** A second, quieter line: the scope, the sort, the status. */
  detail?: string
  /** What is written into the document. */
  markdown: string
  /** Written on lines of its own, as a block, rather than in the sentence. */
  block: boolean
}

/** The `ref` fence's fields, as written. */
export type RefFields = Readonly<Record<string, string>>

export const REF_FENCE = 'ref'

/** A `ref` fence for these fields, in the order given; a field said empty is left out. */
export function refFence(fields: readonly (readonly [string, string | undefined])[]): string {
  const lines = fields.filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => `${key}: ${value}`)
  return `\`\`\`${REF_FENCE}\n${lines.join('\n')}\n\`\`\``
}

/** A `ref` fence's text read back: `key: value` per line, the first of a key kept; anything else is passed over. */
export function parseRef(code: string): RefFields {
  const fields: Record<string, string> = {}
  for (const line of code.split('\n')) {
    const at = line.indexOf(':')
    if (at <= 0) continue
    const key = line.slice(0, at).trim()
    const value = line.slice(at + 1).trim()
    if (key && value && !(key in fields)) fields[key] = value
  }
  return fields
}

/** Which kind a fence refers to: the first kind named among its fields; a view or an element is not a fence's. */
export function refKind(fields: RefFields): Exclude<ReferableKind, 'view' | 'element'> | undefined {
  return (['principle', 'evaluation', 'decision', 'observation'] as const).find((kind) => fields[kind] !== undefined)
}

/** A principle as a fence names it — `<scope>/<id>`, the bare id at the organisation — read back. */
export function principleOfRef(value: string): { scope: string; id: string } {
  const at = value.lastIndexOf('/')
  return at < 0 ? { scope: '', id: value } : { scope: value.slice(0, at), id: value.slice(at + 1) }
}

/** A principle as a fence names it. */
export function principleRef(scope: string, id: string): string {
  return scope === '' ? id : `${scope}/${id}`
}

/** The catalogue narrowed by what was typed, best first: kinds in their order, then by label. */
export function findReferables(all: readonly Referable[], query: string, limit = 8): Referable[] {
  const order = (kind: ReferableKind) => REFERABLE_KINDS.indexOf(kind)
  return all
    .filter((one) => matchesQuery(query, [one.label, one.detail, one.kind]))
    .sort((a, b) => order(a.kind) - order(b.kind) || a.label.localeCompare(b.label))
    .slice(0, limit)
}

/** What typing has opened a completion with: `[[`, or `@` after a space or at a line's start, and the words after it on the line. */
export function completionAt(text: string, caret: number): { start: number; query: string; trigger: '[[' | '@' } | undefined {
  const before = text.slice(0, caret)
  const line = before.slice(before.lastIndexOf('\n') + 1)
  const wiki = line.lastIndexOf('[[')
  if (wiki >= 0 && !line.slice(wiki).includes(']]')) {
    const query = line.slice(wiki + 2)
    if (query.length <= 40) return { start: caret - query.length - 2, query, trigger: '[[' }
  }
  const at = /(^|\s)@([^\s@]{0,40})$/.exec(line)
  if (at) return { start: caret - at[2]!.length - 1, query: at[2]!, trigger: '@' }
  return undefined
}

/** The text with what is between `from` and `to` replaced by the thing's markdown — a block on lines of its own — and where the caret goes. */
export function insertReferable(text: string, from: number, to: number, referable: Referable): { text: string; caret: number } {
  const head = text.slice(0, from)
  const tail = text.slice(to)
  if (!referable.block) return { text: head + referable.markdown + tail, caret: head.length + referable.markdown.length }
  const lead = head === '' || head.endsWith('\n\n') ? '' : head.endsWith('\n') ? '\n' : '\n\n'
  const trail = tail.startsWith('\n\n') ? '' : tail.startsWith('\n') ? '\n' : '\n\n'
  const inserted = `${lead}${referable.markdown}${trail}`
  return { text: head + inserted + tail, caret: head.length + inserted.length }
}
