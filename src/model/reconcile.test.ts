import { describe, expect, it } from 'vitest';
import {
  EMPTY_OVERLAY,
  overlayWithConnection,
  overlayWithConnectionDeleted,
  overlayWithEdgeRoute,
  overlayWithElement,
  overlayWithElementDeleted,
  overlayWithLayoutConfig,
  overlayWithPlacement,
  overlayWithPlacementRemoved,
  overlayIsEmpty,
} from './overlay';
import { reconcileOverlay, remapOverlayIds, type EmittedElementSnapshot } from './reconcile';
import { connection, diagram, element, model, placement } from './testFixtures';

const previous = model({
  diagrams: [diagram('d1', { placements: [placement('1', { x: 10, y: 10, zone: 'landscape' })] })],
  elements: [element('1', { name: 'CRM' })],
  connections: [],
});

describe('reconcileOverlay — value-based clearing', () => {
  it('drops an edited element once the incoming model reflects it', () => {
    const edited = element('1', { name: 'CRM v2' });
    const overlay = overlayWithElement(EMPTY_OVERLAY, edited);
    const incoming = model({ ...previous, elements: [edited] });

    const result = reconcileOverlay({
      previous,
      incoming,
      overlay,
      emittedElements: [],
      emittedConnections: [],
    });
    expect(result.overlay.elements.size).toBe(0);
    expect(result.mustEmit).toBe(false);
  });

  it('keeps an in-flight edit the incoming model does not have yet (local wins)', () => {
    const overlay = overlayWithElement(EMPTY_OVERLAY, element('1', { name: 'CRM v3' }));
    const incoming = model({ ...previous, elements: [element('1', { name: 'CRM v2' })] });

    const result = reconcileOverlay({
      previous,
      incoming,
      overlay,
      emittedElements: [],
      emittedConnections: [],
    });
    expect(result.overlay.elements.get('1')?.name).toBe('CRM v3');
  });

  it('clears placement upserts/removals and deletions the server applied', () => {
    let overlay = overlayWithPlacement(EMPTY_OVERLAY, 'd1', placement('1', { x: 50, y: 60, zone: 'landscape' }));
    overlay = overlayWithPlacementRemoved(overlay, 'd1', 'gone');
    overlay = overlayWithElementDeleted(overlay, previous, 'dead');
    overlay = overlayWithConnectionDeleted(overlay, 'c-dead');

    const incoming = model({
      diagrams: [diagram('d1', { placements: [placement('1', { x: 50, y: 60, zone: 'landscape' })] })],
      elements: [element('1', { name: 'CRM' })],
      connections: [],
    });

    const result = reconcileOverlay({
      previous,
      incoming,
      overlay,
      emittedElements: [],
      emittedConnections: [],
    });
    expect(overlayIsEmpty(result.overlay)).toBe(true);
  });

  it('keeps a pending style edit the incoming model has not round-tripped yet', () => {
    // Everything but the accent colour matches, so an equality check that skipped
    // the style fields would read this as reflected and revert the colour.
    const overlay = overlayWithElement(EMPTY_OVERLAY, element('1', { name: 'CRM', accentColor: '#ff0000' }));
    const incoming = model({ ...previous, elements: [element('1', { name: 'CRM' })] });

    const result = reconcileOverlay({
      previous,
      incoming,
      overlay,
      emittedElements: [],
      emittedConnections: [],
    });
    expect(result.overlay.elements.get('1')?.accentColor).toBe('#ff0000');
  });

  it('keeps a pending connection style edit until the incoming model reflects it', () => {
    const base = model({
      ...previous,
      connections: [connection('c1', '1', '1')],
    });
    const overlay = overlayWithConnection(EMPTY_OVERLAY, connection('c1', '1', '1', { lineStyle: 'dashed' }));

    const stale = reconcileOverlay({
      previous: base,
      incoming: base,
      overlay,
      emittedElements: [],
      emittedConnections: [],
    });
    expect(stale.overlay.connections.get('c1')?.lineStyle).toBe('dashed');

    const reflected = reconcileOverlay({
      previous: base,
      incoming: model({ ...base, connections: [connection('c1', '1', '1', { lineStyle: 'dashed' })] }),
      overlay,
      emittedElements: [],
      emittedConnections: [],
    });
    expect(reflected.overlay.connections.size).toBe(0);
  });

  it('keeps a delete pending while the incoming model still contains the element', () => {
    const overlay = overlayWithElementDeleted(EMPTY_OVERLAY, previous, '1');
    const result = reconcileOverlay({
      previous,
      incoming: previous,
      overlay,
      emittedElements: [],
      emittedConnections: [],
    });
    expect(result.overlay.deletedElementIds.has('1')).toBe(true);
  });
});

