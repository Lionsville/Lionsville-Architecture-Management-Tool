import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import ListItemButton from '@mui/material/ListItemButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { kindLabel } from '../../model/kinds';
import { useStrings } from '../../i18n/LanguageContext';
import { searchElements } from '../elementSearch';
import type { DesignModel, ElementId } from '../../model/types';

export interface ElementSearchDialogProps {
  open: boolean;
  model: DesignModel;
  activeDiagramId: string;
  onClose(): void;
  /** Select and pan to this element — the editor's existing focus request. */
  onFocus(elementId: ElementId): void;
}

/**
 * ⌘F: type, see what matches, press Enter.
 *
 * It reuses the editor's own focus path (`focusElement` → `useFocusElement`)
 * rather than driving React Flow itself, so finding an element does exactly what
 * the host's click-to-focus already did — select it, switch diagram if it lives
 * on another one, and pan/zoom to it — and there is one implementation of "go
 * there" instead of two.
 *
 * Deliberately NOT a filter on the canvas: hiding non-matching nodes is a
 * different feature with a different exit path, and on a board where half the
 * value is the shape of the whole picture, taking boxes away to answer "where is
 * X" is the wrong trade.
 *
 * **The keyboard drives the list without leaving the field.** This is the
 * combobox-over-listbox pattern every finder uses: the caret stays where you are
 * typing, ↑/↓ move an ACTIVE row (announced through `aria-activedescendant`, not
 * by moving focus), Enter takes the active one — the first by default, so the
 * common case is still type-and-Enter — and Escape closes. Focus never enters
 * the list, which is what lets you keep refining the query after arrowing past
 * the row you wanted.
 */
export function ElementSearchDialog(props: ElementSearchDialogProps) {
  const { t } = useStrings();
  const [query, setQuery] = useState('');
  /** Which row Enter would take. Always a valid index while there are hits. */
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Each opening starts empty: a finder that remembered the last search would
  // show yesterday's answer to today's question.
  useEffect(() => {
    if (props.open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [props.open]);

  const hits = useMemo(
    () => (props.open ? searchElements(props.model, query, props.activeDiagramId) : []),
    [props.open, props.model, query, props.activeDiagramId],
  );

  // A new query is a new list: the row you had picked out of the old one is not
  // the same row, so the highlight goes back to the top rather than landing on
  // whatever now happens to sit at that index.
  useEffect(() => setActiveIndex(0), [query]);

  const choose = (id: ElementId) => {
    props.onFocus(id);
    props.onClose();
  };

  const optionId = (index: number) => `lv-search-option-${index}`;
  const active = hits.length > 0 ? Math.min(activeIndex, hits.length - 1) : -1;

  // Keep the active row in the scroller. `scrollIntoView` is absent in jsdom and
  // a no-op when the row is already visible, so the optional call is the whole
  // guard this needs.
  useEffect(() => {
    if (active < 0) return;
    const row = listRef.current?.querySelector(`#${optionId(active)}`);
    (row as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, hits]);

  const move = (delta: number) => {
    if (hits.length === 0) return;
    // Wraps, because a list you can fall off the end of makes you count.
    setActiveIndex((current) => (Math.min(current, hits.length - 1) + delta + hits.length) % hits.length);
  };

  const trimmed = query.trim();

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      maxWidth="xs"
      fullWidth
      // Anchored high: the dialog must not sit over the middle of the board it
      // is about to pan.
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-start', pt: '12vh' } }}
    >
      <Box sx={{ p: 1.5, pb: 1 }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          inputRef={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              move(1);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              move(-1);
            } else if (event.key === 'Enter' && active >= 0) {
              event.preventDefault();
              choose(hits[active].id);
            }
            // Escape is left to the Dialog, which closes on it — one exit, and
            // the same one a click outside uses.
          }}
          label={t('search.title')}
          placeholder={t('search.placeholder')}
          slotProps={{
            htmlInput: {
              'aria-label': t('search.field'),
              // The combobox half of the pattern: focus stays in the field and
              // this is what names the row the arrows are on.
              role: 'combobox',
              'aria-expanded': hits.length > 0,
              'aria-controls': 'lv-search-results',
              'aria-activedescendant': active >= 0 ? optionId(active) : undefined,
              autoComplete: 'off',
            },
          }}
        />
      </Box>
      <Box
        ref={listRef}
        id="lv-search-results"
        role="listbox"
        aria-label={t('search.results')}
        sx={{ maxHeight: 320, overflowY: 'auto', pb: 0.5 }}
      >
        {hits.map((hit, index) => (
          <ListItemButton
            key={hit.id}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            selected={index === active}
            dense
            // Hovering moves the highlight, so mouse and keyboard never
            // disagree about which row Enter would take.
            onMouseMove={() => setActiveIndex(index)}
            onClick={() => choose(hit.id)}
            sx={{ display: 'block', px: 2, py: 0.75 }}
          >
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{hit.name}</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              {[
                kindLabel(hit.kind, t),
                hit.detail,
                // Say where it will take you, but only when that is somewhere
                // else — "on this diagram" would be noise on every row.
                hit.onActiveDiagram
                  ? undefined
                  : hit.diagramName
                    ? t('search.otherDiagram', { name: hit.diagramName })
                    : t('search.unplaced'),
              ]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
          </ListItemButton>
        ))}
        {hits.length === 0 && (
          <Typography sx={{ fontSize: 12, color: 'text.secondary', px: 2, py: 1 }}>
            {trimmed === '' ? t('search.empty') : t('search.noMatches', { query: trimmed })}
          </Typography>
        )}
      </Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', px: 2, pb: 1.5 }}>
        {t('search.hint')}
      </Typography>
    </Dialog>
  );
}
