/**
 * The rules for an element's documentation — the `description` field read as a
 * document rather than as a sentence.
 *
 * A description has always been markdown, and the nodes have always drawn its
 * first two lines. Once it is a page — a header table, sections, links to other
 * elements — the node still needs one line, and this is where that line comes
 * from. Nothing new is stored: everything here is derived from the text, so a
 * description written before any of this existed still gives the same answers
 * it did (its first paragraph), and a page written with the template gives
 * exactly the line its author put in the "Short description" row.
 *
 * Pure. No React, no renderer; the renderer is the host's and only ever sees
 * the result of {@link linkElementRefs}.
 */
import type { DesignDiagram, DesignElement, DesignModel, ElementId, ElementKind } from '../model/types';
import type { Translate } from '../i18n/strings';

/** The href scheme a link to another element carries; the host renderer hands the id back. */
export const ELEMENT_LINK_SCHEME = 'element:';

/**
 * The header-table row that names the short description, in every language a
 * document may have been written in. Matched case-insensitively. Listed here
 * rather than read from the string tables so that this module stays free of
 * them; `documentation.test.ts` checks the tables agree.
 */
export const SHORT_DESCRIPTION_LABELS: readonly string[] = ['short description', 'korte omschrijving'];

// --- reading -------------------------------------------------------------------

type TableRow = { cells: string[] };

function isTableLine(line: string): boolean {
  return line.trimStart().startsWith('|');
}

function isDelimiterRow(line: string): boolean {
  return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line);
}

function splitCells(line: string): string[] {
  let body = line.trim();
  if (body.startsWith('|')) body = body.slice(1);
  if (body.endsWith('|')) body = body.slice(0, -1);
  // An escaped pipe is content; a bare one is a border.
  return body.split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, '|').trim());
}

/**
 * The table a document opens with, if it opens with one. Only leading blank
 * lines may precede it: a table further down is content, not a header.
 */
function leadingTable(lines: string[]): { rows: TableRow[]; end: number } | undefined {
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i += 1;
  if (i >= lines.length || !isTableLine(lines[i])) return undefined;
  const rows: TableRow[] = [];
  while (i < lines.length && isTableLine(lines[i])) {
    if (!isDelimiterRow(lines[i])) rows.push({ cells: splitCells(lines[i]) });
    i += 1;
  }
  return { rows, end: i };
}

