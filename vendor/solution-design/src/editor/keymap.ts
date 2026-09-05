/**
 * KEYMAP (U4c) — the single source of truth for canvas shortcuts.
 *
 * `CANVAS_SHORTCUTS` drives BOTH the dispatch hook (`use-canvas-shortcuts.ts`)
 * and the help overlay (`ShortcutsHelpDialog.tsx`), so the two can never drift:
 * add one entry here and the overlay documents it for free. Undo/redo (U7,
 * round-5 editor-features plan) walk an in-memory stack of overlay snapshots
 * over the `commit` choke-point; each mutating shortcut still resolves to one
 * batched `commit`, and undo/redo re-emit the same cumulative save batch.
 *
 * The `'Mod'` token is abstract: it resolves to ⌘ (metaKey) on Mac and Ctrl
 * (ctrlKey) elsewhere via a robust platform check (`userAgentData.platform`
 * with a `navigator.platform` fallback — never a UA-string sniff). `matchEvent`
 * is a pure function so it can be unit-tested on both platforms.
 */

import type { StringKey } from '../i18n/strings';

/** Which primary modifier `'Mod'` maps to. */
export type Platform = 'mac' | 'other';

export type ShortcutGroup = 'selection' | 'edit' | 'view' | 'general';

/** Context the optional `when` predicate reads to gate a shortcut. */
export interface ShortcutContext {
  readOnly: boolean;
  hasSelection: boolean;
}

export interface ShortcutDef {
  id: string;
  /**
   * The chord tokens: any of the modifiers `'Mod'` / `'Shift'` / `'Alt'`, plus
   * exactly one key token (a letter, digit, `'Escape'`, `'Delete'`, the
   * `'Arrow'` alias for the four arrow keys, `'='`, `'-'`, or `'?'`).
   */
  keys: string[];
  /**
   * The string-table key for this shortcut's name (`shortcut.<id>`), NOT the
   * name itself: the help overlay renders it through `useStrings()` so the
   * keymap stays a pure table and the overlay follows the UI language. Two defs
   * may share a key (`redo` / `redo-alt`).
   */
  labelKey: StringKey;
  group: ShortcutGroup;
  /** When present and false for the current context, the shortcut is inert. */
  when?: (ctx: ShortcutContext) => boolean;
}

const MODIFIER_TOKENS = new Set(['Mod', 'Shift', 'Alt']);

/**
 * Key tokens whose printed character is itself produced with Shift on common
 * layouts (`+` is Shift+`=`, `?` is Shift+`/`). For these we do not constrain
 * the Shift state, so the binding fires whether or not Shift is reported.
 */
const SHIFT_AGNOSTIC = new Set(['=', '?']);

/** Alternate `event.key` values a single key token accepts. */
const KEY_ALIASES: Record<string, string[]> = {
  '=': ['=', '+'],
  Delete: ['Delete', 'Backspace'],
  Arrow: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
};

const notReadOnly = (ctx: ShortcutContext) => !ctx.readOnly;
const notReadOnlyWithSelection = (ctx: ShortcutContext) => !ctx.readOnly && ctx.hasSelection;

/**
 * The final, combined key map (see the plan's "Key map" table). Order here is
 * the order the help overlay renders within each group.
 */
