// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The topics catalogue (ADR-0042 §3): every topic and subtopic, where each is
 * relevant, and what it keeps — building blocks and principles. A topic
 * picked shows its links, written from this end as from the other, its
 * subtopics, its principles and its building blocks. A page over the home it
 * was opened from, reached from the *Topics* card, a chip on a home, the
 * tree's ↗ row or a check.
 */
import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import { barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { PageDialog } from '../../widgets/PageDialog'
import { PageClose } from '../../widgets/PageClose'
import { SeamResizer } from '../../widgets/SeamResizer'
import { useSeamWidth } from '../../widgets/useSeamWidth'
import { linkHolds, useTopics } from './TopicsContext'
import type { TopicSummary, TopicsAccess } from './TopicsContext'
import { TopicDetail } from './TopicDetail'
import { NewTopicDialog } from './topicDialogs'
import { nested } from './topicChoices'
import type { NestedTopic } from './topicChoices'

const CELL = { borderBottom: 1, borderColor: 'divider', px: 1.5, py: 0.75, fontSize: 13, textAlign: 'left', verticalAlign: 'top' } as const

/** Where a row says its topic is relevant: through its parent, and its own links today. */
function relevantWords(access: TopicsAccess, topic: TopicSummary, as: (name: string) => string): string {
  const parent = topic.parent ? access.get(topic.parent) : undefined
  const own = topic.links.filter((link) => linkHolds(link, access.today())).map((link) => access.scopeLabel(link.path))
  if (!parent) return own.join(' · ') || '—'
  return [as(parent.name), ...own.map((one) => `+ ${one}`)].join(', ')
}

function Catalogue({ access, rows, current, onPick }: {
  access: TopicsAccess; rows: NestedTopic[]; current: TopicSummary | undefined; onPick: (id: string) => void
}) {
  const { t } = useStrings()
  return (
    <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%' }} data-testid="topics-catalogue">
      <thead>
        <tr>
          <Box component="th" sx={{ ...CELL, fontWeight: 600 }}>{t('topics.colTopic')}</Box>
          <Box component="th" sx={{ ...CELL, fontWeight: 600 }}>{t('topics.colRelevantTo')}</Box>
          <Box component="th" sx={{ ...CELL, fontWeight: 600 }}>{t('topics.colBlocks')}</Box>
          <Box component="th" sx={{ ...CELL, fontWeight: 600 }}>{t('topics.colPrinciples')}</Box>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ topic, depth }) => {
          const keeps = access.keeps(topic.id)
          return (
            <Box
              component="tr" key={topic.id} onClick={() => onPick(topic.id)} data-testid={`topic-row-${topic.id}`}
              aria-selected={current?.id === topic.id}
              sx={{ cursor: 'pointer', bgcolor: current?.id === topic.id ? 'action.selected' : undefined, '&:hover': { bgcolor: 'action.hover' } }}
            >
              <Box component="td" sx={{ ...CELL, pl: 1.5 + depth * 2.5, fontWeight: depth === 0 ? 600 : 400 }}>
                <Box component="button" type="button" onClick={() => onPick(topic.id)} sx={{ all: 'unset', cursor: 'pointer', '&:focus-visible': { outline: 2, outlineColor: 'primary.main' } }}>
                  {topic.name}
                </Box>
              </Box>
              <Box component="td" sx={{ ...CELL, color: 'text.secondary' }}>{relevantWords(access, topic, (name) => t('topics.asParent', { name }))}</Box>
              <Box component="td" sx={CELL}>{keeps.blocks || '—'}</Box>
              <Box component="td" sx={CELL}>{keeps.principles || '—'}</Box>
            </Box>
          )
        })}
      </tbody>
    </Box>
  )
}

export function TopicsPage({ open, select, nonce, onClose, windowChrome }: {
  open: boolean
  /** The topic to pick, by path. */
  select?: string
  /** Moves with every request, so the same topic asked for twice is picked twice. */
  nonce?: number
  onClose: () => void
  windowChrome: WindowChrome
}) {
  const access = useTopics()
  const { t } = useStrings()
  const bar = barChromeFor(windowChrome)
  const [picked, setPicked] = useState<string | undefined>(select)
  const [making, setMaking] = useState<{ parent?: string } | undefined>(undefined)
  const [detailWidth, setDetailWidth] = useSeamWidth('topics.detail', 420)
  useEffect(() => { if (open && select) setPicked(select) }, [open, select, nonce])
  const version = access?.version ?? 0
  const rows = useMemo(() => nested(access?.list() ?? []), [access, version])
  if (!access) return null
  const current = access.get(picked ?? '') ?? rows[0]?.topic
  return (
    <PageDialog open={open} topInset={windowChrome.topInset} onClose={onClose} aria-label={t('topics.title')}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 1.5, pl: `${12 + bar.controlsInset}px`, minHeight: 48,
        borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0,
      }}>
        <Tooltip title={t('common.close')}>
          <IconButton size="small" aria-label={t('common.close')} onClick={onClose}>
            <Box component="span" aria-hidden sx={{ display: 'inline-block', width: 18, textAlign: 'center', fontSize: 16, lineHeight: 1 }}>‹</Box>
          </IconButton>
        </Tooltip>
        <Typography component="h1" variant="body2" sx={{ fontWeight: 600 }}>{t('topics.title')}</Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('topics.subtitle')}</Typography>
        <Box sx={{ flex: 1 }} />
        {access.mayCreate() && <Button size="small" variant="contained" onClick={() => setMaking({})} data-testid="topics-new" data-guide="topics.new">{t('topics.new')}</Button>}
        <PageClose onClose={onClose} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: `minmax(0, 1fr) auto ${detailWidth}px`, flex: 1, minHeight: 0 }}>
        <Box sx={{ overflow: 'auto', bgcolor: 'background.paper' }}>
          <Catalogue access={access} rows={rows} current={current} onPick={setPicked} />
          <Typography sx={{ fontSize: 12, color: 'text.secondary', p: 2, maxWidth: 640 }}>{t('topics.catalogueNote')}</Typography>
        </Box>
        <SeamResizer orientation="vertical" region="after" value={detailWidth} min={300} max={900} defaultValue={420} onChange={setDetailWidth} label={t('common.resizeColumn')} />
        <Box sx={{ overflow: 'auto', p: 3 }}>
          {current ? <TopicDetail key={current.id} topic={current} access={access} onSubtopic={() => setMaking({ parent: current.id })} /> : (
            <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>{t('topics.empty')}</Typography>
          )}
        </Box>
      </Box>
      {making && <NewTopicDialog access={access} {...(making.parent ? { parent: making.parent } : {})} onClose={(id) => { setMaking(undefined); if (id) setPicked(id) }} />}
    </PageDialog>
  )
}
