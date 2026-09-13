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
import { useEffect, useMemo, useState } from 'react'
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
import type { Language, Translate } from '../../i18n'
import { countScopes, flattenScopes, isOpenableScope, newestChange, sortScopes } from '../../projects/scope'
import { isBoardKind } from '../../model/placement'
import type { DesignDiagram } from '../../model'

import type { ProjectOrder, ScopeSummary } from '../../projects/scope'
import type { ElementId } from '../../model'
import type { Finding } from '../../projects/checks'
import { ROOT_SCOPE, scopePathLabel } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import type { WorkingSource } from '../../platform/workingSource'
import { AgentIcon } from '../../widgets/icons'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import IconButton from '@mui/material/IconButton'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Link from '@mui/material/Link'
import type { ExampleProject } from '../examples'
import { OverflowMenu } from '../OverflowMenu'
import type { ToolbarAgent, ToolbarOverflow } from '../ShellToolbar'
import { agentTip, Crumbs, crumbsFor, sourceLabel } from '../ShellToolbar'
import { NewScopeDialog } from './NewScopeDialog'
import { registerSummary, registerWithin } from './register'
import type { RegisterRow } from './register'
import { RegisterPage } from './RegisterPage'
import { OrganisationCards } from './OrganisationCards'
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
  onChooseWorkingDirectory?: () => void
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
  /** How many plans below the root are initiatives (ADR-0012 §7), off the same index. */
  initiatives?: number
  /** Open a row where it is answered for, with the element selected. */
  onOpenRegisterRow?: (scope: ScopePath, id: ElementId) => void
  /** Open a row's page — the record and its document — where it is answered for. */
  onOpenRegisterPage?: (scope: ScopePath, id: ElementId) => void
  /** Resolve a conflict: open the scope that should yield, with *link* pending. */
  onLinkFromRegister?: (scope: ScopePath, id: ElementId, to: ScopePath) => void
  /** The day, injected so a card's finding is not at the mercy of the clock. */
  today: string
  language: Language
  s: Translate
  windowChrome?: WindowChrome
}

