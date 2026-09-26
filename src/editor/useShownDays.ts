// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The day a person is looking at a board on, where it is not the day the
 * board is saved as (ADR-0027).
 *
 * A board's `asOf` is the model's: it says which day the board is FOR, and
 * everybody who opens the board sees that day. Moving the date control or
 * the roadmap's scrubber is somebody looking around, and that is theirs —
 * held here, per board, for as long as the window is open, and never a
 * command. Saving the day onto the board is a separate, deliberate step.
 *
 * An entry with no `day` is today. No entry is the board's own day. A look
 * that lands on the board's own day forgets itself, so "am I looking away?"
 * is one comparison and never a stale entry.
 */
import { useCallback, useMemo, useState } from 'react';

/** One board's look: `day` absent = today. */
export type ShownDay = { day?: string };

export type ShownDays = {
  /** Per diagram id, where somebody is looking away from the board's own day. */
  days: Readonly<Record<string, ShownDay>>;
  /** Look at a board on `day`; `undefined` is today. */
  show(diagramId: string, day: string | undefined): void;
  /** Back to the day the board is saved as. */
  forget(diagramId: string): void;
};

/** The day a board is drawn on: the look where there is one, else its own. */
export function shownAsOf(
  diagram: { id: string; asOf?: string },
  days: Readonly<Record<string, ShownDay>> | undefined,
): string | undefined {
  const look = days?.[diagram.id];
  return look ? look.day : diagram.asOf;
}

/**
 * `savedOf` answers a board's own day now, so a look that arrives at it is
 * dropped rather than kept as a look that changes nothing.
 */
export function useShownDays(savedOf: (diagramId: string) => string | undefined): ShownDays {
  const [days, setDays] = useState<Record<string, ShownDay>>({});

  const forget = useCallback((diagramId: string) => {
    setDays((held) => {
      if (!(diagramId in held)) return held;
      const { [diagramId]: _gone, ...rest } = held;
      return rest;
    });
  }, []);

  const show = useCallback((diagramId: string, day: string | undefined) => {
    if (day === savedOf(diagramId)) {
      forget(diagramId);
      return;
    }
    setDays((held) => (
      diagramId in held && held[diagramId]?.day === day
        ? held
        : { ...held, [diagramId]: day === undefined ? {} : { day } }
    ));
  }, [savedOf, forget]);

  return useMemo(() => ({ days, show, forget }), [days, show, forget]);
}
