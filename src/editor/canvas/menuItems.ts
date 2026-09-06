import type { AttachSide, EdgeRouting, ElementId, ElementKind, Layer7Zone, Lifecycle } from '../../model/types';
import { formatShortcut, type Platform } from '../keymap';
import { DEFAULT_TRANSLATE, type StringKey, type Translate } from '../../i18n/strings';
import { zoneMenuLabel } from '../../model/zones';
import { paletteLabel } from './paletteItems';
import type { AlignAxis, DistributeAxis } from './alignDistribute';

/**
 * CONTEXT MENUS — the pure half.
 *
 * `menuItemsFor(target, ctx)` decides WHAT a right-click offers; nothing here
 * knows about React, React Flow or the editor state. The canvas builds a
 * {@link MenuContext} from what it has at hand, renders the result with
 * `ContextMenu`, and maps a chosen item's `action` back onto `EditorActions` in
 * `useMenuActions`. Keeping the decision pure is what makes every menu — per
 * target, per diagram kind, read-only or not — a table test.
 *
 * Every item carries its keyboard hint from the keymap, so a rebinding shows up
 * here for free and the menu can never advertise a chord that does not work.
 */

/** What the dispatcher does when an item is picked. */
export type MenuActionId =
  // node
  | 'open-documentation'
  | 'open-container'
  | 'rename'
  | 'start-connection'
  | 'pick-icon'
  | 'set-lifecycle'
  | 'move-to-zone'
  | 'change-kind'
  | 'set-domain-group'
  | 'duplicate'
  | 'copy'
  | 'cut'
  | 'remove-from-diagram'
  | 'delete-from-model'
  // line
  | 'add-bend'
  | 'remove-bend'
  | 'remove-all-bends'
  | 'pin-route'
  | 'reset-route'
  | 'attach-at'
  | 'set-line-shape'
  | 'set-direction'
  | 'edit-label'
  | 'reset-label-position'
  | 'delete-connection'
  // pane
  | 'paste-here'
  | 'add-here'
  | 'add-domain-group-here'
  | 'select-all'
  | 'tidy'
  | 'route-connections'
  | 'route-connections-all'
  | 'fit-view'
  | 'toggle-grid'
  | 'toggle-snap'
  // selection
  | 'align'
  | 'distribute'
  | 'group-into-domain-group'
  | 'delete-selection'
  // group
  | 'rename-group'
  | 'tidy-group'
  | 'group-color'
  | 'select-members'
  | 'remove-group'
  // tab
  | 'rename-diagram'
  | 'diagram-settings'
  | 'duplicate-diagram'
  | 'delete-diagram';

/** The parameter a submenu entry carries alongside its action. */
export interface MenuActionArgs {
  zone?: Layer7Zone;
  lifecycle?: Lifecycle;
  /** `undefined` on the "None" entry — leaves the group. */
  domainGroup?: string;
  kind?: ElementKind;
  /** "Change kind ▸": what the element should become. */
  newKind?: ElementKind;
  /** `undefined` on "Smooth" — the NULL-inherit default, never stored. */
  routing?: EdgeRouting;
  direction?: 'one-way' | 'two-way' | 'reverse';
  /** Attach at ▸ which end; `attachSide` undefined on "Automatic" — frees the end. */
  attachEnd?: 'source' | 'target';
  attachSide?: AttachSide;
  alignAxis?: AlignAxis;
  distributeAxis?: DistributeAxis;
}

export interface MenuItem {
  /** Unique within one menu (React key + test hook). */
  id: string;
  label: string;
  /** Right-aligned keyboard hint, already formatted for the platform. */
  shortcut?: string;
  disabled?: boolean;
  /** Shown as a tooltip on a disabled item — say why, not just that. */
  disabledReason?: string;
  /** Destructive: drawn in the error colour. */
  danger?: boolean;
  /** A check mark; `false` reserves the column so siblings line up. */
  checked?: boolean;
  /** A logo key the renderer may resolve to a mark (the Icon item's current mark). */
  icon?: string;
  children?: MenuItem[];
  divider?: true;
  action?: MenuActionId;
  args?: MenuActionArgs;
}

export type MenuTarget =
  | { kind: 'node'; elementId: ElementId }
  | { kind: 'edge'; connectionId: string }
  | { kind: 'edgeHandle'; connectionId: string; index: number }
  | { kind: 'pane' }
  | { kind: 'group'; name: string }
  | { kind: 'selection'; elementIds: ElementId[] }
  | { kind: 'tab'; diagramId: string };

