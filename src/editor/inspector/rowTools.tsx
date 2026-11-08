// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the panel and the record share about their rows: which are shown where,
 * and how a press picks a value out of a list.
 *
 * **One list builds both surfaces.** A section is a list of `RowSpec`s, each with
 * one rule. The record shows them all, an empty one as a quiet dash. The panel
 * shows what `always` says, and what `filled` says only once it holds something:
 * an owner is set on a few applications in fifty, and a box for it on all fifty
 * reads as a to-do list. The rest wait behind *+ Owner, vendor…*.
 */
import { Fragment, useState } from 'react';
import type { ReactNode } from 'react';
import { useStrings } from '../../i18n/LanguageContext';
import { inSentence } from '../../i18n/languages';
import type { Language } from '../../i18n/languages';
import { PanelSection } from '../../widgets/kit/Panel';
import { PropertyRows } from '../../widgets/kit/Field';
import type { PropertyRowEdit } from '../../widgets/kit/Field';
import { Picker } from '../../widgets/kit/Picker';
import type { PickerOption } from '../../widgets/kit/Picker';

export type Surface = 'panel' | 'record';

export type RowSpec = {
  readonly key: string;
  /** How it is offered under *+ add*. */
  readonly label: string;
  readonly rule: 'always' | 'filled';
  readonly filled: boolean;
  /** The row. `opening`: it was just asked for, so it arrives as a field. */
  readonly node: (opening: boolean) => ReactNode;
};

/** The empty-row word on the record: a quiet dash rather than a box to fill. */
export const DASH = '—';

/** What a row may leave out on this surface, given what was asked for since. */
export function rowsShown(rows: readonly RowSpec[], surface: Surface, added: ReadonlySet<string>) {
  const shown = (row: RowSpec) => surface === 'record' || row.rule === 'always' || row.filled || added.has(row.key);
  return { shown: rows.filter(shown), held: rows.filter((row) => !shown(row)) };
}

/** *Owner, vendor, technology…*: the first few of what is left out, and that there is more. */
export function addLabel(held: readonly { readonly label: string }[], language: Language = 'en'): string {
  // As many as fit on the panel's one line.
  const said: string[] = [];
  for (const { label } of held.slice(0, 3)) {
    const word = said.length === 0 ? label : inSentence(label, language);
    if (said.length > 0 && [...said, word].join(', ').length > 28) break;
    said.push(word);
  }
  return said.length < held.length ? `${said.join(', ')}…` : said.join(', ');
}

export function RowSet({ rows, surface, title, aside, readOnly, onHelp, after }: {
  rows: readonly RowSpec[];
  surface: Surface;
  title?: string;
  aside?: ReactNode;
  readOnly?: boolean;
  onHelp?: (help: string | undefined) => void;
  /** What follows the rows in the same section: a sentence, a thread. */
  after?: ReactNode;
}) {
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const [opening, setOpening] = useState<string>();
  const { language } = useStrings();
  const { shown, held } = rowsShown(rows, surface, added);
  if (shown.length === 0 && (readOnly || held.length === 0) && !after) return null;
  return (
    <PanelSection title={title} aside={aside}>
      <PropertyRows
        readOnly={readOnly}
        onHelp={onHelp}
        add={held.length > 0 ? {
          label: addLabel(held, language),
          items: held.map((row) => ({
            label: row.label,
            onSelect: () => { setAdded(new Set([...added, row.key])); setOpening(row.key); },
          })),
        } : undefined}
      >
        {shown.map((row) => <Fragment key={row.key}>{row.node(opening === row.key)}</Fragment>)}
      </PropertyRows>
      {after}
    </PanelSection>
  );
}

/** A press opens the list where the value stood; picking is the commit, and leaving puts the row back. */
export function pickEdit({ label, options, onCreate, createLabel, placeholder }: {
  label: string;
  options: readonly PickerOption[];
  onCreate?: (name: string) => void;
  createLabel?: (name: string) => string;
  placeholder?: string;
}): PropertyRowEdit {
  return (editor) => (
    <Picker
      label={label} options={options} placeholder={placeholder} autoFocus posture="open"
      onPick={(option) => editor.commit(option.id)}
      {...(onCreate ? { onCreate: (name: string) => { editor.cancel(); onCreate(name); } } : {})}
      {...(createLabel ? { createLabel } : {})}
      onEscape={editor.cancel}
      onLeave={editor.cancel}
    />
  );
}
