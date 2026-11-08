// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { Rect } from '../../model/types';
import { coloursOf, tokenVariables } from '../../widgets/kit/tokens';

/**
 * The browser's own Print over a board: File › Print, or ⌘P while a dialog keeps
 * the key from Export. A board framed whole on one upright sheet printed at about
 * a third of its size, where a card is drawn as its marks alone; so the board is
 * printed on landscape sheets, its cards in the form that says their names, and
 * on two sheets side by side rather than smaller than a name can be read.
 *
 * The sheets are a copy of the drawing as it stands, each with its own framing,
 * so the canvas the person works in is never moved for them.
 */

/** A landscape A4 or Letter sheet inside the margins `@page` sets, in CSS pixels: the narrower of the two, Letter, and the lower, A4, so either holds it. */
export const PRINT_SHEET = { width: 990, height: 725 } as const;

/** Room round the drawing on a sheet. */
export const PRINT_MARGIN = 12;

/** Room under it, where the note goes when there is one. */
export const PRINT_FOOT = 24;

/** Below this a card's name is too small to read on paper: two sheets come before it. */
export const PRINT_READABLE = 0.6;

/** Below this even a name split over two sheets is hard to read, and the sheet says where the full size is. */
export const PRINT_NOTE_BELOW = 0.5;

const PAGE_RULE = '@page { size: landscape; margin: 8mm; }';

export type PrintLayout = {
  /** One scale for every sheet, so a card is the same size on both. */
  zoom: number;
  /** The part of the board each sheet shows, in the board's own units. */
  parts: Rect[];
  /** Even on two sheets the names are smaller than reads well: the sheet says where the full size is. */
  small: boolean;
};

/**
 * How a board of these bounds is laid over sheets: one where its names read, else
 * two side by side or one over the other, whichever draws it larger, cut where no
 * card stands if there is such a place near the middle. Never over 100%.
 */
export function printLayout(bounds: Rect, cards: readonly Rect[], sheet: { width: number; height: number } = PRINT_SHEET): PrintLayout | undefined {
  if (!(bounds.width > 0) || !(bounds.height > 0)) return undefined;
  const room = { width: sheet.width - 2 * PRINT_MARGIN, height: sheet.height - PRINT_MARGIN - PRINT_FOOT };
  const fit = (width: number, height: number) => Math.min(room.width / width, room.height / height, 1);
  const whole = fit(bounds.width, bounds.height);
  if (whole >= PRINT_READABLE) return { zoom: whole, parts: [bounds], small: false };

  const across = seam(bounds.x, bounds.width, cards.map((card) => [card.x, card.x + card.width] as const));
  const down = seam(bounds.y, bounds.height, cards.map((card) => [card.y, card.y + card.height] as const));
  const acrossZoom = fit(Math.max(across - bounds.x, bounds.x + bounds.width - across), bounds.height);
  const downZoom = fit(bounds.width, Math.max(down - bounds.y, bounds.y + bounds.height - down));
  const zoom = Math.max(acrossZoom, downZoom);
  const parts: Rect[] = acrossZoom >= downZoom
    ? [{ ...bounds, width: across - bounds.x }, { ...bounds, x: across, width: bounds.x + bounds.width - across }]
    : [{ ...bounds, height: down - bounds.y }, { ...bounds, y: down, height: bounds.y + bounds.height - down }];
  return { zoom, parts, small: zoom < PRINT_NOTE_BELOW };
}

/**
 * Where to cut a length in two: at the edge of a card nearest the middle that no
 * card stands across, between a third and two thirds; else the middle. A card as
 * wide as much of the board — a band, a group — is no reason not to cut.
 */
export function seam(start: number, length: number, spans: readonly (readonly [number, number])[]): number {
  const middle = start + length / 2;
  const small = spans.filter(([from, to]) => to - from < length * 0.4);
  const clear = (at: number) => small.every(([from, to]) => at <= from || at >= to);
  let best: number | undefined;
  for (const [from, to] of small) {
    for (const at of [from, to]) {
      if (at < start + length / 3 || at > start + (2 * length) / 3 || !clear(at)) continue;
      if (best === undefined || Math.abs(at - middle) < Math.abs(best - middle)) best = at;
    }
  }
  return best ?? middle;
}

