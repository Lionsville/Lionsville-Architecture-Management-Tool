// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Topics (ADR-0042 §3), under Guidance: every topic and subtopic as one nested
 * list, a row saying only its name and how many scopes it reaches. Selecting one
 * opens what it links and keeps, large. A page over the home it was opened from,
 * reached from Guidance, a chip on a home, the tree's ↗ row or a check.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { plural } from '../../i18n/strings'
import type { WindowChrome } from '../../platform/windowChrome'
import { GuidanceEmpty, GuidanceFrame } from '../../principles/ui/GuidanceFrame'
import { List } from '../../widgets/kit/List'
import { ListPage } from '../../widgets/kit/ListPage'
import { PageDialog } from '../../widgets/PageDialog'
import { matchesQuery } from '../../model/textSearch'
import { useTopics } from './TopicsContext'
import { TopicDetail } from './TopicDetail'
import { NewTopicDialog } from './topicDialogs'
import { nested } from './topicChoices'
import { usePlaceList } from '../../widgets/placeTab'

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
  const [picked, setPicked] = useState<string | null>(select ?? null)
  const [find, setFind] = useState('')
  const [making, setMaking] = useState<{ parent?: string } | undefined>(undefined)
  useEffect(() => { if (open && select) setPicked(select) }, [open, select, nonce])
  // The topic up is said in the address as every record's preview is (#/-/topics/<path>, its own address): Back and a reload come back to it.
  const [list, addressed, choose] = usePlaceList('topics')
  const heard = useRef(addressed)
  useEffect(() => {
    // The address moved under the page (Back, Forward): the preview follows it.
    if (addressed === heard.current) return
    heard.current = addressed
    if (open) setPicked(addressed ?? null)
  }, [open, addressed])
  useEffect(() => {
    if (!open || (picked ?? undefined) === heard.current) return
    heard.current = picked ?? undefined
    choose(list, picked ?? undefined)
  }, [open, picked, list, choose])
  const version = access?.version ?? 0
  const rows = useMemo(() => nested(access?.list() ?? []), [access, version])
  if (!access) return null
  // A match keeps the topic it is under, so a subtopic is not read out of its place.
  const hits = rows.filter(({ topic }) => matchesQuery(find, [topic.name, topic.description ?? '']))
  const shown = find.trim() ? rows.filter(({ topic }) => hits.some((hit) => hit.topic.id === topic.id || hit.topic.parent === topic.id)) : rows
  const listRows = shown.map(({ topic, depth }) => {
    const reach = access.relevantPlaces(topic.id).length
    return {
      id: topic.id, text: topic.name, depth,
      note: reach === 0 ? t('topics.notLinked') : plural(t, { one: 'topics.scopesOne', other: 'topics.scopesOther' }, reach),
    }
  })
  const current = picked !== null ? access.get(picked) : undefined
  const newOne = access.mayCreate() ? { label: t('topics.new'), onPress: () => setMaking({}), dataGuide: 'topics.new' } : undefined
  return (
    <PageDialog open={open} topInset={windowChrome.topInset} onClose={onClose} aria-label={t('topics.title')}>
      <GuidanceFrame tab="topics">
        {rows.length === 0 ? <div className="guidance__body"><GuidanceEmpty tab="topics" {...(newOne ? { action: newOne } : {})} /></div> : (
          <ListPage
            filter={{ find, onFind: setFind, findLabel: t('topics.search'), shown: { count: shown.length, total: rows.length } }}
            counted={plural(t, { one: 'topics.cardCountOne', other: 'topics.cardCount' }, rows.length)}
            {...(newOne ? { create: { label: newOne.label, onPress: newOne.onPress, guide: 'topics.new', testId: 'topics-new' } } : {})}
            listTestId="topics-catalogue"
          >
            <List
              label={t('topics.title')} groups={[{ id: '', label: '', rows: listRows }]} selectedId={current?.id ?? null} onOpen={setPicked}
              empty={<p className="guidance__note" role="status">{t('topics.searchEmpty', { query: find })}</p>}
            />
          </ListPage>
        )}
      </GuidanceFrame>
      {current && (
        <TopicDetail
          key={current.id} topic={current} access={access} ids={listRows.map((one) => one.id)}
          onSelect={setPicked} onSubtopic={() => setMaking({ parent: current.id })}
        />
      )}
      {making && <NewTopicDialog access={access} {...(making.parent ? { parent: making.parent } : {})} onClose={(id) => { setMaking(undefined); if (id) setPicked(id) }} />}
    </PageDialog>
  )
}
