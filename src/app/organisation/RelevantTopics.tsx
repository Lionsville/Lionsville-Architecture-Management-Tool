// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Relevant topics* on a scope's home (ADR-0042 §4), with *+ Topic…*, which
 * opens the chooser (`TopicChooser`): adding one here writes the same link as
 * adding this scope on the topic's page —
 * kept on the topic, under its rights. The × on a chip stops the link from
 * today and keeps it as history; it is there only where the link is the
 * topic's own and the person may change the topic. A topic's own home says
 * it is one and opens it in the catalogue instead.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import { linkHolds, useTopics } from './TopicsContext'
import type { TopicSummary } from './TopicsContext'
import { TopicChooser } from './TopicChooser'

const LABEL = { fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mr: 0.5 } as const
const SMALL = { fontSize: 11, minWidth: 0, px: 1 } as const

export function RelevantTopics({ at }: { at: string }) {
  const access = useTopics()
  const { t } = useStrings()
  const [adding, setAdding] = useState(false)
  if (!access) return null
  if (access.get(at)) {
    return (
      <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'center', gap: 0.75 }} data-testid="relevant-topics" data-guide="org.relevantTopics">
        <Typography sx={LABEL}>{t('topics.topic')}</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('topics.thisIsTopic')}</Typography>
        <Button size="small" onClick={() => access.openCatalogue(at)} sx={SMALL} data-testid="topic-in-catalogue">{t('topics.openInCatalogue')}</Button>
      </Box>
    )
  }
  const today = access.today()
  const here = access.relevantAt(at)
  const choosable = access.mayCreate() || access.list().some((one) => access.mayWrite(one.id) && !here.some((held) => held.id === one.id))
  const ownLink = (topic: TopicSummary) => topic.links.some((link) => link.path === at && linkHolds(link, today))
  return (
    <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }} data-testid="relevant-topics" data-guide="org.relevantTopics">
      <Typography component="h2" sx={LABEL}>{t('topics.relevantHere')}</Typography>
      {here.length === 0 && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('topics.relevantNone')}</Typography>}
      {here.map((topic) => (
        <Chip
          key={topic.id} size="small" label={topic.name} onClick={() => access.openCatalogue(topic.id)}
          {...(ownLink(topic) && access.mayWrite(topic.id) ? { onDelete: () => access.stopHere(topic.id, at) } : {})}
          title={t('topics.endHereTip')}
          data-testid={`relevant-${topic.id}`}
        />
      ))}
      {choosable && <Button size="small" onClick={() => setAdding(true)} sx={SMALL} data-testid="relevant-add">{t('topics.addTopic')}</Button>}
      {adding && <TopicChooser at={at} access={access} onClose={() => setAdding(false)} />}
    </Box>
  )
}
