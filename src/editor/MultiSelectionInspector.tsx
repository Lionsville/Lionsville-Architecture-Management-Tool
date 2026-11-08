// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Several things selected: the one Panel, naming what is selected and saying what
 * each field holds across it, *Live, all 3* or *Mixed*. A wrong bulk change on a
 * board of two hundred is costly even with undo, so it shows what it is about to
 * change before it changes it.
 *
 * **Which fields.** Lifecycle, colour, icon and domain group for elements; protocol,
 * technology, window, direction, colour and style for lines. Where "make these
 * twelve the same" is what is meant. Name, description, category and label are one
 * record's facts, and a control that wrote one across a selection would be a mistake
 * generator, so they stay in the single panel. A mixed selection says which rows
 * change what, under a heading each.
 *
 * Each change is one `updateElements` or `updateConnections`, one undo step over the
 * whole selection.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Language } from '../i18n/languages';
import { useStrings } from '../i18n/LanguageContext';
import type { StringKey, Translate } from '../i18n/strings';
import { placedNodes } from '../model/placement';
import type { DesignConnection, DesignDiagram, DesignElement, DesignModel, EdgeLineStyle, Lifecycle } from '../model/types';
import { Button, IconButton } from '../widgets/kit/Button';
import { PropertyRow, PropertyRows } from '../widgets/kit/Field';
import { MenuButton, MoreMenu } from '../widgets/kit/Menu';
import type { MenuEntry } from '../widgets/kit/Menu';
import { Panel, PanelSection } from '../widgets/kit/Panel';
import { CloseIcon } from '../widgets/icons';
import { ColorField } from './ColorField';
import { LINE_STYLE_OPTIONS, ValidEditor, validWords } from './ConnectionInspector';
import { kindLabel } from '../model/kinds';
import { LogoGrid } from './nodes/LogoGrid';
import { pickEdit } from './inspector/rowTools';
import { useArrangeSeat } from './inspector/arrangeSeat';
import type { EditorActions, Selection } from './useEditorState';
import './inspector/inspector.css';
import { PANEL_HELP } from '../platform/helpPlaces';

const LIFECYCLES: Lifecycle[] = ['planned', 'live', 'retiring', 'retired'];

/** What a field holds across a selection: the one value, or how many there are. */
export function acrossSelection<T>(items: readonly T[], read: (item: T) => string): { value: string; mixed?: number } {
  const values = new Set(items.map(read));
  if (values.size <= 1) return { value: [...values][0] ?? '' };
  return { value: '', mixed: values.size };
}

/** *Live, all 3*, *HTTPS, both*: a value everything shares, said so. Nothing where nothing is set. */
function allWords(value: string, count: number, t: Translate): string {
  if (value === '') return '';
  return count === 2 ? t('inspector.allBoth', { value }) : t('inspector.allOf', { value, count });
}

/** The kind line: *3 applications*, *1 element, 1 connection*. */
export function selectionWords(count: number, selected: readonly DesignElement[], lines: number, groups: number, t: Translate): string {
  const elementWord = () => {
    if (count > 1 && selected.length === count && new Set(selected.map((one) => one.kind)).size === 1) return `${count} × ${kindLabel(selected[0].kind, t)}`;
    return count === 1 ? t('inspector.elementsOne', { count }) : t('inspector.elementsOther', { count });
  };
  const parts: string[] = [];
  if (count > 0) parts.push(elementWord());
  if (lines > 0) parts.push(lines === 1 ? t('inspector.connectionsOne', { count: lines }) : t('inspector.connectionsOther', { count: lines }));
  if (groups > 0) parts.push(groups === 1 ? t('inspector.groupsOne', { count: groups }) : t('inspector.groupsOther', { count: groups }));
  return parts.join(', ');
}

const isOnlyElements = (selection: Selection) => selection.elementIds.length > 0 && selection.connectionIds.length === 0 && selection.domainGroups.length === 0;

/** What is selected, each by name, and the selection without it. */
function selectionItems(selection: Selection, model: DesignModel | undefined, diagram: DesignDiagram | undefined, lines: readonly DesignConnection[]) {
  const { elementIds } = selection;
  const nameOf = (id: string) => model?.elements.find((one) => one.id === id)?.name ?? id;
  return [
    ...elementIds.map((id) => ({ id, label: nameOf(id), without: { ...selection, elementIds: elementIds.filter((one) => one !== id) } })),
    ...selection.connectionIds.map((id) => {
      const line = lines.find((one) => one.id === id);
      return {
        id, label: line ? `${nameOf(line.sourceId)} ${line.isBidirectional ? '↔' : '→'} ${nameOf(line.targetId)}` : id,
        without: { ...selection, connectionIds: selection.connectionIds.filter((one) => one !== id) },
      };
    }),
    ...selection.domainGroups.map((id) => ({
      id, label: diagram?.groups?.find((one) => one.id === id)?.name ?? id,
      without: { ...selection, domainGroups: selection.domainGroups.filter((one) => one !== id) },
    })),
  ];

}

