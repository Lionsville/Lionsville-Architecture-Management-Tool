// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** The few pieces the People page's parts share: the words for a kind and a state, a person's roles on one line, a day, and a link. */
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { formatDay } from '../../i18n/dates'
import type { StringKey } from '../../i18n/table'
import type { PersonKind, PersonState } from '../person'
import type { Translate } from '../shown'
import './People.css'

export const KIND_LABEL: Record<PersonKind, StringKey> = { internal: 'people.kindInternal', external: 'people.kindExternal' }

export const SHOW_LABEL: Record<PersonState, StringKey> = {
  active: 'people.showActive', left: 'people.showLeft', forgotten: 'people.showForgotten',
}

/** The roles a person holds on the page's day, each in its unit: those that read as one person. */
export type RolesHeld = readonly { role: string; unit: string }[]

/** A person's roles on one line: the first, and how many more; every one is on the person's page. */
export function rolesText(roles: RolesHeld, s: Translate): string {
  if (roles.length === 0) return s('people.rolesNone')
  return roles.length === 1 ? s('people.roleIn', roles[0]) : `${s('people.roleIn', roles[0])} ${s('people.rolesMore', { count: roles.length - 1 })}`
}

/** One way to write a day: 7 Nov 2026, in the reader's language. An absent day is nothing. */
export function useDayWords(): (day: string | undefined) => string {
  const { language } = useStrings()
  return (day) => (day ? formatDay(day, language) : '')
}

/** Text that goes somewhere when there is somewhere for it to go, and is only text where there is not. */
export function PlaceLink({ onPress, children }: { onPress: (() => void) | undefined; children: ReactNode }) {
  if (!onPress) return <>{children}</>
  return <button type="button" className="people-link" onClick={onPress}>{children}</button>
}
