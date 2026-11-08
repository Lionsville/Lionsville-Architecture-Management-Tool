// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Documents out, and documents in.
 *
 * Separate from {@link ProjectStore} because it is a different act: a store
 * keeps things where the shell already knows to look, a gateway hands something
 * to the user or takes something from them. In the browser that is a download
 * and a file picker; on the desktop a real "save as" and a path. The same two
 * lines, entirely different machinery underneath.
 *
 * `Blob` appears in the signature and that is fine: it is a data shape, not
 * machinery, and node knows it as well as the browser does. `File`,
 * `FileReader` and `<a download>` stay on the far side of this seam.
 *
 * **Text or bytes.** The working file is a zip since ADR-0003 — the project
 * folder, in one file — and a zip is bytes. Everything else this app hands over
 * is still text, and saying so in the type keeps a gateway from having to guess
 * an encoding it was never told.
 */
export type SavedDocument = {
  /** The name the user is offered. */
  name: string
  /** For example `application/json`. */
  mediaType: string
} & ({ text: string; bytes?: undefined } | { bytes: Uint8Array; text?: undefined })

/** What most of this app hands over. The narrower half of {@link SavedDocument}. */
export type TextDocument = SavedDocument & { text: string }

export interface DocumentGateway {
  readonly id: string

  /**
   * Hand a document to the user.
   *
   * `'cancelled'` when they were asked where and said nowhere, which is not a
   * failure: nothing is said about it, and nothing about it having been saved.
   * A browser that drops it in the downloads folder asks nobody, and answers
   * nothing.
   */
  save(doc: SavedDocument): Promise<void | 'cancelled'>

  /**
   * The document goes straight to the browser's downloads and nobody is asked
   * where: what the words before and after a save say. Absent where a save asks.
   */
  readonly downloads?: boolean

  /**
   * The page as it now stands for print, to a PDF the user is asked where to put:
   * text and lines rather than pixels, at the page's own `@page` size. Absent where the
   * only way to paper is a browser's own print dialog.
   */
  print?(doc: { name: string; widthMm: number; heightMm: number }): Promise<void | 'cancelled'>

  /** A chosen file as text. */
  readText(blob: Blob): Promise<string>

  /**
   * A chosen file as bytes.
   *
   * What `openFile` uses, because what a file IS is a question about its bytes
   * and not about its name: a zip, a JSON document, or something renamed by
   * somebody who meant well.
   */
  readBytes(blob: Blob): Promise<Uint8Array>

  /** A chosen file as a data URL — for marks. */
  readDataUrl(blob: Blob): Promise<string>
}
