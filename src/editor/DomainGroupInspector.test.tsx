// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { laidOut } from '../model/testFixtures';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { DEFAULT_TIDY_OPTIONS, type TidyOptions } from '../layout/tidy';
import type { DesignDiagram } from '../model/types';
import type { EditorActions } from './useEditorState';
import { DomainGroupInspector } from './DomainGroupInspector';

afterEach(() => cleanup());

const diagram: DesignDiagram = laidOut({
  id: 'd1',
  kind: 'layer7',
  name: 'L7',
  placements: [
    { id: 'm1', zone: 'landscape', group: 'Core', x: 0, y: 0 },
    { id: 'm2', zone: 'landscape', group: 'Core', x: 10, y: 10 },
    { id: 'out', zone: 'landscape', x: 900, y: 900 },
  ],
  layoutConfig: { domainGroups: [{ id: 'Core', x: 0, y: 0, width: 300, height: 200 }] },
});

function renderInspector(
  overrides: {
    readOnly?: boolean;
    onTidy?: (name: string) => void;
    onTidyOptionsChange?: (options: TidyOptions) => void;
  } = {},
) {
  const actions = {
    renameDomainGroup: vi.fn(),
    removeDomainGroup: vi.fn(),
  } as unknown as EditorActions;
  render(
    <ThemeProvider theme={createTheme()}>
      <DomainGroupInspector
        name="Core"
        diagram={diagram}
        readOnly={overrides.readOnly ?? false}
        actions={actions}
        onTidy={overrides.onTidy}
        tidyOptions={DEFAULT_TIDY_OPTIONS}
        onTidyOptionsChange={overrides.onTidyOptionsChange ?? vi.fn()}
      />
    </ThemeProvider>,
  );
  return { actions };
}

const MORE = 'More';

describe('DomainGroupInspector', () => {
  const tidy = () => fireEvent.click(screen.getByRole('tab', { name: 'Tidy group' }));

  it('counts the members of the group', () => {
    renderInspector();
    expect(screen.getByText('2 elements inside')).toBeDefined();
  });

  it('removes the group from the end of ⋯, where every panel keeps its removing', () => {
    const { actions } = renderInspector();
    fireEvent.click(screen.getByRole('button', { name: MORE }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove group' }));
    expect(actions.removeDomainGroup).toHaveBeenCalledWith('Core');
  });

  it('renames when the typing ends, not on every keystroke (a rename rewrites every member)', () => {
    const { actions } = renderInspector();
    fireEvent.click(screen.getByRole('button', { name: /Change the name/ }));
    const field = screen.getByRole('textbox', { name: 'Change the name' });
    fireEvent.change(field, { target: { value: 'Commerce' } });
    expect(actions.renameDomainGroup).not.toHaveBeenCalled();
    fireEvent.blur(field);
    expect(actions.renameDomainGroup).toHaveBeenCalledWith('Core', 'Commerce');
  });

  it('does not fire a rename when the name came back unchanged', () => {
    const { actions } = renderInspector();
    fireEvent.click(screen.getByRole('button', { name: /Change the name/ }));
    fireEvent.blur(screen.getByRole('textbox', { name: 'Change the name' }));
    expect(actions.renameDomainGroup).not.toHaveBeenCalled();
  });

  it('reads as the name the board prints, never as the id its placements hold', () => {
    const named = laidOut({ id: 'd1', kind: 'layer7', name: 'L7', groups: [{ id: 'order-to-delivery', name: 'Order to delivery' }], placements: [] });
    render(
      <ThemeProvider theme={createTheme()}>
        <DomainGroupInspector name="order-to-delivery" diagram={named} readOnly actions={{} as EditorActions} tidyOptions={DEFAULT_TIDY_OPTIONS} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Order to delivery' })).toBeDefined();
    expect(screen.queryByText('order-to-delivery')).toBeNull();
  });

  it('offers the full tidy settings, and applies them to this group', () => {
    const onTidy = vi.fn();
    renderInspector({ onTidy });
    tidy();
    fireEvent.click(screen.getByRole('button', { name: 'Tidy Core' }));
    expect(onTidy).toHaveBeenCalledWith('Core');
  });

  it('reports a settings change up, so both entry points stay in step', () => {
    const onTidyOptionsChange = vi.fn();
    renderInspector({ onTidy: vi.fn(), onTidyOptionsChange });
    tidy();
    fireEvent.click(screen.getByText('Compact'));
    expect(onTidyOptionsChange).toHaveBeenCalledWith({ ...DEFAULT_TIDY_OPTIONS, density: 'compact' });
  });

  it('leaves out pin-group-placements (a per-group tidy never moves the box)', () => {
    renderInspector({ onTidy: vi.fn() });
    tidy();
    expect(screen.queryByLabelText(/pin group/i)).toBeNull();
  });

  it('shows no edit actions read-only', () => {
    renderInspector({ readOnly: true, onTidy: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Remove group' })).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('button', { name: /Change the name/ })).toBeNull();
  });
});