export function MultiSelectionInspector({
  selection,
  model,
  diagram,
  readOnly,
  actions,
  onRequestLogoUpload,
  onSelectionChange,
  onRequestDelete,
}: {
  selection: Selection;
  model?: DesignModel;
  /** Absent = the summary only. */
  diagram?: DesignDiagram;
  readOnly?: boolean;
  actions?: EditorActions;
  onRequestLogoUpload?(): void;
  /** Takes one out of the selection, from its ×. Absent = no ×. */
  onSelectionChange?(selection: Selection): void;
  /** The confirmation a delete of the whole selection asks. Absent = no Delete here. */
  onRequestDelete?(selection: Selection): void;
}) {
  const { t, language } = useStrings();
  const [help, setHelp] = useState<string>();
  const elementIds = selection.elementIds;
  const elements = (model?.elements ?? []).filter((one) => elementIds.includes(one.id));
  const lines = (model?.relations ?? []).filter((one) => selection.connectionIds.includes(one.id)) as DesignConnection[];
  const total = elementIds.length + selection.connectionIds.length + selection.domainGroups.length;
  const canEdit = Boolean(actions) && !readOnly;

  const items = selectionItems(selection, model, diagram, lines);

  const deleteAll = onRequestDelete && canEdit ? () => onRequestDelete(selection) : undefined;
  const removeFromView = canEdit && actions && diagram && isOnlyElements(selection)
    ? () => { for (const id of elementIds) actions.removeFromDiagram(id); }
    : undefined;

  return (
    <Panel helpAt={PANEL_HELP.several}
      kind={selectionWords(elementIds.length, elements, selection.connectionIds.length, selection.domainGroups.length, t)}
      name={t('inspector.selected', { count: total })}
      facts={canEdit ? t('inspector.bulkNote') : undefined}
      actions={deleteAll && <MoreMenu label={t('inspector.more')} size="small" items={[{ label: t('inspector.deleteCount', { count: total }), final: true, onSelect: deleteAll }]} />}
      // Only lines cannot be dragged together, so the hint says only what they can do.
      help={help ?? t(elementIds.length > 0 || selection.domainGroups.length > 0 ? 'inspector.multiHint' : 'inspector.multiHintLines')}
    >
      <ul className="inspector-list" data-testid="selection-list">
        {items.map((item) => (
          <li key={item.id}>
            <span>{item.label}</span>
            {onSelectionChange && (
              <IconButton size="small" label={t('inspector.takeOut', { name: item.label })} onClick={() => onSelectionChange(item.without)}><CloseIcon size={12} /></IconButton>
            )}
          </li>
        ))}
      </ul>
      {canEdit && actions && (
        <>
          {elementIds.length > 0 && <ElementRows elementIds={elementIds} elements={elements} diagram={diagram} actions={actions} onRequestLogoUpload={onRequestLogoUpload} onHelp={setHelp} mixedKinds={selection.connectionIds.length > 0} t={t} />}
          {lines.length > 0 && <LineRows lines={lines} actions={actions} onHelp={setHelp} mixedKinds={elementIds.length > 0} language={language} t={t} />}
        </>
      )}
      {canEdit && elementIds.length > 1 && <Arrange count={elementIds.length} landscape={diagram?.kind === 'layer7'} t={t} />}
      <RemoveActs removeFromView={removeFromView} deleteAll={deleteAll} count={total} t={t} />
    </Panel>
  );
}

function RemoveActs({ removeFromView, deleteAll, count, t }: { removeFromView: (() => void) | undefined; deleteAll: (() => void) | undefined; count: number; t: Translate }) {
  if (!removeFromView && !deleteAll) return null;
  return (
    <PanelSection title={t('inspector.remove')}>
      <div className="inspector-actions">
        {removeFromView && <Button size="small" onClick={removeFromView}>{t('inspector.fromThisView')}</Button>}
        {deleteAll && <Button size="small" variant="danger" onClick={deleteAll}>{t('inspector.deleteCount', { count })}</Button>}
      </div>
    </PanelSection>
  );
}

