/**
 * What the host outside the window can ask the app to do.
 *
 * A desktop app has two ways in that a browser tab does not: a menu bar, and an
 * operating system that opens documents with it. Neither belongs to any one
 * screen, and both have to be understood by the shell and by the adapter that
 * receives them — so the vocabulary lives here, in the layer everything may
 * read, rather than in either of them.
 *
 * A command and not a call, deliberately. The menu knows there is a File menu;
 * it does not know whether anything is open, whether there are unsaved changes,
 * or what a working file is — and a menu that had to know would be a second
 * copy of the shell's state, kept in the one process that cannot see the
 * screen.
 */
export type HostCommand =
  /** Ask for a folder, then work in it. */
  | { type: 'chooseFolder' }
  /** Work in one the user has already granted — the Recent submenu. */
  | { type: 'openFolder'; root: string }
  /** Write now, without waiting for the idle timer. */
  | { type: 'save' }
  /** Hand the project over as a working file. */
  | { type: 'export' }
  /** Ask for a file to open. The renderer has a picker; the host needs none. */
  | { type: 'open' }
  /**
   * The host opened a document with us — a double click in a file manager, a
   * second instance started with a path. The bytes come with it: the file is
   * outside every folder the user granted, and the double click is the grant.
   */
  | { type: 'openDocument'; name: string; bytes: Uint8Array }

/**
 * Somewhere to send them, and one thing to send back.
 *
 * The traffic runs both ways because both halves are about the window rather
 * than about the document. The host owns closing it, and only the app knows
 * whether closing it would lose anything — a browser tab has `beforeunload` for
 * exactly that conversation, and a desktop window has to have it out loud.
 */
export type HostCommands = {
  /** Every command, until the returned function is called. */
  on(listener: (command: HostCommand) => void): () => void
  /** Is there work that closing the window would lose? */
  reportUnsaved(unsaved: boolean): void
}
