// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { testTheme } from '../testing/theme';
import { SessionMemoryContext } from '../../widgets/sessionMemory';
import { PlaceHostContext } from '../../widgets/kit/placeHost';
import type { SessionMemory } from '../../widgets/sessionMemory';
import { EmptyBoardNote } from './BoardOverlays';

afterEach(() => cleanup());

const css = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

/** One window's memory, as the shell's folds keep it. */
function windowMemory(): SessionMemory {
  const kept = new Map<string, ReadonlySet<string>>();
  return { keep: (key, held) => kept.set(key, held), recall: (key) => kept.get(key) };
}

function Board({ viewId, onAdd, children }: { viewId: string; onAdd?: () => void; children?: ReactNode }) {
  const board = useRef<HTMLDivElement>(null);
  return (
    <div ref={board} data-testid="board" tabIndex={-1}>
      <EmptyBoardNote viewId={viewId} board={board} readOnly={false} onAdd={onAdd} onExisting={undefined} />
      {children}
    </div>
  );
}

function renderBoard(viewId: string, memory: SessionMemory, onAdd?: () => void) {
  return render(
    <ThemeProvider theme={testTheme}>
      <SessionMemoryContext.Provider value={memory}>
        <Board viewId={viewId} {...(onAdd ? { onAdd } : {})} />
      </SessionMemoryContext.Provider>
    </ThemeProvider>,
  );
}

describe("the empty board's note", () => {
  it('works where it is: its add is the board’s own', () => {
    const onAdd = vi.fn();
    renderBoard('v1', windowMemory(), onAdd);
    fireEvent.click(within(screen.getByTestId('empty-board')).getByRole('button', { name: 'Add an application' }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('is put away by its close press', () => {
    renderBoard('v1', windowMemory());
    fireEvent.click(screen.getByRole('button', { name: 'Hide this note' }));
    expect(screen.queryByTestId('empty-board')).toBeNull();
  });

  it('is put away by Escape anywhere on the board', () => {
    renderBoard('v1', windowMemory());
    fireEvent.keyDown(screen.getByTestId('board'), { key: 'Escape' });
    expect(screen.queryByTestId('empty-board')).toBeNull();
  });

  it('is put away by Escape after a press on open board, which leaves the focus nowhere', () => {
    renderBoard('v1', windowMemory());
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByTestId('empty-board')).toBeNull();
  });

  it('leaves an Escape from elsewhere alone', () => {
    renderBoard('v1', windowMemory());
    const field = document.createElement('input');
    document.body.append(field);
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.getByTestId('empty-board')).toBeDefined();
    field.remove();
  });

  it('leaves Escape to a page that is up over the board', () => {
    render(
      <ThemeProvider theme={testTheme}>
        <PlaceHostContext.Provider value={{ page: null, views: null, pageUp: true }}>
          <Board viewId="v1" />
        </PlaceHostContext.Provider>
      </ThemeProvider>,
    );
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.getByTestId('empty-board')).toBeDefined();
  });

  it('leaves an Escape somebody else already answered alone', () => {
    renderBoard('v1', windowMemory());
    const board = screen.getByTestId('board');
    board.addEventListener('keydown', (event) => event.preventDefault(), { capture: true });
    fireEvent.keyDown(board, { key: 'Escape' });
    expect(screen.getByTestId('empty-board')).toBeDefined();
  });

  it('stays away for that view for the session, and another empty view still shows it', () => {
    const memory = windowMemory();
    const first = renderBoard('v1', memory);
    fireEvent.click(screen.getByRole('button', { name: 'Hide this note' }));
    first.unmount();
    renderBoard('v1', memory);
    expect(screen.queryByTestId('empty-board')).toBeNull();
    cleanup();
    renderBoard('v2', memory);
    expect(screen.getByTestId('empty-board')).toBeDefined();
  });

  it('comes back in a new session', () => {
    const first = renderBoard('v1', windowMemory());
    fireEvent.click(screen.getByRole('button', { name: 'Hide this note' }));
    first.unmount();
    renderBoard('v1', windowMemory());
    expect(screen.getByTestId('empty-board')).toBeDefined();
  });

  it('follows the view when the board is drawn for another one', () => {
    function Switching() {
      const [view, setView] = useState('v1');
      return (
        <Board viewId={view}>
          <button type="button" onClick={() => setView('v2')}>other view</button>
        </Board>
      );
    }
    render(
      <ThemeProvider theme={testTheme}>
        <SessionMemoryContext.Provider value={windowMemory()}>
          <Switching />
        </SessionMemoryContext.Provider>
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hide this note' }));
    fireEvent.click(screen.getByRole('button', { name: 'other view' }));
    expect(screen.getByTestId('empty-board')).toBeDefined();
  });
});

describe('what stands on a board stays under a page', () => {
  // A page is drawn over the view in the main column while the board stays mounted
  // under it. The note (z-index 4) once stacked against the page (z-index 3) and was
  // drawn over the observations page; the board's own stacking context is what holds
  // everything it draws beneath any page. jsdom lays nothing out, so the rule is read.
  it('gives the board a stacking context of its own', () => {
    expect(css('./board.css')).toMatch(/\.lv-board \{ isolation: isolate; \}/);
  });

  it('keeps the page a layer over the main column', () => {
    expect(css('../../widgets/kit/Frame.css')).toMatch(/\.kit-place \{ position: absolute; inset: 0; z-index: 3;/);
  });
});
