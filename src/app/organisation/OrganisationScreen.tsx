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
 * `readOnly` is not a state this screen has. Everywhere else it is a prop the
 * editor is handed; here the honest signal that a store will not take a write
 * is the standing storage notice the shell already draws along the bottom, and
 * inventing a second one that guessed would hide affordances that work.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { LOCALE } from '../../i18n'
import { plural } from '../../i18n/strings'
import type { Language, StringKey, Translate } from '../../i18n'
import { countScopes, flattenScopes, isOpenableScope, newestChange, sortScopes } from '../../projects/scope'
import { isBoardKind } from '../../model/placement'
import type { DesignDiagram } from '../../model'

import type { ProjectOrder, ScopeSummary } from '../../projects/scope'
import type { ElementId } from '../../model'
import type { Finding } from '../../projects/checks'
import { isWithinScope, ROOT_SCOPE, scopePathLabel } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import type { WorkingSource } from '../../platform/workingSource'
import type { SourceChip, SourceWayIn } from '../../platform/sourceProvider'
import { AgentIcon } from '../../widgets/icons'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import IconButton from '@mui/material/IconButton'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Link from '@mui/material/Link'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import type { ExampleProject } from '../examples'
import { OverflowMenu } from '../OverflowMenu'
import type { ToolbarAgent, ToolbarOverflow } from '../ShellToolbar'
import { agentTip, Crumbs, crumbsFor, sourceIsAlarming, sourceLabel, sourceTipKey } from '../ShellToolbar'
import { NewScopeDialog } from './NewScopeDialog'
import { registerSummary, registerWithin } from './register'
import type { RegisterRow } from './register'
import { RegisterPage, TechnologyPage } from './RegisterPage'
import { technologySummary, technologyWithin } from '../../projects/technologyRegister'
import type { TechnologyRow } from '../../projects/technologyRegister'
import { OrganisationCards } from './OrganisationCards'
import { attentionItems } from './attention'
import { NeedsAttention } from './NeedsAttention'
import { organisationPages } from './organisationPages'
import { ScopeSettingsDialog, SCOPE_KIND_LABEL } from './ScopeSettingsDialog'
import { ScopeTree } from './ScopeTree'
import type { Organisation } from './useOrganisation'

export type OrganisationScreenProps = {
  organisation: Organisation
  examples: readonly ExampleProject[]
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
  onChooseWorkingDirectory?: () => void
  /**
   * The other places this build can work from, one button each, beside the one
   * that chooses a folder.
   *
   * Empty for every build in this repository, and the bar then reads exactly as
   * it always has. On the root's home only, for the same reason the source chip
   * is: where work is kept is a fact about the whole tree and is said once,
   * where the tree begins.
   */
  waysIn?: readonly SourceWayIn[]
  /** The menu, for a host that has no menu bar — where theme and language are. */
  overflow?: ToolbarOverflow
  agent?: ToolbarAgent
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
  /** How many observations the scopes below shared (ADR-0021), off the same index. */
  sharedObservations?: number
  /** Open a row where it is answered for, with the element selected. */
  onOpenRegisterRow?: (scope: ScopePath, id: ElementId) => void
  /** Open a row's page — the record and its document — where it is answered for. */
  onOpenRegisterPage?: (scope: ScopePath, id: ElementId) => void
  /**
   * An agent asked for one of this screen's two pages (ADR-0019). A request
   * with a nonce, because the same page asked for twice is two requests and
   * a prop that did not change is none.
   */
  pageRequest?: { page: 'register' | 'technologyRegister'; nonce: number }
  /** Which of the two pages is up, whenever that changes — so the shell can say where the app is. */
  onPageChange?: (page: 'register' | 'technologyRegister' | undefined) => void
  /** Resolve a conflict: open the scope that should yield, with *link* pending. */
  onLinkFromRegister?: (scope: ScopePath, id: ElementId, to: ScopePath) => void
  /** The day, injected so a card's finding is not at the mercy of the clock. */
  today: string
  language: Language
  s: Translate
  windowChrome?: WindowChrome
}

