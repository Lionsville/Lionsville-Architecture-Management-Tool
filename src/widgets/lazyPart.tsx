// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A part of the app that is not in the first download.
 *
 * The first view is a board or an organisation's page, and everything it is
 * made of arrives in the one script the page names. What a person reaches
 * later — a page behind a card, a history, a document's markdown — arrives
 * when it is reached, in a script of its own, so a first visit does not wait
 * for, or pay for, what it may never open.
 *
 * **Nothing is fetched for a part that is not on screen.** A page that takes
 * `open` is rendered by its caller whether or not it is open, which is how its
 * closing transition plays; `until` says when a part is wanted at all, and
 * until then it is nothing and costs nothing. Once it has been loaded it is
 * drawn directly, every render after, exactly as a part that was always in
 * the bundle — so what it holds between an open and the next is kept, and its
 * transition plays out.
 *
 * **A part is one boundary.** While its script is on the way it draws what
 * `fallback` says, nothing by default; a script that will not load is the
 * error the nearest boundary already draws. A script that no longer exists
 * because a deploy replaced it is `vite:preloadError`, which the boot answers
 * with a reload (`adapters/browser/staleScripts.ts`).
 *
 * Every part is also listed, so that a suite rendering the app can have all of
 * them before it starts (`preloadLazyParts`): a test that clicks a card and
 * reads the page behind it is about the page, not about the network.
 */
import { lazy, Suspense } from 'react'
import type { ComponentType, ReactNode } from 'react'

export type LazyPartOptions<P> = {
  /** Whether the part is wanted yet. Absent is always. */
  until?: (props: P) => boolean
  /** What is drawn while its script is on the way. Nothing, where absent. */
  fallback?: (props: P) => ReactNode
}

export type LazyPart<P> = ComponentType<P> & {
  /** Fetch the part's script now; the promise is the one every later render shares. */
  preload(): Promise<void>
}

/** Every part made, so a suite can have them all before it starts. */
const PARTS = new Set<() => Promise<void>>()

export function lazyPart<P extends object>(
  load: () => Promise<ComponentType<P>>,
  options: LazyPartOptions<P> = {},
): LazyPart<P> {
  let loaded: ComponentType<P> | undefined
  let loading: Promise<ComponentType<P>> | undefined
  const pending = () => lazy(async () => ({ default: await fetchPart() }))
  let Pending = pending()
  const fetchPart = (): Promise<ComponentType<P>> => {
    loading ??= load().then((part) => { loaded = part; return part }, (cause: unknown) => {
      // A failed fetch is not remembered: `lazy` would keep the rejection for
      // good, so the next render gets a fresh one and asks again — which is
      // what a person pressing the card a second time means.
      loading = undefined
      Pending = pending()
      throw cause
    })
    return loading
  }

  function Part(props: P) {
    const Loaded = loaded
    if (Loaded) return <Loaded {...props} />
    if (options.until && !options.until(props)) return null
    return (
      <Suspense fallback={options.fallback?.(props) ?? null}>
        <Pending {...props} />
      </Suspense>
    )
  }
  const preload = async (): Promise<void> => { await fetchPart() }
  PARTS.add(preload)
  return Object.assign(Part, { preload })
}

/** Load every part made so far. For a suite, before its first render. */
export async function preloadLazyParts(): Promise<void> {
  await Promise.all([...PARTS].map((preload) => preload()))
}