describe('reconcileOverlay — temp id resolution', () => {
  const snapshot: EmittedElementSnapshot = {
    tempId: 'tmp-a',
    kind: 'application',
    name: 'Webshop',
    placement: { diagramId: 'd1', x: 400, y: 300 },
  };

  function withCreated() {
    let overlay = overlayWithElement(EMPTY_OVERLAY, element('tmp-a', { name: 'Webshop' }));
    overlay = overlayWithPlacement(
      overlay,
      'd1',
      placement('tmp-a', { x: 400, y: 300, zone: 'landscape' }),
    );
    return overlay;
  }

  const incomingSaved = model({
    diagrams: [
      diagram('d1', {
        placements: [
          placement('1', { x: 10, y: 10, zone: 'landscape' }),
          placement('77', { x: 400, y: 300, zone: 'landscape' }),
        ],
      }),
    ],
    elements: [element('1', { name: 'CRM' }), element('77', { name: 'Webshop' })],
    connections: [],
  });

  it('matches a saved temp element by kind + emitted name + placement and clears it', () => {
    const result = reconcileOverlay({
      previous,
      incoming: incomingSaved,
      overlay: withCreated(),
      emittedElements: [snapshot],
      emittedConnections: [],
    });
    expect(result.elementAliases.get('tmp-a')).toBe('77');
    expect(overlayIsEmpty(result.overlay)).toBe(true);
  });

  it('re-keys newer in-flight edits onto the real id (rename after emit survives)', () => {
    const overlay = overlayWithElement(withCreated(), element('tmp-a', { name: 'Webshop EU' }));
    const result = reconcileOverlay({
      previous,
      incoming: incomingSaved,
      overlay,
      emittedElements: [snapshot], // server saw "Webshop"
      emittedConnections: [],
    });
    expect(result.overlay.elements.get('77')?.name).toBe('Webshop EU');
    expect(result.overlay.elements.get('77')?.id).toBe('77');
    expect(result.overlay.elements.has('tmp-a')).toBe(false);
  });

  it('disambiguates same-name candidates by placement distance', () => {
    const incoming = model({
      diagrams: [
        diagram('d1', {
          placements: [
            placement('70', { x: 1200, y: 800, zone: 'landscape' }),
            placement('71', { x: 401, y: 299, zone: 'landscape' }),
          ],
        }),
      ],
      elements: [element('70', { name: 'Webshop' }), element('71', { name: 'Webshop' })],
      connections: [],
    });
    const result = reconcileOverlay({
      previous,
      incoming,
      overlay: withCreated(),
      emittedElements: [snapshot],
      emittedConnections: [],
    });
    expect(result.elementAliases.get('tmp-a')).toBe('71');
  });

  it('rewrites parent and connection references to resolved real ids', () => {
    let overlay = withCreated();
    overlay = overlayWithElement(
      overlay,
      element('tmp-b', { kind: 'component', name: 'API', parentApplicationId: 'tmp-a' }),
    );
    overlay = overlayWithConnection(overlay, connection('tmp-c', '1', 'tmp-a', { label: 'syncs' }));

    const result = reconcileOverlay({
      previous,
      incoming: incomingSaved,
      overlay,
      emittedElements: [snapshot],
      emittedConnections: [],
    });
    expect(result.overlay.elements.get('tmp-b')?.parentApplicationId).toBe('77');
    expect(result.overlay.connections.get('tmp-c')?.targetId).toBe('77');
  });

  it('matches temp connections on resolved endpoints + label and clears them', () => {
    let overlay = withCreated();
    overlay = overlayWithConnection(overlay, connection('tmp-c', '1', 'tmp-a', { label: 'syncs' }));

    const incoming = model({
      ...incomingSaved,
      connections: [connection('90', '1', '77', { label: 'syncs' })],
    });
    const result = reconcileOverlay({
      previous,
      incoming,
      overlay,
      emittedElements: [snapshot],
      emittedConnections: [
        { tempId: 'tmp-c', sourceId: '1', targetId: 'tmp-a', label: 'syncs', isBidirectional: false },
      ],
    });
    expect(result.connectionAliases.get('tmp-c')).toBe('90');
    expect(overlayIsEmpty(result.overlay)).toBe(true);
  });

  it('does not match when the emitted name differs (no false positives)', () => {
    const result = reconcileOverlay({
      previous,
      incoming: incomingSaved,
      overlay: withCreated(),
      emittedElements: [{ ...snapshot, name: 'Different' }],
      emittedConnections: [],
    });
    expect(result.elementAliases.size).toBe(0);
    expect(result.overlay.elements.has('tmp-a')).toBe(true);
  });

  it('authoritative connection aliases disambiguate identical parallel connections', () => {
    // Two indistinguishable A→B connections: endpoint+label matching would
    // alias them by iteration order; the server's map says the order is crossed.
    let overlay = withCreated();
    overlay = overlayWithConnection(overlay, connection('tmp-c1', '1', 'tmp-a', {}));
    overlay = overlayWithConnection(overlay, connection('tmp-c2', '1', 'tmp-a', {}));

    const incoming = model({
      ...incomingSaved,
      connections: [connection('90', '1', '77', {}), connection('91', '1', '77', {})],
    });
    const emitted = [
      { tempId: 'tmp-c1', sourceId: '1', targetId: 'tmp-a' as const, isBidirectional: false },
      { tempId: 'tmp-c2', sourceId: '1', targetId: 'tmp-a' as const, isBidirectional: false },
    ];

    const result = reconcileOverlay({
      previous,
      incoming,
      overlay,
      emittedElements: [snapshot],
      emittedConnections: emitted,
      knownConnectionAliases: new Map([
        ['tmp-c1', '91'],
        ['tmp-c2', '90'],
      ]),
    });
    expect(result.connectionAliases.get('tmp-c1')).toBe('91');
    expect(result.connectionAliases.get('tmp-c2')).toBe('90');
  });

  it('authoritative element alias wins even when the heuristic cannot match (rename)', () => {
    // Renamed after emit: the heuristic finds no kind+name match, but the
    // server's map still resolves the temp id.
    const result = reconcileOverlay({
      previous,
      incoming: incomingSaved,
      overlay: withCreated(),
      emittedElements: [{ ...snapshot, name: 'Different' }],
      emittedConnections: [],
      knownElementAliases: new Map([['tmp-a', '77']]),
    });
    expect(result.elementAliases.get('tmp-a')).toBe('77');
    expect(overlayIsEmpty(result.overlay)).toBe(true);
  });

  it('falls back to heuristic matching for temp ids the known maps do not cover', () => {
    const result = reconcileOverlay({
      previous,
      incoming: incomingSaved,
      overlay: withCreated(),
      emittedElements: [snapshot],
      emittedConnections: [],
      knownElementAliases: new Map([['tmp-other', '1']]),
    });
    expect(result.elementAliases.get('tmp-a')).toBe('77');
  });

  it('turns a raced temp delete into a real delete and asks for a re-emit', () => {
    // Created, emitted, deleted locally — and the save landed anyway.
    let overlay = withCreated();
    overlay = overlayWithElementDeleted(overlay, model({ elements: [element('tmp-a')] }), 'tmp-a');

    const result = reconcileOverlay({
      previous,
      incoming: incomingSaved,
      overlay,
      emittedElements: [snapshot],
      emittedConnections: [],
    });
    expect(result.mustEmit).toBe(true);
    expect(result.overlay.deletedElementIds.has('77')).toBe(true);
    expect(result.overlay.deletedTempElementIds.size).toBe(0);
  });
});

