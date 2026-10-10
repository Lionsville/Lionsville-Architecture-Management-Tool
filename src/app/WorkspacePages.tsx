// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The pages beside the canvas, one at a time (`useWorkspacePages`): the
 * decisions and the observations, the roadmap and a plan on it, and a
 * platform's report and a service's.
 */
import { useMemo } from 'react'
import type { ComponentProps } from 'react'
import { shownAsOf } from '../editor'
import { AdrPage } from '../decisions/ui/AdrPage'
import type { ObservationsPage as ObservationsPageShape } from '../observations/ui/ObservationsPage'
import { flattenScopes } from '../projects/scope'
import { scopeDisplayName } from '../projects/scopeLabel'
import { PlanPage, ReplaceDialog, RoadmapPage } from '../roadmap'
import { Crumbs } from './ShellToolbar'
import type {
  PlatformReportPage as PlatformReportShape, ServiceReportPage as ServiceReportShape,
} from '../technology/ui/ReportPage'
import { lazyPart } from '../widgets/lazyPart'
import { ShareLinkDialog } from './dialogs/ShareLinkDialog'
import { useRecordLink } from './useShareLink'
import type { WorkspaceParts } from './workspaceParts'

/**
 * A platform's report and a service's are pages reached from a card, never the
 * first view: their script arrives with the first one opened (`widgets/lazyPart`).
 */
const ServiceReportPage = lazyPart<ComponentProps<typeof ServiceReportShape>>(
  () => import('../technology/ui/ReportPage').then((held) => held.ServiceReportPage), { until: (props) => props.open },
)
const PlatformReportPage = lazyPart<ComponentProps<typeof PlatformReportShape>>(
  () => import('../technology/ui/ReportPage').then((held) => held.PlatformReportPage), { until: (props) => props.open },
)
/**
 * The observations page is reached from a card or a tab's menu, never the first
 * view, and with its picture, its filters and its forms it is the largest page
 * the workspace has: its script arrives when it is first opened.
 */
const ObservationsPage = lazyPart<ComponentProps<typeof ObservationsPageShape>>(
  () => import('../observations/ui/ObservationsPage').then((held) => held.ObservationsPage), { until: (props) => props.open },
)

export function WorkspacePages({ parts }: { parts: WorkspaceParts }) {
  const { s } = parts.props.shell
  const links = useRecordLink({
    address: parts.props.source.shareAddress,
    scope: parts.props.project.path,
    copyText: parts.props.host.controls.copyText,
    diagnostics: parts.props.host.diagnostics,
    notify: parts.props.shell.notify,
    s,
  })
  return (
    <>
      <RecordPages parts={parts} copyRecord={links.copyRecord} />
      <PlanPages parts={parts} copyRecord={links.copyRecord} />
      <ReportPages parts={parts} />
      <ShareLinkDialog answer={links.answer} onCopy={links.copy} onClose={links.close} s={s} />
    </>
  )
}

/** A picture library as a document page takes it: the pictures, who shows each, and removing one. */
function imagesOf({ session, pictures, files }: WorkspaceParts) {
  return { library: session.imageLibrary, usedBy: pictures.imageUsedBy, onRemove: files.removeImage }
}

/** The decisions page (ADR-0012 §7) and the observations page (ADR-0021). */
function RecordPages({ parts, copyRecord }: { parts: WorkspaceParts; copyRecord: ReturnType<typeof useRecordLink>['copyRecord'] }) {
  const { props, session, pages, snapshots, analysis, readings, pictures, files, readOnly, requests, pageChrome, changeBelow, changeAcross } = parts
  const { s, language, makeId } = props.shell
  const { groupName, ancestorDecisions, scopes } = props.tree
  const { onOpenScope, crumbs, onGoHome } = props.navigation
  const { plans } = pages
  // Each scope above by its name in the tree, never its path — and the same
  // list while nothing changes, because the page re-selects on a new one.
  const ancestors = useMemo(() => {
    const listed = flattenScopes(scopes)
    return ancestorDecisions.map((one) => ({ ...one, name: scopeDisplayName(one.path, listed, groupName) }))
  }, [ancestorDecisions, scopes, groupName])
  return (
    <>
      <AdrPage
        open={pages.adrPage.open}
        onClose={() => { pages.closeDecisions(); pages.leaveIfNothingToDraw() }}
        model={session.model}
        groupName={groupName}
        ancestors={ancestors}
        crumbs={(
          <Crumbs
            crumbs={crumbs}
            current={session.model.name}
            currentPath={props.project.path}
            onGoHome={(path) => { pages.closeDecisions(); onGoHome(path) }}
            s={s}
          />
        )}
        {...(onOpenScope
          // On the record, as the observations page opens on its own: the scope
          // above may draw nothing, and a scope with no views opened on no page
          // lands on its home (`pageLanding`), away from the record.
          ? { onOpenScope: (path: string, id: string) => onOpenScope(path, { page: 'decisions', id }) }
          : {})}
        onProjectDecisionsChange={analysis.onDecisionsChange}
        initialAdrId={pages.adrPage.adrId}
        initialNonce={pages.adrPage.nonce}
        onShown={pages.decisionShown}
        readOnly={readOnly}
        s={s}
        language={language}
        makeId={makeId}
        today={parts.today}
        renderMarkdown={pictures.renderDocument}
        onOpenElement={(elementId) => requests.openDocumentation(elementId)}
        onOpenHistory={snapshots.available
          ? (adrId) => { pages.closeDecisions(); snapshots.openPage({ what: 'decision', id: adrId }) }
          : undefined}
        onOpenPlan={plans.openPlan}
        onOpenSolution={(solutionId) => { pages.closeDecisions(); pages.openObservations(solutionId) }}
        onCopyLink={(id) => copyRecord('decisions', id)}
        windowChrome={pageChrome}
      />
      <ObservationsPage
        open={pages.obsPage.open}
        onClose={() => { pages.closeObservations(); pages.leaveIfNothingToDraw() }}
        model={session.model}
        groupName={groupName}
        crumbs={crumbs}
        path={props.project.path}
        below={readings.analysisBelow}
        tree={readings.analysisTree}
        {...(props.source.writable ? { writable: props.source.writable } : {})}
        explainedAbove={readings.explainedAbove}
        explainedAboveOf={readings.explainedAboveOf}
        {...(readOnly ? {} : { onChangeBelow: changeBelow, onChangeAcross: changeAcross })}
        scopeLabel={readings.scopeLabel}
        {...(props.preferences.savedFilters ? { savedFilters: props.preferences.savedFilters } : {})}
        absorbedAbove={readings.absorbedAbove}
        {...(onOpenScope
          ? { onOpenScope: (path: string, id?: string) => onOpenScope(path, { page: 'observations', ...(id !== undefined ? { id } : {}) }) }
          : {})}
        onChange={analysis.onAnalysisChange}
        readOnly={readOnly}
        onDecide={readOnly ? undefined : analysis.onDecideSolution}
        onStartPlan={readOnly ? undefined : analysis.onStartSolutionPlan}
        onOpenDecision={(adrId) => { pages.closeObservations(); pages.openDecisions(adrId) }}
        onOpenPlan={(planId) => { pages.closeObservations(); plans.openPlan(planId) }}
        initialId={pages.obsPage.id}
        initialTab={pages.obsPage.tab}
        initialNonce={pages.obsPage.nonce}
        onShown={pages.observationShown}
        s={s}
        language={language}
        makeId={makeId}
        today={parts.today}
        renderMarkdown={pictures.renderDocument}
        onAddImage={files.addImage}
        images={imagesOf(parts)}
        onCopyLink={(record) => copyRecord('observations', record.id, record.tab)}
        windowChrome={pageChrome}
      />
    </>
  )
}

