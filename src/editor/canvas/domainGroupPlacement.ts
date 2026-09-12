import { DEFAULT_TRANSLATE, type Translate } from '../../i18n/strings';
import { MIN_GROUP_SIZE } from '../../model/placement';
export { GROUP_AROUND_PADDING, GROUP_LABEL_ROOM, groupRectAround } from '../../model/placement';
import { zoneRect } from '../../model/zones';
import { claimKey } from '../../model/keys';
import type { DesignDiagram, DiagramGroup, Point, Rect } from '../../model/types';

/** A new group's box. Big enough to drop two or three cards into straight away. */
export const DEFAULT_GROUP_SIZE = { width: 420, height: 280 } as const;

/**
 * Fallback name, and the base every auto-numbered name counts up from.
 *
 * A function of the language, not a constant: a group's name is its caption and
 * the id is minted from it — it goes into the model and onto the board — so an
 * editor set to Dutch must not silently create a box called "New group".
 * English is the default, which keeps every caller that passes nothing (and
 * every test that reads the fallback) saying exactly what it said before.
 */
export function defaultGroupName(translate: Translate = DEFAULT_TRANSLATE): string {
  return translate('newName.domainGroup');
}

/**
 * A group name that is not taken yet.
 *
 * The name stopped being the group's key when a group got an id (ADR-0012 §6),
 * so a duplicate no longer hijacks somebody else's box — but two groups called
 * the same thing are still a board nobody can read, which is reason enough on
 * its own. Someone typing "Commerce" when a "Commerce" already exists gets
 * "Commerce 2".
 */
export function uniqueGroupName(
  base: string,
  existing: Iterable<string>,
  translate: Translate = DEFAULT_TRANSLATE,
): string {
  const taken = new Set(existing);
  const trimmed = base.trim() || defaultGroupName(translate);
  if (!taken.has(trimmed)) return trimmed;
  for (let i = 2; ; i += 1) {
    const candidate = `${trimmed} ${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export interface NewDomainGroupOptions {
  diagram?: Pick<DesignDiagram, 'groups' | 'geometry'>;
  /** Where the drop landed, in flow coords. Absent = the cascading default spot. */
  center?: Point;
  name?: string;
  color?: string;
  /** The UI language's lookup, for the fallback name. Absent = English. */
  translate?: Translate;
}

/**
 * A new domain group — what it is called, and where its box goes — for BOTH
 * ways of creating one: the palette's Place button (no `center` — the box
 * cascades from the landscape's top-left so repeated adds do not stack) and a
 * palette drop (`center` — the box lands where the cursor was).
 *
 * The two halves come back separately because that is what they are (ADR-0012
 * §6): the name and the colour go into the definition, the box into the
 * geometry.
 *
 * A dropped box is clamped into the landscape zone. Groups are a landscape
 * concept and the boxes draw at `zIndex: -1`, so a group dropped in the actors
 * band would render as a stripe hiding behind a band — clamping keeps the
 * gesture forgiving instead of letting it produce something broken. Shrinking
 * before shifting matters for a narrow landscape: fit first, then place.
 */
export function newDomainGroup(
  options: NewDomainGroupOptions = {},
): { group: DiagramGroup; box: Rect } {
  const { diagram, center, name, color, translate } = options;
  const held = diagram?.groups ?? [];
  const chosen = uniqueGroupName(
    name ?? defaultGroupName(translate), held.map((group) => group.name), translate,
  );
  return {
    group: {
      id: claimKey(chosen, new Set(held.map((group) => group.id))),
      name: chosen,
      ...(color ? { color } : {}),
    },
    box: boxFor(zoneRect('landscape', diagram?.geometry), held.length, center),
  };
}

function boxFor(
  landscape: { x: number; y: number; width: number; height: number },
  groupCount: number,
  center?: Point,
): { x: number; y: number; width: number; height: number } {
  const width = Math.max(Math.min(DEFAULT_GROUP_SIZE.width, landscape.width), MIN_GROUP_SIZE);
  const height = Math.max(Math.min(DEFAULT_GROUP_SIZE.height, landscape.height), MIN_GROUP_SIZE);
  if (!center) {
    // Unchanged cascade: every fifth group starts over, which is what the
    // palette has always done and keeps a run of adds readable.
    const offset = (groupCount % 5) * 36;
    return { x: landscape.x + 48 + offset, y: landscape.y + 48 + offset, width, height };
  }
  return {
    x: clamp(center.x - width / 2, landscape.x, landscape.x + landscape.width - width),
    y: clamp(center.y - height / 2, landscape.y, landscape.y + landscape.height - height),
    width,
    height,
  };
}

function clamp(value: number, min: number, max: number): number {
  // A landscape narrower than the box makes max < min; pin to the left edge
  // rather than returning a nonsense coordinate.
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}
