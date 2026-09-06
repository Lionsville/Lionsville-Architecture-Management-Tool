// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach } from 'vitest';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { SolutionDesignEditor } from './SolutionDesignEditor';
import { GRID_SIZE } from './canvas/DiagramCanvas';
import { PALETTE_DRAG_MIME } from './canvas/ElementPalette';
import { isTempId } from '../model/ids';
import type { DesignModel, DiagramContentBatch, SolutionDesignEditorProps } from '../model/types';
import { installReactFlowMocks } from './reactFlowTestSetup';

beforeAll(() => {
  installReactFlowMocks();
});
afterEach(() => cleanup());

function baseModel(): DesignModel {
  return {
    name: 'ACME Solution Design',
    customerName: 'ACME',
    diagrams: [
      { id: 'd1', kind: 'layer7', name: 'Layer 7 — EU', placements: [] },
      { id: 'd2', kind: 'container', name: 'Webshop', applicationElementId: 'a1', placements: [] },
    ],
    elements: [
      {
        id: 'a1',
        kind: 'application',
        name: 'Webshop',
        lifecycle: 'live',
        isManaged: true,
        aspects: {},
        parameters: {},
      },
    ],
    connections: [],
  };
}

/** baseModel with the application placed on the given diagram. */
function modelWithPlacement(diagramId: 'd1' | 'd2'): DesignModel {
  const model = baseModel();
  const diagram = model.diagrams.find((d) => d.id === diagramId) as DesignModel['diagrams'][0];
  diagram.placements = [{ elementId: 'a1', zone: 'landscape', x: 400, y: 300 }];
  return model;
}

function editorUi(props: SolutionDesignEditorProps) {
  return (
    <ThemeProvider theme={createTheme()}>
      <div style={{ width: '1200px', height: '800px' }}>
        <SolutionDesignEditor {...props} />
      </div>
    </ThemeProvider>
  );
}

function renderEditor(overrides: Partial<SolutionDesignEditorProps> = {}) {
  const onChange = vi.fn<(batch: DiagramContentBatch) => void>();
  const props: SolutionDesignEditorProps = {
    model: baseModel(),
    activeDiagramId: 'd1',
    onActiveDiagramChange: vi.fn(),
    onChange,
    onCreateContainerDiagram: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
    parameterSpecs: () => [],
    ...overrides,
  };
  const view = render(editorUi(props));
  const rerenderWith = (more: Partial<SolutionDesignEditorProps>) =>
    view.rerender(editorUi({ ...props, ...more }));
  return { ...view, props, onChange, rerenderWith };
}

/**
 * The palette gesture after the recut: pressing a row OPENS it, and the Place
 * button inside performs the add. `label` is the row's visible label.
 */
function placeFromPalette(label: string) {
  fireEvent.click(screen.getByRole('button', { name: label, expanded: false }));
  fireEvent.click(screen.getByRole('button', { name: `Add ${label.toLowerCase()}` }));
}

