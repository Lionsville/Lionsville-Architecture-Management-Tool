// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { laidOut } from '../model/testFixtures';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { DesignDiagram, DesignModel } from '../model/types';
import { DEFAULT_TIDY_OPTIONS } from '../layout/tidy';
import { EditorToolbar } from './EditorToolbar';

/**
 * A container view is a tab in everything but shape. It has no tab to
 * right-click, so the diagram menu — rename, settings, delete — opens from
 * two places instead: its entry in the landscape tab's container-views
 * dropdown, and a chevron in its own header once it is open. Without these
 * the only way to delete one was the boards table on the scope's home, and
 * nobody looking at the view found that.
 */

afterEach(() => cleanup());

const landscape: DesignDiagram = laidOut({
  id: 'd1', kind: 'layer7', name: 'Landscape', placements: [{ id: 'billing', x: 0, y: 0 }],
});
const container: DesignDiagram = laidOut({
  id: 'cd1', kind: 'container', name: 'Billing — containers', applicationElementId: 'billing', placements: [],
});
const model: DesignModel = {
  name: 'Design',
  elements: [{ id: 'billing', kind: 'application', name: 'Billing', lifecycle: 'live', isManaged: true, aspects: {} }],
  relations: [],
  diagrams: [landscape, container],
};

function renderToolbar(props: {
  activeDiagram?: DesignDiagram;
  onDeleteDiagram?: (diagramId: string) => void;
  onRenameDiagram?: (diagramId: string, name: string) => void;
  onOpenDiagramSettings?: (diagramId: string) => void;
  onDuplicateDiagram?: (diagramId: string) => void;
  readOnly?: boolean;
}) {
  render(
    <ThemeProvider theme={createTheme()}>
      <EditorToolbar
        model={model}
        activeDiagram={props.activeDiagram ?? landscape}
        readOnly={props.readOnly ?? false}
        onActiveDiagramChange={vi.fn()}
        onCreateLayer7Diagram={vi.fn()}
        onDeleteDiagram={props.onDeleteDiagram}
        onRenameDiagram={props.onRenameDiagram}
        onOpenDiagramSettings={props.onOpenDiagramSettings}
        onDuplicateDiagram={props.onDuplicateDiagram}
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

const diagramMenu = () => screen.getByRole('menu', { name: 'Diagram menu' });

describe('the menu of a container view', () => {
  it('opens with a right-click on its entry in the dropdown, and deletes from there', () => {
    const onDeleteDiagram = vi.fn();
    renderToolbar({ onDeleteDiagram, onRenameDiagram: vi.fn(), onOpenDiagramSettings: vi.fn(), onDuplicateDiagram: vi.fn() });
    fireEvent.click(screen.getByLabelText('Container diagrams of Landscape'));
    fireEvent.contextMenu(screen.getByText('Billing'));
    const menu = diagramMenu();
    expect(within(menu).getByText('Rename diagram…')).toBeTruthy();
    expect(within(menu).getByText('Diagram settings…')).toBeTruthy();
    // No duplicate: a second view about the same application would be two
    // answers to "what is inside it".
    expect(within(menu).queryByText('Duplicate diagram')).toBeNull();
    fireEvent.click(within(menu).getByText('Delete diagram…'));
    expect(onDeleteDiagram).toHaveBeenCalledWith('cd1');
  });

  it('opens from the chevron in the view\'s own header, and is never disabled as a last landscape', () => {
    const onDeleteDiagram = vi.fn();
    const onOpenDiagramSettings = vi.fn();
    renderToolbar({ activeDiagram: container, onDeleteDiagram, onOpenDiagramSettings });
    fireEvent.click(screen.getByLabelText('Menu of the container diagram of Billing'));
    const menu = diagramMenu();
    const remove = within(menu).getByText('Delete diagram…').closest('[role="menuitem"]');
    expect(remove?.getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.click(within(menu).getByText('Diagram settings…'));
    expect(onOpenDiagramSettings).toHaveBeenCalledWith('cd1');
  });

  it('is absent while the editor is read-only, and where the host offers nothing', () => {
    renderToolbar({ activeDiagram: container, onDeleteDiagram: vi.fn(), readOnly: true });
    expect(screen.queryByLabelText('Menu of the container diagram of Billing')).toBeNull();
    cleanup();
    renderToolbar({ activeDiagram: container });
    expect(screen.queryByLabelText('Menu of the container diagram of Billing')).toBeNull();
  });
});
