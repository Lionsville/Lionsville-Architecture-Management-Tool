// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The topics to make relevant to a scope, chosen from its home (ADR-0042 §4):
 * an organisation may keep fifty topics or more, so the chooser is a dialog
 * of its own — found by typing, browsed as the catalogue nests them, each row
 * saying what the topic is about, where it already applies and what it keeps,
 * and the topic pointed at read in full beside the list. Several are picked
 * at once; each becomes a link from today, kept with its topic. A subtopic
 * comes with its topic, so it is shown ticked once its topic is.
 *
 * Nothing found and the person may make topics: *New topic* starts one with
 * what was typed, relevant here.
 */
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import type { ScopePath } from '../../projects/scopePath'
import { FieldsDialog } from '../../widgets/CompactForms'
import type { TopicSummary, TopicsAccess } from './TopicsContext'
import { topicChoices } from './topicChoices'
import type { TopicChoice } from './topicChoices'
import { NewTopicDialog } from './topicDialogs'

const QUIET = { fontSize: 12, color: 'text.secondary' } as const
/** How many places a row names before it counts the rest. */
const PLACES_NAMED = 3

export function TopicChooser({ at, access, onClose }: { at: ScopePath; access: TopicsAccess; onClose: () => void }) {
  const { t } = useStrings()
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<ReadonlySet<ScopePath>>(new Set())
  const [pointed, setPointed] = useState<ScopePath>()
  const [making, setMaking] = useState(false)
  const rows = useMemo(() => topicChoices(access, at, query, picked), [access, at, query, picked])
  const total = access.list().length
  const toggle = (id: ScopePath) => setPicked((was) => {
    const next = new Set(was)
    if (!next.delete(id)) next.add(id)
    return next
  })
  const add = () => {
    for (const id of picked) access.relate(id, at)
    onClose()
  }
  if (making) {
    return <NewTopicDialog access={access} name={query.trim()} relevantTo={[at]} onClose={(made) => (made ? onClose() : setMaking(false))} />
  }
  const about = rows.find((row) => row.topic.id === pointed) ?? rows.find((row) => row.matched)
  return (
    <FieldsDialog open onClose={onClose} maxWidth="md" fullWidth slotProps={{ paper: { sx: { height: '80vh' } } }} data-testid="topic-chooser">
      <DialogTitle>{t('topics.chooseTitle', { scope: access.scopeLabel(at) })}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0 }}>
        <Typography sx={QUIET}>{t('topics.chooseIntro')}</Typography>
        <TextField
          autoFocus size="small" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('topics.chooseFind')}
          helperText={t('topics.chooseShown', { shown: rows.filter((row) => row.matched).length, count: total })}
          slotProps={{ htmlInput: { 'aria-label': t('topics.chooseFind'), 'data-testid': 'topic-chooser-find' } }}
        />
        <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '3fr 2fr' }, gap: 2 }}>
          <Box role="list" aria-label={t('topics.title')} sx={{ overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
            {rows.map((row) => (
              <ChoiceRow key={row.topic.id} row={row} access={access} picked={picked.has(row.topic.id)} onToggle={toggle} onPoint={setPointed} />
            ))}
            {rows.length === 0 && <Typography sx={{ ...QUIET, p: 2 }}>{t('topics.chooseNone')}</Typography>}
          </Box>
          <Box sx={{ display: { xs: 'none', md: 'block' }, overflowY: 'auto' }} data-testid="topic-chooser-about">
            {about ? <TopicAbout topic={about.topic} access={access} /> : <Typography sx={QUIET}>{t('topics.chooseNothing')}</Typography>}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        {access.mayCreate() && <Button onClick={() => setMaking(true)} sx={{ mr: 'auto' }} data-testid="topic-chooser-new">{t('topics.chooseNew')}</Button>}
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={picked.size === 0} onClick={add} data-testid="topic-chooser-add">
          {t(picked.size === 0 ? 'topics.chooseAdd' : picked.size === 1 ? 'topics.chooseAddOne' : 'topics.chooseAddOther', { count: picked.size })}
        </Button>
      </DialogActions>
    </FieldsDialog>
  )
}