export function OrganisationScreen({
  organisation, examples, order, onOrderChange, source, sourceDescription, sourceChip,
  onChooseWorkingDirectory, waysIn,
  overflow, agent, onGoHome, findings, register = [], technology = [], initiatives = 0, sharedObservations = 0,
  onOpenRegisterRow, onOpenRegisterPage, onLinkFromRegister, pageRequest, onPageChange,
  today, language, s, windowChrome = NO_WINDOW_CHROME,
}: OrganisationScreenProps) {
  const { tree, at, root, ready, dialog } = organisation
  /**
   * The register is a page of its own, opened from its card — state here and
   * not in the hook, because it is the one page on this screen that neither
   * writes nor asks a store anything.
   */
  const [registerOpen, setRegisterOpen] = useState(false)
  const [technologyOpen, setTechnologyOpen] = useState(false)
  /**
   * How tall this screen's bar is, measured the way the workspace measures
   * its own: the register and the technology pages open BELOW it, so the
   * crumbs stay and the way home is the same as from every other page. They
   * used to cover it and leave a lone ‹, and the register opened over a
   * backdrop as a dialog would. Zero until measured, as in the workspace.
   */
  const [barHeight, setBarHeight] = useState(0)
  const barRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setBarHeight(node.getBoundingClientRect().height))
    observer.observe(node)
    setBarHeight(node.getBoundingClientRect().height)
  }, [])
  const pageChrome = useMemo<WindowChrome>(() => ({ ...windowChrome, topInset: barHeight }), [windowChrome, barHeight])
  // An agent's request for either page (ADR-0019), and the answer back: which
  // one is up, said on every change and taken back when this screen goes.
  useEffect(() => {
    if (!pageRequest) return
    setRegisterOpen(pageRequest.page === 'register')
    setTechnologyOpen(pageRequest.page === 'technologyRegister')
  }, [pageRequest])
  useEffect(() => {
    onPageChange?.(registerOpen ? 'register' : technologyOpen ? 'technologyRegister' : undefined)
  }, [onPageChange, registerOpen, technologyOpen])
  useEffect(() => () => onPageChange?.(undefined), [onPageChange])

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

  /**
   * Ordered here and not in the store: the order is what this screen shows, and
   * the toggle has to change it without a round trip to storage.
   */
  const ordered = useMemo<ScopeSummary>(() => ({ ...home, children: sortScopes(home.children, order) }), [home, order])
  /** The whole tree in the same order, for the dialogs' *filed under* selects. */
  const orderedTree = useMemo<ScopeSummary>(
    () => ({ ...tree, children: sortScopes(tree.children, order) }),
    [tree, order],
  )
  const pages = useMemo(() => organisationPages(root, today), [root, today])
  const registerHere = useMemo(() => registerWithin(register, at), [register, at])
  const registerCounts = useMemo(() => registerSummary(registerHere), [registerHere])
  const technologyHere = useMemo(() => technologyWithin(technology, at), [technology, at])
  const technologyCounts = useMemo(() => technologySummary(technologyHere), [technologyHere])
  const counts = useMemo(() => countScopes(home), [home])
  const changed = useMemo(() => newestChange(home), [home])
  /**
   * What to call a scope a finding names: its name where the tree has one,
   * the word for the organisation at the root. The screen's vocabulary, so
   * the sentence builder is handed it rather than knowing it.
   */
  const scopeName = useMemo(() => {
    const names = new Map(flattenScopes(tree).map((scope) => [scope.path, scope.name]))
    return (path: ScopePath) => (path === ROOT_SCOPE
      ? s('common.organisation')
      : names.get(path) || scopePathLabel(path))
  }, [tree, s])
  /**
   * The findings, as sentences under the cards (ADR-0012 §9). Read off what
   * the shell already holds: the tree's findings and the technology rows.
   */
  const attention = useMemo(
    () => attentionItems(findings, register, technology, at, s, scopeName),
    [findings, register, technology, at, s, scopeName],
  )

  /**
   * Does this scope have a canvas? Off its own document, which is read for
   * the cards anyway: the listing counts views, and a sheet is a view that
   * is laid out rather than drawn (§6), so a root with a business sheet and
   * no board would otherwise be offered a canvas with nothing on it.
   */
  const draws = ready && isOpenableScope(root) && root.path === at
  /**
   * Which cards: by shape, not by the label a scope gives itself. The root is
   * the organisation whatever it says; a scope that draws is a landscape; and
   * anything else beneath the root is a domain — a folder that holds scopes,
   * or nothing yet.
   */
  const level = atRoot ? 'organisation' : draws ? 'landscape' : 'domain'
  /**
   * Which cards, additively: a scope can honestly be a domain that also draws
   * (`countScopes`), and taking its register away the day it gains a board
   * would be the label deciding after all. The business layer is the root's
   * (§4); the documentation is about the records on a scope's own boards; the
   * register is over what is beneath, so a leaf that draws has no use for it.
   */
  const shows = {
    business: atRoot,
    documentation: draws,
    register: atRoot || home.children.length > 0,
    // The technology is over the tree like the register, and beside it.
    technology: atRoot || home.children.length > 0,
  }
  const named = home.name.trim().length > 0
  const heading = home.name.trim() || (atRoot ? s('picker.organisation') : scopePathLabel(home.path))
  const quiet = { fontSize: 11, minWidth: 0, px: 1, color: 'text.secondary' } as const

  return (
    <Box sx={{
      height: '100vh', width: '100vw', overflowY: 'auto',
      bgcolor: 'background.default', display: 'flex', flexDirection: 'column',
    }}>
      <OrganisationBar
        barRef={barRef}
        tree={tree}
        home={home}
        heading={heading}
        level={level}
        source={atRoot ? source : undefined}
        sourceDescription={sourceDescription}
        sourceChip={sourceChip}
        onChooseWorkingDirectory={atRoot ? onChooseWorkingDirectory : undefined}
        waysIn={atRoot ? waysIn : undefined}
        onGoHome={onGoHome}
        onSettings={() => organisation.editScope(home)}
        overflow={overflow}
        agent={agent}
        s={s}
        windowChrome={windowChrome}
      />

      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 4 }}>
        <Box sx={{ maxWidth: 980, mx: 'auto' }}>
          {/* Identity. A folder nobody has named asks for a name where the
              heading would be, rather than showing a blank one. */}
          {named || !atRoot ? (
            <Typography sx={{ fontSize: 28, fontWeight: 500 }} data-testid="organisation-name">
              {heading}
            </Typography>
          ) : (
            <NameTheOrganisation onName={organisation.nameOrganisation} s={s} />
          )}

          <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }} data-testid="organisation-meta">
            {[
              // The client only where it differs: "For Acme Logistics" under
              // the heading "Acme Logistics" says nothing twice.
              home.client?.trim() && home.client.trim() !== home.name.trim()
                ? s('org.forClient', { name: home.client.trim() })
                : '',
              plural(s, { one: 'org.domainsOne', other: 'org.domainsOther' }, counts.domains),
              plural(s, { one: 'org.landscapesOne', other: 'org.landscapesOther' }, counts.landscapes),
              changed
                ? s('org.lastChanged', {
                  when: new Date(changed).toLocaleString(LOCALE[language], {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  }),
                })
                : s('picker.never'),
            ].filter(Boolean).join(' · ')}
          </Typography>

          {/* What this screen is, and where things live: the first sentence
              every desktop session reads, so it says it plainly. At the root
              only — a domain's home is reached from here and needs no second
              explanation. */}
          {atRoot && (
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1, maxWidth: 720 }} data-testid="organisation-subtitle">
              {[whereSaid(source, sourceDescription, s), s('org.subtitle')].filter(Boolean).join(' ')}
            </Typography>
          )}

          {home.description && (
            <Typography sx={{ fontSize: 13, mt: 1.5, maxWidth: 720 }}>
              {home.description}
            </Typography>
          )}

          {home.links && home.links.length > 0 && (
            <Stack direction="row" spacing={0.75} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.75 }}>
              {home.links.map((link) => (
                <Chip
                  key={link.url}
                  size="small"
                  component={Link}
                  clickable
                  href={link.url}
                  target="_blank"
                  // `noopener` because the opened page gets a handle on this
                  // window otherwise, and the address came from a file that may
                  // have been written by somebody else.
                  rel="noopener noreferrer"
                  label={link.label}
                  sx={{ height: 20, fontSize: 11 }}
                />
              ))}
            </Stack>
          )}

          {/* Not before the document is read at a level below the root: the
              row of cards is the level's shape, and drawing a domain's row and
              then a landscape's is a flicker on every step down. */}
          <Box sx={{ mt: 3, minHeight: 120 }}>
            {(atRoot || ready) && <OrganisationCards
              pages={pages}
              ready={ready}
              onOpenBusiness={() => organisation.open(
                at,
                { page: 'sheet', ...(pages.business.sheetId ? { id: pages.business.sheetId } : {}) },
              )}
              onOpenMap={() => organisation.open(
                at,
                { page: 'map', ...(pages.business.mapId ? { id: pages.business.mapId } : {}) },
              )}
              onOpenDecisions={() => organisation.open(at, { page: 'decisions' })}
              onOpenObservations={() => organisation.open(at, { page: 'observations' })}
              sharedObservations={sharedObservations}
              onOpenRoadmap={() => organisation.open(at, { page: 'roadmap' })}
              register={registerCounts}
              technology={technologyCounts}
              initiatives={initiatives}
              shows={shows}
              onOpenRegister={() => setRegisterOpen(true)}
              onOpenTechnology={() => setTechnologyOpen(true)}
              onOpenTechnologyLandscape={() => organisation.open(
                at,
                { page: 'technology', ...(pages.technology.landscapeId ? { id: pages.technology.landscapeId } : {}) },
              )}
              onOpenDocumentation={() => organisation.open(at, { page: 'documentation' })}
              s={s}
            />}
          </Box>

          {/* What the tree contradicts about itself, once, as sentences a
              person can act on — where the cards used to count them and the
              rows used to colour them. */}
          <NeedsAttention items={attention} onOpen={onOpenRegisterRow} s={s} />

          {/* The boards, one row each: a scope that draws is a stop on the way
              to its canvas, and the way on is the row of the board you want —
              a future version of the landscape sits beside the current one
              here rather than behind it on a tab. On every home, empty or
              not, because the way to a scope's FIRST board is here too: the
              canvas's own button is behind a canvas a scope with no board is
              never given (§1). */}
          {root && root.path === at && (
            <BoardsTable
              // Every view, the laid-out ones too: since ADR-0016 each is a
              // tab the editor draws, so each row opens the scope on it.
              boards={root.model.diagrams}
              onOpen={(id) => organisation.open(at, { page: 'board', id })}
              onAdd={() => organisation.addBoard(at)}
              // The same kinds the editor's + tab offers (ADR-0016): a page
              // opened with no id is the one the scope is about to be given.
              onAddSheet={() => organisation.open(at, { page: 'sheet' })}
              onAddMap={() => organisation.open(at, { page: 'map' })}
              onAddTechnology={() => organisation.open(at, { page: 'technology' })}
              onDelete={(board) => organisation.askDeleteBoard(at, board)}
              language={language}
              s={s}
            />
          )}

          <UnreadableScopes tree={tree} at={at} s={s} />

          {/* The tree, under its heading whether or not there is anything in
              it yet: an empty organisation says so in a sentence, with the
              examples underneath at the root. A landscape's home has no tree
              and no heading — it draws, and files nothing. */}
          {(atRoot || level === 'domain' || home.children.length > 0) && (
            <>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, flex: 1, textTransform: 'uppercase' }}>
                  {s('org.tree')}
                </Typography>
                {home.children.length > 0 && (
                  <>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{s('picker.order')}</Typography>
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={order}
                      onChange={(_e, next: ProjectOrder | null) => { if (next) onOrderChange(next) }}
                      aria-label={s('picker.order')}
                    >
                      <ToggleButton value="name" sx={{ fontSize: 11, py: 0.25, px: 1 }}>
                        {s('picker.orderName')}
                      </ToggleButton>
                      <ToggleButton value="updated" sx={{ fontSize: 11, py: 0.25, px: 1 }}>
                        {s('picker.orderUpdated')}
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </>
                )}
                <Button size="small" variant="contained" onClick={() => organisation.addUnder(at)}>
                  {s('picker.newScope')}
                </Button>
              </Stack>
              <ScopeTree
                tree={ordered}
                name={named || !atRoot ? heading : s('common.organisation')}
                collapsed={organisation.collapsed}
                onToggleCollapsed={organisation.toggleCollapsed}
                onOpen={(path) => organisation.open(path)}
                onHome={onGoHome}
                onAddUnder={organisation.addUnder}
                onSettings={organisation.editScope}
                onDelete={organisation.askDelete}
                language={language}
                s={s}
              />
            </>
          )}

          {/* The examples are for a folder with nothing in it yet. Once the
              organisation holds a view or a scope, an offer to copy one in
              beside the real work is a way to file an example under it by
              accident, so the section goes. */}
          {atRoot && examples.length > 0 && holdsNothing(tree) && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, mb: 1, textTransform: 'uppercase' }}>
                {s('picker.examples')}
              </Typography>
              <Stack spacing={0.75}>
                {examples.map((example) => (
                  <Card key={example.key} variant="outlined">
                    <Stack direction="row" sx={{ alignItems: 'center', px: 1.5, py: 1 }} spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{example.label}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                          {example.description}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        data-testid="copy-example"
                        onClick={() => organisation.copyExample(example)}
                        sx={quiet}
                      >
                        {s('org.copyHere')}
                      </Button>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </>
          )}
        </Box>
      </Box>

      <RegisterPage
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        rows={registerHere}
        organisation={heading}
        onOpen={onOpenRegisterRow}
        onOpenPage={onOpenRegisterPage}
        onLink={onLinkFromRegister}
        s={s}
        windowChrome={pageChrome}
      />
      <TechnologyPage
        open={technologyOpen}
        onClose={() => setTechnologyOpen(false)}
        rows={technologyHere}
        organisation={heading}
        onOpen={onOpenRegisterRow}
        onOpenPage={onOpenRegisterPage}
        s={s}
        windowChrome={pageChrome}
      />
      <NewScopeDialog
        open={dialog.kind === 'newScope'}
        tree={orderedTree}
        parent={dialog.kind === 'newScope' ? dialog.parent : at}
        name={dialog.kind === 'newScope' ? dialog.name : ''}
        withBoard={dialog.kind === 'newScope' ? dialog.withBoard : true}
        onParentChange={organisation.setNewScopeParent}
        onNameChange={organisation.setNewScopeName}
        onWithBoardChange={organisation.setNewScopeWithBoard}
        onCancel={organisation.closeDialog}
        onCreate={organisation.create}
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
      <ScopeSettingsDialog
        target={dialog.kind === 'settings' ? dialog.target : undefined}
        tree={orderedTree}
        onCancel={organisation.closeDialog}
        onSave={(path, patch) => { organisation.closeDialog(); organisation.applySettings(path, patch) }}
        s={s}
      />
      <ConfirmDialog
        open={dialog.kind === 'delete'}
        title={s('picker.deleteTitle', { name: dialog.kind === 'delete' ? dialog.target.name : '' })}
        // What goes, said in full: the scope, everything filed under it, and
        // its folder — and "from this browser" only where that is where it is.
        body={s(
          source?.kind === 'folder' ? 'picker.deleteBodyFolder' : 'picker.deleteBodyBrowser',
          { name: dialog.kind === 'delete' ? dialog.target.name : '' },
        )}
        confirmLabel={s('common.delete')}
        cancelLabel={s('common.cancel')}
        onCancel={organisation.closeDialog}
        onConfirm={organisation.confirmDelete}
      />
      <ConfirmDialog
        open={dialog.kind === 'deleteBoard'}
        title={s('shell.deleteDiagramTitle', { name: dialog.kind === 'deleteBoard' ? dialog.board.name : '' })}
        body={s('shell.deleteContainerBody')}
        confirmLabel={s('common.delete')}
        cancelLabel={s('common.cancel')}
        onCancel={organisation.closeDialog}
        onConfirm={organisation.confirmDeleteBoard}
      />
    </Box>
  )
}

