// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where a page gets a picture's bytes, and when (ADR-0031 §3).
 *
 * **A page lays out from the library and asks for bytes when it shows.** The
 * library a scope is read with says every picture's name and dimensions, so a
 * page reserves each picture's place at once; its bytes are asked of an
 * {@link ImageSource} only when the picture comes into view. Opening a scope
 * asks for none, and scanning a long document asks for the ones looked at.
 *
 * **The source is handed in.** Rendering depends on this interface and on
 * nothing that answers it: the composition hands in the source's image
 * repository, whose `bytes` has this shape, and a test or a story hands in
 * {@link memoryImageSource}.
 *
 * **What was shown is kept, a little.** {@link PictureCache} keeps the bytes of
 * the last pictures a page asked for, so a picture seen before is shown in the
 * frame it comes back in, and asks nothing. The address a browser draws bytes
 * from is made when a picture is shown and let go when the last place showing
 * it goes; the bytes stay in the cache until newer ones push them out.
 *
 * **A report asks for every picture, when it is produced**, and never before
 * (`pictureReport.ts`).
 */
import { imageNameKey } from '../model/imageName'
import type { ImageEntry, ImageName } from '../model/imageName'

/** A picture's bytes, and what they are. The shape an image repository answers. */
export type PictureBytes = {
  mediaType: string
  bytes: Uint8Array
}

/**
 * Where a page asks for a picture's bytes: by the scope's identity and the
 * picture's name in that scope's library. `undefined` where there are none.
 */
export interface ImageSource {
  bytes(scope: string, name: ImageName): Promise<PictureBytes | undefined>
}

/** A source with no pictures at all: what a page without a provider asks, and is answered nothing. */
export const NO_PICTURES: ImageSource = {
  bytes: () => Promise.resolve(undefined),
}

/** One ask a memory source was made, in the order it was made. */
export type PictureAsk = { scope: string; name: ImageName }

/** A source over pictures held in memory, that says what it was asked: for tests and stories. */
export type MemoryImageSource = ImageSource & {
  readonly asked: readonly PictureAsk[]
  /** Holds back every answer until {@link answer} is called, for a test that looks between the ask and the bytes. */
  hold(): void
  answer(): void
}

/**
 * Pictures in memory, by scope and then by name. Every ask is written down
 * in `asked`, answered or not.
 */
export function memoryImageSource(
  pictures: Readonly<Record<string, Readonly<Record<ImageName, PictureBytes>>>>,
): MemoryImageSource {
  const asked: PictureAsk[] = []
  let held: (() => void)[] | undefined
  return {
    asked,
    bytes(scope, name) {
      asked.push({ scope, name })
      const found = pictures[scope]?.[name]
      if (!held) return Promise.resolve(found)
      const waiting = held
      return new Promise((resolve) => { waiting.push(() => resolve(found)) })
    },
    hold() {
      held ??= []
    },
    answer() {
      const waiting = held ?? []
      held = undefined
      for (const release of waiting) release()
    },
  }
}

/** How the address a browser draws a picture from is made from its bytes, and let go of. */
export type PictureAddresses = {
  make(picture: PictureBytes): string
  release(address: string): void
}

/** Every byte as the base64 a data address carries. */
function base64Of(bytes: Uint8Array): string {
  let text = ''
  for (let at = 0; at < bytes.length; at += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(at, at + 0x8000))
  }
  return btoa(text)
}

/** Bytes as a self-contained address: what a report that must draw without asking again takes. */
export function pictureDataAddress(picture: PictureBytes): string {
  return `data:${picture.mediaType};base64,${base64Of(picture.bytes)}`
}

/** The one media type whose bytes can hold a script, and so never get an address in the page's own origin. */
const SCRIPTABLE = 'image/svg+xml'

/**
 * An object address where the platform makes one — the bytes stay bytes and
 * nothing is copied into text — and a data address where it does not, which
 * is a process with no browser.
 *
 * **Never an object address for an SVG.** An object address belongs to the
 * page's origin: an SVG opened from one in a tab of its own — *Open image in
 * new tab*, or dragged to the address bar — runs any script it holds as the
 * app, and anybody who can add a picture could plant one. A data address has
 * an opaque origin, and an `img` runs no script either way.
 */
export function defaultPictureAddresses(): PictureAddresses {
  const objects = typeof URL.createObjectURL === 'function' && typeof URL.revokeObjectURL === 'function'
  if (!objects) return { make: pictureDataAddress, release: () => undefined }
  return {
    make: (picture) => (picture.mediaType === SCRIPTABLE
      ? pictureDataAddress(picture)
      : URL.createObjectURL(new Blob([new Uint8Array(picture.bytes)], { type: picture.mediaType }))),
    release: (address) => {
      if (address.startsWith('blob:')) URL.revokeObjectURL(address)
    },
  }
}

/** What the cache knows a picture by: its name, and the address of the bytes it names. */
export type PictureKey = Pick<ImageEntry, 'name' | 'contentAddress'>