/** One topic on offer: ticked to pick it, its description and where it applies beneath its name, and why it cannot be picked where it cannot. */
function ChoiceRow({ row, access, picked, onToggle, onPoint }: {
  row: TopicChoice; access: TopicsAccess; picked: boolean; onToggle: (id: ScopePath) => void; onPoint: (id: ScopePath) => void
}) {
  const { t } = useStrings()
  const { topic, depth, state } = row
  const free = state === 'free'
  const said = state === 'here' ? t('topics.chooseHere') : state === 'with' ? t('topics.chooseWith', { name: row.withName ?? '' }) : state === 'readOnly' ? t('topics.chooseReadOnly') : undefined
  return (
    <Box
      component="label" role="listitem" onMouseEnter={() => onPoint(topic.id)} data-testid={`topic-choice-${topic.id}`}
      sx={{
        display: 'flex', alignItems: 'flex-start', gap: 1, pl: 1 + depth * 3, pr: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider',
        cursor: free ? 'pointer' : 'default', '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Checkbox
        size="small" checked={!free || picked} disabled={!free} onChange={() => onToggle(topic.id)} onFocus={() => onPoint(topic.id)}
        sx={{ p: 0.25 }} slotProps={{ input: { 'aria-label': topic.name } }}
      />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {/* A row kept only for a match below it says its name in the quieter ink. */}
        <Typography noWrap sx={{ fontSize: 13, fontWeight: depth === 0 ? 600 : 500, color: row.matched ? 'text.primary' : 'text.secondary' }}>{topic.name}</Typography>
        {topic.description && <Typography noWrap sx={QUIET}>{topic.description}</Typography>}
        <Typography noWrap sx={{ ...QUIET, fontSize: 11 }}>{placesLine(access, topic, t)}</Typography>
      </Box>
      {said && <Chip size="small" label={said} variant="outlined" sx={{ height: 18, fontSize: 10, flex: '0 0 auto' }} />}
    </Box>
  )
}

/** Where a topic applies today, the first few by name, and what it keeps where it keeps anything. */
function placesLine(access: TopicsAccess, topic: TopicSummary, t: ReturnType<typeof useStrings>['t']): string {
  const places = access.relevantPlaces(topic.id).map((path) => access.scopeLabel(path))
  const named = places.length === 0 ? t('topics.chooseNowhere')
    : t('topics.chooseRelevantTo', { places: places.slice(0, PLACES_NAMED).join(', ') + (places.length > PLACES_NAMED ? ` +${places.length - PLACES_NAMED}` : '') })
  const keeps = access.keeps(topic.id)
  return keeps.principles + keeps.blocks === 0 ? named : `${named} · ${t('topics.chooseKeeps', { principles: keeps.principles, blocks: keeps.blocks })}`
}

/** The topic pointed at, read in full: what it is about, what it is under, where it applies, what it keeps. */
function TopicAbout({ topic, access }: { topic: TopicSummary; access: TopicsAccess }) {
  const { t } = useStrings()
  const parent = topic.parent ? access.get(topic.parent) : undefined
  const places = access.relevantPlaces(topic.id)
  const subtopics = access.list().filter((one) => one.parent === topic.id)
  const keeps = access.keeps(topic.id)
  const HEAD = { fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mt: 1.5, mb: 0.25 } as const
  return (
    <Box>
      <Typography component="h3" sx={{ fontSize: 15, fontWeight: 600 }}>{topic.name}</Typography>
      {parent && <Typography sx={QUIET}>{t('topics.subtopicOf', { name: parent.name })}</Typography>}
      <Typography sx={{ fontSize: 13, mt: 1, whiteSpace: 'pre-wrap' }}>{topic.description || '—'}</Typography>
      <Typography sx={HEAD}>{t('topics.relevantTo')}</Typography>
      <Typography sx={{ fontSize: 13 }}>{places.map((path) => access.scopeLabel(path)).join(', ') || t('topics.chooseNowhere')}</Typography>
      <Typography sx={HEAD}>{t('topics.subtopics')}</Typography>
      <Typography sx={{ fontSize: 13 }}>{subtopics.map((one) => one.name).join(', ') || t('topics.subtopicsNone')}</Typography>
      <Typography sx={HEAD}>{t('topics.chooseKeepsHead')}</Typography>
      <Typography sx={{ fontSize: 13 }}>{t('topics.chooseKeeps', { principles: keeps.principles, blocks: keeps.blocks })}</Typography>
    </Box>
  )
}
