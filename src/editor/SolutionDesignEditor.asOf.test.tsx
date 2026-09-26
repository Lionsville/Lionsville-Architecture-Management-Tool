// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Looking at another day, and saving a day onto a board (ADR-0027).
 *
 * What is pinned: moving the date control sends the host nothing — the board
 * is drawn on that day and the bar says it is only this window's — and *Save*
 * is the one write, as one command. A board saved on a day opens on it, and
 * saving "today" over it clears the day with the key present, which is how a
 * patch says clear. A reader may look; a reader is not offered *Save*.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { HostedEditor } from './testing/editorHost';
import type { EditorHostState, HostedEditorProps } from './testing/editorHost';
import { installReactFlowMocks } from './reactFlowTestSetup';
import type { DesignDiagram, DesignModel } from '../model/types';

beforeAll(() => installReactFlowMocks());
afterEach(() => cleanup());

function model(board: Partial<DesignDiagram> = {}): DesignModel {
  return {
    name: 'Landscape',
    diagrams: [{ id: 'd1', kind: 'layer7', name: 'Board', members: [], geometry: { nodes: [] }, ...board }],
    elements: [],
    relations: [],
  };
}

function renderEditor(document: DesignModel, overrides: Partial<HostedEditorProps> = {}) {
  const host = { current: undefined as unknown as EditorHostState };
  render(
    <ThemeProvider theme={createTheme()}>
      <HostedEditor
        model={document}
        activeDiagramId="d1"
        onActiveDiagramChange={vi.fn()}
        onCreateContainerDiagram={vi.fn()}
        onCreateLayer7Diagram={vi.fn()}
        {...overrides}
        hostRef={host}
      />
    </ThemeProvider>,
  );
  return host;
}

// `hidden`: an open popover hides the bar under it from the accessibility tree.
const control = () => screen.getByRole('button', { name: 'Showing', hidden: true });
const dateField = () => document.querySelector('input[type="date"]') as HTMLInputElement;
const asOfWrites = (host: { current: EditorHostState }) => host.current.commands.filter(
  (command) => command.type === 'diagram.update' && 'asOf' in command.patch,
);

describe('the date control', () => {
  it('looks at another day without sending the host anything', () => {
    const host = renderEditor(model());
    fireEvent.click(control());
    act(() => { fireEvent.change(dateField(), { target: { value: '2028-01-01' } }); });
    act(() => { fireEvent.change(dateField(), { target: { value: '2028-02-01' } }); });

    expect(asOfWrites(host)).toEqual([]);
    expect(host.current.model.diagrams[0]?.asOf).toBeUndefined();
    expect(control().textContent).toContain('2028-02-01');
    expect(control().getAttribute('data-looking')).toBe('true');
    expect(screen.getByText('Only you see this day. Nothing is saved until you save it.')).toBeDefined();
  });

  it('saves the day on screen onto the board as one command, and stops looking', () => {
    const host = renderEditor(model());
    fireEvent.click(control());
    act(() => { fireEvent.change(dateField(), { target: { value: '2028-01-01' } }); });
    fireEvent.click(screen.getByRole('button', { name: 'Save 2028-01-01 as this board’s day' }));

    expect(asOfWrites(host)).toHaveLength(1);
    expect(host.current.model.diagrams[0]?.asOf).toBe('2028-01-01');
    expect(control().textContent).toContain('2028-01-01');
    expect(control().getAttribute('data-looking')).toBeNull();
  });

  it('opens a dated board on its day, and saves today over it as a clear', () => {
    const host = renderEditor(model({ asOf: '2027-06-01' }));
    expect(control().textContent).toContain('2027-06-01');
    expect(control().getAttribute('data-looking')).toBeNull();

    fireEvent.click(control());
    fireEvent.click(screen.getByRole('button', { name: 'Show today' }));
    expect(control().textContent).toContain('Today');
    expect(control().getAttribute('data-looking')).toBe('true');
    expect(asOfWrites(host)).toEqual([]);

    fireEvent.click(control());
    fireEvent.click(screen.getByRole('button', { name: 'Save: this board shows today' }));
    const [cleared] = asOfWrites(host);
    expect(cleared).toMatchObject({ type: 'diagram.update', id: 'd1' });
    expect(cleared && 'patch' in cleared && 'asOf' in cleared.patch).toBe(true);
    expect(host.current.model.diagrams[0]?.asOf).toBeUndefined();
  });

  it('goes back to the board\'s own day, and forgets the look', () => {
    renderEditor(model({ asOf: '2027-06-01' }));
    fireEvent.click(control());
    act(() => { fireEvent.change(dateField(), { target: { value: '2029-01-01' } }); });
    fireEvent.click(screen.getByRole('button', { name: 'Back to 2027-06-01' }));
    expect(control().textContent).toContain('2027-06-01');
    expect(control().getAttribute('data-looking')).toBeNull();
  });

  it('lets a reader look, and offers a reader no save', () => {
    const host = renderEditor(model(), { readOnly: true });
    fireEvent.click(control());
    act(() => { fireEvent.change(dateField(), { target: { value: '2028-01-01' } }); });
    expect(control().textContent).toContain('2028-01-01');
    expect(screen.queryByRole('button', { name: /^Save/ })).toBeNull();
    expect(asOfWrites(host)).toEqual([]);
  });
});
