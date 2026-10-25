// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The tree's ↗ rows (ADR-0042 §4): under each scope, a labelled row for every
 * topic relevant to it today, opening the topic where it lives — its home. A
 * subtopic whose topic is listed there is implied by it and left out. Quiet,
 * and indented under the scope it is about: it is not a scope filed there.
 */
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import { useTopics } from './TopicsContext'

/** How far a row of the tree is indented per level, in the theme's spacing: the tree's own. */
const STEP = 3

export function TopicRows({ at, depth, s }: { at: string; depth: number; s: Translate }) {
  const access = useTopics()
  const rows = access?.treeRows(at) ?? []
  if (!access || rows.length === 0) return null
  return (
    <>
      {rows.map((topic) => (
        <Box
          key={topic.id} data-testid={`topic-under-${at}-${topic.id}`}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: (depth + 1) * STEP, pl: 4, py: 0.25, borderBottom: 1, borderColor: 'divider' }}
        >
          <Box component="span" aria-hidden sx={{ color: 'text.secondary', fontSize: 12 }}>↗</Box>
          <Button
            size="small" color="inherit" onClick={() => access.openHome(topic.id)}
            sx={{ fontSize: 12, minWidth: 0, px: 0.5, py: 0, textTransform: 'none', color: 'text.secondary' }}
          >
            {topic.name}
          </Button>
          <Typography sx={{ fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>{s('topics.treeLabel')}</Typography>
        </Box>
      ))}
    </>
  )
}
