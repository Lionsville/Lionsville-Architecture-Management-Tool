/**
 * The organisation screen's wiring: what it may do, which dialog is up, and
 * where a person lands on leaving it.
 *
 * A page's wiring is a hook, not a stretch of the workspace (`CLAUDE.md`), and
 * this screen is the case that rule was written for: the tree, the root's own
 * document, five dialogs, a collapsed set and four store operations would
 * otherwise be a dozen `useState`s in `App`. `App` composes it and renders.
 *
 * What it owns that the picker's caller used to:
 *
 * - **the tree**, and re-reading it after every write;
 * - **the root's own document**, loaded once and again after a refresh, because
 *   the cards' counts are not in a listing (`organisationPages`);
 * - **creating a scope**, ancestors included — a folder with no `scope.json` is
 *   not a scope (ADR-0012 §1), so a child filed under one is filed under
 *   nothing;
 * - **a scope's record**, read-patch-write so the content survives a settings
 *   save, and — when the parent changed — save-then-remove over the whole
 *   subtree;
 * - **opening**, which is where a person lands on leaving this screen.
 *
 * What it does not own: the toasts, the trail and the theme, which outlive one
 * screen and arrive as the narrowest callbacks that will do.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { StringKey, Translate } from '../../i18n'
import {
  bareScope, emptyScope, flattenScopes, movedPaths, namesUnder, scopeTree,
} from '../../projects/scope'
import type { ScopeSnapshot, ScopeSummary } from '../../projects/scope'
import { claimKey, idsIn } from '../../model/keys'
import type { DesignDiagram } from '../../model'
import { isBoardKind } from '../../model/placement'
import { normaliseLinks } from '../../projects/links'
import { applyRefPatch } from '../../projects/readdress'
import type { RefPatch } from '../../projects/readdress'
import { reasonOf } from '../../platform/errors'
import {
  ancestorScopes, parentScope, ROOT_SCOPE, scopePathFor, scopePathLabel,
} from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { carryRefs } from '../carryRefs'
import { copyExampleInto } from '../examples'
import type { ExampleProject } from '../examples'
import type { InitialPage, ScopeLibrary, ScopeSettingsPatch } from '../App'

/** Which dialog is up. One at a time, because they all ask about one scope. */
export type OrganisationDialog =
  | { kind: 'none' }
  /** `withBoard` off makes a domain on purpose — a scope that files others and draws nothing itself. */
  | { kind: 'newScope'; parent: ScopePath; name: string; withBoard: boolean }
  /** A landscape for a scope that is already there, at any level (ADR-0012 §1). */
  | { kind: 'newBoard'; path: ScopePath; name: string }
  | { kind: 'settings'; target: ScopeSummary }
  | { kind: 'delete'; target: ScopeSummary }
  /** One board of a scope, from the table on its home. */
  | { kind: 'deleteBoard'; path: ScopePath; board: { id: string; name: string } }

export type UseOrganisationInput = {
  scopes: ScopeLibrary
  /**
   * Is this screen the one on show?
   *
   * The tree is read whatever is up, because the open workspace's settings
   * dialog offers it as a parent to file under. The **home scope's own
   * document** is read only while this screen is up: it is a whole model, and
   * loading one behind a canvas nobody is looking at is the shape ADR-0004
   * keeps catching.
   */
  active: boolean
  /**
   * Whose home the screen is: the root's, or a scope's beneath it.
   *
   * Every scope is the same document (ADR-0012 §1), so every scope has the
   * same home — its identity, its own pages as cards, and the tree filed under
   * it. The root's is the organisation screen; a domain's is the same screen
   * one level down, reached from a crumb on the bar or a row in the tree.
   */
  at: ScopePath
  /**
   * Enter a scope, on the page it was opened for. The hook decides WHICH scope
   * and which page; what entering means — the preference, the remount — is the
   * shell's.
   */
  onEnter: (scope: ScopeSnapshot, page?: InitialPage) => void
  notify: (message: string, severity: 'success' | 'error' | 'warning') => void
  onFailure: (where: string, cause: unknown, key?: StringKey) => void
  /** Latched storage notice: a store that refuses says so once, standing. */
  onStorageResult: (ok: boolean) => void
  s: Translate
}