describe('SolutionDesignEditor (smoke, jsdom)', () => {
  it('renders the toolbar tab, the zone bands and the palette', () => {
    renderEditor();
    expect(screen.getByRole('tab', { name: 'Layer 7 — EU' })).toBeDefined();
    expect(screen.getByText('ACTORS')).toBeDefined();
    expect(screen.getByText('INPUT CHANNELS')).toBeDefined();
    expect(screen.getByText('EXTERNAL SYSTEMS')).toBeDefined();
    expect(screen.getByText('MANAGEMENT LAYER')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Application', expanded: false })).toBeDefined();
  });

  it('placing from the palette emits a batch with a temp element + landscape placement and selects it', () => {
    const { onChange } = renderEditor();
    placeFromPalette('Application');

    expect(onChange).toHaveBeenCalledTimes(1);
    const batch = onChange.mock.calls[0][0];
    expect(batch.diagramId).toBe('d1');
    expect(batch.elements).toHaveLength(1);
    const created = batch.elements[0];
    expect(isTempId(created.id)).toBe(true);
    expect(created.kind).toBe('application');
    expect(created.isManaged).toBe(true);
    const createdPlacement = batch.placements.find((p) => p.elementId === created.id);
    expect(createdPlacement?.zone).toBe('landscape');
    expect(batch.deletedElementIds).toEqual([]);
    expect(batch.removedPlacementElementIds).toEqual([]);

    // The new element is auto-selected: the inspector shows its name field.
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    expect(nameInput.value).toBe('New application');
  });

  it('adds actors into the actors zone', () => {
    const { onChange } = renderEditor();
    placeFromPalette('Actor');
    const batch = onChange.mock.calls[0][0];
    expect(batch.elements[0].kind).toBe('actor');
    expect(batch.elements[0].isManaged).toBe(false);
    expect(batch.placements[0].zone).toBe('actors');
  });

  it('editing the selected element name emits a follow-up batch', () => {
    const { onChange } = renderEditor();
    placeFromPalette('Application');
    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Storefront' } });

    expect(onChange.mock.calls.length).toBeGreaterThanOrEqual(2);
    const lastBatch = onChange.mock.calls.at(-1)?.[0] as DiagramContentBatch;
    expect(lastBatch.elements[0].name).toBe('Storefront');
  });

  it('clears the selection on Escape, including when focus is in the inspector', () => {
    renderEditor();
    placeFromPalette('Application');
    const nameInput = screen.getByLabelText('Name');
    expect((nameInput as HTMLInputElement).value).toBe('New application');

    // React Flow's built-in Escape only fires while the canvas has focus; the
    // editor must still deselect when Escape comes from an inspector field.
    fireEvent.keyDown(nameInput, { key: 'Escape' });

    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.getByText(/Select an element or connection to edit its properties/)).toBeDefined();
  });

  it('hides the palette and add-diagram affordances when readOnly', () => {
    renderEditor({ readOnly: true });
    expect(screen.queryByRole('complementary', { name: 'Element palette' })).toBeNull();
    expect(screen.queryByLabelText('New Layer 7 diagram')).toBeNull();
    expect(screen.getByText('Read-only')).toBeDefined();
  });

  it('shows the container breadcrumb when a container diagram is active', () => {
    renderEditor({ activeDiagramId: 'd2' });
    expect(screen.getByText('Container view')).toBeDefined();
    expect(screen.getByText('Webshop')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Component', expanded: false })).toBeDefined();
  });
});

describe('SolutionDesignEditor — focusElement', () => {
  it('selects the element (inspector opens) when the focus nonce changes', () => {
    const { rerenderWith } = renderEditor({ model: modelWithPlacement('d1') });
    expect(screen.queryByLabelText('Name')).toBeNull();

    rerenderWith({ focusElement: { id: 'a1', nonce: 1 } });

    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    expect(nameInput.value).toBe('Webshop');
  });

  it('honours a focus request that is already on the prop at mount', () => {
    // A host that opens the editor straight onto an element (its coverage
    // drawer deep-links into the board) passes `focusElement` on the FIRST
    // render. 4B's "have I seen this one?" ref used to be seeded with that very
    // prop, so the request looked already-handled and was dropped in silence.
    renderEditor({ model: modelWithPlacement('d1'), focusElement: { id: 'a1', nonce: 1 } });

    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    expect(nameInput.value).toBe('Webshop');
  });

  it('switches diagram for a mount-time request too', () => {
    const { props } = renderEditor({
      model: modelWithPlacement('d2'),
      focusElement: { id: 'a1', nonce: 1 },
    });
    expect(props.onActiveDiagramChange).toHaveBeenCalledExactlyOnceWith('d2');
  });

  it('does not re-handle the same nonce on unrelated rerenders', () => {
    const { rerenderWith, props } = renderEditor({ model: modelWithPlacement('d2') });
    rerenderWith({ focusElement: { id: 'a1', nonce: 1 } });
    expect(props.onActiveDiagramChange).toHaveBeenCalledTimes(1);

    // Same nonce again (e.g. the host re-rendered for other reasons).
    rerenderWith({ focusElement: { id: 'a1', nonce: 1 } });
    expect(props.onActiveDiagramChange).toHaveBeenCalledTimes(1);
  });

  it('switches to the diagram containing the element, then focuses it', () => {
    const { rerenderWith, props } = renderEditor({ model: modelWithPlacement('d2') });

    rerenderWith({ focusElement: { id: 'a1', nonce: 1 } });

    // Not on the active diagram: the editor asks the host to switch first…
    expect(props.onActiveDiagramChange).toHaveBeenCalledExactlyOnceWith('d2');
    expect(screen.queryByLabelText('Name')).toBeNull();

    // …and completes the focus once the host updates activeDiagramId.
    rerenderWith({ focusElement: { id: 'a1', nonce: 1 }, activeDiagramId: 'd2' });
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    expect(nameInput.value).toBe('Webshop');
  });

  it('is a no-op for elements placed on no diagram', () => {
    const { rerenderWith, props } = renderEditor(); // a1 exists but is unplaced
    rerenderWith({ focusElement: { id: 'a1', nonce: 1 } });

    expect(props.onActiveDiagramChange).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Name')).toBeNull();
    // The empty state stays up.
    expect(screen.getByText(/Select an element/)).toBeDefined();
  });
});

describe('SolutionDesignEditor — iteration 2', () => {
  it('falls back to the default five aspect rows without an aspectConfig', () => {
    const { rerenderWith } = renderEditor({ model: modelWithPlacement('d1') });
    rerenderWith({ focusElement: { id: 'a1', nonce: 1 } });

    // Aspects live in the inspector's Data tab (U7a).
    fireEvent.click(screen.getByRole('tab', { name: 'Data' }));

    for (const label of ['Platform', 'CI/CD', 'Disaster recovery', 'Security', 'Monitoring']) {
      expect(screen.getByLabelText(label)).toBeDefined();
    }
    expect(screen.getByLabelText('Platform note')).toBeDefined();
  });

  it('renders configured aspects (order + labels) instead of the default five', () => {
    const model = modelWithPlacement('d1');
    model.diagrams[0].aspectConfig = [
      { key: 'cost', label: 'Cost' },
      { key: 'custom-sla', label: 'SLA' },
    ];
    const { rerenderWith } = renderEditor({ model });
    rerenderWith({ focusElement: { id: 'a1', nonce: 1 } });

    // Aspects live in the inspector's Data tab (U7a).
    fireEvent.click(screen.getByRole('tab', { name: 'Data' }));

    expect(screen.getByLabelText('Cost')).toBeDefined();
    expect(screen.getByLabelText('SLA')).toBeDefined();
    expect(screen.queryByLabelText('Platform')).toBeNull();
  });

  it('shows the scope cost chip on layer7 when scopeSummary is provided', () => {
    renderEditor({
      scopeSummary: { estimatedMonthlyCost: 1250, linkedTasMonthly: 400 },
    });
    expect(screen.getByText(/Scope est\./)).toBeDefined();
    expect(screen.getByText(/T&S/)).toBeDefined();
  });

  it('renders the delta warning segment when scopeSummary carries a significant delta', () => {
    renderEditor({
      scopeSummary: {
        estimatedMonthlyCost: 1250,
        linkedTasMonthly: 2000,
        delta: { amount: 750, percent: 60, significant: true, periodMismatch: false },
      },
    });
    expect(screen.getByText(/Δ/)).toBeDefined();
    expect(screen.getByText(/\+60%/)).toBeDefined();
  });

  it('shows a mixed-billing-periods hint instead of a numeric delta on period mismatch', () => {
    renderEditor({
      scopeSummary: {
        estimatedMonthlyCost: 1250,
        linkedTasMonthly: 2000,
        delta: { amount: 750, percent: 60, significant: true, periodMismatch: true },
      },
    });
    expect(screen.getByText('Mixed billing periods')).toBeDefined();
    expect(screen.queryByText(/Δ/)).toBeNull();
  });

  it('renders no delta segment when the delta is below threshold', () => {
    renderEditor({
      scopeSummary: {
        estimatedMonthlyCost: 1250,
        linkedTasMonthly: 1300,
        delta: { amount: 50, percent: 4, significant: false, periodMismatch: false },
      },
    });
    expect(screen.getByText(/Scope est\./)).toBeDefined();
    expect(screen.queryByText(/Δ/)).toBeNull();
  });

  it('shows the fullscreen button only when onOpenFullscreen is provided', () => {
    const onOpenFullscreen = vi.fn();
    const { unmount } = renderEditor({ onOpenFullscreen });
    fireEvent.click(screen.getByLabelText('Open fullscreen'));
    expect(onOpenFullscreen).toHaveBeenCalledTimes(1);
    unmount();

    renderEditor();
    expect(screen.queryByLabelText('Open fullscreen')).toBeNull();
  });

  it('offers the domain group palette entry on layer7 and not on container diagrams', () => {
    const { unmount } = renderEditor();
    expect(screen.getByRole('button', { name: 'Domain group', expanded: false })).toBeDefined();
    unmount();

    renderEditor({ activeDiagramId: 'd2' });
    expect(screen.queryByText('Domain group')).toBeNull();
  });

  it('adding a domain group emits a batch with the layoutConfig rect', () => {
    const { onChange } = renderEditor();
    // The row opens; the Place button inside it is what adds — same gesture as
    // every other palette row since the group stopped being an exception.
    fireEvent.click(screen.getByRole('button', { name: 'Domain group', expanded: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Add domain group' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const batch = onChange.mock.calls[0][0];
    expect(batch.layoutConfig?.domainGroups).toHaveLength(1);
    expect(batch.layoutConfig?.domainGroups?.[0].name).toBe('New group');
    expect(batch.edgeRoutes).toEqual([]);
  });
});

// ── Edge labels (stacked chip + inline edit + repositioning) ─────────────────

/** Two placed endpoints and one labelled connection on the landscape. */
function modelWithConnection(): DesignModel {
  const model = modelWithPlacement('d1');
  model.elements.push({
    id: 'b1',
    kind: 'externalSystem',
    name: 'Carrier',
    lifecycle: 'live',
    isManaged: false,
    aspects: {},
    parameters: {},
  });
  model.diagrams[0].placements.push({
    elementId: 'b1',
    zone: 'externalSystems',
    x: 1500,
    y: 400,
  });
  model.connections = [
    { id: 'c1', sourceId: 'a1', targetId: 'b1', label: 'Sends orders', protocol: 'EDI', isBidirectional: false },
  ];
  return model;
}

describe('SolutionDesignEditor — edge labels', () => {
  it('stacks the technology below the description in ONE chip, honouring newlines', async () => {
    const model = modelWithConnection();
    model.connections[0].label = 'Sends orders\nand invoices';
    renderEditor({ model });

    const chip = await screen.findByTestId('edge-label-c1');
    const spans = chip.querySelectorAll('span');
    expect(spans[0].textContent).toBe('Sends orders\nand invoices');
    expect(spans[0].style.whiteSpace).toBe('pre-line');
    // The technology line always sits BELOW the description.
    expect(spans[1].textContent).toBe('EDI');
  });

  it('double-click opens a multiline editor; blur commits the new label', async () => {
    const { onChange } = renderEditor({ model: modelWithConnection() });

    fireEvent.doubleClick(await screen.findByTestId('edge-label-c1'));
    const textarea = screen.getByPlaceholderText('Interface description…') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Sends orders');
    fireEvent.change(textarea, { target: { value: 'Sends orders\nand credit notes' } });
    fireEvent.blur(textarea);

    const batch = onChange.mock.calls.at(-1)?.[0] as DiagramContentBatch;
    expect(batch.connections.find((c) => c.id === 'c1')?.label).toBe(
      'Sends orders\nand credit notes',
    );
  });

  it('Escape cancels the inline edit without emitting a change', async () => {
    const { onChange } = renderEditor({ model: modelWithConnection() });

    fireEvent.doubleClick(await screen.findByTestId('edge-label-c1'));
    const textarea = screen.getByPlaceholderText('Interface description…');
    fireEvent.change(textarea, { target: { value: 'scrapped' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });

    expect(onChange).not.toHaveBeenCalled();
    expect((await screen.findByTestId('edge-label-c1')).textContent).toContain('Sends orders');
  });

  it('right-click on a repositioned label offers "Reset label position"', async () => {
    const model = modelWithConnection();
    model.diagrams[0].edgeRoutes = [
      { connectionId: 'c1', waypoints: [], labelPosition: { x: 500, y: 200 } },
    ];
    const { onChange } = renderEditor({ model });

    fireEvent.contextMenu(await screen.findByTestId('edge-label-c1'));
    fireEvent.click(screen.getByText('Reset label position'));

    const batch = onChange.mock.calls.at(-1)?.[0] as DiagramContentBatch;
    // No waypoints and no anchor left, so the server drops the row — and the
    // reset is stamped `manual` like every other hand edit, because it went
    // through the same claiming path rather than a special-cased one.
    expect(batch.edgeRoutes).toEqual([
      { connectionId: 'c1', waypoints: [], labelPosition: undefined, source: 'manual' },
    ]);
  });
});

/**
 * Feedback item 4 said a reroute should not litter the line with grab points; the
 * routing phase (2a) keeps that and changes WHO decides: selection does, not
 * provenance. An unselected line shows nothing, router output included; a
 * selected line shows its handles whoever drew it, and "touching one makes it
 * yours" is what stops that from being a loss of control.
 */
describe('SolutionDesignEditor — route provenance and handles', () => {
  const routedModel = (source: 'manual' | 'auto') => {
    const model = modelWithConnection();
    model.diagrams[0].edgeRoutes = [
      { connectionId: 'c1', waypoints: [{ x: 900, y: 320 }, { x: 900, y: 420 }], source },
    ];
    return model;
  };
  const selectEdge = async (id: string) => fireEvent.click(await screen.findByTestId(`rf__edge-${id}`));

  it('shows no handles on an UNSELECTED line, whoever drew it', async () => {
    for (const source of ['manual', 'auto'] as const) {
      cleanup();
      renderEditor({ model: routedModel(source) });
      // The label proves the edge rendered — it is the handles specifically that stay away.
      await screen.findByTestId('edge-label-c1');
      expect(screen.queryByTestId('waypoint-c1-0')).toBeNull();
      expect(screen.queryByTestId('segment-c1-0')).toBeNull();
    }
  });

  it('shows a bend handle per waypoint and a segment handle per leg once the line is selected — router output included', async () => {
    for (const source of ['manual', 'auto'] as const) {
      cleanup();
      renderEditor({ model: routedModel(source) });
      await selectEdge('c1');
      expect(await screen.findByTestId('waypoint-c1-0')).toBeTruthy();
      expect(screen.getByTestId('waypoint-c1-1')).toBeTruthy();
      // Two bends make three legs.
      expect(screen.getByTestId('segment-c1-0')).toBeTruthy();
      expect(screen.getByTestId('segment-c1-1')).toBeTruthy();
      expect(screen.getByTestId('segment-c1-2')).toBeTruthy();
      expect(screen.queryByTestId('segment-c1-3')).toBeNull();
    }
  });

  it('treats a route with no recorded source as one a person drew: tight corners', async () => {
    // The pre-provenance backfill case. Guessing `auto` here would draw every
    // existing board's bends at the router's radius — and, before 2a, would have
    // stripped their handles.
    const model = modelWithConnection();
    model.diagrams[0].edgeRoutes = [{ connectionId: 'c1', waypoints: [{ x: 900, y: 320 }] }];
    renderEditor({ model });
    await screen.findByTestId('edge-label-c1');
    const path = document.getElementById('c1') as SVGPathElement | null;
    // A manual radius of 8 on this leg geometry: the corner's control point is the
    // bend itself, approached from 8 px out.
    expect(path?.getAttribute('d')).toContain('Q 900,320');
    expect(path?.getAttribute('d')).toContain('L 892,320');
  });

  it('draws sharp corners on a routed line whose shape is "Orthogonal"', async () => {
    // The routing token used to be read only by the waypoint-less branch, so a
    // line with bends always drew rounded whatever the user picked.
    const model = routedModel('manual');
    model.connections[0].routing = 'orthogonal';
    renderEditor({ model });
    await screen.findByTestId('edge-label-c1');
    const d = document.getElementById('c1')?.getAttribute('d') ?? '';
    // Radius 0: the polyline goes straight through both bends, no arc anywhere.
    expect(d).toContain('L 900,320');
    expect(d).toContain('L 900,420');
    expect(d).not.toContain('Q');
  });

  it('claims an auto route for the user when they double-click a new bend into it', async () => {
    const { onChange } = renderEditor({ model: routedModel('auto') });

    fireEvent.doubleClick(await screen.findByTestId('rf__edge-c1'));

    const batch = onChange.mock.calls.at(-1)?.[0] as DiagramContentBatch;
    const route = batch.edgeRoutes.find((r) => r.connectionId === 'c1');
    // One commit: the new bend AND the claim, so a single undo puts both back.
    expect(route?.source).toBe('manual');
    expect(route?.waypoints.length).toBe(3);
  });
});

// ── Copy / paste cascade (U4a) ───────────────────────────────────────────────

describe('SolutionDesignEditor — paste cascade', () => {
  it('offsets each successive paste one grid step further, and a fresh copy resets it', () => {
    const { onChange, rerenderWith } = renderEditor({ model: modelWithPlacement('d1') });
    // Select the placed application (a1 sits at x:400 on the landscape).
    rerenderWith({ focusElement: { id: 'a1', nonce: 1 } });
    expect(screen.getByLabelText('Name')).toBeDefined();

    // A non-editable on-canvas target so the shortcut hook runs. jsdom reports
    // an empty navigator.platform → the keymap resolves Mod to Ctrl here.
    const target = screen.getByText('ACTORS');
    const copy = () => fireEvent.keyDown(target, { key: 'c', ctrlKey: true });
    const paste = () => fireEvent.keyDown(target, { key: 'v', ctrlKey: true });
    // The x of every pasted (temp-id) placement in the latest batch — batches
    // carry the full effective placement set, so these accumulate.
    const pastedXs = () => {
      const batch = onChange.mock.calls.at(-1)?.[0] as DiagramContentBatch;
      return batch.placements.filter((p) => isTempId(p.elementId)).map((p) => p.x).sort((a, b) => a - b);
    };

    copy();
    paste();
    expect(pastedXs()).toEqual([400 + GRID_SIZE]);

    paste();
    expect(pastedXs()).toEqual([400 + GRID_SIZE, 400 + GRID_SIZE * 2]);

    // Re-select a1 and copy again: a fresh copy resets the cascade, so the next
    // paste lands one step out again and a second placement shares that x.
    // (After a paste the selection is the clone, so we must reselect a1 first.)
    rerenderWith({ focusElement: { id: 'a1', nonce: 2 } });
    copy();
    paste();
    expect(pastedXs().filter((x) => x === 400 + GRID_SIZE)).toHaveLength(2);
  });
});

// ── Minimap (QF1 removed it; 4B made it a toggle) ────────────────────────────

describe('SolutionDesignEditor — minimap', () => {
  // Flipped in 4B. QF1's rule was "no minimap", because an always-on one costs
  // board area nobody asked to give up. The rule is now "not unless you ask" —
  // the default is still no minimap, and this asserts that first.
  it('renders no minimap by default', () => {
    const { container } = renderEditor();
    expect(container.querySelector('.react-flow__minimap')).toBeNull();
  });

  it('renders one after the toolbar toggle, and takes it away again', () => {
    const { container } = renderEditor();
    const toggle = screen.getByLabelText('Toggle minimap');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(toggle);
    expect(container.querySelector('.react-flow__minimap')).not.toBeNull();
    expect(screen.getByLabelText('Toggle minimap').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByLabelText('Toggle minimap'));
    expect(container.querySelector('.react-flow__minimap')).toBeNull();
  });

  it('starts on when the host says so, and reports the change back', () => {
    const onPreferencesChange = vi.fn();
    const { container } = renderEditor({
      initialPreferences: { showMinimap: true },
      onPreferencesChange,
    });
    expect(container.querySelector('.react-flow__minimap')).not.toBeNull();

    fireEvent.click(screen.getByLabelText('Toggle minimap'));
    expect(onPreferencesChange).toHaveBeenCalledWith(
      expect.objectContaining({ showMinimap: false }),
    );
  });
});

// ── Keyboard access (4B) ─────────────────────────────────────────────────────

describe('SolutionDesignEditor — keyboard focus on nodes', () => {
  it('Space on a focused node selects it, exactly as Enter does', () => {
    // Both keys, because a focused control that answers to only one of them is
    // the kind of half-keyboard that reads as broken. React Flow's own key
    // handling stays off (the keymap owns the arrows and commits the move), so
    // Enter/Space is the editor's own handler, not a default worth asserting.
    const { container } = renderEditor({ model: modelWithPlacement('d1') });
    const node = container.querySelector('.react-flow__node') as HTMLElement;
    fireEvent.keyDown(node, { key: ' ' });
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Webshop');
  });

  it('Escape lets go of a node the keyboard selected', () => {
    const { container } = renderEditor({ model: modelWithPlacement('d1') });
    const node = container.querySelector('.react-flow__node') as HTMLElement;
    fireEvent.keyDown(node, { key: 'Enter' });
    expect(screen.getByLabelText('Name')).toBeDefined();

    fireEvent.keyDown(node, { key: 'Escape' });
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.getByText(/Select an element or connection/)).toBeDefined();
  });

  it('Enter on a focused node selects it', () => {
    const { container } = renderEditor({ model: modelWithPlacement('d1') });
    const node = container.querySelector('.react-flow__node') as HTMLElement;
    fireEvent.keyDown(node, { key: 'Enter' });
    // The inspector now shows that element's form.
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Webshop');
  });

  it('Shift+Enter adds to the selection instead of replacing it', () => {
    const { container } = renderEditor({ model: modelWithPlacement('d1') });
    const node = container.querySelector('.react-flow__node') as HTMLElement;
    fireEvent.keyDown(node, { key: 'Enter' });
    fireEvent.keyDown(node, { key: 'Enter', shiftKey: true });
    // Toggled back off: nothing selected, so the inspector is empty again.
    expect(screen.getByText(/Select an element or connection/)).toBeDefined();
  });
});

// ── Route connections only ───────────────────────────────────────────────────

describe('SolutionDesignEditor — route connections only', () => {
  /** Two placed applications with a group box straddling the line between them. */
  function modelWithBlockedEdge(): DesignModel {
    const model = baseModel();
    model.elements.push({
      id: 'a2',
      kind: 'application',
      name: 'Order Service',
      lifecycle: 'live',
      isManaged: true,
      aspects: {},
      parameters: {},
    });
    model.connections.push({ id: 'c1', sourceId: 'a1', targetId: 'a2', isBidirectional: false });
    const diagram = model.diagrams[0];
    diagram.placements = [
      { elementId: 'a1', zone: 'landscape', x: 100, y: 400 },
      { elementId: 'a2', zone: 'landscape', x: 1200, y: 400 },
    ];
    diagram.layoutConfig = { domainGroups: [{ name: 'Ops', x: 600, y: 350, width: 300, height: 260 }] };
    return model;
  }

  it('routes the blocked edge and leaves every node where it was', async () => {
    const model = modelWithBlockedEdge();
    const { onChange } = renderEditor({ model });

    fireEvent.click(screen.getByLabelText('Route connections only'));

    // The router is WASM, so the commit lands a tick later — wait for the batch
    // rather than for a timeout, and assert it is still exactly ONE batch.
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    const batch = onChange.mock.calls.at(-1)![0];
    // Positions come back untouched, and the blocked edge gained a route.
    expect(batch.placements).toEqual(model.diagrams[0].placements);
    expect(batch.layoutConfig).toBeUndefined();
    const route = batch.edgeRoutes.find((r) => r.connectionId === 'c1');
    expect(route?.waypoints.length).toBeGreaterThan(0);
  });

  it('locks out Tidy while it runs, then releases both buttons', async () => {
    const { onChange } = renderEditor({ model: modelWithBlockedEdge() });
    const tidy = screen.getByLabelText<HTMLButtonElement>('Tidy layout');
    const route = screen.getByLabelText<HTMLButtonElement>('Route connections only');
    expect(tidy.disabled).toBe(false);

    // Both actions commit one undo step over the whole diagram, so they must not
    // overlap. `busy` is set synchronously in the click handler — no microtask has
    // run yet at this point, so this observes the pending state, not a race.
    fireEvent.click(route);
    expect(tidy.disabled).toBe(true);
    expect(route.disabled).toBe(true);

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(tidy.disabled).toBe(false);
    expect(route.disabled).toBe(false);
  });

  it('hides the action under readOnly', () => {
    renderEditor({ model: modelWithBlockedEdge(), readOnly: true });
    expect(screen.queryByLabelText('Route connections only')).toBeNull();
  });
});

// ── QF3: visible-grid toggle ─────────────────────────────────────────────────

describe('SolutionDesignEditor — grid visibility toggle (QF3)', () => {
  it('renders the dot grid by default and hides it when toggled off', () => {
    const { container } = renderEditor();
    const toggle = screen.getByLabelText('Toggle grid visibility');

    // Default on: the RF background is present and the button reads pressed.
    expect(container.querySelector('.react-flow__background')).not.toBeNull();
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    // Toggle off: the background unmounts and the button flips.
    fireEvent.click(toggle);
    expect(container.querySelector('.react-flow__background')).toBeNull();
    expect(screen.getByLabelText('Toggle grid visibility').getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('is independent of the snap toggle', () => {
    renderEditor();
    const snap = screen.getByLabelText('Toggle snap to grid');
    const grid = screen.getByLabelText('Toggle grid visibility');
    // Snap defaults off, grid defaults on — orthogonal state.
    expect(snap.getAttribute('aria-pressed')).toBe('false');
    expect(grid.getAttribute('aria-pressed')).toBe('true');

    // Toggling snap on does not touch grid visibility.
    fireEvent.click(snap);
    expect(screen.getByLabelText('Toggle snap to grid').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('Toggle grid visibility').getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});

describe('SolutionDesignEditor — collapsible panels (U7b)', () => {
  it('collapses and expands the inspector; chevron reachable in both states', () => {
    renderEditor();
    // Expanded: empty-state body visible, collapse chevron present.
    expect(screen.getByText(/Select an element/)).toBeDefined();
    expect(screen.getByLabelText('Collapse inspector')).toBeDefined();

    fireEvent.click(screen.getByLabelText('Collapse inspector'));
    // Rail: body gone, expand chevron present (reachable in the collapsed state).
    expect(screen.queryByText(/Select an element/)).toBeNull();
    expect(screen.getByLabelText('Expand inspector')).toBeDefined();

    fireEvent.click(screen.getByLabelText('Expand inspector'));
    expect(screen.getByText(/Select an element/)).toBeDefined();
  });

  it('collapses the inspector in readOnly mode too', () => {
    renderEditor({ readOnly: true });
    fireEvent.click(screen.getByLabelText('Collapse inspector'));
    expect(screen.queryByText(/Select an element/)).toBeNull();
    fireEvent.click(screen.getByLabelText('Expand inspector'));
    expect(screen.getByText(/Select an element/)).toBeDefined();
  });

  it('collapses the palette to an icon rail, and a rail icon reopens it at that row', () => {
    renderEditor();
    expect(screen.getByText('Application')).toBeDefined();

    fireEvent.click(screen.getByLabelText('Collapse palette'));
    expect(screen.queryByText('Application')).toBeNull();
    expect(screen.getByLabelText('Expand palette')).toBeDefined();

    // Clicking a kind on the rail expands the panel with that row already open,
    // so the logo and name are one click away rather than two.
    fireEvent.click(screen.getByLabelText('Open application options'));
    expect(screen.getByText('Application')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add application' })).toBeDefined();
  });

  it('keeps collapse state in-memory only (no storage writes) and resets on remount', () => {
    const localSpy = vi.spyOn(Storage.prototype, 'setItem');

    const { unmount } = renderEditor();
    fireEvent.click(screen.getByLabelText('Collapse inspector'));
    fireEvent.click(screen.getByLabelText('Collapse palette'));

    // Matches the snap/lifecycle precedent: nothing is persisted.
    expect(localSpy).not.toHaveBeenCalled();

    unmount();
    // A fresh mount starts expanded again (in-memory state reset).
    renderEditor();
    expect(screen.getByLabelText('Collapse inspector')).toBeDefined();
    expect(screen.getByText(/Select an element/)).toBeDefined();

    localSpy.mockRestore();
  });
});

describe('SolutionDesignEditor — palette drag over the board', () => {
  /**
   * The drop outline answers the question the browser's drag ghost cannot: not
   * "am I dragging" but "which band will this land in", which on a board with a
   * fixed zone grammar is what decides the result.
   */
  function dragOverPane(view: ReturnType<typeof renderEditor>, clientX: number, clientY: number) {
    const pane = view.container.querySelector('.react-flow') as HTMLElement;
    fireEvent.dragOver(pane, {
      clientX,
      clientY,
      dataTransfer: { types: [PALETTE_DRAG_MIME], dropEffect: '' },
    });
    return pane;
  }

  it('outlines the zone under the pointer while a palette drag is over the board', () => {
    const view = renderEditor();
    expect(view.queryByTestId('lv-zone-drop-outline')).toBeNull();

    const pane = dragOverPane(view, 200, 60);
    const outline = view.getByTestId('lv-zone-drop-outline');
    expect(outline.dataset.zone).toBeTruthy();
    expect(outline.dataset.active).toBe('true');

    // Leaving the board fades it out rather than snapping it away, so it stays
    // mounted on the band it was on.
    fireEvent.dragLeave(pane);
    expect(view.getByTestId('lv-zone-drop-outline').dataset.active).toBe('false');
  });

  it('ignores a drag that is not carrying a palette payload', () => {
    const view = renderEditor();
    const pane = view.container.querySelector('.react-flow') as HTMLElement;
    fireEvent.dragOver(pane, {
      clientX: 200,
      clientY: 60,
      dataTransfer: { types: ['Files'], dropEffect: '' },
    });
    expect(view.queryByTestId('lv-zone-drop-outline')).toBeNull();
  });

  it('does not outline anything in readOnly — there is nothing to drop', () => {
    const view = renderEditor({ readOnly: true });
    dragOverPane(view, 200, 60);
    expect(view.queryByTestId('lv-zone-drop-outline')).toBeNull();
  });
});

/**
 * A domain group is created two ways and both go through the same helper: the
 * palette tray's Place button and a drop on the board. It used to be the one
 * palette row that added on click and could not be dragged at all.
 */
describe('SolutionDesignEditor — domain groups from the palette', () => {
  const groupsFrom = (onChange: ReturnType<typeof vi.fn>) =>
    onChange.mock.calls.at(-1)?.[0].layoutConfig?.domainGroups ?? [];

  it('places a named, coloured group from the tray', () => {
    const { onChange } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Domain group', expanded: false }));
    fireEvent.change(screen.getByLabelText('Domain group name'), {
      target: { value: 'Commerce' },
    });
    fireEvent.change(screen.getByLabelText('Domain group colour'), {
      target: { value: '#2f6fdb' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add domain group' }));

    expect(groupsFrom(onChange)).toEqual([
      expect.objectContaining({ name: 'Commerce', color: '#2f6fdb' }),
    ]);
  });

  it('drops a group onto the board instead of the default corner', () => {
    const view = renderEditor();
    const pane = view.container.querySelector('.react-flow') as HTMLElement;

    fireEvent.drop(pane, {
      clientX: 320,
      clientY: 240,
      dataTransfer: {
        types: [PALETTE_DRAG_MIME],
        getData: (type: string) =>
          type === PALETTE_DRAG_MIME
            ? JSON.stringify({ kind: 'domainGroup', name: 'Commerce', color: '#2f6fdb' })
            : '',
      },
    });

    const [group] = groupsFrom(view.onChange);
    expect(group).toMatchObject({ name: 'Commerce', color: '#2f6fdb' });
    // And no element was created by the same gesture — a group is not an element.
    expect(view.onChange.mock.calls.at(-1)?.[0].elements).toEqual([]);
  });

  it('never hijacks an existing group by name', () => {
    const model = baseModel();
    model.diagrams[0].layoutConfig = {
      domainGroups: [{ name: 'Commerce', x: 300, y: 300, width: 400, height: 300 }],
    };
    const { onChange } = renderEditor({ model });

    fireEvent.click(screen.getByRole('button', { name: 'Domain group', expanded: false }));
    fireEvent.change(screen.getByLabelText('Domain group name'), {
      target: { value: 'Commerce' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add domain group' }));

    expect(groupsFrom(onChange).map((g: { name: string }) => g.name)).toEqual([
      'Commerce',
      'Commerce 2',
    ]);
  });
});

describe('SolutionDesignEditor — palette tray pre-seed', () => {
  it('pre-seeds the logo and name; the inspector reflects the same fields', () => {
    const { onChange } = renderEditor();

    // Open the application row, pick a mark and name it before placing.
    fireEvent.click(screen.getByRole('button', { name: 'Application', expanded: false }));
    fireEvent.click(screen.getByLabelText('Database'));
    fireEvent.change(screen.getByLabelText('Application name'), {
      target: { value: 'Kernsysteem' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add application' }));

    const created = onChange.mock.calls.at(-1)?.[0].elements[0] as DiagramContentBatch['elements'][0];
    expect(created.iconKey).toBe('database');
    expect(created.name).toBe('Kernsysteem');

    // Auto-selected → the inspector holds the same name. One source of truth:
    // the tray writes the fields the inspector edits, it does not keep its own.
    const inspector = screen.getByRole('complementary', { name: 'Inspector' });
    expect((within(inspector).getByLabelText('Name') as HTMLInputElement).value).toBe(
      'Kernsysteem',
    );
  });

  it('places an unseeded element when the tray is untouched — parity with today', () => {
    const { onChange } = renderEditor();
    placeFromPalette('Actor');

    const created = onChange.mock.calls.at(-1)?.[0].elements[0] as DiagramContentBatch['elements'][0];
    expect(created.name).toBe('New actor');
    expect(created.shapeVariant).toBeUndefined();
    expect(created.accentColor).toBeUndefined();
    expect(created.iconKey).toBeUndefined();
  });

  it('leaves accent colour and shape to the inspector — the tray does not offer them', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Application', expanded: false }));

    const palette = screen.getByRole('complementary', { name: 'Element palette' });
    expect(within(palette).queryByRole('group', { name: 'Shape' })).toBeNull();
    expect(within(palette).queryByLabelText('Accent colour')).toBeNull();
  });
});

// ── Phase 1: diagram tab menu + container diagrams under their landscape ─────

describe('SolutionDesignEditor — diagram tab menu', () => {
  /** Two landscapes, so Delete is not refused as "the last one". */
  function twoLandscapes(): DesignModel {
    const model = modelWithPlacement('d1');
    model.diagrams.push({ id: 'd3', kind: 'layer7', name: 'Layer 7 — US', placements: [] });
    return model;
  }

  it('right-click on a tab offers rename / duplicate / delete when the host wired them', () => {
    const onRenameDiagram = vi.fn();
    const onDuplicateDiagram = vi.fn();
    const onDeleteDiagram = vi.fn();
    renderEditor({ model: twoLandscapes(), onRenameDiagram, onDuplicateDiagram, onDeleteDiagram });

    fireEvent.contextMenu(screen.getByRole('tab', { name: /Layer 7 — EU/ }));
    const menu = screen.getByRole('menu', { name: 'Diagram menu' });
    fireEvent.click(within(menu).getByText('Duplicate diagram'));
    expect(onDuplicateDiagram).toHaveBeenCalledExactlyOnceWith('d1');

    fireEvent.contextMenu(screen.getByRole('tab', { name: /Layer 7 — US/ }));
    fireEvent.click(within(screen.getByRole('menu', { name: 'Diagram menu' })).getByText('Delete diagram…'));
    expect(onDeleteDiagram).toHaveBeenCalledExactlyOnceWith('d3');
    expect(onRenameDiagram).not.toHaveBeenCalled();
  });

  it('"Rename diagram…" collects the new name in a dialog and hands it to the host', async () => {
    const onRenameDiagram = vi.fn();
    renderEditor({ model: twoLandscapes(), onRenameDiagram });

    fireEvent.contextMenu(screen.getByRole('tab', { name: /Layer 7 — EU/ }));
    fireEvent.click(within(screen.getByRole('menu', { name: 'Diagram menu' })).getByText('Rename diagram…'));

    const dialog = screen.getByRole('dialog');
    const field = within(dialog).getByLabelText('Name') as HTMLInputElement;
    expect(field.value).toBe('Layer 7 — EU');
    // Unchanged name: nothing to save.
    expect((within(dialog).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(field, { target: { value: '  Europa  ' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(onRenameDiagram).toHaveBeenCalledExactlyOnceWith('d1', 'Europa');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('refuses to delete the last landscape and hides entries whose callback is absent', async () => {
    const onDeleteDiagram = vi.fn();
    renderEditor({ model: modelWithPlacement('d1'), onDeleteDiagram });

    fireEvent.contextMenu(screen.getByRole('tab', { name: /Layer 7 — EU/ }));
    const menu = screen.getByRole('menu', { name: 'Diagram menu' });
    expect(within(menu).queryByText('Rename diagram…')).toBeNull();
    expect(within(menu).queryByText('Duplicate diagram')).toBeNull();
    const remove = within(menu).getByRole('menuitem', { name: /Delete diagram/ });
    expect(remove.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(remove);
    expect(onDeleteDiagram).not.toHaveBeenCalled();
    fireEvent.mouseOver(within(remove).getByText('Delete diagram…'));
    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toMatch(/last landscape/));
  });

  it('opens no tab menu without any diagram callbacks, nor in read-only', () => {
    renderEditor({ model: twoLandscapes() });
    fireEvent.contextMenu(screen.getByRole('tab', { name: /Layer 7 — EU/ }));
    expect(screen.queryByRole('menu', { name: 'Diagram menu' })).toBeNull();
    cleanup();

    renderEditor({ model: twoLandscapes(), readOnly: true, onDeleteDiagram: vi.fn(), onRenameDiagram: vi.fn() });
    fireEvent.contextMenu(screen.getByRole('tab', { name: /Layer 7 — EU/ }));
    expect(screen.queryByRole('menu', { name: 'Diagram menu' })).toBeNull();
  });
});

describe('SolutionDesignEditor — container diagrams under their landscape tab', () => {
  it('shows a chevron on a landscape whose applications have container diagrams, listing and switching to them', () => {
    const { props } = renderEditor({ model: modelWithPlacement('d1') });

    const chevron = screen.getByRole('button', { name: 'Container diagrams of Layer 7 — EU' });
    fireEvent.click(chevron);
    const menu = screen.getByRole('menu', { name: 'Container diagrams of Layer 7 — EU' });
    expect(within(menu).getByText('Webshop')).toBeDefined();
    expect(within(menu).getByText('Container view')).toBeDefined();

    fireEvent.click(within(menu).getByText('Webshop'));
    expect(props.onActiveDiagramChange).toHaveBeenCalledWith('d2');
    // Clicking the chevron must not have switched tabs by itself.
    expect(props.onActiveDiagramChange).not.toHaveBeenCalledWith('d1');
  });

  it('shows no chevron when no placed application has a container diagram', () => {
    renderEditor(); // a1 exists with container d2, but is not placed on d1
    expect(screen.queryByRole('button', { name: /Container diagrams of/ })).toBeNull();
  });

  it('keeps the chevron in read-only mode — it is navigation', () => {
    renderEditor({ model: modelWithPlacement('d1'), readOnly: true });
    expect(screen.getByRole('button', { name: 'Container diagrams of Layer 7 — EU' })).toBeDefined();
  });
});
