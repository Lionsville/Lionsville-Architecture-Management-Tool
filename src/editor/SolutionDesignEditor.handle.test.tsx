// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { testTheme } from './testing/theme';
import { laidOut } from '../model/testFixtures';
import type { DesignModel } from '../model/types';
import { HostedEditor } from './testing/editorHost';
import type { EditorHostState } from './testing/editorHost';
import type { EditorHandle } from './props';
import { installReactFlowMocks } from './reactFlowTestSetup';
import { routeDiagramEdges } from '../layout/routeOnly';
import { tidyLayer7 } from '../layout/tidy';

/**
 * A layout pass a host asks for through the editor's handle lands with what
 * the host said about it (ADR-0007).
 *
 * The agent's `diagram.tidy` and `diagram.route` reach the board this way: the
 * renderer view calls the handle, and the editor dispatches the step. An
 * agent's write is marked `origin: 'agent'` on its outermost command, and the
 * Activity list and anything reading the log later tell its work from the
 * person's by that mark — so the mark the handle is handed must be on the step
 * the pass lands, and the person's own press must land without one.
 *
 * The layout engines are mocked: what is under test is which step the editor
 * dispatches with their answer, not the answer.
 */
vi.mock('../layout/routeOnly', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../layout/routeOnly')>()),
  routeDiagramEdges: vi.fn(),
}));
vi.mock('../layout/tidy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../layout/tidy')>()),
  tidyLayer7: vi.fn(),
}));

const mockRoute = vi.mocked(routeDiagramEdges);
const mockTidy = vi.mocked(tidyLayer7);

beforeAll(() => {
  installReactFlowMocks();
});
afterEach(() => {
  cleanup();
  mockRoute.mockReset();
  mockTidy.mockReset();
});

const PLACEMENTS = [
  { id: 'a1', zone: 'landscape' as const, x: 100, y: 400 },
  { id: 'a2', zone: 'landscape' as const, x: 1200, y: 400 },
];
const MOVED = PLACEMENTS.map((p) => ({ ...p, y: p.y + 120 }));
const ROUTES = [{ relationId: 'c1', waypoints: [{ x: 700, y: 300 }, { x: 700, y: 500 }] }];

function model(): DesignModel {
  const element = (id: string, name: string) => ({
    id, kind: 'application' as const, name, lifecycle: 'live' as const, isManaged: true, aspects: {},
  });
  return {
    name: 'Landscape',
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'Layer 7', placements: PLACEMENTS })],
    elements: [element('a1', 'Webshop'), element('a2', 'Order Service')],
    relations: [{ type: 'flow', id: 'c1', sourceId: 'a1', targetId: 'a2', isBidirectional: false }],
  };
}

function renderEditor() {
  const host = { current: undefined as unknown as EditorHostState };
  const handle = { current: undefined as EditorHandle | undefined };
  render(
    <ThemeProvider theme={testTheme}>
      <div style={{ width: '1200px', height: '800px' }}>
        <HostedEditor
          model={model()}
          activeDiagramId="d1"
          hostRef={host}
          onHandle={(held) => { handle.current = held; }}
        />
      </div>
    </ThemeProvider>,
  );
  return { host, handle };
}

describe('a layout pass asked for through the handle', () => {
  it('lands a tidy with the mark the handle was handed', async () => {
    mockTidy.mockResolvedValue({ placements: MOVED });
    const { host, handle } = renderEditor();
    await waitFor(() => expect(handle.current).toBeDefined());

    await act(() => handle.current!.tidy({ origin: 'agent' }));

    expect(host.current.commands).toHaveLength(1);
    expect(host.current.commands[0].origin).toBe('agent');
  });

  it('lands a route with the mark the handle was handed', async () => {
    mockRoute.mockResolvedValue({ placements: [], edgeRoutes: ROUTES });
    const { host, handle } = renderEditor();
    await waitFor(() => expect(handle.current).toBeDefined());

    await act(() => handle.current!.routeEdges({ origin: 'agent' }));

    expect(host.current.commands).toHaveLength(1);
    expect(host.current.commands[0].origin).toBe('agent');
  });

  it('leaves the person’s own press unmarked', async () => {
    mockTidy.mockResolvedValue({ placements: MOVED });
    mockRoute.mockResolvedValue({ placements: [], edgeRoutes: ROUTES });
    const { host } = renderEditor();

    fireEvent.click(screen.getByLabelText('Tidy layout'));
    await waitFor(() => expect(host.current.commands).toHaveLength(1));
    // The toolbar is busy until the tidy has finished, and the command lands
    // before it has: a press on a disabled button is nothing, which a slow
    // runner showed.
    await waitFor(() => expect((screen.getByLabelText('Route connections only') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByLabelText('Route connections only'));
    await waitFor(() => expect(host.current.commands.length).toBeGreaterThan(1));

    for (const command of host.current.commands) expect(command.origin).toBeUndefined();
  });
});
