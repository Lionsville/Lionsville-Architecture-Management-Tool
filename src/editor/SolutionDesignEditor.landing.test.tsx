// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { laidOut } from '../model/testFixtures';
import { act, cleanup, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { HostedEditor } from './testing/editorHost';
import type { EditorHostState, HostedEditorProps } from './testing/editorHost';
import { installReactFlowMocks } from './reactFlowTestSetup';
import type { DesignElement, DesignModel, Relation } from '../model/types';

/**
 * The end a landing drag may take hold of, as React Flow renders it
 * (ADR-0013, redone).
 *
 * `graph.landing.test.ts` pins what the projection SAYS; this pins that React
 * Flow does what it says — one reconnect anchor on a boundary line, at the
 * boundary, and none on the far end. That half had no test, and the gesture
 * lives or dies on it: an anchor that is not drawn cannot be grabbed.
 */

beforeAll(() => installReactFlowMocks());
const measured = () => act(async () => {});
afterEach(() => cleanup());

const el = (id: string, kind: DesignElement['kind'], over: Partial<DesignElement> = {}): DesignElement =>
  ({ id, kind, name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over });

const flow = (id: string, sourceId: string, targetId: string, over: Partial<Relation> = {}): Relation =>
  ({ id, type: 'flow', sourceId, targetId, isBidirectional: false, ...over });

function model(relations: Relation[]): DesignModel {
  return {
    name: 'Acme',
    elements: [
      el('wms', 'application'),
      el('wms-api', 'component', { parentId: 'wms' }),
      el('wms-events', 'component', { parentId: 'wms' }),
      el('orders', 'application'),
    ],
    relations,
    diagrams: [
      laidOut({
        id: 'wms-containers', kind: 'container', name: 'WMS · containers', applicationElementId: 'wms',
        placements: [
          { id: 'wms', x: 0, y: 0 },
          { id: 'wms-api', x: 80, y: 120 },
          { id: 'wms-events', x: 80, y: 300 },
          { id: 'orders', x: 620, y: 120 },
        ],
      }),
    ],
  };
}

function renderEditor(relations: Relation[], overrides: Partial<HostedEditorProps> = {}) {
  const host = { current: undefined as unknown as EditorHostState };
  const view = render(
    <ThemeProvider theme={createTheme()}>
      <div style={{ width: '1200px', height: '800px' }}>
        <HostedEditor
          model={model(relations)}
          activeDiagramId="wms-containers"
          onActiveDiagramChange={vi.fn()}
          onCreateContainerDiagram={vi.fn()}
          onCreateLayer7Diagram={vi.fn()}
          {...overrides}
          hostRef={host}
        />
      </div>
    </ThemeProvider>,
  );
  return { ...view, host };
}

/** The reconnect anchors React Flow drew on one line, by which end each is. */
const anchors = (id: string) =>
  Array.from(screen.getByTestId(`rf__edge-${id}`).querySelectorAll('.react-flow__edgeupdater'))
    .map((a) => (a.getAttribute('class') ?? '').includes('edgeupdater-target') ? 'target' : 'source');

describe('the anchor a landing drag grabs', () => {
  it('is drawn once, at the boundary, on an interface that has not landed', async () => {
    renderEditor([flow('c16', 'orders', 'wms')]);
    await measured();
    // The WMS is the target, so the anchor is the target one — and the end at
    // Order management has none, because that end is not ours to move.
    expect(anchors('c16')).toEqual(['target']);
  });

  it('is drawn once, on its own container, on a line that has landed', async () => {
    renderEditor([
      flow('c16', 'orders', 'wms'),
      flow('r1', 'orders', 'wms-api', { refines: 'c16' }),
    ]);
    await measured();
    expect(anchors('r1')).toEqual(['target']);
  });

  it('is drawn on both ends of a line between two of this application\'s own containers', async () => {
    renderEditor([flow('x1', 'wms-api', 'wms-events')]);
    await measured();
    expect(anchors('x1').sort()).toEqual(['source', 'target']);
  });

  it('is drawn on neither end for a reader', async () => {
    renderEditor([flow('c16', 'orders', 'wms')], { readOnly: true });
    await measured();
    expect(anchors('c16')).toEqual([]);
  });
});
