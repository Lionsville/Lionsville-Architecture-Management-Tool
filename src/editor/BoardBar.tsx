// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The View bar over a board: Add, Arrange, Show, Colour, Day, then Find and Export, in
 * the kit's order and in words, each holding its place and saying its state. What a
 * canvas does for itself is in its dock; undo and the keyboard's sheet are the frame's.
 */
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useStrings } from '../i18n/LanguageContext';
import { LANGUAGES, LANGUAGE_NAME, type Language, type Translate } from '../i18n/strings';
import { viewActions } from './viewActions';
import { aspectConfigFor } from '../model/aspects';
import { colourByAspect, colourByOne, VALUE_COLOUR_BY, type ColourBy } from '../model/overlay';
import { ColourMenu, type ColourQuestion } from '../widgets/kit/ColourMenu';
import { IconButton } from '../widgets/kit/Button';
import type { MenuEntry } from '../widgets/kit/Menu';
import { MoreMenu } from '../widgets/kit/Menu';
import { Segmented } from '../widgets/kit/Segmented';
import { ViewBar, ViewBarAct, ViewBarButton, ViewBarCheck, ViewBarHeading, ViewBarMenu, ViewBarPanel } from '../widgets/kit/ViewBar';
import { RedoIcon, UndoIcon } from '../widgets/icons';
import type { TidyOptions } from '../layout/tidy';
import type { EditorToolbarProps } from './EditorToolbar';
import { COLOUR_BY_LABEL, overlayTitle } from './overlayWords';

export type BoardBarAdd = {
  kinds: readonly { label: string; onPress: () => void }[];
  onExisting?: () => void;
  keepOpen: boolean;
  onKeepOpen: (open: boolean) => void;
};

export type BoardBarShow = {
  status: boolean;
  onStatus: (on: boolean) => void;
  descriptions: boolean;
  onDescriptions: (on: boolean) => void;
  showKey: boolean;
  onKey: (on: boolean) => void;
};

function ArrangeBar({ props }: { props: EditorToolbarProps }) {
  const { t } = useStrings();
  const options = props.tidyOptions;
  const set = (patch: Partial<TidyOptions>) => props.onTidyOptionsChange({ ...options, ...patch });
  const tidying = props.busy === 'tidy';
  const container = props.activeDiagram.kind === 'container';
  return (
    <ViewBarPanel
      label={t('bar.arrange')}
      data-guide="board.arrange"
      {...(props.busy ? {
        busy: tidying && props.onCancelTidy
          ? { label: t('toolbar.cancelTidy'), onPress: props.onCancelTidy }
          : { label: t('bar.arranging') },
      } : {})}
    >
      {(close) => (
        <>
          <ViewBarAct data-testid="arrange-tidy" label={t('bar.tidy')} says={t('bar.tidySays')} onClick={() => { close(); props.onTidy(); }} />
          {props.onLayersByCategory && (
            <ViewBarAct data-testid="arrange-layers" label={t('bar.layers')} says={t('bar.layersSays')} onClick={() => { close(); props.onLayersByCategory?.(); }} />
          )}
          <ViewBarAct data-testid="arrange-route" label={t('bar.route')} says={t('bar.routeSays')} onClick={() => { close(); props.onRouteEdges(); }} />
          {props.onRouteEdgesAll && (
            <ViewBarAct label={t('bar.routeAll')} says={t('bar.routeAllSays')} onClick={() => { close(); props.onRouteEdgesAll?.(); }} />
          )}
          <ViewBarAct
            data-testid="arrange-auto"
            aria-pressed={props.autoRoute}
            label={t('bar.autoRoute')}
            says={props.autoRoute ? t('bar.on') : t('bar.off')}
            title={props.autoRouteNote}
            onClick={props.onToggleAutoRoute}
          />
          <ViewBarHeading>{t('bar.direction')}</ViewBarHeading>
          <Segmented
            label={t('bar.direction')}
            value={options.direction}
            onChange={(direction) => set({ direction })}
            options={[
              { value: 'auto', label: t('tidy.auto') },
              { value: 'horizontal', label: t('tidy.across') },
              { value: 'vertical', label: t('tidy.down') },
              { value: 'hybrid', label: t('tidy.hybrid') },
            ]}
          />
          <ViewBarHeading>{t('tidy.density')}</ViewBarHeading>
          <Segmented
            label={t('tidy.density')}
            value={options.density}
            onChange={(density) => set({ density })}
            options={[
              { value: 'compact', label: t('tidy.compact') },
              { value: 'normal', label: t('tidy.normal') },
              { value: 'spacious', label: t('tidy.spacious') },
            ]}
          />
          <ViewBarHeading>{t('bar.leaveAlone')}</ViewBarHeading>
          <ViewBarCheck label={t('tidy.pinAnchors')} checked={options.pinAnchorPoints} onChange={(pinAnchorPoints) => set({ pinAnchorPoints })} />
          <ViewBarCheck label={t(container ? 'tidy.pinBoundary' : 'tidy.pinGroups')} checked={options.pinGroups} onChange={(pinGroups) => set({ pinGroups })} />
          <ViewBarCheck label={t(container ? 'tidy.pinBoundaryContents' : 'tidy.pinGroupContents')} checked={options.pinGroupContents} onChange={(pinGroupContents) => set({ pinGroupContents })} />
        </>
      )}
    </ViewBarPanel>
  );
}

