// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ReactFlowProvider } from '@xyflow/react';
import type { ComponentType } from 'react';
import { ActorNode } from './ActorNode';
import { ApplicationBoundaryNode } from './ApplicationBoundaryNode';
import { ApplicationCardNode } from './ApplicationCardNode';
import { ComponentNode } from './ComponentNode';
import { ExternalSystemNode } from './ExternalSystemNode';
import { InputChannelNode } from './InputChannelNode';
import { ManagementToolNode } from './ManagementToolNode';
import { LogoLibraryProvider } from './logoRegistry';
import { installReactFlowMocks } from '../reactFlowTestSetup';
import type { DesignElement, ElementKind } from '../../model/types';
import type { ElementNodeProps } from './nodeData';
import { testResizeLimits } from './nodeTestData';

/**
 * Logo rendering on the nodes.
 *
 * DELIBERATE FLIP (Phase 3d): this file used to assert that only the three
 * "vendor-bearing" kinds drew a mark and that a component with an `iconKey`
 * drew nothing. Every kind draws one now — including the container diagram's
 * boundary, which is the application's own frame and therefore the most obvious
 * place for its logo. The gate that used to live here was really about the
 * `vendor` TEXT FIELD, and conflating the two left four of the seven node kinds
 * unable to show an icon at all.
 *
 * What has NOT changed, and is still asserted: an unresolvable key falls back to
 * the kind's glyph rather than breaking the node (intent rule 9), and an uploaded
 * mark reaches the page as an `img` and never as inline markup — a security rule,
 * not a preference, since an uploaded SVG may carry a script.
 */

beforeAll(() => {
  installReactFlowMocks();
});
afterEach(() => cleanup());

function withProviders(node: React.ReactNode) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <ReactFlowProvider>
        <div style={{ width: '220px', height: '150px' }}>{node}</div>
      </ReactFlowProvider>
    </ThemeProvider>,
  );
}

function props(kind: ElementKind, over: Partial<DesignElement> = {}): ElementNodeProps {
  return {
    id: 'e1',
    type: kind,
    selected: false,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    width: 200,
    height: 130,
    data: {
      element: {
        id: 'e1',
        kind,
        name: 'Example',
        lifecycle: 'live',
        isManaged: false,
        aspects: {},
        parameters: {},
        ...over,
      },
      placement: { elementId: 'e1', zone: 'landscape', x: 0, y: 0 },
      resizeLimits: testResizeLimits(kind),
      readOnly: false,
      aspectConfig: [],
      showLifecycle: false,
    },
  } as unknown as ElementNodeProps;
}

/** Every node component that carries an icon slot — which is now all of them. */
const KINDS: { name: string; kind: ElementKind; Node: ComponentType<ElementNodeProps> }[] = [
  { name: 'ApplicationCardNode', kind: 'application', Node: ApplicationCardNode },
  { name: 'ApplicationBoundaryNode', kind: 'application', Node: ApplicationBoundaryNode },
  { name: 'ComponentNode', kind: 'component', Node: ComponentNode },
  { name: 'ExternalSystemNode', kind: 'externalSystem', Node: ExternalSystemNode },
  { name: 'ManagementToolNode', kind: 'managementTool', Node: ManagementToolNode },
  { name: 'InputChannelNode', kind: 'inputChannel', Node: InputChannelNode },
  { name: 'ActorNode', kind: 'actor', Node: ActorNode },
];

describe.each(KINDS)('$name logo slot', ({ kind, Node }) => {
  it('renders the resolved mark when the iconKey resolves', () => {
    const { getByLabelText } = withProviders(<Node {...props(kind, { iconKey: 'database' })} />);
    expect(getByLabelText('Database')).toBeDefined();
  });

  it('falls back (no mark) when the iconKey is unknown', () => {
    const { queryByLabelText } = withProviders(
      <Node {...props(kind, { iconKey: 'not-a-real-key' })} />,
    );
    expect(queryByLabelText('Database')).toBeNull();
  });

  it('renders no mark when the iconKey is absent', () => {
    const { queryByRole } = withProviders(<Node {...props(kind)} />);
    expect(queryByRole('img')).toBeNull();
  });

  it('draws the large body mark at 28px when iconSize is "large"', () => {
    const { getByLabelText } = withProviders(
      <Node {...props(kind, { iconKey: 'database', iconSize: 'large' })} />,
    );
    const mark = getByLabelText('Database');
    expect(mark.getAttribute('width')).toBe('28');
    // Exactly one mark whichever size is chosen — the header slot and the body
    // slot are mutually exclusive by construction.
    expect(document.querySelectorAll('[aria-label="Database"]').length).toBe(1);
  });
});

/**
 * 3f: the dark-mode backing plate. Brand marks are drawn for white paper and
 * half of them are dark ink on nothing, so without a plate a full-colour logo
 * dropped on a dark card header disappears into it. Built-ins are
 * `currentColor` and get no plate — they already contrast with whatever they
 * sit on, and a white square behind a monochrome mark would be the loud thing
 * on the board.
 */
