// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { useStrings } from '../i18n/LanguageContext';
import { ElementRecord } from './ElementRecord';
import type { ElementInspectorProps } from './ElementInspectorProps';
import { inspectorField, usesChoices } from './elementInspectorFacts';
import { useRenameFocus, useTabPerElement, useUsesPicker } from './useInspectorState';
import { InspectorHeader, InspectorTabs, MoveRecord, OwnedElsewhere, RecordSummaryLine } from './InspectorHeader';
import { GeneralTab } from './InspectorGeneralTab';
import { AppearanceTab } from './InspectorAppearanceTab';
import { aspectCount, DataTab } from './InspectorDataTab';

export type { ElementInspectorProps };
export { shapeOptionsFor } from './elementInspectorFacts';

/** The one table lives in the model; re-exported so this file's callers keep one import. */
export { kindLabel } from '../model/kinds';

/**
 * Element property form (U7a): a tabbed inspector — General / Appearance / Data.
 * The header (kind + Name) and the Delete action stay outside the tabs, always
 * visible. Tab selection is per-selection in-memory state and resets to General
 * when the selected element id changes.
 *
 * **Two layouts, and the record is what differs.** Beside the canvas (`tabs`)
 * the panel holds what a person sets while drawing — name, category, phase,
 * the short description, the placement — and the owner's detail (vendor,
 * owner, dates, successor, whose it is) is one line and a way to the page.
 * On the page (`stacked`) the record is laid out in full above the rest
 * (`ElementRecord.tsx` says why it moved). The fields are the same fields
 * and reach the model the same way; only where they are typed differs.
 *
 * This is the composition; each section is its own component beside it, and
 * what they show is worked out in `elementInspectorFacts.ts`.
 */
export function ElementInspector(props: ElementInspectorProps) {
  const { element, readOnly, actions } = props;
  const { t } = useStrings();
  const field = inspectorField(element, props.model, readOnly, actions, props.owned?.fields);
  const [activeTab, setActiveTab] = useTabPerElement(element.id);
  const nameRef = useRenameFocus(props.renameRequest, element.id, readOnly);
  // Held here rather than in the field, so the picker's ticks outlive a tab
  // switch the way they always have.
  const uses = usesChoices(element, props.model, props.technology, t);
  const picker = useUsesPicker(element.id, uses.usesIds, uses.heldIds, props.technology, actions);

  const stacked = props.layout === 'stacked';
  const show = (tab: number) => stacked || activeTab === tab;
  const sectionTitle = (text: string) =>
    stacked ? (
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {text}
      </Typography>
    ) : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <InspectorHeader field={field} stacked={stacked} nameRef={nameRef} onOpenDocumentation={props.onOpenDocumentation} />
      {props.owned && <OwnedElsewhere owned={props.owned} />}
      {!readOnly && props.move && <MoveRecord move={props.move} />}
      {!stacked && <RecordSummaryLine element={element} model={props.model} onOpenDocumentation={props.onOpenDocumentation} />}

      {stacked && sectionTitle(t('record.title'))}
      {stacked && (
        <ElementRecord
          element={element}
          model={props.model}
          readOnly={readOnly}
          actions={actions}
          owned={field.owned}
          onReplace={props.onReplace}
        />
      )}

      {!stacked && (
        <InspectorTabs
          value={activeTab}
          onChange={setActiveTab}
          dataCount={element.kind === 'application' ? aspectCount(field, props.diagram) : undefined}
        />
      )}

      {sectionTitle(t('tab.general'))}
      {show(0) && <GeneralTab field={field} inspector={props} uses={uses} picker={picker} />}
      {!stacked && show(1) && <AppearanceTab field={field} onRequestLogoUpload={props.onRequestLogoUpload} />}
      {sectionTitle(t('tab.data'))}
      {show(2) && <DataTab key={element.id} field={field} diagram={props.diagram} />}

      {!readOnly && <DeleteAction inspector={props} />}
    </Box>
  );
}

/** Delete, below everything: a container view's boundary application says it deletes the application. */
function DeleteAction({ inspector }: { inspector: ElementInspectorProps }) {
  const { t } = useStrings();
  const { diagram, element } = inspector;
  const isBoundaryApp = diagram.kind === 'container' && diagram.applicationElementId === element.id;
  return (
    <>
      <Divider />
      <Button color="error" variant="outlined" size="small" onClick={inspector.onRequestDelete}>
        {isBoundaryApp ? t('element.deleteApplication') : t('element.removeDelete')}
      </Button>
    </>
  );
}
