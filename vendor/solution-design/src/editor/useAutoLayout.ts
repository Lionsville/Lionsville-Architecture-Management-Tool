import { useEffect, useRef } from 'react';
import type { DesignDiagram } from '../types';
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
 * carries the promise in a code comment on the server's seed ("the editor's
 * auto-layout takes over from there"), and an imported diagram carries a seed
 * grid because the import document deliberately holds no coordinates.
 */
export interface UseAutoLayoutArgs {
  /** The diagram on screen, or undefined while the host is still resolving it. */
  diagram: DesignDiagram | undefined;
  readOnly: boolean;
  /** Whichever layout action is already running, from the editor's own flag. */
  busy: LayoutAction | undefined;
  /**
   * Diagrams THIS SESSION created the geometry for — the host names them.
   *
   * The session half of the signal. It needs no migration and covers the case
   * that ships first: the user double-clicked an application, the server seeded a
   * grid, and the new tab is about to open on it.
   */
  requested: readonly string[] | undefined;
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
 * Whether this diagram is carrying layout debt, from either source.
 *
 * Both resolve to the same boolean and the effect does not care which fired — a
 * diagram can legitimately be in both (created in this session AND flagged
 * server-side), and the session ref makes that harmless.
 */
function needsLayout(diagram: DesignDiagram, requested: readonly string[] | undefined): boolean {
  return diagram.needsLayout === true || (requested?.includes(diagram.id) ?? false);
}

export function useAutoLayout({
  diagram,
  readOnly,
  busy,
  requested,
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
    if (!needsLayout(diagram, requested)) return;
    // An empty diagram has nothing to lay out. `tidyLayer7` returns [] for it
    // without throwing, so this is politeness rather than safety.
    if (diagram.placements.length === 0) return;
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
  }, [diagram, readOnly, busy, requested]);
}
