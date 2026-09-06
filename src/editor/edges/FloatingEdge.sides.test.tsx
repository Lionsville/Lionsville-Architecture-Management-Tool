// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { Position } from '@xyflow/react';
import { HostedEditor } from '../testing/editorHost';
import type { EditorHostState, HostedEditorProps } from '../testing/editorHost';
import { installReactFlowMocks } from '../reactFlowTestSetup';
import type { DesignModel, EdgeRoute, Point } from '../../model/types';

/**
 * What a fixed attach side does on screen (Phase 2d), and the handle sizing fix
 * that shipped with it: a selected line shows a marker on each fixed side, a
 * routed line whose leg cannot meet its side square draws the stub legs (and
 * offers their handles), and every handle is counter-scaled by the zoom so it
 * stays the same size on screen.
 */

beforeAll(() => installReactFlowMocks());
afterEach(() => cleanup());

// a1: 400..600 × 300..430 (top midpoint (500,300)); b1: 1000..1200 × 600..730.
const A = { elementId: 'a1', zone: 'landscape' as const, x: 400, y: 300 };
const B = { elementId: 'b1', zone: 'landscape' as const, x: 1000, y: 600 };
const BENDS: Point[] = [
  { x: 800, y: 365 },
  { x: 800, y: 665 },
];

function model(route: EdgeRoute | undefined): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: [
      { id: 'a1', kind: 'application', name: 'A', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'b1', kind: 'application', name: 'B', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
    ],
    connections: [{ id: 'c1', sourceId: 'a1', targetId: 'b1', isBidirectional: false }],
    diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements: [A, B], edgeRoutes: route ? [route] : [] }],
  };
}

function renderEditor(route: EdgeRoute | undefined, overrides: Partial<HostedEditorProps> = {}) {
  const host = { current: undefined as unknown as EditorHostState };
  const props: HostedEditorProps = {
    model: model(route),
    activeDiagramId: 'd1',
    onActiveDiagramChange: vi.fn(),
    onCreateContainerDiagram: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
    ...overrides,
  };
  render(
    <ThemeProvider theme={createTheme()}>
      <div style={{ width: '1200px', height: '800px' }}>
        <HostedEditor {...props} hostRef={host} />
      </div>
    </ThemeProvider>,
  );
}

/** The zoom React Flow wrote onto the viewport. */
function zoom(): number {
  const el = document.querySelector('.react-flow__viewport') as HTMLElement;
  const match = /scale\(([\d.]+)\)/.exec(el.style.transform);
  if (!match) throw new Error(`unexpected viewport transform: ${el.style.transform}`);
  return Number(match[1]);
}
const translateOf = (el: HTMLElement): Point => {
  const match = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(el.style.transform);
  if (!match) throw new Error(`no position in ${el.style.transform}`);
  return { x: Number(match[1]), y: Number(match[2]) };
};
const scaleOf = (el: HTMLElement): number => {
  const match = /scale\(([\d.]+)\)/.exec(el.style.transform);
  if (!match) throw new Error(`no scale in ${el.style.transform}`);
  return Number(match[1]);
};

describe('a side, as React Flow says it', () => {
  // The pure geometry answers in `AttachSide` and this component maps it onto
  // React Flow's `Position`. The map is an identity, which is only safe as long
  // as the enum keeps these four values — so that, and not the map, is what is
  // pinned here.
  it('has the same four values the geometry uses', () => {
    expect([Position.Top, Position.Right, Position.Bottom, Position.Left])
      .toEqual(['top', 'right', 'bottom', 'left']);
  });
});

describe('FloatingEdge — fixed side on a routed line', () => {
  const routed: EdgeRoute = { connectionId: 'c1', waypoints: BENDS, source: 'manual', sourceSide: 'top' };

  it('marks the fixed side while selected, at the point the line leaves it, and only then', async () => {
    renderEditor(routed);
    const edge = await screen.findByTestId('rf__edge-c1');
    expect(screen.queryByTestId('side-marker-c1-source')).toBeNull(); // unselected: nothing
    fireEvent.click(edge);
    const marker = await screen.findByTestId('side-marker-c1-source');
    expect(translateOf(marker)).toEqual({ x: 500, y: 300 }); // a1's top midpoint
    expect(screen.queryByTestId('side-marker-c1-target')).toBeNull(); // the free end has none
  });

  it('draws the stub legs the side costs, with a handle on each', async () => {
    renderEditor(routed);
    fireEvent.click(await screen.findByTestId('rf__edge-c1'));
    await screen.findByTestId('waypoint-c1-0');
    // top (500,300) → (500,276) → (800,276) → (800,365) → (800,665) → (1000,665): five legs.
    expect(screen.getByTestId('segment-c1-4')).toBeDefined();
    expect(screen.queryByTestId('segment-c1-5')).toBeNull();
    // The stub bends are drawn, not stored: still exactly two bend handles.
    expect(screen.getByTestId('waypoint-c1-1')).toBeDefined();
    expect(screen.queryByTestId('waypoint-c1-2')).toBeNull();
    // The first handle sits on the stub leg out of the top, above the node.
    expect(translateOf(screen.getByTestId('segment-c1-0'))).toEqual({ x: 500, y: 288 });
  });

  it('shows no marker in read-only mode', async () => {
    renderEditor(routed, { readOnly: true });
    fireEvent.click(await screen.findByTestId('rf__edge-c1'));
    expect(screen.queryByTestId('side-marker-c1-source')).toBeNull();
    expect(screen.queryByTestId('waypoint-c1-0')).toBeNull();
  });
});

describe('FloatingEdge — handles keep their screen size', () => {
  it('counter-scales every handle and marker by 1 / zoom', async () => {
    renderEditor({ connectionId: 'c1', waypoints: BENDS, source: 'auto', targetSide: 'left' });
    fireEvent.click(await screen.findByTestId('rf__edge-c1'));
    const bend = await screen.findByTestId('waypoint-c1-0');
    const expected = 1 / zoom();
    expect(zoom()).not.toBe(1); // fitView on a 1200×800 pane: the test has teeth
    expect(scaleOf(bend)).toBeCloseTo(expected, 4);
    expect(scaleOf(screen.getByTestId('segment-c1-1'))).toBeCloseTo(expected, 4);
    expect(scaleOf(screen.getByTestId('side-marker-c1-target'))).toBeCloseTo(expected, 4);
    // The hit box is at least 16 px square, around a 10 px bend square.
    expect(bend.style.width).toBe('16px');
    expect(bend.style.height).toBe('16px');
    expect((bend.firstElementChild as HTMLElement).style.width).toBe('10px');
    const pill = screen.getByTestId('segment-c1-1');
    expect(Number.parseFloat(pill.style.height)).toBeGreaterThanOrEqual(16);
    expect((pill.firstElementChild as HTMLElement).style.width).toBe('18px');
    expect((pill.firstElementChild as HTMLElement).style.height).toBe('8px');
  });
});
