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
import { useStrings } from '../../i18n/LanguageContext';
import { PictureDialog, PictureGroup, PictureTitleFields } from '../../widgets/kit/PictureDialog';
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
  /** The window went out of sight while it runs: it stands still until the window is back, and says so. */
  outOfSight?: boolean;
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

export function ExportDialog(props: ExportDialogProps) {
  const { t } = useStrings();
  const { options, onChange, titleFields, exporting } = props;
  const large = props.size.megapixels > LARGE_EXPORT_MEGAPIXELS;
  const warning = props.outOfSight ? t('export.outOfSight') : large ? t('export.largeBody') : undefined;
  return (
    <PictureDialog
      open={props.open} name={props.name ?? ''} onSave={props.onExport} onClose={props.onClose} working={exporting} closesItself
      saveWord={large ? t('export.largeConfirm') : t('export.confirm')}
      {...(warning ? { warning } : {})}
      facts={<p className="export-dialog__size">{t('export.size', props.size)}</p>}
      titleBlock={{
        on: options.titleBlock,
        onChange: (titleBlock) => onChange({ ...options, titleBlock }),
        fields: (disabled) => (
          <>
            {titleFields && (
              <PictureTitleFields
                values={titleFields} clientFrom={titleFields.clientFrom} disabled={disabled}
                onChange={({ date, ...rest }) => titleFields.onChange({ ...rest, ...(date !== undefined ? { documentDate: date } : {}) })}
              />
            )}
            {/* The key lives on the strip: without one there is nowhere to draw it. */}
            <SettingSwitch boxFirst label={t('export.legend')} hint={t(props.offersLineList ? 'export.keyHelp' : 'export.legendHelp')} checked={options.legend && options.titleBlock} disabled={disabled} onChange={(legend) => onChange({ ...options, legend })} />
            {props.offersLineList && (
              <SettingSwitch boxFirst label={t('export.lineList')} hint={t('export.lineListHelp')} checked={options.lineList === true} disabled={disabled} onChange={(lineList) => onChange({ ...options, lineList })} />
            )}
          </>
        ),
      }}
      // The preview sits on the export's own background, so a light picture previewed in a dark window is seen as it will be seen.
      preview={(
        <>
          {props.preview
            ? <img src={props.preview} alt={t('export.preview')} />
            : <p role="status">{t('export.previewBusy')}</p>}
          {props.previewBusy && props.preview && <span className="export-dialog__busy" role="status">{t('export.previewBusy')}</span>}
        </>
      )}
    >
      <PictureGroup label={t('export.theme')}>
        <Segmented
          label={t('export.theme')} value={options.theme}
          onChange={(theme) => { if (!exporting) onChange({ ...options, theme }); }}
          options={[{ value: 'light', label: t('export.themeLight') }, { value: 'dark', label: t('export.themeDark') }]}
        />
      </PictureGroup>
      <SettingSwitch boxFirst label={t('export.labels')} hint={t('export.labelsHelp')} checked={options.showLabels} disabled={exporting} onChange={(showLabels) => onChange({ ...options, showLabels })} />
    </PictureDialog>
  );
}
