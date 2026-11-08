// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What an exported picture says about itself: the title block along the
 * bottom, the key under it, and the file's name. Pure, so the precedence of
 * who names the client and what the title says on a dated board are tested
 * without rasterising anything.
 */
import type { Theme } from '@mui/material/styles';
import type { DesignDiagram, DesignModel } from '../model/types';
import type { Language, Translate } from '../i18n';
import { badgeLegend } from '../model/aspects';
import type { ExportLegend, ExportSwatch, ExportTitleBlock } from './props';
import { containerFacts, diagramLines } from './containerLines';
import type { ExportOptions } from './export/ExportDialog';
import { c4PanelFor } from './export/c4Panel';
import { getNodeTokens } from './theme/tokens';
import { ASPECT_STATUS_LABEL, LIFECYCLE_LEGEND } from './aspectLegend';

export interface TitleBlockContext {
  diagram: DesignDiagram | undefined;
  model: DesignModel;
  /** The day the board is looked at, when it is not today (ADR-0027). */
  lookingAt: string | undefined;
  /** The host's defaults for the whole project. */
  host: { client: string; author?: string } | undefined;
  theme: Theme;
  showLifecycle: boolean;
  /** Whether the boxes carry their status marks: on a container diagram, the key explains them only then. */
  showStatus?: boolean;
  t: Translate;
  language: Language;
}

/** The strip along the bottom, or nothing when the picture goes without one. */
export function titleBlockFor(options: ExportOptions, context: TitleBlockContext): ExportTitleBlock | undefined {
  const { diagram, model, lookingAt, host, t } = context;
  if (!diagram || !options.titleBlock) return undefined;
  return {
    // The title block follows the UI language: it is a caption on a picture
    // for a reader, not a field name in a file format.
    labels: {
      client: t('export.client'),
      title: t('export.title'),
      author: t('export.author'),
      date: t('export.date'),
      legend: t('export.aspects'),
    },
    // The diagram's own answer wins over the host's. The host supplies a
    // default — what it knows about the project as a whole — and somebody
    // who opened this diagram's settings and typed a client was correcting
    // exactly that default.
    client: diagram.client ?? host?.client ?? model.name,
    // A board dated for a day that is not today says so on the picture. An
    // exported PNG travels without the app around it, and a future landscape
    // that does not announce itself is read as the present one (ADR-0009).
    // The day on the screen is the day in the picture: a PNG exported while
    // looking at 2028 says 2028, saved or not.
    title: lookingAt
      ? `${scopeAndView(model.name, diagram.name)} · ${t('export.asOf', { date: lookingAt })}`
      : scopeAndView(model.name, diagram.name),
    author: diagram.author ?? host?.author,
    // Absent = the day of export, which is the exporter's own default.
    date: diagram.documentDate || undefined,
    legend: legendFor(options, context, diagram),
    // A container diagram's corner, which takes the title's place.
    c4: c4PanelFor(model, diagram, t, context.language),
  };
}

/** The key as the picture says it: on a container diagram its notation always, what is drawn and nothing else. */
function legendFor(options: ExportOptions, context: TitleBlockContext, diagram: DesignDiagram): ExportLegend | undefined {
  const { t, theme, model, lookingAt } = context;
  const container = diagram.kind === 'container';
  const day = lookingAt ?? diagram.asOf;
  const base = options.legend && (!container || context.showStatus)
    ? exportLegendFor(diagram, theme, context.showLifecycle, t)
    : undefined;
  if (!container) return base;
  const tokens = getNodeTokens(theme);
  const labels = base?.labels ?? { aspects: t('export.aspects'), lifecycle: t('export.lifecycle') };
  const { drawn } = containerFacts(model, diagram, day);
  const box = (bg: string, border: string): ExportSwatch['token'] => ({ bg, border, fg: border });
  const samples: ExportSwatch[] = options.legend ? [
    ...(drawn.has('container') ? [{ label: t('key.container'), token: box(tokens.card.bg, tokens.edge.stroke) }] : []),
    ...(drawn.has('store') ? [{ label: t('key.store'), token: box(tokens.card.bg, tokens.edge.stroke) }] : []),
    ...(drawn.has('application') ? [{ label: t('key.application'), token: box(tokens.boundary.bg, tokens.card.border) }] : []),
    ...(drawn.has('person') ? [{ label: t('key.person'), token: box(tokens.boundary.bg, tokens.card.border) }] : []),
    { label: t('key.boundary'), token: box('transparent', tokens.boundary.border), line: 'dashed-box' as const },
    ...(drawn.has('line') ? [{ label: t('key.line'), token: box(tokens.edge.stroke, tokens.edge.stroke), line: 'solid' as const }] : []),
    ...(drawn.has('unlanded') ? [{ label: t('key.unlanded'), token: box(tokens.edge.stroke, tokens.edge.stroke), line: 'dashed' as const }] : []),
  ] : [];
  const lines = options.lineList ? diagramLines(model, diagram, day).map((line) => (
    `${line.number}  ${line.from} → ${line.to}${line.label ? `: ${line.label}` : ''}${line.protocol ? ` [${line.protocol}]` : ''}`
  )) : [];
  return {
    ...base,
    labels: { ...labels, key: t('export.key'), lines: t('export.lines') },
    ...(samples.length > 0 ? { notation: samples } : {}),
    ...(lines.length > 0 ? { lines } : {}),
  };
}

/**
 * The key under the strip, in the export's own colours: the maturity columns
 * and what the badge colours mean on a landscape, the lifecycle colours on
 * any board that draws them. A board with nothing to explain gets no key.
 */
export function exportLegendFor(
  diagram: DesignDiagram,
  theme: Theme,
  showLifecycle: boolean,
  t: Translate,
): ExportLegend | undefined {
  const tokens = getNodeTokens(theme);
  const legend: ExportLegend = {
    labels: { aspects: t('export.aspects'), lifecycle: t('export.lifecycle') },
  };
  // The same legend the toolbar's popover draws (`badgeLegend`): each code
  // with its long name, so the key on a print says what a badge means
  // rather than listing names a reader has to match to codes.
  const key = badgeLegend(diagram);
  if (key.columns.length > 0) {
    legend.aspects = key.columns.map((column) => `${column.code} ${column.label}`).join(' · ');
    legend.statuses = key.statuses.map((status) => ({ label: t(ASPECT_STATUS_LABEL[status]), token: tokens.aspects[status] }));
  }
  if (showLifecycle) {
    legend.lifecycle = LIFECYCLE_LEGEND.map(({ key: stage, labelKey }) => ({ label: t(labelKey), token: tokens.lifecycle[stage] }));
  }
  return legend.statuses || legend.lifecycle ? legend : undefined;
}

/** `client-diagram.png`, slugged, with a word for either half that slugs to nothing. */
export function pngFilename(client: string, diagram: DesignDiagram): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `${slug(client) || 'design'}-${slug(diagram.name) || 'diagram'}.png`;
}

/** The scope and the view, said once where the view is named after its scope. */
function scopeAndView(scope: string, view: string): string {
  return scope.trim().toLowerCase() === view.trim().toLowerCase() ? view : `${scope} — ${view}`;
}
