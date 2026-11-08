// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The write-ahead line (`ports/PendingSteps.ts`) in this browser's key-value
 * storage, which is synchronous — the one property that matters, because the
 * line is written in the same turn as the change it holds, and a page may be
 * gone by the next.
 *
 * One key per page, source and scope: two tabs on one scope each hold their
 * own, and neither writes over the other's. Which page is still open is
 * answered by a lock each page holds for as long as it lives (the Web Locks
 * API), which the browser lets go of when the page goes — reloaded, closed,
 * crashed — so a line whose page holds no lock is one nobody is going to
 * write. Where a browser has no locks, only the line of the page this one
 * reloaded is read back (its id is in the tab's session storage, which
 * survives a reload and not a close): a line another tab may still be
 * writing is never taken.
 *
 * Bounded: a line larger than {@link MOST_HELD} is not held (the page's
 * prompt still stands for it), and a line older than {@link KEPT_FOR_MS} is
 * dropped unread at the next open.
 */
import type { HeldSteps, PendingScope, PendingSteps } from '../../ports/PendingSteps'
import type { KeyValueStorage } from './KeyValueStorage'

const PREFIX = 'lvarch.pending:'
const LOCK_PREFIX = 'lvarch.page:'
/** The page this one was before a reload, in the tab's own session storage. */
const PAGE_KEY = 'lvarch.page'

/** The most one line may take, in characters: the storage is shared with the preferences, five megabytes in all. */
export const MOST_HELD = 256 * 1024
/** A line nobody came back for in a month is a source nobody opens here any more. */
export const KEPT_FOR_MS = 30 * 24 * 60 * 60 * 1000

/** As much of the Web Locks API as this asks. */
export type PageLocks = {
  request(name: string, callback: () => Promise<void>): Promise<void>
  query(): Promise<{ held?: { name?: string }[] }>
}

/** As much of the tab's session storage as this asks. */
export type TabStorage = Pick<KeyValueStorage, 'getItem' | 'setItem'>

type Line = HeldSteps & { page: string; source: string }

/**
 * The line for one source — this browser's own place, or one folder — as this
 * page holds it.
 */
export function pendingSteps(source: string, storage: KeyValueStorage, options: {
  locks?: PageLocks | undefined
  tab?: TabStorage | undefined
  now?: () => number
  /** This page, and the page it was before a reload, where a suite says. */
  pageId?: string
  pageBefore?: string
} = {}): PendingSteps {
  const page = pageOf(options)
  const now = options.now ?? Date.now
  const keyOf = (scope: PendingScope) => `${PREFIX}${encodeURIComponent(source)}:${page.id}:${encodeURIComponent(scope.id ?? `@${scope.address}`)}`
  const ours = `${PREFIX}${encodeURIComponent(source)}:`
  const forget = (key: string) => { try { storage.removeItem(key) } catch { /* nothing to let go of where nothing could be kept */ } }

  return {
    hold: (scope, base, steps, touched) => {
      const key = keyOf(scope)
      if (steps.length === 0) { forget(key); return true }
      const line: Line = { page: page.id, source, scope, base, steps, ...(touched ? { touched } : {}), at: now() }
      const text = JSON.stringify(line)
      if (text.length > MOST_HELD) { forget(key); return false }
      try {
        storage.setItem(key, text)
        return true
      } catch {
        forget(key)
        return false
      }
    },
    clear: (scope) => forget(keyOf(scope)),
    left: async () => {
      const open = await openPages(options.locks)
      const found: (HeldSteps & { release: () => void })[] = []
      let keys: string[]
      try { keys = storage.keys() } catch { return [] }
      for (const key of keys) {
        if (!key.startsWith(ours)) continue
        const line = lineAt(storage, key)
        if (!line || now() - line.at > KEPT_FOR_MS) { forget(key); continue }
        if (line.page === page.id || line.source !== source) continue
        // A page still open writes its own; with no way to ask, only the page this one was.
        if (open ? open.has(line.page) : line.page !== page.before) continue
        const touched = line.touched && typeof line.touched === 'object' ? { touched: line.touched } : {}
        found.push({ scope: line.scope, base: line.base, steps: line.steps, ...touched, at: line.at, release: () => forget(key) })
      }
      return found.sort((a, b) => a.at - b.at)
    },
  }
}

function lineAt(storage: KeyValueStorage, key: string): Line | undefined {
  try {
    const value = JSON.parse(storage.getItem(key) ?? 'null') as Partial<Line> | null
    if (!value || typeof value.page !== 'string' || typeof value.base !== 'string' || !Array.isArray(value.steps)
      || typeof value.at !== 'number' || typeof value.scope?.address !== 'string') return undefined
    return value as Line
  } catch {
    return undefined
  }
}

/** The pages of this browser that are open now, by the locks they hold; `undefined` where it cannot be asked. */
async function openPages(locks: PageLocks | undefined): Promise<Set<string> | undefined> {
  if (!locks) return undefined
  try {
    const { held = [] } = await locks.query()
    return new Set(held.flatMap(({ name }) => name?.startsWith(LOCK_PREFIX) ? [name.slice(LOCK_PREFIX.length)] : []))
  } catch {
    return undefined
  }
}

/**
 * This page's id, the id it had before a reload, and the lock that says it
 * is open — one per page, whatever number of sources it opens.
 */
let thisPage: { id: string; before: string | undefined } | undefined

function pageOf(options: { locks?: PageLocks | undefined; tab?: TabStorage | undefined; pageId?: string; pageBefore?: string }): { id: string; before: string | undefined } {
  if (options.pageId !== undefined) return { id: options.pageId, before: options.pageBefore }
  if (thisPage) return thisPage
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  let before: string | undefined
  try {
    before = options.tab?.getItem(PAGE_KEY) ?? undefined
    options.tab?.setItem(PAGE_KEY, id)
  } catch { /* a tab that keeps nothing has no page before it */ }
  // Held until the page goes, which is when the browser lets go of it.
  options.locks?.request(`${LOCK_PREFIX}${id}`, () => new Promise<void>(() => {})).catch(() => {})
  thisPage = { id, before }
  return thisPage
}

/** This browser's locks and tab storage, where it has them. */
export function pageServices(): { locks?: PageLocks; tab?: TabStorage } {
  const out: { locks?: PageLocks; tab?: TabStorage } = {}
  try {
    const locks = typeof navigator !== 'undefined' ? (navigator as { locks?: PageLocks }).locks : undefined
    if (locks) out.locks = locks
  } catch { /* none */ }
  try {
    if (typeof sessionStorage !== 'undefined') {
      out.tab = { getItem: (key) => sessionStorage.getItem(key), setItem: (key, value) => sessionStorage.setItem(key, value) }
    }
  } catch { /* none */ }
  return out
}
