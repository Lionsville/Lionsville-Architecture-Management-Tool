// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A picture of the screen, cut to the part its words are about, at the size it
 * is drawn: a small screen scaled down to fit a column read its words at seven
 * pixels, as shapes. The picture is laid out whole at its own width and a
 * window shows the parts marked `data-crop` (or, failing one, the ring a step
 * draws, `data-mark`), taken out to whole lines of text (`pictureCut`); a press
 * shows the whole of it over the page, enlarged to most of the window.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import type { Translate } from '../../i18n/strings'
import { cutAtLines, fitScale, partsBox, textLines } from './pictureCut'
import type { Box } from './pictureCut'

/** Room left round a ring a picture is cut to, so the ring stays in; a part marked to be cut to is cut at its edge. */
const RING_ROOM = 4
/** How much of the window the whole picture may take, each way. */
const WINDOW_SHARE = 0.92

const same = (a: Box | undefined, b: Box | undefined) =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height)

/** The cut of a picture laid out whole, in px from its top left; nothing where nothing could be measured. */
export function measureCut(picture: HTMLElement, most?: number): Box | undefined {
  const origin = picture.getBoundingClientRect()
  if (origin.width === 0) return undefined
  const marked = Array.from(picture.querySelectorAll('[data-crop]'))
  const parts = marked.length > 0 ? marked : Array.from(picture.querySelectorAll('[data-mark]'))
  const start = partsBox(parts.map((part) => {
    const rect = part.getBoundingClientRect()
    return { x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height }
  }), marked.length > 0 ? 0 : RING_ROOM)
  if (!start) return undefined
  return cutAtLines(start, textLines(picture), { width: picture.scrollWidth, height: picture.scrollHeight }, most)
}

export function HelpFigure({ Picture, caption, t, width, column, small }: {
  Picture: ComponentType; caption: string; t: Translate
  /** The width the picture is laid out at, in px: its words at the size the picture is drawn for. */
  width: number
  /** The widest the column it stands in gives it, in px, where that is narrower than the picture: the cut is kept inside. */
  column?: number
  small?: boolean
}) {
  // The cut's frame is a px of border each side, inside the column.
  const most = column === undefined ? undefined : column - 2
  const inner = useRef<HTMLDivElement>(null)
  const whole = useRef<HTMLDialogElement>(null)
  const foot = useRef<HTMLParagraphElement>(null)
  const [cut, setCut] = useState<Box | undefined>()
  const [scale, setScale] = useState(1)
  // Measured when the picture is laid out anew — a language changed in place changes its lines, a document shown
  // again or a fold opened gives it a size — and never because the cut was set: measured after every render, a
  // browser that had not settled the layout yet answered two cuts in turn, and the help went blank in a loop.
  useLayoutEffect(() => {
    const picture = inner.current
    if (!picture) return
    const measure = () => { const next = measureCut(picture, most); setCut((was) => (same(was, next) ? was : next)) }
    measure()
    if (typeof ResizeObserver !== 'function') return
    const watch = new ResizeObserver(measure)
    watch.observe(picture)
    return () => watch.disconnect()
  }, [most, t, Picture])
  useEffect(() => {
    let current = true
    document.fonts?.ready.then(() => {
      const picture = inner.current
      if (current && picture) { const next = measureCut(picture, most); setCut((was) => (same(was, next) ? was : next)) }
    }, () => {})
    return () => { current = false }
  }, [most])
  const fit = () => {
    const dialog = whole.current
    const picture = inner.current
    const view = dialog?.ownerDocument.defaultView
    if (!dialog || !picture || !view) return
    const style = view.getComputedStyle(dialog)
    const across = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)
    const down = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
    const footHeight = foot.current ? foot.current.offsetHeight + parseFloat(view.getComputedStyle(foot.current).marginTop) : 0
    // The picture's own frame is two px of border, which is not enlarged.
    const room = { width: view.innerWidth * WINDOW_SHARE - across - 2, height: view.innerHeight * WINDOW_SHARE - down - footHeight - 2 }
    setScale(fitScale({ width, height: picture.offsetHeight }, room))
  }
  useEffect(() => {
    const view = whole.current?.ownerDocument.defaultView
    if (!view) return
    const resized = () => { if (whole.current?.open) fit() }
    view.addEventListener('resize', resized)
    return () => view.removeEventListener('resize', resized)
  })
  const show = () => {
    const dialog = whole.current
    if (!dialog || dialog.open) return
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    fit()
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
        {/* Enlarged by zoom rather than a transform, so the dialog is laid out at the size it shows and its words are drawn sharp. */}
        <div className="help-screen" aria-hidden="true" inert style={{ width: width * scale }}>
          <div className="help-whole__picture" style={{ width, zoom: scale }}><Picture /></div>
        </div>
        <p ref={foot} className="help-whole__foot">
          <span>{caption}</span>
          <button type="button" className="help-whole__close" onClick={hide}>{t('help.close')}</button>
        </p>
      </dialog>
    </figure>
  )
}
