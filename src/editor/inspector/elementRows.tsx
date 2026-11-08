// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An element's fields, said once as rows, for the panel beside the view and for
 * its record page (`rowTools`): each row reads as text and turns into a field on
 * a press, so the two surfaces cannot drift apart and neither has a Read mode that
 * takes typing. What a stand-in's owner answers for reads and cannot be pressed.
 *
 * Why it is called what it is called lives on the model's side: the owner's one
 * field in `model/ownerField`, the dates in `model/lifecycle`, where it runs in
 * `model/hosting`. What is here is which row asks what.
 */
import { useEffect, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import type { CitationsSection as CitationsSectionShape } from '../../principles/ui/CitationsSection';
import type { PersonRefField as PersonRefFieldShape } from '../../people/ui/PersonRefField';
import { lazyPart } from '../../widgets/lazyPart';
import { MarkdownField } from '../../documentation/ui/MarkdownField';
import { shortDescription } from '../../documentation/documentation';
import { BlockFacts } from '../../blocks/ui/BlockFacts';
import { CommentThread } from '../../comments/ui/threadPart';
import { RecordChanges } from '../../comments/ui/RecordChanges';
import { useStrings } from '../../i18n/LanguageContext';
import type { StringKey, Translate } from '../../i18n/strings';
import { formatDay } from '../../i18n/dates';
import type { Language } from '../../i18n/languages';
import { aspectConfigFor, derivedPlatformAspect } from '../../model/aspects';
import { drawingsAnchoredTo, drawingsPointingAt } from '../../model/drawing';
import { hostingOf, mayBeHosted } from '../../model/hosting';
import { DATED_PHASES, datesInOrder } from '../../model/lifecycle';
import { isBlankRef } from '../../model/person';
import { placedNodes } from '../../model/placement';
import { applicationOwner, ownerPatch } from '../../model/ownerField';
import { PLATFORM_ARCHETYPES, PLATFORM_ARCHETYPE_LABEL, platformArchetypeOf } from '../../model/relations';
import { transitionLabel, transitionsForElement } from '../../model/transition';
import { wouldCycle } from '../../model/tree';
import { CERTAINTIES } from '../../model/types';
import type { AspectStatus, DesignElement, ElementId, NodeShapeVariant, NodeIconSize, PlatformArchetype } from '../../model/types';
import { zoneLabel } from '../../model/zones';
import { usePersonNames } from '../../people/ui/names';
import type { PersonNames } from '../../people/ui/names';
import { PanelLink, PanelSection } from '../../widgets/kit/Panel';
import { Menu } from '../../widgets/kit/Menu';
import { PropertyRow, PropertyRows, Select, TextInput } from '../../widgets/kit/Field';
import type { RowEditor } from '../../widgets/kit/Field';
import { Button } from '../../widgets/kit/Button';
import { PickerMany } from '../../widgets/kit/Picker';
import type { PickerOption } from '../../widgets/kit/Picker';
import { ColorField } from '../ColorField';
import { partyChoices, ownerText, showOutside, showTechnology, showVendor } from '../ElementRecord';
import type { ElementInspectorProps } from '../ElementInspectorProps';
import type { ShowOnDoor } from '../props';
import { ICON_SIZE_OPTIONS, LIFECYCLES, heldIdsOf, hostingChoices, inspectorField, leverageFor, leverageText, offersContainer, runsSomewhere, shapeOptionsFor, sharedNote, technologyChoices, usesChoices } from '../elementInspectorFacts';
import type { InspectorField } from '../elementInspectorFacts';
import { LogoGrid } from '../nodes/LogoGrid';
import { useResolvedLogo } from '../nodes/logoRegistry';
import { useUsesPicker } from '../useInspectorState';
import { DASH, RowSet, pickEdit } from './rowTools';
import type { RowSpec, Surface } from './rowTools';
import { claimKey } from '../../widgets/kit/keys';
import { focusLeaves } from '../../widgets/kit/Surface';
import './inspector.css';

/** Parts a row opens or only the record shows: not in the first download, which every board pays for. */
const CitationsSection = lazyPart<ComponentProps<typeof CitationsSectionShape>>(
  () => import('../../principles/ui/CitationsSection').then((held) => held.CitationsSection),
);
const PersonRefField = lazyPart<ComponentProps<typeof PersonRefFieldShape>>(
  () => import('../../people/ui/PersonRefField').then((held) => held.PersonRefField),
);

const STATUSES: readonly { value: AspectStatus; labelKey: StringKey }[] = [
  { value: 'managed', labelKey: 'aspect.managed' },
  { value: 'partial', labelKey: 'aspect.partial' },
  { value: 'atRisk', labelKey: 'aspect.atRisk' },
  { value: 'none', labelKey: 'aspect.none' },
];

/** A zone's name in a sentence: the board prints it in capitals, as a caption over the band. */
export function zoneWords(zone: Parameters<typeof zoneLabel>[0], t: Translate): string {
  const word = zoneLabel(zone, t);
  return word.charAt(0) + word.slice(1).toLocaleLowerCase();
}

type Ctx = {
  readonly props: ElementInspectorProps;
  readonly field: InspectorField;
  readonly surface: Surface;
  readonly t: Translate;
  readonly language: Language;
  readonly names: PersonNames;
};

function useCtx(props: ElementInspectorProps, surface: Surface): Ctx {
  const { t, language } = useStrings();
  const names = usePersonNames();
  const field = inspectorField(props.element, props.model, props.readOnly, props.actions, props.owned?.fields);
  return { props, field, surface, t, language, names };
}

const empty = (ctx: Ctx) => (ctx.surface === 'record' ? DASH : undefined);

/** The rule for a row that says what the kind is: always, and on the record too. */
const always = (key: string, label: string, node: RowSpec['node']): RowSpec => ({ key, label, rule: 'always', filled: true, node });
const whenFilled = (key: string, label: string, filled: boolean, node: RowSpec['node']): RowSpec => ({ key, label, rule: 'filled', filled, node });

// --- what it is ------------------------------------------------------------

function technologyRows(ctx: Ctx): RowSpec[] {
  const { field: { element, model, actions, owned, update }, t, props } = ctx;
  const choices = technologyChoices(element, model);
  const rows: RowSpec[] = [];
  if (element.kind === 'platform') {
    const label = t('field.platformArchetype');
    rows.push(always('archetype', label, () => (
      <PropertyRow
        label={label} data-testid="element-archetype" help={t('field.platformArchetypeHelp')}
        value={t(PLATFORM_ARCHETYPE_LABEL[platformArchetypeOf(element)])} readOnly={owned('platformArchetype')}
        edit={{ options: PLATFORM_ARCHETYPES.map((value) => ({ value, label: t(PLATFORM_ARCHETYPE_LABEL[value]) })) }}
        onCommit={(value) => update({ platformArchetype: value as PlatformArchetype })}
      />
    )));
  }
  if (element.kind === 'platformService') {
    const label = t('field.shared');
    const word = element.shared === true ? t('inspector.yes') : t('inspector.no');
    const note = sharedNote(element.shared, props.offeredBeyond, t);
    rows.push(always('shared', label, () => (
      <PropertyRow
        label={label} data-testid="service-shared" field="shared" help={t('field.sharedHelp')} value={word} readOnly={owned('shared')}
        display={<>{word}{note && <span className="inspector-note" data-testid="service-shared-derived">{note}</span>}</>}
        edit={{ options: [{ value: 'yes', label: t('inspector.yes') }, { value: 'no', label: t('inspector.no') }] }}
        onCommit={(value) => update({ shared: value === 'yes' ? true : undefined })}
      />
    )));
  }
  if (choices.isTechnology && element.ref === undefined) {
    const label = t('field.partOf');
    const parent = choices.kin.find((one) => one.id === element.parentId)?.name ?? '';
    const options: PickerOption[] = [
      { id: '', label: t('field.partOfNothing') },
      ...choices.kin.map((one) => ({
        id: one.id, label: one.name,
        ...(wouldCycle(model.elements, element.id, one.id) ? { refused: t('field.parentCycle') } : {}),
      })),
    ];
    rows.push(always('partOf', label, () => (
      <PropertyRow
        label={label} data-testid="element-part-of" value={parent} empty={t('field.partOfNothing')} readOnly={owned('parentId')}
        edit={pickEdit({ label, options })} onCommit={(id) => update({ parentId: id === '' ? undefined : id })}
      />
    )));
  }
  if (element.kind === 'platform' && choices.services.length > 0) {
    const label = t('field.realises');
    rows.push(always('realises', label, () => (
      <PropertyRow
        label={label} data-testid="element-realises" help={t('field.realisesHelp')} value={choices.realised.map((one) => one.name).join(', ')}
        empty={DASH}
        edit={(editor) => (
          <PickerMany
            label={label} chosen={choices.realised.map((one) => ({ id: one.id, label: one.name }))}
            options={choices.services.map((one) => ({ id: one.id, label: one.name }))}
            onAdd={(id) => actions.setRealises(element.id, [...choices.realised.map((one) => one.id), id])}
            onRemove={(id) => actions.setRealises(element.id, choices.realised.map((one) => one.id).filter((held) => held !== id))}
            onDone={editor.cancel}
          />
        )}
      />
    )));
  }
  if (choices.isTechnology && choices.actors.length > 0) {
    const label = t('field.maintainedBy');
    const by = choices.actors.find((one) => one.id === choices.maintainer)?.name ?? '';
    rows.push(always('maintainedBy', label, () => (
      <PropertyRow
        label={label} data-testid="element-maintained-by" value={by} empty={t('field.maintainedByNone')}
        edit={pickEdit({ label, options: [{ id: '', label: t('field.maintainedByNone') }, ...choices.actors.map((one) => ({ id: one.id, label: one.name }))] })}
        onCommit={(id) => actions.setMaintainedBy(element.id, id || undefined)}
      />
    )));
  }
  return rows;
}

function lifecycleRow(ctx: Ctx): RowSpec {
  const { field: { element, owned, update }, t } = ctx;
  const label = t('field.lifecycle');
  return always('lifecycle', label, () => (
    <PropertyRow
      label={label} data-testid="element-lifecycle" value={t(`lifecycle.${element.lifecycle}` as StringKey)} readOnly={owned('lifecycle')}
      edit={{ options: LIFECYCLES.map((value) => ({ value, label: t(`lifecycle.${value}` as StringKey) })) }}
      onCommit={(value) => update({ lifecycle: value as DesignElement['lifecycle'] })}
    />
  ));
}

function categoryRow(ctx: Ctx): RowSpec {
  const { field: { element, model, owned, update }, t } = ctx;
  const label = t('field.category');
  const known = [...new Set(model.elements.map((one) => one.category).filter((one): one is string => Boolean(one)))];
  return always('category', label, () => (
    <PropertyRow
      label={label} data-testid="element-category" value={element.category ?? ''} empty={DASH} readOnly={owned('category')}
      edit={pickEdit({
        label,
        options: [...(element.category ? [{ id: '', label: t('field.notSet') }] : []), ...known.map((one) => ({ id: one, label: one }))],
        onCreate: (name) => update({ category: name }),
      })}
      onCommit={(id) => update({ category: id || undefined })}
    />
  ));
}

/** Confirmed or assumed: absent is nobody having said, and that is not a third value to fill in. */
export function certaintyRow(t: Translate, surface: Surface, value: DesignElement['certainty'], readOnly: boolean, write: (next: DesignElement['certainty']) => void): RowSpec {
  const label = t('field.certainty');
  const said = value ? t(`certainty.${value}` as StringKey) : '';
  return whenFilled('certainty', label, value !== undefined, (opening) => (
    <PropertyRow
      label={label} data-testid="row-certainty" value={said} empty={surface === 'record' ? DASH : t('certainty.unsaid')} readOnly={readOnly} startOpen={opening}
      help={t('certainty.help')}
      edit={{ options: [{ value: '', label: t('certainty.unsaid') }, ...CERTAINTIES.map((one) => ({ value: one, label: t(`certainty.${one}` as StringKey) }))] }}
      onCommit={(next) => write(next === '' ? undefined : next as DesignElement['certainty'])}
    />
  ));
}

// --- where it runs ------------------------------------------------------------

function hostingRow(ctx: Ctx): RowSpec | undefined {
  const { field: { element, model, actions, owned }, t, props } = ctx;
  const { platforms, elsewhere } = hostingChoices(model, props.technology);
  if (!runsSomewhere(element.kind) || (platforms.length === 0 && elsewhere.length === 0)) return undefined;
  const hosting = hostingOf(model, element.id);
  const nameOf = (id: ElementId) => model.elements.find((held) => held.id === id)?.name ?? elsewhere.find((one) => one.id === id)?.name ?? id;
  if (!mayBeHosted(model.elements, element.id)) {
    const label = t('field.runsOn');
    return always('runsOn', label, () => (
      <PropertyRow
        label={label} data-testid="element-runs-on" readOnly
        value={hosting.platformIds.length === 0 ? '' : t('field.runsOnContainers', { names: hosting.platformIds.map(nameOf).join(', '), count: String(hosting.containers) })}
        empty={t('field.runsOnNothing')}
      />
    ));
  }
  const label = t('field.hostedOn');
  const first = hosting.platformIds[0];
  const several = hosting.platformIds.length > 1 ? t('field.hostedOnSeveral', { count: String(hosting.platformIds.length - 1) }) : undefined;
  const options: PickerOption[] = [
    { id: '', label: t('common.none') },
    ...platforms.map((one) => ({ id: one.id, label: one.name })),
    ...elsewhere.map((one) => ({ id: one.id, label: one.name, detail: one.where, group: t('field.hostedOnElsewhere') })),
  ];
  return always('hostedOn', label, () => (
    <PropertyRow
      label={label} data-testid="hosted-on" help={t('field.hostedOnHelp')} readOnly={owned('hostedOn')}
      value={first ? nameOf(first) : ''} empty={DASH}
      {...(several ? { display: <>{nameOf(first as string)}<span className="inspector-note">{several}</span></> } : {})}
      edit={pickEdit({ label, options })}
      onCommit={(id) => {
        const chosen = id || undefined;
        const standIn = chosen !== undefined && !heldIdsOf(model).has(chosen) ? props.technology?.standInFor(chosen) : undefined;
        if (standIn) actions.setHostedOn(element.id, chosen, standIn);
        else actions.setHostedOn(element.id, chosen);
      }}
    />
  ));
}

function usesRow(ctx: Ctx): RowSpec | undefined {
  const { field: { element, model, readOnly, owned, actions }, t, props } = ctx;
  const uses = usesChoices(element, model, props.technology, t);
  if (!runsSomewhere(element.kind) || (uses.usesIds.length === 0 && (readOnly || uses.usable.length === 0))) return undefined;
  const label = t('field.uses');
  return always('uses', label, () => (
    <PropertyRow
      label={label} data-testid="element-uses" data-guide="record.uses" help={t('field.usesHelp')} readOnly={owned('uses')}
      value={uses.usesIds.map((id) => uses.pill(id).name).join(', ')} empty={t('field.usesNothing')}
      edit={(editor) => <UsesEditor element={element} uses={uses} technology={props.technology} actions={actions} label={t('field.usesPick')} placeholder={t('field.usesSearch')} groupWord={(group) => (group === 'chosen' ? t('field.usesChosen') : group === 'here' ? t('field.usesHere') : t('field.hostedOnElsewhere'))} platformWord={t('field.usesPlatform')} onDone={editor.cancel} />}
    />
  ));
}

/**
 * The ticks are the list only when the row goes back to being a row, as one step
 * (ADR-0020): `useUsesPicker` holds them and writes on the way out, whichever way out.
 */
function UsesEditor({ element, uses, technology, actions, label, placeholder, groupWord, platformWord, onDone }: {
  element: DesignElement;
  uses: ReturnType<typeof usesChoices>;
  technology: ElementInspectorProps['technology'];
  actions: ElementInspectorProps['actions'];
  label: string;
  placeholder: string;
  groupWord(group: string): string;
  platformWord: string;
  onDone(): void;
}) {
  const picker = useUsesPicker(element.id, uses.usesIds, uses.heldIds, technology, actions);
  return (
    <PickerMany
      label={label} placeholder={placeholder}
      chosen={picker.pending.map((id) => { const { name, note } = uses.pill(id); return { id, label: name, ...(note ? { detail: note } : {}) }; })}
      options={uses.usable.map((option) => ({
        id: option.id, label: option.name, group: groupWord(option.group),
        detail: [option.platform ? platformWord : undefined, option.where].filter(Boolean).join(' · ') || undefined,
      } as PickerOption))}
      onAdd={(id) => picker.setPending([...picker.pending, id])}
      onRemove={(id) => picker.setPending(picker.pending.filter((held) => held !== id))}
      onDone={() => { picker.commit(); onDone(); }}
    />
  );
}

function leveragesRow(ctx: Ctx): RowSpec | undefined {
  const { field: { element, model }, t, props } = ctx;
  const leverage = leverageFor(element, model, props.leverage);
  const text = leverageText(leverage, t);
  const door = props.showOnTechnology;
  if (leverage === undefined || (text === '' && !door)) return undefined;
  const label = t('field.leverages');
  return always('leverages', label, () => (
    <PropertyRow
      label={label} data-testid="element-leverages" readOnly value={text} empty={t('field.runsOnNothing')}
      after={door && <ShowOnLink door={door} elementId={element.id} label={t('field.showOnLandscape')} />}
    />
  ));
}

/**
 * *Show on technology landscape ›*, drawn only while a landscape shows the
 * element (ADR-0019, amended): one opens at a press, several are a menu
 * naming each with the scope that keeps it.
 */
function ShowOnLink({ door, elementId, label }: { door: ShowOnDoor; elementId: ElementId; label: string }) {
  useEffect(() => { door.want(elementId); }, [door, elementId]);
  const anchor = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const places = door.places(elementId);
  if (places.length === 0) return null;
  const press = () => (places.length === 1 ? door.open(elementId, places[0].key) : setOpen(true));
  return (
    <span className="inspector-note" ref={anchor}>
      <PanelLink data-testid="show-on-landscape" onPress={press}>{label} ›</PanelLink>
      {places.length > 1 && (
        <Menu
          open={open} anchorEl={anchor.current} label={label} onClose={() => setOpen(false)}
          items={places.map((place) => ({
            label: place.view, ...(place.scope !== undefined ? { detail: place.scope } : {}),
            'data-testid': 'show-on-place', onSelect: () => door.open(elementId, place.key),
          }))}
        />
      )}
    </span>
  );
}

// --- the record ------------------------------------------------------------

function ownerRow(ctx: Ctx): RowSpec {
  const { field: { element, model, owned, update, typed }, t, names, props } = ctx;
  const label = t('field.owner');
  const worked = isBlankRef(element.owner) ? ownerText(element, names, t, props.answeredBy) : undefined;

  if (element.kind !== 'application') {
    const shown = isBlankRef(element.owner) && props.answeredBy?.owner !== undefined ? props.answeredBy.owner : element.owner;
    const text = isBlankRef(shown) ? '' : names.text(shown);
    return whenFilled('owner', label, text !== '' || worked !== undefined, (opening) => (
      <PropertyRow
        label={label} data-testid="record-owner" readOnly={owned('owner')} startOpen={opening}
        value={text} empty={worked ?? empty(ctx)}
        edit={(editor) => (
          <div onBlur={(event) => { if (focusLeaves(event)) editor.cancel(); }}>
            <PersonRefField
              value={shown} names={names} label={label} s={t} testId="record-owner-field" inputTestId="record-owner-text"
              onChange={(owner) => typed('owner', { owner })}
            />
          </div>
        )}
      />
    ));
  }

  // One field over two keys (ADR-0036, amended): a unit picked, or a name that says it is not one.
  const parties = partyChoices(element, model, props.parties);
  const said = applicationOwner(element);
  const unitName = (id: ElementId) => model.elements.find((one) => one.id === id)?.name ?? props.parties?.find((one) => one.id === id)?.name ?? id;
  const standIn = isBlankRef(element.owner) && element.partyId === undefined ? props.answeredBy?.owner : undefined;
  const text = said.kind === 'unit'
    ? unitName(said.unitId)
    : said.kind === 'named' ? names.text(said.name) : standIn !== undefined ? names.text(standIn) : '';
  const options: PickerOption[] = [
    ...(said.kind === 'none' ? [] : [{ id: '', label: t('owner.nobody') }]),
    ...parties.here.map((one) => ({ id: one.id, label: one.name })),
    ...parties.above.flatMap((group) => group.parties.map((one) => ({ id: one.id, label: one.name, group: group.where }))),
    ...(parties.unknown !== undefined ? [{ id: parties.unknown, label: parties.unknown }] : []),
  ];
  return whenFilled('owner', label, text !== '' || worked !== undefined, (opening) => (
    <PropertyRow
      label={label} data-testid="record-owner" data-guide="record.party" help={t('owner.help')} startOpen={opening}
      readOnly={owned('partyId') && owned('owner')} value={text} empty={worked ?? empty(ctx)}
      {...(said.kind === 'named' ? { display: <>{text}<span className="inspector-note" data-testid="owner-not-a-unit">{t('owner.notAUnit')}</span></> } : {})}
      edit={pickEdit({
        label, options, placeholder: t('owner.placeholder'),
        createLabel: (name) => t('owner.useName', { name }),
        onCreate: (name) => update({ owner: name }),
      })}
      onCommit={(id) => update(id === '' ? ownerPatch(undefined) : { partyId: id })}
    />
  ));
}

function recordRows(ctx: Ctx): RowSpec[] {
  const { field: { element, model, owned, update }, t, language, props, surface } = ctx;
  const rows: RowSpec[] = [ownerRow(ctx)];
  const text = (key: 'vendor' | 'technology') => {
    const label = t(`field.${key}`);
    return whenFilled(key, label, Boolean(element[key]), (opening) => (
      <PropertyRow
        label={label} data-testid={`record-${key}`} value={element[key] ?? ''} empty={empty(ctx)} readOnly={owned(key)} edit="text" startOpen={opening}
        onCommit={(value) => update({ [key]: value || undefined })}
      />
    ));
  };
  if (showVendor(element.kind)) rows.push(text('vendor'));
  if (showTechnology(element.kind) && element.kind !== 'component') rows.push(text('technology'));
  if (showOutside(element.kind)) {
    const label = t('field.outside');
    rows.push(whenFilled('outside', label, element.outside === true, (opening) => (
      <PropertyRow
        label={label} data-testid="record-outside" value={element.outside ? t('inspector.yes') : t('inspector.no')} readOnly={owned('outside')} startOpen={opening}
        edit={{ options: [{ value: 'no', label: t('inspector.no') }, { value: 'yes', label: t('inspector.yes') }] }}
        // `true` or absent, never `false` (ADR-0012 §3).
        onCommit={(value) => update(value === 'yes' ? { outside: true } : { outside: undefined, partyId: undefined })}
      />
    )));
  }
  for (const phase of DATED_PHASES) {
    const label = t(`field.date.${phase}` as StringKey);
    const day = element.lifecycleDates?.[phase];
    const next = (value: string) => {
      const dates = { ...element.lifecycleDates, [phase]: value || undefined };
      if (!value) delete dates[phase];
      return dates;
    };
    rows.push(whenFilled(`date-${phase}`, label, Boolean(day), (opening) => (
      <PropertyRow
        label={label} data-testid={`record-date-${phase}`} value={day ?? ''} display={day ? formatDay(day, language) : undefined} empty={empty(ctx)}
        readOnly={owned('lifecycleDates')} edit="date" startOpen={opening}
        check={(value) => (datesInOrder(next(value)) ? undefined : t('command.datesOutOfOrder'))}
        onCommit={(value) => update({ lifecycleDates: next(value) })}
      />
    )));
  }
  const label = t('field.successor');
  const others = model.elements.filter((other) => other.id !== element.id && other.kind === element.kind);
  const successor = others.find((other) => other.id === element.successorId)?.name ?? element.successorId ?? '';
  rows.push(whenFilled('successor', label, Boolean(element.successorId), (opening) => (
    <PropertyRow
      label={label} data-testid="record-successor" data-guide="record.replace" value={successor} empty={empty(ctx)} readOnly={owned('successorId')} startOpen={opening}
      edit={pickEdit({ label, options: [{ id: '', label: t('field.notSet') }, ...others.map((other) => ({ id: other.id, label: other.name }))] })}
      onCommit={(id) => update({ successorId: id || undefined })}
      {...(props.onReplace && !owned('successorId') ? { action: { label: t('field.replace'), always: true, onPress: () => props.onReplace?.(element.id) } } : {})}
    />
  )));
  rows.push(certaintyRow(t, surface, element.certainty, owned('certainty'), (certainty) => update({ certainty })));
  return rows;
}

function plansRow(ctx: Ctx): RowSpec | undefined {
  const { field: { element }, t, props } = ctx;
  const plans = props.plans ? transitionsForElement(props.plans.list, element.id) : [];
  if (plans.length === 0) return undefined;
  const label = t('inspector.plans');
  return always('plans', label, () => (
    <PropertyRow
      label={label} data-testid="doc-plans" readOnly value={plans.map((plan) => plan.title).join(', ')}
      display={<span className="inspector-links">{plans.map((plan) => <PanelLink key={plan.id} onPress={() => props.plans?.onOpen(plan.id)}>{transitionLabel(plan)} {plan.title}</PanelLink>)}</span>}
    />
  ));
}

// --- operational aspects ------------------------------------------------------------

/** "3 of 5": how many of the view's aspects this element has set. */
export function aspectCount(element: DesignElement, props: Pick<ElementInspectorProps, 'diagram'>, t: Translate): string {
  const config = aspectConfigFor(props.diagram);
  return t('inspector.ofTotal', { count: config.filter((entry) => element.aspects[entry.key]).length, total: config.length });
}

function AspectEditor({ editor, entryLabel, field, entryKey, t }: {
  editor: RowEditor;
  entryLabel: string;
  field: InspectorField;
  entryKey: string;
  t: Translate;
}) {
  const { element, typed, update } = field;
  const aspect = element.aspects[entryKey];
  return (
    <div
      className="inspector-aspect"
      onBlur={(event) => { if (focusLeaves(event)) editor.cancel(); }}
      onKeyDown={(event) => { if (event.key === 'Escape') { claimKey(event); editor.cancel(); } }}
    >
      <Select
        autoFocus aria-label={entryLabel} data-fit value={aspect?.status ?? ''}
        options={[{ value: '', label: t('field.notSet') }, ...STATUSES.map((one) => ({ value: one.value, label: t(one.labelKey) }))]}
        onChange={(value) => {
          const next = { ...element.aspects };
          if (value === '') delete next[entryKey];
          else next[entryKey] = { ...next[entryKey], status: value as AspectStatus };
          update({ aspects: next });
        }}
      />
      {aspect && (
        <TextInput
          data-fit aria-label={t('field.noteAria', { name: entryLabel })} placeholder={t('field.notePlaceholder')} value={aspect.note ?? ''}
          onChange={(event) => typed(`aspect-note-${entryKey}`, { aspects: { ...element.aspects, [entryKey]: { ...aspect, note: event.target.value || undefined } } })}
        />
      )}
    </div>
  );
}

function aspectRows(ctx: Ctx): RowSpec[] {
  const { field, t, props } = ctx;
  return aspectConfigFor(props.diagram).map((entry) => always(`aspect-${entry.key}`, entry.label, () => {
    const aspect = field.element.aspects[entry.key];
    const word = aspect ? t(`aspect.${aspect.status}` as StringKey) : '';
    return (
      <PropertyRow
        label={entry.label} data-testid={`aspect-${entry.key}`} value={word} empty={DASH}
        {...(aspect?.note ? { display: <>{word}<span className="inspector-note">{aspect.note}</span></> } : {})}
        edit={(editor) => <AspectEditor editor={editor} entryLabel={entry.label} field={field} entryKey={entry.key} t={t} />}
      />
    );
  }));
}

function DerivedPlatform({ ctx }: { ctx: Ctx }) {
  const { field: { element, model }, t, props } = ctx;
  if (!aspectConfigFor(props.diagram).some((entry) => entry.key === 'platform')) return null;
  const derived = derivedPlatformAspect(element, model);
  if (!derived) return null;
  return (
    <p className="inspector-note" data-testid="derived-platform">
      {derived.status === 'none' ? t('aspect.derivedNone') : t('aspect.derivedFrom', { status: t(`aspect.${derived.status}` as StringKey), name: derived.note })}
    </p>
  );
}

// --- inside it ------------------------------------------------------------

function insideRows(ctx: Ctx): RowSpec[] {
  const { field: { element, model, readOnly }, t, props } = ctx;
  const rows: RowSpec[] = [];
  if (element.kind === 'application') {
    const label = t('inspector.containerView');
    const container = model.diagrams.find((one) => one.kind === 'container' && one.applicationElementId === element.id);
    const offer = props.onCreateContainer && !readOnly && offersContainer(element, model) ? props.onCreateContainer : undefined;
    rows.push(always('container', label, () => (
      <PropertyRow
        label={label} data-testid="element-container" value={container?.name ?? ''} empty={t('common.none')}
        {...(offer ? { action: { label: t('inspector.create'), always: true, onPress: () => offer(element.id) } } : {})}
        {...(container && props.onOpenView ? { display: <PanelLink onPress={() => props.onOpenView?.(container.id)}>{container.name}</PanelLink> } : {})}
      />
    )));
  }
  const drawings = [...drawingsPointingAt(model.diagrams, element.id), ...drawingsAnchoredTo(model.diagrams, element.id)]
    .filter((one, at, all) => all.findIndex((other) => other.id === one.id) === at);
  const create = !readOnly ? props.onCreateDrawing : undefined;
  if (drawings.length > 0 || create) {
    const label = t('inspector.drawing');
    const open = props.onOpenDrawing;
    rows.push(always('drawing', label, () => (
      <PropertyRow
        label={label} data-testid="element-drawings" value={drawings.map((one) => one.name).join(', ')} empty={t('common.none')}
        {...(drawings.length > 0 ? {
          display: <span className="inspector-links">{drawings.map((one) => (open ? <PanelLink key={one.id} data-testid={`element-drawing-${one.id}`} onPress={() => open(one.id)}>{one.name}</PanelLink> : <span key={one.id} data-testid={`element-drawing-${one.id}`}>{one.name}</span>))}</span>,
        } : {})}
        {...(create ? { action: { label: t('inspector.create'), always: true, onPress: () => create(element.id) } } : {})}
      />
    )));
  }
  return rows;
}

// --- the description ------------------------------------------------------------

/** First lines, press to write, and the way to the page. Help for the writing is the editor's own `?`. */
function DescriptionBlock({ ctx }: { ctx: Ctx }) {
  const { field: { element, readOnly, owned, typed }, t, props } = ctx;
  const [writing, setWriting] = useState(false);
  const locked = readOnly || owned('description');
  const text = (owned('description') ? props.owned?.description : element.description) ?? '';
  const open = props.onOpenDocumentation;
  const openPage = open ? () => open(element.id) : undefined;
  if (writing && !locked) {
    return (
      <div className="inspector-description" data-shortcuts-ignore="" onKeyDown={(event) => { if (event.key === 'Escape') { claimKey(event); setWriting(false); } }}>
        <MarkdownField
          value={text} disabled={false} autoFocus
          onChange={(value) => typed('description', { description: value || undefined })}
          renderMarkdown={props.renderMarkdown}
          onOpenDocumentation={openPage}
        />
        <Button size="small" variant="quiet" onClick={() => setWriting(false)}>{t('inspector.done')}</Button>
      </div>
    );
  }
  const shown = shortDescription(text) || text;
  return (
    <div className="inspector-description" data-testid="element-description">
      {locked
        ? shown && <p className="inspector-description__text">{shown}</p>
        : (
          <button type="button" className="inspector-description__press" data-empty={shown ? undefined : true} onClick={() => setWriting(true)} aria-label={shown ? `${t('inspector.writeDescription')}: ${shown}` : undefined}>
            {shown || t('inspector.addDescription')}
          </button>
        )}
      {openPage && <PanelLink data-testid="open-documentation" onPress={openPage}>{t('inspector.openPage')}</PanelLink>}
    </div>
  );
}

/** What a container is built with: printed on the box, so it is asked for where the box is edited. */
function containerTechnologyRow(ctx: Ctx): RowSpec {
  const { field: { element, owned, update }, t } = ctx;
  const label = t('field.technology');
  return always('containerTechnology', label, (opening) => (
    <PropertyRow
      label={label} data-testid="element-technology" help={t('field.containerTechnologyHelp')}
      value={element.technology ?? ''} empty={empty(ctx)} readOnly={owned('technology')} edit="text" startOpen={opening}
      onCommit={(value) => update({ technology: value || undefined })}
    />
  ));
}

// --- the surfaces ------------------------------------------------------------

function propertiesRows(ctx: Ctx): RowSpec[] {
  const { field: { element } } = ctx;
  return [
    ...technologyRows(ctx),
    lifecycleRow(ctx),
    ...(element.kind === 'component' ? [containerTechnologyRow(ctx)] : []),
    ...(element.kind === 'application' || element.kind === 'component' ? [categoryRow(ctx)] : []),
  ];
}

const present = (rows: readonly (RowSpec | undefined)[]): RowSpec[] => rows.filter((row): row is RowSpec => row !== undefined);

function runsOnRows(ctx: Ctx): RowSpec[] {
  return present([hostingRow(ctx), usesRow(ctx), leveragesRow(ctx)]);
}

/** The Properties tab beside the view. */
export function PanelProperties({ props, onHelp, unit, fold }: {
  props: ElementInspectorProps;
  onHelp(help: string | undefined): void;
  /** A unit's own section, drawn by the host: first where it leads, and last where it does not. */
  unit?: ReactNode;
  /** A unit leads, and what is the element's own goes under this. */
  fold?: (fields: ReactNode) => ReactNode;
}) {
  const ctx = useCtx(props, 'panel');
  const fields = <ElementRows ctx={ctx} onHelp={onHelp} />;
  return (
    <>
      <BlockFacts element={ctx.field.element} />
      {fold ? <>{unit}{fold(fields)}</> : <>{fields}{unit}</>}
    </>
  );
}

function ElementRows({ ctx, onHelp }: { ctx: Ctx; onHelp(help: string | undefined): void }) {
  const { t, props, field: { element, readOnly } } = ctx;
  return (
    <>
      <RowSet rows={propertiesRows(ctx)} surface="panel" readOnly={readOnly} onHelp={onHelp} />
      <DescriptionBlock ctx={ctx} />
      <RowSet rows={runsOnRows(ctx)} surface="panel" title={t('field.runsOn')} readOnly={readOnly} onHelp={onHelp} />
      <RowSet rows={present([plansRow(ctx), ...recordRows(ctx)])} surface="panel" title={t('record.title')} readOnly={readOnly} onHelp={onHelp} />
      {element.kind === 'application' && (
        <RowSet
          rows={aspectRows(ctx)} surface="panel" title={t('section.operationalAspects')} onHelp={onHelp} readOnly={readOnly}
          aside={(
            <>
              {aspectCount(element, props, t)}
              {props.onOpenViewSettings && !readOnly && <>{' · '}<PanelLink onPress={props.onOpenViewSettings}>{t('inspector.columns')}</PanelLink></>}
            </>
          )}
          after={<DerivedPlatform ctx={ctx} />}
        />
      )}
      <RowSet rows={insideRows(ctx)} surface="panel" title={t('inspector.insideIt')} readOnly={readOnly} />
    </>
  );
}

/** The Appearance tab: how this scope draws it. The page is about what it is, and has no card to colour. */
export function PanelAppearance({ props, onHelp }: { props: ElementInspectorProps; onHelp(help: string | undefined): void }) {
  const { t } = useStrings();
  const { element, diagram, readOnly, actions, onRequestLogoUpload } = props;
  const update = (patch: Partial<DesignElement>) => actions.updateElement(element.id, patch);
  const placement = diagram.kind === 'layer7' ? placedNodes(diagram).find((one) => one.id === element.id) : undefined;
  const groups = diagram.groups ?? [];
  const group = groups.find((one) => one.id === placement?.group)?.name ?? '';
  const shapeLabel = t('field.shape');
  const shapes = shapeOptionsFor(element.kind);
  const shape = shapes.find((one) => one.value === (element.shapeVariant ?? ''));
  const iconLabel = t('field.icon');
  const sizeLabel = t('field.iconSize');
  const size = ICON_SIZE_OPTIONS.find((one) => one.value === (element.iconSize ?? ''));
  const colourLabel = t('field.accentColour');
  const logo = useResolvedLogo(element.iconKey);
  return (
    <>
      <PropertyRows readOnly={readOnly} onHelp={onHelp}>
        <PropertyRow
          label={colourLabel} data-testid="element-colour" value={element.accentColor ?? ''} empty={t('inspector.fromKind')}
          {...(element.accentColor ? { display: <><span className="inspector-swatch" style={{ background: element.accentColor }} aria-hidden="true" />{element.accentColor}</> } : {})}
          edit={(editor) => (
            <ColorField label={colourLabel} ariaLabel={colourLabel} value={element.accentColor} readOnly={false} onChange={(value) => { update({ accentColor: value }); if (value === undefined) editor.cancel(); }} />
          )}
        />
        <PropertyRow
          label={shapeLabel} data-testid="element-shape" value={shape ? t(shape.labelKey) : ''}
          edit={{ options: shapes.map((one) => ({ value: one.value, label: t(one.labelKey) })) }}
          onCommit={(value) => update({ shapeVariant: value === '' ? undefined : value as NodeShapeVariant })}
        />
        <PropertyRow
          label={iconLabel} data-testid="element-icon" value={logo?.entry.label ?? element.iconKey ?? ''} empty={t('common.none')}
          edit={(editor) => (
            <div className="inspector-icons" onKeyDown={(event) => { if (event.key === 'Escape') { claimKey(event); editor.cancel(); } }}>
              <LogoGrid label={iconLabel} value={element.iconKey} onChange={(iconKey) => update({ iconKey })} onRequestUpload={onRequestLogoUpload} maxHeight={220} />
              <Button size="small" variant="quiet" onClick={editor.cancel}>{t('inspector.done')}</Button>
            </div>
          )}
        />
        {element.iconKey
          ? (
            <PropertyRow
              label={sizeLabel} data-testid="element-icon-size" value={size ? t(size.labelKey) : ''}
              edit={{ options: ICON_SIZE_OPTIONS.map((one) => ({ value: one.value, label: t(one.labelKey) })) }}
              onCommit={(value) => update({ iconSize: value === '' ? undefined : value as NodeIconSize })}
            />
          )
          : null}
      </PropertyRows>
      {placement && (
        <PanelSection title={t('inspector.onThisView')}>
          <PropertyRows readOnly={readOnly} onHelp={onHelp}>
            <PropertyRow label={t('inspector.zone')} data-testid="element-zone" readOnly value={placement.zone ? zoneWords(placement.zone, t) : DASH} />
            {placement.zone === 'landscape' && (
              <PropertyRow
                label={t('field.domainGroup')} data-testid="element-group" value={group} empty={DASH}
                edit={pickEdit({
                  label: t('field.domainGroup'), placeholder: t('field.domainGroupPlaceholder'),
                  options: [...(group ? [{ id: '', label: t('field.notSet') }] : []), ...groups.map((one) => ({ id: one.name, label: one.name }))],
                  onCreate: (name) => actions.fileUnderGroupNamed([element.id], name),
                })}
                onCommit={(name) => actions.fileUnderGroupNamed([element.id], name || undefined)}
              />
            )}
          </PropertyRows>
        </PanelSection>
      )}
    </>
  );
}

/** The record's sections, in the order the page reads them, each its own row list. */
export const RECORD_SECTIONS = ['properties', 'record', 'aspects', 'connected', 'principles', 'comments'] as const;
export type RecordSectionId = (typeof RECORD_SECTIONS)[number];

/** Which sections a kind has, and what each is headed. Aspects only where the kind has them: no empty tab, no empty heading. */
export function recordSectionsOf(element: DesignElement, t: Translate): { id: RecordSectionId; heading: string }[] {
  const all: { id: RecordSectionId; heading: string }[] = [
    { id: 'properties', heading: t('inspector.properties') },
    { id: 'record', heading: t('record.title') },
    { id: 'aspects', heading: t('section.operationalAspects') },
    { id: 'connected', heading: t('inspector.connected') },
    { id: 'principles', heading: t('inspector.principles') },
    { id: 'comments', heading: t('inspector.comments') },
  ];
  return all.filter((section) => section.id !== 'aspects' || element.kind === 'application');
}

/** One section of the record page. The same rows as the panel, every field shown. */
export function RecordSectionBody({ props, section, unit }: { props: ElementInspectorProps; section: RecordSectionId; unit?: ReactNode }) {
  const ctx = useCtx(props, 'record');
  const { field: { element, readOnly } } = ctx;
  switch (section) {
    case 'properties':
      return (
        <div data-testid="record-properties">
          <BlockFacts element={element} />
          {unit}
          <RowSet rows={[...propertiesRows(ctx), ...placedRows(ctx), ...runsOnRows(ctx)]} surface="record" readOnly={readOnly} />
        </div>
      );
    case 'record':
      return <div data-testid="element-record"><RowSet rows={recordRows(ctx)} surface="record" readOnly={readOnly} /></div>;
    case 'aspects':
      return <RowSet rows={aspectRows(ctx)} surface="record" readOnly={readOnly} after={<DerivedPlatform ctx={ctx} />} />;
    case 'connected':
      return (
        <div data-testid="record-connected">
          <RowSet rows={present([plansRow(ctx), linesRow(ctx), viewsRow(ctx), ...insideRows(ctx)])} surface="record" readOnly={readOnly} />
          {/* What has been done to it (ADR-0038). */}
          <RecordChanges about={{ kind: 'element', id: element.id }} first="added" />
        </div>
      );
    case 'principles':
      // The principles it follows (ADR-0041 §12), under the page's own heading.
      return <CitationsSection about={{ kind: 'element', id: element.id }} subject={`${element.name}\n${element.description ?? ''}`} readOnly={readOnly} headed={false} />;
    case 'comments':
      return <CommentThread about={{ kind: 'element', id: element.id }} headed={false} />;
  }
}

function placedRows(ctx: Ctx): RowSpec[] {
  const { field: { element }, t, props: { diagram } } = ctx;
  const placement = diagram.kind === 'layer7' ? placedNodes(diagram).find((one) => one.id === element.id) : undefined;
  if (!placement) return [];
  const group = diagram.groups?.find((one) => one.id === placement.group)?.name;
  const label = t('inspector.placedIn');
  const words = [placement.zone ? zoneWords(placement.zone, t) : undefined, group].filter(Boolean).join(', ');
  return [always('placed', label, () => <PropertyRow label={label} data-testid="record-placed" readOnly value={words} />)];
}

/** Every line in and out, one line each: to see what touches a hub without tracing it on a canvas. */
function linesRow(ctx: Ctx): RowSpec | undefined {
  const { field: { element, model }, t, props } = ctx;
  const lines = model.relations.filter((row) => (row.type ?? 'flow') === 'flow' && (row.sourceId === element.id || row.targetId === element.id));
  if (lines.length === 0) return undefined;
  const nameOf = (id: ElementId) => model.elements.find((one) => one.id === id)?.name ?? id;
  const label = t('inspector.lines');
  return always('lines', label, () => (
    <PropertyRow
      label={label} data-testid="record-lines" readOnly value={String(lines.length)}
      display={(
        <span className="inspector-links">
          {lines.map((line) => {
            const out = line.sourceId === element.id;
            const other = out ? line.targetId : line.sourceId;
            const words = `${line.isBidirectional ? '↔' : out ? '→' : '←'} ${nameOf(other)}${line.label ? `, ${line.label}` : ''}`;
            return props.onNavigate
              ? <PanelLink key={line.id} onPress={() => props.onNavigate?.(other)}>{words}</PanelLink>
              : <span key={line.id}>{words}</span>;
          })}
        </span>
      )}
    />
  ));
}

/** Which views draw it: what *Remove from view* against *Delete* is a choice about. */
function viewsRow(ctx: Ctx): RowSpec | undefined {
  const { field: { element, model }, t } = ctx;
  const views = model.diagrams.filter((one) => placedNodes(one).some((placed) => placed.id === element.id));
  if (views.length === 0) return undefined;
  const label = t('inspector.onViews');
  return always('views', label, () => <PropertyRow label={label} data-testid="record-views" readOnly value={views.map((one) => one.name).join(', ')} />);
}
