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
 * **A part whose script is here is drawn directly**, in the same render as
 * the change that wanted it, exactly as a part that was always in the bundle:
 * a page opened by a press is up, and holds the focus, before the next key
 * arrives. One that waits for its script draws its fallback meanwhile, and
 * itself in the render after the script arrives. That is state of its own and
 * not a Suspense boundary: React holds a boundary that has shown its fallback
 * for 300 ms before it reveals what arrived, and the first Observations of a
 * run said *Loading…* for a third of a second over a script that took a
 * tenth. Once drawn it is drawn the same way every render after, so what it
 * holds — a dialog open in it, a person just picked — is kept.
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
 * **A part answers for its own fetch.** While its script is on the way it
 * draws what `fallback` says, nothing by default. A script that will not
 * load — offline, a network that dropped it — is drawn where the part would
 * be, in what `failed` says or one quiet line by default, with *Try again*,
 * which asks for the script anew: the screen around it goes on working, and a
 * reader whose comments would not load is still read. A part that loaded and
 * then throws is the nearest boundary's, as before. A script that no longer
 * exists because a deploy replaced it is `vite:preloadError`, which the boot
 * answers with a reload, and which puts the failure on the trail where it
 * does not (`adapters/browser/staleScripts.ts`).
 *
 * **A main page may be warmed** (`warm`): its script is fetched once the
 * first screen is drawn and the window is idle (`warmLazyParts`), so the
 * first open of a run is drawn directly, as every later one is, rather than
 * waiting for its script after the press.
 *
 * Every part is also listed, so that a suite rendering the app can have all of
 * them before it starts (`preloadLazyParts`): a test that clicks a card and
 * reads the page behind it is about the page, not about the network.
 */
import { useEffect, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useStrings } from '../i18n'
import type { StringKey } from '../i18n'

export type LazyPartOptions<P> = {
  /** Whether the part is wanted yet. Absent is always. */
  until?: (props: P) => boolean
  /** What is drawn while its script is on the way. Nothing, where absent. */
  fallback?: (props: P) => ReactNode
  /** The parts it opens on a press, fetched beside it and here before it is drawn. */
  brings?: readonly Preloadable[]
  /** What is drawn where its script will not load, with what asks for it again. {@link PartNotLoaded}, where absent. */
  failed?: (props: P, retry: () => void) => ReactNode
  /** A main page, fetched once the first screen is drawn and the window is idle (`warmLazyParts`). */
  warm?: boolean
}

/** Anything whose script can be fetched ahead of its use. */
export type Preloadable = { preload(): Promise<void> }

export type LazyPart<P> = ComponentType<P> & Preloadable

/** Every part made, so a suite can have them all before it starts. */
const PARTS = new Set<() => Promise<void>>()

/** The main pages, fetched when the window is idle after its first screen. */
const WARM = new Set<() => Promise<void>>()

/**
 * Where a part's script would not load, one quiet line and *Try again*: the
 * words a part says, or that it could not be loaded.
 */
export function PartNotLoaded({ message = 'common.partNotLoaded', onRetry }: { message?: StringKey; onRetry: () => void }) {
  const { t } = useStrings()
  return (
    <Box data-testid="part-not-loaded" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', my: 0.5 }}>
      <Typography sx={{ fontSize: 'var(--t-small)', color: 'text.secondary' }}>{t(message)}</Typography>
      <Button size="small" onClick={onRetry} data-testid="part-retry">{t('common.tryAgain')}</Button>
    </Box>
  )
}

export function lazyPart<P extends object>(
  load: () => Promise<ComponentType<P>>,
  options: LazyPartOptions<P> = {},
): LazyPart<P> {
  let loaded: ComponentType<P> | undefined
  let loading: Promise<ComponentType<P>> | undefined
  // A part brought along that will not load is asked for again when it is
  // wanted itself, where its failure is drawn: here it holds nothing back.
  const brought = () => Promise.all((options.brings ?? []).map((part) => part.preload().catch(() => undefined)))
  const fetchPart = (): Promise<ComponentType<P>> => {
    loading ??= Promise.all([load(), brought()]).then(([part]) => { loaded = part; return part }, (cause: unknown) => {
      // A failed fetch is not remembered: the next ask fetches again — which
      // is what a person pressing the card a second time means.
      loading = undefined
      throw cause
    })
    return loading
  }

  function Part(props: P) {
    // What arrived for this one, where the script came after its first render.
    const [arrived, setArrived] = useState<{ part: ComponentType<P> } | undefined>(undefined)
    const [failed, setFailed] = useState(false)
    const Loaded = loaded ?? arrived?.part
    const wanted = Loaded !== undefined || !options.until || options.until(props)
    useEffect(() => {
      if (!wanted || Loaded || failed) return undefined
      let live = true
      fetchPart().then((part) => { if (live) setArrived({ part }) }, () => { if (live) setFailed(true) })
      return () => { live = false }
    }, [wanted, Loaded, failed])
    if (Loaded) return <Loaded {...props} />
    if (!wanted) return null
    if (failed) {
      const retry = () => setFailed(false)
      return <>{options.failed?.(props, retry) ?? <PartNotLoaded onRetry={retry} />}</>
    }
    return <>{options.fallback?.(props) ?? null}</>
  }
  const preload = async (): Promise<void> => { await fetchPart() }
  PARTS.add(preload)
  if (options.warm) WARM.add(preload)
  return Object.assign(Part, { preload })
}

/** Load every part made so far. For a suite, before its first render. */
export async function preloadLazyParts(): Promise<void> {
  await Promise.all([...PARTS].map((preload) => preload()))
}

/**
 * Fetch the main pages' scripts one after another while the window is idle,
 * so the first open of each is drawn at once. Where nothing says the window is
 * idle — a suite, an old browser — nothing is fetched. A script that will not
 * load is left for the page's own open to ask for and say.
 */
export function warmLazyParts(): () => void {
  if (typeof requestIdleCallback !== 'function') return () => {}
  const waiting = [...WARM]
  let asked: number | undefined
  let stopped = false
  const next = () => {
    asked = undefined
    const one = waiting.shift()
    if (!one || stopped) return
    void one().catch(() => undefined).finally(() => { if (!stopped) asked = requestIdleCallback(next) })
  }
  asked = requestIdleCallback(next)
  return () => {
    stopped = true
    if (asked !== undefined) cancelIdleCallback(asked)
  }
}
