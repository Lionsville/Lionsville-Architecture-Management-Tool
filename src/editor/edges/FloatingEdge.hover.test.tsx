// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { laidOut } from '../../model/testFixtures';
import type { DesignElement, DesignModel } from '../../model/types';
import { HostedEditor } from '../testing/editorHost';
import { installReactFlowMocks } from '../reactFlowTestSetup';

/**
 * With line labels hidden, a line's label comes up while the pointer is on it and
 * while it is picked, for every line a board draws: on a container diagram the lines
 * between two containers inside the boundary as well as those to an application
 * outside it, and on a landscape. jsdom cannot hit-test, so what lets the pointer
 * reach a line inside the boundary at all is pinned on the sheet at the end; the
 * browser walk is what showed the boundary taking it.
 */

beforeAll(() => installReactFlowMocks());
afterEach(() => { cleanup(); vi.useRealTimers(); });

const el = (id: string, kind: DesignElement['kind'], over: Partial<DesignElement> = {}): DesignElement =>
  ({ id, kind, name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over });

function model(): DesignModel {
  return {
    name: 'Acme',
    elements: [
      el('wms', 'application'),
      el('api', 'component', { parentId: 'wms' }),
      el('db', 'component', { parentId: 'wms' }),
      el('orders', 'application'),
      el('billing', 'application'),
    ],
    relations: [
      { type: 'flow', id: 'inner', sourceId: 'api', targetId: 'db', isBidirectional: false, label: 'reads stock' },
      { type: 'flow', id: 'context', sourceId: 'orders', targetId: 'api', isBidirectional: false, label: 'places orders' },
      { type: 'flow', id: 'board', sourceId: 'orders', targetId: 'billing', isBidirectional: false, label: 'bills' },
    ],
    diagrams: [
      laidOut({
        id: 'wms-containers', kind: 'container', name: 'WMS · containers', applicationElementId: 'wms',
        placements: [
          { id: 'wms', x: 0, y: 0 },
          { id: 'api', x: 80, y: 100 },
          { id: 'db', x: 320, y: 100 },
          { id: 'orders', x: -400, y: 100 },
        ],
      }),
      laidOut({ id: 'l7', kind: 'layer7', name: 'L7', placements: [
        { id: 'orders', zone: 'landscape', x: 0, y: 0 }, { id: 'billing', zone: 'landscape', x: 300, y: 0 },
      ], edgeRoutes: [] }),
    ],
  };
}

async function renderBoard(diagram: string) {
  render(
    <ThemeProvider theme={createTheme()}>
      <div style={{ width: '1200px', height: '800px' }}>
        <HostedEditor model={model()} activeDiagramId={diagram} onActiveDiagramChange={vi.fn()} onCreateContainerDiagram={vi.fn()} onCreateLayer7Diagram={vi.fn()} />
      </div>
    </ThemeProvider>,
  );
  await act(async () => {});
}

/** Labels hidden the way the person hides them: the bar's word on a container diagram, the Show menu's choice elsewhere. */
async function hideLabels(diagram: string) {
  if (diagram === 'wms-containers') {
    const button = screen.getByTestId('container-labels');
    if (button.getAttribute('aria-pressed') === 'true') fireEvent.click(button);
  } else {
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'On hover' }));
  }
  await act(async () => {});
}

/** The group React Flow draws a line in: where the hover is carried. */
const lineGroup = (id: string) => screen.getByTestId(`rf__edge-${id}`).querySelector('g')!;

describe.each([
  ['a line between two containers inside the boundary', 'wms-containers', 'inner'],
  ['a line from an application outside the boundary', 'wms-containers', 'context'],
  ['a line on a landscape', 'l7', 'board'],
])('%s, with labels hidden', (_name, diagram, id) => {
  it('shows its label while the pointer is on it, and not after', async () => {
    await renderBoard(diagram);
    await hideLabels(diagram);
    expect(screen.queryByTestId(`edge-label-${id}`)).toBeNull();
    fireEvent.mouseEnter(lineGroup(id));
    expect(await screen.findByTestId(`edge-label-${id}`)).toBeDefined();
    vi.useFakeTimers();
    fireEvent.mouseLeave(lineGroup(id));
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(screen.queryByTestId(`edge-label-${id}`)).toBeNull();
  });

  it('shows its label while it is picked', async () => {
    await renderBoard(diagram);
    await hideLabels(diagram);
    fireEvent.click(screen.getByTestId(`rf__edge-${id}`));
    expect(await screen.findByTestId(`edge-label-${id}`)).toBeDefined();
  });
});

const boardSheet = () => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../canvas/board.css'), 'utf8');

describe('the boundary over the lines inside it', () => {

  it('lets the pointer through its box, beating React Flow\'s inline pointer-events', () => {
    expect(boardSheet()).toMatch(/\.lv-board \.react-flow__node-applicationBoundary \{ pointer-events: none !important; \}/);
  });

  it('takes it again while a line is being drawn, so a line still lands on it', () => {
    expect(boardSheet()).toMatch(/\.lv-board\[data-connecting\] \.react-flow__node-applicationBoundary \{ pointer-events: all !important; \}/);
  });

  it('takes it on its rim', () => {
    expect(boardSheet()).toMatch(/\.lv-boundary__rim \{[^}]*pointer-events: auto;/);
  });
});
