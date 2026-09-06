// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { SolutionDesignEditor } from '../SolutionDesignEditor';
import { installReactFlowMocks } from '../reactFlowTestSetup';
import { isTempId } from '../../model/ids';
import { zoneRect } from '../../model/zones';
import type { DesignModel, DiagramContentBatch } from '../../model/types';
import type { SolutionDesignEditorProps } from '../props';

/**
 * The context menus, end to end through the editor: a right-click opens the
 * menu for what was clicked, the items do what they say through the same
 * actions the toolbar and keymap use, and read-only strips everything but
 * navigation. `menuItems.test.ts` pins the contents; this pins the wiring.
 */

beforeAll(() => installReactFlowMocks());
afterEach(() => cleanup());

/** Two placed elements and one line between them; the application has a container diagram. */
function model(): DesignModel {
  return {
    name: 'ACME Solution Design',
    customerName: 'ACME',
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'Layer 7 — EU',
        placements: [
          { elementId: 'a1', zone: 'landscape', x: 400, y: 300 },
          { elementId: 'b1', zone: 'externalSystems', x: 1500, y: 400 },
        ],
        layoutConfig: { domainGroups: [{ name: 'Core', x: 300, y: 250, width: 500, height: 400 }] },
      },
      { id: 'd2', kind: 'container', name: 'Webshop', applicationElementId: 'a1', placements: [] },
    ],
    elements: [
      { id: 'a1', kind: 'application', name: 'Webshop', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'b1', kind: 'externalSystem', name: 'Carrier', lifecycle: 'live', isManaged: false, aspects: {}, parameters: {} },
    ],
    connections: [{ id: 'c1', sourceId: 'a1', targetId: 'b1', label: 'Sends orders', isBidirectional: false }],
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
  const view = render(
    <ThemeProvider theme={createTheme()}>
      <div style={{ width: '1200px', height: '800px' }}>
        <SolutionDesignEditor {...props} />
      </div>
    </ThemeProvider>,
  );
  const lastBatch = () => onChange.mock.calls.at(-1)?.[0] as DiagramContentBatch;
  return { ...view, props, onChange, lastBatch };
}

const nodeEl = (id: string) => document.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement;
const pane = () => document.querySelector('.react-flow__pane') as HTMLElement;

/**
 * Client → flow, read off the viewport transform React Flow wrote. jsdom has
 * no layout, so the pane's rect is (0,0) and the transform alone maps the point
 * — the same arithmetic `screenToFlowPosition` performs.
 */
function flowPositionOf(client: { x: number; y: number }): { x: number; y: number } {
  const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
  const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\) scale\(([\d.]+)\)/.exec(viewport.style.transform);
  if (!match) throw new Error(`unexpected viewport transform: ${viewport.style.transform}`);
  const [, tx, ty, k] = match.map(Number);
  return { x: (client.x - tx) / k, y: (client.y - ty) / k };
}

const menu = (name: string) => screen.getByRole('menu', { name });
const openSubmenu = (root: HTMLElement, label: string) => {
  fireEvent.mouseEnter(within(root).getByRole('menuitem', { name: new RegExp(label) }));
  return screen.getByRole('menu', { name: label });
};

