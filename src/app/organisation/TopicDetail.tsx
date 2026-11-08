// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One topic, read large over the list (ADR-0042 §3): what it is, where it is
 * relevant, and what it keeps. Each link is one line with one More whose items say
 * what they keep, since linking is a rare act and must not take the space of what a
 * topic is. *Remove* is refused while it keeps anything, and says so before the
 * press. Every write is under the topic's rights: a person who may only read it
 * reads it.
 */
import { useState } from 'react'
import { formatDay } from '../../i18n/dates'
import { useStrings } from '../../i18n/LanguageContext'
import { plural } from '../../i18n/strings'
import { MarkdownView } from '../../documentation/ui/MarkdownView'
import { useBlocks } from '../../blocks/ui/BlocksContext'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { DateField, TextField } from '../../widgets/kit/Field'
import { MoreMenu } from '../../widgets/kit/Menu'
import { RecordActions } from '../../widgets/kit/RecordActions'
import { PanelSection } from '../../widgets/kit/Panel'
import { Picker } from '../../widgets/kit/Picker'
import { Preview, PreviewFact } from '../../widgets/kit/Preview'
import { linkHolds } from './TopicsContext'
import type { TopicLink, TopicSummary, TopicsAccess } from './TopicsContext'
import { EditTopicDialog } from './TopicEditDialog'

/** How a link's days are said: since when, from when, or from and until. */
function linkWords(link: TopicLink, today: string, day: (date: string | undefined) => string, t: ReturnType<typeof useStrings>['t']): string {
  if (link.until !== undefined && link.until < today) return t('topics.linkEnded', { from: day(link.from) || '…', until: day(link.until) })
  if (link.from !== undefined && link.from > today) return t('topics.linkPlanned', { from: day(link.from) })
  return link.from ? t('topics.linkSince', { from: day(link.from) }) : t('topics.linkAlways')
}

/** *End on a day…* and *Change the days…*: the day or days a link holds, asked for one link at a time. */
function DaysDialog({ mode, topic, link, access, onClose }: { mode: 'end' | 'edit'; topic: TopicSummary; link: TopicLink; access: TopicsAccess; onClose: () => void }) {
  const { t } = useStrings()
  const [from, setFrom] = useState(link.from ?? '')
  const [until, setUntil] = useState(link.until ?? access.today())
  const save = () => {
    if (mode === 'end') access.endLink(topic.id, link, until)
    else access.setLink(topic.id, link, { ...(from ? { from } : {}), ...(until && link.until !== undefined ? { until } : {}) })
    onClose()
  }
  return (
    <Dialog
      open title={t(mode === 'end' ? 'topics.endTitle' : 'topics.daysTitle')} onClose={onClose}
      actions={(
        <>
          <Button variant="quiet" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={save}>{mode === 'end' ? t('topics.endSave') : t('topics.save')}</Button>
        </>
      )}
    >
      {mode === 'edit' && <DateField label={t('topics.from')} value={from} onChange={setFrom} />}
      {(mode === 'end' || link.until !== undefined) && <DateField label={t('topics.until')} value={until} onChange={setUntil} />}
    </Dialog>
  )
}

/** One link: the scope, its days, and for a person who may change the topic one More with its three changes. */
function LinkLine({ topic, link, access, day }: { topic: TopicSummary; link: TopicLink; access: TopicsAccess; day: (date: string | undefined) => string }) {
  const { t } = useStrings()
  const [asking, setAsking] = useState<'end' | 'edit' | undefined>(undefined)
  return (
    <div className="guidance-read__line" data-testid={`topic-link-${link.path}`}>
      <span className="guidance-read__grow">{access.scopeLabel(link.path)}</span>
      <span className="guidance-read__quiet">{linkWords(link, access.today(), day, t)}</span>
      {access.mayWrite(topic.id) && (
        <MoreMenu
          label={t('topics.linkMore', { scope: access.scopeLabel(link.path) })}
          items={[
            ...(link.until === undefined ? [{ label: t('topics.end'), onSelect: () => setAsking('end' as const) }] : []),
            { label: t('topics.editDays'), onSelect: () => setAsking('edit') },
            { label: t('topics.removeLink'), final: true, onSelect: () => access.removeLink(topic.id, link) },
          ]}
        />
      )}
      {asking && <DaysDialog mode={asking} topic={topic} link={link} access={access} onClose={() => setAsking(undefined)} />}
    </div>
  )
}

