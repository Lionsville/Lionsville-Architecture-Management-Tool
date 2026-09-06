import { DEFAULT_TRANSLATE, type StringKey, type Translate } from '../../i18n/strings';
import type { ElementKind } from '../../model/types';

/**
 * Palette content: what each entry is called, what it says about itself, and
 * which group it sits in. Kept out of `ElementPalette.tsx` so the component
 * stays about behaviour and this file stays about copy.
 *
 * The kind lists live here too (they used to sit on the two canvases) because
 * the palette is docked in the editor row and no longer receives them as a
 * canvas prop. `SolutionDesignEditor` picks the list for the active diagram and
 * imports it straight from here; the canvases no longer carry one.
 */

/** A palette entry: every element kind, plus the layer7-only domain group. */
export type PaletteKey = ElementKind | 'domainGroup';

export interface PaletteItem {
  key: PaletteKey;
  /** String-table key for the row's name — the kind's name, shared with the inspector. */
  labelKey: StringKey;
  /**
   * One line, shown where the label alone is not enough: the collapsed rail's
   * tooltip, where there are no visible labels at all. The expanded panel shows
   * labels only — a description under every row was the single biggest source of
   * the noise the redesign removed.
   */
  descriptionKey: StringKey;
}

export const PALETTE_ITEMS: Record<PaletteKey, PaletteItem> = {
  application: {
    key: 'application',
    labelKey: 'kind.application',
    descriptionKey: 'paletteDescription.application',
  },
  component: {
    key: 'component',
    labelKey: 'kind.component',
    descriptionKey: 'paletteDescription.component',
  },
  inputChannel: {
    key: 'inputChannel',
    labelKey: 'kind.inputChannel',
    descriptionKey: 'paletteDescription.inputChannel',
  },
  externalSystem: {
    key: 'externalSystem',
    labelKey: 'kind.externalSystem',
    descriptionKey: 'paletteDescription.externalSystem',
  },
  managementTool: {
    key: 'managementTool',
    labelKey: 'kind.managementTool',
    descriptionKey: 'paletteDescription.managementTool',
  },
  actor: {
    key: 'actor',
    labelKey: 'kind.actor',
    descriptionKey: 'paletteDescription.actor',
  },
  domainGroup: {
    key: 'domainGroup',
    labelKey: 'kind.domainGroup',
    descriptionKey: 'paletteDescription.domainGroup',
  },
};

/** A palette row's name in the given language; English when none is given. */
export function paletteLabel(key: PaletteKey, translate: Translate = DEFAULT_TRANSLATE): string {
  return translate(PALETTE_ITEMS[key].labelKey);
}

export function paletteDescription(
  key: PaletteKey,
  translate: Translate = DEFAULT_TRANSLATE,
): string {
  return translate(PALETTE_ITEMS[key].descriptionKey);
}

export interface PaletteSection {
  id: string;
  titleKey: StringKey;
  keys: PaletteKey[];
}

/**
 * Groups in render order, rendered as quiet captions that never fold. Six rows
 * do not need collapsing; what the captions carry is which kinds the active
 * diagram type even offers, so a container diagram degrades to one row under
 * each of the three captions and still reads as deliberate rather than
 * truncated.
 *
 * A group whose keys are all unavailable on the active diagram is not rendered.
 * Note `component` is not a Layer 7 kind — components require a parent
 * application and live on container diagrams — so `LAYER7_PALETTE` filters it
 * out of the first group there.
 */
export const PALETTE_SECTIONS: PaletteSection[] = [
  { id: 'systems', titleKey: 'palette.section.systems', keys: ['application', 'component'] },
  {
    id: 'integration',
    titleKey: 'palette.section.integration',
    keys: ['inputChannel', 'externalSystem', 'managementTool'],
  },
  { id: 'people', titleKey: 'palette.section.people', keys: ['actor', 'domainGroup'] },
];

/** Layer 7 landscape kinds (no `component` — those belong to container diagrams). */
export const LAYER7_PALETTE: ElementKind[] = [
  'application',
  'actor',
  'externalSystem',
  'inputChannel',
  'managementTool',
];

/** C4 container-diagram kinds. */
export const CONTAINER_PALETTE: ElementKind[] = ['component', 'actor', 'externalSystem'];
