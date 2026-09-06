// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { DesignDiagram, DesignModel } from '../model/types';
import { DEFAULT_TIDY_OPTIONS } from '../layout/tidy';
import { EditorToolbar, type EditorToolbarProps } from './EditorToolbar';

/**
 * Busy states. Tidy and route-only share one flag (they must not overlap — both
 * commit one undo step over the whole board); the PNG export has its own, since
 * it commits nothing and only owes the user a spinner on the button they
 * pressed and no second export while the first rasterises.
 */

afterEach(() => cleanup());

const diagram: DesignDiagram = { id: 'd1', kind: 'layer7', name: 'L7', placements: [] };
const model: DesignModel = {
  name: 'ACME',
  customerName: 'ACME',
  elements: [],
  connections: [],
  diagrams: [diagram],
};

function renderToolbar(overrides: Partial<EditorToolbarProps> = {}) {
  const props: EditorToolbarProps = {
    model,
    activeDiagram: diagram,
    readOnly: false,
    onActiveDiagramChange: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
    onTidy: vi.fn(),
    tidyOptions: DEFAULT_TIDY_OPTIONS,
    onTidyOptionsChange: vi.fn(),
    onRouteEdges: vi.fn(),
    autoRoute: false,
    onToggleAutoRoute: vi.fn(),
    onFitView: vi.fn(),
    onExport: vi.fn(),
    onOpenHelp: vi.fn(),
    showLifecycle: true,
    onToggleLifecycle: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    canUndo: false,
    canRedo: false,
    onOpenSearch: vi.fn(),
    showMinimap: false,
    onToggleMinimap: vi.fn(),
    ...overrides,
  };
  render(
    <ThemeProvider theme={createTheme()}>
      <EditorToolbar {...props} />
    </ThemeProvider>,
  );
  return props;
}

const exportButton = () => screen.getByRole('button', { name: 'Export PNG' }) as HTMLButtonElement;

describe('EditorToolbar — export busy', () => {
  it('is pressable and shows its own icon when idle', () => {
    const props = renderToolbar();
    expect(exportButton().disabled).toBe(false);
    fireEvent.click(exportButton());
    expect(props.onExport).toHaveBeenCalledTimes(1);
  });

  it('disables itself and spins while exporting', () => {
    const props = renderToolbar({ exportBusy: true });
    expect(exportButton().disabled).toBe(true);
    expect(screen.getByRole('progressbar')).toBeDefined();
    fireEvent.click(exportButton());
    expect(props.onExport).not.toHaveBeenCalled();
  });

  it('does not disable Tidy — an export is not a layout pass', () => {
    renderToolbar({ exportBusy: true });
    expect((screen.getByRole('button', { name: 'Tidy layout' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});

/**
 * A tidy that has a thread of its own can be called off, and the button that
 * started it is where the eye already is. Where it has no thread — no worker
 * handed in — the cancel is absent rather than inert: a Cancel that cannot
 * cancel is worse than no Cancel at all.
 */
describe('cancelling a tidy', () => {
  it('turns the tidy button into a cancel while one is running', () => {
    const onCancelTidy = vi.fn();
    const props = renderToolbar({ busy: 'tidy', onCancelTidy });

    const button = screen.getByRole('button', { name: 'Cancel tidy' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(onCancelTidy).toHaveBeenCalledTimes(1);
    expect(props.onTidy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Tidy layout' })).toBeNull();
  });

  it('leaves the button disabled where there is nothing to cancel', () => {
    renderToolbar({ busy: 'tidy' });
    expect((screen.getByRole('button', { name: 'Tidy layout' }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect(screen.queryByRole('button', { name: 'Cancel tidy' })).toBeNull();
  });

  it('is the tidy button again once the pass is over', () => {
    renderToolbar({ onCancelTidy: vi.fn() });
    expect((screen.getByRole('button', { name: 'Tidy layout' }) as HTMLButtonElement).disabled)
      .toBe(false);
    expect(screen.queryByRole('button', { name: 'Cancel tidy' })).toBeNull();
  });
});
