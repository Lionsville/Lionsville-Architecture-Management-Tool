// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { RefObject } from 'react';
import type { DesignDiagram, ElementId } from '../model/types';
import type { PlatformTree } from '../model/deployment';
import type { ClipboardPayload } from '../model/clipboard';
import type { AttachSidesPatch } from '../model/routes';
import type { TidyOptions } from '../layout/tidy';
import type { ExistingAt } from './props';
import type { StandInNote } from './nodes/nodeData';
import type { ViewportMemory } from './canvas/viewportMemory';
import { ContainerCanvas } from './canvas/ContainerCanvas';
import { Layer7Canvas } from './canvas/Layer7Canvas';
import type { EditorState, Selection } from './useEditorState';

export interface CanvasForDiagramProps {
  diagram: DesignDiagram;
  state: EditorState;
  readOnly: boolean;
  /** Live auto-routing — drives the canvas's waypoint-free drag preview only. */
  autoRoute: boolean;
  snapToGrid: boolean;
  onToggleSnapToGrid(): void;
  showGrid: boolean;
  onToggleShowGrid(): void;
  showLifecycle: boolean;
  /** See `EditorOwnership.noteFor` (ADR-0012 §3). Absent = no scope tree. */
  noteFor?(elementId: ElementId): StandInNote | undefined;
  showMinimap: boolean;
  showEdgeLabels: boolean;
  /** See `DiagramCanvasProps.mountEveryElement`: true while a PNG is captured. */
  mountEveryElement: boolean;
  onElementDoubleClick(elementId: ElementId): void;
  onCreateContainer?(elementId: ElementId): void;
  viewports?: ViewportMemory;
  /** The way down from a landscape line (ADR-0013). */
  onLineDoubleClick(relationId: string): void;
  onOpenDocumentation(elementId: ElementId): void;
  /** Whether a container diagram draws the deployment boxes (ADR-0013). */
  showDeployment: boolean;
  /** The platform tree, where another scope answers for it (ADR-0013, ADR-0014). */
  platformTree?: PlatformTree;
  /** The wash each card takes under the landscape's overlay (ADR-0013). */
  overlayTints: ReadonlyMap<ElementId, string>;
  /** The cards the overlay fades rather than washes (ADR-0020). */
  overlayFaded: ReadonlySet<ElementId>;
  /** Layer 7 only — undefined in read-only mode. */
  onTidyGroup?(name: string): void;
  groupTidyOptions: TidyOptions;
  onGroupTidyOptionsChange?(options: TidyOptions): void;
  /** Context-menu plumbing (see DiagramCanvasProps); all undefined in read-only mode. */
  onTidy?(): void;
  onRouteConnections?(): void;
  onRouteConnectionsAll?(): void;
  onResetRoute?(connectionId: string): void;
  onSetRouteSides?(connectionId: string, sides: AttachSidesPatch): void;
  layoutBusy: boolean;
  clipboardRef: RefObject<ClipboardPayload | null>;
  pasteCountRef: RefObject<number>;
  onRequestRename(elementId: ElementId): void;
  onRequestDeleteElement(elementId: ElementId): void;
  onRequestDeleteConnection(connectionId: string): void;
  onRequestDeleteSelection(selection: Selection): void;
  menuRequest?: { kind: 'open' | 'rename'; nonce: number };
  /** See `DiagramCanvasProps.onAddExistingAt`: the host's register, at the click. */
  onAddExistingAt?: (at?: ExistingAt) => void;
}

/**
 * The board for a diagram's kind: a landscape's zones and groups, or a
 * container view with its deployment boxes. Everything else is the same
 * canvas, handed the same props.
 */
export function CanvasForDiagram(props: CanvasForDiagramProps) {
  const { diagram, state, onTidyGroup, groupTidyOptions, onGroupTidyOptionsChange, showDeployment, platformTree, ...rest } = props;
  const shared = {
    ...rest,
    model: state.model,
    diagram,
    selection: state.selection,
    onSelectionChange: state.setSelection,
    actions: state.actions,
  };
  return diagram.kind === 'layer7' ? (
    <Layer7Canvas
      {...shared}
      onTidyGroup={onTidyGroup}
      groupTidyOptions={groupTidyOptions}
      onGroupTidyOptionsChange={onGroupTidyOptionsChange}
    />
  ) : (
    <ContainerCanvas {...shared} showDeployment={showDeployment} platformTree={platformTree} />
  );
}
