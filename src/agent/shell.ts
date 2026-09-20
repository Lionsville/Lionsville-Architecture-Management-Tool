/**
 * The app as the agent sees it (ADR-0019): where it is, what there is to
 * open, opening it, and the session the person can stop.
 *
 * These are the handler's answers for the drive tier and for `views.list`,
 * kept apart from `handle.ts` because they are about the shell rather than
 * the document: they read a {@link ShellView} the app fills, and a session
 * only where one is open. Everything here is answered with or without a
 * scope open, which is the point — an agent that arrives at the organisation
 * screen used to be told *no project* and nothing else.
 */
import type { Adr } from '../model/adr'
import type { HostModel } from '../model/hostModel'
import type { DesignDiagram } from '../model/types'
import type { Driving } from './driving'
import { arrived, HOME_PAGES, NEEDS_ID, scopeOf, VIEW_PAGES } from './screen'
import type { Destination, Page, Screen } from './screen'
import type { AgentAnswer } from './tools'
import { json, refused } from './tools'
import type { TreeView } from './tree'

/**
 * What the handler needs from the shell (ADR-0019). Absent in a test with no
 * shell, and the drive tier then answers from the session alone or refuses.
 */
export type ShellView = {
  /** The tree, as the workspace hands it in too; the shell's copy is the one that is always there. */
  tree?: TreeView
  /** Where the app is, now. */
  screen(): Screen
  /**
   * Move the app. The shell starts the move; the handler waits for the
   * screen to say it has arrived, so a caller's next read is over the right
   * scope. Everything about the destination has been checked by then.
   */
  open(to: Required<Pick<Destination, 'scope'>> & Destination): void | Promise<void>
  /** The connected client's name, from its handshake; absent when the app was not told one. */
  client(): string | undefined
  driving: Driving
}

/** What a session lends to these answers: the open scope's document, as it stands. */
export type OpenScope = {
  scopePath(): string
  current(): HostModel
  activeDiagramId(): string
  ancestorDecisions(): readonly Adr[]
  revision(): number
  tree?: TreeView
}

/** How long a move may take the app before the answer says it has not arrived. */
const ARRIVAL_TIMEOUT_MS = 10_000

// --- app.current -----------------------------------------------------------------

export function currentApp(session: OpenScope | undefined, shell: ShellView | undefined, over: object = {}): AgentAnswer {
  const screen = shell?.screen() ?? screenOf(session)
  const tree = shell?.tree ?? session?.tree
  const state = shell?.driving.current()
  const client = shell?.client()
  const openHere = session !== undefined && screen.open?.path === session.scopePath()
  return json({
    ...screen,
    ...(openHere ? { activeDiagramId: session.activeDiagramId(), revision: session.revision() } : {}),
    ...(tree ? { scopes: tree.scopes().length } : {}),
    agent: {
      ...(client !== undefined ? { client } : {}),
      ...(state?.session ? { session: state.session } : {}),
      ...(state?.stopped ? { stopped: state.stopped } : {}),
    },
    ...(screen.open === undefined
      ? { hint: 'Nothing is open: reads with `scope` set are answered from disk; app.open opens a scope for everything else.' }
      : {}),
    ...over,
  })
}

/** The screen a session alone can describe: its scope, on its active view. */
function screenOf(session: OpenScope | undefined): Screen {
  if (!session) return {}
  const model = session.current()
  const active = model.diagrams.find((diagram) => diagram.id === session.activeDiagramId())
  return {
    open: {
      path: session.scopePath(),
      name: model.name,
      ...(active ? { view: { id: active.id, name: active.name, kind: active.kind } } : {}),
    },
  }
}

// --- views.list ------------------------------------------------------------------

const VIEWS_LIMIT = 500

/**
 * Every view, scope by scope. The index carries no views on purpose
 * (`ScopeModel`), so this is one read per scope that holds one — the load
 * the organisation screen avoids per card, done once because the agent asked
 * for the whole overview and the description says so.
 */
