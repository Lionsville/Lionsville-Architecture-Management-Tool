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
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
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
import type { MarkdownRenderOptions } from '../documentation';
import type { WindowChrome } from '../../platform/windowChrome';
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
import { BackIcon } from '../../widgets/icons';

/** How long the text must be quiet before a draft becomes a commit. */
const COMMIT_DELAY_MS = 1200;

export type DocumentationMode = 'read' | 'edit';

/** What this page may do to an element, and the caret it puts a link into. */
export interface DocumentationActions {
  updateElement(id: ElementId, patch: Partial<DesignElement>): void;
  setSelectionRange?(start: number, end: number): void;
}

export interface DocumentationPageProps {
  element: DesignElement;
  model: DesignModel;
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
   * have to import the canvas to show the fields beside it. `readOnly` is the
   * page's own — reading is read-only even when the document is not.
   */
  renderInspector?(element: DesignElement, options: { readOnly: boolean }): ReactNode;
  /** Move the page to another element (the left column, an element link, prev/next). */
  onNavigate(elementId: ElementId): void;
  onClose(): void;
  onRequestDelete(): void;
  onRequestLogoUpload?(): void;
  /** See {@link SolutionDesignEditorProps.windowChrome}: room for the window's own controls. */
  windowChrome?: WindowChrome;
}

export function DocumentationPage(props: DocumentationPageProps) {
  const { element, model, diagram, readOnly, actions, onNavigate, onClose } = props;
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
    a.updateElement(id, { description: text || undefined });
  }, []);

  // Quiet for a moment → commit. One undo step per pause, not per keystroke.
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

  // Cmd+B / Cmd+I wrap the selection; Tab indents rather than leaving the field.
  const onSourceKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const area = event.currentTarget;
    const mod = event.metaKey || event.ctrlKey;
    const wrap = (mark: string) => {
      event.preventDefault();
      const { selectionStart: start, selectionEnd: end, value } = area;
      const inner = value.slice(start, end);
      const nextValue = value.slice(0, start) + mark + inner + mark + value.slice(end);
      setDraft(nextValue);
      requestAnimationFrame(() => area.setSelectionRange(start + mark.length, end + mark.length));
    };
    if (mod && event.key.toLowerCase() === 'b') wrap('**');
    else if (mod && event.key.toLowerCase() === 'i') wrap('_');
    else if (event.key === 'Tab' && !mod) {
      event.preventDefault();
      const { selectionStart: start, selectionEnd: end, value } = area;
      setDraft(value.slice(0, start) + '  ' + value.slice(end));
      requestAnimationFrame(() => area.setSelectionRange(start + 2, start + 2));
    }
  };

  const subtitle = [element.category, element.vendor, element.technology].filter(Boolean).join(' · ');
  const chrome = props.windowChrome ?? { controlsInset: 0, draggable: false };

  return (
    <Dialog
      open
      fullScreen
      onClose={(_event, reason) => {
        // Escape steps back before it steps out: out of Edit first, then closed.
        if (reason === 'escapeKeyDown' && mode === 'edit') switchMode('read');
        else close();
      }}
      aria-label={t('doc.title')}
      slotProps={{ paper: { sx: { bgcolor: 'background.default', display: 'flex', flexDirection: 'column' } } }}
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
          pl: `${12 + chrome.controlsInset}px`,
          WebkitAppRegion: chrome.draggable ? 'drag' : undefined,
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
          {model.customerName} &nbsp;/&nbsp; {diagram.name} &nbsp;/&nbsp;
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
        <Box sx={{ display: 'grid', gridTemplateColumns: mode === 'edit' ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', minHeight: 0 }}>
          {mode === 'edit' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                  {t('doc.markdownHint')}
                </Typography>
                {!draft.trim() && (
                  <Button size="small" variant="outlined" onClick={insertTemplate}>
                    {t('doc.insertTemplate')}
                  </Button>
                )}
              </Box>
              <Box
                component="textarea"
                ref={textareaRef}
                aria-label={t('doc.source')}
                value={draft}
                spellCheck={false}
                onChange={(e: { target: { value: string } }) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={onSourceKeyDown}
                sx={{
                  flex: 1,
                  minHeight: 0,
                  resize: 'none',
                  border: 0,
                  outline: 'none',
                  p: 2,
                  bgcolor: 'transparent',
                  color: 'text.primary',
                  font: '13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  tabSize: 2,
                }}
              />
            </Box>
          )}

          <Box sx={{ overflow: 'auto', minHeight: 0 }}>
            <Box ref={contentRef} data-testid="doc-content" sx={{ maxWidth: 860, mx: 'auto', px: mode === 'edit' ? 3 : 5, py: 3.5 }}>
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
              <Box sx={{ fontSize: 15, mt: headings.length ? 0 : 3 }}>{rendered}</Box>
            </Box>
          </Box>
        </Box>

        {/* right: the element's own fields */}
        <Box sx={{ borderLeft: 1, borderColor: 'divider', bgcolor: 'background.paper', overflow: 'auto', p: 2 }}>
          {props.renderInspector?.(element, { readOnly: readOnly || mode === 'read' })}
        </Box>
      </Box>
    </Dialog>
  );
}
