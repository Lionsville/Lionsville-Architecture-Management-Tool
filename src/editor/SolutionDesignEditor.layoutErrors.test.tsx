// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { HostedEditor } from './testing/editorHost';
import type { EditorHostState, HostedEditorProps } from './testing/editorHost';
import type { DesignModel } from '../model/types';
import { installReactFlowMocks } from './reactFlowTestSetup';
import { routeDiagramEdges } from '../layout/routeOnly';
import { tidyLayer7 } from '../layout/tidy';

/**
 * What the user is told when a layout action fails.
 *
 * The edge router is WebAssembly fetched at runtime, so "it never loaded" and "it
 * aborted and stays down until reload" are real deployment states, not theory. Both
 * layout buttons are async and both used to have a bare `try/finally`: the spinner
 * blinked, nothing happened, and the one message worth reading went to the console
 * as an unhandled rejection. These tests pin the two halves of the fix — the user is
 * told, and a Tidy whose ROUTING failed still keeps the placements it computed.
 *
 * The router itself is mocked here on purpose. Its own failure paths are covered
 * against a stand-in module in `libavoidRouter.test.ts`; what is under test in this
 * file is only what the editor does with a rejection.
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
beforeEach(() => {
  // The editor logs every failure for whoever opens devtools; that is deliberate
  // and separate from the user-facing report, so keep it out of the test output.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mockRoute.mockReset();
  mockTidy.mockReset();
});

const PLACEMENTS = [
  { elementId: 'a1', zone: 'landscape' as const, x: 100, y: 400 },
  { elementId: 'a2', zone: 'landscape' as const, x: 1200, y: 400 },
];

function model(): DesignModel {
  const element = (id: string, name: string) => ({
    id,
    kind: 'application' as const,
    name,
    lifecycle: 'live' as const,
    isManaged: true,
    aspects: {},
    parameters: {},
  });
  return {
    name: 'ACME Solution Design',
    customerName: 'ACME',
    diagrams: [{ id: 'd1', kind: 'layer7', name: 'Layer 7', placements: PLACEMENTS }],
    elements: [element('a1', 'Webshop'), element('a2', 'Order Service')],
    connections: [{ id: 'c1', sourceId: 'a1', targetId: 'a2', isBidirectional: false }],
  };
}

function renderEditor() {
  const onLayoutError = vi.fn<(message: string) => void>();
  const host = { current: undefined as unknown as EditorHostState };
  const props: HostedEditorProps = {
    model: model(),
    activeDiagramId: 'd1',
    onActiveDiagramChange: vi.fn(),
    onCreateContainerDiagram: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
    onLayoutError,
  };
  render(
    <ThemeProvider theme={createTheme()}>
      <div style={{ width: '1200px', height: '800px' }}>
        <HostedEditor {...props} hostRef={host} />
      </div>
    </ThemeProvider>,
  );
  return { host, onLayoutError };
}

const wasmDown = () => new Error('Edge routing is unavailable. Reload the page.');

describe('SolutionDesignEditor — a failed layout action is reported, not swallowed', () => {
  it('reports a route-only failure and commits nothing', async () => {
    mockRoute.mockRejectedValue(wasmDown());
    const { host, onLayoutError } = renderEditor();

    fireEvent.click(screen.getByLabelText('Route connections only'));

    await waitFor(() => expect(onLayoutError).toHaveBeenCalledTimes(1));
    expect(onLayoutError.mock.calls[0][0]).toMatch(/reload the page/i);
    expect(host.current.commands).toEqual([]);
  });

  it('releases both buttons after a failure, so the toolbar is not left dead', async () => {
    mockRoute.mockRejectedValue(wasmDown());
    const { onLayoutError } = renderEditor();
    const route = screen.getByLabelText<HTMLButtonElement>('Route connections only');
    const tidy = screen.getByLabelText<HTMLButtonElement>('Tidy layout');

    fireEvent.click(route);
    expect(route.disabled).toBe(true);

    await waitFor(() => expect(onLayoutError).toHaveBeenCalled());
    expect(route.disabled).toBe(false);
    expect(tidy.disabled).toBe(false);
  });

  it('reports a Tidy that failed outright and commits nothing', async () => {
    mockTidy.mockRejectedValue(new Error('ELK exploded'));
    const { host, onLayoutError } = renderEditor();

    fireEvent.click(screen.getByLabelText('Tidy layout'));

    await waitFor(() => expect(onLayoutError).toHaveBeenCalledTimes(1));
    expect(host.current.commands).toEqual([]);
  });

  it('KEEPS the placements of a Tidy whose routing failed, and still reports it', async () => {
    // Routing is the last step of a Tidy, so before `routeOrDegrade` a router
    // failure rejected the whole promise and discarded a layout ELK had already
    // computed. The nodes are the expensive part and they are fine.
    const moved = PLACEMENTS.map((p) => ({ ...p, y: p.y + 120 }));
    mockTidy.mockResolvedValue({ placements: moved, routingError: wasmDown() });
    const { host, onLayoutError } = renderEditor();

    fireEvent.click(screen.getByLabelText('Tidy layout'));

    await waitFor(() => expect(host.current.commands).toHaveLength(1));
    expect(host.current.model.diagrams[0].placements).toEqual(expect.arrayContaining(moved));
    // Reported all the same: the board is tidy but its edges are not routed, and
    // the user is the only one who can fix that by reloading.
    expect(onLayoutError).toHaveBeenCalledTimes(1);
    expect(onLayoutError.mock.calls[0][0]).toMatch(/could not be routed/i);
  });

  it('does not ALSO leave the failure as an unhandled rejection', async () => {
    // `handleTidy` rethrows, so `useAutoLayout` can tell "laid out" from "did not".
    // `void handleTidy()` discards the value without attaching a rejection handler,
    // which put every failed Tidy on `window` as an unhandled rejection on top of the
    // toast — reintroducing, through the back door, the console-only symptom the rest
    // of this file exists to prevent, and firing whatever reporting the shell installs.
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      mockTidy.mockRejectedValue(new Error('ELK exploded'));
      const { onLayoutError } = renderEditor();

      fireEvent.click(screen.getByLabelText('Tidy layout'));

      await waitFor(() => expect(onLayoutError).toHaveBeenCalledTimes(1));
      // A macrotask turn: Node reports an unhandled rejection at the end of the tick
      // in which nothing attached a handler, so the check has to happen after one.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('says nothing when Tidy routed cleanly', async () => {
    mockTidy.mockResolvedValue({
      placements: PLACEMENTS,
      edgeRoutes: [{ connectionId: 'c1', waypoints: [{ x: 700, y: 300 }] }],
    });
    const { host, onLayoutError } = renderEditor();

    fireEvent.click(screen.getByLabelText('Tidy layout'));

    await waitFor(() => expect(host.current.commands.length).toBeGreaterThan(0));
    expect(onLayoutError).not.toHaveBeenCalled();
  });
});

/**
 * A board the router REFUSED, as opposed to one it broke on.
 *
 * An over-cap tier is dropped whole, and its connections then come back absent
 * from the result — byte-identical to "nothing needed routing". Measured on a
 * 120-app board that read as 0 of 200 connections routed, in 0.3 ms, reported as
 * success. Declining is the right call (the alternative is a multi-minute
 * unkillable freeze); presenting it as success is not.
 *
 * Both button paths report it, and they report it now, before live mode exists —
 * otherwise the silence would be fixed only in the mode least likely to meet it.
 */
