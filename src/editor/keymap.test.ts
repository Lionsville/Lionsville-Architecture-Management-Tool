import { describe, expect, it } from 'vitest';
import {
  CANVAS_SHORTCUTS,
  chordSignature,
  formatShortcut,
  matchEvent,
  resolveMod,
  type KeyChord,
  type Platform,
  type ShortcutDef,
} from './keymap';
import { t } from '../i18n/strings';

function chord(overrides: Partial<KeyChord>): KeyChord {
  return {
    key: '',
    code: '',
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  };
}

function def(id: string): ShortcutDef {
  const found = CANVAS_SHORTCUTS.find((d) => d.id === id);
  if (!found) throw new Error(`no shortcut def '${id}'`);
  return found;
}

describe('resolveMod', () => {
  it('maps Mod to ⌘ on Mac and Ctrl elsewhere', () => {
    expect(resolveMod('mac')).toBe('metaKey');
    expect(resolveMod('other')).toBe('ctrlKey');
  });
});

describe('matchEvent — Mod resolution per platform', () => {
  it('matches Mod+A with ⌘ on Mac and rejects Ctrl', () => {
    expect(matchEvent(chord({ key: 'a', code: 'KeyA', metaKey: true }), def('select-all'), 'mac')).toBe(true);
    expect(matchEvent(chord({ key: 'a', code: 'KeyA', ctrlKey: true }), def('select-all'), 'mac')).toBe(false);
  });

  it('matches Mod+A with Ctrl on Win/Linux and rejects ⌘', () => {
    expect(matchEvent(chord({ key: 'a', code: 'KeyA', ctrlKey: true }), def('select-all'), 'other')).toBe(true);
    expect(matchEvent(chord({ key: 'a', code: 'KeyA', metaKey: true }), def('select-all'), 'other')).toBe(false);
  });

  it('rejects when the other primary modifier is also held', () => {
    expect(
      matchEvent(chord({ key: 'a', code: 'KeyA', metaKey: true, ctrlKey: true }), def('select-all'), 'mac'),
    ).toBe(false);
  });

  it('matches case-insensitively (uppercase key while Shift is not part of the chord fails)', () => {
    // Mod+C: the copied letter arrives lowercase; the chord has no Shift.
    expect(matchEvent(chord({ key: 'c', metaKey: true }), def('copy'), 'mac')).toBe(true);
    // Mod+Shift+C must NOT trigger plain Mod+C.
    expect(matchEvent(chord({ key: 'C', metaKey: true, shiftKey: true }), def('copy'), 'mac')).toBe(false);
  });
});

describe('matchEvent — special keys', () => {
  it('accepts either arrow with/without Shift for nudge vs fine-nudge', () => {
    expect(matchEvent(chord({ key: 'ArrowUp' }), def('nudge'), 'other')).toBe(true);
    expect(matchEvent(chord({ key: 'ArrowUp', shiftKey: true }), def('nudge'), 'other')).toBe(false);
    expect(matchEvent(chord({ key: 'ArrowLeft', shiftKey: true }), def('nudge-fine'), 'other')).toBe(true);
    expect(matchEvent(chord({ key: 'ArrowLeft' }), def('nudge-fine'), 'other')).toBe(false);
  });

  it('accepts Delete and Backspace for the delete binding', () => {
    expect(matchEvent(chord({ key: 'Delete' }), def('delete'), 'mac')).toBe(true);
    expect(matchEvent(chord({ key: 'Backspace' }), def('delete'), 'mac')).toBe(true);
  });

  it('treats + and = as one Shift-agnostic zoom-in binding', () => {
    expect(matchEvent(chord({ key: '=' }), def('zoom-in'), 'other')).toBe(true);
    expect(matchEvent(chord({ key: '+', shiftKey: true }), def('zoom-in'), 'other')).toBe(true);
  });

  it('recovers Shift+digit via event.code when event.key reports the shifted symbol', () => {
    // US layout: Shift+1 → key '!' but code stays 'Digit1'.
    expect(matchEvent(chord({ key: '!', code: 'Digit1', shiftKey: true }), def('fit-view'), 'mac')).toBe(true);
    expect(matchEvent(chord({ key: '@', code: 'Digit2', shiftKey: true }), def('zoom-100'), 'mac')).toBe(true);
  });

  it('matches ? for the help binding regardless of Shift', () => {
    expect(matchEvent(chord({ key: '?', shiftKey: true }), def('help'), 'other')).toBe(true);
  });

  it('binds F2 to rename and Shift+F10 / the Menu key to the context menu', () => {
    expect(matchEvent(chord({ key: 'F2' }), def('rename'), 'mac')).toBe(true);
    expect(matchEvent(chord({ key: 'F2', shiftKey: true }), def('rename'), 'mac')).toBe(false);
    expect(matchEvent(chord({ key: 'F10', shiftKey: true }), def('context-menu'), 'other')).toBe(true);
    expect(matchEvent(chord({ key: 'F10' }), def('context-menu'), 'other')).toBe(false);
    expect(matchEvent(chord({ key: 'ContextMenu' }), def('context-menu-key'), 'other')).toBe(true);
  });
});

describe('formatShortcut', () => {
  it('renders a known id for the platform and undefined for an unknown one', () => {
    expect(formatShortcut('duplicate', 'mac')).toBe('⌘ D');
    expect(formatShortcut('duplicate', 'other')).toBe('Ctrl+D');
    expect(formatShortcut('rename', 'mac')).toBe('F2');
    expect(formatShortcut('context-menu', 'mac')).toBe('⇧ F10');
    expect(formatShortcut('context-menu-key', 'other')).toBe('Menu');
    expect(formatShortcut('no-such-shortcut', 'mac')).toBeUndefined();
  });
});

describe('CANVAS_SHORTCUTS invariants', () => {
  const platforms: Platform[] = ['mac', 'other'];

  it('has no two defs resolving to the same chord on either platform', () => {
    for (const platform of platforms) {
      const seen = new Map<string, string>();
      for (const shortcut of CANVAS_SHORTCUTS) {
        const sig = chordSignature(shortcut, platform);
        expect(seen.has(sig), `${shortcut.id} collides with ${seen.get(sig)} on ${platform} (${sig})`).toBe(false);
        seen.set(sig, shortcut.id);
      }
    }
  });

  // Flipped in 4B: a def carries a string-table KEY rather than a literal, so
  // the help overlay can render it in the UI language. "Non-empty" therefore
  // becomes "resolves to something other than the key itself".
  it('gives every def a resolvable label key and a valid group', () => {
    const groups = new Set(['selection', 'edit', 'view', 'general']);
    for (const shortcut of CANVAS_SHORTCUTS) {
      expect(t('en', shortcut.labelKey).trim().length).toBeGreaterThan(0);
      expect(t('en', shortcut.labelKey)).not.toBe(shortcut.labelKey);
      expect(groups.has(shortcut.group)).toBe(true);
    }
  });

  it('has unique ids', () => {
    const ids = CANVAS_SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
