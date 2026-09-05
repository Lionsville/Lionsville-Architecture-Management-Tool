// @vitest-environment jsdom
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider, useReactFlow, type ReactFlowInstance } from '@xyflow/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { DEFAULT_TIDY_OPTIONS, type TidyOptions } from '../layout/tidy';
import type { DesignDiagram, DesignModel } from '../types';
import type { EditorActions, Selection } from '../editor/useEditorState';
import { installReactFlowMocks } from '../editor/reactFlowTestSetup';
import { Layer7Canvas } from './Layer7Canvas';

/**
 * The domain-group boxes are drawn `pointer-events: none` so the pane keeps
 * panning/selection and the nodes on top stay clickable. That means a
 * right-click inside a box lands on the PANE, not on the box — the group menu
 * has to be resolved by hit-testing the click point. Right-clicking the tiny
 * name pill (the only interactive part of the box) must open the same menu.
 */

beforeAll(() => installReactFlowMocks());
afterEach(() => cleanup());

const GROUP = { name: 'Core', x: 200, y: 200, width: 400, height: 300 };

function model(): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: [
      { id: 'a1', kind: 'application', name: 'App', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
    ],
    connections: [],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [{ elementId: 'a1', zone: 'landscape', domainGroup: 'Core', x: 250, y: 250 }],
        layoutConfig: { domainGroups: [GROUP] },
      },
    ],
  };
}

/** Grabs the flow instance so the tests can aim clicks in FLOW coordinates. */
function FlowProbe({ onReady }: { onReady(instance: ReactFlowInstance): void }) {
  onReady(useReactFlow());
  return null;
}

function renderCanvas(
  overrides: {
    readOnly?: boolean;
    selection?: Selection;
    onTidyGroup?: (name: string) => void;
    onGroupTidyOptionsChange?: (options: TidyOptions) => void;
    /** Start the Core group already coloured, as a saved design would. */
    groupColor?: string;
    /**
     * Apply selection changes to the canvas (the default, mirroring the editor).
     * Off for the tests that select a NODE: this minimal harness — with or
     * without the context menu — loops React Flow's store on a selected node
     * (a pre-existing quirk of the stubbed actions/model here, not of the
     * editor, whose own tests select nodes freely), so those tests observe
     * the selection call instead of rendering its result.
     */
    controlled?: boolean;
  } = {},
) {
  const design = model();
  if (overrides.groupColor) {
    design.diagrams[0].layoutConfig!.domainGroups![0] = {
      ...GROUP,
      color: overrides.groupColor,
    };
  }
  const diagram = design.diagrams[0] as DesignDiagram;
  const onSelectionChange = vi.fn();
  let flow: ReactFlowInstance | undefined;
  const actions = {
    addElement: vi.fn(),
    upsertDomainGroup: vi.fn(),
    moveDomainGroup: vi.fn(),
    renameDomainGroup: vi.fn(),
    removeDomainGroup: vi.fn(),
  } as unknown as EditorActions;

  /**
   * The selection is CONTROLLED here, exactly as the editor owns it. A spy that
   * swallowed the change would leave the canvas rendering a stale selection —
   * and React Flow's post-click selection reset would then look like a bug that
   * production never has.
   */
  function Harness() {
    const [selection, setSelection] = useState<Selection>(
      overrides.selection ?? { elementIds: [], connectionIds: [], domainGroups: [] },
    );
    return (
      <Layer7Canvas
        model={design}
        diagram={diagram}
        readOnly={overrides.readOnly ?? false}
        selection={selection}
        onSelectionChange={(next) => {
          onSelectionChange(next);
          if (overrides.controlled ?? true) setSelection(next);
        }}
        actions={actions}
        snapToGrid={false}
        onToggleSnapToGrid={vi.fn()}
        showGrid={false}
        onToggleShowGrid={vi.fn()}
        showLifecycle={false}
        onTidyGroup={overrides.onTidyGroup}
        groupTidyOptions={DEFAULT_TIDY_OPTIONS}
        onGroupTidyOptionsChange={overrides.onGroupTidyOptionsChange ?? vi.fn()}
      />
    );
  }

  render(
    <ThemeProvider theme={createTheme()}>
      <ReactFlowProvider>
        <Harness />
        <FlowProbe onReady={(instance) => (flow = instance)} />
      </ReactFlowProvider>
    </ThemeProvider>,
  );

  /**
   * Right-click the pane at a FLOW point — the element every canvas
   * right-click actually lands on, since the group boxes are click-through.
   * The canvas runs `fitView`, so flow coords have to be projected to client
   * coords or the hit-test aims at the wrong place.
   */
  const rightClickAt = (point: { x: number; y: number }) => {
    const element = document.querySelector('.react-flow__pane');
    if (!element || !flow) throw new Error('no react-flow pane rendered');
    const screen = flow.flowToScreenPosition(point);
    fireEvent.contextMenu(element, { clientX: screen.x, clientY: screen.y });
  };

  /** Left-click the pane at a FLOW point — same click-through as above. */
  const clickAt = (point: { x: number; y: number }) => {
    const element = document.querySelector('.react-flow__pane');
    if (!element || !flow) throw new Error('no react-flow pane rendered');
    const screen = flow.flowToScreenPosition(point);
    fireEvent.click(element, { clientX: screen.x, clientY: screen.y });
  };

  return { actions, rightClickAt, clickAt, onSelectionChange };
}

