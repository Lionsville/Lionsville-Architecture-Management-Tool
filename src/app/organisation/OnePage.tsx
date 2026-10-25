// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A card on a scope's home: one page behind it, said in a few short lines,
 * and its ways in over it (ADR-0044 §5). Every card on a home is one of
 * these, so the row of them reads and opens one way.
 */
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'

/** One way in from a card: a page, a view, the record it names. */
export type CardAction = {
  label: string
  onClick: () => void
  /** What a reader hears where the label alone would not say which page: *Open Decisions*. */
  ariaLabel?: string
  testId?: string
  guide?: string
}

/**
 * One card (ADR-0044 §5): what the page behind it is, its counts and one
 * finding, kept to a few short lines so the row of cards stays low. The ways
 * in are not a row of buttons under the text: they come up over the card
 * while the pointer is on it, or the keyboard is in it — one button that
 * fills the card, or one per way in, stacked to fill it — so a card is read
 * first and chosen from second. A page that closes gives the focus back to
 * its button, which brings the ways in up only for the keyboard
 * (`Mui-focusVisible`), not after a press of the mouse.
 */
export function OnePage({ icon, title, description, count, finding, actions = [] }: {
  icon: ReactNode
  title: string
  /** What you find behind it, in the card's own voice, above the counts. Two lines at most; the rest on hover. */
  description: string
  count?: string
  /** A sentence about what is found. */
  finding?: ReactNode
  actions?: readonly CardAction[]
}) {
  return (
    // One cell of the grid, the whole cell: every card the same height as its row.
    <Card
      variant="outlined"
      title={description}
      sx={{
        position: 'relative', p: 1.25, height: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25,
        [`&:hover .${WAYS}, &:has(.Mui-focusVisible) .${WAYS}`]: { opacity: 1 },
      }}
    >
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
        <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{title}</Typography>
      </Stack>
      <Typography
        data-testid="card-description"
        sx={{ fontSize: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {description}
      </Typography>
      {count && <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 'auto', pt: 0.25 }}>{count}</Typography>}
      {finding && <Typography component="div" sx={{ fontSize: 11, color: 'text.secondary', ...(count ? {} : { mt: 'auto' }) }}>{finding}</Typography>}
      {actions.length > 0 && <CardWays title={title} actions={actions} />}
    </Card>
  )
}

/** The class the card raises its ways in by. */
export const WAYS = 'card-ways'

/** How far down the card its title row ends: the padding and one line of the title. */
const TITLE_ROW = 32

/** The ways in, over the card: each a button the full width of the card, together its full height. */
function CardWays({ title, actions }: { title: string; actions: readonly CardAction[] }) {
  return (
    <Box
      className={WAYS}
      role="group"
      aria-label={title}
      data-testid="card-ways"
      sx={{
        // Under the title row, which stays: the card still says what it is while its ways in are up.
        // Pressable while hidden: a press on the card under its title is a press of a way in — on a
        // touch screen, which never hovers, and wherever a press comes before the pointer has moved.
        position: 'absolute', top: TITLE_ROW, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', opacity: 0,
        // No fade: shown or not, never half-drawn under a resting pointer, where its words would be read at no contrast.
        bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider', overflow: 'hidden',
        borderBottomLeftRadius: 'inherit', borderBottomRightRadius: 'inherit',
      }}
    >
      {actions.map((action, index) => (
        <Button
          key={action.testId ?? action.label}
          onClick={action.onClick}
          fullWidth
          data-testid={action.testId}
          data-guide={action.guide}
          aria-label={action.ariaLabel}
          sx={{
            flex: 1, minHeight: 0, borderRadius: 0, textTransform: 'none', fontSize: 13, fontWeight: 600, px: 1.5,
            justifyContent: 'center', textAlign: 'center', lineHeight: 1.25,
            ...(index > 0 ? { borderTop: 1, borderColor: 'divider' } : {}),
          }}
        >
          {action.label}
        </Button>
      ))}
    </Box>
  )
}
