// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One thing on a canvas. The name holds its size on screen at any zoom, what does
 * not fit the distance goes, and a card is as tall as what it says: 2 lines of name
 * from far, 3 nearer, broken inside a long compound rather than cut.
 *
 * A plain element and a class, because a board draws hundreds. The zoom reaches it
 * through the custom property a canvas sets (`canvasZoomProps`), so zooming renders
 * nothing here, and the distance is CSS as well: Card.css says what each one shows.
 * Colour is not its business: a neutral fill and a 3:1 edge, and a hand-set accent
 * is the thin rail at its left.
 */
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import './Card.css'

export type CardProps = Omit<ComponentPropsWithRef<'div'>, 'children' | 'about'> & {
  name: string
  /** The name as something to press: drawn in the name's place, the name still being what it says. */
  nameAs?: ReactNode
  /** A word over the name, such as what kind of thing it is. Said from the middle distance in. */
  over?: ReactNode
  /** A mark before the name, such as a logo somebody chose. */
  lead?: ReactNode
  /** What it is: said from the middle distance in. */
  sub?: ReactNode
  /** What it does: said only near. */
  about?: ReactNode
  /** Rows of its own under the name, for a card that says more than a line. */
  body?: ReactNode
  /** Marks are a state of the thing, so they stay at every distance. */
  marks?: ReactNode
  /** A hand-set colour, as a CSS value. */
  rail?: string
  selected?: boolean
  neighbour?: boolean
  dimmed?: boolean
  planned?: boolean
  /** Changed by an agent and not reviewed yet: a diamond in the corner, until it is. */
  agentChanged?: boolean
  /** A word shown on hover, such as that it has a diagram. */
  hoverWord?: ReactNode
  /** The one connect nub, shown on hover and on the selected card. Absent for a reader. */
  nub?: ReactNode
}

export function Card({ name, nameAs, over, lead, sub, about, body, marks, rail, selected, neighbour, dimmed, planned, agentChanged, hoverWord, nub, className, style, ...rest }: CardProps) {
  const { t } = useStrings()
  return (
    <div
      {...rest}
      className={className ? `kit-card ${className}` : 'kit-card'}
      style={rail ? { ...style, '--kit-card-rail': rail } as typeof style : style}
      data-selected={selected || undefined}
      data-neighbour={neighbour || undefined}
      data-dimmed={dimmed || undefined}
      data-planned={planned || undefined}
      data-rail={rail ? true : undefined}
    >
      <div className="kit-card__head">
        {lead && <div className="kit-card__lead">{lead}</div>}
        <div className="kit-card__text">
          {over && <div className="kit-card__over">{over}</div>}
          <div className="kit-card__name">{nameAs ?? name}</div>
          {sub && <div className="kit-card__sub">{sub}</div>}
          {about && <div className="kit-card__about">{about}</div>}
        </div>
      </div>
      {body && <div className="kit-card__body">{body}</div>}
      {marks && <div className="kit-card__marks">{marks}</div>}
      {hoverWord && <div className="kit-card__word">{hoverWord}</div>}
      {agentChanged && <span className="kit-card__agent" role="img" aria-label={t('kit.card.agent')} />}
      {nub && <div className="kit-card__nub">{nub}</div>}
    </div>
  )
}
