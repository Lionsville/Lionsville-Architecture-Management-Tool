// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { SolutionDesignEditor } from '../editor/SolutionDesignEditor';
import { installReactFlowMocks } from '../editor/reactFlowTestSetup';
import { placementRect } from '../model/placement';
import { drawnPolyline, legAxis } from '../model/routes';
import type { DesignModel, DiagramContentBatch, Point, SolutionDesignEditorProps } from '../types';

/**
 * The three drag gestures on a line — bend, segment, label — through the real
 * editor (routing phase 2b). What each one COMMITS is the contract: one
 * `setWaypoints` / `setLabelPosition` per gesture on pointer-up, nothing at all
 * on Escape or `pointercancel`, and nothing for a press that never travelled the
 * drag threshold. The pure geometry lives in `routes.test.ts`; this pins the
 * wiring between the pointer and the model.
 *
 * jsdom has no `PointerEvent`, so the events are `MouseEvent`s typed
 * `pointerdown` etc. — they carry `button` and `clientX/Y`, reach React's
 * synthetic handler and the native listeners `usePointerDrag` puts on the
 * captured element (same trick as `usePointerDrag.test.tsx`).
 */

beforeAll(() => installReactFlowMocks());
afterEach(() => cleanup());

// a1: 400..600 × 300..430 (application 200×130), right-side centre y = 365.
// b1: 1000..1200 × 600..730, left-side centre y = 665.
const A = { elementId: 'a1', zone: 'landscape' as const, x: 400, y: 300 };
const B = { elementId: 'b1', zone: 'landscape' as const, x: 1000, y: 600 };
const A_RECT = placementRect('application', A);
const B_RECT = placementRect('application', B);
/** a1 right (600,365) → (800,365) → (800,665) → b1 left (1000,665): H, V, H. */
const BENDS: Point[] = [
  { x: 800, y: 365 },
  { x: 800, y: 665 },
];

function model(): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: [
      { id: 'a1', kind: 'application', name: 'A', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'b1', kind: 'application', name: 'B', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
    ],
    connections: [{ id: 'c1', sourceId: 'a1', targetId: 'b1', label: 'Sends orders', isBidirectional: false }],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [A, B],
        // Router output: the drag must claim it, and a click must NOT.
        edgeRoutes: [{ connectionId: 'c1', waypoints: BENDS, source: 'auto' }],
      },
    ],
  };
}

function renderEditor(overrides: Partial<SolutionDesignEditorProps> = {}) {
  const onChange = vi.fn<(batch: DiagramContentBatch) => void>();
  const props: SolutionDesignEditorProps = {
    model: model(),
    activeDiagramId: 'd1',
    onActiveDiagramChange: vi.fn(),
    onChange,
    onCreateContainerDiagram: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
    parameterSpecs: () => [],
    ...overrides,
  };
  render(
    <ThemeProvider theme={createTheme()}>
      <div style={{ width: '1200px', height: '800px' }}>
        <SolutionDesignEditor {...props} />
      </div>
    </ThemeProvider>,
  );
  const lastRoute = () =>
    (onChange.mock.calls.at(-1)?.[0] as DiagramContentBatch | undefined)?.edgeRoutes.find(
      (r) => r.connectionId === 'c1',
    );
  return { onChange, lastRoute };
}

/** Handles belong to the SELECTED line (2a), so every gesture starts by picking it up. */
async function selectEdge(): Promise<void> {
  fireEvent.click(await screen.findByTestId('rf__edge-c1'));
  await screen.findByTestId('waypoint-c1-0');
}

function pointer(type: string, init: MouseEventInit = {}): MouseEvent {
  return new MouseEvent(type, { button: 0, bubbles: true, cancelable: true, ...init });
}

/**
 * The viewport transform React Flow wrote. jsdom has no layout, so the pane's
 * rect is (0,0) and the transform alone maps client ↔ flow — the same arithmetic
 * `screenToFlowPosition` performs, which is what the edge maps its deltas with.
 */
