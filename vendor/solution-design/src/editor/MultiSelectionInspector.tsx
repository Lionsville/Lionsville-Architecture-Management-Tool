import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { DesignDiagram, Lifecycle } from '../types';
import { useStrings } from '../i18n/LanguageContext';
import type { StringKey } from '../i18n/strings';
import { LogoGrid } from '../nodes/LogoGrid';
import { ColorField } from './ColorField';
import type { EditorActions, Selection } from './useEditorState';

/**
 * Inspector state when more than one item is selected: a summary, and the four
 * properties worth setting on a whole selection at once.
 *
 * **Why these four and not the whole form.** A bulk editor is a blunt tool, and
 * the danger is not that it edits too little but that it quietly edits too much.
 * Lifecycle, accent colour, icon and domain group are the properties where "make
 * these twelve the same" is the actual intent — a retiring wave, a colour for a
 * programme, one vendor's mark, one domain. Name, description, category and the
 * aspects are per-element facts; a control that wrote one value across a
 * selection would be a mistake generator, so they stay in the single-element
 * inspector.
 *
 * **Every control is write-only.** There is no "current value" to show for a
 * mixed selection, and a field that displayed the first element's value would
 * read like a form you can edit rather than a switch you can throw. So each
 * control sits at its own neutral position, applies on change, and returns to
 * neutral: it says what it will DO, never what things are.
 *
 * Each change is one `updateElements` / `setDomainGroups` call and therefore one
 * undo step over the whole selection.
 */
export function MultiSelectionInspector({
  selection,
  diagram,
  readOnly,
  actions,
  onRequestLogoUpload,
}: {
  selection: Selection;
  /** Absent = the summary only (the shape this component had before 4B). */
  diagram?: DesignDiagram;
  readOnly?: boolean;
  actions?: EditorActions;
  onRequestLogoUpload?(): void;
}) {
  const { t } = useStrings();
  const elements = selection.elementIds.length;
  const connections = selection.connectionIds.length;
  const groups = selection.domainGroups.length;
  const total = elements + connections + groups;

  const parts: string[] = [];
  if (elements > 0) {
    parts.push(
      elements === 1
        ? t('inspector.elementsOne', { count: elements })
        : t('inspector.elementsOther', { count: elements }),
    );
  }
  if (connections > 0) {
    parts.push(
      connections === 1
        ? t('inspector.connectionsOne', { count: connections })
        : t('inspector.connectionsOther', { count: connections }),
    );
  }
  if (groups > 0) {
    parts.push(
      groups === 1
        ? t('inspector.groupsOne', { count: groups })
        : t('inspector.groupsOther', { count: groups }),
    );
  }

  const canEdit = Boolean(actions) && !readOnly && elements > 0;
  // Domain groups only exist on a Layer 7 board, and only for placements sitting
  // on the landscape — the same rule the element menu applies.
  const landscapeIds =
    diagram?.kind === 'layer7'
      ? selection.elementIds.filter((id) => {
          const placement = diagram.placements.find((p) => p.elementId === id);
          return placement !== undefined && (placement.zone ?? 'landscape') === 'landscape';
        })
      : [];
  const knownGroups = Array.from(
    new Set(
      (diagram?.placements ?? [])
        .map((p) => p.domainGroup)
        .filter((name): name is string => Boolean(name)),
    ),
  ).sort();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {t('inspector.selected', { count: total })}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {parts.join(' · ')}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t('inspector.multiHint')}
      </Typography>

      {canEdit && actions && (
        <>
          <Divider sx={{ mt: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            {t('inspector.bulkTitle')}
          </Typography>

          <TextField
            select
            size="small"
            fullWidth
            label={t('inspector.bulkLifecycle')}
            value=""
            onChange={(event) => {
              if (!event.target.value) return;
              actions.updateElements(selection.elementIds, {
                lifecycle: event.target.value as Lifecycle,
              });
            }}
          >
            <MenuItem value="">{t('inspector.bulkNoChange')}</MenuItem>
            {LIFECYCLES.map((lifecycle) => (
              <MenuItem key={lifecycle} value={lifecycle}>
                {t(`lifecycle.${lifecycle}` as StringKey)}
              </MenuItem>
            ))}
          </TextField>

          {/* Clearing writes `undefined` → NULL → back to the kind's own colour,
              which is the same "reset" the single-element control offers. */}
          <ColorField
            label={t('inspector.bulkColour')}
            ariaLabel={t('inspector.bulkColourAria')}
            value={undefined}
            readOnly={false}
            onChange={(value) => actions.updateElements(selection.elementIds, { accentColor: value })}
          />

          <LogoGrid
            label={t('inspector.bulkIcon')}
            value={undefined}
            onChange={(iconKey) => actions.updateElements(selection.elementIds, { iconKey })}
            onRequestUpload={onRequestLogoUpload}
            maxHeight={180}
          />

          {landscapeIds.length > 0 && (
            <Autocomplete
              freeSolo
              options={knownGroups}
              value=""
              onChange={(_event, value) =>
                actions.setDomainGroups(landscapeIds, (value ?? '').trim() || undefined)
              }
              renderInput={(params) => (
                <TextField {...params} size="small" label={t('inspector.bulkDomainGroup')} />
              )}
            />
          )}

          <Typography variant="caption" color="text.secondary">
            {t('inspector.bulkNote')}
          </Typography>
        </>
      )}
    </Box>
  );
}

const LIFECYCLES: Lifecycle[] = ['planned', 'live', 'retiring', 'retired'];