function changeHeading(count: number, kindSingular: string | undefined, t: Translate): string {
  if (kindSingular) return t(count === 1 ? 'inspector.changeThe' : 'inspector.changeThese', { what: kindSingular, count });
  return count === 2 ? t('inspector.changeBoth') : t('inspector.changeAll', { count });
}

function ElementRows({ elementIds, elements, diagram, actions, onRequestLogoUpload, onHelp, mixedKinds, t }: {
  elementIds: readonly string[];
  elements: readonly DesignElement[];
  diagram: DesignDiagram | undefined;
  actions: EditorActions;
  onRequestLogoUpload: (() => void) | undefined;
  onHelp(help: string | undefined): void;
  mixedKinds: boolean;
  t: Translate;
}) {
  const count = elementIds.length;
  const update = (patch: Partial<DesignElement>) => actions.updateElements(elementIds, patch);
  // Domain groups exist only on a Layer 7 board, and only for placements on the landscape: the element menu's rule.
  const placements = diagram?.kind === 'layer7' ? placedNodes(diagram) : [];
  const landscapeIds = elementIds.filter((id) => {
    const placement = placements.find((one) => one.id === id);
    return placement !== undefined && (placement.zone ?? 'landscape') === 'landscape';
  });
  const groups = diagram?.groups ?? [];
  const groupName = (id: string) => groups.find((one) => one.id === placements.find((placed) => placed.id === id)?.group)?.name ?? '';
  const known = elements.length > 0;
  const lifecycle = known ? acrossSelection(elements, (one) => t(`lifecycle.${one.lifecycle}` as StringKey)) : { value: '' };
  const colour = known ? acrossSelection(elements, (one) => one.accentColor ?? '') : { value: '' };
  const icon = known ? acrossSelection(elements, (one) => one.iconKey ?? '') : { value: '' };
  const group = acrossSelection(landscapeIds, groupName);
  const row = (held: { value: string; mixed?: number }) => (held.mixed !== undefined ? { mixed: held.mixed } : { value: allWords(held.value, count, t) });
  return (
    <PanelSection title={changeHeading(count, mixedKinds ? t(count === 1 ? 'inspector.theElement' : 'inspector.theElements') : undefined, t)}>
      <PropertyRows onHelp={onHelp}>
        <PropertyRow
          label={t('inspector.bulkLifecycle')} data-testid="bulk-lifecycle" empty={t('inspector.bulkNoChange')} {...row(lifecycle)}
          edit={{ options: LIFECYCLES.map((one) => ({ value: one, label: t(`lifecycle.${one}` as StringKey) })) }}
          onCommit={(value) => { if (value) update({ lifecycle: value as Lifecycle }); }}
        />
        {landscapeIds.length > 0 && (
          <PropertyRow
            label={t('inspector.bulkDomainGroup')} data-testid="bulk-group" empty={t('inspector.none')} {...row(group)}
            edit={pickEdit({
              label: t('inspector.bulkDomainGroup'),
              options: [{ id: '', label: t('field.notSet') }, ...groups.map((one) => ({ id: one.name, label: one.name }))],
              onCreate: (name) => actions.fileUnderGroupNamed(landscapeIds, name),
            })}
            onCommit={(name) => actions.fileUnderGroupNamed(landscapeIds, name || undefined)}
          />
        )}
        <PropertyRow
          label={t('inspector.bulkColour')} data-testid="bulk-colour" empty={t('inspector.fromKind')} {...row(colour)}
          // Clearing writes `undefined`: back to the kind's own colour, the same reset the single control offers.
          edit={() => <ColorField label={t('inspector.bulkColour')} ariaLabel={t('inspector.bulkColourAria')} value={undefined} readOnly={false} onChange={(value) => update({ accentColor: value })} />}
        />
        <PropertyRow
          label={t('inspector.bulkIcon')} data-testid="bulk-icon" empty={t('common.none')} {...row(icon)}
          edit={(editor) => (
            <div className="inspector-icons">
              <LogoGrid label={t('inspector.bulkIcon')} value={undefined} onChange={(iconKey) => update({ iconKey })} onRequestUpload={onRequestLogoUpload} maxHeight={180} />
              <Button size="small" variant="quiet" onClick={editor.cancel}>{t('inspector.done')}</Button>
            </div>
          )}
        />
      </PropertyRows>
    </PanelSection>
  );
}

