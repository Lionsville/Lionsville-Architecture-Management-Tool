// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a building block says about itself (ADR-0043 §2, §3): its
 * capabilities, its usage contexts in words with what each needs, and its
 * catalogue of solutions. The fields are the element's, written by
 * `element.update` like every other field; what they may hold is said here
 * once, for the reducer to refuse what does not hold together.
 *
 * Pure.
 */
import type {
  BlockCapability, BlockLevel, DesignElement, SolutionBlock, SolutionBlockStatus, SolutionSort, UsageContext,
} from './types'

export const BLOCK_LEVELS: readonly BlockLevel[] = [0, 1, 2, 3, 4]
export const SOLUTION_SORTS: readonly SolutionSort[] = ['product', 'service', 'inHouse']
export const SOLUTION_STATUSES: readonly SolutionBlockStatus[] = ['candidate', 'evaluated', 'inUse', 'retired']

export function isBlockLevel(held: unknown): held is BlockLevel {
  return typeof held === 'number' && (BLOCK_LEVELS as readonly number[]).includes(held)
}

/** One press on a ball: a quarter on, and from full back to empty; or a quarter back (§6). */
export function nextLevel(level: BlockLevel, by: 1 | -1 = 1): BlockLevel {
  return (((level + by) % 5) + 5) % 5 as BlockLevel
}

/** Whether every id in a list is said, and said once. */
function idsHold(list: readonly { id: string }[]): boolean {
  return list.every((one) => typeof one.id === 'string' && one.id.length > 0)
    && new Set(list.map((one) => one.id)).size === list.length
}

function capabilitiesHold(capabilities: readonly BlockCapability[]): boolean {
  return idsHold(capabilities) && capabilities.every((one) => typeof one.text === 'string' && one.text.trim().length > 0)
}

function contextsHold(contexts: readonly UsageContext[], capabilities: ReadonlySet<string>): boolean {
  return idsHold(contexts) && contexts.every((one) => typeof one.name === 'string' && one.name.trim().length > 0
    && typeof one.needs === 'object' && one.needs !== null
    && Object.entries(one.needs).every(([capability, level]) => capabilities.has(capability) && isBlockLevel(level)))
}

function solutionsHold(sbbs: readonly SolutionBlock[]): boolean {
  return idsHold(sbbs) && sbbs.every((one) => typeof one.name === 'string' && one.name.trim().length > 0
    && SOLUTION_SORTS.includes(one.sort) && SOLUTION_STATUSES.includes(one.status))
}

/**
 * Why an element's block fields do not hold together, or nothing: only a
 * building block carries them; every capability, context and solution has an
 * id of its own and a name; a context needs only capabilities the block has,
 * each at a level; a solution is of a sort and has a status.
 */
export function blockRefusal(element: Pick<DesignElement, 'kind' | 'capabilities' | 'contexts' | 'sbbs'>): 'command.badBlock' | undefined {
  const { capabilities, contexts, sbbs } = element
  if (capabilities === undefined && contexts === undefined && sbbs === undefined) return undefined
  if (element.kind !== 'buildingBlock') return 'command.badBlock'
  const held = capabilities ?? []
  const named = new Set(held.map((one) => one.id))
  return capabilitiesHold(held) && contextsHold(contexts ?? [], named) && solutionsHold(sbbs ?? []) ? undefined : 'command.badBlock'
}

/** The heading a usage context's chapter has in the block's document (§2). */
export function chapterHeading(context: Pick<UsageContext, 'name'>): string {
  return `## ${context.name.trim()}`
}

/** The document with a chapter for every context that has none yet, at the end, under its name. */
export function withChapters(document: string, contexts: readonly Pick<UsageContext, 'name' | 'description'>[]): string {
  const lines = document.split('\n').map((line) => line.trim())
  const missing = contexts.filter((one) => !lines.includes(chapterHeading(one)))
  if (missing.length === 0) return document
  const chapters = missing.map((one) => `${chapterHeading(one)}\n\n${one.description?.trim() ?? ''}`.trimEnd()).join('\n\n')
  return document.trim() ? `${document.trimEnd()}\n\n${chapters}\n` : `${chapters}\n`
}

/** The capabilities a context's needs no longer name, taken off: what is left when a capability is removed. */
export function withoutCapability(contexts: readonly UsageContext[], capability: string): UsageContext[] {
  return contexts.map((one) => {
    if (!(capability in one.needs)) return one
    const { [capability]: _gone, ...needs } = one.needs
    void _gone
    return { ...one, needs }
  })
}
