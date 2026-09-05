import type { DesignElement, NodeShapeVariant } from '../types';

/**
 * Pure resolution of an element's stored presentation style into concrete render
 * inputs, with the U6a NULL-inherit fallbacks (plan D1/D2): a NULL/absent field
 * resolves exactly as the node rendered before this feature existed. Mirrors
 * `edges/edgeStyle.ts` — the accent has the same explicit-wins/else-fallback
 * shape as `resolveEdgeStroke`, and the shape variant maps to a per-kind radius
 * the way `edgePathKind` maps routing.
 */

/**
 * Effective accent colour: the explicit per-element colour, else the caller's
 * theme fallback (category strip for the card, surface border for the others).
 * A byte-identical mirror of `resolveEdgeStroke` — no hardcoded hex here; the
 * fallback is always a runtime theme token supplied by the node.
 */
export function resolveAccent(
  element: Pick<DesignElement, 'accentColor'>,
  fallback: string,
): string {
  return element.accentColor ?? fallback;
}

/**
 * Render-level shape kinds. These are the element kinds plus `boundary` — the
 * container-diagram rendering of an `application`, whose baseline radius differs
 * from the card, so it needs its own key to stay byte-identical when unset.
 */
export type NodeShapeKind =
  | 'actor'
  | 'application'
  | 'externalSystem'
  | 'inputChannel'
  | 'managementTool'
  | 'component'
  | 'boundary';

/** MUI `borderRadius` multipliers (× theme.shape.borderRadius). */
const SHARP_RADIUS = 0;
const SUBTLE_RADIUS = 2;
const ROUNDED_RADIUS = 4;
const PILL_RADIUS = 999;

/**
 * Each kind's current (NULL-variant) root-box radius. The actor is the only
 * conditional shape: a stadium pill when it carries just a name, a rounded rect
 * once it has a description (ActorNode). The boundary is 3 (larger dashed rect);
 * every other kind is 2 today — including the input channel, a plain rounded
 * rect with no stadium clamp.
 */
function defaultRadius(kind: NodeShapeKind, hasDescription: boolean): number {
  if (kind === 'actor') return hasDescription ? SUBTLE_RADIUS : PILL_RADIUS;
  if (kind === 'boundary') return 3;
  return SUBTLE_RADIUS;
}

/**
 * Root-box `borderRadius` for a kind under an optional shape variant. NULL/absent
 * → each kind's current radius (byte-identical). `sharp` squares every kind;
 * `subtle` is the small rounded rect (but preserves the actor's pill when it has
 * no description); `rounded` is a larger radius (and keeps the actor's pill,
 * which already reads as maximally rounded).
 */
export function shapeRadiusFor(
  kind: NodeShapeKind,
  variant: NodeShapeVariant | undefined,
  hasDescription: boolean,
): number {
  if (!variant) return defaultRadius(kind, hasDescription);
  const actorPill = kind === 'actor' && !hasDescription;
  switch (variant) {
    case 'sharp':
      return SHARP_RADIUS;
    case 'subtle':
      return actorPill ? PILL_RADIUS : SUBTLE_RADIUS;
    case 'rounded':
      return actorPill ? PILL_RADIUS : ROUNDED_RADIUS;
    // `figure` is the actor stickman (D11): ActorNode branches to the SVG before
    // consulting this radius, so it never reaches here for an actor. A non-actor
    // kind carrying the value renders harmlessly with its default radius.
    case 'figure':
      return defaultRadius(kind, hasDescription);
  }
}
