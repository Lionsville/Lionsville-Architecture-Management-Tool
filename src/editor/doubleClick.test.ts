import { describe, expect, it, vi } from 'vitest';
import { doubleClickTarget, lineDoubleClickTarget } from './doubleClick';
import type { DesignElement, DesignDiagram, Relation } from '../model';

const element = (id: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over,
});

const model = {
  elements: [
    element('erp'),
    element('wms', { ref: 'acme/logistics' }),
    element('ghost', { ref: 'nowhere' }),
    element('ops', { kind: 'actor' }),
    element('esb', { kind: 'platform' }),
    element('shared-bus', { kind: 'platform', ref: 'acme/platforms' }),
    element('brokering', { kind: 'platformService' }),
  ],
  diagrams: [
    { id: 'l7', kind: 'layer7' as const, name: 'L', members: [], geometry: { nodes: [] } },
    { id: 'cd-erp', kind: 'container' as const, name: 'ERP', applicationElementId: 'erp', members: [], geometry: { nodes: [] } },
  ],
};

describe('doubleClickTarget', () => {
  it('opens the container diagram an application has, and makes nothing for one that has none', () => {
    expect(doubleClickTarget(model, 'erp', undefined)).toEqual({ kind: 'container', diagramId: 'cd-erp' });
    // A view is made on purpose — from the menu or the inspector — never as
    // the side effect of looking for one.
    expect(doubleClickTarget({ ...model, diagrams: [] }, 'erp', undefined)).toBeUndefined();
  });

  it('shows a stand-in where it is defined, and never makes a container diagram here for it', () => {
    const show = vi.fn();
    const ownership = { ownerOf: (id: string) => (id === 'wms' ? { label: 'acme/logistics', fields: [], onShow: show } : undefined) };
    const target = doubleClickTarget(model, 'wms', ownership);
    expect(target?.kind).toBe('owner');
    if (target?.kind === 'owner') target.show();
    expect(show).toHaveBeenCalled();
  });

  it('opens a platform\'s report — here, whoever defines it (ADR-0013)', () => {
    expect(doubleClickTarget(model, 'esb', undefined)).toEqual({ kind: 'platformReport', platformId: 'esb' });
    // A stand-in of a platform another scope defines opens HERE all the same:
    // the rows the report reads are this scope's own, so it is this scope's
    // answer even where the platform is not.
    expect(doubleClickTarget(model, 'shared-bus', { ownerOf: () => ({ label: 'x', fields: [], onShow: () => {} }) }))
      .toEqual({ kind: 'platformReport', platformId: 'shared-bus' });
    // And a service's, from the other side of the realises row (ADR-0014).
    expect(doubleClickTarget(model, 'brokering', undefined)).toEqual({ kind: 'serviceReport', serviceId: 'brokering' });
  });

  it('falls through for a stand-in nobody can show, and opens a page for everything else', () => {
    expect(doubleClickTarget(model, 'ghost', { ownerOf: () => undefined })).toBeUndefined();
    expect(doubleClickTarget(model, 'ops', undefined)).toEqual({ kind: 'documentation' });
    expect(doubleClickTarget(model, 'nope', undefined)).toBeUndefined();
  });
});

/**
 * The way down from a landscape line (ADR-0013, redone).
 *
 * The target first — an interface lands at the end that answers — then the
 * source, then nothing: a view is made on purpose, not by looking for one. On
 * a container diagram the gesture is not this one at all: a double-click
 * there adds a bend.
 */
describe('a double-click on a line', () => {
  const flow = (id: string, sourceId: string, targetId: string, over: Partial<Relation> = {}): Relation =>
    ({ id, type: 'flow', sourceId, targetId, isBidirectional: false, ...over });

  const board = (kind: DesignDiagram['kind']) => ({ kind });

  const held = (relations: Relation[]) => ({
    elements: [
      element('erp'), element('billing'),
      element('erp-api', { kind: 'component', parentId: 'erp' }),
      element('wms', { ref: 'acme/logistics' }),
    ],
    relations,
    diagrams: [
      { id: 'l7', kind: 'layer7' as const, name: 'L', members: [], geometry: { nodes: [] } },
      { id: 'cd-erp', kind: 'container' as const, name: 'ERP', applicationElementId: 'erp', members: [], geometry: { nodes: [] } },
    ],
  });

  it('opens the container diagram at the end that has one, and nothing where neither does', () => {
    const relations = [
      flow('c1', 'billing', 'erp'),
      flow('r1', 'billing', 'erp-api', { refines: 'c1' }),
      flow('r2', 'billing', 'erp-api', { refines: 'c1' }),
    ];
    expect(lineDoubleClickTarget(held(relations), board('layer7'), 'c1'))
      .toEqual({ kind: 'container', diagramId: 'cd-erp', select: ['r1', 'r2'] });
    const relations2 = [flow('c2', 'erp', 'billing'), flow('r1', 'erp-api', 'billing', { refines: 'c2' })];
    expect(lineDoubleClickTarget(held(relations2), board('layer7'), 'c2'))
      .toEqual({ kind: 'container', diagramId: 'cd-erp', select: ['r1'] });
    const model = held([flow('c3', 'erp', 'billing')]);
    const bare = { ...model, diagrams: model.diagrams.filter((d) => d.kind !== 'container') };
    expect(lineDoubleClickTarget(bare, board('layer7'), 'c3')).toBeUndefined();
  });

  it('says nothing on a container diagram', () => {
    expect(lineDoubleClickTarget(held([flow('c1', 'billing', 'erp')]), board('container'), 'c1'))
      .toBeUndefined();
  });

  it('says nothing about a row that is not a line, or one that is not there', () => {
    const rows: Relation[] = [{ id: 'u1', type: 'uses', sourceId: 'erp', targetId: 'billing' }];
    expect(lineDoubleClickTarget(held(rows), board('layer7'), 'u1')).toBeUndefined();
    expect(lineDoubleClickTarget(held([]), board('layer7'), 'nowhere')).toBeUndefined();
  });
});
