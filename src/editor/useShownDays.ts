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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
 * Whether a person is looking at a board on a day that is not the one it is
 * saved as (ADR-0027, amended 7 November 2026): what locks the board. A look
 * that reached the board's own day forgot itself, so this is one question and a
 * view saved on its day stays editable on it.
 */
export function isLookingAway(
  diagram: { id: string } | undefined,
  days: Readonly<Record<string, ShownDay>> | undefined,
): boolean {
  return diagram !== undefined && days?.[diagram.id] !== undefined
}

/**
 * The day the organisation and the landscape are looked at, as a day: the
 * board's look, its own day, or `today` where neither says one — or where
 * there is no board. What every panel beside a board reads its day from
 * (ADR-0027, ADR-0036 §6): a unit's section, the organisation chart, the
 * checks a unit shows — one source, so they cannot disagree with the canvas.
 */
export function dayShown(
  diagram: { id: string; asOf?: string } | undefined,
  days: Readonly<Record<string, ShownDay>> | undefined,
  today: string,
): string {
  return (diagram ? shownAsOf(diagram, days) : undefined) ?? today;
}

/**
 * Going into an application's containers from a board, the day goes along and Back
 * returns there (ADR-0027, amended): a container diagram opened from a board on
 * 1 Sep 2027 is that landscape's, not today's, and the board a person came from is
 * the one to go back to, not the first one that places it. The same sideways, from
 * one application's diagram to a neighbour's. Coming back up changes nothing: the
 * look stayed with the board. Answers where this diagram was opened from.
 *
 * Only a move asked from the board does that (`wentFrom`, which {@link useBoardDoors}
 * fills). Reaching a container diagram any other way — its scope's home, an address,
 * an agent — opens it on its own day: a saved view's day is that view's alone, and
 * did follow to whatever was opened next. A day carried there earlier goes with it,
 * while a look the person took on the diagram itself stays theirs.
 */
export function useCarriedDay(
  active: { id: string; kind: string; asOf?: string } | undefined,
  viewing: ShownDays,
  wentFrom: { current: string | undefined },
): string | undefined {
  const last = useRef(active);
  const [cameFrom, setCameFrom] = useState<Readonly<Record<string, string>>>({});
  const carried = useRef(new Map<string, string | undefined>());
  useEffect(() => {
    const was = last.current;
    last.current = active;
    if (!was || !active || was.id === active.id) return;
    const asked = wentFrom.current === was.id;
    wentFrom.current = undefined;
    if (active.kind !== 'container') return;
    if (!asked || (was.kind !== 'layer7' && was.kind !== 'container')) {
      leaveCarried(active.id, viewing, carried.current);
      setCameFrom((held) => (active.id in held ? withoutKey(held, active.id) : held));
      return;
    }
    if (cameFrom[was.id] === active.id) return;
    setCameFrom((held) => ({ ...held, [active.id]: was.id }));
    const day = shownAsOf(was, viewing.days);
    carried.current.set(active.id, day);
    if (day) viewing.show(active.id, day);
    else viewing.forget(active.id);
  }, [active, viewing, cameFrom, wentFrom]);
  return active ? cameFrom[active.id] : undefined;
}

/** A day carried onto a diagram goes when it is reached another way; one the person chose there since is not this one's to take. */
function leaveCarried(id: string, viewing: ShownDays, carried: Map<string, string | undefined>): void {
  if (!carried.has(id)) return;
  const day = carried.get(id);
  carried.delete(id);
  const look = viewing.days[id];
  if (look !== undefined && look.day === day) viewing.forget(id);
}

function withoutKey(held: Readonly<Record<string, string>>, key: string): Readonly<Record<string, string>> {
  const { [key]: _gone, ...rest } = held;
  return rest;
}

/**
 * The board's own doors to another view: everything the editor opens from the board
 * goes through these, and says which board it left (`from`), so the day may go along
 * ({@link useCarriedDay}). What a host opens by itself does not pass here.
 */
export function useBoardDoors<P extends {
  document: { activeDiagramId: string | undefined; onActiveDiagramChange(id: string): void };
  diagrams: { onCreateContainer(applicationElementId: string): void };
}>(props: P): { props: P; from: { current: string | undefined } } {
  const from = useRef<string | undefined>(undefined);
  const { document, diagrams } = props;
  const doors = useMemo(() => ({
    document: { ...document, onActiveDiagramChange: (id: string) => { from.current = document.activeDiagramId; document.onActiveDiagramChange(id); } },
    diagrams: { ...diagrams, onCreateContainer: (applicationElementId: string) => { from.current = document.activeDiagramId; diagrams.onCreateContainer(applicationElementId); } },
  }), [document, diagrams]);
  return { props: useMemo(() => ({ ...props, ...doors }), [props, doors]), from };
}

/**
 * Back returns what was selected, as the zoom already is, per view: what a person
 * selected to go down is what they find when they come back up.
 */
export function useSelectionPerLevel<S>(activeId: string | undefined, cameFrom: string | undefined, selection: S, setSelection: (held: S) => void, startAfresh: S | undefined): void {
  const held = useRef(new Map<string, S>());
  const last = useRef({ id: activeId, selection, cameFrom });
  useEffect(() => {
    const was = last.current;
    if (was.id !== activeId) {
      if (was.id !== undefined) held.current.set(was.id, was.selection);
      // Up from where it was opened from, and only then. Going down starts afresh: what
      // was selected there is now the whole diagram.
      const kept = activeId !== undefined && was.cameFrom === activeId ? held.current.get(activeId) : undefined;
      const next = kept ?? startAfresh;
      if (next !== undefined) { setSelection(next); last.current = { id: activeId, selection: next, cameFrom }; return; }
    }
    last.current = { id: activeId, selection, cameFrom };
  }, [activeId, selection, cameFrom, setSelection, startAfresh]);
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
