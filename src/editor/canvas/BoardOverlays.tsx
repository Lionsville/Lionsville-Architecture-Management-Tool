// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What stands on a board besides the drawing, each only while it has something to say:
 * the line a person is drawing, the one being started from a card, a word over a
 * selection, an empty board's two ways in.
 */
import { useCallback, useEffect, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';
import { getSmoothStepPath, Panel, useReactFlow, ViewportPortal, type ConnectionLineComponentProps, type FinalConnectionState } from '@xyflow/react';
import { useStrings } from '../../i18n/LanguageContext';
import { Button, IconButton } from '../../widgets/kit/Button';
import { CloseIcon } from '../../widgets/icons';
import { useSessionSet } from '../../widgets/sessionMemory';
import { usePlaceHost } from '../../widgets/kit/placeHost';
import { MenuButton } from '../../widgets/kit/Menu';
import type { DesignDiagram, ElementId, Point } from '../../model/types';
import type { EditorActions } from '../useEditorState';
import type { DiagramCanvasProps } from './DiagramCanvas';
import { BoardKey, OverlayLegend } from './OverlayLegend';
import { ZoomControls } from './ZoomControls';
import type { AlignAxis, DistributeAxis } from '../../layout/alignDistribute';

/**
 * The line in hand: the elbow route it will get, dashed in the focus ink so it stands
 * apart from what is drawn, with a word once a release would land it.
 */
export function BoardConnectionLine({ fromX, fromY, toX, toY, fromPosition, toPosition, connectionStatus }: ConnectionLineComponentProps) {
  const { t } = useStrings();
  const [path] = getSmoothStepPath({
    sourceX: fromX, sourceY: fromY, sourcePosition: fromPosition,
    targetX: toX, targetY: toY, targetPosition: toPosition, borderRadius: 4,
  });
  return (
    <g className="lv-connecting">
      <path d={path} fill="none" stroke="var(--line-focus)" style={{ strokeWidth: 'calc(2px / var(--canvas-zoom, 1))', strokeDasharray: 'calc(5px / var(--canvas-zoom, 1))' }} />
      <circle cx={toX} cy={toY} fill="var(--selected-edge)" style={{ r: 'calc(4px / var(--canvas-zoom, 1))' }} />
      {connectionStatus === 'valid' && (
        <foreignObject x={toX} y={toY} width={1} height={1} overflow="visible">
          <span className="lv-connect-word">{t('board.releaseToConnect')}</span>
        </foreignObject>
      )}
    </g>
  );
}

/** *Start connection*'s line, from the card to the pointer, so the mode can be seen where it is used. */
function StartedLine({ startedFrom }: { startedFrom: ElementId | null }) {
  const { screenToFlowPosition, getNode } = useReactFlow();
  const started = startedFrom !== null ? getNode(startedFrom) : undefined;
  const fromX = started ? started.position.x + (started.measured?.width ?? started.width ?? 0) : undefined;
  const fromY = started ? started.position.y + (started.measured?.height ?? started.height ?? 0) / 2 : undefined;
  const from = fromX !== undefined && fromY !== undefined ? { x: fromX, y: fromY } : undefined;
  const [to, setTo] = useState<Point | undefined>(undefined);
  const on = from !== undefined;
  useEffect(() => {
    if (!on) { setTo(undefined); return undefined; }
    const move = (event: PointerEvent) => setTo(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [on, screenToFlowPosition]);
  if (!from || !to) return null;
  return (
    <ViewportPortal>
      <svg className="lv-started" data-testid="started-line" aria-hidden width={1} height={1}>
        <path
          d={`M${from.x} ${from.y} L${to.x} ${from.y} L${to.x} ${to.y}`}
          fill="none"
          stroke="var(--line-focus)"
          style={{ strokeWidth: 'calc(2px / var(--canvas-zoom, 1))', strokeDasharray: 'calc(5px / var(--canvas-zoom, 1))' }}
        />
      </svg>
    </ViewportPortal>
  );
}

/** Align and distribute over a selection, where it is: it needs no reaching for a dock. */
function SelectionBar({ count, onAlign, onDistribute, onGroup }: {
  count: number;
  onAlign(axis: AlignAxis): void;
  onDistribute(axis: DistributeAxis): void;
  onGroup?(): void;
}) {
  const { t } = useStrings();
  if (count < 2) return null;
  return (
    <Panel position="top-center">
      <div className="lv-selection-bar" role="group" aria-label={t('board.selectionBar', { count })}>
        <span className="lv-selection-bar__count">{t('board.selected', { count })}</span>
        <MenuButton
          variant="quiet"
          size="small"
          label={t('board.align')}
          items={[
            { label: t('canvas.alignLeft'), onSelect: () => onAlign('left') },
            { label: t('canvas.alignCenterX'), onSelect: () => onAlign('centerX') },
            { label: t('canvas.alignRight'), onSelect: () => onAlign('right') },
            { line: true },
            { label: t('canvas.alignTop'), onSelect: () => onAlign('top') },
            { label: t('canvas.alignCenterY'), onSelect: () => onAlign('centerY') },
            { label: t('canvas.alignBottom'), onSelect: () => onAlign('bottom') },
          ]}
        />
        {count >= 3 && (
          <MenuButton
            variant="quiet"
            size="small"
            label={t('board.distribute')}
            items={[
              { label: t('canvas.distributeHorizontally'), onSelect: () => onDistribute('horizontal') },
              { label: t('canvas.distributeVertically'), onSelect: () => onDistribute('vertical') },
            ]}
          />
        )}
        {onGroup && <Button variant="quiet" size="small" onClick={onGroup}>{t('board.group')}</Button>}
      </div>
    </Panel>
  );
}

/**
 * An empty board: its bands are the places to put things, and two ways in. Goes when a
 * card lands, or when the person puts it away — with its ✕ or Escape — since a person
 * who already knows how to add a card should not have to work around the note.
 */
export function EmptyBoard({ readOnly, onAdd, onExisting, onDismiss }: {
  readOnly: boolean;
  onAdd: (() => void) | undefined;
  onExisting: (() => void) | undefined;
  onDismiss(): void;
}) {
  const { t } = useStrings();
  return (
    <div className="lv-empty" data-testid="empty-board">
      <span className="lv-empty__close">
        <IconButton size="small" label={t('board.emptyDismiss')} onClick={onDismiss}><CloseIcon size={12} /></IconButton>
      </span>
      <h2 className="lv-empty__title">{t('board.emptyTitle')}</h2>
      {!readOnly && (
        <>
          <p className="lv-empty__how">{t('board.emptyHow')}</p>
          <div className="lv-empty__acts">
            {onAdd && <Button variant="primary" onClick={onAdd}>{t('board.emptyAdd')}</Button>}
            {onExisting && <Button onClick={onExisting}>{t('board.emptyExisting')}</Button>}
          </div>
        </>
      )}
    </div>
  );
}

/** The session's memory of the empty boards whose note was put away, by view. */
const EMPTY_NOTE_AWAY = 'board.emptyNoteAway';

/**
 * The empty board's note, until it is put away. Away is for the view and for the
 * session: the window remembers it while it is open, so switching tabs or pages does not
 * bring it back, and a new session or another empty view shows it again — a note
 * nobody can recall having hidden should not stay hidden for good. Escape anywhere on
 * the board puts it away too, since nothing on an empty board takes Escape for itself.
 */
export function EmptyBoardNote({ viewId, board, readOnly, onAdd, onExisting }: {
  viewId: string;
  board: RefObject<HTMLDivElement | null>;
  readOnly: boolean;
  onAdd: (() => void) | undefined;
  onExisting: (() => void) | undefined;
}) {
  const [away, setAway] = useSessionSet(EMPTY_NOTE_AWAY);
  const shown = !away.has(viewId);
  const dismiss = useCallback(() => setAway(new Set(away).add(viewId)), [away, setAway, viewId]);
  const pageUp = usePlaceHost()?.pageUp ?? false;
  useEffect(() => {
    if (!shown || pageUp) return undefined;
    // A press on open board leaves the focus on the body, so the key is heard on the
    // window: from the board, or from nowhere in particular while the board is what is up.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const from = event.target;
      if (from !== document.body && !(from instanceof Node && board.current?.contains(from))) return;
      event.preventDefault();
      dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [board, shown, pageUp, dismiss]);
  if (!shown) return null;
  return <EmptyBoard readOnly={readOnly} onAdd={onAdd} onExisting={onExisting} onDismiss={dismiss} />;
}

/** Which side of a card a point is nearest to, for a line released on it. */
function nearestSide(box: { left: number; top: number; width: number; height: number }, at: Point): 'top' | 'right' | 'bottom' | 'left' {
  const distances = [
    ['top', Math.abs(at.y - box.top)],
    ['right', Math.abs(box.left + box.width - at.x)],
    ['bottom', Math.abs(box.top + box.height - at.y)],
    ['left', Math.abs(at.x - box.left)],
  ] as const;
  return distances.reduce((best, one) => (one[1] < best[1] ? one : best))[0];
}

/** What a canvas's element says about what Show and Colour have up, for board.css. */
export function boardAttributes(props: Pick<DiagramCanvasProps, 'overlayLegend' | 'showStatus' | 'showDescriptions' | 'diagram'>) {
  return {
    'data-kind': props.diagram.kind,
    'data-lens': props.overlayLegend ? true : undefined,
    'data-hide-status': props.showStatus === false ? true : undefined,
    'data-hide-descriptions': props.showDescriptions === false ? true : undefined,
  };
}

/** The dock, the one key that is up, the bar over a selection, and a started line. */
export function BoardChrome({ diagram, readOnly, view, selected, onAlign, onDistribute, onGroup, startedFrom }: {
  diagram: DesignDiagram;
  readOnly: boolean;
  view: Pick<DiagramCanvasProps, 'onToggleMinimap' | 'showMinimap' | 'onToggleSnapToGrid' | 'onToggleShowGrid' | 'showGrid' | 'snapToGrid' | 'routeNote' | 'overlayLegend' | 'showKey'>;
  selected: ReadonlySet<ElementId>;
  onAlign(axis: AlignAxis): void;
  onDistribute(axis: DistributeAxis): void;
  onGroup?(): void;
  startedFrom: ElementId | null;
}) {
  return (
    <>
      <ZoomControls
        {...(view.onToggleMinimap ? { map: { on: view.showMinimap ?? false, onToggle: view.onToggleMinimap } } : {})}
        {...(!readOnly && view.onToggleSnapToGrid ? {
          grid: {
            showGrid: view.showGrid, onToggleShowGrid: view.onToggleShowGrid,
            snapToGrid: view.snapToGrid, onToggleSnapToGrid: view.onToggleSnapToGrid,
          },
        } : {})}
        {...(view.routeNote ? { note: view.routeNote } : {})}
      />
      {view.overlayLegend
        ? <OverlayLegend {...view.overlayLegend} />
        : view.showKey !== false && diagram.kind === 'layer7' && diagram.members.length > 0 && <BoardKey diagram={diagram} />}
      {!readOnly && (
        <SelectionBar count={selected.size} onAlign={onAlign} onDistribute={onDistribute} {...(onGroup ? { onGroup } : {})} />
      )}
      <StartedLine startedFrom={startedFrom} />
    </>
  );
}

/**
 * Asking what is to be added, where the person is looking: a double-click on open
 * board, or a line let go. On a handle React Flow has already answered; anywhere else
 * on a card it lands on the side nearest the pointer, and on open board it asks what
 * is to come, since a person mapping a landscape draws the line first and the drag is
 * never lost. Where it lands on the board is the rule a drop follows.
 */
export function useAskAdd(
  container: RefObject<HTMLDivElement | null>,
  props: Pick<DiagramCanvasProps, 'readOnly' | 'onAskAdd' | 'resolveDrop' | 'onAddExistingAt'>,
  actions: Pick<EditorActions, 'connect'>,
) {
  const { screenToFlowPosition } = useReactFlow();
  const { onAskAdd, resolveDrop, onAddExistingAt, readOnly } = props;
  const askAt = useCallback((screen: Point, connectFrom?: ElementId) => {
    const position = screenToFlowPosition(screen);
    onAskAdd?.({
      screen,
      at: { position, ...(resolveDrop?.('', position) ?? {}) },
      ...(connectFrom ? { connectFrom } : {}),
    });
  }, [onAskAdd, resolveDrop, screenToFlowPosition]);
  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent, connection: FinalConnectionState) => {
    if (container.current) delete container.current.dataset.connecting;
    const from = connection.fromNode?.id;
    if (readOnly || connection.isValid || !from || !('clientX' in event)) return;
    const at = { x: event.clientX, y: event.clientY };
    const under = document.elementFromPoint(at.x, at.y);
    const card = under?.closest<HTMLElement>('.react-flow__node');
    if (card?.dataset.id) {
      if (card.dataset.id !== from) actions.connect(from, card.dataset.id, { targetSide: nearestSide(card.getBoundingClientRect(), at) });
      return;
    }
    if (under?.closest('.react-flow__pane')) askAt(at, from);
  }, [actions, askAt, container, readOnly]);
  const onDoubleClick = readOnly || !onAskAdd ? undefined : (event: ReactMouseEvent) => {
    if ((event.target as HTMLElement).classList?.contains('react-flow__pane')) askAt({ x: event.clientX, y: event.clientY });
  };
  const askMiddle = onAskAdd ? () => {
    const box = container.current?.getBoundingClientRect();
    onAskAdd({ screen: { x: (box?.left ?? 0) + (box?.width ?? 0) / 2 - 160, y: (box?.top ?? 0) + (box?.height ?? 0) / 3 } });
  } : undefined;
  const askExisting = onAddExistingAt ? () => onAddExistingAt({ position: screenToFlowPosition({ x: 0, y: 0 }) }) : undefined;
  return { onConnectEnd, onDoubleClick, askMiddle, askExisting };
}