/** The roadmap, the replace dialog it starts from a card, and one plan over it. */
function PlanPages({ parts, copyRecord }: { parts: WorkspaceParts; copyRecord: ReturnType<typeof useRecordLink>['copyRecord'] }) {
  const { props, session, pages, readings, ownership, viewing, pictures, files, readOnly, todayDay, pageChrome } = parts
  const { onOpenScope } = props.navigation
  const { plans } = pages
  const open = session.model.diagrams.find((d) => d.id === session.activeDiagramId)
  // A plan may rest on a record filed above this scope; its gate reads those too.
  const { ancestorDecisions } = props.tree
  const decidedAbove = useMemo(() => ancestorDecisions.flatMap((one) => one.decisions), [ancestorDecisions])
  return (
    <>
      <RoadmapPage
        open={plans.roadmapOpen}
        model={session.model}
        fromBelow={readings.initiativesBelow}
        onOpenInitiative={onOpenScope ? (scope, id) => onOpenScope(scope, { page: 'plan', id }) : undefined}
        today={todayDay}
        platformTree={ownership.platformTree}
        asOf={open ? shownAsOf(open, viewing.days) : undefined}
        readOnly={readOnly}
        actions={plans.roadmapActions}
        onClose={() => { plans.closeRoadmap(); pages.leaveIfNothingToDraw() }}
        windowChrome={pageChrome}
      />
      <ReplaceDialog
        subject={plans.replacing}
        model={session.model}
        onCancel={plans.cancelReplace}
        onConfirm={plans.confirmReplace}
      />
      <PlanPage
        open={plans.planId !== undefined}
        plan={plans.plan}
        model={session.model}
        decisions={session.model.decisions}
        ancestorDecisions={decidedAbove}
        today={todayDay}
        readOnly={readOnly}
        actions={plans.planActions}
        renderMarkdown={pictures.renderDocument}
        onAddImage={files.addImage}
        images={imagesOf(parts)}
        onClose={plans.closePlan}
        windowChrome={pageChrome}
        initiativeToggle={props.project.path !== ''}
        describe={readings.describeForMap}
        onCopyLink={(id) => copyRecord('plan', id)}
      />
    </>
  )
}

/** A service's report and a platform's (ADR-0013, ADR-0014): derived, read only. */
function ReportPages({ parts }: { parts: WorkspaceParts }) {
  const { session, pages, readings, requests, todayDay, pageChrome } = parts
  const { platformReading } = pages
  const close = () => { platformReading.close(); pages.leaveIfNothingToDraw() }
  return (
    <>
      <ServiceReportPage
        open={platformReading.serviceId !== undefined}
        model={session.model}
        serviceId={platformReading.serviceId}
        onClose={close}
        elsewhere={readings.rowsThrough}
        describe={readings.describeForMap}
        today={todayDay}
        onOpenDocumentation={(id) => requests.openDocumentation(id)}
        windowChrome={pageChrome}
      />
      <PlatformReportPage
        open={platformReading.platformId !== undefined}
        model={session.model}
        platformId={platformReading.platformId}
        onClose={close}
        elsewhere={readings.rowsThrough}
        describe={readings.describeForMap}
        today={todayDay}
        onOpenDocumentation={(id) => requests.openDocumentation(id)}
        windowChrome={pageChrome}
      />
    </>
  )
}
