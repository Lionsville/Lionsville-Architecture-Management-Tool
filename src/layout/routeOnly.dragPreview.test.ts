import { describe, expect, it } from 'vitest';
import { routeDiagramEdges } from './routeOnly';
import { diagramWithLivePlacements } from '../model/placement';
import { manualRouteIds } from '../model/routes';
import type { DesignModel } from '../model/types';

/**
 * **The drop must be a visual no-op.** This is the invariant the whole drag preview
 * rests on: what the board draws while a card is moving has to be what the board
 * draws once the card has landed, or the preview has merely moved the snap earlier.
 *
 * The test is deliberately built out of the two calls as the product makes them,
 * not out of a shared helper — a helper that both sides call proves the helper is
 * deterministic and nothing else. The preview routes a diagram carrying live
 * placements; the drag-end pass routes the diagram after those placements have been
 * committed. Equality of the two is the property.
 *
 * The fixture competes for channels on purpose: four parallel edges past one
 * obstacle. On an uncrowded board every routing variant agrees, which is exactly
 * what made subset routing look correct on the real E-Commerce board until it was
 * measured on a crowded one.
 */
function boardModel(): DesignModel {
  const ids = ['s1', 's2', 's3', 's4', 't1', 't2', 't3', 't4'];
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: ids.map((id) => ({
      id,
      kind: 'application' as const,
      name: id,
      lifecycle: 'live' as const,
      isManaged: true,
      aspects: {},
      parameters: {},
    })),
    connections: [1, 2, 3, 4].map((n) => ({
      id: `c${n}`,
      sourceId: `s${n}`,
      targetId: `t${n}`,
      isBidirectional: false,
    })),
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        autoRoute: true,
        placements: [
          ...[1, 2, 3, 4].map((n) => ({
            elementId: `s${n}`,
            zone: 'landscape' as const,
            x: 100,
            y: 100 + n * 160,
          })),
          ...[1, 2, 3, 4].map((n) => ({
            elementId: `t${n}`,
            zone: 'landscape' as const,
            x: 1200,
            y: 100 + n * 160,
          })),
        ],
        layoutConfig: {
          domainGroups: [{ name: 'Wall', x: 600, y: 120, width: 120, height: 700 }],
        },
      },
    ],
  };
}

/** Exactly what `useDragRoutePreview` runs, minus React. */
const preview = (model: DesignModel, moves: { elementId: string; x: number; y: number }[]) => {
  const diagram = model.diagrams[0];
  return routeDiagramEdges(
    model,
    diagramWithLivePlacements(diagram, moves),
    'keep-stored',
    undefined,
    manualRouteIds(diagram),
  );
};

/** Exactly what the editor's drag-end pass runs, on the committed board. */
const dragEnd = (model: DesignModel) => {
  const diagram = model.diagrams[0];
  return routeDiagramEdges(model, diagram, 'keep-stored', undefined, manualRouteIds(diagram));
};

/** The model as it is once the drop has committed `moves`. */
function committed(
  model: DesignModel,
  moves: { elementId: string; x: number; y: number }[],
): DesignModel {
  return {
    ...model,
    diagrams: [diagramWithLivePlacements(model.diagrams[0], moves), ...model.diagrams.slice(1)],
  };
}

describe('drag preview — the drop is a no-op', () => {
  it('previews exactly the geometry the drag-end pass then commits', async () => {
    const model = boardModel();
    const moves = [{ elementId: 's3', x: 420, y: 700 }];

    const previewed = await preview(model, moves);
    const landed = await dragEnd(committed(model, moves));

    expect(previewed.edgeRoutes).toEqual(landed.edgeRoutes);
    // Guard against the test passing on an empty board: something must have routed,
    // and something must have bent, or "equal" is a statement about nothing.
    expect(previewed.edgeRoutes!.length).toBe(4);
    expect(previewed.edgeRoutes!.some((r) => r.waypoints.length > 0)).toBe(true);
  });

  it('holds for a multi-node drag', async () => {
    const model = boardModel();
    const moves = [
      { elementId: 's2', x: 300, y: 300 },
      { elementId: 't4', x: 980, y: 240 },
    ];

    expect((await preview(model, moves)).edgeRoutes).toEqual(
      (await dragEnd(committed(model, moves))).edgeRoutes,
    );
  });

  it('is not vacuous: moving a card DOES change the routes', async () => {
    const model = boardModel();
    const before = await dragEnd(model);
    const after = await preview(model, [{ elementId: 's3', x: 420, y: 700 }]);

    // If this ever passes, the two assertions above are comparing a board with
    // itself and prove nothing at all.
    expect(after.edgeRoutes).not.toEqual(before.edgeRoutes);
  });

  it('leaves a manual route alone, mid-drag and on the drop alike', async () => {
    const model = boardModel();
    const diagram = model.diagrams[0];
    const stored = {
      connectionId: 'c2',
      waypoints: [{ x: 640, y: 60 }],
      labelPosition: { x: 640, y: 40 },
      source: 'manual' as const,
    };
    diagram.edgeRoutes = [stored];

    const moves = [{ elementId: 's3', x: 420, y: 700 }];
    const previewed = await preview(model, moves);
    const landed = await dragEnd(committed(model, moves));

    // A manual route rerouted mid-drag but preserved on drop would snap BACK on
    // release — the same bug this feature removes, wearing a different hat.
    expect(previewed.edgeRoutes!.find((r) => r.connectionId === 'c2')).toEqual(stored);
    expect(landed.edgeRoutes!.find((r) => r.connectionId === 'c2')).toEqual(stored);
    expect(previewed.edgeRoutes).toEqual(landed.edgeRoutes);
  });
});
