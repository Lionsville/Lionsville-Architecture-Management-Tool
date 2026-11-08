// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The folder's own strip (ADR-0005): what its remote said, and the one
 * question a person answers when the folder and its remote have both moved
 * on.
 *
 * Three moments, all decided by this person's settings and by what git
 * answers: the pull as the folder opened, the push after an entry is recorded
 * where this machine says so, and the disagreement between the two. Every one
 * may say no and every refusal is a notice — never a modal, never a blocked
 * save. A disagreement is a standing strip with two answers that both keep
 * everything, and it goes away only when one of them has been carried out; a
 * refusal there leaves the folder as it was and says so.
 *
 * A strip and not a dialog, for the reason the changed-elsewhere notice is
 * one: the person needs to look at what they have in order to choose.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import { useStrings } from '../../i18n'
import type { StringKey } from '../../i18n'
import { reasonOf } from '../../platform/errors'
import { isSyncRefusal, refusedIn } from '../../platform/sync'
import type { SyncRefusal, SyncRefused, SyncSide } from '../../platform/sync'
import { Button as KitButton } from '../../widgets/kit/Button'
import { PanelSection } from '../../widgets/kit/Panel'
import type { SourceChromeProps, SourceYourWorkProps } from '../../ports/ProviderParts'
import { FolderAdoptionQuestion, LeftBehindSaid } from './FolderAdoption'
import type { FolderOwn } from './folderOwn'

export const SYNC_REFUSAL_LABEL: Record<SyncRefusal, StringKey> = {
  'no-remote': 'sync.noRemote',
  unreachable: 'sync.unreachable',
  credentials: 'sync.credentials',
  timeout: 'sync.timeout',
}

/**
 * Why a sync did not happen, as a person reads it: the refusal's own words
 * where git was not run at all — they name what in the folder's configuration
 * it will not run with — or the sentence for the refusal it is.
 */
function reasonFor(outcome: SyncRefusal | SyncRefused, s: (key: StringKey) => string): string {
  const refused = refusedIn(outcome)
  // A refusal the app has a sentence for is said as its key (`GitRefused.keyed`).
  if (refused !== undefined) return /^shell\.[A-Za-z]+$/.test(refused) ? s(refused as StringKey) : refused
  return s(SYNC_REFUSAL_LABEL[outcome as SyncRefusal])
}

/** Drawn whatever the source; about the folder only while a folder is the source. */
export function FolderChrome({ own, notify, reread, flush, preferences, back }: SourceChromeProps<FolderOwn>) {
  // A copy that left something behind went back to where work was: what came of it is said there.
  if (!own) return <LeftBehindSaid />
  return (
    <>
      <LeftBehindSaid />
      {own.adoption && <FolderAdoptionQuestion own={own} adoption={own.adoption} preferences={preferences} reread={reread} flush={flush} {...(back ? { back } : {})} />}
      {own.sync && <SyncStrip own={own} notify={notify} reread={reread} flush={flush} />}
    </>
  )
}

/**
 * Take theirs or keep ours, from the strip or from *Your work*: the two outcomes
 * differ (theirs keeps ours on a branch, ours is recorded as a merge), and both
 * places say so in the same words because they run this.
 */
function useSyncResolve(
  own: FolderOwn, notify: SourceChromeProps<FolderOwn>['notify'], reread: SourceChromeProps<FolderOwn>['reread'],
  flush: SourceChromeProps<FolderOwn>['flush'], settled: () => void,
) {
  const { t: s } = useStrings()
  return useCallback((side: SyncSide) => {
    const sync = own.sync
    if (!sync) return
    // What the open scope holds unwritten is written first: taken into the
    // merge on *mine*, and not written over their version on *theirs*.
    void flush().then(() => sync.resolve(side)).then((outcome) => {
      if (outcome !== 'done') {
        notify(s('sync.resolveRefused', { reason: reasonFor(outcome, s) }), 'warning')
        return
      }
      settled()
      if (side === 'theirs') {
        notify(s('sync.tookTheirs'), 'info')
        reread()
        return
      }
      notify(s('sync.keptOurs'), 'info')
      // The merge commit is made to be pushed, and it is an entry in every
      // sense: whether it goes now is the same setting that decides for any
      // other entry.
      void own.pushIfWanted().catch((cause: unknown) => own.report('sync.push', cause))
    }, (cause: unknown) => {
      own.report('sync.resolve', cause)
      notify(s('sync.resolveRefused', { reason: reasonOf(cause) }), 'error')
    })
  }, [own, notify, reread, flush, settled, s])

}

