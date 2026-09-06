import { toPng } from 'html-to-image';
import type { ExportDiagramPngOptions, ExportTitleBlock, Rect } from '../../model/types';

/**
 * Export the rendered diagram to a PNG Blob (ported from the POC, extended
 * with a title block). The title block — client / title / author / date,
 * engineering-drawing style, bottom-right — is composed onto the bitmap at
 * export time only; it never appears on the live canvas.
 *
 * Colours: the canvas content is captured as rendered (the host passes the
 * theme background via `background`); the title block itself uses fixed ink
 * on white so it stays legible when the PNG lands in documents.
 */
export async function exportDiagramPng(options: ExportDiagramPngOptions): Promise<Blob> {
  const viewport =
    options.container.querySelector<HTMLElement>('.react-flow__viewport') ??
    (options.container.classList.contains('react-flow__viewport') ? options.container : null);
  if (!viewport) {
    throw new Error('exportDiagramPng: no React Flow viewport found inside container');
  }

  const bounds = options.bounds ?? measureNodeBounds(viewport);
  const padding = options.padding ?? 48;
  const background = options.background ?? '#ffffff';
  const width = Math.ceil(bounds.width + padding * 2);
  const height = Math.ceil(bounds.height + padding * 2);
  const pixelRatio = exportPixelRatio(width, height, options.pixelRatio);

  // The board is captured at its own size — one flow pixel is one CSS pixel —
  // and every pixel of resolution then comes from `pixelRatio`. Type rasterised
  // from a shrunken capture cannot be sharpened afterwards; type rasterised at
  // 1:1 and a high ratio is drawn by the browser at that ratio, so it stays
  // crisp however large the sheet.
  const transform = { x: padding - bounds.x, y: padding - bounds.y, zoom: 1 };

  // Uploaded logo marks are remote `img` elements. html-to-image DROPS an image
  // it cannot fetch — no throw, no warning — so without this the PNG would
  // quietly lose half its marks on its way into a customer document. Inline them
  // first, restore afterwards, and report what could not be reached.
  const restoreImages = await inlineRemoteImages(viewport);
  let dataUrl: string;
  try {
    dataUrl = await toPng(viewport, {
    backgroundColor: background,
    pixelRatio,
    width,
    height,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
      },
    });
  } finally {
    restoreImages.restore();
  }

  if (restoreImages.failed.length > 0) {
    options.onImagesMissing?.(restoreImages.failed);
  }

  if (!options.titleBlock) return dataUrlToBlob(dataUrl);
  return composeTitleBlock(dataUrl, options.titleBlock, pixelRatio);
}

/**
 * The floor. Two device pixels per CSS pixel is a retina screen, and the least
 * anything leaving this tool should be.
 */
const MIN_PIXEL_RATIO = 2;

/**
 * What the long edge of the bitmap aims for.
 *
 * These drawings get plotted, not just pasted into a slide: 6000px is roughly
 * 300 dpi across an A2 sheet, or 150 dpi across A1 — the sizes a landscape
 * actually gets printed at. A small container diagram therefore comes out at a
 * higher ratio than a whole landscape does, which is the point: the paper is
 * the same size either way.
 */
const TARGET_LONG_EDGE = 6000;

/**
 * The ceiling. Past this a bitmap is only heavier, never more readable — the
 * type is already vector-sharp at the scale it was rasterised.
 */
const MAX_PIXEL_RATIO = 8;

/**
 * What a canvas will actually hold. Chromium refuses a side over 16384px and
 * an area over 2^28 pixels, and it refuses by handing back a blank canvas
 * rather than by throwing — an export nobody can tell went wrong. Sizing down
 * to fit is worth more than a resolution that produces nothing.
 */
const MAX_CANVAS_EDGE = 16_384;
const MAX_CANVAS_AREA = 268_435_456;

/**
 * How many image pixels one CSS pixel of the board becomes.
 *
 * Enough that type is readable on a large sheet, never so many that the canvas
 * gives up. Its own function so the rule can be read, and tested, on its own.
 *
 * A caller that names a ratio gets it, still held to what a canvas can take:
 * a request the browser cannot honour comes back as a blank image, which is a
 * worse answer than a slightly smaller one.
 */
