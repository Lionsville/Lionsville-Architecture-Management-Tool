// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The pictures a page shows, handed down (ADR-0031 §3).
 *
 * {@link PicturesProvider} says, once for everything under it, which scope's
 * library the documents below name pictures from, and the {@link ImageSource}
 * their bytes are asked of. The composition fills it from the source's image
 * repository; a test or a story fills it from `memoryImageSource`. Without
 * one, every picture is its alt text, and nothing is asked.
 *
 * {@link LibraryPicture} is one picture in a page. It takes its place from
 * the library entry's dimensions in the render that first draws it, so
 * nothing moves when the bytes arrive, and it asks for its bytes when it
 * comes into view — through {@link PictureWatch}, which is an
 * `IntersectionObserver` in a browser and can be driven by hand in a test.
 */
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import { imageNameKey } from '../../model/imageName'
import type { ImageEntry, ImageName } from '../../model/imageName'
import { NO_PICTURES, PictureCache } from '../pictureSource'
import type { ImageSource, PictureAddresses } from '../pictureSource'

/**
 * Tell `seen` once, when `element` comes into view, and answer how to stop
 * watching. `afresh` counts only a coming into view after the element has
 * been out of it: what a picture whose bytes did not arrive waits for before
 * it asks again, rather than asking again and again while it sits in view. A
 * watch that cannot tell treats the element as seen, and as never seen afresh.
 */
export type PictureWatch = (element: Element, seen: () => void, afresh?: boolean) => () => void

/**
 * How far outside the visible part a picture counts as coming into view: a
 * little, so a picture scrolled towards is on its way before it is there, and
 * one a long document keeps far below is never asked for. The margin is the
 * window's: a document scrolling inside a sheet of its own has its pictures
 * seen as they appear in the sheet, with no margin at the sheet's edge.
 */
export const AHEAD = '200px 0px'

/** What a watch that cannot tell does: every picture is seen at once, and never afresh. */
function seenAtOnce(): PictureWatch {
  return (_element, seen, afresh) => {
    if (!afresh) seen()
    return () => undefined
  }
}

/**
 * One observer for every picture under a provider, rather than one each: a
 * long document holds dozens, and an observer is cheap to share and not to
 * make.
 */
export function watchInView(): PictureWatch {
  if (typeof IntersectionObserver !== 'function') return seenAtOnce()
  const waiting = new Map<Element, { seen: () => void; ready: boolean }>()
  let observer: IntersectionObserver | undefined
  const observe = () => {
    observer ??= new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const watching = waiting.get(entry.target)
        if (!watching) continue
        if (!entry.isIntersecting) {
          watching.ready = true
          continue
        }
        if (!watching.ready) continue
        waiting.delete(entry.target)
        observer?.unobserve(entry.target)
        watching.seen()
      }
    }, { rootMargin: AHEAD })
    return observer
  }
  return (element, seen, afresh = false) => {
    waiting.set(element, { seen, ready: !afresh })
    observe().observe(element)
    return () => {
      waiting.delete(element)
      observer?.unobserve(element)
    }
  }
}

type Pictures = {
  scope: string
  entries: ReadonlyMap<string, ImageEntry>
  cache: PictureCache
  watch: PictureWatch
}

const NONE: Pictures = {
  scope: '',
  entries: new Map(),
  cache: new PictureCache(NO_PICTURES),
  watch: seenAtOnce(),
}

const PicturesContext = createContext<Pictures>(NONE)

export type PicturesProviderProps = {
  /** Where the bytes are asked for. Keep it stable: a new source is a new cache. */
  source: ImageSource
  /** The identity of the scope whose library the documents below name pictures from. */
  scope: string
  /** That scope's library: every picture's entry, never its bytes. */
  library: readonly ImageEntry[]
  /** When a picture counts as seen. Absent = {@link watchInView}. */
  watch?: PictureWatch
  /** How a shown picture's address is made from its bytes. Absent = an object address where there is one. */
  addresses?: PictureAddresses
  /** A source that failed to answer. The picture keeps its place and its alt text. */
  onFailure?: (error: unknown) => void
  children: ReactNode
}

export function PicturesProvider({ source, scope, library, watch, addresses, onFailure, children }: PicturesProviderProps) {
  const failed = useRef(onFailure)
  failed.current = onFailure
  const cache = useMemo(
    () => new PictureCache(source, { addresses, onFailure: (error) => failed.current?.(error) }),
    [source, addresses],
  )
  const seeing = useMemo(() => watch ?? watchInView(), [watch])
  const entries = useMemo(() => new Map(library.map((entry) => [imageNameKey(entry.name), entry])), [library])
  const value = useMemo<Pictures>(() => ({ scope, entries, cache, watch: seeing }), [scope, entries, cache, seeing])
  return <PicturesContext.Provider value={value}>{children}</PicturesContext.Provider>
}

/** The identity of the scope whose library the nearest provider hands down. */
export function usePictureScope(): string {
  return useContext(PicturesContext).scope
}

/** The library entry a name is, under the nearest provider; `undefined` where it holds none. */
export function usePictureEntry(name: ImageName): ImageEntry | undefined {
  return useContext(PicturesContext).entries.get(imageNameKey(name))
}

/** Where a picture is: waiting for its bytes, drawn from an address, or without bytes after asking. */
type PictureState = { address?: string; failed?: true }