/**
 * What *Your work* says of the remote, from what the pull as the folder opened
 * answered: up to date only where it was, its refusal where one stands, and
 * nothing where no pull was made or there is no remote to make one from.
 */
function remoteSaid(pulled: FolderOwn['pulled'], parted: boolean, s: (key: StringKey) => string): string | undefined {
  if (parted || pulled === 'diverged') return s('sync.diverged')
  if (pulled === 'done') return s('sync.pulled')
  if (pulled === undefined || pulled === 'no-remote') return undefined
  return reasonFor(pulled, s)
}

/** What the folder says in *Your work*: its remote, and the same two answers the strip offers while the two have parted. */
export function FolderYourWork({ own, notify, reread, flush }: SourceYourWorkProps<FolderOwn>) {
  const { t: s } = useStrings()
  const [parted, setParted] = useState(own?.pulled === 'diverged')
  useEffect(() => own?.onPushed((outcome) => { if (outcome === 'rejected') setParted(true) }), [own])
  const settled = useCallback(() => setParted(false), [])
  const resolve = useSyncResolve(own as FolderOwn, notify as never, reread as never, flush as never, settled)
  if (!own?.sync) return null
  const said = remoteSaid(own.pulled, parted, s)
  // A folder with no history, or a history with no remote, has no remote to say anything about.
  if (said === undefined) return null
  return (
    <PanelSection title={s('sync.remote')}>
      <p data-testid="work-remote">{said}</p>
      {parted && (
        <>
          <p>{s('sync.outcomes')}</p>
          <KitButton size="small" onClick={() => resolve('theirs')} data-testid="work-take-theirs-remote">{s('sync.takeTheirs')}</KitButton>
          <KitButton size="small" onClick={() => resolve('ours')} data-testid="work-keep-ours-remote">{s('sync.keepOurs')}</KitButton>
        </>
      )}
    </PanelSection>
  )
}

function SyncStrip({ own, notify, reread, flush }: Pick<SourceChromeProps<FolderOwn>, 'notify' | 'reread' | 'flush'> & { own: FolderOwn }) {
  const { t: s } = useStrings()
  const [diverged, setDiverged] = useState(own.pulled === 'diverged')
  // Said once, on mount: a refusal as the folder opened is a notice rather than
  // a failure to open — the folder opened, and this says why it is not up to
  // date. Once, because the translator changes with the language, and a change
  // of language is not a second opening.
  const said = useRef(false)
  useEffect(() => {
    const pulled = own.pulled
    if (said.current || !pulled || (!isSyncRefusal(pulled) && refusedIn(pulled) === undefined)) return
    said.current = true
    notify(s('sync.pullRefused', { reason: reasonFor(pulled as SyncRefusal | SyncRefused, s) }), 'warning')
  }, [own, notify, s])

  useEffect(() => own.onPushed((outcome) => {
    if (outcome === 'done') { notify(s('sync.pushed'), 'success'); return }
    if (outcome === 'rejected') { setDiverged(true); return }
    notify(s('sync.pushRefused', { reason: reasonFor(outcome, s) }), 'warning')
  }), [own, notify, s])

  const resolve = useSyncResolve(own, notify, reread, flush, () => setDiverged(false))

  if (!diverged) return null
  return (
    <Alert
      severity="warning"
      square
      sx={{ py: 0.25, fontSize: 'var(--t-body)', borderRadius: 0, flex: '0 0 auto' }}
      data-testid="sync-notice"
      action={(
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={() => resolve('theirs')}>{s('sync.takeTheirs')}</Button>
          <Button size="small" onClick={() => resolve('ours')}>{s('sync.keepOurs')}</Button>
        </Stack>
      )}
    >
      {s('sync.diverged')}
    </Alert>
  )
}
