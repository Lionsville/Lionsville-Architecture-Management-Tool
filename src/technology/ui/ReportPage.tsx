// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One platform, or one service, on one page: one idea from two sides (ADR-0013,
 * ADR-0014). A report rather than a view: everything on it is derived from the
 * rows by `model/platformReport` and `model/serviceReport`, so opening it is the
 * whole of making it, and what the landscape's row counts is what the sentence
 * here says, because both read one sum.
 *
 * It opens with the sentence a person came for, *If X went*, a line of facts,
 * and then one row per thing. All of it is read: what a person changes is
 * changed on the landscape or the record, and a name opens the thing's page
 * where this scope holds it.
 */
import { useMemo, useState } from 'react'
import type { DesignModel, ElementId, Relation } from '../../model'
import { PLATFORM_ARCHETYPE_LABEL } from '../../model'
import { platformReport } from '../../model/platformReport'
import type { PlatformDescribe, PlatformEnd, PlatformReport } from '../../model/platformReport'
import { serviceReport } from '../../model/serviceReport'
import type { ServiceReport } from '../../model/serviceReport'
import type { SharedElsewhere } from '../../model/technologyLandscape'
import type { PlatformTree } from '../../model/hosting'
import { useStrings } from '../../i18n'
import { plural } from '../../i18n/strings'
import type { Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { Button } from '../../widgets/kit/Button'
import { List } from '../../widgets/kit/List'
import type { ListColumn, ListRow } from '../../widgets/kit/List'
import { PageDialog } from '../../widgets/PageDialog'
import type { WindowChrome } from '../../platform/windowChrome'
import './TechnologyLandscapePage.css'

type PageProps = {
  open: boolean
  model: DesignModel
  onClose(): void
  windowChrome?: WindowChrome
  /** Rows written in another scope that name the thing being read (ADR-0012 §2). A STABLE array. */
  elsewhere?: readonly Relation[]
  describe?: PlatformDescribe
  sharedElsewhere?: readonly SharedElsewhere[]
  tree?: PlatformTree
  /** The day it is read. */
  today?: string
  /** The way to an element's own page. Absent = names are not links. */
  onOpenDocumentation?(id: ElementId): void
}

export type PlatformReportPageProps = PageProps & { platformId: ElementId | undefined }
export type ServiceReportPageProps = PageProps & { serviceId: ElementId | undefined }

/** How many rows a report shows before it asks: the sentence has already said how many there are. */
const FIRST_ROWS = 25

function useOptions(props: PageProps) {
  const { elsewhere, describe, today, sharedElsewhere, tree } = props
  return useMemo(() => ({
    ...(elsewhere ? { elsewhere } : {}),
    ...(describe ? { describe } : {}),
    ...(today !== undefined ? { today } : {}),
    ...(sharedElsewhere ? { sharedElsewhere } : {}),
    ...(tree ? { tree } : {}),
  }), [elsewhere, describe, today, sharedElsewhere, tree])
}

function Shell({ open, onClose, label, testId, children }: { open: boolean; onClose(): void; label: string; testId: string; children: React.ReactNode }) {
  return (
    <PageDialog open={open} onClose={onClose} aria-label={label}>
      <div className="tl-report" data-testid={testId}>
        <div className="tl-reportBody"><div className="tl-reportColumn">{children}</div></div>
      </div>
    </PageDialog>
  )
}

function Head({ kind, heading, testId, sentence, facts, summaryId }: { kind: string; heading: string; testId: string; sentence: string; facts: readonly string[]; summaryId: string }) {
  return (
    <header>
      <div className="tl-reportKind">{kind}</div>
      <h1 data-testid={testId}>{heading}</h1>
      <p className="tl-reportSentence" data-testid={summaryId}>{sentence}</p>
      {facts.length > 0 && <div className="tl-reportFacts">{facts.join(' · ')}</div>}
    </header>
  )
}

/** A table of a report: the one List, opening what this scope holds, with the rest behind a press. */
function Rows({ label, itemLabel, columns, rows, opens, empty, testId, t }: {
  label: string; itemLabel: string; columns: readonly ListColumn[]; rows: readonly ListRow[]; opens(id: string): void; empty: string; testId: string; t: Translate
}) {
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, FIRST_ROWS)
  return (
    <section data-testid={testId}>
      <h2>{label}</h2>
      <List
        label={label} itemLabel={itemLabel} columns={columns} density="compact"
        groups={[{ id: 'rows', label: '', rows: shown }]} onOpen={opens}
        empty={<p className="tl-reportEmpty">{empty}</p>}
      />
      {shown.length < rows.length && (
        <Button variant="plain" size="small" data-testid={`${testId}-more`} onClick={() => setAll(true)}>{t('technology.showRest', { count: rows.length - shown.length })}</Button>
      )}
    </section>
  )
}

