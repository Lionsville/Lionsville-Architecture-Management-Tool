// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What an entry kept of a scope that could not be read, saved as a file the
 * person keeps (`HistoryEntry.unread`): a scope put back whole was kept as
 * it stood first, and what could not be read is theirs to take to somebody
 * who can read it — not something only a developer's tools can reach.
 */
import { useCallback } from 'react'
import type { Translate } from '../../i18n'
import { slug } from '../../model/keys'
import { reasonOf } from '../../platform/errors'
import type { SavedDocument } from '../../ports/DocumentGateway'
import type { HistoryEntry, HistoryRepository } from '../../ports/HistoryRepository'
import type { Notify } from '../useToasts'

/** The file's name: the scope's, the entry's day, what it holds, and the ending the history gave it. */
export function unreadFileName(scopeName: string, at: number, extension: string): string {
  return `${slug(scopeName) || 'scope'}-${new Date(at).toISOString().slice(0, 10)}-unread.${extension}`
}

/** Saving an entry's unread part, where the history can give it; `undefined` where it cannot. */
export function useSaveUnread(deps: {
  history?: Pick<HistoryRepository, 'unreadAt'>
  keep: (doc: SavedDocument) => Promise<void>
  scopeName: () => string
  notify: Notify
  s: Translate
}): ((entry: HistoryEntry) => void) | undefined {
  const { history, keep, scopeName, notify, s } = deps
  const save = useCallback((entry: HistoryEntry) => {
    if (!history?.unreadAt) return
    void history.unreadAt(entry.scope, entry.id).then(async (kept) => {
      if (kept === undefined) { notify(s('history.gone'), 'warning'); return }
      await keep({ name: unreadFileName(scopeName(), entry.at, kept.extension), mediaType: kept.mediaType, text: kept.text })
      notify(s('history.savedUnread'), 'success')
    }).catch((cause: unknown) => notify(s('shell.saveFileFailed', { message: reasonOf(cause) }), 'error'))
  }, [history, keep, scopeName, notify, s])
  return history?.unreadAt ? save : undefined
}
