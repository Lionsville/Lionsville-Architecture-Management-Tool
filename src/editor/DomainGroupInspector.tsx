// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The panel for a selected domain group, the same shell as an element's. Groups are
 * layout rects on a view rather than model rows, so there is little to say: its
 * name, what is inside, how it tidies, and that it can go without what it holds.
 */
import { useState } from 'react';
import type { TidyOptions } from '../layout/tidy';
import { placedNodes } from '../model/placement';
import type { DesignDiagram, DesignElement } from '../model/types';
import { useStrings } from '../i18n/LanguageContext';
import { Button } from '../widgets/kit/Button';
import { PropertyRow, PropertyRows } from '../widgets/kit/Field';
import { MoreMenu } from '../widgets/kit/Menu';
import { Panel } from '../widgets/kit/Panel';
import { zoneWords } from './inspector/elementRows';
import { TidySettingsPanel } from './TidySettingsPanel';
import type { EditorActions } from './useEditorState';
import './inspector/inspector.css';
import { PANEL_HELP } from '../platform/helpPlaces';

export interface DomainGroupInspectorProps {
  /** The selected group: what the placements' `group` says. It reads as its name, never as this. */
  name: string;
  diagram: DesignDiagram;
  /** To say what is inside by name. Absent, it says how many. */
  elements?: readonly Pick<DesignElement, 'id' | 'name'>[];
  readOnly: boolean;
  actions: EditorActions;
  /** Runs the per-group tidy; absent read-only or when the host supplies none. */
  onTidy?(name: string): void;
  /** The same state the right-click menu's popover edits, so the two can never disagree about how a group is tidied. */
  tidyOptions: TidyOptions;
  onTidyOptionsChange?(options: TidyOptions): void;
}

export function DomainGroupInspector(props: DomainGroupInspectorProps) {
  const { t } = useStrings();
  const { name, diagram, readOnly, actions, elements } = props;
  const [tab, setTab] = useState<'properties' | 'tidy'>('properties');
  const members = placedNodes(diagram).filter((p) => p.group === name);
  const count = members.length;
  const inside = elements
    ? members.map((member) => elements.find((one) => one.id === member.id)?.name ?? member.id).join(', ')
    : '';
  const canTidy = !readOnly && props.onTidy !== undefined;
  const remove = () => actions.removeDomainGroup(name);
  const zone = members[0]?.zone;
  const shownName = diagram.groups?.find((group) => group.id === name)?.name ?? name;
  return (
    <Panel helpAt={PANEL_HELP.group}
      kind={t('section.domainGroup')}
      name={shownName}
      {...(readOnly ? {} : { onRename: (next: string) => actions.renameDomainGroup(name, next) })}
      facts={count === 1 ? t('group.membersOne', { count }) : t('group.membersOther', { count })}
      actions={!readOnly && <MoreMenu label={t('inspector.more')} size="small" items={[{ label: t('group.remove'), final: true, onSelect: remove }]} />}
      {...(canTidy ? {
        tabs: [{ value: 'properties', label: t('inspector.properties') }, { value: 'tidy', label: t('section.tidyGroup') }],
        tab,
        onTab: (next: string) => setTab(next as 'properties' | 'tidy'),
      } : {})}
    >
      {tab === 'tidy' && canTidy
        ? (
          // The same controls the right-click menu opens, on the same state. "Pin group placements"
          // stays out: a per-group tidy already leaves the box where it is.
          <TidySettingsPanel
            width="100%"
            options={props.tidyOptions}
            onChange={(next) => props.onTidyOptionsChange?.(next)}
            applyLabel={t('group.tidyApply', { name: shownName })}
            onApply={() => props.onTidy?.(name)}
          />
        )
        : (
          <>
            <PropertyRows readOnly>
              {zone && <PropertyRow label={t('inspector.zone')} data-testid="group-zone" value={zoneWords(zone, t)} />}
              {inside && <PropertyRow label={t('inspector.inside')} data-testid="group-inside" value={inside} />}
            </PropertyRows>
            {!readOnly && (
              <div className="inspector-actions">
                <Button size="small" variant="danger" onClick={remove}>{t('group.remove')}</Button>
                <p className="inspector-note">{t('group.removeNote')}</p>
              </div>
            )}
          </>
        )}
    </Panel>
  );
}
