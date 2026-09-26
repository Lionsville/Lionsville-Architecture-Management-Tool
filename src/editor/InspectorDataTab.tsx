// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { DesignDiagram } from '../model/types';
import { aspectConfigFor, derivedPlatformAspect } from '../model/aspects';
import { useStrings } from '../i18n/LanguageContext';
import type { StringKey } from '../i18n/strings';
import { AspectsEditor } from './AspectsEditor';
import { InspectorSection } from './InspectorSection';
import type { InspectorField } from './elementInspectorFacts';

/**
 * The Data tab: an application's operational aspects, with what the rows say
 * about the platform where nobody typed it (ADR-0013) said beside the editor
 * rather than put into it — the field stays empty, which is what makes the
 * derived answer the one shown. Mounted per element, so a section's
 * open/closed default recomputes on a change of selection.
 */
export function DataTab({ field, diagram }: { field: InspectorField; diagram: DesignDiagram }) {
  const { t } = useStrings();
  const { element } = field;
  const aspectConfig = aspectConfigFor(diagram);
  if (element.kind !== 'application') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Typography variant="caption" color="text.secondary" sx={{ pt: 1 }}>
          {t('element.noData')}
        </Typography>
      </Box>
    );
  }
  const derivedPlatform = aspectConfig.some((entry) => entry.key === 'platform')
    ? derivedPlatformAspect(element, field.model)
    : undefined;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <InspectorSection title={t('section.operationalAspects')} badge={aspectCount(field, diagram)} defaultOpen>
        <AspectsEditor
          aspects={element.aspects}
          config={aspectConfig}
          disabled={field.readOnly}
          onChange={(aspects) => field.update({ aspects })}
        />
        {derivedPlatform && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pt: 1 }} data-testid="derived-platform">
            {derivedPlatform.status === 'none'
              ? t('aspect.derivedNone')
              : t('aspect.derivedFrom', { status: t(`aspect.${derivedPlatform.status}` as StringKey), name: derivedPlatform.note })}
          </Typography>
        )}
      </InspectorSection>
    </Box>
  );
}

/** "3/5": how many of the board's aspects this element has set — the Data tab's badge, and its section's. */
export function aspectCount(field: InspectorField, diagram: DesignDiagram): string {
  const aspectConfig = aspectConfigFor(diagram);
  const set = aspectConfig.filter((entry) => field.element.aspects[entry.key]).length;
  return `${set}/${aspectConfig.length}`;
}
