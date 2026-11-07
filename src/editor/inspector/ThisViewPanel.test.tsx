// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/** With nothing selected there is no panel, and pressing the name of the view that is up asks about the view. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { laidOut } from '../../model/testFixtures';
import type { DesignModel } from '../../model/types';
import { installReactFlowMocks } from '../reactFlowTestSetup';
import { HostedEditor } from '../testing/editorHost';
import type { EditorHostState } from '../testing/editorHost';

installReactFlowMocks();
afterEach(() => cleanup());

const model = (): DesignModel => ({
  name: 'Acme',
  diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'Landscape', placements: [{ id: 'a1', x: 0, y: 0 }, { id: 'a2', x: 300, y: 0 }] })],
  elements: ['a1', 'a2'].map((id) => ({ id, kind: 'application' as const, name: id.toUpperCase(), lifecycle: 'live' as const, isManaged: false, aspects: {} })),
  relations: [{ type: 'flow', id: 'c1', sourceId: 'a1', targetId: 'a2', isBidirectional: false }],
});

const open = () => render(
  <ThemeProvider theme={createTheme()}>
    <HostedEditor model={model()} activeDiagramId="d1" onActiveDiagramChange={vi.fn()} onCreateContainerDiagram={vi.fn()} onCreateLayer7Diagram={vi.fn()} hostRef={{ current: undefined as unknown as EditorHostState }} />
  </ThemeProvider>,
);

const containers = (): DesignModel => ({
  name: 'Acme',
  diagrams: [laidOut({
    id: 'c1', kind: 'container', name: 'App · containers', applicationElementId: 'app',
    placements: [{ id: 'app', x: 0, y: 0, width: 600, height: 400 }, { id: 'api', x: 40, y: 60 }, { id: 'db', x: 300, y: 60 }, { id: 'buyer', x: -300, y: 0 }],
  })],
  elements: [
    { id: 'app', kind: 'application', name: 'App', lifecycle: 'live', isManaged: true, aspects: {} },
    { id: 'api', kind: 'component', parentId: 'app', name: 'API', technology: 'Java', lifecycle: 'live', isManaged: true, aspects: {} },
    { id: 'db', kind: 'component', parentId: 'app', name: 'Store', lifecycle: 'live', isManaged: true, aspects: {} },
    { id: 'buyer', kind: 'actor', name: 'Buyer', lifecycle: 'live', isManaged: true, aspects: {} },
  ],
  relations: [
    { type: 'flow', id: 'r1', sourceId: 'api', targetId: 'db', label: 'reads and writes', protocol: 'SQL', isBidirectional: false },
    { type: 'flow', id: 'r2', sourceId: 'buyer', targetId: 'app', label: 'orders', isBidirectional: false },
  ],
});

const openContainers = () => render(
  <ThemeProvider theme={createTheme()}>
    <HostedEditor model={containers()} activeDiagramId="c1" onActiveDiagramChange={vi.fn()} />
  </ThemeProvider>,
);

describe('a container diagram, about itself', () => {
  it('says its title in the bar, and its name opens what it holds, the waiting line and a key on the canvas', () => {
    openContainers();
    expect(screen.queryByTestId('lv-c4-panel')).toBeNull();
    const key = screen.getByTestId('container-key');
    expect(key.textContent).toContain('Container');
    expect(key.textContent).toContain('Person');
    expect(key.textContent).toContain('Reaches the application');
    fireEvent.click(screen.getByTestId('this-view'));
    const panel = document.querySelector<HTMLElement>('[data-guide="board.inspector"]')!;
    expect(within(panel).getByRole('heading', { name: 'App' })).toBeDefined();
    expect(panel.textContent).toContain('2 containers, 1 around them, 2 lines');
    expect(within(panel).getByTestId('unlanded-lines').textContent).toContain('Buyer reaches the application');
  });

  it('lists its lines by the numbers on the canvas, stays in the list while walking them, and filters', () => {
    openContainers();
    fireEvent.click(screen.getByTestId('this-view'));
    fireEvent.click(screen.getByRole('tab', { name: /Lines/ }));
    expect(screen.getByTestId('line-row-1').textContent).toContain('API → Store');
    fireEvent.click(screen.getByTestId('line-row-1'));
    expect(screen.getByTestId('lines-list')).toBeDefined();
    expect(screen.getByTestId('line-row-1').textContent).toContain('reads and writes [SQL]');
    fireEvent.click(screen.getByTestId('line-edit'));
    expect(screen.queryByTestId('lines-list')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: /API/ })).toBeDefined();
  });

  it('says labels in words on the bar, on by default, and turning them off takes the words away', () => {
    openContainers();
    const labels = screen.getByTestId('container-labels');
    expect(labels.textContent).toBe('Labels on');
    expect(labels.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(labels);
    expect(screen.getByTestId('container-labels').textContent).toBe('Labels off');
  });
});

describe('This view', () => {
  it('is what a press on the open view\'s name opens, says what the view holds, and closes', () => {
    open();
    expect(document.querySelector('.kit-panel')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Landscape' }));
    const panel = document.querySelector<HTMLElement>('[data-guide="board.inspector"]')!;
    expect(within(panel).getByRole('heading', { name: 'Landscape' })).toBeDefined();
    expect(within(panel).getByTestId('view-elements').textContent).toContain('2');
    expect(within(panel).getByTestId('view-lines').textContent).toContain('1');
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(document.querySelector('.kit-panel')).toBeNull();
  });

  it('gives way to what is then selected', () => {
    open();
    fireEvent.click(screen.getByRole('tab', { name: 'Landscape' }));
    fireEvent.click(document.querySelector('.react-flow__node[data-id="a1"]')!);
    expect(screen.getByRole('heading', { level: 2, name: 'A1' })).toBeDefined();
    expect(screen.queryByTestId('view-elements')).toBeNull();
  });
});
