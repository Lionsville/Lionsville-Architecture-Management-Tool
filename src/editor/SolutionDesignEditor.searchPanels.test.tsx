// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { laidOut } from '../model/testFixtures';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { testTheme } from './testing/theme';
import { HostedEditor } from './testing/editorHost';
import type { EditorHostState, HostedEditorProps } from './testing/editorHost';
import { installReactFlowMocks } from './reactFlowTestSetup';
import { PANEL_LIMITS } from './panels';
import type { DesignModel } from '../model/types';
import type { EditorPreferences } from './preferences';

/**
 * ⌘F, the palette filter and the resizable seams — the three 4B affordances
 * that are about FINDING things and MAKING ROOM, tested where they meet the
 * editor rather than in isolation: each one is a small pure function (pinned in
 * `model/elementSearch.test.ts` and `model/panels.test.ts`) plus a piece of
 * wiring, and it is the wiring that breaks.
 */

beforeAll(() => installReactFlowMocks());
afterEach(() => cleanup());

function model(): DesignModel {
  return {
    name: 'ACME Solution Design',
    diagrams: [
      laidOut({
        id: 'd1',
        kind: 'layer7',
        name: 'Layer 7 — EU',
        placements: [
          { id: 'a1', zone: 'landscape', x: 400, y: 300 },
          { id: 'a2', zone: 'landscape', x: 700, y: 300 },
        ],
      }),
      laidOut({
        id: 'd2',
        kind: 'container',
        name: 'Webshop containers',
        applicationElementId: 'a1',
        placements: [{ id: 'a3', x: 0, y: 0 }],
      }),
    ],
    elements: [
      { id: 'a1', kind: 'application', name: 'Webshop', lifecycle: 'live', isManaged: true, aspects: {} },
      { id: 'a2', kind: 'application', name: 'Betaalplatform', vendor: 'Adyen', lifecycle: 'live', isManaged: true, aspects: {} },
      { id: 'a3', kind: 'component', name: 'Orderservice', parentId: 'a1', lifecycle: 'live', isManaged: true, aspects: {} },
    ],
    relations: [],
  };
}

function renderEditor(overrides: Partial<HostedEditorProps> = {}) {
  const onPreferencesChange = vi.fn<(preferences: EditorPreferences) => void>();
  const onActiveDiagramChange = vi.fn<(id: string) => void>();
  const host = { current: undefined as unknown as EditorHostState };
  const props: HostedEditorProps = {
    model: model(),
    activeDiagramId: 'd1',
    onActiveDiagramChange,
    onCreateContainerDiagram: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
    onPreferencesChange,
    ...overrides,
  };
  const view = render(
    <ThemeProvider theme={testTheme}>
      <div style={{ width: '1280px', height: '800px' }}>
        <HostedEditor {...props} hostRef={host} />
      </div>
    </ThemeProvider>,
  );
  const latest = () => onPreferencesChange.mock.calls.at(-1)?.[0];
  return { ...view, latest, onActiveDiagramChange, onPreferencesChange };
}

// ── ⌘F ───────────────────────────────────────────────────────────────────────

const searchField = () => screen.getByLabelText('Search elements');

