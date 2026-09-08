import { useCallback, useMemo } from 'react';
import type { DesignDiagram, DesignModel, ElementKind } from '../../model/types';
import { useStrings } from '../../i18n/LanguageContext';
import { c4PanelFor } from '../export/c4Panel';
import type { ElementSeedPatch } from '../useEditorState';
import { C4InfoPanel } from './C4InfoPanel';
import { DiagramCanvas, type DiagramCanvasProps } from './DiagramCanvas';

type SharedProps = Omit<DiagramCanvasProps, 'resolveDrop' | 'onAddByDrop' | 'children'>;

/**
 * C4 container diagram: the application renders as the boundary (a real node,
 * built by graph.ts) and everything else is freely placeable — no zones.
 */
export function ContainerCanvas(
  props: SharedProps & { model: DesignModel; diagram: DesignDiagram },
) {
  const { actions, model, diagram } = props;
  const { t, language } = useStrings();
  // The corner says what this is the container diagram of. Recomputed when the
  // model changes, since the application can be renamed or described under it.
  const info = useMemo(() => c4PanelFor(model, diagram, t, language), [model, diagram, t, language]);
  const onAddByDrop = useCallback(
    (kind: ElementKind, position: { x: number; y: number }, style?: ElementSeedPatch) =>
      actions.addElement({ kind, position, ...style }),
    [actions],
  );

  // No `source` branch here: the vendor-logo grid is hidden on container
  // diagrams (D6), so a logo drop cannot reach this canvas.
  return (
    <DiagramCanvas {...props} onAddByDrop={onAddByDrop}>
      {info && <C4InfoPanel info={info} />}
    </DiagramCanvas>
  );
}
