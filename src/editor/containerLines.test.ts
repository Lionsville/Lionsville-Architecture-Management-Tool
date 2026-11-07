// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest';
import type { DesignDiagram, DesignElement, DesignModel, Relation } from '../model/types';
import { containerFacts, diagramLines } from './containerLines';
import { buildEdges, buildNodes } from './graph';

const el = (id: string, kind: DesignElement['kind'], over: Partial<DesignElement> = {}): DesignElement =>
  ({ id, kind, name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over });
const flow = (id: string, sourceId: string, targetId: string, over: Partial<Relation> = {}): Relation =>
  ({ type: 'flow', id, sourceId, targetId, isBidirectional: false, ...over }) as Relation;

const diagram: DesignDiagram = {
  id: 'c', kind: 'container', name: 'App · containers', applicationElementId: 'app',
  members: ['app', 'api', 'db', 'buyer', 'other'].map((id) => ({ id })),
  geometry: {
    nodes: [
      { id: 'app', x: 0, y: 0, width: 600, height: 400 },
      { id: 'api', x: 50, y: 50 }, { id: 'db', x: 300, y: 50 },
      { id: 'buyer', x: -300, y: 0 }, { id: 'other', x: 700, y: 0 },
    ],
  },
} as unknown as DesignDiagram;

const model: DesignModel = {
  name: 'Acme',
  elements: [
    el('app', 'application'),
    el('api', 'component', { parentId: 'app', technology: 'Java' }),
    el('db', 'component', { parentId: 'app', shapeVariant: 'store' }),
    el('buyer', 'actor'),
    el('other', 'application'),
  ],
  relations: [
    flow('r1', 'api', 'db', { label: 'reads', protocol: 'SQL', validFrom: '2027-01-01' }),
    flow('r2', 'buyer', 'app', { label: 'orders' }),
    flow('r3', 'other', 'api'),
  ],
  diagrams: [diagram],
} as unknown as DesignModel;

describe('a container diagram, as data', () => {
  it('numbers its lines the way the canvas does, and says which reach only the application', () => {
    const lines = diagramLines(model, diagram, undefined);
    expect(lines.map((line) => [line.number, line.from, line.to, line.unlanded])).toEqual([
      [1, 'api', 'db', false], [2, 'buyer', 'app', true], [3, 'other', 'api', false],
    ]);
    const edges = buildEdges({ model, diagram, readOnly: true, edgeColor: '' });
    expect(edges.map((edge) => edge.data?.number)).toEqual([1, 2, 3]);
  });

  it('keeps to the day: a line not yet valid is neither drawn nor listed', () => {
    expect(diagramLines(model, diagram, '2026-01-01').map((line) => line.id)).toEqual(['r2', 'r3']);
  });

  it('says what its key has to explain, and nothing that is not drawn', () => {
    const facts = containerFacts(model, diagram, undefined);
    expect(facts).toMatchObject({ containers: 2, around: 2, lines: 3 });
    expect([...facts.drawn].sort()).toEqual(['application', 'container', 'line', 'person', 'store', 'unlanded']);
  });

  it('gives a box its room and its place on the level', () => {
    const nodes = buildNodes({ model, diagram, readOnly: true, edgeColor: '' });
    const of = (id: string) => nodes.find((node) => node.id === id)!;
    expect(of('buyer').data.c4Context).toBe(true);
    expect(of('api').data.c4Context).toBeUndefined();
    expect(of('app').data.c4Empty).toBeUndefined();
    expect(of('buyer').height).toBeGreaterThanOrEqual(100);
  });

  it('says a landscape card holds what it holds', () => {
    const landscape = { id: 'l', kind: 'layer7', name: 'L', members: [{ id: 'app' }], geometry: { nodes: [{ id: 'app', zone: 'landscape', x: 0, y: 0 }] } } as unknown as DesignDiagram;
    const nodes = buildNodes({ model: { ...model, diagrams: [diagram, landscape] }, diagram: landscape, readOnly: true, edgeColor: '' });
    expect(nodes[0]?.data).toMatchObject({ hasContainerDiagram: true, containerCount: 2 });
  });

  it('says an empty boundary is empty', () => {
    const empty = { ...model, elements: model.elements.filter((one) => one.kind !== 'component'), relations: [] };
    const nodes = buildNodes({ model: empty, diagram, readOnly: true, edgeColor: '' });
    expect(nodes.find((node) => node.id === 'app')?.data.c4Empty).toBe(true);
  });
});
