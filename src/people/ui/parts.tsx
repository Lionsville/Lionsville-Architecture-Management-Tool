// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** The few pieces the People page's parts share: a section heading, the words for a kind and a state, and a person's roles on one line. */
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { StringKey } from '../../i18n/table'
import type { PersonKind, PersonState } from '../person'
import type { Translate } from '../shown'

export const KIND_LABEL: Record<PersonKind, StringKey> = { internal: 'people.kindInternal', external: 'people.kindExternal' }

export const SHOW_LABEL: Record<PersonState | 'all', StringKey> = {
  all: 'people.showAll', active: 'people.showActive', left: 'people.showLeft', forgotten: 'people.showForgotten',
}

/** The roles a person holds on the page's day, each in its unit: those that read as one person. */
export type RolesHeld = readonly { role: string; unit: string }[]

/**
 * A person's roles on one line: the first, and how many more — the rest in
 * its tooltip, and every one in the person's panel — and *none* said as
 * such, so whoever holds nothing stands out.
 */
export function RolesLine({ roles, s }: { roles: RolesHeld; s: Translate }) {
  if (roles.length === 0) return <Box component="span" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>{s('people.rolesNone')}</Box>
  const rest = roles.slice(1)
  return (
    <>
      {s('people.roleIn', roles[0])}
      {rest.length > 0 && (
        <Box component="span" title={rest.map((one) => s('people.roleIn', one)).join(', ')} sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
          {' '}{s('people.rolesMore', { count: rest.length })}
        </Box>
      )}
    </>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ mt: 2 }}>
      <Typography component="h3" sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'text.secondary', mb: 0.75 }}>
        {title}
      </Typography>
      {children}
    </Box>
  )
}
