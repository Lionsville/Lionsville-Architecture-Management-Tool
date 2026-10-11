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
 * drawn every render after, open or not — so what it holds between an open
 * and the next is kept, and its transition plays out.
 *
 * **A part is drawn the way it was first drawn, for as long as it is
 * there** — first drawn being the first render that draws it at all, not the
 * caller's first, where an unwanted part is nothing. One whose script is here
 * by then is drawn directly, in the same render as the change that wanted it,
 * exactly as a part that was always in the bundle: a page opened by a press
 * is up, and holds the focus, before the next key arrives. One that waited
 * for its script stays under the boundary it waited in. Taking it out from
 * under the boundary on the next render would be a different tree, and React
 * draws a different tree anew: a dialog open in the part, a person just
 * picked in it, would be gone the first time its caller drew again.
 *
 * **A part may bring the parts it opens** (`brings`): a page that opens
 * another as the outcome of a press in it — the roadmap a plan it makes —
 * fetches that one's script beside its own and is drawn once both are here,
 * so what it opens is drawn in the moment of the press, directly, as above.
 * A page arriving a moment after the press would leave the focus where the
 * press put it back meanwhile, and the key that pressed would go on to act
 * there. What a part brings is a head start, not a need: one that will not
 * load holds nothing back, and asks again when it is itself wanted.
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
import { lazy, Suspense, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'

export type LazyPartOptions<P> = {
  /** Whether the part is wanted yet. Absent is always. */
  until?: (props: P) => boolean
  /** What is drawn while its script is on the way. Nothing, where absent. */
  fallback?: (props: P) => ReactNode
  /** The parts it opens on a press, fetched beside it and here before it is drawn. */
  brings?: readonly Preloadable[]
}

/** Anything whose script can be fetched ahead of its use. */
export type Preloadable = { preload(): Promise<void> }

export type LazyPart<P> = ComponentType<P> & Preloadable

/** How a part is drawn, fixed by the first render that draws it at all. */
type Shape = 'direct' | 'waited'

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
  // A part brought along that will not load is asked for again when it is
  // wanted itself, where its failure is drawn: here it holds nothing back.
  const brought = () => Promise.all((options.brings ?? []).map((part) => part.preload().catch(() => undefined)))
  const fetchPart = (): Promise<ComponentType<P>> => {
    loading ??= Promise.all([load(), brought()]).then(([part]) => { loaded = part; return part }, (cause: unknown) => {
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
    const [shape, setShape] = useState<Shape | undefined>(undefined)
    const Loaded = loaded
    if (!Loaded && options.until && !options.until(props)) return null
    const drawn: Shape = shape ?? (Loaded ? 'direct' : 'waited')
    // Kept from the first render that draws anything, before it is committed.
    if (shape === undefined) setShape(drawn)
    if (drawn === 'direct' && Loaded) return <Loaded {...props} />
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
