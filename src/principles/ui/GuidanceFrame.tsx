// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Guidance: principles, topics and building blocks, which answer one question,
 * what should guide this work. One entry and one frame, where each tab is a page
 * with an address of its own, so a link and an agent still reach each by name:
 * the tabs are a view over the pages and not a state of them. What differs is the
 * reader, because a rule, a subject and a reusable concept are different things.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { usePlaceGo } from '../../widgets/placeTab'
import { Dialog } from '../../widgets/kit/Dialog'
import { PageState } from '../../widgets/kit/PageState'
import type { PageAction } from '../../widgets/kit/PageState'
import { Tabs } from '../../widgets/kit/Tabs'
import './Guidance.css'

export type GuidanceTab = 'principles' | 'topics' | 'blocks'

/** Which one to use: said on the page, since until now only the manual said it. */
function WhichOne() {
  const { t } = useStrings()
  const rows = (['principle', 'topic', 'block'] as const).map((one) => ({
    use: t(`guidance.which.${one}`), when: t(`guidance.which.${one}When`), example: t(`guidance.which.${one}Example`),
  }))
  return (
    <>
      <table className="guidance__which">
        <thead><tr><th scope="col">{t('guidance.which.use')}</th><th scope="col">{t('guidance.which.when')}</th><th scope="col">{t('guidance.which.example')}</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.use}><th scope="row">{row.use}</th><td>{row.when}</td><td>{row.example}</td></tr>)}</tbody>
      </table>
      <p className="guidance__note">{t('guidance.which.relate')}</p>
    </>
  )
}

export function GuidanceFrame({ tab, children }: { tab: GuidanceTab; children: ReactNode }) {
  const { t } = useStrings()
  const go = usePlaceGo()
  const [asking, setAsking] = useState(false)
  return (
    <div className="guidance">
      <div className="guidance__head">
        <Tabs<GuidanceTab>
          label={t('guidance.title')} value={tab} onChange={(next) => { if (next !== tab) go?.({ scope: '', page: next }) }}
          items={[
            { value: 'principles', label: t('guidance.tab.principles') },
            { value: 'topics', label: t('guidance.tab.topics') },
            { value: 'blocks', label: t('guidance.tab.blocks') },
          ]}
        />
        <p className="guidance__purpose">
          {t(`guidance.purpose.${tab}`)}{' '}
          <button type="button" className="guidance__link" onClick={() => setAsking(true)}>{t('guidance.which.ask')}</button>
        </p>
      </div>
      {children}
      <Dialog
        open={asking} size="m" title={t('guidance.which.ask')} onClose={() => setAsking(false)}
        actions={{
          cancel: { onClick: () => setAsking(false), label: t('common.close') },
        }}
      >
        <WhichOne />
      </Dialog>
    </div>
  )
}

/** Nothing here yet, on any of the three: what it is for, an example, and which of the three is wanted. */
export function GuidanceEmpty({ tab, action }: { tab: GuidanceTab; action?: PageAction }) {
  const { t } = useStrings()
  return (
    <PageState
      state="empty" title={t(`guidance.empty.${tab}Title`)} {...(action ? { action } : {})}
      body={(
        <>
          <p>{t(`guidance.empty.${tab}Body`)}</p>
          <div className="guidance__example">
            <strong>{t(`guidance.empty.${tab}Example`)}</strong>
            {t(`guidance.empty.${tab}ExampleText`)}
          </div>
          <WhichOne />
        </>
      )}
    />
  )
}
