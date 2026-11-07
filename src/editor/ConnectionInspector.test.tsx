// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { laidOut } from '../model/testFixtures';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ConnectionInspector } from './ConnectionInspector';
import type { EditorActions } from './useEditorState';
import type { DesignDiagram, DesignModel, EdgeRoute, Relation } from '../model/types';
import type { AttachSidesPatch } from '../model/routes';

/**
 * U7a connection inspector: General / Appearance two-tab split. General owns the
 * single Direction control (source of truth for isBidirectional, D2); Appearance
 * owns the shared ColorField plus line/routing and the demoted per-end arrowhead
 * override, which must still round-trip sourceArrowhead/targetArrowhead. We
 * assert the updateConnection onChange contract — never MUI internals.
 */

afterEach(() => cleanup());

function connection(overrides: Partial<Relation> = {}): Relation {
  return { id: 'c1', type: 'flow', sourceId: 'a1', targetId: 'b1', isBidirectional: false, ...overrides };
}

function model(): DesignModel {
  return {
    name: 'SD',
    diagrams: [],
    elements: [
      { id: 'a1', kind: 'application', name: 'A', lifecycle: 'live', isManaged: false, aspects: {} },
      { id: 'b1', kind: 'application', name: 'B', lifecycle: 'live', isManaged: false, aspects: {} },
    ],
    relations: [],
  };
}

/** The active diagram, with whatever routes a test wants stored on it. */
function diagram(edgeRoutes: EdgeRoute[] = []): DesignDiagram {
  return laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [], edgeRoutes });
}

function makeActions(): {
  actions: EditorActions;
  updateConnection: ReturnType<typeof vi.fn>;
  setRouteSource: ReturnType<typeof vi.fn>;
} {
  const updateConnection = vi.fn();
  const setRouteSource = vi.fn();
  const actions = new Proxy({ updateConnection, setRouteSource } as Record<string | symbol, unknown>, {
    get(target, prop) {
      return target[prop] ?? vi.fn();
    },
  }) as unknown as EditorActions;
  return { actions, updateConnection, setRouteSource };
}

/** The editor's "Reset to automatic" callback; `null` in a test renders without one. */
type ResetRouteSpy = Mock<(connectionId: string) => void>;

/** The editor's "Attach at" callback; `null` renders without one. */
type SetRouteSidesSpy = Mock<(connectionId: string, sides: AttachSidesPatch) => void>;

function renderInspector(
  conn: Relation,
  opts: {
    readOnly?: boolean;
    routes?: EdgeRoute[];
    onResetRoute?: ResetRouteSpy | null;
    onSetRouteSides?: SetRouteSidesSpy | null;
    /** A landscape of two applications unless a test needs containers on it. */
    model?: DesignModel;
  } = {},
) {
  const { actions, updateConnection, setRouteSource } = makeActions();
  const onResetRoute: ResetRouteSpy | null =
    opts.onResetRoute === undefined ? vi.fn<(connectionId: string) => void>() : opts.onResetRoute;
  const onSetRouteSides: SetRouteSidesSpy | null =
    opts.onSetRouteSides === undefined
      ? vi.fn<(connectionId: string, sides: AttachSidesPatch) => void>()
      : opts.onSetRouteSides;
  const view = render(
    <ThemeProvider theme={createTheme()}>
      <ConnectionInspector
        connection={conn}
        model={opts.model ?? model()}
        diagram={diagram(opts.routes)}
        readOnly={opts.readOnly ?? false}
        actions={actions}
        onResetRoute={onResetRoute ?? undefined}
        onSetRouteSides={onSetRouteSides ?? undefined}
      />
    </ThemeProvider>,
  );
  return { ...view, updateConnection, setRouteSource, onResetRoute, onSetRouteSides };
}

