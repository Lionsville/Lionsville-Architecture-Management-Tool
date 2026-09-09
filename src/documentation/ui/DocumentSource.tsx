/**
 * The source of a document while it is being written: one pane, the same on
 * every page that edits markdown.
 *
 * An element's description, a decision's body and a plan's body are three
 * strings drawn by one renderer, and until this file they were typed into
 * three textareas that had grown apart: only one of them could take a picture
 * in, one had a help card and another a page of help, and none could get the
 * preview out of the way. What a writer can do to markdown does not depend on
 * whose markdown it is, so it is said once here — the caret, ⌘B and ⌘I, Tab,
 * a pasted or dropped picture, the project's pictures, the business-case
 * template, the help card and the preview toggle — and the page keeps what is
 * its own: the draft, when it commits, and what stands beside the source.
 *
 * Controlled and stateless about the text: every insertion is answered as the
 * whole next value through `onChange`, computed against the textarea's own
 * value rather than the prop, because a paste lands while the value is
 * whatever was just typed and the prop may be one render behind.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import type { ClipboardEvent, DragEvent, KeyboardEvent, ReactNode, RefObject } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { DocumentImage } from '../../model/types'
import { useStrings } from '../../i18n/LanguageContext'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { TrashIcon } from '../../widgets/icons'
import { businessCaseTemplate } from '../businessCase'
import { imageReference, imagesUsedIn } from '../images'
import { MarkdownHelp } from './MarkdownHelp'

const CODE_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

/**
 * The pictures the project holds, so the writer can put one in again or take
 * one out (ADR-0009). `usedBy` names every document that shows a file — the
 * host knows the decisions and plans a page does not — and is what the delete
 * confirmation says.
 */
export type DocumentImages = {
  library: readonly DocumentImage[]
  usedBy(file: string): readonly string[]
  onRemove(file: string): void
}

export type DocumentSourceProps = {
  value: string
  onChange(next: string): void
  onBlur?(): void
  /** What the textarea is called, for a reader who cannot see it. */
  label: string
  /**
   * Take a pasted or dropped picture into the project, answering with the file
   * name to refer to — or `undefined` when the host refused it, in which case
   * nothing is written and the host has already said why (ADR-0009).
   * Absent = no way to add one, and neither affordance is offered.
   */
  onAddImage?(file: File): Promise<string | undefined>
  /** Absent = no list. */
  images?: DocumentImages
  /**
   * The rendered page beside this source, and whether it is up. A wide table
   * is written with the preview out of the way; absent, there is no toggle.
   */
  preview?: { shown: boolean; onToggle(): void }
  /** The page's own buttons, between the shared ones and the help. */
  extra?: ReactNode
  /** The page keeps the caret when it needs to put something there itself. */
  textareaRef?: RefObject<HTMLTextAreaElement | null>
}

