// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { VIRTUALISE_ABOVE, virtualising } from './DiagramCanvas';
import { HostedEditor } from '../testing/editorHost';
import { installReactFlowMocks } from '../reactFlowTestSetup';
import { syntheticModel } from '../../model/testing/synthetic';
import type { DesignModel } from '../../model/types';

/**
 * Drawing only what is in view, and the one thing that must not be allowed to
 * notice.
 *
 * Everything on the canvas that answers a question about the board — the
 * minimap, the helper lines, a marquee selection, "fit view" — reads React
 * Flow's store, which holds every node whether or not it is drawn. The PNG
 * export is the exception: it captures the viewport ELEMENT, so a board that
 * only draws what is on screen would export what is on screen. That is the
 * failure this file is mostly about, because it is silent — a plausible-looking
 * picture of the wrong thing, on its way into somebody's document.
 */

vi.mock('html-to-image', () => ({
  // Counts what was in the DOM at the moment of capture, which is the whole
  // question. A real rasteriser has nothing to do in jsdom anyway — there is no
  // 2d context and no layout — so the stand-in canvas answers the two things
  // the export asks of it and nothing else.
  toCanvas: vi.fn(async (element: HTMLElement) => {
    captured.push(element.ownerDocument.querySelectorAll('.react-flow__node').length);
    return {
      width: 10,
      height: 10,
      getContext: () => null,
      toBlob: (give: (blob: Blob) => void) => give(new Blob([], { type: 'image/png' })),
    } as unknown as HTMLCanvasElement;
  }),
}));

const captured: number[] = [];

beforeAll(() => installReactFlowMocks());
afterEach(() => { cleanup(); captured.length = 0; });

/** A landscape past the threshold, on one board. */
const big = syntheticModel({
  elements: 230, connections: 300, diagrams: 2, descriptionBytes: 120, decisions: 0, seed: 9,
}) as DesignModel;

function renderEditor(model: DesignModel, activeDiagramId: string) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <div style={{ width: '1200px', height: '800px' }}>
        <HostedEditor model={model} activeDiagramId={activeDiagramId} />
      </div>
    </ThemeProvider>,
  );
}

const drawn = () => document.querySelectorAll('.react-flow__node').length;

/**
 * Mounting a couple of hundred real node components is seconds of work in
 * jsdom, and the default one-second wait is a coin toss for it when the rest of
 * the suite is running beside this file.
 */
const SLOWLY = { timeout: 30_000 };

describe('the rule', () => {
  it('leaves a board anybody arranged by hand alone', () => {
    expect(virtualising(30)).toBe(false);
    expect(virtualising(VIRTUALISE_ABOVE)).toBe(false);
  });

  it('draws only what is in view once a board is an inventory', () => {
    expect(virtualising(VIRTUALISE_ABOVE + 1)).toBe(true);
  });

  it('never leaves a box out while something is reading the DOM', () => {
    expect(virtualising(5_000, true)).toBe(false);
  });
});

/** A board the threshold leaves alone, out of the same generator. */
const small = syntheticModel({
  elements: 60, connections: 80, diagrams: 2, descriptionBytes: 120, decisions: 0, seed: 11,
}) as DesignModel;

describe('what the canvas asks React Flow to draw', () => {
  it('draws every box on a board anybody arranged by hand', async () => {
    renderEditor(small, 'landscape');
    await waitFor(() => expect(drawn()).toBe(small.diagrams[0].placements.length), SLOWLY);
  }, SLOWLY.timeout);

  it('draws fewer than all of them once a board is past the threshold', async () => {
    // What the viewport actually holds is not a question jsdom can answer — it
    // has no layout, so React Flow sees a board at the origin and a window of
    // nothing much. So this asserts the decision rather than the arithmetic:
    // past the threshold the canvas hands React Flow `onlyRenderVisibleElements`
    // and stops drawing boxes it was told are off screen. Whether the right
    // ones are on screen is React Flow's business and a browser's.
    renderEditor(big, 'landscape');
    await waitFor(() => expect(drawn()).toBeGreaterThan(0), SLOWLY);
    expect(drawn()).toBeLessThan(big.diagrams[0].placements.length);
  }, SLOWLY.timeout);

  it('captures the whole board, not the part that happens to be drawn', async () => {
    renderEditor(big, 'landscape');
    await waitFor(() => expect(drawn()).toBeGreaterThan(0), SLOWLY);

    fireEvent.click(screen.getByRole('button', { name: 'Export PNG' }));

    // A board this size is tens of megapixels, so it asks first — and it asks
    // before mounting anything, which is why the answer has to arrive before
    // there is a capture to count.
    const go = await screen.findByRole('button', { name: 'Export anyway' }, SLOWLY);
    expect(captured).toHaveLength(0);
    fireEvent.click(go);

    await waitFor(() => expect(captured).toHaveLength(1), SLOWLY);
    expect(captured[0]).toBe(big.diagrams[0].placements.length);
  }, SLOWLY.timeout);

  it('does not capture a board the user decided against', async () => {
    renderEditor(big, 'landscape');
    await waitFor(() => expect(drawn()).toBeGreaterThan(0), SLOWLY);

    fireEvent.click(screen.getByRole('button', { name: 'Export PNG' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }, SLOWLY));

    await waitFor(
      () => expect((screen.getByRole('button', { name: 'Export PNG' }) as HTMLButtonElement).disabled)
        .toBe(false),
      SLOWLY,
    );
    expect(captured).toHaveLength(0);
  }, SLOWLY.timeout);
});
