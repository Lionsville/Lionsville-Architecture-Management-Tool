// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The General tab: what a person sets while drawing — what the thing is, where
 * it runs and what it uses, its category, phase and short description, where
 * it is placed — and the offer of a container diagram where it has none.
 */
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { FieldLabel, FieldText } from '../widgets/CompactForms';
import type { DesignDiagram, DesignElement, DesignModel, ElementId } from '../model/types';
import { drawingsPointingAt } from '../model/drawing';
import { placedNodes } from '../model/placement';
import { zoneLabel } from '../model/zones';
import { useStrings } from '../i18n/LanguageContext';
import type { StringKey } from '../i18n/strings';
import { MarkdownField } from '../documentation/ui/MarkdownField';
import { LIFECYCLES, leverageFor, offersContainer, type InspectorField, type usesChoices } from './elementInspectorFacts';
import type { useUsesPicker } from './useInspectorState';
import type { ElementInspectorProps } from './ElementInspectorProps';
import { TechnologyFields } from './InspectorTechnologyFields';
import { HostingField, LeveragesField } from './InspectorHostingFields';
import { UsesField } from './InspectorUsesField';

export function GeneralTab({ field, inspector, uses, picker }: {
  field: InspectorField;
  inspector: ElementInspectorProps;
  uses: ReturnType<typeof usesChoices>;
  picker: ReturnType<typeof useUsesPicker>;
}) {
  const { element, model, readOnly } = field;
  const { onOpenDocumentation, onCreateContainer, onCreateDrawing } = inspector;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <TechnologyFields field={field} offeredBeyond={inspector.offeredBeyond} />
      <HostingField field={field} technology={inspector.technology} />
      <UsesField field={field} uses={uses} picker={picker} />
      <LeveragesField
        elementId={element.id}
        leverage={leverageFor(element, model, inspector.leverage)}
        onShowOnTechnology={inspector.onShowOnTechnology}
      />
      <CategoryLifecycleRow field={field} />
      {!inspector.hideDescription && (
        <MarkdownField
          value={(field.owned('description') ? inspector.owned?.description : element.description) ?? ''}
          disabled={readOnly || field.owned('description')}
          onChange={(value) => field.typed('description', { description: value || undefined })}
          renderMarkdown={inspector.renderMarkdown}
          onOpenDocumentation={onOpenDocumentation ? () => onOpenDocumentation(element.id) : undefined}
        />
      )}
      <PlacementField field={field} diagram={inspector.diagram} />
      <DrawingsField model={model} elementId={element.id} onOpen={inspector.onOpenDrawing} />
      {onCreateContainer && !readOnly && offersContainer(element, model) && (
        <ContainerOffer onCreate={() => onCreateContainer(element.id)} />
      )}
      {onCreateDrawing && !readOnly && (
        <DrawingOffer onCreate={() => onCreateDrawing(element.id)} />
      )}
    </Box>
  );
}

/**
 * The category and the phase on one row: the two short answers a person
 * gives while drawing, side by side where the panel is wide enough and
 * stacked where it is not. The *Managed* switch that stood beside the phase
 * until 3.7.0 is gone: nothing drew it, counted it or asked it — whose a
 * system is, is `outside` on the record (ADR-0012 §4) — and a switch that
 * does nothing is a promise the app does not keep. The flag stays on the
 * record for the files that carry it.
 */
function CategoryLifecycleRow({ field }: { field: InspectorField }) {
  const { element } = field;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 1 }}>
      {element.kind === 'application' && <CategoryField field={field} />}
      <LifecycleField field={field} />
    </Box>
  );
}

function CategoryField({ field }: { field: InspectorField }) {
  const { t } = useStrings();
  const knownCategories = [
    ...new Set(field.model.elements.map((e) => e.category).filter((c): c is string => Boolean(c))),
  ];
  return (
    <Autocomplete
      freeSolo
      options={knownCategories}
      value={field.element.category ?? ''}
      disabled={field.readOnly || field.owned('category')}
      sx={{ minWidth: 0 }}
      // A new element handed in is the field catching up with the selection
      // (`reset`), not a person typing: written, it was an `element.update` on
      // every selection. And a value the element already holds is no change.
      onInputChange={(_e, value, reason) => {
        const category = value || undefined;
        if (reason !== 'reset' && category !== field.element.category) field.update({ category });
      }}
      renderInput={(params) => <TextField {...params} label={t('field.category')} />}
    />
  );
}

