// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A connector and its label. A fixed width and arrowhead whatever the zoom, one of
 * four inks, and the meaning in the dash and the word and never in the hue alone.
 *
 * Where it runs is the canvas's: this takes the path a router already worked out
 * and draws it. Inside an `<svg>`, in the canvas's own coordinates; the screen size
 * comes from `non-scaling-stroke` and the custom property `canvasZoomProps` sets.
 */
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { SCALE } from './tokens'
import './Line.css'

export type LineInk = 'quiet' | 'ink' | 'signal' | 'exception'
export type LinePattern = 'solid' | 'functional' | 'implied' | 'planned'
export type LineState = 'rest' | 'picked' | 'dimmed'

const DASH: Record<LinePattern, string | undefined> = {
  solid: undefined,
  functional: SCALE['line-dash-functional'],
  implied: SCALE['line-dash-implied'],
  planned: SCALE['line-dash-planned'],
}

/** Where an arrowhead goes and which way it points, from the last two points of a route. */
export function arrowAt(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number; angle: number } {
  return { x: to.x, y: to.y, angle: (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI }
}

export type LineProps = Omit<ComponentPropsWithRef<'g'>, 'children'> & {
  /** The route, an SVG path in the canvas's coordinates. */
  d: string
  ink?: LineInk
  pattern?: LinePattern
  state?: LineState
  /** The head at its end. Absent on a line with no direction. */
  arrow?: { x: number; y: number; angle: number }
}

export function Line({ d, ink = 'quiet', pattern = 'solid', state = 'rest', arrow, className, ...rest }: LineProps) {
  return (
    <g {...rest} className={className ? `kit-line ${className}` : 'kit-line'} data-ink={ink} data-state={state}>
      <path className="kit-line__hit" d={d} vectorEffect="non-scaling-stroke" />
      <path className="kit-line__path" d={d} vectorEffect="non-scaling-stroke" strokeDasharray={DASH[pattern]} />
      {arrow && (
        <g transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})`}>
          <path className="kit-line__head" d="M0 0 L-8 -3.5 L-8 3.5 Z" />
        </g>
      )}
    </g>
  )
}

/** What a label may say: about two lines. The rest is the panel's, and the title holds it for a hover. */
const LABEL_AT_MOST = 56

export function labelWords(words: string): string {
  if (words.length <= LABEL_AT_MOST) return words
  const cut = words.lastIndexOf(' ', LABEL_AT_MOST - 1)
  return `${words.slice(0, cut > 20 ? cut : LABEL_AT_MOST - 1)}…`
}

export type LineLabelProps = Omit<ComponentPropsWithRef<'div'>, 'children'> & {
  words: string
  /** A second line in the code face: `[HTTPS]`. */
  how?: string
  /** The word that says a line is an exception: colour alone never does. */
  exception?: string
  /** What it carries instead of words below the distance where a label reads, as an entry in the Lines list. */
  number?: number
  picked?: boolean
  dimmed?: boolean
  /** Anything else it holds, such as a route handle. */
  extra?: ReactNode
}

/**
 * A label holds its size on screen. A canvas places it, and centres it through the
 * wrapper it places, because the scale here is about the label's own middle.
 */
export function LineLabel({ words, how, exception, number, picked, dimmed, extra, className, title, ...rest }: LineLabelProps) {
  const { t } = useStrings()
  const said = labelWords(words)
  return (
    <div
      {...rest}
      className={className ? `kit-linelabel ${className}` : 'kit-linelabel'}
      title={title ?? (said === words ? undefined : words)}
      data-picked={picked || undefined}
      data-dimmed={dimmed || undefined}
      data-numbered={number !== undefined || undefined}
    >
      <div className="kit-linelabel__words">
        {exception && <span className="kit-linelabel__exception">{exception} </span>}
        {said}
        {how && <div className="kit-linelabel__how">{how}</div>}
      </div>
      {number !== undefined && <span className="kit-linelabel__number" aria-label={t('kit.line.number', { number })}>{number}</span>}
      {extra}
    </div>
  )
}
