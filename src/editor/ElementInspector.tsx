// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The panel for one element: the one Panel, its identity fixed above and three
 * tabs under it. The rows are said once (`inspector/elementRows`), for this panel
 * and for the record page, which shows them all.
 *
 * **A unit comes first** (ADR-0036, as built 3.6.1). Where the host's unit section
 * leads (`UnitSlot.leads`: an actor with a type) it opens Properties, and the
 * element's own fields fold under *Element* below it. An actor without a type, and
 * every other kind, keeps the element's order with the section after it.
 */
import { useState } from 'react';
import { formatDay } from '../i18n/dates';
import { Button } from '../widgets/kit/Button';
import { containersWord } from './nodes/BoardTile';
import type { ReactNode } from 'react';
import { commentCount } from '../comments/thread';
import { useComments } from '../comments/ui/CommentsContext';
import { CommentThread } from '../comments/ui/threadPart';
import { useStrings } from '../i18n/LanguageContext';
import type { StringKey, Translate } from '../i18n/strings';
import { changeableKinds } from '../model/kindChange';
import { kindLabel } from '../model/kinds';
import { paletteLabel } from './canvas/paletteItems';
import { transitionsForElement } from '../model/transition';
import type { ElementId } from '../model/types';
import { MoreMenu } from '../widgets/kit/Menu';
import type { MenuEntry } from '../widgets/kit/Menu';
import { Panel, PanelLink } from '../widgets/kit/Panel';
import type { ElementInspectorProps } from './ElementInspectorProps';
import { InspectorSection } from './InspectorSection';
import { PanelAppearance, PanelProperties } from './inspector/elementRows';

export type { ElementInspectorProps };
export { shapeOptionsFor } from './elementInspectorFacts';

/** The one table lives in the model; re-exported so this file's callers keep one import. */
export { kindLabel } from '../model/kinds';

type Tab = 'properties' | 'appearance' | 'comments';

/** The tab, back to the first when the selection moves to another element. */
function useTabPer(elementId: ElementId): [Tab, (tab: Tab) => void] {
  const [tab, setTab] = useState<Tab>('properties');
  const [seen, setSeen] = useState(elementId);
  if (seen !== elementId) {
    setSeen(elementId);
    setTab('properties');
  }
  return [tab, setTab];
}

/** One line in words: what state it is in and what hangs on it. Only what is so. */
export function elementFacts(props: Pick<ElementInspectorProps, 'element' | 'model' | 'plans'>, t: Translate): string {
  const { element, model, plans } = props;
  const lines = model.relations.filter((row) => (row.type ?? 'flow') === 'flow' && (row.sourceId === element.id || row.targetId === element.id)).length;
  const planCount = plans ? transitionsForElement(plans.list, element.id).length : 0;
  return [
    t(`lifecycle.${element.lifecycle}` as StringKey),
    element.certainty ? t(`certainty.${element.certainty}` as StringKey) : undefined,
    lines > 0 ? t(lines === 1 ? 'inspector.linesOne' : 'inspector.linesOther', { count: lines }) : undefined,
    planCount > 0 ? t(planCount === 1 ? 'inspector.plansOne' : 'inspector.plansOther', { count: planCount }) : undefined,
  ].filter(Boolean).join(' · ');
}

/** ⋯: what is done to the whole record. It stands in one place, panel and page alike, and the delete comes last. */
export function elementMenu(props: ElementInspectorProps, t: Translate, opts: { drawing: boolean; kinds?: boolean } = { drawing: false }): MenuEntry[] {
  const { element, diagram, model, readOnly, actions, move, onCreateDrawing } = props;
  if (readOnly) return [];
  const kinds = opts.kinds === false || diagram.id === '' ? [] : changeableKinds(model, diagram, element.id);
  const isBoundary = diagram.kind === 'container' && diagram.applicationElementId === element.id;
  return [
    ...(move ? [{ label: move.label, detail: move.tip, onSelect: move.onMove }] : []),
    ...(kinds.length > 0 ? [{ label: t('menu.changeKind'), items: kinds.map((kind) => ({ label: paletteLabel(kind, t), onSelect: () => actions.changeElementKind(element.id, kind) })) }] : []),
    ...(opts.drawing && onCreateDrawing ? [{ label: t('menu.createDrawing'), onSelect: () => onCreateDrawing(element.id) }] : []),
    { label: isBoundary ? t('element.deleteApplication') : t('element.removeDelete'), final: true, onSelect: props.onRequestDelete },
  ];
}

