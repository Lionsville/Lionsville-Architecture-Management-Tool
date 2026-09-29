// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The history, as the workspace uses it: is there one, take one, look at one
 * (ADR-0008, ADR-0031 §1).
 *
 * A snapshot is `record` over every scope, with the person's words; the
 * safeguard before a replace is `record` over the scope being replaced and
 * everything filed under it, which the replace writes too — and only where a
 * history is kept already, so it never starts one nobody asked for. A
 * history is read in the domain's words — the entries of the scopes that hold
 * a thing, about the record it is — and going back is the model's own restore,
 * dispatched like any step, so the history only grows.
 *
 * **But not on a scope that could not be read whole** (`ScopeState.unreadable`),
 * which takes no model command: there going back is putting the whole scope
 * back as the entry held it (`projects/putBack.ts`), with the safeguard's
 * entry first, and the scope is opened again once it reads whole.
 *
 * The one ordering that matters: a snapshot is of what is kept, so what is on
 * screen has to be written before one is taken. That is why `save` is awaited
 * rather than fired.
 */
import { useCallback, useRef, useState } from 'react'
import { draftEntrySubject } from '../../projects/entrySubject'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import { fromArrays } from '../../model/normalised'
import type { Model } from '../../model/normalised'
import { restoreCommand } from '../../model/restore'
import type { StepSummary } from '../../model/activity'
import type { Translate } from '../../i18n'
import { reasonIn } from '../messageFor'
import type { HistoryEntry, HistoryRepository } from '../../ports/HistoryRepository'
import type { ScopeRepository } from '../../ports/ScopeRepository'
import { putBackWhole } from '../../projects/putBack'
import type { ScopeSnapshot } from '../../projects/scope'
import { nodeAt, nodesOf } from '../../projects/scopeAccess'
import type { ScopeReader } from '../../projects/scopeAccess'
import type { ScopePath } from '../../projects/scopePath'
import type { ScopeId } from '../../projects/scopeState'
import type { Notify } from '../useToasts'
import { recordOf, scopesOf } from './subjects'
import type { HistorySubject } from './subjects'

/** How many entries the page lists: the newest, as a history read by a person is read. */
export const ENTRIES_SHOWN = 50

