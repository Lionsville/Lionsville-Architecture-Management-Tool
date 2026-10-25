// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Who changed a record, on every reader that has a page (ADR-0038, amended
 * §11): *Recorded by X · last changed by Y · N changes*, and the *Changes*
 * list under it — when, who, via which client, and what, in the record's own
 * terms. Read from the history by record (ADR-0031 §1) through the one seam
 * the shell provides, so a reader mounts `<RecordChanges about />` and
 * nothing else. *History…* still opens the full page with a restore.
 *
 * The line costs one read of the history; what each entry did costs the scope
 * as it was at each, so it is read only when the list is opened. With no
 * provider, or no entry yet, a reader draws nothing here, as a thread does.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import type { RecordKey } from '../../model/recordKey'
import { useStrings } from '../../i18n/LanguageContext'
import { LOCALE } from '../../i18n'

/** One history entry that wrote a record: when, who, and through which client. */
export type RecordChangeEntry = {
  id: string
  /** Epoch milliseconds. */
  at: number
  /** Who, in the source's word: an account's name, a commit's author. */
  by: string
  /** The client it came through, where not the app itself: an agent's name. */
  via?: string
}

export type RecordChangesAccess = {
  /** The entries that wrote a record, newest first, and whether older ones were left unread. */
  readonly entriesOf: (about: RecordKey, scope?: string) => Promise<{ entries: readonly RecordChangeEntry[]; more: boolean }>
  /** What each of those entries did to it, in the same order. */
  readonly whatOf: (about: RecordKey, scope: string | undefined, entries: readonly RecordChangeEntry[], more: boolean) => Promise<readonly string[]>
}

const ChangesContext = createContext<RecordChangesAccess | undefined>(undefined)

export function RecordChangesProvider({ value, children }: { value: RecordChangesAccess | undefined; children: ReactNode }) {
  return <ChangesContext.Provider value={value}>{children}</ChangesContext.Provider>
}

export function useRecordChanges(): RecordChangesAccess | undefined {
  return useContext(ChangesContext)
}

function when(at: number, locale: string): string {
  return new Date(at).toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function who(entry: RecordChangeEntry, via: (agent: string) => string): string {
  return entry.via ? `${entry.by} ${via(entry.via)}` : entry.by
}

type Listed = { entries: readonly RecordChangeEntry[]; more: boolean }

/** The entries that wrote the record, read again whenever the record or the source changes. */
function useEntries(access: RecordChangesAccess | undefined, about: RecordKey, scope: string | undefined): Listed | undefined {
  const [listed, setListed] = useState<Listed>()
  useEffect(() => {
    if (!access) return undefined
    let live = true
    // A history that cannot be read leaves the line out: the record reads as it does without one.
    access.entriesOf(about, scope).then((held) => { if (live) setListed(held) }, () => { if (live) setListed(undefined) })
    return () => { live = false }
  }, [access, about.kind, about.id, scope])
  return listed
}

/**
 * The line and the list. `first` is what the first entry is called on this
 * kind — *Recorded by*, *Proposed by*, *Added by* — said only where the list
 * reaches back to it; the list is folded until asked.
 */
export function RecordChanges({ about, scope, first = 'recorded', defaultOpen = false }: {
  about: RecordKey
  /** The scope that keeps the record, where not the open one. */
  scope?: string
  first?: 'recorded' | 'proposed' | 'added'
  defaultOpen?: boolean
}) {
  const access = useRecordChanges()
  const { t, language } = useStrings()
  const [open, setOpen] = useState(defaultOpen)
  const [what, setWhat] = useState<readonly string[]>()
  const listed = useEntries(access, about, scope)
  useEffect(() => {
    if (!open || !access || !listed?.entries.length) return undefined
    let live = true
    access.whatOf(about, scope, listed.entries, listed.more).then((held) => { if (live) setWhat(held) }, () => { if (live) setWhat([]) })
    return () => { live = false }
  }, [open, access, listed])
  if (!access || !listed || listed.entries.length === 0) return null
  const { entries, more } = listed
  const locale = LOCALE[language]
  const via = (agent: string) => t('comments.via', { agent })
  const newest = entries[0]!
  const oldest = entries[entries.length - 1]!
  const firstKey = first === 'proposed' ? 'changes.proposedBy' : first === 'added' ? 'changes.addedBy' : 'changes.recordedBy'
  const line = [
    ...(more ? [] : [t(firstKey, { name: who(oldest, via), when: when(oldest.at, locale) })]),
    ...(entries.length > 1 || more ? [t('changes.lastChangedBy', { name: who(newest, via), when: when(newest.at, locale) })] : []),
    more ? t('changes.countMore', { count: entries.length }) : entries.length === 1 ? t('changes.countOne') : t('changes.countOther', { count: entries.length }),
  ].join(' · ')
  return (
    <Box data-testid="record-changes" sx={{ mt: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary" data-testid="record-changes-line">{line}</Typography>
        <Button size="small" onClick={() => setOpen((was) => !was)} aria-expanded={open} sx={{ fontSize: 11, minWidth: 0, px: 0.75, py: 0 }}>
          {open ? t('changes.hide') : t('changes.show')}
        </Button>
      </Box>
      {open && (
        <Box component="ol" aria-label={t('changes.heading')} data-testid="record-changes-list" sx={{ listStyle: 'none', m: 0, mt: 0.5, p: 0, fontSize: 13 }}>
          {entries.map((entry, index) => (
            <Box component="li" key={entry.id} sx={{ display: 'grid', gridTemplateColumns: 'max-content max-content 1fr', columnGap: 2, py: 0.25, borderBottom: 1, borderColor: 'divider' }}>
              <Box component="span" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{when(entry.at, locale)}</Box>
              <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{who(entry, via)}</Box>
              <Box component="span">{what?.[index] ?? ''}</Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
