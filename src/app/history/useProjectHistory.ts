/**
 * The history, as the workspace uses it: is there one, take one, look at one.
 *
 * All of the awkwardness of layer two lives here, and it is mostly about
 * saying no gracefully. There may be no git on the machine; the folder may not
 * be keeping history; the project may not have existed at the snapshot somebody
 * clicked. None of those is a failure and none of them may interrupt a save —
 * so every one of them is a state this hook can sit in, and the menu simply
 * does not offer what cannot be done.
 *
 * The one ordering that matters: a snapshot is of the FOLDER, so the folder has
 * to hold what is on screen before one is taken. That is why `save` is awaited
 * rather than fired.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { draftCommitMessage } from '../../projects/commitMessage'
import type { HostModel } from '../../model/fromInterchange'
import type { StepSummary } from '../../model/activity'
import type { Translate } from '../../i18n'
import { reasonOf } from '../../platform/errors'
import type { ProjectSnapshot } from '../../projects/project'
import type { HistoryEntry, ProjectHistory } from '../../ports/ProjectHistory'
import type { Notify } from '../useToasts'

export type ProjectHistoryState = {
  /** Can this machine keep a history at all? Nothing is offered when it cannot. */
  available: boolean
  /** Is this folder keeping one yet? The dialog explains the first time. */
  keeping: boolean
  dialogOpen: boolean
  pageOpen: boolean
  /** What the message field starts with, worked out when the dialog opens. */
  draft: string
  entries: readonly HistoryEntry[]
  chosen?: { id: string; model?: HostModel }
  openDialog: () => void
  closeDialog: () => void
  take: (message: string) => void
  openPage: () => void
  closePage: () => void
  choose: (id: string) => void
}

export function useProjectHistory(deps: {
  history?: ProjectHistory
  /** What is on screen, and how it got there. */
  project: () => ProjectSnapshot
  steps: () => readonly { summary: StepSummary }[]
  /** Write the project out and answer when it has landed. */
  save: () => Promise<void>
  notify: Notify
  s: Translate
}): ProjectHistoryState {
  const { history, project, steps, save, notify, s } = deps

  const [available, setAvailable] = useState(false)
  const [keeping, setKeeping] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pageOpen, setPageOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [entries, setEntries] = useState<readonly HistoryEntry[]>([])
  const [chosen, setChosen] = useState<{ id: string; model?: HostModel } | undefined>(undefined)

  /** How much of this session's log the last snapshot already covers. */
  const recorded = useRef(0)

  useEffect(() => {
    if (!history) return
    void history.available().then(async (can) => {
      setAvailable(can)
      if (can) setKeeping(await history.keeping())
    }, () => setAvailable(false))
  }, [history])

  const openDialog = useCallback(() => {
    // Drafted now rather than held: the log has grown since the dialog was last
    // open, and a stale draft is worse than none.
    const drafted = draftCommitMessage(steps().slice(recorded.current).map((held) => held.summary), s)
    // An empty log is not an empty snapshot. The folder can have changed on
    // another machine, or the last snapshot may have covered everything this
    // session did — and a message field that cannot be submitted because
    // nothing happened HERE would be a dead end.
    setDraft(drafted || s('history.defaultMessage'))
    setDialogOpen(true)
  }, [steps, s])

  const take = useCallback((message: string) => {
    if (!history) return
    setDialogOpen(false)
    void (async () => {
      // The folder first. A snapshot of a folder that does not yet hold what is
      // on screen is a snapshot of the wrong thing, and it would be silently so.
      await save()
      if (!keeping) await history.start()
      const written = await history.snapshot(message)
      setKeeping(true)
      recorded.current = steps().length
      notify(s(written ? 'history.taken' : 'history.nothingToRecord'), written ? 'success' : 'info')
    })().catch((cause: unknown) => {
      notify(s('history.failed', { message: reasonOf(cause) }), 'error')
    })
  }, [history, keeping, save, steps, notify, s])

  const choose = useCallback((id: string) => {
    if (!history) return
    setChosen({ id })
    void history.projectAt(project().ref, id).then(
      (held) => setChosen({ id, model: held?.model }),
      (cause: unknown) => {
        setChosen({ id })
        notify(s('history.failed', { message: reasonOf(cause) }), 'error')
      },
    )
  }, [history, project, notify, s])

  const openPage = useCallback(() => {
    if (!history) return
    setChosen(undefined)
    setPageOpen(true)
    void history.entries().then(setEntries, (cause: unknown) => {
      setEntries([])
      notify(s('history.failed', { message: reasonOf(cause) }), 'error')
    })
  }, [history, notify, s])

  return {
    available,
    keeping,
    dialogOpen,
    pageOpen,
    draft,
    entries,
    chosen,
    openDialog,
    closeDialog: useCallback(() => setDialogOpen(false), []),
    take,
    openPage,
    closePage: useCallback(() => setPageOpen(false), []),
    choose,
  }
}
