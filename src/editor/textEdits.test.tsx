// @vitest-environment jsdom
/**
 * A typed sentence is one undo step (ADR-0002, step 8).
 *
 * Every keystroke still reaches the model — the card on the canvas is drawn
 * from it, and a name that does not appear while you type it is worse than any
 * undo behaviour — but the run of them is one step, because typing a name is
 * one decision and not eleven. `fieldEdit` in `model/commands.ts` is the key
 * that says so; this is what it buys, through the real inspector.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { HostedEditor } from './testing/editorHost';
import type { EditorHostState, HostedEditorProps } from './testing/editorHost';
import { installReactFlowMocks } from './reactFlowTestSetup';
import type { DesignModel } from '../model/types';

beforeAll(() => { installReactFlowMocks(); });
afterEach(() => cleanup());

function model(): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: [
      { id: 'a1', kind: 'application', name: 'Webshop', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'b1', kind: 'application', name: 'Orders', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
    ],
    connections: [{ id: 'c1', sourceId: 'a1', targetId: 'b1', isBidirectional: false }],
    diagrams: [{
      id: 'd1', kind: 'layer7', name: 'L7',
      placements: [
        { elementId: 'a1', zone: 'landscape', x: 400, y: 300 },
        { elementId: 'b1', zone: 'landscape', x: 800, y: 300 },
      ],
    }],
  };
}

function renderEditor() {
  const host = { current: undefined as unknown as EditorHostState };
  const props: HostedEditorProps = {
    model: model(),
    activeDiagramId: 'd1',
    onActiveDiagramChange: vi.fn(),
    onCreateContainerDiagram: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
  };
  render(
    <ThemeProvider theme={createTheme()}>
      <div style={{ width: '1200px', height: '800px' }}>
        <HostedEditor {...props} hostRef={host} />
      </div>
    </ThemeProvider>,
  );
  return { host };
}

const node = (id: string) => document.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement;
const inspector = () => screen.getByRole('complementary', { name: 'Inspector' });
const type = (field: HTMLElement, text: string) => {
  for (let i = 1; i <= text.length; i += 1) {
    fireEvent.change(field, { target: { value: text.slice(0, i) } });
  }
};

describe('typing into a field', () => {
  it('shows every keystroke on the card and takes the whole run back in one undo', () => {
    const { host } = renderEditor();
    fireEvent.click(node('a1'));
    const name = within(inspector()).getByLabelText('Name');

    type(name, 'Storefront');

    // Live in the model — that is what the canvas draws from.
    expect(host.current.model.elements[0].name).toBe('Storefront');
    expect(host.current.commands).toHaveLength('Storefront'.length);

    // …and one step, not ten.
    act(() => host.current.history.undo());
    expect(host.current.model.elements[0].name).toBe('Webshop');
    expect(host.current.history.canUndo).toBe(false);
  });

  it('redoes the whole sentence too', () => {
    const { host } = renderEditor();
    fireEvent.click(node('a1'));
    type(within(inspector()).getByLabelText('Name'), 'Storefront');

    act(() => host.current.history.undo());
    act(() => host.current.history.redo());
    expect(host.current.model.elements[0].name).toBe('Storefront');
  });

  it('keeps two fields apart: each is its own step', () => {
    const { host } = renderEditor();
    fireEvent.click(node('a1'));
    type(within(inspector()).getByLabelText('Name'), 'Storefront');
    type(within(inspector()).getByLabelText('Vendor'), 'Acme BV');

    act(() => host.current.history.undo());
    expect(host.current.model.elements[0].vendor).toBeUndefined();
    expect(host.current.model.elements[0].name).toBe('Storefront');

    act(() => host.current.history.undo());
    expect(host.current.model.elements[0].name).toBe('Webshop');
  });

  it('keeps the same field on two elements apart', () => {
    const { host } = renderEditor();
    fireEvent.click(node('a1'));
    type(within(inspector()).getByLabelText('Name'), 'Storefront');
    fireEvent.click(node('b1'));
    type(within(inspector()).getByLabelText('Name'), 'Order service');

    act(() => host.current.history.undo());
    expect(host.current.model.elements[1].name).toBe('Orders');
    expect(host.current.model.elements[0].name).toBe('Storefront');
  });

  it('starts a new step when something else happens in between', () => {
    const { host } = renderEditor();
    fireEvent.click(node('a1'));
    const name = () => within(inspector()).getByLabelText('Name');
    type(name(), 'Store');
    // A change of a different kind: the run is over.
    fireEvent.click(within(inspector()).getByRole('checkbox', { name: 'Managed' }));
    type(name(), 'Storefront');

    act(() => host.current.history.undo());
    expect(host.current.model.elements[0].name).toBe('Store');
  });

  it('does the same for a connection label', () => {
    const { host } = renderEditor();
    fireEvent.click(screen.getByTestId('rf__edge-c1'));
    type(within(inspector()).getByLabelText('Label'), 'Sends orders');

    expect(host.current.model.connections[0].label).toBe('Sends orders');
    act(() => host.current.history.undo());
    expect(host.current.model.connections[0].label).toBeUndefined();
    expect(host.current.history.canUndo).toBe(false);
  });
});
