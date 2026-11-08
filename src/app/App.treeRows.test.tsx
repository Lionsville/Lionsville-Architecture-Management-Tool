// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

/**
 * Every kind of row in the docked tree, pressed from every place that docks
 * it: the tree stays, the place arrived at is marked, and a page kept per
 * scope stays that page where the scope can hold it — a scope with no element
 * to document lands on its home, never on the empty place with no tree. The
 * empty place itself docks the tree, so there is always a way on from it.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import type { DesignElement as Element } from '../model'
import { element, laidOut } from '../model/testFixtures'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'
import type { ScopeSnapshot } from '../projects/scope'
import type { AgentGateway } from '../ports/AgentGateway'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'

beforeAll(() => installReactFlowMocks())
afterEach(() => cleanup())
beforeEach(() => { window.history.replaceState(null, '', '/') })

const app = (id: string): Element => element(id, { kind: 'application', name: id })
const scope = (path: string, name: string, over: { views?: boolean; elements?: Element[] } & Partial<ScopeSnapshot> = {}): ScopeSnapshot => {
  const { views = false, elements = [], ...rest } = over
  return {
    path,
    model: { name, elements, relations: [], diagrams: views ? [laidOut({ id: `v-${path}`, kind: 'layer7', name: `${name} board`, placements: [] })] : [] },
    activeDiagramId: views ? `v-${path}` : '',
    logoLibrary: [],
    ...rest,
  }
}

/**
 * The organisation (an element, no view); a scope with views and an element; a
 * scope with no views and nothing in it; a practice, typed by the operating
 * model, with an element and no view; and the topics place with a topic
 * relevant to the depot that keeps nothing — the owner's *Topics › Integration*.
 */
const TREE = (): ScopeSnapshot[] => [
  scope('', 'Acme', { elements: [app('org-app')] }),
  scope('retail', 'Retail'),
  scope('retail/depot', 'Depot', { views: true, elements: [app('depot-app')] }),
  scope('retail/depot/practice', 'Practice', { elements: [app('practice-app')], unitTypeId: 'ut-practice' }),
  scope('topics', 'Topics', { kind: 'topic' }),
  scope('topics/integration', 'Integration', { kind: 'topic', relevantTo: [{ path: 'retail/depot' }] }),
]

function wire() {
  let handler: ((request: AgentRequest) => Promise<AgentAnswer>) | undefined
  const connected = { kind: 'connected' as const, port: 51733, token: 't'.repeat(24), client: { name: 'Claude Code', version: '1' } }
  const gateway: AgentGateway = {
    id: 'fake',
    on(next) { handler = next; return () => { if (handler === next) handler = undefined } },
    status: () => Promise.resolve(connected), onStatus: () => () => {},
    configure: () => Promise.resolve(connected), newToken: () => Promise.resolve(connected),
  }
  let n = 0
  return { gateway, bound: () => handler !== undefined, ask: (tool: string, args: unknown = {}) => handler!({ id: `r${++n}`, tool, args }) }
}
type Current = { open?: { path: string; noView?: boolean }; home?: { path: string }; page?: { page: string } }
const parsed = (answer: AgentAnswer): Current => {
  if (!answer.ok || answer.content[0].type !== 'text') throw new Error(`refused: ${JSON.stringify(answer)}`)
  return JSON.parse(answer.content[0].text) as Current
}

async function shell() {
  const agent = wire()
  renderApp({ agent: agent.gateway, repositories: heldRepositories(TREE()), boot: { initialProject: undefined } })
  await waitFor(() => expect(agent.bound()).toBe(true))
  await screen.findByTestId('organisation-cards')
  return agent
}

const tree = () => screen.getByTestId('frame-tree')
const row = (testId: string) => within(tree()).getByTestId(testId)
/** A branch folded shut where the place is elsewhere, opened as a person would. */
const unfold = (path: string) => {
  const fold = within(tree()).queryByTestId(`fold-${path}`)
  if (fold?.getAttribute('aria-expanded') === 'false') fireEvent.click(fold)
}

