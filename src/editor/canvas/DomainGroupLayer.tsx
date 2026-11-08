// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useEffect, useRef, useState } from 'react';
import { useReactFlow, ViewportPortal } from '@xyflow/react';
import { useTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { getNodeTokens } from '../theme/tokens';
import type { DiagramGroup, DomainGroupRect, Geometry, Point, Rect } from '../../model/types';
import { useCanvasMenu } from './CanvasMenuContext';
import { usePointerDrag } from './usePointerDrag';
import { useStrings } from '../../i18n/LanguageContext';
import { Zone } from '../../widgets/kit/Zone';
import { claimKey } from '../../widgets/kit/keys';

const MIN_GROUP_SIZE = 120;

/**
 * A group is the kit's Zone: a step of the ground, an edge and a name, each read
 * at any zoom, and a colour somebody chose stays as the thin rail at its left. Anything but a plain hex
 * draws no rail: a decoration is never worth taking the canvas down for.
 */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function groupColors(
  theme: Theme,
  color: string | undefined,
): { border: string; fill: string; label: string; rail?: string } {
  const tokens = getNodeTokens(theme);
  return color && HEX.test(color) ? { ...tokens.domainGroup, rail: color } : tokens.domainGroup;
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
  geometry?: Geometry;
  /**
   * What the groups are CALLED, by id (ADR-0012 §6). The boxes come from the
   * layout config; the label and the colour come from here, which is why a
   * rename moves no geometry.
   */
  groups: readonly DiagramGroup[];
  readOnly: boolean;
  /** Ids of the currently selected groups (drawn solid + accented). */
  selected: string[];
  /**
   * Select a group. Fired by a click (or the start of a drag/resize) on the
   * label; clicking the box interior is resolved by the canvas's pane-click
   * hit-test, since the box itself is click-through.
   */
  onSelect(groupId: string): void;
  /** Commit a resized box. Geometry only. */
  onResize(groupId: string, box: Rect): void;
  /** Rigid-move a group: translate the box AND its members by (dx, dy). */
  onMove(groupId: string, dx: number, dy: number): void;
  onRename(groupId: string, name: string): void;
  /**
   * Start the inline rename of one group from outside (the group menu's
   * "Rename", F2 on a selected group). Handled once per nonce.
   */
  renameRequest?: { groupId: string; nonce: number };
}

/**
 * Explicit domain-group rectangles from the view's geometry
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
  const { screenToFlowPosition } = useReactFlow();
  const menu = useCanvasMenu();
  const [preview, setPreview] = useState<DomainGroupRect | null>(null);
  const [renaming, setRenaming] = useState<{ groupId: string; value: string } | null>(null);
  const { renameRequest, readOnly, groups } = props;
  const handledRenameNonce = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!renameRequest || handledRenameNonce.current === renameRequest.nonce) return;
    handledRenameNonce.current = renameRequest.nonce;
    if (readOnly) return;
    const held = groups.find((group) => group.id === renameRequest.groupId);
    setRenaming({ groupId: renameRequest.groupId, value: held?.name ?? renameRequest.groupId });
  }, [renameRequest, readOnly, groups]);
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
        props.onMove(live.group.id, live.current.x - live.group.x, live.current.y - live.group.y);
      } else {
        const { id, ...box } = live.current;
        props.onResize(id, box);
      }
    },
    onCancel: () => {
      gesture.current = null;
      setPreview(null);
    },
  });

  const boxes = props.geometry?.groups ?? [];
  const named = new Map(props.groups.map((group) => [group.id, group]));
  if (boxes.length === 0) return null;

  const beginGesture =
    (group: DomainGroupRect, mode: 'move' | 'resize') =>
    (event: React.PointerEvent<HTMLDivElement | HTMLSpanElement>) => {
      if (event.button !== 0) return;
      // Select first, drag second — the label stops propagation, so the pane
      // click that would otherwise select the group never fires. Selection is
      // allowed read-only (it only drives the inspector); the gesture is not.
      props.onSelect(group.id);
      if (props.readOnly) return;
      pending.current = { group, mode };
      drag.onPointerDown(event);
    };

  const commitRename = () => {
    if (renaming) props.onRename(renaming.groupId, renaming.value);
    setRenaming(null);
  };

  return (
    <>
      <ViewportPortal>
        {boxes.map((group) => {
          const rect = preview && preview.id === group.id ? preview : group;
          const held = named.get(group.id);
          const label = held?.name ?? group.id;
          const colors = groupColors(theme, held?.color);
          const isSelected = props.selected.includes(group.id);
          return (
            <Zone
              key={group.id}
              className="lv-group"
              name={label}
              nameAs={renaming?.groupId === group.id ? (
                <input
                  autoFocus
                  className="nodrag nopan"
                  aria-label={t('canvas.groupName')}
                  value={renaming.value}
                  onChange={(e) => setRenaming({ groupId: group.id, value: e.target.value })}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    // Cancel/commit the rename here first; don't let these keys
                    // bubble to the editor's Escape-to-deselect shortcut.
                    e.stopPropagation();
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') { claimKey(e); setRenaming(null); }
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
                  className="nodrag nopan lv-group__name"
                  role="button" tabIndex={0}
                  aria-label={t('canvas.groupNamed', { name: label })}
                  aria-pressed={isSelected}
                  onPointerDown={beginGesture(group, 'move')}
                  onDoubleClick={() =>
                    !props.readOnly && setRenaming({ groupId: group.id, value: label })
                  }
                  onContextMenu={(event) => {
                    if (props.readOnly) return;
                    event.stopPropagation(); if (!isSelected) props.onSelect(group.id); // the panel says what the menu acts on
                    menu.open({ kind: 'group', groupId: group.id }, event);
                  }}
                  style={{
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    cursor: props.readOnly ? 'default' : 'grab',
                    pointerEvents: 'all',
                  }}
                >
                  {label}
                </span>
              )}
              data-testid="lv-domain-group"
              data-group={group.id}
              data-selected={isSelected || undefined}
              style={{
                position: 'absolute',
                left: rect.x,
                top: rect.y,
                width: rect.width,
                height: rect.height,
                // Selected reads as a selected card does: the selection's edge, drawn outside the box so nothing in it moves.
                ...(isSelected ? { borderColor: 'var(--selected-edge)', boxShadow: '0 0 0 calc(2px / var(--canvas-zoom, 1)) var(--selected-edge)' } : {}),
                ...(colors.rail ? { borderLeft: `calc(3px / var(--canvas-zoom, 1)) solid ${colors.rail}` } : {}),
                pointerEvents: 'none',
                zIndex: -1,
              }}
            >
              {!props.readOnly && (
                <div
                  className="nodrag nopan" role="separator"
                  aria-label={t('canvas.resizeGroup', { name: label })}
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
            </Zone>
          );
        })}
      </ViewportPortal>
    </>
  );
}
