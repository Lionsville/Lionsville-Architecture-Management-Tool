// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { installReactFlowMocks } from '../reactFlowTestSetup';
import { usePointerDrag, type PointerDragHandlers } from './usePointerDrag';

/**
 * jsdom has no `PointerEvent`, so `fireEvent.pointerDown` would construct a
 * bare `Event` and drop `button`, `clientX` and `clientY` — the three things
 * every one of these tests turns on. A `MouseEvent` typed `pointerdown` carries
 * them, still reaches React's synthetic listener, and still reaches the native
 * listeners the hook puts on the captured element. Same trick as
 * `Layer7Canvas.groupMenu.test.tsx`.
 */
beforeAll(() => installReactFlowMocks());
afterEach(() => cleanup());

function pointer(type: string, init: MouseEventInit = {}) {
  return new MouseEvent(type, { button: 0, bubbles: true, cancelable: true, ...init });
}

function Harness(handlers: PointerDragHandlers) {
  const drag = usePointerDrag(handlers);
  return (
    <div
      data-testid="handle"
      data-dragging={drag.dragging ? 'true' : 'false'}
      onPointerDown={drag.onPointerDown}
    />
  );
}

function setup() {
  const spies = { onStart: vi.fn(), onMove: vi.fn(), onEnd: vi.fn(), onCancel: vi.fn() };
  render(<Harness {...spies} />);
  return { ...spies, handle: screen.getByTestId('handle') };
}

