// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useStrings } from '../i18n/LanguageContext';
import { ElementRecord } from './ElementRecord';
import type { ElementInspectorProps } from './ElementInspectorProps';
import { inspectorField, usesChoices } from './elementInspectorFacts';
import type { InspectorField } from './elementInspectorFacts';
import { useRenameFocus, useTabPerElement, useUsesPicker } from './useInspectorState';
import { ElementMore, InspectorHeader, InspectorTabs, MoveRecord, OwnedElsewhere, RecordSummaryLine } from './InspectorHeader';
import { InspectorSection } from './InspectorSection';
import { GeneralTab } from './InspectorGeneralTab';
import { AppearanceTab } from './InspectorAppearanceTab';
import { aspectCount, DataTab } from './InspectorDataTab';
import { CommentThread } from '../comments/ui/threadPart';

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
 * **A unit comes first** (ADR-0036, as built 3.6.1). Where the host's unit
 * section leads (`UnitSlot.leads`: an actor with a type), it follows the name,
 * and the element's own fields fold under *Element* below it — beside the
 * canvas; the page lays them out, as it lays out the tabs. *Move…* and
 * *Create drawing* go into the *⋯* beside the name. An actor without a type,
 * and every other kind, keeps the element's order, the section under General.
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
  const unit = props.unitSection;
  const leads = unit?.leads === true;
  const fields = (
    <ElementFields
      // Led by the unit, Create drawing is in the ⋯ menu and not offered twice.
      inspector={leads ? { ...props, onCreateDrawing: undefined } : props}
      field={field}
      tab={{ value: activeTab, onChange: setActiveTab }}
      uses={uses}
      picker={picker}
      underGeneral={leads ? undefined : unit?.section}
    />
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <InspectorHeader
        field={field}
        stacked={stacked}
        nameRef={nameRef}
        onOpenDocumentation={props.onOpenDocumentation}
        more={leads ? <ElementMore inspector={props} /> : undefined}
      />
      {props.owned && <OwnedElsewhere owned={props.owned} />}
      {!leads && !readOnly && props.move && <MoveRecord move={props.move} />}
      {leads ? (
        <>
          {unit.section}
          <ElementFold key={element.id} stacked={stacked}>{fields}</ElementFold>
        </>
      ) : fields}

      <CommentThread about={{ kind: 'element', id: element.id }} />
      {!readOnly && <DeleteAction inspector={props} />}
    </Box>
  );
}

/**
 * The element's own fields: its record, the tabs and what they hold — and,
 * where the host's unit section does not lead, that section under General.
 */
function ElementFields({ inspector, field, tab, uses, picker, underGeneral }: {
  inspector: ElementInspectorProps;
  field: InspectorField;
  tab: { value: number; onChange(tab: number): void };
  uses: ReturnType<typeof usesChoices>;
  picker: ReturnType<typeof useUsesPicker>;
  underGeneral: ReactNode;
}) {
  const { t } = useStrings();
  const { element, readOnly } = field;
  const stacked = inspector.layout === 'stacked';
  const show = (index: number) => stacked || tab.value === index;
  const sectionTitle = (text: string) =>
    stacked ? (
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {text}
      </Typography>
    ) : null;

  return (
    <>
      {!stacked && <RecordSummaryLine element={element} model={inspector.model} parties={inspector.parties} answeredBy={inspector.answeredBy} onOpenDocumentation={inspector.onOpenDocumentation} />}

      {stacked && sectionTitle(t('record.title'))}
      {stacked && (
        <ElementRecord
          element={element}
          model={inspector.model}
          readOnly={readOnly}
          actions={inspector.actions}
          owned={field.owned}
          parties={inspector.parties}
          answeredBy={inspector.answeredBy}
          onReplace={inspector.onReplace}
        />
      )}

      {!stacked && (
        <InspectorTabs
          value={tab.value}
          onChange={tab.onChange}
          dataCount={element.kind === 'application' ? aspectCount(field, inspector.diagram) : undefined}
        />
      )}

      {sectionTitle(t('tab.general'))}
      {show(0) && <GeneralTab field={field} inspector={inspector} uses={uses} picker={picker} />}
      {show(0) && underGeneral}
      {!stacked && show(1) && <AppearanceTab field={field} onRequestLogoUpload={inspector.onRequestLogoUpload} />}
      {sectionTitle(t('tab.data'))}
      {show(2) && <DataTab key={element.id} field={field} diagram={inspector.diagram} />}
    </>
  );
}

/**
 * The element's own fields under a unit: folded beside the canvas, where the
 * unit is what a person came for, and folded again for each unit picked. The
 * page lays them out below the unit, as it lays out the tabs.
 */
function ElementFold({ stacked, children }: { stacked: boolean; children: ReactNode }) {
  const { t } = useStrings();
  if (stacked) return <>{children}</>;
  return (
    <InspectorSection title={t('inspector.element')} note={t('inspector.elementHolds')} testId="element-fold">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{children}</Box>
    </InspectorSection>
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
