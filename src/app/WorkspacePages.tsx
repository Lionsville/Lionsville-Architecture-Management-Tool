// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The pages beside the canvas, one at a time (`useWorkspacePages`): the
 * decisions and the observations, the roadmap and a plan on it, and a
 * platform's report and a service's.
 */
import { createElement, useMemo } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { shownAsOf } from '../editor'
import type { AdrPage as AdrPageShape } from '../decisions/ui/AdrPage'
import type { ObservationsPage as ObservationsPageShape } from '../observations/ui/ObservationsPage'
import type { OperatingModelPage as OperatingModelPageShape } from '../operating/ui/OperatingModelPage'
import { ROOT_SCOPE } from '../projects/scopePath'
import type { RecordLink } from '../observations/ui/ObservationsPage'
import { flattenScopes } from '../projects/scope'
import { scopeDisplayName } from '../projects/scopeLabel'
import type { PlanPage as PlanPageShape } from '../roadmap/ui/PlanPage'
import type { ReplaceDialog as ReplaceDialogShape } from '../roadmap/ui/ReplaceDialog'
import type { RoadmapPage as RoadmapPageShape } from '../roadmap/ui/RoadmapPage'
import { Crumbs } from './ShellToolbar'
import type {
  PlatformReportPage as PlatformReportShape, ServiceReportPage as ServiceReportShape,
} from '../technology/ui/ReportPage'
import { lazyPart } from '../widgets/lazyPart'
import type { WorkspaceParts } from './workspaceParts'
import type { EndedHolders as EndedHoldersShape, SlotHolders as SlotHoldersShape } from './units/EndedHolders'
import { organisationHere } from './units/organisationHere'
import { heldThroughType } from '../model/units'
import type { SlotTakeOut } from '../operating/ui/OperatingModelPage'
import { roleHoldersHere, unitCountsHere } from './units/operatingCounts'
import type {
  PlanMoves as PlanMovesShape, PlanOrganisation as PlanOrganisationShape, PlanOrganisationProps,
} from './units/PlanOrganisation'

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

/**
 * The decisions page, the roadmap and a plan on it are reached from a card, a
 * tab's menu or a link, never the first view, and a replacement starts from
 * an element's *Replace…*: each script arrives with the first of its kind
 * opened, the pages' readers, rows and dialogs with it.
 */
const AdrPage = lazyPart<ComponentProps<typeof AdrPageShape>>(
  () => import('../decisions/ui/AdrPage').then((held) => held.AdrPage), { until: (props) => props.open },
)
const RoadmapPage = lazyPart<ComponentProps<typeof RoadmapPageShape>>(
  () => import('../roadmap/ui/RoadmapPage').then((held) => held.RoadmapPage), { until: (props) => props.open },
)
const PlanPage = lazyPart<ComponentProps<typeof PlanPageShape>>(
  () => import('../roadmap/ui/PlanPage').then((held) => held.PlanPage), { until: (props) => props.open },
)
const ReplaceDialog = lazyPart<ComponentProps<typeof ReplaceDialogShape>>(
  () => import('../roadmap/ui/ReplaceDialog').then((held) => held.ReplaceDialog), { until: (props) => props.subject !== undefined },
)

/**
 * The operating model's page (ADR-0036) is reached from the organisation's
 * card, never the first view: its script, and its libraries, arrive when it
 * is first opened.
 */
const OperatingModelPage = lazyPart<ComponentProps<typeof OperatingModelPageShape>>(
  () => import('../operating/ui/OperatingModelPage').then((held) => held.OperatingModelPage), { until: (props) => props.open },
)

/**
 * What a plan does to the organisation, and what a unit type or a role that
 * ends leaves to decide (ADR-0036 §6), are drawn on a plan's page and the
 * operating model's, never the first view: their script arrives with the
 * first of them drawn.
 */
const PlanMoves = lazyPart<ComponentProps<typeof PlanMovesShape>>(
  () => import('./units/PlanOrganisation').then((held) => held.PlanMoves),
)
const PlanOrganisation = lazyPart<ComponentProps<typeof PlanOrganisationShape>>(
  () => import('./units/PlanOrganisation').then((held) => held.PlanOrganisation),
)
const EndedHolders = lazyPart<ComponentProps<typeof EndedHoldersShape>>(
  () => import('./units/EndedHolders').then((held) => held.EndedHolders),
)
const SlotHolders = lazyPart<ComponentProps<typeof SlotHoldersShape>>(
  () => import('./units/EndedHolders').then((held) => held.SlotHolders),
)

export function WorkspacePages({ parts }: { parts: WorkspaceParts }) {
  return (
    <>
      <RecordPages parts={parts} />
      <PlanPages parts={parts} />
      <ReportPages parts={parts} />
      <OperatingPages parts={parts} />
    </>
  )
}

/**
 * The operating model (ADR-0036): kept at the organisation, so it is edited
 * only where the organisation is the scope open, and read anywhere else.
 */
