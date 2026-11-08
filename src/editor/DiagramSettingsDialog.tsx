// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Everything about one board that is not the picture, in two tabs because they are
 * two questions: what sits on the cards, shown on a card as it is edited, and what
 * is printed on an export.
 *
 * The columns are the reason this dialog exists. `aspectConfig` was per-diagram
 * data from the start — ordered, renameable, and round-tripping through
 * interchange — but the only way to set it was to hand-edit a file, so every
 * landscape in the world got Platform / CI/CD / DR / Security / Monitoring
 * whether or not those were the five things that organisation actually tracks.
 *
 * The draft is held here and applied on Save, so a half-typed column is never a
 * column, and an accidental "remove everything" is one Cancel away. What leaves
 * is a whole {@link DiagramSettings} — the host applies it, this dialog does not
 * know what a model is.
 */
import { useState } from 'react';
import { Button } from '../widgets/kit/Button';
import { Card } from '../widgets/kit/Card';
import { Dialog } from '../widgets/kit/Dialog';
import { DateField, TextField } from '../widgets/kit/Field';
import { Tabs } from '../widgets/kit/Tabs';
import { ViewBarCheck } from '../widgets/kit/ViewBar';
import { AspectBadgeRow } from './nodes/AspectBadgeRow';
import './canvas/board.css';
import { AspectColumnsEditor, settleFreshAspectKeys } from './AspectColumnsEditor';
import { DEFAULT_ASPECT_CONFIG, normaliseAspectConfig } from '../model/aspects';
import { useStrings } from '../i18n/LanguageContext';
import type { AspectConfigEntry, DesignDiagram, DiagramSettings } from '../model/types';

export interface DiagramSettingsDialogProps {
  /** The diagram being configured; the dialog is closed while undefined. */
  target?: DesignDiagram;
  /**
   * The client the export would name if this diagram says nothing — the group
   * the project is filed under. Shown as the placeholder, so "leave it empty"
   * is a visible choice rather than a guess.
   */
  defaultClient: string;
  onSave(diagramId: string, settings: DiagramSettings): void;
  onClose(): void;
}

type Draft = {
  name: string;
  author: string;
  client: string;
  documentDate: string;
  showTitleBlock: boolean;
  columns: AspectConfigEntry[];
  showAspects: boolean;
  /**
   * Columns added in this sitting. Their keys are still up for grabs — nothing
   * has been filed under them — so they are re-derived from the final label on
   * save. A column that was already in the model keeps its key whatever happens
   * to its label, because per-element statuses are filed under it.
   */
  fresh: string[];
};

function draftOf(diagram: DesignDiagram): Draft {
  return {
    name: diagram.name,
    author: diagram.author ?? '',
    client: diagram.client ?? '',
    documentDate: diagram.documentDate ?? '',
    showTitleBlock: diagram.showTitleBlock !== false,
    // Deliberately not `aspectConfigFor`: that answers "what renders", and a
    // hidden diagram renders nothing. This dialog edits what is configured,
    // which outlives the hiding.
    columns: [...(diagram.aspectConfig ?? DEFAULT_ASPECT_CONFIG)],
    showAspects: diagram.showAspects !== false,
    fresh: [],
  };
}

