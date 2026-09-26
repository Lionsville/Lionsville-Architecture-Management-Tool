// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The block under the cards: what the organisation contradicts about itself,
 * one sentence each, every one a way to the thing it is about.
 *
 * Not shown at all when there is nothing — a heading over an empty list would
 * be a warning about nothing, and a "no problems" line would be saying so
 * before the index has been read. Folded past a handful: an organisation
 * whose business layer is still being agreed can have forty capabilities
 * proposed by its domains, and forty sentences would push the tree off the
 * screen — the first few say what kind of thing is wrong, and the count says
 * how much.
 */
const SHOWN_FOLDED = 6

import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { ElementId } from '../../model'
import type { ScopePath } from '../../projects/scopePath'
import type { AttentionItem } from './attention'

export function NeedsAttention({ items, onOpen, s }: {
  items: readonly AttentionItem[]
  /** Open the scope with the record selected; absent where the host cannot. */
  onOpen?: (scope: ScopePath, id: ElementId) => void
  s: Translate
}) {
  const [unfolded, setUnfolded] = useState(false)
  if (items.length === 0) return null
  const shown = unfolded ? items : items.slice(0, SHOWN_FOLDED)
  return (
    <Box sx={{ mb: 4 }} data-testid="needs-attention" data-guide="org.attention">
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, mb: 1, textTransform: 'uppercase', color: 'warning.main' }}>
        {s('org.attention')}
      </Typography>
      <Stack spacing={0.25}>
        {shown.map((item) => (
          <Typography
            key={`${item.key}|${item.scope}|${item.id}`}
            component="button"
            type="button"
            disabled={!onOpen}
            onClick={() => onOpen?.(item.scope, item.id)}
            data-testid={`attention-${item.scope}-${item.id}`}
            title={s('org.attentionOpen')}
            sx={{
              fontSize: 13, font: 'inherit', color: 'inherit', background: 'none', border: 0,
              p: 0, py: 0.5, cursor: onOpen ? 'pointer' : 'default', textAlign: 'left',
              borderBottom: 1, borderColor: 'divider',
              '&:hover': { color: onOpen ? 'primary.main' : 'inherit' },
            }}
          >
            {item.text}
          </Typography>
        ))}
      </Stack>
      {items.length > shown.length && (
        <Button size="small" onClick={() => setUnfolded(true)} data-testid="attention-more" data-guide="org.attentionMore" sx={{ mt: 0.5, fontSize: 11 }}>
          {s('org.attentionMore', { count: items.length })}
        </Button>
      )}
    </Box>
  )
}