/** *+ Scope…* with its first day: a link made from this end. */
function AddLink({ topic, access, current, onClose }: { topic: TopicSummary; access: TopicsAccess; current: readonly TopicLink[]; onClose: () => void }) {
  const { t } = useStrings()
  const [adding, setAdding] = useState<{ id: string; label: string } | undefined>(undefined)
  const [from, setFrom] = useState(access.today())
  const options = access.scopeChoices().filter((one) => !current.some((link) => link.path === one.path)).map((one) => ({
    id: one.path, label: one.name, group: one.topic ? t('topics.placeTopics') : t('topics.placeScopes'),
  }))
  return (
    <Dialog
      open size="m" title={t('topics.addScopeTitle')} onClose={onClose}
      actions={(
        <>
          <Button variant="quiet" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!adding} onClick={() => { if (adding) access.relate(topic.id, adding.id, from || undefined); onClose() }} data-testid="topic-link-add">{t('topics.link')}</Button>
        </>
      )}
    >
      {adding ? <p>{t('topics.pickedScope', { scope: adding.label })}</p> : <Picker label={t('topics.pickScope')} autoFocus options={options} recent={options.slice(0, 8)} onPick={setAdding} />}
      <DateField label={t('topics.from')} value={from} onChange={setFrom} />
    </Dialog>
  )
}

/** Where the topic is relevant: its own links, those it has through the topic it is under, and its ended links folded. */
function Links({ topic, access }: { topic: TopicSummary; access: TopicsAccess }) {
  const { t, language } = useStrings()
  const [adding, setAdding] = useState(false)
  const today = access.today()
  const standing = topic.links.filter((link) => link.until === undefined || link.until >= today)
  const ended = topic.links.filter((link) => link.until !== undefined && link.until < today)
  const own = new Set(topic.links.filter((link) => linkHolds(link, today)).map((link) => link.path))
  const inherited = access.relevantPlaces(topic.id).filter((path) => !own.has(path))
  const day = (date: string | undefined) => (date ? formatDay(date, language) : '')
  return (
    <PanelSection title={t('topics.relevantTo')} {...(access.mayWrite(topic.id) ? { aside: <Button variant="quiet" size="small" onClick={() => setAdding(true)} data-testid="topic-add-scope">{t('topics.addScope')}</Button> } : {})}>
      {standing.length === 0 && inherited.length === 0 && <p className="guidance-read__empty">{t('topics.relevantNone')}</p>}
      {standing.map((link) => <LinkLine key={`${link.path}/${link.from ?? ''}`} topic={topic} link={link} access={access} day={day} />)}
      {inherited.map((path) => (
        <div className="guidance-read__line" key={path}>
          <span className="guidance-read__grow">{access.scopeLabel(path)}</span>
          <span className="guidance-read__quiet">{t('topics.inheritedTip')}</span>
        </div>
      ))}
      {ended.length > 0 && (
        <details className="guidance-form__fold">
          <summary>{t('topics.endedLinks', { count: ended.length })}</summary>
          {ended.map((link) => <LinkLine key={`${link.path}/${link.until ?? ''}`} topic={topic} link={link} access={access} day={day} />)}
        </details>
      )}
      {adding && <AddLink topic={topic} access={access} current={standing} onClose={() => setAdding(false)} />}
    </PanelSection>
  )
}