export type Organisation = {
  /** The whole tree, root first. Re-read after every write. */
  tree: ScopeSummary
  /** Whose home this is. */
  at: ScopePath
  /**
   * The home scope's own document, for the cards. `undefined` until it has
   * been read once — which `ready` is what tells a screen apart from an empty
   * scope.
   */
  root: ScopeSnapshot | undefined
  ready: boolean
  refresh: () => void
  dialog: OrganisationDialog
  /** Which scopes are folded shut. Per session: a fold is not a preference. */
  collapsed: ReadonlySet<ScopePath>
  toggleCollapsed: (path: ScopePath) => void
  addUnder: (parent: ScopePath) => void
  editScope: (target: ScopeSummary) => void
  askDelete: (target: ScopeSummary) => void
  closeDialog: () => void
  setNewScopeName: (name: string) => void
  setNewScopeParent: (parent: ScopePath) => void
  setNewScopeWithBoard: (withBoard: boolean) => void
  create: () => void
  /**
   * Give a scope a board of its own. The organisation's, a domain's or a
   * team's: a landscape is a scope that draws, and nothing in the tree says
   * which scopes may (§1) — which is why the dialog is on every home and not
   * only on one that already draws.
   */
  addBoard: (path: ScopePath) => void
  setNewBoardName: (name: string) => void
  createBoard: () => void
  /**
   * Take a board off a scope, from the table on its home. The only place a
   * container diagram can be deleted: it is not a tab, so the tab menu that
   * deletes a landscape never reaches it.
   */
  askDeleteBoard: (path: ScopePath, board: { id: string; name: string }) => void
  confirmDeleteBoard: () => void
  applySettings: (path: ScopePath, patch: ScopeSettingsPatch) => void
  confirmDelete: () => void
  open: (path: ScopePath, page?: InitialPage) => void
  copyExample: (example: ExampleProject) => void
  /** Give the root a name, from the field a fresh folder shows instead of a heading. */
  nameOrganisation: (name: string) => void
}

