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
import Chip from '@mui/material/Chip'
import { Button } from '../../widgets/kit/Button'
import { PropertyRow, PropertyRows } from '../../widgets/kit/Field'
import { useStrings } from '../../i18n/LanguageContext'
import { linkHolds, useTopics } from './TopicsContext'
import type { TopicSummary } from './TopicsContext'
import { TopicChooser } from './TopicChooser'


export function RelevantTopics({ at }: { at: string }) {
  const access = useTopics()
  const { t } = useStrings()
  const [adding, setAdding] = useState(false)
  if (!access) return null
  if (access.get(at)) {
    return (
      <div data-testid="relevant-topics" data-guide="org.relevantTopics">
        <PropertyRows>
          <PropertyRow
            label={t('topics.topic')}
            display={<>{t('topics.thisIsTopic')} <Button variant="quiet" size="small" onClick={() => access.openCatalogue(at)} data-testid="topic-in-catalogue">{t('topics.openInCatalogue')}</Button></>}
          />
        </PropertyRows>
      </div>
    )
  }
  const today = access.today()
  const here = access.relevantAt(at)
  // As the tree lists them: a subtopic goes with its topic's chip, unless it has a link of its own here.
  const chips = access.treeRows(at)
  const choosable = access.mayCreate() || access.list().some((one) => access.mayWrite(one.id) && !here.some((held) => held.id === one.id))
  const ownLink = (topic: TopicSummary) => topic.links.some((link) => link.path === at && linkHolds(link, today))
  return (
    <div data-testid="relevant-topics" data-guide="org.relevantTopics">
      <PropertyRows>
        <PropertyRow
          label={t('topics.relevantHere')}
          display={(
            <>
              {here.length === 0 && <>{t('topics.relevantNone')} </>}
              {chips.map((topic) => (
                <Chip
                  key={topic.id} size="small" label={topic.name} onClick={() => access.openCatalogue(topic.id)}
                  {...(ownLink(topic) && access.mayWrite(topic.id) ? { onDelete: () => access.stopHere(topic.id, at) } : {})}
                  title={t('topics.endHereTip')}
                  data-testid={`relevant-${topic.id}`}
                />
              ))}
              {choosable && <Button variant="quiet" size="small" onClick={() => setAdding(true)} data-testid="relevant-add">{t('topics.addTopic')}</Button>}
            </>
          )}
        />
      </PropertyRows>
      {adding && <TopicChooser at={at} access={access} onClose={() => setAdding(false)} />}
    </div>
  )
}
