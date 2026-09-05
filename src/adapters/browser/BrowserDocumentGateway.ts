/**
 * Documents in and out, using what a browser has.
 *
 * Handing over is an `<a download>` with a blob URL; that URL is released
 * again, or the tab holds on to the whole payload until you close it. Taking in
 * is `FileReader`.
 *
 * This is the only place in the shell where those two names still appear. Phase
 * 5C puts the File System Access API beside it (real save-in-place) and phase 6
 * a variant over IPC; both are a new file next to this one, not a rebuild of it.
 */
import type { DocumentGateway, TextDocument } from '../../ports/DocumentGateway'

/** How long the blob URL must outlive the click that picked it up. */
const REVOKE_AFTER_MS = 800

export class BrowserDocumentGateway implements DocumentGateway {
  readonly id = 'browser'

  save(doc: TextDocument): Promise<void> {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([doc.text], { type: doc.mediaType }))
    a.download = doc.name
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, REVOKE_AFTER_MS)
    return Promise.resolve()
  }

  readText(blob: Blob): Promise<string> {
    return this.read((r) => r.readAsText(blob))
  }

  readDataUrl(blob: Blob): Promise<string> {
    return this.read((r) => r.readAsDataURL(blob))
  }

  private read(start: (reader: FileReader) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('The file could not be read'))
      reader.onload = () => resolve(String(reader.result ?? ''))
      start(reader)
    })
  }
}