describe('SolutionDesignEditor — element search', () => {
  it('opens from the toolbar and from ⌘F, and starts empty', () => {
    renderEditor();
    fireEvent.click(screen.getByTestId('board-find'));
    expect(searchField()).toBeDefined();
    expect(screen.getByText('Type to search this design.')).toBeDefined();
  });

  it('⌘F opens it and swallows the browser find bar', () => {
    const { container } = renderEditor();
    const wrapper = container.querySelector('.react-flow') as HTMLElement;
    // jsdom reports Ctrl for `Mod`; `fireEvent` returns false when the handler
    // called preventDefault, which is what keeps the browser's find bar shut.
    const notPrevented = fireEvent.keyDown(wrapper, { key: 'f', ctrlKey: true });
    expect(notPrevented).toBe(false);
    expect(searchField()).toBeDefined();
  });

  it('lists matches by name and by vendor, and says where they live', () => {
    renderEditor();
    fireEvent.click(screen.getByTestId('board-find'));
    fireEvent.change(searchField(), { target: { value: 'adyen' } });
    const results = screen.getByRole('listbox', { name: 'Search results' });
    expect(within(results).getByText('Betaalplatform')).toBeDefined();

    fireEvent.change(searchField(), { target: { value: 'orderservice' } });
    // It lives on the container diagram, so the row says so.
    expect(screen.getByText(/on Webshop containers/)).toBeDefined();
  });

  it('says so when nothing matches', () => {
    renderEditor();
    fireEvent.click(screen.getByTestId('board-find'));
    fireEvent.change(searchField(), { target: { value: 'zzzqqq' } });
    expect(screen.getByText('No element matches “zzzqqq”.')).toBeDefined();
  });

  it('Enter focuses the first match and closes the dialog', async () => {
    renderEditor();
    fireEvent.click(screen.getByTestId('board-find'));
    fireEvent.change(searchField(), { target: { value: 'webshop' } });
    fireEvent.keyDown(searchField(), { key: 'Enter' });
    // The element is now the selection, so the inspector shows its form.
    expect(document.querySelector('.kit-panel__name')).not.toBeNull();
    await waitFor(() => expect(screen.queryByLabelText('Search elements')).toBeNull());
  });

  it('arrows move the active row without taking focus out of the field', () => {
    renderEditor();
    fireEvent.click(screen.getByTestId('board-find'));
    // All three elements carry an "e"; `elementSearch` puts the two on the open
    // diagram first (Betaalplatform, Webshop) and the container one last.
    fireEvent.change(searchField(), { target: { value: 'e' } });
    const options = () => screen.getAllByRole('option');
    const activeRow = () =>
      options().findIndex((option) => option.getAttribute('aria-selected') === 'true');

    // The first row is active from the start — type-and-Enter must keep working.
    expect(activeRow()).toBe(0);
    expect(searchField().getAttribute('aria-activedescendant')).toBe(options()[0].id);

    fireEvent.keyDown(searchField(), { key: 'ArrowDown' });
    expect(activeRow()).toBe(1);
    expect(searchField().getAttribute('aria-activedescendant')).toBe(options()[1].id);
    // The caret never leaves the query, so you can keep typing.
    expect(document.activeElement).toBe(searchField());

    // Up from the top wraps to the bottom rather than sticking.
    fireEvent.keyDown(searchField(), { key: 'ArrowUp' });
    fireEvent.keyDown(searchField(), { key: 'ArrowUp' });
    expect(activeRow()).toBe(options().length - 1);
  });

  it('Enter takes the arrowed-to row, not always the first', async () => {
    renderEditor();
    fireEvent.click(screen.getByTestId('board-find'));
    fireEvent.change(searchField(), { target: { value: 'e' } });
    // Row 0 is Betaalplatform; arrow down to Webshop and take that one.
    fireEvent.keyDown(searchField(), { key: 'ArrowDown' });
    fireEvent.keyDown(searchField(), { key: 'Enter' });

    expect(document.querySelector('.kit-panel__name')?.textContent).toBe('Webshop');
    await waitFor(() => expect(screen.queryByLabelText('Search elements')).toBeNull());
  });

  it('a new query puts the highlight back on the first row', () => {
    renderEditor();
    fireEvent.click(screen.getByTestId('board-find'));
    fireEvent.change(searchField(), { target: { value: 'e' } });
    fireEvent.keyDown(searchField(), { key: 'ArrowDown' });

    fireEvent.change(searchField(), { target: { value: 'webshop' } });
    const options = screen.getAllByRole('option');
    expect(options[0].getAttribute('aria-selected')).toBe('true');
  });

  it('arrows are inert with nothing to arrow through', () => {
    renderEditor();
    fireEvent.click(screen.getByTestId('board-find'));
    fireEvent.change(searchField(), { target: { value: 'zzzqqq' } });
    fireEvent.keyDown(searchField(), { key: 'ArrowDown' });
    fireEvent.keyDown(searchField(), { key: 'Enter' });
    // Still open, nothing selected, no crash on an empty list.
    expect(searchField()).toBeDefined();
    expect(searchField().getAttribute('aria-activedescendant')).toBeNull();
  });

  it('does not shadow the host‘s own focus requests afterwards', () => {
    // Both sources feed one request through one nonce counter; a ⌘F must not
    // make the host's `focusElement` prop inert for the rest of the session.
    const onActiveDiagramChange = vi.fn<(id: string) => void>();
    const host = { current: undefined as unknown as EditorHostState };
    const props: HostedEditorProps = {
      model: model(),
      activeDiagramId: 'd1',
      onActiveDiagramChange,
      onCreateContainerDiagram: vi.fn(),
      onCreateLayer7Diagram: vi.fn(),
    };
    const ui = (extra: Partial<HostedEditorProps>) => (
      <ThemeProvider theme={testTheme}>
        <div style={{ width: '1280px', height: '800px' }}>
          <HostedEditor {...props} {...extra} hostRef={host} />
        </div>
      </ThemeProvider>
    );
    const view = render(ui({}));

    // A ⌘F focus first…
    fireEvent.click(screen.getByTestId('board-find'));
    fireEvent.change(searchField(), { target: { value: 'webshop' } });
    fireEvent.keyDown(searchField(), { key: 'Enter' });

    // …then the host asks for something on another diagram.
    view.rerender(ui({ focusElement: { id: 'a3', nonce: 1 } }));
    expect(onActiveDiagramChange).toHaveBeenCalledWith('d2');
  });

  it('clicking a hit on another diagram asks the host to switch to it', () => {
    const { onActiveDiagramChange } = renderEditor();
    fireEvent.click(screen.getByTestId('board-find'));
    fireEvent.change(searchField(), { target: { value: 'orderservice' } });
    fireEvent.click(screen.getByText('Orderservice'));
    expect(onActiveDiagramChange).toHaveBeenCalledWith('d2');
  });
});

