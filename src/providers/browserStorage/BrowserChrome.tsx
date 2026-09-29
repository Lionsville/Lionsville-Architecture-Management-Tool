// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * This browser's own strip, while it is the source: whether its database can
 * be written now, how full it is getting, and the work the older storage kept.
 *
 * **Whether it can be written.** Another tab holding the database at an older
 * layout blocks this one until that tab lets go; a database the browser let
 * go of, or one a later build took over in another tab, cannot be written
 * again until the page is reloaded. Both are standing strips, because both are
 * true until something is done about them.
 *
 * **How full.** A browser's quota is small, shared with everything else on the
 * site, and reached in silence: the first anybody hears of it is a save that
 * did not happen. So it is said early — once, because a warning on every write
 * is a warning nobody reads, and again only after it dropped back under and
 * climbed a second time.
 *
 * **The older work.** What the key-value storage kept before the database is
 * brought over at every start, never over work done here. Where it could not
 * be — the database was lost after a copy, or a scope changed in both places
 * — the person answers, one scope at a time; and what could not be read is
 * said, so a scope that is missing without a word is not one somebody goes
 * looking for — once, as the source opens.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import type { EarlierStanding } from '../../adapters/webStorage/earlierScopes'
import type { Standing } from '../../adapters/webStorage/IndexedDbStore'
import { useStrings } from '../../i18n'
import { reasonOf } from '../../platform/errors'
import type { SourceChromeProps } from '../../ports/ProviderParts'
import type { BrowserOwn } from './browserOwn'

/** Above this share of what the browser lets this site keep, say so. */
export const NEARLY_FULL = 0.8

export function BrowserChrome({ own, notify, reread }: SourceChromeProps<BrowserOwn>) {
  if (!own) return null
  return (
    <>
      <KeepsNothing own={own} />
      <StandingStrip own={own} />
      <NearlyFull own={own} notify={notify} />
      {own.earlier && <EarlierWork earlier={own.earlier} notify={notify} reread={reread} />}
    </>
  )
}

/** The database would not open: memory took its place, and nothing done here outlives the tab. */
function KeepsNothing({ own }: { own: BrowserOwn }) {
  const { t: s } = useStrings()
  const [nothing, setNothing] = useState(() => own.keepsNothing())
  useEffect(() => {
    setNothing(own.keepsNothing())
    return own.onKeepsNothing(() => setNothing(true))
  }, [own])
  if (!nothing) return null
  return (
    <Alert severity="warning" square data-testid="storage-notice" sx={{ flex: '0 0 auto', borderRadius: 0, py: 0, fontSize: 12 }}>
      {s('shell.keepFailed')}
    </Alert>
  )
}

function StandingStrip({ own }: { own: BrowserOwn }) {
  const { t: s } = useStrings()
  const [standing, setStanding] = useState<Standing>(() => own.database.standing())
  useEffect(() => {
    setStanding(own.database.standing())
    return own.database.onStanding(setStanding)
  }, [own])
  if (standing === 'open') return null
  return (
    <Alert
      severity={standing === 'reload' ? 'error' : 'warning'}
      square
      data-testid="browser-standing"
      sx={{ flex: '0 0 auto', borderRadius: 0, py: 0, fontSize: 12 }}
    >
      {s(standing === 'reload' ? 'shell.storageReload' : 'shell.storageBlocked')}
    </Alert>
  )
}

function NearlyFull({ own, notify }: Pick<SourceChromeProps<BrowserOwn>, 'notify'> & { own: BrowserOwn }) {
  const { t: s } = useStrings()
  const said = useRef(false)
  useEffect(() => own.onFullness(({ used, budget }) => {
    const full = budget > 0 && used / budget >= NEARLY_FULL
    if (!full) {
      said.current = false
      return
    }
    if (said.current) return
    said.current = true
    notify(s('shell.storageNearlyFull', { percent: Math.round((used / budget) * 100) }), 'warning')
  }), [own, notify, s])
  return null
}

type EarlierProps = Pick<SourceChromeProps<BrowserOwn>, 'notify' | 'reread'> & {
  earlier: NonNullable<BrowserOwn['earlier']>
}

function EarlierWork({ earlier, notify, reread }: EarlierProps) {
  const { t: s } = useStrings()
  const [standing, setStanding] = useState<EarlierStanding | undefined>(undefined)
  const read = useCallback(() => {
    void earlier.standing().then(setStanding, () => setStanding(undefined))
  }, [earlier])
  useEffect(read, [read])
  // What was left behind, and what could not be brought over, said once as
  // the source opens: facts to know, not questions to answer.
  const told = useRef(false)
  useEffect(() => {
    if (!standing || told.current) return
    told.current = true
    const left = standing.left.map((one) => one.path || '/')
    if (left.length > 0) notify(s('browser.earlierLeftBehind', { paths: left.join(', ') }), 'info')
    if (standing.refused.length > 0) {
      notify(s('browser.earlierRefused', { paths: standing.refused.map((path) => path || '/').join(', ') }), 'warning')
    }
  }, [standing, notify, s])

  const answer = useCallback((bring: boolean, addresses?: readonly string[]) => {
    const asked = bring ? earlier.bringOver(addresses) : earlier.leave(addresses)
    void asked.then(() => {
      notify(s(bring ? 'browser.earlierBrought' : 'browser.earlierLeft'), 'info')
      if (bring) reread()
      read()
    }, (cause: unknown) => notify(reasonOf(cause), 'error'))
  }, [earlier, notify, reread, read, s])

  if (!standing) return null
  return (
    <Stack data-testid="browser-earlier" sx={{ flex: '0 0 auto' }}>
      {standing.asking && (
        <Choice text={s('browser.earlierAsking')} onBring={() => answer(true)} onLeave={() => answer(false)} />
      )}
      {!standing.asking && standing.diverged.map((path) => (
        <Choice
          key={path}
          text={s('browser.earlierDiverged', { path: path || '/' })}
          onBring={() => answer(true, [path])}
          onLeave={() => answer(false, [path])}
        />
      ))}
    </Stack>
  )
}

/** One question about the older copy, with its two answers. */
function Choice({ text, onBring, onLeave }: { text: string; onBring: () => void; onLeave: () => void }) {
  const { t: s } = useStrings()
  return (
    <Alert
      severity="warning"
      square
      sx={{ borderRadius: 0, py: 0.25, fontSize: 13 }}
      action={(
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={onBring}>{s('browser.earlierBring')}</Button>
          <Button size="small" onClick={onLeave}>{s('browser.earlierLeave')}</Button>
        </Stack>
      )}
    >
      {text}
    </Alert>
  )
}
