// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where an application or a container runs, and what it leverages
 * (ADR-0013, ADR-0014, ADR-0020): the one written, the other derived.
 */
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { ElementId } from '../model/types';
import { hostingOf, mayBeHosted } from '../model/hosting';
import { useStrings } from '../i18n/LanguageContext';
import {
  heldIdsOf, hostingChoices, leverageText, runsSomewhere,
  type InspectorField, type InspectorTechnology,
} from './elementInspectorFacts';
import type { LeverageLine } from '../model/leverage';

/**
 * Where it runs (ADR-0013, redone). A container says it; an application with
 * containers is told what they say, because it is not deployed anywhere
 * itself; one with no containers — an outside system, a SaaS service, a
 * bought package — says it too, which is the only sentence anybody can write
 * about it.
 */
export function HostingField({ field, technology }: { field: InspectorField; technology: InspectorTechnology }) {
  const { element, model } = field;
  const { platforms, elsewhere } = hostingChoices(model, technology);
  if (!runsSomewhere(element.kind) || (platforms.length === 0 && elsewhere.length === 0)) return null;
  return mayBeHosted(model.elements, element.id)
    ? <HostedOnSelect field={field} technology={technology} platforms={platforms} elsewhere={elsewhere} />
    : <RunsOnLine field={field} />;
}

type Choices = ReturnType<typeof hostingChoices>;

function HostedOnSelect({ field, technology, platforms, elsewhere }: {
  field: InspectorField;
  technology: InspectorTechnology;
  platforms: Choices['platforms'];
  elsewhere: Choices['elsewhere'];
}) {
  const { t } = useStrings();
  const { element, model, actions } = field;
  const hosting = hostingOf(model, element.id);
  const choose = (chosen: ElementId | undefined) => {
    const standIn = chosen !== undefined && !heldIdsOf(model).has(chosen) ? technology?.standInFor(chosen) : undefined;
    if (standIn) actions.setHostedOn(element.id, chosen, standIn);
    else actions.setHostedOn(element.id, chosen);
  };
  return (
    <Box>
      <TextField
        select
        fullWidth
        label={t('field.hostedOn')}
        value={hosting.platformIds[0] ?? ''}
        disabled={field.readOnly || field.owned('hostedOn')}
        helperText={hosting.platformIds.length > 1
          ? t('field.hostedOnSeveral', { count: String(hosting.platformIds.length - 1) })
          : t('field.hostedOnHelp')}
        onChange={(e) => choose(e.target.value || undefined)}
        slotProps={{ htmlInput: { 'data-testid': 'hosted-on' } }}
      >
        <MenuItem value="">{t('common.none')}</MenuItem>
        {platforms.map((platform) => (
          <MenuItem key={platform.id} value={platform.id}>{platform.name}</MenuItem>
        ))}
        {elsewhere.length > 0 && <ListSubheader role="presentation">{t('field.hostedOnElsewhere')}</ListSubheader>}
        {elsewhere.map((platform) => (
          <MenuItem key={platform.id} value={platform.id} data-testid={`hosted-on-elsewhere-${platform.id}`}>
            {platform.name}
            <Typography component="span" sx={{ fontSize: 11, color: 'text.secondary', ml: 1 }}>{platform.where}</Typography>
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
}

function RunsOnLine({ field }: { field: InspectorField }) {
  const { t } = useStrings();
  const { model } = field;
  const hosting = hostingOf(model, field.element.id);
  const nameOf = (id: ElementId) => model.elements.find((held) => held.id === id)?.name ?? id;
  return (
    <Box data-testid="element-runs-on">
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('field.runsOn')}</Typography>
      <Typography sx={{ fontSize: 13 }}>
        {hosting.platformIds.length === 0
          ? t('field.runsOnNothing')
          : t('field.runsOnContainers', {
            names: hosting.platformIds.map((id) => nameOf(id)).join(', '),
            count: String(hosting.containers),
          })}
      </Typography>
    </Box>
  );
}

/**
 * Read only, and derived (ADR-0014): the consumer says which service it uses,
 * the platform team says what realises it, and nobody types the platform on
 * the application. The door under it (ADR-0020) opens the landscape on this
 * card.
 */
export function LeveragesField({ elementId, leverage, onShowOnTechnology }: {
  elementId: ElementId;
  leverage: LeverageLine | undefined;
  onShowOnTechnology?(elementId: ElementId): void;
}) {
  const { t } = useStrings();
  const text = leverageText(leverage, t);
  if (leverage === undefined || (text === '' && !onShowOnTechnology)) return null;
  return (
    <Box data-testid="element-leverages">
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{t('field.leverages')}</Typography>
      <Typography sx={{ fontSize: 13 }}>{text || t('field.runsOnNothing')}</Typography>
      {onShowOnTechnology && (
        <Link
          component="button"
          type="button"
          underline="hover"
          data-testid="show-on-landscape"
          sx={{ fontSize: 12, mt: 0.5, textAlign: 'left' }}
          onClick={() => onShowOnTechnology(elementId)}
        >
          {t('field.showOnLandscape')} ›
        </Link>
      )}
    </Box>
  );
}
