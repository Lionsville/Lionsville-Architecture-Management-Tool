import { describe, expect, it, vi } from 'vitest';
import {
  cancelElkLayout, canCancelElkLayout, configureElkWorker, isLayoutRefusal, layoutGraph,
} from './elkLayout';

/**
 * Laying out beside the thread, and calling it off.
 *
 * The worker itself is elkjs's own built script and there is nothing of ours in
 * it. What is ours is the arrangement around it: that a host which hands over a
 * factory gets the worker-backed engine rather than the in-process one, that a
 * cancel terminates the thread, and that the caller is then refused rather than
 * left waiting for an answer that is never coming. A stand-in worker that never
 * replies is exactly the right shape for testing all three — it is the slow
 * board, held still.
 *
 * Its own file because {@link configureElkWorker} is module state with no way
 * back, which is right for a composition root and wrong to leave lying about
 * for the next test in the same file.
 */

function fakeWorker() {
  const worker = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onmessage: null,
    onerror: null,
  };
  return worker;
}

describe('the layout worker', () => {
  it('uses the factory the host handed over, and can be called off', async () => {
    const workers: ReturnType<typeof fakeWorker>[] = [];
    configureElkWorker(() => {
      const worker = fakeWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    });
    expect(canCancelElkLayout()).toBe(true);

    const pass = layoutGraph([{ id: 'a', width: 200, height: 130 }], []);
    const refused = pass.catch((error: unknown) => error);

    // The engine is imported lazily, so the worker does not exist until the
    // import has landed.
    await vi.waitFor(() => expect(workers).toHaveLength(1));
    cancelElkLayout();

    expect(workers[0].terminate).toHaveBeenCalled();
    expect(isLayoutRefusal(await refused, 'cancelled')).toBe(true);
  });

  it('does nothing when nothing is running', () => {
    expect(() => cancelElkLayout()).not.toThrow();
  });
});
