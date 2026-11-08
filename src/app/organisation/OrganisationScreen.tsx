// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's home. The root's is the first screen: the organisation's.
 *
 * Not a list of projects. The picker this replaces asked "which document do you
 * want to be in", which was the right question while a project was the only
 * thing that could hold anything; since format 5 every scope is the same
 * document, nested (ADR-0012 §1) — it has a name, a client, links, a
 * description, decisions, plans and a business architecture of its own — and a
 * screen that listed what is filed *under* it while showing none of that was
 * describing the folder rather than the organisation.
 *
 * So: the scope's identity at the top, its own pages as cards, the tree filed
 * under it, and — at the root, while it is empty — the examples last and
 * small. **Every scope has this home**, because every scope is the same
 * document: a domain's is reached from a crumb on the bar or from its row in
 * the tree, and shows the same things one level down. The scope is never a row
 * in its own tree.
 *
 * **What may be written is asked, per scope** (`writable`). A store that
 * refuses every write says so in the standing notice the shell draws along the
 * bottom; a source that lets a person read one scope and write another is
 * asked about each, the way the workspace is asked about the scope it opens.
 * A scope the person may only read offers nothing that writes — no *Make…*,
 * no new board or scope, no settings, no removal — and still opens every page
 * it has, to read.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import Box from '@mui/material/Box'
import { plural } from '../../i18n/strings'
import type { Language, StringKey, Translate } from '../../i18n'
import { countScopeKinds, countScopeTypes, flattenScopes, isOpenableScope, newestChange, sortScopes } from '../../projects/scope'
import type { ProjectOrder, ScopeSummary } from '../../projects/scope'
import type { ElementId } from '../../model'
import type { PlatformTree } from '../../model/hosting'
import type { KeptCheckMark } from '../../model/checkMarks'
import type { Finding } from '../../projects/checks'
import { isWithinScope, parentScope, ROOT_SCOPE, scopePathLabel } from '../../projects/scopePath'
import { scopeDisplayName } from '../../projects/scopeLabel'
import type { ScopePath } from '../../projects/scopePath'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import type { WorkingSource } from '../../platform/workingSource'
import type { Page } from '../../agent/screen'
import type { InitialPage } from '../App'
import type { SourceSayings } from '../appProps'
import type { SourceChip, SourceWayIn } from '../../platform/sourceProvider'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { TextField, TextInput } from '../../widgets/kit/Field'
import { MenuButton, MoreMenu } from '../../widgets/kit/Menu'
import type { MenuAct } from '../../widgets/kit/Menu'
import { LinkLine, PageHead } from '../../widgets/kit/Section'
import type { ExampleOffer } from '../../projects/examples/catalogue'
import { useFrameFacts } from '../frame/frameStore'
import type { ScreenFacts } from '../frame/frameStore'
import { MORE_PLACES, ORGANISATION_PLACES, SCOPE_PLACES } from '../frame/places'
import type { RecentPlace } from '../frame/recentPlaces'
import { NewScopeDialog } from './NewScopeDialog'
import type { NewScopeDialogProps } from './NewScopeDialog'
import { registerSummary, registerWithin } from './register'
import type { RegisterRow } from './register'
import { HomeRecords } from './HomeRecords'
import type { HomeStore } from './HomeRecords'
import { RelevantTopics } from './RelevantTopics'
import type { ScopePrinciples } from '../../projects/scopeIndex'
import type { PeopleAccess } from './usePeopleRegister'
import type { OrgPage, OrgPageRequest } from '../useShellAgent'
import { renderMarkdown } from '../../documentation/ui/renderMarkdown'
import { technologySummary, technologyWithin } from '../../projects/technologyRegister'
import type { TechnologyRow } from '../../projects/technologyRegister'
import { ChecksLine } from './NeedsAttention'
import { HomePages } from './HomePages'
import { firstOfWeight } from './treeChecks'
import { useHomeChecks } from './useHomeChecks'
import type { TreeRead } from './useHomeChecks'
import { useHomePages } from './useHomePages'
import { organisationPages } from './organisationPages'
import { SCOPE_KIND_COUNT, scopeTypeLabel } from './scopeKinds'
import type { ScopeSettingsPage as ScopeSettingsPageShape, SettingsUndo } from './ScopeSettingsPage'
import { lazyPart } from '../../widgets/lazyPart'
import { arrivingPage } from '../../widgets/Arriving'
import { HomeSearch } from './HomeSearch'
import { ServedBy } from './ServedBy'
import type { ServedByAccess } from './useServedBy'
import type { Organisation } from './useOrganisation'
import type { FrameStep } from '../frame/frameStore'
import { holdingsOf } from './holdings'
import { newViewChoices } from './newViewChoices'
import { homeMeta, ScopeHome } from './ScopeHome'
import { FirstChoices, NamedNothingYet } from './HomeFirstRun'
import { DELETE_VIEW_BODY } from '../dialogs/deleteViewBody'
import { RenameDiagramDialog } from '../../editor/RenameDiagramDialog'

