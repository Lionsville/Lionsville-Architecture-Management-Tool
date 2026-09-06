import type { AspectConfigEntry, DesignDiagram } from './types';

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

/** The code a label would get on its own, for showing as a placeholder. */
export function derivedShortCode(label: string): string {
  const cleaned = label.replace(/[^a-zA-Z0-9/€]/g, '');
  return (cleaned.length <= 5 ? cleaned : cleaned.slice(0, 3)).toUpperCase();
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
