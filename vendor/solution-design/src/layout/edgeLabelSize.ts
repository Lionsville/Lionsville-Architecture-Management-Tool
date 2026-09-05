import type { DesignConnection } from '../types';

/**
 * Estimated on-canvas size of an edge's label chip, fed to ELK so the layered
 * algorithm can reserve room for center edge labels (it inserts label dummy
 * nodes when a labelled edge carries dimensions).
 *
 * Calibrated to FloatingEdge's label chip (edges/FloatingEdge.tsx:252-339):
 *   - box: `padding: '2px 7px'`, `maxWidth: 240`
 *   - label span: `fontSize: 10`, `lineHeight: 1.35` (one text line)
 *   - optional protocol span below it: `fontSize: 9`, uppercase (a 2nd line)
 * A single label line renders ~18px tall on the canvas; with the protocol line
 * underneath the chip is ~34px. Glyph advance at fontSize 10 averages ~6.2px.
 * These are deterministic estimates — no DOM measurement — and HAL-agnostic.
 */
export interface EdgeLabelSize {
  width: number;
  height: number;
}

/** FloatingEdge chip `maxWidth`. */
const MAX_CHIP_WIDTH = 240;
/** `padding: '2px 7px'` → 7px each side. */
const HORIZONTAL_PADDING = 14;
/** Average glyph advance at fontSize 10. */
const CHAR_WIDTH = 6.2;
/** One label line, including the chip's vertical padding. */
const LINE_HEIGHT = 18;
/** The uppercase protocol line adds a second row (~34px total). */
const PROTOCOL_LINE_HEIGHT = 16;

/**
 * Estimate the label chip size for a connection, or `undefined` when the
 * connection carries no label (only labelled edges need space reserved).
 */
export function edgeLabelSize(
  connection: Pick<DesignConnection, 'label' | 'protocol'>,
): EdgeLabelSize | undefined {
  const label = connection.label?.trim();
  if (!label) return undefined;

  const protocol = connection.protocol?.trim();
  // Width tracks the longest wrapped line so multi-line labels are not
  // under-measured; a short label with a long protocol is driven by the
  // protocol instead. Capped at the chip's maxWidth (the text wraps there).
  const widestLineChars = Math.max(
    ...label.split('\n').map((line) => line.length),
    protocol ? protocol.length : 0,
  );
  const width = Math.min(
    MAX_CHIP_WIDTH,
    Math.ceil(widestLineChars * CHAR_WIDTH) + HORIZONTAL_PADDING,
  );
  const height = protocol ? LINE_HEIGHT + PROTOCOL_LINE_HEIGHT : LINE_HEIGHT;
  return { width, height };
}
