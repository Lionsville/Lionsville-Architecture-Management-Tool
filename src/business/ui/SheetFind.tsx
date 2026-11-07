// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The find bar: it stays open, the hits are lit where they sit and the rest goes
 * quiet, so how a word spreads over the map can be seen. ↑ and ↓ walk the hits,
 * across functions, steps and stakeholders, and Enter takes the first or the next.
 */
import { useEffect, useRef } from 'react'
import type { Translate } from '../../i18n'
import { Button, IconButton } from '../../widgets/kit/Button'
import { BackIcon, CloseIcon, ForwardIcon } from '../../widgets/icons'
import { TextInput } from '../../widgets/kit/Field'
import type { SheetHit } from '../find'

export function FindBar({ query, hits, at, onQuery, onWalk, onClose, t }: {
  query: string
  hits: readonly SheetHit[]
  /** Which hit is up, or none yet. */
  at: number | undefined
  onQuery(query: string): void
  onWalk(to: number): void
  onClose(): void
  t: Translate
}) {
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => { field.current?.focus() }, [])
  const step = (by: 1 | -1) => {
    if (hits.length === 0) return
    onWalk(at === undefined ? (by === 1 ? 0 : hits.length - 1) : (at + by + hits.length) % hits.length)
  }
  const up = at !== undefined ? hits[at] : undefined
  return (
    <div className="sheet-find" data-testid="sheet-finder" role="search">
      <span className="sheet-find__field">
        <TextInput
          ref={field} value={query} placeholder={t('sheet.findPlaceholder')} aria-label={t('sheet.find')}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'ArrowDown') { event.preventDefault(); step(1) }
            if (event.key === 'ArrowUp') { event.preventDefault(); step(-1) }
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
          }}
        />
      </span>
      <span className="sheet-find__count" role="status">
        {query.trim() === '' ? '' : hits.length === 0 ? t('sheet.findNone') : at !== undefined ? t('sheet.findAt', { at: at + 1, count: hits.length }) : t('sheet.findCount', { count: hits.length })}
      </span>
      <IconButton label={t('sheet.findPrevious')} disabled={hits.length === 0} onClick={() => step(-1)}><BackIcon /></IconButton>
      <IconButton label={t('sheet.findNext')} disabled={hits.length === 0} onClick={() => step(1)}><ForwardIcon /></IconButton>
      {up && <span className="sheet-find__where">{up.element.name}{up.within !== undefined ? ` · ${up.within}` : ''}</span>}
      <Button variant="quiet" size="small" onClick={onClose}><CloseIcon />{t('common.close')}</Button>
    </div>
  )
}