/** What on a container diagram changes what a reader believes, in words on the bar and each saying its state. */
function ContainerWords({ props }: { props: EditorToolbarProps }) {
  const { t } = useStrings();
  return (
    <>
      <ViewBarButton on={props.showEdgeLabels} aria-pressed={props.showEdgeLabels} onClick={props.onToggleEdgeLabels} data-guide="board.labels" data-testid="container-labels">
        {t(props.showEdgeLabels ? 'bar.labelsOn' : 'bar.labelsOff')}
      </ViewBarButton>
      {props.onToggleDeployment && (
        <ViewBarButton on={props.showDeployment === true} aria-pressed={props.showDeployment === true} onClick={props.onToggleDeployment} data-guide="board.deployment" data-testid="container-deployment">
          {t('toolbar.deployment')}
        </ViewBarButton>
      )}
    </>
  );
}

function ShowBar({ props, show }: { props: EditorToolbarProps; show: BoardBarShow | undefined }) {
  const { t } = useStrings();
  const container = props.activeDiagram.kind === 'container';
  return (
    <ViewBarPanel label={t('bar.show')} data-guide="board.show">
      {() => (
        <>
          <ViewBarHeading>{t('bar.onCards')}</ViewBarHeading>
          {show && <ViewBarCheck label={t('bar.statusDots')} checked={show.status} onChange={show.onStatus} />}
          <ViewBarCheck label={t('bar.lifecycleWord')} checked={props.showLifecycle} onChange={props.onToggleLifecycle} />
          {show && <ViewBarCheck label={t('bar.descriptions')} checked={show.descriptions} onChange={show.onDescriptions} />}
          {!container && (
            <>
              <ViewBarHeading>{t('bar.lineLabels')}</ViewBarHeading>
              <Segmented
                label={t('bar.lineLabels')}
                value={props.showEdgeLabels ? 'always' : 'hover'}
                onChange={(value) => { if ((value === 'always') !== props.showEdgeLabels) props.onToggleEdgeLabels(); }}
                options={[{ value: 'hover', label: t('bar.onHover') }, { value: 'always', label: t('bar.always') }]}
              />
            </>
          )}
          <ViewBarHeading>{t('bar.onCanvas')}</ViewBarHeading>
          {show && <ViewBarCheck label={t('bar.key')} checked={show.showKey} onChange={show.onKey} />}
          <ViewBarCheck label={t('bar.map')} checked={props.showMinimap} onChange={props.onToggleMinimap} />
        </>
      )}
    </ViewBarPanel>
  );
}

/** The questions a landscape can be asked in colour, by what they read; the one-thing ones one level down. */
function ColourBar({ props }: { props: EditorToolbarProps }) {
  const { t } = useStrings();
  const columns = aspectConfigFor(props.activeDiagram);
  const questions = useMemo<ColourQuestion[]>(() => [
    ...(['platform', 'technologyLifecycle'] as const).map((by) => ({ id: by, label: t(COLOUR_BY_LABEL[by]), group: t('overlay.groupRows') })),
    ...VALUE_COLOUR_BY.map((by) => ({ id: by, label: t(COLOUR_BY_LABEL[by as keyof typeof COLOUR_BY_LABEL]), group: t('overlay.groupRecord') })),
    ...columns.map((column) => ({ id: colourByAspect(column.key), label: column.label, group: t('overlay.groupAspects') })),
  ], [columns, t]);
  const candidates = props.overlayCandidates ?? [];
  return (
    <ColourMenu
      data-guide="board.colour"
      questions={questions}
      more={{ label: t('overlay.one'), questions: candidates.map((one) => ({ id: colourByOne(one.id), label: one.name })) }}
      value={props.colourBy}
      {...(props.colourBy !== undefined ? { upLabel: overlayTitle(props.colourBy, columns, t, props.overlayBands ?? []) } : {})}
      onChange={(id) => props.onColourByChange?.(id as ColourBy | undefined)}
    />
  );
}

