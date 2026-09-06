// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ConnectionInspector } from './ConnectionInspector';
import type { EditorActions } from './useEditorState';
import type { DesignConnection, DesignDiagram, DesignModel, EdgeRoute } from '../model/types';
import type { AttachSidesPatch } from '../model/routes';

/**
 * U7a connection inspector: General / Appearance two-tab split. General owns the
 * single Direction control (source of truth for isBidirectional, D2); Appearance
 * owns the shared ColorField plus line/routing and the demoted per-end arrowhead
 * override, which must still round-trip sourceArrowhead/targetArrowhead. We
 * assert the updateConnection onChange contract — never MUI internals.
 */

afterEach(() => cleanup());

function connection(overrides: Partial<DesignConnection> = {}): DesignConnection {
  return { id: 'c1', sourceId: 'a1', targetId: 'b1', isBidirectional: false, ...overrides };
}

function model(): DesignModel {
  return {
    name: 'SD',
    customerName: 'ACME',
    diagrams: [],
    elements: [
      { id: 'a1', kind: 'application', name: 'A', lifecycle: 'live', isManaged: false, aspects: {}, parameters: {} },
      { id: 'b1', kind: 'application', name: 'B', lifecycle: 'live', isManaged: false, aspects: {}, parameters: {} },
    ],
    connections: [],
  };
}

