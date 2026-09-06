// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import {
  isBuiltInLogoKey,
  LOGO_CATEGORIES,
  LOGO_ENTRIES,
  searchLogos,
  type LogoCategory,
} from './logoRegistry';
import { PathMark } from './PathMark';
import { GENERIC_MARKS } from '../../model/marks/generic';
import { RAIL_MARKS, RAIL_PACK } from '../../app/iconPacks/rail';
import { registerLogoPack } from '../../model/logoRegistry';

// The pack ships with this build, so the suite asks its questions of a build
// that has it — the same one `composition.ts` assembles.
registerLogoPack(RAIL_PACK);
import { VENDOR_MARKS } from '../../model/marks/vendors';

/**
 * The registry itself: data-shaped, monochrome, grouped, searchable.
 *
 * Resolution (which key wins, and what an unresolvable key falls back to) is
 * asserted in `logoRendering.test.tsx` against the real nodes, where the
 * fallback actually matters.
 */

const entry = (key: string) => LOGO_ENTRIES.find((e) => e.key === key)!;

afterEach(() => cleanup());

describe('the registry', () => {
  it('lists every entry for the picker, with unique keys', () => {
    expect(LOGO_ENTRIES.length).toBeGreaterThan(90);
    expect(new Set(LOGO_ENTRIES.map((e) => e.key)).size).toBe(LOGO_ENTRIES.length);
  });

  it('keeps the eight original keys, so existing documents keep their marks', () => {
    // These were persisted on elements before Phase 3 rewrote the registry as
    // data. Re-drawing a mark is fine; renaming its key is not.
    for (const key of ['database', 'queue', 'api', 'cache', 'storage', 'cdn', 'scheduler', 'auth']) {
      expect(isBuiltInLogoKey(key)).toBe(true);
    }
  });

  it('puts every entry in a declared category, and leaves no category empty', () => {
    const declared = new Set<LogoCategory>(LOGO_CATEGORIES.map((c) => c.key));
    for (const e of LOGO_ENTRIES) expect(declared.has(e.category)).toBe(true);
    for (const category of declared) {
      expect(LOGO_ENTRIES.some((e) => e.category === category)).toBe(true);
    }
  });

  it('sources the three sets: hand-authored generic, rail, and simple-icons vendors', () => {
    expect(GENERIC_MARKS.length).toBeGreaterThanOrEqual(45);
    expect(RAIL_MARKS.length).toBe(13);
    expect(VENDOR_MARKS.length).toBeGreaterThanOrEqual(40);
    expect(LOGO_ENTRIES.length).toBe(
      GENERIC_MARKS.length + RAIL_MARKS.length + VENDOR_MARKS.length,
    );
  });

  it('draws the hand-authored sets with strokes and the vendor marks filled', () => {
    for (const e of [...GENERIC_MARKS, ...RAIL_MARKS]) expect(e.render).toBe('stroke');
    for (const e of VENDOR_MARKS) {
      expect(e.render).toBe('fill');
      expect(e.key.startsWith('vendor-')).toBe(true);
    }
  });

  it('gives every rail mark Dutch keywords — the words a Dutch team types', () => {
    for (const e of RAIL_MARKS) expect(e.keywords.length).toBeGreaterThan(2);
    // Spot-check the terms the roadmap named.
    for (const term of ['materieel', 'perron', 'dienstregeling', 'sein', 'wissel', 'meldkamer', 'reisinformatie']) {
      expect(searchLogos(term).length).toBeGreaterThan(0);
    }
  });

  it('rejects a key it does not know', () => {
    expect(isBuiltInLogoKey('not-a-real-key')).toBe(false);
    expect(isBuiltInLogoKey(undefined)).toBe(false);
    expect(isBuiltInLogoKey('lib:uploaded')).toBe(false);
  });
});

