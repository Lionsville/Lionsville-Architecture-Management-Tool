/**
 * The options every "fit the board" shares.
 *
 * React Flow's fit counts only the nodes it has measured, and the canvas
 * virtualises: on a board of two thousand cards only the ones in view are
 * drawn, so a fit pressed while zoomed in on one card framed that one card.
 * `includeHiddenNodes` makes it fall back to a node's declared size — and
 * every node here declares one (`graph.ts`), so the whole board is what gets
 * framed, drawn or not.
 */
export const FIT_ALL = { padding: 0.1, includeHiddenNodes: true } as const;
