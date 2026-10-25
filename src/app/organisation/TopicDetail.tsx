// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One topic, picked in the catalogue (ADR-0042 §3): its links with their days
 * — *End…* keeps one as history, *Days…* changes them, *Remove* is for a link
 * made by mistake — its ended links folded, its subtopics, its principles;
 * *Edit* and *Remove*, which is refused while it keeps anything. Every write
 * is under the topic's rights: a person who may only read it reads it.
 */
import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { formatDay } from '../../i18n/dates'
import { useStrings } from '../../i18n/LanguageContext'
import { plural } from '../../i18n/strings'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { linkHolds } from './TopicsContext'
import type { TopicLink, TopicSummary, TopicsAccess } from './TopicsContext'
import { EditTopicDialog } from './topicDialogs'
import { useBlocks } from '../../blocks/ui/BlocksContext'

const HEADING = { display: 'block', mt: 3, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'text.secondary' } as const
const SMALL = { fontSize: 11, minWidth: 0, px: 0.75 } as const

/** How a link's days are said: since when, from when, or from and until. */
function linkWords(link: TopicLink, today: string, day: (date: string | undefined) => string, t: ReturnType<typeof useStrings>['t']): string {
  if (link.until !== undefined && link.until < today) return t('topics.linkEnded', { from: day(link.from) || '…', until: day(link.until) })
  if (link.from !== undefined && link.from > today) return t('topics.linkPlanned', { from: day(link.from) })
  return link.from ? t('topics.linkSince', { from: day(link.from) }) : t('topics.linkAlways')
}

/** One link of a topic, with its days and, for a person who may change the topic, its three changes. */
function LinkLine({ topic, link, access, day }: { topic: TopicSummary; link: TopicLink; access: TopicsAccess; day: (date: string | undefined) => string }) {
  const { t } = useStrings()
  const [mode, setMode] = useState<'read' | 'end' | 'edit'>('read')
  const [from, setFrom] = useState(link.from ?? '')
  const [until, setUntil] = useState(link.until ?? access.today())
  const may = access.mayWrite(topic.id)
  const save = () => {
    if (mode === 'end') access.endLink(topic.id, link, until)
    else access.setLink(topic.id, link, { ...(from ? { from } : {}), ...(until && link.until !== undefined ? { until } : {}) })
    setMode('read')
  }
  return (
    <Box sx={{ py: 0.5, borderBottom: 1, borderColor: 'divider' }} data-testid={`topic-link-${link.path}`}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', fontSize: 14 }}>
        <Box sx={{ flex: 1, fontWeight: 500 }}>{access.scopeLabel(link.path)}</Box>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{linkWords(link, access.today(), day, t)}</Typography>
        {may && mode === 'read' && link.until === undefined && <Button size="small" onClick={() => setMode('end')} sx={SMALL}>{t('topics.end')}</Button>}
        {may && mode === 'read' && <Button size="small" onClick={() => setMode('edit')} sx={SMALL}>{t('topics.editDays')}</Button>}
        {may && mode === 'read' && (
          <Tooltip title={t('topics.removeLinkTip')}>
            <Button size="small" color="error" onClick={() => access.removeLink(topic.id, link)} sx={SMALL}>{t('topics.removeLink')}</Button>
          </Tooltip>
        )}
      </Box>
      {mode !== 'read' && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.75 }}>
          {mode === 'edit' && <TextField type="date" size="small" label={t('topics.from')} value={from} onChange={(event) => setFrom(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 150 }} />}
          {(mode === 'end' || link.until !== undefined) && (
            <TextField type="date" size="small" label={t('topics.until')} value={until} onChange={(event) => setUntil(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 150 }} />
          )}
          <Button size="small" variant="contained" onClick={save}>{mode === 'end' ? t('topics.endSave') : t('topics.save')}</Button>
          <Button size="small" onClick={() => setMode('read')}>{t('common.cancel')}</Button>
        </Box>
      )}
    </Box>
  )
}

