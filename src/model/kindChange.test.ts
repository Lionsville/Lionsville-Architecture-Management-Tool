import { describe, expect, it } from 'vitest';
import {
  allowedKindsOn,
  canChangeKind,
  changeableKinds,
  placementForKind,
} from './kindChange';
import { NODE_MAX_SIZE, nodeMinSize } from './placement';
import { HOME_ZONE } from './zones';
import { diagram, element, model, placement } from './testFixtures';

const board = () =>
  model({
    diagrams: [
      diagram('d1', {
        placements: [
          placement('a1', { zone: 'landscape', x: 400, y: 300 }),
          placement('a2', { zone: 'externalSystems', x: 1500, y: 400 }),
          placement('c1', { zone: 'landscape', x: 500, y: 300 }),
        ],
      }),
      diagram('cd', {
        kind: 'container',
        name: 'App containers',
        applicationElementId: 'boundary',
        placements: [placement('c2')],
      }),
    ],
    elements: [
      element('a1', { kind: 'application' }),
      element('a2', { kind: 'externalSystem' }),
      element('c1', { kind: 'externalSystem' }),
      element('c2', { kind: 'component', parentApplicationId: 'boundary' }),
      element('boundary', { kind: 'application' }),
    ],
  });

const layer7 = () => board().diagrams[0];
const container = () => board().diagrams[1];

describe('allowedKindsOn', () => {
  it('mirrors the palette for each diagram kind', () => {
    expect(allowedKindsOn({ kind: 'layer7' })).not.toContain('component');
    expect(allowedKindsOn({ kind: 'container' })).toContain('component');
  });
});

describe('canChangeKind', () => {
  it('allows a straightforward change', () => {
    expect(canChangeKind(board(), layer7(), 'a2', 'application')).toEqual({ ok: true });
  });

  it('refuses the kind it already is', () => {
    expect(canChangeKind(board(), layer7(), 'a1', 'application')).toEqual({
      ok: false,
      reason: 'kindChange.sameKind',
    });
  });

  it('refuses an element this diagram does not carry', () => {
    expect(canChangeKind(board(), layer7(), 'c2', 'actor')).toEqual({
      ok: false,
      reason: 'kindChange.notOnThisDiagram',
    });
  });

  it('refuses an unknown element', () => {
    expect(canChangeKind(board(), layer7(), 'nope', 'actor').ok).toBe(false);
  });

  it('refuses a kind this diagram does not hold', () => {
    // A component needs a parent application, so Layer 7 never offers one.
    expect(canChangeKind(board(), layer7(), 'a1', 'component')).toEqual({
      ok: false,
      reason: 'kindChange.notAllowedHere',
    });
  });

  it('refuses an application that a container diagram is about', () => {
    const m = board();
    m.diagrams[0].placements.push(placement('boundary', { zone: 'landscape' }));
    expect(canChangeKind(m, m.diagrams[0], 'boundary', 'externalSystem')).toEqual({
      ok: false,
      reason: 'kindChange.hasContainerDiagram',
    });
  });

  it('refuses an application that still has components, container view or not', () => {
    // The other half of `parentApplicationId`. `a1` has no container diagram —
    // its component was placed straight onto the landscape (or the view was
    // deleted and left the component behind), so the container-diagram refusal
    // does not fire and only this one stands between the model and a component
    // parented to an external system.
    const m = board();
    m.elements = m.elements.map((e) =>
      e.id === 'c1' ? { ...e, kind: 'component' as const, parentApplicationId: 'a1' } : e,
    );
    expect(canChangeKind(m, m.diagrams[0], 'a1', 'externalSystem')).toEqual({
      ok: false,
      reason: 'kindChange.hasComponents',
    });
    // And it is the only thing stopping it: detach the component and the same
    // change goes through.
    const detached = board();
    expect(canChangeKind(detached, detached.diagrams[0], 'a1', 'externalSystem')).toEqual({
      ok: true,
    });
  });

  it('leaves an application with components nothing to change into', () => {
    const m = board();
    m.elements = m.elements.map((e) =>
      e.id === 'c1' ? { ...e, kind: 'component' as const, parentApplicationId: 'a1' } : e,
    );
    expect(changeableKinds(m, m.diagrams[0], 'a1')).toEqual([]);
  });

  it('refuses a component that still belongs to an application', () => {
    expect(canChangeKind(board(), container(), 'c2', 'actor')).toEqual({
      ok: false,
      reason: 'kindChange.hasParent',
    });
  });

  it('allows a parentless component to become something else', () => {
    const m = board();
    m.elements = m.elements.map((e) =>
      e.id === 'c2' ? { ...e, parentApplicationId: undefined } : e,
    );
    expect(canChangeKind(m, m.diagrams[1], 'c2', 'actor')).toEqual({ ok: true });
  });
});

describe('changeableKinds', () => {
  it('lists what this element could become here, and never its own kind', () => {
    const kinds = changeableKinds(board(), layer7(), 'a1');
    expect(kinds).not.toContain('application');
    expect(kinds).not.toContain('component');
    expect(kinds).toContain('actor');
    expect(kinds).toContain('externalSystem');
  });

  it('is empty for an element the rules refuse outright', () => {
    expect(changeableKinds(board(), container(), 'c2')).toEqual([]);
  });
});

describe('placementForKind', () => {
  it('leaves a landscape placement in the landscape — it holds every kind', () => {
    const next = placementForKind(placement('a1', { zone: 'landscape', x: 400, y: 300 }), 'actor', layer7());
    expect(next.zone).toBe('landscape');
    expect(next.x).toBe(400);
  });

  it('moves a band member to the new kind‘s home band', () => {
    // An external system in the external-systems band becoming an actor belongs
    // in the actors band; leaving it would put an actor in a band whose grammar
    // says external systems.
    const next = placementForKind(
      placement('a2', { zone: 'externalSystems', x: 1500, y: 400 }),
      'actor',
      layer7(),
    );
    expect(next.zone).toBe(HOME_ZONE.actor);
  });

  it('keeps a band member where it is when the band is already its home', () => {
    const next = placementForKind(
      placement('a2', { zone: 'externalSystems', x: 1500, y: 400 }),
      'externalSystem',
      layer7(),
    );
    expect(next.zone).toBe('externalSystems');
  });

  it('keeps an explicit size that still fits', () => {
    const next = placementForKind(
      placement('a1', { zone: 'landscape', width: 240, height: 160 }),
      'externalSystem',
      layer7(),
    );
    expect(next.width).toBe(240);
    expect(next.height).toBe(160);
  });

  it('clamps an explicit size the new kind cannot have', () => {
    const min = nodeMinSize('actor');
    const next = placementForKind(
      placement('a1', { zone: 'landscape', width: 10, height: 10 }),
      'actor',
      layer7(),
    );
    expect(next.width).toBe(min.width);
    expect(next.height).toBe(min.height);

    const huge = placementForKind(
      placement('a1', { zone: 'landscape', width: 9000, height: 9000 }),
      'application',
      layer7(),
    );
    expect(huge.width).toBe(NODE_MAX_SIZE.width);
    expect(huge.height).toBe(NODE_MAX_SIZE.height);
  });

  it('never invents a stored size for a placement that had none', () => {
    const next = placementForKind(placement('a1', { zone: 'landscape' }), 'actor', layer7());
    expect(next.width).toBeUndefined();
    expect(next.height).toBeUndefined();
  });

  it('leaves zones alone on a container diagram — it has no bands', () => {
    const next = placementForKind(placement('c2'), 'actor', container());
    expect(next.zone).toBeUndefined();
  });
});