export const CANVAS_SHORTCUTS: ShortcutDef[] = [
  // selection
  { id: 'select-all', keys: ['Mod', 'a'], labelKey: 'shortcut.select-all', group: 'selection' },
  {
    id: 'deselect',
    keys: ['Escape'],
    labelKey: 'shortcut.deselect',
    group: 'selection',
    when: (ctx) => ctx.hasSelection,
  },
  // edit
  { id: 'copy', keys: ['Mod', 'c'], labelKey: 'shortcut.copy', group: 'edit', when: (ctx) => ctx.hasSelection },
  { id: 'paste', keys: ['Mod', 'v'], labelKey: 'shortcut.paste', group: 'edit', when: notReadOnly },
  { id: 'cut', keys: ['Mod', 'x'], labelKey: 'shortcut.cut', group: 'edit', when: notReadOnlyWithSelection },
  {
    id: 'duplicate',
    keys: ['Mod', 'd'],
    labelKey: 'shortcut.duplicate',
    group: 'edit',
    when: notReadOnlyWithSelection,
  },
  {
    id: 'delete',
    keys: ['Delete'],
    labelKey: 'shortcut.delete',
    group: 'edit',
    when: notReadOnlyWithSelection,
  },
  // Enter opens the documentation page for the selected element; reading is
  // allowed in read-only, so it is not gated on that.
  {
    id: 'open-documentation',
    keys: ['Enter'],
    labelKey: 'shortcut.open-documentation',
    group: 'selection',
    when: (ctx) => ctx.hasSelection,
  },
  // F2 renames whatever is selected: an element (inspector Name field), a domain
  // group (inline label editor) or a connection (inline label chip).
  { id: 'rename', keys: ['F2'], labelKey: 'shortcut.rename', group: 'edit', when: notReadOnlyWithSelection },
  {
    id: 'nudge',
    keys: ['Arrow'],
    labelKey: 'shortcut.nudge',
    group: 'edit',
    when: notReadOnlyWithSelection,
  },
  {
    id: 'nudge-fine',
    keys: ['Shift', 'Arrow'],
    labelKey: 'shortcut.nudge-fine',
    group: 'edit',
    when: notReadOnlyWithSelection,
  },
  { id: 'undo', keys: ['Mod', 'z'], labelKey: 'shortcut.undo', group: 'edit', when: notReadOnly },
  { id: 'redo', keys: ['Mod', 'Shift', 'z'], labelKey: 'shortcut.redo', group: 'edit', when: notReadOnly },
  // Ctrl+Y is the Windows/Linux redo; a harmless second binding to the same handler.
  { id: 'redo-alt', keys: ['Mod', 'y'], labelKey: 'shortcut.redo', group: 'edit', when: notReadOnly },
  // view
  { id: 'zoom-in', keys: ['='], labelKey: 'shortcut.zoom-in', group: 'view' },
  { id: 'zoom-out', keys: ['-'], labelKey: 'shortcut.zoom-out', group: 'view' },
  { id: 'fit-view', keys: ['Shift', '1'], labelKey: 'shortcut.fit-view', group: 'view' },
  { id: 'zoom-100', keys: ['Shift', '2'], labelKey: 'shortcut.zoom-100', group: 'view' },
  // general
  { id: 'force-save', keys: ['Mod', 's'], labelKey: 'shortcut.force-save', group: 'general' },
  // The context menu for the current selection (or the canvas when nothing is
  // selected). Two bindings because they differ in Shift: the conventional
  // Shift+F10 and the dedicated Menu key some keyboards carry.
  { id: 'context-menu', keys: ['Shift', 'F10'], labelKey: 'shortcut.context-menu', group: 'general' },
  { id: 'context-menu-key', keys: ['ContextMenu'], labelKey: 'shortcut.context-menu', group: 'general' },
  { id: 'help', keys: ['?'], labelKey: 'shortcut.help', group: 'general' },
  // ⌘F / Ctrl+F: the element finder. Browser-owned, so the dispatch hook always
  // preventDefaults it — a find bar over a canvas full of SVG finds nothing.
  { id: 'find', keys: ['Mod', 'f'], labelKey: 'shortcut.find', group: 'general' },
];

/** Detect the platform from the UA-client-hints API, falling back to platform. */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const raw = nav.userAgentData?.platform ?? navigator.platform ?? '';
  return /mac/i.test(raw) ? 'mac' : 'other';
}

/** The event property `'Mod'` resolves to on the given platform. */
export function resolveMod(platform: Platform): 'metaKey' | 'ctrlKey' {
  return platform === 'mac' ? 'metaKey' : 'ctrlKey';
}