export function exportPixelRatio(width: number, height: number, requested?: number): number {
  const longEdge = Math.max(width, height, 1);
  const wanted = requested ?? Math.min(
    Math.max(MIN_PIXEL_RATIO, TARGET_LONG_EDGE / longEdge),
    MAX_PIXEL_RATIO,
  );
  const limit = Math.min(
    MAX_CANVAS_EDGE / longEdge,
    Math.sqrt(MAX_CANVAS_AREA / Math.max(width * height, 1)),
  );
  // Two decimals, and rounded down rather than to nearest: a ratio multiplies
  // every dimension of the bitmap, so rounding up is how a canvas limit gets
  // exceeded by a whisker and the whole export comes back blank.
  return Math.max(0.01, Math.floor(Math.min(wanted, limit) * 100) / 100);
}

/**
 * Swap every remote `img` inside the capture for a data URI, and hand back a
 * `restore` that puts the original sources back.
 *
 * A mark that cannot be fetched has its `src` cleared rather than left pointing
 * at a URL the capture will drop: an empty `img` renders as the nothing it is,
 * the node's own glyph fallback shows through, and the caller is told which
 * labels were affected. Silence here would produce a diagram that looks finished
 * and is not.
 */
async function inlineRemoteImages(
  viewport: HTMLElement,
): Promise<{ restore(): void; failed: string[] }> {
  const images = Array.from(viewport.querySelectorAll('img'));
  const originals = images.map((image) => ({ image, src: image.getAttribute('src') ?? '' }));
  const failed: string[] = [];

  await Promise.all(
    originals.map(async ({ image, src }) => {
      if (!src || src.startsWith('data:')) return;
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        image.setAttribute('src', await blobToDataUrl(await response.blob()));
      } catch {
        failed.push(image.getAttribute('alt') || src);
        image.setAttribute('src', '');
      }
    }),
  );

  return {
    failed,
    restore() {
      for (const { image, src } of originals) image.setAttribute('src', src);
    },
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('could not read logo bytes'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Fallback bounds: union of the rendered node rects, read from the DOM
 * (each node carries `translate(x, y)` in flow coordinates).
 */
function measureNodeBounds(viewport: HTMLElement): Rect {
  const nodes = viewport.querySelectorAll<HTMLElement>('.react-flow__node');
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const match = /translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(node.style.transform);
    if (!match) continue;
    const x = Number(match[1]);
    const y = Number(match[2]);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + node.offsetWidth);
    maxY = Math.max(maxY, y + node.offsetHeight);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 1200, height: 800 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [, base64] = dataUrl.split(',');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}

const INK = '#1F2733';
const INK_MUTED = '#6B7480';

/**
 * The captions a caller that passes none gets. English, and the same words the
 * block has always carried, so an existing host's PNG is byte-identical.
 */
const DEFAULT_TITLE_BLOCK_LABELS = {
  client: 'CLIENT',
  title: 'TITLE',
  author: 'AUTHOR',
  date: 'DATE',
  legend: 'ASPECTS',
} as const;

async function composeTitleBlock(
  dataUrl: string,
  block: ExportTitleBlock,
  pixelRatio: number,
): Promise<Blob> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrlToBlob(dataUrl);
  ctx.drawImage(image, 0, 0);
  drawTitleBlock(ctx, canvas.width, canvas.height, block, pixelRatio);
  return canvasToBlob(canvas);
}

function drawTitleBlock(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  block: ExportTitleBlock,
  scale: number,
): void {
  const labels = block.labels ?? DEFAULT_TITLE_BLOCK_LABELS;
  const rows: [string, string][] = [
    [labels.client, block.client],
    [labels.title, block.title],
  ];
  if (block.author) rows.push([labels.author, block.author]);
  rows.push([labels.date, block.date ?? new Date().toISOString().slice(0, 10)]);
  if (block.legend) rows.push([labels.legend, block.legend]);

  const width = 300 * scale;
  const rowHeight = 26 * scale;
  const padding = 12 * scale;
  const height = rows.length * rowHeight + padding;
  const x = canvasWidth - width - 20 * scale;
  const y = canvasHeight - height - 20 * scale;

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5 * scale;
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x, y, width, height);

  const labelX = x + padding;
  const valueX = x + 80 * scale;
  rows.forEach(([label, value], index) => {
    const baseline = y + padding / 2 + rowHeight * (index + 0.7);
    ctx.fillStyle = INK_MUTED;
    ctx.font = `600 ${10 * scale}px sans-serif`;
    ctx.fillText(label, labelX, baseline);
    ctx.fillStyle = INK;
    ctx.font = `${index === 1 ? 700 : 400} ${13 * scale}px sans-serif`;
    ctx.fillText(fitText(ctx, value, width - (valueX - x) - padding), valueX, baseline);
  });
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}…`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('exportDiagramPng: failed to decode capture'));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('exportDiagramPng: canvas serialisation failed'));
    }, 'image/png');
  });
}
