// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * A stand-in for the captured canvas. jsdom has no 2d context and no
 * `toBlob`, so the real thing cannot be produced here — and does not need to
 * be: what these tests are about is what the export asks for and what it puts
 * back, not what a rasteriser draws.
 */
const fakeCanvas = () => ({
  width: 100,
  height: 80,
  getContext: () => null,
  toBlob: (give: (blob: Blob | null) => void) => give(new Blob([], { type: 'image/png' })),
} as unknown as HTMLCanvasElement);

const toCanvas = vi.fn(async () => fakeCanvas());

vi.mock('html-to-image', () => ({ toCanvas: (...args: unknown[]) => toCanvas(...(args as [])) }));

const {
  exportBitmapSize, exportDiagramPng, exportPixelRatio, LARGE_EXPORT_MEGAPIXELS,
} = await import('./exportPng');

/**
 * The export inlines every remote image before capturing, because html-to-image
 * DROPS an image it cannot fetch without throwing. Left alone, a PNG heading into
 * a customer document would quietly lose its uploaded logo marks.
 */

afterEach(() => {
  toCanvas.mockClear();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

/** A viewport holding one node with one remote logo mark. */
function viewportWithLogo(src = 'https://hal.test/logos/salesforce/content') {
  const container = document.createElement('div');
  const viewport = document.createElement('div');
  viewport.className = 'react-flow__viewport';
  const node = document.createElement('div');
  node.className = 'react-flow__node';
  node.style.transform = 'translate(10px, 20px)';
  const image = document.createElement('img');
  image.setAttribute('src', src);
  image.setAttribute('alt', 'Salesforce');

  node.appendChild(image);
  viewport.appendChild(node);
  container.appendChild(viewport);
  document.body.appendChild(container);
  return container;
}

/**
 * The minimal response shape the export reads. Deliberately not a real
 * `Response`: jsdom's FileReader cannot read a Blob that came out of undici's
 * implementation, which would fail the test for a reason that has nothing to do
 * with the code under test.
 */
function okSvg() {
  return {
    ok: true,
    status: 200,
    blob: async () => new Blob(['<svg xmlns="http://www.w3.org/2000/svg" />'], { type: 'image/svg+xml' }),
  } as unknown as Response;
}

function srcOf(container: HTMLElement) {
  return container.querySelector('img')!.getAttribute('src');
}

describe('exportDiagramPng — logo marks', () => {
  it('captures the mark as a data URI and restores the original src afterwards', async () => {
    const container = viewportWithLogo();
    const original = srcOf(container);
    let srcDuringCapture: string | null = null;
    toCanvas.mockImplementationOnce(async () => {
      srcDuringCapture = srcOf(container);
      return fakeCanvas();
    });
    vi.stubGlobal('fetch', vi.fn(async () => okSvg()));

    await exportDiagramPng({ container, bounds: { x: 0, y: 0, width: 100, height: 100 } });

    expect(srcDuringCapture).toMatch(/^data:/);
    // The live canvas must look exactly as it did before the export.
    expect(srcOf(container)).toBe(original);
  });

  it('reports a mark it could not embed instead of shipping a bitmap with a hole', async () => {
    const container = viewportWithLogo();
    const onImagesMissing = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 }) as unknown as Response));

    await exportDiagramPng({
      container,
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      onImagesMissing,
    });

    expect(onImagesMissing).toHaveBeenCalledWith(['Salesforce']);
  });

  it('says nothing when there was nothing to report', async () => {
    const container = viewportWithLogo('data:image/svg+xml;base64,AAAA');
    const onImagesMissing = vi.fn();
    vi.stubGlobal('fetch', vi.fn());

    await exportDiagramPng({
      container,
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      onImagesMissing,
    });

    // Already a data URI: no fetch, no complaint.
    expect(fetch).not.toHaveBeenCalled();
    expect(onImagesMissing).not.toHaveBeenCalled();
  });

  it('restores the original sources even when the capture itself throws', async () => {
    const container = viewportWithLogo();
    const original = srcOf(container);
    toCanvas.mockRejectedValueOnce(new Error('canvas exploded'));
    vi.stubGlobal('fetch', vi.fn(async () => okSvg()));

    await expect(
      exportDiagramPng({ container, bounds: { x: 0, y: 0, width: 100, height: 100 } }),
    ).rejects.toThrow('canvas exploded');

    expect(srcOf(container)).toBe(original);
  });
});

