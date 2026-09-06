// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { DEFAULT_TIDY_OPTIONS, type TidyOptions } from '../layout/tidy';
import type { DesignDiagram } from '../model/types';
import type { EditorActions } from './useEditorState';
import { DomainGroupInspector } from './DomainGroupInspector';

afterEach(() => cleanup());

const diagram: DesignDiagram = {
  id: 'd1',
  kind: 'layer7',
  name: 'L7',
  placements: [
    { elementId: 'm1', zone: 'landscape', domainGroup: 'Core', x: 0, y: 0 },
    { elementId: 'm2', zone: 'landscape', domainGroup: 'Core', x: 10, y: 10 },
    { elementId: 'out', zone: 'landscape', x: 900, y: 900 },
  ],
  layoutConfig: { domainGroups: [{ name: 'Core', x: 0, y: 0, width: 300, height: 200 }] },
};

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

describe('DomainGroupInspector', () => {
  it('counts the members of the group', () => {
    renderInspector();
    expect(screen.getByText('2 elements inside')).toBeDefined();
  });

  it('removes the group — the obvious target the right-click menu never was', () => {
    const { actions } = renderInspector();

    fireEvent.click(screen.getByText('Remove group'));

    expect(actions.removeDomainGroup).toHaveBeenCalledWith('Core');
  });

  it('renames on blur, not on every keystroke (a rename rewrites every member)', () => {
    const { actions } = renderInspector();
    const field = screen.getByLabelText('Name');

    fireEvent.change(field, { target: { value: 'Platform' } });
    expect(actions.renameDomainGroup).not.toHaveBeenCalled();

    fireEvent.blur(field);
    expect(actions.renameDomainGroup).toHaveBeenCalledWith('Core', 'Platform');
  });

  it('does not fire a rename when the name came back unchanged', () => {
    const { actions } = renderInspector();

    fireEvent.blur(screen.getByLabelText('Name'));

    expect(actions.renameDomainGroup).not.toHaveBeenCalled();
  });

  /**
   * The panel offers the SAME tidy controls as the group's right-click menu —
   * direction, density, manual routes and a named Apply — not just a bare
   * "tidy it now" button. Same settings state behind both, so switching entry
   * point never changes how the group gets laid out.
   */
  it('offers the full tidy settings, and applies them to this group', () => {
    const onTidy = vi.fn();
    renderInspector({ onTidy });

    expect(screen.getByText('Direction')).toBeDefined();
    expect(screen.getByText('Density')).toBeDefined();
    expect(screen.getByText('Pin anchor points')).toBeDefined();

    fireEvent.click(screen.getByText('Tidy Core', { selector: 'button' }));
    expect(onTidy).toHaveBeenCalledWith('Core');
  });

  it('reports a settings change up, so both entry points stay in step', () => {
    const onTidyOptionsChange = vi.fn();
    renderInspector({ onTidy: vi.fn(), onTidyOptionsChange });

    fireEvent.click(screen.getByText('Compact'));

    expect(onTidyOptionsChange).toHaveBeenCalledWith({
      ...DEFAULT_TIDY_OPTIONS,
      density: 'compact',
    });
  });

  it('leaves out pin-group-placements (a per-group tidy never moves the box)', () => {
    renderInspector({ onTidy: vi.fn() });

    expect(screen.queryByText('Pin group placements')).toBeNull();
  });

  it('shows no edit actions read-only', () => {
    renderInspector({ readOnly: true, onTidy: vi.fn() });

    expect(screen.queryByText('Remove group')).toBeNull();
    expect(screen.queryByText('Direction')).toBeNull();
    expect(screen.getByLabelText('Name').hasAttribute('disabled')).toBe(true);
  });
});