/** A scope's settings arrive the first time they are asked for. */
const ScopeSettingsPage = lazyPart<ComponentProps<typeof ScopeSettingsPageShape>>(
  () => import('./ScopeSettingsPage').then((held) => held.ScopeSettingsPage), { until: (props) => props.open, fallback: arrivingPage },
)

export type OrganisationScreenProps = {
  organisation: Organisation
  examples: readonly ExampleOffer[]
  /** The example as a place to visit; absent where this build cannot, and the offer is not made. */
  onVisitExample?: (offer: ExampleOffer) => void
  /** Make a link to this scope, and say it. */
  onShareScope?: (scope: ScopePath) => void
  /** *Copy link* to a topic, from its ⋯ in the catalogue. */
  onShareTopic?: (topic: ScopePath) => void
  order: ProjectOrder
  onOrderChange: (order: ProjectOrder) => void
  /**
   * Where the scopes are kept, said the way the workspace's bar used to say it.
   * Shown on the root's home only — it is a fact about the folder, and the
   * folder is the root. Absent folder controls in a browser tab whose browser
   * cannot give one: a button that cannot work is worse than no button.
   */
  source?: WorkingSource
  /**
   * The sentence the source's own provider gives for where work is kept, as the
   * key of its own string (`platform/sourceProvider.ts`'s `describeKey`).
   *
   * Read in two places on this screen: the chip that names the source says it
   * when you hover it, and the subtitle under the heading says it to everybody.
   * There is one per built-in kind because this tree knows what a folder and a
   * browser's storage cost you. For a registered source only the provider
   * knows, so this is its answer — and where it has none both places say
   * nothing at all rather than a sentence of ours about somewhere this shell
   * has never heard of.
   */
  sourceDescription?: StringKey | (string & {})
  /** The source's provider's sentences: what the chip calls it, where everything is kept, what removing takes. */
  sourceSayings?: SourceSayings
  /**
   * What that provider calls the chip right now, and what pressing it does
   * (`platform/sourceProvider.ts`'s `chip`).
   *
   * The name a registered source was opened under is the one it was given at the
   * handshake; who is signed in to it is an answer that arrives after it and
   * moves again while the window is open, so the chip is the provider's word and
   * not a fact this screen keeps. `App` re-reads it when the provider says so.
   *
   * Absent for the three that ship and for a provider that gave none, and then
   * the chip is the fact it always was.
   */
  sourceChip?: SourceChip
  /**
   * What pressing the chip opens, drawn under it (`ShellToolbar`'s
   * `ToolbarChip`). Where a provider gave this or its own `sourceChip`, the
   * chip is on every scope's home and not the organisation's alone.
   */
  chipPanel?: (close: () => void) => ReactNode
  /** A page of the open source's provider's own, drawn over this home (`SourcePageEntry`). */
  sourcePage?: ((page: string, onClose: () => void) => ReactNode) | undefined
  /**
   * What the chip looks like, where the provider drew it a face (`ToolbarChip`'s
   * `face`). Like a word or a panel of the provider's own, it puts the chip on
   * every scope's home.
   */
  chipFace?: (open: boolean, fallback: ReactNode) => ReactNode
  /**
   * The places this build can work from, one button each, as each provider
   * says it here: where one answers for the source that is open, what it
   * offers from there — another of its kind — rather than where the person
   * already is.
   *
   * On the root's home only, for the same reason the source chip is: where
   * work is kept is a fact about the whole tree and is said once, where the
   * tree begins.
   */
  waysIn?: readonly SourceWayIn[]
  /**
   * The open source publishes its steps (`Shell.publishesSteps`): the work stays
   * where it is kept, so the ways to work from somewhere else are a rare act,
   * under ⋯, and not the first press on the home.
   */
  publishesSteps?: boolean
  /**
   * Go to another scope's home: a crumb on the bar, or a row's name. The
   * shell's, because which home is up is the shell's state — the same as
   * which scope is open.
   */
  onGoHome: (path: ScopePath) => void
  /**
   * What the tree contradicts about itself, by scope (ADR-0012 §9).
   *
   * Handed in already worked out, because the index behind it belongs to the
   * shell and outlives this screen — and because one fold over the
   * organisation serves every row. Absent means nothing has been read yet, and
   * a row then says nothing about findings rather than saying there are none.
   */
  findings?: ReadonlyMap<ScopePath, readonly Finding[]>
  /** The tree's findings marked as intended (`ScopeIndex.checkMarks`), which the counts and the Checks page leave out. */
  checkMarks?: readonly KeptCheckMark[]
  /**
   * The index and the scopes' records it was built from, for the findings
   * only they say: every scope's dates, and the Conway map over the home.
   * Absent: those are not counted.
   */
  treeRead?: TreeRead
  /**
   * The register, derived over the whole tree (ADR-0012 §2).
   *
   * Handed in for the same reason the findings are: the index behind it
   * belongs to the shell and outlives this screen, and one pass over it serves
   * the card and the page alike. A domain's home shows the part that is the
   * domain's business (`registerWithin`). Empty means nothing has been read
   * yet, which on this screen is the same as an organisation with no
   * applications in it — and the page says so in a sentence either way.
   */
  register?: readonly RegisterRow[]
  /**
   * The technology register (ADR-0014 §2.6): every service and platform in
   * the tree, off the same index and handed in for the same reason.
   */
  technology?: readonly TechnologyRow[]
  /** How many plans below the root are initiatives (ADR-0012 §7), off the same index. */
  initiatives?: number
  /** How many open observations the scopes below hold (ADR-0032 §1), off the same index. */
  localObservations?: number
  /**
   * The platform tree off the same index (`platformTree.ts`), so the roadmap
   * card's finding is the one the roadmap page puts first.
   */
  platformTree?: PlatformTree
  /** The functions the scopes below took up (ADR-0040 §6), off the same index: the card's count leaves them out. */
  takenUp?: ReadonlySet<ElementId>
  /** Open a row where it is answered for, with the element selected. */
  onOpenRegisterRow?: (scope: ScopePath, id: ElementId) => void
  /** Open a row's page — the record and its document — where it is answered for. */
  onOpenRegisterPage?: (scope: ScopePath, id: ElementId) => void
  /**
   * One of this screen's two pages asked for, or the home itself with neither
   * over it (`home`) — by an agent, a provider or Back (ADR-0019, ADR-0033). A
   * request with a nonce, because the same page asked for twice is two
   * requests and a prop that did not change is none.
   */
  pageRequest?: OrgPageRequest
  /** Which of the pages is up, whenever that changes — so the shell can say where the app is. */
  onPageChange?: (page: OrgPage | undefined, record?: string) => void
  /**
   * The people register (ADR-0036): its card on the root's home and its page
   * over any home, where the source keeps one.
   */
  people?: PeopleAccess
  /**
   * Who serves each scope (ADR-0036, amended 11 October 2026): *Served by* on
   * the home and in the settings, off the shell's index, and its two edits.
   * Absent where the shell has no index to read it from.
   */
  servedBy?: ServedByAccess
  /** Resolve a conflict: open the scope that should yield, with *link* pending. */
  onLinkFromRegister?: (scope: ScopePath, id: ElementId, to: ScopePath) => void
  /**
   * May this person change the scope at this path? Asked per scope, because
   * a source can let somebody write one domain and only read the next. Every
   * scope may be written where absent, which is every source that ships.
   */
  writable?: (path: ScopePath) => boolean
  /** Each scope's principles, off the shell's index (ADR-0041): what the *Principles* card counts. */
  principlesAt?: (path: ScopePath) => ScopePrinciples
  /** Where the topics are written (ADR-0042): the card, the catalogue and *Relevant topics*, where the shell keeps one. */
  topics?: HomeStore
  /** Where this person worked last, on this computer, for *Continue*; and going back there. */
  recent?: readonly RecentPlace[]
  onContinue?: (place: RecentPlace) => void
  /** Open a working file somebody gave you, the File menu's way. Absent: not offered. */
  onOpenFile?: () => void
  /** The day, injected so a card's finding is not at the mercy of the clock. */
  today: string
  language: Language
  s: Translate
  windowChrome?: WindowChrome
}