/**
 * What the capture is worth on paper.
 *
 * The board used to be handed to `getViewportForBounds` with a padding in
 * pixels where that function wants a ratio, which pinned the zoom at its 0.1
 * floor: a drawing rasterised at a tenth of its size, in a bitmap sized for the
 * whole of it. It looked like a resolution problem and was a transform
 * problem, so both halves are pinned here — the capture is 1:1, and the pixels
 * come from the ratio.
 */
describe('exportDiagramPng — how much of it survives printing', () => {
  type CaptureOptions = {
    width: number;
    height: number;
    pixelRatio: number;
    style: { transform: string };
  };
  const captureOptions = () =>
    (toCanvas.mock.calls[0] as unknown as [HTMLElement, CaptureOptions])[1];

  it('captures the board at its own size, with the padding around it', async () => {
    const container = viewportWithLogo('data:image/svg+xml;base64,AAAA');

    await exportDiagramPng({
      container,
      bounds: { x: 40, y: 100, width: 1000, height: 600 },
      padding: 48,
    });

    const options = captureOptions();
    expect(options.width).toBe(1096);
    expect(options.height).toBe(696);
    // Not a fitted zoom: the drawing sits at 1:1, moved so its top-left corner
    // lands one padding in from the corner of the image.
    expect(options.style.transform).toBe('translate(8px, -52px) scale(1)');
  });

  it('raises the ratio for a small diagram, so a small drawing still prints large', async () => {
    const container = viewportWithLogo('data:image/svg+xml;base64,AAAA');

    await exportDiagramPng({ container, bounds: { x: 0, y: 0, width: 800, height: 500 }, padding: 0 });

    // 800px of board on a sheet is 7.5 image pixels per board pixel.
    expect(captureOptions().pixelRatio).toBe(7.5);
  });

  it('honours a ratio the caller asked for', async () => {
    const container = viewportWithLogo('data:image/svg+xml;base64,AAAA');

    await exportDiagramPng({
      container,
      bounds: { x: 0, y: 0, width: 1000, height: 1000 },
      padding: 0,
      pixelRatio: 3,
    });

    expect(captureOptions().pixelRatio).toBe(3);
  });
});

describe('exportPixelRatio', () => {
  it('never drops below a retina screen', () => {
    expect(exportPixelRatio(6000, 4000)).toBe(2);
    expect(exportPixelRatio(20000, 400)).toBeLessThan(2); // …unless the canvas says so
  });

  it('aims at the same long edge whatever the board measures', () => {
    expect(exportPixelRatio(3000, 2000) * 3000).toBe(6000);
    expect(exportPixelRatio(1500, 900) * 1500).toBe(6000);
  });

  it('stops magnifying a tiny drawing past the point it helps', () => {
    expect(exportPixelRatio(100, 80)).toBe(8);
  });

  it('stays inside what a canvas will hold, request or no request', () => {
    // A board this size at 2x would be 40000px across; Chromium hands back a
    // blank canvas rather than an error, so the ratio has to give way.
    const ratio = exportPixelRatio(20000, 12000);
    expect(ratio * 20000).toBeLessThanOrEqual(16384);
    expect(ratio * 20000 * ratio * 12000).toBeLessThanOrEqual(268_435_456);
    expect(exportPixelRatio(20000, 12000, 4)).toBe(ratio);
  });
});

/**
 * How big the picture will be, asked before anything is drawn. The arithmetic
 * is the export's own, so a caller that shows the number and a caller that
 * rasterises it cannot disagree about what is about to happen.
 */
describe('exportBitmapSize', () => {
  it('reports the bitmap the export would produce, padding included', () => {
    const size = exportBitmapSize({ x: 0, y: 0, width: 1000, height: 500 }, 50);
    // 1100 x 600 of board; the ratio aims the long edge at 6000.
    expect(size.pixelRatio).toBe(exportPixelRatio(1100, 600));
    expect(size.width).toBe(Math.round(1100 * size.pixelRatio));
    expect(size.height).toBe(Math.round(600 * size.pixelRatio));
  });

  it('counts the megapixels a caller has to decide about', () => {
    const size = exportBitmapSize({ x: 0, y: 0, width: 1904, height: 904 }, 48);
    expect(size.megapixels).toBe(Math.round((size.width * size.height) / 1e6));
  });

  it('leaves an ordinary board under the threshold and a landscape over it', () => {
    // A container diagram, and the default Layer 7 board grown to its ceiling.
    expect(exportBitmapSize({ x: 0, y: 0, width: 900, height: 620 }).megapixels)
      .toBeLessThan(LARGE_EXPORT_MEGAPIXELS);
    expect(exportBitmapSize({ x: 0, y: 0, width: 4800, height: 3200 }).megapixels)
      .toBeGreaterThan(LARGE_EXPORT_MEGAPIXELS);
  });
})