const openAppearance = () => fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }));
const row = (testId: string) => screen.getByTestId(testId);
const press = (testId: string) => fireEvent.click(within(row(testId)).getByRole('button'));
const text = (testId: string) => row(testId).textContent ?? '';
/** A row that opens as a short list: its select changed is its commit. */
function choose(testId: string, label: string, value: string) {
  press(testId);
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function typeIn(testId: string, label: string, value: string) {
  press(testId);
  const field = screen.getByLabelText(label);
  fireEvent.change(field, { target: { value } });
  fireEvent.keyDown(field, { key: 'Enter' });
}

describe('ConnectionInspector: the same shell as an element', () => {
  it('names the line by its ends, and reads as rows that turn into a field on a press', () => {
    const { updateConnection } = renderInspector(connection({ label: 'orders' }));
    expect(screen.getByRole('heading', { name: 'A → B' })).toBeDefined();
    expect(text('connection-label')).toContain('orders');
    expect(screen.queryByRole('textbox')).toBeNull();
    typeIn('connection-protocol', 'Protocol', 'EDI');
    expect(updateConnection).toHaveBeenCalledWith('c1', { protocol: 'EDI' });
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('says Always of a line with no window, the state it is really in, and the window once it has one', () => {
    renderInspector(connection());
    expect(text('connection-valid')).toContain('Always');
    cleanup();
    renderInspector(connection({ validFrom: '2027-03-01' }));
    expect(text('connection-valid')).toContain('no end');
  });

  it('writes the window from the row, and clears it as absent', () => {
    const { updateConnection } = renderInspector(connection({ validFrom: '2027-03-01' }));
    press('connection-valid');
    fireEvent.change(screen.getByLabelText('Line valid until'), { target: { value: '2028-01-01' } });
    expect(updateConnection).toHaveBeenCalledWith('c1', { validUntil: '2028-01-01' });
    fireEvent.change(screen.getByLabelText('Line valid from'), { target: { value: '' } });
    expect(updateConnection).toHaveBeenCalledWith('c1', { validFrom: undefined });
  });

  it('keeps the delete in the ⋯, and none of it read-only', () => {
    renderInspector(connection());
    expect(screen.getByRole('button', { name: 'More' })).toBeDefined();
    cleanup();
    renderInspector(connection(), { readOnly: true });
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });

  it('marks a line assumed, as a word, and offers it behind + where nobody said', () => {
    const { updateConnection } = renderInspector(connection());
    expect(screen.queryByTestId('row-certainty')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^\+ Certainty/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Certainty' }));
    fireEvent.change(screen.getByLabelText('Certainty'), { target: { value: 'assumed' } });
    expect(updateConnection).toHaveBeenCalledWith('c1', { certainty: 'assumed' });
    cleanup();
    renderInspector(connection({ certainty: 'assumed' }));
    expect(text('row-certainty')).toContain('Assumed');
  });
});

describe('ConnectionInspector: Direction is the one source of truth (D2)', () => {
  it('drives isBidirectional', () => {
    const { updateConnection } = renderInspector(connection());
    choose('connection-direction', 'Direction', 'bidirectional');
    expect(updateConnection).toHaveBeenCalledWith('c1', { isBidirectional: true });
  });

  it('says so on the name and the row', () => {
    renderInspector(connection({ isBidirectional: true }));
    expect(screen.getByRole('heading', { name: 'A ↔ B' })).toBeDefined();
    expect(text('connection-direction')).toContain('Bidirectional');
  });

  it('keeps the per-end override round-tripping, and says it follows the direction until then', () => {
    const { updateConnection } = renderInspector(connection());
    openAppearance();
    expect(text('connection-arrowheads')).toContain('Follow the direction');
    press('connection-arrowheads');
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'arrow' } });
    expect(updateConnection).toHaveBeenCalledWith('c1', { sourceArrowhead: 'arrow' });
    fireEvent.change(screen.getByLabelText('Target'), { target: { value: '' } });
    expect(updateConnection).toHaveBeenCalledWith('c1', { targetArrowhead: undefined });
  });
});

describe('ConnectionInspector: what it looks like', () => {
  it('writes a hex and clears it, the NULL-inherit contract', () => {
    const { updateConnection } = renderInspector(connection({ color: '#112233' }));
    openAppearance();
    press('connection-colour');
    fireEvent.change(screen.getByLabelText('Edge colour'), { target: { value: '#445566' } });
    expect(updateConnection).toHaveBeenCalledWith('c1', { color: '#445566' });
  });

  it('writes no explicit default: the default choice is undefined', () => {
    const { updateConnection } = renderInspector(connection({ lineStyle: 'dashed' }));
    openAppearance();
    choose('connection-style', 'Line style', '');
    expect(updateConnection).toHaveBeenCalledWith('c1', { lineStyle: undefined });
  });

  it('goes back to Properties when the selected line changes', () => {
    const view = renderInspector(connection());
    openAppearance();
    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <ConnectionInspector connection={connection({ id: 'c2' })} model={model()} diagram={diagram()} readOnly={false} actions={makeActions().actions} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('tab', { name: 'Properties' }).getAttribute('aria-selected')).toBe('true');
  });

  it('presses nothing under readOnly, on either tab', () => {
    renderInspector(connection({ label: 'x' }), { readOnly: true });
    expect(within(row('connection-label')).queryByRole('button')).toBeNull();
    openAppearance();
    expect(within(row('connection-style')).queryByRole('button')).toBeNull();
    expect(within(row('connection-colour')).queryByRole('button')).toBeNull();
  });
});

