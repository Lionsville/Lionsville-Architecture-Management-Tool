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
 * Tell `seen` once, when `element` first comes into view, and answer how to
 * stop watching. A watch that cannot tell treats the element as seen.
 */
export type PictureWatch = (element: Element, seen: () => void) => () => void

/**
 * How far outside the visible part a picture counts as coming into view: a
 * little, so a picture scrolled towards is on its way before it is there, and
 * one a long document keeps far below is never asked for.
 */
const AHEAD = '200px 0px'

/**
 * One observer for every picture under a provider, rather than one each: a
 * long document holds dozens, and an observer is cheap to share and not to
 * make.
 */
export function watchInView(): PictureWatch {
  if (typeof IntersectionObserver !== 'function') {
    return (_element, seen) => {
      seen()
      return () => undefined
    }
  }
  const waiting = new Map<Element, () => void>()
  let observer: IntersectionObserver | undefined
  const observe = () => {
    observer ??= new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const seen = waiting.get(entry.target)
        waiting.delete(entry.target)
        observer?.unobserve(entry.target)
        seen?.()
      }
    }, { rootMargin: AHEAD })
    return observer
  }
  return (element, seen) => {
    waiting.set(element, seen)
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
  watch: (_element, seen) => {
    seen()
    return () => undefined
  },
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

/** The library entry a name is, under the nearest provider; `undefined` where it holds none. */
export function usePictureEntry(name: ImageName): ImageEntry | undefined {
  return useContext(PicturesContext).entries.get(imageNameKey(name))
}

/**
 * The address to draw a picture from once its bytes are here, and nothing
 * before: shown at once where the page kept them, else asked for when
 * `element` first comes into view.
 */
function usePictureAddress(entry: ImageEntry, element: RefObject<Element | null>): string | undefined {
  const { scope, cache, watch } = useContext(PicturesContext)
  const { name, contentAddress } = entry
  const [address, setAddress] = useState<string | undefined>(undefined)
  // Before the browser paints: a picture seen before is drawn in the frame it
  // comes back in, from bytes the page kept, without a frame of empty box.
  useLayoutEffect(() => {
    const picture = { name, contentAddress }
    let live = true
    let showing = false
    const show = () => {
      const shown = cache.show(scope, picture)
      if (shown === undefined) return
      showing = true
      setAddress(shown)
    }
    const seen = () => {
      void cache.load(scope, picture).then((here) => {
        if (live && here) show()
      })
    }
    let unwatch: (() => void) | undefined
    if (cache.has(scope, picture)) show()
    else if (element.current) unwatch = watch(element.current, seen)
    return () => {
      live = false
      unwatch?.()
      if (showing) cache.hide(scope, picture)
      setAddress(undefined)
    }
  }, [scope, name, contentAddress, cache, watch, element])
  return address
}

/**
 * A picture in the page, and the same picture at full size on a click.
 *
 * Its box is the entry's: `width` and `height` are the dimensions the picture
 * declares, and the ratio between them holds the box's shape while the width
 * the page has scales it — so the box is the size it will be before a byte
 * arrives. The page shows it no taller than most of the window, so a tall
 * screenshot does not take the page with it; the picture is fitted inside the
 * box, not the box to the picture. An entry with no dimensions reserves none.
 */
export function LibraryPicture({ entry, alt }: { entry: ImageEntry; alt: string }) {
  const element = useRef<HTMLImageElement>(null)
  const address = usePictureAddress(entry, element)
  const [open, setOpen] = useState(false)
  const sized = entry.width > 0 && entry.height > 0
  return (
    <>
      <Box
        component="img"
        ref={element}
        src={address}
        alt={alt}
        data-picture={entry.name}
        {...(sized ? { width: entry.width, height: entry.height } : {})}
        onClick={address ? () => setOpen(true) : undefined}
        sx={{
          display: 'block',
          maxWidth: '100%',
          height: 'auto',
          maxHeight: '70vh',
          objectFit: 'contain',
          borderRadius: 1,
          ...(sized ? { aspectRatio: `${entry.width} / ${entry.height}` } : {}),
          ...(address ? { cursor: 'zoom-in' } : { bgcolor: 'action.hover', color: 'transparent' }),
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