export function DiagramSettingsDialog({
  target, defaultClient, onSave, onClose,
}: DiagramSettingsDialogProps) {
  const { t } = useStrings();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<'cards' | 'export'>('cards');
  // A fresh target resets the draft; the same target keeps what was typed, so a
  // stray click on the backdrop is recoverable by reopening.
  const [seenId, setSeenId] = useState<string | undefined>(undefined);
  if (target && seenId !== target.id) {
    setSeenId(target.id);
    setDraft(draftOf(target));
  }

  const isLayer7 = target?.kind === 'layer7';
  const edit = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const trimmedName = draft?.name.trim() ?? '';
  const canSave = Boolean(target) && trimmedName.length > 0;
  const commit = () => {
    if (!target || !draft || !canSave) return;
    const columns = normaliseAspectConfig(settleFreshAspectKeys(draft.columns, draft.fresh));
    onSave(target.id, {
      name: trimmedName,
      author: draft.author.trim() || undefined,
      client: draft.client.trim() || undefined,
      documentDate: draft.documentDate.trim() || undefined,
      // Absent is the default in the model, so only the deviation is stored —
      // a diagram nobody configured stays a diagram nobody configured.
      showTitleBlock: draft.showTitleBlock ? undefined : false,
      // Container diagrams have no aspect row; saying nothing keeps whatever a
      // future version might put there rather than blanking it.
      aspectConfig: isLayer7 ? columns : undefined,
      showAspects: isLayer7 && !draft.showAspects ? false : undefined,
    });
    onClose();
  };

  const open = target !== undefined && draft !== null;
  const name = draft && (
    <TextField
      autoFocus
      label={t('field.name')}
      value={draft.name}
      onChange={(next) => edit({ name: next })}
    />
  );
  const onCards = draft && (
    <div className="lv-settings__cards">
      {name}
      <div className="lv-settings__columns">
        <div>
          <div className="lv-settings__head">
            <h3 className="lv-settings__title">{t('diagramSettings.aspects')}</h3>
            <ViewBarCheck label={t('diagramSettings.showAspects')} checked={draft.showAspects} onChange={(showAspects) => edit({ showAspects })} />
          </div>
          <p className="lv-settings__help">{t('diagramSettings.aspectsHelp')}</p>
          {!draft.showAspects && <p className="lv-settings__help">{t('diagramSettings.hiddenNote')}</p>}
          <AspectColumnsEditor
            columns={draft.columns}
            fresh={draft.fresh}
            dimmed={!draft.showAspects}
            onChange={(columns, fresh) => edit({ columns, fresh })}
          />
        </div>
        <CardPreview columns={draft.columns} shown={draft.showAspects} />
      </div>
    </div>
  );
  const onExport = draft && (
    <div className="lv-settings__export">
      {!isLayer7 && name}
      <p className="lv-settings__help">{t('diagramSettings.presentationHelp')}</p>
      <ViewBarCheck
        label={t('diagramSettings.showTitleBlock')}
        checked={draft.showTitleBlock}
        onChange={(showTitleBlock) => edit({ showTitleBlock })}
      />
      <div className="lv-settings__pair">
        <TextField
          label={t('diagramSettings.author')}
          placeholder={t('diagramSettings.authorPlaceholder')}
          value={draft.author}
          disabled={!draft.showTitleBlock}
          onChange={(author) => edit({ author })}
        />
        <TextField
          label={t('diagramSettings.client')}
          placeholder={defaultClient}
          hint={t('diagramSettings.clientHelp', { name: defaultClient })}
          value={draft.client}
          disabled={!draft.showTitleBlock}
          onChange={(client) => edit({ client })}
        />
      </div>
      <DateField
        label={t('diagramSettings.date')}
        hint={t('diagramSettings.dateHelp')}
        value={draft.documentDate}
        disabled={!draft.showTitleBlock}
        onChange={(documentDate) => edit({ documentDate })}
      />
    </div>
  );
  return (
    <Dialog
      open={open}
      size="l"
      title={t('diagramSettings.title')}
      onClose={onClose}
      onSubmit={commit}
      actions={(
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" disabled={!canSave}>{t('common.save')}</Button>
        </>
      )}
    >
      {draft && isLayer7 && (
        <>
          <Tabs
            label={t('diagramSettings.title')}
            value={tab}
            onChange={setTab}
            items={[
              { value: 'cards', label: t('diagramSettings.tabCards') },
              { value: 'export', label: t('diagramSettings.tabExport') },
            ]}
          />
          {tab === 'cards' ? onCards : onExport}
        </>
      )}
      {draft && !isLayer7 && onExport}
    </Dialog>
  );
}

/** What the columns come to on a card, as they are edited, at the distance the codes show. */
function CardPreview({ columns, shown }: { columns: readonly AspectConfigEntry[]; shown: boolean }) {
  const { t } = useStrings();
  return (
    <div className="lv-settings__preview">
      <div className="lv-settings__help">{t('diagramSettings.looksLike')}</div>
      <Card
        name={t('diagramSettings.previewName')}
        marks={shown && columns.length > 0 ? <AspectBadgeRow aspects={{}} config={columns} /> : undefined}
      />
      <p className="lv-settings__help">{t('diagramSettings.previewNote')}</p>
    </div>
  );
}
