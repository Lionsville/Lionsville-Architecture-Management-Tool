// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the element inspector shows, worked out before anything is drawn.
 *
 * Pure, so each answer the panel gives — which platforms *Hosted on* offers
 * and in what order, what the *Uses* picker lists, what the *Shared* tick
 * says where nobody ticked — is tested without mounting a form. The panel's
 * components read these and draw; none of them decides.
 */
import type { DesignElement, DesignModel, ElementId, NodeIconSize, NodeShapeVariant } from '../model/types';
import type { Translate } from '../i18n/strings';
import type { StringKey } from '../i18n/strings';
import { describeLeverage, leverageOf } from '../model/leverage';
import type { LeverageLine } from '../model/leverage';
import { platformArchetypeOf } from '../model/relations';
import { fieldEdit } from '../model/commands';
import type { EditorActions } from './useEditorState';
import type { EditorOwnership } from './props';

export const LIFECYCLES: DesignElement['lifecycle'][] = ['planned', 'live', 'retiring', 'retired'];

/** The technology the rest of the organisation defines, as the panel is handed it. */
export type InspectorTechnology = EditorOwnership['technology'];

/**
 * What every field of the panel is handed: the record, whether it may be
 * written, and the two ways a write reaches the model.
 */
export interface InspectorField {
  element: DesignElement;
  model: DesignModel;
  readOnly: boolean;
  actions: EditorActions;
  /**
   * Is this field the owning scope's to answer for? A stand-in's caches and
   * the owner's detail both come through `owned.fields`, so the panel greys
   * out exactly what a write from anywhere else would be refused.
   */
  owned(field: string): boolean;
  update(patch: Partial<Omit<DesignElement, 'id' | 'kind'>>): void;
  /**
   * A text field: every keystroke reaches the model — the card on the canvas is
   * drawn from it — but the run of them is one undo step (see `fieldEdit`).
   */
  typed(field: string, patch: Partial<Omit<DesignElement, 'id' | 'kind'>>): void;
}

/**
 * The field scope for one element: `owned` reads the owning scope's list
 * (ADR-0012 §10), `update` is one step per change, `typed` folds a run of
 * keystrokes into one.
 */
export function inspectorField(
  element: DesignElement,
  model: DesignModel,
  readOnly: boolean,
  actions: EditorActions,
  ownedFields: readonly string[] | undefined,
): InspectorField {
  return {
    element,
    model,
    readOnly,
    actions,
    owned: (name) => ownedFields?.includes(name) ?? false,
    update: (patch) => actions.updateElement(element.id, patch),
    typed: (name, patch) => actions.updateElement(element.id, patch, fieldEdit(element.id, name)),
  };
}

/**
 * Shape-variant options (U6a). The empty option writes `undefined` → NULL →
 * inherit each kind's current shape, exactly like the connection style controls'
 * "default" choice. No explicit default token is ever stored.
 */
const SHAPE_VARIANT_OPTIONS: { value: NodeShapeVariant | ''; labelKey: StringKey }[] = [
  { value: '', labelKey: 'option.default' },
  { value: 'rounded', labelKey: 'option.rounded' },
  { value: 'sharp', labelKey: 'option.sharp' },
  { value: 'subtle', labelKey: 'option.subtle' },
];

/**
 * Icon size (Phase 3). The empty option writes `undefined` → NULL → the header
 * mark every node has always drawn, so an element that never touched this reads
 * exactly as before.
 */
export const ICON_SIZE_OPTIONS: { value: NodeIconSize | ''; labelKey: StringKey }[] = [
  { value: '', labelKey: 'option.iconSmall' },
  { value: 'large', labelKey: 'option.iconLarge' },
];

/**
 * Shape options for a kind. Actors add the D11 Box↔Stickman choice (`figure`);
 * every other kind keeps rounded/sharp/subtle and never sees `figure`.
 */