describe('DiagramCanvas — element menu', () => {
  it('right-click opens the element menu, selects the element and offers its actions', () => {
    renderEditor();
    fireEvent.contextMenu(nodeEl('a1'), { clientX: 300, clientY: 300 });

    const root = menu('Element menu');
    for (const label of ['Open container diagram', 'Rename', 'Start connection to…', 'Duplicate', 'Copy', 'Cut', 'Remove from diagram', 'Delete from model…']) {
      expect(within(root).getByText(label)).toBeDefined();
    }
    // Submenus for the things an application carries. "Icon…" is NOT one of
    // them since Phase 3 — it is a leaf that opens the picker popover.
    for (const label of ['Lifecycle', 'Move to zone', 'Domain group']) {
      expect(within(root).getByRole('menuitem', { name: new RegExp(label) }).getAttribute('aria-haspopup')).toBe('menu');
    }
    // Selected: the inspector now shows it.
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Webshop');
  });

  it('"Open container diagram" takes the double-click path', () => {
    const { props } = renderEditor();
    fireEvent.contextMenu(nodeEl('a1'));
    fireEvent.click(within(menu('Element menu')).getByText('Open container diagram'));
    expect(props.onActiveDiagramChange).toHaveBeenCalledWith('d2');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('"Create container diagram" asks the host when the application has none', () => {
    const { props } = renderEditor();
    const m = model();
    m.diagrams = m.diagrams.filter((d) => d.id !== 'd2');
    cleanup();
    const second = renderEditor({ model: m });
    fireEvent.contextMenu(nodeEl('a1'));
    fireEvent.click(within(menu('Element menu')).getByText('Create container diagram'));
    expect(second.props.onCreateContainerDiagram).toHaveBeenCalledWith('a1');
    expect(props.onCreateContainerDiagram).not.toHaveBeenCalled();
  });

  it('Lifecycle ▸ Retired updates the element', () => {
    const { lastBatch } = renderEditor();
    fireEvent.contextMenu(nodeEl('a1'));
    const lifecycle = openSubmenu(menu('Element menu'), 'Lifecycle');
    expect(within(lifecycle).getByRole('menuitemcheckbox', { name: 'Live' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(lifecycle).getByRole('menuitemcheckbox', { name: 'Retired' }));
    expect(lastBatch().elements.find((e) => e.id === 'a1')?.lifecycle).toBe('retired');
  });

  /**
   * DELIBERATE FLIP (Phase 3): "Icon ▸" was a submenu of eight marks; it is now
   * "Icon…", a leaf that opens the searchable grid in an anchored popover. The
   * write and clear contract is the same, which is what this still asserts.
   */
  it('Icon… opens the picker; a tile sets the mark and None clears it', () => {
    const { lastBatch } = renderEditor();

    fireEvent.contextMenu(nodeEl('a1'));
    fireEvent.click(within(menu('Element menu')).getByText('Icon…'));
    fireEvent.click(within(screen.getByRole('group', { name: 'Icon' })).getByLabelText('Database'));
    expect(lastBatch().elements.find((e) => e.id === 'a1')?.iconKey).toBe('database');

    fireEvent.contextMenu(nodeEl('a1'));
    fireEvent.click(within(menu('Element menu')).getByText('Icon…'));
    fireEvent.click(within(screen.getByRole('group', { name: 'Icon' })).getByLabelText('None'));
    expect(lastBatch().elements.find((e) => e.id === 'a1')?.iconKey).toBeUndefined();
  });

  it('Move to zone ▸ Actors re-places the element inside the actors band', () => {
    const { lastBatch } = renderEditor();
    fireEvent.contextMenu(nodeEl('a1'));
    fireEvent.click(within(openSubmenu(menu('Element menu'), 'Move to zone')).getByRole('menuitemcheckbox', { name: 'Actors' }));

    const placement = lastBatch().placements.find((p) => p.elementId === 'a1');
    const band = zoneRect('actors');
    expect(placement?.zone).toBe('actors');
    expect(placement?.domainGroup).toBeUndefined();
    expect(placement!.y).toBeGreaterThanOrEqual(band.y);
    expect(placement!.y).toBeLessThan(band.y + band.height);
  });

  it('Domain group ▸ joins the group the element already sits in without moving it', () => {
    const { lastBatch } = renderEditor();
    fireEvent.contextMenu(nodeEl('a1'));
    fireEvent.click(within(openSubmenu(menu('Element menu'), 'Domain group')).getByRole('menuitemcheckbox', { name: 'Core' }));
    const placement = lastBatch().placements.find((p) => p.elementId === 'a1');
    expect(placement).toMatchObject({ domainGroup: 'Core', x: 400, y: 300 });
  });

  it('"Start connection to…" enters connect mode; the next node click connects, Escape cancels', () => {
    const { lastBatch, onChange } = renderEditor();
    fireEvent.contextMenu(nodeEl('a1'));
    fireEvent.click(within(menu('Element menu')).getByText('Start connection to…'));
    expect(screen.getByTestId('lv-connect-hint').textContent).toMatch(/Click a target element/);

    fireEvent.click(nodeEl('b1'));
    const created = lastBatch().connections.find((c) => isTempId(c.id));
    expect(created).toMatchObject({ sourceId: 'a1', targetId: 'b1' });
    expect(screen.queryByTestId('lv-connect-hint')).toBeNull();
    // Like a hand-drawn line, the new connection is what ends up selected.
    expect(screen.getByText('Webshop → Carrier')).toBeDefined();

    // Escape leaves the mode without connecting anything.
    const before = onChange.mock.calls.length;
    fireEvent.contextMenu(nodeEl('a1'));
    fireEvent.click(within(menu('Element menu')).getByText('Start connection to…'));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByTestId('lv-connect-hint')).toBeNull();
    expect(onChange.mock.calls.length).toBe(before);
  });

  it('"Rename" focuses the inspector Name field with the text selected', async () => {
    renderEditor();
    fireEvent.contextMenu(nodeEl('a1'));
    fireEvent.click(within(menu('Element menu')).getByText('Rename'));
    const name = screen.getByLabelText('Name') as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(name));
    expect(name.selectionStart).toBe(0);
    expect(name.selectionEnd).toBe('Webshop'.length);
  });

  it('"Delete from model…" opens the delete dialog; "Remove from diagram" removes straight away', () => {
    const { lastBatch } = renderEditor();
    fireEvent.contextMenu(nodeEl('a1'));
    fireEvent.click(within(menu('Element menu')).getByText('Delete from model…'));
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Delete “Webshop”/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.contextMenu(nodeEl('a1'));
    fireEvent.click(within(menu('Element menu')).getByText('Remove from diagram'));
    expect(lastBatch().removedPlacementElementIds).toEqual(['a1']);
  });
});

describe('DiagramCanvas — connection menu', () => {
  it('a line WITHOUT a stored route gets the menu; "Add bend point here" claims it', () => {
    const { lastBatch } = renderEditor();
    fireEvent.contextMenu(screen.getByTestId('rf__edge-c1'), { clientX: 400, clientY: 300 });
    const root = menu('Connection menu');
    expect(within(root).getByText('Remove all bend points').closest('[role="menuitem"]')?.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(within(root).getByText('Add bend point here'));

    const route = lastBatch().edgeRoutes.find((r) => r.connectionId === 'c1');
    expect(route?.waypoints).toHaveLength(1);
    expect(route?.source).toBe('manual');
  });

  it('Direction ▸ Reverse swaps the endpoints; Two-way sets isBidirectional', () => {
    const { lastBatch } = renderEditor();
    fireEvent.contextMenu(screen.getByTestId('rf__edge-c1'));
    fireEvent.click(within(openSubmenu(menu('Connection menu'), 'Direction')).getByRole('menuitemcheckbox', { name: 'Reverse' }));
    expect(lastBatch().connections.find((c) => c.id === 'c1')).toMatchObject({ sourceId: 'b1', targetId: 'a1' });

    fireEvent.contextMenu(screen.getByTestId('rf__edge-c1'));
    fireEvent.click(within(openSubmenu(menu('Connection menu'), 'Direction')).getByRole('menuitemcheckbox', { name: 'Two-way' }));
    expect(lastBatch().connections.find((c) => c.id === 'c1')?.isBidirectional).toBe(true);
  });

  it('Line shape ▸ writes the routing token, Smooth clears it', () => {
    const { lastBatch } = renderEditor();
    fireEvent.contextMenu(screen.getByTestId('rf__edge-c1'));
    fireEvent.click(within(openSubmenu(menu('Connection menu'), 'Line shape')).getByRole('menuitemcheckbox', { name: 'Orthogonal' }));
    expect(lastBatch().connections.find((c) => c.id === 'c1')?.routing).toBe('orthogonal');
    fireEvent.contextMenu(screen.getByTestId('rf__edge-c1'));
    fireEvent.click(within(openSubmenu(menu('Connection menu'), 'Line shape')).getByRole('menuitemcheckbox', { name: 'Smooth' }));
    expect(lastBatch().connections.find((c) => c.id === 'c1')?.routing).toBeUndefined();
  });

  it('"Edit label" opens the inline editor on the chip', async () => {
    renderEditor();
    fireEvent.contextMenu(screen.getByTestId('rf__edge-c1'));
    fireEvent.click(within(menu('Connection menu')).getByText('Edit label'));
    const textarea = (await screen.findByPlaceholderText('Interface description…')) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Sends orders');
  });

  it('the label chip opens the same menu; Attach at ▸ Source ▸ Top fixes the source side as an auto row', async () => {
    const { onChange } = renderEditor();
    // The side commit is synchronous; the routing pass it triggers (live routing
    // is off, so the editor runs one) lands a LATER batch with the routed bends.
    // Look for the commit's own batch rather than the last one, so the pass's
    // timing cannot decide the outcome.
    const routeIn = (batch: DiagramContentBatch) => batch.edgeRoutes.find((r) => r.connectionId === 'c1');
    const someBatch = (matches: (route: ReturnType<typeof routeIn>) => boolean) =>
      onChange.mock.calls.some(([batch]) => matches(routeIn(batch)));
    fireEvent.contextMenu(await screen.findByTestId('edge-label-c1'));
    const root = menu('Connection menu');
    expect(within(root).getByRole('menuitem', { name: /Pin route/ }).getAttribute('aria-disabled')).toBeNull();
    expect(within(root).getByRole('menuitem', { name: /Reset to automatic route/ }).getAttribute('aria-disabled')).toBeNull();
    const attach = openSubmenu(root, 'Attach at');
    const source = openSubmenu(attach, 'Source');
    expect(within(source).getByRole('menuitemcheckbox', { name: 'Automatic' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(source).getByRole('menuitemcheckbox', { name: 'Top' }));
    // Sides are constraints, not geometry: the new row is the router's, not a claim.
    expect(
      someBatch((r) => r?.waypoints.length === 0 && r.source === 'auto' && r.sourceSide === 'top'),
    ).toBe(true);
    // The pass then routes the line out of its top — bends, still under the side.
    // Waited for, because the editor is busy until it lands and a second side
    // change meanwhile is refused (the menu disables the entries while it runs).
    await waitFor(() =>
      expect(someBatch((r) => (r?.waypoints.length ?? 0) > 0 && r?.sourceSide === 'top')).toBe(true),
    );
    // The menu now shows the side as chosen, and Automatic clears it again. The
    // reopen is RETRIED until the menu is there: React Flow replaces the edge's
    // DOM (chip and all) on the re-render the pass causes, a tick after the batch
    // lands, so an element queried between the two is detached by the time the
    // event fires and nothing hears it (measured: every other run). Firing again
    // on an already open menu is a no-op.
    let reopened!: HTMLElement;
    await waitFor(() => {
      fireEvent.contextMenu(screen.getByTestId('rf__edge-c1'));
      reopened = screen.getByRole('menu', { name: 'Connection menu' });
    });
    fireEvent.mouseEnter(within(reopened).getByRole('menuitem', { name: /Attach at/ }));
    const attachAgain = await screen.findByRole('menu', { name: 'Attach at' });
    fireEvent.mouseEnter(within(attachAgain).getByRole('menuitem', { name: /Source/ }));
    const again = await screen.findByRole('menu', { name: 'Source' });
    expect(within(again).getByRole('menuitemcheckbox', { name: 'Top' }).getAttribute('aria-checked')).toBe('true');
    // The entries are disabled until the editor's busy flag clears — which happens
    // a render after the batch above landed — so wait for Automatic to be clickable.
    await waitFor(() =>
      expect(within(again).getByRole('menuitemcheckbox', { name: 'Automatic' }).getAttribute('aria-disabled')).toBeNull(),
    );
    const before = onChange.mock.calls.length;
    fireEvent.click(within(again).getByRole('menuitemcheckbox', { name: 'Automatic' }));
    // Freeing the side drops the constraint and nothing else: the row keeps the
    // router's bends (the pass that follows re-routes it free), so the batch
    // carries c1 without a `sourceSide`.
    const freed = onChange.mock.calls.slice(before).map(([batch]) => routeIn(batch));
    expect(freed.length).toBeGreaterThan(0);
    expect(freed.some((r) => r !== undefined && r.sourceSide === undefined)).toBe(true);
  });

  it('"Pin route" pins a line with no stored route; the entry then reads "Unpin route" and unpins it', async () => {
    const { lastBatch } = renderEditor();
    fireEvent.contextMenu(screen.getByTestId('rf__edge-c1'));
    fireEvent.click(within(menu('Connection menu')).getByText('Pin route'));
    expect(lastBatch().edgeRoutes.find((r) => r.connectionId === 'c1')).toEqual({
      connectionId: 'c1',
      waypoints: [],
      labelPosition: undefined,
      source: 'manual',
      pinned: true,
    });
    // The inspector's Route section agrees.
    expect(screen.getByTestId('route-badge').textContent).toBe('Hand-drawn');

    fireEvent.contextMenu(screen.getByTestId('rf__edge-c1'));
    fireEvent.click(within(menu('Connection menu')).getByText('Unpin route'));
    // A pin-only row that loses its pin has nothing left: the delete marker.
    const unpinned = lastBatch().edgeRoutes.find((r) => r.connectionId === 'c1');
    expect(unpinned?.waypoints).toEqual([]);
    expect(unpinned?.pinned).toBeUndefined();
    expect(screen.getByTestId('route-badge').textContent).toBe('None');
  });

  it('"Re-route everything (ignore pins)" sits after Route connections in the canvas menu', () => {
    renderEditor();
    fireEvent.contextMenu(pane(), { clientX: 700, clientY: 500 });
    const root = menu('Canvas menu');
    const labels = within(root).getAllByRole('menuitem').map((i) => i.querySelector('.MuiListItemText-primary')?.textContent);
    expect(labels.indexOf('Re-route everything (ignore pins)')).toBe(labels.indexOf('Route connections') + 1);
  });

  it('a bend handle offers "Remove bend point"', async () => {
    const m = model();
    m.diagrams[0].edgeRoutes = [{ connectionId: 'c1', waypoints: [{ x: 900, y: 320 }, { x: 900, y: 420 }], source: 'manual' }];
    const { lastBatch } = renderEditor({ model: m });
    // Handles belong to the SELECTED line (routing phase 2a), so pick it up first.
    fireEvent.click(await screen.findByTestId('rf__edge-c1'));
    fireEvent.contextMenu(await screen.findByTestId('waypoint-c1-1'));
    fireEvent.click(within(menu('Connection menu')).getByText('Remove bend point'));
    expect(lastBatch().edgeRoutes.find((r) => r.connectionId === 'c1')?.waypoints).toEqual([{ x: 900, y: 320 }]);
  });
});

describe('DiagramCanvas — canvas menu', () => {
  it('right-click on empty canvas opens the canvas menu; "Add here ▸ Application" creates one at the click point', () => {
    const { lastBatch } = renderEditor();
    // Well clear of the Core group box in flow space, on the landscape.
    const client = { x: 700, y: 500 };
    fireEvent.contextMenu(pane(), { clientX: client.x, clientY: client.y });
    const root = menu('Canvas menu');
    expect(within(root).getByText('Paste here').closest('[role="menuitem"]')?.getAttribute('aria-disabled')).toBe('true');
    expect(within(root).getByText('Add domain group here')).toBeDefined();
    expect(within(root).getByText('Tidy layout')).toBeDefined();
    expect(within(root).getByText('Route connections')).toBeDefined();
    expect(within(root).getByRole('menuitemcheckbox', { name: 'Show grid' }).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(within(openSubmenu(root, 'Add here')).getByText('Application'));

    const batch = lastBatch();
    const created = batch.elements.find((e) => isTempId(e.id));
    expect(created?.kind).toBe('application');
    const placement = batch.placements.find((p) => p.elementId === created?.id);
    const expected = flowPositionOf(client);
    expect(placement?.x).toBeCloseTo(expected.x, 3);
    expect(placement?.y).toBeCloseTo(expected.y, 3);
  });

  it('"Add domain group here" lands a box centred on the click', () => {
    const { lastBatch } = renderEditor();
    fireEvent.contextMenu(pane(), { clientX: 500, clientY: 450 });
    fireEvent.click(within(menu('Canvas menu')).getByText('Add domain group here'));
    const groups = lastBatch().layoutConfig?.domainGroups ?? [];
    expect(groups.map((g) => g.name)).toEqual(['Core', 'New group']);
  });

  it('Copy on an element then "Paste here" pastes the copy with its corner at the click point', () => {
    const { lastBatch } = renderEditor();
    fireEvent.contextMenu(nodeEl('a1'));
    fireEvent.click(within(menu('Element menu')).getByText('Copy'));

    const client = { x: 650, y: 520 };
    fireEvent.contextMenu(pane(), { clientX: client.x, clientY: client.y });
    fireEvent.click(within(menu('Canvas menu')).getByText('Paste here'));

    const pasted = lastBatch().placements.find((p) => isTempId(p.elementId));
    const expected = flowPositionOf(client);
    expect(pasted?.x).toBeCloseTo(expected.x, 3);
    expect(pasted?.y).toBeCloseTo(expected.y, 3);
  });

  it('Show grid / Snap to grid toggle the same state as the placement toolbar', () => {
    renderEditor();
    fireEvent.contextMenu(pane(), { clientX: 700, clientY: 500 });
    fireEvent.click(within(menu('Canvas menu')).getByRole('menuitemcheckbox', { name: 'Show grid' }));
    expect(screen.getByLabelText('Toggle grid visibility').getAttribute('aria-pressed')).toBe('false');
    fireEvent.contextMenu(pane(), { clientX: 700, clientY: 500 });
    fireEvent.click(within(menu('Canvas menu')).getByRole('menuitemcheckbox', { name: 'Snap to grid' }));
    expect(screen.getByLabelText('Toggle snap to grid').getAttribute('aria-pressed')).toBe('true');
  });

  it('Select all selects the diagram content', () => {
    renderEditor();
    fireEvent.contextMenu(pane(), { clientX: 700, clientY: 500 });
    fireEvent.click(within(menu('Canvas menu')).getByText('Select all'));
    expect(screen.getByText('3 selected')).toBeDefined();
  });
});

describe('DiagramCanvas — selection menu', () => {
  it('right-click on a node inside a multi-selection opens the selection menu; Lifecycle applies to all in one batch', () => {
    const { onChange, lastBatch } = renderEditor();
    fireEvent.contextMenu(pane(), { clientX: 700, clientY: 500 });
    fireEvent.click(within(menu('Canvas menu')).getByText('Select all'));

    fireEvent.contextMenu(nodeEl('a1'));
    const root = menu('Selection menu');
    expect(within(root).getByText('Group into new domain group')).toBeDefined();
    const before = onChange.mock.calls.length;
    fireEvent.click(within(openSubmenu(root, 'Lifecycle')).getByText('Planned'));
    expect(onChange.mock.calls.length).toBe(before + 1);
    expect(lastBatch().elements.map((e) => e.lifecycle)).toEqual(['planned', 'planned']);
  });

  it('"Group into new domain group" boxes the landscape members and assigns them in one batch', () => {
    const { onChange, lastBatch } = renderEditor();
    fireEvent.contextMenu(pane(), { clientX: 700, clientY: 500 });
    fireEvent.click(within(menu('Canvas menu')).getByText('Select all'));
    const before = onChange.mock.calls.length;

    fireEvent.contextMenu(nodeEl('a1'));
    fireEvent.click(within(menu('Selection menu')).getByText('Group into new domain group'));

    expect(onChange.mock.calls.length).toBe(before + 1);
    const batch = lastBatch();
    const group = batch.layoutConfig?.domainGroups?.find((g) => g.name === 'New group');
    expect(group).toBeDefined();
    // The landscape member joins; the band member is not a group member.
    expect(batch.placements.find((p) => p.elementId === 'a1')?.domainGroup).toBe('New group');
    expect(batch.placements.find((p) => p.elementId === 'b1')?.domainGroup).toBeUndefined();
    // The box wraps the application card (200×130 at 400,300).
    expect(group!.x).toBeLessThan(400);
    expect(group!.y).toBeLessThan(300);
    expect(group!.x + group!.width).toBeGreaterThan(600);
    expect(group!.y + group!.height).toBeGreaterThan(430);
  });
});

describe('DiagramCanvas — keyboard', () => {
  it('Shift+F10 opens the menu for the selected element; F2 renames it', async () => {
    const { rerender, props } = renderEditor();
    rerender(
      <ThemeProvider theme={createTheme()}>
        <div style={{ width: '1200px', height: '800px' }}>
          <SolutionDesignEditor {...props} focusElement={{ id: 'a1', nonce: 1 }} />
        </div>
      </ThemeProvider>,
    );
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Webshop');

    const canvasTarget = screen.getByText('ACTORS');
    fireEvent.keyDown(canvasTarget, { key: 'F10', shiftKey: true });
    expect(menu('Element menu')).toBeDefined();
    fireEvent.keyDown(menu('Element menu'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());

    fireEvent.keyDown(canvasTarget, { key: 'F2' });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Name')));
  });

  it('Shift+F10 with nothing selected opens the canvas menu', () => {
    renderEditor();
    fireEvent.keyDown(screen.getByText('ACTORS'), { key: 'F10', shiftKey: true });
    expect(menu('Canvas menu')).toBeDefined();
  });
});

describe('DiagramCanvas — read-only', () => {
  it('offers only navigation: documentation and container on an element, select all / fit view on the canvas, nothing on a line', () => {
    renderEditor({ readOnly: true });
    const primary = (item: HTMLElement) => item.querySelector('.MuiListItemText-primary')?.textContent;

    fireEvent.contextMenu(nodeEl('a1'));
    const element = menu('Element menu');
    expect(within(element).getAllByRole('menuitem').map(primary)).toEqual(['Open documentation', 'Open container diagram']);
    fireEvent.keyDown(element, { key: 'Escape' });

    fireEvent.contextMenu(pane(), { clientX: 700, clientY: 500 });
    const canvas = menu('Canvas menu');
    expect(within(canvas).getAllByRole('menuitem').map(primary)).toEqual(['Select all', 'Fit view']);
    fireEvent.keyDown(canvas, { key: 'Escape' });

    fireEvent.contextMenu(screen.getByTestId('rf__edge-c1'));
    expect(screen.queryByRole('menu', { name: 'Connection menu' })).toBeNull();

    // A non-application has no container to open, but reading is still allowed.
    fireEvent.contextMenu(nodeEl('b1'));
    const other = menu('Element menu');
    expect(within(other).getAllByRole('menuitem').map(primary)).toEqual(['Open documentation']);
  });
});