export function ElementInspector(props: ElementInspectorProps) {
  const { element, readOnly, actions, owned, renameRequest } = props;
  const { t } = useStrings();
  const [tab, setTab] = useTabPer(element.id);
  const [help, setHelp] = useState<string>();
  const leads = props.unitSection?.leads === true;
  const nameOwned = owned?.fields.includes('name') === true;
  const access = useComments();
  const comments = commentCount(access?.comments ?? [], { kind: 'element', id: element.id });
  const rename = renameRequest?.id === element.id ? renameRequest.nonce : undefined;
  const menu = elementMenu(props, t, { drawing: leads });
  const open = props.onOpenDocumentation;
  const fold = leads
    ? (fields: ReactNode) => (
      <InspectorSection title={t('inspector.element')} note={t('inspector.elementHolds')} testId="element-fold">{fields}</InspectorSection>
    )
    : undefined;
  return (
    <Panel
      kind={kindLabel(element.kind, t)}
      name={element.name}
      {...(readOnly || nameOwned ? {} : {
        onRename: (name: string) => actions.updateElement(element.id, { name }),
        renameRequest: rename,
      })}
      facts={elementFacts(props, t)}
      status={<>{owned && <Elsewhere owned={owned} t={t} />}<OpenContainerDiagram {...props} /></>}
      actions={(
        <>
          {open && <PanelLink data-testid="open-details" onPress={() => open(element.id)}>{t('record.open')} ›</PanelLink>}
          {menu.length > 0 && <MoreMenu items={menu} label={t('inspector.more')} size="small" />}
        </>
      )}
      tabs={[
        { value: 'properties', label: t('inspector.properties') },
        { value: 'appearance', label: t('tab.appearance') },
        { value: 'comments', label: t('inspector.comments'), ...(comments > 0 ? { count: comments } : {}), hidden: access === undefined },
      ]}
      tab={tab}
      onTab={(next) => setTab(next as Tab)}
      help={help}
    >
      <div key={element.id}>
        {tab === 'properties' && (
          <PanelProperties
            props={leads ? { ...props, onCreateDrawing: undefined } : props}
            onHelp={setHelp} unit={props.unitSection?.section}
            {...(fold ? { fold } : {})}
          />
        )}
        {tab === 'appearance' && <PanelAppearance props={props} onHelp={setHelp} />}
        {tab === 'comments' && <CommentThread about={{ kind: 'element', id: element.id }} headed={false} />}
      </div>
    </Panel>
  );
}

/** Drawn here, defined there (ADR-0012 §3), said once, because every row that cannot be pressed cannot for this reason. */
function Elsewhere({ owned, t }: { owned: NonNullable<ElementInspectorProps['owned']>; t: Translate }) {
  return (
    <span data-testid="owned-elsewhere">
      {t('standIn.definedIn', { scope: owned.label })}
      {owned.onOpen && <> <PanelLink onPress={owned.onOpen}>{t('standIn.open', { scope: owned.label })}</PanelLink></>}
    </span>
  );
}


/** An application with a diagram says what is under it, and offers the way down first. */
function OpenContainerDiagram({ element, model, diagram, onOpenView, dayShown }: Pick<ElementInspectorProps, 'element' | 'model' | 'diagram' | 'onOpenView' | 'dayShown'>) {
  const { t, language } = useStrings();
  if (element.kind !== 'application' || !onOpenView) return null;
  const under = model.diagrams.find((one) => one.kind === 'container' && one.applicationElementId === element.id);
  if (!under || under.id === diagram?.id) return null;
  const count = model.elements.filter((one) => one.kind === 'component' && one.parentId === element.id).length;
  return (
    <div className="inspector-open-under">
      <Button variant="primary" size="small" data-testid="open-container" data-guide="inspector.openContainer" onClick={() => onOpenView(under.id)}>{t('menu.openContainer')}</Button>
      <span>
        {containersWord(count, t).replace(' ›', '')}
        {dayShown ? ` · ${t('inspector.opensOn', { day: formatDay(dayShown, language) })}` : ''}
      </span>
    </div>
  );
}
