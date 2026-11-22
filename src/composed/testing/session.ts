// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a suite: the session, driven.
 *
 * The session hook and what it is made of, for a suite that drives it against
 * a filling of its own.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { problemOffer } from '../../app/problem'
export type { ProblemFacts } from '../../app/problem'
export { flatten, pickRun, rewind, unwind } from '../../app/rebase'
export { landAcross } from '../../app/useChangeAcross'
export { useModelSession } from '../../app/useModelSession'
export type { ModelSession } from '../../app/useModelSession'
export { landBelow } from '../../session/useChangeBelow'
