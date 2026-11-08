// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An element's record: one page under one name, read first, with its text pressed
 * open on request.
 *
 * The document IS the element's `description`: nothing new is stored, and the
 * panel's small field and this page edit one string. What the page adds is room:
 * every field the panel keeps out for being empty, and the other elements of the
 * view down the left, filtered and with a long name on two lines.
 *
 * Facts are rows, pressed where they stand, in any state: there is no Read and Edit
 * for a person who came to set an owner. *Edit text* is about the prose and says so,
 * and folds everything else away: a window with nothing but the source and the
 * result, the fields a press away.
 *
 * Writes go through the same `updateElement` the panel uses, so autosave and undo
 * apply unchanged. The difference is WHEN: the text is a local draft, committed
 * when it has been quiet for a moment, when the writing ends, and when the page
 * closes or moves to another element. Under one key, so a page's worth of writing
 * is one undo step rather than one per pause.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { DesignDiagram, DesignElement, DesignModel, ElementId } from '../../model/types';
import type { MarkdownRenderOptions } from '../documentation';
import type { WindowChrome } from '../../platform/windowChrome';
import { PageDialog } from '../../widgets/PageDialog';
import { PageClose } from '../../widgets/PageClose';
import { SeamResizer } from '../../widgets/SeamResizer';
import { RECORD_RAIL } from './DocumentationPage.rail';
import { Button } from '../../widgets/kit/Button';
import { FindField } from '../../widgets/kit/FindField';
import { FocusedWindow, useWritingView } from '../../widgets/kit/FocusedWindow';
import { List } from '../../widgets/kit/List';
import type { ListGroup } from '../../widgets/kit/List';
import { MoreMenu } from '../../widgets/kit/Menu';
import type { MenuEntry } from '../../widgets/kit/Menu';
import { PanelName } from '../../widgets/kit/Panel';
import { RecordPage } from '../../widgets/kit/RecordPage';
import type { RecordSection } from '../../widgets/kit/RecordPage';
import { MarkdownEditor } from './MarkdownEditor';
import type { DocumentImages } from './MarkdownEditor';
import {
  documentTemplate,
  documentedElements,
  hasDocumentation,
  linkElementRefs,
  outline,
} from '../documentation';
import { useStrings } from '../../i18n/LanguageContext';
import type { Translate } from '../../i18n';
import { DocGlyph } from '../../widgets/icons';
import { kindLabel } from '../../model/kinds';
import { fieldEdit } from '../../model/commands';
import './DocumentationPage.css';

/** How long the text must be quiet before a draft becomes a commit. */
const COMMIT_DELAY_MS = 1200;

export type DocumentationMode = 'read' | 'edit';

/** What this page may do to an element. */
export interface DocumentationActions {
  /** `coalesce` makes a run of edits to one field a single undo step. */
  updateElement(id: ElementId, patch: Partial<DesignElement>, coalesce?: string): void;
}

export interface DocumentationPageProps {
  element: DesignElement;
  model: DesignModel;
  /** The view the page was opened from, whose neighbours it lists; absent where the scope draws nothing (`documentedElements`). */
  diagram?: DesignDiagram;
  readOnly: boolean;
  /** Another scope answers for the name, so it reads. */
  nameLocked?: boolean;
  /**
   * The one thing this page changes. Not the editor's whole action set: a page
   * that can only write a description cannot accidentally move a node, and it
   * can be mounted in a test with one function.
   */
  actions: DocumentationActions;
  renderMarkdown?(md: string, options?: MarkdownRenderOptions): ReactNode;
  /**
   * The record's other sections, after the text: its properties and what it is
   * connected to, in the order the host says. A slot, like `renderMarkdown`, since
   * the rows are the editor's and a page that reads a description must not have to
   * import the canvas to show them.
   */
  recordSections?(element: DesignElement): readonly RecordSection[];
  /** What is done to the whole record, the ⋯ at the end of the head. */
  menu?: readonly MenuEntry[];
  /** Move the page to another element (the list, an element link, previous and next). */
  onNavigate(elementId: ElementId): void;
  onClose(): void;
  /** The host keeps a history and can show this description's (ADR-0008). Absent: no button. */
  onOpenHistory?(): void;
  /**
   * Take a pasted or dropped picture into the project, answering with the file
   * name to refer to, or `undefined` when the host refused it, in which case
   * nothing is written and the host has already said why (ADR-0009).
   * Absent = no way to add one, and neither affordance is offered.
   */
  onAddImage?(file: File): Promise<string | undefined>;
  /** The pictures the project holds (ADR-0009). Absent = no list. */
  images?: DocumentImages;
  /** How much of the top the shell keeps; its full-window writing wears the window's bar on its own. */
  windowChrome?: WindowChrome;
  /** How wide the list down the left is. The host's, so it outlives the page. Absent = the default, and no seam. */
  railWidth?: { value: number; onChange(next: number): void };
}

