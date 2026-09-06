import { useEffect, useRef, useState } from 'react';
import { useReactFlow, ViewportPortal } from '@xyflow/react';
import { alpha, useTheme } from '@mui/material/styles';
import { getNodeTokens } from '../theme/tokens';
import type { DiagramLayoutConfig, DomainGroupRect, Point } from '../../model/types';
import { useCanvasMenu } from './CanvasMenuContext';
import { usePointerDrag } from './usePointerDrag';
import { useStrings } from '../../i18n/LanguageContext';

const MIN_GROUP_SIZE = 120;

/**
 * How far a group's chosen colour reaches: the dashed border and the label take
 * the hex as-is, and the interior gets the same hue as a wash — enough to read
 * the group as a coloured region when the board is zoomed out, faint enough that
 * a card sitting on it still reads as a card. The wash is a touch stronger on
 * dark, where a 6% tint over a dark ground all but disappears.
 *
 * A group with no colour is byte-identical to before: the neutral theme tokens.
 * So is a group with a colour this does not recognise: `alpha()` THROWS on an
 * unparseable colour, and a decoration is never worth taking the whole canvas
 * down for, so anything that is not a plain hex degrades to neutral.
 */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function groupColors(
  tokens: ReturnType<typeof getNodeTokens>,
  dark: boolean,
  color: string | undefined,
): { border: string; fill: string; label: string } {
  if (!color || !HEX.test(color)) return tokens.domainGroup;
  return {
    border: color,
    fill: alpha(color, dark ? 0.1 : 0.06),
    label: color,
  };
}

/** One live move/resize: what was grabbed, where from, and where it is now. */
interface Gesture {
  group: DomainGroupRect;
  mode: 'move' | 'resize';
  /** Pointer-down position in flow coordinates. */
  origin: Point;
  /** The rectangle as it currently previews; identical to `group` until it moves. */
  current: DomainGroupRect;
}

export interface DomainGroupLayerProps {
  layoutConfig?: DiagramLayoutConfig;
  readOnly: boolean;
  /** Names of the currently selected groups (drawn solid + accented). */
  selected: string[];
  /**
   * Select a group. Fired by a click (or the start of a drag/resize) on the
   * label; clicking the box interior is resolved by the canvas's pane-click
   * hit-test, since the box itself is click-through.
   */
  onSelect(name: string): void;
  onUpsert(rect: DomainGroupRect): void;
  /** Rigid-move a group: translate the box AND its members by (dx, dy). */
  onMove(name: string, dx: number, dy: number): void;
  onRename(oldName: string, newName: string): void;
  /**
   * Start the inline rename of one group from outside (the group menu's
   * "Rename", F2 on a selected group). Handled once per nonce.
   */
  renameRequest?: { name: string; nonce: number };
}

/**
 * Explicit domain-group rectangles from the diagram's layoutConfig
 * (iteration 2 — no longer derived from member bounding boxes). Click the box
 * (or its label) to select it like a node — the inspector then offers rename,
 * tidy and remove, and Delete removes it. Drag the label to move, drag the
 * corner handle to resize, double-click the label to rename inline, right-click
 * the label for the group menu. The box interior is `pointer-events: none`, so a
 * right-click there arrives via the pane and the canvas resolves the group by
 * hit-test — both paths open the same shared menu (`CanvasMenuContext`).
 * Membership is assigned by containment when elements are dragged (Layer7Canvas).
 */
