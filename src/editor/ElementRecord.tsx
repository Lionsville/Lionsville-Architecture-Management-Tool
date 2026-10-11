// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The record: what an element IS in the organisation, as fields on its page.
 *
 * The inspector beside the canvas used to hold every field an element has, and
 * was getting long: a vendor, an owner, three dates and a successor are not
 * what a person sets while dragging a card into a group. They are the owner's
 * detail in the sense of ADR-0012 §3 — the fields a stand-in may not carry —
 * and they belong on the page, where the width is there to lay them out and
 * the reader has come to find out about the thing rather than to draw it.
 *
 * So this is the half that moved. The panel keeps what is about the drawing
 * and the day-to-day (name, category, phase, the short description, the
 * placement) and shows a read-out of this half with a way to the page; the
 * page shows this half above the rest. Both write through the same
 * `updateElement`, so the undo stack and `mayEdit` do not know which one
 * a keystroke came from.
 *
 * `outside` and the party it belongs to are asked here for the first time —
 * the register reported "nobody said whose" about a record no screen could say
 * it on. The party is an actor this scope can see: one of its own — for a
 * landscape often a stand-in of one of the organisation's — or one a scope
 * above keeps, named by its plain id (ADR-0012 §4).
 */
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { DesignElement, DesignModel, ElementId } from '../model/types';
import { DATED_PHASES, datesInOrder } from '../model/lifecycle';
import { OrderedDateFields } from '../widgets/OrderedDateFields';
import { useStrings } from '../i18n/LanguageContext';
import type { StringKey, Translate } from '../i18n/strings';
import { fieldEdit } from '../model/commands';
import type { EditorActions } from './useEditorState';
import type { AnsweredBy, PartyElsewhere } from './props';
import { isBlankRef } from '../model/person';
import type { PersonRef } from '../model/person';
import type { PersonNames } from '../people/ui/names';
import { usePersonNames } from '../people/ui/names';
import { PersonRefField } from '../people/ui/PersonRefField';

/**
 * Who sells it — asked of an application and of nothing else.
 *
 * It used to be asked of three kinds, and the other two turned out to BE
 * applications (ADR-0012 §4): a management tool has a vendor because it is a
 * piece of software somebody bought, and so does a system from outside.
 */
export function showVendor(kind: DesignElement['kind']): boolean {
  return kind === 'application';
}

export function showTechnology(kind: DesignElement['kind']): boolean {
  return kind === 'application' || kind === 'component';
}

/**
 * Whether it is ours is a question about a system and about a party — a
 * customer's portal, a regulator. A capability or a step is ours by
 * definition, because it is a thing this organisation does.
 */
export function showOutside(kind: DesignElement['kind']): boolean {
  return kind === 'application' || kind === 'actor';
}

/** The choices under *Belongs to*, grouped by the scope that keeps them. */
export interface PartyChoices {
  /** This scope's own actors, stand-ins included. */
  here: readonly { id: ElementId; name: string }[];
  /** The actors each scope above keeps and this one does not, nearest first. */
  above: readonly { where: string; parties: readonly PartyElsewhere[] }[];
  /**
   * The party the record names where nothing above offers it — a scope that
   * is gone, a sibling's actor. Offered under its id so the field shows what
   * is written rather than a blank, and a person can see it and change it.
   */
  unknown?: ElementId;
}

/**
 * Which actors *Belongs to* may name (ADR-0012 §4): this scope's own, then
 * those of the scopes above that this one holds no record of, as the host
 * hands them over. An id held here is this scope's, even when it is a
 * stand-in of an actor above: the record is the same actor.
 */
export function partyChoices(
  element: DesignElement,
  model: DesignModel,
  elsewhere: readonly PartyElsewhere[] = [],
): PartyChoices {
  const here = model.elements
    .filter((other) => other.kind === 'actor' && other.id !== element.id)
    .map(({ id, name }) => ({ id, name }));
  const held = new Set(model.elements.map((other) => other.id));
  const above: { where: string; parties: PartyElsewhere[] }[] = [];
  for (const party of elsewhere) {
    if (held.has(party.id)) continue;
    const group = above.find((one) => one.where === party.where);
    if (group) group.parties.push(party);
    else above.push({ where: party.where, parties: [party] });
  }
  const offered = (id: ElementId) =>
    here.some((one) => one.id === id) || above.some((group) => group.parties.some((one) => one.id === id));
  const named = element.partyId;
  return {
    here,
    above,
    ...(named !== undefined && !offered(named) ? { unknown: named } : {}),
  };
}

/** What to call the party a record names: its name where this scope or one above keeps it. */
function partyName(
  partyId: ElementId | undefined,
  model: DesignModel,
  elsewhere: readonly PartyElsewhere[] = [],
): string | undefined {
  if (partyId === undefined) return undefined;
  return model.elements.find((other) => other.id === partyId)?.name
    ?? elsewhere.find((other) => other.id === partyId)?.name;
}

