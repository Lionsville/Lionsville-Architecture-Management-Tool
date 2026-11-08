// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A free note or picture on one poster: on this view only, and no fact about the
 * model (ADR-0048). In the reading order by where it is, found by Find if it says
 * something, a stop for the keyboard, and on the print. Double press or Enter writes a
 * note, Delete takes it off; First layout leaves it where it is.
 */
import { useState } from 'react'
import type { PosterItem as PosterItemRecord, PosterItemPlace } from '../../model'
import type { Translate } from '../../i18n'
import { usePictureByAddress, LibraryPicture } from '../../documentation/ui/Pictures'
import type { PosterDesign } from './PosterDesign'
import { commandKey } from '../../widgets/kit/keys'

function Picture({ item }: { item: PosterItemRecord }) {
  const entry = usePictureByAddress(item.image ?? '')
  if (!entry) return <span className="poster-item__alt">{item.alt}</span>
  return <LibraryPicture entry={entry} alt={item.alt ?? ''} />
}

export function PosterItem({ item, at, design, t }: { item: PosterItemRecord; at: PosterItemPlace; design: PosterDesign | undefined; t: Translate }) {
  const [writing, setWriting] = useState(false)
  const said = item.kind === 'note' ? item.text ?? '' : item.alt ?? ''
  const finish = (text: string) => {
    setWriting(false)
    if (text !== item.text) design?.actions.updateItem(item.id, { text })
  }
  return (
    <div
      className="poster-item" data-kind={item.kind} data-item-id={item.id} data-testid={`poster-item-${item.id}`}
      style={{ left: at.x, top: at.y, width: at.width, height: at.height, minHeight: at.height }}
      tabIndex={0} role={design ? 'button' : 'note'} aria-label={item.kind === 'note' ? t('sheet.poster.noteSays', { text: said }) : said}
      onDoubleClick={() => { if (design && item.kind === 'note') setWriting(true) }}
      onKeyDown={(event) => {
        if (!design || writing) return
        if (event.key === 'Enter' && item.kind === 'note') { event.preventDefault(); setWriting(true) }
        if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); design.actions.removeItem(item.id) }
      }}
    >
      {writing
        ? (
          <textarea
            className="poster-item__text" defaultValue={item.text ?? ''} autoFocus aria-label={t('sheet.poster.noteWords')}
            onBlur={(event) => finish(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Escape') { event.preventDefault(); setWriting(false) }
              if (event.key === 'Enter' && commandKey(event)) { event.preventDefault(); finish(event.currentTarget.value) }
            }}
          />
        )
        : item.kind === 'note' ? <span className="poster-item__words">{said}</span> : <Picture item={item} />}
      {design && (
        <span className="poster-add poster-add--item" data-sheet-add>
          <button type="button" tabIndex={-1} aria-label={t('sheet.poster.takeOffItem')} title={t('sheet.poster.takeOffItem')} onClick={(event) => { event.stopPropagation(); design.actions.removeItem(item.id) }}>×</button>
        </span>
      )}
      <i className="poster-handle" data-resize="" aria-hidden="true" />
    </div>
  )
}
