import type {
  DesignDiagram,
  DesignModel,
  DiagramPlacement,
  ElementId,
  ElementKind,
} from '../types';
import type { StringKey } from '../i18n/strings';
import { CONTAINER_PALETTE, LAYER7_PALETTE } from '../canvas/paletteItems';
import { clampPlacementIntoZone, nodeMaxSize, nodeMinSize } from './placement';
import { HOME_ZONE } from './zones';

/**
 * CHANGING WHAT SOMETHING IS, after it exists.
 *
 * "I drew this as an external system and it's really an application" is a real,
 * common mistake, and the only cure until now was delete-and-redraw — which
 * loses the connections, the placement, the aspects and the description. So the
 * kind becomes editable.
 *
 * It is editable UNDER RULES, because `kind` is not decoration. It decides which
 * node component renders (`model/graph.ts`), how big the node is
 * (`model/placement.ts`), which band the palette calls home (`model/zones.ts`),
 * which diagrams may show it, and — for two kinds — what else in the model
 * points at it. The three refusals below are exactly those last cases:
 *
 * - **An application with a container diagram.** That diagram exists *about*
 *   this application (`applicationElementId`) and its components hang off it.
 *   Demoting the application would leave a diagram about something that is no
 *   longer an application. Delete the container view first, deliberately.
 * - **An application with components.** The other half of the same reference:
 *   `parentApplicationId` can point at an application that has no container
 *   diagram at all (its components were placed straight onto a landscape, or
 *   the view was deleted and its components left behind). Demoting it would
 *   leave components parented to an external system, and `model/graph` would
 *   go on drawing them as its children. Re-parent or delete them first.
 * - **A component with a parent.** `parentApplicationId` is what makes it a
 *   component; every other kind ignores the field, so changing the kind would
 *   silently orphan the reference. Detach it first.
 *
 * Everything else is allowed, and the placement follows: a new kind has a
 * different canonical size and a different home band, so the element moves to
 * `HOME_ZONE[kind]` when its current band is no longer one it may sit in, and
 * any explicit size is re-clamped to what the new kind and band permit.
 *
 * Pure: the editor action applies what this returns, in one commit.
 */

export type KindChangeRefusal =
  | 'kindChange.sameKind'
  | 'kindChange.notOnThisDiagram'
  | 'kindChange.hasContainerDiagram'
  | 'kindChange.hasParent'
  | 'kindChange.hasComponents'
  | 'kindChange.notAllowedHere';

export type KindChangeCheck =
  | { ok: true }
  | { ok: false; reason: KindChangeRefusal & StringKey };

/** The kinds a diagram of this sort may show — the palette's list, reused. */
export function allowedKindsOn(diagram: Pick<DesignDiagram, 'kind'>): readonly ElementKind[] {
  return diagram.kind === 'layer7' ? LAYER7_PALETTE : CONTAINER_PALETTE;
}

/** May this element become `kind` on this diagram, and if not, why not? */
export function canChangeKind(
  model: DesignModel,
  diagram: DesignDiagram,
  elementId: ElementId,
  kind: ElementKind,
): KindChangeCheck {
  const element = model.elements.find((e) => e.id === elementId);
  if (!element) return { ok: false, reason: 'kindChange.notOnThisDiagram' };
  if (element.kind === kind) return { ok: false, reason: 'kindChange.sameKind' };
  if (!diagram.placements.some((p) => p.elementId === elementId)) {
    return { ok: false, reason: 'kindChange.notOnThisDiagram' };
  }
  if (!allowedKindsOn(diagram).includes(kind)) {
    return { ok: false, reason: 'kindChange.notAllowedHere' };
  }
  if (
    element.kind === 'application' &&
    model.diagrams.some((d) => d.kind === 'container' && d.applicationElementId === elementId)
  ) {
    return { ok: false, reason: 'kindChange.hasContainerDiagram' };
  }
  if (
    element.kind === 'application' &&
    model.elements.some((e) => e.parentApplicationId === elementId)
  ) {
    return { ok: false, reason: 'kindChange.hasComponents' };
  }
  if (element.kind === 'component' && element.parentApplicationId) {
    return { ok: false, reason: 'kindChange.hasParent' };
  }
  return { ok: true };
}

/** The kinds this element could actually become here, in palette order. */
export function changeableKinds(
  model: DesignModel,
  diagram: DesignDiagram,
  elementId: ElementId,
): ElementKind[] {
  return allowedKindsOn(diagram).filter(
    (kind) => canChangeKind(model, diagram, elementId, kind).ok,
  );
}

/**
 * The placement the element should have as its new kind.
 *
 * Two things happen, in this order. The band: a kind may only live in bands the
 * grammar gives it, so an element whose current band is not its new kind's home
 * — and is not the landscape, which takes anything — moves to `HOME_ZONE[kind]`.
 * Only then the size, because the size limits depend on the band it ends up in.
 *
 * An explicit width/height the user set is kept where it still fits and clamped
 * where it does not; a placement that never carried one keeps carrying none, so
 * a kind change never invents a stored size out of a default.
 */
export function placementForKind(
  placement: DiagramPlacement,
  kind: ElementKind,
  diagram: DesignDiagram,
): DiagramPlacement {
  if (diagram.kind !== 'layer7') return clampSize(placement, kind, diagram);
  const home = HOME_ZONE[kind];
  const zone = placement.zone ?? 'landscape';
  // The landscape holds every kind (that is what makes it the landscape); any
  // other band holds only the kinds whose home it is.
  const legal = zone === 'landscape' || zone === home;
  const moved: DiagramPlacement = legal ? placement : { ...placement, zone: home };
  return clampSize(moved, kind, diagram);
}

function clampSize(
  placement: DiagramPlacement,
  kind: ElementKind,
  diagram: DesignDiagram,
): DiagramPlacement {
  const min = nodeMinSize(kind);
  const max = nodeMaxSize(kind, placement.zone, diagram.layoutConfig);
  const fit = (value: number | undefined, lo: number, hi: number) =>
    value === undefined ? undefined : Math.min(Math.max(value, lo), hi);
  const sized: DiagramPlacement = {
    ...placement,
    width: fit(placement.width, min.width, max.width),
    height: fit(placement.height, min.height, max.height),
  };
  // A band member must also still be inside its band after the resize.
  return clampPlacementIntoZone(sized, kind, diagram.layoutConfig) ?? sized;
}
