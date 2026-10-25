// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's own pages, as a row of cards.
 *
 * Which cards depends on what the scope is by shape, never by its label, and
 * the shapes add up rather than exclude each other: the organisation — the
 * root — has the business layer, because the rail is one tree on its own page
 * (ADR-0012 §4); a scope that draws has the pages of the records on its boards
 * (the boards themselves are a table beneath, one row each); every scope has
 * its decisions and its plans; and the register is over the tree beneath a
 * scope, so it is a card wherever something is filed — a domain that draws a
 * board of its own keeps it.
 *
 * Business, decisions and the roadmap are about the scope's own document and
 * come from {@link organisationPages}, which is one read of it; the register
 * comes from the index the shell already holds (ADR-0012 §2). Neither is a
 * load of its own, which is the point: a load per card is the shape ADR-0004
 * keeps catching.
 *
 * Nothing here loads, and nothing here counts.
 */
import Box from '@mui/material/Box'
import type { ReactNode } from 'react'
import { plural } from '../../i18n/strings'
import type { Translate } from '../../i18n'
import { STATUS_LABEL as ADR_STATUS_LABEL, formatAdrNumber } from '../../decisions'
// Each from its own module: the roadmap's index names its pages, which arrive when they are opened.
import { PLAN_STATUS_LABEL } from '../../roadmap/labels'
import type { FindingTarget } from '../../roadmap/findingTarget'
import { findingWords } from '../../roadmap/ui/FindingSentence'
import { STATE_LABEL as CAUSE_STATE_LABEL } from '../../observations/observationScope'
import type { Finding } from '../../model/checks'
import { DecisionIcon, DeploymentIcon, DocumentIcon, ObservationIcon, RegisterIcon, SheetIcon, TimelineIcon } from '../../widgets/icons'
import type { OrganisationPages, StatusTally } from './organisationPages'
import type { RegisterSummary } from './register'
import type { TechnologySummary } from '../../projects/technologyRegister'
import { OperatingCard } from './OperatingCard'
import { OnePage } from './OnePage'
import type { CardAction } from './OnePage'

export type OrganisationCardsProps = {
  pages: OrganisationPages
  /** The root has been read at least once. Before that the cards say nothing. */
  ready: boolean
  /**
   * The register's own numbers (ADR-0012 §2).
   *
   * From the index rather than from a load, which is why this card can say
   * something about the WHOLE tree while the other three speak for the root's
   * own document: the index is one pass over every `model.json`, held by the
   * shell and already read.
   */
  register: RegisterSummary
  /**
   * The technology register's numbers (ADR-0014 §2.6): the same fold over the
   * same index as the register's, so the card says what the page says.
   */
  technology: TechnologySummary
  /** Plans below this scope flagged as initiatives (ADR-0012 §7): the roadmap card's second line. */
  initiatives?: number
  /**
   * Which cards, by the scope's shape and additively — a domain that also
   * draws keeps its register (`countScopes` counts it as both). The business
   * layer is the root's; the documentation is a scope's that draws, whose
   * boards are a table under the cards rather than a card; the register is
   * over what is beneath, so a scope that draws and holds nothing under it has
   * no use for it.
   */
  shows: { business: boolean; documentation: boolean; register: boolean; technology: boolean; operating: boolean }
  onOpenBusiness: () => void
  /** The enterprise map: the business card's second door (ADR-0012 §9). */
  onOpenMap: () => void
  onOpenDecisions: () => void
  /** One record on the decisions page: the newest, which the card names. */
  onOpenDecision?: (id: string) => void
  /** The observations page (ADR-0021). */
  onOpenObservations: () => void
  /** How many open observations the scopes below hold (ADR-0032 §1), off the index. */
  localObservations?: number
  onOpenRoadmap: () => void
  /** What the roadmap card's finding is about, opened as the roadmap page opens it (`findingTarget`). */
  onOpenFinding?: (target: FindingTarget) => void
  onOpenRegister: () => void
  onOpenTechnology: () => void
  /** The technology landscape: the technology card's second door (ADR-0015). */
  onOpenTechnologyLandscape: () => void
  /** The documentation page, as the bar opens it. */
  onOpenDocumentation?: () => void
  /** The operating model's page (ADR-0036), at the organisation. */
  onOpenOperating?: () => void
  /**
   * May this person change the scope? Where not, a page the scope has not been
   * given yet is not offered — *Make a sheet…* would be a write they are
   * refused — and a page it has is offered to read, as ever. Everything may be
   * made where absent.
   */
  writable?: boolean
  /** A card the screen draws itself after these: the people register's, at the root (`PeopleCard`). */
  extra?: ReactNode
  s: Translate
}

