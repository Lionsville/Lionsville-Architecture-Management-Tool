// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { useState } from 'react';
import { laidOut } from '../model/testFixtures';
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

const diagram: DesignDiagram = laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] });
const model: DesignModel = {
  name: 'ACME',
  elements: [],
  relations: [],
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
        onExport={vi.fn()}
        onOpenHelp={vi.fn()}
        showLifecycle
        onToggleLifecycle={vi.fn()}
        onAsOfChange={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        canUndo={false}
        canRedo={false}
        onOpenSearch={() => {}}
        showMinimap={false}
        onToggleMinimap={() => {}}
        showEdgeLabels
        onToggleEdgeLabels={() => {}}
      />
    </ThemeProvider>
  );
}

describe('EditorToolbar — Arrange', () => {
  const openArrange = () => fireEvent.click(screen.getByRole('button', { name: 'Arrange' }));

  it('tidies from the panel, and the panel goes', async () => {
    const onTidy = vi.fn();
    render(<Harness onTidy={onTidy} />);
    openArrange();
    fireEvent.click(screen.getByTestId('arrange-tidy'));

    expect(onTidy).toHaveBeenCalledTimes(1);
    await waitForElementToBeRemoved(() => screen.queryByText('Reading direction'));
  });

  it('reports a direction change and leaves the other settings alone', () => {
    const onOptions = vi.fn();
    render(<Harness onOptions={onOptions} />);
    openArrange();

    fireEvent.click(screen.getByRole('radio', { name: 'Down' }));

    expect(onOptions).toHaveBeenCalledWith({ ...DEFAULT_TIDY_OPTIONS, direction: 'vertical' });
  });

  it('reports density and what a tidy leaves alone', () => {
    const onOptions = vi.fn();
    render(<Harness onOptions={onOptions} />);
    openArrange();

    fireEvent.click(screen.getByRole('radio', { name: 'Spacious' }));
    expect(onOptions).toHaveBeenLastCalledWith({ ...DEFAULT_TIDY_OPTIONS, density: 'spacious' });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Bends and labels I placed' }));
    expect(onOptions).toHaveBeenLastCalledWith({ ...DEFAULT_TIDY_OPTIONS, density: 'spacious', pinAnchorPoints: false });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Where the groups stand' }));
    expect(onOptions).toHaveBeenLastCalledWith(expect.objectContaining({ pinGroups: true }));
  });

  it('hides the whole control in read-only mode', () => {
    render(<Harness readOnly />);
    expect(screen.queryByRole('button', { name: 'Arrange' })).toBeNull();
  });
});