/**
 * Puts the sheets for this layout at the end of the document, each a copy of the
 * board drawn in its full-name form, and asks for landscape sheets; the print rule
 * in `board.css` prints them alone. Answers what takes them away again.
 */
export function printSheets(board: HTMLElement, layout: PrintLayout, note: string | undefined): () => void {
  const document = board.ownerDocument;
  const page = document.createElement('style');
  page.textContent = PAGE_RULE;
  document.head.appendChild(page);

  // Sections, not divs: the frame's print rule lets every div at the top of the body grow to its content.
  const sheets = document.createElement('section');
  sheets.className = 'lv-print-sheets';
  sheets.setAttribute('aria-hidden', 'true');
  // Ink on white whatever the window is in, as a printed page is (`printPage`).
  for (const [name, value] of Object.entries(tokenVariables('light'))) sheets.style.setProperty(name, value);
  layout.parts.forEach((part, index) => {
    const sheet = document.createElement('section');
    sheet.className = 'lv-print-sheet';
    sheet.style.width = `${PRINT_SHEET.width}px`;
    sheet.style.height = `${PRINT_SHEET.height}px`;
    const clip = document.createElement('div');
    clip.className = 'lv-print-sheet__clip';
    clip.style.left = `${PRINT_MARGIN}px`;
    clip.style.top = `${PRINT_MARGIN}px`;
    clip.style.width = `${Math.ceil(part.width * layout.zoom)}px`;
    clip.style.height = `${Math.ceil(part.height * layout.zoom)}px`;
    clip.appendChild(drawing(board, { x: -part.x * layout.zoom, y: -part.y * layout.zoom, zoom: layout.zoom }, `lv-print-${index}-`));
    sheet.appendChild(clip);
    if (note && index === 0) {
      const said = document.createElement('p');
      said.className = 'lv-print-sheet__note';
      said.textContent = note;
      sheet.appendChild(said);
    }
    sheets.appendChild(sheet);
  });
  document.body.appendChild(sheets);
  return () => {
    sheets.remove();
    page.remove();
  };
}

/**
 * What a cut between two sheets must not run through besides the cards: a group's
 * box with its title, and a line's label. Measured on a copy drawn as the sheets
 * draw it — names as words, at 100% — in the board's own units, since a label's
 * size is the copy's and not what the screen shows at its zoom.
 */
export function printObstacles(board: HTMLElement): Rect[] {
  const document = board.ownerDocument;
  // Laid out but never seen, and only for as long as it takes to measure.
  const holder = document.createElement('section');
  holder.setAttribute('aria-hidden', 'true');
  Object.assign(holder.style, { position: 'fixed', left: '0', top: '0', width: '0', height: '0', overflow: 'hidden', visibility: 'hidden', pointerEvents: 'none' });
  const copy = drawing(board, { x: 0, y: 0, zoom: 1 }, 'lv-print-measure-');
  Object.assign(copy.style, { position: 'absolute', left: '0', top: '0', width: '1px', height: '1px' });
  holder.appendChild(copy);
  document.body.appendChild(holder);
  try {
    const origin = copy.querySelector('.react-flow__viewport')?.getBoundingClientRect();
    if (!origin) return [];
    const kept = copy.querySelectorAll<HTMLElement>('.lv-group, .react-flow__edgelabel-renderer > *');
    return [...kept].map((one) => {
      const box = one.getBoundingClientRect();
      return { x: box.left - origin.left, y: box.top - origin.top, width: box.width, height: box.height };
    }).filter((box) => box.width > 0 && box.height > 0);
  } finally {
    holder.remove();
  }
}

