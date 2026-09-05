// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ReactFlowProvider } from '@xyflow/react';
import { ActorNode } from './ActorNode';
import type { ElementNodeProps } from './nodeData';
import { testResizeLimits } from './nodeTestData';
import type { DesignElement, NodeShapeVariant } from '../types';
import { installReactFlowMocks } from '../editor/reactFlowTestSetup';

/**
 * D11 stickman: ActorNode renders the figure SVG when `shapeVariant === 'figure'`
 * (bypassing the box/radius, and ignoring `hasDescription`), and today's box
 * otherwise. The figure is actor-only — no other kind reaches ActorNode.
 */

beforeAll(() => installReactFlowMocks());
afterEach(() => cleanup());

function props(element: Partial<DesignElement>): ElementNodeProps {
  return {
    id: 'a1',
    type: 'actor',
    selected: false,
    dragging: false,
    zIndex: 1,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    width: 140,
    height: 60,
    data: {
      element: {
        id: 'a1',
        kind: 'actor',
        name: 'Customer',
        lifecycle: 'live',
        isManaged: false,
        aspects: {},
        parameters: {},
        ...element,
      },
      readOnly: false,
      showLifecycle: true,
      resizeLimits: testResizeLimits('actor', 'actors'),
    },
  } as unknown as ElementNodeProps;
}

function renderNode(p: ElementNodeProps) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <ReactFlowProvider>
        <div style={{ width: '140px', height: '60px' }}>
          <ActorNode {...p} />
        </div>
      </ReactFlowProvider>
    </ThemeProvider>,
  );
}

describe('ActorNode — stickman (D11)', () => {
  it('renders the stickman figure when shapeVariant is "figure"', () => {
    renderNode(props({ shapeVariant: 'figure' }));
    expect(screen.getByRole('img', { name: 'Actor figure' })).toBeDefined();
    expect(screen.getByText('Customer')).toBeDefined();
  });

  it('renders the box (no figure) for the default and other variants', () => {
    for (const shapeVariant of [undefined, 'rounded', 'sharp', 'subtle'] as (
      | NodeShapeVariant
      | undefined
    )[]) {
      const { unmount } = renderNode(props({ shapeVariant }));
      expect(screen.queryByRole('img', { name: 'Actor figure' })).toBeNull();
      expect(screen.getByText('Customer')).toBeDefined();
      unmount();
    }
  });

  it('renders the figure the same with or without a description (ignores hasDescription)', () => {
    const withDesc = renderNode(props({ shapeVariant: 'figure', description: 'A long description' }));
    expect(screen.getByRole('img', { name: 'Actor figure' })).toBeDefined();
    // The figure path shows only the name, never the 2-line description block.
    expect(screen.queryByText('A long description')).toBeNull();
    withDesc.unmount();

    renderNode(props({ shapeVariant: 'figure' }));
    expect(screen.getByRole('img', { name: 'Actor figure' })).toBeDefined();
  });
});
