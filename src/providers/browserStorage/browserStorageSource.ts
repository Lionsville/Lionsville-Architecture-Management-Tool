// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * This browser's own storage: the fallback, and it says so on the bar.
 *
 * The scopes are kept in this browser's database (ADR-0031, *browser storage
 * is IndexedDB*), and what the key-value storage kept before it is brought in
 * at every start (`adapters/webStorage/earlierScopes.ts`) — copied, never
 * moved. The key-value storage stays where the preferences are kept.
 *
 * **Where the database will not open** — a browser without one, a private
 * window that allows the key-value storage and not the database — the scopes
 * are held in memory, and what the key-value storage kept before is shown
 * there: read, never moved, so the older storage is left as it was. The
 * preferences are still kept, because their storage is still there. The bar
 * says in the warning colour that nothing done here is kept, the subtitle and
 * the history's note say it too, and the strip says where the work shown came
 * from. Which it is is settled before anything is drawn (`settled`); a
 * database that only fails after waiting on another tab falls the same way,
 * and then its strip says so.
 */
import { browserRepositories } from '../../adapters/webStorage/browserRepositories'
import type { BrowserDatabase } from '../../adapters/webStorage/browserRepositories'
import type { EarlierWords } from '../../adapters/webStorage/earlierScopes'
import type { IndexedDb } from '../../adapters/webStorage/IndexedDbStore'
import type { KeyValueStorage } from '../../adapters/webStorage/KeyValueStorage'
import { WebStoragePreferencesStore } from '../../adapters/webStorage/WebStoragePreferencesStore'
import type { Translate } from '../../i18n'
import type { SourceProvider } from '../../platform/sourceProvider'
import type { WorkingSource } from '../../platform/workingSource'
import type { Diagnostics } from '../../ports/Diagnostics'
import type { PreferencesStore } from '../../ports/PreferencesStore'
import type { ProviderParts, ProviderSayings } from '../../ports/ProviderParts'
import type { Repositories } from '../../ports/Repositories'
import { memoryRepositories } from '../../adapters/memory/memoryRepositories'
import { afterWrites, browserOwn } from './browserOwn'
import type { BrowserOwn } from './browserOwn'
import { fallingBack, made } from './fallingBack'
import { olderWorkInMemory } from './olderWork'

/**
 * What this browser keeps: its database, where the scopes are, where it has
 * one, and the key-value storage, where the preferences are and where the
 * scopes were.
 */
export type BrowserOpening = {
  storage: KeyValueStorage
  database?: IndexedDb
}

export type BrowserParts = ProviderParts<BrowserOwn> & {
  repositories: Repositories
  preferences: PreferencesStore
}

type BrowserBase = { readonly diagnostics: Diagnostics; readonly s?: Translate }

/** This browser, which is one place: there is nothing to tell apart. */
export const BROWSER_STORAGE: WorkingSource = { provider: 'browserStorage', name: '', key: '' }

/** This browser, where its database would not open: nothing here outlives the tab. */
export const BROWSER_KEEPING_NOTHING: WorkingSource = { ...BROWSER_STORAGE, transient: true }

/** What is said of a source that keeps nothing — memory's own sentences, because that is what it is. */
const KEEPS_NOTHING: ProviderSayings = {
  labelKey: 'shell.sourceMemory',
  describeKey: 'shell.sourceTipMemory',
  whereKey: 'memory.where',
  removeKey: 'picker.deleteBodyBrowser',
}

/** A database that is never there, for the strip that asks after one. */
const NO_DATABASE: Pick<BrowserDatabase, 'standing' | 'onStanding'> = {
  standing: () => 'open',
  onStanding: () => () => undefined,
}

