import type {
  DesignDiagram,
  DesignElement,
  DesignModel,
  PlacedNode,
  ElementId,
  ElementKind,
} from './types';
import type { StringKey } from '../i18n/strings';
import { nodeFigure } from './kinds';
import type { NodeFigure } from './kinds';
import { clampPlacementIntoZone, nodeMaxSize, nodeMinSize, placedNode } from './placement';
import type { CanvasKind } from './placement';
import { HOME_ZONE } from './zones';

/**
 * CHANGING WHAT SOMETHING IS, after it exists.
 *
 * "I drew this as an actor and it's really an application" is a real, common
 * mistake, and the only cure until now was delete-and-redraw — which loses the
 * connections, the placement, the aspects and the description. So the kind
 * becomes editable.
 *
 * ADR-0012 §4 made it a smaller question than it was: three of the five things
 * a landscape box could be were never kinds, and moving a card between bands
 * has always been a drag rather than a change of what the thing IS. What is
 * left decides which node component renders (`editor/graph.ts`), how big the
 * node is (`model/placement.ts`), which diagrams may show it, and — for two
 * kinds — what else in the model points at it. The three refusals below are
 * exactly those last cases:
 *
 * - **An application with a container diagram.** That diagram exists *about*
 *   this application (`applicationElementId`) and its components hang off it.
 *   Demoting the application would leave a diagram about something that is no
 *   longer an application. Delete the container view first, deliberately.
 * - **An application with components.** The other half of the same reference:
 *   `parentId` can point at an application that has no container
 *   diagram at all (its components were placed straight onto a landscape, or
 *   the view was deleted and its components left behind). Demoting it would
 *   leave components parented to something that is not an application, and
 *   `editor/graph` would go on drawing them as its children. Re-parent or
 *   delete them first.
 * - **A component with a parent.** `parentId` is what makes it a
 *   component; every other kind ignores the field, so changing the kind would
 *   silently orphan the reference. Detach it first.
 *
 * Everything else is allowed, and the placement follows: a new kind may draw
 * as a different figure, with a different canonical size and a different home
 * band, so the element moves to that home when its current band is no longer
 * one it may sit in, and any explicit size is re-clamped to what the figure and
 * the band permit.
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

/**
 * Layer 7 landscape kinds — no `component`, those belong to container diagrams.
 *
 * Two rows where there were five (ADR-0012 §4). What left was never a kind: an
 * input channel and a management tool are an application in a band, and the
 * band is the view's to say — so the palette offers *application* and the
 * board offers *where*, which is one decision in one place instead of a kind
 * that has to be changed when a card is dragged.
 *
 * Here and not in the palette because it is a rule about the model, not about a
 * row of buttons: `canChangeKind` below refuses a kind the diagram may not show,
 * and the palette offers exactly what the rule allows by importing these.
 */
export const LAYER7_PALETTE: CanvasKind[] = ['application', 'actor'];

/**
 * C4 container-diagram kinds.
 *
 * `application` is here for the context boxes an external system used to be:
 * a container view has no bands to say "somebody else's", so on one of these
 * the fact does it — `outside` on the record, which the inspector offers.
 */
export const CONTAINER_PALETTE: CanvasKind[] = ['component', 'actor', 'application'];

/** The kinds a diagram of this sort may show. */
export function allowedKindsOn(diagram: Pick<DesignDiagram, 'kind'>): readonly CanvasKind[] {
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
  if (!placedNode(diagram, elementId)) {
    return { ok: false, reason: 'kindChange.notOnThisDiagram' };
  }
  if (!(allowedKindsOn(diagram) as readonly ElementKind[]).includes(kind)) {
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
    model.elements.some((e) => e.parentId === elementId)
  ) {
    return { ok: false, reason: 'kindChange.hasComponents' };
  }
  if (element.kind === 'component' && element.parentId) {
    return { ok: false, reason: 'kindChange.hasParent' };
  }
  return { ok: true };
}

/** The kinds this element could actually become here, in palette order. */
export function changeableKinds(
  model: DesignModel,
  diagram: DesignDiagram,
  elementId: ElementId,
): CanvasKind[] {
  return allowedKindsOn(diagram).filter(
    (kind) => canChangeKind(model, diagram, elementId, kind).ok,
  );
}

/**
 * The placement the element should have as its new kind.
 *
 * Two things happen, in this order. The band: a figure may only live in bands
 * the grammar gives it, so an element whose current band is not the home of
 * what it would now be drawn as — and is not the landscape, which takes
 * anything — moves to that home. Only then the size, because the size limits
 * depend on the band it ends up in.
 *
 * An explicit width/height the user set is kept where it still fits and clamped
 * where it does not; a placement that never carried one keeps carrying none, so
 * a kind change never invents a stored size out of a default.
 */
export function placementForKind(
  placement: PlacedNode,
  becoming: Pick<DesignElement, 'kind' | 'outside'>,
  diagram: DesignDiagram,
): PlacedNode {
  if (diagram.kind !== 'layer7') {
    return clampSize(placement, nodeFigure(becoming, placement.zone), diagram);
  }
  const zone = placement.zone ?? 'landscape';
  // What it would be drawn as where it stands, and where that figure lives.
  const home = HOME_ZONE[nodeFigure(becoming, zone)];
  // The landscape holds every kind (that is what makes it the landscape); any
  // other band holds only the figures whose home it is.
  const legal = zone === 'landscape' || zone === home;
  const moved: PlacedNode = legal ? placement : { ...placement, zone: home };
  return clampSize(moved, nodeFigure(becoming, moved.zone), diagram);
}

function clampSize(
  placement: PlacedNode,
  figure: NodeFigure,
  diagram: DesignDiagram,
): PlacedNode {
  const min = nodeMinSize(figure);
  const max = nodeMaxSize(figure, placement.zone, diagram.geometry);
  const fit = (value: number | undefined, lo: number, hi: number) =>
    value === undefined ? undefined : Math.min(Math.max(value, lo), hi);
  const sized: PlacedNode = {
    ...placement,
    width: fit(placement.width, min.width, max.width),
    height: fit(placement.height, min.height, max.height),
  };
  // A band member must also still be inside its band after the resize.
  return clampPlacementIntoZone(sized, figure, diagram.geometry) ?? sized;
}
