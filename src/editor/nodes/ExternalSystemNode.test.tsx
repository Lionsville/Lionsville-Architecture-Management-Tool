// @vitest-environment jsdom
/**
 * A card for something this board is not the subject of (ADR-0012 §3, §4).
 *
 * Two facts share this figure, and they are different facts: `outside` means
 * nobody in this organisation owns it, and `ref` means somebody does — just not
 * this scope. They draw the same, because what the look says is "somebody
 * else's", which is true of both; what tells them apart is the line in the
 * header, which says where a stand-in is really defined.
 *
 * The words come in already translated. The editor may not know a scope tree
 * exists, so it is handed the sentence rather than the path.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ReactFlowProvider } from '@xyflow/react';
import { ExternalSystemNode } from './ExternalSystemNode';
import type { ElementNodeProps, StandInNote } from './nodeData';
import { testResizeLimits } from './nodeTestData';
import { nodeFigure } from '../../model/kinds';
import type { DesignElement } from '../../model/types';
import { installReactFlowMocks } from '../reactFlowTestSetup';

beforeAll(() => installReactFlowMocks());
afterEach(() => cleanup());

function props(element: Partial<DesignElement>, note?: StandInNote): ElementNodeProps {
  return {
    id: 'erp',
    type: 'externalSystem',
    selected: false,
    dragging: false,
    zIndex: 1,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    width: 180,
    height: 70,
    data: {
      element: {
        id: 'erp',
        kind: 'application',
        name: 'ERP',
        lifecycle: 'live',
        isManaged: false,
        aspects: {},
        ...element,
      },
      placement: { id: 'erp', x: 0, y: 0 },
      readOnly: false,
      aspectConfig: [],
      showLifecycle: true,
      phase: 'live',
      resizeLimits: testResizeLimits('externalSystem', 'externalSystems'),
      ...(note !== undefined ? { note } : {}),
    },
  } as unknown as ElementNodeProps;
}

const show = (element: Partial<DesignElement>, note?: StandInNote) => render(
  <ThemeProvider theme={createTheme()}>
    <ReactFlowProvider>
      <ExternalSystemNode {...props(element, note)} />
    </ReactFlowProvider>
  </ThemeProvider>,
);

describe('what a stand-in draws as', () => {
  it('is the figure this look was extended for', () => {
    expect(nodeFigure({ kind: 'application', ref: 'acme/retail' })).toBe('externalSystem');
    expect(nodeFigure({ kind: 'application' })).toBe('application');
  });

  /**
   * The band still wins over the fact, which is the rule that let two kinds
   * retire: a card in the management band is a management tool whoever
   * defines it.
   */
  it('still lets the band a card sits in win over where it is defined', () => {
    expect(nodeFigure({ kind: 'application', ref: 'acme/retail' }, 'management'))
      .toBe('managementTool');
  });
});

describe('what the card says about it', () => {
  it('says where it is from, in place of the word "external"', () => {
    show({ ref: 'acme/retail' }, { from: 'from acme/retail' });
    expect(screen.getByText('from acme/retail')).toBeDefined();
    expect(screen.queryByText('EXTERNAL')).toBeNull();
  });

  it('keeps saying "external" for a system nobody in the organisation owns', () => {
    show({ outside: true });
    expect(screen.getByText('EXTERNAL')).toBeDefined();
  });

  /**
   * Drift, or a stand-in nobody defines. Worth noticing on a board of two
   * hundred cards and never a reason to stop, so it is a glyph carrying the
   * finding's own sentence rather than anything a person has to dismiss.
   */
  it('carries a finding as a glyph with the finding\'s sentence on it', () => {
    show({ ref: 'acme/retail' }, {
      from: 'from acme/retail',
      warning: 'The name here is not what acme/retail calls it any more',
    });
    const glyph = screen.getByTestId('stand-in-warning');
    expect(glyph.getAttribute('title')).toContain('acme/retail');
  });

  it('draws no glyph where the tree says nothing is wrong', () => {
    show({ ref: 'acme/retail' }, { from: 'from acme/retail' });
    expect(screen.queryByTestId('stand-in-warning')).toBeNull();
  });
});
