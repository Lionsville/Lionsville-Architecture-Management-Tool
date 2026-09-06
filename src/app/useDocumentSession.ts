/**
 * Saving, and telling the truth about it.
 *
 * This is `projects/documentSession.ts` — the state machine — with a clock, a
 * store and a window wired to it. The machine is where the awkward pairs live
 * (an edit during a write, a change on disk during an edit, our own write
 * arriving back as news); this file has nothing in it but the plumbing that
 * feeds it, which is the whole reason the split exists.
 *
 * What it replaces is a 400 ms debounce that wrote fire-and-forget and had no
 * idea whether anything was outstanding. That was tolerable while a save was
 * `localStorage.setItem` — synchronous, instant, and free. Against a file in a
 * working directory it is not: it is a continuous stream of intermediate states
 * into somebody's sync client, and it leaves the app unable to answer the one
 * question that matters when the window closes.
 *
 * Three triggers, and each is a different belief about being finished. Idle:
 * three seconds of quiet is one edit rather than forty. Blur: leaving the window
 * is the moment a person thinks they are done. Quit: the last moment there is,
 * and the only one that also asks.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react'
import {
  AUTOSAVE_IDLE_MS, documentSession, hasUnsavedWork, openSession, shouldSaveNow,
} from '../projects/documentSession'
import type { DocumentEvent, DocumentSession, SaveTrigger } from '../projects/documentSession'
import type { ProjectSnapshot } from '../projects/project'
import type { ProjectRef } from '../projects/projectRef'
import type { StorageNotice } from './useStorageNotice'
import type { StoragePressure } from '../ports/ProjectStore'

/**
 * What this hook needs from a store: writing it out. Nothing else.
 *
 * Not `load`, not `list`, not `remove` — an autosave that could reach those
 * would be one refactor away from saving the open project over a different one.
 * The project carries its own ref, so there is no second argument to get wrong.
 */
export type ProjectSaver = {
  save(project: ProjectSnapshot): Promise<void>
  /**
   * Reading is here for one reason only: taking their version. The alternative
   * is the workspace loading the project itself and telling the machine
   * afterwards, which puts a transition somewhere it cannot be tested.
   */
  load?(ref: ProjectRef): Promise<ProjectSnapshot | undefined>
  /**
   * How full it is, where it can say — see `ports/ProjectStore`. Read after a
   * save rather than before one: the number that matters is what the write it
   * just did leaves for the next one, and asking first would either measure a
   * project this store is about to replace or cost a second serialisation.
   */
  pressure?(): StoragePressure | undefined
}

/** The part of the editing session this one reads: what changed, and what to write. */
export type SavableSession = {
  model: unknown
  activeDiagramId: string
  logoLibrary: unknown
  /** The project as it stands NOW — asked at save time, never at render time. */
  snapshot: () => ProjectSnapshot
}

export type DocumentSessionHook = {
  /** What the bar says, and what a close prompt asks about. */
  state: DocumentSession
  /**
   * Take what is on disk. Answers the "changed on disk" notice and the "take
   * theirs" half of a conflict — the same act in both, which is why it is one
   * function.
   */
  takeTheirs: () => void
  /**
   * Ours stands. The document goes back to dirty, never to clean: their
   * version is still the one on disk until the next save writes over it.
   */
  keepMine: () => void
  /**
   * Save now, without waiting, and answer when it has landed.
   *
   * The editor asks for this (`onForceSave`) at moments when it knows there is
   * something to lose — before an export, for instance. The promise matters to
   * one caller: a snapshot has to be taken of a folder that already holds what
   * is on screen.
   */
  forceSave: () => Promise<void>
}

