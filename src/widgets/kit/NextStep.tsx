// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where a record with a life stands, and the one thing that happens next: a
 * stepper in words and a card with one question and its verb. A row of equal
 * Move-to buttons makes a person work out which is next; this says.
 *
 * What holds the step is a list where every line goes to the thing to fix, and
 * the button that cannot be pressed says how many, so a grey button is never the
 * whole answer. A record that has ended has no card, only a sentence.
 *
 * `readOnly` is the screen's: it hands in no actions, and the question still reads.
 */
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { Button } from './Button'
import './hidden.css'
import './NextStep.css'

export type StepState = 'done' | 'current' | 'todo'

export type Step = { readonly id: string; readonly label: string; readonly state: StepState }

export type NextAction = {
  readonly label: string
  readonly onPress: () => void
  readonly primary?: boolean
  /** Held: what holds it is `holds`. Drawn off, with the count beside it. */
  readonly held?: boolean
  readonly dataGuide?: string
  readonly testId?: string
}

export type NextHold = { readonly label: string; readonly onPress?: () => void }

export type NextStepProps = {
  readonly steps?: readonly Step[]
  /** How the stepper is laid: along the card, or down a preview's facts. */
  readonly orientation?: 'along' | 'down'
  /** Its name for assistive technology. Defaults to the kit's *Where it stands*. */
  readonly stepsLabel?: string
  readonly question?: string
  readonly actions?: readonly NextAction[]
  readonly holds?: readonly NextHold[]
  /** The record's life is over: this sentence, in place of the card. */
  readonly ended?: ReactNode
  /** Without the card's box: for a preview's foot, where the foot is the box. */
  readonly inline?: boolean
  readonly dataGuide?: string
}

export function StepLadder({ steps, orientation = 'along', label }: { readonly steps: readonly Step[]; readonly orientation?: 'along' | 'down'; readonly label?: string }) {
  const { t } = useStrings()
  const name = label ?? t('kit.next.standing')
  return (
    <ol className="kit-steps" data-orientation={orientation} aria-label={name}>
      {steps.map((step) => (
        <li key={step.id} className="kit-steps__step" data-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
          <span className="kit-steps__dot" aria-hidden="true" />
          <span>{step.label}</span>
          {step.state === 'done' && <span className="kit-hidden"> ({t('kit.next.done')})</span>}
        </li>
      ))}
    </ol>
  )
}

export function NextStep({ steps, orientation, stepsLabel, question, actions, holds, ended, inline, dataGuide }: NextStepProps) {
  const { t } = useStrings()
  const held = holds?.length ?? 0
  const buttons = actions?.map((action) => (
    <Button
      key={action.label} variant={action.primary ? 'primary' : 'plain'}
      reason={action.held && held > 0 ? t('kit.next.holds', { count: held }) : undefined}
      onClick={action.onPress} data-guide={action.dataGuide} data-testid={action.testId}
    >
      {action.label}
    </Button>
  ))
  if (inline) {
    return (
      <div className="kit-next" data-inline="" data-guide={dataGuide}>
        {ended ?? (
          <>
            {question && <strong className="kit-next__question">{question}</strong>}
            {buttons}
          </>
        )}
      </div>
    )
  }
  return (
    <div className="kit-next" data-guide={dataGuide}>
      {steps && <StepLadder steps={steps} orientation={orientation} label={stepsLabel} />}
      {ended ? <p className="kit-next__ended">{ended}</p> : (
        <div className="kit-next__card">
          <div className="kit-next__label">{t('kit.next.next')}</div>
          {question && <div className="kit-next__question">{question}</div>}
          {buttons && buttons.length > 0 && (
            <div className="kit-next__actions">
              {buttons}
              {held > 0 && <span className="kit-next__heldCount">{t('kit.next.holds', { count: held })}</span>}
            </div>
          )}
          {held > 0 && (
            <ul className="kit-next__holds" aria-label={t('kit.next.holdsLabel')}>
              {holds?.map((hold) => (
                <li key={hold.label}>
                  {hold.onPress
                    ? <button type="button" className="kit-next__hold" onClick={hold.onPress}>{hold.label}</button>
                    : hold.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