describe('PathMark', () => {
  it('renders a labelled, currentColor svg for every entry', () => {
    for (const e of LOGO_ENTRIES) {
      const { getByLabelText, unmount } = render(<PathMark entry={e} />);
      const svg = getByLabelText(e.label);
      expect(svg.tagName.toLowerCase()).toBe('svg');
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
      // Monochrome: no hardcoded colours, only currentColor strokes/fills.
      expect(svg.outerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(svg.innerHTML).toContain('currentColor');
      unmount();
    }
  });

  it('defaults to a labelled role="img" — the mark names the element on a node', () => {
    const { getByRole } = render(<PathMark entry={entry('database')} />);
    const svg = getByRole('img');
    expect(svg.getAttribute('aria-label')).toBe('Database');
    expect(svg.getAttribute('aria-hidden')).toBeNull();
  });

  it('renders decoratively (aria-hidden, no role/label) when decorative is set', () => {
    // Used in the picker's tiles and the menu row, where adjacent text already
    // names it — a labelled mark would make a reader announce the label twice.
    const { queryByRole, container } = render(<PathMark entry={entry('database')} decorative />);
    expect(queryByRole('img')).toBeNull();
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('aria-label')).toBeNull();
  });

  it('strokes a hand-authored mark and fills a vendor one', () => {
    const stroked = render(<PathMark entry={entry('database')} />);
    const strokePath = stroked.container.querySelector('path')!;
    expect(strokePath.getAttribute('stroke')).toBe('currentColor');
    expect(strokePath.getAttribute('fill')).toBeNull();
    stroked.unmount();

    const filled = render(<PathMark entry={entry('vendor-sap')} />);
    const fillPath = filled.container.querySelector('path')!;
    expect(fillPath.getAttribute('fill')).toBe('currentColor');
    expect(fillPath.getAttribute('stroke')).toBeNull();
  });

  it('takes its size from the prop', () => {
    const { container } = render(<PathMark entry={entry('database')} size={28} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('28');
    expect(svg.getAttribute('height')).toBe('28');
  });
});

describe('searchLogos', () => {
  it('returns everything for a blank query', () => {
    expect(searchLogos('')).toBe(LOGO_ENTRIES);
    expect(searchLogos('   ')).toBe(LOGO_ENTRIES);
  });

  it('matches the label, case-insensitively', () => {
    expect(searchLogos('DATABASE').map((e) => e.key)).toContain('database');
    expect(searchLogos('message queue').map((e) => e.key)).toContain('queue');
  });

  it('matches keywords, including Dutch synonyms', () => {
    expect(searchLogos('wachtrij').map((e) => e.key)).toContain('queue');
    expect(searchLogos('onderhoud').map((e) => e.key)).toContain('rail-depot');
    expect(searchLogos('ov-chipkaart').map((e) => e.key)).toContain('rail-travel-card');
  });

  it('folds diacritics both ways', () => {
    // The query carries accents the entry does not…
    expect(searchLogos('réisinformatie').map((e) => e.key)).toContain('rail-passenger-info');
    // …and a plain query still finds an accented label.
    expect(searchLogos('nederlandse spoorwegen').map((e) => e.key)).toContain('vendor-ns');
  });

  it('matches the category heading the picker shows', () => {
    // A grid with a visible "Rail" group where typing "rail" finds nothing is a
    // wart; the heading names a mark as much as its own label does.
    const rail = searchLogos('rail');
    expect(rail.filter((e) => e.category === 'rail')).toHaveLength(RAIL_MARKS.length);
    // Matching is substring-based, so a query is allowed to pick up a term it
    // is part of ("rail" is in "audit trail"). Narrowing with a second token is
    // the answer to that, not a stricter matcher.
    expect(searchLogos('vendors').every((e) => e.category === 'vendors')).toBe(true);
  });

  it('narrows on every token rather than widening', () => {
    const both = searchLogos('rail camera');
    expect(both.map((e) => e.key)).toEqual(['rail-camera']);
    expect(searchLogos('camera').length).toBeGreaterThanOrEqual(both.length);
  });

  it('finds nothing for a nonsense query', () => {
    expect(searchLogos('zzzzqqqq')).toEqual([]);
  });

  it('searches whatever list it is handed', () => {
    const only = [entry('database'), entry('cache')];
    expect(searchLogos('cache', only).map((e) => e.key)).toEqual(['cache']);
    expect(searchLogos('queue', only)).toEqual([]);
  });
});
