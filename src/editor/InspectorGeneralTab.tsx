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
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TechnologyFields field={field} offeredBeyond={inspector.offeredBeyond} />
      <HostingField field={field} technology={inspector.technology} />
      <UsesField field={field} uses={uses} picker={picker} />
      <LeveragesField
        elementId={element.id}
        leverage={leverageFor(element, model, inspector.leverage)}
        onShowOnTechnology={inspector.onShowOnTechnology}
      />
      {element.kind === 'application' && <CategoryField field={field} />}
      <LifecycleRow field={field} />
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
      <DrawingsField model={model} elementId={element.id} />
      {onCreateContainer && !readOnly && offersContainer(element, model) && (
        <ContainerOffer onCreate={() => onCreateContainer(element.id)} />
      )}
      {onCreateDrawing && !readOnly && (
        <DrawingOffer onCreate={() => onCreateDrawing(element.id)} />
      )}
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

function LifecycleRow({ field }: { field: InspectorField }) {
  const { t } = useStrings();
  const { element, readOnly } = field;
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <TextField
        select
        label={t('field.lifecycle')}
        value={element.lifecycle}
        sx={{ flex: 1 }}
        disabled={readOnly || field.owned('lifecycle')}
        onChange={(e) => field.update({ lifecycle: e.target.value as DesignElement['lifecycle'] })}
      >
        {LIFECYCLES.map((lifecycle) => (
          <MenuItem key={lifecycle} value={lifecycle}>
            {t(`lifecycle.${lifecycle}` as StringKey)}
          </MenuItem>
        ))}
      </TextField>
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={element.isManaged}
            disabled={readOnly || field.owned('isManaged')}
            onChange={(e) => field.update({ isManaged: e.target.checked })}
          />
        }
        label={<Typography variant="caption">{t('field.managed')}</Typography>}
      />
    </Box>
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
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {t('field.placement')}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t('field.zone', { name: placement.zone ? zoneLabel(placement.zone, t) : '—' })}
      </Typography>
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
function DrawingsField({ model, elementId }: { model: DesignModel; elementId: ElementId }) {
  const { t } = useStrings();
  const drawings = drawingsPointingAt(model.diagrams, elementId);
  if (drawings.length === 0) return null;
  return (
    <Box data-testid="element-drawings">
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {t('field.onDrawings')}
      </Typography>
      {drawings.map((drawing) => (
        <Typography key={drawing.id} variant="body2" component="div" data-testid={`element-drawing-${drawing.id}`}>
          {drawing.name}
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
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {t('field.anchoredDrawing')}
      </Typography>
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
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {t('field.noContainer')}
      </Typography>
      <Button size="small" variant="outlined" onClick={onCreate}>
        {t('menu.createContainer')}
      </Button>
    </Box>
  );
}