/**
 * The view's own acts at the head of its ⋯, the list its tab's ⌄ and its row on
 * the home draw too (`viewActions`); delete is the last thing in the menu.
 */
function viewEntries(props: EditorToolbarProps, t: Translate): MenuEntry[] {
  if (props.readOnly) return [];
  const view = props.activeDiagram;
  const run = {
    rename: () => props.onRenameDiagram?.(view.id, view.name),
    duplicate: () => props.onDuplicateDiagram?.(view.id),
    delete: () => props.onDeleteDiagram?.(view.id),
  } as const;
  const acts = viewActions({
    canRename: Boolean(props.onRenameDiagram),
    // A second container view about one application would be two answers to what is inside it.
    canDuplicate: Boolean(props.onDuplicateDiagram) && view.kind !== 'container',
    canDelete: Boolean(props.onDeleteDiagram),
  }, t).flatMap((act) => (act.id === 'rename' || act.id === 'duplicate' || act.id === 'delete'
    ? [{ label: act.label, onSelect: run[act.id], ...(act.danger ? { final: true } : {}) }]
    : []));
  return acts.length > 0 ? [...acts, { line: true }] : [];
}

export function BoardBar({ props, framed, pageBar, day, add, show }: {
  props: EditorToolbarProps;
  /** The frame's row one has undo. */
  framed: boolean;
  /** Where a laid-out page draws its own words, at the head of the bar. */
  pageBar: ReactNode;
  day: ReactNode;
  add: BoardBarAdd | undefined;
  show: BoardBarShow | undefined;
}) {
  const { t, language } = useStrings();
  const editing = !props.readOnly && !props.looking && !props.laidOut;
  const onCanvas = !props.laidOut;
  const more: MenuEntry[] = [
    ...viewEntries(props, t),
    { label: t('toolbar.shortcuts'), onSelect: props.onOpenHelp, shortcut: '?' },
    ...(props.onLanguageChange ? [{
      label: t('common.language'),
      items: LANGUAGES.map((candidate: Language) => ({
        label: t(LANGUAGE_NAME[candidate]),
        checked: candidate === language,
        // The menu names the one that is on; choosing it again asks nothing of the host.
        onSelect: () => { if (candidate !== language) props.onLanguageChange?.(candidate); },
      })),
    }] : []),
  ];
  return (
    <ViewBar
      reading={(
        <>
          {!framed && !props.readOnly && (
            <>
              <IconButton label={t('toolbar.undo')} disabled={!props.canUndo} onClick={props.onUndo}><UndoIcon /></IconButton>
              <IconButton label={t('toolbar.redo')} disabled={!props.canRedo} onClick={props.onRedo}><RedoIcon /></IconButton>
            </>
          )}
          {pageBar}
          {props.readOnly && <span className="kit-viewbar__says">{t('toolbar.readOnly')}</span>}
        </>
      )}
      {...(editing && add ? {
        add: (
          <span data-guide="board.library">
            <ViewBarMenu
              label={t('bar.add')}
              {...(add.keepOpen ? {} : { 'data-guide': 'board.palette' })}
              items={[
                ...add.kinds.map((kind) => ({ label: kind.label, onSelect: kind.onPress })),
                ...(add.onExisting ? [{ line: true } as const, { label: t('palette.existing'), onSelect: add.onExisting }] : []),
                { line: true },
                { label: t('bar.keepOpen'), checked: add.keepOpen, onSelect: () => add.onKeepOpen(!add.keepOpen) },
              ]}
            />
          </span>
        ),
      } : {})}
      {...(editing ? { arrange: <ArrangeBar props={props} /> } : {})}
      {...(onCanvas ? {
        show: (
          <>
            <ShowBar props={props} show={show} />
            {props.activeDiagram.kind === 'container' && <ContainerWords props={props} />}
          </>
        ),
      } : {})}
      {...(onCanvas && props.onColourByChange ? { colour: <ColourBar props={props} /> } : {})}
      day={day}
      {...(props.activeDiagram.kind === 'conway' ? {} : {
        // A Conway map places no element of its own, so the board's find answered *no element matches* for every name on it.
        find: <ViewBarButton onClick={props.onOpenSearch} data-testid="board-find">{t('bar.find')}</ViewBarButton>,
      })}
      {...(onCanvas ? {
        exportAs: (
          <ViewBarButton onClick={props.onExport} working={props.exportBusy === true} data-testid="board-export">
            {t('bar.export')}
          </ViewBarButton>
        ),
      } : {})}
      more={<MoreMenu items={more} size="small" label={t('bar.more')} />}
    />
  );
}