export function shapeOptionsFor(
  kind: DesignElement['kind'],
): { value: NodeShapeVariant | ''; labelKey: StringKey }[] {
  return kind === 'actor'
    ? [...SHAPE_VARIANT_OPTIONS, { value: 'figure' as const, labelKey: 'option.stickman' as const }]
    : SHAPE_VARIANT_OPTIONS;
}

/** An application or a container: the two kinds that run somewhere and use something. */
export function runsSomewhere(kind: DesignElement['kind']): boolean {
  return kind === 'component' || kind === 'application';
}

export function heldIdsOf(model: DesignModel): Set<ElementId> {
  return new Set(model.elements.map((held) => held.id));
}

/**
 * The records this scope must write to point at `ids`: a stand-in for each one
 * it does not hold yet, where the rest of the organisation can say what one is.
 */
export function standInsFor(
  ids: readonly ElementId[],
  held: ReadonlySet<ElementId>,
  standInFor: ((id: ElementId) => DesignElement | undefined) | undefined,
): DesignElement[] {
  return ids
    .filter((id) => !held.has(id))
    .map((id) => standInFor?.(id))
    .filter((one): one is DesignElement => one !== undefined);
}

/**
 * Where it runs, and what it could run on (ADR-0013, redone). The platforms
 * this scope holds, definitions and stand-ins both: a shared cluster is
 * drawn here and defined in the platform scope. The places first (ADR-0014):
 * a container sits in a namespace or on a machine, and a broker is offered
 * after them rather than refused, because binding to one is legal. Then the
 * platforms the rest of the organisation defines (ADR-0017), the places first
 * likewise, so a container can be hosted on a cloud its landscape has never
 * drawn; choosing one writes the stand-in.
 */
export function hostingChoices(model: DesignModel, technology: InspectorTechnology) {
  const isPlace = (held: DesignElement) => platformArchetypeOf(held) === 'place';
  const platforms = model.elements
    .filter((held) => held.kind === 'platform')
    .sort((a, b) => Number(isPlace(b)) - Number(isPlace(a)));
  const heldIds = heldIdsOf(model);
  const elsewhere = (technology?.elsewhere ?? [])
    .filter((one) => one.kind === 'platform' && !heldIds.has(one.id))
    .sort((a, b) => Number(b.place) - Number(a.place));
  return { platforms, elsewhere };
}

/**
 * What it leverages (ADR-0014): the services it uses and the platforms
 * behind them, derived and never typed here. The host's answer where it has
 * a tree to read, this scope's own rows otherwise; nothing for a kind that
 * runs nowhere.
 */
export function leverageFor(
  element: DesignElement,
  model: DesignModel,
  given: LeverageLine | undefined,
): LeverageLine | undefined {
  if (!runsSomewhere(element.kind)) return undefined;
  return given ?? describeLeverage(
    leverageOf(model, element.id),
    (id) => model.elements.find((held) => held.id === id)?.name,
  );
}

/** The leverage as one line: each service with the platforms behind it, then the platforms used directly. */
export function leverageText(leverage: LeverageLine | undefined, t: Translate): string {
  if (leverage === undefined) return '';
  return [
    ...leverage.services.map((one) => `${one.platforms.length
      ? `${one.name} (${one.platforms.map((platform) => platform.name).join(', ')})`
      : one.name}${one.implied ? ` ${t('field.leveragesImplied')}` : ''}`),
    ...leverage.platforms.map((one) => one.name),
  ].join(' · ');
}

/**
 * The technology layer's own controls (ADR-0014 §2.8). What a platform or
 * a service sits in is the same kind's tree, over this scope's own records
 * — a stand-in sits on the owner's tree and is not offered one here — with
 * a loop shown and refused rather than hidden, as the sheet's inspector
 * does. What a platform realises, and who maintains either, are rows.
 */
