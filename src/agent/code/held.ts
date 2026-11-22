// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The simulations waiting to be run (ADR-0050): what a script would change,
 * kept under a token until it is landed, discarded or too old.
 *
 * What is kept is **the commands, not the script**. A run lands exactly what
 * the simulation answered — the same commands, with the ids the answer said
 * — and never runs the script again, so nothing the script read between the
 * two can change what lands; what may have changed is the scope itself, and
 * that is what the revision each scope was tried at is for.
 *
 * **A token is 128 random bits, good once, for fifteen minutes, for whoever
 * was given it.** In memory only: a restart forgets every simulation, which
 * costs a caller one more `simulate`. A token that is unknown, used,
 * expired, discarded or somebody else's is one answer
 * (`agent.unknownSimulation`), so asking about a token tells nothing about
 * anybody else's. Each caller holds at most twenty; the oldest is let go.
 */
import type { Command } from '../../model/commands'

/** How long a simulation is held, in milliseconds. */
export const HELD_FOR_MS = 15 * 60 * 1000

/** How many simulations one caller holds at once. */
export const MOST_HELD = 20

/** One scope of a simulation: what to land there, and against what. */
export type HeldScope = {
  readonly scope: string
  /** The revision the scope was at when it was tried: it lands only if it still is. */
  readonly base: number
  readonly commands: readonly Command[]
  /** The tools whose calls made the commands, by name: what a host asks its rights about again. */
  readonly tools: readonly string[]
  /** How many calls changed it. */
  readonly writes: number
  /** The view a command made the one in front, where one did. */
  readonly activeDiagramId?: string
}

export type Simulation = {
  readonly token: string
  /** Who it was given to. */
  readonly holder: string
  /** The script's fingerprint. */
  readonly hash: string
  /** When it stops being held, in milliseconds since the epoch. */
  readonly expires: number
  readonly scopes: readonly HeldScope[]
}

export type HeldSimulations = {
  /** Hold a simulation for this caller, and answer it with its token. */
  hold(holder: string, hash: string, scopes: readonly HeldScope[]): Simulation
  /** The simulation under this token, taken: it is held no longer. Nothing for a token that is not this caller's to use. */
  take(holder: string, token: string): Simulation | undefined
  /** How many this caller holds now. */
  count(holder: string): number
}

/** A token: `sim_` and 128 random bits as hex, from the platform's own source. */
function newToken(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  return `sim_${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

export function heldSimulations(now: () => number = Date.now): HeldSimulations {
  /** By token, oldest first, as a map keeps them. */
  const held = new Map<string, Simulation>()
  const sweep = (): void => {
    const at = now()
    for (const [token, one] of held) if (one.expires <= at) held.delete(token)
  }
  return {
    hold(holder, hash, scopes) {
      sweep()
      const theirs = [...held.values()].filter((one) => one.holder === holder)
      for (const oldest of theirs.slice(0, Math.max(0, theirs.length - MOST_HELD + 1))) held.delete(oldest.token)
      const simulation: Simulation = { token: newToken(), holder, hash, expires: now() + HELD_FOR_MS, scopes }
      held.set(simulation.token, simulation)
      return simulation
    },
    take(holder, token) {
      sweep()
      const simulation = held.get(token)
      if (!simulation || simulation.holder !== holder) return undefined
      held.delete(token)
      return simulation
    },
    count(holder) {
      sweep()
      return [...held.values()].filter((one) => one.holder === holder).length
    },
  }
}
