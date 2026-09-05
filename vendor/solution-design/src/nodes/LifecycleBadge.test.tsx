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
import { LifecycleBadge } from './LifecycleBadge';
import { ManagementToolNode } from './ManagementToolNode';
import { installReactFlowMocks } from '../editor/reactFlowTestSetup';
import type { ElementKind, Lifecycle } from '../types';
import type { ElementNodeProps } from './nodeData';
import { testResizeLimits } from './nodeTestData';
import { t } from '../i18n/strings';

/**
 * U5 lifecycle badge: legible on the canvas without opening the inspector.
 * `live` is the normal state and never badges; only planned/retiring/retired
 * do, and the toolbar toggle (`showLifecycle`) hides them for a clean view.
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

describe('LifecycleBadge', () => {
  it('renders nothing for the live state (the normal state — no noise)', () => {
    const { container } = withProviders(<LifecycleBadge lifecycle="live" show />);
    expect(container.textContent).toBe('');
  });

  it('renders nothing when hidden by the toggle, even for a non-live state', () => {
    const { container } = withProviders(<LifecycleBadge lifecycle="planned" show={false} />);
    expect(container.textContent).toBe('');
  });

  it.each(['planned', 'retiring', 'retired'] as Lifecycle[])(
    'renders the %s label as a text channel when shown',
    (lifecycle) => {
      const { getByText, getByLabelText } = withProviders(
        <LifecycleBadge lifecycle={lifecycle} show />,
      );
      expect(getByText(lifecycle)).toBeDefined();
      // Flipped in 4B: the badge's accessible name now goes through the string
      // table, so it reads the lifecycle's NAME ("Retired") rather than its
      // stored value ("retired") — and it says it in the UI language.
      expect(getByLabelText(`Lifecycle: ${t('en', `lifecycle.${lifecycle}`)}`)).toBeDefined();
    },
  );
});

// --- Badge across every node kind + the boundary variant --------------------

function props(
  kind: ElementNodeProps['type'],
  lifecycle: Lifecycle,
  showLifecycle: boolean,
): ElementNodeProps {
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
        kind: kind === 'applicationBoundary' ? 'application' : kind,
        name: 'Example',
        lifecycle,
        isManaged: false,
        aspects: {},
        parameters: {},
      },
      placement: { elementId: 'e1', zone: 'landscape', x: 0, y: 0 },
      resizeLimits: testResizeLimits(
        (kind === 'applicationBoundary' ? 'application' : kind) as ElementKind,
      ),
      readOnly: false,
      aspectConfig: [],
      showLifecycle,
    },
  } as unknown as ElementNodeProps;
}

const KINDS: { name: string; type: ElementNodeProps['type']; Node: ComponentType<ElementNodeProps> }[] = [
  { name: 'ActorNode', type: 'actor', Node: ActorNode },
  { name: 'ApplicationCardNode', type: 'application', Node: ApplicationCardNode },
  { name: 'ComponentNode', type: 'component', Node: ComponentNode },
  { name: 'ExternalSystemNode', type: 'externalSystem', Node: ExternalSystemNode },
  { name: 'InputChannelNode', type: 'inputChannel', Node: InputChannelNode },
  { name: 'ManagementToolNode', type: 'managementTool', Node: ManagementToolNode },
  { name: 'ApplicationBoundaryNode', type: 'applicationBoundary', Node: ApplicationBoundaryNode },
];

describe.each(KINDS)('$name lifecycle badge', ({ type, Node }) => {
  it('shows the badge for a non-live lifecycle when the toggle is on', () => {
    const { getByText } = withProviders(<Node {...props(type, 'planned', true)} />);
    expect(getByText('planned')).toBeDefined();
  });

  it('omits the badge for the live state', () => {
    const { queryByText } = withProviders(<Node {...props(type, 'live', true)} />);
    expect(queryByText('live')).toBeNull();
  });

  it('omits the badge when the toggle hides it', () => {
    const { queryByText } = withProviders(<Node {...props(type, 'planned', false)} />);
    expect(queryByText('planned')).toBeNull();
  });
});

// The retired dim must not swallow the badge: CSS opacity creates a stacking
// context over its whole subtree, so a badge nested inside the dimmed box would
// render at 55% and stop being the legible-under-dim channel. The badge must be
// a sibling of the dimmed content box, never a descendant — asserted here for
// ComponentNode (regression) and cross-checked on a wrapped kind.
describe.each([
  { name: 'ComponentNode', type: 'component' as const, Node: ComponentNode },
  { name: 'ApplicationCardNode', type: 'application' as const, Node: ApplicationCardNode },
])('$name retired dim', ({ type, Node }) => {
  it('renders the RETIRED badge outside the dimmed content subtree', () => {
    const { getByLabelText, getByText } = withProviders(<Node {...props(type, 'retired', true)} />);
    const badge = getByLabelText('Lifecycle: Retired');
    const name = getByText('Example');
    const wrapper = badge.parentElement;
    expect(wrapper).not.toBeNull();
    const dimmedBox = Array.from(wrapper!.children).find(
      (child) => child !== badge && child.contains(name),
    );
    expect(dimmedBox).toBeDefined();
    // The badge is a sibling of the dimmed box, not nested within it.
    expect(dimmedBox!.contains(badge)).toBe(false);
  });
});
