// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { laidOut } from '../model/testFixtures';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { HostedEditor } from './testing/editorHost';
import type { EditorHostState, HostedEditorProps } from './testing/editorHost';
import { installReactFlowMocks } from './reactFlowTestSetup';
import type { DesignElement, DesignModel, Relation } from '../model/types';

/**
 * The deployment boxes on a container diagram (ADR-0013, redone).
 *
 * `model/deployment.test.ts` pins which containers belong in which box; what
 * is pinned here is that the boxes are drawn around them at all, nested, that
 * the toggle takes them away, and that a reader may flip it — what a view
 * shows is theirs to change even where the writing is not.
 */

beforeAll(() => installReactFlowMocks());
const measured = () => act(async () => {});
afterEach(() => cleanup());

const el = (id: string, kind: DesignElement['kind'], over: Partial<DesignElement> = {}): DesignElement =>
  ({ id, kind, name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over });

function model(): DesignModel {
  return {
    name: 'Acme',
    elements: [
      el('wms', 'application'),
      el('wms-api', 'component', { parentId: 'wms' }),
      el('wms-db', 'component', { parentId: 'wms' }),
      el('wms-loose', 'component', { parentId: 'wms' }),
      el('openshift', 'platform', { name: 'OpenShift', platformCategory: 'runtime' }),
      el('ns', 'platform', { name: 'Logistics namespace', parentId: 'openshift' }),
    ],
    relations: [
      { id: 'h1', type: 'hostedOn', sourceId: 'wms-api', targetId: 'ns' },
      { id: 'h2', type: 'hostedOn', sourceId: 'wms-db', targetId: 'openshift' },
    ] as Relation[],
    diagrams: [
      laidOut({
        id: 'wms-containers', kind: 'container', name: 'WMS · containers', applicationElementId: 'wms',
        placements: [
          { id: 'wms', x: 0, y: 0 },
          { id: 'wms-api', x: 80, y: 100 },
          { id: 'wms-db', x: 320, y: 100 },
          { id: 'wms-loose', x: 80, y: 340 },
        ],
      }),
    ],
  };
}

function renderEditor(overrides: Partial<HostedEditorProps> = {}) {
  const host = { current: undefined as unknown as EditorHostState };
  const view = render(
    <ThemeProvider theme={createTheme()}>
      <div style={{ width: '1200px', height: '800px' }}>
        <HostedEditor
          model={model()}
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

const boxes = () => screen.queryAllByTestId('lv-deployment-box')
  .map((box) => box.getAttribute('data-platform'));

describe('the deployment boxes', () => {
  it('draws one per platform the containers run on, nested, outermost first', async () => {
    renderEditor();
    await measured();
    expect(boxes()).toEqual(['openshift', 'ns']);
  });

  it('says the platform\'s name and its sort on the box', async () => {
    renderEditor();
    await measured();
    const ns = screen.getAllByTestId('lv-deployment-box')
      .find((box) => box.getAttribute('data-platform') === 'ns');
    expect(ns?.textContent).toContain('Logistics namespace');
    expect(ns?.textContent).toContain('Tooling');
  });

  it('draws the inner box inside the outer one', async () => {
    renderEditor();
    await measured();
    const rect = (id: string) => {
      const box = screen.getAllByTestId('lv-deployment-box')
        .find((held) => held.getAttribute('data-platform') === id)!;
      return {
        left: parseFloat(box.style.left), top: parseFloat(box.style.top),
        width: parseFloat(box.style.width), height: parseFloat(box.style.height),
      };
    };
    const outer = rect('openshift');
    const inner = rect('ns');
    expect(inner.left).toBeGreaterThan(outer.left);
    expect(inner.top).toBeGreaterThan(outer.top);
    expect(inner.left + inner.width).toBeLessThan(outer.left + outer.width);
  });

  it('draws nothing at all on a landscape', async () => {
    const held = model();
    held.diagrams.push(laidOut({ id: 'l7', kind: 'layer7', name: 'L7', placements: [{ id: 'wms', zone: 'landscape', x: 0, y: 0 }] }));
    renderEditor({ model: held, activeDiagramId: 'l7' });
    await measured();
    expect(boxes()).toEqual([]);
  });
});

describe('the toggle', () => {
  const press = () => fireEvent.click(screen.getByLabelText('Deployment boxes'));

  it('takes the boxes away and keeps the answer on the view', async () => {
    const { host } = renderEditor();
    await measured();
    press();
    await measured();
    expect(boxes()).toEqual([]);
    expect(host.current.model.diagrams[0].showDeployment).toBe(false);
  });

  it('is not offered on a view that has nothing to draw them around', async () => {
    const held = model();
    held.diagrams.push(laidOut({ id: 'l7', kind: 'layer7', name: 'L7', placements: [] }));
    renderEditor({ model: held, activeDiagramId: 'l7' });
    await measured();
    expect(screen.queryByLabelText('Deployment boxes')).toBeNull();
  });

  it('still works for a reader, who may change what a view shows without writing it', async () => {
    const { host } = renderEditor({ readOnly: true });
    await measured();
    press();
    await measured();
    expect(boxes()).toEqual([]);
    // Nothing written: the stored answer is still what everybody else opens on.
    expect(host.current.model.diagrams[0].showDeployment).toBeUndefined();
  });
});