/**
 * Every board the scope draws, one row each, oldest first as the model holds
 * them. What a row says is what tells two boards of one landscape apart: the
 * kind, the day it shows (ADR-0009) and how much is on it.
 */
/** What a laid-out view's row says instead of a day and a count: the kind, and that it is laid out. */
const LAID_OUT_LABEL = { sheet: 'org.viewSheet', map: 'org.viewMap', technology: 'org.viewTechnology' } as const

function BoardsTable({ boards, onOpen, onAdd, onAddSheet, onAddMap, onAddTechnology, onDelete, language, s }: {
  boards: readonly DesignDiagram[]
  onOpen: (id: string) => void
  /** A landscape for this scope — the only way to its first one. */
  onAdd: () => void
  /** The laid-out kinds, the same three the editor's + tab offers (ADR-0016). */
  onAddSheet: () => void
  onAddMap: () => void
  onAddTechnology: () => void
  /**
   * A container diagram only: a landscape is deleted from its tab, where the
   * last one is refused, and a container diagram has no tab and no last one.
   */
  onDelete: (board: { id: string; name: string }) => void
  language: Language
  s: Translate
}) {
  const [newMenu, setNewMenu] = useState<HTMLElement | null>(null)
  const pick = (make: () => void) => () => { setNewMenu(null); make() }
  return (
    <Box sx={{ mb: 4 }} data-testid="boards">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, flex: 1, textTransform: 'uppercase' }}>
          {s('org.boards')}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={(event) => setNewMenu(event.currentTarget)}
          aria-haspopup="menu"
          aria-expanded={Boolean(newMenu)}
          data-testid="new-board"
        >
          {s('org.newBoard')}
        </Button>
        <Menu open={Boolean(newMenu)} anchorEl={newMenu} onClose={() => setNewMenu(null)} slotProps={{ list: { dense: true } }}>
          <MenuItem onClick={pick(onAdd)} data-testid="new-board-landscape">{s('org.newBoardLandscape')}</MenuItem>
          <MenuItem onClick={pick(onAddSheet)}>{s('org.newBoardSheet')}</MenuItem>
          <MenuItem onClick={pick(onAddMap)}>{s('org.newBoardMap')}</MenuItem>
          <MenuItem onClick={pick(onAddTechnology)}>{s('org.newBoardTechnology')}</MenuItem>
        </Menu>
      </Stack>
      {boards.length === 0 && (
        <Typography sx={{ fontSize: 12, color: 'text.secondary', py: 0.75 }} data-testid="boards-empty">
          {s('org.noBoards')}
        </Typography>
      )}
      {boards.map((board) => (
        <Stack
          key={board.id}
          direction="row"
          spacing={1}
          data-testid={`board-${board.id}`}
          sx={{ alignItems: 'center', py: 0.75, borderBottom: 1, borderColor: 'divider' }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* The name opens it too: a row whose only door is the button at
                the far end is a row people click on and nothing happens. */}
            <Typography
              component="button"
              type="button"
              onClick={() => onOpen(board.id)}
              data-testid={`board-name-${board.id}`}
              sx={{
                fontSize: 13, fontWeight: 500, font: 'inherit', color: 'inherit', background: 'none', border: 0,
                p: 0, cursor: 'pointer', textAlign: 'left', '&:hover': { color: 'primary.main' },
              }}
            >
              {board.name}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              {!isBoardKind(board.kind) ? s(LAID_OUT_LABEL[board.kind as keyof typeof LAID_OUT_LABEL]) : [
                s(board.kind === 'container' ? 'org.viewContainer' : 'org.viewLayer7'),
                // The day the board shows. A board with no date moves with
                // the calendar, and says so rather than printing today's.
                board.asOf
                  ? s('org.viewAsOf', {
                    date: new Date(board.asOf).toLocaleDateString(LOCALE[language], {
                      day: 'numeric', month: 'short', year: 'numeric',
                    }),
                  })
                  : s('org.viewToday'),
                plural(s, { one: 'org.onItOne', other: 'org.onItOther' }, board.members.length),
              ].join(' · ')}
            </Typography>
          </Box>
          <Button size="small" onClick={() => onOpen(board.id)} sx={{ fontSize: 11, minWidth: 0, px: 1 }}>
            {s('picker.open')}
          </Button>
          {board.kind === 'container' && (
            <Button
              size="small"
              color="error"
              onClick={() => onDelete({ id: board.id, name: board.name })}
              sx={{ fontSize: 11, minWidth: 0, px: 1 }}
            >
              {s('common.delete')}
            </Button>
          )}
        </Stack>
      ))}
    </Box>
  )
}

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
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{s('org.newBoard')}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label={s('org.boardName')}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && ready) onCreate() }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{s('common.cancel')}</Button>
        <Button variant="contained" disabled={!ready} onClick={onCreate}>
          {s('picker.create')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * The sentence for the chip, or the empty string where there is none to say.
 *
 * A provider's key comes from its own table (`i18n`'s `registerStrings`), so it
 * is rendered exactly as the ways in render their labels: this shell passes the
 * key through and never holds the words.
 */