export function useOrganisation({
  scopes, active, at, onEnter, notify, onFailure, onStorageResult, s,
}: UseOrganisationInput): Organisation {
  const [tree, setTree] = useState<ScopeSummary>(() => scopeTree([]))
  const [root, setRoot] = useState<ScopeSnapshot | undefined>(undefined)
  const [ready, setReady] = useState(false)
  const [dialog, setDialog] = useState<OrganisationDialog>({ kind: 'none' })
  const [collapsed, setCollapsed] = useState<ReadonlySet<ScopePath>>(() => new Set())
  const [revision, setRevision] = useState(0)

  const refresh = useCallback(() => setRevision((held) => held + 1), [])

  /**
   * How a failure is reported is not an input to reading the tree.
   *
   * Read through a ref so it cannot re-trigger the effect below: `onFailure`
   * hangs off the toasts and the language and changes identity as they do, and
   * a dependency that changes on render is not a needless read but an endless
   * one — the same reason `App` keeps its own `failed` in a ref.
   */
  const failedRef = useRef(onFailure)
  failedRef.current = onFailure

  /**
   * The listing, and the home scope's own document beside it.
   *
   * Two reads and not one per card. An empty tree and a tree that would not
   * read look identical on this screen, and one of them means "you have nothing
   * here" while the other means "your work is still there, somewhere" — so a
   * refusal says which. A different home is a different document, so the
   * read runs again when the crumb changes — and `ready` drops first, so the
   * cards do not say a domain's numbers under the organisation's name.
   */
  useEffect(() => {
    let live = true
    void scopes.list().then(
      (held) => { if (live) setTree(held) },
      (cause: unknown) => {
        if (!live) return
        setTree(scopeTree([]))
        failedRef.current('organisation.list', cause, 'picker.listFailed')
      },
    )
    if (!active) return () => { live = false }
    setReady(false)
    void scopes.load(at).then(
      (held) => { if (live) { setRoot(held); setReady(true) } },
      (cause: unknown) => {
        if (!live) return
        setRoot(undefined)
        setReady(true)
        // No message: what the cards count is decoration beside a tree that is
        // perfectly readable, and the trail still takes the cause.
        failedRef.current('organisation.root', cause)
      },
    )
    return () => { live = false }
  }, [scopes, active, at, revision])

  const toggleCollapsed = useCallback((path: ScopePath) => {
    setCollapsed((held) => {
      const next = new Set(held)
      if (!next.delete(path)) next.add(path)
      return next
    })
  }, [])

  const addUnder = useCallback((parent: ScopePath) => {
    setDialog({ kind: 'newScope', parent, name: '', withBoard: true })
  }, [])
  const editScope = useCallback((target: ScopeSummary) => setDialog({ kind: 'settings', target }), [])
  const askDelete = useCallback((target: ScopeSummary) => setDialog({ kind: 'delete', target }), [])
  const closeDialog = useCallback(() => setDialog({ kind: 'none' }), [])
  const setNewScopeName = useCallback((name: string) => {
    setDialog((held) => (held.kind === 'newScope' ? { ...held, name } : held))
  }, [])
  const setNewScopeParent = useCallback((parent: ScopePath) => {
    setDialog((held) => (held.kind === 'newScope' ? { ...held, parent } : held))
  }, [])
  const setNewScopeWithBoard = useCallback((withBoard: boolean) => {
    setDialog((held) => (held.kind === 'newScope' ? { ...held, withBoard } : held))
  }, [])
  const addBoard = useCallback((path: ScopePath) => {
    setDialog({ kind: 'newBoard', path, name: s('shell.newDiagram') })
  }, [s])
  const setNewBoardName = useCallback((name: string) => {
    setDialog((held) => (held.kind === 'newBoard' ? { ...held, name } : held))
  }, [])

  /** A new scope exists as soon as it is saved; otherwise a refresh loses it. */
  const createAndEnter = useCallback((fresh: ScopeSnapshot, message: string) => {
    void scopes.save(fresh).then(
      () => { onEnter(fresh); refresh(); notify(message, 'success') },
      (cause: unknown) => { onFailure('organisation.create', cause); onStorageResult(false) },
    )
  }, [scopes, onEnter, refresh, notify, onFailure, onStorageResult])

  /**
   * Create a scope under another one.
   *
   * **The ancestors are created too** when they are not there: a folder with no
   * `scope.json` is not a scope, so a child filed under one would be filed
   * under nothing and nothing would list it. Written from the top down and
   * before the new scope itself, so an interrupted run leaves a tree that is
   * whole as far as it got.
   */
  const create = useCallback(() => {
    if (dialog.kind !== 'newScope') return
    const wanted = { parent: dialog.parent, name: dialog.name.trim(), withBoard: dialog.withBoard }
    if (!wanted.name) return
    setDialog({ kind: 'none' })
    void scopes.list().then(async (held) => {
      const all = flattenScopes(held)
      const parent = all.find((scope) => scope.path === wanted.parent)
      const path = scopePathFor(wanted.parent, wanted.name, namesUnder(parent))
      try {
        for (const missing of ancestorScopes(path).reverse()) {
          if (missing === ROOT_SCOPE || all.some((scope) => scope.path === missing)) continue
          await scopes.save(bareScope(missing, scopePathLabel(missing), 'domain'))
        }
      } catch (cause) {
        onFailure('organisation.ancestors', cause)
        onStorageResult(false)
        return
      }
      // A scope that draws is a landscape and one that does not is a domain
      // (§1) — labels for a screen, said here from what the person asked for
      // rather than read back later from the shape.
      createAndEnter(
        wanted.withBoard
          ? emptyScope(path, { design: wanted.name, diagram: s('shell.newDiagram') }, 'landscape')
          : bareScope(path, wanted.name, 'domain'),
        s('shell.scopeCreated', { name: wanted.name }),
      )
    }, (cause: unknown) => {
      // A list that will not read is a store refusing, so the standing storage
      // notice is the honest message — and it is latched, so a burst says it once.
      onFailure('organisation.create.list', cause)
      onStorageResult(false)
    })
  }, [dialog, scopes, createAndEnter, onFailure, onStorageResult, s])

  /**
   * Add a board to a scope that is already there, and land on it.
   *
   * Read-patch-write like the settings dialog, because the home is outside
   * any session: there is no stack to put a `diagram.create` on until the
   * scope is open, and it is opened on the board just made. The id is the key
   * the file would give it, claimed against everything the document already
   * names, so a second landscape beside the first is `landscape-2` and not a
   * collision. A scope the store no longer has is made on the spot — its
   * `scope.json` may have gone under us — rather than refused.
   */
  const createBoard = useCallback(() => {
    if (dialog.kind !== 'newBoard') return
    const wanted = { path: dialog.path, name: dialog.name.trim() }
    if (!wanted.name) return
    setDialog({ kind: 'none' })
    void (async () => {
      const held = await scopes.load(wanted.path) ?? bareScope(wanted.path, scopePathLabel(wanted.path))
      const diagram: DesignDiagram = {
        id: claimKey(s('shell.newDiagram'), new Set(idsIn(held.model))),
        kind: 'layer7', name: wanted.name, members: [], geometry: { nodes: [] },
        ...(held.model.defaultAspectConfig ? { aspectConfig: [...held.model.defaultAspectConfig] } : {}),
      }
      const next: ScopeSnapshot = {
        ...held,
        model: { ...held.model, diagrams: [...held.model.diagrams, diagram] },
        activeDiagramId: diagram.id,
      }
      await scopes.save(next)
      onEnter(next, { page: 'board', id: diagram.id })
      refresh()
      notify(s('shell.scopeCreated', { name: wanted.name }), 'success')
    })().catch((cause: unknown) => {
      onFailure('organisation.board', cause)
      onStorageResult(false)
    })
  }, [dialog, scopes, onEnter, refresh, notify, onFailure, onStorageResult, s])

  const askDeleteBoard = useCallback((path: ScopePath, board: { id: string; name: string }) => {
    setDialog({ kind: 'deleteBoard', path, board })
  }, [])

  /**
   * Read-patch-write, like making a board: the home is outside any session.
   * The active board moves on to the first that remains, so a scope entered
   * next does not start on a board that is not there.
   */
  const confirmDeleteBoard = useCallback(() => {
    if (dialog.kind !== 'deleteBoard') return
    const { path, board } = dialog
    setDialog({ kind: 'none' })
    void (async () => {
      const held = await scopes.load(path)
      if (!held) return
      const diagrams = held.model.diagrams.filter((diagram) => diagram.id !== board.id)
      const next: ScopeSnapshot = {
        ...held,
        model: { ...held.model, diagrams },
        activeDiagramId: held.activeDiagramId === board.id
          ? diagrams.find((diagram) => isBoardKind(diagram.kind))?.id ?? ''
          : held.activeDiagramId,
      }
      await scopes.save(next)
      refresh()
      notify(s('shell.deleted', { name: board.name }), 'success')
    })().catch((cause: unknown) => {
      onFailure('organisation.deleteBoard', cause)
      onStorageResult(false)
    })
  }, [dialog, scopes, refresh, notify, onFailure, onStorageResult, s])

  /**
   * Apply a scope's edited record: what it is called, what it is, who its
   * drawings are made out to, where its material lives — and where it is filed.
   *
   * Read-patch-write, so a scope's model, decisions and plans survive a save
   * this dialog cannot see. A **move** is the one part that is not one write:
   * the address changes, `ScopeStore.remove` takes a scope AND everything under
   * it, so every scope in the subtree is written at its new address first and
   * the old folder removed after. Removing first and failing to save would lose
   * the lot.
   */
  const applySettings = useCallback((path: ScopePath, patch: ScopeSettingsPatch) => {
    void (async () => {
      const listing = await scopes.list()
      const all = flattenScopes(listing)
      const subtree = all.find((scope) => scope.path === path)
      const from = parentScope(path) ?? ROOT_SCOPE
      const moving = patch.parent !== undefined && patch.parent !== from && path !== ROOT_SCOPE
      const to = moving
        ? scopePathFor(
          patch.parent!,
          scopePathLabel(path),
          namesUnder(all.find((scope) => scope.path === patch.parent)),
        )
        : path

      let held: ScopeSnapshot | undefined
      try {
        held = await scopes.load(path)
      } catch (cause) {
        onFailure('organisation.settings.load', cause, 'group.saveFailed')
        return
      }
      const links = normaliseLinks(patch.links)
      const next: ScopeSnapshot = {
        ...(held ?? bareScope(path, patch.name)),
        path: to,
        model: {
          ...(held?.model ?? bareScope(path, patch.name).model),
          name: patch.name.trim() || scopePathLabel(path),
          ...(patch.description?.trim()
            ? { description: patch.description.trim() }
            : { description: undefined }),
        },
        ...(patch.client?.trim() ? { client: patch.client.trim() } : { client: undefined }),
        ...(links.length ? { links } : { links: undefined }),
        ...(patch.kind ? { kind: patch.kind } : {}),
      }
      // Absent rather than set to `undefined`, so the file has the shape a
      // hand-written one would.
      if (next.model.description === undefined) delete next.model.description
      if (next.client === undefined) delete next.client
      if (next.links === undefined) delete next.links

      /**
       * A ref is an address, so a move carries the ones pointing into it
       * (ADR-0012 §3). The scopes OUTSIDE the subtree are written by this call;
       * what comes back is what the subtree's own scopes should say, applied
       * below as each is written at its new address. A failure here is a move
       * that has not started, which is why it has a guard of its own.
       */
      let carried = new Map<ScopePath, RefPatch>()
      if (moving) {
        try {
          carried = await carryRefs({ scopes, from: path, to })
        } catch (cause) {
          onFailure('organisation.settings.readdress', cause, 'group.saveFailed')
          return
        }
      }

      try {
        await scopes.save(applyRefPatch(next, carried.get(path)))
        if (moving && subtree) {
          // The scope itself is already written; what is left is everything
          // filed under it, parents first.
          for (const pair of movedPaths(subtree, to).slice(1)) {
            const child = await scopes.load(pair.from)
            if (child) await scopes.save(applyRefPatch({ ...child, path: pair.to }, carried.get(pair.from)))
          }
        }
      } catch (cause) {
        onFailure('organisation.settings.save', cause, 'group.saveFailed')
        return
      }

      if (moving) {
        // Inside its own guard: the saves have landed, so the subtree exists at
        // both addresses, and a remove that throws here leaves a duplicate
        // rather than a loss. The move itself still counts as done.
        try {
          await scopes.remove(path)
        } catch (cause) {
          onFailure('organisation.settings.remove', cause)
          notify(s('shell.moveLeftCopy', { message: reasonOf(cause) }), 'warning')
        }
      }

      refresh()
      notify(
        moving
          ? s('settings.moved', { name: next.model.name })
          : held && held.model.name !== next.model.name
            ? s('group.renamed', { name: next.model.name })
            : s('group.saved', { name: next.model.name }),
        'success',
      )
    })().catch((cause: unknown) => {
      // A backstop, not a handler: everything above is caught where it can be
      // answered. A throw that reaches here happened in the synchronous tail,
      // which no boundary can see from inside an async function.
      onFailure('organisation.settings', cause, 'group.saveFailed')
    })
  }, [scopes, refresh, notify, onFailure, s])

  const confirmDelete = useCallback(() => {
    if (dialog.kind !== 'delete') return
    const target = dialog.target
    setDialog({ kind: 'none' })
    void scopes.remove(target.path).then(
      refresh,
      (cause: unknown) => onFailure('organisation.remove', cause, 'picker.deleteFailed'),
    )
  }, [dialog, scopes, refresh, onFailure])

  /**
   * Where a person lands on leaving this screen.
   *
   * A scope that draws nothing is an ordinary scope (ADR-0012 §1) and this is
   * the screen that can open one: the card that asked for it names the page,
   * and the workspace shows that page over a canvas with nothing on it. Without
   * a page named, a scope with no views has nothing to show, so the tree offers
   * *Open* only on one that draws.
   */
  const open = useCallback((path: ScopePath, page?: InitialPage) => {
    void scopes.load(path).then(
      (found) => {
        if (!found) {
          notify(s('picker.loadFailed'), 'error')
          refresh()
          return
        }
        onEnter(found, page)
      },
      (cause: unknown) => onFailure('organisation.open', cause, 'picker.loadFailed'),
    )
  }, [scopes, onEnter, notify, refresh, onFailure, s])

  /**
   * An example is a starting point, not a document you keep opening. Where the
   * copy lands is `copyExampleInto`'s answer; what is here is the writing of
   * it, parents first, and landing the person in the scope that has the work in
   * it rather than in the name above it.
   */
  const copyExample = useCallback((example: ExampleProject) => {
    void (async () => {
      const copy = copyExampleInto(example, tree)
      // A shipped example this build cannot read is a bug the example tests
      // exist to prevent, so it reaches here as nothing rather than as a crash.
      if (copy.length === 0) {
        onFailure('organisation.copyExample', new Error('the example did not read'))
        return
      }
      const existing = await scopes.load(copy[copy.length - 1].path)
      if (existing) { onEnter(existing); return }
      for (const scope of copy.slice(0, -1)) await scopes.save(scope)
      createAndEnter(copy[copy.length - 1], s('shell.exampleCopied', { name: example.label }))
    })().catch((cause: unknown) => {
      onFailure('organisation.copyExample', cause)
      onStorageResult(false)
    })
  }, [tree, scopes, onEnter, createAndEnter, onFailure, onStorageResult, s])

  /**
   * The root's name, from the field a fresh folder shows instead of a heading.
   *
   * The same write as the settings dialog's, with one field in it: a person who
   * has just chosen a folder should be able to say whose landscape it is
   * without opening a dialog about a scope they have not met yet.
   */
  const nameOrganisation = useCallback((name: string) => {
    if (!name.trim()) return
    applySettings(ROOT_SCOPE, { name: name.trim() })
  }, [applySettings])

  return useMemo(() => ({
    tree, at, root, ready, refresh, dialog, collapsed, toggleCollapsed,
    addUnder, editScope, askDelete, closeDialog, setNewScopeName, setNewScopeParent,
    setNewScopeWithBoard, create, addBoard, setNewBoardName, createBoard,
    askDeleteBoard, confirmDeleteBoard,
    applySettings, confirmDelete, open, copyExample, nameOrganisation,
  }), [
    tree, at, root, ready, refresh, dialog, collapsed, toggleCollapsed,
    addUnder, editScope, askDelete, closeDialog, setNewScopeName, setNewScopeParent,
    setNewScopeWithBoard, create, addBoard, setNewBoardName, createBoard,
    askDeleteBoard, confirmDeleteBoard,
    applySettings, confirmDelete, open, copyExample, nameOrganisation,
  ])
}