export interface ElementMenuFacts {
  kind: ElementKind;
  lifecycle: Lifecycle;
  iconKey?: string;
  zone?: Layer7Zone;
  domainGroup?: string;
  hasContainerDiagram: boolean;
  /** The application a container diagram is about — cannot leave its own diagram. */
  isBoundaryApplication: boolean;
  /**
   * Kinds this element may become here (`model/kindChange.changeableKinds`).
   * Empty or absent = the entry is offered DISABLED with the refusal as its
   * tooltip, because "why can't I?" is the question at that moment and a
   * missing entry answers it with nothing.
   */
  changeableKinds?: ElementKind[];
  /** Why the change is refused, when it is. A string-table key. */
  kindChangeRefusal?: StringKey;
}

export interface ConnectionMenuFacts {
  routing?: EdgeRouting;
  isBidirectional: boolean;
  waypointCount: number;
  hasLabelPosition: boolean;
  /**
   * Who owns the stored route: `none` when nothing is stored (a plain floating
   * line), `auto` for router output, `manual` for a hand-drawn or pinned line.
   * Decides whether the pin entry reads "Pin route" or "Unpin route".
   */
  route: 'none' | 'auto' | 'manual';
  /** The side each end is fixed to (`EdgeRoute.sourceSide`); absent = automatic. */
  sourceSide?: AttachSide;
  targetSide?: AttachSide;
}

export interface SelectionMenuFacts {
  elementCount: number;
  /** Members whose placement sits on the landscape — the ones a group can hold. */
  landscapeCount: number;
}

export interface TabMenuFacts {
  canRename: boolean;
  canConfigure: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  /** The only landscape left: deleting it is refused, not confirmed. */
  isLastLandscape: boolean;
}

export interface MenuContext {
  readOnly: boolean;
  platform: Platform;
  /**
   * The UI language's lookup. Optional, and English when absent: the menus are
   * a pure table with a hundred labels, and defaulting here is what let the
   * whole builder become bilingual without touching a single one of its tests.
   */
  t?: Translate;
  diagramKind: 'layer7' | 'container';
  /** Domain-group names on the active diagram (layer7). */
  domainGroups?: string[];
  clipboardHasContent?: boolean;
  /** Element kinds the palette offers on this diagram — the "Add here" list. */
  allowedKinds?: ElementKind[];
  showGrid?: boolean;
  snapToGrid?: boolean;
  /** Board-level layout actions the editor wired; absent hides the item. */
  canTidy?: boolean;
  canRouteConnections?: boolean;
  /** "Re-route everything (ignore pins)" — the pass that overrides pinned routes. */
  canRouteConnectionsAll?: boolean;
  canTidyGroup?: boolean;
  /** A layout pass is running: Tidy / Route stay visible but disabled. */
  layoutBusy?: boolean;
  element?: ElementMenuFacts;
  connection?: ConnectionMenuFacts;
  selection?: SelectionMenuFacts;
  tab?: TabMenuFacts;
}

const LIFECYCLES: { value: Lifecycle; labelKey: StringKey }[] = [
  { value: 'planned', labelKey: 'lifecycle.planned' },
  { value: 'live', labelKey: 'lifecycle.live' },
  { value: 'retiring', labelKey: 'lifecycle.retiring' },
  { value: 'retired', labelKey: 'lifecycle.retired' },
];

const ZONES: Layer7Zone[] = ['actors', 'inputChannels', 'landscape', 'externalSystems', 'management'];

const LINE_SHAPES: { value: EdgeRouting | undefined; labelKey: StringKey }[] = [
  { value: undefined, labelKey: 'shape.smooth' },
  { value: 'orthogonal', labelKey: 'shape.orthogonal' },
  { value: 'straight', labelKey: 'shape.straight' },
  { value: 'curved', labelKey: 'shape.curved' },
];

/** Attach at ▸ Source / Target ▸ one of these; `undefined` is Automatic. */
const ATTACH_SIDES: { value: AttachSide | undefined; labelKey: StringKey }[] = [
  { value: undefined, labelKey: 'side.auto' },
  { value: 'top', labelKey: 'side.top' },
  { value: 'right', labelKey: 'side.right' },
  { value: 'bottom', labelKey: 'side.bottom' },
  { value: 'left', labelKey: 'side.left' },
];

