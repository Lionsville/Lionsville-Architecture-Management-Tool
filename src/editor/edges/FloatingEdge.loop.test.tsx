// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { laidOut } from '../../model/testFixtures';
import { HostedEditor } from '../testing/editorHost';
import type { EditorHostState } from '../testing/editorHost';
import { installReactFlowMocks } from '../reactFlowTestSetup';
import type { DesignModel } from '../../model/types';

/**
 * A selected line measures its chip to keep its pills off it. A measure that
 * follows what it moves brought the board down once (React's error 185): the chip's
 * box moved by a hundredth of a pixel with the place it was put, which changed
 * the side it was put on. Whatever the measure says, drawing a line settles.
 */

beforeAll(() => installReactFlowMocks());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function model(): DesignModel {
  return {
    name: 'ACME',
    elements: [
      { id: 'a1', kind: 'application', name: 'A', lifecycle: 'live', isManaged: true, aspects: {} },
      { id: 'b1', kind: 'application', name: 'B', lifecycle: 'live', isManaged: true, aspects: {} },
    ],
    relations: [{ type: 'flow', id: 'c1', sourceId: 'a1', targetId: 'b1', isBidirectional: false }],
    // A short step between two cards close together, as a line drawn at Fit is.
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [
      { id: 'a1', zone: 'landscape', x: 0, y: 0 }, { id: 'b1', zone: 'landscape', x: 240, y: 40 },
    ], edgeRoutes: [] })],
  };
}

describe('FloatingEdge — a measure that never holds still', () => {
  it('draws the selected line without an update loop', async () => {
    let calls = 0;
    const real = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (!this.classList.contains('kit-linelabel')) return real.call(this);
      calls += 1;
      // A different size every time it is asked: the worst a layout could answer.
      return { x: 0, y: 0, top: 0, left: 0, right: 120 + calls, bottom: 20 + (calls % 2) * 9, width: 120 + calls, height: 20 + (calls % 2) * 9, toJSON: () => ({}) } as DOMRect;
    });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const host = { current: undefined as unknown as EditorHostState };
    render(
      <ThemeProvider theme={createTheme()}>
        <div style={{ width: '1200px', height: '800px' }}>
          <HostedEditor model={model()} activeDiagramId="d1" onActiveDiagramChange={vi.fn()} onCreateContainerDiagram={vi.fn()} onCreateLayer7Diagram={vi.fn()} hostRef={host} />
        </div>
      </ThemeProvider>,
    );
    fireEvent.click(await screen.findByTestId('rf__edge-c1'));
    expect(await screen.findByTestId('edge-label-c1')).toBeDefined();
    expect(calls).toBeGreaterThan(0);
    // Measured a handful of times and then left alone, not fifty.
    expect(calls).toBeLessThan(20);
    expect(errors.mock.calls.some((call) => String(call[0]).includes('Maximum update depth'))).toBe(false);
  });
});
