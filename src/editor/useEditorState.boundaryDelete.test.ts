// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { laidOut } from '../model/testFixtures';
import { act } from '@testing-library/react';
import { renderEditorState } from './testing/editorHost';
import { selectAllContent } from './useEditorState';
import type { DesignModel, Relation } from '../model/types';

/**
 * A container diagram's boundary box IS its application, and a delete over a
 * SELECTION used to take it: select-all, a rubber band over the whole board and
 * Cut all reach `deleteSelection`, which walked past the two guards that had
 * always said no to this — the tab menu's *Remove from diagram*, and the
 * single-element dialog's *Delete from model*.
 *
 * What went with it was never only the box. `reducer.deleteElement` cascades to
 * the container view itself and to every relation ending on the application, so
 * one keystroke on the container diagram took the application off the landscape
 * and its interfaces with it. The rule is `model/deletion.ts`'s; what is pinned
 * here is that the gestures obey it and that the rest of the gesture still
 * happens.
 */

const el = (id: string, over: Record<string, unknown> = {}) =>
  ({ id, kind: 'application' as const, name: id, lifecycle: 'live' as const, isManaged: true, aspects: {}, ...over });

const flow = (id: string, sourceId: string, targetId: string): Relation =>
  ({ id, type: 'flow', sourceId, targetId, isBidirectional: false });

function model(): DesignModel {
  return {
    name: 'Acme',
    elements: [
      el('wms'), el('orders'),
      el('wms-api', { kind: 'component', parentId: 'wms' }),
      el('wms-events', { kind: 'component', parentId: 'wms' }),
    ],
    relations: [flow('c16', 'orders', 'wms'), flow('x1', 'wms-api', 'orders')],
    diagrams: [
      laidOut({
        id: 'l7', kind: 'layer7', name: 'Landschap',
        placements: [{ id: 'wms', x: 0, y: 0 }, { id: 'orders', x: 400, y: 0 }],
      }),
      laidOut({
        id: 'wms-containers', kind: 'container', name: 'WMS · containers', applicationElementId: 'wms',
        placements: [
          { id: 'wms', x: 0, y: 0 },
          { id: 'wms-api', x: 60, y: 80 },
          { id: 'wms-events', x: 60, y: 220 },
          { id: 'orders', x: 600, y: 80 },
        ],
      }),
    ],
  };
}

const open = (activeDiagramId: string) => renderEditorState(model(), { activeDiagramId });
const ids = (host: { current: { model: DesignModel } }) => host.current.model.elements.map((e) => e.id);

describe('a delete over a selection on a container diagram', () => {
  it('clears the contents and leaves the boundary application standing', () => {
    const { result, host } = open('wms-containers');
    const everything = selectAllContent(model(), model().diagrams[1]);
    expect(everything.elementIds).toContain('wms');
    act(() => result.current.actions.deleteSelection(everything));
    expect(ids(host)).toContain('wms');
    expect(ids(host)).not.toContain('wms-api');
    expect(ids(host)).not.toContain('wms-events');
  });

  it('leaves the view itself, and the application where the landscape drew it', () => {
    const { result, host } = open('wms-containers');
    act(() => result.current.actions.deleteSelection(
      selectAllContent(model(), model().diagrams[1])));
    // The cascade that used to take both: the view goes with its application,
    // so keeping the application is what keeps the view.
    expect(host.current.model.diagrams.map((d) => d.id)).toContain('wms-containers');
    const landscape = host.current.model.diagrams.find((d) => d.id === 'l7')!;
    expect(landscape.members.map((m) => m.id)).toContain('wms');
  });

  it('keeps an interface a rubber band over the boxes never selected', () => {
    // Select-all takes the lines too, and a line the user selected is a line
    // they asked for. A band over the containers is not an ask about `c16`.
    const { result, host } = open('wms-containers');
    act(() => result.current.actions.deleteSelection(
      { elementIds: ['wms', 'wms-api', 'wms-events'], connectionIds: [], domainGroups: [] }));
    expect(host.current.model.relations.map((r) => r.id)).toEqual(['c16']);
  });

  it('does nothing at all where the boundary was the whole selection', () => {
    const { result, host } = open('wms-containers');
    const before = host.current.model;
    act(() => result.current.actions.deleteSelection(
      { elementIds: ['wms'], connectionIds: [], domainGroups: [] }));
    expect(host.current.model).toBe(before);
  });

  it('still deletes the same application from a landscape, where it is an ordinary card', () => {
    const { result, host } = open('l7');
    act(() => result.current.actions.deleteSelection(
      { elementIds: ['wms', 'orders'], connectionIds: [], domainGroups: [] }));
    expect(ids(host)).not.toContain('wms');
  });
});
