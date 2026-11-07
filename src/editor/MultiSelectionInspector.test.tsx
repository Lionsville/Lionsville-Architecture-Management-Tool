// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { laidOut } from '../model/testFixtures';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { MultiSelectionInspector } from './MultiSelectionInspector';
import type { Selection } from './useEditorState';
import type { DesignElement, DesignModel } from '../model/types';

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
    expect(getByText('2 elements, 1 connection')).toBeDefined();
  });

  it('uses singular nouns for a single item of each kind', () => {
    const { getByText } = renderInspector({
      elementIds: ['a1'],
      connectionIds: ['c1'],
      domainGroups: [],
    });
    expect(getByText('2 selected')).toBeDefined();
    expect(getByText('1 element, 1 connection')).toBeDefined();
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
    expect(getByText('1 element, 2 domain groups')).toBeDefined();
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
    fileUnderGroupNamed: vi.fn(),
  };
}

const layer7 = laidOut({
  id: 'd1',
  kind: 'layer7' as const,
  name: 'L7',
  groups: [{ id: 'core', name: 'Core' }],
  placements: [
    { id: 'a1', x: 0, y: 0, zone: 'landscape' as const, group: 'core' },
    { id: 'a2', x: 0, y: 0, zone: 'landscape' as const },
    { id: 'a3', x: 0, y: 0, zone: 'actors' as const },
  ],
});

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

const held = (id: string, over: Partial<DesignElement> = {}): DesignElement => ({ id, kind: 'application', name: id.toUpperCase(), lifecycle: 'live', isManaged: false, aspects: {}, ...over });

function renderFull(selection: Selection, over: { model?: Partial<DesignModel>; onSelectionChange?: (next: Selection) => void; onRequestDelete?: (next: Selection) => void } = {}) {
  const actions = { updateElements: vi.fn(), updateConnections: vi.fn(), fileUnderGroupNamed: vi.fn(), removeFromDiagram: vi.fn() };
  const model: DesignModel = {
    name: 'M', diagrams: [layer7], elements: [held('a1'), held('a2', { lifecycle: 'retiring' }), held('a3')],
    relations: [
      { id: 'c1', type: 'flow', sourceId: 'a1', targetId: 'a2', isBidirectional: false, protocol: 'HTTPS' },
      { id: 'c2', type: 'flow', sourceId: 'a2', targetId: 'a3', isBidirectional: false, protocol: 'HTTPS', technology: 'Kafka' },
    ],
    ...over.model,
  };
  render(
    <ThemeProvider theme={createTheme()}>
      <MultiSelectionInspector selection={selection} model={model} diagram={layer7} actions={actions as never} onSelectionChange={over.onSelectionChange} onRequestDelete={over.onRequestDelete} />
    </ThemeProvider>,
  );
  return { actions };
}

const press = (testId: string) => fireEvent.click(within(screen.getByTestId(testId)).getByRole('button'));
const none = { elementIds: [], connectionIds: [], domainGroups: [] };

