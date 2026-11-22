// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a `batch` asks of its steps before any is built (ADR-0011, amended
 * 22 November 2026): how many it may hold, and a step's use of what an
 * earlier step answered.
 *
 * A step's argument may be `{ "$ref": "steps[0].id" }`: the value at that
 * path in the answer of an earlier step of the same batch, put in its place
 * before the step is built. It is how a later step names the id an earlier
 * one minted without the caller guessing the slug. A reference to the step
 * itself or one after it, to a step that is not there, or to a path the
 * answer does not hold is refused with `agent.badReference`, naming it.
 */
import type { AgentAnswer } from './tools'
import { refused } from './tools'

/**
 * The most steps one batch holds. One step to a person, so one undo and one
 * Activity line; a batch larger than this is several changes the person
 * should be able to tell apart, and a body a server has to hold whole.
 */
export const MOST_STEPS = 200

const REFERENCE = /^steps\[(\d+)\]((?:\.[A-Za-z_$][\w$]*|\[\d+\])*)$/

/** The step's arguments with every reference resolved against the answers before it, or the refusal. */
export function resolved(args: unknown, answers: readonly unknown[], index: number): { args: unknown } | AgentAnswer {
  try {
    return { args: resolve(args, answers, index) }
  } catch (error) {
    if (error instanceof BadReference) return refused('agent.badReference', `steps[${index}]: ${error.message}`)
    throw error
  }
}

class BadReference extends Error {}

function resolve(value: unknown, answers: readonly unknown[], index: number): unknown {
  if (Array.isArray(value)) return value.map((item) => resolve(item, answers, index))
  if (!value || typeof value !== 'object') return value
  const held = value as Record<string, unknown>
  if (Object.keys(held).length === 1 && '$ref' in held) return follow(held.$ref, answers, index)
  return Object.fromEntries(Object.entries(held).map(([key, item]) => [key, resolve(item, answers, index)]))
}

function follow(ref: unknown, answers: readonly unknown[], index: number): unknown {
  const match = typeof ref === 'string' ? REFERENCE.exec(ref) : null
  if (!match) throw new BadReference(`${JSON.stringify(ref)} is not a reference: write "steps[<n>].<field>"`)
  const from = Number(match[1])
  if (from >= index) throw new BadReference(`${ref} names step ${from}, which is not before this one`)
  let at: unknown = answers[from]
  for (const part of match[2].match(/\.[^.[]+|\[\d+\]/g) ?? []) {
    const key = part.startsWith('.') ? part.slice(1) : Number(part.slice(1, -1))
    at = at && typeof at === 'object' ? (at as Record<string | number, unknown>)[key] : undefined
    if (at === undefined) throw new BadReference(`${ref}: step ${from} answered no ${String(key)}`)
  }
  return at
}
