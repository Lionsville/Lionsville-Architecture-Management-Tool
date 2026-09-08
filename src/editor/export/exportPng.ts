import { toCanvas } from 'html-to-image';
import type { Rect } from '../../model/types';
import type { ExportDiagramPngOptions, ExportLegend, ExportSwatch, ExportTitleBlock } from '../props';
import type { ExportTokens } from '../theme/tokens';

/**
 * Export the rendered diagram to a PNG Blob (ported from the POC, extended
 * with a title block). The title block — title / client / author / date and
 * the aspect legend, engineering-drawing style — is a strip along the bottom
 * of the sheet, composed onto the bitmap at export time only; it never appears
 * on the live canvas. On a container diagram the C4 corner takes the title's
 * place in it: the level, the subject, a sentence and the date.
 *
 * Colours: the canvas content is captured as rendered (the host passes the
 * theme background via `background`), and the strip is drawn in the tokens of
 * the same theme (`palette`), so a dark export is dark to its bottom edge. A
 * caller that passes no palette gets ink on white, the block it always had.
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
  const footer = exportFooterHeight(options.titleBlock);
  const width = Math.ceil(bounds.width + padding * 2);
  // The strip is below the drawing, not over it: the sheet is taller by its
  // height and the capture paints background there for the strip to cover.
  const height = Math.ceil(bounds.height + padding * 2) + footer;
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
  let canvas: HTMLCanvasElement;
  try {
    // `toCanvas` rather than `toPng`, and this is not a detail on a large board.
    // The PNG route encoded the bitmap, wrote it into a base64 string, decoded
    // that string back into an image and drew it onto a SECOND canvas to add the
    // title block — four passes over the pixels and, for a 6000px landscape, a
    // couple of hundred megabytes of string held alongside two canvases. The
    // title block is drawn onto the canvas that was captured, and the encode
    // happens once, into the blob that leaves.
    canvas = await toCanvas(viewport, {
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

  if (options.titleBlock) {
    // No 2d context is a browser that has already declined the bitmap. The
    // capture is whatever it is; refusing to hand it over as well would turn a
    // picture without a caption into no picture at all.
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawTitleBlock(
        ctx, canvas.width, canvas.height, options.titleBlock,
        options.palette ?? INK_ON_WHITE, pixelRatio,
      );
    }
  }
  return canvasToBlob(canvas);
}

/**
 * How large the bitmap will be, before anything is rasterised.
 *
 * So a caller can ask before it commits somebody's machine to it: the ratio is
 * chosen for paper (see {@link exportPixelRatio}), which on a landscape that
 * already measures thousands of flow pixels is tens of megapixels and several
 * seconds of an unresponsive tab. The arithmetic is the same as the export's,
 * and it is here rather than in the caller so it cannot drift from it.
 */
export function exportBitmapSize(
  bounds: Rect, padding = 48, requested?: number, footer = 0,
): { width: number; height: number; megapixels: number; pixelRatio: number } {
  const width = Math.ceil(bounds.width + padding * 2);
  const height = Math.ceil(bounds.height + padding * 2) + footer;
  const pixelRatio = exportPixelRatio(width, height, requested);
  const pixels = width * pixelRatio * height * pixelRatio;
  return {
    width: Math.round(width * pixelRatio),
    height: Math.round(height * pixelRatio),
    megapixels: Math.round(pixels / 1e6),
    pixelRatio,
  };
}

/**
 * Above this many megapixels, a caller should ask first.
 *
 * Roughly a 6000x6000 sheet. Below it the export is a few seconds; above it the
 * cost climbs with the area and the browser is doing it on the main thread with
 * no way to stop — which is exactly why the protection is a question BEFORE it
 * starts rather than a progress bar during it. A progress bar would be a lie:
 * neither `toCanvas` nor `toBlob` can be interrupted or report where they are,
 * so a Cancel could only abandon a result the machine is going to finish
 * computing anyway.
 */
export const LARGE_EXPORT_MEGAPIXELS = 36;

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

/**
 * The colours a caller that passes no palette gets: ink on white, which is
 * the block every existing host's PNG carried.
 */
const INK_ON_WHITE: ExportTokens = {
  background: '#ffffff',
  panel: '#ffffff',
  ink: '#1F2733',
  inkMuted: '#6B7480',
  border: '#1F2733',
  accent: '#1F2733',
};

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

/** The strip's rows, in CSS pixels of the sheet: one line of cells, and a legend line when there is one. */
const FOOTER_ROW = 60;
const FOOTER_C4_ROW = 84;
const FOOTER_LEGEND_ROW = 22;
/** A cell for client, author or date; the title takes whatever is left. */
const FOOTER_CELL = 200;
const FOOTER_PAD = 16;

/**
 * How much taller the sheet is for its title block, in CSS pixels. Zero when
 * there is none. Exported so a caller can size the bitmap before asking for it.
 */
export function exportFooterHeight(block: ExportTitleBlock | undefined): number {
  if (!block) return 0;
  return (block.c4 ? FOOTER_C4_ROW : FOOTER_ROW) + legendRows(block.legend).length * FOOTER_LEGEND_ROW;
}

type LegendRow = { label: string; text?: string; swatches?: ExportSwatch[] };

