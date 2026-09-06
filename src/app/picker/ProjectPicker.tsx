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
import type { Language, StringKey, Translate } from '../../i18n'
import { groupProfileFor } from '../../projects/group'
import type { GroupProfile } from '../../projects/group'
import { groupsOf, sortProjects } from '../../projects/project'
import type { ProjectOrder, ProjectSummary } from '../../projects/project'
import { refPath, sameRef } from '../../projects/projectRef'
import type { ProjectRef } from '../../projects/projectRef'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import type { ExampleProject } from '../examples'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { NEW_GROUP, groupChoiceName } from './GroupField'
import type { GroupChoice } from './GroupField'
import { GroupSettingsDialog } from './GroupSettingsDialog'
import { NewGroupDialog } from './NewGroupDialog'
import { NewProjectDialog } from './NewProjectDialog'

/**
 * What the picker needs from a store: to see what is there, and to remove one.
 *
 * Not the whole `ProjectStore`. Opening and creating go through callbacks
 * instead, because both change which project the app is in — that is the
 * caller's decision, and a picker that could load a project itself would be
 * holding half of the navigation.
 */
export type ProjectCatalogue = {
  list(): Promise<ProjectSummary[]>
  remove(ref: ProjectRef): Promise<void>
}

/**
 * What the picker needs from the group store: to read the records. Narrower
 * than `GroupStore` — this screen has no business forgetting one, and a
 * component that could is one a reader has to check.
 */
export type GroupCatalogue = {
  list(): Promise<GroupProfile[]>
}

