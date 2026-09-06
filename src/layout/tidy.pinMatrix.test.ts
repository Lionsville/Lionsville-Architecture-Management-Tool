import { describe, expect, it } from 'vitest';
import { DEFAULT_TIDY_OPTIONS, tidyContainer, tidyLayer7, type TidyOptions } from './tidy';
import type { DesignModel, DiagramPlacement } from '../model/types';

/**
 * The four cells of box-position × member-layout (feedback item 2).
 *
 * The two pins are independent, so the interesting assertions are about which
 * half moved and which did not — a test that only checks "something happened"
 * passes for three of the four cells.
 */
function landscape(): DesignModel {
  const element = (id: string) => ({
    id,
    kind: 'application' as const,
    name: id,
    lifecycle: 'live' as const,
    isManaged: true,
    aspects: {},
    parameters: {},
  });
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: ['a1', 'a2', 'b1', 'b2', 'loose'].map(element),
    connections: [
      { id: 'a1-b1', sourceId: 'a1', targetId: 'b1', isBidirectional: false },
      { id: 'a1-a2', sourceId: 'a1', targetId: 'a2', isBidirectional: false },
    ],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          { elementId: 'a1', zone: 'landscape', domainGroup: 'Alpha', x: 240, y: 300 },
          { elementId: 'a2', zone: 'landscape', domainGroup: 'Alpha', x: 240, y: 460 },
          { elementId: 'b1', zone: 'landscape', domainGroup: 'Beta', x: 800, y: 300 },
          { elementId: 'b2', zone: 'landscape', domainGroup: 'Beta', x: 800, y: 460 },
          { elementId: 'loose', zone: 'landscape', x: 1300, y: 700 },
        ],
        layoutConfig: {
          domainGroups: [
            { name: 'Alpha', x: 200, y: 250, width: 300, height: 400 },
            { name: 'Beta', x: 760, y: 250, width: 300, height: 400 },
          ],
        },
      },
    ],
  };
}

const options = (over: Partial<TidyOptions>): TidyOptions => ({ ...DEFAULT_TIDY_OPTIONS, ...over });

const byId = (placements: DiagramPlacement[]) =>
  new Map(placements.map((p) => [p.elementId, p]));