export async function listViews(
  rawArgs: unknown, session: OpenScope | undefined, tree: TreeView | undefined,
): Promise<AgentAnswer> {
  const args = (rawArgs ?? {}) as Record<string, unknown>
  const under = args.scope as string | undefined
  const kind = args.kind as string | undefined
  const limit = (args.limit as number | undefined) ?? VIEWS_LIMIT
  const open = session?.scopePath()
  const scopes = tree
    ? tree.scopes()
    : session ? [{ path: open!, name: session.current().name, views: session.current().diagrams.length }] : []
  const within = (path: string) => under === undefined || under === '' || path === under || path.startsWith(`${under}/`)
  const rows: unknown[] = []
  let total = 0
  let read = 0
  for (const scope of scopes) {
    if (!within(scope.path)) continue
    let model: HostModel | undefined
    let active: string | undefined
    if (scope.path === open && session) {
      model = session.current()
      active = session.activeDiagramId()
    } else if (scope.views > 0 && tree) {
      const held = await tree.read(scope.path)
      model = held?.model
      active = held?.activeDiagramId
    }
    if (!model) continue
    read += 1
    for (const diagram of model.diagrams) {
      if (kind !== undefined && diagram.kind !== kind) continue
      total += 1
      if (rows.length < limit) rows.push(viewRow(scope.path, scope.name, diagram, active, open))
    }
  }
  return json({ total, scopesRead: read, ...(open !== undefined ? { open } : {}), some: rows })
}

function viewRow(scope: string, scopeName: string, diagram: DesignDiagram, active: string | undefined, open: string | undefined) {
  return {
    scope,
    scopeName,
    id: diagram.id,
    name: diagram.name,
    kind: diagram.kind,
    elements: diagram.members.length,
    ...(diagram.id === active ? { onTab: true } : {}),
    ...(diagram.id === active && scope === open ? { onScreen: true } : {}),
  }
}

// --- app.open --------------------------------------------------------------------

type Resolved = { page?: Page; id?: string }

export async function openApp(rawArgs: unknown, session: OpenScope | undefined, shell: ShellView | undefined): Promise<AgentAnswer> {
  if (!shell) return refused('agent.noAnswer', 'the app has no screen to move')
  const asked = (rawArgs ?? {}) as Destination
  const scope = asked.scope ?? session?.scopePath() ?? scopeOf(shell.screen())
  if (scope === undefined) return refused('agent.badArguments', '"scope" is needed when nothing is open')
  const tree = shell.tree ?? session?.tree
  const known = tree
    ? tree.scopes().find((held) => held.path === scope)
    : session && scope === session.scopePath()
      ? { path: scope, name: session.current().name, views: session.current().diagrams.length }
      : undefined
  if (!known) return refused('agent.unknownScope', scope || 'the organisation')
  if (asked.page !== undefined && NEEDS_ID.includes(asked.page) && asked.id === undefined) {
    return refused('agent.badArguments', `"id" is needed for page ${asked.page}`)
  }

  let target: Resolved = { ...(asked.page !== undefined ? { page: asked.page } : {}), ...(asked.id !== undefined ? { id: asked.id } : {}) }
  const aboutSomething = asked.id !== undefined || (asked.page !== undefined && VIEW_PAGES.includes(asked.page))
  if (aboutSomething) {
    const document = session && scope === session.scopePath()
      ? { model: session.current(), ancestorDecisions: session.ancestorDecisions() }
      : await tree?.read(scope)
    if (!document) return refused('agent.unknownScope', scope || 'the organisation')
    const resolved = resolveTarget(document.model, document.ancestorDecisions, target, scope)
    if ('ok' in resolved) return resolved
    target = resolved
  }
  // A scope that draws nothing has no canvas to open on: its home is the
  // honest place, which is where the tree's own *Open* would not go at all.
  if (target.page === undefined && target.id === undefined && known.views === 0) target = { page: 'home' }
  if (target.page !== undefined && HOME_PAGES.includes(target.page)) target = { page: target.page }

  const to = { scope, ...target }
  await shell.open(to)
  const deadline = Date.now() + ARRIVAL_TIMEOUT_MS
  let there = arrived(shell.screen(), to, scope)
  while (!there && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50))
    there = arrived(shell.screen(), to, scope)
  }
  // The session this call arrived with may be the scope just left; the
  // screen is the truth now, and the revision is the open scope's own.
  const still = session && shell.screen().open?.path === session.scopePath() ? session : undefined
  return currentApp(still, shell, { asked: to, arrived: there })
}

/**
 * What the destination is about, checked against the scope's own document:
 * a view of the right kind, an element, a plan or a record — or, with an id
 * and no page, whichever of those the id names.
 */
