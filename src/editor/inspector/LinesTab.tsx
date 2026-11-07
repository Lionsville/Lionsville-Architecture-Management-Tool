// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a drawing cannot carry: a container diagram's lines, in words and whole. The
 * numbers are the ones the canvas shows when it has no room for words. Pressing a row
 * selects that line on the canvas, and what it does not touch recedes; the list stays,
 * so a person can walk the lines of a dense diagram one by one.
 */
import { useMemo, useState } from 'react';
import { formatDay } from '../../i18n/dates';
import { useStrings } from '../../i18n/LanguageContext';
import type { DesignDiagram } from '../../model/types';
import { Button } from '../../widgets/kit/Button';
import { TextInput } from '../../widgets/kit/Field';
import { List } from '../../widgets/kit/List';
import { howWords } from '../../widgets/kit/Line';
import { PageState } from '../../widgets/kit/PageState';
import { diagramLines, type DiagramLine } from '../containerLines';
import type { EditorParts } from '../editorParts';
import { selectConnection } from '../useEditorState';

const said = (line: DiagramLine) => [line.label, line.protocol ? howWords(line.protocol) : undefined].filter(Boolean).join(' ');

function matches(line: DiagramLine, words: string): boolean {
  const asked = words.trim().toLowerCase();
  return asked === '' || [line.from, line.to, line.label, line.protocol].some((one) => one?.toLowerCase().includes(asked));
}

export function LinesTab({ parts, diagram }: { parts: EditorParts; diagram: DesignDiagram }) {
  const { t, language } = useStrings();
  const { state, board, dialogs } = parts;
  const [words, setWords] = useState('');
  const shown = board.shownDiagram ?? diagram;
  const lines = useMemo(() => diagramLines(state.model, shown, board.lookingAt), [state.model, shown, board.lookingAt]);
  const kept = lines.filter((line) => matches(line, words));
  const selectedId = state.selectedConnection?.id ?? null;
  const window = (line: DiagramLine) => (line.validFrom || line.validUntil ? t('c4.lineShows', {
    from: line.validFrom ? formatDay(line.validFrom, language) : t('c4.anyDay'),
    until: line.validUntil ? formatDay(line.validUntil, language) : t('c4.anyDay'),
  }) : undefined);
  if (lines.length === 0) return <PageState state="empty" compact title={t('c4.linesEmpty')} />;
  return (
    <div className="lv-lines" data-testid="lines-list">
      <TextInput value={words} onChange={(event) => setWords(event.target.value)} placeholder={t('c4.linesFilter')} aria-label={t('c4.linesFilter')} />
      {kept.length === 0 && <PageState state="empty" compact title={t('c4.linesNone')} />}
      {kept.length > 0 && (
        <List
          label={t('c4.lines')}
          wrap
          selectedId={selectedId}
          onOpen={(id) => state.setSelection(selectConnection(id))}
          groups={[{
            id: 'lines',
            label: '',
            rows: kept.map((line) => ({
              id: line.id,
              code: String(line.number),
              text: `${line.from} → ${line.to}`,
              testId: `line-row-${line.number}`,
              actions: (
                <div className="lv-lines__said">
                  {said(line) && <span>{said(line)}</span>}
                  {window(line) && <span>{window(line)}</span>}
                  <span>
                    <Button size="small" data-testid="line-edit" onClick={() => { dialogs.setThisViewTab('properties'); dialogs.setThisViewOpen(false); }}>
                      {t('c4.lineEdit')}
                    </Button>
                  </span>
                </div>
              ),
            })),
          }]}
        />
      )}
    </div>
  );
}

/** A line that stops at the boundary is not a mistake: it says so, and offers the next step. */
export function UnlandedLines({ parts, diagram }: { parts: EditorParts; diagram: DesignDiagram }) {
  const { t } = useStrings();
  const { state, board, dialogs, readOnly } = parts;
  const lines = diagramLines(state.model, board.shownDiagram ?? diagram, board.lookingAt).filter((line) => line.unlanded);
  if (lines.length === 0) return null;
  const first = lines[0]!;
  const subject = state.model.elements.find((one) => one.id === diagram.applicationElementId)?.name;
  return (
    <section className="lv-unlanded" data-testid="unlanded-lines">
      <span className="lv-unlanded__title">{lines.length === 1 ? t('c4.unlandedOne') : t('c4.unlandedMany', { count: lines.length })}</span>
      <span className="lv-unlanded__how">{t('c4.unlandedHow', { from: first.from === subject ? first.to : first.from })}</span>
      {!readOnly && (
        <span>
          <Button size="small" data-testid="choose-container" onClick={() => { dialogs.setThisViewOpen(false); state.setSelection(selectConnection(first.id)); }}>
            {t('c4.chooseContainer')}
          </Button>
        </span>
      )}
    </section>
  );
}
