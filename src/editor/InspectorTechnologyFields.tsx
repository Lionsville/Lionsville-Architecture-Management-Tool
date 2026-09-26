// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The technology layer's own controls on the General tab (ADR-0014 §2.8): what
 * a platform is, whether a service is offered beyond its team, what either
 * sits in, what a platform realises and who maintains either.
 */
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { PlatformArchetype } from '../model/types';
import { PLATFORM_ARCHETYPES, PLATFORM_ARCHETYPE_LABEL, platformArchetypeOf } from '../model/relations';
import { wouldCycle } from '../model/tree';
import { useStrings } from '../i18n/LanguageContext';
import { sharedNote, technologyChoices, type InspectorField } from './elementInspectorFacts';

export function TechnologyFields({ field, offeredBeyond }: {
  field: InspectorField;
  offeredBeyond?: readonly string[];
}) {
  const { element } = field;
  const choices = technologyChoices(element, field.model);
  return (
    <>
      {element.kind === 'platform' && <PlatformArchetypeField field={field} />}
      {element.kind === 'platformService' && <ServiceSharedField field={field} offeredBeyond={offeredBeyond} />}
      {choices.isTechnology && element.ref === undefined && <PartOfField field={field} kin={choices.kin} />}
      {element.kind === 'platform' && choices.services.length > 0 && (
        <RealisesField field={field} services={choices.services} realised={choices.realised} />
      )}
      {choices.isTechnology && choices.actors.length > 0 && (
        <MaintainedByField field={field} actors={choices.actors} maintainer={choices.maintainer} />
      )}
    </>
  );
}

type Choices = ReturnType<typeof technologyChoices>;

/**
 * What it is (ADR-0014): a place, a service or a network. A service when
 * unsaid, which is what the select shows — a wrong place draws a box nobody
 * asked for, a wrong service draws nothing.
 */
function PlatformArchetypeField({ field }: { field: InspectorField }) {
  const { t } = useStrings();
  return (
    <TextField
      select
      label={t('field.platformArchetype')}
      value={platformArchetypeOf(field.element)}
      disabled={field.readOnly || field.owned('platformArchetype')}
      helperText={t('field.platformArchetypeHelp')}
      onChange={(e) => field.update({ platformArchetype: e.target.value as PlatformArchetype })}
    >
      {PLATFORM_ARCHETYPES.map((archetype) => (
        <MenuItem key={archetype} value={archetype}>{t(PLATFORM_ARCHETYPE_LABEL[archetype])}</MenuItem>
      ))}
    </TextField>
  );
}

/**
 * Offered for use beyond the team that maintains it (ADR-0014). Explicit,
 * because organisations draw this line differently; and where nobody has
 * ticked, the rows still say — shown beside the tick as a sentence, never
 * written into the field, so a value somebody typed wins and is left as typed.
 */
function ServiceSharedField({ field, offeredBeyond }: { field: InspectorField; offeredBeyond?: readonly string[] }) {
  const { t } = useStrings();
  const { element } = field;
  return (
    <Box data-testid="service-shared">
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={element.shared === true}
            disabled={field.readOnly || field.owned('shared')}
            onChange={(e) => field.update({ shared: e.target.checked ? true : undefined })}
          />
        }
        label={<Typography variant="caption">{t('field.shared')}</Typography>}
      />
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }} data-testid="service-shared-derived">
        {sharedNote(element.shared, offeredBeyond, t)}
      </Typography>
    </Box>
  );
}

function PartOfField({ field, kin }: { field: InspectorField; kin: Choices['kin'] }) {
  const { t } = useStrings();
  const { element } = field;
  return (
    <TextField
      select
      fullWidth
      label={t('field.partOf')}
      value={element.parentId ?? ''}
      disabled={field.readOnly || field.owned('parentId')}
      slotProps={{ htmlInput: { 'data-testid': 'element-part-of' } }}
      onChange={(e) => field.update({ parentId: e.target.value === '' ? undefined : e.target.value })}
    >
      <MenuItem value="">{t('field.partOfNothing')}</MenuItem>
      {kin.map((candidate) => {
        const loops = wouldCycle(field.model.elements, element.id, candidate.id);
        return (
          <MenuItem key={candidate.id} value={candidate.id} disabled={loops}>
            {candidate.name}
            {loops && (
              <Typography component="span" sx={{ fontSize: 10, color: 'text.secondary', ml: 1 }}>
                {t('field.parentCycle')}
              </Typography>
            )}
          </MenuItem>
        );
      })}
    </TextField>
  );
}

function RealisesField({ field, services, realised }: {
  field: InspectorField;
  services: Choices['services'];
  realised: Choices['realised'];
}) {
  const { t } = useStrings();
  return (
    <Autocomplete
      multiple
      options={services}
      getOptionLabel={(held) => held.name}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      value={realised}
      disabled={field.readOnly}
      onChange={(_e, value) => field.actions.setRealises(field.element.id, value.map((held) => held.id))}
      renderInput={(params) => (
        <TextField {...params} label={t('field.realises')} helperText={t('field.realisesHelp')} />
      )}
      data-testid="element-realises"
    />
  );
}

function MaintainedByField({ field, actors, maintainer }: {
  field: InspectorField;
  actors: Choices['actors'];
  maintainer: string;
}) {
  const { t } = useStrings();
  return (
    <TextField
      select
      fullWidth
      label={t('field.maintainedBy')}
      value={maintainer}
      disabled={field.readOnly}
      slotProps={{ htmlInput: { 'data-testid': 'element-maintained-by' } }}
      onChange={(e) => field.actions.setMaintainedBy(field.element.id, e.target.value || undefined)}
    >
      <MenuItem value="">{t('field.maintainedByNone')}</MenuItem>
      {actors.map((actor) => (
        <MenuItem key={actor.id} value={actor.id}>{actor.name}</MenuItem>
      ))}
    </TextField>
  );
}