/** The day a snapshot was taken, `yyyy-mm-dd`, in the person's own clock. */
function dayOf(at: number): string {
  const held = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${held.getFullYear()}-${pad(held.getMonth() + 1)}-${pad(held.getDate())}`
}

/**
 * Where the open scope could not be read whole and may be written: the
 * scope, what puts it back, and what opens it again once it reads whole.
 */
export type PutBack = {
  scopes: Pick<ScopeRepository, 'state' | 'apply'>
  scope: ScopeId
  done: () => void
}

export type ProjectHistoryState = {
  /** Is there a history to keep? Nothing is offered where there is none. */
  available: boolean
  /** Known NOT to be: there is no history here at all. */
  unavailable: boolean
  /** Does this scope have an entry yet? The dialog explains the first time. */
  keeping: boolean
  dialogOpen: boolean
  pageOpen: boolean
  /** What the message field starts with, worked out when the dialog opens. */
  draft: string
  entries: readonly HistoryEntry[]
  chosen?: { id: string; model?: HostModel }
  /** Whose history the page is showing; absent is the whole scope's (ADR-0008). */
  subject?: HistorySubject
  /** Whether going back puts the whole scope back, because it could not be read whole. */
  whole: boolean
  /**
   * Every scope the open subject's history is read over, this one first
   * (ADR-0012 §7): what the page says under the picker — *everywhere this is
   * drawn* — and empty for the whole scope's history, which is this scope's.
   */
  places: readonly ScopePath[]
  openDialog: () => void
  closeDialog: () => void
  take: (message: string) => void
  /** Open the page, on everything or on one thing. */
  openPage: (subject?: HistorySubject) => void
  closePage: () => void
  choose: (id: string) => void
  setSubject: (subject: HistorySubject | undefined) => void
  restore: () => void
  /** Record the scope before a replace; `false` only where that was wanted and failed. */
  safeguard: () => Promise<boolean>
  label: (name: string) => void
}

/**
 * The entry a replace takes first: what is on screen written, then the scope
 * and everything filed under it recorded — a replace writes them all. `false`
 * only where the entry was due and could not be taken.
 */
async function beforeReplace(
  deps: {
    history?: HistoryRepository; kept?: () => Promise<boolean>; save: () => Promise<void>
    scopes: ScopeReader; project: () => ScopeSnapshot; notify: Notify; s: Translate
  },
  onRecorded: () => void,
): Promise<boolean> {
  const { history, kept, save, scopes, project, notify, s } = deps
  if (!history) return true
  try {
    await save()
    // Where no history is kept, none is started for this: the replace goes
    // on as its question warned.
    if (kept && !await kept()) return true
    const node = nodeAt(await scopes.tree(), project().path)
    // A scope with no document yet has nothing to lose.
    if (!node) return true
    const written = await history.record({ scopes: nodesOf(node).map((held) => held.id), subject: s('history.beforeReplace') })
    if (written.length > 0) {
      onRecorded()
      notify(s('history.takenBeforeReplace'), 'info')
    }
    return true
  } catch (cause) {
    notify(s('history.failedBeforeReplace', { message: reasonIn(cause, s) }), 'error')
    return false
  }
}

/**
 * A scope that could not be read whole, put back as an entry held it — the
 * repository keeping it as it stood first, or refusing — and then opened
 * again (`PutBack.done`). Said as it went, whichever way: where what could
 * not be read went, and what of the entry was left out.
 */
async function putBack(
  deps: Parameters<typeof beforeReplace>[0] & { history: HistoryRepository },
  entry: HistoryEntry,
  into: PutBack,
  onPut: () => void,
): Promise<void> {
  const { history, notify, s } = deps
  try {
    // The repository keeps the scope as it stood first, or refuses: an entry
    // recorded here would find nothing open, and keep nothing it could not read.
    const outcome = await putBackWhole({ scopes: into.scopes, history }, into.scope, entry, s('history.beforePutBack'))
    if (!outcome) { notify(s('history.gone'), 'warning'); return }
    onPut()
    notify(s('history.putBackDone', { date: dayOf(entry.at) }) + putBackSaid(outcome, s), 'success')
    into.done()
  } catch (cause) {
    notify(s('history.putBackFailed', { message: reasonIn(cause, s) }), 'error')
  }
}

/** What a put back kept first and what it left out, as the sentences after the one that says it landed. */
export function putBackSaid(outcome: { left?: number; setAside: readonly string[] }, s: Translate): string {
  const kept = outcome.setAside.length
    ? s('history.putBackSetAside', { files: outcome.setAside.join(', ') })
    : s('history.putBackKept')
  return kept + (outcome.left ? s('history.putBackWithout', { count: outcome.left }) : '')
}

/** Putting back the open scope, where it could not be read whole; `undefined` where it reads whole. */
function usePutBack(
  deps: Parameters<typeof beforeReplace>[0],
  recover: PutBack | undefined,
  page: { recorded: { current: number }; steps: () => readonly unknown[]; setPageOpen: (open: boolean) => void },
): ((entry: HistoryEntry) => void) | undefined {
  const { history, kept, save, scopes, project, notify, s } = deps
  const { recorded, steps, setPageOpen } = page
  const put = useCallback((entry: HistoryEntry) => {
    if (!history || !recover) return
    void putBack({ history, kept, save, scopes, project, notify, s }, entry, recover, () => {
      // The entry before it covered what the session did: the next draft starts after it.
      recorded.current = steps().length
      setPageOpen(false)
    })
  }, [history, kept, save, scopes, project, notify, s, recover, recorded, steps, setPageOpen])
  return recover ? put : undefined
}

export function useProjectHistory(deps: {
  history?: HistoryRepository
  /** Whether one is kept here already: the entry before a replace never starts one. Absent where one always is. */
  kept?: () => Promise<boolean>
  /** The tree, for which scopes a history is asked about by address. */
  scopes: ScopeReader
  index?: ScopeIndex
  project: () => ScopeSnapshot
  steps: () => readonly { summary: StepSummary }[]
  /** Write what is on screen, rejecting where it did not land: no entry is recorded over a refused save. */
  save: () => Promise<void>
  indexed: () => Model
  dispatch: (command: Command) => unknown
  /** Where the open scope could not be read whole and may be written ({@link PutBack}). */
  recover?: PutBack
  notify: Notify
  s: Translate
}): ProjectHistoryState {
  const { history, kept, scopes, index, project, steps, save, indexed, dispatch, recover, notify, s } = deps

  const [keeping, setKeeping] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pageOpen, setPageOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [entries, setEntries] = useState<readonly HistoryEntry[]>([])
  const [chosen, setChosen] = useState<{ id: string; model?: HostModel } | undefined>(undefined)
  const [subject, setSubjectState] = useState<HistorySubject | undefined>(undefined)
  const [places, setPlaces] = useState<readonly ScopePath[]>([])

  /**
   * How many of the session's steps the last snapshot covered. The draft is
   * made from the ones after it, so a second snapshot does not repeat the first.
   */
  const recorded = useRef(0)

  /** The identities of the scopes at these addresses, as the tree has them now. */
  const idsAt = useCallback(async (addresses: readonly ScopePath[]): Promise<string[]> => {
    const tree = await scopes.tree()
    return addresses.flatMap((address) => nodeAt(tree, address)?.id ?? [])
  }, [scopes])

  const refused = useCallback((): boolean => {
    if (history) return false
    notify(s('history.unavailable'), 'warning')
    return true
  }, [history, notify, s])

  const openDialog = useCallback(() => {
    if (refused() || !history) return
    // Drafted now rather than held: the log has grown since the dialog was last
    // open, and a stale draft is worse than none.
    const drafted = draftEntrySubject(steps().slice(recorded.current).map((held) => held.summary), s)
    // An empty log is not an empty snapshot. The scope can have changed
    // elsewhere, or the last snapshot may have covered everything this session
    // did — and a message field that cannot be submitted because nothing
    // happened HERE would be a dead end.
    setDraft(drafted || s('history.defaultMessage'))
    setDialogOpen(true)
    void idsAt([project().path]).then(
      async (ids) => setKeeping(ids.length > 0 && (await history.entries({ scopes: ids, limit: 1 })).entries.length > 0),
      () => setKeeping(true),
    )
  }, [refused, history, steps, idsAt, project, s])

  const take = useCallback((message: string) => {
    if (!history) return
    setDialogOpen(false)
    void (async () => {
      // What is on screen first. A snapshot of a scope that does not yet hold
      // what is on screen is a snapshot of the wrong thing, and silently so.
      await save()
      const written = await history.record({ subject: message })
      setKeeping(true)
      recorded.current = steps().length
      notify(s(written.length > 0 ? 'history.taken' : 'history.nothingToRecord'), written.length > 0 ? 'success' : 'info')
    })().catch((cause: unknown) => {
      notify(s('history.failed', { message: reasonIn(cause, s) }), 'error')
    })
  }, [history, save, steps, notify, s])

  const choose = useCallback((id: string) => {
    const entry = entries.find((held) => held.id === id)
    if (!history || !entry) return
    setChosen({ id })
    void history.stateAt(entry.scope, id).then(
      (held) => setChosen({ id, model: held?.model }),
      (cause: unknown) => {
        setChosen({ id })
        notify(s('history.readFailed', { message: reasonIn(cause, s) }), 'error')
      },
    )
  }, [history, entries, notify, s])

  const list = useCallback((of: HistorySubject | undefined) => {
    if (!history) return
    // Everywhere it is kept, which for an element's page is every scope that
    // holds the id (ADR-0012 §7) and for everything else is this scope alone.
    const addresses = scopesOf(of, project().path, index)
    setPlaces(of ? addresses : [])
    void idsAt(addresses).then(async (ids) => (ids.length === 0 ? [] : (await history.entries({
      scopes: ids, ...(of ? { record: recordOf(of) } : {}), limit: ENTRIES_SHOWN,
    })).entries)).then(setEntries, (cause: unknown) => {
      setEntries([])
      notify(s('history.readFailed', { message: reasonIn(cause, s) }), 'error')
    })
  }, [history, project, index, idsAt, notify, s])

  const openPage = useCallback((of?: HistorySubject) => {
    if (refused()) return
    setChosen(undefined)
    setSubjectState(of)
    setPageOpen(true)
    list(of)
  }, [refused, list])

  const safeguard = useCallback(() => beforeReplace({ history, kept, save, scopes, project, notify, s }, () => {
    recorded.current = steps().length
  }), [history, kept, save, scopes, project, steps, notify, s])

  const putBackAt = usePutBack({ history, kept, save, scopes, project, notify, s }, recover, { recorded, steps, setPageOpen })

  const restore = useCallback(() => {
    if (!chosen?.model) return
    const entry = entries.find((held) => held.id === chosen.id)
    if (putBackAt) { if (entry) putBackAt(entry); return }
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
  }, [chosen, entries, putBackAt, subject, indexed, dispatch, notify, s, openDialog])

  const label = useCallback((name: string) => {
    const entry = entries.find((held) => held.id === chosen?.id)
    if (!history || !entry) return
    void history.label(entry.scope, entry.id, name).then((outcome) => {
      switch (outcome) {
        case 'done': notify(s('history.labelled'), 'success'); list(subject); break
        case 'exists': notify(s('history.labelExists'), 'warning'); break
        case 'unnamed': notify(s('history.labelUnnamed'), 'warning'); break
        case 'gone': notify(s('history.readFailed', { message: outcome }), 'warning'); break
      }
    }, (cause: unknown) => {
      notify(s('history.labelFailed', { reason: reasonIn(cause, s) }), 'error')
    })
  }, [history, entries, chosen, subject, list, notify, s])

  const setSubject = useCallback((of: HistorySubject | undefined) => {
    // The chosen snapshot is dropped with the list: it may not be in the new one.
    setChosen(undefined)
    setSubjectState(of)
    list(of)
  }, [list])

  return {
    available: history !== undefined,
    unavailable: history === undefined,
    keeping,
    dialogOpen,
    pageOpen,
    draft,
    entries,
    chosen,
    subject,
    whole: recover !== undefined,
    places,
    openDialog,
    closeDialog: useCallback(() => setDialogOpen(false), []),
    take,
    openPage,
    closePage: useCallback(() => setPageOpen(false), []),
    choose,
    setSubject,
    restore,
    label,
    safeguard,
  }
}