/** The key's rows, one per kind of colour it explains; none for an empty key. */
function legendRows(legend: ExportLegend | undefined): LegendRow[] {
  if (!legend) return [];
  const rows: LegendRow[] = [];
  if (legend.aspects || legend.statuses?.length) {
    rows.push({ label: legend.labels.aspects, text: legend.aspects, swatches: legend.statuses });
  }
  if (legend.lifecycle?.length) rows.push({ label: legend.labels.lifecycle, swatches: legend.lifecycle });
  return rows;
}

type Cell = { label: string; value: string };

function drawTitleBlock(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  block: ExportTitleBlock,
  palette: ExportTokens,
  scale: number,
): void {
  const labels = block.labels ?? DEFAULT_TITLE_BLOCK_LABELS;
  const footer = exportFooterHeight(block) * scale;
  const top = canvasHeight - footer;
  const pad = FOOTER_PAD * scale;

  ctx.fillStyle = palette.panel;
  ctx.fillRect(0, top, canvasWidth, footer);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(canvasWidth, top);
  ctx.stroke();

  const cells: Cell[] = [{ label: labels.client, value: block.client }];
  if (block.author) cells.push({ label: labels.author, value: block.author });
  cells.push({ label: labels.date, value: block.date ?? new Date().toISOString().slice(0, 10) });

  const cellWidth = FOOTER_CELL * scale;
  const titleWidth = Math.max(cellWidth, canvasWidth - cells.length * cellWidth);
  const labelBaseline = top + pad + 9 * scale;
  const valueBaseline = labelBaseline + 19 * scale;

  // The title cell: the C4 corner on a container diagram, the plain caption
  // on anything else.
  if (block.c4) {
    ctx.fillStyle = palette.accent;
    ctx.font = `600 ${10 * scale}px sans-serif`;
    ctx.fillText(fitText(ctx, block.c4.scope, titleWidth - pad * 2), pad, labelBaseline);
    ctx.fillStyle = palette.ink;
    ctx.font = `700 ${16 * scale}px sans-serif`;
    ctx.fillText(fitText(ctx, block.c4.title, titleWidth - pad * 2), pad, labelBaseline + 21 * scale);
    ctx.fillStyle = palette.inkMuted;
    ctx.font = `${11 * scale}px sans-serif`;
    ctx.fillText(
      fitText(ctx, `${block.c4.description}  ${block.c4.date}`, titleWidth - pad * 2),
      pad, labelBaseline + 40 * scale,
    );
  } else {
    drawCell(ctx, { label: labels.title, value: block.title }, pad, titleWidth - pad * 2, labelBaseline, valueBaseline, palette, scale, true);
  }

  cells.forEach((cell, index) => {
    const x = titleWidth + index * cellWidth;
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(x, top + pad / 2);
    ctx.lineTo(x, top + (block.c4 ? FOOTER_C4_ROW : FOOTER_ROW) * scale - pad / 2);
    ctx.stroke();
    drawCell(ctx, cell, x + pad, cellWidth - pad * 2, labelBaseline, valueBaseline, palette, scale, false);
  });

  legendRows(block.legend).forEach((row, index) => {
    const rowTop = top + ((block.c4 ? FOOTER_C4_ROW : FOOTER_ROW) + index * FOOTER_LEGEND_ROW) * scale;
    const baseline = rowTop + 10 * scale;
    ctx.fillStyle = palette.inkMuted;
    ctx.font = `600 ${9 * scale}px sans-serif`;
    ctx.fillText(row.label, pad, baseline);
    let x = pad + ctx.measureText(row.label).width + 12 * scale;
    if (row.text) {
      ctx.fillStyle = palette.ink;
      ctx.font = `${11 * scale}px sans-serif`;
      const text = fitText(ctx, row.text, canvasWidth - x - pad);
      ctx.fillText(text, x, baseline);
      x += ctx.measureText(text).width + 20 * scale;
    }
    for (const swatch of row.swatches ?? []) {
      if (x > canvasWidth - pad) break;
      x = drawSwatch(ctx, swatch, x, baseline, palette, scale);
    }
  });
}

/** A badge-coloured chip with its meaning beside it; returns where the next one starts. */
function drawSwatch(
  ctx: CanvasRenderingContext2D,
  swatch: ExportSwatch,
  x: number,
  baseline: number,
  palette: ExportTokens,
  scale: number,
): number {
  const width = 22 * scale;
  const height = 11 * scale;
  const y = baseline - 9 * scale;
  ctx.fillStyle = swatch.token.bg;
  ctx.strokeStyle = swatch.token.border;
  ctx.lineWidth = 1 * scale;
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = palette.ink;
  ctx.font = `${11 * scale}px sans-serif`;
  ctx.fillText(swatch.label, x + width + 5 * scale, baseline);
  return x + width + 5 * scale + ctx.measureText(swatch.label).width + 16 * scale;
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  cell: Cell,
  x: number,
  width: number,
  labelBaseline: number,
  valueBaseline: number,
  palette: ExportTokens,
  scale: number,
  bold: boolean,
): void {
  ctx.fillStyle = palette.inkMuted;
  ctx.font = `600 ${9 * scale}px sans-serif`;
  ctx.fillText(cell.label, x, labelBaseline);
  ctx.fillStyle = palette.ink;
  ctx.font = `${bold ? 700 : 400} ${13 * scale}px sans-serif`;
  ctx.fillText(fitText(ctx, cell.value, width), x, valueBaseline);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}…`;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('exportDiagramPng: canvas serialisation failed'));
    }, 'image/png');
  });
}
