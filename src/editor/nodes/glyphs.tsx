/**
 * Tiny inline SVG glyphs (stroke = currentColor). The package deliberately
 * avoids an @mui/icons-material dependency — these few marks are all it needs.
 *
 * `strokeWidth` defaults to 2, which is what every node draws. The palette
 * passes 1.5: six 2px marks stacked in a narrow column read as a texture rather
 * than as six separate things, and the palette wants the label to lead. Nodes
 * never pass it, so canvas rendering is unchanged.
 */

interface GlyphProps {
  size?: number;
  strokeWidth?: number;
}

export function PersonGlyph({ size = 14, strokeWidth = 2 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth={strokeWidth} />
      <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function ChannelGlyph({ size = 14, strokeWidth = 2 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6l6 6-6 6M12 6l6 6-6 6" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WrenchGlyph({ size = 13, strokeWidth = 2 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14.5 6.5a4 4 0 0 0-5.6 4.9L4 16.3V20h3.7l4.9-4.9a4 4 0 0 0 4.9-5.6l-2.8 2.8-2.4-2.4 2.2-3.4z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GlobeGlyph({ size = 13, strokeWidth = 2 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={strokeWidth} />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.6 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3z" stroke="currentColor" strokeWidth={strokeWidth} />
    </svg>
  );
}

export function DrillGlyph({ size = 12, strokeWidth = 2 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 5h6M5 5v6M5 5l8 8M19 13v6h-6" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * `DocGlyph` moved to `widgets/icons.tsx`: the documentation page draws it too,
 * and that page may not import the canvas. Re-exported so the nodes beside it
 * keep one import for "the glyphs".
 */
export { DocGlyph } from '../../widgets/icons';

export function WarningGlyph({ size = 12, strokeWidth = 2 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5 21.5 20h-19L12 3.5z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <path d="M12 10v4.5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle cx="12" cy="17.4" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function LinkGlyph({ size = 11, strokeWidth = 2 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ApplicationGlyph({ size = 14, strokeWidth = 2 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth={strokeWidth} />
      <path d="M3 9h18" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle cx="6.5" cy="6.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

/** UML-style component: a box with the two protruding tabs. */
export function ComponentGlyph({ size = 14, strokeWidth = 2 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="7" y="4" width="14" height="16" rx="1.5" stroke="currentColor" strokeWidth={strokeWidth} />
      <rect x="3" y="7" width="6" height="3.5" rx="1" stroke="currentColor" strokeWidth={strokeWidth} />
      <rect x="3" y="13.5" width="6" height="3.5" rx="1" stroke="currentColor" strokeWidth={strokeWidth} />
    </svg>
  );
}

/** Domain group: the dashed rectangle the landscape draws around a group. */
export function DomainGroupGlyph({ size = 14, strokeWidth = 2 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray="4 3"
      />
    </svg>
  );
}

/**
 * Actor stickman (U7c/D11), shared by `ActorNode` and the palette.
 *
 * It conforms to this module's contract rather than the reverse: `currentColor`
 * and `aria-hidden`, like every other glyph here. `ActorNode` supplies the
 * colour and the announcement from its own wrapper, where the node — not the
 * shared mark — owns what a screen reader says. That matters for the palette:
 * a copy carrying `role="img" aria-label="Actor figure"` would make a palette
 * row announce "Application, Actor figure".
 *
 * The figure is taller than it is wide, so `size` sets the HEIGHT and the width
 * follows the 24×32 viewBox (3:4). `size={34}` reproduces the node's mark.
 */
export function StickmanGlyph({ size = 18, strokeWidth = 2 }: GlyphProps) {
  return (
    <svg width={(size * 3) / 4} height={size} viewBox="0 0 24 32" fill="none" aria-hidden>
      <circle cx="12" cy="5" r="4" stroke="currentColor" strokeWidth={strokeWidth} />
      <path
        d="M12 9v11M12 12l-7 4M12 12l7 4M12 20l-5 9M12 20l5 9"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