describe('uploaded marks get a backing plate on dark, and only on dark', () => {
  const library = [{ key: 'lib:merk', label: 'Merk', url: 'data:image/png;base64,AAA' }];

  function inMode(mode: 'light' | 'dark', iconKey: string) {
    return render(
      <ThemeProvider theme={createTheme({ palette: { mode } })}>
        <ReactFlowProvider>
          <LogoLibraryProvider value={library}>
            <ApplicationCardNode {...props('application', { iconKey })} />
          </LogoLibraryProvider>
        </ReactFlowProvider>
      </ThemeProvider>,
    );
  }

  /** The plate is the mark's parent box; a transparent one has no background. */
  const plateOf = (image: HTMLElement) => getComputedStyle(image.parentElement!).backgroundColor;

  /** Anything that actually paints; a transparent plate paints nothing. */
  const OPAQUE = /^rgba?\((\d+), (\d+), (\d+)(, (?!0\))[\d.]+)?\)$/;

  it('plates a full-colour uploaded mark on a dark theme', () => {
    const { getByAltText } = inMode('dark', 'lib:merk');
    expect(plateOf(getByAltText('Merk'))).toMatch(OPAQUE);
  });

  it('leaves it unplated on a light theme — the paper already is the plate', () => {
    const { getByAltText } = inMode('light', 'lib:merk');
    expect(plateOf(getByAltText('Merk'))).not.toMatch(OPAQUE);
  });

  it('never plates a built-in mark, dark or light', () => {
    const dark = inMode('dark', 'database');
    expect(plateOf(dark.getByLabelText('Database'))).not.toMatch(OPAQUE);
    dark.unmount();
    const light = inMode('light', 'database');
    expect(plateOf(light.getByLabelText('Database'))).not.toMatch(OPAQUE);
  });
});

describe('the actor stickman keeps its figure', () => {
  it('draws the figure, not the logo, under shapeVariant "figure"', () => {
    // That render exists precisely to BE a figure; swapping it for a mark would
    // empty the choice the user made.
    const { getByRole, queryByLabelText } = withProviders(
      <ActorNode {...props('actor', { shapeVariant: 'figure', iconKey: 'database' })} />,
    );
    expect(getByRole('img', { name: 'Actor figure' })).toBeDefined();
    expect(queryByLabelText('Database')).toBeNull();
  });
});

/**
 * Uploaded marks (intent rule 9). Three things are asserted, and the middle one
 * is a security rule rather than a preference: an uploaded SVG may carry a
 * script, so it must reach the page as an `img` and never as inline markup.
 */
describe.each(KINDS)('$name uploaded logo slot', ({ kind, Node }) => {
  const library = [
    { key: 'lib:salesforce', label: 'Salesforce', url: 'https://hal.test/logos/salesforce/content' },
  ];

  function withLibrary(node: React.ReactNode, value = library) {
    return render(
      <ThemeProvider theme={createTheme()}>
        <ReactFlowProvider>
          <LogoLibraryProvider value={value}>
            <div style={{ width: '220px', height: '150px' }}>{node}</div>
          </LogoLibraryProvider>
        </ReactFlowProvider>
      </ThemeProvider>,
    );
  }

  it('renders an uploaded mark as a full-colour image', () => {
    const { getByAltText } = withLibrary(<Node {...props(kind, { iconKey: 'lib:salesforce' })} />);
    const image = getByAltText('Salesforce');
    expect(image.tagName).toBe('IMG');
    expect(image.getAttribute('src')).toBe(library[0].url);
  });

  it('lets a `lib:` key win over a built-in with the same key', () => {
    // The prefix is the shell's promise that the mark is an upload; honouring it
    // means a built-in can never shadow one.
    const shadowing = [{ key: 'lib:database', label: 'Eigen database', url: 'https://hal.test/x' }];
    const { getByAltText, queryByLabelText } = withLibrary(
      <Node {...props(kind, { iconKey: 'lib:database' })} />,
      shadowing,
    );
    expect(getByAltText('Eigen database')).toBeDefined();
    expect(queryByLabelText('Database')).toBeNull();
  });

  it('prefers a built-in mark over an un-namespaced uploaded entry', () => {
    const shadowing = [{ key: 'database', label: 'Not the built-in', url: 'https://hal.test/x' }];
    const { getByLabelText, queryByAltText } = withLibrary(
      <Node {...props(kind, { iconKey: 'database' })} />,
      shadowing,
    );
    expect(getByLabelText('Database')).toBeDefined();
    expect(queryByAltText('Not the built-in')).toBeNull();
  });

  it('degrades to the kind glyph when a purged key no longer resolves', () => {
    const { queryByRole, queryByAltText } = withLibrary(
      <Node {...props(kind, { iconKey: 'lib:was-purged' })} />,
    );
    expect(queryByAltText('Salesforce')).toBeNull();
    expect(queryByRole('img')).toBeNull();
  });
});
