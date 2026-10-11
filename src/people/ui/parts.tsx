// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** The few pieces the People page's parts share: a section heading, and the words for a kind and a state. */
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { StringKey } from '../../i18n/table'
import type { PersonKind, PersonState } from '../person'

export const KIND_LABEL: Record<PersonKind, StringKey> = { internal: 'people.kindInternal', external: 'people.kindExternal' }

export const SHOW_LABEL: Record<PersonState | 'all', StringKey> = {
  all: 'people.showAll', active: 'people.showActive', left: 'people.showLeft', forgotten: 'people.showForgotten',
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
