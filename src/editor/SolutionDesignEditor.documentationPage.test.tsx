// @vitest-environment jsdom
/**
 * The documentation page on a scope with no board.
 *
 * An organisation's views are a sheet and a map, so the editor has no canvas
 * to draw and says so — but its capabilities and stakeholders have pages,
 * and the sheet's *Details ›* is the way to them. The host's request names
 * the sheet, and the page lists the sheet's neighbours down its left.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { HostedEditor } from './testing/editorHost';
import type { EditorHostState, HostedEditorProps } from './testing/editorHost';
import { installReactFlowMocks } from './reactFlowTestSetup';
import type { DesignModel } from '../model/types';

beforeAll(() => installReactFlowMocks());
afterEach(() => cleanup());

const element = (id: string, kind: 'function' | 'actor', name: string) => ({
  id, kind, name, lifecycle: 'live' as const, isManaged: false, aspects: {},
});

function model(): DesignModel {
  return {
    name: 'Acme',
    diagrams: [{ id: 'sh-1', kind: 'sheet', name: 'Business architecture', members: [], geometry: { nodes: [] } }],
    elements: [element('billing', 'function', 'Billing'), element('rating', 'function', 'Rating'), element('ops', 'actor', 'Operations')],
    relations: [],
  };
}

function renderEditor(overrides: Partial<HostedEditorProps> = {}) {
  const host = { current: undefined as unknown as EditorHostState };
  const props: HostedEditorProps = {
    model: model(),
    activeDiagramId: undefined,
    onActiveDiagramChange: vi.fn(),
    onCreateContainerDiagram: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
    ...overrides,
  };
  return render(
    <ThemeProvider theme={createTheme()}>
      <HostedEditor {...props} hostRef={host} />
    </ThemeProvider>,
  );
}

describe('the documentation page where there is no board', () => {
  it('opens on the element the host named, listing the sheet’s own neighbours', () => {
    renderEditor({ documentationRequest: { elementId: 'rating', diagramId: 'sh-1', nonce: 1 } });
    expect(screen.getByRole('heading', { name: 'Rating' })).toBeTruthy();
    // The sheet's trees down the left, not a board's applications.
    expect(screen.getByRole('button', { name: 'Billing' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Operations' })).toBeTruthy();
  });

  it('draws nothing but the notice without a request', () => {
    renderEditor();
    expect(screen.queryByRole('heading', { name: 'Rating' })).toBeNull();
  });
});