export function technologyChoices(element: DesignElement, model: DesignModel) {
  const isTechnology = element.kind === 'platform' || element.kind === 'platformService';
  const kin = isTechnology
    ? model.elements.filter((held) => held.kind === element.kind && held.id !== element.id && held.ref === undefined)
    : [];
  const services = model.elements.filter((held) => held.kind === 'platformService');
  const realised = model.relations
    .filter((row) => row.type === 'realises' && row.sourceId === element.id)
    .map((row) => services.find((held) => held.id === row.targetId))
    .filter((held): held is DesignElement => held !== undefined);
  const actors = model.elements.filter((held) => held.kind === 'actor');
  const maintainer = model.relations.find((row) => row.type === 'assigned' && row.targetId === element.id)?.sourceId ?? '';
  return { isTechnology, kin, services, realised, actors, maintainer };
}

/**
 * The sentence beside the *Shared* tick (ADR-0014): the help where somebody
 * ticked it or the host has no tree to read; otherwise what the rows say —
 * who uses it from outside, or that nobody does.
 */
export function sharedNote(shared: boolean | undefined, offeredBeyond: readonly string[] | undefined, t: Translate): string {
  if (shared || offeredBeyond === undefined) return t('field.sharedHelp');
  return offeredBeyond.length > 0
    ? t('field.sharedDerived', { names: offeredBeyond.join(', ') })
    : t('field.sharedWithin');
}

/** One thing the *Uses* picker offers: this scope's, or another's with where it comes from (ADR-0020). */
export type UseOption = { id: ElementId; name: string; group: 'here' | 'elsewhere'; where?: string; platform: boolean };

/**
 * What it uses, as written (ADR-0020): the rows from this element, and what
 * the picker offers — this scope's offerings and service platforms first,
 * then what the rest of the organisation offers: every shared offering and
 * every service platform the index knows, with its scope.
 */
export function usesChoices(element: DesignElement, model: DesignModel, technology: InspectorTechnology, t: Translate) {
  const usesIds = model.relations
    .filter((row) => row.type === 'uses' && row.sourceId === element.id)
    .map((row) => row.targetId);
  const heldIds = heldIdsOf(model);
  const elsewhereById = new Map((technology?.elsewhere ?? []).map((one) => [one.id, one]));
  const usable: UseOption[] = runsSomewhere(element.kind)
    ? [
      ...model.elements
        .filter((held) => held.id !== element.id
          && (held.kind === 'platformService' || (held.kind === 'platform' && platformArchetypeOf(held) === 'service')))
        .map((held): UseOption => ({ id: held.id, name: held.name, group: 'here', platform: held.kind === 'platform' })),
      ...(technology?.elsewhere ?? [])
        .filter((one) => !heldIds.has(one.id) && (one.kind === 'platformService' ? one.shared === true : !one.place))
        .map((one): UseOption => ({ id: one.id, name: one.name, group: 'elsewhere', where: one.where, platform: one.kind === 'platform' })),
    ]
    : [];
  const nameOf = (id: ElementId) => model.elements.find((held) => held.id === id)?.name ?? elsewhereById.get(id)?.name ?? id;
  const noteOf = (id: ElementId) => {
    const one = elsewhereById.get(id);
    return one ? [one.shared ? t('field.usesShared') : undefined, one.where].filter(Boolean).join(' · ') : undefined;
  };
  /** A pill's words: the name, and where it comes from when that is somewhere else. */
  const pillLabel = (id: ElementId) => (noteOf(id) ? `${nameOf(id)} · ${noteOf(id)}` : nameOf(id));
  return { usesIds, usable, heldIds, pillLabel };
}

/**
 * A definition this scope draws the inside of, with no inside drawn yet: the
 * panel offers to make its container diagram. A stand-in's inside is the
 * owning scope's business (ADR-0012 §3).
 */
export function offersContainer(element: DesignElement, model: DesignModel): boolean {
  return element.kind === 'application'
    && element.ref === undefined
    && !model.diagrams.some((d) => d.kind === 'container' && d.applicationElementId === element.id);
}
