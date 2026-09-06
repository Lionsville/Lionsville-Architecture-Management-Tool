import { describe, expect, it } from 'vitest';
import { pasteOffsetFor, remapClipboard, serializeSelection, type ClipboardPayload } from './clipboard';
import { connection, diagram, element, model, placement } from './testFixtures';

/** Deterministic id minters for assertions. */
function minters() {
  let e = 0;
  let c = 0;
  return {
    mintElementId: () => `tmp-e${(e += 1)}`,
    mintConnectionId: () => `tmp-c${(c += 1)}`,
  };
}

describe('serializeSelection', () => {
  const source = model({
    diagrams: [
      diagram('d1', {
        placements: [
          placement('10', { x: 100, y: 100 }),
          placement('11', { x: 300, y: 100 }),
          // 12 exists in the model but is NOT placed on d1.
        ],
      }),
    ],
    elements: [element('10'), element('11'), element('12')],
    connections: [
      connection('20', '10', '11', { label: 'uses' }),
      connection('21', '11', '12'), // 12 not selected → excluded
    ],
  });
  const d1 = source.diagrams[0];

  it('captures placed elements, their placements, and internal connections only', () => {
    const payload = serializeSelection(source, d1, ['10', '11', '12']);
    expect(payload).toBeDefined();
    expect(payload!.elements.map((e) => e.id).sort()).toEqual(['10', '11']);
    expect(payload!.placements.map((p) => p.elementId).sort()).toEqual(['10', '11']);
    // Only 20 has both endpoints placed+selected; 21 touches the unplaced 12.
    expect(payload!.connections.map((c) => c.id)).toEqual(['20']);
  });

  it('returns undefined when no requested element is placed on the diagram', () => {
    expect(serializeSelection(source, d1, ['12'])).toBeUndefined();
    expect(serializeSelection(source, d1, [])).toBeUndefined();
  });

  it('deep-copies so the payload is independent of the model', () => {
    const payload = serializeSelection(source, d1, ['10'])!;
    payload.elements[0].name = 'mutated';
    expect(source.elements.find((e) => e.id === '10')!.name).not.toBe('mutated');
  });
});

describe('remapClipboard', () => {
  const payload = (): ClipboardPayload => ({
    elements: [
      element('app', { kind: 'application', name: 'Webshop' }),
      element('comp', { kind: 'component', name: 'API', parentApplicationId: 'app' }),
    ],
    connections: [connection('c-int', 'app', 'comp', { label: 'hosts' })],
    placements: [
      placement('app', { x: 100, y: 100, zone: 'landscape', domainGroup: 'Commerce' }),
      placement('comp', { x: 140, y: 160 }),
    ],
  });

  it('mints fresh ids and rewires every reference', () => {
    const out = remapClipboard(payload(), {
      ...minters(),
      offset: { x: 10, y: 20 },
      target: { kind: 'layer7', domainGroupNames: new Set(['Commerce']) },
    });

    expect(out.elements.map((e) => e.id)).toEqual(['tmp-e1', 'tmp-e2']);
    // The copied component keeps pointing at the copied parent's NEW id.
    expect(out.elements[1].parentApplicationId).toBe('tmp-e1');
    // Connection endpoints follow the same map; the connection id is fresh.
    expect(out.connections[0]).toMatchObject({
      id: 'tmp-c1',
      sourceId: 'tmp-e1',
      targetId: 'tmp-e2',
      label: 'hosts',
    });
    // Placements are offset and re-keyed; the known group survives.
    expect(out.placements).toEqual([
      { elementId: 'tmp-e1', x: 110, y: 120, zone: 'landscape', domainGroup: 'Commerce' },
      { elementId: 'tmp-e2', x: 150, y: 180, zone: undefined, domainGroup: undefined },
    ]);
  });

  it('drops a domain group the target diagram does not define', () => {
    const out = remapClipboard(payload(), {
      ...minters(),
      offset: { x: 0, y: 0 },
      target: { kind: 'layer7', domainGroupNames: new Set() },
    });
    expect(out.placements[0].domainGroup).toBeUndefined();
    expect(out.placements[0].zone).toBe('landscape');
  });

  it('strips zone/group and repoints orphaned components when pasting into a container', () => {
    const single: ClipboardPayload = {
      elements: [element('comp', { kind: 'component', parentApplicationId: 'app' })],
      connections: [],
      placements: [placement('comp', { x: 5, y: 5, zone: 'landscape', domainGroup: 'X' })],
    };
    const out = remapClipboard(single, {
      ...minters(),
      offset: { x: 0, y: 0 },
      target: { kind: 'container', applicationElementId: 'boundary-app' },
    });
    // Parent wasn't copied → adopt the container's boundary application.
    expect(out.elements[0].parentApplicationId).toBe('boundary-app');
    expect(out.placements[0]).toMatchObject({ zone: undefined, domainGroup: undefined });
  });

  it('drops a parent reference that is neither copied nor a container adoption', () => {
    const single: ClipboardPayload = {
      elements: [element('a', { kind: 'application', parentApplicationId: 'gone' })],
      connections: [],
      placements: [placement('a')],
    };
    const out = remapClipboard(single, {
      ...minters(),
      offset: { x: 0, y: 0 },
      target: { kind: 'layer7' },
    });
    expect(out.elements[0].parentApplicationId).toBeUndefined();
  });
});

describe('pasteOffsetFor', () => {
  const payload: ClipboardPayload = {
    elements: [],
    connections: [],
    placements: [
      { elementId: 'a', x: 300, y: 500 },
      { elementId: 'b', x: 100, y: 700 },
    ],
  };

  it('shifts the payload so its top-left corner lands on the point', () => {
    const offset = pasteOffsetFor(payload, { x: 1000, y: 40 });
    expect(offset).toEqual({ x: 900, y: -460 });
    // Applied, the leftmost and topmost placements sit exactly on the point.
    const xs = payload.placements.map((p) => p.x + offset.x);
    const ys = payload.placements.map((p) => p.y + offset.y);
    expect(Math.min(...xs)).toBe(1000);
    expect(Math.min(...ys)).toBe(40);
  });

  it('is a no-op offset for an empty payload', () => {
    expect(pasteOffsetFor({ elements: [], connections: [], placements: [] }, { x: 5, y: 5 })).toEqual({
      x: 0,
      y: 0,
    });
  });
});
