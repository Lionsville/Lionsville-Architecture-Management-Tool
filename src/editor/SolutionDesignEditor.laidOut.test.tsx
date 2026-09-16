// @vitest-environment jsdom
/**
 * A laid-out view drawn in the tab (ADR-0016).
 *
 * What is pinned: the host's page takes the canvas's place when the active
 * view is laid out; the technology landscape keeps the palette and the
 * inspector docked and its palette offers the layer's two kinds, made
 * without a placement; the map takes the whole body; and the canvas's own
 * controls are not on the bar for either.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { HostedEditor } from './testing/editorHost';
import type { EditorHostState, HostedEditorProps } from './testing/editorHost';
import { installReactFlowMocks } from './reactFlowTestSetup';
import type { PageView } from './props';
import type { DesignDiagram, DesignModel } from '../model/types';

beforeAll(() => installReactFlowMocks());
afterEach(() => cleanup());

function model(active: DesignDiagram): DesignModel {
  return {
    name: 'Platforms',
    diagrams: [{ id: 'd1', kind: 'layer7', name: 'Board', members: [], geometry: { nodes: [] } }, active],
    elements: [{ id: 'openshift', kind: 'platform', name: 'OpenShift', lifecycle: 'live', isManaged: false, aspects: {} }],
    relations: [],
  };
}
const TECHNOLOGY: DesignDiagram = { id: 'tl', kind: 'technology', name: 'Technology landscape', members: [], geometry: { nodes: [] } };
const MAP: DesignDiagram = { id: 'mp', kind: 'map', name: 'Enterprise map', members: [], geometry: { nodes: [] } };

function renderEditor(active: DesignDiagram, overrides: Partial<HostedEditorProps> = {}) {
  const host = { current: undefined as unknown as EditorHostState };
  const views: PageView[] = [];
  const props: HostedEditorProps = {
    model: model(active),
    activeDiagramId: active.id,
    onActiveDiagramChange: vi.fn(),
    onCreateContainerDiagram: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
    pages: {
      render: (diagram, view) => {
        views.push(view);
        return <div data-testid="the-page">{diagram.name}</div>;
      },
    },
    ...overrides,
  };
  render(
    <ThemeProvider theme={createTheme()}>
      <HostedEditor {...props} hostRef={host} />
    </ThemeProvider>,
  );
  return { host, views: () => views, last: () => views[views.length - 1] };
}

describe('the technology landscape in the tab', () => {
  it('draws the page where the canvas would be, with the palette and the inspector docked', () => {
    renderEditor(TECHNOLOGY);
    expect(screen.getByTestId('laid-out-view').textContent).toBe('Technology landscape');
    expect(screen.getByRole('complementary', { name: 'Element palette' })).toBeDefined();
    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Fit view' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tidy layout' })).toBeNull();
  });

  it('offers the layer’s two kinds, and makes one with no placement, selected', () => {
    const { host, last } = renderEditor(TECHNOLOGY);
    expect(screen.queryByRole('button', { name: 'Application' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Platform service' }));
    fireEvent.click(screen.getByRole('button', { name: /Add platform service/ }));
    const made = host.current.model.elements.find((element) => element.kind === 'platformService');
    expect(made).toBeDefined();
    expect(host.current.model.diagrams.every((diagram) => diagram.members.length === 0)).toBe(true);
    expect(last().selectedId).toBe(made!.id);
  });

  it('files what the page adds under the parent it names, and hands the page the selection both ways', () => {
    const { host, last } = renderEditor(TECHNOLOGY);
    act(() => last().onAdd({ kind: 'platform', parentId: 'openshift' }));
    const made = host.current.model.elements.find((element) => element.kind === 'platform' && element.id !== 'openshift');
    expect(made?.parentId).toBe('openshift');
    act(() => last().onSelect('openshift'));
    expect(last().selectedId).toBe('openshift');
    act(() => last().onSelect(undefined));
    expect(last().selectedId).toBeUndefined();
  });
});

describe('the map in the tab', () => {
  it('takes the whole body: no palette and no inspector beside it', () => {
    renderEditor(MAP);
    expect(screen.getByTestId('laid-out-view').textContent).toBe('Enterprise map');
    expect(screen.queryByRole('complementary', { name: 'Element palette' })).toBeNull();
    expect(screen.queryByRole('complementary', { name: 'Inspector' })).toBeNull();
  });
});
