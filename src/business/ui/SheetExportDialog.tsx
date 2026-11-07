// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The sheet as a picture, for a person (ADR-0012 §6).
 *
 * An agent could already ask for one (`diagram.render`); a person could not,
 * and the person is the one who has to hand a business architecture to a
 * board. The one choice that matters is the width the page is **laid out**
 * at: the grid fits as many area columns as the width has room for
 * (`business/grid.ts`), so an A1 or A0 print is not the window enlarged but
 * the same page tiled wider, with more areas side by side. The page redraws
 * itself at that width for the capture and comes back afterwards.
 *
 * Drawing takes a moment on a large page, so the dialog stays up while it
 * does, says so, and says why when the browser declines — a bitmap the size
 * of an A0 at two pixels per point is past what some of them will draw.
 */
import { useState } from 'react'
import { useStrings } from '../../i18n'
import type { DesignDiagram, SheetPaper } from '../../model'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { SelectField } from '../../widgets/kit/Field'
import { DEFAULT_PAPER, MAX_SPAN, PAPER_SIZES, isSheetPaper, paperHeight, paperWidth } from '../grid'
import type { PaperSize } from '../grid'
import type { SheetActions } from './FunctionInspector'

/** The window as it is, or a sheet of paper. */
export type ExportLayout = 'screen' | PaperSize

export type SheetExportDialogProps = {
  /** What the sheet is laid out on already, offered first. Absent = A1. */
  initial?: ExportLayout
  /** Draw the page at the width, or as it is, and hand the picture over. Rejects when the browser declined. */
  onExport(layout: ExportLayout): Promise<void>
  onClose(): void
  /** The sheet's own canvas and columns, which say how a picture is laid out. Absent for a reader, and for a map. */
  sheet?: DesignDiagram
  actions?: Pick<SheetActions, 'updateSheet'>
  /** What the dialog is called, where it is not the sheet's. */
  title?: string
  hint?: string
}

/** One to twice the widest an area may be: an A0 holds about fourteen columns, and nobody reads that. */
const COLUMN_CHOICES = Array.from({ length: MAX_SPAN * 2 }, (_, index) => index + 1)

export function SheetExportDialog({ initial, onExport, onClose, sheet, actions, title, hint }: SheetExportDialogProps) {
  const { t } = useStrings()
  const [layout, setLayout] = useState<ExportLayout>(initial ?? 'A1')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)

  const save = async () => {
    setBusy(true)
    setFailure(undefined)
    try {
      await onExport(layout)
      onClose()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open size="m" title={title ?? t('sheet.exportTitle')} onClose={onClose} working={busy}
      {...(failure !== undefined ? { error: t('sheet.exportFailed', { message: failure }) } : {})}
      actions={(
        <>
          <Button onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button variant="primary" working={busy} onClick={() => { void save() }}>{busy ? t('sheet.exportBusy') : t('sheet.exportSave')}</Button>
        </>
      )}
    >
      <p>{hint ?? t('sheet.exportHint')}</p>
      <SelectField
        label={t('sheet.exportPaper')} value={layout} disabled={busy} onChange={(value) => setLayout(value as ExportLayout)}
        options={[
          { value: 'screen', label: t('sheet.exportScreen') },
          ...PAPER_SIZES.map((paper) => ({ value: paper, label: `${paper} · ${paperWidth(paper)} × ${paperHeight(paper)} px` })),
        ]}
      />
      {sheet && actions && (
        <>
          <SelectField
            label={t('sheet.settingsPaper')} value={isSheetPaper(sheet.paper) ? sheet.paper : DEFAULT_PAPER} disabled={busy}
            onChange={(value) => actions.updateSheet({ paper: value === DEFAULT_PAPER ? undefined : value as SheetPaper })}
            options={[
              ...PAPER_SIZES.map((paper) => ({ value: paper, label: `${paper} · ${paperWidth(paper)} × ${paperHeight(paper)} px` })),
              { value: 'fit', label: t('sheet.paperFit') },
            ]}
          />
          <SelectField
            label={t('sheet.settingsColumns')} value={sheet.columns === undefined ? '' : String(sheet.columns)} disabled={busy}
            onChange={(value) => actions.updateSheet({ columns: value === '' ? undefined : Number(value) })}
            options={[{ value: '', label: t('sheet.columnsFit') }, ...COLUMN_CHOICES.map((count) => ({ value: String(count), label: String(count) }))]}
          />
        </>
      )}
    </Dialog>
  )
}
