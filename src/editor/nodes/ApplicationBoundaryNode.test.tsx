// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ReactFlowProvider } from '@xyflow/react';
import { ApplicationBoundaryNode } from './ApplicationBoundaryNode';
import type { ElementNodeProps } from './nodeData';
import { testResizeLimits } from './nodeTestData';
import { installReactFlowMocks } from '../reactFlowTestSetup';

/**
 * Characterization test for the container-view click-through bug: the
 * boundary's interior fill must stay non-interactive (pointerEvents: none)
 * so it never intercepts clicks meant for child component nodes, while the
 * title bar stays interactive so the boundary remains selectable. This only
 * covers the CSS declaration — real hit-testing / z-order under
 * elevateNodesOnSelect needs a live browser (Playwright), which jsdom can't
 * exercise.
 */

beforeAll(() => {
  installReactFlowMocks();
});
afterEach(() => cleanup());

function baseProps(overrides: Partial<ElementNodeProps> = {}): ElementNodeProps {
  return {
    id: 'a1',
    type: 'applicationBoundary',
    selected: false,
    dragging: false,
    zIndex: -10,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    width: 400,
    height: 300,
    data: {
      element: {
        id: 'a1',
        kind: 'application',
        name: 'Webshop',
        lifecycle: 'live',
        isManaged: true,
        aspects: {},
        parameters: {},
      },
      placement: { elementId: 'a1', zone: 'landscape', x: 0, y: 0 },
      resizeLimits: testResizeLimits('application'),
      readOnly: false,
      aspectConfig: [],
    },
    ...overrides,
  } as unknown as ElementNodeProps;
}

function renderNode(props: ElementNodeProps) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <ReactFlowProvider>
        <div style={{ width: '400px', height: '300px' }}>
          <ApplicationBoundaryNode {...props} />
        </div>
      </ReactFlowProvider>
    </ThemeProvider>,
  );
}

describe('ApplicationBoundaryNode', () => {
  it('makes the interior fill non-interactive so clicks fall through to child nodes', () => {
    const { getByTestId } = renderNode(baseProps());
    const fill = getByTestId('boundary-fill');
    expect(getComputedStyle(fill).pointerEvents).toBe('none');
  });

  it('keeps the title bar interactive so the boundary itself stays selectable', () => {
    const { getByTestId } = renderNode(baseProps({ selected: true }));
    const title = getByTestId('boundary-title');
    expect(getComputedStyle(title).pointerEvents).toBe('auto');
  });
});
