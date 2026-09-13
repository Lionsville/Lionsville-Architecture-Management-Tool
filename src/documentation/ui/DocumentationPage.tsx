/**
 * An element's documentation as a page: read first, edit on request.
 *
 * The document IS the element's `description` — nothing new is stored, the
 * inspector's small field and this page edit one string. What the page adds is
 * room: a reading layout with a table of contents, a split view for writing,
 * the diagram's other elements down the left so a reader can move between
 * them, and the element's own fields down the right so a writer never has to
 * go back to the canvas to set an aspect or a vendor.
 *
 * Writes go through the same `updateElement` the inspector uses, so autosave
 * and undo apply unchanged. The difference is WHEN: the inspector commits per
 * keystroke, which is right for a sentence and wrong for a page, because every
 * commit is an undo step. Here the text is a local draft, committed when it
 * has been quiet for a moment, when the mode switches back to read, and when
 * the page closes or moves to another element.
 *
 * A dialog rather than an overlay inside the editor on purpose: it portals out
 * of the editor's DOM, so the canvas's keyboard shortcuts — Delete, F2,
 * Cmd+D — cannot reach a reader who is only scrolling a page.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { DesignDiagram, DesignElement, DesignModel, ElementId } from '../../model/types';
import { transitionLabel, transitionsForElement } from '../../model/transition';
import type { Transition } from '../../model/transition';
import type { MarkdownRenderOptions } from '../documentation';
import type { WindowChrome } from '../../platform/windowChrome';
import { barChromeFor } from '../../platform/windowChrome';
import { PageDialog } from '../../widgets/PageDialog';
import { DocumentSource } from './DocumentSource';
import type { DocumentImages } from './DocumentSource';
import { DocumentSheet } from './DocumentSheet';
import {
  documentTemplate,
  documentedElements,
  hasDocumentation,
  linkElementRefs,
  outline,
} from '../documentation';
import { useStrings } from '../../i18n/LanguageContext';
import { DocGlyph } from '../../widgets/icons';
import { kindLabel } from '../../model/kinds';
import { fieldEdit } from '../../model/commands';
import { BackIcon } from '../../widgets/icons';

/** How long the text must be quiet before a draft becomes a commit. */
const COMMIT_DELAY_MS = 1200;

export type DocumentationMode = 'read' | 'edit';

/** What this page may do to an element, and the caret it puts a link into. */
export interface DocumentationActions {
  /** `coalesce` makes a run of edits to one field a single undo step. */
  updateElement(id: ElementId, patch: Partial<DesignElement>, coalesce?: string): void;
  setSelectionRange?(start: number, end: number): void;
}

export interface DocumentationPageProps {
  element: DesignElement;
  model: DesignModel;
  /**
   * The organisation this scope sits in, for the breadcrumb (ADR-0012 §1).
   * Absent = this scope's own name, which is what a landscape with nothing
   * above it is called.
   */
  scopeLabel?: string;
  diagram: DesignDiagram;
  readOnly: boolean;
  /**
   * The one thing this page changes. Not the editor's whole action set: a page
   * that can only write a description cannot accidentally move a node, and it
   * can be mounted in a test with one function.
   */
  actions: DocumentationActions;
  renderMarkdown?(md: string, options?: MarkdownRenderOptions): ReactNode;
  /**
   * The element's own fields, down the right-hand column.
   *
   * A slot, like `renderMarkdown` above it, and for the same reason: the
   * inspector is the editor's, and a page that reads a description must not
   * have to import the canvas to show the fields beside it.
   *
   * `readOnly` is the page's own, and it is NOT the Read/Edit toggle: that
   * toggle is about the prose, and a person who came to this page to set an
   * owner should not have to open the markdown source to do it. The fields
   * were greyed out in Read once, and the record moved here from the panel
   * precisely so it could be edited somewhere with room.
   */
  renderInspector?(element: DesignElement, options: { readOnly: boolean }): ReactNode;
  /** Move the page to another element (the left column, an element link, prev/next). */
  onNavigate(elementId: ElementId): void;
  onClose(): void;
  onRequestDelete(): void;
  onRequestLogoUpload?(): void;
  /** The host keeps a history and can show this description's (ADR-0008). Absent: no button. */
  onOpenHistory?(): void;
  /**
   * Take a pasted or dropped picture into the project, answering with the file
   * name to refer to — or `undefined` when the host refused it, in which case
   * nothing is written and the host has already said why (ADR-0009).
   *
   * Absent = no way to add one, and neither affordance is offered.
   */
  onAddImage?(file: File): Promise<string | undefined>;
  /**
   * The pictures the project holds, so the writer can put one in again or
   * take one out (ADR-0009). `usedBy` names every document that shows a
   * file — the host knows the decisions and plans this page does not — and is
   * what the delete confirmation says. Absent = no list.
   */
  images?: DocumentImages;
  /** See {@link SolutionDesignEditorProps.windowChrome}: room for the window's own controls. */
  windowChrome?: WindowChrome;
  /**
   * The plans over the landscape (ADR-0010), so the page can list the ones
   * that name this element above its fields. Absent = no such section.
   */
  plans?: { list: readonly Transition[]; onOpen(transitionId: string): void };
}

