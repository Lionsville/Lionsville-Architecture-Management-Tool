import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, useTheme, type SxProps, type Theme } from '@mui/material/styles';
import { getNodeTokens } from '../theme/tokens';
import { DESCRIPTION_TYPE, descriptionLineClamp } from '../model/placement';
import { shortDescription } from '../model/documentation';
import type { DesignElement, ElementKind } from '../types';
import { ElementResizer } from './ElementResizer';
import { LifecycleBadge } from './LifecycleBadge';
import { LogoMark, useResolvedLogo } from './logoRegistry';
import { NodeHandles } from './NodeHandles';
import type { ElementNodeData } from './nodeData';

/**
 * ONE scaffold for all seven node components.
 *
 * Every node used to open with the same eighteen lines — a positioned wrapper, a
 * root box with the selection ring and the retired dim, a NodeResizer, four-side
 * handles, and a LifecycleBadge outside the root's `overflow: hidden` — and then
 * differ only in what it drew inside. Seven copies of the frame is seven places
 * to forget the `readOnly` gate.
 *
 * What the shell owns:
 * - the `position: relative` wrapper the badge and the handles anchor to,
 * - the selection ring (`boxShadow`) over each kind's own resting shadow,
 * - the retired dim (`opacity`, gated on the lifecycle toggle),
 * - the resizer (never in read-only, never for a node with no limits),
 * - the four-side handles,
 * - the lifecycle badge.
 *
 * What each node still owns: everything visual inside — its surface, border,
 * radius, layout and content — handed in as `sx` plus `children`. The shell adds
 * nothing to `sx` after it, so a node can still override any of it.
 *
 * The three companion pieces below (`NodeIcon`, `NodeIconRow`, `NodeDescription`)
 * are the slots the nodes place themselves, because WHERE a mark or a description
 * sits is exactly the part that differs per kind.
 */
export function NodeShell({
  element,
  selected,
  readOnly,
  showLifecycle,
  resizeLimits,
  sx,
  restingShadow = 'none',
  selectionRing = true,
  children,
}: {
  element: DesignElement;
  selected: boolean;
  readOnly: boolean;
  showLifecycle: boolean;
  /** Absent = this node does not resize (the container-diagram boundary). */
  resizeLimits?: ElementNodeData['resizeLimits'];
  /** The node's own root-box styling. Applied last, so it wins. */
  sx?: SxProps<Theme>;
  /** Shadow when NOT selected; the application card draws `theme.shadows[1]`. */
  restingShadow?: string;
  /**
   * Draw the 2px selection ring. The boundary node says no: it shows selection
   * by recolouring its dashed border, and a ring around a whole container
   * diagram would frame the components inside it.
   */
  selectionRing?: boolean;
  children: ReactNode;
}) {
  const tokens = getNodeTokens(useTheme());
  const dim = element.lifecycle === 'retired' && showLifecycle;
  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Box
        sx={{
          width: '100%',
          height: '100%',
          boxShadow:
            selected && selectionRing ? `0 0 0 2px ${tokens.card.selectedRing}` : restingShadow,
          opacity: dim ? 0.55 : 1,
          ...sx,
          /**
           * The keyboard focus ring (4B). React Flow puts `tabIndex` on its own
           * `.react-flow__node` wrapper, which is this box's PARENT — so the
           * selector reaches up rather than using `&:focus-visible`, which would
           * never match. Last in the object so a node's own `sx` cannot lose it.
           *
           * `:focus-visible` and not `:focus`: a mouse click focuses the node
           * too, and a ring that appeared on every click would just be a second,
           * uglier selection ring.
           */
          '.react-flow__node:focus-visible &': {
            boxShadow: `0 0 0 2px ${tokens.card.focusRing}, 0 0 0 5px ${alpha(tokens.card.focusRing, 0.3)}`,
          },
        }}
      >
        {children}
        {!readOnly && resizeLimits && (
          <ElementResizer elementId={element.id} selected={selected} limits={resizeLimits} />
        )}
        <NodeHandles connectable={!readOnly} />
      </Box>
      <LifecycleBadge lifecycle={element.lifecycle} show={showLifecycle} />
    </Box>
  );
}

// --- the icon slot -------------------------------------------------------------

/** The body mark's edge, px. Big enough to read a board across a room. */
const LARGE_ICON = 28;

/** True when this element asks for the big body mark instead of the header one. */
export function usesBodyIcon(element: DesignElement): boolean {
  return element.iconSize === 'large';
}

/**
 * The size this element's mark draws at: its slot's own small size (≈13–14 px,
 * per kind, unchanged) or the 28 px body mark.
 *
 * Five of the seven kinds lead their body with a horizontal row — the management
 * tool, the external system's EXTERNAL strip, the actor's and input channel's
 * name rows, the boundary's title — so for them "leading the body" and "in the
 * header row" are the same slot and only the size changes. The application card
 * is the exception: its header is a title BAR, so it moves the mark into the
 * body with {@link NodeIconRow} instead of growing the bar.
 */
export function iconSlotSize(element: DesignElement, small = 14): number {
  return usesBodyIcon(element) ? LARGE_ICON : small;
}

/**
 * The resolved mark, or the kind's own glyph, or nothing.
 *
 * `fallback` renders UNWRAPPED when the key is absent or unresolvable, so a node
 * whose slot has always held a glyph (the globe, the wrench) keeps drawing
 * exactly what it drew. That fallback is intent rule 9's degradation rule, and
 * the reason a purged library entry or an `iconType` from another tool cannot
 * break a diagram.
 */
export function NodeIcon({
  element,
  size,
  color,
  fallback,
}: {
  element: DesignElement;
  size: number;
  /** Ink for a monochrome built-in; an uploaded mark keeps its own colours. */
  color?: string;
  fallback?: ReactNode;
}) {
  const logo = useResolvedLogo(element.iconKey);
  if (!logo) return <>{fallback ?? null}</>;
  return (
    <Box sx={{ display: 'flex', flexShrink: 0, ...(color ? { color } : {}) }}>
      <LogoMark resolved={logo} size={size} />
    </Box>
  );
}

// --- the description slot ------------------------------------------------------

/**
 * The line-clamped description block, once. Six nodes carried the same six CSS
 * properties with only the per-kind type scale differing; the clamp count is
 * derived from the node's measured height (`descriptionLineClamp`), which is the
 * part worth having in one place — as is the rule that a description that has
 * grown into a page is drawn as its short description only.
 */
export function NodeDescription({
  kind,
  text,
  height,
  sx,
}: {
  kind: ElementKind;
  text: string | undefined;
  /** The node's measured height; decides how many lines fit. */
  height: number | undefined;
  sx?: SxProps<Theme>;
}) {
  const tokens = getNodeTokens(useTheme());
  // The one line a node shows of what may be a whole page (see
  // model/documentation): applied here so no node can forget it.
  const line = shortDescription(text);
  return (
    <Typography
      sx={{
        fontSize: DESCRIPTION_TYPE[kind].fontSize,
        lineHeight: DESCRIPTION_TYPE[kind].lineHeight,
        color: tokens.card.description,
        display: '-webkit-box',
        WebkitLineClamp: descriptionLineClamp(kind, height),
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        ...sx,
      }}
    >
      {line}
    </Typography>
  );
}
