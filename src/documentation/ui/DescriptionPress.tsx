// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A description in a panel, read as text: its first lines, a press with a
 * pencil to write it, and the way to its page. An open editor standing where
 * the description is read looked like a form left half filled.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useStrings } from '../../i18n/LanguageContext';
import { PencilIcon } from '../../widgets/icons';
import { Button } from '../../widgets/kit/Button';
import { claimKey } from '../../widgets/kit/keys';
import { PanelLink } from '../../widgets/kit/Panel';
import { shortDescription } from '../documentation';
import type { MarkdownRenderOptions } from '../documentation';
import { MarkdownField } from './MarkdownField';
import './DescriptionPress.css';

export function DescriptionPress({ text, locked, onChange, renderMarkdown, onOpenPage, openPageLabel, addLabel }: {
  readonly text: string;
  /** Read only: the words, and no press. */
  readonly locked: boolean;
  readonly onChange: (value: string) => void;
  readonly renderMarkdown?: ((md: string, options?: MarkdownRenderOptions) => ReactNode) | undefined;
  readonly onOpenPage?: (() => void) | undefined;
  readonly openPageLabel?: string;
  /** What an empty one offers, where the screen says it its own way. */
  readonly addLabel?: string;
}) {
  const { t } = useStrings();
  const [writing, setWriting] = useState(false);
  if (writing && !locked) {
    return (
      <div className="description-press" data-shortcuts-ignore="" onKeyDown={(event) => { if (event.key === 'Escape') { claimKey(event); setWriting(false); } }}>
        <MarkdownField value={text} disabled={false} autoFocus onChange={onChange} renderMarkdown={renderMarkdown} onOpenDocumentation={onOpenPage} />
        <Button size="small" variant="quiet" onClick={() => setWriting(false)}>{t('field.descriptionDone')}</Button>
      </div>
    );
  }
  const shown = shortDescription(text) || text;
  return (
    <div className="description-press" data-testid="element-description">
      {locked
        ? shown && <p className="description-press__text">{shown}</p>
        : (
          <button
            type="button" className="description-press__press" data-empty={shown ? undefined : true} onClick={() => setWriting(true)}
            aria-label={shown ? `${t('field.writeDescription')}: ${shown}` : undefined}
          >
            <span className="description-press__text">{shown || (addLabel ?? t('field.addDescription'))}</span>
            <span className="description-press__pen" aria-hidden="true"><PencilIcon size={14} /></span>
          </button>
        )}
      {onOpenPage && openPageLabel && <PanelLink data-testid="open-documentation" onPress={onOpenPage}>{openPageLabel}</PanelLink>}
    </div>
  );
}
