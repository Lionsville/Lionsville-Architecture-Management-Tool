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
