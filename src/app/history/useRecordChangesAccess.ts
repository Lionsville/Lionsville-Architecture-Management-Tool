// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the readers' *Changes* read (ADR-0038, amended §11), filled from the
 * source's history: the entries that wrote a record, and — only when the list
 * is opened, because each costs the scope as it was — what each did to it.
 * Absent where the source keeps no history, and the readers then draw
 * nothing.
 */
import { useMemo, useRef } from 'react'
import type { HistoryRepository } from '../../ports/HistoryRepository'
import type { ScopeRepository } from '../../ports/ScopeRepository'
import type { ScopePath } from '../../projects/scopePath'
import { nodeAt } from '../../projects/scopeAccess'
import { useStrings } from '../../i18n/LanguageContext'
import type { RecordChangeEntry, RecordChangesAccess } from '../../comments/ui/RecordChanges'
import { recordChangeLines } from './recordChanges'

/** How many entries a record's line counts and its list shows; more is said as more. */
export const RECORD_CHANGES_SHOWN = 20

export function useRecordChangesAccess(deps: {
  history: HistoryRepository | undefined
  scopes: Pick<ScopeRepository, 'tree'>
  /** The open scope's path: where a record is kept when a reader names no other. */
  here: () => ScopePath
}): RecordChangesAccess | undefined {
  const { history, scopes, here } = deps
  const { t } = useStrings()
  // A scope's id by its path, read from the tree once and again on a miss: a
  // reader opened twice asks the repository once.
  const ids = useRef(new Map<ScopePath, string>())
  return useMemo(() => {
    if (!history) return undefined
    const idOf = async (path: ScopePath): Promise<string | undefined> => {
      const known = ids.current.get(path)
      if (known !== undefined) return known
      const id = nodeAt(await scopes.tree(), path)?.id
      if (id !== undefined) ids.current.set(path, id)
      return id
    }
    return {
      entriesOf: async (about, scope) => {
        const id = await idOf(scope ?? here())
        if (id === undefined) return { entries: [], more: false }
        const page = await history.entries({ scopes: [id], record: about, limit: RECORD_CHANGES_SHOWN })
        const entries: RecordChangeEntry[] = page.entries.map((one) => ({
          id: one.id, at: one.at, by: one.by, ...(one.via ? { via: one.via } : {}),
        }))
        return { entries, more: page.next !== undefined }
      },
      whatOf: async (about, scope, listed, more) => {
        const id = await idOf(scope ?? here())
        if (id === undefined) return listed.map(() => '')
        const states = await Promise.all(listed.map((one) => history.stateAt(id, one.id)))
        return recordChangeLines(about, states.map((state) => state?.model), !more, t('changes.began'), t)
      },
    }
  }, [history, scopes, here, t])
}