/** *+ Scope…* with its first day: a link made from this end. */
function AddLink({ topic, access, current }: { topic: TopicSummary; access: TopicsAccess; current: readonly TopicLink[] }) {
  const { t } = useStrings()
  const [adding, setAdding] = useState<{ path: string; name: string } | null>(null)
  const [from, setFrom] = useState(access.today())
  const choices = access.scopeChoices().filter((one) => !current.some((link) => link.path === one.path))
  return (
    <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
      <Autocomplete
        size="small" options={choices as { path: string; name: string }[]} value={adding} onChange={(_event, next) => setAdding(next)}
        getOptionLabel={(one) => one.name} isOptionEqualToValue={(a, b) => a.path === b.path} sx={{ flex: 1 }}
        renderInput={(params) => <TextField {...params} placeholder={t('topics.addScope')} slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, 'aria-label': t('topics.addScope') } }} />}
      />
      <TextField type="date" size="small" label={t('topics.from')} value={from} onChange={(event) => setFrom(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 150 }} />
      <Button size="small" variant="contained" disabled={!adding} onClick={() => { if (adding) access.relate(topic.id, adding.path, from || undefined); setAdding(null) }} data-testid="topic-link-add">{t('topics.link')}</Button>
    </Box>
  )
}

/** Where the topic is relevant: its own links, those it has through the topic it is under, and its ended links folded. */
function Links({ topic, access }: { topic: TopicSummary; access: TopicsAccess }) {
  const { t, language } = useStrings()
  const today = access.today()
  const standing = topic.links.filter((link) => link.until === undefined || link.until >= today)
  const ended = topic.links.filter((link) => link.until !== undefined && link.until < today)
  const own = new Set(topic.links.filter((link) => linkHolds(link, today)).map((link) => link.path))
  const inherited = access.relevantPlaces(topic.id).filter((path) => !own.has(path))
  const day = (date: string | undefined) => (date ? formatDay(date, language) : '')
  return (
    <>
      <Typography component="h3" sx={HEADING}>{t('topics.relevantTo')}</Typography>
      {standing.length === 0 && inherited.length === 0 && <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('topics.relevantNone')}</Typography>}
      {standing.map((link) => <LinkLine key={`${link.path}/${link.from ?? ''}`} topic={topic} link={link} access={access} day={day} />)}
      {inherited.map((path) => (
        <Box key={path} sx={{ display: 'flex', gap: 1, alignItems: 'baseline', py: 0.5, borderBottom: 1, borderColor: 'divider', fontSize: 14, color: 'text.secondary' }}>
          <Box sx={{ flex: 1 }}>{access.scopeLabel(path)}</Box>
          <Typography sx={{ fontSize: 12 }}>{t('topics.inheritedTip')}</Typography>
        </Box>
      ))}
      {access.mayWrite(topic.id) && <AddLink topic={topic} access={access} current={standing} />}
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.75 }}>{t('topics.bothEnds')}</Typography>
      {ended.length > 0 && (
        <Box component="details" sx={{ mt: 1.5, '& summary': { cursor: 'pointer', fontSize: 12, color: 'text.secondary' } }}>
          <summary>{t('topics.endedLinks', { count: ended.length })}</summary>
          {ended.map((link) => <LinkLine key={`${link.path}/${link.until ?? ''}`} topic={topic} link={link} access={access} day={day} />)}
        </Box>
      )}
    </>
  )
}

