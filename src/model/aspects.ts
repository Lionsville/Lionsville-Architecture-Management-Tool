// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { AspectConfigEntry, AspectStatus, DesignDiagram, DesignElement, ElementId, Relation } from './types';
import { hostingOf } from './hosting';

/**
 * The Lionsville aspect superset: every standard operational aspect a layer7
 * diagram can configure (plus custom slug+label entries added by the host).
 * Order here is the canonical presentation order.
 */
export const ASPECT_SUPERSET: readonly AspectConfigEntry[] = [
  { key: 'platform', label: 'Platform' },
  { key: 'cicd', label: 'CI/CD' },
  { key: 'dr', label: 'Disaster recovery' },
  { key: 'security', label: 'Security' },
  { key: 'monitoring', label: 'Monitoring' },
  { key: 'backup', label: 'Backup' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'cost', label: 'Cost' },
] as const;

/**
 * The platform aspect, read off the rows rather than typed (ADR-0013).
 *
 * The badge used to be the only thing the model could say about platforms:
 * a status per application, set by hand, saying nothing about which. With
 * `hostedOn` rows the fact is in the model, and the badge becomes the
 * derived opinion: *managed* when it runs on a platform this organisation
 * owns, *partial* when it runs on one outside it, *none* when it runs on
 * nothing — and only where the scope holds any platform at all, so a
 * landscape that has not started modelling technology hears nothing. A
 * status somebody set by hand wins, and is left exactly as typed.
 *
 * Returns the element it was given when there is nothing to derive, so a
 * caller comparing by reference sees no change where there is none.
 */
export function withDerivedAspects(
  element: DesignElement,
  model: { elements: readonly DesignElement[]; relations: readonly Relation[] },
): DesignElement {
  const derived = derivedPlatformAspect(element, model);
  if (!derived) return element;
  return { ...element, aspects: { ...element.aspects, platform: derived } };
}

export function derivedPlatformAspect(
  element: Pick<DesignElement, 'id' | 'kind' | 'aspects'>,
  model: { elements: readonly DesignElement[]; relations: readonly Relation[] },
): { status: 'managed' | 'partial' | 'none'; note: string; derived: true } | undefined {
  if (element.kind !== 'application' && element.kind !== 'component') return undefined;
  if (element.aspects?.platform) return undefined;
  const platforms = new Map<ElementId, DesignElement>(
    model.elements.filter((held) => held.kind === 'platform').map((held) => [held.id, held]),
  );
  if (platforms.size === 0) return undefined;
  // The roll-up, not the element's own rows (ADR-0013, redone): an application
  // does not run anywhere, the things it is made of do, and the badge has to
  // say what they say or it says nothing anybody typed and nothing that is
  // true either.
  const on = hostingOf(model, element.id).platformIds
    .map((id) => platforms.get(id))
    .filter((held): held is DesignElement => held !== undefined);
  if (on.length === 0) return { status: 'none', note: '', derived: true };
  const inside = on.filter((held) => !held.outside);
  return {
    status: inside.length > 0 ? 'managed' : 'partial',
    note: (inside.length > 0 ? inside : on).map((held) => held.name).join(', '),
    derived: true,
  };
}

/** The original five — the fallback when a diagram has no aspectConfig. */
export const DEFAULT_ASPECT_CONFIG: readonly AspectConfigEntry[] = ASPECT_SUPERSET.slice(0, 5);

/** No columns at all, shared so consumers can compare identity cheaply. */
const NO_ASPECTS: readonly AspectConfigEntry[] = [];

/**
 * Resolve the aspect columns for a diagram.
 *
 * Three states, and the difference between the last two is the whole point of
 * this function:
 *
 * - `showAspects: false` — the reader is not interested in maturity at all.
 *   Nothing renders, and the configuration is kept so that turning it back on
 *   restores the columns rather than the defaults.
 * - no `aspectConfig` — nobody has said what this diagram's columns are, so it
 *   gets the standard five.
 * - an `aspectConfig`, **including an empty one** — somebody has said, and an
 *   empty answer is an answer. This used to fall back to the default five,
 *   which made "we do not track any of these" impossible to express.
 */
export function aspectConfigFor(diagram: DesignDiagram | undefined): readonly AspectConfigEntry[] {
  if (diagram?.showAspects === false) return NO_ASPECTS;
  return diagram?.aspectConfig ?? DEFAULT_ASPECT_CONFIG;
}

