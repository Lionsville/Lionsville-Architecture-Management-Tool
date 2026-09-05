// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ReactFlowProvider } from '@xyflow/react';
import { ActorNode } from './ActorNode';
import { InputChannelNode } from './InputChannelNode';
import { ExternalSystemNode } from './ExternalSystemNode';
import { ManagementToolNode } from './ManagementToolNode';
import type { ElementKind } from '../types';
import type { ElementNodeProps } from './nodeData';
import { installReactFlowMocks } from '../editor/reactFlowTestSetup';
import { NodeResizeContext } from '../canvas/NodeResizeContext';
import { NODE_SIZES, nodeMaxSize, nodeMinSize } from '../model/placement';
import { HOME_ZONE } from '../model/zones';
import type { DesignElement, Layer7Zone } from '../types';

/**
 * Since 2026-08 every band node is resizable when selected — not just the
 * application/component cards. The four kinds mount a NodeResizer whose
 * controls (`react-flow__resize-control`) appear for a selected editable node
 * and never in read-only mode.
 */

beforeAll(() => {
  installReactFlowMocks();
});
afterEach(() => cleanup());

function props(
  kind: ElementKind,
  options: {
    selected: boolean;
    readOnly: boolean;
    zone?: Layer7Zone;
    element?: Partial<DesignElement>;
  },
): ElementNodeProps {
  const zone = options.zone ?? HOME_ZONE[kind];
  const canonical = NODE_SIZES[kind];
  return {
    id: 'e1',
    type: kind,
    selected: options.selected,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    width: canonical.width,
    height: canonical.height,
    data: {
      element: {
        id: 'e1',
        kind,
        name: 'Example',
        lifecycle: 'live',
        isManaged: false,
        aspects: {},
        parameters: {},
        ...options.element,
      },
      placement: { elementId: 'e1', zone, x: 0, y: 0 },
      readOnly: options.readOnly,
      aspectConfig: [],
      showLifecycle: true,
      resizeLimits: { min: nodeMinSize(kind), max: nodeMaxSize(kind, zone) },
    },
  } as unknown as ElementNodeProps;
}

function renderNode(node: React.ReactNode, singleSelection = true) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <ReactFlowProvider>
        <NodeResizeContext.Provider value={{ commitResize: () => {}, singleSelection }}>
          <div style={{ width: '160px', height: '56px' }}>{node}</div>
        </NodeResizeContext.Provider>
      </ReactFlowProvider>
    </ThemeProvider>,
  );
}

const controls = (container: HTMLElement) =>
  container.querySelectorAll('.react-flow__resize-control').length;

const CASES = [
  { name: 'ActorNode', Node: ActorNode, kind: 'actor' as const },
  // The stickman render is a separate early return with its own resizer.
  {
    name: 'ActorNode (figure)',
    Node: ActorNode,
    kind: 'actor' as const,
    element: { shapeVariant: 'figure' as const },
  },
  { name: 'InputChannelNode', Node: InputChannelNode, kind: 'inputChannel' as const },
  { name: 'ExternalSystemNode', Node: ExternalSystemNode, kind: 'externalSystem' as const },
  { name: 'ManagementToolNode', Node: ManagementToolNode, kind: 'managementTool' as const },
];

describe.each(CASES)('$name resize affordance', ({ Node, kind, element }) => {
  it('shows resize controls when selected and editable', () => {
    const { container } = renderNode(
      <Node {...props(kind, { selected: true, readOnly: false, element })} />,
    );
    expect(controls(container)).toBeGreaterThan(0);
  });

  it('mounts no resizer in read-only mode', () => {
    const { container } = renderNode(
      <Node {...props(kind, { selected: true, readOnly: true, element })} />,
    );
    expect(controls(container)).toBe(0);
  });

  // A resizer per node in a multi-selection churns dimensions inside React
  // Flow's <NodesSelection> and loops the store, which is why the gate exists.
  it('mounts no resizer while more than one item is selected', () => {
    const { container } = renderNode(
      <Node {...props(kind, { selected: true, readOnly: false, element })} />,
      false,
    );
    expect(controls(container)).toBe(0);
  });
});
