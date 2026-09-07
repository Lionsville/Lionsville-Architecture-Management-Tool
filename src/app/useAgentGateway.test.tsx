// @vitest-environment jsdom
/**
 * An agent's request is answered from the model on screen (ADR-0007, step 2).
 *
 * The whole shell, with the seam filled by a fake that keeps the handler it
 * was given: a request pushed through it must come back answered against the
 * project that is open, and refused with `agent.noProject` when none is. The
 * editor is stubbed, as in `App.commands.test.tsx`: what is under test is the
 * binding, not the canvas.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ProjectSnapshot } from '../projects/project'
import { InMemoryProjectStore } from '../adapters/memory/InMemoryProjectStore'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return {
    ...actual,
    SolutionDesignEditor: (props: {
      editing: { dispatch: (command: unknown) => unknown }
    }) => (
      <button
        data-testid="rename-billing"
        onClick={() => props.editing.dispatch({ type: 'element.update', id: 'billing', patch: { name: 'Invoicing' } })}
      >
        rename
      </button>
    ),
  }
})

afterEach(() => cleanup())

const project: ProjectSnapshot = {
  ref: { group: 'acme', project: 'landscape' },
  model: {
    name: 'Warehouse landscape',
    customerName: 'Acme',
    elements: [{ id: 'billing', kind: 'application', name: 'Billing', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} }],
    connections: [],
    diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements: [{ elementId: 'billing', x: 0, y: 0 }] }],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
}

/** A gateway that keeps whoever subscribed, so a test can ask through it. */
function fakeGateway() {
  let handler: ((request: AgentRequest) => Promise<AgentAnswer>) | undefined
  const gateway: AgentGateway = {
    id: 'fake',
    on(next) {
      handler = next
      return () => { if (handler === next) handler = undefined }
    },
    status: () => Promise.resolve({ kind: 'off' }),
    onStatus: () => () => {},
    configure: () => Promise.resolve({ kind: 'off' }),
    newToken: () => Promise.resolve({ kind: 'off' }),
  }
  const ask = (tool: string, args: unknown = {}): Promise<AgentAnswer> => {
    if (!handler) throw new Error('nobody is listening')
    return handler({ id: 'r', tool, args })
  }
  return { gateway, ask, bound: () => handler !== undefined }
}

const parsed = (answer: AgentAnswer): Record<string, unknown> => {
  if (!answer.ok || answer.content[0].type !== 'text') throw new Error(`refused: ${JSON.stringify(answer)}`)
  return JSON.parse(answer.content[0].text)
}

describe('the agent seam, bound to the shell', () => {
  it('answers from the project that is open', async () => {
    const { gateway, ask } = fakeGateway()
    renderApp({ initialProject: project, agent: gateway })
    await waitFor(() => expect(screen.getByTestId('rename-billing')).toBeDefined())
    expect(parsed(await ask('project.current'))).toMatchObject({ name: 'Warehouse landscape', elements: 1 })
  })

  it('answers against the model as it stands, not as it was opened', async () => {
    const { gateway, ask } = fakeGateway()
    renderApp({ initialProject: project, agent: gateway })
    await waitFor(() => expect(screen.getByTestId('rename-billing')).toBeDefined())
    fireEvent.click(screen.getByTestId('rename-billing'))
    const held = parsed(await ask('element.describe', { id: 'billing' }))
    expect(held.name).toBe('Invoicing')
  })

  it('refuses with agent.noProject when nothing is open', async () => {
    const { gateway, ask, bound } = fakeGateway()
    renderApp({ initialProject: undefined, agent: gateway })
    await waitFor(() => expect(bound()).toBe(true))
    expect(await ask('project.current')).toEqual({ ok: false, refusal: 'agent.noProject' })
  })

  it('moves the binding from the shell to the workspace when a project opens', async () => {
    const { gateway, ask } = fakeGateway()
    renderApp({ initialProject: undefined, agent: gateway, projects: new InMemoryProjectStore([project]) })
    await waitFor(() => expect(screen.getByText('Warehouse landscape')).toBeDefined())
    // The card itself is the affordance: its name is what a person clicks.
    fireEvent.click(screen.getByText('Warehouse landscape'))
    await waitFor(() => expect(screen.getByTestId('rename-billing')).toBeDefined())
    expect(parsed(await ask('project.current'))).toMatchObject({ name: 'Warehouse landscape' })
  })
})
