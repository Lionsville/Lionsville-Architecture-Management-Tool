// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest';
import { laidOut } from '../model/testFixtures';
import { buildEdges } from './graph';
import type { DesignDiagram, DesignElement, DesignModel, Relation } from '../model/types';

/**
 * What a container diagram draws once an interface lands on it (ADR-0013).
 *
 * One line per landed interface and NO line to the boundary for that one —
 * never both, because the same fact drawn twice is the clutter this step
 * exists to remove. An interface that has not landed keeps the boundary line
 * it has always had, drawn exactly as before.
 *
 * The far end is hoisted the way the membership already hoists it, so a row
 * between two applications\' containers is one row shown on both diagrams.
 */

const el = (id: string, kind: DesignElement['kind'], over: Partial<DesignElement> = {}): DesignElement =>
  ({ id, kind, name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over });

const flow = (id: string, sourceId: string, targetId: string, over: Partial<Relation> = {}): Relation =>
  ({ id, type: 'flow', sourceId, targetId, isBidirectional: false, ...over });

const ELEMENTS = [
  el('wms', 'application'),
  el('wms-api', 'component', { parentId: 'wms' }),
  el('wms-events', 'component', { parentId: 'wms' }),
  el('orders', 'application'),
  el('orders-ui', 'component', { parentId: 'orders' }),
];

/** The WMS container diagram: the boundary, its two containers, Order management beside it. */
const containers = (): DesignDiagram => laidOut({
  id: 'wms-containers', kind: 'container', name: 'WMS · containers', applicationElementId: 'wms',
  placements: [
    { id: 'wms', x: 0, y: 0 },
    { id: 'wms-api', x: 60, y: 80 },
    { id: 'wms-events', x: 60, y: 220 },
    { id: 'orders', x: 600, y: 80 },
  ],
});

const landscape = (): DesignDiagram => laidOut({
  id: 'l7', kind: 'layer7', name: 'Landscape',
  placements: [{ id: 'orders', zone: 'landscape', x: 0, y: 0 }, { id: 'wms', zone: 'landscape', x: 400, y: 0 }],
});

function edges(relations: Relation[], diagram: DesignDiagram, elements = ELEMENTS) {
  const model: DesignModel = { name: 'Acme', elements, relations, diagrams: [diagram] };
  return buildEdges({ model, diagram, readOnly: false, edgeColor: '#theme' });
}

const ends = (relations: Relation[], diagram: DesignDiagram, elements = ELEMENTS) =>
  edges(relations, diagram, elements).map((edge) => [edge.id, edge.source, edge.target]);

describe('an interface that has not landed', () => {
  it('attaches to the boundary box, as an ordinary line', () => {
    expect(ends([flow('c16', 'orders', 'wms', { protocol: 'REST' })], containers()))
      .toEqual([['c16', 'orders', 'wms']]);
  });

  it('is drawn with nothing to say it might land: no badge, no dash', () => {
    const [edge] = edges([flow('c16', 'orders', 'wms', { protocol: 'REST' })], containers());
    expect(edge.data?.lineStyle).toBeUndefined();
    expect(edge.data?.protocol).toBe('REST');
  });
});

describe('an interface that has landed', () => {
  const interfaceAndLanding = [
    flow('c16', 'orders', 'wms'),
    flow('r1', 'orders', 'wms-api', { refines: 'c16', protocol: 'REST' }),
  ];

  it('draws the landing and no line to the boundary, one line per landing, hoisting the far end', () => {
    expect(ends(interfaceAndLanding, containers())).toEqual([['r1', 'orders', 'wms-api']]);
    const twice = [...interfaceAndLanding, flow('r2', 'orders', 'wms-events', { refines: 'c16', protocol: 'AMQP' })];
    expect(ends(twice, containers())).toEqual([
      ['r1', 'orders', 'wms-api'],
      ['r2', 'orders', 'wms-events'],
    ]);
    const deep = [flow('c16', 'orders', 'wms'), flow('r1', 'orders-ui', 'wms-api', { refines: 'c16' })];
    expect(ends(deep, containers())).toEqual([['r1', 'orders', 'wms-api']]);
    const inside = [flow('x1', 'orders-ui', 'orders')];
    expect(ends(inside, containers())).toEqual([]);
  });

  it('keeps the boundary line of an interface that landed somewhere else', () => {
    // A landing on another application\'s container says nothing here: this
    // diagram still draws the interface at its own boundary.
    const elsewhere = [
      ...interfaceAndLanding,
      flow('c20', 'orders', 'wms'),
    ];
    expect(ends(elsewhere, containers()).map((one) => one[0])).toEqual(['r1', 'c20']);
  });

});

describe('the landscape, with landings in the model', () => {
  it('draws the application line and never a landing', () => {
    const relations = [
      flow('c16', 'orders', 'wms'),
      flow('r1', 'orders', 'wms-api', { refines: 'c16', protocol: 'REST' }),
      flow('r2', 'orders-ui', 'wms-api', { refines: 'c16' }),
    ];
    expect(ends(relations, landscape())).toEqual([['c16', 'orders', 'wms']]);
  });
});

describe('the day the board shows', () => {
  it('gives the interface its boundary line back when the container it landed on is gone', () => {
    const elements = ELEMENTS.map((e) => (
      e.id === 'wms-api' ? { ...e, lifecycleDates: { retired: '2027-01-01' } } : e
    ));
    const relations = [flow('c16', 'orders', 'wms'), flow('r1', 'orders', 'wms-api', { refines: 'c16' })];
    const model: DesignModel = { name: 'Acme', elements, relations, diagrams: [containers()] };
    const after = buildEdges({
      model, diagram: model.diagrams[0] as DesignDiagram, readOnly: false, edgeColor: '#theme', asOfDay: '2027-06-01',
    });
    expect(after.map((edge) => edge.id)).toEqual(['c16']);
  });
});

/**
 * Which end of a line may be grabbed (ADR-0013).
 *
 * The end that means something is grabbable and the other is not: an
 * interface's boundary end lands it, a landing's own end moves it, and the far
 * end of either belongs to the other application — dragging it would re-point
 * the functional line, which is never what the gesture means.
 */
describe('the end a drag may take hold of', () => {
  const grabbable = (relations: Relation[], id: string, diagram = containers(), readOnly = false) => {
    const model: DesignModel = { name: 'Acme', elements: ELEMENTS, relations, diagrams: [diagram] };
    return buildEdges({ model, diagram, readOnly, edgeColor: '#theme' })
      .find((edge) => edge.id === id)?.reconnectable;
  };

  it('is the boundary end of an interface that has not landed', () => {
    expect(grabbable([flow('c16', 'orders', 'wms')], 'c16')).toBe('target');
    expect(grabbable([flow('c20', 'wms', 'orders')], 'c20')).toBe('source');
  });

  it('is the landing’s own end, either end where the diagram says nothing, and neither for a reader', () => {
    const landed = [flow('c16', 'orders', 'wms'), flow('r1', 'orders', 'wms-api', { refines: 'c16' })];
    expect(grabbable(landed, 'r1')).toBe('target');
    expect(grabbable([flow('x1', 'wms-api', 'wms-events')], 'x1')).toBe(true);
    expect(grabbable([flow('c16', 'orders', 'wms')], 'c16', landscape())).toBe(true);
    expect(grabbable([flow('c16', 'orders', 'wms')], 'c16', containers(), true)).toBe(false);
  });

});
