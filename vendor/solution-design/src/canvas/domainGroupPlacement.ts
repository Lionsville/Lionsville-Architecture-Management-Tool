import { DEFAULT_TRANSLATE, type Translate } from '../i18n/strings';
import { expandRect, unionRects } from '../model/placement';
import { zoneRect } from '../model/zones';
import type { DiagramLayoutConfig, DomainGroupRect, Point, Rect } from '../types';

/** A new group's box. Big enough to drop two or three cards into straight away. */
export const DEFAULT_GROUP_SIZE = { width: 420, height: 280 } as const;

/**
 * Fallback name, and the base every auto-numbered name counts up from.
 *
 * A function of the language, not a constant: a group's name is its KEY and its
 * caption — it goes into the model and onto the board — so an editor set to
 * Dutch must not silently create a box called "New group". English is the
 * default, which keeps every caller that passes nothing (and every test that
 * reads the fallback) saying exactly what it said before.
 */
export function defaultGroupName(translate: Translate = DEFAULT_TRANSLATE): string {
  return translate('newName.domainGroup');
}

/** Never let a dropped box get so small it cannot hold a card. */
const MIN_GROUP_SIZE = 120;

/**
 * A group name that is not taken yet. Names are the group's KEY — `upsertDomainGroup`
 * matches on them — so handing back a name that already exists would silently
 * move and resize somebody else's group instead of creating one. That makes this
 * load-bearing rather than cosmetic, and it is why the palette's own name field
 * runs through here too: someone typing "Commerce" when a "Commerce" already
 * exists gets "Commerce 2", not a hijacked box.
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
  layoutConfig?: DiagramLayoutConfig;
  /** Where the drop landed, in flow coords. Absent = the cascading default spot. */
  center?: Point;
  name?: string;
  color?: string;
  /** The UI language's lookup, for the fallback name. Absent = English. */
  translate?: Translate;
}

/**
 * Build the rect for a new domain group, for BOTH ways of creating one: the
 * palette's Place button (no `center` — the box cascades from the landscape's
 * top-left so repeated adds do not stack) and a palette drop (`center` — the box
 * lands where the cursor was).
 *
 * A dropped box is clamped into the landscape zone. Groups are a landscape
 * concept and the boxes draw at `zIndex: -1`, so a group dropped in the actors
 * band would render as a stripe hiding behind a band — clamping keeps the
 * gesture forgiving instead of letting it produce something broken. Shrinking
 * before shifting matters for a narrow landscape: fit first, then place.
 */
export function newDomainGroupRect(options: NewDomainGroupOptions = {}): DomainGroupRect {
  const { layoutConfig, center, name, color, translate } = options;
  const existing = (layoutConfig?.domainGroups ?? []).map((group) => group.name);
  const landscape = zoneRect('landscape', layoutConfig);
  const rect: DomainGroupRect = {
    name: uniqueGroupName(name ?? defaultGroupName(translate), existing, translate),
    ...boxFor(landscape, existing.length, center),
    ...(color ? { color } : {}),
  };
  return rect;
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

/** Air between a group's members and its border when the box is drawn around them. */
export const GROUP_AROUND_PADDING = 28;
/** Extra room above the members for the name pill, which sits on the top edge. */
export const GROUP_LABEL_ROOM = 14;

/**
 * A box that hugs `memberRects` — "Group into new domain group" from a
 * selection. Padded all round, with a little more on top for the label pill.
 * Undefined for an empty selection: there is nothing to draw around.
 */
export function groupRectAround(memberRects: readonly Rect[]): Rect | undefined {
  const union = unionRects([...memberRects]);
  if (!union) return undefined;
  const padded = expandRect(union, GROUP_AROUND_PADDING);
  return {
    ...padded,
    y: padded.y - GROUP_LABEL_ROOM,
    height: Math.max(padded.height + GROUP_LABEL_ROOM, MIN_GROUP_SIZE),
    width: Math.max(padded.width, MIN_GROUP_SIZE),
  };
}