/** A way in where the card has somewhere to go, and none where it has not. */
function wayIf(onClick: (() => void) | undefined, way: Omit<CardAction, 'onClick'>): CardAction[] {
  return onClick ? [{ ...way, onClick }] : []
}

/** *Open*, said with the page's name for a reader. */
function openWay(onClick: (() => void) | undefined, name: string, testId: string, guide: string | undefined, s: Translate): CardAction[] {
  return wayIf(onClick, { label: s('picker.open'), ariaLabel: s('picker.openNamed', { name }), testId, ...(guide ? { guide } : {}) })
}

/**
 * The business card's button: *Open*, named for a reader, where there is a
 * sheet. A scope with no sheet is not missing one; it has not been given one
 * yet, and the word says which.
 */
function businessAction(hasSheet: boolean, s: Translate): { text: string; label: string | undefined } {
  return hasSheet
    ? { text: s('picker.open'), label: s('picker.openNamed', { name: s('org.business') }) }
    : { text: s('org.businessMake'), label: undefined }
}

/** The business card's ways in: the sheet, and the map, which is the same layer read the other way. */
function businessWays(pages: OrganisationPages, writable: boolean, onOpenBusiness: () => void, onOpenMap: () => void, s: Translate): CardAction[] {
  const business = businessAction(pages.business.sheetId !== undefined, s)
  const mapped = Boolean(pages.business.mapId)
  return [
    ...(pages.business.sheetId || writable ? wayIf(onOpenBusiness, { label: business.text, testId: 'open-business', guide: 'org.card.business', ...(business.label ? { ariaLabel: business.label } : {}) }) : []),
    ...(mapped || writable ? wayIf(onOpenMap, {
      label: mapped ? s('org.mapView') : s('org.mapMake'), testId: 'open-map', guide: 'org.card.map', ...(mapped ? { ariaLabel: s('org.openMap') } : {}),
    }) : []),
  ]
}

/** The decisions card's ways in: the page, and the latest decision. */
function decisionWays(pages: OrganisationPages, onOpenDecisions: () => void, onOpenDecision: ((id: string) => void) | undefined, s: Translate): CardAction[] {
  const latest = pages.decisions.latest
  return [
    ...openWay(onOpenDecisions, s('shell.decisions'), 'open-decisions', 'org.card.decisions', s),
    ...(latest && onOpenDecision ? wayIf(() => onOpenDecision(latest.id), { label: s('org.latest', { name: formatAdrNumber(latest.number) }), testId: 'open-latest-decision' }) : []),
  ]
}

/** The roadmap card's ways in: the page, and what its dates disagree about. */
function roadmapWays(pages: OrganisationPages, counted: boolean, onOpenRoadmap: () => void, onOpenFinding: ((target: FindingTarget) => void) | undefined, s: Translate): CardAction[] {
  const opens = counted ? pages.roadmap.findingOpens : undefined
  return [
    ...openWay(onOpenRoadmap, s('shell.roadmap'), 'open-roadmap', 'org.card.roadmap', s),
    ...(opens && onOpenFinding ? wayIf(() => onOpenFinding(opens), { label: s('org.openFinding'), testId: 'open-roadmap-finding' }) : []),
  ]
}

/** The technology card's ways in: the register, and the landscape, which is the same layer as a picture. */
function technologyWays(pages: OrganisationPages, writable: boolean, onOpenTechnology: () => void, onOpenLandscape: () => void, s: Translate): CardAction[] {
  const drawn = Boolean(pages.technology.landscapeId)
  return [
    ...openWay(onOpenTechnology, s('org.technology'), 'open-technology', 'org.card.technology', s),
    ...(drawn || writable ? wayIf(onOpenLandscape, {
      label: drawn ? s('org.technologyLandscapeView') : s('org.technologyLandscapeMake'), testId: 'open-technology-landscape', guide: 'org.card.landscape',
      ...(drawn ? { ariaLabel: s('org.openTechnologyLandscape') } : {}),
    }) : []),
  ]
}