const ALIGNMENTS: { axis: AlignAxis; labelKey: StringKey }[] = [
  { axis: 'left', labelKey: 'align.left' },
  { axis: 'centerX', labelKey: 'align.centerX' },
  { axis: 'right', labelKey: 'align.right' },
  { axis: 'top', labelKey: 'align.top' },
  { axis: 'centerY', labelKey: 'align.centerY' },
  { axis: 'bottom', labelKey: 'align.bottom' },
];

const sep = (id: string): MenuItem => ({ id, label: '', divider: true });

export function menuItemsFor(target: MenuTarget, ctx: MenuContext): MenuItem[] {
  switch (target.kind) {
    case 'node':
      return nodeItems(ctx);
    case 'edge':
      return lineItems(ctx, undefined);
    case 'edgeHandle':
      return lineItems(ctx, target.index);
    case 'pane':
      return paneItems(ctx);
    case 'selection':
      return selectionItems(ctx);
    case 'group':
      return groupItems(ctx);
    case 'tab':
      return tabItems(ctx);
  }
}

// --- node ---------------------------------------------------------------------

function nodeItems(ctx: MenuContext): MenuItem[] {
  const el = ctx.element;
  if (!el) return [];
  const t = ctx.t ?? DEFAULT_TRANSLATE;
  const key = (id: string) => formatShortcut(id, ctx.platform);
  const items: MenuItem[] = [];

  // Reading is not editing: the page opens in read-only too.
  items.push({
    id: 'open-documentation',
    label: t('menu.openDocumentation'),
    shortcut: key('open-documentation'),
    action: 'open-documentation',
  });
  if (el.kind === 'application') {
    if (el.hasContainerDiagram) {
      items.push({ id: 'open-container', label: t('menu.openContainer'), action: 'open-container' });
    } else if (!ctx.readOnly) {
      items.push({ id: 'open-container', label: t('menu.createContainer'), action: 'open-container' });
    }
  }
  if (ctx.readOnly) return items;

  items.push(
    { id: 'rename', label: t('menu.rename'), shortcut: key('rename'), action: 'rename' },
    { id: 'start-connection', label: t('menu.startConnection'), action: 'start-connection' },
  );
  items.push(iconItem(el.iconKey, t));
  items.push({
    id: 'lifecycle',
    label: t('menu.lifecycle'),
    children: LIFECYCLES.map((l) => ({
      id: `lifecycle-${l.value}`,
      label: t(l.labelKey),
      checked: el.lifecycle === l.value,
      action: 'set-lifecycle',
      args: { lifecycle: l.value },
    })),
  });
  items.push(changeKindItem(el, t));
  if (ctx.diagramKind === 'layer7') {
    const zone = el.zone ?? 'landscape';
    items.push({
      id: 'move-to-zone',
      label: t('menu.moveToZone'),
      children: ZONES.map((z) => ({
        id: `zone-${z}`,
        label: zoneMenuLabel(z, t),
        checked: zone === z,
        action: 'move-to-zone',
        args: { zone: z },
      })),
    });
    const groups = ctx.domainGroups ?? [];
    if (zone === 'landscape' && (groups.length > 0 || el.domainGroup)) {
      items.push({
        id: 'domain-group',
        label: t('menu.domainGroup'),
        children: [
          ...groups.map((name) => ({
            id: `group-${name}`,
            label: name,
            checked: el.domainGroup === name,
            action: 'set-domain-group' as const,
            args: { domainGroup: name },
          })),
          {
            id: 'group-none',
            label: t('common.none'),
            checked: !el.domainGroup,
            action: 'set-domain-group',
            args: { domainGroup: undefined },
          },
        ],
      });
    }
  }
  items.push(
    sep('sep-edit'),
    { id: 'duplicate', label: t('menu.duplicate'), shortcut: key('duplicate'), action: 'duplicate' },
    { id: 'copy', label: t('menu.copy'), shortcut: key('copy'), action: 'copy' },
    { id: 'cut', label: t('menu.cut'), shortcut: key('cut'), action: 'cut' },
    sep('sep-delete'),
    {
      id: 'remove-from-diagram',
      label: t('menu.removeFromDiagram'),
      shortcut: key('delete'),
      action: 'remove-from-diagram',
      ...(el.isBoundaryApplication
        ? { disabled: true, disabledReason: t('menu.boundaryApplication') }
        : {}),
    },
    { id: 'delete-from-model', label: t('menu.deleteFromModel'), danger: true, action: 'delete-from-model' },
  );
  return items;
}

