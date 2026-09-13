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

  /**
   * Entries are delivered in ONE batch per observer, on the microtask after the
   * last `observe`, the way a browser delivers them once per frame. React Flow
   * observes every node with one observer and answers each delivery with a
   * full measure pass (`updateNodeInternals`: a selector over the whole board,
   * then one per node); delivered one at a time, that pass ran once per node,
   * and jsdom's selector engine compiles afresh on every call — a thirty-node
   * board cost a second of nothing but that. Batched, it is one pass.
   */
  class ResizeObserverMock {
    callback: ResizeObserverCallback;
    private pending = new Set<Element>();
    private scheduled = false;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      this.pending.add(target);
      if (this.scheduled) return;
      this.scheduled = true;
      queueMicrotask(() => {
        this.scheduled = false;
        const entries = [...this.pending].map((observed) => entryFor(observed));
        this.pending.clear();
        if (entries.length > 0) this.callback(entries, this);
      });
    }
    unobserve(target: Element) {
      this.pending.delete(target);
    }
    disconnect() {
      this.pending.clear();
    }
  }

  // Newer @xyflow versions read entry.contentRect — jsdom has no layout, so
  // synthesize one from the offset shims below.
  function entryFor(target: Element): ResizeObserverEntry {
    const width = (target as HTMLElement).offsetWidth || 800;
    const height = (target as HTMLElement).offsetHeight || 600;
    const contentRect = {
      x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height, toJSON: () => ({}),
    };
    return { target, contentRect } as unknown as ResizeObserverEntry;
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