/** The building blocks the topic keeps (ADR-0043), each opening its page, and a new one kept here. */
function TopicBlocks({ topic, may }: { topic: TopicSummary; may: boolean }) {
  const blocks = useBlocks()
  const { t } = useStrings()
  const [name, setName] = useState('')
  if (!blocks) return null
  const kept = blocks.blocksAt(topic.id).kept.filter((one) => one.scope === topic.id)
  const make = () => { void blocks.create(topic.id, name).then((id) => { if (id) blocks.openBlock(id) }); setName('') }
  return (
    <>
      <Typography component="h3" sx={HEADING}>{t('topics.blocks')}</Typography>
      {kept.length === 0 && <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('topics.blocksNone')}</Typography>}
      {kept.map(({ block }) => (
        <Box key={block.id}>
          <Link component="button" type="button" underline="hover" onClick={() => blocks.openBlock(block.id)} sx={{ fontSize: 14 }} data-testid={`topic-block-${block.id}`}>{block.name}</Link>
        </Box>
      ))}
      {may && (
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <TextField size="small" value={name} onChange={(event) => setName(event.target.value)} placeholder={t('topics.blockName')} sx={{ flex: 1 }} slotProps={{ htmlInput: { 'aria-label': t('topics.blockName') } }} />
          <Button size="small" disabled={!name.trim()} onClick={make} data-testid="topic-new-block">{t('topics.newBlock')}</Button>
        </Box>
      )}
    </>
  )
}

export function TopicDetail({ topic, access, onSubtopic }: { topic: TopicSummary; access: TopicsAccess; onSubtopic: () => void }) {
  const { t } = useStrings()
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [refused, setRefused] = useState(false)
  const keeps = access.keeps(topic.id)
  const may = access.mayWrite(topic.id)
  const subtopics = access.list().filter((one) => one.parent === topic.id)
  const remove = () => {
    setRemoving(false)
    void access.remove(topic.id).then((gone) => setRefused(!gone))
  }
  return (
    <Box data-testid="topic-detail">
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'text.secondary' }}>
        {topic.parent ? t('topics.subtopicOf', { name: access.get(topic.parent)?.name ?? '' }) : t('topics.topic')}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography component="h2" variant="h5" sx={{ fontWeight: 600, flex: 1 }}>{topic.name}</Typography>
        <Button size="small" onClick={() => access.openHome(topic.id)} data-testid="topic-home">{t('topics.openHome')}</Button>
        {may && <Button size="small" onClick={() => setEditing(true)} data-testid="topic-edit">{t('topics.edit')}</Button>}
        {may && <Button size="small" color="error" onClick={() => (keeps.principles + keeps.blocks + keeps.subtopics > 0 ? setRefused(true) : setRemoving(true))} data-testid="topic-remove">{t('topics.remove')}</Button>}
      </Box>
      {topic.description && <Typography sx={{ fontSize: 14, mt: 0.5 }}>{topic.description}</Typography>}
      {refused && <Alert severity="warning" sx={{ mt: 1 }} onClose={() => setRefused(false)}>{t('topics.removeRefused')}</Alert>}
      <Links topic={topic} access={access} />

      <Typography component="h3" sx={HEADING}>{t('topics.subtopics')}</Typography>
      {subtopics.length === 0 && <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('topics.subtopicsNone')}</Typography>}
      {subtopics.map((one) => <Typography key={one.id} sx={{ fontSize: 14 }}>{one.name}</Typography>)}
      {may && <Button size="small" onClick={onSubtopic} sx={{ mt: 0.5 }}>{t('topics.addSubtopic')}</Button>}

      <Typography component="h3" sx={HEADING}>{t('topics.principles')}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 14 }}>{plural(t, { one: 'topics.principlesCountOne', other: 'topics.principlesCount' }, keeps.principles)}</Typography>
        <Link component="button" type="button" underline="hover" onClick={() => access.openPrinciples(topic.id)} sx={{ fontSize: 13 }} data-testid="topic-open-principles">{t('topics.openPrinciples')}</Link>
      </Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('topics.principlesApply')}</Typography>
      <TopicBlocks topic={topic} may={may} />
      {editing && <EditTopicDialog topic={topic} access={access} onClose={() => setEditing(false)} />}
      <ConfirmDialog
        open={removing} title={t('topics.removeTitle', { name: topic.name })} body={t('topics.removeBody')}
        confirmLabel={t('topics.remove')} cancelLabel={t('common.cancel')} onCancel={() => setRemoving(false)} onConfirm={remove}
      />
    </Box>
  )
}