export function OrganisationScreen({
  organisation, examples, onVisitExample, onShareScope, onShareTopic, order, sourceDescription, sourceSayings = {}, sourcePage,
  waysIn, publishesSteps,
  onGoHome, findings, register = [], technology = [], initiatives = 0, localObservations = 0, platformTree, takenUp,
  onOpenRegisterRow, onOpenRegisterPage, onLinkFromRegister, pageRequest, onPageChange, people, servedBy,
  writable = ANYWHERE, today, language, s, windowChrome = NO_WINDOW_CHROME, checkMarks, treeRead, principlesAt, topics,
  recent, onContinue, onOpenFile,
}: OrganisationScreenProps) {
  const { tree, at, root, ready } = organisation
  const mayWrite = writable(at)
  /** Which of this screen's pages is up over its home, one at a time, and what it was asked to pick (`useHomePages`). */
  const homePages = useHomePages(pageRequest, onPageChange)
  /** What the settings page can take back, which the frame's undo offers while it is up. */
  const [settingsUndo, setSettingsUndo] = useState<SettingsUndo | undefined>(undefined)
  const searchDoor = useRef<() => void>(() => undefined)
  const pageChrome = useMemo<WindowChrome>(() => ({ ...windowChrome, topInset: 0 }), [windowChrome])

  /**
   * The scope whose home this is, out of the listing. The root is the listing
   * itself; a scope beneath it is its subtree. One that the listing no longer
   * has — removed underneath us — reads as the root until the shell notices,
   * which is the next render.
   */
  const home = useMemo<ScopeSummary>(
    () => flattenScopes(tree).find((scope) => scope.path === at) ?? tree,
    [tree, at],
  )
  const atRoot = home.path === ROOT_SCOPE

  /** The whole tree in the frame tree's order, for the dialogs' *filed under* selects. */
  const orderedTree = useMemo<ScopeSummary>(
    () => ({ ...tree, children: sortScopes(tree.children, order) }),
    [tree, order],
  )
  const pages = useMemo(() => organisationPages(root, today, platformTree, takenUp), [root, today, platformTree, takenUp])
  const registerHere = useMemo(() => registerWithin(register, at), [register, at])
  const registerCounts = useMemo(() => registerSummary(registerHere), [registerHere])
  const technologyHere = useMemo(() => technologyWithin(technology, at), [technology, at])
  const technologyCounts = useMemo(() => technologySummary(technologyHere), [technologyHere])
  const { typeLines, unitTypes, typeName, typeLink } = useScopeTypes(home, servedBy, s)
  const changed = useMemo(() => newestChange(home), [home])
  const holdings = useMemo(() => holdingsOf(tree, treeRead?.models ?? []), [tree, treeRead])
  /**
   * What to call a scope a finding names: its name where the tree has one,
   * the word for the organisation at the root. The screen's vocabulary, so
   * the sentence builder is handed it rather than knowing it.
   */
  const everyScope = useMemo(() => flattenScopes(tree), [tree])
  const scopeName = useMemo(
    () => (path: ScopePath) => (path === ROOT_SCOPE
      ? s('common.organisation')
      : scopeDisplayName(path, everyScope, s('common.organisation'))),
    [everyScope, s],
  )
  /**
   * What the checks find at or under this home (ADR-0012 §9; ADR-0036, amended): off what the shell already holds —
   * the tree's findings, the technology rows, every scope's dates, the Conway map over the home and, at the organisation,
   * the operating model's own — counted on the home's Checks line and listed on the Checks page.
   */
  const checks = useHomeChecks({ findings, register, technology, at, root, tree: treeRead, marks: checkMarks, people, platformTree, today, scopeName, s })

  /**
   * Does this scope have a canvas? Off its own document, which is read for the
   * rows anyway: the listing counts views, and a sheet is a view that is laid
   * out rather than drawn (§6).
   */
  const draws = ready && isOpenableScope(root) && root.path === at
  const named = home.name.trim().length > 0
  const heading = home.name.trim() || (atRoot ? s('picker.organisation') : scopePathLabel(home.path))
  /**
   * What the registers call a scope — *Kept in*, *Drawn in*, the scope a
   * finding names: its own name out of the listing, and the organisation's
   * heading at the root. Never its path.
   */
  const rootName = tree.name.trim() || s('picker.organisation')
  const registerScopeName = useCallback((path: ScopePath) => scopeDisplayName(path, everyScope, rootName), [everyScope, rootName])
  const closePagesAndGoHome = (path: ScopePath) => { homePages.close(); onGoHome(path) }
  const typeWord = scopeTypeLabel({ kind: home.kind ?? (atRoot ? 'organisation' : draws ? 'landscape' : 'domain'), unitTypeId: home.unitTypeId }, typeName, s)
  const newView = newViewChoices(s, () => organisation.addBoard(at), (kind) => organisation.open(at, { page: 'make', kind }))
  const unread = (tree.unreadable ?? []).filter((path) => isWithinScope(path, at) && (path !== at || at === ROOT_SCOPE))
  // Nothing kept, nothing filed and nothing unread: the first screen a new place opens on.
  const empty = atRoot && organisation.listed && holdsNothing(tree) && ready && pages.empty && holdings.count(ROOT_SCOPE) === 0
  const firstRun = empty && !named && mayWrite
  const goPlace = (page: Page) => {
    if (isHomePage(page)) homePages.open(page)
    else organisation.open(ROOT_SCOPE, { page } as InitialPage)
  }
  const head = (bare: boolean) => (
    <>
              <PageHead
                title={named || !atRoot || !mayWrite || !ready || !organisation.listed ? heading : <NameTheOrganisation onName={organisation.nameOrganisation} s={s} />}
                {...(named || !atRoot || !mayWrite ? { titleTestId: 'organisation-name' } : {})} metaTestId="organisation-meta" metaTitle={typeLines.join(' · ')}
                meta={[homeMeta(home, tree, typeWord, changed, language, s), mayWrite ? '' : s('org.readOnlyHere')].filter(Boolean).join('. ')}
                actions={(
                  <HomeActions
                    bare={bare} writable={mayWrite} settingsAllowed={writable(home.path)} newView={newView}
                    onNewScope={() => organisation.addUnder(at)} onSettings={() => homePages.open('settings')}
                    waysIn={atRoot ? waysIn : undefined} waysFolded={publishesSteps === true} s={s}
                  />
                )}
              >
                {home.description && <div className="kit-pageline" data-testid="organisation-description">{renderMarkdown(home.description)}</div>}
              </PageHead>
              {home.links && home.links.length > 0 && (
                <p className="kit-factline">
                  {home.links.map((link) => (
                    // `noopener` because the opened page gets a handle on this window otherwise, and the address came from a file that may have been written by somebody else.
                    <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="kit-linkline__link">{link.label}</a>
                  ))}
                </p>
              )}
              {/* Who serves this scope (ADR-0036, amended): the units whose domains name it, written where each unit is kept. */}
              <ServedBy scope={at} servedBy={servedBy} scopeName={scopeName} s={s} />
              <RelevantTopics at={at} />
              <ChecksLine
                counts={checks.counts} shown={checks.split.shown} onOpen={(weight) => homePages.open('checks', firstOfWeight(checks.rows, weight))}
                onPage={() => homePages.open('checks')} s={s}
              />
    </>
  )
  return (
    <HomeRecords
      store={topics} tree={tree} principlesAt={principlesAt} writable={writable} today={today} open={organisation.open} goHome={closePagesAndGoHome}
      openCatalogue={(topic) => homePages.open('topics', topic)} openBlock={(block, evaluation) => homePages.open('blocks', block, evaluation)} s={s} copyLink={onShareTopic}
    >
    <Box sx={{ flex: '1 1 auto', minHeight: 0, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <HomeFacts
        kind="home" path={home.path} name={heading} openSearch={() => searchDoor.current()} typeLink={typeLink} bare={firstRun}
        bands={unread.length > 0 ? [unreadBand(unread, organisation.refresh, s)] : []}
        {...(writable(home.path) ? { onNewView: () => organisation.addBoard(at) } : {})}
        {...undoOf(settingsUndo, organisation.viewUndo)}
        {...(root && root.path === at ? { views: root.model.diagrams } : {})}
      />
      <HomeSearch
        at={home.path} tree={tree} root={root} treeRead={treeRead} onOpen={organisation.open} onOpenPerson={(person) => homePages.open('people', person)}
        searchRef={(open) => { searchDoor.current = open }} s={s}
      />
      <Box inert={homePages.openPage !== undefined} sx={{ flex: 1, overflowY: 'auto' }}>
        {firstRun
          ? (
            <FirstChoices
              examples={examples} waysIn={waysIn ?? []} onName={organisation.nameOrganisation} onVisit={onVisitExample}
              onOpenFile={onOpenFile} where={whereSaid(sourceSayings, sourceDescription, s)}
              places={[...SCOPE_PLACES, ...ORGANISATION_PLACES, ...MORE_PLACES]} goPlace={goPlace} s={s}
            />
          )
          : (
            <div className="kit-page">
              {empty && named
                ? (
                  <>{head(true)}<NamedNothingYet
                    writable={mayWrite} newView={newView} onNewScope={() => organisation.addUnder(at)} where={whereSaid(sourceSayings, sourceDescription, s)}
                    onObservation={() => organisation.open(at, { page: 'observations' })} onOperating={() => organisation.open(ROOT_SCOPE, { page: 'operating' })}
                    s={s}
                  /></>
                )
                : (
                  <ScopeHome
                    head={head} at={at} atRoot={atRoot} home={home} tree={tree} views={root && root.path === at ? root.model.diagrams : []} pages={pages}
                    ready={atRoot ? organisation.listed && ready : ready} draws={draws} writable={mayWrite} localObservations={localObservations} initiatives={initiatives}
                    register={registerCounts} technology={technologyCounts} principlesAt={principlesAt} holdings={holdings}
                    open={organisation.open} onGoHome={onGoHome} onHomePage={(page) => homePages.open(page)} onFinding={(target) => organisation.open(at, target)}
                    onDeleteView={(view) => organisation.askDeleteView(at, view)} onRenameView={(view) => organisation.askRenameView(at, view)} onNewView={newView}
                    {...(mayWrite ? { onNewScope: () => organisation.addUnder(at) } : {})}
                    {...(recent ? { recent } : {})} onContinue={onContinue} today={today} language={language} s={s}
                  />
                )}
              {/* For a place with nothing filed in it. Once the organisation holds a view or a scope, an offer to copy one in beside the real work is a way to file an example under it by accident. */}
              {atRoot && mayWrite && onVisitExample && organisation.listed && ready && holdsNothing(tree) && (
                <LinkLine
                  label={s('org.firstExample')}
                  links={examples.map((one) => ({ label: one.label, title: one.description, onPress: () => onVisitExample?.(one), 'data-testid': 'open-example' }))}
                />
              )}
            </div>
          )}
      </Box>

      <ScopeSettingsPage
        open={homePages.openPage === 'settings'} onClose={homePages.close} target={home} document={root} tree={orderedTree} field={fieldAsked(homePages.asked)}
        readOnly={!writable(home.path)} unitTypes={unitTypes} s={s} onUndoChange={setSettingsUndo}
        onApply={organisation.applySettings}
        {...(aboveClient(home, everyScope) ? { aboveClient: aboveClient(home, everyScope) } : {})}
        {...(onShareScope ? { onCopyLink: () => onShareScope(home.path) } : {})}
        {...(atRoot ? {} : { onDelete: () => organisation.askDelete(home) })}
        servedBy={<ServedBy scope={home.path} servedBy={servedBy} scopeName={scopeName} compact s={s} />}
      />
      <HomePages
        sourcePage={sourcePage} pages={homePages} at={at} register={registerHere} technology={technologyHere} registerScopeName={registerScopeName} everyScope={everyScope} treeRead={treeRead} today={today} language={language} topics={topics}
        scopeName={scopeName} checks={checks} people={people} readOnly={!mayWrite} open={organisation.open} onHome={onGoHome}
        onOpenRow={onOpenRegisterRow} onOpenRowPage={onOpenRegisterPage} onLink={onLinkFromRegister} s={s} windowChrome={pageChrome} ready={ready}
      />
      <HomeDialogs organisation={organisation} at={at} tree={orderedTree} unitTypes={unitTypes} servedBy={servedBy} sourceSayings={sourceSayings} s={s} />
    </Box>
    </HomeRecords>
  )
}

/** The questions a home asks, each up while the organisation's dialog says so. */
function HomeDialogs({ organisation, at, tree, unitTypes, servedBy, sourceSayings, s }: {
  organisation: Organisation
  at: ScopePath
  /** The whole tree in the frame tree's order, for the *filed under* selects. */
  tree: ScopeSummary
  unitTypes: readonly { id: string; name: string }[]
  servedBy: ServedByAccess | undefined
  sourceSayings: SourceSayings
  s: Translate
}) {
  const { dialog } = organisation
  return (
    <>
      <NewScopeDialog
        open={dialog.kind === 'newScope'}
        tree={tree}
        parent={dialog.kind === 'newScope' ? dialog.parent : at}
        name={dialog.kind === 'newScope' ? dialog.name : ''}
        withBoard={dialog.kind === 'newScope' ? dialog.withBoard : false}
        type={dialog.kind === 'newScope' ? dialog.type : ''}
        unitTypes={unitTypes}
        onParentChange={organisation.setNewScopeParent}
        onNameChange={organisation.setNewScopeName}
        onWithBoardChange={organisation.setNewScopeWithBoard}
        onTypeChange={organisation.setNewScopeType}
        onCancel={organisation.closeDialog}
        {...newScopeServing(organisation, servedBy)}
        s={s}
      />
      <NewBoardDialog
        open={dialog.kind === 'newBoard'}
        name={dialog.kind === 'newBoard' ? dialog.name : ''}
        onNameChange={organisation.setNewBoardName}
        onCancel={organisation.closeDialog}
        onCreate={organisation.createBoard}
        s={s}
      />
      <ConfirmDialog
        open={dialog.kind === 'delete'}
        title={s('picker.deleteTitle', { name: dialog.kind === 'delete' ? dialog.target.name : '' })}
        // What goes, said in full, in the words of where it is kept.
        body={s(removeKeyOf(sourceSayings), { name: dialog.kind === 'delete' ? dialog.target.name : '' })}
        confirmLabel={s('common.delete')}
        cancelLabel={s('common.cancel')}
        onCancel={organisation.closeDialog}
        onConfirm={organisation.confirmDelete}
      />
      <HomeViewDialogs organisation={organisation} s={s} />
    </>
  )
}

/** What row one's undo takes back on a home: the settings page's newest change while it is up, else a view's change from its row. */
function undoOf(settings: SettingsUndo | undefined, view: FrameStep | undefined): { undo?: FrameStep } {
  if (settings) return { undo: { can: true, run: settings.run, name: settings.name } }
  return view ? { undo: view } : {}
}

/** A view deleted or renamed from its row: the question, said of its kind, and the name. */
function HomeViewDialogs({ organisation, s }: { organisation: Organisation; s: Translate }) {
  const asked = organisation.viewDialog
  return (
    <>
      <ConfirmDialog
        open={asked.kind === 'delete'}
        title={s('shell.deleteDiagramTitle', { name: asked.kind === 'delete' ? asked.view.name : '' })}
        // What goes with it, said of the kind of view it is.
        body={s(DELETE_VIEW_BODY[asked.kind === 'delete' ? asked.view.kind : 'layer7'])}
        confirmLabel={s('common.delete')}
        cancelLabel={s('common.cancel')}
        onCancel={organisation.closeViewDialog}
        onConfirm={organisation.confirmDeleteView}
      />
      <RenameDiagramDialog
        {...(asked.kind === 'rename' ? { target: asked.view } : {})}
        onRename={(_id, name) => organisation.renameView(name)} onClose={organisation.closeViewDialog}
      />
    </>
  )
}

/** Whether a place of the frame is one this screen draws over its home, rather than a scope's own page. */
/** The field the settings page was asked to land on, where it was: *Move to…*'s Filed under. */
function fieldAsked(asked: OrgPageRequest | undefined): { name: string; nonce: number } | undefined {
  return asked?.page === 'settings' && asked.field !== undefined ? { name: asked.field, nonce: asked.nonce } : undefined
}

function isHomePage(page: Page): page is OrgPage {
  return ['register', 'technologyRegister', 'people', 'checks', 'topics', 'blocks'].includes(page)
}

/** What an exported picture names where this scope says nothing: the nearest client or name above it. */
function aboveClient(home: ScopeSummary, every: readonly ScopeSummary[]): string | undefined {
  let at = parentScope(home.path)
  while (at !== undefined) {
    const held = every.find((scope) => scope.path === at)
    if (held?.client?.trim() || held?.name.trim()) return held.client?.trim() || held.name.trim()
    at = parentScope(at)
  }
  return undefined
}

/** Every scope may be written: what a screen is told by every source that ships. */
const ANYWHERE = () => true

/**
 * What to call the board. One field, filled in with the usual name, so Enter
 * on the untouched dialog is the common case and a renamed one is a tab's
 * rename made a moment earlier.
 */
function NewBoardDialog({ open, name, onNameChange, onCancel, onCreate, s }: {
  open: boolean
  name: string
  onNameChange: (name: string) => void
  onCancel: () => void
  onCreate: () => void
  s: Translate
}) {
  const ready = name.trim().length > 0
  return (
    <Dialog
      open={open} title={s('org.newLandscapeTitle')} onClose={onCancel} onSubmit={() => { if (ready) onCreate() }}
      actions={{
        cancel: { onClick: onCancel, label: s('common.cancel') },
        outcome: { reason: ready ? undefined : s('picker.nameFirst'), onClick: onCreate, label: s('picker.create') },
      }}
    >
      {open && <TextField autoFocus label={s('org.boardName')} value={name} onChange={onNameChange} />}
    </Dialog>
  )
}

/**
 * The subtitle's first sentence: where work is kept, in the source's
 * provider's own sentence — the one it gave for here, or its sentence about
 * the chip — whole rather than folded into a clause of ours —
 * a sentence about somewhere this shell has never heard of is the provider's
 * to write. Where it gave none the sentence is dropped and the subtitle says
 * what it can say truthfully: what a domain and a landscape below are.
 */
function whereSaid(sayings: SourceSayings, describeKey: StringKey | (string & {}) | undefined, s: Translate): string {
  const whereKey = sayings.whereKey ?? describeKey
  return whereKey === undefined ? '' : s(whereKey as StringKey)
}

/** What removing a scope takes with it here: the provider's sentence, or ours, which names no place. */
function removeKeyOf(sayings: SourceSayings): StringKey {
  return (sayings.removeKey ?? 'picker.deleteBody') as StringKey
}

/**
 * Is this folder known to hold nothing — no scope, no board, and nothing the
 * listing could not read? What the examples are offered for.
 */
function holdsNothing(tree: ScopeSummary): boolean {
  return tree.children.length === 0 && tree.diagrams === 0 && !tree.unreadable?.length
}

/**
 * What the listing could not read under this home, as a band with a way to try
 * again (`ScopeSummary.unreadable`, ADR-0028 amended). A scope that is missing
 * without a word is one a person goes looking for, or creates again; the tree
 * shows each as a row that says *not read*.
 */
function unreadBand(here: readonly ScopePath[], tryAgain: () => void, s: Translate) {
  return {
    id: 'unreadable', tone: 'finding' as const,
    title: <span data-testid="organisation-unreadable">{here.includes(ROOT_SCOPE)
      ? s('org.unreadableRoot')
      : plural(s, { one: 'org.unreadableOne', other: 'org.unreadableOther' }, here.length, { paths: here.join(', ') })}</span>,
    action: <Button size="small" onClick={tryAgain}>{s('common.tryAgain')}</Button>,
  }
}

/** A home's facts for the frame, as a component so the hook sits beside the rest of this screen's drawing. */
function HomeFacts(facts: ScreenFacts) {
  useFrameFacts(facts)
  return null
}

/**
 * A home's acts: a new view, a new scope filed here and its settings, and at the
 * root where work is kept and the ways to work from somewhere else. A scope
 * holding nothing has its first steps on its page, so only its settings stay
 * up here; each is simply not there for somebody who may only read.
 */
function HomeActions({
  writable, settingsAllowed, newView, onNewScope, onSettings, bare, waysIn = [], waysFolded = false, s,
}: {
  writable: boolean
  settingsAllowed: boolean
  newView: Parameters<typeof MenuButton>[0]['items']
  onNewScope: () => void
  onSettings: () => void
  bare: boolean
  waysIn?: readonly SourceWayIn[] | undefined
  waysFolded?: boolean
  s: Translate
}) {
  const steps = writable && !bare
  const elsewhere = waysIn.map((way): MenuAct => ({ label: s(way.labelKey as StringKey), onSelect: way.onConnect, 'data-testid': `connect-source-${way.kind}` }))
  return (
    <>
      {!waysFolded && waysIn.map((way) => (
        // The provider's key, from its own table or from this one's (`i18n/registerStrings`); the shell only renders it.
        <Button key={way.kind} variant="quiet" size="small" data-testid={`connect-source-${way.kind}`} onClick={way.onConnect}>{s(way.labelKey as StringKey)}</Button>
      ))}
      {steps && <MenuButton label={s('org.newBoard')} items={newView} data-guide="org.newBoard" data-testid="new-board" />}
      {/* The one way to a new scope from a home that has something to show, filed where it is. */}
      {steps && <Button data-testid="new-scope" data-guide="org.newScope" onClick={onNewScope}>{s('picker.newScope')}</Button>}
      {settingsAllowed && <Button variant="quiet" data-testid="scope-settings" onClick={onSettings}>{s('group.open')}</Button>}
      {waysFolded && elsewhere.length > 0 && <MoreMenu label={s('org.workElsewhere')} items={elsewhere} />}
    </>
  )
}

/**
 * The heading a folder nobody has named shows instead.
 *
 * A person who has just pointed the app at an empty folder should be able to
 * say whose landscape it is without finding the settings dialog of a scope they
 * have not met yet. Enter, or the button, and it is the organisation's name.
 */
function NameTheOrganisation({ onName, s }: { onName: (name: string) => void; s: Translate }) {
  const [name, setName] = useState('')
  // A folder that gets a name elsewhere (a settings save, a watcher) should not
  // leave a stale draft sitting in this field.
  useEffect(() => () => setName(''), [])
  return (
    <span className="kit-factline">
      <TextInput
        aria-label={s('org.nameThis')} placeholder={s('org.nameThis')} value={name} data-testid="organisation-name-field"
        onChange={(e) => setName(e.target.value)}
        // The Enter it acts on is consumed, so it cannot go on to press whatever button takes the focus next.
        onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { e.preventDefault(); onName(name) } }}
      />
      <Button variant="primary" size="small" reason={name.trim() ? undefined : s('picker.nameFirst')} onClick={() => onName(name)}>{s('settings.save')}</Button>
    </span>
  )
}