export const BROWSER_STORAGE_SOURCE: SourceProvider<BrowserParts, BrowserOpening, BrowserBase> = {
  kind: 'browserStorage',
  labelKey: 'shell.sourceBrowser',
  describeKey: 'shell.sourceTipBrowser',
  whereKey: 'browser.where',
  removeKey: 'picker.deleteBodyBrowser',
  open: ({ storage, database }, { diagnostics, s }) => {
    const preferences = new WebStoragePreferencesStore(storage)
    const by = s?.('browser.historyAuthor')
    const inMemory = () => olderWorkInMemory(storage, s?.('memory.historyAuthor'))
    if (!database) {
      const settling = inMemory().then(({ repositories, shown }) => keepingNothing(repositories, shown, preferences))
      return {
        ...keepingNothing(made(memoryRepositories(), () => settling.then((parts) => parts.repositories)), false, preferences),
        settled: () => settling,
      }
    }
    const { repositories, database: kept, earlier } = browserRepositories(database, storage, undefined, {
      ...(by ? { by } : {}), ...(s ? { earlier: earlierWords(s) } : {}),
    })
    const { own, heard, fell, answering } = browserOwn(kept, earlier)
    const writing = { ...repositories, scopes: afterWrites(repositories.scopes, kept, heard, diagnostics) }
    let fallen: Promise<BrowserParts> | undefined
    const fallback = () => fallen ??= inMemory().then(({ repositories: held, shown }) => {
      fell(shown)
      return keepingNothing(held, shown, preferences)
    })
    const parts: BrowserParts = {
      repositories: fallingBack(writing, () => fallback().then((held) => held.repositories), (cause) => {
        diagnostics.report({ level: 'warn', where: 'browserStorage', message: 'the database would not open; nothing is kept', cause })
      }),
      preferences, source: BROWSER_STORAGE, own, historyNoteKey: 'browser.historyNote',
    }
    return { ...parts, settled: () => settle(parts, kept, () => fallen, answering) }
  },
}

/**
 * How long the first frame waits on this browser's database. Before it, the
 * page waited on the database only where a last scope was to be reopened; a
 * database that never answers must not leave it blank.
 */
export const STILL_ANSWERING_MS = 4000

/**
 * The parts this browser settles on: its database's, once it opens, once it
 * waits on another tab — the strip says why it waits, and waiting is no
 * reason not to draw — or once it has kept the first frame waiting for
 * {@link STILL_ANSWERING_MS}, when the strip says it is still answering and
 * the work appears as soon as it does. Where it would not open, those of what
 * memory holds instead.
 */
async function settle(
  parts: BrowserParts, database: Pick<BrowserDatabase, 'standing' | 'onStanding'>,
  fallen: () => Promise<BrowserParts> | undefined, answering: (still: boolean) => void,
): Promise<BrowserParts> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let stop: (() => void) | undefined
  const answered = parts.repositories.scopes.tree().then(() => true, () => true)
  const late = new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), STILL_ANSWERING_MS) })
  const waits = new Promise<true>((resolve) => { stop = blocked(database, () => resolve(true)) })
  const inTime = await Promise.race([answered, late, waits])
  clearTimeout(timer)
  stop?.()
  if (!inTime) {
    answering(true)
    void answered.then(() => answering(false))
  }
  return await fallen() ?? parts
}

/** Tells once the database waits on another tab; answers the way to stop listening. */
function blocked(database: Pick<BrowserDatabase, 'standing' | 'onStanding'>, then: () => void): () => void {
  if (database.standing() === 'blocked') {
    then()
    return () => undefined
  }
  const stop = database.onStanding((standing) => {
    if (standing !== 'blocked') return
    stop()
    then()
  })
  return stop
}

/** The parts of a browser whose database would not open: memory, and what it shows. */
function keepingNothing(repositories: Repositories, shown: boolean, preferences: PreferencesStore): BrowserParts {
  const own: BrowserOwn = {
    database: NO_DATABASE,
    onFullness: () => () => undefined,
    keepsNothing: () => true,
    onKeepsNothing: () => () => undefined,
    shownFromOlder: () => shown,
    stillAnswering: () => false,
    onStillAnswering: () => () => undefined,
  }
  return {
    repositories, preferences, source: BROWSER_KEEPING_NOTHING, own,
    historyNoteKey: 'memory.historyNote', sayings: KEEPS_NOTHING,
  }
}

/** What a bringing's history entries say, in the person's language. */
function earlierWords(s: Translate): EarlierWords {
  return { earlier: s('browser.broughtOver'), again: s('browser.broughtOverAgain'), beforeAgain: s('browser.beforeBringingAgain') }
}
