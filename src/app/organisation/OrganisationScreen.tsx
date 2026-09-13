/**
 * The first screen: the organisation's home.
 *
 * Not a list of projects. The picker this replaces asked "which document do you
 * want to be in", which was the right question while a project was the only
 * thing that could hold anything; since format 5 the root of a working folder
 * is itself a scope (ADR-0012 §1) — it has a name, a client, links, a
 * description, decisions, plans and a business architecture of its own — and a
 * screen that listed what is filed *under* it while showing none of that was
 * describing the folder rather than the organisation.
 *
 * So: the root's identity at the top, its own pages as cards, the tree beneath,
 * and the examples last and small. The root is never a row in its own tree.
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
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { LOCALE } from '../../i18n'
import { plural } from '../../i18n/strings'
import type { Language, Translate } from '../../i18n'
import { countScopes, newestChange, sortScopes } from '../../projects/scope'
import type { ProjectOrder, ScopeSummary } from '../../projects/scope'
import type { ElementId } from '../../model'
import type { Finding } from '../../projects/checks'
import { ROOT_SCOPE } from '../../projects/scopePath'
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
import { agentTip, sourceLabel } from '../ShellToolbar'
import { NewScopeDialog } from './NewScopeDialog'
import { registerSummary } from './register'
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
   * Where the scopes are kept, said the way the workspace's bar says it. Absent
   * folder controls in a browser tab whose browser cannot give one: a button
   * that cannot work is worse than no button.
   */
  source?: WorkingSource
  onChooseWorkingDirectory?: () => void
  /** The menu, for a host that has no menu bar — where theme and language are. */
  overflow?: ToolbarOverflow
  agent?: ToolbarAgent
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
   * the card and the page alike. Empty means nothing has been read yet, which
   * on this screen is the same as an organisation with no applications in it —
   * and the page says so in a sentence either way.
   */
  register?: readonly RegisterRow[]
  /** How many plans below the root are initiatives (ADR-0012 §7), off the same index. */
  initiatives?: number
  /** Open a row where it is answered for, with the element selected. */
  onOpenRegisterRow?: (scope: ScopePath, id: ElementId) => void
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
  overflow, agent, findings, register = [], initiatives = 0, onOpenRegisterRow, onLinkFromRegister,
  today, language, s, windowChrome = NO_WINDOW_CHROME,
}: OrganisationScreenProps) {
  const { tree, root, ready, dialog } = organisation
  /**
   * The register is a page of its own, opened from its card — state here and
   * not in the hook, because it is the one page on this screen that neither
   * writes nor asks a store anything.
   */
  const [registerOpen, setRegisterOpen] = useState(false)

  /**
   * Ordered here and not in the store: the order is what this screen shows, and
   * the toggle has to change it without a round trip to storage.
   */
  const ordered = useMemo<ScopeSummary>(
    () => ({ ...tree, children: sortScopes(tree.children, order) }),
    [tree, order],
  )
  const pages = useMemo(() => organisationPages(root, today), [root, today])
  const registerCounts = useMemo(() => registerSummary(register), [register])
  const counts = useMemo(() => countScopes(tree), [tree])
  const changed = useMemo(() => newestChange(tree), [tree])

  const named = tree.name.trim().length > 0
  const quiet = { fontSize: 11, minWidth: 0, px: 1, color: 'text.secondary' } as const

  return (
    <Box sx={{
      height: '100vh', width: '100vw', overflowY: 'auto',
      bgcolor: 'background.default', display: 'flex', flexDirection: 'column',
    }}>
      <OrganisationBar
        tree={tree}
        source={source}
        onChooseWorkingDirectory={onChooseWorkingDirectory}
        onSettings={() => organisation.editScope(tree)}
        overflow={overflow}
        agent={agent}
        s={s}
        windowChrome={windowChrome}
      />

      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 4 }}>
        <Box sx={{ maxWidth: 980, mx: 'auto' }}>
          {/* Identity. A folder nobody has named asks for a name where the
              heading would be, rather than showing a blank one. */}
          {named ? (
            <Typography sx={{ fontSize: 28, fontWeight: 500 }} data-testid="organisation-name">
              {tree.name}
            </Typography>
          ) : (
            <NameTheOrganisation onName={organisation.nameOrganisation} s={s} />
          )}

          <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }} data-testid="organisation-meta">
            {[
              // The client only where it differs: "For Acme Logistics" under
              // the heading "Acme Logistics" says nothing twice.
              tree.client?.trim() && tree.client.trim() !== tree.name.trim()
                ? s('org.forClient', { name: tree.client.trim() })
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

          {tree.description && (
            <Typography sx={{ fontSize: 13, mt: 1.5, maxWidth: 720 }}>
              {tree.description}
            </Typography>
          )}

          {tree.links && tree.links.length > 0 && (
            <Stack direction="row" spacing={0.75} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.75 }}>
              {tree.links.map((link) => (
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

          <Box sx={{ mt: 3 }}>
            <OrganisationCards
              pages={pages}
              ready={ready}
              onOpenBusiness={() => organisation.open(
                ROOT_SCOPE,
                { page: 'sheet', ...(pages.business.sheetId ? { id: pages.business.sheetId } : {}) },
              )}
              onOpenMap={() => organisation.open(
                ROOT_SCOPE,
                { page: 'map', ...(pages.business.mapId ? { id: pages.business.mapId } : {}) },
              )}
              onOpenDecisions={() => organisation.open(ROOT_SCOPE, { page: 'decisions' })}
              onOpenRoadmap={() => organisation.open(ROOT_SCOPE, { page: 'roadmap' })}
              register={registerCounts}
              initiatives={initiatives}
              onOpenRegister={() => setRegisterOpen(true)}
              s={s}
            />
          </Box>

          {/* The tree. A fresh folder has none, and says so with the examples
              underneath rather than with an empty heading. */}
          {tree.children.length > 0 && (
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
                <Button size="small" variant="contained" onClick={() => organisation.addUnder(ROOT_SCOPE)}>
                  {s('picker.newScope')}
                </Button>
              </Stack>
              <ScopeTree
                tree={ordered}
                collapsed={organisation.collapsed}
                onToggleCollapsed={organisation.toggleCollapsed}
                onOpen={(path) => organisation.open(path)}
                onAddUnder={organisation.addUnder}
                onSettings={organisation.editScope}
                onDelete={organisation.askDelete}
                findings={findings}
                language={language}
                s={s}
              />
            </>
          )}
          {tree.children.length === 0 && (
            <Button size="small" variant="contained" onClick={() => organisation.addUnder(ROOT_SCOPE)}>
              {s('picker.newScope')}
            </Button>
          )}

          {examples.length > 0 && (
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
        rows={register}
        organisation={tree.name.trim() || s('picker.organisation')}
        onOpen={onOpenRegisterRow}
        onLink={onLinkFromRegister}
        s={s}
        windowChrome={windowChrome}
      />
      <NewScopeDialog
        open={dialog.kind === 'newScope'}
        tree={ordered}
        parent={dialog.kind === 'newScope' ? dialog.parent : ROOT_SCOPE}
        name={dialog.kind === 'newScope' ? dialog.name : ''}
        onParentChange={organisation.setNewScopeParent}
        onNameChange={organisation.setNewScopeName}
        onCancel={organisation.closeDialog}
        onCreate={organisation.create}
        s={s}
      />
      <ScopeSettingsDialog
        target={dialog.kind === 'settings' ? dialog.target : undefined}
        tree={ordered}
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
    </Box>
  )
}

/**
 * The bar, the way the workspace has one.
 *
 * The same left-to-right reading ADR-0005 asks for — what you are looking at,
 * then what you can do to it, then where it is kept — and the same window
 * chrome duties: keep clear of the traffic lights, and be the surface the
 * window is dragged by.
 */
function OrganisationBar({
  tree, source, onChooseWorkingDirectory, onSettings, overflow, agent, s, windowChrome,
}: {
  tree: ScopeSummary
  source?: WorkingSource
  onChooseWorkingDirectory?: () => void
  onSettings: () => void
  overflow?: ToolbarOverflow
  agent?: ToolbarAgent
  s: Translate
  windowChrome: WindowChrome
}) {
  const quiet = { fontSize: 11, minWidth: 0, px: 1, color: 'text.secondary' } as const
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
      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
        {tree.name.trim() || s('picker.organisation')}
      </Typography>
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
        {s(SCOPE_KIND_LABEL[tree.kind ?? 'organisation'])}
      </Typography>
      <Tooltip title={s('group.openFor', { name: tree.name.trim() || s('picker.organisation') })}>
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
