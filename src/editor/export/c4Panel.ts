import type { DesignDiagram, DesignModel } from '../../model/types';
import type { Language, Translate } from '../../i18n';

/**
 * What the corner of a container diagram says about itself.
 *
 * A C4 drawing is read out of context more often than in it — pasted into a
 * slide, printed, sent along — and the first question its reader has is "the
 * containers of what?". Structurizr answers it with a small block in the
 * bottom-left: the scope, the level, a sentence, the date. This is that block,
 * as text, so the canvas can draw it live and the export can draw it onto the
 * bitmap from the same four lines.
 */
export interface C4PanelInfo {
  /** The landscape this application belongs to, and its name: the breadcrumb. */
  scope: string;
  /** `[Container] <application>` — the level, then the subject. */
  title: string;
  /** The application's own description, or the sentence a C4 diagram carries. */
  description: string;
  /** The document date, or today, written out in the UI language. */
  date: string;
}

const LOCALE: Record<Language, string> = { en: 'en-GB', nl: 'nl-NL' };

/**
 * The panel for a diagram, or nothing when the diagram is not a container
 * diagram — a landscape has its own title block and no C4 level to announce.
 */
export function c4PanelFor(
  model: DesignModel,
  diagram: DesignDiagram,
  t: Translate,
  language: Language,
  today: Date = new Date(),
): C4PanelInfo | undefined {
  if (diagram.kind !== 'container') return undefined;
  const application = diagram.applicationElementId
    ? model.elements.find((element) => element.id === diagram.applicationElementId)
    : undefined;
  const name = application?.name ?? diagram.name;
  const description = firstParagraph(application?.description)
    || t('c4.containerDescription', { name });
  return {
    scope: `${model.name} · ${t('c4.applicationTag', { name })}`,
    title: t('c4.containerTitle', { name }),
    description,
    date: formatDate(diagram.documentDate, language, today),
  };
}

/**
 * The first paragraph of a description, on one line. A description is
 * markdown and can run to pages; a corner panel has room for a sentence.
 */
function firstParagraph(text: string | undefined): string {
  if (!text) return '';
  const paragraph = text.trim().split(/\n\s*\n/)[0] ?? '';
  return paragraph.replace(/\s+/g, ' ').trim();
}

/**
 * `YYYY-MM-DD` — the shape the diagram stores — read as a calendar date and
 * not as UTC midnight, which is the day before across half the world's
 * evenings. Anything else, or nothing, is today.
 */
function formatDate(stored: string | undefined, language: Language, today: Date): string {
  const match = stored ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(stored) : null;
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : today;
  return new Intl.DateTimeFormat(LOCALE[language] ?? LOCALE.en, { dateStyle: 'full' }).format(date);
}
