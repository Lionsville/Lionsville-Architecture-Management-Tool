// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { ReactFlowProvider, type Node } from '@xyflow/react';
import type { ReactNode } from 'react';
import { atFullSize, useBoardFrame } from './useBoardFrame';

afterEach(() => { cleanup(); vi.useRealTimers(); });

const wrapper = ({ children }: { children: ReactNode }) => <ReactFlowProvider>{children}</ReactFlowProvider>;
const sized = (width: number, height: number) => ({
  current: { getBoundingClientRect: () => ({ width, height }) } as unknown as HTMLDivElement,
});
const nodes: Node[] = [
  { id: 'a', position: { x: 0, y: 0 }, data: {}, width: 200, height: 130 },
  { id: 'b', position: { x: 800, y: 500 }, data: {}, width: 200, height: 130 },
];

describe('the first frame', () => {
  it('is put before the board is shown, at once and at no more than 100%', () => {
    const setViewport = vi.fn();
    const { result } = renderHook(() => useBoardFrame({
      container: sized(1400, 900), nodes, kept: undefined, awaiting: false, ready: true, setViewport,
    }), { wrapper });
    expect(result.current.framed).toBe(true);
    expect(setViewport).toHaveBeenCalledTimes(1);
    expect(setViewport.mock.calls[0][0].zoom).toBeLessThanOrEqual(1);
    // No duration: nothing flies in.
    expect(setViewport.mock.calls[0]).toHaveLength(1);
  });

  it('does not put one over a board that was left earlier: it goes back there', () => {
    const setViewport = vi.fn();
    const { result } = renderHook(() => useBoardFrame({
      container: sized(1400, 900), nodes, kept: { x: 1, y: 2, zoom: 1.5 }, awaiting: false, ready: true, setViewport,
    }), { wrapper });
    expect(result.current.framed).toBe(true);
    expect(setViewport).not.toHaveBeenCalled();
  });

  it('holds a board nobody has placed yet until the pass has placed it', () => {
    const setViewport = vi.fn();
    const { result, rerender } = renderHook(({ awaiting }) => useBoardFrame({
      container: sized(1400, 900), nodes, kept: undefined, awaiting, ready: true, setViewport,
    }), { wrapper, initialProps: { awaiting: true } });
    expect(result.current.framed).toBe(false);
    expect(setViewport).not.toHaveBeenCalled();
    rerender({ awaiting: false });
    expect(result.current.framed).toBe(true);
    expect(setViewport).toHaveBeenCalledTimes(1);
  });

  it('lets go of a pass that never ends, with what there is', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useBoardFrame({
      container: sized(1400, 900), nodes, kept: undefined, awaiting: true, ready: true, setViewport: vi.fn(),
    }), { wrapper });
    expect(result.current.framed).toBe(false);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.framed).toBe(true);
  });
});

describe('a picture', () => {
  it('is drawn at its own size whatever the zoom, and the window goes back after', () => {
    const canvas = document.createElement('div');
    canvas.dataset.distance = 'far';
    canvas.style.setProperty('--canvas-zoom', '0.6');
    const inner = canvas.appendChild(document.createElement('div'));
    const restore = atFullSize(inner);
    expect(canvas.dataset.distance).toBe('middle');
    expect(canvas.style.getPropertyValue('--canvas-zoom')).toBe('1');
    restore();
    expect(canvas.dataset.distance).toBe('far');
    expect(canvas.style.getPropertyValue('--canvas-zoom')).toBe('0.6');
  });
});