export function DocumentSource(props: DocumentSourceProps) {
  const { value, onChange, onAddImage, images, preview } = props
  const { t } = useStrings()
  const ownRef = useRef<HTMLTextAreaElement>(null)
  const areaRef = props.textareaRef ?? ownRef

  /** Write text where the caret is, and leave the caret after it. */
  const insertAtCaret = useCallback((text: string) => {
    const area = areaRef.current
    if (!area) return
    const { selectionStart: start, selectionEnd: end, value: current } = area
    onChange(current.slice(0, start) + text + current.slice(end))
    const caret = start + text.length
    requestAnimationFrame(() => {
      area.focus()
      area.setSelectionRange(caret, caret)
    })
  }, [areaRef, onChange])

  // ⌘B / ⌘I wrap the selection; Tab indents rather than leaving the field.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const area = event.currentTarget
    const mod = event.metaKey || event.ctrlKey
    const wrap = (mark: string) => {
      event.preventDefault()
      const { selectionStart: start, selectionEnd: end, value: current } = area
      onChange(current.slice(0, start) + mark + current.slice(start, end) + mark + current.slice(end))
      requestAnimationFrame(() => area.setSelectionRange(start + mark.length, end + mark.length))
    }
    if (mod && event.key.toLowerCase() === 'b') wrap('**')
    else if (mod && event.key.toLowerCase() === 'i') wrap('_')
    else if (event.key === 'Tab' && !mod) {
      event.preventDefault()
      const { selectionStart: start, selectionEnd: end, value: current } = area
      onChange(current.slice(0, start) + '  ' + current.slice(end))
      requestAnimationFrame(() => area.setSelectionRange(start + 2, start + 2))
    }
  }

  // --- pictures ---------------------------------------------------------------

  const addImages = useCallback((files: readonly File[]) => {
    if (!onAddImage) return
    // One at a time and in order, so two pictures dropped together arrive in
    // the document in the order they were dropped rather than in whichever
    // order the reads happened to finish.
    void files.reduce(
      (queue, file) => queue.then(() => onAddImage(file).then((name) => {
        if (name) insertAtCaret(`\n\n${imageReference(name, file.name.replace(/\.[^.]+$/, ''))}\n\n`)
      })),
      Promise.resolve(),
    )
  }, [onAddImage, insertAtCaret])

  const imagesIn = (list: FileList | null | undefined): File[] =>
    Array.from(list ?? []).filter((file) => file.type.startsWith('image/'))

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = imagesIn(event.clipboardData?.files)
    if (!files.length || !onAddImage) return
    // Only when it IS a picture: a copied screenshot carries no text, but text
    // copied from a rich document can carry an image alongside it, and the
    // words are what the person meant.
    if (event.clipboardData?.getData('text/plain')) return
    event.preventDefault()
    addImages(files)
  }

  const onDrop = (event: DragEvent<HTMLTextAreaElement>) => {
    const files = imagesIn(event.dataTransfer?.files)
    if (!files.length || !onAddImage) return
    event.preventDefault()
    addImages(files)
  }

  const [showPictures, setShowPictures] = useState(false)
  const [deleting, setDeleting] = useState<string | undefined>(undefined)
  const library = images?.library ?? []
  const usedHere = useMemo(() => new Set(imagesUsedIn(value)), [value])
  const deletingUsedBy = deleting ? images?.usedBy(deleting) ?? [] : []

  const insertPicture = (image: DocumentImage) =>
    insertAtCaret(`\n\n${imageReference(image.file, image.file.replace(/\.[^.]+$/, ''))}\n\n`)

  return (
    <Box data-testid="document-source" sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
        {/* One line, however narrow the pane: the help button beside it says the rest. */}
        <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>
          {onAddImage ? t('doc.markdownImageHint') : t('doc.markdownHint')}
        </Typography>
        <Button size="small" onClick={() => insertAtCaret(`\n\n${businessCaseTemplate()}\n\n`)}>
          {t('doc.insertBusinessCase')}
        </Button>
        {images && (
          <Button
            size="small"
            variant={showPictures ? 'contained' : 'text'}
            disableElevation
            aria-pressed={showPictures}
            onClick={() => setShowPictures((open) => !open)}
          >
            {t('doc.pictures')} ({library.length})
          </Button>
        )}
        {props.extra}
        {preview && (
          <Button size="small" variant="outlined" aria-pressed={preview.shown} onClick={preview.onToggle}>
            {preview.shown ? t('doc.hidePreview') : t('doc.showPreview')}
          </Button>
        )}
        <MarkdownHelp images={Boolean(onAddImage)} />
      </Box>

      {images && showPictures && (
        <Box
          data-testid="doc-pictures"
          sx={{ maxHeight: 220, overflow: 'auto', borderBottom: 1, borderColor: 'divider', px: 1.5, py: 1 }}
        >
          {library.length === 0 && (
            <Typography variant="body2" color="text.secondary">{t('doc.picturesNone')}</Typography>
          )}
          {library.map((image) => (
            <Box key={image.file} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
              <Box
                component="img"
                src={image.url}
                alt=""
                sx={{ width: 48, height: 36, objectFit: 'contain', borderRadius: 0.5, bgcolor: 'action.hover', flexShrink: 0 }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, fontFamily: CODE_FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {image.file}
                </Typography>
                {usedHere.has(image.file) && (
                  <Typography variant="caption" color="text.secondary">{t('doc.pictureUsedHere')}</Typography>
                )}
              </Box>
              <Button size="small" onClick={() => insertPicture(image)}>{t('doc.insertPicture')}</Button>
              <Tooltip title={t('doc.deletePicture')}>
                <IconButton size="small" aria-label={`${t('doc.deletePicture')} ${image.file}`} onClick={() => setDeleting(image.file)}>
                  <TrashIcon size={16} />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      )}

      <Box
        component="textarea"
        ref={areaRef}
        aria-label={props.label}
        value={value}
        spellCheck={false}
        onChange={(e: { target: { value: string } }) => onChange(e.target.value)}
        onBlur={props.onBlur}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onDrop={onDrop}
        sx={{
          flex: 1, minHeight: 0, resize: 'none', border: 0, outline: 'none', p: 2,
          bgcolor: 'transparent', color: 'text.primary',
          font: `13px/1.6 ${CODE_FONT}`, tabSize: 2,
        }}
      />

      {/* Deleting a picture is the one thing on a page ⌘Z cannot take back, so it asks. */}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('doc.deletePictureTitle', { file: deleting ?? '' })}
        body={deletingUsedBy.length
          ? t('doc.deletePictureUsedBy', { labels: deletingUsedBy.join(', ') })
          : t('doc.deletePictureUnused')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) images?.onRemove(deleting)
          setDeleting(undefined)
        }}
      />
    </Box>
  )
}
