import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoutePreviewChannel } from './routePreviewChannel';

/**
 * The coalescing channel behind the drag preview.
 *
 * Every test here is about a failure mode with a name, not about the API surface:
 * a backlog that makes the preview lag further the harder you drag, an answer that
 * lands after the gesture it belongs to, and a worker terminated so often it never
 * finishes initialising.
 */

/** A pass whose completion the test decides. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createRoutePreviewChannel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('discards intermediate inputs unsent rather than queueing them', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const sent: number[] = [];
    const pending = [first, second];
    const channel = createRoutePreviewChannel<number, string>({
      route: (input) => {
        sent.push(input);
        return pending.shift()!.promise;
      },
      onResult: () => undefined,
      watchdogMs: 1000,
      onStuck: () => undefined,
    });

    channel.send(1);
    expect(sent).toEqual([1]);
    // Three more frames arrive while pass 1 is still running.
    channel.send(2);
    channel.send(3);
    channel.send(4);
    expect(sent).toEqual([1]);

    first.resolve('a');
    await vi.advanceTimersByTimeAsync(0);

    // Only the NEWEST survives. 2 and 3 are never sent — that is the whole point:
    // a queue would deliver routes for positions the card left seconds ago.
    expect(sent).toEqual([1, 4]);
  });

  it('applies results newest-last and never applies one from a stopped generation', async () => {
    const inFlight = deferred<string>();
    const applied: string[] = [];
    const channel = createRoutePreviewChannel<number, string>({
      route: () => inFlight.promise,
      onResult: (result) => applied.push(result),
      watchdogMs: 1000,
      onStuck: () => undefined,
    });

    channel.send(1);
    channel.stop(); // the drag ended while the pass was still running
    inFlight.resolve('late');
    await vi.advanceTimersByTimeAsync(0);

    expect(applied).toEqual([]);
  });

  it('sends nothing more after stop', async () => {
    const sent: number[] = [];
    const channel = createRoutePreviewChannel<number, string>({
      route: (input) => {
        sent.push(input);
        return Promise.resolve('ok');
      },
      onResult: () => undefined,
      watchdogMs: 1000,
      onStuck: () => undefined,
    });

    channel.send(1);
    await vi.advanceTimersByTimeAsync(0);
    channel.stop();
    channel.send(2);
    await vi.advanceTimersByTimeAsync(0);

    expect(sent).toEqual([1]);
  });

  it('keeps previewing when a pass fails', async () => {
    const failing = deferred<string>();
    const applied: string[] = [];
    let call = 0;
    const channel = createRoutePreviewChannel<number, string>({
      route: () => (call++ === 0 ? failing.promise : Promise.resolve('recovered')),
      onResult: (result) => applied.push(result),
      watchdogMs: 1000,
      onStuck: () => undefined,
    });

    channel.send(1);
    channel.send(2);
    failing.reject(new Error('router said no'));
    await vi.advanceTimersByTimeAsync(0);

    // A failed preview pass is reported nowhere and stops nothing: nobody pressed
    // anything, and the drag-end pass will answer for real in a moment.
    expect(applied).toEqual(['recovered']);
  });

  it('never reports stuck for ordinary supersession, however many inputs arrive', async () => {
    const onStuck = vi.fn();
    const channel = createRoutePreviewChannel<number, string>({
      route: () => Promise.resolve('ok'),
      onResult: () => undefined,
      watchdogMs: 1000,
      onStuck,
    });

    for (let i = 0; i < 200; i++) {
      channel.send(i);
      await vi.advanceTimersByTimeAsync(0);
    }
    await vi.advanceTimersByTimeAsync(5000);

    // Supersession is not a failure. If this ever fires, the worker is being
    // terminated at frame rate and every replacement re-initialises the WASM
    // module, so the preview would never complete a pass at all.
    expect(onStuck).not.toHaveBeenCalled();
  });

  it('reports stuck once when a pass never answers, and then goes quiet', async () => {
    const never = deferred<string>();
    const onStuck = vi.fn();
    const sent: number[] = [];
    const channel = createRoutePreviewChannel<number, string>({
      route: (input) => {
        sent.push(input);
        return never.promise;
      },
      onResult: () => undefined,
      watchdogMs: 1000,
      onStuck,
    });

    channel.send(1);
    channel.send(2);
    await vi.advanceTimersByTimeAsync(999);
    expect(onStuck).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2);
    expect(onStuck).toHaveBeenCalledTimes(1);

    // Finished: no further passes, and no second report.
    channel.send(3);
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent).toEqual([1]);
    expect(onStuck).toHaveBeenCalledTimes(1);
  });

  it('does not report stuck for a pass that answers inside the watchdog', async () => {
    const slow = deferred<string>();
    const onStuck = vi.fn();
    const channel = createRoutePreviewChannel<number, string>({
      route: () => slow.promise,
      onResult: () => undefined,
      watchdogMs: 1000,
      onStuck,
    });

    channel.send(1);
    await vi.advanceTimersByTimeAsync(900);
    slow.resolve('ok');
    await vi.advanceTimersByTimeAsync(5000);

    expect(onStuck).not.toHaveBeenCalled();
  });
});
