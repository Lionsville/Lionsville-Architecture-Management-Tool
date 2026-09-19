// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { laidOut } from '../model/testFixtures';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { DesignDiagram, DesignModel } from '../model/types';
import { DEFAULT_TIDY_OPTIONS } from '../layout/tidy';
import { EditorToolbar } from './EditorToolbar';

/**
 * What the badges mean is a button, not a hover: the legend used to open on
 * hovering the lifecycle toggle, whose click did something else, and the
 * inspector's copy named a hard-coded PLT and vanished on the first click.
 * The popover lists this board's own columns, code and long name, from the
 * same function the export's key is drawn from.
 */

afterEach(() => cleanup());

const landscape: DesignDiagram = laidOut({
  id: 'd1', kind: 'layer7', name: 'Landscape', placements: [],
  aspectConfig: [
    { key: 'monitoring', label: 'Monitoring' },
    { key: 'custom-self-healing', label: 'Self-healing' },
  ],
});
const container: DesignDiagram = laidOut({ id: 'cd1', kind: 'container', name: 'Inside', applicationElementId: 'a1', placements: [] });
const model: DesignModel = { name: 'Design', elements: [], relations: [], diagrams: [landscape, container] };

function renderToolbar(activeDiagram: DesignDiagram, showLifecycle = true) {
  render(
    <ThemeProvider theme={createTheme()}>
      <EditorToolbar
        model={model}
        activeDiagram={activeDiagram}
        readOnly={false}
        onActiveDiagramChange={vi.fn()}
        onCreateLayer7Diagram={vi.fn()}
        onTidy={vi.fn()}
        tidyOptions={DEFAULT_TIDY_OPTIONS}
        onTidyOptionsChange={vi.fn()}
        onRouteEdges={vi.fn()}
        autoRoute={false}
        onToggleAutoRoute={vi.fn()}
        onFitView={vi.fn()}
        onExport={vi.fn()}
        onOpenHelp={vi.fn()}
        showLifecycle={showLifecycle}
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

describe('the legend button', () => {
  it('opens a popover with each column’s code and long name, the statuses and the lifecycle colours', () => {
    renderToolbar(landscape);
    fireEvent.click(screen.getByLabelText('What the badges mean'));
    const legend = screen.getByTestId('badge-legend');
    expect(within(legend).getByText('MON')).toBeTruthy();
    expect(within(legend).getByText('Monitoring')).toBeTruthy();
    expect(within(legend).getByText('SH')).toBeTruthy();
    expect(within(legend).getByText('Self-healing')).toBeTruthy();
    for (const status of ['Managed', 'Partial', 'At risk', 'None']) expect(within(legend).getByText(status)).toBeTruthy();
    for (const stage of ['Planned', 'Live', 'Retiring', 'Retired']) expect(within(legend).getByText(stage)).toBeTruthy();
  });

  it('says a board shows no aspects rather than listing nothing, and that the lifecycle badges are hidden', () => {
    renderToolbar(container, false);
    fireEvent.click(screen.getByLabelText('What the badges mean'));
    const legend = screen.getByTestId('badge-legend');
    expect(legend.textContent).toContain('This board shows no operational aspects.');
    expect(legend.textContent).toContain('Hidden on this board');
    expect(within(legend).queryByText('MON')).toBeNull();
  });

  it('gives the lifecycle toggle a tooltip that says what it does', async () => {
    renderToolbar(landscape);
    fireEvent.mouseOver(screen.getByLabelText('Toggle lifecycle badges'));
    expect(await screen.findByText('Show or hide the lifecycle badges')).toBeTruthy();
  });
});
