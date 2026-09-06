import { useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { DesignModel } from '../model/types';
import type { SolutionDesignEditorProps } from './props';
import { selectElement, type Selection } from './useEditorState';

/**
 * Handles the `focusElement` prop (host click-to-focus, e.g. the coverage
 * drawer). A request is identified by its nonce and handled exactly once:
 *
 * - element placed on the active diagram → select it (inspector opens) and
 *   pan/zoom the canvas to it;
 * - placed only on another diagram → ask the host to switch (once per nonce);
 *   the effect re-runs when `activeDiagramId` changes and then completes the
 *   focus, consuming the nonce;
 * - placed nowhere → consume the nonce without doing anything.
 */
export function useFocusElement(args: {
  focusElement: SolutionDesignEditorProps['focusElement'];
  /** Effective model (host model + local overlay). */
  model: DesignModel;
  activeDiagramId: string;
  setSelection(selection: Selection): void;
  onActiveDiagramChange(diagramId: string): void;
}): void {
  const { focusElement, model, activeDiagramId, setSelection, onActiveDiagramChange } = args;
  const { fitView } = useReactFlow();
  const handledNonceRef = useRef<number | undefined>(undefined);
  const switchRequestedNonceRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!focusElement || handledNonceRef.current === focusElement.nonce) return;

    const isPlacedOn = (diagramId: string) =>
      model.diagrams
        .find((d) => d.id === diagramId)
        ?.placements.some((p) => p.elementId === focusElement.id) ?? false;

    if (isPlacedOn(activeDiagramId)) {
      handledNonceRef.current = focusElement.nonce;
      setSelection(selectElement(focusElement.id));
      // Pan/zoom on the next frame so React Flow has the (possibly just
      // switched) diagram's nodes in its store before fitting.
      const frame = requestAnimationFrame(() => {
        void fitView({
          nodes: [{ id: focusElement.id }],
          padding: 0.4,
          maxZoom: 1.2,
          duration: 300,
        });
      });
      return () => cancelAnimationFrame(frame);
    }

    const target = model.diagrams.find((d) =>
      d.placements.some((p) => p.elementId === focusElement.id),
    );
    if (!target) {
      handledNonceRef.current = focusElement.nonce;
      return;
    }
    if (switchRequestedNonceRef.current !== focusElement.nonce) {
      switchRequestedNonceRef.current = focusElement.nonce;
      onActiveDiagramChange(target.id);
      // Nonce stays unconsumed: the host switching activeDiagramId re-runs
      // this effect and the placed-on-active branch finishes the job.
    }
  }, [focusElement, model, activeDiagramId, setSelection, onActiveDiagramChange, fitView]);
}
