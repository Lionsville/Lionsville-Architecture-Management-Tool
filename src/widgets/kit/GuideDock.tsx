// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The guide's dock: one card, in one place on every step, that says one sentence
 * of why and one bold line of what to do, with the rest behind *Tell me more*.
 * Nothing is dimmed and nothing is held: the page stays the person's, so they may
 * look around and come back. It knows no path and no step; a screen hands it
 * words and what each press means, and what it is not handed it does not draw.
 *
 * `GuideRing` is the one target: a ring round the control, a tag that says press
 * here, and a thin line from the dock. It lights a control and not a region, so
 * nothing beside it reads as part of the instruction.
 */
import { useId, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { Button, IconButton } from './Button'
import { Menu } from './Menu'
import type { MenuEntry } from './Menu'
import { hasAPlace } from './guidePlace'
import type { GuideOffset } from './guidePlace'
import './GuideDock.css'

export type GuideDockProps = {
  /** What is being walked: *Finding your way*. */
  readonly name: string
  /** Where in it: *Step 2 of 6*. */
  readonly position?: string
  readonly title: string
  /** One sentence of why. */
  readonly why?: ReactNode
  /** What to do, in bold. */
  readonly act?: ReactNode
  /** Something the person should know before they act: what this lands in. */
  readonly note?: ReactNode
  /** The step is done: what the person now sees. */
  readonly done?: ReactNode
  /** Behind *Tell me more*. */
  readonly more?: ReactNode
  /** A small drawing, under the words. */
  readonly picture?: ReactNode
  /** Anything else the step has to say: a way there, the state of a wait. */
  readonly children?: ReactNode
  readonly onBack?: () => void
  readonly onSkip?: () => void
  readonly onPause?: () => void
  readonly onNext?: () => void
  /** What going on is called here: *Next*, *Start*, *Start the next path*. */
  readonly nextWord?: string
  /** The answer beside Next that is not going on: *Later*, *Close*. */
  readonly other?: { readonly word: string; readonly onPress: () => void }
  /** Behind the ⋯: starting over, leaving, making it small. */
  readonly menu?: readonly MenuEntry[]
  readonly menuLabel?: string
  /** Said politely as it changes, whatever the dock draws. */
  readonly said?: string
  /** Where the person dragged it from its place. */
  readonly offset?: GuideOffset
  readonly onMoved?: (offset: GuideOffset) => void
  readonly small?: boolean
  readonly onGrow?: () => void
  readonly dataTestid?: string
  /** What a screen says of the step for whoever reads the page: data attributes, as they are. */
  readonly data?: Readonly<Record<`data-${string}`, string | undefined>>
  readonly dataGuide?: string
}

const NUDGE = 16
const NUDGES: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-NUDGE, 0], ArrowRight: [NUDGE, 0], ArrowUp: [0, -NUDGE], ArrowDown: [0, NUDGE],
}