export function DocumentationPage(props: DocumentationPageProps) {
  const { element, model, scopeLabel, diagram, readOnly, actions, onNavigate, onClose } = props;
  const { t } = useStrings();
  const [mode, setMode] = useState<DocumentationMode>('read');
  const [draft, setDraft] = useState(element.description ?? '');
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- the draft and its commits ---------------------------------------------

  const latest = useRef({ draft, stored: element.description ?? '', id: element.id, actions });
  latest.current = { draft, stored: element.description ?? '', id: element.id, actions };

  const commit = useCallback(() => {
    const { draft: text, stored, id, actions: a } = latest.current;
    if (text === stored) return;
    // Under the field's own key, so a page's worth of writing is one ⌘Z rather
    // than one per pause — the pauses are how it reaches the model, not how the
    // writer thinks about what they wrote.
    a.updateElement(id, { description: text || undefined }, fieldEdit(id, 'description'));
  }, []);

  // Quiet for a moment → the draft reaches the model.
  useEffect(() => {
    if (mode !== 'edit') return;
    const timer = setTimeout(commit, COMMIT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, mode, commit]);

  // Leaving the page (close, another element) commits whatever is pending.
  useEffect(() => commit, [commit]);

  // An undo while reading changes the stored text under us; follow it. While
  // editing, the draft is the truth and the store is behind by design.
  useEffect(() => {
    if (mode === 'read') setDraft(element.description ?? '');
  }, [element.description, mode]);

  const switchMode = (next: DocumentationMode | null) => {
    if (!next || next === mode) return;
    if (next === 'read') commit();
    setMode(next);
  };

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
  const plansHere = useMemo(
    () => (props.plans ? transitionsForElement(props.plans.list, element.id) : []),
    [props.plans, element.id],
  );
  const groups = useMemo(() => documentedElements(model, diagram), [model, diagram]);
  const order = useMemo(() => groups.flatMap((g) => g.elements.map((e) => e.id)), [groups]);
  const position = order.indexOf(element.id);
  const previous = position > 0 ? order[position - 1] : undefined;
  const next = position >= 0 && position < order.length - 1 ? order[position + 1] : undefined;

  const rendered = source.trim()
    ? props.renderMarkdown
      ? props.renderMarkdown(source, { onElementLink: navigate })
      : <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{source}</Box>
    : (
      <Box sx={{ color: 'text.secondary' }}>
        <Typography>{t('common.empty')}</Typography>
        {!readOnly && <Typography variant="body2">{t('doc.emptyHint')}</Typography>}
      </Box>
    );

  // The renderer is the host's, so headings carry no ids we could link to. A
  // heading is found by its text instead, which works for any renderer that
  // produces a heading at all.
  const scrollToHeading = (headingText: string) => {
    const root = contentRef.current;
    if (!root) return;
    const candidates = root.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
    const target = Array.from(candidates).find((el) => el.textContent?.trim() === headingText);
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const insertTemplate = () => {
    setDraft(documentTemplate(t));
    textareaRef.current?.focus();
  };

  // The rendered page beside the source, which a wide table wants out of the way.
  const [previewShown, setPreviewShown] = useState(true);
  const showPreview = mode === 'read' || previewShown;

  const subtitle = [element.category, element.vendor, element.technology].filter(Boolean).join(' · ');
  const chrome = props.windowChrome ?? { controlsInset: 0, draggable: false };
  const bar = barChromeFor(chrome)

  return (
    <PageDialog
      open
      topInset={chrome.topInset}
      onClose={(_event, reason) => {
        // Escape steps back before it steps out: out of Edit first, then closed.
        if (reason === 'escapeKeyDown' && mode === 'edit') switchMode('read');
        else close();
      }}
      aria-label={t('doc.title')}
    >
      {/* ---- top bar ---- */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          // This bar covers the whole window, so it inherits the window's two
          // jobs: start after the controls painted over its corner, and move
          // the window when dragged — except where something is clickable.
          pl: `${12 + bar.controlsInset}px`,
          WebkitAppRegion: bar.draggable ? 'drag' : undefined,
          '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
          minHeight: 48,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          flexShrink: 0,
        }}
      >
        <Tooltip title={t('doc.close')}>
          <IconButton size="small" aria-label={t('doc.close')} onClick={close}>
            <BackIcon />
          </IconButton>
        </Tooltip>
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {scopeLabel ?? model.name} &nbsp;/&nbsp; {diagram.name} &nbsp;/&nbsp;
          <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{element.name}</Box>
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title={t('doc.previous')}>
          <span>
            <IconButton size="small" aria-label={t('doc.previous')} disabled={!previous} onClick={() => previous && navigate(previous)}>
              <BackIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('doc.next')}>
          <span>
            <IconButton size="small" aria-label={t('doc.next')} disabled={!next} onClick={() => next && navigate(next)} sx={{ transform: 'scaleX(-1)' }}>
              <BackIcon />
            </IconButton>
          </span>
        </Tooltip>
        {props.onOpenHistory && (
          <Button size="small" onClick={props.onOpenHistory} sx={{ ml: 1 }}>{t('common.history')}</Button>
        )}
        <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_e, value: DocumentationMode | null) => switchMode(value)} sx={{ ml: 1 }}>
          <ToggleButton value="read">{t('doc.read')}</ToggleButton>
          {!readOnly && <ToggleButton value="edit">{t('doc.edit')}</ToggleButton>}
        </ToggleButtonGroup>
      </Box>

      {/* ---- three columns ---- */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr) 340px', flex: 1, minHeight: 0 }}>
        {/* left: the diagram's elements */}
        <Box component="nav" data-testid="doc-nav" sx={{ borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper', overflow: 'auto' }}>
          <List dense disablePadding>
            {groups.map((group) => (
              <Box key={group.kind}>
                <ListSubheader disableSticky sx={{ lineHeight: '32px', bgcolor: 'transparent' }}>
                  {kindLabel(group.kind, t)}
                </ListSubheader>
                {group.elements.map((item) => (
                  <ListItemButton
                    key={item.id}
                    selected={item.id === element.id}
                    onClick={() => item.id !== element.id && navigate(item.id)}
                    sx={{ py: 0.5 }}
                  >
                    <ListItemText primary={item.name} slotProps={{ primary: { noWrap: true, fontSize: 13 } }} />
                    {hasDocumentation(item.description) && (
                      <Box sx={{ color: 'text.secondary', display: 'flex', ml: 1 }} aria-hidden>
                        <DocGlyph />
                      </Box>
                    )}
                  </ListItemButton>
                ))}
              </Box>
            ))}
          </List>
        </Box>

        {/* centre: the document, or the source beside it */}
        <Box sx={{ display: 'grid', gridTemplateColumns: mode === 'edit' && showPreview ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', minHeight: 0 }}>
          {mode === 'edit' && (
            <DocumentSource
              value={draft}
              onChange={setDraft}
              onBlur={commit}
              label={t('doc.source')}
              onAddImage={readOnly ? undefined : props.onAddImage}
              images={props.images}
              preview={{ shown: previewShown, onToggle: () => setPreviewShown((on) => !on) }}
              textareaRef={textareaRef}
              extra={!draft.trim() && (
                <Button size="small" variant="outlined" onClick={insertTemplate}>
                  {t('doc.insertTemplate')}
                </Button>
              )}
            />
          )}

          {showPreview && (
            <DocumentSheet ref={contentRef} testId="doc-content" dense={mode === 'edit'}>
              <Typography variant="overline" color="text.secondary">
                {kindLabel(element.kind, t)}
              </Typography>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                {element.name}
              </Typography>
              {subtitle && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {subtitle}
                </Typography>
              )}
              {headings.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, py: 1.5, mt: 1.5, mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    {t('doc.contents')}
                  </Typography>
                  {headings.map((h, index) => (
                    <Typography
                      key={`${h.id}-${index}`}
                      component="button"
                      type="button"
                      variant="caption"
                      onClick={() => scrollToHeading(h.text)}
                      sx={{
                        border: 0,
                        p: 0,
                        bgcolor: 'transparent',
                        color: 'text.secondary',
                        cursor: 'pointer',
                        pl: h.level === 3 ? 1.5 : 0,
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      {h.text}
                    </Typography>
                  ))}
                </Box>
              )}
              <Box sx={{ fontSize: 15, mt: headings.length ? 0 : 3 }} data-document>{rendered}</Box>
            </DocumentSheet>
          )}
        </Box>

        {/* right: the plans that name it, then the element's own fields */}
        <Box sx={{ borderLeft: 1, borderColor: 'divider', bgcolor: 'background.paper', overflow: 'auto', p: 2 }}>
          {plansHere.length > 0 && (
            <Box data-testid="doc-plans" sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{t('doc.plans')}</Typography>
              {plansHere.map((plan) => (
                <Typography
                  key={plan.id}
                  sx={{ fontSize: 13, cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                  onClick={() => props.plans?.onOpen(plan.id)}
                >
                  {transitionLabel(plan)} {plan.title}
                </Typography>
              ))}
            </Box>
          )}
          {props.renderInspector?.(element, { readOnly })}
        </Box>
      </Box>

    </PageDialog>
  );
}
