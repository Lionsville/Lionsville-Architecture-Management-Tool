// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { laidOut } from '../model/testFixtures';
import type { DesignModel, PlacedNode } from '../model/types';
import { tidyLayer7 } from '../layout/tidy';
import { testTheme } from './testing/theme';
import { HostedEditor } from './testing/editorHost';
import type { EditorHostState, HostedEditorProps } from './testing/editorHost';
import { installReactFlowMocks } from './reactFlowTestSetup';
import { ViewportMemory } from './canvas/viewportMemory';

/**
 * A board nobody has laid out, opened by a reader.
 *
 * A machine-written board carries `needsLayout` and no positions, and every
 * member of it answers (0, 0) until a settling pass lands. That pass is the
 * step of whoever may write the board and opens it first; a reader makes no
 * step, so a reader who got there first saw every card on one point. What is
 * pinned here is the other half: the reader is shown the same pass, and
 * nothing about it is landed or reported as settled.
 *
 * The pass itself is stubbed, as in `layoutErrors`: what is under test is what
 * the editor does with a result, not how ELK arrives at one.
 */
vi.mock('../layout/tidy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../layout/tidy')>()),
  tidyLayer7: vi.fn(),
}));

const mockTidy = vi.mocked(tidyLayer7);

beforeAll(() => {
  installReactFlowMocks();
});
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mockTidy.mockReset();
});

const IDS = ['a1', 'a2', 'a3'] as const;

/** Where the pass puts each card: three distinct spots in the landscape band. */
const LAID: PlacedNode[] = IDS.map((id, i) => ({ id, zone: 'landscape', x: 120 + i * 360, y: 420 }));

function element(id: string) {
  return { id, kind: 'application' as const, name: `App ${id}`, lifecycle: 'live' as const, isManaged: true, aspects: {} };
}

/** A landscape a machine wrote: three members, the flag, and not one position. */
function unplaced(): DesignModel {
  const board = laidOut({
    id: 'd1', kind: 'layer7', name: 'Landscape', needsLayout: true,
    placements: IDS.map((id) => ({ id, zone: 'landscape' as const, x: 0, y: 0 })),
  });
  return {
    name: 'Example',
    diagrams: [{ ...board, geometry: { ...board.geometry, nodes: [] } }],
    elements: IDS.map(element),
    relations: [{ type: 'flow', id: 'c1', sourceId: 'a1', targetId: 'a2', isBidirectional: false }],
  };
}

/** The same board after somebody's settling step: real positions, no flag. */
function placed(): DesignModel {
  const before = unplaced();
  const board = laidOut({
    id: 'd1', kind: 'layer7', name: 'Landscape',
    placements: IDS.map((id, i) => ({ id, zone: 'landscape' as const, x: 200, y: 300 + i * 200 })),
  });
  return { ...before, diagrams: [board] };
}

/** The same board renamed by somebody who did not open it: still no positions. */
function renamed(): DesignModel {
  const before = unplaced();
  return { ...before, diagrams: [{ ...before.diagrams[0], name: 'Landscape, renamed' }] };
}

function renderBoard(over: Partial<HostedEditorProps> = {}) {
  const onLayoutSettled = vi.fn<(diagramId: string) => void>();
  const onLayoutError = vi.fn<(message: string) => void>();
  const host = { current: undefined as unknown as EditorHostState };
  const props: HostedEditorProps = {
    model: unplaced(),
    activeDiagramId: 'd1',
    readOnly: true,
    onLayoutSettled,
    onLayoutError,
    ...over,
  };
  const view = render(
    <ThemeProvider theme={testTheme}>
      <div style={{ width: '1200px', height: '800px' }}>
        <HostedEditor {...props} hostRef={host} />
      </div>
    </ThemeProvider>,
  );
  const rerender = (next: Partial<HostedEditorProps>) => view.rerender(
    <ThemeProvider theme={testTheme}>
      <div style={{ width: '1200px', height: '800px' }}>
        <HostedEditor {...props} {...next} hostRef={host} />
      </div>
    </ThemeProvider>,
  );
  return { host, onLayoutSettled, onLayoutError, rerender };
}

/** Where each card is drawn, as React Flow puts it on the node's element. */
function drawnAt(): Map<string, string> {
  const at = new Map<string, string>();
  for (const id of IDS) {
    const node = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
    if (node) at.set(id, node.style.transform);
  }
  return at;
}