export function GuideDock(props: GuideDockProps) {
  const { name, position, title, why, act, note, done, more, picture, children, onBack, onSkip, onPause, onNext, nextWord, other, menu, menuLabel, said, offset = { x: 0, y: 0 }, onMoved, small, onGrow, dataTestid, data, dataGuide } = props
  const { t } = useStrings()
  const titled = useId()
  const [open, setOpen] = useState(false)
  const [menuAt, setMenuAt] = useState<HTMLElement | null>(null)
  const held = useRef(offset)
  held.current = offset
  const head = position ? `${name} · ${position}` : name

  const grab = (event: PointerEvent) => {
    if (!onMoved) return
    event.preventDefault()
    const from = { x: event.clientX, y: event.clientY, offset: held.current }
    const follow = (moving: globalThis.PointerEvent) => onMoved({ x: from.offset.x + moving.clientX - from.x, y: from.offset.y + moving.clientY - from.y })
    const stop = () => {
      window.removeEventListener('pointermove', follow)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', follow)
    window.addEventListener('pointerup', stop)
  }
  const nudge = (event: KeyboardEvent) => {
    const by = NUDGES[event.key]
    if (!by || !onMoved) return
    event.preventDefault()
    onMoved({ x: held.current.x + by[0], y: held.current.y + by[1] })
  }
  const place = hasAPlace(offset) ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined

  return (
    <section
      className="kit-guide" role="dialog" aria-modal="false" aria-label={small ? `${head}: ${title}` : undefined} aria-labelledby={small ? undefined : titled}
      data-learn-card="" data-small={small ? '' : undefined} data-testid={dataTestid} data-guide={dataGuide} style={place} {...data}
    >
      {/* First, and whichever the dock is: a live region is never taken away and put back. */}
      <div className="kit-guide__said" role="status" aria-live="polite">{said ?? title}</div>
      {small
        ? <Button variant="quiet" size="small" onClick={onGrow} title={t('kit.guide.grow')}>{head}</Button>
        : (
            <>
              <div className="kit-guide__head">
                <span className="kit-guide__where">{head}</span>
                {onMoved && <IconButton label={t('kit.guide.drag')} size="small" onPointerDown={grab} onKeyDown={nudge} data-testid="learn-grip">⠿</IconButton>}
                {menu && menu.length > 0 && (
                  <>
                    <IconButton label={menuLabel ?? t('kit.guide.menu')} size="small" aria-haspopup="menu" aria-expanded={menuAt !== null ? 'true' : undefined} onClick={(event) => setMenuAt(event.currentTarget)}>⋯</IconButton>
                    <Menu open={menuAt !== null} anchorEl={menuAt} label={menuLabel ?? t('kit.guide.menu')} items={menu} onClose={() => setMenuAt(null)} />
                  </>
                )}
              </div>
              <h2 className="kit-guide__title" id={titled}>{title}</h2>
              {why !== undefined && <p className="kit-guide__why">{why}</p>}
              {picture}
              {note !== undefined && <p className="kit-guide__note" data-testid="learn-note">{note}</p>}
              {act !== undefined && <p className="kit-guide__act" data-testid="learn-act">{act}</p>}
              {done !== undefined && <p className="kit-guide__done" data-testid="learn-done"><span aria-hidden="true">✓ </span>{done}</p>}
              {children}
              {more !== undefined && (
                <>
                  <button type="button" className="kit-guide__more" aria-expanded={open} onClick={() => setOpen(!open)} data-testid="learn-more">
                    {t('kit.guide.more')} <span aria-hidden="true">{open ? '▴' : '▾'}</span>
                  </button>
                  {open && <div className="kit-guide__rest">{more}</div>}
                </>
              )}
              <div className="kit-guide__foot">
                {onBack && <Button variant="quiet" size="small" onClick={onBack} data-testid="learn-back">{t('kit.guide.back')}</Button>}
                {onSkip && <Button variant="quiet" size="small" onClick={onSkip} data-testid="learn-skip">{t('kit.guide.skip')}</Button>}
                <span className="kit-guide__grow" />
                {onPause && <Button variant="quiet" size="small" onClick={onPause} data-testid="learn-pause">{t('kit.guide.pause')}</Button>}
                {other && <Button variant="plain" size="small" onClick={other.onPress} data-testid="learn-other">{other.word}</Button>}
                {onNext && <Button variant="primary" size="small" onClick={onNext} data-testid="learn-next">{nextWord ?? t('kit.guide.next')}</Button>}
              </div>
            </>
          )}
    </section>
  )
}

export type GuideBox = { readonly left: number; readonly top: number; readonly width: number; readonly height: number }

/** One ring on one target, with its tag and a thin line from the dock where the dock is known. */
export function GuideRing({ target, dock, tag = true }: { target: GuideBox; dock?: GuideBox | undefined; tag?: boolean }) {
  const { t } = useStrings()
  return (
    <>
      <div
        className="kit-guide-ring" aria-hidden="true" data-testid="learn-spotlight"
        style={{ left: target.left - 4, top: target.top - 4, width: target.width + 8, height: target.height + 8 }}
      />
      {tag && <div className="kit-guide-tag" aria-hidden="true" style={{ left: target.left + target.width + 8, top: target.top + target.height / 2 }}>{t('kit.guide.pressHere')}</div>}
      {dock && (
        <svg className="kit-guide-line" aria-hidden="true" focusable="false">
          <line x1={dock.left} y1={dock.top + 24} x2={target.left + target.width / 2} y2={target.top + target.height} />
        </svg>
      )}
    </>
  )
}
