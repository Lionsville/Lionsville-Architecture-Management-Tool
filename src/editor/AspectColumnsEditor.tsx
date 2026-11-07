// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The maturity columns, as a list you can edit: rename, reorder, re-code, drop,
 * add a standard one, add your own.
 *
 * A component and not a section of a dialog, because the same list is edited in
 * two places for two reasons — on a diagram, where it decides what that
 * landscape's cards show, and on a project, where it decides what a *new*
 * landscape starts with. One editor means those two never drift apart in what
 * they let you type.
 *
 * Controlled: the caller owns the columns and the "these are new" set. Keys are
 * what per-element statuses are filed under, so a rename never moves one; the
 * caller re-keys the fresh ones on save via {@link settleFreshAspectKeys}.
 */
import { useState } from 'react';
import { Button } from '../widgets/kit/Button';
import { TextInput } from '../widgets/kit/Field';
import { MenuButton, MoreMenu } from '../widgets/kit/Menu';
import './AspectColumnsEditor.css';
import {
  ASPECT_CODE_MAX,
  ASPECT_SUPERSET,
  DEFAULT_ASPECT_CONFIG,
  aspectKeyForLabel,
  aspectShortCode,
} from '../model/aspects';
import { useStrings } from '../i18n/LanguageContext';
import type { AspectConfigEntry } from '../model/types';

export interface AspectColumnsEditorProps {
  columns: AspectConfigEntry[];
  /** Keys added in this sitting — nothing is filed under them yet. */
  fresh: string[];
  onChange(columns: AspectConfigEntry[], fresh: string[]): void;
  /** Drawn faded while the caller has the row switched off. */
  dimmed?: boolean;
}

export function AspectColumnsEditor({
  columns, fresh, onChange, dimmed = false,
}: AspectColumnsEditorProps) {
  const { t } = useStrings();
  const [dragged, setDragged] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  const setColumns = (next: AspectConfigEntry[]) => onChange(next, fresh);
  const editColumn = (index: number, patch: Partial<AspectConfigEntry>) =>
    setColumns(columns.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const move = (index: number, by: number) => {
    const to = index + by;
    if (to < 0 || to >= columns.length) return;
    const next = [...columns];
    const [taken] = next.splice(index, 1);
    next.splice(to, 0, taken);
    setColumns(next);
  };

  const unusedStandard = ASPECT_SUPERSET.filter(
    (entry) => !columns.some((c) => c.key === entry.key),
  );

  const addStandard = (entry: AspectConfigEntry) => {
    setColumns([...columns, { ...entry }]);
  };
  const addCustom = () => {
    const label = t('diagramSettings.newColumn');
    const key = aspectKeyForLabel(label, columns.map((c) => c.key));
    onChange([...columns, { key, label }], [...fresh, key]);
  };

  return (
    <div className="aspect-table" data-dimmed={dimmed || undefined}>
      {columns.length === 0 && <p className="aspect-table__none">{t('diagramSettings.noColumns')}</p>}
      {columns.length > 0 && (
        <div className="aspect-table__row aspect-table__row--head" aria-hidden>
          <span />
          <span>{t('diagramSettings.columnLabel')}</span>
          <span>{t('diagramSettings.columnCode')}</span>
          <span />
        </div>
      )}
      {columns.map((column, index) => (
        <div
          key={column.key} className="aspect-table__row" data-drop={dropAt === index || undefined}
          onDragOver={(event) => { if (dragged !== null) { event.preventDefault(); setDropAt(index); } }}
          onDrop={(event) => { event.preventDefault(); if (dragged !== null) move(dragged, index - dragged); setDragged(null); setDropAt(null); }}
        >
          <span
            className="aspect-table__grip" draggable aria-hidden
            onDragStart={() => setDragged(index)} onDragEnd={() => { setDragged(null); setDropAt(null); }}
          >
            ⋮⋮
          </span>
          <TextInput aria-label={t('diagramSettings.columnLabel')} value={column.label} onChange={(e) => editColumn(index, { label: e.target.value })} />
          <TextInput
            aria-label={t('diagramSettings.columnCode')} maxLength={ASPECT_CODE_MAX} value={column.code ?? ''}
            // What the badge would say if this stayed empty: for a standard
            // column its curated code (`dr` reads DR), not one from the label.
            placeholder={aspectShortCode({ ...column, code: undefined }) || t('diagramSettings.codePlaceholder')}
            onChange={(e) => editColumn(index, { code: e.target.value })}
          />
          <span className="aspect-table__acts">
            <Button size="small" variant="quiet" aria-label={t('diagramSettings.remove', { name: column.label })} onClick={() => setColumns(columns.filter((_, i) => i !== index))}>
              {t('diagramSettings.removeWord')}
            </Button>
            {/* The drag's keyboard path. */}
            <MoreMenu
              size="small"
              items={[
                ...(index > 0 ? [{ label: t('diagramSettings.moveUp', { name: column.label }), onSelect: () => move(index, -1) }] : []),
                ...(index < columns.length - 1 ? [{ label: t('diagramSettings.moveDown', { name: column.label }), onSelect: () => move(index, 1) }] : []),
              ]}
            />
          </span>
        </div>
      ))}
      <div className="aspect-table__add">
        <MenuButton
          label={t('diagramSettings.addStandard')} size="small" variant="plain"
          items={unusedStandard.length === 0
            ? [{ label: t('diagramSettings.allStandardUsed'), refused: t('diagramSettings.allStandardUsed'), onSelect: () => undefined }]
            : unusedStandard.map((entry) => ({ label: entry.label, onSelect: () => addStandard(entry) }))}
        />
        <Button size="small" onClick={addCustom}>{t('diagramSettings.addCustom')}</Button>
        <span className="aspect-table__grow" />
        <Button size="small" variant="quiet" onClick={() => setColumns([...DEFAULT_ASPECT_CONFIG])}>{t('diagramSettings.reset')}</Button>
      </div>
    </div>
  );
}

/**
 * Re-key the columns added in this sitting from the labels they ended up with,
 * so a column typed as "Service levels" is filed as `custom-service-levels` and
 * not as whatever the placeholder said when the row appeared.
 *
 * Columns that were already in the model keep their keys whatever happens to
 * their labels — statuses are filed under those.
 */
export function settleFreshAspectKeys(
  columns: readonly AspectConfigEntry[],
  fresh: readonly string[],
): AspectConfigEntry[] {
  if (fresh.length === 0) return [...columns];
  const settled = columns.filter((c) => !fresh.includes(c.key)).map((c) => c.key);
  return columns.map((column) => {
    if (!fresh.includes(column.key)) return column;
    const key = aspectKeyForLabel(column.label, settled);
    settled.push(key);
    return { ...column, key };
  });
}