/** One picture of one scope, as its bytes are: a new content address is another picture. */
function keyOf(scope: string, entry: PictureKey): string {
  return `${scope}\u0000${imageNameKey(entry.name)}\u0000${entry.contentAddress}`
}

export type PictureCacheOptions = {
  /** How many pictures' bytes are kept once nothing shows them. */
  keep?: number
  addresses?: PictureAddresses
  /** A source that failed to answer: the picture keeps its place, and the failure goes where the composition says. */
  onFailure?: (error: unknown) => void
}

/** How many pictures' bytes a page keeps by default: a few screens of a long document. */
export const PICTURES_KEPT = 48

/**
 * The bytes a page has asked for, and the addresses it draws them from.
 *
 * {@link load} asks the source once however many places want the same
 * picture at the same moment, and keeps what it answers. {@link show} gives
 * a place the address to draw kept bytes from, made the first time any place
 * shows them, and {@link hide} lets it go once no place does.
 * {@link request} is the two for a place that has just seen a picture: its
 * bytes cannot be dropped between arriving and being shown, however many
 * others arrive in between. Bytes nobody shows are dropped oldest first
 * beyond `keep`; bytes being shown, or waited for, never are.
 */
export class PictureCache {
  private readonly kept = new Map<string, PictureBytes>()
  private readonly asking = new Map<string, Promise<boolean>>()
  private readonly shown = new Map<string, { address: string; places: number }>()
  /** How many places are waiting to show bytes being asked for. */
  private readonly wanted = new Map<string, number>()
  private readonly keep: number
  private readonly addresses: PictureAddresses
  private readonly onFailure: (error: unknown) => void

  constructor(private readonly source: ImageSource, options: PictureCacheOptions = {}) {
    this.keep = options.keep ?? PICTURES_KEPT
    this.addresses = options.addresses ?? defaultPictureAddresses()
    this.onFailure = options.onFailure ?? (() => undefined)
  }

  /** Whether this picture's bytes are here, so it can be shown without asking. */
  has(scope: string, entry: PictureKey): boolean {
    return this.kept.has(keyOf(scope, entry))
  }

  /** Ask for a picture's bytes, once, and answer whether they are here. A failure is reported and answers no. */
  load(scope: string, entry: PictureKey): Promise<boolean> {
    const key = keyOf(scope, entry)
    if (this.kept.has(key)) return Promise.resolve(true)
    const pending = this.asking.get(key)
    if (pending) return pending
    const asked = this.source.bytes(scope, entry.name).then(
      (picture) => {
        if (picture) this.keepBytes(key, picture)
        return picture !== undefined
      },
      (error: unknown) => {
        this.onFailure(error)
        return false
      },
    ).finally(() => this.asking.delete(key))
    this.asking.set(key, asked)
    return asked
  }

  /** The address to draw a kept picture from, for one more place showing it; `undefined` where its bytes are not here. */
  show(scope: string, entry: PictureKey): string | undefined {
    const key = keyOf(scope, entry)
    const showing = this.shown.get(key)
    if (showing) {
      showing.places += 1
      return showing.address
    }
    const picture = this.kept.get(key)
    if (!picture) return undefined
    this.touch(key, picture)
    const address = this.addresses.make(picture)
    this.shown.set(key, { address, places: 1 })
    return address
  }

  /**
   * Ask for a picture's bytes and show them: the address to draw them from,
   * for one more place, or `undefined` where there are none. A place that is
   * gone by the time they arrive hides what it was given.
   */
  async request(scope: string, entry: PictureKey): Promise<string | undefined> {
    const key = keyOf(scope, entry)
    this.wanted.set(key, (this.wanted.get(key) ?? 0) + 1)
    try {
      return await this.load(scope, entry) ? this.show(scope, entry) : undefined
    } finally {
      const waiting = (this.wanted.get(key) ?? 1) - 1
      if (waiting > 0) this.wanted.set(key, waiting)
      else this.wanted.delete(key)
    }
  }

  /** One place stopped showing a picture; the last to stop lets its address go. */
  hide(scope: string, entry: PictureKey): void {
    const key = keyOf(scope, entry)
    const showing = this.shown.get(key)
    if (!showing) return
    showing.places -= 1
    if (showing.places > 0) return
    this.shown.delete(key)
    this.addresses.release(showing.address)
    this.trim()
  }

  private keepBytes(key: string, picture: PictureBytes): void {
    this.touch(key, picture)
    this.trim()
  }

  /** Kept, as the newest. */
  private touch(key: string, picture: PictureBytes): void {
    this.kept.delete(key)
    this.kept.set(key, picture)
  }

  /** Whether bytes are shown, or about to be: they are never dropped, and do not count against `keep`. */
  private inUse(key: string): boolean {
    return this.shown.has(key) || this.wanted.has(key)
  }

  /** Bytes nobody shows, beyond `keep`, dropped oldest first. */
  private trim(): void {
    let over = [...this.kept.keys()].filter((key) => !this.inUse(key)).length - this.keep
    for (const key of this.kept.keys()) {
      if (over <= 0) return
      if (this.inUse(key)) continue
      this.kept.delete(key)
      over -= 1
    }
  }
}
