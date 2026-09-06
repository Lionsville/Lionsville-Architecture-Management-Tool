// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { SolutionDesignEditor } from './SolutionDesignEditor';
import { installReactFlowMocks } from './reactFlowTestSetup';
import type { EditorPreferences } from './preferences';
import type { DesignModel, SolutionDesignEditorProps } from '../model/types';

/**
 * The preferences seam: settings in through `initialPreferences`, out through
 * `onPreferencesChange`. `model/preferences.test.ts` pins the merging and the
 * equality; this pins that the editor actually starts in the state it was
 * handed and reports the state it moves to.
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
        placements: [{ elementId: 'a1', zone: 'landscape', x: 400, y: 300 }],
      },
    ],
    elements: [
      { id: 'a1', kind: 'application', name: 'Webshop', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
    ],
    connections: [],
  };
}

function renderEditor(overrides: Partial<SolutionDesignEditorProps> = {}) {
  const onPreferencesChange = vi.fn<(preferences: EditorPreferences) => void>();
  const props: SolutionDesignEditorProps = {
    model: model(),
    activeDiagramId: 'd1',
    onActiveDiagramChange: vi.fn(),
    onChange: vi.fn(),
    onCreateContainerDiagram: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
    parameterSpecs: () => [],
    onPreferencesChange,
    ...overrides,
  };
  const view = render(
    <ThemeProvider theme={createTheme()}>
      <div style={{ width: '1200px', height: '800px' }}>
        <SolutionDesignEditor {...props} />
      </div>
    </ThemeProvider>,
  );
  const latest = () => onPreferencesChange.mock.calls.at(-1)?.[0];
  return { ...view, onPreferencesChange, latest };
}

const lifecycleButton = () => screen.getByRole('button', { name: 'Toggle lifecycle badges' });

describe('SolutionDesignEditor — preferences in', () => {
  it('starts in the state the host handed over', () => {
    renderEditor({
      initialPreferences: { showLifecycle: false, paletteCollapsed: true },
    });
    expect(lifecycleButton().getAttribute('aria-pressed')).toBe('false');
    // A collapsed palette shows its expand affordance instead of the rows.
    expect(screen.queryByRole('button', { name: 'Application', expanded: false })).toBeNull();
  });

  it('falls back to the defaults for junk', () => {
    renderEditor({ initialPreferences: 'not an object' });
    expect(lifecycleButton().getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Application', expanded: false })).toBeDefined();
  });
});

describe('SolutionDesignEditor — preferences out', () => {
  it('says nothing on mount', () => {
    const { onPreferencesChange } = renderEditor();
    expect(onPreferencesChange).not.toHaveBeenCalled();
  });

  it('reports a toggled setting, with the rest of the set alongside it', () => {
    const { onPreferencesChange, latest } = renderEditor();

    fireEvent.click(lifecycleButton());

    expect(onPreferencesChange).toHaveBeenCalledTimes(1);
    expect(latest()).toMatchObject({ showLifecycle: false, showGrid: true, snapToGrid: false });
    // The board's Tidy starts at hybrid; this line is here to prove the whole
    // set travels with a single toggled flag, not to pin the direction itself.
    expect(latest()?.tidyOptions.direction).toBe('hybrid');
  });

  it('reports each further change once', () => {
    const { onPreferencesChange, latest } = renderEditor();

    fireEvent.click(lifecycleButton());
    fireEvent.click(lifecycleButton());

    expect(onPreferencesChange).toHaveBeenCalledTimes(2);
    expect(latest()?.showLifecycle).toBe(true);
  });
});
