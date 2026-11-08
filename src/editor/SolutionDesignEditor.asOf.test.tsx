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
import { formatDay } from '../i18n/dates';

/** A day as the bar says it: the way the rest of the screen does (`formatDay`). */
const day = (value: string) => formatDay(value, 'en');

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
const control = () => screen.getByRole('button', { name: /^Day/, hidden: true });
const dateField = () => document.querySelector('input[data-date]') as HTMLInputElement;
const asOfWrites = (host: { current: EditorHostState }) => host.current.commands.filter(
  (command) => command.type === 'diagram.update' && 'asOf' in command.patch,
);
const look = (value: string) => {
  fireEvent.click(control());
  fireEvent.click(screen.getByRole('menuitem', { name: 'Choose a day…' }));
  act(() => { fireEvent.change(dateField(), { target: { value } }); });
  fireEvent.click(screen.getByRole('button', { name: 'Show this day' }));
};

describe('the date control', () => {
  it('looks at another day without sending the host anything', () => {
    const host = renderEditor(model());
    look('2028-01-01');
    look('2028-02-01');
    expect(asOfWrites(host)).toEqual([]);
    expect(host.current.model.diagrams[0]?.asOf).toBeUndefined();
    expect(control().textContent).toContain(day('2028-02-01'));
  });

  it('says what a day is and is not, where it is typed', () => {
    renderEditor(model());
    fireEvent.click(control());
    fireEvent.click(screen.getByRole('menuitem', { name: 'Choose a day…' }));
    expect(screen.getByText(/Drawn from today’s model using its dates/)).toBeTruthy();
  });

  it('offers the days worth looking at', () => {
    renderEditor({ ...model(), elements: [{ id: 'e', kind: 'application', name: 'Yard', lifecycle: 'planned', isManaged: true, aspects: {}, lifecycleDates: { live: '2031-03-01' } }] } as DesignModel);
    fireEvent.click(control());
    fireEvent.click(screen.getByText(`Yard goes live · ${day('2031-03-01')}`));
    expect(control().textContent).toContain(day('2031-03-01'));
  });

  it('opens a dated board on its day, says so on its tab, and today is a look like any other', () => {
    const host = renderEditor(model({ asOf: '2027-06-01' }));
    expect(control().textContent).toContain(day('2027-06-01'));
    expect(document.querySelector('[data-look-edge]')).toBeNull();
    fireEvent.click(control());
    fireEvent.click(screen.getByText('Today'));
    expect(control().textContent).toBe('Day');
    expect(document.querySelector('[data-look-edge]')).not.toBeNull();
    expect(asOfWrites(host)).toEqual([]);
  });

  it('forgets the look on arriving at the board\'s own day', () => {
    renderEditor(model({ asOf: '2027-06-01' }));
    look('2029-01-01');
    expect(document.querySelector('[data-look-edge]')).not.toBeNull();
    look('2027-06-01');
    expect(document.querySelector('[data-look-edge]')).toBeNull();
  });

  it('puts edits away while looking and draws the edge; a view saved on its day stays editable (ADR-0027, amended)', () => {
    renderEditor(model({ asOf: '2027-01-01' }));
    // On the board's own day it is an ordinary board.
    expect(screen.queryByRole('button', { name: 'Arrange', hidden: true })).not.toBeNull();
    expect(document.querySelector('[data-guide="board.palette"]')).not.toBeNull();
    look('2028-03-01');
    expect(screen.queryByRole('button', { name: 'Arrange', hidden: true })).toBeNull();
    expect(document.querySelector('[data-guide="board.palette"]')).toBeNull();
    expect(document.querySelector('[data-look-edge]')).not.toBeNull();
    look('2027-01-01');
    expect(screen.queryByRole('button', { name: 'Arrange', hidden: true })).not.toBeNull();
    expect(document.querySelector('[data-guide="board.palette"]')).not.toBeNull();
  });

  it('lets a reader look', () => {
    const host = renderEditor(model(), { readOnly: true });
    look('2028-01-01');
    expect(control().textContent).toContain(day('2028-01-01'));
    expect(asOfWrites(host)).toEqual([]);
  });
});