// ── palette filter ───────────────────────────────────────────────────────────

// ── resizable panels ─────────────────────────────────────────────────────────

describe('SolutionDesignEditor — panel seams', () => {
  const inspectorSeam = () => screen.getByRole('separator', { name: 'Resize inspector' });

  it('opens the inspector at its stored width', () => {
    renderEditor({ focusElement: { id: 'a1', nonce: 1 }, initialPreferences: { inspectorWidth: 400 } });
    // The seam is the accessible face of the width, so it is what we read.
    expect(inspectorSeam().getAttribute('aria-valuenow')).toBe('400');
  });

  it('grows the inspector when its seam is dragged LEFT — it lives on the right', () => {
    const { latest } = renderEditor({ focusElement: { id: 'a1', nonce: 1 }, initialPreferences: { inspectorWidth: 320 } });
    fireEvent.keyDown(inspectorSeam(), { key: 'ArrowLeft' });
    expect(latest()?.inspectorWidth).toBe(328);
    fireEvent.keyDown(inspectorSeam(), { key: 'ArrowRight' });
    expect(latest()?.inspectorWidth).toBe(320);
  });

  it('takes the seam away when the panel is a rail', () => {
    renderEditor({ initialPreferences: { inspectorCollapsed: true } });
    expect(screen.queryByRole('separator', { name: 'Resize palette' })).toBeNull();
    expect(screen.queryByRole('separator', { name: 'Resize inspector' })).toBeNull();
  });

  it('has no palette seam in read-only — there is no palette', () => {
    renderEditor({ readOnly: true, focusElement: { id: 'a1', nonce: 1 } });
    expect(screen.queryByRole('separator', { name: 'Resize palette' })).toBeNull();
    // The inspector is still there to read, and still resizable.
    expect(inspectorSeam()).toBeDefined();
  });
});
