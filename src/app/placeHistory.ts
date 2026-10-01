// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The window's history, holding places (ADR-0033).
 *
 * One history for both builds, and it is the window's own: in a browser its
 * Back, its keys and its gestures move it, and on the desktop the bar's Back
 * is `history.back()` pressed from inside the page. What the app adds is
 * telling the window when it moved, and moving when the window says it did.
 *
 * - **A look.** The shell looks at the screen after every move, whoever made
 *   it (`useShellAgent`'s `lookAgain`), and hands the place it found here.
 *   A look that finds a different place is a step: pushed, with the place in
 *   the entry's state and in the address's fragment (`agent/place.ts`) — or
 *   replaced, for another record on the same record page and for the first
 *   place there is (`stepBetween`).
 * - **Settled first.** One move is often several looks: a scope is chosen and
 *   then its workspace is up, a home is up and then the register over it, a
 *   page opens and then lands on the record it was asked for. Each of those
 *   in between is a place for a moment, and a Back that went to one of them
 *   would go nowhere anybody was. So a look waits {@link SETTLE_MS} for the
 *   next, and only the place the move settled on is written. A look that
 *   finds the place already waiting does not start the wait again, because
 *   the workspace looks on every render and typing would otherwise keep a
 *   move from ever being written.
 * - **Back and Forward.** The window says it moved (`popstate`), and the place
 *   in the entry is opened the way `app.open` opens one. That move is the
 *   history moving and not a step: it is marked before it is made, the way an
 *   agent's move is, and until the app has landed somewhere — anywhere but
 *   where it was — no look is written. A place that is not there any more is
 *   first worked out to where it lands now (`nearestPlace`), and the entry is
 *   written over with that, so a reload goes there too.
 *
 * What is kept in an entry beside the place is whatever other code kept
 * there: the state is merged into, never replaced, and the query string is
 * left as it is — only the fragment carries a place. The first entry keeps
 * a fragment that is not a place, which a source may have opened the app
 * with, and holds its place in the state alone.
 *
 * No React: a class with a window handed in, so every rule here is a node
 * test with a fake window and a clock (`placeHistory.test.ts`).
 */
import { PLACE_STATE_KEY, placeInState, readPlace, samePlace, stepBetween, writePlace } from '../agent/place'
import type { Place } from '../agent/place'

/** How long a look waits for the next before the place is written. */
export const SETTLE_MS = 150

/** How long Back may take to land before a look is a person's move again. */
export const ARRIVAL_MS = 10_000

/** As much of a window as the history needs. */
export type HistoryWindow = {
  readonly history: {
    readonly state: unknown
    pushState(state: unknown, unused: string, url?: string): void
    replaceState(state: unknown, unused: string, url?: string): void
  }
  readonly location: { readonly href: string; readonly hash: string }
  addEventListener(type: 'popstate', listener: (event: { state: unknown }) => void): void
  removeEventListener(type: 'popstate', listener: (event: { state: unknown }) => void): void
}

export type PlaceHistoryOptions = {
  /** Open a place, the way `app.open` moves the app. */
  open: (place: Place) => void
  /** Where a place lands now: itself, or as near to it as there is. */
  nearest: (place: Place) => Promise<Place>
  /** Somewhere a failure is said, for a place that could not be worked out. */
  failed?: (cause: unknown) => void
  now?: () => number
  setTimer?: (run: () => void, ms: number) => unknown
  clearTimer?: (timer: unknown) => void
}

/** A history move in flight: where it was made from and where it is going. */
type Moving = { from: Place | undefined; until: number }

export class PlaceHistory {
  readonly #window: HistoryWindow
  readonly #options: Required<Omit<PlaceHistoryOptions, 'failed'>> & Pick<PlaceHistoryOptions, 'failed'>
  /** The place the current entry holds, as this class last wrote or was told it. */
  #entry: Place | undefined
  /** The place the last look found, written or not. */
  #seen: Place | undefined
  #pending: Place | undefined
  #timer: unknown
  #moving: Moving | undefined
  /** Which Back is the latest, so a slow one does not open after a later one. */
  #pops = 0
  readonly #onPop = (event: { state: unknown }) => { this.popped(event.state) }

  constructor(window: HistoryWindow, options: PlaceHistoryOptions) {
    this.#window = window
    this.#options = {
      now: () => Date.now(),
      setTimer: (run, ms) => setTimeout(run, ms),
      clearTimer: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
      ...options,
    }
  }

  /** Listen for the window's own moves; the answer stops listening and drops a look not yet written. */
  listen(): () => void {
    this.#window.addEventListener('popstate', this.#onPop)
    return () => {
      this.#window.removeEventListener('popstate', this.#onPop)
      this.#cancel()
    }
  }

  /** The place the screen is now, after a move or a render: nothing for a screen that is not a place yet. */
  look(place: Place | undefined): void {
    if (place === undefined) return
    this.#seen = place
    if (this.#timer !== undefined && samePlace(this.#pending, place)) return
    this.#pending = place
    if (this.#timer !== undefined) this.#options.clearTimer(this.#timer)
    this.#timer = this.#options.setTimer(() => this.settle(), SETTLE_MS)
  }

  /** Write what the looks settled on. Called by the timer; a test may call it at once. */
  settle(): void {
    this.#timer = undefined
    const place = this.#pending
    this.#pending = undefined
    if (place === undefined) return
    const moving = this.#moving
    if (moving && this.#options.now() <= moving.until) {
      // Still where Back was pressed: the move has not happened yet.
      if (samePlace(place, moving.from) && !samePlace(place, this.#entry)) return
      this.#moving = undefined
      if (!samePlace(place, this.#entry)) this.#write('replace', place)
      return
    }
    this.#moving = undefined
    const step = stepBetween(this.#entry, place)
    if (step !== 'none') this.#write(step, place)
  }

  /** The window moved: open the place its entry holds. */
  popped(state: unknown): void {
    const place = placeInState(state) ?? readPlace(this.#window.location.hash)
    // An entry the app never wrote: not one of its places, and nothing to open.
    if (place === undefined) return
    this.#cancel()
    this.#moving = { from: this.#seen, until: this.#options.now() + ARRIVAL_MS }
    this.#entry = place
    const pop = ++this.#pops
    this.#options.nearest(place).then((near) => {
      if (pop !== this.#pops) return
      if (!samePlace(near, place)) this.#write('replace', near)
      this.#options.open(near)
    }, (cause: unknown) => {
      if (pop !== this.#pops) return
      // Not worked out: opened as the entry says, which is what a link to it does.
      this.#options.failed?.(cause)
      this.#options.open(place)
    })
  }

  #cancel(): void {
    if (this.#timer !== undefined) this.#options.clearTimer(this.#timer)
    this.#timer = undefined
    this.#pending = undefined
  }

  #write(step: 'push' | 'replace', place: Place): void {
    const { history, location } = this.#window
    const first = this.#entry === undefined
    const state = { ...(typeof history.state === 'object' && history.state !== null ? history.state : {}), [PLACE_STATE_KEY]: place }
    const url = new URL(location.href)
    // The first entry keeps a fragment that is somebody else's.
    if (!(first && url.hash !== '' && readPlace(url.hash) === undefined)) url.hash = writePlace(place)
    const to = `${url.pathname}${url.search}${url.hash}`
    if (step === 'push') history.pushState(state, '', to)
    else history.replaceState(state, '', to)
    this.#entry = place
  }
}
