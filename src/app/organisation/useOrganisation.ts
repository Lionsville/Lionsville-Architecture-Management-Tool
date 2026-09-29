// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
  bareScope, emptyScope, flattenScopes, namesUnder, scopeTree, unreadableAt,
} from '../../projects/scope'
import type { ScopeSnapshot, ScopeSummary } from '../../projects/scope'
import { claimKey, idsIn } from '../../model/keys'
import { removeContainerDiagram, toDiagram } from '../../model'
import type { Command, DesignDiagram } from '../../model'
import { isBoardKind } from '../../model/placement'
import { normaliseLinks } from '../../projects/links'
import { ShellError } from '../../platform/errors'
import {
  ancestorScopes, parentScope, ROOT_SCOPE, scopePathFor, scopePathLabel,
} from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import {
  blank, changeScope, ensureScope, landed, moveScope, nodeAt, readScope, summaryOf,
} from '../../projects/scopeAccess'
import type { ScopeCommand } from '../../projects/scopeState'
import type { Repositories } from '../../ports/Repositories'
import { opensOnNothing } from '../useShellNavigation'
import { exampleOf } from '../../projects/examples/catalogue'
import type { ExampleOffer } from '../../projects/examples/catalogue'
import { exampleCopyOver, placeCopy } from '../../projects/examples/copy'
import type { InitialPage, ScopeSettingsPatch } from '../App'

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
  /** Where the scopes are kept: the tree, each one's state, and the steps and moves that change them. */
  repositories: Pick<Repositories, 'scopes' | 'index' | 'images'>
  /**
   * A scope was written that was not there before — the example copied in,
   * a scope or a board created. The shell reads the index again on it: a
   * browser tab has no watcher to say so, and an index that never heard of
   * the landscape just copied in answers "nobody" for every application on
   * the organisation's map.
   */
  onTreeChanged?: () => void
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
  onKeptResult: (ok: boolean) => void
  /**
   * May this person change the scope at this path? What `open` asks before it
   * gives a scope with no document one (R2 below). Every scope may be written
   * where absent, which is every source that ships.
   */
  writable?: (path: ScopePath) => boolean
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
  /**
   * Whether the listing has been read at least once: before it has, a home it
   * does not hold yet is a home nobody has looked for, not one that is gone.
   */
  listed: boolean
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
  copyExample: (example: ExampleOffer) => void
  /** Give the root a name, from the field a fresh folder shows instead of a heading. */
  nameOrganisation: (name: string) => void
}

/** What a scope is called for a document made for it: its name in the listing, else its address's last word. */
function nameOf(tree: ScopeSummary, path: ScopePath): string {
  const listed = flattenScopes(tree).find((scope) => scope.path === path)?.name.trim()
  return listed || scopePathLabel(path)
}

/** A new scope refused because a scope nobody could read is at its address, or above it. */
function refuseInTheWay(onFailure: UseOrganisationInput['onFailure']): void {
  onFailure('organisation.create.unreadable', undefined, 'shell.unreadableInTheWay')
}

/**
 * The two reads this screen is drawn from: the tree, and the home's own
 * document.
 */