/** Inline markdown reduced to its words, for a line that will be drawn, not rendered. */
export function stripInline(text: string): string {
  return text
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function isShortDescriptionLabel(cell: string): boolean {
  const label = stripInline(cell).toLowerCase().replace(/:$/, '').trim();
  return SHORT_DESCRIPTION_LABELS.includes(label);
}

/**
 * The row of a leading header table that names the short description, if any.
 * Header row and body rows alike: the template puts it first, where GFM makes
 * it the header, but a table that starts with an empty header row and files it
 * lower is the same document to its author.
 */
function shortDescriptionRow(markdown: string): string | undefined {
  const table = leadingTable(markdown.split('\n'));
  if (!table) return undefined;
  const row = table.rows.find((r) => r.cells.length >= 2 && isShortDescriptionLabel(r.cells[0]));
  return row ? stripInline(row.cells[1]) : undefined;
}

const BLOCK_MARKER = /^\s*(#{1,6}\s+|>\s?|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/;

/**
 * The first paragraph: the first run of non-blank lines after any leading
 * table, skipping headings, rules and fences on the way. List items count —
 * a description that is a list still has a first thing to say.
 */
function firstParagraph(markdown: string): string {
  const lines = markdown.split('\n');
  let i = leadingTable(lines)?.end ?? 0;
  const collected: string[] = [];
  let inFence = false;
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (trimmed === '') {
      if (collected.length) break;
      continue;
    }
    if (/^#{1,6}\s/.test(trimmed) || /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed) || isTableLine(line)) {
      if (collected.length) break;
      continue;
    }
    collected.push(trimmed.replace(BLOCK_MARKER, ''));
  }
  return stripInline(collected.join(' '));
}

// --- reading a description more than once --------------------------------------

/**
 * How many descriptions each reader remembers having read.
 *
 * Comfortably more than a board's worth of nodes, so scrolling a large
 * landscape does not evict what is about to come back into view, and small
 * enough that a long session over a five-thousand element project does not
 * accumulate every page anybody has looked at. The entries are the cost, not
 * the text: the key IS the description the model is already holding.
 */
export const DESCRIPTIONS_REMEMBERED = 2_000;

/**
 * A reader of a description, answering from memory the second time.
 *
 * Every node on the canvas asks {@link shortDescription} and
 * {@link hasDocumentation} what its element's page says, and both walk the
 * whole markdown to answer — twice per card, on every render, on a board that
 * can carry two thousand of them with two kilobytes of prose each. The result
 * only depends on the text, so it is worth remembering.
 *
 * A `Map` in insertion order IS an LRU once a hit re-inserts its key: the
 * oldest key is the first one the iterator gives back. Keyed on the string
 * rather than on the element, because the same description reached through two
 * different objects is the same question — and because a `WeakMap` cannot key
 * on a string at all.
 */
function readOnce<T>(read: (markdown: string) => T): (markdown: string) => T {
  const held = new Map<string, T>();
  return (markdown) => {
    if (held.has(markdown)) {
      const answer = held.get(markdown) as T;
      held.delete(markdown);
      held.set(markdown, answer);
      return answer;
    }
    const answer = read(markdown);
    held.set(markdown, answer);
    if (held.size > DESCRIPTIONS_REMEMBERED) {
      held.delete(held.keys().next().value as string);
    }
    return answer;
  };
}

/**
 * The one line a node draws for an element.
 *
 * The "Short description" row of a leading header table wins; failing that, the
 * first paragraph; failing that, nothing. Undefined in, empty string out — the
 * nodes treat both as "no description".
 */
export function shortDescription(markdown: string | undefined): string {
  if (!markdown) return '';
  return readShortDescription(markdown);
}

const readShortDescription = readOnce(
  (markdown) => shortDescriptionRow(markdown) ?? firstParagraph(markdown),
);

/**
 * Whether there is more here than the one line the node shows: a heading, a
 * header table with something in it besides the short description, or a second
 * paragraph. Drives the document glyph on a node and the counts in the page's
 * navigation, so "has documentation" means "worth opening".
 */
export function hasDocumentation(markdown: string | undefined): boolean {
  return markdown ? readHasDocumentation(markdown) : false;
}

const readHasDocumentation = readOnce((markdown) => {
  if (!markdown.trim()) return false;
  const lines = markdown.split('\n');
  const table = leadingTable(lines);
  if (table) {
    const filled = table.rows.filter(
      (r) => r.cells.length >= 2 && r.cells[1].trim() !== '' && !isShortDescriptionLabel(r.cells[0]),
    );
    if (filled.length > 0) return true;
  }
  const rest = lines.slice(table?.end ?? 0);
  if (rest.some((line) => /^\s*#{1,6}\s/.test(line))) return true;
  const paragraphs = rest.join('\n').split(/\n\s*\n/).filter((block) => block.trim() !== '');
  return paragraphs.length > 1;
});

// --- the outline ---------------------------------------------------------------

export interface OutlineEntry {
  level: number;
  text: string;
  /** A stable anchor derived from the text: lower case, words joined by one dash. */
  id: string;
}

export function headingId(text: string): string {
  return stripInline(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** ATX headings in order, ignoring anything inside a code fence. */
export function outline(markdown: string | undefined): OutlineEntry[] {
  if (!markdown) return [];
  const entries: OutlineEntry[] = [];
  let inFence = false;
  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(trimmed);
    if (!match) continue;
    const text = stripInline(match[2]);
    entries.push({ level: match[1].length, text, id: headingId(text) });
  }
  return entries;
}

// --- links between elements ----------------------------------------------------

/**
 * `[[Name]]` becomes a markdown link to that element, by exact name, case-
 * insensitively. A name nobody has is left as written: a dangling reference is
 * worth seeing, and the author may be about to add the element. When two
 * elements share a name the first in model order wins, which is at least
 * deterministic; names are meant to be unique on a landscape.
 */
export function linkElementRefs(
  markdown: string,
  elements: readonly Pick<DesignElement, 'id' | 'name'>[],
): string {
  if (!markdown.includes('[[')) return markdown;
  const byName = new Map<string, ElementId>();
  for (const element of elements) {
    const key = element.name.trim().toLowerCase();
    if (key && !byName.has(key)) byName.set(key, element.id);
  }
  return markdown.replace(/\[\[([^\]\n]+)\]\]/g, (whole, name: string) => {
    const id = byName.get(name.trim().toLowerCase());
    if (id === undefined) return whole;
    return `[${name.trim()}](${ELEMENT_LINK_SCHEME}${encodeURIComponent(id)})`;
  });
}

// --- the page's neighbours -----------------------------------------------------

/** The order the page lists kinds in: what a reader most often documents first. */
const KIND_ORDER: readonly ElementKind[] = [
  'application',
  'component',
  'externalSystem',
  'inputChannel',
  'managementTool',
  'actor',
];

export interface DocumentedGroup {
  kind: ElementKind;
  elements: DesignElement[];
}

/**
 * The elements placed on a diagram, grouped by kind and sorted by name, for the
 * page's left column and its previous/next. Placement rather than the whole
 * model, because "the other things on this drawing" is what a reader means by
 * next; a kind with nothing placed is left out rather than shown empty.
 */
export function documentedElements(model: DesignModel, diagram: DesignDiagram): DocumentedGroup[] {
  const placed = new Set(diagram.placements.map((p) => p.elementId));
  const byKind = new Map<ElementKind, DesignElement[]>();
  for (const element of model.elements) {
    if (!placed.has(element.id)) continue;
    const list = byKind.get(element.kind) ?? [];
    list.push(element);
    byKind.set(element.kind, list);
  }
  return KIND_ORDER.filter((kind) => byKind.has(kind)).map((kind) => ({
    kind,
    elements: [...(byKind.get(kind) ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

// --- the template --------------------------------------------------------------

/**
 * What an empty document becomes when its author asks for a starting point.
 *
 * Deliberately only what the model does not already know. Vendor, technology
 * and lifecycle are fields on the element and are shown beside the document;
 * writing them into the table as well would give one question two answers.
 * The short description goes first so that GFM makes it the header row, which
 * is also where a reader expects the one-line summary.
 */
export function documentTemplate(t: Translate): string {
  const row = (label: string) => `| ${label} | |`;
  const section = (title: string) => `## ${title}\n\n`;
  return [
    row(t('doc.shortDescription')),
    '|---|---|',
    row(t('doc.owner')),
    row(t('doc.criticality')),
    row(t('doc.users')),
    row(t('doc.dataClassification')),
    row(t('doc.lastReviewed')),
    '',
    section(t('doc.purpose')),
    section(t('doc.keyFunctions')),
    section(t('doc.interfaces')),
    section(t('doc.data')),
    section(t('doc.operations')),
    section(t('doc.decisions')),
  ]
    .join('\n')
    .trimEnd()
    .concat('\n');
}

/**
 * What a markdown renderer may be told beyond the text.
 *
 * An element link is a link whose href is `element:<id>`. The model writes
 * those (a `[[Name]]` in a description resolves to one); the renderer only has
 * to recognise the scheme and hand the id back, so it stays ignorant of the
 * model and the page stays ignorant of the renderer.
 */
export interface MarkdownRenderOptions {
  onElementLink?(elementId: string): void;
}