/** Compact cell codes for the badge row; custom keys derive from their label. */
const SHORT_CODES: Record<string, string> = {
  platform: 'PLT',
  cicd: 'CI/CD',
  dr: 'DR',
  security: 'SEC',
  monitoring: 'MON',
  backup: 'BKP',
  compliance: 'CMP',
  cost: '€',
};

/**
 * What the badge cell says.
 *
 * An explicit `code` wins over everything, because a renamed column keeps its
 * key — call `dr` "Continuity" and the badge would otherwise still read DR,
 * which is exactly the surprise this override exists to remove.
 */
export function aspectShortCode(entry: AspectConfigEntry): string {
  const chosen = entry.code?.trim();
  if (chosen) return chosen;
  const known = SHORT_CODES[entry.key];
  if (known) return known;
  return derivedShortCode(entry.label);
}

/**
 * The code a label would get on its own, for showing as a placeholder.
 *
 * A name a person can read gives its initials when it has two or more words
 * — `Self-healing` → SH, `Disaster recovery` → DR — and its first three
 * letters when it has one, `Observability` → OBS; a short single word is
 * itself. The first three letters of a two-word name (`SEL`) was a code
 * nobody could read back, and the legend is not where a person should have
 * to go for a badge on every card.
 */
export function derivedShortCode(label: string): string {
  const words = label.split(/[^a-zA-Z0-9€]+/).filter((word) => word.length > 0);
  if (words.length >= 2) return words.map((word) => word[0]).join('').slice(0, ASPECT_CODE_MAX).toUpperCase();
  const cleaned = words[0] ?? '';
  return (cleaned.length <= ASPECT_CODE_MAX ? cleaned : cleaned.slice(0, 3)).toUpperCase();
}

/** The four a badge can say, in the order every legend lists them. */
export const ASPECT_STATUSES: readonly AspectStatus[] = ['managed', 'partial', 'atRisk', 'none'];

/**
 * What the badges on this board mean: each column's code with its long name,
 * in the board's own order, and the statuses a badge can show.
 *
 * One function, because two things draw it — the toolbar's legend popover
 * and the export's key under the title block — and a legend drawn from two
 * lists is a legend that disagrees with itself. Empty columns for a board
 * that shows no aspects: a container diagram, a landscape whose settings
 * hide them, or one with no columns left.
 */
export function badgeLegend(
  diagram: Pick<DesignDiagram, 'kind' | 'showAspects' | 'aspectConfig'> | undefined,
): { columns: { code: string; label: string }[]; statuses: readonly AspectStatus[] } {
  const shown = diagram?.kind === 'layer7' && diagram.showAspects !== false;
  const columns = shown
    ? aspectConfigFor(diagram as DesignDiagram).map((entry) => ({ code: aspectShortCode(entry), label: entry.label }))
    : [];
  return { columns, statuses: ASPECT_STATUSES };
}

/** How wide a badge code may be before it stops fitting a card's cell. */
export const ASPECT_CODE_MAX = 5;

/**
 * A key for a column somebody just typed a label for.
 *
 * Prefixed `custom-` so a hand-made column can never collide with a superset
 * key, and suffixed on collision so two columns called the same thing stay two
 * columns. Keys are what per-element aspect values are filed under, so this is
 * only ever called when a column is created — renaming one must not move it.
 */
export function aspectKeyForLabel(label: string, taken: readonly string[]): string {
  const slug = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = `custom-${slug || 'aspect'}`;
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.includes(candidate)) return candidate;
  }
}

/**
 * Clean a config on its way into the model: drop the unlabelled, trim what is
 * left, and keep the first of any duplicated key.
 *
 * The dialog can hold a half-typed row without the model ever seeing one.
 */
export function normaliseAspectConfig(
  entries: readonly AspectConfigEntry[],
): AspectConfigEntry[] {
  const seen = new Set<string>();
  const out: AspectConfigEntry[] = [];
  for (const entry of entries) {
    const label = entry.label.trim();
    if (!label || seen.has(entry.key)) continue;
    seen.add(entry.key);
    const code = entry.code?.trim().slice(0, ASPECT_CODE_MAX);
    out.push(code ? { key: entry.key, label, code } : { key: entry.key, label });
  }
  return out;
}
