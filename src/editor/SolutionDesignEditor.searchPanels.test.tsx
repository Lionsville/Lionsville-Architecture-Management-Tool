// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { SolutionDesignEditor } from './SolutionDesignEditor';
import { installReactFlowMocks } from './reactFlowTestSetup';
import { PANEL_LIMITS } from './panels';
import type { DesignModel, SolutionDesignEditorProps } from '../model/types';
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
    customerName: 'ACME',
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'Layer 7 — EU',
        placements: [
          { elementId: 'a1', zone: 'landscape', x: 400, y: 300 },
          { elementId: 'a2', zone: 'landscape', x: 700, y: 300 },
        ],
      },
      {
        id: 'd2',
        kind: 'container',
        name: 'Webshop containers',
        applicationElementId: 'a1',
        placements: [{ elementId: 'a3', x: 0, y: 0 }],
      },
    ],
    elements: [
      { id: 'a1', kind: 'application', name: 'Webshop', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'a2', kind: 'application', name: 'Betaalplatform', vendor: 'Adyen', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'a3', kind: 'component', name: 'Orderservice', parentApplicationId: 'a1', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
    ],
    connections: [],
  };
}

function renderEditor(overrides: Partial<SolutionDesignEditorProps> = {}) {
  const onPreferencesChange = vi.fn<(preferences: EditorPreferences) => void>();
  const onActiveDiagramChange = vi.fn<(id: string) => void>();
  const props: SolutionDesignEditorProps = {
    model: model(),
    activeDiagramId: 'd1',
    onActiveDiagramChange,
    onChange: vi.fn(),
    onCreateContainerDiagram: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
    parameterSpecs: () => [],
    onPreferencesChange,
    ...overrides,
  };
  const view = render(
    <ThemeProvider theme={createTheme()}>
      <div style={{ width: '1280px', height: '800px' }}>
        <SolutionDesignEditor {...props} />
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
    fireEvent.click(screen.getByLabelText('Find element'));
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
    fireEvent.click(screen.getByLabelText('Find element'));
    fireEvent.change(searchField(), { target: { value: 'adyen' } });
    const results = screen.getByRole('listbox', { name: 'Search results' });
    expect(within(results).getByText('Betaalplatform')).toBeDefined();

    fireEvent.change(searchField(), { target: { value: 'orderservice' } });
    // It lives on the container diagram, so the row says so.
    expect(screen.getByText(/on Webshop containers/)).toBeDefined();
  });

  it('says so when nothing matches', () => {
    renderEditor();
    fireEvent.click(screen.getByLabelText('Find element'));
    fireEvent.change(searchField(), { target: { value: 'zzzqqq' } });
    expect(screen.getByText('No element matches “zzzqqq”.')).toBeDefined();
  });

  it('Enter focuses the first match and closes the dialog', async () => {
    renderEditor();
    fireEvent.click(screen.getByLabelText('Find element'));
    fireEvent.change(searchField(), { target: { value: 'webshop' } });
    fireEvent.keyDown(searchField(), { key: 'Enter' });
    // The element is now the selection, so the inspector shows its form.
    expect(screen.getByLabelText('Name')).toBeDefined();
    await waitFor(() => expect(screen.queryByLabelText('Search elements')).toBeNull());
  });

  it('arrows move the active row without taking focus out of the field', () => {
    renderEditor();
    fireEvent.click(screen.getByLabelText('Find element'));
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
    fireEvent.click(screen.getByLabelText('Find element'));
    fireEvent.change(searchField(), { target: { value: 'e' } });
    // Row 0 is Betaalplatform; arrow down to Webshop and take that one.
    fireEvent.keyDown(searchField(), { key: 'ArrowDown' });
    fireEvent.keyDown(searchField(), { key: 'Enter' });

    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Webshop');
    await waitFor(() => expect(screen.queryByLabelText('Search elements')).toBeNull());
  });

  it('a new query puts the highlight back on the first row', () => {
    renderEditor();
    fireEvent.click(screen.getByLabelText('Find element'));
    fireEvent.change(searchField(), { target: { value: 'e' } });
    fireEvent.keyDown(searchField(), { key: 'ArrowDown' });

    fireEvent.change(searchField(), { target: { value: 'webshop' } });
    const options = screen.getAllByRole('option');
    expect(options[0].getAttribute('aria-selected')).toBe('true');
  });

  it('arrows are inert with nothing to arrow through', () => {
    renderEditor();
    fireEvent.click(screen.getByLabelText('Find element'));
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
    const props: SolutionDesignEditorProps = {
      model: model(),
      activeDiagramId: 'd1',
      onActiveDiagramChange,
      onChange: vi.fn(),
      onCreateContainerDiagram: vi.fn(),
      onCreateLayer7Diagram: vi.fn(),
      parameterSpecs: () => [],
    };
    const ui = (extra: Partial<SolutionDesignEditorProps>) => (
      <ThemeProvider theme={createTheme()}>
        <div style={{ width: '1280px', height: '800px' }}>
          <SolutionDesignEditor {...props} {...extra} />
        </div>
      </ThemeProvider>
    );
    const view = render(ui({}));

    // A ⌘F focus first…
    fireEvent.click(screen.getByLabelText('Find element'));
    fireEvent.change(searchField(), { target: { value: 'webshop' } });
    fireEvent.keyDown(searchField(), { key: 'Enter' });

    // …then the host asks for something on another diagram.
    view.rerender(ui({ focusElement: { id: 'a3', nonce: 1 } }));
    expect(onActiveDiagramChange).toHaveBeenCalledWith('d2');
  });

  it('clicking a hit on another diagram asks the host to switch to it', () => {
    const { onActiveDiagramChange } = renderEditor();
    fireEvent.click(screen.getByLabelText('Find element'));
    fireEvent.change(searchField(), { target: { value: 'orderservice' } });
    fireEvent.click(screen.getByText('Orderservice'));
    expect(onActiveDiagramChange).toHaveBeenCalledWith('d2');
  });
});