describe('reconcileOverlay — edge routes & layoutConfig', () => {
  const reconcileWith = (overlay: Parameters<typeof reconcileOverlay>[0]['overlay'], incoming = previous) =>
    reconcileOverlay({ previous, incoming, overlay, emittedElements: [], emittedConnections: [] });

  it('drops a route upsert once the incoming diagram reflects it', () => {
    const overlay = overlayWithEdgeRoute(EMPTY_OVERLAY, 'd1', {
      connectionId: 'c1',
      waypoints: [{ x: 10, y: 20 }],
    });
    const incoming = model({
      ...previous,
      diagrams: [
        diagram('d1', {
          placements: previous.diagrams[0].placements,
          edgeRoutes: [{ connectionId: 'c1', waypoints: [{ x: 10, y: 20 }] }],
        }),
      ],
    });
    expect(overlayIsEmpty(reconcileWith(overlay, incoming).overlay)).toBe(true);
  });

  it('keeps a route upsert with differing incoming waypoints (in-flight wins)', () => {
    const overlay = overlayWithEdgeRoute(EMPTY_OVERLAY, 'd1', {
      connectionId: 'c1',
      waypoints: [{ x: 10, y: 20 }],
    });
    const result = reconcileWith(overlay);
    expect(result.overlay.edgeRoutes.get('d1')?.get('c1')?.waypoints).toEqual([{ x: 10, y: 20 }]);
  });

  it('clears a delete marker once the incoming diagram has no route', () => {
    const overlay = overlayWithEdgeRoute(EMPTY_OVERLAY, 'd1', {
      connectionId: 'c1',
      waypoints: [],
    });
    expect(overlayIsEmpty(reconcileWith(overlay).overlay)).toBe(true);
  });

  it('keeps the delete marker while the incoming diagram still has the route', () => {
    const overlay = overlayWithEdgeRoute(EMPTY_OVERLAY, 'd1', {
      connectionId: 'c1',
      waypoints: [],
    });
    const incoming = model({
      ...previous,
      diagrams: [
        diagram('d1', {
          placements: previous.diagrams[0].placements,
          edgeRoutes: [{ connectionId: 'c1', waypoints: [{ x: 1, y: 1 }] }],
        }),
      ],
    });
    const result = reconcileWith(overlay, incoming);
    expect(result.overlay.edgeRoutes.get('d1')?.get('c1')?.waypoints).toEqual([]);
  });

  it('routes keyed by a temp connection follow its alias', () => {
    let overlay = overlayWithConnection(EMPTY_OVERLAY, connection('tmp-c', '1', '1b', { label: 'syncs' }));
    overlay = overlayWithEdgeRoute(overlay, 'd1', {
      connectionId: 'tmp-c',
      waypoints: [{ x: 10, y: 20 }],
    });
    const prev = model({ ...previous, elements: [element('1'), element('1b')] });
    const incoming = model({
      ...prev,
      connections: [connection('90', '1', '1b', { label: 'syncs' })],
    });
    const result = reconcileOverlay({
      previous: prev,
      incoming,
      overlay,
      emittedElements: [],
      emittedConnections: [
        { tempId: 'tmp-c', sourceId: '1', targetId: '1b', label: 'syncs', isBidirectional: false },
      ],
    });
    expect(result.overlay.edgeRoutes.get('d1')?.get('90')?.connectionId).toBe('90');
    expect(result.overlay.edgeRoutes.get('d1')?.has('tmp-c')).toBe(false);
  });

  it('drops a layoutConfig upsert once the incoming diagram reflects it, else keeps it', () => {
    const config = {
      zones: { actors: { size: 240 } },
      domainGroups: [{ name: 'Commerce', x: 1, y: 2, width: 300, height: 200 }],
    };
    const overlay = overlayWithLayoutConfig(EMPTY_OVERLAY, 'd1', config);
    // Not reflected yet → kept.
    expect(reconcileWith(overlay).overlay.layoutConfigs.get('d1')).toEqual(config);
    // Reflected → dropped.
    const incoming = model({
      ...previous,
      diagrams: [
        diagram('d1', { placements: previous.diagrams[0].placements, layoutConfig: config }),
      ],
    });
    expect(overlayIsEmpty(reconcileWith(overlay, incoming).overlay)).toBe(true);
  });

  it('keeps a label-position change pending until the diagram round-trips it', () => {
    const route = { connectionId: 'c1', waypoints: [], labelPosition: { x: 12, y: 34 } };
    const overlay = overlayWithEdgeRoute(EMPTY_OVERLAY, 'd1', route);
    // The same connection with no anchor (or another anchor) does not clear it…
    expect(reconcileWith(overlay).overlay.edgeRoutes.get('d1')?.get('c1')).toEqual(route);
    // …the round-tripped anchor does.
    const incoming = model({
      ...previous,
      diagrams: [
        diagram('d1', { placements: previous.diagrams[0].placements, edgeRoutes: [route] }),
      ],
    });
    expect(overlayIsEmpty(reconcileWith(overlay, incoming).overlay)).toBe(true);
  });

  it('treats a canvas size change as a pending layoutConfig edit (iteration 3)', () => {
    const config = { canvas: { width: 2400, height: 1600 } };
    const overlay = overlayWithLayoutConfig(EMPTY_OVERLAY, 'd1', config);
    // A diagram without the grown canvas does NOT clear the pending edit…
    const withoutCanvas = model({
      ...previous,
      diagrams: [diagram('d1', { placements: previous.diagrams[0].placements, layoutConfig: {} })],
    });
    expect(reconcileWith(overlay, withoutCanvas).overlay.layoutConfigs.get('d1')).toEqual(config);
    // …a diagram that reflects it does.
    const withCanvas = model({
      ...previous,
      diagrams: [
        diagram('d1', { placements: previous.diagrams[0].placements, layoutConfig: config }),
      ],
    });
    expect(overlayIsEmpty(reconcileWith(overlay, withCanvas).overlay)).toBe(true);
  });

  it('keeps a card resize pending until the placement round-trips width/height', () => {
    const resized = placement('1', { x: 10, y: 10, zone: 'landscape', width: 320, height: 200 });
    const overlay = overlayWithPlacement(EMPTY_OVERLAY, 'd1', resized);
    // Same x/y but no width/height yet → the resize is still pending.
    expect(reconcileWith(overlay).overlay.placements.get('d1')?.get('1')).toEqual(resized);
    // Round-tripped size → cleared.
    const incoming = model({
      ...previous,
      diagrams: [diagram('d1', { placements: [resized] })],
    });
    expect(overlayIsEmpty(reconcileWith(overlay, incoming).overlay)).toBe(true);
  });
});

