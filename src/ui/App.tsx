/**
 * The shell. Two states: you are in a project, or you are choosing one.
 *
 * What used to be here — the session, the toolbar, the dialogs — moved to
 * {@link ProjectWorkspace}, because all of it only means something once a
 * project is open. What remains is the part that outlives a project: the theme,
 * the language, the toasts, and which project you are in.
 *
 * Every capability arrives as a prop, typed as the narrowest shape that will do.
 * `App` genuinely needs most of a store — it lists, loads, saves and removes —
 * but the hooks below it do not, and each asks for its own slice. Nothing here
 * knows whether a project lives in browser storage, on disk or on a server.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { translator } from '@lionsville/solution-design'
import {
  emptyProject, groupsOf, isProjectOrder, keysInGroup, moveToGroup, projectFromDocument,
  renameProject, setProjectDefaults,
} from '../core/project'
import type {
  ProjectGroup, ProjectOrder, ProjectSnapshot, ProjectSummary,
} from '../core/project'
import { refFor, sameRef } from '../core/projectRef'
import type { ProjectRef } from '../core/projectRef'
import { NO_WINDOW_CHROME } from '../core/windowChrome'
import type { WindowChrome } from '../core/windowChrome'
import type { ExampleProject } from '../examples'
import { ProjectPicker } from './picker/ProjectPicker'
import { ProjectWorkspace } from './ProjectWorkspace'
import type { ProjectSettings } from './ProjectSettingsDialog'
import { ToastBar } from './ToastBar'
import type { MakeId } from './useDiagramActions'
import type { ProjectFileChannel } from './useProjectFiles'
import { useShellPreferences } from './useShellPreferences'
import type { PreferencesWriter } from './useShellPreferences'
import { useStorageNotice } from './useStorageNotice'
import type { StorageNotice } from './useStorageNotice'
import { useToasts } from './useToasts'

/**
 * What `App` does to a store.
 *
 * Spelled out rather than named, so the workspace and the picker below can each
 * be handed a smaller slice of it and a reader can see that they were.
 */
export type ProjectLibrary = {
  list(): Promise<ProjectSummary[]>
  load(ref: ProjectRef): Promise<ProjectSnapshot | undefined>
  save(project: ProjectSnapshot): Promise<void>
  remove(ref: ProjectRef): Promise<void>
}

export type AppProps = {
  projects: ProjectLibrary
  preferences: PreferencesWriter
  documents: ProjectFileChannel

  /** Read by the composition root before the first render, so this can be sync. */
  initialProject: ProjectSnapshot | undefined
  initialPreferences: unknown

  examples: readonly ExampleProject[]
  /** Fresh ids. Injected because a clock inside a component cannot be tested. */
  makeId: MakeId
  /** What the browser reports; injected so a test can pin the starting language. */
  browserLanguages?: readonly string[] | string
  /**
   * What the window around the app leaves to us. On the desktop the title bar
   * is hidden, so our own top bar has to keep clear of the window controls and
   * be the thing you drag the window by. A browser tab needs neither.
   */
  windowChrome?: WindowChrome
}

