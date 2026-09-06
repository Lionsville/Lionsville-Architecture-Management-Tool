import { useCallback } from 'react';
import type { DesignDiagram, DesignModel, ElementKind } from '../../model/types';
import type { ElementSeedPatch } from '../useEditorState';
import { DiagramCanvas, type DiagramCanvasProps } from './DiagramCanvas';

type SharedProps = Omit<DiagramCanvasProps, 'resolveDrop' | 'onAddByDrop' | 'children'>;

/**
 * C4 container diagram: the application renders as the boundary (a real node,
 * built by graph.ts) and everything else is freely placeable — no zones.
 */
export function ContainerCanvas(
  props: SharedProps & { model: DesignModel; diagram: DesignDiagram },
) {
  const { actions } = props;
  const onAddByDrop = useCallback(
    (kind: ElementKind, position: { x: number; y: number }, style?: ElementSeedPatch) =>
      actions.addElement({ kind, position, ...style }),
    [actions],
  );

  // No `source` branch here: the vendor-logo grid is hidden on container
  // diagrams (D6), so a logo drop cannot reach this canvas.
  return <DiagramCanvas {...props} onAddByDrop={onAddByDrop} />;
}
