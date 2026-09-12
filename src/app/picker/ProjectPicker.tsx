/**
 * The first screen: which project do you want to be in?
 *
 * This replaces "the shipped document loads itself at boot". That was fine while
 * there was one landscape and one customer compiled into the shell; it is the
 * wrong first impression for a tool that gets handed to the people whose
 * landscape it describes. Now the app either reopens what you had open, or asks.
 *
 * Projects are shown under their group. Groups are flat here even though a ref's
 * group is a path — nesting is addressable already
 * (`{@link ../../core/projectRef}`), and this is the screen that grows a tree
 * when there is something to put in it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { LOCALE } from '../../i18n'
import type { Language, StringKey, Translate } from '../../i18n'
import { flattenScopes, scopeTree, sortScopes } from '../../projects/scope'
import type { ProjectOrder, ScopeSummary } from '../../projects/scope'
import { ROOT_SCOPE, scopeSegments } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import type { ExampleProject } from '../examples'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { NewScopeDialog } from './NewScopeDialog'
import { ScopeSettingsDialog } from './ScopeSettingsDialog'
import type { ScopeSettingsPatch } from '../App'

/**
 * What the picker needs from a store: to see what is there, and to remove one.
 *
 * Not the whole `ProjectStore`. Opening and creating go through callbacks
 * instead, because both change which project the app is in — that is the
 * caller's decision, and a picker that could load a project itself would be
 * holding half of the navigation.
 */
export type ScopeCatalogue = {
  list(): Promise<ScopeSummary>
  remove(path: ScopePath): Promise<void>
}

export type ProjectPickerProps = {
  scopes: ScopeCatalogue
  /**
   * Apply a scope's edited record. Not done here: a save is a read and a write
   * of the whole scope, which is the caller's store to reach.
   */
  onApplyScopeSettings: (path: ScopePath, patch: ScopeSettingsPatch) => void
  examples: readonly ExampleProject[]
  order: ProjectOrder
  onOrderChange: (order: ProjectOrder) => void
  onOpen: (path: ScopePath) => void
  /** Create a scope under another one. The parent always exists — the root does. */
  onCreate: (scope: { parent: ScopePath; name: string }) => void
  onCopyExample: (example: ExampleProject) => void
  /**
   * Something on this screen failed.
   *
   * The picker knows WHICH failure it was and says so with a key; the caller
   * owns the trail and the toast bar. Without the key nothing is shown — not
   * every failure is worth interrupting a perfectly readable list for.
   */
  onFailure: (where: string, cause: unknown, key?: StringKey) => void
  /** Bumped by the caller after it creates something, to re-read the list. */
  revision?: number
  /**
   * The folder these scopes are in, and how to change it.
   *
   * Both absent in a browser tab, which cannot offer a folder at all. The
   * callback present with no folder is a desktop that has not been given one
   * yet: the projects are in the app's own storage and the line below says so,
   * because "where is my work" is not a question anyone should have to guess at.
   */
  workingDirectory?: { name: string }
  onChooseWorkingDirectory?: () => void
  language: Language
  s: Translate
  /**
   * What the window leaves to this screen. The workspace has a toolbar to hand
   * the window; this screen has none, so when the title bar is hidden it lends
   * the window the strip of padding above its heading instead.
   */
  windowChrome?: WindowChrome
}

function whenChanged(updatedAt: string | undefined, language: Language, s: Translate): string {
  if (!updatedAt) return s('picker.never')
  const at = new Date(updatedAt)
  if (Number.isNaN(at.getTime())) return s('picker.never')
  return s('picker.changed', {
    when: at.toLocaleString(LOCALE[language], {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }),
  })
}

