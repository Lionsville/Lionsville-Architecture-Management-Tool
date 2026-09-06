// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { DesignDiagram, DesignModel } from '../model/types';
import { DEFAULT_TIDY_OPTIONS, type TidyOptions } from '../layout/tidy';
import { EditorToolbar } from './EditorToolbar';

/**
 * Tidy is a split button. The icon tidies with the current settings; the caret
 * opens the settings panel (direction / density / keep-manual-routes / pin
 * groups) with its own Apply. Settings are session state — the toolbar only
 * reports changes upward.
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

function Harness(props: {
  onTidy?: () => void;
  onOptions?: (options: TidyOptions) => void;
  readOnly?: boolean;
}) {
  const [options, setOptions] = useState<TidyOptions>(DEFAULT_TIDY_OPTIONS);
  return (
    <ThemeProvider theme={createTheme()}>
      <EditorToolbar
        model={model}
        activeDiagram={diagram}
        readOnly={props.readOnly ?? false}
        onActiveDiagramChange={vi.fn()}
        onCreateLayer7Diagram={vi.fn()}
        onTidy={props.onTidy ?? vi.fn()}
        tidyOptions={options}
        onTidyOptionsChange={(next) => {
          setOptions(next);
          props.onOptions?.(next);
        }}
        onRouteEdges={vi.fn()}
        autoRoute={false}
        onToggleAutoRoute={vi.fn()}
        onFitView={vi.fn()}
        onExport={vi.fn()}
        onOpenHelp={vi.fn()}
        showLifecycle
        onToggleLifecycle={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        canUndo={false}
        canRedo={false}
        onOpenSearch={() => {}}
        showMinimap={false}
        onToggleMinimap={() => {}}
      />
    </ThemeProvider>
  );
}

const openSettings = () => fireEvent.click(screen.getByLabelText('Tidy settings'));

describe('EditorToolbar — Tidy split button', () => {
  it('tidies on the icon without opening the settings', () => {
    const onTidy = vi.fn();
    render(<Harness onTidy={onTidy} />);

    fireEvent.click(screen.getByLabelText('Tidy layout'));

    expect(onTidy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Direction')).toBeNull();
  });

  it('reports a direction change and leaves the other settings alone', () => {
    const onOptions = vi.fn();
    render(<Harness onOptions={onOptions} />);
    openSettings();

    fireEvent.click(screen.getByText('Down'));

    expect(onOptions).toHaveBeenCalledWith({ ...DEFAULT_TIDY_OPTIONS, direction: 'vertical' });
  });

  it('reports density and pin-anchor-points changes', () => {
    const onOptions = vi.fn();
    render(<Harness onOptions={onOptions} />);
    openSettings();

    fireEvent.click(screen.getByText('Spacious'));
    expect(onOptions).toHaveBeenLastCalledWith({ ...DEFAULT_TIDY_OPTIONS, density: 'spacious' });

    // Pins are ON by default since the routing phase, so this click turns them OFF.
    fireEvent.click(screen.getByLabelText('Pin anchor points'));
    expect(DEFAULT_TIDY_OPTIONS.pinAnchorPoints).toBe(true);
    expect(onOptions).toHaveBeenLastCalledWith({
      ...DEFAULT_TIDY_OPTIONS,
      density: 'spacious',
      pinAnchorPoints: false,
    });
  });

  it('keeps the current value when the active toggle is clicked again', () => {
    const onOptions = vi.fn();
    render(<Harness onOptions={onOptions} />);
    openSettings();

    // 'Auto' is already selected; MUI hands back null for this click.
    fireEvent.click(screen.getByText('Auto'));

    expect(onOptions).not.toHaveBeenCalled();
  });

  it('applies from the panel and closes it', async () => {
    const onTidy = vi.fn();
    render(<Harness onTidy={onTidy} />);
    openSettings();

    fireEvent.click(screen.getByText('Tidy layout', { selector: 'button' }));

    expect(onTidy).toHaveBeenCalledTimes(1);
    // MUI keeps the popover mounted through its exit transition.
    await waitForElementToBeRemoved(() => screen.queryByText('Direction'));
  });

  it('offers pin group placements on the board panel and reports it', () => {
    const onOptions = vi.fn();
    render(<Harness onOptions={onOptions} />);
    openSettings();

    fireEvent.click(screen.getByLabelText('Pin group placements'));

    expect(onOptions).toHaveBeenLastCalledWith({ ...DEFAULT_TIDY_OPTIONS, pinGroups: true });
  });

  it('hides the whole control in read-only mode', () => {
    render(<Harness readOnly />);

    expect(screen.queryByLabelText('Tidy layout')).toBeNull();
    expect(screen.queryByLabelText('Tidy settings')).toBeNull();
  });
});
