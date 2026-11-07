// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The poster on paper: one page, with a title and a foot, in a print look that ignores
 * the theme. A PDF is text and lines, from the host (Electron's `printToPDF` on the
 * desktop, the browser's print dialog on the web); a PNG is a picture on both, and no
 * promise of pixels alike between them. Before anything is saved it says how many
 * names this paper cuts, and a press selects them, so nobody finds out on the wall.
 */
import { useMemo, useState } from 'react'
import { useStrings } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { plural } from '../../i18n/strings'
import type { DesignDiagram, ElementId } from '../../model'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { TextField } from '../../widgets/kit/Field'
import { Segmented } from '../../widgets/kit/Segmented'
import { PRINT_PAPERS, printScale } from '../../widgets/printPage'
import type { PrintLook, PrintPaper } from '../../widgets/printPage'
import { POSTER_WIDTH } from '../posterLayout'

type PaperName = keyof typeof PRINT_PAPERS
const NAMES = Object.keys(PRINT_PAPERS) as PaperName[]

/** A name at this size reads at this distance, roughly; the thresholds are a sheet's on a desk, on a table and on a wall. */
const DESK_PT = 7
const TABLE_PT = 9
/** What a tile's name is drawn at on the page, in points at 100%. */
const NAME_PT = (13 * 72) / 96

export type PosterExport = {
  paper: PrintPaper
  file: 'pdf' | 'png'
  look: PrintLook
  title: string
  foot: string
  date: string
}

export function PosterExportDialog({ sheet, page, scopeName, keyWords, cutNames, waiting, canWrite, onSheet, onSave, onSelectCut, onClose, today }: {
  sheet: DesignDiagram
  page: { width: number; height: number }
  /** What the title says beside the view's own name. */
  scopeName: string | undefined
  /** What the key says, where a Colour is up. */
  keyWords: readonly string[]
  cutNames(paper: PrintPaper): readonly ElementId[]
  /** Blocks with no room on the page, which are not on the paper either. */
  waiting: number
  canWrite: boolean
  onSheet(patch: Partial<Pick<DesignDiagram, 'poster' | 'paper' | 'client' | 'documentDate'>>): void
  onSave(how: PosterExport): Promise<void>
  onSelectCut(ids: readonly ElementId[]): void
  onClose(): void
  today: string
}) {
  const { t, language } = useStrings()
  const held = sheet.paper
  const [paperName, setPaperName] = useState<PaperName>(held !== undefined && held !== 'wide' && held !== 'fit' ? held : 'A2')
  const [file, setFile] = useState<'pdf' | 'png'>('pdf')
  const [look, setLook] = useState<PrintLook>('print')
  const [title, setTitle] = useState([sheet.client ?? scopeName, sheet.name].filter(Boolean).join(', '))
  const [foot, setFoot] = useState(sheet.poster?.foot ?? '')
  const date = sheet.documentDate ?? (today !== '' ? formatDay(today, language) : '')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const paper = PRINT_PAPERS[paperName]
  const cut = useMemo(() => cutNames(paper), [cutNames, paper])
  const scale = printScale(page, paper, true)
  const named = NAME_PT * scale
  const reach = named < DESK_PT ? t('sheet.poster.reachDesk') : named < TABLE_PT ? t('sheet.poster.reachTable') : t('sheet.poster.reachWall')
  const save = async () => {
    setBusy(true)
    setFailure(undefined)
    try {
      if (canWrite && foot !== (sheet.poster?.foot ?? '')) onSheet({ poster: { ...sheet.poster, ...(foot !== '' ? { foot } : { foot: undefined }) } })
      await onSave({ paper, file, look, title, foot, date })
      onClose()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open size="m" title={t('sheet.poster.exportTitle')} onClose={onClose} working={busy}
      {...(failure !== undefined ? { error: t('sheet.exportFailed', { message: failure }) } : {})}
      actions={(
        <>
          <Button onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button variant="primary" working={busy} data-testid="poster-export-save" onClick={() => { void save() }}>{busy ? t('sheet.exportBusy') : t('sheet.exportSave')}</Button>
        </>
      )}
    >
      <Segmented label={t('sheet.exportPaper')} value={paperName} onChange={setPaperName} options={NAMES.map((name) => ({ value: name, label: name }))} />
      <p data-testid="poster-export-size">{t('sheet.poster.exportSize', { points: named.toFixed(1), reach })}</p>
      <Segmented label={t('sheet.poster.exportFile')} value={file} onChange={setFile} options={[{ value: 'pdf', label: 'PDF' }, { value: 'png', label: 'PNG' }]} />
      <Segmented label={t('sheet.poster.exportLook')} value={look} onChange={setLook} options={[{ value: 'print', label: t('sheet.poster.lookPrint') }, { value: 'screen', label: t('sheet.poster.lookScreen') }]} />
      {keyWords.length > 0 && <p>{t('sheet.poster.exportKey', { key: keyWords.join(', ') })}</p>}
      <TextField label={t('sheet.poster.exportTitleField')} value={title} onChange={setTitle} />
      <TextField label={t('sheet.poster.exportFoot')} value={foot} onChange={setFoot} />
      <p>{t('sheet.poster.exportDate', { date })}</p>
      {cut.length > 0
        ? (
          <p data-testid="poster-export-cut">
            {plural(t, { one: 'sheet.poster.cutOne', other: 'sheet.poster.cutOther' }, cut.length)}{' '}
            <button type="button" className="sheet-page__link" onClick={() => { onSelectCut(cut); onClose() }}>{t('sheet.poster.cutSelect')}</button>
          </p>
        )
        : <p data-testid="poster-export-cut">{t('sheet.poster.cutNone')}</p>}
      {waiting > 0 && <p>{plural(t, { one: 'sheet.poster.waitingOne', other: 'sheet.poster.waitingOther' }, waiting)}</p>}
      {page.width > POSTER_WIDTH && <p>{t('sheet.poster.exportWider')}</p>}
    </Dialog>
  )
}
