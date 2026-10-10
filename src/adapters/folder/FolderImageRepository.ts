// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The pictures of a folder's scopes, as an image repository (ADR-0031 §3).
 *
 * A listing and a lookup read the scope's header, where its library's rows
 * are, and the names in its pictures folder — never a picture. A picture's
 * bytes are read from its file when they are asked for, which is when it is
 * shown. Bytes put are held until a step adds them (`PictureStaging`), and
 * one whose entry was added before they were written answers them from
 * there.
 */
import { contentAddressOf, imageFolderOf, imageFoldersUnder, imageNameRefusal, mediaTypeOfBytes } from '../../model/imageName'
import type { ContentAddress, ImageEntry, ImageFolder, ImageName } from '../../model/imageName'
import type { ScopeId } from '../../projects/scopeState'
import type { ImageBytes, ImageListing, ImageRepository, Put } from '../../ports/ImageRepository'
import { picturePath } from './folderPictures'
import type { PictureStaging } from './folderPictures'
import type { FolderScopes } from './folderScopes'
import { bytesAt as fileBytes } from './handles'

export class FolderImageRepository implements ImageRepository {
  readonly id = 'folder'

  private readonly folder: FolderScopes
  private readonly staging: PictureStaging

  constructor(folder: FolderScopes, staging: PictureStaging) {
    this.folder = folder
    this.staging = staging
  }

  async put(scope: ScopeId, name: ImageName, bytes: Uint8Array): Promise<Put> {
    const refused = imageNameRefusal(name)
    if (refused) return { refused }
    // Bytes for no scope would be held for nobody, and never let go of with a scope.
    if (!await this.folder.resolve(scope)) return { refused: 'shell.scopeGone' }
    const contentAddress = await contentAddressOf(bytes)
    this.staging.put(scope, contentAddress, bytes)
    return { contentAddress }
  }

  async list(scope: ScopeId, within: ImageFolder): Promise<ImageListing> {
    const entries = (await this.folder.libraryAt(scope))?.library.map(({ entry }) => entry) ?? []
    return structuredClone({
      images: entries.filter((entry) => imageFolderOf(entry.name) === within)
        .sort((one, other) => (one.name < other.name ? -1 : 1)),
      imageFolders: imageFoldersUnder(within, entries.map((entry) => entry.name)),
    })
  }

  async find(scope: ScopeId, name: ImageName): Promise<ImageEntry | undefined> {
    const found = (await this.folder.libraryAt(scope))?.library.find((kept) => kept.entry.name === name)
    return found ? { ...found.entry } : undefined
  }

  async bytes(scope: ScopeId, name: ImageName): Promise<ImageBytes | undefined> {
    const held = await this.folder.libraryAt(scope)
    const found = held?.library.find((kept) => kept.entry.name === name)
    if (!held || !found) return undefined
    const bytes = await fileBytes(this.folder.root, picturePath(held.node.address, found.file))
      ?? this.staging.get(scope, found.entry.contentAddress)
    return bytes ? { mediaType: found.entry.mediaType, bytes } : undefined
  }

  async bytesAt(scope: ScopeId, address: ContentAddress): Promise<ImageBytes | undefined> {
    const staged = this.staging.get(scope, address)
    if (staged) return { mediaType: mediaTypeOfBytes(staged), bytes: staged }
    const held = await this.folder.libraryAt(scope)
    const found = held?.library.find((kept) => kept.entry.contentAddress === address)
    if (!held || !found) return undefined
    const bytes = await fileBytes(this.folder.root, picturePath(held.node.address, found.file))
    return bytes ? { mediaType: found.entry.mediaType, bytes } : undefined
  }
}
