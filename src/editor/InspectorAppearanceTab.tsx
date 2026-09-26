// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The Appearance tab: how this scope DRAWS the thing — a colour, a shape, a
 * mark on a card. It stays beside the canvas, where the card is. The page is
 * about what the thing is, and a colour picker on it would be a control for a
 * drawing you cannot see.
 */
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import type { NodeIconSize, NodeShapeVariant } from '../model/types';
import { useStrings } from '../i18n/LanguageContext';
import { LogoGrid } from './nodes/LogoGrid';
import { ColorField } from './ColorField';
import { ICON_SIZE_OPTIONS, shapeOptionsFor, type InspectorField } from './elementInspectorFacts';

export function AppearanceTab({ field, onRequestLogoUpload }: { field: InspectorField; onRequestLogoUpload?(): void }) {
  const { t } = useStrings();
  const { element, readOnly, update } = field;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <ColorField
        label={t('field.accentColour')}
        ariaLabel={t('field.accentColour')}
        value={element.accentColor}
        readOnly={readOnly}
        onChange={(value) => update({ accentColor: value })}
      />

      <TextField
        select
        label={t('field.shape')}
        value={element.shapeVariant ?? ''}
        fullWidth
        size="small"
        disabled={readOnly}
        onChange={(e) =>
          update({
            shapeVariant: e.target.value === '' ? undefined : (e.target.value as NodeShapeVariant),
          })
        }
      >
        {shapeOptionsFor(element.kind).map((o) => (
          <MenuItem key={o.value} value={o.value}>
            {t(o.labelKey)}
          </MenuItem>
        ))}
      </TextField>

      {/* Icon picker (Phase 3): EVERY kind carries a mark now — the vendor
          gate that used to sit here was about the `vendor` text field, not
          about whether an actor or an input channel can have an icon, and
          conflating the two left four of the seven node kinds unable to
          show one. The None tile writes `undefined` → NULL → no logo. */}
      <LogoGrid
        label={t('field.icon')}
        value={element.iconKey}
        disabled={readOnly}
        onChange={(iconKey) => update({ iconKey })}
        onRequestUpload={onRequestLogoUpload}
        maxHeight={220}
      />

      <IconSizeSelect field={field} />
    </Box>
  );
}

/**
 * Size sits next to the picker rather than in the grid: it is a property of
 * how this element draws, like Shape, and it applies whether the mark came
 * from the library or from an upload.
 */
function IconSizeSelect({ field }: { field: InspectorField }) {
  const { t } = useStrings();
  const { element, readOnly, update } = field;
  return (
    <TextField
      select
      label={t('field.iconSize')}
      value={element.iconSize ?? ''}
      fullWidth
      size="small"
      disabled={readOnly || !element.iconKey}
      helperText={element.iconKey ? undefined : t('field.iconFirst')}
      onChange={(e) =>
        update({
          iconSize: e.target.value === '' ? undefined : (e.target.value as NodeIconSize),
        })
      }
    >
      {ICON_SIZE_OPTIONS.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {t(o.labelKey)}
        </MenuItem>
      ))}
    </TextField>
  );
}