function tipFor(
  source: WorkingSource, describeKey: StringKey | (string & {}) | undefined, s: Translate,
  chip?: SourceChip,
): string {
  const key = sourceTipKey(source, describeKey, chip)
  return key === undefined ? '' : s(key as StringKey)
}

/**
 * The subtitle's first sentence: where work is kept, or nothing.
 *
 * The second place on this screen that says it, the chip's tooltip being the
 * first, and it follows the same rule for the same reason. A clause per
 * built-in kind, because this tree knows what a folder and a browser's storage
 * are; for a registered source the provider's own sentence (`describeKey`, from
 * its own table), whole rather than folded into a clause of ours, because a
 * sentence about somewhere this shell has never heard of is the provider's to
 * write. Where it gave none the clause is dropped and the subtitle says what it
 * can say truthfully: what a domain and a landscape below are.
 *
 * A source that is not there yet reads as the browser's storage, which is what
 * a tab with no source is working from.
 */
function whereSaid(
  source: WorkingSource | undefined, describeKey: StringKey | (string & {}) | undefined, s: Translate,
): string {
  if (source?.kind === 'registered') {
    return describeKey === undefined ? '' : s(describeKey as StringKey)
  }
  return s('org.subtitleWhere', {
    where: s(source?.kind === 'folder'
      ? 'org.whereFolder'
      : source?.kind === 'memory' ? 'org.whereMemory' : 'org.whereBrowser'),
  })
}