function useHomeReads({ scopes, active, at, revision, onFailure }: {
  scopes: Repositories['scopes']
  active: boolean
  at: ScopePath
  revision: number
  onFailure: UseOrganisationInput['onFailure']
}): { tree: ScopeSummary; root: ScopeSnapshot | undefined; ready: boolean; listed: boolean } {
  const [tree, setTree] = useState<ScopeSummary>(() => scopeTree([]))
  const [listed, setListed] = useState(false)
  const [root, setRoot] = useState<ScopeSnapshot | undefined>(undefined)
  const [ready, setReady] = useState(false)

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
   * refusal says which. Two effects: a crumb is another home in the same
   * tree, and one effect over both listed the whole tree on every crumb.
   */
  useEffect(() => {
    let live = true
    void scopes.tree().then(
      (held) => { if (live) { setTree(summaryOf(held)); setListed(true) } },
      (cause: unknown) => {
        if (!live) return
        setTree(scopeTree([]))
        setListed(true)
        failedRef.current('organisation.list', cause, 'picker.listFailed')
      },
    )
    return () => { live = false }
  }, [scopes, revision])

  // A different home is a different document, and `ready` drops first, so
  // the cards do not say a domain's numbers under the organisation's name.
  useEffect(() => {
    let live = true
    if (!active) return () => { live = false }
    setReady(false)
    void readScope(scopes, at).then(
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

  return { tree, root, ready, listed }
}

/** Every scope may be written: what the hook is told by every source that ships. */
const ANYWHERE = () => true

export function useOrganisation({
  repositories, active, at, onEnter, notify, onFailure, onKeptResult, s, onTreeChanged, writable = ANYWHERE,
}: UseOrganisationInput): Organisation {
  const { scopes } = repositories
  const [dialog, setDialog] = useState<OrganisationDialog>({ kind: 'none' })
  const [collapsed, setCollapsed] = useState<ReadonlySet<ScopePath>>(() => new Set())
  const [revision, setRevision] = useState(0)

  const refresh = useCallback(() => setRevision((held) => held + 1), [])
  const { tree, root, ready, listed } = useHomeReads({ scopes, active, at, revision, onFailure })


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

  /** A scope made, entered, and said: the tree read again, and the index with it. */
  const entered = useCallback(async (path: ScopePath, message: string) => {
    const made = await readScope(scopes, path)
    if (!made) return
    onEnter(made)
    refresh()
    onTreeChanged?.()
    notify(message, 'success')
  }, [scopes, onEnter, refresh, onTreeChanged, notify])

  /**
   * Create a scope under another one.
   *
   * **The ancestors are created too** when they are not there, as domains named
   * after their addresses, from the top down and before the new scope itself,
   * so an interrupted run leaves a tree that is whole as far as it got. A scope
   * that draws is made with its first board, as the step that adds it.
   */
  const create = useCallback(() => {
    if (dialog.kind !== 'newScope') return
    const wanted = { parent: dialog.parent, name: dialog.name.trim(), withBoard: dialog.withBoard }
    if (!wanted.name) return
    setDialog({ kind: 'none' })
    void (async () => {
      const held = summaryOf(await scopes.tree())
      const all = flattenScopes(held)
      const path = scopePathFor(wanted.parent, wanted.name, namesUnder(all.find((scope) => scope.path === wanted.parent)))
      // Free by the listing: a scope the listing could not read is still there,
      // and the repository refuses to make one where it is.
      if (unreadableAt(held, path) !== undefined) return refuseInTheWay(onFailure)
      for (const missing of ancestorScopes(path).reverse()) {
        if (missing === ROOT_SCOPE || all.some((scope) => scope.path === missing)) continue
        await ensureScope(scopes, missing, { name: scopePathLabel(missing), kind: 'domain' })
      }
      // A scope that draws is a landscape and one that does not is a domain
      // (§1) — labels for a screen, said here from what the person asked for
      // rather than read back later from the shape.
      const fresh = wanted.withBoard
        ? emptyScope(path, { design: wanted.name, diagram: s('shell.newDiagram') }, 'landscape')
        : bareScope(path, wanted.name, 'domain')
      const id = await ensureScope(scopes, path, { name: wanted.name, ...(fresh.kind ? { kind: fresh.kind } : {}) })
      const boards: ScopeCommand[] = fresh.model.diagrams.map((diagram) => ({ type: 'diagram.create', diagram: toDiagram(diagram) }))
      if (boards.length) {
        await changeScope(scopes, path, () => [...boards, { type: 'scope.describe', patch: { activeDiagramId: fresh.activeDiagramId } }])
      }
      if (id) await entered(path, s('shell.scopeCreated', { name: wanted.name }))
    })().catch((cause: unknown) => {
      // Where work is kept refusing is what the standing notice says, and it
      // is latched, so a burst says it once.
      onFailure('organisation.create', cause)
      onKeptResult(false)
    })
  }, [dialog, scopes, entered, onFailure, onKeptResult, s])

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
      // A scope the tree no longer has is made on the spot. The board is added
      // to the scope as it stands, expecting what was read and worked out
      // again over a scope that moved in between, and its id claimed against
      // what it holds.
      await ensureScope(scopes, wanted.path, { name: scopePathLabel(wanted.path) })
      let board = ''
      const next = await changeScope(scopes, wanted.path, (held) => {
        const diagram: DesignDiagram = {
          id: claimKey(s('shell.newDiagram'), new Set(idsIn(held.model))),
          kind: 'layer7', name: wanted.name, members: [], geometry: { nodes: [] },
          ...(held.model.defaultAspectConfig ? { aspectConfig: [...held.model.defaultAspectConfig] } : {}),
        }
        board = diagram.id
        return [{ type: 'diagram.create', diagram: toDiagram(diagram) }, { type: 'scope.describe', patch: { activeDiagramId: diagram.id } }]
      })
      if (!next) return
      onEnter(next, { page: 'board', id: board })
      refresh()
      onTreeChanged?.()
      notify(s('shell.scopeCreated', { name: wanted.name }), 'success')
    })().catch((cause: unknown) => {
      onFailure('organisation.board', cause)
      onKeptResult(false)
    })
  }, [dialog, scopes, onEnter, refresh, notify, onFailure, onKeptResult, s, onTreeChanged])

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
      // Expecting what was read, and taken off again over a scope that moved
      // in between, so a board somebody drew meanwhile is not taken with it.
      // A container view is the DETAIL of an application, not the
      // application: the containers go, the interfaces they were carrying are
      // written on the landscape first, and the application stays where it
      // was drawn (`model/containerDiagram.ts`). A landscape has no such
      // insides, so it is the plain drop it always was.
      const next = await changeScope(scopes, path, (held) => {
        const taken = new Set(idsIn(held.model))
        const command: Command = removeContainerDiagram(held.model, board.id, () => claimKey('interface', taken))
          ?? { type: 'diagram.delete', id: board.id }
        const moving = held.activeDiagramId === board.id
          ? held.model.diagrams.find((diagram) => diagram.id !== board.id)?.id ?? ''
          : undefined
        return [command, ...(moving !== undefined ? [{ type: 'scope.describe', patch: { activeDiagramId: moving } } as const] : [])]
      })
      if (!next) return
      refresh()
      notify(s('shell.deleted', { name: board.name }), 'success')
    })().catch((cause: unknown) => {
      // The reducer's own refusal is said in its words; anything else is where
      // work is kept not answering.
      if (cause instanceof ShellError) { notify(s(cause.key), 'error'); return }
      onFailure('organisation.deleteBoard', cause)
      onKeptResult(false)
    })
  }, [dialog, scopes, refresh, notify, onFailure, onKeptResult, s])

  /**
   * Apply a scope's edited record: what it is called, what it is, who its
   * drawings are made out to, where its material lives — and where it is filed.
   *
   * As the steps they are, over the scope as it stands, so its model,
   * decisions and plans survive a change this dialog cannot see; a scope with
   * no document yet is made first. A **move** is the repository's: the scope
   * and everything under it go to the new address together, identities and
   * all, and the stand-ins elsewhere that named it follow (`moveScope`).
   */
  const applySettings = useCallback((path: ScopePath, patch: ScopeSettingsPatch) => {
    void (async () => {
      const listing = summaryOf(await scopes.tree())
      const from = parentScope(path) ?? ROOT_SCOPE
      const moving = patch.parent !== undefined && patch.parent !== from && path !== ROOT_SCOPE
      const name = patch.name.trim() || scopePathLabel(path)
      const was = flattenScopes(listing).find((scope) => scope.path === path)?.name
      try {
        await ensureScope(scopes, path, { name })
        await changeScope(scopes, path, () => settingsCommands(name, patch))
        if (moving) {
          const siblings = namesUnder(flattenScopes(listing).find((scope) => scope.path === patch.parent))
          await moveScope(scopes, repositories.index, path, scopePathFor(patch.parent!, scopePathLabel(path), siblings))
        }
      } catch (cause) {
        // A refusal is the repository's answer, said in its words.
        onFailure('organisation.settings', cause, cause instanceof ShellError ? cause.key : 'group.saveFailed')
        return
      }
      refresh()
      notify(
        moving
          ? s('settings.moved', { name })
          : was !== undefined && was !== name
            ? s('group.renamed', { name })
            : s('group.saved', { name }),
        'success',
      )
    })().catch((cause: unknown) => {
      // A backstop, not a handler: everything above is caught where it can be
      // answered. A throw that reaches here happened in the synchronous tail,
      // which no boundary can see from inside an async function.
      onFailure('organisation.settings', cause, 'group.saveFailed')
    })
  }, [scopes, repositories, refresh, notify, onFailure, s])

  const confirmDelete = useCallback(() => {
    if (dialog.kind !== 'delete') return
    const target = dialog.target
    setDialog({ kind: 'none' })
    void (async () => {
      const node = nodeAt(await scopes.tree(), target.path)
      if (node) landed(await scopes.remove(node.id))
    })().then(
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
   *
   * **A page asked for on a scope with no document** — a root with scopes
   * under it and no `scope.json` of its own, a folder somebody made by hand —
   * is a page on a scope that has not been written yet, not a failure. For
   * somebody who may write there the scope is written first, bare and whole,
   * in ONE write: a source whose changes travel as steps refuses a step on a
   * scope that does not exist, so the session opened on it could not start
   * it. Then it is read back and entered, as the example's copy is. For
   * somebody who may only read, nothing is written and the page opens empty —
   * the workspace asks the source the same question and opens it read-only.
   *
   * A failure is said once, through `onFailure`: it used to be said here too,
   * which was the same toast twice.
   */
  const open = useCallback((path: ScopePath, page?: InitialPage) => {
    void (async () => {
      const found = await readScope(scopes, path)
      if (found) { onEnter(found, page); return }
      if (!opensOnNothing(page)) {
        // Nothing there, and nothing asked for that a scope has before it is
        // written: somebody removed it between the listing and the press. The
        // listing is read again, and that is said.
        refresh()
        onFailure('organisation.open.gone', undefined, 'picker.loadFailed')
        return
      }
      const bare = bareScope(path, nameOf(tree, path))
      if (!writable(path)) { onEnter(bare, page); return }
      // Made only where nothing is: a scope somebody made in between is
      // theirs and is the one entered.
      await ensureScope(scopes, path, { name: bare.model.name })
      const written = await readScope(scopes, path)
      if (!written) {
        onFailure('organisation.open.unwritten', undefined, 'picker.loadFailed')
        return
      }
      onEnter(written, page)
      refresh()
      onTreeChanged?.()
    })().catch((cause: unknown) => onFailure('organisation.open', cause, 'picker.loadFailed'))
  }, [scopes, tree, writable, onEnter, refresh, onTreeChanged, onFailure])

  /**
   * An example is a starting point, not a document you keep opening. Where the
   * copy lands is `exampleCopyOver`'s answer; what is here is the writing of
   * it, parents first, and landing the person in the scope that has the work in
   * it rather than in the name above it.
   */
  const copyExample = useCallback((offer: ExampleOffer) => {
    void (async () => {
      const example = await exampleOf(offer)
      const copy = await exampleCopyOver(scopes, example)
      // A shipped example this build cannot read is a bug the example tests
      // exist to prevent, so it reaches here as nothing rather than as a crash.
      if (copy.length === 0) {
        onFailure('organisation.copyExample', new Error('the example did not read'))
        return
      }
      // The scope with the work in it: of the scopes that draw a board, the
      // one holding the most applications — not the last in path order, which
      // since ADR-0013 is the platform scope beside the landscape, and since
      // ADR-0014 draws a board of its own with the services and platforms on
      // it. A tie goes to the first, which is the one nearest the root.
      const drawing = copy.filter((scope) => scope.model.diagrams.some((diagram) => isBoardKind(diagram.kind)))
      const applications = (scope: typeof copy[number]) =>
        scope.model.elements.filter((element) => element.kind === 'application' && element.ref === undefined).length
      const landing = drawing.reduce<typeof copy[number] | undefined>(
        (best, scope) => (best === undefined || applications(scope) > applications(best) ? scope : best),
        undefined,
      ) ?? copy[copy.length - 1]
      // Copied before: entered, not copied again. The organisation is always
      // there, and one nothing was ever put in is where a copy lands.
      const existing = await readScope(scopes, landing.path)
      if (existing && !blank(existing)) { onEnter(existing); return }
      // Each scope a content that arrives whole, all of them landed together.
      await placeCopy(repositories, copy)
      await entered(landing.path, s('shell.exampleCopied', { name: example.label }))
    })().catch((cause: unknown) => {
      onFailure('organisation.copyExample', cause)
      onKeptResult(false)
    })
  }, [scopes, repositories, onEnter, entered, onFailure, onKeptResult, s])

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
    tree, listed, at, root, ready, refresh, dialog, collapsed, toggleCollapsed,
    addUnder, editScope, askDelete, closeDialog, setNewScopeName, setNewScopeParent,
    setNewScopeWithBoard, create, addBoard, setNewBoardName, createBoard,
    askDeleteBoard, confirmDeleteBoard,
    applySettings, confirmDelete, open, copyExample, nameOrganisation,
  }), [
    tree, listed, at, root, ready, refresh, dialog, collapsed, toggleCollapsed,
    addUnder, editScope, askDelete, closeDialog, setNewScopeName, setNewScopeParent,
    setNewScopeWithBoard, create, addBoard, setNewBoardName, createBoard,
    askDeleteBoard, confirmDeleteBoard,
    applySettings, confirmDelete, open, copyExample, nameOrganisation,
  ])
}

/** What the settings dialog says about a scope, as the steps that say it. */
function settingsCommands(name: string, patch: ScopeSettingsPatch): ScopeCommand[] {
  const links = normaliseLinks(patch.links)
  return [
    { type: 'project.settings', patch: { name, description: patch.description?.trim() || undefined } },
    {
      type: 'scope.describe',
      patch: {
        client: patch.client?.trim() || undefined,
        links: links.length ? links : undefined,
        ...(patch.kind ? { kind: patch.kind } : {}),
      },
    },
  ]
}