// ── palette filter ───────────────────────────────────────────────────────────

describe('ElementPalette — search', () => {
  const filter = () => screen.getByLabelText('Search the palette');

  it('narrows the rows and keeps the sections that still have one', () => {
    renderEditor();
    expect(screen.getByText('Application')).toBeDefined();
    expect(screen.getByText('Actor')).toBeDefined();

    fireEvent.change(filter(), { target: { value: 'actor' } });
    expect(screen.queryByText('Application')).toBeNull();
    expect(screen.getByText('Actor')).toBeDefined();
    expect(screen.queryByText('Applications & components')).toBeNull();
  });

  it('matches the Dutch label too, whatever the UI language is', () => {
    // An English UI used by a Dutch-speaking architect is the normal case here.
    renderEditor();
    fireEvent.change(filter(), { target: { value: 'invoerkanaal' } });
    expect(screen.getByText('Input channel')).toBeDefined();
  });

  it('matches the description, not only the name', () => {
    renderEditor();
    fireEvent.change(filter(), { target: { value: 'outside' } });
    expect(screen.getByText('External system')).toBeDefined();
    expect(screen.queryByText('Actor')).toBeNull();
  });

  it('says so when nothing matches', () => {
    renderEditor();
    fireEvent.change(filter(), { target: { value: 'zzzqqq' } });
    expect(screen.getByText('Nothing matches “zzzqqq”')).toBeDefined();
  });

  it('is not offered on the collapsed rail', () => {
    renderEditor({ initialPreferences: { paletteCollapsed: true } });
    expect(screen.queryByLabelText('Search the palette')).toBeNull();
  });
});

// ── resizable panels ─────────────────────────────────────────────────────────

describe('SolutionDesignEditor — panel seams', () => {
  const paletteSeam = () => screen.getByRole('separator', { name: 'Resize palette' });
  const inspectorSeam = () => screen.getByRole('separator', { name: 'Resize inspector' });

  it('opens each panel at its stored width', () => {
    renderEditor({ initialPreferences: { paletteWidth: 300, inspectorWidth: 400 } });
    // The seam is the accessible face of the width, so it is what we read: MUI
    // compiles `sx` to a class, and asserting on a generated class name would
    // pin the styling engine rather than the behaviour.
    expect(paletteSeam().getAttribute('aria-valuenow')).toBe('300');
    expect(inspectorSeam().getAttribute('aria-valuenow')).toBe('400');
  });

  it('widens the palette with the keyboard and reports the new width', () => {
    const { latest } = renderEditor({ initialPreferences: { paletteWidth: 232 } });
    fireEvent.keyDown(paletteSeam(), { key: 'ArrowRight' });
    expect(paletteSeam().getAttribute('aria-valuenow')).toBe('240');
    expect(latest()?.paletteWidth).toBe(240);
  });

  it('grows the inspector when its seam is dragged LEFT — it lives on the right', () => {
    const { latest } = renderEditor({ initialPreferences: { inspectorWidth: 320 } });
    fireEvent.keyDown(inspectorSeam(), { key: 'ArrowLeft' });
    expect(latest()?.inspectorWidth).toBe(328);
    fireEvent.keyDown(inspectorSeam(), { key: 'ArrowRight' });
    expect(latest()?.inspectorWidth).toBe(320);
  });

  it('clamps at the limits rather than letting a panel eat the board', () => {
    const { latest } = renderEditor({ initialPreferences: { paletteWidth: PANEL_LIMITS.palette.max } });
    fireEvent.keyDown(paletteSeam(), { key: 'ArrowRight', shiftKey: true });
    expect(latest()?.paletteWidth ?? PANEL_LIMITS.palette.max).toBe(PANEL_LIMITS.palette.max);
  });

  it('double-click resets to the default width', () => {
    const { latest } = renderEditor({ initialPreferences: { paletteWidth: 400 } });
    fireEvent.doubleClick(paletteSeam());
    expect(latest()?.paletteWidth).toBe(PANEL_LIMITS.palette.default);
  });

  it('takes the seam away when the panel is a rail', () => {
    renderEditor({ initialPreferences: { paletteCollapsed: true, inspectorCollapsed: true } });
    expect(screen.queryByRole('separator', { name: 'Resize palette' })).toBeNull();
    expect(screen.queryByRole('separator', { name: 'Resize inspector' })).toBeNull();
  });

  it('has no palette seam in read-only — there is no palette', () => {
    renderEditor({ readOnly: true });
    expect(screen.queryByRole('separator', { name: 'Resize palette' })).toBeNull();
    // The inspector is still there to read, and still resizable.
    expect(inspectorSeam()).toBeDefined();
  });
});
