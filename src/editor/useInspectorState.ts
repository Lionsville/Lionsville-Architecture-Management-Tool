// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** The *Uses* picker's ticks until it closes: a rule about when they are kept and when they are written, tested on its own. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ElementId } from '../model/types';
import type { EditorActions } from './useEditorState';
import { standInsFor, type InspectorTechnology } from './elementInspectorFacts';

/**
 * The picker's ticks, until it closes: then they are the list, as one step
 * (ADR-0020). Ticking several and closing writes once; a tick on something
 * this scope does not hold writes the stand-in in that step; closing with
 * the list unchanged writes nothing. The ticks follow the rows whenever the
 * element or its rows change underneath.
 *
 * "Until it closes" has three doors, and every one of them commits: the list
 * closing, the picker losing focus, and the picker going away with ticks still
 * pending. The last is the one that lost work: Escape reached the canvas,
 * which cleared the selection and unmounted the inspector before the list had
 * said it closed, and what was ticked went with it. The picker now keeps
 * Escape to itself (`data-shortcuts-ignore`), and the commit on the way out is
 * the rule for every other road to the same place.
 *
 * `commit` reads the ticks through a ref, not a closure: the three doors can
 * fire in one event, and a second call must see that the first already
 * wrote, not the ticks as they were when the event began.
 */
export function useUsesPicker(
  elementId: ElementId,
  usesIds: readonly ElementId[],
  heldIds: ReadonlySet<ElementId>,
  technology: InspectorTechnology,
  actions: Pick<EditorActions, 'setUses'>,
) {
  const [pending, setPending] = useState<readonly ElementId[]>(usesIds);
  const usesKey = `${elementId}|${usesIds.join(',')}`;
  const [seenUses, setSeenUses] = useState(usesKey);
  if (seenUses !== usesKey) {
    setSeenUses(usesKey);
    setPending(usesIds);
  }
  const live = useRef({ pending, usesIds, elementId, heldIds, technology, actions });
  live.current = { pending, usesIds, elementId, heldIds, technology, actions };
  const commit = useCallback(() => {
    const now = live.current;
    const ticked = now.pending;
    if (ticked.length === now.usesIds.length && ticked.every((id) => now.usesIds.includes(id))) return;
    // Written down before the write, so a second door in the same event finds
    // nothing left to commit.
    live.current = { ...now, pending: now.usesIds };
    const standIns = standInsFor(ticked, now.heldIds, now.technology?.standInFor);
    if (standIns.length > 0) now.actions.setUses(now.elementId, ticked, standIns);
    else now.actions.setUses(now.elementId, ticked);
    setPending(now.usesIds);
  }, []);
  // The way out: whatever is still ticked when the picker goes is written.
  useEffect(() => () => commit(), [commit]);
  return { pending, setPending, commit };
}