describe('ConnectionInspector: Route, said once, under Appearance', () => {
  const route = (over: Partial<EdgeRoute> = {}): EdgeRoute => ({ source: 'auto', relationId: 'c1', waypoints: [], ...over } as EdgeRoute);

  it('is on Appearance and not on Properties', () => {
    renderInspector(connection());
    expect(screen.queryByTestId('route-section')).toBeNull();
    openAppearance();
    expect(row('route-section')).toBeDefined();
  });

  it('reads None with no stored route, and offers Pin and Reset', () => {
    const { setRouteSource, onResetRoute } = renderInspector(connection());
    openAppearance();
    expect(screen.getByTestId('route-badge').textContent).toBe('None');
    fireEvent.click(screen.getByRole('button', { name: 'Pin' }));
    expect(setRouteSource).toHaveBeenCalledWith('c1', 'manual');
    fireEvent.click(screen.getByRole('button', { name: 'Reset to automatic' }));
    expect(onResetRoute).toHaveBeenCalledWith('c1');
  });

  it('reads Automatic for router output, with its bend count', () => {
    renderInspector(connection(), { routes: [route({ waypoints: [{ x: 1, y: 1 }, { x: 2, y: 2 }], source: 'auto' } as never)] });
    openAppearance();
    expect(screen.getByTestId('route-badge').textContent).toBe('Automatic');
    expect(screen.getByTestId('route-bends').textContent).toContain('2 bends');
  });

  it('reads Hand-drawn for a manual route and offers Unpin instead of Pin', () => {
    const { setRouteSource } = renderInspector(connection(), { routes: [route({ waypoints: [{ x: 1, y: 1 }], source: 'manual' } as never)] });
    openAppearance();
    expect(screen.getByTestId('route-badge').textContent).toBe('Hand-drawn');
    expect(screen.queryByRole('button', { name: 'Pin' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Unpin' }));
    expect(setRouteSource).toHaveBeenCalledWith('c1', 'auto');
  });

  it('hides every route button read-only, and Reset when the editor wired none', () => {
    renderInspector(connection(), { readOnly: true });
    openAppearance();
    expect(screen.queryByRole('button', { name: 'Pin' })).toBeNull();
    cleanup();
    renderInspector(connection(), { onResetRoute: null });
    openAppearance();
    expect(screen.queryByRole('button', { name: 'Reset to automatic' })).toBeNull();
  });

  it('fixes one end from its row, and Automatic frees it with an explicit undefined', () => {
    const { onSetRouteSides } = renderInspector(connection(), { routes: [route({ sourceSide: 'top' } as never)] });
    openAppearance();
    expect(text('route-leaves')).toContain('Top');
    choose('route-arrives', 'Arrives at', 'left');
    expect(onSetRouteSides).toHaveBeenCalledWith('c1', { targetSide: 'left' });
    choose('route-leaves', 'Leaves from', '');
    expect(onSetRouteSides).toHaveBeenCalledWith('c1', { sourceSide: undefined });
  });

  it('still says the stored sides where they cannot be changed', () => {
    renderInspector(connection(), { onSetRouteSides: null, routes: [route({ sourceSide: 'top' } as never)] });
    openAppearance();
    expect(text('route-leaves')).toContain('Top');
    expect(within(row('route-leaves')).queryByRole('button')).toBeNull();
  });
});

describe('ConnectionInspector: part of which interface (ADR-0013)', () => {
  const held = (id: string, kind: 'application' | 'component', parentId?: string) => ({
    id, kind, name: id.toUpperCase(), lifecycle: 'live' as const, isManaged: false, aspects: {}, ...(parentId ? { parentId } : {}),
  });
  const landscape = (rows: Relation[]): DesignModel => ({
    name: 'SD', diagrams: [],
    elements: [held('a1', 'application'), held('b1', 'application'), held('a1c', 'component', 'a1'), held('b1c', 'component', 'b1')],
    relations: rows,
  });
  const line = connection({ id: 'l1', sourceId: 'a1c', targetId: 'b1c' });
  const iface = connection({ id: 'i1', sourceId: 'a1', targetId: 'b1', label: 'orders' });

  it('is not asked about an application line', () => {
    renderInspector(connection(), { model: landscape([]) });
    expect(screen.queryByTestId('connection-part-of')).toBeNull();
  });

  it('offers the interfaces running that way, and a new one of its own', () => {
    const { updateConnection } = renderInspector(line, { model: landscape([iface, line]) });
    press('connection-part-of');
    fireEvent.click(screen.getByRole('option', { name: /orders/ }));
    expect(updateConnection).toHaveBeenCalledWith('l1', { refines: 'i1' });
  });

  it('offers the way out by name on a line that landed', () => {
    const landed = { ...line, refines: 'i1' };
    const { updateConnection } = renderInspector(landed, { model: landscape([iface, landed]) });
    press('connection-part-of');
    fireEvent.click(screen.getByRole('option', { name: /Detach from/ }));
    expect(updateConnection).toHaveBeenCalledWith('l1', { refines: undefined });
  });

  it('is read-only where the panel is', () => {
    renderInspector(line, { model: landscape([iface, line]), readOnly: true });
    expect(within(row('connection-part-of')).queryByRole('button')).toBeNull();
  });

  it('says how many landed and which protocols, in place of a protocol somebody could contradict them with', () => {
    const landedA = { ...line, id: 'l1', refines: 'i1', protocol: 'REST' };
    const landedB = { ...line, id: 'l2', refines: 'i1', protocol: 'AMQP' };
    renderInspector(iface, { model: landscape([iface, landedA, landedB]) });
    expect(text('connection-detail')).toContain('REST, AMQP');
    expect(screen.queryByTestId('connection-protocol')).toBeNull();
  });

  it('keeps the protocol on an interface nothing has landed on', () => {
    renderInspector(iface, { model: landscape([iface]) });
    expect(row('connection-protocol')).toBeDefined();
    expect(screen.queryByTestId('connection-detail')).toBeNull();
  });
});
