// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ReactFlowProvider } from '@xyflow/react';
import { ActorNode } from './ActorNode';
import { InputChannelNode } from './InputChannelNode';
import { ManagementToolNode } from './ManagementToolNode';
import type { ElementKind } from '../../model/types';
import type { ElementNodeProps } from './nodeData';
import { testResizeLimits } from './nodeTestData';
import { installReactFlowMocks } from '../reactFlowTestSetup';

/**
 * Regression cover for the "descriptions never render" bug: actor, input
 * channel, and management-tool nodes carry a `description` in the model and
 * inspector but never drew it on the canvas (unlike application/component/
 * external-system nodes). These nodes are fixed-size, so the description is
 * shown only when present — the name-only look must be preserved otherwise.
 */

beforeAll(() => {
  installReactFlowMocks();
});
afterEach(() => cleanup());

function props(kind: ElementKind, description?: string): ElementNodeProps {
  return {
    id: 'e1',
    type: kind,
    selected: false,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    width: 160,
    height: 56,
    data: {
      element: {
        id: 'e1',
        kind,
        name: 'Example',
        description,
        vendor: kind === 'managementTool' ? 'ExampleCo' : undefined,
        lifecycle: 'live',
        isManaged: false,
        aspects: {},
        parameters: {},
      },
      placement: { elementId: 'e1', zone: 'landscape', x: 0, y: 0 },
      resizeLimits: testResizeLimits(kind),
      readOnly: false,
      aspectConfig: [],
    },
  } as unknown as ElementNodeProps;
}

function renderNode(node: React.ReactNode) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <ReactFlowProvider>
        <div style={{ width: '160px', height: '56px' }}>{node}</div>
      </ReactFlowProvider>
    </ThemeProvider>,
  );
}

const CASES = [
  { name: 'ActorNode', Node: ActorNode, kind: 'actor' as const },
  { name: 'InputChannelNode', Node: InputChannelNode, kind: 'inputChannel' as const },
  { name: 'ManagementToolNode', Node: ManagementToolNode, kind: 'managementTool' as const },
];

describe.each(CASES)('$name description rendering', ({ Node, kind }) => {
  it('renders the description when the element has one', () => {
    const { getByText } = renderNode(<Node {...props(kind, 'Handles the thing.')} />);
    expect(getByText('Handles the thing.')).toBeDefined();
  });

  it('renders name-only when there is no description', () => {
    const { getByText, queryByText } = renderNode(<Node {...props(kind, undefined)} />);
    expect(getByText('Example')).toBeDefined();
    expect(queryByText('Handles the thing.')).toBeNull();
  });
});

/**
 * A description that has grown into a page — a header table, sections, a
 * markdown table — is drawn as its short description and nothing else. The
 * markdown must not leak onto the canvas as text.
 */
const PAGE = [
  '| Short description | Handles the thing. |',
  '|---|---|',
  '| Owner | Ops |',
  '',
  '## Interfaces',
  '',
  '| With | Direction |',
  '|---|---|',
  '| Billing | out |',
  '',
  '- [x] decided',
].join('\n');

describe.each(CASES)('$name with a documented element', ({ Node, kind }) => {
  it('draws only the short description', () => {
    const { getByText, container } = renderNode(<Node {...props(kind, PAGE)} />);
    expect(getByText('Handles the thing.')).toBeDefined();
    expect(container.textContent).not.toContain('Interfaces');
    expect(container.textContent).not.toContain('|');
    expect(container.textContent).not.toContain('Owner');
  });
});
