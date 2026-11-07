// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a region says when it has no content to show, and why. Empty, held,
 * offline and unreadable are different facts, and drawing them alike is how an
 * unreachable server came to look like an organisation with nothing in it.
 *
 * So the states are told apart by type: only `empty` takes a first step, because
 * offering *New…* before anyone has said the place is empty invites somebody to
 * start again on top of work they cannot see. `pageStateOf` says which state is
 * true, with empty as the last thing it answers rather than the default.
 *
 * Loading says nothing for a second, since a page that arrives in that time should
 * not flash at anybody; then a skeleton; past ten seconds, words and a way out.
 */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { Button } from './Button'
import './hidden.css'
import './PageState.css'

export type PageStateName = 'loading' | 'held' | 'empty' | 'offline' | 'unreadable'

/** The facts a screen has. Whether it has heard at all comes first: nothing heard is not nothing there. */
export type PageFacts = {
  readonly reachable: boolean
  /** The answer has come. */
  readonly answered: boolean
  /** What came could be read. */
  readonly readable: boolean
  /** The place is waiting on something other than this page. */
  readonly held?: boolean
  readonly count: number
}

/** Null is content: nothing to say. */
export function pageStateOf({ reachable, answered, readable, held, count }: PageFacts): PageStateName | null {
  if (held) return 'held'
  if (!reachable) return 'offline'
  if (!answered) return 'loading'
  if (!readable) return 'unreadable'
  return count === 0 ? 'empty' : null
}

export type PageAction = { readonly label: string; readonly onPress: () => void; readonly dataGuide?: string }

type Common = {
  /** A panel or a row of a list says it smaller than a page does. */
  readonly compact?: boolean
  readonly dataGuide?: string
}

export type PageStateProps = Common & (
  | {
      readonly state: 'loading'
      /** Past ten seconds: somewhere else to go. */
      readonly wayOut?: PageAction
      /** Tests and a page that has already waited start past the quiet second. */
      readonly waited?: number
    }
  | {
      readonly state: 'held'
      readonly title: string
      readonly body?: ReactNode
      /** The address of what is being waited for, said because a person may need to pass it on. */
      readonly address?: string
      /** What a person can do about it, where it is theirs to do: then nothing is arriving, and no skeleton says so. */
      readonly actions?: ReactNode
    }
  | {
      readonly state: 'empty'
      readonly title: string
      /** What this is for, in a sentence, and what applies here anyway. */
      readonly body?: ReactNode
      /** One first step. None where this person could not take it. */
      readonly action?: PageAction
      /** Several first steps, where the place truly has several ways to begin: the screen's own buttons, in order. */
      readonly steps?: ReactNode
    }
  | {
      readonly state: 'offline'
      /** Who did not answer. */
      readonly where?: string
      readonly retryIn?: number
      readonly onRetry?: () => void
      /** Beside the retry: a way to report it, say. */
      readonly actions?: ReactNode
    }
  | {
      readonly state: 'unreadable'
      /** What could not be read, where the screen knows. */
      readonly what?: string
      readonly body?: ReactNode
      readonly onRetry?: () => void
    }
)

const QUIET_MS = 1_000
const SLOW_MS = 10_000

function Loading({ wayOut, waited = 0, compact }: { readonly wayOut?: PageAction; readonly waited?: number; readonly compact?: boolean }) {
  const { t } = useStrings()
  const [waiting, setWaiting] = useState(waited)
  useEffect(() => {
    const timers = [QUIET_MS, SLOW_MS].filter((ms) => ms > waited).map((ms) => setTimeout(() => setWaiting(ms), ms - waited))
    return () => timers.forEach(clearTimeout)
  }, [waited])
  if (waiting < QUIET_MS) return <div className="kit-state" data-state="loading" data-quiet="" aria-busy="true" />
  return (
    <div className="kit-state" data-state="loading" data-compact={compact || undefined} role="status" aria-busy="true">
      <span className="kit-hidden">{t('common.arriving')}</span>
      <div className="kit-state__skeleton" aria-hidden="true"><span /><span /><span /></div>
      {waiting >= SLOW_MS && (
        <>
          <div className="kit-state__body">{t('kit.state.slow')}</div>
          {wayOut && <Button variant="plain" onClick={wayOut.onPress} data-guide={wayOut.dataGuide}>{wayOut.label}</Button>}
        </>
      )}
    </div>
  )
}

function Card({ state, role, title, body, children, compact, guide }: {
  readonly state: PageStateName
  readonly role: 'status' | 'alert'
  readonly title: string
  readonly body?: ReactNode
  readonly children?: ReactNode
  readonly compact?: boolean
  readonly guide?: string
}) {
  return (
    <div className="kit-state" data-state={state} data-compact={compact || undefined} role={role} data-guide={guide}>
      <div className="kit-state__title">{title}</div>
      {body && <div className="kit-state__body">{body}</div>}
      {children}
    </div>
  )
}

export function PageState(props: PageStateProps) {
  const { t } = useStrings()
  const { compact, dataGuide } = props
  switch (props.state) {
    case 'loading':
      return <Loading wayOut={props.wayOut} waited={props.waited} compact={compact} />
    case 'held':
      return (
        <Card state="held" role="status" title={props.title} body={props.body} compact={compact} guide={dataGuide}>
          {props.address && <code className="kit-state__address">{props.address}</code>}
          {props.actions ? <div>{props.actions}</div> : <div className="kit-state__skeleton" aria-hidden="true"><span /><span /></div>}
        </Card>
      )
    case 'empty':
      return (
        <Card state="empty" role="status" title={props.title} body={props.body} compact={compact} guide={dataGuide}>
          {props.steps && <div className="kit-state__steps">{props.steps}</div>}
          {props.action && <div><Button variant="primary" onClick={props.action.onPress} data-guide={props.action.dataGuide}>{props.action.label}</Button></div>}
        </Card>
      )
    case 'offline':
      return (
        <Card
          state="offline" role="alert" title={t('kit.state.offline')} compact={compact} guide={dataGuide}
          body={[
            props.where ? t('kit.state.noAnswer', { where: props.where }) : undefined,
            t('kit.state.nothingLost'),
            props.retryIn !== undefined ? t('kit.state.retryIn', { seconds: props.retryIn }) : undefined,
          ].filter(Boolean).join(' ')}
        >
          {(props.onRetry || props.actions) && (
            <div>
              {props.onRetry && <Button variant="plain" onClick={props.onRetry}>{t('kit.state.tryNow')}</Button>}
              {props.actions}
            </div>
          )}
        </Card>
      )
    case 'unreadable':
      return (
        <Card
          state="unreadable" role="alert" title={props.what ? t('kit.state.unreadableWhat', { what: props.what }) : t('kit.state.unreadable')}
          body={props.body ?? t('kit.state.unreadableBody')} compact={compact} guide={dataGuide}
        >
          {props.onRetry && <div><Button variant="plain" onClick={props.onRetry}>{t('common.tryAgain')}</Button></div>}
        </Card>
      )
  }
}