export function ProjectPicker({
  scopes, onApplyScopeSettings, examples, order, onOrderChange,
  onOpen, onCreate, onCopyExample, onFailure,
  revision = 0, workingDirectory, onChooseWorkingDirectory,
  language, s, windowChrome = NO_WINDOW_CHROME,
}: ProjectPickerProps) {
  const [tree, setTree] = useState<ScopeSummary>(() => scopeTree([]))
  const [toEdit, setToEdit] = useState<ScopeSummary | undefined>(undefined)
  const [newScopeOpen, setNewScopeOpen] = useState(false)
  const [parent, setParent] = useState<ScopePath>(ROOT_SCOPE)
  const [scopeName, setScopeName] = useState('')
  const [toDelete, setToDelete] = useState<ScopeSummary | null>(null)

  const refresh = useCallback(() => {
    // An empty tree and a tree that would not read look identical on this
    // screen, and one of them means "you have nothing here" while the other
    // means "your work is still there, somewhere". Say which.
    void scopes.list().then(setTree, (cause: unknown) => {
      setTree(scopeTree([]))
      onFailure('picker.list', cause, 'picker.listFailed')
    })
  }, [scopes, onFailure])

  useEffect(refresh, [refresh, revision])

  /**
   * Sorted here and not in the store: the order is what this screen shows, and
   * the toggle has to be able to change it without a round trip to storage.
   */
  const ordered = useMemo<ScopeSummary>(
    () => ({ ...tree, children: sortScopes(tree.children, order) }),
    [tree, order],
  )
  const everything = useMemo(() => flattenScopes(ordered), [ordered])

  /** Open "new scope" with a parent already chosen — the common case. */
  const addUnder = useCallback((path: ScopePath) => {
    setParent(path)
    setScopeName('')
    setNewScopeOpen(true)
  }, [])

  const confirmDelete = useCallback(() => {
    const target = toDelete
    setToDelete(null)
    if (!target) return
    void scopes.remove(target.path).then(
      refresh,
      (cause: unknown) => onFailure('picker.remove', cause, 'picker.deleteFailed'),
    )
  }, [toDelete, scopes, refresh, onFailure])

  return (
    <Box sx={{
      height: '100vh', width: '100vw', overflowY: 'auto',
      bgcolor: 'background.default', px: 3, py: 5,
    }}>
      {windowChrome.draggable && (
        // Nothing is drawn here and nothing sits under it — it is the top
        // padding, made grabbable, so a window with no title bar can still be
        // moved from the screen it opens on.
        <Box
          data-testid="window-drag-strip"
          sx={{
            position: 'fixed', top: 0, left: 0, right: 0, height: 32,
            WebkitAppRegion: 'drag',
          }}
        />
      )}
      <Box sx={{ maxWidth: 880, mx: 'auto' }}>
        <Stack direction="row" alignItems="flex-end" spacing={2} sx={{ mb: 3 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 24, fontWeight: 700 }}>{s('picker.title')}</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              {s('picker.subtitle')}
            </Typography>
          </Box>
          <Button variant="contained" onClick={() => addUnder(ROOT_SCOPE)}>
            {s('picker.newScope')}
          </Button>
        </Stack>

        {onChooseWorkingDirectory && (
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ mb: 2 }}
            data-testid="working-directory"
          >
            <Typography sx={{ fontSize: 12, color: 'text.secondary', flex: 1 }}>
              {workingDirectory
                ? s('picker.folder', { name: workingDirectory.name })
                : s('picker.noFolder')}
            </Typography>
            <Button size="small" onClick={onChooseWorkingDirectory}>
              {s(workingDirectory ? 'picker.changeFolder' : 'picker.chooseFolder')}
            </Button>
          </Stack>
        )}

        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, flex: 1 }}>
            {s('picker.yours')}
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
        </Stack>

        {everything.length === 1 && ordered.children.length === 0 && (
          <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 2 }}>
            {s('picker.empty')}
          </Typography>
        )}

        {everything.map((scope) => (
          <Box
            key={scope.path || ' root'}
            data-testid={`scope-${scope.path || 'root'}`}
            data-depth={scopeSegments(scope.path).length}
            sx={{ mb: 1.5, ml: scopeSegments(scope.path).length * 2 }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
              {scope.diagrams > 0 ? (
                <Card variant="outlined" sx={{ flex: 1 }}>
                  <CardActionArea
                    onClick={() => onOpen(scope.path)}
                    sx={{ px: 1.5, py: 1.25 }}
                  >
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                      {scope.name || s('picker.organisation')}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                      {whenChanged(scope.updatedAt, language, s)}
                    </Typography>
                  </CardActionArea>
                </Card>
              ) : (
                /* A scope that draws nothing is a heading: there is no canvas
                   to open, and everything filed under it is listed below. */
                <Typography sx={{
                  fontSize: 11, fontWeight: 700, color: 'text.secondary',
                  textTransform: 'uppercase', letterSpacing: 0.6, flex: 1,
                }}>
                  {scope.name || s('picker.organisation')}
                </Typography>
              )}
              <Tooltip title={s('group.openFor', { name: scope.name })}>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => setToEdit(scope)}
                  sx={{ fontSize: 11, minWidth: 0, px: 1, color: 'text.secondary' }}
                  aria-label={s('group.openFor', { name: scope.name })}
                >
                  {s('group.open')}
                </Button>
              </Tooltip>
              <Tooltip title={s('picker.addUnder', { name: scope.name })}>
                <Button
                  size="small"
                  onClick={() => addUnder(scope.path)}
                  sx={{ fontSize: 11, minWidth: 0, px: 1 }}
                  aria-label={s('picker.addUnder', { name: scope.name })}
                >
                  + {s('picker.newScope')}
                </Button>
              </Tooltip>
              {scope.path !== ROOT_SCOPE && (
                <Tooltip title={s('picker.delete')}>
                  <IconButton
                    aria-label={`${s('picker.delete')} ${scope.name}`}
                    onClick={() => setToDelete(scope)}
                    sx={{ color: 'text.secondary' }}
                    size="small"
                  >
                    ✕
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
            {scope.description && (
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
                {scope.description}
              </Typography>
            )}
            {scope.links && scope.links.length > 0 && (
              <Stack direction="row" spacing={0.75} sx={{ mb: 0.75, flexWrap: 'wrap' }}>
                {scope.links.map((link) => (
                  <Link
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    // `noopener` because the opened page gets a handle on this
                    // window otherwise, and the address came from a file that
                    // may have been written by somebody else.
                    rel="noopener noreferrer"
                    sx={{ fontSize: 11 }}
                  >
                    {link.label}
                  </Link>
                ))}
              </Stack>
            )}
          </Box>
        ))}

        <Divider sx={{ my: 3 }} />

        <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 1.5 }}>
          {s('picker.examples')}
        </Typography>
        <Stack spacing={0.75}>
          {examples.map((example) => {
            const already = everything.some((scope) => scope.path === example.path)
            return (
              <Card key={example.key} variant="outlined">
                <Stack direction="row" alignItems="center" sx={{ px: 1.5, py: 1.25 }} spacing={2}>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{example.label}</Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                      {example.description}
                    </Typography>
                  </Box>
                  <Button size="small" onClick={() => onCopyExample(example)}>
                    {already ? s('picker.open') : s('picker.copy')}
                  </Button>
                </Stack>
              </Card>
            )
          })}
        </Stack>
      </Box>

      <NewScopeDialog
        open={newScopeOpen}
        tree={ordered}
        parent={parent}
        name={scopeName}
        onParentChange={setParent}
        onNameChange={setScopeName}
        onCancel={() => setNewScopeOpen(false)}
        onCreate={() => {
          setNewScopeOpen(false)
          onCreate({ parent, name: scopeName.trim() })
          setScopeName('')
        }}
        s={s}
      />
      <ScopeSettingsDialog
        target={toEdit}
        onCancel={() => setToEdit(undefined)}
        onSave={(path, patch) => { setToEdit(undefined); onApplyScopeSettings(path, patch) }}
        s={s}
      />
      <ConfirmDialog
        open={toDelete !== null}
        title={s('picker.deleteTitle', { name: toDelete?.name ?? '' })}
        body={s('picker.deleteBody')}
        confirmLabel={s('common.delete')}
        cancelLabel={s('common.cancel')}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </Box>
  )
}
