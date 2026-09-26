// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The pages beside the canvas, one at a time (`useWorkspacePages`): the
 * decisions and the observations, the roadmap and a plan on it, and a
 * platform's report and a service's.
 */
import { shownAsOf } from '../editor'
import { AdrPage } from '../decisions/ui/AdrPage'
import { ObservationsPage } from '../observations/ui/ObservationsPage'
import { PlanPage, ReplaceDialog, RoadmapPage } from '../roadmap'
import { PlatformReportPage, ServiceReportPage } from '../technology'
import type { WorkspaceParts } from './workspaceParts'

export function WorkspacePages({ parts }: { parts: WorkspaceParts }) {
  return (
    <>
      <RecordPages parts={parts} />
      <PlanPages parts={parts} />
      <ReportPages parts={parts} />
    </>
  )
}

/** A picture library as a document page takes it: the pictures, who shows each, and removing one. */
function imagesOf({ session, pictures, files }: WorkspaceParts) {
  return { library: session.imageLibrary, usedBy: pictures.imageUsedBy, onRemove: files.removeImage }
}

/** The decisions page (ADR-0012 §7) and the observations page (ADR-0021). */
function RecordPages({ parts }: { parts: WorkspaceParts }) {
  const { props, session, pages, snapshots, analysis, readings, pictures, files, readOnly, requests, pageChrome } = parts
  const { s, language, makeId } = props.shell
  const { groupName, ancestorDecisions } = props.tree
  const { onOpenScope } = props.navigation
  const { plans } = pages
  return (
    <>
      <AdrPage
        open={pages.adrPage.open}
        onClose={() => { pages.closeDecisions(); pages.leaveIfNothingToDraw() }}
        model={session.model}
        groupName={groupName}
        ancestors={ancestorDecisions}
        {...(onOpenScope ? { onOpenScope } : {})}
        onProjectDecisionsChange={analysis.onDecisionsChange}
        initialAdrId={pages.adrPage.adrId}
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
        windowChrome={pageChrome}
      />
      <ObservationsPage
        open={pages.obsPage.open}
        onClose={() => { pages.closeObservations(); pages.leaveIfNothingToDraw() }}
        model={session.model}
        groupName={groupName}
        shared={readings.sharedBelow}
        scopeLabel={readings.scopeLabel}
        absorbedAbove={readings.absorbedAbove}
        canShare={props.project.path !== ''}
        {...(onOpenScope ? { onOpenScope: (path: string) => onOpenScope(path, { page: 'observations' }) } : {})}
        onChange={analysis.onAnalysisChange}
        readOnly={readOnly}
        onDecide={readOnly ? undefined : analysis.onDecideSolution}
        onStartPlan={readOnly ? undefined : analysis.onStartSolutionPlan}
        onOpenDecision={(adrId) => { pages.closeObservations(); pages.openDecisions(adrId) }}
        onOpenPlan={(planId) => { pages.closeObservations(); plans.openPlan(planId) }}
        initialId={pages.obsPage.id}
        s={s}
        language={language}
        makeId={makeId}
        today={parts.today}
        renderMarkdown={pictures.renderDocument}
        onAddImage={files.addImage}
        images={imagesOf(parts)}
        windowChrome={pageChrome}
      />
    </>
  )
}

/** The roadmap, the replace dialog it starts from a card, and one plan over it. */
function PlanPages({ parts }: { parts: WorkspaceParts }) {
  const { props, session, pages, readings, ownership, viewing, pictures, files, readOnly, todayDay, pageChrome } = parts
  const { onOpenScope } = props.navigation
  const { plans } = pages
  const open = session.model.diagrams.find((d) => d.id === session.activeDiagramId)
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
        today={todayDay}
        readOnly={readOnly}
        actions={plans.planActions}
        renderMarkdown={pictures.renderDocument}
        onAddImage={files.addImage}
        images={imagesOf(parts)}
        onClose={plans.closePlan}
        windowChrome={pageChrome}
        initiativeToggle={props.project.path !== ''}
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
