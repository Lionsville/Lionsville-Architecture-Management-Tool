import { describe, expect, it } from 'vitest';
import { apply, fromArrays, toArrays } from '../model';
import type { HostModel } from '../model/fromInterchange';
import { connection, diagram, element, model, placement } from '../model/testFixtures';
import { buildEdges, buildNodes } from './graph';

/**
 * What the derive hands back when nothing changed.
 *
 * `React.memo` on the seven node components and on the edge compares props by
 * identity, so a projection that builds a fresh object per row every time gives
 * it nothing to compare and every box on the board re-renders for a change that
 * was nowhere near it. These are the rules that stop that: a row that says the
 * same thing keeps the object it had, a list in which nothing moved comes back
 * as the list itself, and a row that DID change is a new object — which matters
 * exactly as much, because a stale object is a box that does not repaint.
 */

const host: HostModel = model({
  elements: [
    element('a', { name: 'Alpha' }),
    element('b', { name: 'Beta' }),
    element('c', { name: 'Gamma' }),
  ],
  connections: [connection('a-b', 'a', 'b'), connection('b-c', 'b', 'c')],
  diagrams: [
    diagram('landscape', {
      placements: [
        placement('a', { x: 0, y: 0 }),
        placement('b', { x: 400, y: 0 }),
        placement('c', { x: 800, y: 0 }),
      ],
    }),
    diagram('other', { name: 'Other', placements: [placement('a', { x: 10, y: 10 })] }),
  ],
});

const argsOf = (m: HostModel, extra: Record<string, unknown> = {}) => ({
  model: m,
  diagram: m.diagrams[0],
  readOnly: false,
  edgeColor: '#888',
  ...extra,
});

/** The model with one command applied, back in the shape the canvas is handed. */
function after(command: Parameters<typeof apply>[1]): HostModel {
  const result = apply(fromArrays(host), command);
  if (!result.ok) throw new Error(`the reducer refused: ${result.reason}`);
  return toArrays(result.model);
}

describe('deriving nodes twice', () => {
  it('hands back the very list it was given when nothing changed', () => {
    const nodes = buildNodes(argsOf(host));
    expect(buildNodes(argsOf(host), nodes)).toBe(nodes);
  });

  it('builds fresh objects when there is nothing to compare against', () => {
    const nodes = buildNodes(argsOf(host));
    const again = buildNodes(argsOf(host));
    expect(again).not.toBe(nodes);
    expect(again[0]).not.toBe(nodes[0]);
  });

  it('replaces only the element that was edited', () => {
    const nodes = buildNodes(argsOf(host));
    const renamed = after({ type: 'element.update', id: 'b', patch: { name: 'Beta 2' } });
    const next = buildNodes(argsOf(renamed), nodes);
    expect(next).not.toBe(nodes);
    expect(next[0]).toBe(nodes[0]);
    expect(next[1]).not.toBe(nodes[1]);
    expect(next[1].data.element.name).toBe('Beta 2');
    expect(next[2]).toBe(nodes[2]);
  });

  it('replaces only the element that moved', () => {
    const nodes = buildNodes(argsOf(host));
    const dragged = after({
      type: 'placement.set', diagramId: 'landscape', placements: [{ elementId: 'c', x: 900, y: 60 }],
    });
    const next = buildNodes(argsOf(dragged), nodes);
    expect(next[0]).toBe(nodes[0]);
    expect(next[1]).toBe(nodes[1]);
    expect(next[2].position).toEqual({ x: 900, y: 60 });
  });

  it('replaces only what the selection moved on or off', () => {
    const nodes = buildNodes(argsOf(host, { selectedElementIds: new Set(['a']) }));
    const next = buildNodes(argsOf(host, { selectedElementIds: new Set(['b']) }), nodes);
    expect(next[0]).not.toBe(nodes[0]);
    expect(next[1]).not.toBe(nodes[1]);
    expect(next[2]).toBe(nodes[2]);
  });

  it('replaces every node when a toggle on every node changes', () => {
    const nodes = buildNodes(argsOf(host, { showLifecycle: true }));
    const next = buildNodes(argsOf(host, { showLifecycle: false }), nodes);
    for (const [n, node] of next.entries()) expect(node).not.toBe(nodes[n]);
  });

  it('is not fooled by a change on a diagram it is not drawing', () => {
    const nodes = buildNodes(argsOf(host));
    const elsewhere = after({ type: 'diagram.rename', id: 'other', name: 'Renamed' });
    expect(buildNodes(argsOf(elsewhere), nodes)).toBe(nodes);
  });
});

describe('deriving edges twice', () => {
  it('hands back the very list it was given when nothing changed', () => {
    const edges = buildEdges(argsOf(host));
    expect(buildEdges(argsOf(host), edges)).toBe(edges);
  });

  it('replaces only the connection that was edited', () => {
    const edges = buildEdges(argsOf(host));
    const relabelled = after({ type: 'connection.update', id: 'b-c', patch: { label: 'publishes' } });
    const next = buildEdges(argsOf(relabelled), edges);
    expect(next[0]).toBe(edges[0]);
    expect(next[1]).not.toBe(edges[1]);
    expect(next[1].data?.label).toBe('publishes');
  });

  it('replaces the edges whose anchors a move changed, and no others', () => {
    const edges = buildEdges(argsOf(host));
    const dragged = after({
      type: 'placement.set', diagramId: 'landscape', placements: [{ elementId: 'a', x: 0, y: 300 }],
    });
    const next = buildEdges(argsOf(dragged), edges);
    expect(next[0]).not.toBe(edges[0]);
    expect(next[1]).toBe(edges[1]);
  });

  it('replaces only the connection the selection moved on', () => {
    const edges = buildEdges(argsOf(host, { selectedConnectionIds: new Set(['a-b']) }));
    const next = buildEdges(argsOf(host, { selectedConnectionIds: new Set<string>() }), edges);
    expect(next[0]).not.toBe(edges[0]);
    expect(next[1]).toBe(edges[1]);
  });
});

describe('the diagrams the file shape is built from', () => {
  it('keeps the object of a diagram no command touched', () => {
    const indexed = fromArrays(host);
    const before = toArrays(indexed);
    const result = apply(indexed, { type: 'diagram.rename', id: 'landscape', name: 'Board' });
    if (!result.ok) throw new Error('refused');
    const next = toArrays(result.model);
    expect(next.diagrams[1]).toBe(before.diagrams[1]);
    expect(next.diagrams[0]).not.toBe(before.diagrams[0]);
  });

  it('answers with the same object twice for the same indexed diagram', () => {
    const indexed = fromArrays(host);
    expect(toArrays(indexed).diagrams[0]).toBe(toArrays(indexed).diagrams[0]);
  });
});
