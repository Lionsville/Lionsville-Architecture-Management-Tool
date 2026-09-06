// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { HostedEditor } from './testing/editorHost';
import type { EditorHostState, HostedEditorProps } from './testing/editorHost';
import { installReactFlowMocks } from './reactFlowTestSetup';
import type { DesignModel } from '../model/types';

/**
 * The two deletes that used to happen in silence: one connection, and a whole
 * multi-selection. Both were one keystroke from removing model content with
 * nothing on screen to say so. `model/deletion.test.ts` pins the counting and
 * the rule; this pins the wiring — every entry point reaches the same dialog,
 * Cancel really cancels, and a single element still gets its own richer dialog.
 */

beforeAll(() => installReactFlowMocks());
afterEach(() => cleanup());

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
      },
    ],
    elements: [
      { id: 'a1', kind: 'application', name: 'Webshop', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'b1', kind: 'externalSystem', name: 'Carrier', lifecycle: 'live', isManaged: false, aspects: {}, parameters: {} },
    ],
    connections: [
      { id: 'c1', sourceId: 'a1', targetId: 'b1', label: 'Sends orders', isBidirectional: false },
    ],
  };
}

function renderEditor(overrides: Partial<HostedEditorProps> = {}) {
  const host = { current: undefined as unknown as EditorHostState };
  const props: HostedEditorProps = {
    model: model(),
    activeDiagramId: 'd1',
    onActiveDiagramChange: vi.fn(),
    onCreateContainerDiagram: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
    ...overrides,
  };
  const view = render(
    <ThemeProvider theme={createTheme()}>
      <div style={{ width: '1200px', height: '800px' }}>
        <HostedEditor {...props} hostRef={host} />
      </div>
    </ThemeProvider>,
  );
  /** What the last step asked for, flattened. */
  const asked = () => {
    const last = host.current.commands.at(-1);
    if (!last) return [];
    return last.type === 'transaction' ? last.commands : [last];
  };
  return { ...view, host, asked };
}

const nodeEl = (id: string) => document.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement;
const dialog = () => screen.getByRole('dialog');
const confirm = () => fireEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }));

describe('SolutionDesignEditor — confirming a connection delete', () => {
  it('the line menu asks first, and Cancel keeps the line', () => {
    const { host } = renderEditor();

    fireEvent.contextMenu(screen.getByTestId('rf__edge-c1'));
    fireEvent.click(within(screen.getByRole('menu', { name: 'Connection menu' })).getByText('Delete connection'));

    expect(within(dialog()).getByText(/Sends orders/)).toBeDefined();
    expect(host.current.commands).toEqual([]);

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(host.current.commands).toEqual([]);
  });

  it('confirming deletes the connection', () => {
    const { host } = renderEditor();

    fireEvent.contextMenu(screen.getByTestId('rf__edge-c1'));
    fireEvent.click(within(screen.getByRole('menu', { name: 'Connection menu' })).getByText('Delete connection'));
    confirm();

    expect(host.current.model.connections).toEqual([]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the Delete key on a selected connection asks too', () => {
    const { host } = renderEditor();

    fireEvent.click(screen.getByTestId('rf__edge-c1'));
    fireEvent.keyDown(screen.getByText('ACTORS'), { key: 'Delete' });

    expect(within(dialog()).getByText(/Sends orders/)).toBeDefined();
    expect(host.current.commands).toEqual([]);
  });

  it("the inspector's Delete connection button asks too", () => {
    renderEditor();

    fireEvent.click(screen.getByTestId('rf__edge-c1'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete connection' }));

    expect(within(dialog()).getByText(/Sends orders/)).toBeDefined();
  });
});

describe('SolutionDesignEditor — confirming a multi-delete', () => {
  it('names what goes, and deletes it in one step once confirmed', () => {
    const { host, asked } = renderEditor();

    // Select all: two elements and the line between them.
    fireEvent.contextMenu(document.querySelector('.react-flow__pane') as HTMLElement, {
      clientX: 700,
      clientY: 500,
    });
    fireEvent.click(within(screen.getByRole('menu', { name: 'Canvas menu' })).getByText('Select all'));

    fireEvent.keyDown(screen.getByText('ACTORS'), { key: 'Delete' });
    expect(within(dialog()).getByText(/2 elements and 1 connection/)).toBeDefined();
    expect(host.current.commands).toEqual([]);

    confirm();
    // One step: the two elements go, and the line goes with them rather than
    // being asked for a second time.
    expect(host.current.commands).toHaveLength(1);
    expect(asked().map((c) => c.type)).toEqual(['element.delete', 'element.delete']);
    expect(host.current.model.elements).toEqual([]);
    expect(host.current.model.connections).toEqual([]);
  });

  it('the selection menu reaches the same confirmation', () => {
    const { host } = renderEditor();

    fireEvent.contextMenu(document.querySelector('.react-flow__pane') as HTMLElement, {
      clientX: 700,
      clientY: 500,
    });
    fireEvent.click(within(screen.getByRole('menu', { name: 'Canvas menu' })).getByText('Select all'));

    fireEvent.contextMenu(nodeEl('a1'));
    fireEvent.click(within(screen.getByRole('menu', { name: 'Selection menu' })).getByText('Delete'));

    expect(within(dialog()).getByText(/2 elements and 1 connection/)).toBeDefined();
    expect(host.current.commands).toEqual([]);
  });

  it('leaves a single element to its own dialog, which asks a better question', () => {
    renderEditor();

    fireEvent.click(nodeEl('a1'));
    fireEvent.keyDown(screen.getByText('ACTORS'), { key: 'Delete' });

    // The remove-or-delete dialog, not the confirmation.
    expect(within(dialog()).getByRole('button', { name: 'Remove from diagram' })).toBeDefined();
    expect(within(dialog()).getByRole('button', { name: 'Delete from model' })).toBeDefined();
  });
});
