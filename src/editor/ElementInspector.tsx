// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { Fragment, type ReactNode } from 'react';
import { useStrings } from '../i18n/LanguageContext';
import { ElementRecord } from './ElementRecord';
import type { ElementInspectorProps } from './ElementInspectorProps';
import { PAGE_SECTIONS, SECTION_TITLE, TABBED_SECTIONS, inspectorField, usesChoices } from './elementInspectorFacts';
import type { ElementSection, InspectorField } from './elementInspectorFacts';
import { useRenameFocus, useTabPerElement, useUsesPicker } from './useInspectorState';
import { ElementMore, InspectorHeader, InspectorTabs, MoveRecord, OwnedElsewhere, RecordSummaryLine } from './InspectorHeader';
import { InspectorSection } from './InspectorSection';
import { SectionHeading } from '../widgets/CompactForms';
import { GeneralTab } from './InspectorGeneralTab';
import { AppearanceTab } from './InspectorAppearanceTab';
import { aspectCount, DataTab } from './InspectorDataTab';
import { CitationsSection } from '../principles/ui/CitationsSection';
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
 * **Two layouts, one order of sections** (`ELEMENT_SECTIONS`). Beside the
 * canvas (`tabs`) the panel holds what a person sets while drawing — name,
 * category, phase, the short description, the placement — and the owner's
 * detail (vendor, owner, dates, successor, whose it is) is one line and a way
 * to the page. On the page (`stacked`) the record is laid out in full above
 * the rest (`ElementRecord.tsx` says why it moved), in two columns where the
 * column has room. The fields are the same fields, in the same order, worn
 * the same way (`CompactForms`), and reach the model the same way; only
 * where they are typed differs.
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
      {/* Beside the canvas, Move… sits at the end of the record's line (`RecordSummaryLine`); on the page it is a strip of its own. */}
      {stacked && !leads && !readOnly && props.move && <MoveRecord move={props.move} />}
      {leads ? (
        <>
          {unit.section}
          <ElementFold key={element.id} stacked={stacked}>{fields}</ElementFold>
        </>
      ) : fields}

      {/* The principles it follows, on the record's page (ADR-0041 §12). */}
      {stacked && <CitationsSection about={{ kind: 'element', id: element.id }} subject={`${element.name}\n${element.description ?? ''}`} readOnly={readOnly} />}
      <CommentThread about={{ kind: 'element', id: element.id }} />
      {!readOnly && <DeleteAction inspector={props} />}
    </Box>
  );
}

/**
 * The element's own fields: its sections, in the one order both layouts keep
 * (`ELEMENT_SECTIONS`). Beside the canvas the record is its summary line and
 * the rest are tabs; on the page every section but the appearance is laid out
 * under its heading. What each section holds is said once, below, so the two
 * layouts cannot drift apart — and, where the host's unit section does not
 * lead, that section goes under General in both.
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

  const body = (section: ElementSection): ReactNode => {
    switch (section) {
      case 'record':
        return stacked ? (
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
        ) : (
          <RecordSummaryLine
            element={element} model={inspector.model} parties={inspector.parties} answeredBy={inspector.answeredBy}
            move={inspector.unitSection?.leads === true || readOnly ? undefined : inspector.move}
          />
        );
      case 'general':
        return <><GeneralTab field={field} inspector={inspector} uses={uses} picker={picker} />{underGeneral}</>;
      case 'appearance':
        return <AppearanceTab field={field} onRequestLogoUpload={inspector.onRequestLogoUpload} />;
      case 'data':
        return <DataTab key={element.id} field={field} diagram={inspector.diagram} />;
    }
  };

  if (stacked) {
    return (
      <>
        {PAGE_SECTIONS.map((section) => (
          <Fragment key={section}>
            <SectionHeading sx={{ mt: 1.5 }}>{t(SECTION_TITLE[section])}</SectionHeading>
            {body(section)}
          </Fragment>
        ))}
      </>
    );
  }
  return (
    <>
      {body('record')}
      <InspectorTabs
        value={tab.value}
        onChange={tab.onChange}
        dataCount={element.kind === 'application' ? aspectCount(field, inspector.diagram) : undefined}
      />
      {body(TABBED_SECTIONS[tab.value] ?? 'general')}
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
