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
import { historyPaths } from '../../projects/historyPath'
import type { HistorySubject } from '../../projects/historyPath'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/fromInterchange'
import { fromArrays } from '../../model/normalised'
import type { Model } from '../../model/normalised'
import { restoreCommand } from '../../model/restore'
import type { StepSummary } from '../../model/activity'
import type { Translate } from '../../i18n'
import { reasonOf } from '../../platform/errors'
import type { ProjectSnapshot } from '../../projects/project'
import type { HistoryEntry, ProjectHistory } from '../../ports/ProjectHistory'
import type { Notify } from '../useToasts'

/** The day a snapshot was taken, `yyyy-mm-dd`, in the person's own clock. */
function dayOf(at: number): string {
  const held = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${held.getFullYear()}-${pad(held.getMonth() + 1)}-${pad(held.getDate())}`
}

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
  /** Whose history the page is showing; absent is the whole project's (ADR-0008). */
  subject?: HistorySubject
  openDialog: () => void
  closeDialog: () => void
  take: (message: string) => void
  /** Open the page, on everything or on one thing. */
  openPage: (subject?: HistorySubject) => void
  closePage: () => void
  choose: (id: string) => void
  /** Narrow or widen what the open page is about; the list is read again. */
  setSubject: (subject: HistorySubject | undefined) => void
  /**
   * Make the subject — or, with none, the whole project — what the chosen
   * snapshot held, as one command through the session (ADR-0008). Nothing
   * happens until the snapshot has been read; the page's button waits for it.
   */
  restore: () => void
}

export function useProjectHistory(deps: {
  history?: ProjectHistory
  /** What is on screen, and how it got there. */
  project: () => ProjectSnapshot
  steps: () => readonly { summary: StepSummary }[]
  /** Write the project out and answer when it has landed. */
  save: () => Promise<void>
  /** The session's two halves a restore needs: what stands, and the one way to change it. */
  indexed: () => Model
  dispatch: (command: Command) => unknown
  notify: Notify
  s: Translate
  /** A snapshot succeeded. What follows — a push, perhaps — is the caller's. */
  onTaken?: () => void
}): ProjectHistoryState {
  const { history, project, steps, save, indexed, dispatch, notify, s, onTaken } = deps

  const [available, setAvailable] = useState(false)
  const [keeping, setKeeping] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pageOpen, setPageOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [entries, setEntries] = useState<readonly HistoryEntry[]>([])
  const [chosen, setChosen] = useState<{ id: string; model?: HostModel } | undefined>(undefined)
  const [subject, setSubjectState] = useState<HistorySubject | undefined>(undefined)

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
      // Whether or not anything was recorded: an earlier push may have been
      // refused, and the snapshot is the moment this machine tries again.
      onTaken?.()
    })().catch((cause: unknown) => {
      notify(s('history.failed', { message: reasonOf(cause) }), 'error')
    })
  }, [history, keeping, save, steps, notify, s, onTaken])

  const choose = useCallback((id: string) => {
    if (!history) return
    setChosen({ id })
    void history.projectAt(project().ref, id).then(
      (held) => setChosen({ id, model: held?.model }),
      (cause: unknown) => {
        setChosen({ id })
        notify(s('history.readFailed', { message: reasonOf(cause) }), 'error')
      },
    )
  }, [history, project, notify, s])

  /**
   * The list, for one subject or for everything. A subject the model cannot
   * place (a decision that is gone) has no paths and therefore no snapshots —
   * an empty list, not everybody's.
   */
  const list = useCallback((of: HistorySubject | undefined) => {
    if (!history) return
    const held = project()
    const paths = of ? historyPaths(of, held.model) : undefined
    const read = of && !paths ? Promise.resolve([]) : history.entries(undefined, paths && { ref: held.ref, paths })
    void read.then(setEntries, (cause: unknown) => {
      setEntries([])
      notify(s('history.readFailed', { message: reasonOf(cause) }), 'error')
    })
  }, [history, project, notify, s])

  const openPage = useCallback((of?: HistorySubject) => {
    if (!history) return
    setChosen(undefined)
    setSubjectState(of)
    setPageOpen(true)
    list(of)
  }, [history, list])

  /**
   * The restore itself. A refusal is a toast and nothing else; a success
   * closes the page, so the person sees what came back, and offers the
   * snapshot rather than taking it — a restore that was itself a mistake is
   * one ⌘Z away until it is recorded.
   */
  const restore = useCallback(() => {
    if (!chosen?.model) return
    const entry = entries.find((held) => held.id === chosen.id)
    const asOf = entry ? dayOf(entry.at) : ''
    const result = restoreCommand(fromArrays(chosen.model), indexed(), subject, asOf)
    if (!result.ok) { notify(s(result.reason), 'warning'); return }
    dispatch(result.command)
    setPageOpen(false)
    const name = result.command.type === 'restore' ? result.command.restored.name : ''
    let message = subject
      ? s('history.restored', { name, date: asOf })
      : s('history.restoredProject', { date: asOf })
    if (result.dropped) message += s('history.restoredDropped', { count: result.dropped })
    if (result.kept) message += s('history.restoredKept', { count: result.kept })
    notify(message, 'success', { label: s('history.snapshotNow'), onClick: openDialog })
  }, [chosen, entries, subject, indexed, dispatch, notify, s, openDialog])

  const setSubject = useCallback((of: HistorySubject | undefined) => {
    // The chosen snapshot is dropped with the list: it may not be in the new one.
    setChosen(undefined)
    setSubjectState(of)
    list(of)
  }, [list])

  return {
    available,
    keeping,
    dialogOpen,
    pageOpen,
    draft,
    entries,
    chosen,
    subject,
    openDialog,
    closeDialog: useCallback(() => setDialogOpen(false), []),
    take,
    openPage,
    closePage: useCallback(() => setPageOpen(false), []),
    choose,
    setSubject,
    restore,
  }
}
