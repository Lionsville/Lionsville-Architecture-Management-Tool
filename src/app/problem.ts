// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A problem the app ran into, said as the facts it had, and the action the
 * open source's provider offers on one (ADR-0022, amended).
 *
 * The app sends nothing itself. Where a provider offered an action, the app
 * puts it on what it already says about a problem — the crash screen, and the
 * notices a failure, a refusal or an unexpected error raise — and hands the
 * problem to the provider when, and only when, the person presses it. Nothing
 * here is written to the trail: the trail keeps keys and messages and never a
 * landscape's content, and the problem is the person's to hand over.
 *
 * Pure: the problem is worked out when it happens, so `at` and `screen` are
 * the moment it happened and not the moment somebody pressed the button.
 */
import type { Screen } from '../agent/screen'
import type { Problem, ProblemAction } from '../ports/ProviderParts'
import { ShellError } from '../platform/errors'
import type { ToastAction } from './useToasts'

export type { Problem, ProblemAction }

/** What a place that met a problem knows about it. */
export type ProblemFacts = {
  /** Where it was caught or refused. */
  readonly where: string
  /** What the person was told, or what was refused, as its key. */
  readonly key?: string | undefined
  /** The command that was refused, by its type. */
  readonly command?: string | undefined
  /** Whatever was thrown, where something was. */
  readonly cause?: unknown
}

/**
 * The action on a notice about a problem, where the open source's provider
 * offers one; nothing otherwise, and the notice is what it always was.
 */
export type ProblemOffer = (facts: ProblemFacts) => ToastAction | undefined

/** The problem, from the facts, the moment it happened and where the app was then. */
export function problemOf(facts: ProblemFacts, at: Date, screen?: Screen): Problem {
  const { where, command, cause } = facts
  const key = facts.key ?? (cause instanceof ShellError ? cause.key : undefined)
  const error = cause instanceof Error ? cause : undefined
  const message = error ? error.message : messageOf(cause)
  return {
    where,
    ...(key !== undefined ? { key } : {}),
    ...(error ? { name: error.name } : {}),
    ...(message !== undefined ? { message } : {}),
    ...(error?.stack ? { stack: error.stack } : {}),
    ...(command !== undefined ? { command } : {}),
    at: at.toISOString(),
    ...(screen ? { screen } : {}),
  }
}

/** What something thrown that is not an error says of itself, where it says anything. */
function messageOf(cause: unknown): string | undefined {
  if (cause === undefined || cause === null) return undefined
  if (typeof cause === 'string') return cause
  const message = (cause as { message?: unknown }).message
  return typeof message === 'string' ? message : undefined
}

/**
 * The offer a notice carries: the provider's words, and a press that hands it
 * the problem as it was when it happened. Nothing where no provider offered an
 * action, so a build with none draws every notice exactly as before.
 */
export function problemOffer(
  action: ProblemAction | undefined,
  label: (key: string) => string,
  screen: () => Screen | undefined,
  now: () => Date = () => new Date(),
): ProblemOffer | undefined {
  if (!action) return undefined
  return (facts) => {
    const problem = problemOf(facts, now(), screen())
    return { label: label(action.labelKey), onClick: () => action.run(problem) }
  }
}

/**
 * The offer for a notice, as the arguments after its severity: none where
 * there is none, so a notice without one is said exactly as it always was.
 */
export function offerFor(offer: ProblemOffer | undefined, facts: ProblemFacts): [] | [ToastAction] {
  const action = offer?.(facts)
  return action ? [action] : []
}
