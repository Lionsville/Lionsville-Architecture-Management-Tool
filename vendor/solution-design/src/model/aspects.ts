import type { AspectConfigEntry, DesignDiagram } from '../types';

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

/** Resolve the aspect columns for a diagram (configured order, else default five). */
export function aspectConfigFor(diagram: DesignDiagram | undefined): readonly AspectConfigEntry[] {
  const config = diagram?.aspectConfig;
  return config && config.length > 0 ? config : DEFAULT_ASPECT_CONFIG;
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

export function aspectShortCode(entry: AspectConfigEntry): string {
  const known = SHORT_CODES[entry.key];
  if (known) return known;
  const cleaned = entry.label.replace(/[^a-zA-Z0-9/€]/g, '');
  return (cleaned.length <= 5 ? cleaned : cleaned.slice(0, 3)).toUpperCase();
}
