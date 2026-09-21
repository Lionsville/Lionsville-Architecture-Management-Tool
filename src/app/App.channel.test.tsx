// @vitest-environment jsdom
/**
 * Two workspaces over one command channel: the seam, end to end.
 *
 * This is the test the seam exists for. Everything else about it is a type, a
 * registration or a function with a comment; here two whole shells are mounted
 * side by side in one document, given one channel between them, and composed
 * the way whoever answers for a source would compose them — publish what was
 * done here, apply what was done elsewhere, and take our own unsequenced work
 * off the model while theirs lands underneath it.
 *
 * `overChannel` below is written out in the test on purpose. Core registers no
 * such provider and never will; what it owes is that one can be written from
 * outside without a single edit in here, and the only honest way to show that
 * is to write one from outside and use nothing that is not public.
 *
 * The steps are made through the agent's seam rather than by clicking, because
 * a click makes the same step through the same door and this way the test says
 * which step it meant. The screen is still what is read: the other workspace's
 * Activity list has to name the author, or a change nobody at that keyboard
 * made would appear on their board unattributed, which is indistinguishable
 * from a fault.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import { transaction } from '../model'
import type { Command } from '../model'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import type { AgentGateway } from '../ports/AgentGateway'
import { InMemoryCommandChannel } from '../adapters/memory/InMemoryCommandChannel'
import type { HostCommand } from '../platform/hostCommands'
import type { ScopeSnapshot } from '../projects/scope'
import { renderApp } from './testing/renderShell'
import type { ScopeSession } from './useModelSession'

/**
 * The canvas is stubbed, as in every other test of this shell: jsdom has no
 * `ResizeObserver` and the pane the editor draws into would spend this test
 * inside the error boundary. It hands out a handle, because a write that places
 * something asks the canvas where it went.
 */
vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  const { useEffect } = await import('react')
  return {
    ...actual,
    SolutionDesignEditor: (props: {
      document: { activeDiagramId: string }
      onHandle?: (handle: unknown) => void
    }) => {
      const { onHandle, document: held } = props
      useEffect(() => {
        onHandle?.({
          activeDiagramId: held.activeDiagramId, busy: false,
          tidy: async () => {}, routeEdges: async () => {},
          capture: async () => ({ arrayBuffer: async () => new ArrayBuffer(0) }),
        })
        return () => onHandle?.(undefined)
      }, [onHandle, held.activeDiagramId])
      return <div data-testid="canvas">{held.activeDiagramId}</div>
    },
  }
})

afterEach(() => cleanup())

const scope: ScopeSnapshot = {
  path: 'acme/landscape',
  model: {
    name: 'Landscape',
    elements: [{ id: 'billing', kind: 'application', name: 'Billing', lifecycle: 'live', isManaged: true, aspects: {} }],
    relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [{ id: 'billing', x: 0, y: 0 }] })],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
}

/** A gateway that keeps whoever subscribed, so a test can ask as an agent would. */
function listeningGateway() {
  let handler: ((request: AgentRequest) => Promise<AgentAnswer>) | undefined
  const connected = {
    kind: 'connected' as const, port: 51733, token: 't'.repeat(24),
    client: { name: 'Claude Code', version: '2.0' },
  }
  const gateway: AgentGateway = {
    id: 'fake',
    on(next) { handler = next; return () => { if (handler === next) handler = undefined } },
    status: () => Promise.resolve(connected),
    onStatus: () => () => {},
    configure: () => Promise.resolve(connected),
    newToken: () => Promise.resolve(connected),
  }
  let n = 0
  return {
    gateway,
    bound: () => handler !== undefined,
    ask: async (tool: string, args: unknown = {}): Promise<AgentAnswer> => {
      if (!handler) throw new Error('nobody is listening')
      // Inside `act`, because a step published from here reaches the other
      // workspace's session synchronously and both screens settle before the
      // answer comes back.
      let answer!: AgentAnswer
      await act(async () => { answer = await handler!({ id: `r${n += 1}`, tool, args }) })
      return answer
    },
  }
}