export function useDocumentSession(deps: {
  session: SavableSession
  projects: ProjectSaver
  onSaved: (at: Date) => void
  onResult: StorageNotice
  /**
   * The store is filling up. Called after every successful save that a store
   * can answer for; absent where nothing is listening.
   */
  onPressure?: (pressure: StoragePressure) => void
  /**
   * Somebody else changed this project's files. Absent where nothing can
   * watch — a browser tab — and the document then simply never leaves the
   * three states it can reach on its own.
   */
  watch?: (onChanged: () => void) => () => void
  /** Their version, once it has been read. The caller puts it on screen. */
  onAdopt?: (project: ProjectSnapshot) => void
  /**
   * Is there work that closing the window would lose?
   *
   * Told to whoever owns the window. In a browser that is `beforeunload`, which
   * this hook handles itself; on the desktop the window belongs to another
   * process, and it cannot know unless it is told.
   */
  onUnsavedWork?: (unsaved: boolean) => void
}): DocumentSessionHook {
  const {
    session, projects, onSaved, onResult, onPressure, watch, onAdopt, onUnsavedWork,
  } = deps
  const { model, activeDiagramId, logoLibrary, snapshot } = session

  const [state, dispatch] = useReducer(documentSession, snapshot().ref, openSession)

  /**
   * The same machine, kept in step by hand.
   *
   * The timers and the window listeners run outside React's render, and a
   * dispatch does not change what they can see until React has re-rendered.
   * Two timers firing in one turn would then both read the state from before
   * either of them acted — and both write. So every event goes through the
   * reducer twice: once here, immediately, and once where React keeps it. The
   * reducer is pure, so the two cannot disagree.
   */
  const held = useRef(state)
  const apply = useCallback((event: DocumentEvent) => {
    held.current = documentSession(held.current, event)
    dispatch(event)
  }, [])
  const editedAt = useRef(0)

  const save = useCallback((trigger: SaveTrigger): Promise<void> => {
    if (!shouldSaveNow(held.current, trigger, Date.now() - editedAt.current)) {
      return Promise.resolve()
    }
    apply({ type: 'saveRequested' })
    return projects.save(snapshot()).then(
      () => {
        // No fingerprint: a store that keeps projects in a browser has no file
        // to fingerprint, and inventing one would answer "was that our own
        // write?" wrongly rather than not at all. The folder store supplies one
        // once there is a watcher to need it.
        apply({ type: 'saveSucceeded' })
        onSaved(new Date())
        onResult(true)
        const pressure = projects.pressure?.()
        if (pressure) onPressure?.(pressure)
      },
      (cause: unknown) => {
        apply({ type: 'saveFailed', reason: String(cause) })
        onResult(false)
      },
    )
  }, [apply, projects, snapshot, onSaved, onResult])

  // Read by the timers, which are installed once and must not hold the save
  // they were installed with.
  const saving = useRef(save)
  saving.current = save

  /**
   * Every change to what would be written is an edit, and every edit restarts
   * the wait — the timer lives in this effect for that reason, rather than
   * watching the status. Watching the status would arm it on the first
   * keystroke of a sentence and never again, because the fortieth keystroke
   * leaves the status exactly where the first one put it.
   *
   * Not on the first render, though: the project was just read from the store
   * and is not dirty because it was drawn.
   */
  const opened = useRef(true)
  useEffect(() => {
    if (opened.current) { opened.current = false; return undefined }
    editedAt.current = Date.now()
    apply({ type: 'edited' })
    const timer = window.setTimeout(() => saving.current('idle'), AUTOSAVE_IDLE_MS)
    return () => window.clearTimeout(timer)
    // These three and nothing else. Everything the body reaches for besides
    // them is a ref or is stable for the life of the hook; a dependency that
    // changed identity per render would read as an edit per render.
  }, [model, activeDiagramId, logoLibrary])

  /**
   * The two cases the effect above cannot cover, and they are the same case: a
   * document that became dirty without anybody typing. A write that landed with
   * edits behind it, and a conflict somebody has just decided in our favour.
   * Nothing new will be typed, so nothing else would arm the wait, and the work
   * would sit there until the next keystroke.
   *
   * A refusal deliberately does not re-arm. A store that is saying no —
   * quota, permission, a drive that is gone — would otherwise be asked again
   * every three seconds for as long as the window is open; the next edit, or
   * leaving the window, is a better moment to find out whether it has changed
   * its mind.
   */
  const before = useRef(state.status)
  useEffect(() => {
    const was = before.current
    before.current = state.status
    const decided = was === 'saving' || was === 'conflict'
    if (state.status !== 'dirty' || !decided || state.lastError) return undefined
    const timer = window.setTimeout(() => saving.current('idle'), AUTOSAVE_IDLE_MS)
    return () => window.clearTimeout(timer)
  }, [state.status, state.lastError])

  useEffect(() => {
    const onBlur = () => save('blur')
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [save])

  const outstanding = hasUnsavedWork(state)
  useEffect(() => {
    onUnsavedWork?.(outstanding)
    // On the way out there is nothing left to lose in this workspace, whatever
    // it was holding a moment ago — the next one will say for itself.
    return () => onUnsavedWork?.(false)
  }, [outstanding, onUnsavedWork])

  useEffect(() => {
    const onLeaving = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedWork(held.current)) return
      // Both, and in this order. The prompt is the only thing that can actually
      // stop the loss; the write is what makes "leave anyway" cost nothing when
      // the store is fast enough to finish. It cannot be awaited — nothing may
      // await here — so it is deliberately fire-and-forget, with a catch so a
      // refusal does not surface as an unhandled rejection on a page that is
      // halfway gone.
      event.preventDefault()
      projects.save(snapshot()).catch(() => {})
    }
    window.addEventListener('beforeunload', onLeaving)
    return () => window.removeEventListener('beforeunload', onLeaving)
  }, [projects, snapshot])

  /**
   * The other author.
   *
   * Whether this is news at all was settled before it got here: the desktop
   * adapter drops the changes our own writes caused, by content, so everything
   * that arrives is somebody else's. No fingerprint travels with it — a project
   * is a folder of files and there is no one file to fingerprint, which is
   * exactly why `sameFile` treats an absent one as "not ours".
   */
  useEffect(() => {
    if (!watch) return undefined
    return watch(() => apply({ type: 'externalChangeDetected' }))
  }, [watch, apply])

  const takeTheirs = useCallback(() => {
    const ref = snapshot().ref
    void projects.load?.(ref)?.then((project) => {
      // Gone from disk entirely: somebody deleted the project while it was
      // open. Nothing to take, and the copy on screen is now the only one —
      // which the unsaved-work prompt will insist on when the window closes.
      if (!project) return
      onAdopt?.(project)
      apply({ type: 'reloadAccepted' })
    }, (cause: unknown) => {
      apply({ type: 'saveFailed', reason: String(cause) })
    })
  }, [apply, projects, snapshot, onAdopt])

  const keepMine = useCallback(() => {
    // From `external-changed` this is a decision, and the machine only accepts
    // one in `conflict` — deliberately, because saving over a file we have been
    // told is newer is the one way to lose somebody's work without being asked.
    // Editing is what turns the question into a conflict, and choosing "mine"
    // IS an edit as far as the document is concerned.
    apply({ type: 'edited' })
    apply({ type: 'conflictResolved', resolution: 'mine' })
  }, [apply])

  // A person asking is not the idle timer, so it does not wait — but it is
  // still refused when there is nothing to write, or when writing would land on
  // top of somebody else's change.
  const forceSave = useCallback(() => save('blur'), [save])

  return { state, forceSave, takeTheirs, keepMine }
}
