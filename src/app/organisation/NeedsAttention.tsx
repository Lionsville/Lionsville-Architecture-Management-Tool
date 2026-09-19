/**
 * The block under the cards: what the organisation contradicts about itself,
 * one sentence each, every one a way to the thing it is about.
 *
 * Not shown at all when there is nothing — a heading over an empty list would
 * be a warning about nothing, and a "no problems" line would be saying so
 * before the index has been read.
 */
import Box from '@mui/material/Box'
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
  if (items.length === 0) return null
  return (
    <Box sx={{ mb: 4 }} data-testid="needs-attention">
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, mb: 1, textTransform: 'uppercase', color: 'warning.main' }}>
        {s('org.attention')}
      </Typography>
      <Stack spacing={0.25}>
        {items.map((item) => (
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
    </Box>
  )
}