describe('usePointerDrag', () => {
  it('reports move deltas in client pixels, relative to the pointer-down', () => {
    const { handle, onMove } = setup();

    fireEvent(handle, pointer('pointerdown', { clientX: 100, clientY: 200 }));
    fireEvent(handle, pointer('pointermove', { clientX: 130, clientY: 190 }));
    fireEvent(handle, pointer('pointermove', { clientX: 100, clientY: 200 }));

    expect(onMove).toHaveBeenCalledTimes(2);
    expect(onMove.mock.calls[0][0]).toEqual({ dx: 30, dy: -10 });
    // deltas are measured from the START, not from the previous move
    expect(onMove.mock.calls[1][0]).toEqual({ dx: 0, dy: 0 });
  });

  it('hands the native event to onMove, so a caller can map its own coordinates', () => {
    const { handle, onMove } = setup();

    fireEvent(handle, pointer('pointerdown', { clientX: 0, clientY: 0 }));
    fireEvent(handle, pointer('pointermove', { clientX: 42, clientY: 7 }));

    const event = onMove.mock.calls[0][1] as MouseEvent;
    expect(event.type).toBe('pointermove');
    expect([event.clientX, event.clientY]).toEqual([42, 7]);
  });

  it('starts, flags dragging, and commits on pointer-up', () => {
    const { handle, onStart, onEnd, onCancel } = setup();

    fireEvent(handle, pointer('pointerdown', { clientX: 5, clientY: 5 }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(handle.getAttribute('data-dragging')).toBe('true');

    fireEvent(handle, pointer('pointerup', { clientX: 9, clientY: 9 }));

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect((onEnd.mock.calls[0][0] as MouseEvent).type).toBe('pointerup');
    expect(onCancel).not.toHaveBeenCalled();
    expect(handle.getAttribute('data-dragging')).toBe('false');
  });

  it('commits on a pointer-up that never moved (a click on the handle)', () => {
    const { handle, onMove, onEnd } = setup();

    fireEvent(handle, pointer('pointerdown', { clientX: 5, clientY: 5 }));
    fireEvent(handle, pointer('pointerup', { clientX: 5, clientY: 5 }));

    expect(onMove).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('cancels on pointercancel, and commits nothing', () => {
    const { handle, onCancel, onEnd } = setup();

    fireEvent(handle, pointer('pointerdown', { clientX: 5, clientY: 5 }));
    fireEvent(handle, pointer('pointermove', { clientX: 50, clientY: 50 }));
    fireEvent(handle, pointer('pointercancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
    expect(handle.getAttribute('data-dragging')).toBe('false');
  });

  it('cancels on Escape, and commits nothing', () => {
    const { handle, onCancel, onEnd } = setup();

    fireEvent(handle, pointer('pointerdown', { clientX: 5, clientY: 5 }));
    fireEvent(handle, pointer('pointermove', { clientX: 50, clientY: 50 }));
    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
    expect(handle.getAttribute('data-dragging')).toBe('false');
  });

  it('keeps that Escape to itself, so it does not also deselect', () => {
    const deselect = vi.fn();
    document.body.addEventListener('keydown', deselect);
    const { handle } = setup();

    fireEvent(handle, pointer('pointerdown', { clientX: 5, clientY: 5 }));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(deselect).not.toHaveBeenCalled();

    // …and once the drag is over, Escape belongs to the editor again
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(deselect).toHaveBeenCalledTimes(1);

    document.body.removeEventListener('keydown', deselect);
  });

  it('ignores keys other than Escape while dragging', () => {
    const { handle, onCancel } = setup();

    fireEvent(handle, pointer('pointerdown', { clientX: 5, clientY: 5 }));
    fireEvent.keyDown(document.body, { key: 'Delete' });
    fireEvent.keyDown(document.body, { key: 'a' });

    expect(onCancel).not.toHaveBeenCalled();
    expect(handle.getAttribute('data-dragging')).toBe('true');
  });

  it('detaches after an end and after a cancel: later pointer events are dead', () => {
    const { handle, onMove, onEnd, onCancel } = setup();

    fireEvent(handle, pointer('pointerdown', { clientX: 0, clientY: 0 }));
    fireEvent(handle, pointer('pointerup'));
    fireEvent(handle, pointer('pointermove', { clientX: 90, clientY: 90 }));
    fireEvent(handle, pointer('pointerup'));
    expect(onMove).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);

    fireEvent(handle, pointer('pointerdown', { clientX: 0, clientY: 0 }));
    fireEvent(handle, pointer('pointercancel'));
    fireEvent(handle, pointer('pointermove', { clientX: 90, clientY: 90 }));
    fireEvent(handle, pointer('pointerup'));
    expect(onMove).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('starts nothing on a non-left button, and lets that event through', () => {
    const { handle, onStart, onMove } = setup();
    const bubbled = vi.fn();
    document.body.addEventListener('pointerdown', bubbled);

    fireEvent(handle, pointer('pointerdown', { button: 2, clientX: 5, clientY: 5 }));
    fireEvent(handle, pointer('pointermove', { clientX: 50, clientY: 50 }));

    expect(onStart).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
    expect(bubbled).toHaveBeenCalledTimes(1);

    document.body.removeEventListener('pointerdown', bubbled);
  });

  it('swallows the pointer-down it takes, so the pane neither pans nor deselects', () => {
    const { handle } = setup();
    const bubbled = vi.fn();
    document.body.addEventListener('pointerdown', bubbled);

    const event = pointer('pointerdown', { clientX: 5, clientY: 5 });
    fireEvent(handle, event);

    expect(bubbled).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);

    document.body.removeEventListener('pointerdown', bubbled);
  });

  it('runs one gesture at a time: a second pointer-down is ignored', () => {
    const { handle, onStart, onEnd } = setup();

    fireEvent(handle, pointer('pointerdown', { clientX: 0, clientY: 0 }));
    fireEvent(handle, pointer('pointerdown', { clientX: 40, clientY: 40 }));

    expect(onStart).toHaveBeenCalledTimes(1);

    fireEvent(handle, pointer('pointerup'));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('always calls the CURRENT handlers, not the ones the drag started with', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Harness onMove={first} />);
    const handle = screen.getByTestId('handle');

    fireEvent(handle, pointer('pointerdown', { clientX: 0, clientY: 0 }));
    fireEvent(handle, pointer('pointermove', { clientX: 10, clientY: 0 }));
    expect(first).toHaveBeenCalledTimes(1);

    // a re-render mid-drag swaps the handler; the live gesture must follow
    rerender(<Harness onMove={second} />);
    fireEvent(handle, pointer('pointermove', { clientX: 20, clientY: 0 }));

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('lets go on unmount, without calling a handler on a component that is gone', () => {
    const { handle, onMove, onEnd, onCancel } = setup();

    fireEvent(handle, pointer('pointerdown', { clientX: 0, clientY: 0 }));
    cleanup();
    fireEvent(handle, pointer('pointermove', { clientX: 50, clientY: 50 }));
    fireEvent(handle, pointer('pointerup'));

    expect(onMove).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
