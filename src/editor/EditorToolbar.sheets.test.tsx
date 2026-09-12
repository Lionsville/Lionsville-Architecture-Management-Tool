// @vitest-environment jsdom
/**
 * A laid-out view in the tab strip (ADR-0012 §6).
 *
 * A sheet is a view, so it has a tab where every other view has one. It is
 * the one tab that does not change what the canvas is drawing: the editor
 * cannot draw a page that has no geometry, so choosing it is a request to the
 * host — and a host that has nowhere to put one is not offered the tab at all.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { laidOut } from '../model/testFixtures';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { DesignDiagram, DesignModel } from '../model/types';
import { DEFAULT_TIDY_OPTIONS } from '../layout/tidy';
import { EditorToolbar } from './EditorToolbar';

afterEach(() => cleanup());

const board: DesignDiagram = laidOut({ id: 'd1', kind: 'layer7', name: 'Landscape', placements: [] });
const sheet: DesignDiagram = {
  id: 'sh-1', kind: 'sheet', name: 'Business architecture', members: [], geometry: { nodes: [] },
};
const other: DesignDiagram = laidOut({ id: 'd2', kind: 'layer7', name: 'Target', placements: [] });
const model: DesignModel = {
  name: 'Design', customerName: 'Group', elements: [], relations: [], diagrams: [board, other, sheet],
};

function renderToolbar(props: {
  onOpenSheet?: (diagramId: string) => void;
  onCreateSheet?: () => void;
  onCreateLayer7Diagram?: () => void;
  onActiveDiagramChange?: (diagramId: string) => void;
  readOnly?: boolean;
}) {
  render(
    <ThemeProvider theme={createTheme()}>
      <EditorToolbar
        model={model}
        activeDiagram={board}
        readOnly={props.readOnly ?? false}
        onActiveDiagramChange={props.onActiveDiagramChange ?? vi.fn()}
        onCreateLayer7Diagram={props.onCreateLayer7Diagram ?? vi.fn()}
        onOpenSheet={props.onOpenSheet}
        onCreateSheet={props.onCreateSheet}
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

describe('a sheet’s tab', () => {
  it('sits in the strip beside the boards', () => {
    renderToolbar({ onOpenSheet: vi.fn() });
    expect(screen.getByRole('tab', { name: /Business architecture/ })).toBeTruthy();
  });

  it('is not offered where the host cannot draw one', () => {
    renderToolbar({});
    expect(screen.queryByRole('tab', { name: /Business architecture/ })).toBeNull();
    expect(screen.getByRole('tab', { name: /Landscape/ })).toBeTruthy();
  });

  it('asks the host to open it, and leaves the canvas where it was', () => {
    const onOpenSheet = vi.fn();
    const onActiveDiagramChange = vi.fn();
    renderToolbar({ onOpenSheet, onActiveDiagramChange });
    fireEvent.click(screen.getByRole('tab', { name: /Business architecture/ }));
    expect(onOpenSheet).toHaveBeenCalledWith('sh-1');
    expect(onActiveDiagramChange).not.toHaveBeenCalled();
  });

  it('still switches boards the way it always did', () => {
    const onActiveDiagramChange = vi.fn();
    const onOpenSheet = vi.fn();
    renderToolbar({ onOpenSheet, onActiveDiagramChange });
    fireEvent.click(screen.getByRole('tab', { name: /Target/ }));
    expect(onActiveDiagramChange).toHaveBeenCalledWith('d2');
    expect(onOpenSheet).not.toHaveBeenCalled();
  });
});

describe('the + ', () => {
  it('offers both kinds when the host can make a sheet', () => {
    const onCreateSheet = vi.fn();
    renderToolbar({ onCreateSheet, onOpenSheet: vi.fn() });
    fireEvent.click(screen.getByLabelText('New Layer 7 diagram'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Business architecture' }));
    expect(onCreateSheet).toHaveBeenCalled();
  });

  it('still makes a landscape from the same menu', () => {
    const onCreateLayer7Diagram = vi.fn();
    renderToolbar({ onCreateSheet: vi.fn(), onCreateLayer7Diagram });
    fireEvent.click(screen.getByLabelText('New Layer 7 diagram'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Landscape' }));
    expect(onCreateLayer7Diagram).toHaveBeenCalled();
  });

  it('makes a landscape without asking where the host has no sheets', () => {
    const onCreateLayer7Diagram = vi.fn();
    renderToolbar({ onCreateLayer7Diagram });
    fireEvent.click(screen.getByLabelText('New Layer 7 diagram'));
    expect(onCreateLayer7Diagram).toHaveBeenCalled();
  });

  it('is offered at all only while the editor can be written to', () => {
    renderToolbar({ onCreateSheet: vi.fn(), readOnly: true });
    expect(screen.queryByLabelText('New Layer 7 diagram')).toBeNull();
  });
});
