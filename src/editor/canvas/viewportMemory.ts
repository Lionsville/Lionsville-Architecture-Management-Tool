// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where each diagram was left, for the session.
 *
 * React Flow keeps one transform for the one canvas, and the canvas is not
 * remounted when the active diagram changes — so a person who zoomed into a
 * container diagram and pressed *Back to landscape* got the landscape drawn
 * under the container's transform: one card, large, and the rest off-screen.
 * The viewport a person left a diagram at is theirs, not the document's, so
 * it is kept here rather than saved: per diagram id, for as long as the
 * editor is mounted.
 *
 * A diagram never visited has nothing kept and is fitted on first open, which
 * is what the canvas did on mount anyway. A diagram that has since been
 * deleted and re-made under the same id — an undo — comes back where it was.
 */
export type Viewport = { x: number; y: number; zoom: number };

export class ViewportMemory {
  private readonly kept = new Map<string, Viewport>();

  keep(diagramId: string, viewport: Viewport): void {
    this.kept.set(diagramId, { ...viewport });
  }

  recall(diagramId: string): Viewport | undefined {
    const held = this.kept.get(diagramId);
    return held ? { ...held } : undefined;
  }
}