/**
 * The Icon entry. Phase 3 turned this from a submenu of eight marks into ONE
 * item that opens the searchable grid (`nodes/LogoGrid`), because a hundred
 * marks in a nested menu is a scroll, not a choice — and the grid is the same
 * control the inspector and the palette show, so "pick an icon" looks the same
 * wherever it starts.
 *
 * It is offered for EVERY kind: the old three-kind gate was about the `vendor`
 * text field, not about whether an actor can have a mark.
 *
 * `icon` carries the current key so the renderer can draw it in the item's
 * leading column — the menu row shows what the element has right now.
 */
function iconItem(current: string | undefined, t: Translate): MenuItem {
  return {
    id: 'icon',
    label: t('menu.icon'),
    action: 'pick-icon',
    ...(current ? { icon: current } : {}),
  };
}

// --- line ---------------------------------------------------------------------

function lineItems(ctx: MenuContext, handleIndex: number | undefined): MenuItem[] {
  const c = ctx.connection;
  if (!c || ctx.readOnly) return [];
  const t = ctx.t ?? DEFAULT_TRANSLATE;
  const key = (id: string) => formatShortcut(id, ctx.platform);
  const items: MenuItem[] = [
    { id: 'add-bend', label: t('menu.addBend'), action: 'add-bend' },
  ];
  if (handleIndex !== undefined) {
    items.push({ id: 'remove-bend', label: t('menu.removeBend'), action: 'remove-bend' });
  }
  items.push(
    {
      id: 'remove-all-bends',
      label: t('menu.removeAllBends'),
      action: 'remove-all-bends',
      ...(c.waypointCount === 0
        ? { disabled: true, disabledReason: t('menu.noBendPoints') }
        : {}),
    },
    sep('sep-route'),
    // One entry that toggles: the label says what a click will DO, not what is.
    {
      id: 'pin-route',
      label: c.route === 'manual' ? t('menu.unpinRoute') : t('menu.pinRoute'),
      action: 'pin-route',
    },
    {
      id: 'reset-route',
      label: t('menu.resetRoute'),
      action: 'reset-route',
      ...(ctx.layoutBusy ? { disabled: true, disabledReason: t('menu.layoutBusy') } : {}),
    },
    attachAtSubmenu(c, ctx.layoutBusy ?? false, t),
    {
      id: 'line-shape',
      label: t('menu.lineShape'),
      children: LINE_SHAPES.map((shape) => ({
        id: `shape-${shape.value ?? 'smooth'}`,
        label: t(shape.labelKey),
        checked: (c.routing ?? undefined) === shape.value,
        action: 'set-line-shape',
        args: { routing: shape.value },
      })),
    },
    {
      id: 'direction',
      label: t('menu.direction'),
      children: [
        { id: 'direction-one-way', label: t('menu.oneWay'), checked: !c.isBidirectional, action: 'set-direction', args: { direction: 'one-way' } },
        { id: 'direction-two-way', label: t('menu.twoWay'), checked: c.isBidirectional, action: 'set-direction', args: { direction: 'two-way' } },
        { id: 'direction-reverse', label: t('menu.reverse'), checked: false, action: 'set-direction', args: { direction: 'reverse' } },
      ],
    },
    sep('sep-label'),
    { id: 'edit-label', label: t('menu.editLabel'), action: 'edit-label' },
    {
      id: 'reset-label-position',
      label: t('menu.resetLabelPosition'),
      action: 'reset-label-position',
      ...(c.hasLabelPosition
        ? {}
        : { disabled: true, disabledReason: t('menu.labelAutomatic') }),
    },
    sep('sep-delete'),
    { id: 'delete-connection', label: t('menu.deleteConnection'), shortcut: key('delete'), danger: true, action: 'delete-connection' },
  );
  return items;
}

/**
 * Change kind ▸ — what this element should have been.
 *
 * Always present, disabled with a reason when the rules refuse (an application
 * that a container diagram is about, a component still attached to its parent).
 * Hiding it would answer the user's actual question — "why can't I?" — with
 * nothing at all.
 */
