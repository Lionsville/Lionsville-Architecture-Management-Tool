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
 * it on. The party is an actor of this scope's model, which for a landscape
 * means a stand-in of one of the organisation's (ADR-0012 §4).
 */
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import type { DesignElement, DesignModel, ElementId } from '../model/types';
import { DATED_PHASES } from '../model/lifecycle';
import type { DatedPhase } from '../model/lifecycle';
import { useStrings } from '../i18n/LanguageContext';
import type { StringKey, Translate } from '../i18n/strings';
import { fieldEdit } from '../model/commands';
import type { EditorActions } from './useEditorState';

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

/**
 * A patch for one phase's date, with the whole object rebuilt.
 *
 * Rebuilt rather than mutated because the reducer judges the dates the element
 * would END UP with, and it compares by value: clearing a field has to remove
 * the key, not leave it present and empty.
 */
export function withDate(
  held: DesignElement['lifecycleDates'],
  phase: DatedPhase,
  day: string | undefined,
): DesignElement['lifecycleDates'] {
  const next = { ...held };
  if (day) next[phase] = day;
  else delete next[phase];
  return Object.keys(next).length ? next : undefined;
}

export interface ElementRecordProps {
  element: DesignElement;
  model: DesignModel;
  readOnly: boolean;
  actions: EditorActions;
  /** Is this field another scope's to answer for? See `ElementInspectorProps.owned`. */
  owned(field: string): boolean;
  /** Start a replacement (ADR-0010). Absent = no Replace… button. */
  onReplace?(elementId: ElementId): void;
}

export function ElementRecord(props: ElementRecordProps) {
  const { element, model, readOnly, actions, owned } = props;
  const { t } = useStrings();
  const update = (patch: Partial<Omit<DesignElement, 'id' | 'kind'>>) =>
    actions.updateElement(element.id, patch);
  const typed = (field: string, patch: Partial<Omit<DesignElement, 'id' | 'kind'>>) =>
    actions.updateElement(element.id, patch, fieldEdit(element.id, field));

  const parties = model.elements.filter((other) => other.kind === 'actor' && other.id !== element.id);

  return (
    <Box data-testid="element-record" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TextField
        label={t('field.owner')}
        value={element.owner ?? ''}
        fullWidth
        disabled={readOnly || owned('owner')}
        onChange={(e) => typed('owner', { owner: e.target.value || undefined })}
      />

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
          {element.kind === 'application' && element.outside && (
            <TextField
              select
              label={t('field.party')}
              value={element.partyId ?? ''}
              disabled={readOnly || owned('partyId')}
              sx={{ flex: 1, minWidth: 180 }}
              onChange={(e) => update({ partyId: e.target.value || undefined })}
            >
              <MenuItem value="">{t('field.partyNone')}</MenuItem>
              {parties.map((party) => (
                <MenuItem key={party.id} value={party.id}>{party.name}</MenuItem>
              ))}
            </TextField>
          )}
        </Box>
      )}

      {/* The dates on the lifecycle (ADR-0009). Optional throughout: an
          element that says nothing about time behaves exactly as it did
          before dates existed, and these three stay empty. */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        {DATED_PHASES.map((phase) => (
          <TextField
            key={phase}
            type="date"
            label={t(`field.date.${phase}` as StringKey)}
            value={element.lifecycleDates?.[phase] ?? ''}
            sx={{ flex: 1 }}
            disabled={readOnly || owned('lifecycleDates')}
            slotProps={{ inputLabel: { shrink: true } }}
            onChange={(e) => update({
              lifecycleDates: withDate(element.lifecycleDates, phase, e.target.value || undefined),
            })}
          />
        ))}
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
          <Button size="small" variant="outlined" onClick={() => props.onReplace?.(element.id)}>
            {t('field.replace')}
          </Button>
        )}
      </Box>
    </Box>
  );
}

/**
 * The record in one line, for the panel beside the canvas: "Owner · Vendor ·
 * Technology · Outside", whichever are set. Empty when none is, so the panel
 * can say so instead.
 */
export function recordSummary(
  element: DesignElement,
  model: DesignModel,
  t: Translate,
): string[] {
  const parts: string[] = [];
  if (element.owner) parts.push(`${t('field.owner')}: ${element.owner}`);
  if (element.vendor) parts.push(`${t('field.vendor')}: ${element.vendor}`);
  if (element.technology) parts.push(`${t('field.technology')}: ${element.technology}`);
  if (element.outside) {
    const party = model.elements.find((other) => other.id === element.partyId)?.name;
    parts.push(party ? t('record.outsideOf', { name: party }) : t('field.outside'));
  }
  const successor = model.elements.find((other) => other.id === element.successorId)?.name;
  if (successor) parts.push(`${t('field.successor')}: ${successor}`);
  return parts;
}
