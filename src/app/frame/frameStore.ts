// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the screen under the frame says about itself, and what the frame holds
 * across screens.
 *
 * The two rows stand above whichever screen is up and outlive it, while most
 * of what they say belongs to that screen: its undo stack, its save state, the
 * way to search it. So a screen publishes those facts here (`useFrameFacts`)
 * and the rows read them; a store and not a context value, so a keystroke's
 * new status draws the rows and not the whole workspace again.
 */
import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react'
import type { TypeLink } from '../../projects/scopeType'
import type { FramePanel, Page } from '../../agent/screen'
import type { DocumentStatus } from '../../projects/documentSession'
import type { ScopePath } from '../../projects/scopePath'
import type { PaletteLine } from '../../search/ui/GlobalSearchDialog'
import type { StackedBand } from '../../widgets/kit/Band'
import type { ActivityEntry, ActivityMenuProps } from '../ActivityMenu'

/** A view named in row two, on a screen that draws no tabs of its own: a home. */
export type FrameView = { readonly id: string; readonly name: string; readonly kind: string }

/** One side of the undo stack: whether it can, and what it would take back. */
export type FrameStep = { readonly can: boolean; readonly run: () => void; readonly name?: string }

/** Everything a screen tells the frame. Every field but its name and place is optional: a home has little to say. */
export type ScreenFacts = {
  readonly kind: 'home' | 'workspace'
  readonly path: ScopePath
  readonly name: string
  readonly openSearch?: () => void
  readonly openSettings?: () => void
  /** A home's views, and how to file another. A workspace's tabs come from the editor. */
  readonly views?: readonly FrameView[]
  readonly onNewView?: () => void
  readonly undo?: FrameStep
  readonly redo?: FrameStep
  /** The document's state, where a scope is open. */
  readonly status?: DocumentStatus
  readonly savedAt?: Date | null
  readonly saveFailed?: boolean
  readonly publishesSteps?: boolean
  readonly sourceStatus?: boolean
  readonly alsoHere?: readonly string[]
  readonly activity?: () => readonly ActivityEntry[]
  readonly recentActivity?: ActivityMenuProps['recent']
  readonly activityKept?: boolean
  /** A band this screen is in: looking at another day. */
  readonly bands?: readonly StackedBand[]
  /** Is a board on screen, whose canvas has a keymap of its own? And its sheet of keys. */
  readonly boardUp?: boolean
  readonly showShortcuts?: () => void
  /** The agent's newest run as a person may take it back: how many steps, and the press. */
  readonly agentRun?: () => { readonly steps: number; readonly undo?: () => void; readonly putBack?: () => void } | undefined
  /** How a scope's type stands to the units that serve it, for the tree's rows to mark a disagreement. */
  readonly typeLink?: (path: ScopePath) => TypeLink | undefined
}

export type FrameState = {
  readonly screen?: ScreenFacts
  readonly panel?: FramePanel
  /** The tab of the page that is up, where its page keeps it here (`usePlaceTab`), and which page it is of. */
  readonly tab?: string
  readonly tabOf?: Page
  /** A scope's settings, asked for by an address or an agent: the screen of that scope answers once it is up. */
  readonly asks?: 'settings'
  /** ⌘\: the tree docked on every screen, by this person's choice. */
  readonly pinned: boolean
}

export type FrameStore = {
  get(): FrameState
  set(patch: Partial<FrameState>): void
  subscribe(listener: () => void): () => void
}

export function frameStore(initial: Partial<FrameState> = {}): FrameStore {
  let state: FrameState = { pinned: false, ...initial }
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(patch) {
      const changed = (Object.keys(patch) as (keyof FrameState)[]).some((key) => patch[key] !== state[key])
      if (!changed) return
      state = { ...state, ...patch }
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export const FrameStoreContext = createContext<FrameStore | undefined>(undefined)

export type { PaletteLine }

/** What ⌘K offers beside the records, for what is typed; both screens' palettes read it. */
export const FrameCommandsContext = createContext<(asked: string) => readonly PaletteLine[]>(() => [])

export function useFrameCommands(): (asked: string) => readonly PaletteLine[] {
  return useContext(FrameCommandsContext)
}

export function useFrameState(store: FrameStore): FrameState {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

/**
 * A screen's facts, published for as long as it is mounted. Handed the same
 * values, it publishes nothing, so asking on every render costs a comparison.
 */
export function useFrameFacts(facts: ScreenFacts): void {
  const store = useContext(FrameStoreContext)
  const held = useRef(facts)
  held.current = facts
  useEffect(() => {
    if (!store) return
    const was = store.get().screen
    if (was && Object.keys({ ...was, ...facts }).every((key) => was[key as keyof ScreenFacts] === facts[key as keyof ScreenFacts])) return
    store.set({ screen: facts })
  })
  useEffect(() => () => {
    if (store?.get().screen?.kind === held.current.kind) store.set({ screen: undefined })
  }, [store])
}
