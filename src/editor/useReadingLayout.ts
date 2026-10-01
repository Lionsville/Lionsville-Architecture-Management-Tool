// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a reader is shown of a board nobody has laid out yet.
 *
 * A board a machine wrote — a new container view, an import, an example
 * shipped without coordinates, a view made by a client that cannot lay
 * anything out — carries `needsLayout` and no positions, and every member of
 * it answers (0, 0) until a settling pass lands (`useAutoLayout`). That pass
 * is a step, made by whoever opens the board first, and a reader makes no
 * steps. So until somebody who may write the board had opened it, a reader
 * saw every card on one point, and "fit the board" could only zoom in on the
 * pile.
 *
 * Here a reader is shown the same pass instead: run with the same options
 * (`settlingOptions`), its result said as the same commands the writer's step
 * would carry (`tidyCommands`) and put on a copy of the board by the same
 * reducer — and then held on the screen. Nothing is dispatched, nothing is
 * saved, and nobody is told the board settled, so the flag stays for the
 * first person who may write it.
 *
 * What is shown belongs to the stored board it was worked out from. When the
 * stored board changes — above all when somebody's settling step arrives with
 * real positions — the stored board wins at once, and one that still has
 * none is worked out again. Passes for one board are not lined up, so the
 * one that ends last is not always the newest: a pass never displaces what a
 * pass started after it has put on the screen.
 */
import { useEffect, useRef, useState } from 'react';
import { transaction } from '../model/commands';
import { fromArrays, fromDiagram } from '../model/normalised';
import { apply } from '../model/reducer';
import type { DesignDiagram, DesignModel } from '../model/types';
import type { TidyOptions, TidyResult } from '../layout/tidy';
import { awaitsLayout, settlingOptions } from './useAutoLayout';
import { tidyCommands } from './useEditorState';

/**
 * The board with a pass's result on it, as the step that result lands as
 * would leave it — worked out over a copy of the model and kept nowhere.
 * The board as stored when the result changes nothing or is refused.
 */
export function laidOutForReading(model: DesignModel, diagram: DesignDiagram, result: TidyResult): DesignDiagram {
  const commands = tidyCommands(diagram, result);
  if (commands.length === 0) return diagram;
  const outcome = apply(fromArrays(model), transaction(commands));
  const next = outcome.ok ? outcome.model.diagrams[diagram.id] : undefined;
  return next ? fromDiagram(next) : diagram;
}

export interface UseReadingLayoutArgs {
  /** The board as stored, or undefined while the host is still resolving it. */
  diagram: DesignDiagram | undefined;
  readOnly: boolean;
  /** The session's Tidy settings; {@link settlingOptions} strips the pins, as for the writer's pass. */
  options: TidyOptions;
  /**
   * Run the pass over this board and answer with the board to show
   * ({@link laidOutForReading}). Rejects when the pass produced nothing, which
   * it has reported itself: the stored board is then drawn as it is.
   */
  lay(diagram: DesignDiagram, options: TidyOptions): Promise<DesignDiagram>;
  /** Once a laid-out board is on screen, if it is still the open one: the canvas framed the pile. */
  onShown?(): void;
}

interface Held {
  from: DesignDiagram;
  shown: DesignDiagram;
  /** When its pass started, in this editor's count: the later start wins. */
  started: number;
}

const NOTHING_HELD: ReadonlyMap<string, Held> = new Map();

/**
 * The board to draw: for a reader, a board nobody has laid out with the pass
 * on it once it has run; otherwise, and meanwhile, the board as stored.
 */
export function useReadingLayout({ diagram, readOnly, options, lay, onShown }: UseReadingLayoutArgs): DesignDiagram | undefined {
  const [held, setHeld] = useState(NOTHING_HELD);
  /**
   * The stored boards a pass has been started for, by object. Written before
   * the pass starts, so a failure is not retried in a loop and a double render
   * cannot double-run; a board that changes is a new object, and gets one pass.
   */
  const attemptedRef = useRef(new WeakSet<DesignDiagram>());
  /** How many passes this editor has started, so each knows its place among them. */
  const startsRef = useRef(0);
  // Read inside the effect so a changed callback identity cannot re-trigger it.
  const latestRef = useRef({ options, lay, onShown, diagram });
  latestRef.current = { options, lay, onShown, diagram };

  useEffect(() => {
    if (!readOnly || !diagram || !awaitsLayout(diagram)) return;
    if (attemptedRef.current.has(diagram)) return;
    attemptedRef.current.add(diagram);
    const started = ++startsRef.current;
    const { options: current, lay: run } = latestRef.current;
    void run(diagram, settlingOptions(current)).then(
      (shown) => {
        // A board that changed while this pass ran has had a pass of its own,
        // and when that one has ended first, what it shows is the newer.
        setHeld((was) => ((was.get(diagram.id)?.started ?? 0) > started
          ? was
          : new Map(was).set(diagram.id, { from: diagram, shown, started })));
        if (latestRef.current.diagram === diagram) latestRef.current.onShown?.();
      },
      () => {
        // Reported by `lay` through the editor's one message channel; the
        // board is drawn as stored, and this one is not tried again.
      },
    );
  }, [diagram, readOnly]);

  if (!diagram || !readOnly) return diagram;
  const kept = held.get(diagram.id);
  return kept?.from === diagram ? kept.shown : diagram;
}