/**
 * What the scopes under a home say they are, for the line under its name,
 * the badges and the picker (ADR-0036, amended 17 October 2026): the kinds
 * counted, the unit types counted, the operating model's unit types by id
 * and name — nothing where there is no model — and how each scope's type
 * stands to the units that serve it.
 */
function useScopeTypes(home: ScopeSummary, servedBy: ServedByAccess | undefined, s: Translate) {
  const unitTypes = useMemo(() => servedBy?.unitTypes() ?? [], [servedBy])
  const typeName = useCallback((id: string) => unitTypes.find((one) => one.id === id)?.name, [unitTypes])
  const typeLink = useCallback((path: ScopePath) => servedBy?.of(path)?.type.link, [servedBy])
  // The unit types counted first, then the kinds, for the line under the name.
  const typeLines = useMemo(() => [
    ...countScopeTypes(home).map(({ unitTypeId, count }) => s('org.typedCount', { count, type: typeName(unitTypeId) ?? s('org.typeGoneBadge') })),
    ...countScopeKinds(home).map(({ kind, count }) => plural(s, SCOPE_KIND_COUNT[kind ?? 'unsaid'], count)),
  ], [home, typeName, s])
  return { typeLines, unitTypes, typeName, typeLink }
}

/**
 * The new-scope dialog's *Served by*, where the home has one, and its
 * *Create*, which links the unit picked once the scope is made.
 */
function newScopeServing(organisation: Organisation, servedBy: ServedByAccess | undefined): Pick<NewScopeDialogProps, 'servedBy' | 'onCreate'> {
  const { dialog } = organisation
  if (!servedBy || dialog.kind !== 'newScope') return { onCreate: () => organisation.create() }
  return {
    servedBy: { options: servedBy.choicesForNew(), value: dialog.servedBy, onChange: organisation.setNewScopeServedBy },
    onCreate: () => organisation.create(servedBy.link),
  }
}
