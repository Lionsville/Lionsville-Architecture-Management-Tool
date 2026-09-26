// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the active board SHOWS, as distinct from what it stores: the day it
 * is looked at (ADR-0027), whether a container view draws its deployment
 * boxes, and what a landscape is coloured by (ADR-0013, ADR-0020). A reader
 * may change each of these on a view they may not write, so each is held
 * here per diagram and wins over the stored answer; the write that keeps it
 * is the session's to refuse.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Theme } from '@mui/material/styles';
import type { DesignDiagram, DesignModel, ElementId } from '../model/types';
import type { PlatformTree } from '../model/deployment';
import { overlayBands, type ColourBy } from '../model/overlay';
import { today } from '../model/lifecycle';
import { overlayTint } from './theme/overlayColors';
import { shownAsOf, useShownDays, type ShownDays } from './useShownDays';
import type { EditorActions } from './useEditorState';

/** Whether a board draws its deployment boxes: the reader's flip, else the stored answer, else yes. */
export function shownDeployment(diagram: DesignDiagram | undefined, held: Readonly<Record<string, boolean>>): boolean {
  if (diagram === undefined) return true;
  return held[diagram.id] ?? diagram.showDeployment ?? true;
}

/** What a landscape is coloured by: the reader's choice — `none` included — else the stored one. */
export function shownColourBy(
  diagram: DesignDiagram | undefined,
  held: Readonly<Record<string, ColourBy | 'none'>>,
): ColourBy | undefined {
  const chosen = diagram === undefined ? undefined : held[diagram.id];
  return chosen === 'none' ? undefined : chosen ?? diagram?.colourBy;
}

export function useBoardView(args: {
  model: DesignModel;
  diagram: DesignDiagram | undefined;
  /** The host's day, when it has one, so its scrubber and this bar move one thing. */
  viewing: ShownDays | undefined;
  platformTree: PlatformTree | undefined;
  theme: Theme;
  actions: Pick<EditorActions, 'setShowDeployment' | 'setColourBy'>;
}) {
  const { diagram, actions } = args;
  const shown = useShownDiagram(args.model, diagram, args.viewing);
  const [deploymentShown, setDeploymentShown] = useState<Record<string, boolean>>({});
  const showDeployment = shownDeployment(diagram, deploymentShown);
  const [colourShown, setColourShown] = useState<Record<string, ColourBy | 'none'>>({});
  const colourBy = shownColourBy(diagram, colourShown);
  const overlay = useOverlay(args.model, shown.shownDiagram, colourBy, args.platformTree, args.theme);

  const toggleDeployment = () => {
    if (!diagram) return;
    const next = !showDeployment;
    setDeploymentShown((held) => ({ ...held, [diagram.id]: next }));
    actions.setShowDeployment(next);
  };
  const chooseColourBy = (by: ColourBy | undefined) => {
    if (!diagram) return;
    setColourShown((kept) => ({ ...kept, [diagram.id]: by ?? 'none' }));
    actions.setColourBy(by);
  };
  return { ...shown, showDeployment, toggleDeployment, colourBy, chooseColourBy, ...overlay };
}

export type BoardView = ReturnType<typeof useBoardView>;

/**
 * The day a person is looking at, which is not a write (ADR-0027). The
 * host's when it has one; the editor's own otherwise. `shownDiagram` is the
 * board with that day on it, and is what anything that DRAWS is handed — a
 * write is always built from the model's diagram, so the look cannot leak
 * into one.
 */
function useShownDiagram(model: DesignModel, diagram: DesignDiagram | undefined, hostViewing: ShownDays | undefined) {
  const modelRef = useRef(model);
  modelRef.current = model;
  const ownDays = useShownDays(
    useCallback((id: string) => modelRef.current.diagrams.find((d) => d.id === id)?.asOf, []),
  );
  const viewing = hostViewing ?? ownDays;
  const lookingAt = diagram ? shownAsOf(diagram, viewing.days) : undefined;
  const shownDiagram = useMemo(() => {
    if (!diagram || lookingAt === diagram.asOf) return diagram;
    return { ...diagram, asOf: lookingAt };
  }, [diagram, lookingAt]);
  return { viewing, lookingAt, shownDiagram };
}

/**
 * The landscape coloured by what its applications stand on (ADR-0013): the
 * bands, the wash each card takes, the cards faded rather than washed, and
 * what the one-thing overlay may ask about (ADR-0020) — this scope's
 * platforms and offerings, a shared one with a stand-in here among them.
 */
function useOverlay(
  model: DesignModel,
  shownDiagram: DesignDiagram | undefined,
  colourBy: ColourBy | undefined,
  platformTree: PlatformTree | undefined,
  theme: Theme,
) {
  const overlay = useMemo(
    () => (shownDiagram ? overlayBands(model, shownDiagram, colourBy, shownDiagram.asOf ?? today(), platformTree) : []),
    [model, shownDiagram, colourBy, platformTree],
  );
  const overlayTints = useMemo(() => {
    const tints = new Map<ElementId, string>();
    for (const band of overlay) {
      if (band.faded) continue;
      const colour = overlayTint(theme, band);
      for (const id of band.memberIds) tints.set(id, colour);
    }
    return tints;
  }, [overlay, theme]);
  const overlayFaded = useMemo(
    () => new Set<ElementId>(overlay.filter((band) => band.faded).flatMap((band) => band.memberIds)),
    [overlay],
  );
  const overlayCandidates = useMemo(
    () => model.elements
      .filter((element) => element.kind === 'platform' || element.kind === 'platformService')
      .map((element) => ({ id: element.id, name: element.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [model.elements],
  );
  return { overlay, overlayTints, overlayFaded, overlayCandidates };
}
