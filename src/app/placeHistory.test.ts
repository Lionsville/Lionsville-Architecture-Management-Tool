// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The window's history holding places (ADR-0033), over a fake window and a
 * clock: what is a step, what is not, and what Back opens.
 */
import { describe, expect, it, vi } from 'vitest'
import { PLACE_STATE_KEY } from '../agent/place'
import type { Place } from '../agent/place'
import { ARRIVAL_MS, PlaceHistory, SETTLE_MS } from './placeHistory'
import type { HistoryWindow } from './placeHistory'

type Entry = { state: unknown; url: string }

/** A window with a history of entries, and the timers and clock a test turns by hand. */
function fakeWindow(start = 'https://app.example/index.html?tenant=t1', state: unknown = null) {
  const entries: Entry[] = [{ state, url: start }]
  let at = 0
  const listeners = new Map<string, (event: { state?: unknown }) => void>()
  const win: HistoryWindow = {
    history: {
      get state() { return entries[at].state },
      pushState(next, _unused, url) {
        entries.splice(at + 1)
        entries.push({ state: next, url: new URL(url ?? entries[at].url, entries[at].url).href })
        at += 1
      },
      replaceState(next, _unused, url) {
        entries[at] = { state: next, url: new URL(url ?? entries[at].url, entries[at].url).href }
      },
    },
    location: {
      get href() { return entries[at].url },
      get hash() { return new URL(entries[at].url).hash },
    },
    addEventListener: (type, next) => { listeners.set(type, next) },
    removeEventListener: (type) => { listeners.delete(type) },
  }
  const go = (delta: number) => {
    at += delta
    listeners.get('popstate')?.({ state: entries[at].state })
  }
  /**
   * The bar's fragment changed, as a person pasting a link does: a new entry
   * with no state, then what the browser says — `popstate` and `hashchange`
   * both, or `hashchange` alone.
   */
  const paste = (hash: string, says: 'both' | 'hashchange' = 'both') => {
    entries.splice(at + 1)
    entries.push({ state: null, url: new URL(hash, entries[at].url).href })
    at += 1
    if (says === 'both') listeners.get('popstate')?.({ state: null })
    listeners.get('hashchange')?.({})
  }
  return { win, entries, go, paste, at: () => at, listening: () => listeners.size > 0 }
}

function setUp(win = fakeWindow(), nearest: (place: Place) => Promise<Place> = (place) => Promise.resolve(place)) {
  let now = 0
  let timer: { run: () => void } | undefined
  const opened: Place[] = []
  const history = new PlaceHistory(win.win, {
    open: (place) => { opened.push(place) },
    nearest,
    now: () => now,
    setTimer: (run) => { timer = { run }; return timer },
    clearTimer: (held) => { if (held === timer) timer = undefined },
  })
  const stop = history.listen()
  const settle = () => { const held = timer; timer = undefined; held?.run() }
  const look = (place: Place) => { history.look(place); settle() }
  return { history, ...win, opened, settle, look, stop, pending: () => timer !== undefined, pass: (ms: number) => { now += ms } }
}

const home: Place = { scope: '', page: 'home' }
const board: Place = { scope: 'acme', page: 'board', id: 'l7' }
const decisions = (id?: string): Place => ({ scope: 'acme', page: 'decisions', ...(id ? { id } : {}) })