describe('MultiSelectionInspector: it says what is selected, and what each field holds', () => {
  it('lists the selection by name, and takes one out with its ×', () => {
    const onSelectionChange = vi.fn();
    renderFull({ ...none, elementIds: ['a1', 'a2'] }, { onSelectionChange });
    const list = screen.getByTestId('selection-list');
    expect(within(list).getByText('A1')).toBeDefined();
    fireEvent.click(within(list).getByRole('button', { name: /A2/ }));
    expect(onSelectionChange).toHaveBeenCalledWith({ ...none, elementIds: ['a1'] });
  });

  it('says Mixed where they differ and the value, all of them, where they agree', () => {
    renderFull({ ...none, elementIds: ['a1', 'a2'] });
    expect(within(screen.getByTestId('bulk-lifecycle')).getByText('Mixed, 2 values')).toBeDefined();
    cleanup();
    renderFull({ ...none, elementIds: ['a1', 'a3'] });
    expect(within(screen.getByTestId('bulk-lifecycle')).getByText('Live, both')).toBeDefined();
  });

  it('edits lines as well: a protocol or a window over all of them, one call, and says what they hold', () => {
    const { actions } = renderFull({ ...none, connectionIds: ['c1', 'c2'] });
    expect(within(screen.getByTestId('bulk-protocol')).getByText('HTTPS, both')).toBeDefined();
    expect(within(screen.getByTestId('bulk-technology')).getByText('Mixed, 2 values')).toBeDefined();
    press('bulk-technology');
    const field = screen.getByLabelText('Technology');
    fireEvent.change(field, { target: { value: 'REST' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(actions.updateConnections).toHaveBeenCalledWith(['c1', 'c2'], { technology: 'REST' });
    expect(actions.updateElements).not.toHaveBeenCalled();
  });

  it('heads each part with what it changes when both kinds are selected', () => {
    renderFull({ ...none, elementIds: ['a1'], connectionIds: ['c1'] });
    expect(screen.getByRole('heading', { name: 'Change the element' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Change the connection' })).toBeDefined();
  });

  it('offers the delete where people look, over the whole selection', () => {
    const onRequestDelete = vi.fn();
    const selection = { ...none, elementIds: ['a1', 'a2'] };
    const { actions } = renderFull(selection, { onRequestDelete });
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2…' }));
    expect(onRequestDelete).toHaveBeenCalledWith(selection);
    fireEvent.click(screen.getByRole('button', { name: 'From this view' }));
    expect(actions.removeFromDiagram).toHaveBeenCalledTimes(2);
  });
});

describe('MultiSelectionInspector: bulk edit', () => {
  const lifecycle = () => { press('bulk-lifecycle'); return screen.getByLabelText('Lifecycle'); };

  it('sets the lifecycle on the whole selection in one call', () => {
    const { actions } = renderBulk();
    fireEvent.change(lifecycle(), { target: { value: 'retiring' } });
    expect(actions.updateElements).toHaveBeenCalledTimes(1);
    expect(actions.updateElements).toHaveBeenCalledWith(['a1', 'a2'], { lifecycle: 'retiring' });
  });

  it('sets the accent colour on the whole selection', () => {
    const { actions } = renderBulk();
    press('bulk-colour');
    fireEvent.change(screen.getByLabelText('Accent colour for the selection'), { target: { value: '#123456' } });
    expect(actions.updateElements).toHaveBeenCalledWith(['a1', 'a2'], { accentColor: '#123456' });
  });

  it('assigns a domain group to the landscape members only, in one undo step', () => {
    const { actions } = renderBulk({ selection: { ...none, elementIds: ['a1', 'a2', 'a3'] } });
    press('bulk-group');
    fireEvent.click(screen.getByRole('option', { name: 'Core' }));
    expect(actions.fileUnderGroupNamed).toHaveBeenCalledTimes(1);
    expect(actions.fileUnderGroupNamed).toHaveBeenCalledWith(['a1', 'a2'], 'Core');
  });

  it('offers no domain group on a container diagram: there are none there', () => {
    renderBulk({ diagram: laidOut({ id: 'd2', kind: 'container', name: 'C', placements: [] }) as never });
    expect(screen.queryByTestId('bulk-group')).toBeNull();
  });

  it('shows nothing mutating in read-only mode', () => {
    renderBulk({ readOnly: true });
    expect(screen.queryByTestId('bulk-lifecycle')).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
  });

  it('asks nothing of the elements when the selection holds none', () => {
    renderBulk({ selection: { ...none, connectionIds: ['c1'] } });
    expect(screen.queryByTestId('bulk-lifecycle')).toBeNull();
  });

  it('keeps working as a plain summary when no actions are wired', () => {
    render(<ThemeProvider theme={createTheme()}><MultiSelectionInspector selection={{ ...none, elementIds: ['a1', 'a2'] }} /></ThemeProvider>);
    expect(screen.getByText('2 selected')).toBeDefined();
    expect(screen.queryByTestId('bulk-lifecycle')).toBeNull();
  });
});
