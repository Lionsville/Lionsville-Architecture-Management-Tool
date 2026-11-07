// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A region of a canvas. A zone is filled and named, a column or a band of a board;
 * a boundary is a dashed edge round what belongs to one thing, the edge of an
 * application on its container diagram. Either name holds its size at every
 * distance, and either may fold, which is where a fold on a canvas comes from.
 */
import { useId } from 'react'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { CaretIcon } from '../icons'
import './Zone.css'

export type ZoneProps = Omit<ComponentPropsWithRef<'section'>, 'children'> & {
  name: string
  kind?: 'zone' | 'boundary'
  /** A word after the name, such as a kind in brackets or a count. */
  aside?: ReactNode
  dimmed?: boolean
  /** A zone that can fold. A count in `aside` is what a folded zone still says. */
  fold?: { folded: boolean; onToggle: () => void }
  children?: ReactNode
}

export function Zone({ name, kind = 'zone', aside, dimmed, fold, className, children, ...rest }: ZoneProps) {
  const { t } = useStrings()
  const nameId = useId()
  return (
    <section
      {...rest}
      aria-labelledby={nameId}
      className={className ? `kit-zone ${className}` : 'kit-zone'}
      data-kind={kind}
      data-dimmed={dimmed || undefined}
      data-folded={fold?.folded || undefined}
    >
      <header className="kit-zone__head">
        {fold && (
          <button
            type="button"
            className="kit-zone__fold"
            aria-expanded={!fold.folded}
            aria-label={t(fold.folded ? 'kit.zone.unfold' : 'kit.zone.fold', { name })}
            onClick={fold.onToggle}
          ><CaretIcon size={10} /></button>
        )}
        <span className="kit-zone__name" id={nameId}>{name}</span>
        {aside && <span className="kit-zone__aside">{aside}</span>}
      </header>
      {!fold?.folded && children}
    </section>
  )
}