function changeKindItem(el: ElementMenuFacts, t: Translate): MenuItem {
  const kinds = el.changeableKinds ?? [];
  if (kinds.length === 0) {
    return {
      id: 'change-kind',
      label: t('menu.changeKind'),
      // It keeps its action even disabled, so the menu's "every leaf does
      // something" invariant stays true; with no `args.newKind` the dispatcher
      // is a no-op, and a disabled item never reaches it anyway.
      action: 'change-kind',
      disabled: true,
      disabledReason: t(el.kindChangeRefusal ?? 'kindChange.notAllowedHere'),
    };
  }
  return {
    id: 'change-kind',
    label: t('menu.changeKind'),
    children: kinds.map((kind: ElementKind) => ({
      id: `change-kind-${kind}`,
      label: paletteLabel(kind, t),
      action: 'change-kind' as const,
      args: { newKind: kind },
    })),
  };
}

/**
 * Attach at ▸ Source ▸ (Automatic | Top | Right | Bottom | Left) and Target ▸ the
 * same: which side of its node each end of the line is fixed to. Checked = the
 * side stored on the route row for that end, Automatic when none is. Disabled
 * while a layout pass runs, like Reset: a side change routes the line, and the
 * editor refuses a second pass while one is in flight.
 */
function attachAtSubmenu(c: ConnectionMenuFacts, layoutBusy: boolean, t: Translate): MenuItem {
  const busy = layoutBusy ? { disabled: true, disabledReason: t('menu.layoutBusy') } : {};
  const endMenu = (end: 'source' | 'target', label: string, current: AttachSide | undefined): MenuItem => ({
    id: `attach-${end}`,
    label,
    children: ATTACH_SIDES.map((side) => ({
      id: `attach-${end}-${side.value ?? 'auto'}`,
      label: t(side.labelKey),
      checked: current === side.value,
      action: 'attach-at' as const,
      args: { attachEnd: end, attachSide: side.value },
      ...busy,
    })),
  });
  return {
    id: 'attach-at',
    label: t('menu.attachAt'),
    children: [
      endMenu('source', t('menu.attachSource'), c.sourceSide),
      endMenu('target', t('menu.attachTarget'), c.targetSide),
    ],
  };
}

// --- pane ---------------------------------------------------------------------

function paneItems(ctx: MenuContext): MenuItem[] {
  const t = ctx.t ?? DEFAULT_TRANSLATE;
  const key = (id: string) => formatShortcut(id, ctx.platform);
  const navigation: MenuItem[] = [
    { id: 'select-all', label: t('menu.selectAll'), shortcut: key('select-all'), action: 'select-all' },
  ];
  const fitView: MenuItem = { id: 'fit-view', label: t('menu.fitView'), shortcut: key('fit-view'), action: 'fit-view' };
  if (ctx.readOnly) return [...navigation, fitView];

  const busy = ctx.layoutBusy
    ? { disabled: true, disabledReason: t('menu.layoutBusy') }
    : {};
  const items: MenuItem[] = [
    {
      id: 'paste-here',
      label: t('menu.pasteHere'),
      shortcut: key('paste'),
      action: 'paste-here',
      ...(ctx.clipboardHasContent ? {} : { disabled: true, disabledReason: t('menu.nothingToPaste') }),
    },
    {
      id: 'add-here',
      label: t('menu.addHere'),
      children: (ctx.allowedKinds ?? []).map((kind) => ({
        id: `add-${kind}`,
        label: paletteLabel(kind, t),
        action: 'add-here' as const,
        args: { kind },
      })),
    },
  ];
  if (ctx.diagramKind === 'layer7') {
    items.push({ id: 'add-domain-group-here', label: t('menu.addDomainGroupHere'), action: 'add-domain-group-here' });
  }
  items.push(sep('sep-view'), ...navigation);
  if (ctx.canTidy) items.push({ id: 'tidy', label: t('menu.tidy'), action: 'tidy', ...busy });
  if (ctx.canRouteConnections) {
    items.push({ id: 'route-connections', label: t('menu.routeConnections'), action: 'route-connections', ...busy });
  }
  if (ctx.canRouteConnectionsAll) {
    items.push({
      id: 'route-connections-all',
      label: t('menu.routeConnectionsAll'),
      action: 'route-connections-all',
      ...busy,
    });
  }
  items.push(
    fitView,
    sep('sep-grid'),
    { id: 'toggle-grid', label: t('menu.showGrid'), checked: ctx.showGrid ?? false, action: 'toggle-grid' },
    { id: 'toggle-snap', label: t('menu.snapToGrid'), checked: ctx.snapToGrid ?? false, action: 'toggle-snap' },
  );
  return items;
}

