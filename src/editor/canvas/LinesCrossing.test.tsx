// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { laidOut } from '../../model/testFixtures';
import { HostedEditor } from '../testing/editorHost';
import type { EditorHostState } from '../testing/editorHost';
import { installReactFlowMocks } from '../reactFlowTestSetup';
import type { DesignElement, DesignModel, Relation } from '../../model/types';

/**
 * The check for lines through boxes, run once a container diagram has settled:
 * it reads each line's path off the drawn canvas by the line's id, and must do
 * that for any id, in a page that has no `CSS.escape` as well.
 */

beforeAll(() => installReactFlowMocks());
afterEach(() => { cleanup(); vi.useRealTimers(); });

const el = (id: string, kind: DesignElement['kind'], over: Partial<DesignElement> = {}): DesignElement =>
  ({ id, kind, name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over });

function model(): DesignModel {
  return {
    name: 'Acme',
    elements: [el('shop', 'application'), el('shop-api', 'component', { parentId: 'shop' }), el('shop-db', 'component', { parentId: 'shop' })],
    relations: [{ id: 'line "one"', type: 'flow', sourceId: 'shop-api', targetId: 'shop-db' }] as Relation[],
    diagrams: [laidOut({
      id: 'shop-containers', kind: 'container', name: 'Shop · containers', applicationElementId: 'shop',
      placements: [{ id: 'shop', x: 0, y: 0 }, { id: 'shop-api', x: 80, y: 100 }, { id: 'shop-db', x: 320, y: 100 }],
    })],
  };
}

describe('the lines-through-boxes check on a container diagram', () => {
  it('reads the lines once settled, an id with quotes in it too, and says nothing where none crosses a box', async () => {
    vi.useFakeTimers();
    const host = { current: undefined as unknown as EditorHostState };
    render(
      <ThemeProvider theme={createTheme()}>
        <div style={{ width: '1200px', height: '800px' }}>
          <HostedEditor model={model()} activeDiagramId="shop-containers" onActiveDiagramChange={vi.fn()}
            onCreateContainerDiagram={vi.fn()} onCreateLayer7Diagram={vi.fn()} hostRef={host} />
        </div>
      </ThemeProvider>,
    );
    vi.stubGlobal('CSS', undefined);
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    } finally {
      vi.unstubAllGlobals();
    }
    expect(screen.queryByTestId('lines-crossing')).toBeNull();
  });
});
