/**
 * One open document, as a state machine.
 *
 * The problem this solves is not "saving". It is that a file on a synced drive
 * has a second author — OneDrive, SharePoint, a colleague, or the same person on
 * another machine — and every awkward case is a pair of things happening at
 * once: a change arrives while a save is in flight, or while there are unsaved
 * edits, or twice while the conflict dialog is open, or the change turns out to
 * be our own write coming back. Each of those is a transition. Written as
 * `useState` inside a component they are unfixable, because the illegal states
 * are reachable and nobody can enumerate them; written as a reducer they are a
 * table, and a table can be read and tested.
 *
 * So: no React, no filesystem, no Electron, no clock. Everything that touches
 * the world hands this function an event and gets back a state. That is what
 * makes the sync behaviour testable at all — the parts that cannot be tested
 * (the watcher, the disk) then have nothing left in them but plumbing.
 *
 * The statuses, and what each one means to the person using the app:
 *
 * - `no-file`    — nothing is attached yet. Edits are fine; there is simply
 *                  nowhere to put them, so saving means choosing a file.
 * - `clean`      — what is on screen is what is on disk.
 * - `dirty`      — there are edits worth saving.
 * - `saving`     — a write is in flight. Edits during it are kept, not dropped.
 * - `external-changed` — the file changed underneath us and we have nothing
 *                  unsaved, so taking their version costs nothing.
 * - `conflict`   — both sides changed. This is the only state that requires a
 *                  human, and it is deliberately the only one.
 */
import type { ProjectRef } from './projectRef'

export type DocumentStatus =
  | 'no-file'
  | 'clean'
  | 'dirty'
  | 'saving'
  | 'external-changed'
  | 'conflict'

/**
 * Enough of a file to tell our own write from somebody else's.
 *
 * Recorded on every successful save. Without it, a watcher reports the change
 * *we just made* as an external one, and the app asks about a conflict with
 * itself every few seconds — which is how a sync feature becomes something
 * people turn off.
 *
 * All four fields, because none of them is sufficient alone: mtime granularity
 * differs per filesystem and sync clients preserve it deliberately, size misses
 * an edit that keeps the length, and a hash alone cannot tell "unchanged" from
 * "changed back". Together they are cheap and decisive.
 */
export type SaveFingerprint = {
  path: string
  mtimeMs: number
  size: number
  sha256: string
}

export type ConflictResolution = 'mine' | 'theirs' | 'copy'

export type DocumentEvent =
  /** A file is now bound to this session — opened, or saved-as for the first time. */
  | { type: 'attached'; fingerprint: SaveFingerprint }
  /** The model changed. */
  | { type: 'edited' }
  /** A write has started. */
  | { type: 'saveRequested' }
  /** The write landed; this is the fingerprint of what is now on disk. */
  | { type: 'saveSucceeded'; fingerprint: SaveFingerprint }
  /** The write did not land. The edits are still ours. */
  | { type: 'saveFailed'; reason?: string }
  /** The file on disk looks different from what we last wrote. */
  | { type: 'externalChangeDetected'; fingerprint: SaveFingerprint }
  /** Their version has been loaded into the editor. */
  | { type: 'reloadAccepted'; fingerprint: SaveFingerprint }
  /** A human decided. `fingerprint` is the new file when resolving as a copy. */
  | { type: 'conflictResolved'; resolution: ConflictResolution; fingerprint?: SaveFingerprint }
  /** The file is no longer bound — the project was closed or moved. */
  | { type: 'detached' }

export type DocumentSession = {
  status: DocumentStatus
  /** What we last wrote, and therefore what an external change is measured against. */
  fingerprint?: SaveFingerprint
  /**
   * Edits arrived while a write was in flight.
   *
   * Without this, a save that started before the last keystroke lands and
   * reports `clean`, and the newest edit is the one nobody notices is missing —
   * the worst kind of data loss, because the app says everything is fine.
   */
  editedWhileSaving: boolean
  /** Which project this session is for, when one is attached. */
  ref?: ProjectRef
  /** Why the last save failed, for the message. Cleared by the next attempt. */
  lastError?: string
}

export function emptySession(ref?: ProjectRef): DocumentSession {
  return { status: 'no-file', editedWhileSaving: false, ref }
}

/** Two fingerprints describing the same bytes in the same place. */
export function sameFile(a: SaveFingerprint | undefined, b: SaveFingerprint | undefined): boolean {
  if (!a || !b) return false
  return a.path === b.path && a.size === b.size && a.mtimeMs === b.mtimeMs && a.sha256 === b.sha256
}

/**
 * The table.
 *
 * Every event is legal in every state — a reducer that throws on an unexpected
 * event moves the problem to the caller, and the caller is a watcher firing on
 * its own schedule. An event that means nothing here returns the state
 * unchanged, and that is a deliberate answer rather than a gap.
 */