describe('SolutionDesignEditor — a board the router refused is reported', () => {
  const overCap = (count: number) => [
    {
      connectorCount: count,
      connectionIds: Array.from({ length: count }, (_, i) => `c${i}`),
    },
  ];

  it('reports an over-cap board on a Tidy press', async () => {
    mockTidy.mockResolvedValue({ placements: PLACEMENTS, edgeRoutes: [], skipped: overCap(200) });
    const { onLayoutError } = renderEditor();

    fireEvent.click(screen.getByLabelText('Tidy layout'));

    await waitFor(() => expect(onLayoutError).toHaveBeenCalledTimes(1));
    const message = onLayoutError.mock.calls[0][0];
    // Says what is wrong with the BOARD, in the board's own terms.
    expect(message).toContain('200');
    expect(message).toMatch(/could not be routed automatically/i);
    // And does NOT send them to "Route connections", which cannot route this
    // board either — pointing there would be pointing at a second failure.
    expect(message).not.toMatch(/route connections/i);
  });

  it('reports an over-cap board on a route-only press', async () => {
    mockRoute.mockResolvedValue({ placements: [], edgeRoutes: [], skipped: overCap(180) });
    const { onLayoutError } = renderEditor();

    fireEvent.click(screen.getByLabelText('Route connections only'));

    await waitFor(() => expect(onLayoutError).toHaveBeenCalledTimes(1));
    expect(onLayoutError.mock.calls[0][0]).toContain('180');
  });

  it('answers EVERY press, because the user asked every time', async () => {
    mockRoute.mockResolvedValue({ placements: [], edgeRoutes: [], skipped: overCap(180) });
    const { onLayoutError } = renderEditor();

    const button = screen.getByLabelText('Route connections only');
    fireEvent.click(button);
    await waitFor(() => expect(onLayoutError).toHaveBeenCalledTimes(1));
    fireEvent.click(button);
    await waitFor(() => expect(onLayoutError).toHaveBeenCalledTimes(2));
  });

  it('says nothing when no tier was refused', async () => {
    // Silence has to stay meaningful, or the message becomes noise people learn
    // to dismiss — which is the failure mode the reporting work exists to avoid.
    mockRoute.mockResolvedValue({ placements: [], edgeRoutes: [], skipped: [] });
    const { onLayoutError } = renderEditor();

    fireEvent.click(screen.getByLabelText('Route connections only'));

    await waitFor(() => expect(mockRoute).toHaveBeenCalled());
    expect(onLayoutError).not.toHaveBeenCalled();
  });

  it('prefers the routing FAILURE message when both could be reported', async () => {
    // One message per press. A router that threw is the more useful thing to say
    // than a cap it never reached.
    mockTidy.mockResolvedValue({
      placements: PLACEMENTS,
      routingError: wasmDown(),
      skipped: overCap(200),
    });
    const { onLayoutError } = renderEditor();

    fireEvent.click(screen.getByLabelText('Tidy layout'));

    await waitFor(() => expect(onLayoutError).toHaveBeenCalledTimes(1));
    expect(onLayoutError.mock.calls[0][0]).toMatch(/could not be routed. Reload/i);
  });
});