/** A place that docks the tree, and how the depot's branch is brought into view there. */
type Source = { name: string; page?: string; open: (ask: ReturnType<typeof wire>['ask']) => Promise<void> }
const onPage = (page: string): Source => ({ name: page, page, open: async (ask) => { await ask('app.open', { scope: 'retail/depot', page }) } })
const SOURCES: Source[] = [
  { name: 'a home', open: async (ask) => { await ask('app.open', { scope: 'retail/depot', page: 'home' }) } },
  ...['documentation', 'decisions', 'observations', 'roadmap', 'principles', 'blocks'].map(onPage),
  {
    // The empty place: a scope with no view open with nothing over it, as documentation asked of one that keeps nothing leaves it.
    name: 'the empty place',
    open: async (ask) => {
      await ask('app.open', { scope: 'retail', page: 'documentation' })
      await screen.findByText('No view here yet')
      await waitFor(async () => expect(parsed(await ask('app.current'))).toMatchObject({ open: { path: 'retail', noView: true } }))
      // Docked whatever the preference says, as on a home: the toggle shows it pressed and says why.
      await waitFor(() => expect(screen.getByTestId('frame-tree-toggle').getAttribute('aria-pressed')).toBe('true'))
    },
  },
]

/** The kinds of row, each with the scope it lands on, how it is pressed, and whether that scope can hold documentation. */
type Kind = { name: string; lands: string; documents: boolean; press: () => void }
const KINDS: Kind[] = [
  { name: 'the organisation', lands: '', documents: true, press: () => fireEvent.click(row('scope-root')) },
  { name: 'a scope with views', lands: 'retail/depot', documents: true, press: () => fireEvent.click(row('scope-retail/depot')) },
  { name: 'a scope with no views', lands: 'retail', documents: false, press: () => fireEvent.click(row('scope-retail')) },
  { name: 'a practice', lands: 'retail/depot/practice', documents: true, press: () => { unfold('retail/depot'); fireEvent.click(row('scope-retail/depot/practice')) } },
  {
    name: 'a topic under Topics', lands: 'topics/integration', documents: false,
    press: () => {
      unfold('topics')
      fireEvent.click(row('scope-topics/integration'))
    },
  },
  { name: 'a ↗ topic link', lands: 'topics/integration', documents: false, press: () => { unfold('retail/depot'); fireEvent.click(row('topic-row-retail/depot-topics/integration')) } },
  {
    // A scope found from above: flat, with the path over it.
    name: 'a scope found by name', lands: 'retail/depot/practice', documents: true,
    press: () => {
      fireEvent.change(within(tree()).getByTestId('tree-find').querySelector('input') ?? within(tree()).getByTestId('tree-find'), { target: { value: 'Practice' } })
      fireEvent.click(row('scope-retail/depot/practice'))
    },
  },
]

const where = (now: Current) => now.open?.path ?? now.home?.path
const marked = (path: string) => within(tree()).getByTestId(path === '' ? 'scope-root' : `scope-${path}`).getAttribute('aria-current')

describe.each(SOURCES)('the tree beside $name', (source) => {
  it.each(KINDS)('stays docked when $name is pressed, the place marked and the page kept where it can be', async (kind) => {
    const { ask } = await shell()
    await source.open(ask)
    // Docked before the press: the empty place too.
    await waitFor(() => expect(screen.queryByTestId('frame-tree')).not.toBeNull())
    await waitFor(() => expect(within(tree()).queryByTestId('scope-retail/depot')).not.toBeNull())
    kind.press()
    const keeps = source.page !== undefined && (source.page !== 'documentation' || kind.documents)
    await waitFor(async () => {
      const now = parsed(await ask('app.current'))
      expect(where(now)).toBe(kind.lands)
      if (keeps) expect(now.page?.page).toMatch(source.page === 'documentation' ? /^document/ : new RegExp(`^${source.page}$`))
      else expect(now.page?.page ?? 'home').toBe('home')
    })
    await waitFor(() => expect(marked(kind.lands)).toBe('page'))
    expect(screen.getByTestId('frame-tree')).toBeDefined()
  })
})