export interface ElementRecordProps {
  element: DesignElement;
  model: DesignModel;
  readOnly: boolean;
  actions: EditorActions;
  /** Is this field another scope's to answer for? See `ElementInspectorProps.owned`. */
  owned(field: string): boolean;
  /** The actors the scopes above keep, as the host reads them. Absent = this scope's own only. */
  parties?: readonly PartyElsewhere[];
  /** Start a replacement (ADR-0010). Absent = no Replace… button. */
  onReplace?(elementId: ElementId): void;
  /** Who answers for it beyond its own field: a stand-in's master, the rule (`EditorOwnership.answeredBy`). */
  answeredBy?: AnsweredBy;
}

/**
 * Who answers for a record, in words (ADR-0036 §8): its own owner, the owner
 * its master names for a stand-in, or — where nobody wrote one — whoever the
 * operating model's rule works out on the day, with the role and the unit
 * that make them it. Nothing where none of the three says anyone.
 */
export function ownerText(
  element: Pick<DesignElement, 'owner'>, names: PersonNames, t: Translate, answeredBy?: AnsweredBy,
): string | undefined {
  const written: PersonRef | undefined = isBlankRef(element.owner) ? answeredBy?.owner : element.owner;
  if (!isBlankRef(written)) return names.text(written);
  const worked = answeredBy?.workedOut;
  if (!worked || worked.people.length === 0) return undefined;
  const who = worked.people.map((id) => names.text({ person: id })).join(', ');
  return t('record.ownerWorkedOut', { who, role: worked.role, unit: worked.unit });
}

export function ElementRecord(props: ElementRecordProps) {
  const { element, model, readOnly, actions, owned } = props;
  const { t } = useStrings();
  // A person picked from the register, or text; read through the register (ADR-0036 §8).
  const names = usePersonNames();
  const update = (patch: Partial<Omit<DesignElement, 'id' | 'kind'>>) =>
    actions.updateElement(element.id, patch);
  const typed = (field: string, patch: Partial<Omit<DesignElement, 'id' | 'kind'>>) =>
    actions.updateElement(element.id, patch, fieldEdit(element.id, field));

  const parties = partyChoices(element, model, props.parties);

  return (
    <Box data-testid="element-record" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <OwnerField element={element} names={names} readOnly={readOnly || owned('owner')} answeredBy={props.answeredBy}
        onChange={(owner) => typed('owner', { owner })} />

      {showVendor(element.kind) && (
        <TextField
          label={t('field.vendor')}
          value={element.vendor ?? ''}
          fullWidth
          disabled={readOnly || owned('vendor')}
          onChange={(e) => typed('vendor', { vendor: e.target.value || undefined })}
        />
      )}

      {showTechnology(element.kind) && (
        <TextField
          label={t('field.technology')}
          value={element.technology ?? ''}
          fullWidth
          disabled={readOnly || owned('technology')}
          onChange={(e) => typed('technology', { technology: e.target.value || undefined })}
        />
      )}

      {/* `true` or absent, never `false` (ADR-0012 §3): switching it off
          removes the key, so nothing has to write down that a thing is ours.
          The party goes with it — a thing that is ours belongs to nobody
          else, and a party left on it would be what the checks call a
          contradiction. */}
      {showOutside(element.kind) && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={element.outside === true}
                disabled={readOnly || owned('outside')}
                onChange={(e) => update(
                  e.target.checked
                    ? { outside: true }
                    : { outside: undefined, partyId: undefined },
                )}
              />
            }
            label={t('field.outside')}
            sx={{ flex: 1, minWidth: 180 }}
          />
          {/* Whose it is: a party outside, or — for one of ours — the unit
              it belongs to, which the operating model's rule reads its
              owner from (ADR-0036 §2). */}
          {element.kind === 'application' && (
            <TextField
              select
              label={t('field.party')}
              data-guide="record.party"
              value={element.partyId ?? ''}
              disabled={readOnly || owned('partyId')}
              sx={{ flex: 1, minWidth: 180 }}
              onChange={(e) => update({ partyId: e.target.value || undefined })}
            >
              <MenuItem value="">{t('field.partyNone')}</MenuItem>
              {parties.here.map((party) => (
                <MenuItem key={party.id} value={party.id}>{party.name}</MenuItem>
              ))}
              {/* A select's children, not a fragment per group: MUI reads
                  the options off its direct children. */}
              {parties.above.flatMap((group) => [
                <ListSubheader key={`where:${group.where}`} role="presentation">{group.where}</ListSubheader>,
                ...group.parties.map((party) => (
                  <MenuItem key={party.id} value={party.id}>{party.name}</MenuItem>
                )),
              ])}
              {parties.unknown !== undefined && (
                <MenuItem value={parties.unknown}>{parties.unknown}</MenuItem>
              )}
            </TextField>
          )}
        </Box>
      )}

      {/* The dates on the lifecycle (ADR-0009). Optional throughout: an
          element that says nothing about time behaves exactly as it did
          before dates existed, and these three stay empty.
          A grid rather than a row of three: a native date input will not
          shrink below its own text, so three sharing a narrow inspector
          clipped the date to its first two parts. Each keeps room for a
          whole date and they stack where there is not room for three. */}
      <Box
        data-testid="element-lifecycle-dates"
        sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1 }}
      >
        <OrderedDateFields
          keys={DATED_PHASES}
          values={element.lifecycleDates}
          label={(phase) => t(`field.date.${phase}` as StringKey)}
          sx={{ minWidth: 0 }}
          disabled={readOnly || owned('lifecycleDates')}
          accepts={datesInOrder}
          refusal={t('command.datesOutOfOrder')}
          onChange={(lifecycleDates) => update({ lifecycleDates })}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          select
          label={t('field.successor')}
          value={element.successorId ?? ''}
          disabled={readOnly || owned('successorId')}
          sx={{ flex: 1 }}
          onChange={(e) => update({ successorId: e.target.value || undefined })}
        >
          <MenuItem value="">{t('field.notSet')}</MenuItem>
          {model.elements
            // Anything but itself: a successor is another thing in this
            // landscape, and a self-reference would be a cycle in the checks.
            .filter((other) => other.id !== element.id && other.kind === element.kind)
            .map((other) => (
              <MenuItem key={other.id} value={other.id}>{other.name}</MenuItem>
            ))}
        </TextField>
        {/* The gesture that sets this field and everything around it
            (ADR-0010). Beside the field rather than under it, so "replaced
            by" and "replace…" read as one question. */}
        {!readOnly && !owned('successorId') && props.onReplace && (
          <Button size="small" variant="outlined" data-guide="record.replace" onClick={() => props.onReplace?.(element.id)}>
            {t('field.replace')}
          </Button>
        )}
      </Box>
    </Box>
  );
}

