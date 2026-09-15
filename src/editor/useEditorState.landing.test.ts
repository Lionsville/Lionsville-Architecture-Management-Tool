// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { laidOut } from '../model/testFixtures';
import { act } from '@testing-library/react';
import { renderEditorState } from './testing/editorHost';
import type { DesignModel, Relation } from '../model/types';

/**
 * Landing an interface, as the gestures do it (ADR-0013, redone).
 *
 * The rule itself is `model/refines.test.ts`\'s and the writer\'s; what is
 * pinned here is that each gesture is ONE step over the real reducer, that the
 * step it makes is the one the gesture means, and that ⌘Z takes it back.
 */

const el = (id: string, over: Record<string, unknown> = {}) =>
  ({ id, kind: 'application' as const, name: id, lifecycle: 'live' as const, isManaged: true, aspects: {}, ...over });

function model(relations: Relation[]): DesignModel {
  return {
    name: 'Acme',
    elements: [
      el('wms'), el('orders'),
      el('wms-api', { kind: 'component', parentId: 'wms' }),
      el('wms-events', { kind: 'component', parentId: 'wms' }),
      el('orders-ui', { kind: 'component', parentId: 'orders' }),
    ],
    relations,
    diagrams: [
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

const flow = (id: string, sourceId: string, targetId: string, over: Partial<Relation> = {}): Relation =>
  ({ id, type: 'flow', sourceId, targetId, isBidirectional: false, ...over });

const open = (relations: Relation[]) =>
  renderEditorState(model(relations), { activeDiagramId: 'wms-containers' });

type Host = { current: { model: DesignModel; history: { undo(): void } } };
const rows = (host: Host) => host.current.model.relations;
const landings = (host: Host, id: string) => rows(host).filter((r) => r.refines === id);

describe('landing an interface', () => {
  it('makes a container line refining it, carrying the protocol down, and never re-ends the interface', () => {
    const { result, host } = open([flow('c16', 'orders', 'wms', { label: 'asks', protocol: 'REST' })]);
    act(() => result.current.actions.landInterface('c16', 'wms-api'));
    const landed = landings(host, 'c16');
    expect(landed).toHaveLength(1);
    expect(landed[0]).toMatchObject({ sourceId: 'orders', targetId: 'wms-api', protocol: 'REST' });
    const held = rows(host).find((r) => r.id === 'c16')!;
    // The functional line keeps its ends and its label, and loses the protocol
    // it can no longer answer for.
    expect(held).toMatchObject({ sourceId: 'orders', targetId: 'wms', label: 'asks' });
    expect(held.protocol).toBeUndefined();
  });

  it('is one step: ⌘Z puts the interface back on the boundary, protocol and all', () => {
    const before = model([flow('c16', 'orders', 'wms', { protocol: 'REST' })]);
    const { result, host } = open(before.relations);
    act(() => result.current.actions.landInterface('c16', 'wms-api'));
    act(() => host.current.history.undo());
    expect(rows(host)).toEqual(before.relations);
  });

  it('takes the direction down and leaves the window and the label up', () => {
    const { result, host } = open([
      flow('c16', 'orders', 'wms', { label: 'asks', isBidirectional: true, validFrom: '2027-01-01' }),
    ]);
    act(() => result.current.actions.landInterface('c16', 'wms-api'));
    const landed = landings(host, 'c16')[0];
    expect(landed.isBidirectional).toBe(true);
    expect(landed.label).toBeUndefined();
    expect(landed.validFrom).toBeUndefined();
  });

  it('refuses a container that is not this application\'s', () => {
    const { result, host } = open([flow('c16', 'orders', 'wms')]);
    act(() => result.current.actions.landInterface('c16', 'orders-ui'));
    expect(landings(host, 'c16')).toEqual([]);
  });
});

describe('moving and removing a landing', () => {
  const landed = [
    flow('c16', 'orders', 'wms'),
    flow('r1', 'orders', 'wms-api', { refines: 'c16', protocol: 'REST' }),
  ];

  it('moves the landed end to another container, and nothing else', () => {
    const { result, host } = open(landed);
    act(() => result.current.actions.moveLanding('r1', 'wms-events'));
    expect(rows(host).find((r) => r.id === 'r1')).toMatchObject({
      sourceId: 'orders', targetId: 'wms-events', refines: 'c16', protocol: 'REST',
    });
  });

  it('removes the landing when it goes back to the boundary, leaving the interface written as it was', () => {
    const { result, host } = open(landed);
    act(() => result.current.actions.removeLanding('r1'));
    expect(rows(host).map((r) => r.id)).toEqual(['c16']);
  });

  it('detaches a landing into an interface of its own, keeping the line', () => {
    const { result, host } = open(landed);
    act(() => result.current.actions.detachLanding('r1'));
    expect(rows(host).find((r) => r.id === 'r1')).toMatchObject({ targetId: 'wms-api', protocol: 'REST' });
    expect(rows(host).find((r) => r.id === 'r1')!.refines).toBeUndefined();
  });
});

describe('a container line drawn by hand', () => {
  it('takes the one interface running that way, so the common case needs no answer', () => {
    const { result, host } = open([flow('c16', 'orders', 'wms', { label: 'asks' })]);
    act(() => { result.current.actions.connect('orders', 'wms-events'); });
    const drawn = rows(host).find((r) => r.targetId === 'wms-events')!;
    expect(drawn.refines).toBe('c16');
  });

  it('asks nobody and lands nothing when several interfaces run that way', () => {
    const { result, host } = open([
      flow('c16', 'orders', 'wms', { label: 'asks' }),
      flow('c17', 'orders', 'wms', { label: 'tells' }),
    ]);
    act(() => { result.current.actions.connect('orders', 'wms-events'); });
    expect(rows(host).find((r) => r.targetId === 'wms-events')!.refines).toBeUndefined();
  });

  it('leaves a line with no interface to be part of as one of its own', () => {
    const { result, host } = open([]);
    act(() => { result.current.actions.connect('orders', 'wms-api'); });
    expect(rows(host).find((r) => r.targetId === 'wms-api')!.refines).toBeUndefined();
  });

  it('leaves an application line alone: only a container line is ever part of one', () => {
    const { result, host } = open([flow('c16', 'orders', 'wms', { label: 'asks' })]);
    act(() => { result.current.actions.connect('orders', 'wms'); });
    expect(rows(host).filter((r) => r.sourceId === 'orders' && r.targetId === 'wms')
      .every((r) => r.refines === undefined)).toBe(true);
  });
});