export function OrganisationScreen({
  organisation, examples, order, onOrderChange, source, onChooseWorkingDirectory,
  overflow, agent, onGoHome, findings, register = [], initiatives = 0,
  onOpenRegisterRow, onOpenRegisterPage, onLinkFromRegister,
  today, language, s, windowChrome = NO_WINDOW_CHROME,
}: OrganisationScreenProps) {
  const { tree, at, root, ready, dialog } = organisation
  /**
   * The register is a page of its own, opened from its card — state here and
   * not in the hook, because it is the one page on this screen that neither
   * writes nor asks a store anything.
   */
  const [registerOpen, setRegisterOpen] = useState(false)

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
  const ordered = useMemo<ScopeSummary>(
    () => ({ ...home, children: sortScopes(home.children, order) }),
    [home, order],
  )
  /** The whole tree in the same order, for the dialogs' *filed under* selects. */
  const orderedTree = useMemo<ScopeSummary>(
    () => ({ ...tree, children: sortScopes(tree.children, order) }),
    [tree, order],
  )
  const pages = useMemo(() => organisationPages(root, today), [root, today])
  const registerHere = useMemo(() => registerWithin(register, at), [register, at])
  const registerCounts = useMemo(() => registerSummary(registerHere), [registerHere])
  const counts = useMemo(() => countScopes(home), [home])
  const changed = useMemo(() => newestChange(home), [home])

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
        tree={tree}
        home={home}
        heading={heading}
        level={level}
        source={atRoot ? source : undefined}
        onChooseWorkingDirectory={atRoot ? onChooseWorkingDirectory : undefined}
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
              onOpenRoadmap={() => organisation.open(at, { page: 'roadmap' })}
              register={registerCounts}
              initiatives={initiatives}
              shows={shows}
              onOpenRegister={() => setRegisterOpen(true)}
              onOpenDocumentation={() => organisation.open(at, { page: 'documentation' })}
              s={s}
            />}
          </Box>

          {/* The boards, one row each: a scope that draws is a stop on the way
              to its canvas, and the way on is the row of the board you want —
              a future version of the landscape sits beside the current one
              here rather than behind it on a tab. On every home, empty or
              not, because the way to a scope's FIRST board is here too: the
              canvas's own button is behind a canvas a scope with no board is
              never given (§1). */}
          {root && root.path === at && (
            <BoardsTable
              boards={root.model.diagrams.filter((diagram) => isBoardKind(diagram.kind))}
              onOpen={(id) => organisation.open(at, { page: 'board', id })}
              onAdd={() => organisation.addBoard(at)}
              onDelete={(board) => organisation.askDeleteBoard(at, board)}
              language={language}
              s={s}
            />
          )}

          {/* The tree. A fresh folder has none, and says so with the examples
              underneath rather than with an empty heading. */}
          {home.children.length > 0 && (
            <>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, flex: 1, textTransform: 'uppercase' }}>
                  {s('org.tree')}
                </Typography>
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
                <Button size="small" variant="contained" onClick={() => organisation.addUnder(at)}>
                  {s('picker.newScope')}
                </Button>
              </Stack>
              <ScopeTree
                tree={ordered}
                collapsed={organisation.collapsed}
                onToggleCollapsed={organisation.toggleCollapsed}
                onOpen={(path) => organisation.open(path)}
                onHome={onGoHome}
                onAddUnder={organisation.addUnder}
                onSettings={organisation.editScope}
                onDelete={organisation.askDelete}
                findings={findings}
                language={language}
                s={s}
              />
            </>
          )}
          {home.children.length === 0 && (
            <Button size="small" variant="contained" onClick={() => organisation.addUnder(at)}>
              {s('picker.newScope')}
            </Button>
          )}

          {/* The examples are for a folder with nothing in it yet. Once the
              organisation holds a view or a scope, an offer to copy one in
              beside the real work is a way to file an example under it by
              accident, so the section goes. */}
          {atRoot && examples.length > 0 && tree.children.length === 0 && tree.diagrams === 0 && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, mb: 1, textTransform: 'uppercase' }}>
                {s('picker.examples')}
              </Typography>
              <Stack spacing={0.75}>
                {examples.map((example) => (
                  <Card key={example.key} variant="outlined">
                    <Stack direction="row" alignItems="center" sx={{ px: 1.5, py: 1 }} spacing={2}>
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
        windowChrome={windowChrome}
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
        body={s('picker.deleteBody')}
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
function BoardsTable({ boards, onOpen, onAdd, onDelete, language, s }: {
  boards: readonly DesignDiagram[]
  onOpen: (id: string) => void
  /** A board for this scope — the only way to its first one. */
  onAdd: () => void
  /**
   * A container diagram only: a landscape is deleted from its tab, where the
   * last one is refused, and a container diagram has no tab and no last one.
   */
  onDelete: (board: { id: string; name: string }) => void
  language: Language
  s: Translate
}) {
  return (
    <Box sx={{ mb: 4 }} data-testid="boards">
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, flex: 1, textTransform: 'uppercase' }}>
          {s('org.views')}
        </Typography>
        <Button size="small" variant="outlined" onClick={onAdd} data-testid="new-board">
          {s('org.newBoard')}
        </Button>
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
          alignItems="center"
          spacing={1}
          data-testid={`board-${board.id}`}
          sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider' }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{board.name}</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              {[
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
 * The bar, the way the workspace has one.
 *
 * The same left-to-right reading ADR-0005 asks for — where you are, as the
 * crumbs above this scope and then its own name, then what you can do to it,
 * then where it is kept — and the same window chrome duties: keep clear of the
 * traffic lights, and be the surface the window is dragged by.
 */
function OrganisationBar({
  tree, home, heading, level, source, onChooseWorkingDirectory, onGoHome, onSettings, overflow, agent, s, windowChrome,
}: {
  tree: ScopeSummary
  home: ScopeSummary
  heading: string
  /** What the scope is by shape, for the word beside the name when it has not said. */
  level: 'organisation' | 'domain' | 'landscape'
  source?: WorkingSource
  onChooseWorkingDirectory?: () => void
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
    <Box data-testid="shell-toolbar" sx={{
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
        <Tooltip title={s('shell.sourceTip')}>
          <Typography
            data-testid="working-source"
            sx={{
              fontSize: 11, px: 0.75, py: 0.25, borderRadius: 1,
              color: source.kind === 'memory' ? 'warning.main' : 'text.secondary',
              border: 1, borderColor: source.kind === 'memory' ? 'warning.main' : 'divider',
            }}
          >
            {sourceLabel(source, s)}
          </Typography>
        </Tooltip>
      )}
      {onChooseWorkingDirectory && (
        <Button size="small" color="inherit" onClick={onChooseWorkingDirectory} sx={quiet}>
          {s(source?.kind === 'folder' ? 'picker.changeFolder' : 'picker.chooseFolder')}
        </Button>
      )}
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
                : agent.status.kind === 'listening' ? 'text.secondary' : 'text.disabled',
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
    <Stack direction="row" spacing={1} alignItems="flex-end" sx={{ maxWidth: 480 }}>
      <TextField
        fullWidth
        variant="standard"
        label={s('org.nameThis')}
        value={name}
        inputProps={{ 'data-testid': 'organisation-name-field' }}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onName(name) }}
      />
      <Button size="small" variant="contained" disabled={!name.trim()} onClick={() => onName(name)}>
        {s('settings.save')}
      </Button>
    </Stack>
  )
}