function viewport(): { tx: number; ty: number; k: number } {
  const el = document.querySelector('.react-flow__viewport') as HTMLElement;
  const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\) scale\(([\d.]+)\)/.exec(el.style.transform);
  if (!match) throw new Error(`unexpected viewport transform: ${el.style.transform}`);
  const [, tx, ty, k] = match.map(Number);
  return { tx, ty, k };
}
const toFlow = (client: Point): Point => {
  const { tx, ty, k } = viewport();
  return { x: (client.x - tx) / k, y: (client.y - ty) / k };
};
/** A client-pixel delta that maps to `flow` pixels at the current zoom. */
const clientDelta = (flow: Point): Point => {
  const { k } = viewport();
  return { x: flow.x * k, y: flow.y * k };
};

/** A complete gesture: down at `from`, one move per `via`, up at the last point. */
function drag(handle: HTMLElement, from: Point, ...via: Point[]): void {
  fireEvent(handle, pointer('pointerdown', { clientX: from.x, clientY: from.y }));
  for (const p of via) fireEvent(handle, pointer('pointermove', { clientX: p.x, clientY: p.y }));
  const last = via.at(-1) ?? from;
  fireEvent(handle, pointer('pointerup', { clientX: last.x, clientY: last.y }));
}

/** The translate(...) the handle is drawn at — the live preview while a drag runs. */
function handlePosition(handle: HTMLElement): Point {
  const match = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(handle.style.transform);
  if (!match) throw new Error(`no position in ${handle.style.transform}`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

const FROM: Point = { x: 300, y: 300 };

describe('FloatingEdge — bend drag', () => {
  it('commits the bend where the pointer came up, in flow coordinates, and claims the route', async () => {
    const { onChange, lastRoute } = renderEditor();
    await selectEdge();
    const to = { x: 360, y: 340 };

    drag(screen.getByTestId('waypoint-c1-0'), FROM, { x: 330, y: 320 }, to);

    expect(onChange).toHaveBeenCalledTimes(1); // one gesture, one commit, one undo step
    const route = lastRoute();
    expect(route?.source).toBe('manual');
    expect(route?.waypoints).toHaveLength(2);
    const expected = toFlow(to);
    expect(route?.waypoints[0].x).toBeCloseTo(expected.x, 5);
    expect(route?.waypoints[0].y).toBeCloseTo(expected.y, 5);
    expect(route?.waypoints[1]).toEqual(BENDS[1]);
  });
});

describe('FloatingEdge — segment drag', () => {
  it('shifts the leg perpendicular to itself and commits an orthogonal route', async () => {
    const { onChange, lastRoute } = renderEditor();
    await selectEdge();
    // Leg 1 is the vertical middle leg at x = 800. A drag that is mostly
    // sideways, with some vertical noise the leg cannot follow.
    const delta = clientDelta({ x: 60, y: 25 });

    drag(screen.getByTestId('segment-c1-1'), FROM, { x: FROM.x + delta.x, y: FROM.y + delta.y });

    expect(onChange).toHaveBeenCalledTimes(1);
    const route = lastRoute();
    expect(route?.source).toBe('manual');
    expect(route?.waypoints).toHaveLength(2);
    // x moved by the drag's x, y did not move at all.
    expect(route!.waypoints[0].x).toBeCloseTo(860, 5);
    expect(route!.waypoints[1].x).toBeCloseTo(860, 5);
    expect(route!.waypoints[0].y).toBe(365);
    expect(route!.waypoints[1].y).toBe(665);
    // Every leg of the line as DRAWN — anchors from `routeEndAnchor` — is axis-aligned.
    const drawn = drawnPolyline(route!.waypoints, A_RECT, B_RECT);
    for (let i = 0; i < drawn.length - 1; i += 1) {
      expect(legAxis(drawn[i], drawn[i + 1]), `leg ${i}`).not.toBe('diagonal');
    }
  });

  it('makes an orthogonal jog out of a line that has no bends', async () => {
    const m = model();
    m.diagrams[0].edgeRoutes = [];
    const { onChange, lastRoute } = renderEditor({ model: m });
    fireEvent.click(await screen.findByTestId('rf__edge-c1'));
    // A straight line shows exactly one segment handle.
    const handle = await screen.findByTestId('segment-c1-0');
    expect(screen.queryByTestId('segment-c1-1')).toBeNull();
    expect(screen.queryByTestId('waypoint-c1-0')).toBeNull();

    drag(handle, FROM, { x: FROM.x + clientDelta({ x: 40, y: 0 }).x, y: FROM.y });

    expect(onChange).toHaveBeenCalledTimes(1);
    const route = lastRoute();
    expect(route?.source).toBe('manual');
    expect(route!.waypoints.length).toBeGreaterThanOrEqual(2);
    const drawn = drawnPolyline(route!.waypoints, A_RECT, B_RECT);
    for (let i = 0; i < drawn.length - 1; i += 1) {
      expect(legAxis(drawn[i], drawn[i + 1]), `leg ${i} of ${JSON.stringify(drawn)}`).not.toBe('diagonal');
    }
  });
});

describe('FloatingEdge — label drag', () => {
  it('commits the chip anchor where the pointer came up', async () => {
    const { onChange, lastRoute } = renderEditor();
    const chip = await screen.findByTestId('edge-label-c1');
    const to = { x: 420, y: 260 };

    drag(chip, FROM, { x: 350, y: 280 }, to);

    expect(onChange).toHaveBeenCalledTimes(1);
    const route = lastRoute();
    expect(route?.source).toBe('manual');
    expect(route?.waypoints).toEqual(BENDS); // the bends ride along untouched
    const expected = toFlow(to);
    expect(route?.labelPosition?.x).toBeCloseTo(expected.x, 5);
    expect(route?.labelPosition?.y).toBeCloseTo(expected.y, 5);
  });
});

describe('FloatingEdge — cancelled and aborted gestures commit nothing', () => {
  it('Escape mid-drag drops the preview and leaves the model alone', async () => {
    const { onChange } = renderEditor();
    await selectEdge();
    const handle = screen.getByTestId('waypoint-c1-0');

    fireEvent(handle, pointer('pointerdown', { clientX: FROM.x, clientY: FROM.y }));
    fireEvent(handle, pointer('pointermove', { clientX: FROM.x + 50, clientY: FROM.y + 50 }));
    // The preview is live: the handle has left its stored spot…
    expect(handlePosition(screen.getByTestId('waypoint-c1-0'))).not.toEqual(BENDS[0]);
    fireEvent.keyDown(document.body, { key: 'Escape' });

    // …and is back on it, with nothing emitted.
    expect(handlePosition(screen.getByTestId('waypoint-c1-0'))).toEqual(BENDS[0]);
    expect(onChange).not.toHaveBeenCalled();
    // The gesture is over: a later pointer-up is dead too.
    fireEvent(handle, pointer('pointerup', { clientX: FROM.x + 50, clientY: FROM.y + 50 }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('pointercancel (the browser took the pointer) does the same, on every handle kind', async () => {
    const { onChange } = renderEditor();
    await selectEdge();
    for (const id of ['waypoint-c1-0', 'segment-c1-1', 'edge-label-c1']) {
      const handle = screen.getByTestId(id);
      fireEvent(handle, pointer('pointerdown', { clientX: FROM.x, clientY: FROM.y }));
      fireEvent(handle, pointer('pointermove', { clientX: FROM.x + 60, clientY: FROM.y + 60 }));
      fireEvent(handle, pointer('pointercancel'));
      fireEvent(handle, pointer('pointerup', { clientX: FROM.x + 60, clientY: FROM.y + 60 }));
    }
    expect(onChange).not.toHaveBeenCalled();
    expect(handlePosition(screen.getByTestId('waypoint-c1-0'))).toEqual(BENDS[0]);
  });

  it('a press that travels one pixel is a click, not a drag: nothing is committed or claimed', async () => {
    const { onChange } = renderEditor();
    await selectEdge();
    for (const id of ['waypoint-c1-0', 'segment-c1-1']) {
      drag(screen.getByTestId(id), FROM, { x: FROM.x + 1, y: FROM.y });
    }
    // On the chip a plain click SELECTS the line — still no route commit.
    drag(screen.getByTestId('edge-label-c1'), FROM, { x: FROM.x + 1, y: FROM.y + 1 });
    expect(onChange).not.toHaveBeenCalled();
    // Router output stays router output.
    expect(screen.getByTestId('route-badge').textContent).toBe('Automatic');
  });
});