describe('a look at the screen', () => {
  it('replaces the entry the window opened on with the first place, and pushes nothing', () => {
    const { look, entries } = setUp()
    look(home)
    expect(entries).toHaveLength(1)
    expect(entries[0].url).toBe('https://app.example/index.html?tenant=t1#/-/home')
    expect((entries[0].state as Record<string, unknown>)[PLACE_STATE_KEY]).toEqual(home)
  })

  it('pushes one entry for a move to another place, keeping the query and what else the state held', () => {
    const { look, entries } = setUp(fakeWindow('https://app.example/?tenant=t1', { kept: 'theirs' }))
    look(home)
    look(board)
    expect(entries).toHaveLength(2)
    expect(entries[1].url).toBe('https://app.example/?tenant=t1#/acme/-/board/l7')
    expect(entries[1].state).toEqual({ kept: 'theirs', [PLACE_STATE_KEY]: board })
    expect(entries[0].state).toEqual({ kept: 'theirs', [PLACE_STATE_KEY]: home })
  })

  it('writes nothing for a look that finds the same place', () => {
    const { look, entries } = setUp()
    look(home)
    look({ ...home })
    expect(entries).toHaveLength(1)
  })

  it('replaces the entry for another record on the same record page', () => {
    const { look, entries } = setUp()
    look(board)
    look(decisions('ADR-1'))
    look(decisions('ADR-2'))
    look(decisions())
    expect(entries).toHaveLength(2)
    expect(new URL(entries[1].url).hash).toBe('#/acme/-/decisions')
  })

  it('writes only the place a move settled on, and does not start the wait again for the same one', () => {
    const { history, entries, settle, pending } = setUp()
    history.look(home)
    settle()
    // A home, then the register over it: one move.
    history.look({ scope: 'acme', page: 'home' })
    history.look({ scope: 'acme', page: 'register' })
    expect(pending()).toBe(true)
    history.look({ scope: 'acme', page: 'register' })
    settle()
    expect(entries).toHaveLength(2)
    expect(new URL(entries[1].url).hash).toBe('#/acme/-/register')
  })

  it('takes a screen that is not a place yet for no look at all', () => {
    const { history, pending } = setUp()
    history.look(undefined)
    expect(pending()).toBe(false)
  })

  it('leaves a fragment that is not a place on the first entry, holding the place in the state alone', () => {
    const { look, entries } = setUp(fakeWindow('https://app.example/#token=abc'))
    look(home)
    expect(entries[0].url).toBe('https://app.example/#token=abc')
    expect((entries[0].state as Record<string, unknown>)[PLACE_STATE_KEY]).toEqual(home)
    look(board)
    expect(entries[1].url).toBe('https://app.example/#/acme/-/board/l7')
  })

  it('writes a place over a place the first entry carried', () => {
    const { look, entries } = setUp(fakeWindow('https://app.example/#place?scope=acme&page=board&id=gone'))
    look(board)
    expect(entries[0].url).toBe('https://app.example/#/acme/-/board/l7')
  })
})