function resolveTarget(model: HostModel, ancestors: readonly Adr[], asked: Resolved, scope: string): Resolved | AgentAnswer {
  const where = scope || 'the organisation'
  const diagram = asked.id !== undefined ? model.diagrams.find((held) => held.id === asked.id) : undefined
  const element = asked.id !== undefined ? model.elements.find((held) => held.id === asked.id) : undefined
  const plan = asked.id !== undefined ? (model.transitions ?? []).find((held) => held.id === asked.id) : undefined
  const decision = asked.id !== undefined
    ? [...(model.decisions ?? []), ...ancestors].find((held) => held.id === asked.id)
    : undefined
  const observed = asked.id !== undefined
    ? [...(model.observations ?? []), ...(model.causes ?? [])].find((held) => held.id === asked.id)
    : undefined

  if (asked.page === undefined) {
    if (diagram) return { page: pageOf(diagram), id: diagram.id }
    if (element) return { page: 'element', id: element.id }
    if (plan) return { page: 'plan', id: plan.id }
    if (decision) return { page: 'decisions', id: decision.id }
    if (observed) return { page: 'observations', id: observed.id }
    return refused('agent.unknownId', `${asked.id} in ${where}`)
  }
  const page = asked.page
  if (VIEW_PAGES.includes(page)) {
    if (asked.id !== undefined) {
      if (!diagram) return refused('agent.unknownId', `diagram ${asked.id} in ${where}`)
      if (pageOf(diagram) !== page) return refused('agent.badArguments', `${asked.id} is a ${diagram.kind}, not a ${page}`)
      return { page, id: diagram.id }
    }
    const ofKind = model.diagrams.filter((held) => pageOf(held) === page)
    if (ofKind.length === 1) return { page, id: ofKind[0].id }
    if (ofKind.length === 0) return refused('agent.unknownId', `no ${page} in ${where}; diagram.create makes one`)
    return refused('agent.badArguments', `${where} has ${ofKind.length} ${page}s: say which by id (${ofKind.map((held) => held.id).join(', ')})`)
  }
  switch (page) {
    case 'decisions':
      if (asked.id !== undefined && !decision) return refused('agent.unknownId', `decision ${asked.id} in ${where}`)
      return asked.id !== undefined ? { page, id: asked.id } : { page }
    case 'observations':
      if (asked.id !== undefined && !observed) return refused('agent.unknownId', `observation or cause ${asked.id} in ${where}`)
      return asked.id !== undefined ? { page, id: asked.id } : { page }
    case 'plan':
      return plan ? { page, id: plan.id } : refused('agent.unknownId', `plan ${asked.id} in ${where}`)
    case 'element':
    case 'document':
      return element ? { page, id: element.id } : refused('agent.unknownId', `element ${asked.id} in ${where}`)
    case 'platform':
      if (!element) return refused('agent.unknownId', `element ${asked.id} in ${where}`)
      return element.kind === 'platform' ? { page, id: element.id } : refused('agent.badArguments', `${asked.id} is a ${element.kind}, not a platform`)
    case 'service':
      if (!element) return refused('agent.unknownId', `element ${asked.id} in ${where}`)
      return element.kind === 'platformService' ? { page, id: element.id } : refused('agent.badArguments', `${asked.id} is a ${element.kind}, not a platform service`)
    default:
      // home, roadmap, documentation and the two registers are about the
      // scope; an id given with them is not an error, only unused.
      return { page }
  }
}

/** Which page's tab a view is: the two drawn kinds are boards, the laid-out ones are their own. */
function pageOf(diagram: DesignDiagram): Page {
  return diagram.kind === 'layer7' || diagram.kind === 'container' ? 'board' : diagram.kind as Page
}

// --- session.start / session.end ------------------------------------------------------

export function startSession(rawArgs: unknown, session: OpenScope | undefined, shell: ShellView | undefined): AgentAnswer {
  if (!shell) return refused('agent.noAnswer', 'the app has no screen to drive')
  const purpose = ((rawArgs ?? {}) as { purpose?: string }).purpose?.trim()
  shell.driving.start(shell.client(), purpose || undefined)
  return currentApp(session, shell)
}

export function endSession(shell: ShellView | undefined): AgentAnswer {
  if (!shell) return refused('agent.noAnswer', 'the app has no screen to drive')
  shell.driving.end('agent')
  return json({ ended: true })
}

/**
 * The call, unless the person presses Stop first — in which case the call
 * is answered `agent.stopped` at once and whatever it was doing is left to
 * finish on its own. A tidy that was running still lands, undoable; what
 * the person asked for is that the agent hears about it now.
 */
export function untilStopped(shell: ShellView, work: Promise<AgentAnswer>): Promise<AgentAnswer> {
  return new Promise<AgentAnswer>((resolve, reject) => {
    const off = shell.driving.onStop(() => {
      resolve(refused('agent.stopped', 'the person stopped the session while this call was running'))
    })
    work.then(
      (answer) => { off(); resolve(answer) },
      (cause: unknown) => { off(); reject(cause instanceof Error ? cause : new Error(String(cause))) },
    )
  })
}