/**
 * Is this folder known to hold nothing — no scope, no board, and nothing the
 * listing could not read? What the examples are offered for.
 */
function holdsNothing(tree: ScopeSummary): boolean {
  return tree.children.length === 0 && tree.diagrams === 0 && !tree.unreadable?.length
}

/**
 * What the listing could not read under this home, said in a sentence
 * (`ScopeSummary.unreadable`, ADR-0028 amended). Not shown in the tree, which
 * has nothing to draw it from; said here because a scope that is missing
 * without a word is one a person goes looking for, or creates again.
 */
function UnreadableScopes({ tree, at, s }: { tree: ScopeSummary; at: ScopePath; s: Translate }) {
  const here = (tree.unreadable ?? []).filter((path) => isWithinScope(path, at) && (path !== at || at === ROOT_SCOPE))
  if (here.length === 0) return null
  return (
    <Typography sx={{ fontSize: 13, color: 'warning.main', mb: 2, maxWidth: 720 }} data-testid="organisation-unreadable">
      {here.includes(ROOT_SCOPE)
        ? s('org.unreadableFolder')
        : plural(s, { one: 'org.unreadableOne', other: 'org.unreadableOther' }, here.length, { paths: here.join(', ') })}
    </Typography>
  )
}

/**
 * The bar, the way the workspace has one.
 *
 * The same left-to-right reading ADR-0005 asks for — where you are, as the
 * crumbs above this scope and then its own name, then what you can do to it,
 * then where it is kept — and the same window chrome duties: keep clear of the
 * traffic lights, and be the surface the window is dragged by.
 */
