// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The export, as a dialog: which theme the picture is made in, whether every
 * line carries its label, whether the strip along the bottom is drawn — and a
 * preview of exactly what will leave, drawn by the same code that draws the
 * export.
 *
 * The preview is the point. A title block is composed onto the bitmap and
 * never appears on the canvas, a dark board can be exported light for a
 * document, and labels that are a hover away on screen are simply absent on
 * paper; none of that could be seen before pressing the button. Now the
 * button is pressed once the picture already looks right.
 *
 * The dialog owns none of the drawing. The editor renders the board under the
 * chosen options while this is open and hands over the preview and the size;
 * this decides nothing but what the person chose.
 */
import { useEffect, useState } from 'react';
import { useStrings } from '../../i18n/LanguageContext';
import { Button } from '../../widgets/kit/Button';
import { Dialog } from '../../widgets/kit/Dialog';
import { TextField } from '../../widgets/kit/Field';
import { Segmented } from '../../widgets/kit/Segmented';
import { SettingSwitch } from '../../widgets/kit/SettingsPage';
import { LARGE_EXPORT_MEGAPIXELS } from './exportPng';
import './ExportDialog.css';

/** What a person chooses about a picture. */
export interface ExportOptions {
  theme: 'light' | 'dark';
  /** Every line's label, not only the ones the pointer would find. */
  showLabels: boolean;
  /** The strip along the bottom: client, author, date. */
  titleBlock: boolean;
  /** The key under the strip: the aspect columns, the badge and lifecycle colours. */
  legend: boolean;
  /** Every line in words under the picture, where a label had to cut short. Only a container diagram offers it. */
  lineList?: boolean;
}

export interface ExportDialogProps {
  open: boolean;
  /** The view the picture is of. */
  name?: string;
  options: ExportOptions;
  onChange(next: ExportOptions): void;
  /** An object URL of the preview, or nothing while the first one is drawn. */
  preview?: string;
  previewBusy: boolean;
  /** The bitmap the export would produce, before it is produced. */
  size: { width: number; height: number; megapixels: number };
  /** The real export is running; the button spins and the options hold still. */
  exporting: boolean;
  onExport(): void;
  onClose(): void;
  /**
   * What the title block will say, editable here beside its preview: each value is
   * the diagram's own, written to its settings as it is left, with what an empty
   * field falls back on said under it. Absent where the view may not be changed.
   */
  titleFields?: ExportTitleFields;
  offersLineList?: boolean;
}

export interface ExportTitleFields {
  client: string;
  /** What the picture names where the client is empty. */
  clientFrom: string;
  author: string;
  date: string;
  onChange(patch: { client?: string; author?: string; documentDate?: string }): void;
}

/** One value of the title block: it lands as the person leaves the field. */
function TitleField({ label, hint, held, disabled, onCommit }: { label: string; hint: string; held: string; disabled: boolean; onCommit(next: string): void }) {
  const [typed, setTyped] = useState(held);
  useEffect(() => setTyped(held), [held]);
  return (
    <TextField
      label={label} hint={hint} value={typed} disabled={disabled} onChange={setTyped}
      onBlur={() => { if (typed.trim() !== held.trim()) onCommit(typed.trim()); }}
    />
  );
}

export function ExportDialog(props: ExportDialogProps) {
  const { t } = useStrings();
  const { options, onChange, titleFields, exporting } = props;
  const large = props.size.megapixels > LARGE_EXPORT_MEGAPIXELS;

  return (
    <Dialog
      open={props.open} size="l" title={props.name ? t('export.dialogTitleOf', { name: props.name }) : t('export.dialogTitle')} onClose={props.onClose} working={exporting}
      actions={(
        <>
          <Button onClick={props.onClose} disabled={exporting}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={props.onExport} working={exporting}>{large ? t('export.largeConfirm') : t('export.confirm')}</Button>
        </>
      )}
    >
      <div className="export-dialog">
        <div className="export-dialog__options">
          <Segmented
            label={t('export.theme')} value={options.theme}
            onChange={(theme) => { if (!exporting) onChange({ ...options, theme }); }}
            options={[{ value: 'light', label: t('export.themeLight') }, { value: 'dark', label: t('export.themeDark') }]}
          />
          <SettingSwitch label={t('export.labels')} hint={t('export.labelsHelp')} checked={options.showLabels} disabled={exporting} onChange={(showLabels) => onChange({ ...options, showLabels })} />
          <SettingSwitch label={t('export.titleBlock')} hint={t('export.titleBlockHelp')} checked={options.titleBlock} disabled={exporting} onChange={(titleBlock) => onChange({ ...options, titleBlock })} />
          {options.titleBlock && titleFields && (
            <div className="export-dialog__title-fields">
              <TitleField label={t('diagramSettings.client')} hint={t('diagramSettings.clientHelp', { name: titleFields.clientFrom })} held={titleFields.client} disabled={exporting} onCommit={(client) => titleFields.onChange({ client })} />
              <TitleField label={t('diagramSettings.author')} hint={t('export.authorHelp')} held={titleFields.author} disabled={exporting} onCommit={(author) => titleFields.onChange({ author })} />
              <TitleField label={t('diagramSettings.date')} hint={t('diagramSettings.dateHelp')} held={titleFields.date} disabled={exporting} onCommit={(documentDate) => titleFields.onChange({ documentDate })} />
            </div>
          )}
          {/* The key lives on the strip: without one there is nowhere to draw it. */}
          <SettingSwitch label={t('export.legend')} hint={t(props.offersLineList ? 'export.keyHelp' : 'export.legendHelp')} checked={options.legend && options.titleBlock} disabled={exporting || !options.titleBlock} onChange={(legend) => onChange({ ...options, legend })} />
          {props.offersLineList && (
            <SettingSwitch label={t('export.lineList')} hint={t('export.lineListHelp')} checked={options.lineList === true} disabled={exporting || !options.titleBlock} onChange={(lineList) => onChange({ ...options, lineList })} />
          )}
          <p className="export-dialog__size">{t('export.size', props.size)}</p>
          {large && <p className="export-dialog__large" role="status">{t('export.largeBody')}</p>}
        </div>
        {/* The preview sits on the export's own background, so a light picture
            previewed in a dark window is seen as it will be seen. */}
        <div className="export-dialog__preview">
          {props.preview
            ? <img src={props.preview} alt={t('export.preview')} />
            : <p role="status">{t('export.previewBusy')}</p>}
          {props.previewBusy && props.preview && <span className="export-dialog__busy" role="status">{t('export.previewBusy')}</span>}
        </div>
      </div>
    </Dialog>
  );
}
