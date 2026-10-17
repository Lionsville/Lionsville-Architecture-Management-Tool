// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { laidOut } from '../model/testFixtures';
import { cleanup, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { DesignDiagram, DesignModel } from '../model/types';
import { DEFAULT_TIDY_OPTIONS } from '../layout/tidy';
import { EditorToolbar } from './EditorToolbar';

/**
 * The board's tabs take the free width of the toolbar before anything else
 * does. A spacer that grew beside them took half of it, and the tabs scrolled
 * with half the bar empty: the tools are pushed right by an auto margin, which
 * takes only what the tabs leave. jsdom lays nothing out, so this reads the
 * styles that decide it; the browser walk measured the widths.
 */

afterEach(() => cleanup());

const diagram: DesignDiagram = laidOut({ id: 'd1', kind: 'layer7', name: 'Landscape', placements: [] });
const other: DesignDiagram = laidOut({ id: 'd2', kind: 'layer7', name: 'Target', placements: [] });
const model: DesignModel = {
  name: 'Design',
  elements: [],
  relations: [],
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
        onAsOfChange={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        canUndo={false}
        canRedo={false}
        onOpenSearch={vi.fn()}
        showMinimap={false}
        onToggleMinimap={vi.fn()}
        showEdgeLabels
        onToggleEdgeLabels={vi.fn()}
      />
    </ThemeProvider>,
  );
}

describe('the width the tabs are given', () => {
  it('grows the tabs to their own width and pushes the tools right by an auto margin', () => {
    renderToolbar({});
    const tabs = screen.getByRole('tablist').closest('.MuiTabs-root') as HTMLElement;
    expect(getComputedStyle(tabs).maxWidth).toBe('max-content');
    const spacer = screen.getByTestId('toolbar-spacer');
    expect(getComputedStyle(spacer).marginLeft).toBe('auto');
  });
});