function endText(end: PlatformEnd, unknown: string): string {
  return end.known ? end.name : `${end.name} (${unknown})`
}

function platformRows(report: PlatformReport, t: Translate): ListRow[] {
  return report.standing.map((one) => ({
    id: `${one.end.id}|${one.how}|${one.via?.id ?? ''}`,
    text: endText(one.end, t('technology.unknown')),
    cells: {
      how: one.how === 'runs' ? t('technology.howRuns')
        : one.how === 'container' ? t('technology.howContainer', { name: one.end.application?.name ?? '' })
          : one.how === 'binds' ? t('technology.howBinds') : t('technology.howThrough'),
      through: one.via?.name ?? one.end.place?.name ?? '',
      from: one.end.where ?? '',
    },
  }))
}

function PlatformBody({ report, opens, t }: { report: PlatformReport; opens(id: string): void; t: Translate }) {
  const applications = report.counts.applications
  const appsOf = (hows: readonly string[]) => new Set(report.standing.filter((one) => hows.includes(one.how)).map((one) => one.end.application?.id ?? one.end.id)).size
  const how = [
    [appsOf(['runs', 'container']), 'technology.sentenceRuns'],
    [appsOf(['binds']), 'technology.sentenceBinds'],
    [appsOf(['through']), 'technology.sentenceThrough'],
  ] as const
  const stays = report.standsOn.map((one) => one.name)
  const sentence = applications === 0 ? t('technology.sentenceNone') : [
    t('technology.sentence', {
      applications: plural(t, { one: 'technology.sentenceApplicationsOne', other: 'technology.sentenceApplicationsOther' }, applications),
      how: how.filter(([count]) => count > 0).map(([count, key]) => t(key, { count })).join(', '),
    }),
    ...(stays.length > 0 ? [t('technology.stays', { names: stays.join(', ') })] : []),
  ].join(' ')
  const facts = [
    t(PLATFORM_ARCHETYPE_LABEL[report.platform.platformArchetype]),
    ...(report.platform.where ? [report.platform.where] : []),
    ...(report.standsOn.length > 0 ? [t('technology.facts.partOf', { names: stays.join(', ') })] : []),
    ...(report.children.length > 0 ? [t('technology.facts.holds', { names: report.children.map((one) => one.name).join(', ') })] : []),
  ]
  const landings = report.landings.map((landing): ListRow => ({
    id: `landing:${landing.relation.id}`,
    text: `${landing.source.name} ${landing.relation.isBidirectional === true ? '↔' : '→'} ${landing.target.name}`,
    cells: {
      how: [landing.relation.protocol, landing.relation.technology].filter(Boolean).join(' · '),
      partOf: landing.partOf ? landing.partOf.label ?? landing.partOf.id : t('technology.itsOwn'),
    },
  }))
  return (
    <>
      <Head kind={t('technology.page')} heading={t('technology.heading', { name: report.platform.name })} testId="technology-platform" sentence={sentence} facts={facts} summaryId="technology-summary" />
      <Rows
        label={t('technology.standing')} itemLabel={t('technology.standing')} testId="technology-standing" rows={platformRows(report, t)} empty={t('technology.nothing')} opens={opens} t={t}
        columns={[{ id: 'how', label: t('technology.how') }, { id: 'through', label: t('technology.through') }, { id: 'from', label: t('service.fromScope') }]}
      />
      <Rows
        label={t('technology.landings')} itemLabel={t('technology.landings')} testId="technology-landings" rows={landings} empty={t('technology.noLandings')} opens={() => {}} t={t}
        columns={[{ id: 'how', label: t('technology.protocol') }, { id: 'partOf', label: t('technology.partOf') }]}
      />
    </>
  )
}

