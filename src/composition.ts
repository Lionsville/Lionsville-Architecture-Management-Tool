/**
 * The composition: which outside world this shell gets.
 *
 * Deliberately the only file that knows both a seam and a filling. Everything
 * above this line talks to `ProjectStore`, `PreferencesStore` and
 * `DocumentGateway` and does not know what sits underneath; everything below it
 * does not know who calls. The moment somewhere else also decides which store it
 * is, that property is gone — and there is a lint rule for it
 * (`eslint.config.js`), because an agreement that lives only in a comment wears
 * off.
 *
 * Another place to keep things (disk via the File System Access API, Electron
 * over IPC, a server) is: a class under `src/adapters/`, the contract run over
 * it (`ports/ProjectStore.contract.ts`), and one branch here. Not a single file
 * above it changes.
 */
import { BrowserDocumentGateway } from './adapters/browser/BrowserDocumentGateway'
import { browserHostControls } from './adapters/browser/browserHostControls'
import { ConsoleDiagnostics } from './adapters/browser/ConsoleDiagnostics'
import { hostWindowChrome } from './adapters/browser/hostWindow'
import { InMemoryGroupStore } from './adapters/memory/InMemoryGroupStore'
import { InMemoryPreferencesStore } from './adapters/memory/InMemoryPreferencesStore'
import { InMemoryProjectStore } from './adapters/memory/InMemoryProjectStore'
import { browserStorage } from './adapters/webStorage/available'
import { WebStorageGroupStore } from './adapters/webStorage/WebStorageGroupStore'
import { WebStoragePreferencesStore } from './adapters/webStorage/WebStoragePreferencesStore'
import { WebStorageProjectStore } from './adapters/webStorage/WebStorageProjectStore'
import type { WindowChrome } from './core/windowChrome'
import type { Diagnostics } from './ports/Diagnostics'
import type { DocumentGateway } from './ports/DocumentGateway'
import type { GroupStore } from './ports/GroupStore'
import type { HostControls } from './ports/HostControls'
import type { PreferencesStore } from './ports/PreferencesStore'
import type { ProjectStore } from './ports/ProjectStore'

/** Everything the shell needs from outside, in one grip. */
export type Shell = {
  projects: ProjectStore
  /** What each group says about itself. Decoration; groups are still derived. */
  groups: GroupStore
  preferences: PreferencesStore
  documents: DocumentGateway
  /**
   * Where a failure goes when there is nobody to tell. Passed down like the
   * other seams, so a boundary or a rejected promise has somewhere to report
   * before it draws a message.
   */
  diagnostics: Diagnostics
  /** What the crash fallback can do about it: reload, and copy the trail. */
  hostControls: HostControls
  /**
   * What the window around the app is doing, which on the desktop is less than
   * a browser does: no title bar to move it by, and controls drawn over our
   * own top bar.
   */
  windowChrome: WindowChrome
}

/**
 * The shell as it stands in a browser.
 *
 * If storage refuses — private window, strict policy — memory takes its place.
 * The session then works in full and simply leaves nothing behind, which is
 * precisely what the user asked for by opening such a window. Before this layer
 * the answer to that situation was a `try/catch` in four places and an empty
 * editor if one of them was missed.
 */
export function composeShell(): Shell {
  const storage = browserStorage()
  return {
    projects: storage ? new WebStorageProjectStore(storage) : new InMemoryProjectStore(),
    groups: storage ? new WebStorageGroupStore(storage) : new InMemoryGroupStore(),
    preferences: storage ? new WebStoragePreferencesStore(storage) : new InMemoryPreferencesStore(),
    documents: new BrowserDocumentGateway(),
    diagnostics: new ConsoleDiagnostics(),
    hostControls: browserHostControls(),
    windowChrome: hostWindowChrome(),
  }
}