function LineRows({ lines, actions, onHelp, mixedKinds, language, t }: {
  lines: readonly DesignConnection[];
  actions: EditorActions;
  onHelp(help: string | undefined): void;
  mixedKinds: boolean;
  language: Language;
  t: Translate;
}) {
  const count = lines.length;
  const ids = lines.map((one) => one.id);
  const update = (patch: Partial<DesignConnection>) => actions.updateConnections(ids, patch);
  const shown = (held: { value: string; mixed?: number }) => (held.mixed !== undefined ? { mixed: held.mixed } : { value: allWords(held.value, count, t) });
  const textRow = (key: 'protocol' | 'technology', label: string): ReactNode => (
    <PropertyRow
      label={label} data-testid={`bulk-${key}`} empty={t('inspector.none')} {...shown(acrossSelection(lines, (one) => one[key] ?? ''))}
      edit="text" onCommit={(value) => update({ [key]: value || undefined })}
    />
  );
  const valid = acrossSelection(lines, (one) => validWords(one, language, t));
  const direction = acrossSelection(lines, (one) => (one.isBidirectional ? t('field.bidirectional') : t('field.oneWay')));
  const colour = acrossSelection(lines, (one) => one.color ?? '');
  const style = acrossSelection(lines, (one) => t(LINE_STYLE_OPTIONS.find((option) => option.value === (one.lineStyle ?? ''))?.labelKey ?? 'option.solidDefault'));
  return (
    <PanelSection title={changeHeading(count, mixedKinds ? t(count === 1 ? 'inspector.theLine' : 'inspector.theLines') : undefined, t)}>
      <PropertyRows onHelp={onHelp}>
        {textRow('protocol', t('field.protocol'))}
        {textRow('technology', t('field.technology'))}
        <PropertyRow
          label={t('inspector.valid')} data-testid="bulk-valid" {...shown(valid)}
          edit={(editor) => <ValidEditor editor={editor} connection={lines[0]} onWrite={update} t={t} />}
        />
        <PropertyRow
          label={t('field.direction')} data-testid="bulk-direction" {...shown(direction)}
          edit={{ options: [{ value: '', label: t('inspector.bulkNoChange') }, { value: 'oneway', label: t('field.oneWay') }, { value: 'bidirectional', label: t('field.bidirectional') }] }}
          onCommit={(value) => { if (value) update({ isBidirectional: value === 'bidirectional' }); }}
        />
        <PropertyRow
          label={t('field.colour')} data-testid="bulk-line-colour" empty={t('option.default')} {...shown(colour)}
          edit={() => <ColorField label={t('field.colour')} ariaLabel={t('field.edgeColour')} value={undefined} readOnly={false} onChange={(value) => update({ color: value })} />}
        />
        <PropertyRow
          label={t('field.lineStyle')} data-testid="bulk-line-style" {...shown(style)}
          edit={{ options: LINE_STYLE_OPTIONS.map((one) => ({ value: one.value, label: t(one.labelKey) })) }}
          onCommit={(value) => update({ lineStyle: value === '' ? undefined : value as EdgeLineStyle })}
        />
      </PropertyRows>
    </PanelSection>
  );
}

/** The canvas bar's acts, in words, where people look: the sums are the canvas's (`arrangeSeat`). */
function Arrange({ count, landscape, t }: { count: number; landscape: boolean; t: Translate }) {
  const seat = useArrangeSeat();
  if (!seat?.current) return null;
  const acts = seat.current;
  const align: MenuEntry[] = ([
    ['left', 'canvas.alignLeft'], ['centerX', 'canvas.alignCenterX'], ['right', 'canvas.alignRight'],
    ['top', 'canvas.alignTop'], ['centerY', 'canvas.alignCenterY'], ['bottom', 'canvas.alignBottom'],
  ] as const).map(([axis, key]) => ({ label: t(key), onSelect: () => acts.align(axis) }));
  const distribute: MenuEntry[] = [
    { label: t('canvas.distributeHorizontally'), onSelect: () => acts.distribute('horizontal') },
    { label: t('canvas.distributeVertically'), onSelect: () => acts.distribute('vertical') },
  ];
  return (
    <PanelSection title={t('inspector.arrange')}>
      <div className="inspector-actions">
        <MenuButton label={t('inspector.align')} menuLabel={t('inspector.align')} items={align} size="small" />
        {count > 2 && <MenuButton label={t('inspector.distribute')} menuLabel={t('inspector.distribute')} items={distribute} size="small" />}
        {landscape && <Button size="small" onClick={acts.group}>{t('inspector.group')}</Button>}
      </div>
    </PanelSection>
  );
}