export function App({
  projects, preferences, documents, initialProject, initialPreferences,
  examples, makeId, browserLanguages, windowChrome = NO_WINDOW_CHROME,
}: AppProps) {
  const toasts = useToasts()

  /**
   * Preferences and the storage notice need each other: writing a preference can
   * fail, and saying so needs the language, which is a preference. One late-bound
   * hop breaks the knot — the notice is looked up when it fires, not when the
   * writer is built.
   */
  const noticeRef = useRef<StorageNotice>(() => {})
  const reportStorage = useCallback<StorageNotice>((ok) => noticeRef.current(ok), [])

  const prefs = useShellPreferences({
    store: preferences,
    initial: initialPreferences,
    onWriteFailed: reportStorage,
    browserLanguages,
  })
  const s = useMemo(() => translator(prefs.language), [prefs.language])
  noticeRef.current = useStorageNotice(toasts.notify, s)

  const [project, setProject] = useState<ProjectSnapshot | undefined>(initialProject)
  /** Bumped whenever the set of projects changed, so the picker re-reads it. */
  const [revision, setRevision] = useState(0)

  const [order, setOrder] = useState<ProjectOrder>(() => {
    const stored = (prefs.preferences as Record<string, unknown> | undefined)?.projectOrder
    return isProjectOrder(stored) ? stored : 'name'
  })
  const chooseOrder = useCallback((next: ProjectOrder) => {
    setOrder(next)
    prefs.writePreference({ projectOrder: next })
  }, [prefs])

  /** Opening is what makes a project "last opened", so both happen here. */
  const enter = useCallback((next: ProjectSnapshot) => {
    setProject(next)
    prefs.writePreference({ lastProject: next.ref })
  }, [prefs])

  const openProject = useCallback((ref: ProjectRef) => {
    void projects.load(ref).then(
      (found) => {
        if (!found) { toasts.notify(s('picker.loadFailed'), 'error'); setRevision((r) => r + 1); return }
        enter(found)
      },
      () => toasts.notify(s('picker.loadFailed'), 'error'),
    )
  }, [projects, enter, toasts, s])

  const leaveProject = useCallback(() => {
    setProject(undefined)
    // Deliberately keeps `lastProject`: closing a project is not the same as
    // saying you never want to see it again, and a refresh should still land
    // you back in your work.
    setRevision((r) => r + 1)
  }, [])

  /** A new project exists as soon as it is saved; otherwise a refresh loses it. */
  const createAndEnter = useCallback((fresh: ProjectSnapshot, message: string) => {
    void projects.save(fresh).then(
      () => {
        enter(fresh)
        setRevision((r) => r + 1)
        toasts.notify(message, 'success')
      },
      () => reportStorage(false),
    )
  }, [projects, enter, toasts, reportStorage])

  /**
   * Create a project, in a group that exists or in a new one.
   *
   * `group` arrives as a slug when the picker had one to offer, so adding to a
   * group you already work in files it under exactly that group rather than
   * under whatever the name happens to slug to this time.
   */
  const createProject = useCallback((wanted: {
    group?: string; groupName: string; projectName: string
  }) => {
    void projects.list().then((existing) => {
      const group = wanted.group ?? refFor(wanted.groupName, wanted.projectName).group
      const ref = refFor(
        wanted.groupName, wanted.projectName, keysInGroup(existing, group))
      createAndEnter(
        emptyProject(
          { group, project: ref.project },
          wanted.groupName,
          { design: wanted.projectName, diagram: s('shell.newDiagram') },
        ),
        s('shell.projectCreated', { name: wanted.projectName }),
      )
    })
  }, [projects, createAndEnter, s])

  /** The groups that exist, for the pickers in both dialogs. */
  const [groups, setGroups] = useState<ProjectGroup[]>([])
  const refreshGroups = useCallback(() => {
    void projects.list().then((all) => setGroups(groupsOf(all)), () => setGroups([]))
  }, [projects])

  /**
   * Change a project's name, its group, or both.
   *
   * A rename edits the model in place. A move changes the ref, so the store has
   * to take the new address before it forgets the old one — that order matters:
   * removing first and then failing to save would lose the project outright.
   */
  const applyProjectSettings = useCallback((settings: ProjectSettings) => {
    if (!project) return
    void projects.list().then(async (existing) => {
      const targetGroup = settings.group
      const moving = targetGroup !== project.ref.group
      const named = setProjectDefaults(renameProject(project, settings.name), {
        author: settings.defaultAuthor,
        aspectConfig: settings.defaultAspectConfig,
      })
      let next = moving
        ? moveToGroup(named, targetGroup, settings.groupName)
        : { ...named, model: { ...named.model, customerName: settings.groupName } }

      if (moving) {
        // A key free in the old group can be taken in the new one.
        const taken = keysInGroup(existing, targetGroup)
        if (taken.includes(next.ref.project)) {
          next = { ...next, ref: refFor(settings.groupName, settings.name, taken) }
          next = { ...next, ref: { group: targetGroup, project: next.ref.project } }
        }
      }

      try {
        await projects.save(next)
      } catch {
        reportStorage(false)
        return
      }
      if (moving && !sameRef(project.ref, next.ref)) await projects.remove(project.ref)
      enter(next)
      setRevision((r) => r + 1)
      toasts.notify(
        moving
          ? s('settings.moved', { name: settings.groupName })
          : s('settings.renamed', { name: settings.name }),
        'success',
      )
    })
  }, [project, projects, enter, toasts, reportStorage, s])

  /**
   * An example is a starting point, not a document you keep opening. Copying it
   * into a project of your own is what makes it editable and savable; opening it
   * again later opens *your* copy, which is why an existing one wins here.
   */
  const copyExample = useCallback((example: ExampleProject) => {
    void projects.load(example.ref).then((existing) => {
      if (existing) { enter(existing); return }
      createAndEnter(
        projectFromDocument(example.document, example.ref, example.groupName),
        s('shell.exampleCopied', { name: example.label }),
      )
    })
  }, [projects, enter, createAndEnter, s])

  return (
    /* The theme lives here and not at module level: it hangs off state (light /
       dark / system) and must be able to change with it. CssBaseline sits inside
       it, because that is what paints the page background. */
    <ThemeProvider theme={prefs.theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
        {project ? (
          <ProjectWorkspace
            // Remounting on a project switch is the mechanism, not an accident:
            // the session's undo stack, aliases and pending batches belong to
            // one project and must not survive into another.
            key={`${project.ref.group}/${project.ref.project}`}
            project={project}
            projects={projects}
            documents={documents}
            notify={toasts.notify}
            onStorageResult={reportStorage}
            s={s}
            language={prefs.language}
            themeMode={prefs.themeMode}
            onCycleTheme={prefs.cycleTheme}
            onChooseLanguage={prefs.chooseLanguage}
            editorPreferences={prefs.preferences}
            onEditorPreferencesChange={prefs.savePreferences}
            onLeave={leaveProject}
            groups={groups}
            onOpenSettings={refreshGroups}
            onApplySettings={applyProjectSettings}
            makeId={makeId}
            windowChrome={windowChrome}
          />
        ) : (
          <ProjectPicker
            projects={projects}
            examples={examples}
            order={order}
            onOrderChange={chooseOrder}
            onOpen={openProject}
            onCreate={createProject}
            onCopyExample={copyExample}
            revision={revision}
            language={prefs.language}
            s={s}
            windowChrome={windowChrome}
          />
        )}
        <ToastBar
          toast={toasts.toast}
          open={toasts.open}
          onClose={toasts.close}
          onExited={toasts.exited}
        />
      </Box>
    </ThemeProvider>
  )
}