function LifecycleField({ field }: { field: InspectorField }) {
  const { t } = useStrings();
  const { element, readOnly } = field;
  return (
    <TextField
      select
      label={t('field.lifecycle')}
      value={element.lifecycle}
      sx={{ minWidth: 0 }}
      disabled={readOnly || field.owned('lifecycle')}
      onChange={(e) => field.update({ lifecycle: e.target.value as DesignElement['lifecycle'] })}
    >
      {LIFECYCLES.map((lifecycle) => (
        <MenuItem key={lifecycle} value={lifecycle}>
          {t(`lifecycle.${lifecycle}` as StringKey)}
        </MenuItem>
      ))}
    </TextField>
  );
}

/**
 * Where it sits on a landscape: the zone, and on the landscape zone the group.
 * Names, not ids: this field is what a person types, and the action resolves
 * a name to the group it belongs to (ADR-0012 §6).
 */
function PlacementField({ field, diagram }: { field: InspectorField; diagram: DesignDiagram }) {
  const { t } = useStrings();
  const { element } = field;
  const placement = placedNodes(diagram).find((p) => p.id === element.id);
  if (!placement || diagram.kind !== 'layer7') return null;
  const groups = diagram.groups ?? [];
  const current = groups.find((group) => group.id === placement.group)?.name ?? '';
  return (
    <Box>
      <FieldLabel>{t('field.placement')}</FieldLabel>
      <FieldText>{t('field.zone', { name: placement.zone ? zoneLabel(placement.zone, t) : '—' })}</FieldText>
      {placement.zone === 'landscape' && (
        <Autocomplete
          freeSolo
          options={groups.map((group) => group.name)}
          value={current}
          disabled={field.readOnly}
          // As the category's: a selection moving is not a person filing it.
          onInputChange={(_e, value, reason) => {
            if (reason !== 'reset' && value !== current) field.actions.fileUnderGroupNamed([element.id], value || undefined)
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t('field.domainGroup')}
              placeholder={t('field.domainGroupPlaceholder')}
              sx={{ mt: 1 }}
            />
          )}
        />
      )}
    </Box>
  );
}

/**
 * The drawings in this scope whose links point at the element. Nothing, when
 * none do — an empty heading would be a heading about an absence.
 */
function DrawingsField({ model, elementId, onOpen }: {
  model: DesignModel;
  elementId: ElementId;
  onOpen?: (diagramId: string) => void;
}) {
  const { t } = useStrings();
  const drawings = drawingsPointingAt(model.diagrams, elementId);
  if (drawings.length === 0) return null;
  return (
    <Box data-testid="element-drawings">
      <FieldLabel sx={{ mb: 0.25 }}>{t('field.onDrawings')}</FieldLabel>
      {drawings.map((drawing) => (
        <Typography key={drawing.id} variant="body2" component="div" data-testid={`element-drawing-${drawing.id}`}>
          {onOpen ? (
            <Link component="button" type="button" variant="body2" onClick={() => onOpen(drawing.id)} sx={{ textAlign: 'left' }}>
              {drawing.name}
            </Link>
          ) : drawing.name}
        </Typography>
      ))}
    </Box>
  );
}

/**
 * Make this application's container diagram. A view is made on purpose: a
 * double-click on the card only OPENS one (`doubleClick.ts`), and a card with
 * nothing inside gives no hint — this button is the hint.
 */
/**
 * Make a drawing anchored to this element. Beside the container button where
 * there is one: a double-click only opens a drawing (`doubleClick.ts`).
 */
function DrawingOffer({ onCreate }: { onCreate(): void }) {
  const { t } = useStrings();
  return (
    <Box>
      <FieldLabel sx={{ mb: 0.5 }}>{t('field.anchoredDrawing')}</FieldLabel>
      <Button size="small" variant="outlined" onClick={onCreate}>
        {t('menu.createDrawing')}
      </Button>
    </Box>
  );
}

function ContainerOffer({ onCreate }: { onCreate(): void }) {
  const { t } = useStrings();
  return (
    <Box>
      <FieldLabel sx={{ mb: 0.5 }}>{t('field.noContainer')}</FieldLabel>
      <Button size="small" variant="outlined" onClick={onCreate}>
        {t('menu.createContainer')}
      </Button>
    </Box>
  );
}