/** Member positions relative to their own group's top-left — the "arrangement". */
function interiorOf(result: { placements: DiagramPlacement[]; domainGroups?: { name: string; x: number; y: number }[] }, group: string) {
  const box = result.domainGroups?.find((g) => g.name === group);
  const members = result.placements.filter((p) => p.domainGroup === group);
  return members
    .map((m) => ({ id: m.elementId, dx: m.x - (box?.x ?? 0), dy: m.y - (box?.y ?? 0) }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

describe('Tidy — box position × member layout', () => {
  it('(free, free): ELK places everything', async () => {
    const model = landscape();
    const before = byId(model.diagrams[0].placements);
    const result = await tidyLayer7(model, model.diagrams[0], DEFAULT_TIDY_OPTIONS);
    const after = byId(result.placements);
    // Something moved, and the group boxes were rebuilt from member bounds.
    expect(after.get('a1')).not.toEqual(before.get('a1'));
    expect(result.domainGroups?.map((g) => g.name).sort()).toEqual(['Alpha', 'Beta']);
  });

  it('(pinned box, free members): the box keeps its top-left, members reflow inside', async () => {
    const model = landscape();
    const result = await tidyLayer7(model, model.diagrams[0], options({ pinGroups: true }));

    const alpha = result.domainGroups?.find((g) => g.name === 'Alpha');
    expect(alpha).toMatchObject({ x: 200, y: 250 });
    // The interior was re-laid-out, so it is NOT the arrangement we started with.
    expect(interiorOf(result, 'Alpha')).not.toEqual([
      { id: 'a1', dx: 40, dy: 50 },
      { id: 'a2', dx: 40, dy: 210 },
    ]);
    // Loose nodes are left alone — with the boxes fixed there is nowhere to
    // reflow them to without walking over one.
    expect(byId(result.placements).get('loose')).toMatchObject({ x: 1300, y: 700 });
  });

  it('(free box, pinned members): the boxes move and each interior travels verbatim', async () => {
    const model = landscape();
    const result = await tidyLayer7(model, model.diagrams[0], options({ pinGroupContents: true }));

    // The arrangement INSIDE each group is byte-identical to what went in...
    expect(interiorOf(result, 'Alpha')).toEqual([
      { id: 'a1', dx: 40, dy: 50 },
      { id: 'a2', dx: 40, dy: 210 },
    ]);
    expect(interiorOf(result, 'Beta')).toEqual([
      { id: 'b1', dx: 40, dy: 50 },
      { id: 'b2', dx: 40, dy: 210 },
    ]);
    // ...and the box sizes are kept, not re-derived from members.
    expect(result.domainGroups?.find((g) => g.name === 'Alpha')).toMatchObject({
      width: 300,
      height: 400,
    });
    // The boxes themselves DID move — otherwise this cell would be the next one.
    expect(result.domainGroups?.find((g) => g.name === 'Alpha')).not.toMatchObject({
      x: 200,
      y: 250,
    });
  });

  it('(free box, pinned members): loose nodes ARE placed, unlike with a pinned box', async () => {
    // `pinGroups`'s carve-out is about pinned POSITIONS and does not transfer:
    // here the boxes move, so ELK can place the loose nodes too, and it should.
    const model = landscape();
    const result = await tidyLayer7(model, model.diagrams[0], options({ pinGroupContents: true }));
    expect(byId(result.placements).get('loose')).not.toMatchObject({ x: 1300, y: 700 });
  });

  it('(pinned box, pinned members): nothing in the landscape moves at all', async () => {
    const model = landscape();
    const before = byId(model.diagrams[0].placements);
    const result = await tidyLayer7(
      model,
      model.diagrams[0],
      options({ pinGroups: true, pinGroupContents: true }),
    );
    const after = byId(result.placements);

    for (const id of ['a1', 'a2', 'b1', 'b2', 'loose']) {
      expect(after.get(id)).toMatchObject({ x: before.get(id)!.x, y: before.get(id)!.y });
    }
    expect(result.domainGroups?.find((g) => g.name === 'Alpha')).toMatchObject({
      x: 200,
      y: 250,
      width: 300,
      height: 400,
    });
    // The pass is still worth running: the edges were re-routed.
    expect(result.edgeRoutes).toBeDefined();
  });

  it('sizes a group with NO stored rect from its members instead of emitting a zero box', async () => {
    // A domain group exists as soon as a placement names it; its rect only exists
    // once a Tidy or a drag wrote one. That is a normal state, not an edge case,
    // and a zero-sized leaf would collapse the group under ELK.
    const model = landscape();
    model.diagrams[0].layoutConfig = { domainGroups: [] };
    const result = await tidyLayer7(model, model.diagrams[0], options({ pinGroupContents: true }));

    const alpha = result.domainGroups?.find((g) => g.name === 'Alpha');
    expect(alpha!.width).toBeGreaterThan(0);
    expect(alpha!.height).toBeGreaterThan(0);
    // Still rigid: the interior arrangement is preserved even with a derived box.
    const interior = interiorOf(result, 'Alpha');
    expect(interior[1].dy - interior[0].dy).toBe(160);
  });

  it('keeps a group’s colour through a pinned-contents pass', async () => {
    const model = landscape();
    model.diagrams[0].layoutConfig!.domainGroups![0].color = '#ff8800';
    const result = await tidyLayer7(model, model.diagrams[0], options({ pinGroupContents: true }));
    expect(result.domainGroups?.find((g) => g.name === 'Alpha')?.color).toBe('#ff8800');
  });
});

function container(): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: [
      { id: 'app', kind: 'application', name: 'Webshop', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'c1', kind: 'component', parentApplicationId: 'app', name: 'API', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'c2', kind: 'component', parentApplicationId: 'app', name: 'DB', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'ext', kind: 'externalSystem', name: 'PSP', lifecycle: 'live', isManaged: false, aspects: {}, parameters: {} },
    ],
    connections: [{ id: 'c1-ext', sourceId: 'c1', targetId: 'ext', isBidirectional: false }],
    diagrams: [
      {
        id: 'd2',
        kind: 'container',
        name: 'Webshop',
        applicationElementId: 'app',
        placements: [
          { elementId: 'app', x: 160, y: 200, width: 640, height: 400 },
          { elementId: 'c1', x: 200, y: 260 },
          { elementId: 'c2', x: 400, y: 260 },
          { elementId: 'ext', x: 160, y: 40 },
        ],
      },
    ],
  };
}

describe('Tidy — the pins on a container diagram, where the group is the boundary', () => {
  it('keeps the components’ arrangement and the boundary size when contents are pinned', async () => {
    const model = container();
    const result = await tidyContainer(model, model.diagrams[0], options({ pinGroupContents: true }));
    const after = byId(result.placements);

    // The components moved as one piece with the boundary: their offsets from it,
    // and from each other, are unchanged.
    const boundary = after.get('app')!;
    expect(after.get('c1')!.x - boundary.x).toBe(40);
    expect(after.get('c2')!.x - after.get('c1')!.x).toBe(200);
    expect(boundary).toMatchObject({ width: 640, height: 400 });
  });

  it('re-lays-out the components when contents are not pinned', async () => {
    const model = container();
    const result = await tidyContainer(model, model.diagrams[0], DEFAULT_TIDY_OPTIONS);
    const after = byId(result.placements);
    // The boundary is sized by ELK to hug what it laid out, not kept verbatim.
    expect(after.get('app')!.width).not.toBe(640);
  });
});

describe('Tidy — hybrid direction', () => {
  it('flows the group boxes across and the members down inside each one', async () => {
    const model = landscape();
    const result = await tidyLayer7(model, model.diagrams[0], options({ direction: 'hybrid' }));
    const alpha = result.domainGroups!.find((g) => g.name === 'Alpha')!;
    const beta = result.domainGroups!.find((g) => g.name === 'Beta')!;
    const after = byId(result.placements);

    // ACROSS: the root flow is RIGHT, so the box at the target end of the
    // cross-group edge (a1 → b1) is placed further along x.
    expect(beta.x).toBeGreaterThan(alpha.x);

    // DOWN: inside each box the members form a COLUMN — same x, separated on y.
    // This is the half that does not happen at all under INCLUDE_CHILDREN, where
    // a compound node's own direction is silently ignored.
    expect(after.get('a1')!.x).toBe(after.get('a2')!.x);
    expect(after.get('b1')!.x).toBe(after.get('b2')!.x);
    expect(after.get('a1')!.y).not.toBe(after.get('a2')!.y);
  });

  it('is the only direction that stacks members — the others lay them out in a row', async () => {
    // The measurement hybrid exists because of: with the default hierarchy
    // handling, `root=RIGHT, group=DOWN` produces the identical layout to
    // `root=RIGHT, group=inherit`. So per-group direction and SEPARATE_CHILDREN
    // are one feature; either alone is a no-op or an unasked-for change.
    const model = landscape();
    const across = await tidyLayer7(model, model.diagrams[0], options({ direction: 'horizontal' }));
    const members = byId(across.placements);
    expect(members.get('a1')!.x).not.toBe(members.get('a2')!.x);
  });

  it('keeps the zone grammar: every member stays in the landscape band', async () => {
    // The invariant hybrid must not touch. Only the landscape zone's INTERNAL
    // flow changes; the five zones keep their fixed semantics and order.
    const model = landscape();
    const result = await tidyLayer7(model, model.diagrams[0], options({ direction: 'hybrid' }));
    for (const placement of result.placements) {
      expect(placement.zone ?? 'landscape').toBe('landscape');
    }
  });
});