/** The text as it reads: *Edit text* above it, its contents, and calm words where nothing is written yet. */
function RecordText({ rendered, readOnly, headings, template, onWrite, onHeading, ref }: {
  rendered: ReactNode;
  readOnly: boolean;
  headings: ReturnType<typeof outline>;
  template: { label: string; text: string };
  onWrite(from?: string): void;
  onHeading(text: string): void;
  ref: RefObject<HTMLDivElement | null>;
}) {
  const { t } = useStrings();
  if (rendered === null) {
    return (
      <div ref={ref} data-testid="doc-content" className="doc-record__text">
        <div className="doc-record__blank">
          <p>{t('doc.noPage')}</p>
          {!readOnly && (
            <div className="doc-record__acts">
              <Button size="small" onClick={() => onWrite()} data-guide="record.editText">{t('doc.writeText')}</Button>
              <Button size="small" variant="quiet" onClick={() => onWrite(template.text)}>{template.label}</Button>
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div ref={ref} data-testid="doc-content" className="doc-record__text">
      {!readOnly && (
        <div className="doc-record__acts">
          <Button size="small" onClick={() => onWrite()} data-guide="record.editText">{t('doc.editText')}</Button>
        </div>
      )}
      {headings.length > 0 && (
        <nav className="doc-record__contents" aria-label={t('doc.contents')}>
          <span>{t('doc.contents')}</span>
          {headings.map((h, index) => (
            <button key={`${h.id}-${index}`} type="button" data-sub={h.level === 3 || undefined} onClick={() => onHeading(h.text)}>{h.text}</button>
          ))}
        </nav>
      )}
      <div data-document>{rendered}</div>
    </div>
  );
}

/**
 * *Step · on Business architecture*: the view only where it holds the element. A
 * page opened from search or a list has the view the editor last showed, which may
 * not draw it at all.
 */
function statusOf(kind: string, diagram: DesignDiagram | undefined, holds: boolean, t: Translate): string {
  return diagram && holds ? t('doc.statusOn', { kind, view: diagram.name }) : kind;
}

/** The view's other elements: filtered by what is typed, since a real list runs to two hundred. */
function RecordRail({ groups, current, onOpen }: {
  groups: ReturnType<typeof documentedElements>;
  current: ElementId;
  onOpen(id: ElementId): void;
}) {
  const { t } = useStrings();
  const [find, setFind] = useState('');
  const total = groups.reduce((sum, group) => sum + group.elements.length, 0);
  const wanted = find.trim().toLocaleLowerCase();
  const listed: ListGroup[] = groups.map((group) => ({
    id: group.kind,
    label: kindLabel(group.kind, t),
    rows: group.elements
      .filter((item) => wanted === '' || item.name.toLocaleLowerCase().includes(wanted))
      .map((item) => ({
        id: item.id, text: item.name,
        ...(hasDocumentation(item.description) ? { mark: <DocGlyph /> } : {}),
      })),
  })).filter((group) => group.rows.length > 0);
  return (
    <nav className="doc-record__rail" data-testid="doc-nav" aria-label={t('doc.neighbours')}>
      <div className="doc-record__find">
        <FindField fill label={t('doc.filter', { count: total })} value={find} onChange={setFind} />
      </div>
      <List
        label={t('doc.neighbours')} groups={listed} wrap density="compact" selectedId={current}
        onOpen={(id) => { if (id !== current) onOpen(id); }}
        empty={<p className="doc-record__none">{t('doc.noMatch')}</p>}
      />
    </nav>
  );
}

/**
 * The text and its commits: a local draft, written when it has been quiet, when the
 * writing ends and when the page closes or moves on.
 */
function useRecordText(element: DesignElement, actions: DocumentationActions) {
  const [mode, setMode] = useState<DocumentationMode>('read');
  const [draft, setDraft] = useState(element.description ?? '');
  // What Cancel goes back to, since the text reached the model while it was written.
  const opened = useRef(element.description ?? '');

  // --- the draft and its commits ---------------------------------------------

  const latest = useRef({ draft, stored: element.description ?? '', id: element.id, actions });

  // One page for every element, not a page per element: the place stays up from
  // one to the next. What a new element starts afresh is reset here, before
  // anything of it is rendered. `latest` still holds the element being left, whose
  // unsaved draft is kept aside for the effect below: a write does not belong in a render.
  const [shownId, setShownId] = useState(element.id);
  const leaving = useRef<typeof latest.current | undefined>(undefined);
  if (shownId !== element.id) {
    leaving.current = latest.current;
    setShownId(element.id);
    setMode('read');
    setDraft(element.description ?? '');
  }

  latest.current = { draft, stored: element.description ?? '', id: element.id, actions };

  const commit = useCallback(() => {
    const { draft: text, stored, id, actions: a } = latest.current;
    if (text === stored) return;
    a.updateElement(id, { description: text || undefined }, fieldEdit(id, 'description'));
  }, []);

  // Quiet for a moment → the draft reaches the model.
  useEffect(() => {
    if (mode !== 'edit') return;
    const timer = setTimeout(commit, COMMIT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, mode, commit]);

  // Leaving the page commits whatever is pending.
  useEffect(() => commit, [commit]);

  // So does leaving an element for another, however the host got there: the
  // page's own ways commit before they ask, a search hit or the agent may not.
  useEffect(() => {
    const left = leaving.current;
    leaving.current = undefined;
    if (left && left.draft !== left.stored) {
      left.actions.updateElement(left.id, { description: left.draft || undefined }, fieldEdit(left.id, 'description'));
    }
  }, [element.id]);

  // An undo while reading changes the stored text under us; follow it. While
  // editing, the draft is the truth and the store is behind by design.
  useEffect(() => {
    if (mode === 'read') setDraft(element.description ?? '');
  }, [element.description, mode]);

  const startWriting = (from?: string) => {
    opened.current = element.description ?? '';
    if (from !== undefined) setDraft(from);
    setMode('edit');
  };
  const doneWriting = () => {
    commit();
    setMode('read');
  };
  const cancelWriting = () => {
    setDraft(opened.current);
    latest.current = { ...latest.current, draft: opened.current };
    commit();
    setMode('read');
  };
  return { mode, draft, setDraft, commit, startWriting, doneWriting, cancelWriting, changed: draft !== opened.current };
}

export function DocumentationPage(props: DocumentationPageProps) {
  const { element, model, diagram, readOnly, actions, onNavigate, onClose } = props;
  const { t } = useStrings();
  const writing = useRecordText(element, actions);
  const { mode, draft, setDraft, commit, startWriting, doneWriting, cancelWriting, changed } = writing;
  const { view, views } = useWritingView();
  const contentRef = useRef<HTMLDivElement>(null);

  const close = () => {
    commit();
    onClose();
  };
  const navigate = useCallback(
    (id: ElementId) => {
      commit();
      onNavigate(id);
    },
    [commit, onNavigate],
  );

  // --- what is shown -----------------------------------------------------------

  const text = mode === 'edit' ? draft : (element.description ?? '');
  const source = useMemo(() => linkElementRefs(text, model.elements), [text, model.elements]);
  const headings = useMemo(() => outline(text).filter((h) => h.level <= 3), [text]);
  const groups = useMemo(() => documentedElements(model, diagram), [model, diagram]);
  const order = useMemo(() => groups.flatMap((g) => g.elements.map((e) => e.id)), [groups]);
  const position = order.indexOf(element.id);
  const previous = position > 0 ? order[position - 1] : undefined;
  const next = position >= 0 && position < order.length - 1 ? order[position + 1] : undefined;

  const rendered = source.trim() !== ''
    ? props.renderMarkdown
      ? props.renderMarkdown(source, { onElementLink: navigate })
      : <pre className="doc-record__plain">{source}</pre>
    : null;

  // The renderer is the host's, so headings carry no ids we could link to. A
  // heading is found by its text instead, which works for any renderer that
  // produces a heading at all.
  const scrollToHeading = (headingText: string) => {
    const candidates = contentRef.current?.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]') ?? [];
    const target = Array.from(candidates).find((el) => el.textContent?.trim() === headingText);
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const chrome = props.windowChrome ?? {};
  const template = { label: t('doc.insertTemplate'), text: documentTemplate(t) };
  const kind = kindLabel(element.kind, t);
  const rest = props.recordSections?.(element) ?? [];
  const fields = rest.filter((section) => section.id !== 'comments');

  const textSection: RecordSection = {
    id: 'text',
    heading: t('doc.text'),
    children: (
      <RecordText
        ref={contentRef} rendered={rendered} readOnly={readOnly} headings={headings} template={template}
        onWrite={startWriting} onHeading={scrollToHeading}
      />
    ),
  };

  return (
    <PageDialog open topInset={chrome.topInset} onClose={close} aria-label={t('doc.title')}>
      <div className="doc-record" style={{ '--doc-rail': `${props.railWidth?.value ?? RECORD_RAIL.default}px` } as CSSProperties}>
        <RecordRail groups={groups} current={element.id} onOpen={navigate} />
        {props.railWidth && (
          <SeamResizer
            orientation="vertical" region="before"
            value={props.railWidth.value} min={RECORD_RAIL.min} max={RECORD_RAIL.max} defaultValue={RECORD_RAIL.default}
            onChange={props.railWidth.onChange} label={t('doc.resizeRail')}
          />
        )}
        <RecordPage
          title={(
            <PanelName
              unheaded
              name={element.name}
              {...(readOnly || props.nameLocked ? {} : { onRename: (name: string) => actions.updateElement(element.id, { name }) })}
            />
          )}
          status={statusOf(kind, diagram, position >= 0, t)}
          actions={(
            <>
              <Button size="small" variant="quiet" aria-label={t('doc.previous')} reason={previous ? undefined : t('doc.firstInList')} onClick={() => previous && navigate(previous)}>‹ {t('doc.previousShort')}</Button>
              <Button size="small" variant="quiet" aria-label={t('doc.next')} reason={next ? undefined : t('doc.lastInList')} onClick={() => next && navigate(next)}>{t('doc.nextShort')} ›</Button>
              {props.onOpenHistory && <Button size="small" variant="quiet" onClick={props.onOpenHistory}>{t('common.history')}</Button>}
              {props.menu && props.menu.length > 0 && <MoreMenu items={props.menu} size="small" />}
              <PageClose onClose={close} label={t('doc.close')} />
            </>
          )}
          sections={[textSection, ...rest]}
          outlineFrom={4}
          dataGuide="record.page"
        />
      </div>
      {mode === 'edit' && (
      <FocusedWindow
        open
        data-guide="record.writing"
        title={t('doc.editing', { name: element.name })}
        changed={changed}
        views={views}
        onSave={doneWriting}
        onCancel={cancelWriting}
        // The fields stand open beside the writing where there is room; on a narrow window the bar folds them (`FocusedWindow`).
        {...(fields.length > 0 ? { aside: fields.map((section) => <div key={section.id}><h2 className="doc-record__asideHead">{section.heading}</h2>{section.children}</div>) } : {})}
      >
        <MarkdownEditor
          variant="pane"
          value={draft}
          onChange={setDraft}
          onBlur={commit}
          label={t('doc.source')}
          shownAs={view}
          autoFocus
          attachable
          {...(readOnly || !props.onAddImage ? {} : { onAddImage: props.onAddImage })}
          {...(props.images ? { images: props.images } : {})}
          template={template}
          renderPreview={() => (rendered ?? <p className="doc-record__none">{t('common.empty')}</p>)}
        />
      </FocusedWindow>
      )}
    </PageDialog>
  );
}