const parsed = (out: AgentAnswer): Record<string, unknown> => {
  if (!out.ok || out.content[0].type !== 'text') throw new Error(`not an answer: ${JSON.stringify(out)}`)
  return JSON.parse(out.content[0].text)
}

/** One command as one step, and several as the one transaction they were. */
const asOne = (commands: readonly Command[]): Command =>
  (commands.length === 1 ? commands[0] : transaction([...commands]))

/**
 * One author's side of a channel, as a source provider would compose it.
 *
 * Publish what was done here; recognise our own coming back by the name the
 * session gave it; put somebody else's underneath whatever of ours has not been
 * sequenced yet. `hold` is the one thing a real provider has that this does not
 * spell out — somewhere to keep steps while there is nowhere to send them — and
 * it is here so a step can be caught mid-flight, which is the only state in
 * which a rebase has anything to do.
 *
 * It publishes per **announcement** (`change.changeId`) and not per step. A
 * step that coalesces is announced every time it grows, always under the same
 * `stepId`, so publishing under that would make every keystroke after the
 * first a retry of the first — and a channel idempotent by that name answers a
 * retry out of what it already decided and sequences nothing.
 */
function overChannel(channel: InMemoryCommandChannel, by: string) {
  const wire = channel.connect(by)
  /** Ours, sequenced or not, by the name we published it under. */
  const ours = new Set<string>()
  /** Ours that the channel has not answered for yet, oldest first. */
  const pending: string[] = []
  let held: ScopeSession | undefined
  let head = 0
  let holding = false
  const waiting: (() => void)[] = []
  const send = (job: () => void) => { if (holding) waiting.push(job); else job() }

  const bind = (session: ScopeSession) => {
    held = session
    const stopListening = session.steps.onChange((change) => {
      // It came from the channel a moment ago; sending it back would be this
      // side telling the others what they told it.
      if (change.origin === 'remote') return
      // The announcement's own name, whatever step it grew. An undo gets one
      // too — the step it takes back was sequenced under its own names already,
      // and a retry of those would be answered instead of taken.
      const stepId = change.changeId
      ours.add(stepId)
      pending.push(stepId)
      const envelope = {
        scope: session.scope, stepId, base: head, command: asOne(change.commands), at: change.at,
      }
      send(() => { void wire.publish(envelope) })
    })
    /**
     * Who else is on this scope, as the channel is willing to say — ours is not
     * one of them, because the bar is about the OTHER authors. Asked at the
     * start and again whenever somebody else's step arrives, which is the
     * cheapest signal a channel like this gives that the room has changed.
     */
    const sayWhoElse = () => {
      void wire.presence?.(session.scope).then((names) => {
        session.alsoHere(names.filter((name) => name !== by))
      })
    }
    const stopSubscription = wire.subscribe(session.scope, head, (step) => {
      head = step.seq
      if (ours.has(step.stepId)) {
        const at = pending.indexOf(step.stepId)
        if (at >= 0) pending.splice(at, 1)
        // Sequenced, so nobody here has to hand it back for a rebase and the
        // log may let it go when it reaches its cap.
        session.steps.settled([step.stepId])
        return
      }
      const land = () => {
        session.steps.applyExternal(step.command, { by: step.by, at: step.at, stepId: step.stepId })
      }
      // Theirs belongs under everything of ours the channel has not seen yet.
      if (pending.length === 0) land()
      else session.steps.rebase({ stepIds: [...pending], between: land })
      sayWhoElse()
    }, () => {})
    sayWhoElse()
    return () => { stopListening(); stopSubscription() }
  }

  return {
    bind,
    /** The session as it was handed over, for a test that has to make a step. */
    session: () => held,
    hold: () => { holding = true },
    release: async () => {
      holding = false
      const jobs = [...waiting]
      waiting.length = 0
      await act(async () => { for (const job of jobs) job() })
    },
  }
}

/**
 * A menu of this workspace's own: ⌘Z and the Edit items arrive at the
 * workspace as a `HostCommand` and nowhere else (ADR-0005), so this is how a
 * test asks for an undo that the person, rather than the agent, made.
 */