export type ProjectPickerProps = {
  projects: ProjectCatalogue
  groups: GroupCatalogue
  /**
   * Apply a group's edited record. Not done here: a rename has to relabel every
   * project filed under the group, which is the caller's store to write to.
   */
  onApplyGroupSettings: (profile: GroupProfile) => void
  examples: readonly ExampleProject[]
  order: ProjectOrder
  onOrderChange: (order: ProjectOrder) => void
  onOpen: (ref: ProjectRef) => void
  /**
   * Create a project. `group` is an existing group's slug when there is one, so
   * adding to a group you already work in cannot spawn a near-duplicate of it.
   */
  onCreate: (project: { group?: string; groupName: string; projectName: string }) => void
  onCopyExample: (example: ExampleProject) => void
  /**
   * Something on this screen failed.
   *
   * The picker knows WHICH failure it was and says so with a key; the caller
   * owns the trail and the toast bar. Without the key nothing is shown — a
   * group record that would not read costs a description, which is not worth
   * interrupting a perfectly readable list of projects for.
   */
  onFailure: (where: string, cause: unknown, key?: StringKey) => void
  /** Bumped by the caller after it creates something, to re-read the list. */
  revision?: number
  /**
   * The folder these projects are in, and how to change it.
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
    when: at.toLocaleString(language === 'nl' ? 'nl-NL' : 'en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }),
  })
}

export function ProjectPicker({
  projects, groups: groupCatalogue, onApplyGroupSettings, examples, order, onOrderChange,
  onOpen, onCreate, onCopyExample, onFailure,
  revision = 0, workingDirectory, onChooseWorkingDirectory,
  language, s, windowChrome = NO_WINDOW_CHROME,
}: ProjectPickerProps) {
  const [summaries, setSummaries] = useState<ProjectSummary[]>([])
  const [profiles, setProfiles] = useState<GroupProfile[]>([])
  const [groupToEdit, setGroupToEdit] = useState<GroupProfile | undefined>(undefined)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [group, setGroup] = useState<GroupChoice>({ selected: NEW_GROUP, newName: '' })
  const [groupName, setGroupName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [toDelete, setToDelete] = useState<ProjectSummary | null>(null)

  const refresh = useCallback(() => {
    // An empty list and a list that would not read look identical on this
    // screen, and one of them means "you have no projects" while the other
    // means "your projects are still there, somewhere". Say which.
    void projects.list().then(setSummaries, (cause: unknown) => {
      setSummaries([])
      onFailure('picker.list', cause, 'picker.listFailed')
    })
    // A group's record is decoration: failing to read it costs the description
    // and the links, never the list of projects. Trail only.
    void groupCatalogue.list().then(setProfiles, (cause: unknown) => {
      setProfiles([])
      onFailure('picker.groups', cause)
    })
  }, [projects, groupCatalogue, onFailure])

  useEffect(refresh, [refresh, revision])

  /**
   * Sorted here and not in the store: the order is what this screen shows, and
   * the toggle has to be able to change it without a round trip to storage.
   */
  const ordered = useMemo(() => sortProjects(summaries, order), [summaries, order])

  /**
   * Still derived from the projects — a record decorates a group, it never
   * conjures one — with whatever that group has said about itself folded in.
   */
  const groups = useMemo(
    () => groupsOf(ordered).map((entry) => ({
      ...entry,
      profile: groupProfileFor(entry.group, entry.name, profiles),
    })),
    [ordered, profiles],
  )

  /** Open "new project" with a group already chosen — the common case. */
  const addToGroup = useCallback((slug: string) => {
    setGroup({ selected: slug, newName: '' })
    setProjectName('')
    setNewProjectOpen(true)
  }, [])

  const confirmDelete = useCallback(() => {
    const target = toDelete
    setToDelete(null)
    if (!target) return
    void projects.remove(target.ref).then(
      refresh,
      (cause: unknown) => onFailure('picker.remove', cause, 'picker.deleteFailed'),
    )
  }, [toDelete, projects, refresh, onFailure])

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
          <Button
            onClick={() => { setGroupName(''); setProjectName(''); setNewGroupOpen(true) }}
          >
            {s('picker.newGroup')}
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setGroup({ selected: groups[0]?.group ?? NEW_GROUP, newName: '' })
              setProjectName('')
              setNewProjectOpen(true)
            }}
          >
            {s('picker.newProject')}
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

        {groups.length === 0 && (
          <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 2 }}>
            {s('picker.empty')}
          </Typography>
        )}

        {groups.map((entry) => (
          <Box key={entry.group} sx={{ mb: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
              <Typography sx={{
                fontSize: 11, fontWeight: 700, color: 'text.secondary',
                textTransform: 'uppercase', letterSpacing: 0.6, flex: 1,
              }}>
                {entry.profile.name}
              </Typography>
              <Tooltip title={s('group.openFor', { name: entry.profile.name })}>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => setGroupToEdit(entry.profile)}
                  sx={{ fontSize: 11, minWidth: 0, px: 1, color: 'text.secondary' }}
                  aria-label={s('group.openFor', { name: entry.profile.name })}
                >
                  {s('group.open')}
                </Button>
              </Tooltip>
              <Tooltip title={s('picker.addProject', { name: entry.profile.name })}>
                <Button
                  size="small"
                  onClick={() => addToGroup(entry.group)}
                  sx={{ fontSize: 11, minWidth: 0, px: 1 }}
                  aria-label={s('picker.addProject', { name: entry.profile.name })}
                >
                  + {s('picker.newProject')}
                </Button>
              </Tooltip>
            </Stack>
            {entry.profile.description && (
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
                {entry.profile.description}
              </Typography>
            )}
            {entry.profile.links && entry.profile.links.length > 0 && (
              <Stack direction="row" spacing={0.75} sx={{ mb: 0.75, flexWrap: 'wrap' }}>
                {entry.profile.links.map((link) => (
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
            <Stack spacing={0.75}>
              {entry.projects.map((summary) => (
                <Card key={refPath(summary.ref)} variant="outlined">
                  <Stack direction="row" alignItems="stretch">
                    <CardActionArea
                      onClick={() => onOpen(summary.ref)}
                      sx={{ px: 1.5, py: 1.25, flex: 1 }}
                    >
                      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{summary.name}</Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                        {whenChanged(summary.updatedAt, language, s)}
                      </Typography>
                    </CardActionArea>
                    <Tooltip title={s('picker.delete')}>
                      <IconButton
                        aria-label={`${s('picker.delete')} ${summary.name}`}
                        onClick={() => setToDelete(summary)}
                        sx={{ alignSelf: 'center', mr: 0.5, color: 'text.secondary' }}
                        size="small"
                      >
                        ✕
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Card>
              ))}
            </Stack>
          </Box>
        ))}

        <Divider sx={{ my: 3 }} />

        <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 1.5 }}>
          {s('picker.examples')}
        </Typography>
        <Stack spacing={0.75}>
          {examples.map((example) => {
            const already = summaries.some((summary) => sameRef(summary.ref, example.ref))
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

      <NewProjectDialog
        open={newProjectOpen}
        groups={groups}
        group={group}
        projectName={projectName}
        onGroupChange={setGroup}
        onProjectNameChange={setProjectName}
        onCancel={() => setNewProjectOpen(false)}
        onCreate={() => {
          setNewProjectOpen(false)
          onCreate({
            group: group.selected === NEW_GROUP ? undefined : group.selected,
            groupName: groupChoiceName(group, groups),
            projectName: projectName.trim(),
          })
          setProjectName('')
        }}
        s={s}
      />
      <GroupSettingsDialog
        target={groupToEdit}
        onCancel={() => setGroupToEdit(undefined)}
        onSave={(profile) => { setGroupToEdit(undefined); onApplyGroupSettings(profile) }}
        s={s}
      />
      <NewGroupDialog
        open={newGroupOpen}
        groups={groups}
        groupName={groupName}
        projectName={projectName}
        onGroupNameChange={setGroupName}
        onProjectNameChange={setProjectName}
        onCancel={() => setNewGroupOpen(false)}
        onCreate={() => {
          setNewGroupOpen(false)
          onCreate({ groupName: groupName.trim(), projectName: projectName.trim() })
          setGroupName('')
          setProjectName('')
        }}
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
