// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { MultiSelectionInspector } from './MultiSelectionInspector';
import type { Selection } from './useEditorState';

afterEach(() => cleanup());

function renderInspector(selection: Selection) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <MultiSelectionInspector selection={selection} />
    </ThemeProvider>,
  );
}

describe('MultiSelectionInspector', () => {
  it('summarises a mixed selection with pluralised counts', () => {
    const { getByText } = renderInspector({
      elementIds: ['a1', 'a2'],
      connectionIds: ['c1'],
      domainGroups: [],
    });
    expect(getByText('3 selected')).toBeDefined();
    expect(getByText('2 elements · 1 connection')).toBeDefined();
  });

  it('uses singular nouns for a single item of each kind', () => {
    const { getByText } = renderInspector({
      elementIds: ['a1'],
      connectionIds: ['c1'],
      domainGroups: [],
    });
    expect(getByText('2 selected')).toBeDefined();
    expect(getByText('1 element · 1 connection')).toBeDefined();
  });

  it('omits the empty id space from the breakdown', () => {
    const { getByText } = renderInspector({
      elementIds: [],
      connectionIds: ['c1', 'c2'],
      domainGroups: [],
    });
    expect(getByText('2 selected')).toBeDefined();
    expect(getByText('2 connections')).toBeDefined();
  });

  it('counts selected domain groups alongside the content', () => {
    const { getByText } = renderInspector({
      elementIds: ['a1'],
      connectionIds: [],
      domainGroups: ['Core', 'Edge'],
    });
    expect(getByText('3 selected')).toBeDefined();
    expect(getByText('1 element · 2 domain groups')).toBeDefined();
  });
});

// ── Bulk edit (4B) ───────────────────────────────────────────────────────────

/**
 * The controls are deliberately WRITE-ONLY: a mixed selection has no single
 * current value, and a field showing the first element's would read as a form
 * rather than a switch. So these tests check what each control DOES, and that
 * every one of them lands as a single call over the whole selection.
 */
function bulkActions() {
  return {
    updateElements: vi.fn(),
    setDomainGroups: vi.fn(),
  };
}

const layer7 = {
  id: 'd1',
  kind: 'layer7' as const,
  name: 'L7',
  placements: [
    { elementId: 'a1', x: 0, y: 0, zone: 'landscape' as const, domainGroup: 'Core' },
    { elementId: 'a2', x: 0, y: 0, zone: 'landscape' as const },
    { elementId: 'a3', x: 0, y: 0, zone: 'actors' as const },
  ],
};

function renderBulk(overrides: {
  selection?: Selection;
  diagram?: typeof layer7;
  readOnly?: boolean;
} = {}) {
  const actions = bulkActions();
  const selection = overrides.selection ?? {
    elementIds: ['a1', 'a2'],
    connectionIds: [],
    domainGroups: [],
  };
  render(
    <ThemeProvider theme={createTheme()}>
      <MultiSelectionInspector
        selection={selection}
        diagram={'diagram' in overrides ? overrides.diagram : layer7}
        readOnly={overrides.readOnly}
        actions={actions as never}
      />
    </ThemeProvider>,
  );
  return { actions };
}

describe('MultiSelectionInspector — bulk edit', () => {
  it('sets the lifecycle on the whole selection in one call', () => {
    const { actions } = renderBulk();
    fireEvent.mouseDown(screen.getByLabelText('Lifecycle'));
    fireEvent.click(within(screen.getByRole('listbox')).getByText('Retiring'));
    expect(actions.updateElements).toHaveBeenCalledTimes(1);
    expect(actions.updateElements).toHaveBeenCalledWith(['a1', 'a2'], { lifecycle: 'retiring' });
  });

  it('sets the accent colour on the whole selection', () => {
    const { actions } = renderBulk();
    fireEvent.change(screen.getByLabelText('Accent colour for the selection'), {
      target: { value: '#ff0000' },
    });
    expect(actions.updateElements).toHaveBeenCalledWith(['a1', 'a2'], { accentColor: '#ff0000' });
  });

  it('sets the icon on the whole selection', () => {
    const { actions } = renderBulk();
    fireEvent.click(within(screen.getByRole('group', { name: 'Icon' })).getByLabelText('Database'));
    expect(actions.updateElements).toHaveBeenCalledWith(['a1', 'a2'], { iconKey: 'database' });
  });

  it('assigns a domain group to the landscape members only, in one undo step', () => {
    const { actions } = renderBulk({
      selection: { elementIds: ['a1', 'a2', 'a3'], connectionIds: [], domainGroups: [] },
    });
    const field = screen.getByLabelText('Domain group');
    fireEvent.mouseDown(field);
    fireEvent.click(within(screen.getByRole('listbox')).getByText('Core'));
    // 'a3' sits in the actors band, where a domain group means nothing.
    expect(actions.setDomainGroups).toHaveBeenCalledWith(['a1', 'a2'], 'Core');
  });

  it('offers no domain group on a container diagram — there are none there', () => {
    renderBulk({
      diagram: { ...layer7, kind: 'container' as unknown as 'layer7' },
    });
    expect(screen.queryByLabelText('Domain group')).toBeNull();
  });

  it('shows nothing mutating in read-only mode', () => {
    renderBulk({ readOnly: true });
    expect(screen.queryByText('APPLY TO ALL')).toBeNull();
    expect(screen.queryByLabelText('Lifecycle')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Icon' })).toBeNull();
  });

  it('shows nothing mutating when the selection holds no elements', () => {
    renderBulk({ selection: { elementIds: [], connectionIds: ['c1', 'c2'], domainGroups: [] } });
    expect(screen.queryByText('APPLY TO ALL')).toBeNull();
  });

  it('keeps working as a plain summary when no actions are wired', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <MultiSelectionInspector
          selection={{ elementIds: ['a1', 'a2'], connectionIds: [], domainGroups: [] }}
        />
      </ThemeProvider>,
    );
    expect(screen.getByText('2 selected')).toBeDefined();
    expect(screen.queryByText('APPLY TO ALL')).toBeNull();
  });
});
