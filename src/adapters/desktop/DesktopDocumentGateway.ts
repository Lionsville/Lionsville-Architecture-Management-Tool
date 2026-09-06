/**
 * Documents in and out, on a machine with a real file dialog.
 *
 * The browser's answer to "save this" is an `<a download>`: the file lands in
 * the downloads folder, named whatever we said, and the user finds out where it
 * went afterwards. That is the best a tab can do and it is not what a desktop
 * app should do — so on the desktop this asks, writes where the user said, and
 * tells the OS a document of ours was written there.
 *
 * Only saving changes. Reading still goes through the browser gateway, because
 * a file the user picked is already a `Blob` in this process: routing it out to
 * main and back would be a second copy of the bytes and a second thing to get
 * wrong, and it would buy nothing at all.
 */
import { BrowserDocumentGateway } from '../browser/BrowserDocumentGateway'
import type { DocumentGateway, SavedDocument } from '../../ports/DocumentGateway'
import type { DesktopFiles } from './channel'

export class DesktopDocumentGateway implements DocumentGateway {
  readonly id = 'desktop'

  private readonly browser = new BrowserDocumentGateway()

  constructor(private readonly files: DesktopFiles) {}

  async save(doc: SavedDocument): Promise<void> {
    const bytes = doc.text === undefined
      ? doc.bytes as Uint8Array
      : new TextEncoder().encode(doc.text)
    // Cancelling is not failing. The caller says "saved" on a resolved promise,
    // and a person who changed their mind has not lost anything to report.
    await this.files.saveDocument(doc.name, bytes, doc.mediaType)
  }

  readText(blob: Blob): Promise<string> {
    return this.browser.readText(blob)
  }

  readBytes(blob: Blob): Promise<Uint8Array> {
    return this.browser.readBytes(blob)
  }

  readDataUrl(blob: Blob): Promise<string> {
    return this.browser.readDataUrl(blob)
  }
}
