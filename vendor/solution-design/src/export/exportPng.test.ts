// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const toPng = vi.fn(async () => 'data:image/png;base64,AAAA');

vi.mock('html-to-image', () => ({ toPng: (...args: unknown[]) => toPng(...(args as [])) }));
vi.mock('@xyflow/react', () => ({
  getViewportForBounds: () => ({ x: 0, y: 0, zoom: 1 }),
}));

const { exportDiagramPng } = await import('./exportPng');

/**
 * The export inlines every remote image before capturing, because html-to-image
 * DROPS an image it cannot fetch without throwing. Left alone, a PNG heading into
 * a customer document would quietly lose its uploaded logo marks.
 */

afterEach(() => {
  toPng.mockClear();
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
    toPng.mockImplementationOnce(async () => {
      srcDuringCapture = srcOf(container);
      return 'data:image/png;base64,AAAA';
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
    toPng.mockRejectedValueOnce(new Error('canvas exploded'));
    vi.stubGlobal('fetch', vi.fn(async () => okSvg()));

    await expect(
      exportDiagramPng({ container, bounds: { x: 0, y: 0, width: 100, height: 100 } }),
    ).rejects.toThrow('canvas exploded');

    expect(srcOf(container)).toBe(original);
  });
});