function OrganisationBar({
  barRef, tree, home, heading, level, source, sourceDescription, sourceChip,
  onChooseWorkingDirectory, waysIn = [],
  onGoHome, onSettings, overflow, agent, s, windowChrome,
}: {
  /** Measured, so the pages that open under it know how far down to start. */
  barRef: (node: HTMLDivElement | null) => void
  tree: ScopeSummary
  home: ScopeSummary
  heading: string
  /** What the scope is by shape, for the word beside the name when it has not said. */
  level: 'organisation' | 'domain' | 'landscape'
  source?: WorkingSource
  sourceDescription?: StringKey | (string & {})
  sourceChip?: SourceChip
  onChooseWorkingDirectory?: () => void
  waysIn?: readonly SourceWayIn[]
  onGoHome: (path: ScopePath) => void
  onSettings: () => void
  overflow?: ToolbarOverflow
  agent?: ToolbarAgent
  s: Translate
  windowChrome: WindowChrome
}) {
  const quiet = { fontSize: 11, minWidth: 0, px: 1, color: 'text.secondary' } as const
  const crumbs = useMemo(() => crumbsFor(home.path, flattenScopes(tree), s), [home.path, tree, s])
  return (
    <Box ref={barRef} data-testid="shell-toolbar" sx={{
      display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75,
      borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flex: '0 0 auto',
      // The window controls are painted over this bar's start, so the first
      // thing begins after them rather than under them.
      pl: `${12 + windowChrome.controlsInset}px`,
      WebkitAppRegion: windowChrome.draggable ? 'drag' : undefined,
      '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
    }}>
      <Crumbs crumbs={crumbs} current={heading} currentPath={home.path} onGoHome={onGoHome} s={s} />
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
        {s(SCOPE_KIND_LABEL[home.kind ?? level])}
      </Typography>
      <Tooltip title={s('group.openFor', { name: heading })}>
        <Button size="small" color="inherit" onClick={onSettings} sx={quiet}>
          {s('group.open')}
        </Button>
      </Tooltip>

      <Box sx={{ flex: 1 }} />

      {source && (
        /* The sentence about where work is kept: this tree's for a built-in
           kind, the provider's own for a registered source, and — where a
           provider gave none — nothing, which an empty title is how MUI says.
           A guess of ours about somewhere this shell has never heard of could
           promise a copy that cannot be made. */
        <Tooltip title={tipFor(source, sourceDescription, s, sourceChip)}>
          <Typography
            data-testid="working-source"
            /* A real `button` where a provider gave something to press, and not
               a span that listens: this bar is the window's drag surface on the
               desktop, and the rule that keeps a control clickable inside it
               names elements (`& button, & a, & input`) rather than whatever
               happens to have a handler. A span with an `onClick` here would be
               dead surface that drags the window instead. */
            {...(sourceChip?.onClick
              ? { component: 'button' as const, type: 'button', onClick: sourceChip.onClick }
              : {})}
            sx={{
              fontSize: 11, px: 0.75, py: 0.25, borderRadius: 1,
              color: sourceIsAlarming(source) ? 'warning.main' : 'text.secondary',
              border: 1, borderColor: sourceIsAlarming(source) ? 'warning.main' : 'divider',
              // A button brings the browser's own font and background with it,
              // so both are said back to what the chip has always looked like.
              fontFamily: 'inherit', bgcolor: 'transparent',
              cursor: sourceChip?.onClick ? 'pointer' : undefined,
            }}
          >
            {sourceLabel(source, s, sourceChip)}
          </Typography>
        </Tooltip>
      )}
      {onChooseWorkingDirectory && (
        <Button size="small" color="inherit" onClick={onChooseWorkingDirectory} sx={quiet}>
          {s(source?.kind === 'folder' ? 'picker.changeFolder' : 'picker.chooseFolder')}
        </Button>
      )}
      {waysIn.map((way) => (
        <Button
          key={way.kind}
          size="small"
          color="inherit"
          data-testid={`connect-source-${way.kind}`}
          onClick={way.onConnect}
          sx={quiet}
        >
          {/* The provider's key, from its own table or from this one's
              (`i18n/registerStrings`); the shell only renders it. */}
          {s(way.labelKey as StringKey)}
        </Button>
      ))}
      {agent && (
        <Tooltip title={agentTip(agent.status, s)}>
          <IconButton
            size="small"
            aria-label={agentTip(agent.status, s)}
            data-testid="agent-glyph"
            data-state={agent.status.kind}
            onClick={agent.onOpen}
            sx={{
              width: 30, height: 30,
              color: agent.status.kind === 'connected'
                ? 'primary.main'
                : agent.status.kind === 'listening' ? 'text.primary' : 'text.secondary',
            }}
          >
            <AgentIcon filled={agent.status.kind === 'connected'} />
          </IconButton>
        </Tooltip>
      )}
      {overflow && (
        <OverflowMenu
          themeMode={overflow.themeMode}
          can={overflow.can}
          onCommand={overflow.onCommand}
          sourceEntries={overflow.sourceEntries}
          onSourceWork={overflow.onSourceWork}
          s={s}
        />
      )}
    </Box>
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
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end', maxWidth: 480 }}>
      <TextField
        fullWidth
        variant="standard"
        label={s('org.nameThis')}
        value={name}
        slotProps={{ htmlInput: { 'data-testid': 'organisation-name-field' } }}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onName(name) }}
      />
      <Button size="small" variant="contained" disabled={!name.trim()} onClick={() => onName(name)}>
        {s('settings.save')}
      </Button>
    </Stack>
  )
}