/**
 * The roadmap card's finding: the worst the dates disagree about, as the
 * roadmap page says it (`findingWords`) — what it is about is the card's
 * second way in — or that they agree.
 */
function RoadmapFinding({ finding, s }: { finding: Finding | undefined; s: Translate }) {
  if (!finding) return <>{s('org.noFindings')}</>
  return <>{findingWords(finding, s)}</>
}

/** "3 accepted · 1 proposed", in the vocabulary's own order and without zeroes. */
function tallyLine<T extends string>(
  tally: StatusTally<T>, label: Record<T, Parameters<Translate>[0]>, s: Translate,
): string {
  return tally
    .map((one) => s('org.statusCount', { count: one.count, status: s(label[one.status]).toLowerCase() }))
    .join(' · ')
}

/**
 * What the observations card counts: the problems, and the bright spots apart
 * (ADR-0038 §6); the causes by state; and the root causes, with how many a
 * solution covers once there is one.
 */
function observationsLine(counts: OrganisationPages['observations'], s: Translate): string {
  const { total, bright, roots, solutions } = counts
  return [
    total > 0 || bright === 0 ? plural(s, { one: 'org.observationsOne', other: 'org.observationsOther' }, total) : '',
    bright > 0 ? plural(s, { one: 'org.brightOne', other: 'org.brightOther' }, bright) : '',
    tallyLine(counts.causes, CAUSE_STATE_LABEL, s),
    roots > 0 && solutions > 0
      ? plural(s, { one: 'solution.coverageOne', other: 'solution.coverageOther' }, roots, { count: counts.covered, total: roots })
      : roots > 0 ? plural(s, { one: 'org.rootCausesOne', other: 'org.rootCausesOther' }, roots) : '',
  ].filter(Boolean).join(' · ')
}

