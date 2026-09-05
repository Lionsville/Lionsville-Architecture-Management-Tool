// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { DesignDiagram, DesignModel } from '../types';
import { DEFAULT_TIDY_OPTIONS } from '../layout/tidy';
import { EditorToolbar } from './EditorToolbar';

/**
 * The radar on a tab is the second way to the diagram's settings. The first is
 * a right-click, which is not a thing you find — and the maturity columns are
 * behind it, so a diagram whose badges say the wrong words has to be reachable
 * without knowing that.
 */

afterEach(() => cleanup());

const diagram: DesignDiagram = { id: 'd1', kind: 'layer7', name: 'Landscape', placements: [] };
const other: DesignDiagram = { id: 'd2', kind: 'layer7', name: 'Target', placements: [] };
const model: DesignModel = {
  name: 'Design',
  customerName: 'Group',
  elements: [],
  connections: [],
  diagrams: [diagram, other],
};

function renderToolbar(props: {
  onOpenDiagramSettings?: (diagramId: string) => void;
  onActiveDiagramChange?: (diagramId: string) => void;
  readOnly?: boolean;
}) {
  render(
    <ThemeProvider theme={createTheme()}>
      <EditorToolbar
        model={model}
        activeDiagram={diagram}
        readOnly={props.readOnly ?? false}
        onActiveDiagramChange={props.onActiveDiagramChange ?? vi.fn()}
        onCreateLayer7Diagram={vi.fn()}
        onOpenDiagramSettings={props.onOpenDiagramSettings}
        onTidy={vi.fn()}
        tidyOptions={DEFAULT_TIDY_OPTIONS}
        onTidyOptionsChange={vi.fn()}
        onRouteEdges={vi.fn()}
        autoRoute={false}
        onToggleAutoRoute={vi.fn()}
        onFitView={vi.fn()}
        onExport={vi.fn()}
        onOpenHelp={vi.fn()}
        showLifecycle
        onToggleLifecycle={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        canUndo={false}
        canRedo={false}
        onOpenSearch={vi.fn()}
        showMinimap={false}
        onToggleMinimap={vi.fn()}
      />
    </ThemeProvider>,
  );
}

describe('the settings affordance on a diagram tab', () => {
  it('opens the settings of the tab it sits on, not of the active one', () => {
    const onOpenDiagramSettings = vi.fn();
    const onActiveDiagramChange = vi.fn();
    renderToolbar({ onOpenDiagramSettings, onActiveDiagramChange });
    fireEvent.click(screen.getByLabelText('Settings of Target'));
    expect(onOpenDiagramSettings).toHaveBeenCalledWith('d2');
    // The click belongs to the radar; it must not also switch tabs.
    expect(onActiveDiagramChange).not.toHaveBeenCalled();
  });

  it('is absent when the host offers no settings', () => {
    renderToolbar({});
    expect(screen.queryByLabelText('Settings of Landscape')).toBeNull();
  });

  it('is absent while the editor is read-only', () => {
    renderToolbar({ onOpenDiagramSettings: vi.fn(), readOnly: true });
    expect(screen.queryByLabelText('Settings of Landscape')).toBeNull();
  });
});
