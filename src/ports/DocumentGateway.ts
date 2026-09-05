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
 */
export type TextDocument = {
  /** The name the user is offered. */
  name: string
  text: string
  /** For example `application/json`. */
  mediaType: string
}

export interface DocumentGateway {
  readonly id: string

  /** Hand a text document to the user. */
  save(doc: TextDocument): Promise<void>

  /** A chosen file as text. */
  readText(blob: Blob): Promise<string>

  /** A chosen file as a data URL — for marks. */
  readDataUrl(blob: Blob): Promise<string>
}
