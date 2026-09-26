// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The element inspector's own state: which tab is up, where a rename puts the
 * caret, and the *Uses* picker's ticks until it closes. Each is a rule about
 * when state is kept and when it is let go, and each is tested on its own.
 */
import { useEffect, useRef, useState } from 'react';
import type { ElementId } from '../model/types';
import type { EditorActions } from './useEditorState';
import { standInsFor, type InspectorTechnology } from './elementInspectorFacts';

/**
 * The tab, reset to the first whenever the selected element changes (the
 * tabbed equivalent of the old `key={element.id}` section-default remount).
 */
export function useTabPerElement(elementId: ElementId): [number, (tab: number) => void] {
  const [activeTab, setActiveTab] = useState(0);
  const [seenId, setSeenId] = useState(elementId);
  if (seenId !== elementId) {
    setSeenId(elementId);
    setActiveTab(0);
  }
  return [activeTab, setActiveTab];
}

/**
 * "Rename" (node menu, F2): focus the Name field and select its text. A request
 * for another element is ignored, each nonce is handled once so a re-render
 * never steals focus back, and a read-only panel takes the request without
 * acting on it.
 */
export function useRenameFocus(
  renameRequest: { id: string; nonce: number } | undefined,
  elementId: ElementId,
  readOnly: boolean,
) {
  const nameRef = useRef<HTMLInputElement>(null);
  const handledNonce = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!renameRequest || renameRequest.id !== elementId) return;
    if (handledNonce.current === renameRequest.nonce) return;
    handledNonce.current = renameRequest.nonce;
    if (readOnly) return;
    nameRef.current?.focus();
    nameRef.current?.select();
  }, [renameRequest, elementId, readOnly]);
  return nameRef;
}

/**
 * The picker's ticks, until it closes: then they are the list, as one step
 * (ADR-0020). Ticking several and closing writes once; a tick on something
 * this scope does not hold writes the stand-in in that step; closing with
 * the list unchanged writes nothing. The ticks follow the rows whenever the
 * element or its rows change underneath.
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
  const commit = () => {
    if (pending.length === usesIds.length && pending.every((id) => usesIds.includes(id))) return;
    const standIns = standInsFor(pending, heldIds, technology?.standInFor);
    if (standIns.length > 0) actions.setUses(elementId, pending, standIns);
    else actions.setUses(elementId, pending);
    setPending(usesIds);
  };
  return { pending, setPending, commit };
}