describe('remapOverlayIds (U7 undo-stack reconcile-remap)', () => {
  const elementAliases = new Map([['t1', 'r1']]);
  const connectionAliases = new Map([['tc1', 'rc1']]);

  it('rewrites a stack entry holding a tempId to the reconciled server id', () => {
    let overlay = overlayWithElement(EMPTY_OVERLAY, element('t1', { name: 'CRM' }));
    overlay = overlayWithPlacement(overlay, 'd1', placement('t1', { x: 5, y: 6 }));

    const out = remapOverlayIds(overlay, elementAliases, new Map());
    expect(out.elements.has('r1')).toBe(true);
    expect(out.elements.has('t1')).toBe(false);
    expect(out.elements.get('r1')?.id).toBe('r1');
    expect(out.placements.get('d1')?.has('r1')).toBe(true);
    expect(out.placements.get('d1')?.get('r1')?.elementId).toBe('r1');
  });

  it('composes element then connection aliases like reconcileOverlay (endpoints + id follow)', () => {
    let overlay = overlayWithElement(EMPTY_OVERLAY, element('t1'));
    // A temp connection whose SOURCE is the temp element: the element alias must
    // rewrite the endpoint AND the connection alias must rewrite the id.
    overlay = overlayWithConnection(overlay, connection('tc1', 't1', 'r0'));

    const out = remapOverlayIds(overlay, elementAliases, connectionAliases);
    expect(out.connections.has('rc1')).toBe(true);
    expect(out.connections.has('tc1')).toBe(false);
    expect(out.connections.get('rc1')?.id).toBe('rc1');
    expect(out.connections.get('rc1')?.sourceId).toBe('r1'); // endpoint via element alias
    expect(out.connections.get('rc1')?.targetId).toBe('r0');
  });

  it('leaves entries without the aliased id untouched', () => {
    const overlay = overlayWithElement(EMPTY_OVERLAY, element('other'));
    const out = remapOverlayIds(overlay, elementAliases, connectionAliases);
    expect(out.elements.has('other')).toBe(true);
  });

  it('returns the overlay unchanged when both alias maps are empty', () => {
    const overlay = overlayWithElement(EMPTY_OVERLAY, element('t1'));
    expect(remapOverlayIds(overlay, new Map(), new Map())).toBe(overlay);
  });
});