export function DomainGroupLayer(props: DomainGroupLayerProps) {
  const theme = useTheme();
  const { t } = useStrings();
  const tokens = getNodeTokens(theme);
  const { screenToFlowPosition } = useReactFlow();
  const menu = useCanvasMenu();
  const [preview, setPreview] = useState<DomainGroupRect | null>(null);
  const [renaming, setRenaming] = useState<{ name: string; value: string } | null>(null);
  const { renameRequest, readOnly } = props;
  const handledRenameNonce = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!renameRequest || handledRenameNonce.current === renameRequest.nonce) return;
    handledRenameNonce.current = renameRequest.nonce;
    if (readOnly) return;
    setRenaming({ name: renameRequest.name, value: renameRequest.name });
  }, [renameRequest, readOnly]);
  // What the pointer grabbed, promoted to `gesture` once the drag really starts.
  const pending = useRef<{ group: DomainGroupRect; mode: 'move' | 'resize' } | null>(null);
  const gesture = useRef<Gesture | null>(null);

  const drag = usePointerDrag({
    onStart: (event) => {
      const grabbed = pending.current;
      if (!grabbed) return;
      gesture.current = {
        ...grabbed,
        // Flow coordinates, not screen: the box lives in the viewport, so a
        // dragged pixel must mean the same thing at every zoom level.
        origin: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        current: grabbed.group,
      };
    },
    onMove: (_delta, event) => {
      const live = gesture.current;
      if (!live) return;
      const { group, mode, origin } = live;
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const dx = point.x - origin.x;
      const dy = point.y - origin.y;
      live.current =
        mode === 'move'
          ? { ...group, x: group.x + dx, y: group.y + dy }
          : {
              ...group,
              width: Math.max(group.width + dx, MIN_GROUP_SIZE),
              height: Math.max(group.height + dy, MIN_GROUP_SIZE),
            };
      setPreview(live.current);
    },
    onEnd: () => {
      const live = gesture.current;
      gesture.current = null;
      setPreview(null);
      if (!live || live.current === live.group) return;
      // A move carries the group's members along (rigid translate); a resize
      // touches the box alone.
      if (live.mode === 'move') {
        props.onMove(live.group.name, live.current.x - live.group.x, live.current.y - live.group.y);
      } else {
        props.onUpsert(live.current);
      }
    },
    onCancel: () => {
      gesture.current = null;
      setPreview(null);
    },
  });

  const groups = props.layoutConfig?.domainGroups ?? [];
  if (groups.length === 0) return null;

  const beginGesture =
    (group: DomainGroupRect, mode: 'move' | 'resize') =>
    (event: React.PointerEvent<HTMLDivElement | HTMLSpanElement>) => {
      if (event.button !== 0) return;
      // Select first, drag second — the label stops propagation, so the pane
      // click that would otherwise select the group never fires. Selection is
      // allowed read-only (it only drives the inspector); the gesture is not.
      props.onSelect(group.name);
      if (props.readOnly) return;
      pending.current = { group, mode };
      drag.onPointerDown(event);
    };

  const commitRename = () => {
    if (renaming) props.onRename(renaming.name, renaming.value);
    setRenaming(null);
  };

  return (
    <>
      <ViewportPortal>
        {groups.map((group) => {
          const rect = preview && preview.name === group.name ? preview : group;
          const colors = groupColors(tokens, theme.palette.mode === 'dark', group.color);
          const isSelected = props.selected.includes(group.name);
          // Selected reads like a selected node: the dashes go solid and a soft
          // ring lifts the box off the band behind it. The group's own colour
          // still owns the border and the wash — selection is a state on top of
          // the decoration, not a replacement for it.
          const border = isSelected
            ? `2px solid ${colors.border}`
            : `1.5px dashed ${colors.border}`;
          return (
            <div
              key={group.name}
              data-testid="lv-domain-group"
              data-group={group.name}
              style={{
                position: 'absolute',
                left: rect.x,
                top: rect.y,
                width: rect.width,
                height: rect.height,
                border,
                boxShadow: isSelected ? `0 0 0 4px ${theme.palette.action.selected}` : undefined,
                backgroundColor: colors.fill,
                borderRadius: 14,
                pointerEvents: 'none',
                zIndex: -1,
              }}
            >
              {renaming?.name === group.name ? (
                <input
                  autoFocus
                  className="nodrag nopan"
                  aria-label={t('canvas.groupName')}
                  value={renaming.value}
                  onChange={(e) => setRenaming({ name: group.name, value: e.target.value })}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    // Cancel/commit the rename here first; don't let these keys
                    // bubble to the editor's Escape-to-deselect shortcut.
                    e.stopPropagation();
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  style={{
                    position: 'absolute',
                    top: -12,
                    left: 16,
                    padding: '1px 6px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1.1,
                    textTransform: 'uppercase',
                    color: theme.palette.text.primary,
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.primary.main}`,
                    borderRadius: 4,
                    outline: 'none',
                    pointerEvents: 'all',
                  }}
                />
              ) : (
                <span
                  className="nodrag nopan"
                  role="button"
                  aria-label={t('canvas.groupNamed', { name: group.name })}
                  aria-pressed={isSelected}
                  onPointerDown={beginGesture(group, 'move')}
                  onDoubleClick={() =>
                    !props.readOnly && setRenaming({ name: group.name, value: group.name })
                  }
                  onContextMenu={(event) => {
                    if (props.readOnly) return;
                    event.stopPropagation();
                    menu.open({ kind: 'group', name: group.name }, event);
                  }}
                  style={{
                    position: 'absolute',
                    top: -9,
                    left: 16,
                    padding: '0 6px',
                    backgroundColor: theme.palette.background.default,
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.1,
                    textTransform: 'uppercase',
                    color: colors.label,
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    cursor: props.readOnly ? 'default' : 'grab',
                    pointerEvents: 'all',
                  }}
                >
                  {group.name}
                </span>
              )}
              {!props.readOnly && (
                <div
                  className="nodrag nopan"
                  aria-label={t('canvas.resizeGroup', { name: group.name })}
                  onPointerDown={beginGesture(group, 'resize')}
                  style={{
                    position: 'absolute',
                    right: -6,
                    bottom: -6,
                    width: 14,
                    height: 14,
                    borderRight: `3px solid ${colors.border}`,
                    borderBottom: `3px solid ${colors.border}`,
                    borderBottomRightRadius: 6,
                    cursor: 'nwse-resize',
                    pointerEvents: 'all',
                  }}
                />
              )}
            </div>
          );
        })}
      </ViewportPortal>
    </>
  );
}
