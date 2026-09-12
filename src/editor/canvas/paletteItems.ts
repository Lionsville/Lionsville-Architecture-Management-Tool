import { DEFAULT_TRANSLATE, type StringKey, type Translate } from '../../i18n/strings';
import type { CanvasKind } from '../../model/placement';
import { KIND_LABEL_KEYS } from '../../model/kinds';

/**
 * Palette content: what each entry is called, what it says about itself, and
 * which group it sits in. Kept out of `ElementPalette.tsx` so the component
 * stays about behaviour and this file stays about copy.
 *
 * The kind lists are re-exported from `model/kindChange` at the bottom, so the
 * palette and the rule that refuses a kind change cannot disagree about what a
 * container diagram may hold. They used to be defined here, which meant the
 * model imported the palette to find out.
 */

/**
 * A palette entry: every kind a canvas can draw, plus the layer7-only domain
 * group. Not every kind — a business kind is not placed on a board at all
 * (`model/placement.canPlaceKind`), so there is no row for one to be offered in.
 */
export type PaletteKey = CanvasKind | 'domainGroup';

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
    labelKey: KIND_LABEL_KEYS.application,
    descriptionKey: 'paletteDescription.application',
  },
  component: {
    key: 'component',
    labelKey: KIND_LABEL_KEYS.component,
    descriptionKey: 'paletteDescription.component',
  },
  actor: {
    key: 'actor',
    labelKey: KIND_LABEL_KEYS.actor,
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
 * Groups in render order, rendered as quiet captions that never fold. What the
 * captions carry is which kinds the active diagram type even offers, so a
 * container diagram degrades to one row under each caption and still reads as
 * deliberate rather than truncated.
 *
 * The integration caption went with ADR-0012 §4. An input channel, an external
 * system and a management tool were three rows that all added an application
 * and differed only in which band it landed in — and the band is the board's to
 * say, so the palette offers the thing and the board offers the place. Right-
 * clicking inside a band and adding there is how a person still puts one
 * straight into it.
 *
 * A group whose keys are all unavailable on the active diagram is not rendered.
 * Note `component` is not a Layer 7 kind — components require a parent
 * application and live on container diagrams — so `LAYER7_PALETTE` filters it
 * out of the first group there.
 */
export const PALETTE_SECTIONS: PaletteSection[] = [
  { id: 'systems', titleKey: 'palette.section.systems', keys: ['application', 'component'] },
  { id: 'people', titleKey: 'palette.section.people', keys: ['actor', 'domainGroup'] },
];

/**
 * Which kinds each sort of diagram may show. Re-exported rather than defined
 * here: the rule is the model's — `canChangeKind` refuses a kind a diagram may
 * not show — and a palette that owned its own copy would be a second answer to
 * the same question.
 */
export { CONTAINER_PALETTE, LAYER7_PALETTE } from '../../model/kindChange';
