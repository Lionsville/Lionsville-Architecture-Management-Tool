// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Share with a Link…* (ADR-0033, amended): a link to the place on screen,
 * copied and shown.
 *
 * A link is two halves, each said by whoever knows it. **Where** is the open
 * source's — the address somebody else who may read the same work reaches it
 * at (`ProviderParts.shareAddress`) — and **what is there** is the shell's:
 * the place the screen is, written as the fragment ADR-0033 already reads at
 * the boot. So the receiver lands exactly where a reload would have landed
 * the sender, record and tab included, and nothing new is read at the other
 * end.
 *
 * Held by the shell rather than the workspace, because the command has to
 * work from every home as well as over a scope: a menu item that only an open
 * scope answers is a silent no-op on the organisation's screen.
 *
 * The link is copied the moment the command arrives and shown in a dialog as
 * well, so it can be read and selected where the copy was refused. *Copied*
 * is said only once the clipboard has said yes — never a success not waited
 * for. Where the source has no address, or the screen is not a place yet, the
 * same dialog says why, and nothing is copied.
 */
import { useCallback, useState } from 'react'
import { linkTo, placeOf } from '../agent/place'
import type { Place } from '../agent/place'
import type { Screen } from '../agent/screen'
import type { Translate } from '../i18n'
import type { Diagnostics } from '../ports/Diagnostics'
import type { Notify } from './useToasts'

/** As much of the trail as a link needs: somewhere to say a copy was refused. */
type Trail = Pick<Diagnostics, 'report'>

/** Why there is no link: no address a link may carry here, or no place on screen to name. */
export type ShareRefusal = 'share.noAddress' | 'share.noPlace'

/** What a press of *Share with a Link…* comes to. */
export type ShareAnswer = { readonly link: string } | { readonly refused: ShareRefusal }

/**
 * The link to a screen, from the address a link to the source starts from.
 * The address is asked first: a folder has no link whatever is on screen, and
 * saying *there is no place yet* about one would promise a link a moment later.
 */
export function shareLinkOf(address: string | undefined, screen: Screen | undefined): ShareAnswer {
  if (address === undefined || address === '') return { refused: 'share.noAddress' }
  const place = screen === undefined ? undefined : placeOf(screen)
  if (place === undefined) return { refused: 'share.noPlace' }
  return { link: linkTo(address, place) }
}

/**
 * A link to one record, built the same way: the source's address and the
 * place as its fragment. A record's bar asks for this rather than for the
 * screen, so the link names that record even before the screen has caught
 * up. No address is the same refusal *Share with a Link…* gives.
 */
export function recordLinkOf(address: string | undefined, place: Place): ShareAnswer {
  if (address === undefined || address === '') return { refused: 'share.noAddress' }
  return { link: linkTo(address, place) }
}

export type ShareLink = {
  /** What the dialog shows, while it is open. */
  answer: ShareAnswer | undefined
  /** The command: make the link, copy it, show it. */
  share: () => void
  /** The dialog's Copy, again. */
  copy: () => void
  close: () => void
}

/**
 * *Copy link* on a record (ADR-0033, amended): the same two halves as
 * {@link useShareLink}, asked of one place rather than of whatever the screen
 * has caught up to. The dialog is the caller's; this copies, and says why
 * there is no link, the way the menu command does.
 */
export function useRecordLink(deps: {
  address: (() => string | undefined) | undefined
  scope: string
  copyText: (text: string) => Promise<void>
  diagnostics: Trail
  notify: Notify
  s: Translate
}) {
  const { address, scope, copyText, diagnostics, notify, s } = deps
  const [answer, setAnswer] = useState<ShareAnswer | undefined>(undefined)
  const copyLink = useCallback((link: string) => {
    void copyText(link).then(
      () => notify(s('share.copied'), 'success'),
      (cause: unknown) => {
        diagnostics.report({ level: 'warn', where: 'share', message: 'the link could not be copied', cause })
        notify(s('share.copyFailed'), 'warning')
      },
    )
  }, [copyText, diagnostics, notify, s])
  const copyRecord = useCallback((page: NonNullable<Place['page']>, id: string, tab?: Place['tab']) => {
    let said: string | undefined
    try {
      said = address?.()
    } catch (cause) {
      diagnostics.report({ level: 'warn', where: 'share', message: 'the source could not say its address', cause })
    }
    const next = recordLinkOf(said, { scope, page, id, ...(tab !== undefined ? { tab } : {}) })
    setAnswer(next)
    if ('link' in next) copyLink(next.link)
  }, [address, scope, diagnostics, copyLink])
  const copy = useCallback(() => {
    if (answer && 'link' in answer) copyLink(answer.link)
  }, [answer, copyLink])
  const close = useCallback(() => setAnswer(undefined), [])
  return { answer, copy, close, copyRecord }
}

export function useShareLink(deps: {
  address: (() => string | undefined) | undefined
  screen: () => Screen | undefined
  copyText: (text: string) => Promise<void>
  diagnostics: Trail
  notify: Notify
  s: Translate
}): ShareLink {
  const { address, screen, copyText, diagnostics, notify, s } = deps
  const [answer, setAnswer] = useState<ShareAnswer | undefined>(undefined)

  const copyLink = useCallback((link: string) => {
    void copyText(link).then(
      () => notify(s('share.copied'), 'success'),
      (cause: unknown) => {
        diagnostics.report({ level: 'warn', where: 'share', message: 'the link could not be copied', cause })
        notify(s('share.copyFailed'), 'warning')
      },
    )
  }, [copyText, diagnostics, notify, s])

  const share = useCallback(() => {
    let said: string | undefined
    try {
      said = address?.()
    } catch (cause) {
      // A provider that falls over asking costs the link, not the window.
      diagnostics.report({ level: 'warn', where: 'share', message: 'the source could not say its address', cause })
    }
    const next = shareLinkOf(said, screen())
    setAnswer(next)
    if ('link' in next) copyLink(next.link)
  }, [address, screen, diagnostics, copyLink])

  const copy = useCallback(() => {
    if (answer && 'link' in answer) copyLink(answer.link)
  }, [answer, copyLink])
  const close = useCallback(() => setAnswer(undefined), [])
  return { answer, share, copy, close }
}
