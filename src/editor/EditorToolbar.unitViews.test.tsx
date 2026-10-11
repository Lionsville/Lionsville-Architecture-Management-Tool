// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The organisation chart and the Conway map in the tab strip (ADR-0036 §7):
 * each a tab of its own where the host can open one, each made from the +,
 * and each keeping the day control a board has — they are drawn on a day —
 * when the canvas's other controls are put away. A sheet keeps none.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { laidOut } from '../model/testFixtures';
import type { DesignDiagram, DesignModel } from '../model/types';
import { DEFAULT_TIDY_OPTIONS } from '../layout/tidy';
import { EditorToolbar } from './EditorToolbar';
import { isDated } from './EditorBoardToolbar';

afterEach(() => cleanup());

const board: DesignDiagram = laidOut({ id: 'd1', kind: 'layer7', name: 'Landscape', placements: [] });
const chart: DesignDiagram = { id: 'oc-1', kind: 'chart', name: 'Who holds what', members: [], geometry: { nodes: [] } };
const conway: DesignDiagram = { id: 'cw-1', kind: 'conway', name: 'Teams and systems', members: [], geometry: { nodes: [] } };
const sheet: DesignDiagram = { id: 'sh-1', kind: 'sheet', name: 'Business architecture', members: [], geometry: { nodes: [] } };
const model: DesignModel = { name: 'Design', elements: [], relations: [], diagrams: [board, chart, conway, sheet] };

function renderToolbar(props: {
  activeDiagram?: DesignDiagram; laidOut?: boolean; dated?: boolean
  onOpenChart?: (id: string) => void; onOpenConway?: (id: string) => void
  onCreateChart?: () => void; onCreateConway?: () => void
}) {
  render(
    <ThemeProvider theme={createTheme()}>
      <EditorToolbar
        model={model} activeDiagram={props.activeDiagram ?? board} readOnly={false}
        laidOut={props.laidOut} dated={props.dated}
        onActiveDiagramChange={vi.fn()} onCreateLayer7Diagram={vi.fn()} onOpenSheet={vi.fn()} onCreateSheet={vi.fn()}
        onOpenChart={props.onOpenChart} onOpenConway={props.onOpenConway}
        onCreateChart={props.onCreateChart} onCreateConway={props.onCreateConway}
        onTidy={vi.fn()} tidyOptions={DEFAULT_TIDY_OPTIONS} onTidyOptionsChange={vi.fn()} onRouteEdges={vi.fn()}
        autoRoute={false} onToggleAutoRoute={vi.fn()} onFitView={vi.fn()} onExport={vi.fn()} onOpenHelp={vi.fn()}
        showLifecycle onToggleLifecycle={vi.fn()} onAsOfChange={vi.fn()} onUndo={vi.fn()} onRedo={vi.fn()}
        canUndo={false} canRedo={false} onOpenSearch={vi.fn()} showMinimap={false} onToggleMinimap={vi.fn()}
        showEdgeLabels onToggleEdgeLabels={vi.fn()}
      />
    </ThemeProvider>,
  );
}

describe('the organisation chart and the Conway map in the strip', () => {
  it('each has a tab of its own where the host opens one, and asks the host to open it', () => {
    const onOpenChart = vi.fn();
    const onOpenConway = vi.fn();
    renderToolbar({ onOpenChart, onOpenConway });
    fireEvent.click(screen.getByRole('tab', { name: /Who holds what/ }));
    expect(onOpenChart).toHaveBeenCalledWith('oc-1');
    fireEvent.click(screen.getByRole('tab', { name: /Teams and systems/ }));
    expect(onOpenConway).toHaveBeenCalledWith('cw-1');
    cleanup();
    renderToolbar({});
    expect(screen.queryByRole('tab', { name: /Who holds what/ })).toBeNull();
  });

  it('is made from the +', () => {
    const onCreateChart = vi.fn();
    const onCreateConway = vi.fn();
    renderToolbar({ onCreateChart, onCreateConway });
    fireEvent.click(screen.getByLabelText('New Layer 7 diagram'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Organisation chart' }));
    expect(onCreateChart).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('New Layer 7 diagram'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Conway map' }));
    expect(onCreateConway).toHaveBeenCalled();
  });

  it('keeps the day control when laid out, where a sheet keeps none', () => {
    renderToolbar({ activeDiagram: chart, laidOut: true, dated: isDated('chart'), onOpenChart: vi.fn() });
    expect(screen.getByLabelText('Showing')).toBeTruthy();
    expect(screen.queryByLabelText(/Minimap/i)).toBeNull();
    cleanup();
    renderToolbar({ activeDiagram: sheet, laidOut: true, dated: isDated('sheet') });
    expect(screen.queryByLabelText('Showing')).toBeNull();
  });

  it('says which kinds are drawn on a day', () => {
    expect(['layer7', 'container', 'chart', 'conway'].every((kind) => isDated(kind as DesignDiagram['kind']))).toBe(true);
    expect(['sheet', 'map', 'technology', 'drawing'].some((kind) => isDated(kind as DesignDiagram['kind']))).toBe(false);
  });
});