// --- selection ------------------------------------------------------------------

function selectionItems(ctx: MenuContext): MenuItem[] {
  const sel = ctx.selection;
  if (!sel || ctx.readOnly) return [];
  const t = ctx.t ?? DEFAULT_TRANSLATE;
  const key = (id: string) => formatShortcut(id, ctx.platform);
  const items: MenuItem[] = [
    {
      id: 'align',
      label: t('menu.align'),
      children: ALIGNMENTS.map((a) => ({
        id: `align-${a.axis}`,
        label: t(a.labelKey),
        action: 'align' as const,
        args: { alignAxis: a.axis },
      })),
    },
    {
      id: 'distribute',
      label: t('menu.distribute'),
      ...(sel.elementCount < 3
        ? { disabled: true, disabledReason: t('menu.needThreeElements') }
        : {}),
      children: [
        { id: 'distribute-horizontal', label: t('menu.distributeHorizontally'), action: 'distribute', args: { distributeAxis: 'horizontal' } },
        { id: 'distribute-vertical', label: t('menu.distributeVertically'), action: 'distribute', args: { distributeAxis: 'vertical' } },
      ],
    },
    {
      id: 'lifecycle',
      label: t('menu.lifecycle'),
      children: LIFECYCLES.map((l) => ({
        id: `lifecycle-${l.value}`,
        label: t(l.labelKey),
        action: 'set-lifecycle' as const,
        args: { lifecycle: l.value },
      })),
    },
  ];
  if (ctx.diagramKind === 'layer7') {
    items.push({
      id: 'group-into-domain-group',
      label: t('menu.groupIntoDomainGroup'),
      action: 'group-into-domain-group',
      ...(sel.landscapeCount === 0
        ? { disabled: true, disabledReason: t('menu.needLandscapeElements') }
        : {}),
    });
  }
  items.push(
    sep('sep-edit'),
    { id: 'copy', label: t('menu.copy'), shortcut: key('copy'), action: 'copy' },
    { id: 'delete-selection', label: t('menu.delete'), shortcut: key('delete'), danger: true, action: 'delete-selection' },
  );
  return items;
}

// --- group ----------------------------------------------------------------------

function groupItems(ctx: MenuContext): MenuItem[] {
  if (ctx.readOnly) return [];
  const t = ctx.t ?? DEFAULT_TRANSLATE;
  const items: MenuItem[] = [{ id: 'rename-group', label: t('menu.rename'), action: 'rename-group' }];
  if (ctx.canTidyGroup) items.push({ id: 'tidy-group', label: t('menu.tidyGroup'), action: 'tidy-group' });
  items.push(
    { id: 'group-color', label: t('menu.groupColor'), action: 'group-color' },
    { id: 'select-members', label: t('menu.selectMembers'), action: 'select-members' },
    sep('sep-delete'),
    { id: 'remove-group', label: t('menu.removeGroup'), danger: true, action: 'remove-group' },
  );
  return items;
}

// --- tab ------------------------------------------------------------------------

function tabItems(ctx: MenuContext): MenuItem[] {
  const tab = ctx.tab;
  if (!tab || ctx.readOnly) return [];
  const t = ctx.t ?? DEFAULT_TRANSLATE;
  const items: MenuItem[] = [];
  if (tab.canRename) items.push({ id: 'rename-diagram', label: t('menu.renameDiagram'), action: 'rename-diagram' });
  if (tab.canConfigure) items.push({ id: 'diagram-settings', label: t('menu.diagramSettings'), action: 'diagram-settings' });
  if (tab.canDuplicate) items.push({ id: 'duplicate-diagram', label: t('menu.duplicateDiagram'), action: 'duplicate-diagram' });
  if (tab.canDelete) {
    if (items.length > 0) items.push(sep('sep-delete'));
    items.push({
      id: 'delete-diagram',
      label: t('menu.deleteDiagram'),
      danger: true,
      action: 'delete-diagram',
      ...(tab.isLastLandscape
        ? { disabled: true, disabledReason: t('menu.lastLandscape') }
        : {}),
    });
  }
  return items;
}
