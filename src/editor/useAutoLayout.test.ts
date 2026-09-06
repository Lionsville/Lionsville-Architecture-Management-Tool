// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { settlingOptions, useAutoLayout, type UseAutoLayoutArgs } from './useAutoLayout';
import { DEFAULT_TIDY_OPTIONS, type TidyOptions } from '../layout/tidy';
import type { DesignDiagram } from '../model/types';

/**
 * One case per precondition, because the preconditions ARE the specification of
 * when a diagram may be rearranged without being asked. Getting any of them wrong
 * means the tool moves a board somebody curated.
 */
function diagram(over: Partial<DesignDiagram> = {}): DesignDiagram {
  return {
    id: 'd1',
    kind: 'layer7',
    name: 'L7',
    placements: [{ elementId: 'e1', zone: 'landscape', x: 10, y: 20 }],
    ...over,
  };
}

function render(over: Partial<UseAutoLayoutArgs> = {}) {
  const run = vi.fn<(options: TidyOptions) => Promise<void>>().mockResolvedValue(undefined);
  const onSettled = vi.fn<(diagramId: string) => void>();
  const args: UseAutoLayoutArgs = {
    diagram: diagram({ needsLayout: true }),
    readOnly: false,
    busy: undefined,
    options: DEFAULT_TIDY_OPTIONS,
    run,
    onSettled,
    ...over,
  };
  const view = renderHook((props: UseAutoLayoutArgs) => useAutoLayout(props), {
    initialProps: args,
  });
  return { ...view, run, onSettled, args };
}

describe('useAutoLayout — when it runs', () => {
  it('lays out a flagged diagram, once', async () => {
    const { run, rerender, args } = render();
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));

    // Re-rendering must not run it again — the session ref is written BEFORE the
    // pass starts, so even a failure cannot loop and a double render cannot
    // double-run.
    rerender({ ...args });
    rerender({ ...args });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not touch a diagram nobody flagged', async () => {
    // The default, and the one that matters most: every board a person built.
    const { run } = render({ diagram: diagram() });
    await new Promise((r) => setTimeout(r, 10));
    expect(run).not.toHaveBeenCalled();
  });

  it('runs exactly once when BOTH sources name the same diagram', async () => {
    // The two-sources seam: a diagram can legitimately be created in this session
    // and flagged server-side. The session ref is what makes that harmless.
    const { run } = render({ diagram: diagram({ needsLayout: true }) });
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 10));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('never runs read-only', async () => {
    // A design version is an immutable snapshot; it must not spend a quarter of a
    // second of somebody's main thread computing a layout it will throw away.
    const { run } = render({ readOnly: true });
    await new Promise((r) => setTimeout(r, 10));
    expect(run).not.toHaveBeenCalled();
  });

  it('waits while another layout action is running', async () => {
    const { run, rerender, args } = render({ busy: 'tidy' });
    await new Promise((r) => setTimeout(r, 10));
    expect(run).not.toHaveBeenCalled();

    rerender({ ...args, busy: undefined });
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  });

  it('skips an empty diagram', async () => {
    const { run } = render({ diagram: diagram({ needsLayout: true, placements: [] }) });
    await new Promise((r) => setTimeout(r, 10));
    expect(run).not.toHaveBeenCalled();
  });

  it('waits for the diagram to resolve', async () => {
    const { run, rerender, args } = render({ diagram: undefined });
    await new Promise((r) => setTimeout(r, 10));
    expect(run).not.toHaveBeenCalled();

    rerender({ ...args, diagram: diagram({ needsLayout: true }) });
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  });
});

describe('useAutoLayout — reporting the outcome', () => {
  it('tells the host once, after a pass that produced placements', async () => {
    const { onSettled } = render();
    await waitFor(() => expect(onSettled).toHaveBeenCalledWith('d1'));
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('does NOT tell the host when the pass threw', async () => {
    // The host clears the persisted flag from `onSettled`. Clearing it for a pass
    // that produced nothing would mean the diagram is never laid out again — so a
    // failure leaves the flag set and the board gets one more attempt next open.
    const run = vi.fn<(o: TidyOptions) => Promise<void>>().mockRejectedValue(new Error('elk'));
    const { onSettled } = render({ run });
    await waitFor(() => expect(run).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('does not retry in the same session after a failure', async () => {
    // One report per open, never a stream. The manual Tidy button still works.
    const run = vi.fn<(o: TidyOptions) => Promise<void>>().mockRejectedValue(new Error('elk'));
    const { rerender, args } = render({ run });
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    rerender({ ...args, run });
    rerender({ ...args, run });
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('settlingOptions — the pin rule', () => {
  it('forces all three pins off', async () => {
    // `TidyOptions` is session state SHARED ACROSS DIAGRAMS, so "the user ticked
    // every pin box" does not mean "protect this board" — it means they ticked
    // boxes to protect some other board earlier in the same session. Honouring
    // one here leaks that setting onto a diagram they have never seen, and a
    // carried-over pin produces exactly the machine grid this pass exists to
    // replace, arrived at silently.
    const pinned: TidyOptions = {
      direction: 'vertical',
      density: 'spacious',
      pinGroups: true,
      pinGroupContents: true,
      pinAnchorPoints: true,
    };
    expect(settlingOptions(pinned)).toEqual({
      direction: 'vertical',
      density: 'spacious',
      pinGroups: false,
      pinGroupContents: false,
      pinAnchorPoints: false,
    });
  });

  it('keeps direction and density, because their failure is recoverable', async () => {
    // The asymmetry: a carried-over direction gives a valid board that one button
    // press re-flows. A carried-over pin gives no board at all.
    const { run } = render({
      options: { ...DEFAULT_TIDY_OPTIONS, direction: 'hybrid', density: 'compact', pinGroups: true },
    });
    await waitFor(() => expect(run).toHaveBeenCalled());
    expect(run.mock.calls[0][0]).toMatchObject({
      direction: 'hybrid',
      density: 'compact',
      pinGroups: false,
    });
  });
});