describe('SolutionDesignEditor — a reader opening a board nobody has laid out', () => {
  it('is shown the board laid out, not piled on one point', async () => {
    mockTidy.mockResolvedValue({ placements: LAID, edgeRoutes: [] });
    renderBoard();

    await waitFor(() => expect(drawnAt().size).toBe(IDS.length));
    await waitFor(() => expect(new Set(drawnAt().values()).size).toBe(IDS.length));
    expect(mockTidy).toHaveBeenCalledTimes(1);
    // The writer's settling options: whatever pins the session holds, none here.
    expect(mockTidy.mock.calls[0][2]).toMatchObject({ pinGroups: false, pinGroupContents: false, pinAnchorPoints: false });
  });

  it('lands nothing and tells nobody the board settled', async () => {
    mockTidy.mockResolvedValue({ placements: LAID, edgeRoutes: [] });
    const { host, onLayoutSettled } = renderBoard();

    await waitFor(() => expect(new Set(drawnAt().values()).size).toBe(IDS.length));
    // No step, so the stored board still asks for its layout: the first person
    // who may write it settles it, as the step of their own open.
    expect(host.current.commands).toEqual([]);
    expect(onLayoutSettled).not.toHaveBeenCalled();
    expect(host.current.model.diagrams[0].geometry.needsLayout).toBe(true);
    expect(host.current.model.diagrams[0].geometry.nodes).toEqual([]);
  });

  it('gives way to the stored layout once somebody has laid the board out', async () => {
    mockTidy.mockResolvedValue({ placements: LAID, edgeRoutes: [] });
    const { rerender } = renderBoard();
    await waitFor(() => expect(new Set(drawnAt().values()).size).toBe(IDS.length));
    const shown = drawnAt();

    rerender({ model: placed() });

    // The stored positions win: every card moves off where the reader's pass
    // put it, and no second pass runs for a board that now has positions.
    await waitFor(() => {
      const now = drawnAt();
      for (const id of IDS) expect(now.get(id)).not.toBe(shown.get(id));
    });
    expect(new Set(drawnAt().values()).size).toBe(IDS.length);
    expect(mockTidy).toHaveBeenCalledTimes(1);
  });

  it('says so once, and draws the board as stored, when the pass fails', async () => {
    mockTidy.mockRejectedValue(new Error('ELK exploded'));
    const { host, onLayoutError, onLayoutSettled } = renderBoard();

    await waitFor(() => expect(onLayoutError).toHaveBeenCalledTimes(1));
    expect(onLayoutError.mock.calls[0][0]).toBe('This diagram could not be laid out automatically.');
    expect(host.current.commands).toEqual([]);
    expect(onLayoutSettled).not.toHaveBeenCalled();
    expect(mockTidy).toHaveBeenCalledTimes(1);
  });

  it('forgets the frame of a board whose pass lands while the reader is on another', async () => {
    let finish!: () => void;
    mockTidy.mockImplementation(() => new Promise((resolve) => { finish = () => resolve({ placements: LAID, edgeRoutes: [] }); }));
    const forget = vi.spyOn(ViewportMemory.prototype, 'forget');
    const other = laidOut({
      id: 'd2', kind: 'layer7', name: 'Other',
      placements: IDS.map((id, i) => ({ id, zone: 'landscape' as const, x: 200 + i * 360, y: 300 })),
    });
    const model = { ...unplaced(), diagrams: [...unplaced().diagrams, other] };
    const { rerender } = renderBoard({ model });
    await waitFor(() => expect(mockTidy).toHaveBeenCalledTimes(1));

    // The reader goes to another board before the pass lands: the canvas framed
    // the pile meanwhile, and kept that frame for when they come back.
    rerender({ model, activeDiagramId: 'd2' });
    finish();
    await waitFor(() => expect(forget).toHaveBeenCalledWith('d1'));

    // Back on it, it is laid out, from the pass that already ran.
    rerender({ model, activeDiagramId: 'd1' });
    await waitFor(() => expect(new Set(drawnAt().values()).size).toBe(IDS.length));
    expect(mockTidy).toHaveBeenCalledTimes(1);
  });

  it('keeps the cards where they are while a board changed under the reader is worked out again', async () => {
    mockTidy.mockResolvedValueOnce({ placements: LAID, edgeRoutes: [] });
    mockTidy.mockImplementation(() => new Promise(() => {}));
    const { rerender } = renderBoard();
    await waitFor(() => expect(new Set(drawnAt().values()).size).toBe(IDS.length));
    const shown = drawnAt();

    // Somebody renames the board without opening it: a new board, still with
    // no positions, and a pass of its own that has not landed.
    rerender({ model: renamed() });
    await waitFor(() => expect(mockTidy).toHaveBeenCalledTimes(2));
    expect(drawnAt()).toEqual(shown);
  });

  it('tells a reader about a failing pass once per board, however often the board changes', async () => {
    mockTidy.mockResolvedValue({ placements: LAID, edgeRoutes: [], routingError: new Error('router down') });
    const { onLayoutError, rerender } = renderBoard();
    await waitFor(() => expect(onLayoutError).toHaveBeenCalledTimes(1));
    expect(onLayoutError.mock.calls[0][0]).toBe('This diagram was laid out but its connections could not be routed.');

    rerender({ model: renamed() });
    await waitFor(() => expect(mockTidy).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 20));
    expect(onLayoutError).toHaveBeenCalledTimes(1);
  });

  it('leaves a board somebody has laid out exactly as stored', async () => {
    renderBoard({ model: placed() });

    await waitFor(() => expect(drawnAt().size).toBe(IDS.length));
    await new Promise((r) => setTimeout(r, 20));
    expect(mockTidy).not.toHaveBeenCalled();
  });
});

describe('SolutionDesignEditor — a writer opening the same board', () => {
  it('still settles it as a step of its own open, and is not shown a second pass', async () => {
    mockTidy.mockResolvedValue({ placements: LAID, edgeRoutes: [] });
    const { host, onLayoutSettled } = renderBoard({ readOnly: false });

    await waitFor(() => expect(onLayoutSettled).toHaveBeenCalledWith('d1'));
    expect(host.current.commands.length).toBeGreaterThan(0);
    expect(host.current.model.diagrams[0].geometry.needsLayout).toBeUndefined();
    await waitFor(() => expect(new Set(drawnAt().values()).size).toBe(IDS.length));
    expect(mockTidy).toHaveBeenCalledTimes(1);
  });
});
