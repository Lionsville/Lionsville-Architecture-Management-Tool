// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useEffect, useRef } from 'react';
import type { DesignDiagram } from '../model/types';
import type { TidyOptions } from '../layout/tidy';
import type { LayoutAction } from './EditorToolbar';

/**
 * Lay a diagram out ONCE, the first time a person opens geometry a machine wrote.
 *
 * Not continuous auto-layout, and the difference is the whole design. A HAL
 * solution design is a curated board: the tech lead places elements deliberately,
 * drags group boxes, resizes them, and three separate pin options exist purely to
 * make Tidy move less. Layout that re-ran on every graph change would spend its
 * life undoing work the user just did, with a save behind it — and the pins could
 * not rescue it, because the contradiction is structural rather than a matter of
 * degree: `pinGroups` means "do not move my boxes", and a mode that re-lays-out
 * on change means "move whatever the graph implies".
 *
 * So the question is not *whether* to run layout automatically but *where there
 * is nothing to protect*, and there are exactly two such places — both of them
 * geometry whose own author apologised for it. A newly created container diagram
 * carries a seed grid the editor is expected to take over from, and an imported
 * diagram carries one because the interchange document deliberately holds no
 * coordinates. Both say so on the diagram itself, with `needsLayout`, which is
 * why this hook needs nothing from the host but the diagram.
 *
 * The flag alone is not enough, and the second condition is the one that
 * matters for a board more than one person opens: **no member may have a
 * stored position yet** ({@link hasStoredPosition}). A board whose flag
 * survived a layout that did land — a pass whose flag clear was lost, a
 * seed that shipped real coordinates with the flag still on — is a board
 * somebody may already have looked at and arranged, and relaying it on every
 * open, as the step of whoever happened to open it, rearranged it each time.
 * Where both say "nobody has placed anything here", nothing is lost
 * ({@link awaitsLayout} is the two of them, and a member to place).
 *
 * Nor is it ever run for a reader: a read-only session makes no step. What a
 * reader is shown of such a board is the same pass held on the screen and
 * landed nowhere (`useReadingLayout`) — without it, every member answers
 * (0, 0) until somebody who may write the board has opened it, and the reader
 * sees the whole board on one point.
 *
 * The pass that runs is marked as the editor's own and carries the flag's
 * clearing in the same step (`useLayoutActions`), so the two travel together.
 */
export interface UseAutoLayoutArgs {
  /** The diagram on screen, or undefined while the host is still resolving it. */
  diagram: DesignDiagram | undefined;
  readOnly: boolean;
  /** Whichever layout action is already running, from the editor's own flag. */
  busy: LayoutAction | undefined;
  /** The session's Tidy settings; {@link settlingOptions} strips the pins. */
  options: TidyOptions;
  /**
   * `handleTidy`, with its unattended flag already bound — the same function the
   * toolbar button calls, so the two paths cannot drift apart. The flag only
   * changes the WORDING of a failure: advice to reload is for someone who pressed
   * something and is waiting, not for a pass that ran by itself.
   */
  run(override: TidyOptions): Promise<void>;
  /**
   * Fires once, after a pass that produced placements. The host clears the
   * persisted flag from here (and, on that path only, says so once).
   *
   * Deliberately not called when the pass threw: the flag then stays set, so the
   * diagram gets one more attempt the next time it is opened, while the session
   * ref below stops it retrying in a loop meanwhile.
   */
  onSettled?(diagramId: string): void;
}

/**
 * The options a settling pass runs with: the session's `direction` and `density`,
 * and **all three pins forced off**.
 *
 * The soft reason is that there is no curation to protect on a machine-written
 * board. The hard one is where `TidyOptions` lives: it is session state on the
 * editor, shared across every diagram, not a per-diagram setting. So "the user
 * ticked every pin box" does not mean *protect this board* — it means they ticked
 * boxes to protect some OTHER board earlier in the same session, and carrying
 * those onto a diagram they have never seen leaks one board's setting onto
 * another.
 *
 * That asymmetry is also why direction and density are treated differently even
 * though they are the same kind of session state: a carried-over direction gives
 * a valid board that one button press re-flows, while a carried-over pin gives a
 * board that KEEPS THE MACHINE GRID — the exact outcome the pass exists to
 * prevent, arrived at silently.
 */
export function settlingOptions(options: TidyOptions): TidyOptions {
  return {
    ...options,
    pinGroups: false,
    pinGroupContents: false,
    pinAnchorPoints: false,
  };
}

/**
 * Whether this board is one nobody has laid out: a machine wrote it and said so
 * (`needsLayout`), it has members to place, and none of them has a position of
 * its own yet. The writer's settling pass and the reader's shown one both ask
 * exactly this, so the two cannot disagree about which boards they are for.
 */
export function awaitsLayout(diagram: DesignDiagram): boolean {
  if (diagram.geometry?.needsLayout !== true) return false;
  // An empty diagram has nothing to lay out. `tidyLayer7` returns [] for it
  // without throwing, so this is politeness rather than safety.
  if (diagram.members.length === 0) return false;
  return !hasStoredPosition(diagram);
}

/**
 * Whether any member of this board already has a position of its own.
 *
 * A position for an element no longer on the board does not count: it is a
 * leftover, not an arrangement of what is there.
 */
export function hasStoredPosition(diagram: DesignDiagram): boolean {
  const nodes = diagram.geometry?.nodes ?? [];
  if (nodes.length === 0) return false;
  const members = new Set(diagram.members.map((member) => member.id));
  return nodes.some((node) => members.has(node.id));
}

export function useAutoLayout({
  diagram,
  readOnly,
  busy,
  options,
  run,
  onSettled,
}: UseAutoLayoutArgs): void {
  /**
   * Diagrams this editor session has already attempted.
   *
   * Written BEFORE the pass starts, which is what makes a failure terminal for
   * the session rather than a loop: the effect re-runs on the next render, sees
   * the id, and stops. A double render cannot double-run for the same reason.
   */
  const attemptedRef = useRef<Set<string>>(new Set());
  // Read inside the effect so a changed callback identity cannot re-trigger it.
  const latestRef = useRef({ options, run, onSettled, busy });
  latestRef.current = { options, run, onSettled, busy };

  useEffect(() => {
    if (!diagram || readOnly || busy !== undefined) return;
    if (!awaitsLayout(diagram)) return;
    if (attemptedRef.current.has(diagram.id)) return;

    attemptedRef.current.add(diagram.id);
    const { options: current, run: runTidy, onSettled: settled } = latestRef.current;
    void runTidy(settlingOptions(current)).then(
      () => settled?.(diagram.id),
      () => {
        // Swallowed here on purpose: `handleTidy` already reported it through the
        // editor's one message channel. Re-reporting would say it twice, and
        // `onSettled` must not fire — the flag stays set so the diagram gets one
        // more attempt the next time it is opened.
      },
    );
  }, [diagram, readOnly, busy]);
}
