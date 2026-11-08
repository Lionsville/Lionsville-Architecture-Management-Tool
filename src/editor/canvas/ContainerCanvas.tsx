// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useCallback, useMemo } from 'react';
import type { DesignDiagram, DesignModel, ElementKind } from '../../model/types';
import type { PlatformTree } from '../../model/deployment';
import type { ElementSeedPatch } from '../useEditorState';
import { ContainerBoardContext } from './containerBoard';
import { CategoryBands } from './CategoryBands';
import { ContainerKey } from './ContainerKey';
import { DeploymentLayer } from './DeploymentLayer';
import { LabelSpread } from './LabelSpread';
import { LinesCrossing } from './LinesCrossing';
import { DiagramCanvas, type DiagramCanvasProps } from './DiagramCanvas';

type SharedProps = Omit<DiagramCanvasProps, 'resolveDrop' | 'onAddByDrop' | 'children'>;

/**
 * C4 container diagram: the application renders as the boundary (a real node,
 * built by graph.ts) and everything else is freely placeable — no zones.
 */
export function ContainerCanvas(
  props: SharedProps & {
    model: DesignModel;
    diagram: DesignDiagram;
    showDeployment?: boolean;
    /** Route these lines again, whoever drew them, and leave the rest. */
    onRouteLines?: (lines: readonly string[]) => void;
    platformTree?: PlatformTree;
  },
) {
  const { actions, model, diagram, onAskAdd } = props;
  const onAddByDrop = useCallback(
    (kind: ElementKind, position: { x: number; y: number }, style?: ElementSeedPatch) =>
      actions.addElement({ kind, position, ...style }),
    [actions],
  );

  // No `source` branch here: the vendor-logo grid is hidden on container
  // diagrams (D6), so a logo drop cannot reach this canvas.
  const board = useMemo(() => ({
    ...(onAskAdd ? {
      onAddContainer: () => {
        const box = document.querySelector('[data-testid="empty-boundary"]')?.getBoundingClientRect();
        onAskAdd({ kind: 'component', screen: box ? { x: box.left + box.width / 2 - 160, y: box.bottom } : { x: window.innerWidth / 2, y: window.innerHeight / 3 } });
      },
    } : {}),
  }), [onAskAdd]);
  return (
    <ContainerBoardContext.Provider value={board}>
    <DiagramCanvas {...props} onAddByDrop={onAddByDrop}>
      <LabelSpread alongLine />
      <CategoryBands />
      {!props.readOnly && props.onRouteLines && (
        <LinesCrossing onRoute={props.onRouteLines} onMoveClear={(moves) => actions.movePlacements([...moves])} boundary={diagram.applicationElementId} />
      )}
      {props.showKey !== false && (
        <ContainerKey model={model} diagram={diagram} day={diagram.asOf} showDeployment={props.showDeployment === true} showStatus={props.showStatus === true} />
      )}
      {/* Where the containers run, around them (ADR-0013). Derived and
          measured off the live nodes, so it follows a card as it is dragged
          and there is no geometry to keep in step. */}
      {props.showDeployment && (
        <DeploymentLayer model={model} diagram={diagram} platformTree={props.platformTree} />
      )}
    </DiagramCanvas>
    </ContainerBoardContext.Provider>
  );
}