/**
 * The address to draw a picture from once its bytes are here, and nothing
 * before: shown at once where the page kept them, else asked for when
 * `element` first comes into view. Where the bytes do not arrive — none
 * there, or the source failed — the picture is `failed`, and asks again the
 * next time it comes into view.
 */
function usePicture(entry: ImageEntry, element: RefObject<Element | null>): PictureState {
  const { scope, cache, watch } = useContext(PicturesContext)
  const { name, contentAddress } = entry
  const [state, setState] = useState<PictureState>({})
  // Before the browser paints: a picture seen before is drawn in the frame it
  // comes back in, from bytes the page kept, without a frame of empty box.
  useLayoutEffect(() => {
    const picture = { name, contentAddress }
    let live = true
    let showing = false
    let unwatch: (() => void) | undefined
    const present = (shown: string) => {
      showing = true
      setState({ address: shown })
    }
    const seen = () => {
      void cache.request(scope, picture).then((shown) => {
        if (!live) {
          if (shown !== undefined) cache.hide(scope, picture)
        } else if (shown !== undefined) present(shown)
        else {
          setState({ failed: true })
          if (element.current) unwatch = watch(element.current, seen, true)
        }
      })
    }
    const kept = cache.show(scope, picture)
    if (kept !== undefined) present(kept)
    else if (element.current) unwatch = watch(element.current, seen)
    return () => {
      live = false
      unwatch?.()
      if (showing) cache.hide(scope, picture)
      setState({})
    }
  }, [scope, name, contentAddress, cache, watch, element])
  return state
}

/**
 * What an empty box looks like: a tint while its bytes are on their way, and
 * the alt text once they did not come. On paper, the alt text either way and
 * no tint, since a page printed from the browser has no bytes to wait for.
 */
const WAITING = {
  bgcolor: 'action.hover',
  color: 'transparent',
  '@media print': { bgcolor: 'transparent', color: 'text.secondary' },
} as const
const FAILED = { color: 'text.secondary', fontStyle: 'italic' } as const

/**
 * The shape a picture that declares no size — an SVG with neither a size nor
 * a view box — is laid out in before it arrives: a box that changed when the
 * picture came would move the page. What is fitted inside is what a browser
 * draws of such an SVG, 300 by 150 of its own units and nothing outside them.
 */
const UNSIZED = { width: 640, height: 480 } as const

/**
 * A picture in the page, and the same picture at full size on a click.
 *
 * Its box is the entry's: `width` and `height` are the dimensions the picture
 * declares, and the ratio between them holds the box's shape while the width
 * the page has scales it — so the box is the size it will be before a byte
 * arrives. The page shows it no taller than most of the window, so a tall
 * screenshot does not take the page with it; the picture is fitted inside the
 * box, not the box to the picture. An entry that declares no size is laid
 * out in {@link UNSIZED}'s shape.
 *
 * `minHeight: 0` and `overflow: hidden` let the box yield to a flex column
 * shorter than it, its picture fitted inside the smaller box, where a flex
 * item would otherwise keep its full height and run past the column's end.
 */
export function LibraryPicture({ entry, alt }: { entry: ImageEntry; alt: string }) {
  const element = useRef<HTMLImageElement>(null)
  const { address, failed } = usePicture(entry, element)
  const [open, setOpen] = useState(false)
  const { width, height } = entry.width > 0 && entry.height > 0 ? entry : UNSIZED
  return (
    <>
      <Box
        component="img"
        ref={element}
        src={address}
        alt={alt}
        data-picture={entry.name}
        {...(failed ? { 'data-failed': '' } : {})}
        width={width}
        height={height}
        onClick={address ? () => setOpen(true) : undefined}
        sx={{
          display: 'block',
          maxWidth: '100%',
          height: 'auto',
          maxHeight: '70vh',
          minHeight: 0,
          overflow: 'hidden',
          objectFit: 'contain',
          borderRadius: 1,
          aspectRatio: `${width} / ${height}`,
          ...(address ? { cursor: 'zoom-in' } : failed ? FAILED : WAITING),
        }}
      />
      {address && (
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          maxWidth={false}
          aria-label={alt}
          slotProps={{
            backdrop: { sx: { bgcolor: 'rgba(0, 0, 0, 0.85)' } },
            paper: { sx: { m: 0, bgcolor: 'transparent', boxShadow: 'none', maxWidth: '100vw', maxHeight: '100vh' } },
          }}
        >
          <Box
            component="img"
            src={address}
            alt={alt}
            data-testid="lightbox"
            onClick={() => setOpen(false)}
            sx={{ display: 'block', maxWidth: '100vw', maxHeight: '100vh', objectFit: 'contain', cursor: 'zoom-out' }}
          />
        </Dialog>
      )}
    </>
  )
}

/**
 * A picture of the library, small: what the list of a scope's pictures shows
 * beside each name. Asked for as any picture is, when it comes into view, and
 * an empty tint until then.
 */
export function PictureThumbnail({ entry }: { entry: ImageEntry }) {
  const element = useRef<HTMLImageElement>(null)
  const { address, failed } = usePicture(entry, element)
  return (
    <Box
      component="img"
      ref={element}
      src={address}
      alt=""
      data-picture={entry.name}
      sx={{
        width: 48, height: 36, objectFit: 'contain', borderRadius: 0.5, flexShrink: 0,
        bgcolor: 'action.hover', ...(failed ? FAILED : {}),
      }}
    />
  )
}
