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
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n'
import { PAPER_SIZES, paperWidth } from '../grid'
import type { PaperSize } from '../grid'

/** The window as it is, or a sheet of paper. */
export type ExportLayout = 'screen' | PaperSize

export type SheetExportDialogProps = {
  /** Draw the page at the width, or as it is, and hand the picture over. Rejects when the browser declined. */
  onExport(layout: ExportLayout): Promise<void>
  onClose(): void
}

export function SheetExportDialog({ onExport, onClose }: SheetExportDialogProps) {
  const { t } = useStrings()
  const [layout, setLayout] = useState<ExportLayout>('A1')
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
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('sheet.exportTitle')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('sheet.exportHint')}</Typography>
        <TextField
          select size="small" fullWidth
          label={t('sheet.exportPaper')}
          value={layout}
          disabled={busy}
          slotProps={{ htmlInput: { 'aria-label': t('sheet.exportPaper') } }}
          onChange={(e) => setLayout(e.target.value as ExportLayout)}
        >
          <MenuItem value="screen">{t('sheet.exportScreen')}</MenuItem>
          {PAPER_SIZES.map((paper) => (
            <MenuItem key={paper} value={paper}>{paper} · {paperWidth(paper)} px</MenuItem>
          ))}
        </TextField>
        {failure !== undefined && (
          <Typography role="alert" sx={{ fontSize: 12, color: 'error.main' }}>
            {t('sheet.exportFailed', { message: failure })}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
        <Button
          size="small" variant="contained" disabled={busy}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
          onClick={() => { void save() }}
        >
          {busy ? t('sheet.exportBusy') : t('sheet.exportSave')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
