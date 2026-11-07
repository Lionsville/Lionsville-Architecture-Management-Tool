// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The view itself, in the same shell: its name pressed from the bar opens it, since
 * with nothing selected there is no panel and the board has the width. Settings
 * stay in the tab's menu too; this is where they can be read.
 */
import { formatDay } from '../../i18n/dates';
import { useStrings } from '../../i18n/LanguageContext';
import { aspectConfigFor } from '../../model/aspects';
import { placedNodes } from '../../model/placement';
import { routeFor, routeSource } from '../../model/routes';
import type { Translate } from '../../i18n';
import type { DesignDiagram } from '../../model/types';
import { Button } from '../../widgets/kit/Button';
import { PropertyRow, PropertyRows } from '../../widgets/kit/Field';
import { Panel, PanelSection } from '../../widgets/kit/Panel';
import { containerFacts } from '../containerLines';
import type { ThisViewTab } from '../EditorDialogs';
import type { EditorParts } from '../editorParts';
import { LinesTab, UnlandedLines } from './LinesTab';
import { TidySettingsPanel } from '../TidySettingsPanel';

export function ThisViewPanel({ parts, diagram, onClose }: { parts: EditorParts; diagram: DesignDiagram; onClose(): void }) {
  const { t, language } = useStrings();
  const { state, view, layout, board, readOnly, dialogs, props } = parts;
  const { thisViewTab, setThisViewTab: setTab } = dialogs;
  const container = diagram.kind === 'container';
  const tab = thisViewTab === 'lines' && !container ? 'properties' : thisViewTab;
  const placed = placedNodes(diagram);
  const drawn = new Set(placed.map((one) => one.id));
  const lines = state.model.relations.filter((row) => (row.type ?? 'flow') === 'flow' && drawn.has(row.sourceId) && drawn.has(row.targetId));
  const handRouted = lines.filter((line) => { const route = routeFor(diagram, line.id); return route !== undefined && routeSource(route) === 'manual'; }).length;
  const groups = diagram.groups?.length ?? 0;
  const day = board.lookingAt ? formatDay(board.lookingAt, language) : t('inspector.today');
  const columns = aspectConfigFor(diagram).map((entry) => entry.label).join(', ');
  const canTidy = !readOnly && (diagram.kind === 'layer7' || diagram.kind === 'container');
  return (
    <Panel
      {...(container
        ? containerHead(parts, diagram, day, t)
        : { kind: t('inspector.thisView'), name: diagram.name, facts: t('inspector.viewFacts', { elements: drawn.size, lines: lines.length, day }) })}
      dataGuide="board.inspector"
      onClose={onClose}
      {...(canTidy || container ? {
        tabs: viewTabs(parts, diagram, canTidy, t),
        tab,
        onTab: (next: string) => setTab(next as ThisViewTab),
      } : {})}
      help={t('inspector.empty')}
    >
      {tab === 'lines' && container ? <LinesTab parts={parts} diagram={diagram} /> : tab === 'tidy' && canTidy
        ? (
          <TidySettingsPanel
            width="100%" options={view.tidyOptions} onChange={view.setTidyOptions} applyLabel={t('inspector.tidy')}
            // Caught: `handleTidy` rethrows for the unattended caller, and a person has been told already.
            onApply={() => void layout.handleTidy().catch(() => {})}
          />
        )
        : (
          <>
            {container && <ContainerHead parts={parts} diagram={diagram} />}
            <PropertyRows readOnly>
              <PropertyRow label={t('inspector.shownDay')} data-testid="view-day" value={day} />
              {columns && <PropertyRow label={t('inspector.columns')} data-testid="view-columns" value={columns} />}
            </PropertyRows>
            <PanelSection title={t('inspector.onThisBoard')}>
              <PropertyRows readOnly>
                <PropertyRow label={t('inspector.elements')} data-testid="view-elements" value={String(drawn.size)} />
                <PropertyRow label={t('inspector.lines')} data-testid="view-lines" value={handRouted > 0 ? t('inspector.linesHand', { count: lines.length, hand: handRouted }) : String(lines.length)} />
                {groups > 0 && <PropertyRow label={t('inspector.groups')} data-testid="view-groups" value={String(groups)} />}
              </PropertyRows>
            </PanelSection>
            {props.diagrams.onSettingsChange && !readOnly && (
              <div className="inspector-actions">
                <Button size="small" onClick={() => dialogs.setSettingsDiagramId(diagram.id)}>{t('inspector.viewSettings')}</Button>
              </div>
            )}
          </>
        )}
    </Panel>
  );
}

/** A container diagram goes by its application, and counts what a reader wants counted. */
function containerHead(parts: EditorParts, diagram: DesignDiagram, day: string, t: Translate) {
  const { state, board } = parts;
  const facts = containerFacts(state.model, board.shownDiagram ?? diagram, board.lookingAt);
  return {
    kind: t('c4.aboutDiagram'),
    name: state.model.elements.find((one) => one.id === diagram.applicationElementId)?.name ?? diagram.name,
    facts: t('c4.facts', { containers: facts.containers, around: facts.around, lines: facts.lines, day }),
  };
}

function viewTabs(parts: EditorParts, diagram: DesignDiagram, canTidy: boolean, t: Translate) {
  const container = diagram.kind === 'container';
  const count = container ? containerFacts(parts.state.model, parts.board.shownDiagram ?? diagram, parts.board.lookingAt).lines : 0;
  return [
    { value: 'properties', label: t('inspector.properties') },
    ...(container ? [{ value: 'lines', label: t('c4.lines'), count }] : []),
    ...(canTidy ? [{ value: 'tidy', label: t('inspector.tidy') }] : []),
  ];
}

/** What it says about itself, and the lines that wait for a container. */
function ContainerHead({ parts, diagram }: { parts: EditorParts; diagram: DesignDiagram }) {
  const { description } = containerFacts(parts.state.model, parts.board.shownDiagram ?? diagram, parts.board.lookingAt);
  return (
    <>
      {description && <p className="lv-lines__said">{description}</p>}
      <UnlandedLines parts={parts} diagram={diagram} />
    </>
  );
}