/**
 * Live mode meeting a board the router refuses.
 *
 * Nobody pressed anything, so the rules are different from the two button paths
 * above: the mode turns itself OFF (and persists that, so reopening the diagram
 * does not re-enter a mode that cannot work), and it says so exactly once. A live
 * mode that emitted a toast per drag would turn the failure-reporting work into
 * noise, which is the failure it exists to avoid.
 */
describe('SolutionDesignEditor — live routing on an over-cap board', () => {
  const overCap = [{ connectorCount: 200, connectionIds: ['c1'] }];

  function renderLive() {
      const onLayoutError = vi.fn<(message: string) => void>();
    const live = model();
    live.diagrams[0].autoRoute = true;
    const host = { current: undefined as unknown as EditorHostState };
    const props: HostedEditorProps = {
      model: live,
      activeDiagramId: 'd1',
      onActiveDiagramChange: vi.fn(),
      onCreateContainerDiagram: vi.fn(),
      onCreateLayer7Diagram: vi.fn(),
      onLayoutError,
    };
    render(
      <ThemeProvider theme={createTheme()}>
        <div style={{ width: '1200px', height: '800px' }}>
          <HostedEditor {...props} hostRef={host} />
        </div>
      </ThemeProvider>,
    );
    return { host, onLayoutError };
  }

  /**
   * A real geometry change — placing an element from the palette goes through
   * `addElement`, which is on the bump list. (The Undo button is disabled on an
   * empty history, so clicking it moves nothing.)
   */
  const changeGeometry = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Application', expanded: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Add application' }));
  };

  it('shows the toggle pressed when the diagram has the mode on', () => {
    renderLive();
    expect(
      screen.getByLabelText('Auto-route connections').getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('turns itself off and reports once when the board is over the cap', async () => {
    mockRoute.mockResolvedValue({ placements: [], edgeRoutes: [], skipped: overCap });
    const { host, onLayoutError } = renderLive();

    // Two geometry changes: the message must still arrive exactly once.
    changeGeometry();
    changeGeometry();

    await waitFor(() => expect(onLayoutError).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(onLayoutError.mock.calls[0][0]).toContain('200');
    // Persisted off, so reopening does not re-enter a mode that cannot work.
    await waitFor(() => expect(host.current.model.diagrams[0].autoRoute).toBe(false));
  });

  it('does not report a live pass that FAILED, because nobody asked for it', async () => {
    // The asymmetry with the two button paths: a message the user did not prompt,
    // about a pass they did not start, is noise. The console still carries it.
    mockRoute.mockRejectedValue(wasmDown());
    const { onLayoutError } = renderLive();

    changeGeometry();

    await waitFor(() => expect(mockRoute).toHaveBeenCalled(), { timeout: 2000 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onLayoutError).not.toHaveBeenCalled();
  });
});

/**
 * What an UNATTENDED pass says when it goes wrong.
 *
 * The wording differs from the button paths on purpose. "Reload the page and try
 * again" is advice for somebody who pressed something and is waiting for it; for
 * a pass that ran by itself when the diagram opened, it reads as an alarm about
 * an action the user did not take and cannot repeat.
 */
describe('SolutionDesignEditor — an automatic layout that failed', () => {
  function renderNeedingLayout() {
      const onLayoutError = vi.fn<(message: string) => void>();
    const onLayoutSettled = vi.fn<(diagramId: string) => void>();
    const pending = model();
    pending.diagrams[0].needsLayout = true;
    const host = { current: undefined as unknown as EditorHostState };
    const props: HostedEditorProps = {
      model: pending,
      activeDiagramId: 'd1',
      onActiveDiagramChange: vi.fn(),
      onCreateContainerDiagram: vi.fn(),
      onCreateLayer7Diagram: vi.fn(),
      onLayoutError,
      onLayoutSettled,
    };
    render(
      <ThemeProvider theme={createTheme()}>
        <div style={{ width: '1200px', height: '800px' }}>
          <HostedEditor {...props} hostRef={host} />
        </div>
      </ThemeProvider>,
    );
    return { host, onLayoutError, onLayoutSettled };
  }

  it('keeps the placements and says so plainly when only the ROUTING failed', async () => {
    const moved = PLACEMENTS.map((p) => ({ ...p, y: p.y + 120 }));
    mockTidy.mockResolvedValue({ placements: moved, routingError: wasmDown() });
    const { host, onLayoutError, onLayoutSettled } = renderNeedingLayout();

    await waitFor(() => expect(host.current.commands.length).toBeGreaterThan(0));
    expect(onLayoutError).toHaveBeenCalledTimes(1);
    expect(onLayoutError.mock.calls[0][0]).toBe(
      'This diagram was laid out but its connections could not be routed.',
    );
    // It DID lay out, so the host is told and clears the flag.
    await waitFor(() => expect(onLayoutSettled).toHaveBeenCalledWith('d1'));
  });

  it('does not tell the host it settled when the pass threw outright', async () => {
    // The host clears the persisted flag from `onLayoutSettled`. Clearing it here
    // would mean the diagram is never laid out again; leaving it set gives the
    // board one more attempt the next time somebody opens it.
    mockTidy.mockRejectedValue(new Error('ELK exploded'));
    const { onLayoutError, onLayoutSettled } = renderNeedingLayout();

    await waitFor(() => expect(onLayoutError).toHaveBeenCalledTimes(1));
    expect(onLayoutError.mock.calls[0][0]).toBe('This diagram could not be laid out automatically.');
    expect(onLayoutSettled).not.toHaveBeenCalled();
  });

  it('reports an over-cap board once, and still settles', async () => {
    mockTidy.mockResolvedValue({
      placements: PLACEMENTS,
      edgeRoutes: [],
      skipped: [{ connectorCount: 200, connectionIds: ['c1'] }],
    });
    const { onLayoutError, onLayoutSettled } = renderNeedingLayout();

    await waitFor(() => expect(onLayoutError).toHaveBeenCalledTimes(1));
    expect(onLayoutError.mock.calls[0][0]).toContain('200');
    // Placed but unrouted is still placed: the flag is cleared and the board is
    // not offered up for a second attempt it would fail the same way.
    await waitFor(() => expect(onLayoutSettled).toHaveBeenCalledWith('d1'));
  });
});