/** The subset of a keyboard event `matchEvent` reads (real events satisfy it). */
export interface KeyChord {
  key: string;
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

function keyTokenOf(def: ShortcutDef): string {
  return def.keys.find((token) => !MODIFIER_TOKENS.has(token)) ?? '';
}

function keyMatches(event: KeyChord, token: string): boolean {
  const candidates = KEY_ALIASES[token] ?? [token];
  for (const candidate of candidates) {
    if (event.key === candidate) return true;
    if (event.key.toLowerCase() === candidate.toLowerCase()) return true;
  }
  // `event.code` is layout-stable, so it recovers letters/digits whose printed
  // `event.key` shifts (e.g. Shift+1 reports '!' but code stays 'Digit1').
  if (/^[a-z]$/i.test(token) && event.code === `Key${token.toUpperCase()}`) return true;
  if (/^[0-9]$/.test(token) && event.code === `Digit${token}`) return true;
  return false;
}

/** Pure chord matcher: does `event` fire `def` on `platform`? */
export function matchEvent(event: KeyChord, def: ShortcutDef, platform: Platform): boolean {
  const needMod = def.keys.includes('Mod');
  const needShift = def.keys.includes('Shift');
  const needAlt = def.keys.includes('Alt');
  const modProp = resolveMod(platform);
  const otherPrimary = modProp === 'metaKey' ? 'ctrlKey' : 'metaKey';

  if (needMod ? !event[modProp] || event[otherPrimary] : event.metaKey || event.ctrlKey) {
    return false;
  }
  if (needAlt !== event.altKey) return false;

  const token = keyTokenOf(def);
  // `+` and `?` arrive with Shift held on most layouts, so their bindings must
  // not constrain it; every other chord matches Shift exactly.
  if (!SHIFT_AGNOSTIC.has(token) && needShift !== event.shiftKey) return false;

  return keyMatches(event, token);
}

/**
 * Canonical signature of the chord a def resolves to on a platform. Two enabled
 * defs sharing a signature would silently shadow each other — the invariant
 * test asserts they never do.
 */
export function chordSignature(def: ShortcutDef, platform: Platform): string {
  const token = keyTokenOf(def);
  const mod = def.keys.includes('Mod') ? resolveMod(platform) : 'none';
  const shift = SHIFT_AGNOSTIC.has(token) ? 'any' : String(def.keys.includes('Shift'));
  const alt = String(def.keys.includes('Alt'));
  return `${mod}|shift:${shift}|alt:${alt}|${token}`;
}

const MOD_GLYPH: Record<Platform, string> = { mac: '⌘', other: 'Ctrl' };
const ALT_GLYPH: Record<Platform, string> = { mac: '⌥', other: 'Alt' };
const SHIFT_GLYPH = '⇧';

const KEY_GLYPH: Record<string, string> = {
  Escape: 'Esc',
  Delete: 'Del',
  Arrow: '↑ ↓ ← →',
  ContextMenu: 'Menu',
  '=': '+',
  '-': '−',
  '?': '?',
};

function keyGlyph(token: string): string {
  if (KEY_GLYPH[token]) return KEY_GLYPH[token];
  return token.length === 1 ? token.toUpperCase() : token;
}

/** Human-readable, platform-correct rendering of a def's chord for the overlay. */
export function formatChord(def: ShortcutDef, platform: Platform): string {
  const parts: string[] = [];
  if (def.keys.includes('Mod')) parts.push(MOD_GLYPH[platform]);
  if (def.keys.includes('Shift')) parts.push(SHIFT_GLYPH);
  if (def.keys.includes('Alt')) parts.push(ALT_GLYPH[platform]);
  parts.push(keyGlyph(keyTokenOf(def)));
  // Mac stacks glyphs tight (⌘⇧1); elsewhere the words read better joined by +.
  return platform === 'mac' ? parts.join(' ') : parts.join('+');
}

/**
 * The chord hint for a shortcut id, or undefined when the keymap has none. The
 * context menus read their right-aligned hints through this so a rebinding here
 * shows up in every menu without anyone touching the menu code.
 */
export function formatShortcut(id: string, platform: Platform): string | undefined {
  const def = CANVAS_SHORTCUTS.find((d) => d.id === id);
  return def ? formatChord(def, platform) : undefined;
}
