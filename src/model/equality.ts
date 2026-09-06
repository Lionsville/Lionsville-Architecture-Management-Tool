import type {
  DesignConnection,
  DesignElement,
  DesignParameters,
  DiagramLayoutConfig,
  DiagramPlacement,
  EdgeRoute,
  ResizableZone,
} from './types';
import { routeSource } from './routes';

/**
 * Field-by-field equality used by reconciliation to decide whether the host's
 * refreshed model now reflects a local edit (then the local overlay entry can
 * be dropped). `undefined` and "absent" are treated as equal so DTO round-trips
 * that normalise empty strings/nulls do not keep entries alive forever.
 *
 * Every persisted field participates, including the U6a element style
 * (accentColor/shapeVariant/iconKey/iconSize) and U4b connection style (color/lineStyle/
 * routing/arrowheads). Leaving those out would read a pending style edit as
 * already round-tripped and drop it, reverting the colour on the next save.
 */

const PARAMETER_KEYS: (keyof DesignParameters)[] = [
  'complexity',
  'maturity',
  'cloudNativeness',
  'coCreationFactor',
  'serviceLevel',
  'quantity',
  'pricePerItem',
  'period',
];

const RESIZABLE_ZONES: ResizableZone[] = [
  'actors',
  'inputChannels',
  'externalSystems',
  'management',
];

function sameOptional(a: unknown, b: unknown): boolean {
  return (a ?? undefined) === (b ?? undefined);
}

function aspectsEqual(a: DesignElement['aspects'], b: DesignElement['aspects']): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const entryA = a[key];
    const entryB = b[key];
    if (!entryA || !entryB) {
      if ((entryA ?? undefined) !== (entryB ?? undefined)) return false;
      continue;
    }
    if (entryA.status !== entryB.status || !sameOptional(entryA.note, entryB.note)) return false;
  }
  return true;
}

export function elementsEqual(a: DesignElement, b: DesignElement): boolean {
  if (a.id !== b.id || a.kind !== b.kind || a.name !== b.name) return false;
  if (!sameOptional(a.parentApplicationId, b.parentApplicationId)) return false;
  if (
    !sameOptional(a.category, b.category) ||
    !sameOptional(a.vendor, b.vendor) ||
    !sameOptional(a.technology, b.technology) ||
    !sameOptional(a.description, b.description)
  ) {
    return false;
  }
  if (a.lifecycle !== b.lifecycle || a.isManaged !== b.isManaged) return false;
  if (!aspectsEqual(a.aspects, b.aspects)) return false;
  if (
    !sameOptional(a.accentColor, b.accentColor) ||
    !sameOptional(a.shapeVariant, b.shapeVariant) ||
    !sameOptional(a.iconKey, b.iconKey) ||
    !sameOptional(a.iconSize, b.iconSize)
  ) {
    return false;
  }
  for (const key of PARAMETER_KEYS) {
    if (!sameOptional(a.parameters[key], b.parameters[key])) return false;
  }
  return true;
}

export function connectionsEqual(a: DesignConnection, b: DesignConnection): boolean {
  return (
    a.id === b.id &&
    a.sourceId === b.sourceId &&
    a.targetId === b.targetId &&
    sameOptional(a.label, b.label) &&
    sameOptional(a.protocol, b.protocol) &&
    a.isBidirectional === b.isBidirectional &&
    sameOptional(a.color, b.color) &&
    sameOptional(a.lineStyle, b.lineStyle) &&
    sameOptional(a.routing, b.routing) &&
    sameOptional(a.sourceArrowhead, b.sourceArrowhead) &&
    sameOptional(a.targetArrowhead, b.targetArrowhead)
  );
}

const POSITION_EPSILON = 0.001;

function sameCoordinate(a: number, b: number): boolean {
  return Math.abs(a - b) < POSITION_EPSILON;
}

export function placementsEqual(a: DiagramPlacement, b: DiagramPlacement): boolean {
  return (
    a.elementId === b.elementId &&
    sameOptional(a.zone, b.zone) &&
    sameOptional(a.domainGroup, b.domainGroup) &&
    sameCoordinate(a.x, b.x) &&
    sameCoordinate(a.y, b.y) &&
    sameOptional(a.width, b.width) &&
    sameOptional(a.height, b.height)
  );
}

export function edgeRoutesEqual(a: EdgeRoute, b: EdgeRoute): boolean {
  if (a.connectionId !== b.connectionId) return false;
  // Provenance is persisted, so a route whose ONLY change is who owns it still
  // has to reach the server. This comparison decides whether `diffToOverlay`
  // emits an upsert at all, and leaving it out would silently drop exactly the
  // interesting case: identical geometry that changed hands — a preserved route
  // re-emitted as manual over a stored auto row, or an undo handing one back.
  if (routeSource(a) !== routeSource(b)) return false;
  // The pin is persisted too, and it is the only thing that distinguishes an
  // explicitly pinned straight line from no row at all.
  if ((a.pinned ?? false) !== (b.pinned ?? false)) return false;
  // Attach sides are persisted constraints; a row whose only change is which side
  // an end leaves from must reach the server like any other route edit.
  if (!sameOptional(a.sourceSide, b.sourceSide) || !sameOptional(a.targetSide, b.targetSide)) {
    return false;
  }
  if (a.waypoints.length !== b.waypoints.length) return false;
  if ((a.labelPosition === undefined) !== (b.labelPosition === undefined)) return false;
  if (
    a.labelPosition &&
    b.labelPosition &&
    (!sameCoordinate(a.labelPosition.x, b.labelPosition.x) ||
      !sameCoordinate(a.labelPosition.y, b.labelPosition.y))
  ) {
    return false;
  }
  return a.waypoints.every(
    (p, i) => sameCoordinate(p.x, b.waypoints[i].x) && sameCoordinate(p.y, b.waypoints[i].y),
  );
}

export function layoutConfigsEqual(
  a: DiagramLayoutConfig | undefined,
  b: DiagramLayoutConfig | undefined,
): boolean {
  for (const zone of RESIZABLE_ZONES) {
    if (!sameOptional(a?.zones?.[zone]?.size, b?.zones?.[zone]?.size)) return false;
  }
  if (
    !sameOptional(a?.canvas?.width, b?.canvas?.width) ||
    !sameOptional(a?.canvas?.height, b?.canvas?.height)
  ) {
    return false;
  }
  const groupsA = a?.domainGroups ?? [];
  const groupsB = b?.domainGroups ?? [];
  if (groupsA.length !== groupsB.length) return false;
  return groupsA.every((groupA, i) => {
    const groupB = groupsB[i];
    return (
      groupA.name === groupB.name &&
      sameCoordinate(groupA.x, groupB.x) &&
      sameCoordinate(groupA.y, groupB.y) &&
      sameCoordinate(groupA.width, groupB.width) &&
      sameCoordinate(groupA.height, groupB.height)
    );
  });
}