describe('Layer7Canvas — domain-group context menu', () => {
  it('opens the group menu on a right-click inside the box, not just on the label', () => {
    const onTidyGroup = vi.fn();
    const { rightClickAt } = renderCanvas({ onTidyGroup });

    // A point well inside the Core box, but on no node.
    rightClickAt({ x: GROUP.x + 40, y: GROUP.y + GROUP.height - 40 });

    expect(screen.getByText('Tidy this group')).toBeDefined();
    expect(screen.getByText('Remove group')).toBeDefined();

    // "Tidy this group" opens the settings panel; Apply is what runs it.
    fireEvent.click(screen.getByText('Tidy this group'));
    expect(onTidyGroup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Tidy Core', { selector: 'button' }));
    expect(onTidyGroup).toHaveBeenCalledWith('Core');
  });

  it('opens the canvas menu, not the group menu, over open landscape', () => {
    const { rightClickAt } = renderCanvas({ onTidyGroup: vi.fn() });

    rightClickAt({ x: GROUP.x + GROUP.width + 200, y: GROUP.y + GROUP.height + 200 });

    expect(screen.queryByText('Tidy this group')).toBeNull();
    expect(screen.queryByText('Remove group')).toBeNull();
    // Phase 1: open landscape has a menu of its own now.
    expect(screen.getByRole('menu', { name: 'Canvas menu' })).toBeDefined();
    expect(screen.getByText('Add domain group here')).toBeDefined();
  });

  it('opens the element menu, not the group menu, on a node inside the box', () => {
    const { onSelectionChange } = renderCanvas({ onTidyGroup: vi.fn(), controlled: false });

    // Bubbles up to the pane container, so without the target guard this would
    // open the group menu on top of the node's own.
    const node = document.querySelector('.react-flow__node');
    fireEvent.contextMenu(node!, { clientX: 300, clientY: 300, bubbles: true });

    expect(screen.queryByText('Remove group')).toBeNull();
    expect(screen.getByRole('menu', { name: 'Element menu' })).toBeDefined();
    expect(screen.getByText('Remove from diagram')).toBeDefined();
    // Right-click selects the node it is about, like every other editor does.
    expect(onSelectionChange).toHaveBeenCalledWith({ elementIds: ['a1'], connectionIds: [], domainGroups: [] });
  });

  it('still opens from the group label pill, and removes via the same menu', () => {
    const { actions } = renderCanvas({ onTidyGroup: vi.fn() });

    fireEvent.contextMenu(screen.getByLabelText('Domain group Core'));

    fireEvent.click(screen.getByText('Remove group'));
    expect(actions.removeDomainGroup).toHaveBeenCalledWith('Core');
  });

  it('offers no Tidy entry when the editor supplies no handler', () => {
    const { rightClickAt } = renderCanvas();

    rightClickAt({ x: GROUP.x + 40, y: GROUP.y + GROUP.height - 40 });

    expect(screen.queryByText('Tidy this group')).toBeNull();
    expect(screen.getByText('Remove group')).toBeDefined();
  });

  it('opens no group menu in read-only mode', () => {
    const { rightClickAt } = renderCanvas({ readOnly: true });

    rightClickAt({ x: GROUP.x + 40, y: GROUP.y + GROUP.height - 40 });

    expect(screen.queryByText('Remove group')).toBeNull();
    expect(screen.queryByText('Tidy this group')).toBeNull();
  });

  it('offers Select members and Rename as well, through the same menu', () => {
    const { rightClickAt, onSelectionChange } = renderCanvas({ controlled: false });

    rightClickAt({ x: GROUP.x + 40, y: GROUP.y + GROUP.height - 40 });
    expect(screen.getByText('Rename')).toBeDefined();
    fireEvent.click(screen.getByText('Select members'));

    expect(onSelectionChange).toHaveBeenCalledWith({
      elementIds: ['a1'],
      connectionIds: [],
      domainGroups: [],
    });
  });

  it('"Rename" starts the inline label editor, like a double-click on the pill', () => {
    const { actions, rightClickAt } = renderCanvas();

    rightClickAt({ x: GROUP.x + 40, y: GROUP.y + GROUP.height - 40 });
    fireEvent.click(screen.getByText('Rename'));

    const input = screen.getByLabelText('Domain group name') as HTMLInputElement;
    expect(input.value).toBe('Core');
    fireEvent.change(input, { target: { value: 'Kern' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(actions.renameDomainGroup).toHaveBeenCalledWith('Core', 'Kern');
  });

  it('shows the settings in the panel it opens, naming the group', () => {
    const { rightClickAt } = renderCanvas({ onTidyGroup: vi.fn() });

    rightClickAt({ x: GROUP.x + 40, y: GROUP.y + GROUP.height - 40 });
    fireEvent.click(screen.getByText('Tidy this group'));

    expect(screen.getByText('Direction')).toBeDefined();
    expect(screen.getByText('Density')).toBeDefined();
    expect(screen.getByText('Tidy Core', { selector: 'button' })).toBeDefined();
  });

  it('reports group setting changes separately from the board settings', () => {
    const onGroupTidyOptionsChange = vi.fn();
    const { rightClickAt } = renderCanvas({
      onTidyGroup: vi.fn(),
      onGroupTidyOptionsChange,
    });

    rightClickAt({ x: GROUP.x + 40, y: GROUP.y + GROUP.height - 40 });
    fireEvent.click(screen.getByText('Tidy this group'));
    fireEvent.click(screen.getByText('Compact'));

    expect(onGroupTidyOptionsChange).toHaveBeenCalledWith({
      ...DEFAULT_TIDY_OPTIONS,
      density: 'compact',
    });
  });

  it('does not offer pin group placements on a single group', () => {
    const { rightClickAt } = renderCanvas({ onTidyGroup: vi.fn() });

    rightClickAt({ x: GROUP.x + 40, y: GROUP.y + GROUP.height - 40 });
    fireEvent.click(screen.getByText('Tidy this group'));

    // A per-group tidy already leaves the box where it is.
    expect(screen.queryByLabelText('Pin group placements')).toBeNull();
  });
});

/**
 * Group colour, after creation. A colour picked in the palette tray has to be
 * changeable, or the first wrong guess is permanent — and right-click is where a
 * group's other edits (rename, tidy, remove) already live.
 */
describe('Layer7Canvas — group colour', () => {
  const openColorPicker = (rightClickAt: (p: { x: number; y: number }) => void) => {
    rightClickAt({ x: GROUP.x + 40, y: GROUP.y + GROUP.height - 40 });
    fireEvent.click(screen.getByText('Group colour…'));
  };

  it('writes the picked colour onto that group and nothing else', () => {
    const { actions, rightClickAt } = renderCanvas();
    openColorPicker(rightClickAt);

    fireEvent.change(screen.getByLabelText('Domain group colour'), {
      target: { value: '#2f6fdb' },
    });

    expect(actions.upsertDomainGroup).toHaveBeenCalledWith({ ...GROUP, color: '#2f6fdb' });
  });

  it('shows the colour the group already has', () => {
    const { rightClickAt } = renderCanvas({ groupColor: '#2f6fdb' });
    openColorPicker(rightClickAt);

    expect((screen.getByLabelText('Domain group colour') as HTMLInputElement).value).toBe(
      '#2f6fdb',
    );
  });

  /**
   * Clearing must leave the key ABSENT, not present-and-undefined: the mapper
   * turns a present `color` into a DTO null, and absent-means-inherit is what
   * makes the group fall back to the theme.
   */
  it('clears back to inherit without leaving an empty colour behind', () => {
    const { actions, rightClickAt } = renderCanvas({ groupColor: '#2f6fdb' });
    openColorPicker(rightClickAt);

    fireEvent.click(screen.getByLabelText('Clear group colour'));

    expect(actions.upsertDomainGroup).toHaveBeenCalledWith(GROUP);
    const [written] = (actions.upsertDomainGroup as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [Record<string, unknown>];
    expect('color' in written).toBe(false);
  });

  it('tints the box and its label, and leaves an uncoloured group neutral', () => {
    renderCanvas({ groupColor: '#2f6fdb' });
    const box = screen.getByTestId('lv-domain-group');
    expect(box.style.borderColor).toBe('rgb(47, 111, 219)');
    expect(box.style.backgroundColor).not.toBe('');
    cleanup();

    renderCanvas();
    expect(screen.getByTestId('lv-domain-group').style.borderColor).not.toBe('rgb(47, 111, 219)');
  });

  /** A decoration is never worth taking the canvas down for. */
  it('degrades a colour it cannot parse instead of throwing', () => {
    expect(() => renderCanvas({ groupColor: 'not-a-colour' })).not.toThrow();
    expect(screen.getByTestId('lv-domain-group')).toBeDefined();
  });

  it('offers no colour entry in read-only mode (only the canvas navigation items remain)', () => {
    const { rightClickAt } = renderCanvas({ readOnly: true });
    rightClickAt({ x: GROUP.x + 40, y: GROUP.y + GROUP.height - 40 });
    expect(screen.queryByText('Group colour…')).toBeNull();
    expect(screen.queryByRole('menu', { name: 'Domain group menu' })).toBeNull();
    // A read-only viewer still gets Select all / Fit view for the canvas.
    expect(screen.getByRole('menu', { name: 'Canvas menu' })).toBeDefined();
    expect(screen.getByText('Fit view')).toBeDefined();
    expect(screen.queryByText('Add domain group here')).toBeNull();
  });
});

/**
 * Selecting a group works off the SAME click-through + containment hit-test as
 * the menu above: a left-click inside the box lands on the pane, and the canvas
 * resolves which group it fell in. That is what makes a group as selectable —
 * and as deletable — as a node.
 */
describe('Layer7Canvas — domain-group selection', () => {
  it('selects the group a pane click landed inside', () => {
    const { clickAt, onSelectionChange } = renderCanvas();

    clickAt({ x: GROUP.x + 40, y: GROUP.y + GROUP.height - 40 });

    expect(onSelectionChange).toHaveBeenCalledWith({
      elementIds: [],
      connectionIds: [],
      domainGroups: ['Core'],
    });
  });

  it('clears the selection when the click lands on open landscape', () => {
    const { clickAt, onSelectionChange } = renderCanvas();

    clickAt({ x: GROUP.x + GROUP.width + 200, y: GROUP.y + GROUP.height + 200 });

    expect(onSelectionChange).toHaveBeenCalledWith({
      elementIds: [],
      connectionIds: [],
      domainGroups: [],
    });
  });

  it('selects from the label pill too (it swallows the pane click)', () => {
    const { onSelectionChange } = renderCanvas();

    // jsdom has no PointerEvent, so `fireEvent.pointerDown` would drop `button`
    // and the handler's left-button guard would bail. A MouseEvent typed
    // `pointerdown` carries it and still reaches React's listener.
    fireEvent(
      screen.getByLabelText('Domain group Core'),
      new MouseEvent('pointerdown', { button: 0, bubbles: true }),
    );

    expect(onSelectionChange).toHaveBeenCalledWith({
      elementIds: [],
      connectionIds: [],
      domainGroups: ['Core'],
    });
  });

  it('selects in read-only mode as well (selection drives the inspector, not an edit)', () => {
    const { clickAt, onSelectionChange } = renderCanvas({ readOnly: true });

    clickAt({ x: GROUP.x + 40, y: GROUP.y + GROUP.height - 40 });

    expect(onSelectionChange).toHaveBeenCalledWith({
      elementIds: [],
      connectionIds: [],
      domainGroups: ['Core'],
    });
  });

  // The other half of this story — React Flow clearing its own selection right
  // after a pane click, which must NOT clear the group that click just selected
  // — is covered as a unit in `selection.test.ts` (`mirrorGraphSelection`).

  it('marks the selected group on its label', () => {
    renderCanvas({
      selection: { elementIds: [], connectionIds: [], domainGroups: ['Core'] },
    });

    expect(screen.getByLabelText('Domain group Core').getAttribute('aria-pressed')).toBe('true');
  });
});
