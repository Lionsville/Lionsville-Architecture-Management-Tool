// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The pictures of one source's scopes, and their bytes (ADR-0031 §3).
 *
 * **The library is part of a scope's state.** Each picture's entry — its name,
 * media type, size, width, height and content address (`model/imageName.ts`)
 * — is read with the scope, and a picture is added to the library or taken
 * out of it by a step through `ScopeRepository`. What this seam adds is the
 * bytes, and the two questions a library of any size has to answer without
 * being read whole: what is in one image folder, and what one name is.
 *
 * **Bytes are asked for when a picture is shown.** A page lays every picture
 * out from the library's entries at once, and asks for one picture's bytes
 * only when that picture comes into view — so reading a scope never reads a
 * picture, and nothing on a page moves when one arrives.
 *
 * **Adding a picture is two acts, bytes first.** `put` keeps the bytes and
 * answers their content address; the step that adds the entry, with that
 * address and the picture's dimensions, is what puts it in the library. Bytes
 * put and never added are in no library, are not answered by name, and are
 * the implementation's to let go of.
 *
 * `ImageRepository.contract.ts`, beside this seam, is the behaviour every
 * implementation must show.
 */
import type { ContentAddress, ImageEntry, ImageFolder, ImageName } from '../model/imageName'
import type { ScopeId } from '../projects/scopeState'

/** One image folder of a library: the pictures directly in it, and the image folders directly under it. */
export type ImageListing = {
  images: readonly ImageEntry[]
  imageFolders: readonly ImageFolder[]
}

/** A picture's bytes, and what they are. */
export type ImageBytes = {
  mediaType: string
  bytes: Uint8Array
}

/** Bytes kept, under their content address; or the key for a name no picture may have, or a scope that is not there. */
export type Put =
  | { contentAddress: ContentAddress }
  | { refused: 'shell.imageBadName' | 'shell.imageBadType' | 'shell.scopeGone' }

export interface ImageRepository {
  readonly id: string

  /**
   * Keep a picture's bytes for a scope, to be added to its library under
   * `name`, and answer their content address. The media type is the name's.
   * The same bytes put twice are kept once, under one address. Refused,
   * `shell.scopeGone`, for a scope that is not there: bytes kept for no scope
   * would be kept for nobody, and never let go of with a scope.
   */
  put(scope: ScopeId, name: ImageName, bytes: Uint8Array): Promise<Put>

  /**
   * The pictures directly in one image folder of a scope's library, and the
   * image folders directly under it, each sorted by name. `''` is the top. An
   * image folder with nothing in it answers empty.
   */
  list(scope: ScopeId, within: ImageFolder): Promise<ImageListing>

  /** One picture's entry by its name, or `undefined` where the library has none by it. */
  find(scope: ScopeId, name: ImageName): Promise<ImageEntry | undefined>

  /**
   * One picture's bytes, by its name in the scope's library, with the media
   * type its entry says; `undefined` where the library has no picture by that
   * name, or its bytes are not there. Two names may hold the same bytes, and
   * each answers its own media type.
   */
  bytes(scope: ScopeId, name: ImageName): Promise<ImageBytes | undefined>

  /**
   * One picture's bytes by their content address, whether or not a library
   * name points at them. A drawing's picture is kept this way: the view holds
   * the address and no library entry. `undefined` where those bytes are not
   * there — put and never kept, or swept after nothing named them.
   */
  bytesAt(scope: ScopeId, address: ContentAddress): Promise<ImageBytes | undefined>
}