function OperatingPages({ parts }: { parts: WorkspaceParts }) {
  const { props, session, pages, readOnly, pageChrome, landMoves, todayDay } = parts
  const model = session.model
  const lists = useMemo(() => ({
    unitTypes: model.unitTypes ?? [], roles: model.roles ?? [],
    responsibilities: model.responsibilities ?? [], operatingRules: model.operatingRules ?? [],
  }), [model.unitTypes, model.roles, model.responsibilities, model.operatingRules])
  const page = pages.operatingPage
  // The units of each type today, across the tree with this scope's session over it: counted while the page is up, and only then.
  const scope = props.project.path
  const unitCounts = useMemo(
    () => (page.open ? unitCountsHere(props.tree.index, scope, model, todayDay) : undefined),
    [page.open, props.tree.index, scope, model, todayDay],
  )
  return (
    <OperatingModelPage
      open={page.open}
      model={lists}
      readOnly={readOnly}
      atOrganisation={props.project.path === ROOT_SCOPE}
      makeId={props.shell.makeId}
      dispatch={(command) => { session.dispatch(command) }}
      {...(page.id !== undefined ? { initialId: page.id } : {})}
      initialNonce={page.nonce}
      onClose={() => { pages.closeOperating(); pages.leaveIfNothingToDraw() }}
      windowChrome={pageChrome}
      // What a unit type or a role that ends leaves to decide (ADR-0036 §6): the organisation's, so the host's.
      aside={(item) => (item.kind === 'responsibility' ? undefined : createElement(EndedHolders, {
        item, scope: props.project.path, model, index: props.tree.index, people: props.shell.people,
        readOnly: readOnly || props.project.path !== ROOT_SCOPE, makeId: props.shell.makeId, land: landMoves, s: props.shell.s,
      }))}
      slotTakeOut={slotTakeOut(parts)}
      {...(unitCounts ? { unitCounts } : {})}
      // Who holds a role, said before it is removed (ADR-0036 §6).
      roleHolders={(roleId) => roleHoldersHere(props.tree.index, scope, model, roleId, todayDay)}
      // A library's step, taken back from its toast only while no other step has come since.
      undoStep={() => {
        const at = session.revision()
        return () => {
          if (session.revision() !== at) return false
          session.undo()
          return true
        }
      }}
    />
  )
}

/**
 * A role taken out of a unit type (ADR-0036 §6): who holds it through the
 * type from today on, read off the tree with this scope's session laid over
 * it, and — where anybody does — their moves, landed with the role taken out
 * as one step. Their last day in it is today.
 */
function slotTakeOut(parts: WorkspaceParts): SlotTakeOut {
  const { props, session, readOnly, landMoves, todayDay } = parts
  const scope = props.project.path
  return {
    held: (type, roleId) => heldThroughType(organisationHere(props.tree.index, scope, session.model).organisation, type.id, roleId, todayDay).length > 0,
    aside: (type, roleId, done) => createElement(SlotHolders, {
      type, roleId, today: todayDay, onDone: done, scope, model: session.model, index: props.tree.index, people: props.shell.people,
      readOnly: readOnly || scope !== ROOT_SCOPE, makeId: props.shell.makeId, land: landMoves, s: props.shell.s,
    }),
  }
}

/** A picture library as a document page takes it: the pictures, who shows each, and removing one. */
function imagesOf({ session, pictures, files }: WorkspaceParts) {
  return { library: session.imageLibrary, usedBy: pictures.imageUsedBy, onRemove: files.removeImage }
}

/** The decisions page (ADR-0012 §7) and the observations page (ADR-0021). */
function RecordPages({ parts }: { parts: WorkspaceParts }) {
  const { props, session, pages, snapshots, analysis, readings, pictures, files, readOnly, requests, pageChrome, changeBelow, changeAcross } = parts
  const { s, language, makeId } = props.shell
  const { groupName, ancestorDecisions, scopes } = props.tree
  const { onOpenScope, crumbs, onGoHome, onShareLink } = props.navigation
  const { plans } = pages
  const scope = props.project.path
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
        {...(onShareLink ? { onCopyLink: (id: string) => onShareLink({ scope, page: 'decisions', id }) } : {})}
        onOpenSolution={(solutionId) => { pages.closeDecisions(); pages.openObservations(solutionId) }}
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
        {...(onShareLink ? { onCopyLink: (to: RecordLink) => onShareLink({ ...to, scope: to.scope ?? scope, page: 'observations' }) } : {})}
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
  const { onOpenScope, onShareLink } = props.navigation
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
        onCopyLink={onShareLink && plans.planId !== undefined ? () => onShareLink({ scope: props.project.path, page: 'plan', id: plans.planId! }) : undefined}
        windowChrome={pageChrome}
        initiativeToggle={props.project.path !== ''}
        describe={readings.describeForMap}
        {...(plans.plan ? { organisation: planOrganisation(parts, plans.plan) } : {})}
      />
    </>
  )
}

/** What a plan does to the organisation (ADR-0036 §6), drawn here because all of it is the organisation's. */
function planOrganisation(parts: WorkspaceParts, plan: NonNullable<WorkspaceParts['pages']['plans']['plan']>): { facts: ReactNode; main: ReactNode } {
  const { props, session, readOnly, readings, landMoves, showElement, pages } = parts
  const shared: PlanOrganisationProps = {
    plan, scope: props.project.path, model: session.model, index: props.tree.index, people: props.shell.people, readOnly,
    dispatch: session.dispatch, makeId: props.shell.makeId, land: landMoves, scopeLabel: readings.scopeLabel, s: props.shell.s,
    // A unit a finding is about, wherever it is kept: the plan's page closes on the way.
    onOpenElement: (id) => showElement.show(id, pages.plans.closePlan),
  }
  return { facts: createElement(PlanMoves, shared), main: createElement(PlanOrganisation, shared) }
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
