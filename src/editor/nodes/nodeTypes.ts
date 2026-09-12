import type { NodeTypes } from '@xyflow/react';
import { ActorNode } from './ActorNode';
import { ApplicationBoundaryNode } from './ApplicationBoundaryNode';
import { ApplicationCardNode } from './ApplicationCardNode';
import { ComponentNode } from './ComponentNode';
import { ExternalSystemNode } from './ExternalSystemNode';
import { InputChannelNode } from './InputChannelNode';
import { ManagementToolNode } from './ManagementToolNode';

/**
 * React Flow node type registry, keyed by {@link ../../model/kinds.NodeFigure} —
 * what a box is DRAWN as, which stopped being its kind at ADR-0012 §4 — plus
 * 'applicationBoundary' for the application-as-boundary on container diagrams.
 */
export const nodeTypes: NodeTypes = {
  actor: ActorNode,
  application: ApplicationCardNode,
  externalSystem: ExternalSystemNode,
  inputChannel: InputChannelNode,
  managementTool: ManagementToolNode,
  component: ComponentNode,
  applicationBoundary: ApplicationBoundaryNode,
};