function hostMenu() {
  const listeners = new Set<(command: HostCommand) => void>()
  return {
    on: (listener: (command: HostCommand) => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    press: async (command: HostCommand) => {
      await act(async () => { for (const listener of [...listeners]) listener(command) })
    },
  }
}

async function twoWorkspaces() {
  const channel = new InMemoryCommandChannel({ seed: [{ scope: scope.path, model: scope.model }] })
  const first = overChannel(channel, 'A. Author')
  const second = overChannel(channel, 'B. Bee')
  const wireA = listeningGateway()
  const wireB = listeningGateway()
  const menuA = hostMenu()
  const a = renderApp({
    initialProject: scope, agent: wireA.gateway, onScopeSession: first.bind, commands: menuA.on,
  })
  const b = renderApp({ initialProject: scope, agent: wireB.gateway, onScopeSession: second.bind })
  await waitFor(() => expect(wireA.bound() && wireB.bound()).toBe(true))
  return { channel, a, b, first, second, menuA, askA: wireA.ask, askB: wireB.ask }
}

/** What the other workspace's Activity list says about who made what. */
async function activityOf(render: { container: HTMLElement }): Promise<string[]> {
  fireEvent.click(within(render.container).getByText('Activity'))
  // The menu is a portal, so it is not under the container — and only one is
  // ever open, which is what makes reading it here unambiguous.
  const menu = await screen.findByRole('menu')
  // Newest first, which is the order the list is read in.
  const said = within(menu).queryAllByTestId('activity-origin').map((node) => node.textContent ?? '')
  fireEvent.keyDown(menu, { key: 'Escape' })
  return said
}

describe('two workspaces over one command channel', () => {
  it('lands a step made in one on the other, named after its author', async () => {
    const { askA, askB, b, channel } = await twoWorkspaces()

    const added = parsed(await askA('element.add', { kind: 'application', name: 'Ledger' }))
    expect(added.id).toBe('ledger')

    // The other side's model, without anybody there touching anything.
    await waitFor(async () => {
      expect(parsed(await askB('project.current')).elements).toBe(2)
    })
    const there = parsed(await askB('elements.list')) as { elements: { id: string }[] }
    expect(there.elements.map((row) => row.id)).toContain('ledger')

    // And the channel, which is the one order both sides agreed on.
    expect(Object.keys(channel.head(scope.path).elements)).toEqual(['billing', 'ledger'])

    // On their screen it is somebody else's work, and it says whose.
    expect(await activityOf(b)).toEqual(['BY A. Author'])
  })

  it('carries an undo over as a new step, because a colleague cannot un-see one', async () => {
    const { askA, askB, b } = await twoWorkspaces()
    await askA('element.add', { kind: 'application', name: 'Ledger' })
    await waitFor(async () => { expect(parsed(await askB('project.current')).elements).toBe(2) })

    const undone = parsed(await askA('undo'))
    expect(undone.undone).toEqual(['Added Ledger'])

    // It arrives as a change, not as a retraction: the element goes, and their
    // log has two of this author's steps on it rather than none.
    await waitFor(async () => { expect(parsed(await askB('project.current')).elements).toBe(1) })
    expect(await activityOf(b)).toEqual(['BY A. Author', 'BY A. Author'])
  })

  it('puts their step underneath ours when ours has not been sequenced yet', async () => {
    const { askA, askB, second, channel } = await twoWorkspaces()

    // Nothing leaves this side: our step is made, applied here, and waiting.
    second.hold()
    expect(parsed(await askB('element.add', { kind: 'application', name: 'Payments' })).id).toBe('payments')
    expect(Object.keys(channel.head(scope.path).elements)).toEqual(['billing'])

    // Theirs is sequenced first, so ours comes off the model, theirs lands, and
    // ours goes back on top of it.
    await askA('element.add', { kind: 'application', name: 'Ledger' })
    const log = parsed(await askB('activity.list')) as { steps: { by: string; what: string }[] }
    expect(log.steps.map((step) => [step.by, step.what])).toEqual([
      ['agent', 'Added Payments'],
      ['A. Author', 'Added Ledger'],
    ])

    // Both sides, and the channel, now hold the same three.
    await second.release()
    await waitFor(() => {
      expect(Object.keys(channel.head(scope.path).elements)).toEqual(['billing', 'ledger', 'payments'])
    })
    expect(parsed(await askA('project.current')).elements).toBe(3)
    expect(parsed(await askB('project.current')).elements).toBe(3)
  })

  it('sends a typed name keystroke by keystroke, and takes it back as one', async () => {
    const { askB, b, first, menuA, channel } = await twoWorkspaces()
    const typed = 'Crews'

    // What the name field does: one command per keystroke, all under one
    // `coalesce` key, so it is one step here and one ⌘Z for the person.
    for (let i = 1; i <= typed.length; i += 1) {
      await act(async () => {
        first.session()!.dispatch({
          type: 'element.update', id: 'billing', patch: { name: typed.slice(0, i) },
          coalesce: 'element.update:billing:name',
        })
      })
    }
    expect(first.session()!.history()).toHaveLength(1)
    expect(first.session()!.history()[0].folds).toHaveLength(typed.length)

    // Whole, on the other side and in the one order both agreed on — not
    // 'C', which is where a step published five times under one name stops.
    await waitFor(() => {
      expect(channel.head(scope.path).elements.billing.name).toBe(typed)
    })
    const there = parsed(await askB('elements.list')) as { elements: { name: string }[] }
    expect(there.elements.map((row) => row.name)).toEqual([typed])

    // One step here is five out there, which is what the stack's type says:
    // each announcement is sequenced, named and undoable on its own over there.
    expect(await activityOf(b)).toEqual(Array(typed.length).fill('BY A. Author'))

    // And taking it back is ONE change of ours, carrying every fold's inverse —
    // so it crosses as one step and their name goes back in one go.
    await menuA.press({ type: 'undo' })
    expect(first.session()!.history()).toHaveLength(0)
    await waitFor(() => {
      expect(channel.head(scope.path).elements.billing.name).toBe('Billing')
    })
    expect(await activityOf(b)).toHaveLength(typed.length + 1)
  })

  it('names the other author on the bar, and never oneself', async () => {
    const { askB, a, b } = await twoWorkspaces()

    // The second to arrive found the first already there; the first has not
    // been told anything yet, and its bar says nothing rather than saying it is
    // alone.
    await waitFor(() => {
      expect(within(b.container).getByTestId('also-here').textContent).toBe('Also here: A. Author')
    })
    expect(within(a.container).queryByTestId('also-here')).toBeNull()

    // Their step arriving is what makes this side ask the channel who is there.
    await askB('element.add', { kind: 'application', name: 'Ledger' })
    await waitFor(() => {
      expect(within(a.container).getByTestId('also-here').textContent).toBe('Also here: B. Bee')
    })
    // Each names the other and neither names itself: a bar that names you back
    // is a bar nobody trusts.
    expect(within(b.container).getByTestId('also-here').textContent).toBe('Also here: A. Author')
  })
})

/**
 * The handover itself, with nobody on the other end of it.
 *
 * `overChannel` above uses the three functions on `steps`; this is the other
 * half of what a provider was given the session for. Minting an id against what
 * is taken and working out whether what has just arrived disagrees with what was
 * done here are both questions about the model at an instant — the instant a
 * step is made, which is one render before anything is drawn.
 */
describe('the session handed to whoever answers for the source', () => {
  it('reads the model it is minting against, as it stands', async () => {
    const wire = listeningGateway()
    let handed: ScopeSession | undefined
    const take = (session: ScopeSession) => { handed = session }
    renderApp({ initialProject: scope, agent: wire.gateway, onScopeSession: take })
    await waitFor(() => expect(wire.bound()).toBe(true))
    expect(handed?.scope).toBe(scope.path)

    expect(handed!.indexed().order.elements).toEqual(['billing'])
    expect(handed!.current().elements.map((element) => element.id)).toEqual(['billing'])

    await wire.ask('element.add', { kind: 'application', name: 'Ledger' })

    // The step is on this model the moment it is made, which is what makes
    // `ledger` a name the next one must not take.
    expect(handed!.indexed().order.elements).toEqual(['billing', 'ledger'])
    expect(handed!.current().elements.map((element) => element.id)).toEqual(['billing', 'ledger'])
  })
})
