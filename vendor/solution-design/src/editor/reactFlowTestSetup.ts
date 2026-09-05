/**
 * jsdom shims React Flow needs to render (per the React Flow testing guide):
 * ResizeObserver, DOMMatrixReadOnly, layout dimensions, SVGElement.getBBox, and
 * the pointer-capture API every drag gesture opens with (jsdom implements none
 * of it). Imported explicitly by jsdom component tests — node-env tests stay
 * lean.
 */
export function installReactFlowMocks(): void {
  for (const name of ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture'] as const) {
    if (globalThis.HTMLElement.prototype[name]) continue;
    Object.defineProperty(globalThis.HTMLElement.prototype, name, {
      configurable: true,
      value: () => false,
    });
  }

  class ResizeObserverMock {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      // Newer @xyflow versions read entry.contentRect — jsdom has no layout,
      // so synthesize one from the offset shims below.
      const width = (target as HTMLElement).offsetWidth || 800;
      const height = (target as HTMLElement).offsetHeight || 600;
      const contentRect = {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        width,
        height,
        toJSON: () => ({}),
      };
      this.callback([{ target, contentRect } as unknown as ResizeObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

  class DOMMatrixReadOnlyMock {
    m22: number;
    constructor(transform?: string) {
      const scale = transform?.match(/scale\(([1-9.]+)\)/)?.[1];
      this.m22 = scale !== undefined ? Number(scale) : 1;
    }
  }
  globalThis.DOMMatrixReadOnly =
    DOMMatrixReadOnlyMock as unknown as typeof DOMMatrixReadOnly;

  Object.defineProperties(globalThis.HTMLElement.prototype, {
    offsetHeight: {
      configurable: true,
      get() {
        return Number.parseFloat((this as HTMLElement).style.height) || 600;
      },
    },
    offsetWidth: {
      configurable: true,
      get() {
        return Number.parseFloat((this as HTMLElement).style.width) || 800;
      },
    },
  });

  (globalThis.SVGElement.prototype as SVGElement & { getBBox?: () => DOMRect }).getBBox = () =>
    ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;
}