/**
 * Who answers for it: a person picked from the register or a name typed — a
 * stand-in shows its master's, greyed — and, where nobody wrote one, whoever
 * the rule works out today, said under the field (ADR-0036 §2, §8).
 */
function OwnerField({ element, names, readOnly, answeredBy, onChange }: {
  element: DesignElement;
  names: PersonNames;
  readOnly: boolean;
  answeredBy?: AnsweredBy;
  onChange(owner: PersonRef | undefined): void;
}) {
  const { t } = useStrings();
  const shown = isBlankRef(element.owner) && answeredBy?.owner !== undefined ? answeredBy.owner : element.owner;
  const worked = isBlankRef(shown) ? ownerText({}, names, t, answeredBy) : undefined;
  return (
    <Box data-testid="record-owner">
      <PersonRefField
        value={shown} onChange={onChange} names={names} label={t('field.owner')} disabled={readOnly}
        testId="record-owner-field" inputTestId="record-owner-text" s={t}
      />
      {worked && (
        <Typography variant="caption" color="text.secondary" data-testid="record-owner-worked-out" sx={{ display: 'block', mt: 0.5 }}>
          {worked}
        </Typography>
      )}
    </Box>
  );
}

/**
 * The record in one line, for the panel beside the canvas: "Owner · Vendor ·
 * Technology · Outside", whichever are set. Empty when none is, so the panel
 * can say so instead. The owner reads through the register, and where
 * nobody wrote one, it is whoever the rule works out (ADR-0036 §8); without
 * `people` a picked owner reads as nobody's name.
 */
export function recordSummary(
  element: DesignElement,
  model: DesignModel,
  t: Translate,
  parties?: readonly PartyElsewhere[],
  people?: { names: PersonNames; answeredBy?: AnsweredBy },
): string[] {
  const parts: string[] = [];
  const owner = people ? ownerText(element, people.names, t, people.answeredBy) : typeof element.owner === 'string' ? element.owner : undefined;
  if (owner) parts.push(`${t('field.owner')}: ${owner}`);
  if (element.vendor) parts.push(`${t('field.vendor')}: ${element.vendor}`);
  if (element.technology) parts.push(`${t('field.technology')}: ${element.technology}`);
  if (element.outside) {
    const party = partyName(element.partyId, model, parties);
    parts.push(party ? t('record.outsideOf', { name: party }) : t('field.outside'));
  }
  const successor = model.elements.find((other) => other.id === element.successorId)?.name;
  if (successor) parts.push(`${t('field.successor')}: ${successor}`);
  return parts;
}
