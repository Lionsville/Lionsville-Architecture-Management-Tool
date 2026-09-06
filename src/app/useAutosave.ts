/**
 * Saving the project without anybody asking for it.
 *
 * Briefly debounced after every change, and once more when the tab closes. THIS
 * is what you get back if the browser falls over — not the file you saved
 * yourself.
 *
 * Phase 6 changes the cadence (a synced file on OneDrive does not tolerate a
 * write every 400 ms), and that will be a change in this file alone.
 */
import { useCallback, useEffect } from 'react'
import type { ProjectSnapshot } from '../projects/project'
import type { ModelSession } from './useModelSession'
import type { StorageNotice } from './useStorageNotice'

/**
 * What this hook needs from a store: writing it out. Nothing else.
 *
 * Not `load`, not `list`, not `remove` — an autosave that could reach those
 * would be one refactor away from saving the open project over a different one.
 * The project carries its own ref, so there is no second argument to get wrong.
 */
export type ProjectSaver = {
  save(project: ProjectSnapshot): Promise<void>
}

/** How long it must be quiet before a save happens. */
const IDLE_MS = 400

export type Autosave = {
  /**
   * Save now, without waiting.
   *
   * The editor asks for this (`onForceSave`) at moments when it knows there is
   * something to lose — before an export, for instance.
   */
  forceSave: () => void
}

export function useAutosave(deps: {
  session: ModelSession
  projects: ProjectSaver
  onSaved: (at: Date) => void
  onResult: StorageNotice
}): Autosave {
  const { session, projects, onSaved, onResult } = deps
  const { model, activeDiagramId, logoLibrary, snapshot, flush } = session

  const persist = useCallback(() => {
    projects.save(snapshot()).then(
      () => { onSaved(new Date()); onResult(true) },
      () => onResult(false),
    )
  }, [projects, snapshot, onSaved, onResult])

  useEffect(() => {
    const t = window.setTimeout(persist, IDLE_MS)
    return () => window.clearTimeout(t)
  }, [model, activeDiagramId, logoLibrary, persist])

  useEffect(() => {
    const save = () => {
      flush()
      // The one fire-and-forget in the shell, and deliberately so: the tab is
      // closing, there is nobody left to tell and no screen left to tell them
      // on. The catch is here only so a refusal does not surface as an
      // unhandled rejection on a page that is halfway gone.
      projects.save(snapshot()).catch(() => {})
    }
    window.addEventListener('beforeunload', save)
    return () => window.removeEventListener('beforeunload', save)
  }, [flush, projects, snapshot])

  const forceSave = useCallback(() => { flush(); persist() }, [flush, persist])
  return { forceSave }
}