export function documentSession(state: DocumentSession, event: DocumentEvent): DocumentSession {
  switch (event.type) {
    case 'attached':
      return { ...state, status: 'clean', fingerprint: event.fingerprint, editedWhileSaving: false }

    case 'detached':
      return { ...emptySession(state.ref), status: 'no-file' }

    case 'edited':
      switch (state.status) {
        // Nothing to be dirty against yet: saving from here means choosing a
        // file, which the shell offers anyway.
        case 'no-file': return state
        // Remember it, and settle it when the write reports back — see
        // `editedWhileSaving`.
        case 'saving': return { ...state, editedWhileSaving: true }
        // Editing after being told their version changed is what turns a
        // question you could answer by reloading into one only a human can
        // settle. This is the transition most implementations miss.
        case 'external-changed': return { ...state, status: 'conflict' }
        case 'conflict': return state
        default: return { ...state, status: 'dirty' }
      }

    case 'saveRequested':
      switch (state.status) {
        // Saving over a file we have been told is newer than ours is the one
        // way to lose somebody else's work without ever being asked. Make it a
        // decision instead.
        case 'external-changed': return { ...state, status: 'conflict' }
        case 'conflict': return state
        case 'saving': return state
        default: return { ...state, status: 'saving', editedWhileSaving: false, lastError: undefined }
      }

    case 'saveSucceeded':
      if (state.status !== 'saving') {
        // A late reply from a write nobody is waiting for any more. Record what
        // is on disk — a stale fingerprint is what makes our own write look
        // foreign later — but do not claim the editor is clean.
        return { ...state, fingerprint: event.fingerprint }
      }
      return {
        ...state,
        status: state.editedWhileSaving ? 'dirty' : 'clean',
        fingerprint: event.fingerprint,
        editedWhileSaving: false,
        lastError: undefined,
      }

    case 'saveFailed':
      if (state.status !== 'saving') return state
      // Back to dirty, never to clean: the edits are still only in this window.
      return { ...state, status: 'dirty', editedWhileSaving: false, lastError: event.reason }

    case 'externalChangeDetected':
      // Our own write, arriving back as news. Every save round-trips through the
      // watcher; without this the app interrupts itself.
      if (sameFile(state.fingerprint, event.fingerprint)) return state
      switch (state.status) {
        case 'no-file': return state
        // Their change and our unsaved edits both exist. Nobody but a human can
        // choose between them.
        case 'dirty': return { ...state, status: 'conflict' }
        // A write is in flight against a file that has already moved. Whatever
        // that write does, the result is two versions.
        case 'saving': return { ...state, status: 'conflict' }
        case 'conflict': return state
        // Told twice before anyone answered: still the same question.
        case 'external-changed': return state
        default: return { ...state, status: 'external-changed' }
      }

    case 'reloadAccepted':
      // Whatever we were, we are now exactly what is on disk.
      return { ...state, status: 'clean', fingerprint: event.fingerprint, editedWhileSaving: false }

    case 'conflictResolved':
      if (state.status !== 'conflict') return state
      switch (event.resolution) {
        // Ours stands and has not been written yet — dirty, not clean, or the
        // next save never happens and their version quietly wins.
        case 'mine': return { ...state, status: 'dirty', editedWhileSaving: false }
        case 'theirs': return {
          ...state,
          status: 'clean',
          fingerprint: event.fingerprint ?? state.fingerprint,
          editedWhileSaving: false,
        }
        // Ours goes somewhere new. With a fingerprint the copy exists already
        // and this session follows it; without one the caller still has to
        // choose a file, so we stay dirty and attached to nothing new.
        case 'copy': return event.fingerprint
          ? { ...state, status: 'clean', fingerprint: event.fingerprint, editedWhileSaving: false }
          : { ...state, status: 'dirty', editedWhileSaving: false }
      }
  }
}

/** Is there anything worth writing? */
export function hasUnsavedWork(state: DocumentSession): boolean {
  return state.status === 'dirty' || state.status === 'conflict' || state.editedWhileSaving
}

/**
 * How long the editor sits still before an autosave goes out.
 *
 * Today's shell writes 400 ms after every change, which is right for
 * localStorage and wrong for a file: against a synced drive it is a continuous
 * upload of intermediate states, each one a version in somebody's history and a
 * chance for a sync client to collide with the next. A few seconds of quiet is
 * long enough to be one edit rather than forty, and short enough that nothing is
 * lost when the power goes.
 */
export const AUTOSAVE_IDLE_MS = 3_000

/**
 * Why a save is being attempted.
 *
 * Idleness is the common one; the other two exist because idleness is not
 * enough on its own. Leaving the window is the moment a person believes they are
 * done, and quitting is the last moment there is.
 */
export type SaveTrigger = 'idle' | 'blur' | 'quit'

/**
 * Should we write now?
 *
 * Pure, so the cadence is testable without a clock or a window: the caller
 * supplies the trigger and how long the editor has been quiet.
 *
 * `blur` and `quit` do not wait for the idle window — that is the whole point of
 * them — but they are still refused while a write is already in flight, because
 * two overlapping writes to one file is precisely how a half-written document
 * ends up on disk.
 */
export function shouldSaveNow(
  state: DocumentSession,
  trigger: SaveTrigger,
  msSinceLastEdit: number,
): boolean {
  if (state.status !== 'dirty') return false
  return trigger === 'idle' ? msSinceLastEdit >= AUTOSAVE_IDLE_MS : true
}