function ServiceBody({ report, opens, language, t }: { report: ServiceReport; opens(id: string): void; language: string; t: Translate }) {
  const { counts } = report
  const inTime = counts.consumers - counts.stranded
  const sentence = counts.consumers + counts.comesWithHosting === 0 ? t('service.sentenceNone') : [
    ...(counts.consumers > 0 ? [t('service.sentence', {
      stranded: plural(t, { one: 'service.applicationsOne', other: 'service.applicationsOther' }, counts.stranded),
      inTime: inTime === 0 ? t('service.inTimeNobody') : t('service.inTimeSome', { count: inTime }),
    })] : []),
    ...(counts.comesWithHosting > 0 ? [t(counts.consumers > 0 ? 'service.sentenceHosting' : 'service.sentenceOnlyHosting', { count: counts.comesWithHosting })] : []),
  ].join(' ')
  const facts = [
    report.service.shared ? t('service.shared') : t('service.ownTeam'),
    ...(report.service.where ? [report.service.where] : []),
    ...(report.service.retiredOn ? [t('service.goesOn', { day: formatDay(report.service.retiredOn, language as never) })] : []),
    report.maintainers.length > 0 ? t('service.maintainers', { names: report.maintainers.map((one) => one.name).join(', ') }) : t('service.nobody'),
    report.realisedBy.length > 0 ? t('service.realisedBy', { names: report.realisedBy.map((one) => one.name).join(', ') }) : t('service.nothingRealises'),
  ]
  const stranded = new Set(report.stranded.map((one) => one.id))
  const rows: ListRow[] = [
    ...report.consumers.map((one) => ({
      id: one.id,
      text: endText(one, t('service.unknown')),
      cells: {
        via: one.via?.name ?? '',
        from: one.where ?? t('service.thisScope'),
        goes: stranded.has(one.id) ? t('service.strandedYes') : t('service.strandedNo'),
      },
    })),
    ...report.comesWithHosting.map((one) => ({
      id: one.id,
      text: endText(one, t('service.unknown')),
      cells: { via: t('service.withHosting'), from: one.where ?? t('service.thisScope'), goes: t('service.strandedYes') },
    })),
  ]
  return (
    <>
      <Head kind={t('service.page')} heading={t('service.heading', { name: report.service.name })} testId="service-name" sentence={sentence} facts={facts} summaryId="service-summary" />
      <Rows
        label={t('service.consumers')} itemLabel={t('service.consumer')} testId="service-consumers" rows={rows} empty={t('service.noConsumers')} opens={opens} t={t}
        columns={[{ id: 'via', label: t('service.via') }, { id: 'from', label: t('service.fromScope') }, { id: 'goes', label: t('service.stranded') }]}
      />
    </>
  )
}

function useOpens(props: PageProps) {
  const held = useMemo(() => new Set(props.model.elements.map((one) => one.id)), [props.model.elements])
  return (rowId: string) => {
    const id = rowId.split('|')[0]!
    if (held.has(id)) props.onOpenDocumentation?.(id)
  }
}

export function PlatformReportPage({ platformId, ...props }: PlatformReportPageProps) {
  const { t } = useStrings()
  const options = useOptions(props)
  const opens = useOpens(props)
  const report = useMemo(() => (platformId === undefined ? undefined : platformReport(props.model, platformId, options)), [props.model, platformId, options])
  return (
    <Shell open={props.open} onClose={props.onClose} label={t('technology.page')} testId="technology-body">
      {report ? <PlatformBody report={report} opens={opens} t={t} /> : <p className="tl-reportEmpty">{t('technology.noPlatform')}</p>}
    </Shell>
  )
}

export function ServiceReportPage({ serviceId, ...props }: ServiceReportPageProps) {
  const { t, language } = useStrings()
  const options = useOptions(props)
  const opens = useOpens(props)
  const report = useMemo(() => (serviceId === undefined ? undefined : serviceReport(props.model, serviceId, options)), [props.model, serviceId, options])
  return (
    <Shell open={props.open} onClose={props.onClose} label={t('service.page')} testId="service-body">
      {report ? <ServiceBody report={report} opens={opens} language={language} t={t} /> : <p className="tl-reportEmpty">{t('service.noService')}</p>}
    </Shell>
  )
}
