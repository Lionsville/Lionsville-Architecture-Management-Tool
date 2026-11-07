// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A file a document points at: `[report.pdf](attachment:<id>)`.
 *
 * Nothing but the name and an opaque id is written into the text. Where the
 * bytes are is the source's, so a document stays plain markdown and reads the
 * same wherever it goes: under a source that keeps attachments the link opens
 * the file, and anywhere else it is the file's name.
 *
 * Pure.
 */

export const ATTACHMENT_SCHEME = 'attachment:'

/** Why a source will not keep a file, in words for the person. */
export type AttachmentRefused = { refused: string }

/**
 * What a source that keeps attachments offers the editor and the reader.
 * The core's sources keep none, and then neither a button nor a drop is offered.
 */
export type DocumentAttachments = {
  /** The largest file taken, in bytes: refused before anything is sent. Absent: the source alone decides. */
  maxBytes?: number
  /**
   * Keep a file, for the scope with this identity (`usePictureScope`), answering
   * with the id to refer to. A source that refuses it answers why, in the
   * person's language, and the editor says that beside the text. `undefined`
   * where nothing is to be said. Either way nothing is written into the document.
   */
  add(file: File, scope: string): Promise<string | AttachmentRefused | undefined>
  /** Where the file with this id is opened from. */
  href(id: string): string
}

/** The link a document holds. A bracket in a file's name would end the link's words early. */
export function attachmentMarkdown(id: string, name: string): string {
  const words = name.replace(/[\\[\]]/g, (mark) => `\\${mark}`)
  return `[${words}](${ATTACHMENT_SCHEME}${encodeURIComponent(id)})`
}

/** The id an `attachment:` address names; `undefined` for any other address. */
export function attachmentOfHref(href: string | undefined): string | undefined {
  if (!href?.startsWith(ATTACHMENT_SCHEME)) return undefined
  const id = href.slice(ATTACHMENT_SCHEME.length)
  if (!id) return undefined
  try {
    return decodeURIComponent(id)
  } catch {
    return undefined
  }
}

/** Every attachment a document points at, once each and in the order they appear: what keeps a file in use. */
export function attachmentsUsedIn(markdown: string): string[] {
  const found = new Set<string>()
  for (const match of markdown.matchAll(/\]\((attachment:[^)\s]+)\)/g)) {
    const id = attachmentOfHref(match[1])
    if (id) found.add(id)
  }
  return [...found]
}
