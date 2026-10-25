// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One building block's page (ADR-0043 §8):
 *
 * - *About*: its document, a chapter per usage context, and the principles
 *   it cites;
 * - *Requirements*: its capabilities and its usage contexts, how much each
 *   context needs each capability — a context's head opens its chapter;
 * - *Solutions*: the catalogue of what could deliver it, where each is
 *   weighed and chosen;
 * - *Where used*: each scope's evaluation, and *Evaluate for a scope…*.
 *
 * A page over the home it was opened from, reached from the register, a
 * topic or the block on a board; never the first view, so its script
 * arrives when it is first opened.
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import { barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { PageClose } from '../../widgets/PageClose'
import { PageDialog } from '../../widgets/PageDialog'
import { BlockAbout } from './BlockAbout'
import { BlockRequirements } from './BlockRequirements'
import { BlockSolutions } from './BlockSolutions'
import { BlockWhereUsed } from './BlockWhereUsed'
import { useBlocks } from './BlocksContext'

type TabKey = 'about' | 'requirements' | 'solutions' | 'used'

export function BlockPage({ open, id, evaluation: openOn, nonce, onClose, windowChrome }: {
  open: boolean
  id: string | undefined
  /** A scope whose evaluation to open on: *Where used* on it. */
  evaluation?: string
  /** Moves with every request, so the same block asked for twice is opened twice. */
  nonce?: number
  onClose: () => void
  windowChrome: WindowChrome
}) {
  const access = useBlocks()
  const { t } = useStrings()
  const [tab, setTab] = useState<TabKey>('requirements')
  const [chapter, setChapter] = useState<string | undefined>(undefined)
  const [evaluating, setEvaluating] = useState<string | undefined>(openOn)
  useEffect(() => {
    if (!open) return
    setEvaluating(openOn)
    setTab(openOn !== undefined ? 'used' : 'requirements')
  }, [open, openOn, id, nonce])
  const bar = barChromeFor(windowChrome)
  const row = id ? access?.block(id) : undefined
  if (!access || !row) return null
  const { block, scope } = row
  const toChapter = (context: string) => { setChapter((block.contexts ?? []).find((one) => one.id === context)?.name); setTab('about') }
  return (
    <PageDialog open={open} topInset={windowChrome.topInset} onClose={onClose} aria-label={block.name}>
      <Box sx={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, px: 1.5, pl: `${12 + bar.controlsInset}px`, minHeight: 48,
        borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0,
      }}>
        <Tooltip title={t('common.close')}>
          <IconButton size="small" aria-label={t('common.close')} onClick={onClose}>
            <Box component="span" aria-hidden sx={{ display: 'inline-block', width: 18, textAlign: 'center', fontSize: 16, lineHeight: 1 }}>‹</Box>
          </IconButton>
        </Tooltip>
        <Typography component="h1" variant="body2" sx={{ fontWeight: 600 }}>{block.name}</Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('blocks.kind')} · {access.scopeLabel(scope)}</Typography>
        <Box sx={{ flex: 1 }} />
        <Tabs
          value={tab} aria-label={block.name}
          onChange={(_event, next: TabKey) => { setTab(next); if (next === 'used') setEvaluating(undefined) }}
          sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontSize: 13 } }}
        >
          <Tab value="about" label={t('blocks.about')} data-testid="block-tab-about" />
          <Tab value="requirements" label={t('blocks.requirements')} data-testid="block-tab-requirements" />
          <Tab value="solutions" label={t('blocks.solutions')} data-testid="block-tab-solutions" />
          <Tab value="used" label={t('blocks.whereUsed')} data-testid="block-tab-used" />
        </Tabs>
        <PageClose onClose={onClose} />
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', px: 4, py: 3 }}>
        <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
          {tab === 'about' && <BlockAbout row={row} chapter={chapter} onChapterShown={() => setChapter(undefined)} />}
          {tab === 'requirements' && <BlockRequirements row={row} onChapter={toChapter} />}
          {tab === 'solutions' && <BlockSolutions row={row} />}
          {tab === 'used' && <BlockWhereUsed row={row} evaluating={evaluating} onEvaluate={setEvaluating} onChapter={toChapter} />}
        </Box>
      </Box>
    </PageDialog>
  )
}