export function OrganisationCards({
  pages, ready, register, technology, initiatives = 0, localObservations = 0, shows, onOpenBusiness, onOpenMap, onOpenDecisions,
  onOpenDecision, onOpenObservations, onOpenRoadmap, onOpenFinding, onOpenRegister, onOpenTechnology, onOpenTechnologyLandscape,
  onOpenDocumentation, onOpenOperating, writable = true, extra, s,
}: OrganisationCardsProps) {
  // A fresh folder, and the shipped example's organisation until the sheet
  // moves up to it: one sentence on each card rather than four zeroes, which
  // read as a fault rather than as a beginning.
  const nothing = ready && pages.empty

  const businessCount = nothing ? s('org.nothingHere') : ready ? [
    plural(s, { one: 'org.journeysOne', other: 'org.journeysOther' }, pages.business.journeys),
    plural(s, { one: 'org.areasOne', other: 'org.areasOther' }, pages.business.areas),
    plural(s, { one: 'org.functionsOne', other: 'org.functionsOther' }, pages.business.functions),
    plural(s, { one: 'org.stakeholdersOne', other: 'org.stakeholdersOther' }, pages.business.stakeholders),
  ].join(' · ') : undefined

  const businessFinding = nothing || !ready
    ? undefined
    : pages.business.unmapped > 0
      ? plural(s, { one: 'org.unmappedOne', other: 'org.unmappedOther' }, pages.business.unmapped)
      : s('org.allMapped')

  return (
    // A grid rather than a wrapping row: equal columns, so six cards are two
    // rows of three the same size and left-aligned, not four and two wider ones
    // starting half a gutter in. 220 px a card: four across at the narrow
    // measure, five at the wide one, so the root's ten are two rows.
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1.5, mb: 4 }} data-testid="organisation-cards" data-guide="org.cards">
      {shows.documentation && (
        <OnePage
          icon={<DocumentIcon />}
          title={s('shell.documentation')}
          description={s('org.describeDocumentation')}
          count={ready
            ? s(pages.documentation.described === 1 ? 'org.describedOne' : 'org.describedOther', {
              count: pages.documentation.described, total: pages.documentation.elements,
            })
            : undefined}
          actions={openWay(onOpenDocumentation, s('shell.documentation'), 'open-documentation', undefined, s)}
        />
      )}

      {shows.business && <OnePage
        icon={<SheetIcon />}
        title={s('org.business')}
        description={s('org.describeBusiness')}
        count={businessCount}
        finding={businessFinding}
        actions={businessWays(pages, writable, onOpenBusiness, onOpenMap, s)}
      />}<OperatingCard shown={shows.operating} ready={ready} counts={pages.operating} onOpen={onOpenOperating} s={s} />

      <OnePage
        icon={<DecisionIcon />}
        title={s('shell.decisions')}
        description={s('org.describeDecisions')}
        count={nothing ? s('org.nothingHere') : ready
          ? [
            plural(s, { one: 'org.recordsOne', other: 'org.recordsOther' }, pages.decisions.total),
            tallyLine(pages.decisions.byStatus, ADR_STATUS_LABEL, s),
          ].filter(Boolean).join(' · ')
          : undefined}
        finding={pages.decisions.latest && s('org.latest', { name: `${formatAdrNumber(pages.decisions.latest.number)} ${pages.decisions.latest.title}` })}
        actions={decisionWays(pages, onOpenDecisions, onOpenDecision, s)}
      />

      <OnePage
        icon={<ObservationIcon />}
        title={s('shell.observations')}
        description={s('org.describeObservations')}
        count={[
          nothing ? s('org.nothingHere') : ready
            ? observationsLine(pages.observations, s)
            : '',
          // What the scopes below observed (ADR-0032 §1): local to them, and
          // off the index like the initiatives on the roadmap card.
          localObservations > 0
            ? plural(s, { one: 'org.localBelowOne', other: 'org.localBelowOther' }, localObservations)
            : '',
        ].filter(Boolean).join(' · ') || undefined}
        actions={openWay(onOpenObservations, s('shell.observations'), 'open-observations', 'org.card.observations', s)}
      />

      <OnePage
        icon={<TimelineIcon />}
        title={s('shell.roadmap')}
        description={s('org.describeRoadmap')}
        count={[
          nothing ? s('org.nothingHere') : ready
            ? [
              plural(s, { one: 'org.plansOne', other: 'org.plansOther' }, pages.roadmap.total),
              tallyLine(pages.roadmap.byStatus, PLAN_STATUS_LABEL, s),
            ].filter(Boolean).join(' · ')
            : '',
          // The domains' initiatives, which the root's roadmap draws under
          // its own plans: counted off the index, like the register's line.
          initiatives > 0
            ? plural(s, { one: 'org.initiativesOne', other: 'org.initiativesOther' }, initiatives)
            : '',
        ].filter(Boolean).join(' · ') || undefined}
        finding={nothing || !ready ? undefined : (
          <RoadmapFinding finding={pages.roadmap.finding} s={s} />
        )}
        actions={roadmapWays(pages, !nothing && ready, onOpenRoadmap, onOpenFinding, s)}
      />

      {/* The one card that is about the whole tree rather than about the
          root's own document — the register is derived over every scope
          (ADR-0012 §2), so its numbers come from the index and not from a
          load of its own. */}
      {shows.register && <OnePage
        icon={<RegisterIcon />}
        title={s('org.register')}
        description={s('org.describeRegister')}
        // The counts only: what the register disagrees about is said under
        // the cards, as sentences (`NeedsAttention`), not tallied here.
        count={[
          plural(s, { one: 'register.applicationsOne', other: 'register.applicationsOther' }, register.applications),
          plural(s, { one: 'register.ownedOne', other: 'register.ownedOther' }, register.ownedByADomain),
          plural(s, { one: 'register.outsideOne', other: 'register.outsideOther' }, register.outside),
        ].join(' · ')}
        actions={openWay(onOpenRegister, s('org.register'), 'open-register', 'org.card.register', s)}
      />}

      {/* The technology beside the applications (ADR-0014 §2.6): every
          service offered and every platform delivering one, over the whole
          tree, off the same index. */}
      {shows.technology && <OnePage
        icon={<DeploymentIcon />}
        title={s('org.technology')}
        description={s('org.describeTechnology')}
        count={[
          plural(s, { one: 'techRegister.servicesOne', other: 'techRegister.servicesOther' }, technology.services),
          plural(s, { one: 'techRegister.platformsOne', other: 'techRegister.platformsOther' }, technology.platforms),
          plural(s, { one: 'techRegister.sharedOne', other: 'techRegister.sharedOther' }, technology.shared),
        ].join(' · ')}
        actions={technologyWays(pages, writable, onOpenTechnology, onOpenTechnologyLandscape, s)}
      />}
      {extra}
    </Box>
  )
}