/** The active diagram, with whatever routes a test wants stored on it. */
function diagram(edgeRoutes: EdgeRoute[] = []): DesignDiagram {
  return { id: 'd1', kind: 'layer7', name: 'L7', placements: [], edgeRoutes };
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
  conn: DesignConnection,
  opts: {
    readOnly?: boolean;
    routes?: EdgeRoute[];
    onResetRoute?: ResetRouteSpy | null;
    onSetRouteSides?: SetRouteSidesSpy | null;
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
        model={model()}
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

const tab = (name: 'General' | 'Appearance') => screen.getByRole('tab', { name });
const openTab = (name: 'General' | 'Appearance') => fireEvent.click(tab(name));

/** MUI non-native Select: open the combobox and click an option by its text. */
function chooseOption(labelText: string, optionText: RegExp | string) {
  fireEvent.mouseDown(screen.getByLabelText(labelText));
  fireEvent.click(within(screen.getByRole('listbox')).getByText(optionText));
}
/** MUI non-native Select exposes disabled via aria-disabled on its combobox. */
const selectDisabled = (labelText: string) =>
  screen.getByLabelText(labelText).getAttribute('aria-disabled') === 'true';

describe('ConnectionInspector — tab structure (U7a)', () => {
  it('General reaches Label, Protocol, Direction', () => {
    renderInspector(connection());
    expect(screen.getByLabelText('Label')).toBeDefined();
    expect(screen.getByLabelText('Protocol')).toBeDefined();
    expect(screen.getByLabelText('Direction')).toBeDefined();
  });

  it('Appearance reaches Colour, Line style, Routing and the arrowhead override', () => {
    renderInspector(connection());
    openTab('Appearance');
    expect(screen.getByLabelText('Edge colour')).toBeDefined();
    expect(screen.getByLabelText('Line style')).toBeDefined();
    expect(screen.getByLabelText('Routing')).toBeDefined();
    expect(screen.getByText('Arrowhead override')).toBeDefined();
    expect(screen.getByLabelText('Source')).toBeDefined();
    expect(screen.getByLabelText('Target')).toBeDefined();
  });
});

describe('ConnectionInspector — Direction dedup (D2)', () => {
  it('Direction drives isBidirectional (one-way → false, bidirectional → true)', () => {
    const { updateConnection } = renderInspector(connection({ isBidirectional: false }));
    chooseOption('Direction', /Bidirectional/);
    expect(updateConnection).toHaveBeenCalledWith('c1', { isBidirectional: true });

    cleanup();
    const two = renderInspector(connection({ isBidirectional: true }));
    chooseOption('Direction', /One-way/);
    expect(two.updateConnection).toHaveBeenCalledWith('c1', { isBidirectional: false });
  });

  it('shows bidirectional when isBidirectional is set', () => {
    renderInspector(connection({ isBidirectional: true }));
    expect(screen.getByLabelText('Direction').textContent).toContain('Bidirectional');
  });

  it('the arrowhead override still round-trips sourceArrowhead / targetArrowhead', () => {
    const { updateConnection } = renderInspector(connection());
    openTab('Appearance');
    chooseOption('Source', 'None');
    expect(updateConnection).toHaveBeenCalledWith('c1', { sourceArrowhead: 'none' });
    chooseOption('Target', 'Arrow');
    expect(updateConnection).toHaveBeenCalledWith('c1', { targetArrowhead: 'arrow' });
  });

  it('there is no top-level Bidirectional switch competing with Direction', () => {
    renderInspector(connection());
    expect(screen.queryByLabelText('Bidirectional')).toBeNull();
  });
});

describe('ConnectionInspector — ColorField colour (D4)', () => {
  it('writes a hex on change and clears to undefined', () => {
    const { updateConnection } = renderInspector(connection({ color: '#00ff00' }));
    openTab('Appearance');
    fireEvent.change(screen.getByLabelText('Edge colour'), { target: { value: '#123456' } });
    expect(updateConnection).toHaveBeenCalledWith('c1', { color: '#123456' });
    fireEvent.click(screen.getByLabelText('Clear colour'));
    expect(updateConnection).toHaveBeenCalledWith('c1', { color: undefined });
  });
});

describe('ConnectionInspector — active tab + readOnly', () => {
  it('resets to General when the selected connection id changes', () => {
    const { rerender } = render(
      <ThemeProvider theme={createTheme()}>
        <ConnectionInspector connection={connection({ id: 'c1' })} model={model()} diagram={diagram()} readOnly={false} actions={makeActions().actions} />
      </ThemeProvider>,
    );
    openTab('Appearance');
    expect(tab('Appearance').getAttribute('aria-selected')).toBe('true');

    rerender(
      <ThemeProvider theme={createTheme()}>
        <ConnectionInspector connection={connection({ id: 'c2' })} model={model()} diagram={diagram()} readOnly={false} actions={makeActions().actions} />
      </ThemeProvider>,
    );
    expect(tab('General').getAttribute('aria-selected')).toBe('true');
  });

  it('disables controls in every tab under readOnly', () => {
    renderInspector(connection({ color: '#00ff00', sourceArrowhead: 'arrow' }), { readOnly: true });
    expect((screen.getByLabelText('Label') as HTMLInputElement).disabled).toBe(true);
    expect(selectDisabled('Direction')).toBe(true);

    openTab('Appearance');
    expect((screen.getByLabelText('Edge colour') as HTMLInputElement).disabled).toBe(true);
    expect(selectDisabled('Line style')).toBe(true);
    expect(selectDisabled('Source')).toBe(true);
    expect(selectDisabled('Target')).toBe(true);
  });
});

describe('ConnectionInspector — tab badges', () => {
  it('dots General when a label/protocol is set and Appearance when styled', () => {
    renderInspector(connection({ protocol: 'EDI', color: '#00ff00' }));
    expect(within(tab('General')).queryByText('●')).not.toBeNull();
    expect(within(tab('Appearance')).queryByText('●')).not.toBeNull();
  });

  it('shows no dots on a bare connection', () => {
    renderInspector(connection());
    expect(within(tab('General')).queryByText('●')).toBeNull();
    expect(within(tab('Appearance')).queryByText('●')).toBeNull();
  });
});

/**
 * The Route section (Phase 2a): who owns this line's route on the ACTIVE diagram
 * and the three things a person can do about it. It reads the diagram, never the
 * connection — a route is per diagram while the connection is design-wide.
 */
describe('ConnectionInspector — Route section', () => {
  const badge = () => screen.getByTestId('route-badge').textContent;
  const bends = () => screen.getByTestId('route-bends').textContent;
  const button = (name: string) => screen.queryByRole('button', { name });

  it('reads None with no stored route, and offers Pin and Reset', () => {
    const { setRouteSource, onResetRoute } = renderInspector(connection());
    expect(badge()).toBe('None');
    expect(bends()).toBe('0 bends');
    expect(button('Pin')).not.toBeNull();
    expect(button('Unpin')).toBeNull();

    fireEvent.click(button('Pin')!);
    expect(setRouteSource).toHaveBeenCalledWith('c1', 'manual');
    fireEvent.click(button('Reset to automatic')!);
    expect(onResetRoute).toHaveBeenCalledWith('c1');
  });

  it('reads Automatic for router output, with its bend count, and offers Pin', () => {
    renderInspector(connection(), {
      routes: [{ connectionId: 'c1', waypoints: [{ x: 1, y: 1 }, { x: 2, y: 2 }], source: 'auto' }],
    });
    expect(badge()).toBe('Automatic');
    expect(bends()).toBe('2 bends');
    expect(button('Pin')).not.toBeNull();
    expect(button('Unpin')).toBeNull();
  });

  it('reads Hand-drawn for a manual route and offers Unpin instead of Pin', () => {
    const { setRouteSource } = renderInspector(connection(), {
      routes: [{ connectionId: 'c1', waypoints: [{ x: 1, y: 1 }], source: 'manual' }],
    });
    expect(badge()).toBe('Hand-drawn');
    expect(bends()).toBe('1 bend');
    expect(button('Pin')).toBeNull();
    fireEvent.click(button('Unpin')!);
    expect(setRouteSource).toHaveBeenCalledWith('c1', 'auto');
  });

  it('says so when the row is an explicit pin, and reads another connection’s route as None', () => {
    renderInspector(connection(), {
      routes: [
        { connectionId: 'c1', waypoints: [], source: 'manual', pinned: true },
        { connectionId: 'other', waypoints: [{ x: 1, y: 1 }], source: 'manual' },
      ],
    });
    expect(badge()).toBe('Hand-drawn');
    expect(bends()).toBe('0 bends · pinned');

    cleanup();
    renderInspector(connection(), {
      routes: [{ connectionId: 'other', waypoints: [{ x: 1, y: 1 }], source: 'manual' }],
    });
    expect(badge()).toBe('None');
  });

  it('hides every route button in read-only mode, and Reset when the editor wired none', () => {
    renderInspector(connection(), {
      readOnly: true,
      routes: [{ connectionId: 'c1', waypoints: [{ x: 1, y: 1 }], source: 'auto' }],
    });
    expect(badge()).toBe('Automatic'); // the facts still show
    expect(button('Pin')).toBeNull();
    expect(button('Unpin')).toBeNull();
    expect(button('Reset to automatic')).toBeNull();

    cleanup();
    renderInspector(connection(), { onResetRoute: null });
    expect(button('Pin')).not.toBeNull();
    expect(button('Reset to automatic')).toBeNull();
  });
});

/**
 * Attach sides (Phase 2d): two small selects in the Route section, one per end.
 * They go through the editor's callback — like Reset — because with live routing
 * off the editor runs the pass that routes the line out of its new side.
 */
describe('ConnectionInspector — Leaves from / Arrives at', () => {
  const leaves = () => screen.getByLabelText('Leaves from');
  const arrives = () => screen.getByLabelText('Arrives at');

  it('reads Automatic for both ends with no stored side; choosing Top fixes the source only', () => {
    const { onSetRouteSides } = renderInspector(connection());
    // Automatic is the empty option, so the closed select shows no side at all
    // (MUI renders a zero-width space for it).
    expect(leaves().textContent?.replace(/\u200b/gu, '')).toBe('');
    expect(arrives().textContent?.replace(/\u200b/gu, '')).toBe('');
    chooseOption('Leaves from', 'Top');
    expect(onSetRouteSides).toHaveBeenCalledWith('c1', { sourceSide: 'top' });
    expect(onSetRouteSides).toHaveBeenCalledTimes(1);
  });

  it('shows the stored sides, and Automatic frees an end with an explicit undefined', () => {
    const { onSetRouteSides } = renderInspector(connection(), {
      routes: [{ connectionId: 'c1', waypoints: [], source: 'auto', sourceSide: 'right', targetSide: 'bottom' }],
    });
    expect(leaves().textContent).toContain('Right');
    expect(arrives().textContent).toContain('Bottom');
    chooseOption('Arrives at', 'Automatic');
    expect(onSetRouteSides).toHaveBeenCalledWith('c1', { targetSide: undefined });
    // The key is PRESENT: that is what tells "free this end" from "leave it alone".
    expect('targetSide' in (onSetRouteSides?.mock.calls[0][1] ?? {})).toBe(true);
  });

  it('is hidden in read-only mode and when the editor wired no callback — but a stored side is still stated', () => {
    renderInspector(connection(), { readOnly: true, routes: [{ connectionId: 'c1', waypoints: [], source: 'auto', sourceSide: 'right' }] });
    expect(screen.queryByLabelText('Leaves from')).toBeNull();
    expect(screen.queryByLabelText('Arrives at')).toBeNull();
    // The line honours the side, so the viewer is told about it.
    expect(screen.getByTestId('route-sides').textContent).toBe('Leaves from Right');

    cleanup();
    renderInspector(connection(), { onSetRouteSides: null });
    expect(screen.queryByLabelText('Leaves from')).toBeNull();
    expect(screen.queryByTestId('route-sides')).toBeNull(); // nothing stored, nothing to state
    expect(screen.queryByRole('button', { name: 'Pin' })).not.toBeNull(); // the rest of the section stays
  });

  it('never states the sides while the selects are there to show them', () => {
    renderInspector(connection(), {
      routes: [{ connectionId: 'c1', waypoints: [], source: 'auto', sourceSide: 'top', targetSide: 'left' }],
    });
    expect(screen.queryByTestId('route-sides')).toBeNull();
  });
});