/** The building blocks the topic keeps (ADR-0043), each opening its page, and a new one kept here. */
function TopicBlocks({ topic, may }: { topic: TopicSummary; may: boolean }) {
  const blocks = useBlocks()
  const { t } = useStrings()
  const [making, setMaking] = useState(false)
  const [name, setName] = useState('')
  if (!blocks) return null
  const kept = blocks.blocksAt(topic.id).kept.filter((one) => one.scope === topic.id)
  const make = () => { void blocks.create(topic.id, name).then((id) => { if (id) blocks.openBlock(id) }); setName(''); setMaking(false) }
  return (
    <PanelSection title={t('topics.blocks')} {...(may ? { aside: <Button variant="quiet" size="small" onClick={() => setMaking(true)} data-testid="topic-add-block">{t('topics.newBlock')}</Button> } : {})}>
      {kept.length === 0 && <p className="guidance-read__empty">{t('topics.blocksNone')}</p>}
      {kept.map(({ block }) => (
        <div className="guidance-read__line" key={block.id}>
          <button type="button" className="guidance__link" onClick={() => blocks.openBlock(block.id)} data-testid={`topic-block-${block.id}`}>{block.name}</button>
        </div>
      ))}
      <Dialog
        open={making} title={t('topics.newBlockTitle')} onClose={() => setMaking(false)}
        actions={(
          <>
            <Button variant="quiet" onClick={() => setMaking(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={!name.trim()} onClick={make} data-testid="topic-new-block">{t('topics.createBlock')}</Button>
          </>
        )}
      >
        <TextField autoFocus label={t('topics.blockName')} value={name} onChange={setName} />
      </Dialog>
    </PanelSection>
  )
}

export function TopicDetail({ topic, access, ids, onSelect, onSubtopic }: {
  topic: TopicSummary
  access: TopicsAccess
  /** The list's rows as drawn, for walking it. */
  ids: readonly string[]
  onSelect: (id: string | null) => void
  onSubtopic: () => void
}) {
  const { t } = useStrings()
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const keeps = access.keeps(topic.id)
  const may = access.mayWrite(topic.id)
  const subtopics = access.list().filter((one) => one.parent === topic.id)
  const principles = access.principlesOf(topic.id)
  const parent = topic.parent ? access.get(topic.parent) : undefined
  const refused = keeps.principles + keeps.blocks + keeps.subtopics > 0
  const remove = () => {
    setRemoving(false)
    void access.remove(topic.id).then((gone) => { if (gone) onSelect(null) })
  }
  return (
    <>
      <Preview
        ids={ids} currentId={topic.id} onSelect={onSelect} title={topic.name} listWord={t('topics.listWord')}
        {...(parent ? { code: t('topics.subtopicOf', { name: parent.name }) } : {})}
        facts={(
          <>
            <PreviewFact label={t('topics.relevantTo')}>{plural(t, { one: 'topics.scopesOne', other: 'topics.scopesOther' }, access.relevantPlaces(topic.id).length)}</PreviewFact>
          </>
        )}
        actions={(
          <RecordActions
            verbs={<Button variant="quiet" onClick={() => access.openHome(topic.id)} data-testid="topic-home">{t('topics.openHome')}</Button>}
            {...(may ? { edit: { onPress: () => setEditing(true), testId: 'topic-edit' } } : {})}
            more={may ? [{
              label: t('topics.remove'), final: true, onSelect: () => setRemoving(true),
              ...(refused ? { refused: t('topics.removeRefusedShort') } : {}),
            }] : []}
          />
        )}
      >
        <div className="guidance-read" data-testid="topic-detail">
          <p className="guidance-read__quiet">{t('topics.isScope')}</p>
          {topic.description && <MarkdownView markdown={topic.description} />}
          <p className="guidance-read__status">{t('topics.applies')}</p>
          <Links topic={topic} access={access} />
          <PanelSection title={t('topics.principles')} aside={<button type="button" className="guidance__link" onClick={() => access.openPrinciples(topic.id)} data-testid="topic-open-principles">{t('topics.openPrinciples')}</button>}>
            {principles.length === 0 && <p className="guidance-read__empty">{t('topics.principlesNone')}</p>}
            {principles.map((one) => (
              <div className="guidance-read__line" key={one.id}>
                <button type="button" className="guidance__link" onClick={() => access.openPrinciples(topic.id, one.id)}>{one.label}</button>
              </div>
            ))}
          </PanelSection>
          <TopicBlocks topic={topic} may={may} />
          <PanelSection title={t('topics.subtopics')} {...(may ? { aside: <Button variant="quiet" size="small" onClick={onSubtopic}>{t('topics.addSubtopic')}</Button> } : {})}>
            {subtopics.length === 0 && <p className="guidance-read__empty">{t('topics.subtopicsNone')}</p>}
            {subtopics.map((one) => (
              <div className="guidance-read__line" key={one.id}>
                <button type="button" className="guidance__link" onClick={() => onSelect(one.id)}>{one.name}</button>
              </div>
            ))}
          </PanelSection>
        </div>
      </Preview>
      {editing && <EditTopicDialog topic={topic} access={access} onClose={() => setEditing(false)} />}
      <Dialog
        open={removing} title={t('topics.removeTitle', { name: topic.name })} onClose={() => setRemoving(false)}
        actions={(
          <>
            <Button variant="quiet" onClick={() => setRemoving(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={remove}>{t('topics.remove')}</Button>
          </>
        )}
      >
        <p>{t('topics.removeBody')}</p>
      </Dialog>
    </>
  )
}
