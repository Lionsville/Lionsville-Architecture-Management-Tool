// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The ? that opens the help at the place that answers for what it stands in:
 * a panel's head, a page's. The kit knows no help and no screen; the frame says
 * how the help is opened (`HelpPlaceProvider`) and the screen says where, by an
 * id from `platform/helpPlaces.ts`. Drawn by nobody where nobody said how,
 * so a part shown on its own, in a test or in the help's own pictures, has none.
 */
import { createContext, useContext } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import './HelpPress.css'

type OpenHelp = (at: string) => void

const HelpPlaceContext = createContext<OpenHelp | undefined>(undefined)
export const HelpPlaceProvider = HelpPlaceContext.Provider

/** How the help is opened here, where the frame said; for a press drawn by the screen itself. */
export function useOpenHelp(): OpenHelp | undefined {
  return useContext(HelpPlaceContext)
}

export function HelpPress({ at, about, className = 'kit-panel__icon' }: {
  /** The help's id for this place. */
  readonly at: string
  /** What it is help on, for the name a screen reader says: *Help on Dispatch*. */
  readonly about?: string
  readonly className?: string
}) {
  const { t } = useStrings()
  const open = useOpenHelp()
  if (!open) return null
  const label = about ? t('kit.help.on', { about }) : t('kit.help.here')
  return (
    <button type="button" className={className} aria-label={label} title={`${label} (F1)`} data-help-at={at} onClick={() => open(at)}>
      <span aria-hidden="true" className="kit-help-press">?</span>
    </button>
  )
}