describe('Back and Forward', () => {
  it('opens the place in the entry, and pushes nothing for the move', async () => {
    const { look, go, entries, opened, at } = setUp()
    look(home)
    look(board)
    go(-1)
    await Promise.resolve()
    expect(opened).toEqual([home])
    // Still where Back was pressed, then arrived: neither is a step.
    look(board)
    look(home)
    expect(entries).toHaveLength(2)
    expect(at()).toBe(0)
    go(1)
    await Promise.resolve()
    expect(opened).toEqual([home, board])
    look(board)
    expect(entries).toHaveLength(2)
    // And a move after it is a step again, which leaves no Forward.
    look(decisions())
    expect(entries).toHaveLength(3)
  })

  it('lands a place that is not there any more as near as there is, and writes the entry over with it', async () => {
    const near: Place = { scope: 'acme', page: 'sheet', id: 'first' }
    const { look, go, entries, opened } = setUp(fakeWindow(), (place) => Promise.resolve(place.id === 'l7' ? near : place))
    look(board)
    look(home)
    go(-1)
    await Promise.resolve()
    await Promise.resolve()
    expect(opened).toEqual([near])
    expect(new URL(entries[0].url).hash).toBe('#/acme/-/sheet/first')
    look(near)
    expect(entries).toHaveLength(2)
  })

  it('takes a landing somewhere else for where Back went, and writes it over the entry', async () => {
    const { look, go, entries } = setUp()
    look(home)
    look(board)
    go(-1)
    await Promise.resolve()
    look({ scope: '', page: 'register' })
    expect(entries).toHaveLength(2)
    expect(new URL(entries[0].url).hash).toBe('#/-/register')
  })

  it('is a person\'s move again once Back has had long enough to land', async () => {
    const { look, go, entries, pass } = setUp()
    look(home)
    look(board)
    go(-1)
    await Promise.resolve()
    pass(ARRIVAL_MS + 1)
    look(decisions())
    expect(entries).toHaveLength(2)
    expect(new URL(entries[1].url).hash).toBe('#/acme/-/decisions')
  })

  it('ignores an entry the app never wrote', async () => {
    const { go, opened, win } = setUp()
    win.history.pushState({ theirs: true }, '', '#section')
    go(-1)
    go(1)
    await Promise.resolve()
    expect(opened).toEqual([])
  })

  it('reads the place from the address where the entry\'s state lost it', async () => {
    const { look, go, opened, entries } = setUp()
    look(home)
    look(board)
    entries[0].state = null
    go(-1)
    await Promise.resolve()
    expect(opened).toEqual([home])
  })

  it('opens a link pasted into the open window with its selection, and writes the entry without it (ADR-0033, amended)', async () => {
    const { look, go, opened, entries, win } = setUp()
    look(home)
    win.history.pushState(null, '', '#place?scope=acme&page=board&id=l7&select=app-1')
    go(0)
    await Promise.resolve()
    expect(opened).toEqual([{ ...board, select: 'app-1' }])
    expect(new URL(entries.at(-1)!.url).hash).toBe('#/acme/-/board/l7')
    expect(entries.at(-1)!.state).toEqual({ 'lvarch.place': board })
  })

  it('opens a link pasted into the bar of an open window where the browser says only that the fragment changed', async () => {
    const { look, paste, opened, entries } = setUp()
    look(home)
    paste('#/acme/-/board/l7', 'hashchange')
    await Promise.resolve()
    expect(opened).toEqual([board])
    // Nothing is pushed for it: the browser made the entry, and it holds the place.
    expect(entries).toHaveLength(2)
  })

  it('opens a pasted link once where the browser says both, in the old form as well, and writes it over in the new one', async () => {
    const { look, paste, opened, entries } = setUp()
    look(home)
    paste('#place?scope=acme&page=board&id=l7')
    await Promise.resolve()
    expect(opened).toEqual([board])
    expect(new URL(entries.at(-1)!.url).hash).toBe('#/acme/-/board/l7')
    paste('#/acme/-/decisions/ADR-1')
    await Promise.resolve()
    expect(opened).toEqual([board, decisions('ADR-1')])
    expect(entries).toHaveLength(3)
  })

  it('takes a fragment that changed to what the entry holds, or to somebody else\'s, for no move', async () => {
    const { look, paste, opened } = setUp()
    look(home)
    look(board)
    paste('#/acme/-/board/l7', 'hashchange')
    paste('#section-2', 'hashchange')
    await Promise.resolve()
    expect(opened).toEqual([])
  })

  it('opens what the entry says where where it lands could not be worked out', async () => {
    const failed = vi.fn()
    const win = fakeWindow()
    const opened: Place[] = []
    const history = new PlaceHistory(win.win, {
      open: (place) => { opened.push(place) }, nearest: () => Promise.reject(new Error('no listing')), failed,
      setTimer: (run) => { run(); return undefined },
    })
    history.listen()
    history.look(home)
    history.look(board)
    win.go(-1)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(opened).toEqual([home])
    expect(failed).toHaveBeenCalled()
  })

  it('opens only the latest of two quick presses', async () => {
    let release: (() => void) | undefined
    const slow = (place: Place) => new Promise<Place>((resolve) => {
      if (place.page === 'home') release = () => resolve(place)
      else resolve(place)
    })
    const { look, go, opened } = setUp(fakeWindow(), slow)
    look(home)
    look(board)
    look(decisions())
    go(-2)
    go(1)
    await Promise.resolve()
    release?.()
    await Promise.resolve()
    expect(opened).toEqual([board])
  })

  it('drops a look not yet written when Back is pressed, and stops listening when asked', () => {
    const { history, go, entries, pending, stop, listening, look } = setUp()
    look(home)
    look(board)
    history.look(decisions())
    go(-1)
    expect(pending()).toBe(false)
    expect(entries).toHaveLength(2)
    history.look(home)
    stop()
    expect(listening()).toBe(false)
    expect(pending()).toBe(false)
  })

  it('waits the settling time with the real clock', () => {
    vi.useFakeTimers()
    try {
      const win = fakeWindow()
      const history = new PlaceHistory(win.win, { open: () => {}, nearest: (place) => Promise.resolve(place) })
      history.look(home)
      history.look(board)
      vi.advanceTimersByTime(SETTLE_MS - 1)
      expect(win.entries[0].state).toBeNull()
      vi.advanceTimersByTime(1)
      expect((win.entries[0].state as Record<string, unknown>)[PLACE_STATE_KEY]).toEqual(board)
    } finally {
      vi.useRealTimers()
    }
  })
})