/** A copy of the board at this framing, in the form a card says its name in (as a picture is drawn, `atFullSize`). */
function drawing(board: HTMLElement, viewport: { x: number; y: number; zoom: number }, ids: string): HTMLElement {
  const copy = board.cloneNode(true) as HTMLElement;
  copy.removeAttribute('data-unframed');
  copy.removeAttribute('data-capturing');
  copy.dataset.distance = 'middle';
  copy.dataset.labels = 'words';
  copy.style.setProperty('--canvas-zoom', '1');
  // A copy is no control: an agent or a test looking for the board finds the one on the screen.
  for (const named of [copy, ...copy.querySelectorAll<HTMLElement>('[data-guide], [data-testid]')]) {
    named.removeAttribute('data-guide');
    named.removeAttribute('data-testid');
  }
  const view = copy.querySelector<HTMLElement>('.react-flow__viewport');
  if (view) view.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;
  ownMarkers(copy, ids);
  inLightInk(copy);
  return copy;
}

/**
 * Every copy's arrowheads its own: a marker's id was the same in the board on the
 * screen and in each sheet, and `url(#…)` found the screen's, which the print hides,
 * so the printed lines lost their heads.
 */
function ownMarkers(copy: HTMLElement, prefix: string): void {
  const renamed = new Map<string, string>();
  for (const marker of copy.querySelectorAll('marker[id]')) {
    const id = marker.id;
    renamed.set(id, `${prefix}${id}`);
    marker.id = `${prefix}${id}`;
  }
  if (renamed.size === 0) return;
  for (const end of ['marker-start', 'marker-end', 'marker-mid']) {
    for (const line of copy.querySelectorAll(`[${end}]`)) {
      const said = line.getAttribute(end) ?? '';
      const id = /url\(['"]?#(.+?)['"]?\)/.exec(said)?.[1];
      const now = id === undefined ? undefined : renamed.get(id);
      if (now !== undefined) line.setAttribute(end, `url('#${now}')`);
    }
  }
}

/** The colour properties a line, its head and its label are drawn with inline. */
const INKED = ['stroke', 'fill', 'color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'] as const;

/**
 * The lines in light ink. A line takes its colour as a value, not a custom property,
 * and the board under the sheets is drawn light only after the copy is taken: from
 * the dark window the lines printed in its pale ink, at about 2:1 on paper. A colour
 * that is a dark token's goes to that token's light one; a line's own colour stays.
 */
function inLightInk(copy: HTMLElement): void {
  const light = darkToLight();
  const inked = copy.querySelectorAll<HTMLElement | SVGElement>(
    '.react-flow__edges *, .react-flow__edgelabel-renderer *, marker, marker *',
  );
  for (const one of inked) {
    for (const property of INKED) {
      const now = light.get(rgbKey(one.style.getPropertyValue(property)));
      if (now) one.style.setProperty(property, now);
    }
    for (const attribute of ['stroke', 'fill']) {
      const now = light.get(rgbKey(one.getAttribute(attribute) ?? ''));
      if (now) one.setAttribute(attribute, now);
    }
  }
}

let darkLight: Map<string, string> | undefined;

/** Each dark colour by its light twin, keyed as `r,g,b`; one that is also a light colour is left alone, as it may be meant. */
function darkToLight(): Map<string, string> {
  if (darkLight) return darkLight;
  const dark = coloursOf('dark');
  const light = coloursOf('light');
  const lightKeys = new Set(Object.values(light).map(rgbKey));
  const map = new Map<string, string>();
  for (const [token, value] of Object.entries(dark) as [keyof typeof dark, string][]) {
    const key = rgbKey(value);
    if (key === '' || lightKeys.has(key) || map.has(key) || rgbKey(light[token]) === '') continue;
    map.set(key, light[token]);
  }
  darkLight = map;
  return map;
}

/** A colour as `r,g,b`, from six hex digits or the rgb notation a style reads back in; anything else as nothing. */
export function rgbKey(value: string): string {
  const said = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{6})$/.exec(said)?.[1];
  if (hex) return [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(',');
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*1(?:\.0+)?\s*)?\)$/.exec(said);
  return rgb ? `${rgb[1]},${rgb[2]},${rgb[3]}` : '';
}
