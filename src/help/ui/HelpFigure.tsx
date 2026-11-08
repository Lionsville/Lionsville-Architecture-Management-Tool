// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A picture of the screen, cut to the part its words are about, at the size it
 * is drawn: a small screen scaled down to fit a column read its words at seven
 * pixels, as shapes. The picture is laid out whole at its own width and a
 * window shows the part marked `data-crop` (or, failing one, the ring a step
 * draws, `data-mark`); a press shows the whole of it, at the same size, over
 * the page.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import type { Translate } from '../../i18n/strings'

/** Room left round a ring a picture is cut to, so the ring stays in; a part marked to be cut to is cut at its edge. */
const RING_ROOM = 4

type Cut = { x: number; y: number; width: number; height: number }

/** Where the part sits in the picture, and the window round it; nothing where it cannot be measured. */
export function cutTo(picture: DOMRect, part: DOMRect, whole: { width: number; height: number }, room = 0): Cut | undefined {
  if (picture.width === 0 || part.width === 0) return undefined
  const x = Math.max(0, part.left - picture.left - room)
  const y = Math.max(0, part.top - picture.top - room)
  return {
    x, y,
    width: Math.min(whole.width - x, part.width + 2 * room),
    height: Math.min(whole.height - y, part.height + 2 * room),
  }
}

export function HelpFigure({ Picture, caption, t, width, small }: {
  Picture: ComponentType; caption: string; t: Translate
  /** The width the picture is laid out at, in px: its words at the size the picture is drawn for. */
  width: number
  small?: boolean
}) {
  const inner = useRef<HTMLDivElement>(null)
  const whole = useRef<HTMLDialogElement>(null)
  const [cut, setCut] = useState<Cut | undefined>()
  useLayoutEffect(() => {
    // Offsets inside the picture, so measuring again after it is moved, or once the typefaces are in, gives the same cut.
    const measure = () => {
      const picture = inner.current
      const marked = picture?.querySelector('[data-crop]')
      const part = marked ?? picture?.querySelector('[data-mark]')
      if (!picture || !part) return
      setCut(cutTo(picture.getBoundingClientRect(), part.getBoundingClientRect(), { width: picture.scrollWidth, height: picture.scrollHeight }, marked ? 0 : RING_ROOM))
    }
    measure()
    let current = true
    document.fonts?.ready.then(() => { if (current) measure() }, () => {})
    return () => { current = false }
  }, [])
  const show = () => {
    const dialog = whole.current
    if (!dialog || dialog.open) return
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
  }
  const hide = () => {
    const dialog = whole.current
    if (!dialog) return
    if (typeof dialog.close === 'function') dialog.close()
    else dialog.removeAttribute('open')
  }
  return (
    <figure className={`help-figure${small ? ' help-figure--small' : ''}`}>
      <div className="help-figure__frame">
        <div className="help-screen help-crop" aria-hidden="true" inert style={cut ? { width: cut.width, height: cut.height } : undefined}>
          <div ref={inner} className="help-crop__picture" style={{ width, ...(cut ? { transform: `translate(${-cut.x}px, ${-cut.y}px)` } : {}) }}>
            <Picture />
          </div>
        </div>
        {/* Over the picture rather than round it: a button holds words, not a screen. */}
        <button type="button" className="help-figure__press" onClick={show} aria-label={`${t('help.enlarge')}: ${caption}`} title={t('help.enlarge')} />
      </div>
      <figcaption>{caption}</figcaption>
      <dialog ref={whole} className="help-whole" aria-label={caption} onClick={(event) => { if (event.target === whole.current) hide() }}>
        <div className="help-screen" aria-hidden="true" inert style={{ width }}><Picture /></div>
        <p className="help-whole__foot">
          <span>{caption}</span>
          <button type="button" className="help-whole__close" onClick={hide}>{t('help.close')}</button>
        </p>
      </dialog>
    </figure>
  )
}
