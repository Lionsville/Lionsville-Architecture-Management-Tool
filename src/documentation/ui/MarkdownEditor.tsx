// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one place a person writes markdown, in any size: a pane on the pages that
 * hold a document, a field where a description sits among other fields.
 *
 * The source is the thing. What is stored is what is in the textarea, in plain
 * characters, and every help here only types what the writer would have typed:
 * the toolbar and the keys (`markdownEditing`), a list or table that carries on
 * at Enter, an address pasted over words, `/` for a block and `[[` or `@` for a
 * reference (`ReferenceCompletion`), a pasted or dropped picture or file. Write,
 * Preview and side by side show the same text.
 *
 * A change goes through the browser's own editing where it can, so ⌘Z takes back
 * a bold as it takes back a word. Answered as the whole next value otherwise,
 * computed against the textarea's own value rather than the prop: a paste lands
 * while the value is whatever was just typed, and the prop may be a render behind.
 *
 * The page keeps what is its own: the draft, when it commits, and what the
 * preview shows around the text.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ClipboardEvent, DragEvent, FocusEvent, KeyboardEvent, ReactNode, RefObject } from 'react'
import Button from '@mui/material/Button'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { ImageEntry } from '../../model/imageName'
import { useStrings } from '../../i18n/LanguageContext'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { TrashIcon } from '../../widgets/icons'
import { attachmentMarkdown } from '../attachments'
import { businessCaseTemplate } from '../businessCase'
import { imagesUsedIn, pictureMarkdown } from '../images'
import {
  BLOCK_SNIPPETS, continueOnEnter, headingOfCaret, headingsAt, insertBlock, insertInline, linkOnPaste, missingSections,
  tabIn, wordCount,
} from '../markdownEditing'
import type { Edit, HeadingAt, Selected } from '../markdownEditing'
import { useAttachments } from './Attachments'
import { MarkdownGuide } from './MarkdownGuide'
import { MarkdownToolbar, OutlineMenu, ViewSwitch, toolOfKey } from './MarkdownToolbar'
import type { MarkdownViewMode } from './MarkdownToolbar'
import { PictureIcon } from './markdownIcons'
import { PictureThumbnail, usePictureScope } from './Pictures'
import { caretRect, InsertMenu, useReferenceCompletion } from './ReferenceCompletion'
import type { Completion, SlashBlock } from './ReferenceCompletion'
import type { Referable } from '../references'
import './MarkdownEditor.css'

/**
 * The pictures the project holds, so the writer can put one in again or take
 * one out (ADR-0009). `usedBy` names every document that shows a file — the
 * host knows the decisions and plans a page does not — and is what the delete
 * confirmation says.
 */
export type DocumentImages = {
  library: readonly ImageEntry[]
  usedBy(file: string): readonly string[]
  onRemove(file: string): void
}

/** A text this record starts from. Its `##` sections are offered one by one once it has been started. */
export type MarkdownTemplate = { label: string; text: string }

export type MarkdownEditorProps = {
  value: string
  onChange(next: string): void
  onBlur?(): void
  /** What the text is called: on the field, and for a reader who cannot see it. */
  label: string
  /** A pane fills the height it is given and always shows its bar; a field grows with its text and shows its tools while in use. */
  variant?: 'pane' | 'field'
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
  minRows?: number
  maxRows?: number
  /** What the words look like read. Absent: no Preview, and only the text. */
  renderPreview?(text: string): ReactNode
  /**
   * Take a pasted or dropped picture into the project, answering with the file
   * name to refer to — or `undefined` when the host refused it, in which case
   * nothing is written and the host has already said why (ADR-0009).
   * Absent = no way to add one, and neither affordance is offered.
   */
  onAddImage?(file: File): Promise<string | undefined>
  /** Absent = no list. */
  images?: DocumentImages
  /** Whether a source's attachments are offered here, where it keeps them. A comment is not documentation. */
  attachable?: boolean
  template?: MarkdownTemplate
  /** The page's own buttons, on a pane's bar. */
  extra?: ReactNode
  /** What stands above the text in a pane, in its column: a record's title. */
  above?: ReactNode
  /** A line under a field: an example, or what is wrong. */
  helper?: ReactNode
  error?: boolean
  required?: boolean
  /** A word beside the label: *optional*. */
  note?: string
  /** ⌘Enter, where the text has a button that sends it. */
  onSubmit?(): void
  textareaRef?: RefObject<HTMLTextAreaElement | null>
  testId?: string
  previewTestId?: string
}

const LINE = 21

/** From how many headings a document is long enough to want a way around it. */
const OUTLINE_FROM = 3

/** Put an edit into the textarea through the browser's own editing, so its undo keeps it; otherwise as the whole next value. */
function applyEdit(area: HTMLTextAreaElement, edit: Edit, onChange: (next: string) => void) {
  const before = area.value
  const after = edit.text
  let from = 0
  while (from < before.length && from < after.length && before[from] === after[from]) from += 1
  let endBefore = before.length
  let endAfter = after.length
  while (endBefore > from && endAfter > from && before[endBefore - 1] === after[endAfter - 1]) { endBefore -= 1; endAfter -= 1 }
  area.focus()
  const select = () => area.setSelectionRange(edit.start, edit.end)
  if (before === after) { select(); return }
  area.setSelectionRange(from, endBefore)
  const middle = after.slice(from, endAfter)
  const said = typeof document.execCommand === 'function'
    && (middle ? document.execCommand('insertText', false, middle) : document.execCommand('delete'))
  if (said && area.value === after) { select(); return }
  onChange(after)
  requestAnimationFrame(select)
}

/** Whether the window and the pane have the room for the text and its preview side by side. */
function useRoom(variant: 'pane' | 'field'): { sideBySide: boolean; wordsOnBar: boolean; setRoot: (root: HTMLElement | null) => void } {
  const narrowWindow = useMediaQuery('(max-width: 1100px)')
  const [root, setRoot] = useState<HTMLElement | null>(null)
  const [width, setWidth] = useState<number | undefined>(undefined)
  useEffect(() => {
    if (!root || typeof ResizeObserver === 'undefined') return undefined
    const measure = () => setWidth(root.getBoundingClientRect().width)
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(root)
    return () => watch.disconnect()
  }, [root])
  const roomy = (need: number) => variant === 'pane' && !narrowWindow && (width === undefined || width === 0 || width >= need)
  return { sideBySide: roomy(760), wordsOnBar: roomy(820), setRoot }
}

/** A field as tall as its text, between its rows. */
function useGrowing(area: RefObject<HTMLTextAreaElement | null>, value: string, on: boolean, minRows: number, maxRows: number) {
  useLayoutEffect(() => {
    const element = area.current
    if (!on || !element) return
    const edges = element.offsetHeight - element.clientHeight
    element.style.height = 'auto'
    const wanted = element.scrollHeight + edges
    element.style.height = `${Math.min(Math.max(wanted, minRows * LINE + 18), maxRows * LINE + 18)}px`
  }, [area, value, on, minRows, maxRows])
}

/** Pictures and files coming in: pasted, dropped or picked. One at a time, so they land in the order they came. */
function useFilesComing({ apply, areaRef, onAddImage, attachable }: {
  apply: (edit: Edit) => void
  areaRef: RefObject<HTMLTextAreaElement | null>
  onAddImage?: (file: File) => Promise<string | undefined>
  attachable: boolean
}) {
  const { t } = useStrings()
  const scope = usePictureScope()
  const source = useAttachments()
  const attachments = attachable ? source : undefined
  const [said, setSaid] = useState<{ words: string; refused: boolean } | undefined>(undefined)
  const put = useCallback((markdown: string) => {
    const area = areaRef.current
    if (!area) return
    apply(insertBlock({ text: area.value, start: area.selectionStart, end: area.selectionEnd }, markdown))
  }, [apply, areaRef])

  const attach = useCallback(async (file: File) => {
    if (!attachments) return
    if (attachments.maxBytes !== undefined && file.size > attachments.maxBytes) {
      setSaid({ words: t('md.attachmentTooLarge', { file: file.name, size: Math.round(attachments.maxBytes / (1024 * 1024)) }), refused: true })
      return
    }
    setSaid({ words: t('md.attaching', { file: file.name }), refused: false })
    try {
      const id = await attachments.add(file, scope)
      setSaid(undefined)
      if (id) put(attachmentMarkdown(id, file.name))
    } catch {
      setSaid({ words: t('md.attachmentFailed', { file: file.name }), refused: true })
    }
  }, [attachments, scope, t, put])

  const taken = useCallback((file: File) => (file.type.startsWith('image/') && onAddImage) || attachments, [onAddImage, attachments])

  const take = useCallback((files: readonly File[]) => {
    void files.reduce<Promise<void>>((queue, file) => queue.then(async () => {
      if (file.type.startsWith('image/') && onAddImage) {
        const name = await onAddImage(file)
        if (name) put(pictureMarkdown(name, file.name.replace(/\.[^.]+$/, '')))
      } else await attach(file)
    }), Promise.resolve())
  }, [onAddImage, attach, put])

  return { attachments, said, taken, take }
}

/** What the keys do in the text: the completion first, then the writer's own, and everything else is typing. */
function useKeys({ completion, selection, apply, onSubmit, toolbarRef }: {
  completion: Completion
  selection: () => Selected | undefined
  apply: (edit: Edit) => void
  onSubmit: (() => void) | undefined
  toolbarRef: RefObject<HTMLDivElement | null>
}) {
  const { t } = useStrings()
  return (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (completion.onKeyDown(event)) return
    const state = selection()
    if (!state) return
    const mod = event.metaKey || event.ctrlKey
    const handled = (edit: Edit | undefined) => {
      if (!edit) return
      event.preventDefault()
      // ⌘K is a link here, not the search the window listens for.
      event.stopPropagation()
      apply(edit)
    }
    if (mod && event.key === 'Enter' && onSubmit) { event.preventDefault(); onSubmit(); return }
    if (event.altKey && event.key === 'F10') {
      event.preventDefault()
      toolbarRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
      return
    }
    if (mod && !event.altKey) {
      const tool = toolOfKey(event.key, event.code, event.shiftKey)
      if (tool) handled(tool.edit(state, t('md.linkWords')))
      return
    }
    if (event.altKey || event.nativeEvent.isComposing) return
    if (event.key === 'Tab') handled(tabIn(state, event.shiftKey))
    else if (event.key === 'Enter' && !event.shiftKey) handled(continueOnEnter(state))
  }
}

/** Paste and drop: an address over words, a file, or an ordinary paste. */
function useTaking({ files, selection, apply, canTake }: {
  files: ReturnType<typeof useFilesComing>
  selection: () => Selected | undefined
  apply: (edit: Edit) => void
  canTake: boolean
}) {
  const [dropping, setDropping] = useState(false)
  return {
    dropping,
    onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
      const pasted = event.clipboardData?.getData('text/plain') ?? ''
      // Only when it IS a file: a copied screenshot carries no text, but text
      // copied from a rich document can carry an image alongside it, and the
      // words are what the person meant.
      if (pasted) {
        const state = selection()
        const link = state && linkOnPaste(state, pasted)
        if (link) { event.preventDefault(); apply(link) }
        return
      }
      const list = Array.from(event.clipboardData?.files ?? []).filter(files.taken)
      if (list.length) { event.preventDefault(); files.take(list) }
    },
    onDrop(event: DragEvent<HTMLElement>) {
      setDropping(false)
      const list = Array.from(event.dataTransfer?.files ?? []).filter(files.taken)
      if (!list.length) return
      event.preventDefault()
      files.take(list)
    },
    onDragOver(event: DragEvent<HTMLElement>) {
      if (!canTake || !Array.from(event.dataTransfer?.items ?? []).some((item) => item.kind === 'file')) return
      event.preventDefault()
      setDropping(true)
    },
    onDragLeave() { setDropping(false) },
  }
}

/** A pane's bar: the marks, what can be put in, and how the text is shown. */
function PaneBar({ tools, switcher, canWrite, editor, images, showPictures, onPictures, pickFile, insert, put, headings, caret, moveTo }: {
  tools: ReactNode
  switcher: ReactNode
  canWrite: boolean
  editor: MarkdownEditorProps
  images: DocumentImages | undefined
  showPictures: boolean
  onPictures(open: boolean): void
  pickFile: (() => void) | undefined
  insert(referable: Referable): void
  put(snippet: string): void
  headings: readonly HeadingAt[]
  caret: number
  moveTo(heading: HeadingAt): void
}) {
  const { t } = useStrings()
  const { template, value } = editor
  const blank = !value.trim()
  const sections = useMemo(() => (template && !blank ? missingSections(template.text, value) : []), [template, blank, value])
  const more = [
    ...(template && !blank ? [{ key: 'template', label: template.label, onPick: () => put(template.text.trimEnd()) }] : []),
    ...sections.map((section) => ({ key: `section-${section.title}`, label: t('md.section', { name: section.title }), onPick: () => put(section.body) })),
  ]
  const count = `${t('doc.pictures')} (${images?.library.length ?? 0})`
  return (
    <div className="md-editor__bar">
      {tools}
      {canWrite && (
        <InsertMenu
          onBusinessCase={() => put(businessCaseTemplate())}
          {...(images ? { onPicture: () => onPictures(true) } : {})}
          {...(pickFile ? { onAttach: pickFile } : {})}
          onInsert={insert}
          more={more}
        />
      )}
      {canWrite && template && blank && (
        <Button size="small" variant="outlined" onClick={() => editor.onChange(template.text)}>{template.label}</Button>
      )}
      <span className="md-editor__end">
        {images && canWrite && (
          <button type="button" className="md-editor__tool" aria-expanded={showPictures} title={count} aria-label={count} onClick={() => onPictures(!showPictures)}>
            <PictureIcon />
          </button>
        )}
        {headings.length >= OUTLINE_FROM && <OutlineMenu headings={headings} current={headingOfCaret(headings, caret)} onPick={moveTo} />}
        {editor.extra}
        {switcher}
      </span>
    </div>
  )
}

/** A field's row: the label, with the tools in its place while the field is in use. */
function FieldBar({ fieldId, label, required, note, tools, switcher }: {
  fieldId: string
  label: string
  required: boolean | undefined
  note: string | undefined
  tools: ReactNode
  switcher: ReactNode
}) {
  return (
    <div className="md-editor__bar">
      <div className="md-editor__heading">
        <label className="md-editor__label" htmlFor={fieldId}>
          {label}{required && ' *'}{note && <small>{note}</small>}
        </label>
        {tools}
      </div>
      {switcher}
    </div>
  )
}

/** The preview, in a field with something to say where nothing is written yet. */
function PreviewColumn({ boxRef, editor, pane, minRows }: { boxRef: RefObject<HTMLDivElement | null>; editor: MarkdownEditorProps; pane: boolean; minRows: number }) {
  const { t } = useStrings()
  return (
    <div ref={boxRef} className="md-editor__preview" data-testid={editor.previewTestId} style={pane ? undefined : { minHeight: minRows * LINE + 18 }}>
      {pane || editor.value.trim() ? editor.renderPreview?.(editor.value) : <span className="md-editor__nothing">{t('md.nothing')}</span>}
    </div>
  )
}

/** Move the caret to a heading and bring it into sight, in the text and in the preview. */
function goToHeading(area: HTMLTextAreaElement | null, preview: HTMLElement | null, heading: HeadingAt) {
  if (area) {
    area.focus()
    area.setSelectionRange(heading.at, heading.at)
    const top = caretRect(area, heading.at).top - area.getBoundingClientRect().top + area.scrollTop
    area.scrollTop = Math.max(0, top - 12)
  }
  const shown = preview?.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')
  const target = Array.from(shown ?? []).find((one) => one.textContent?.trim() === heading.text)
  target?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
}

/** Which of the three ways the text is shown just now, and the choice a person made. */
function useView({ pane, disabled, canPreview, sideBySide }: { pane: boolean; disabled: boolean; canPreview: boolean; sideBySide: boolean }) {
  const [wanted, setWanted] = useState<MarkdownViewMode>(pane && canPreview ? 'split' : 'write')
  let view = wanted
  // Nothing to write with, then there is only reading, where there is a way to read.
  if (disabled && canPreview) view = 'preview'
  else if (!canPreview || (wanted === 'split' && !sideBySide)) view = 'write'
  return { view, setWanted }
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  const { value, onChange, onAddImage, images, variant = 'field', disabled = false, renderPreview, template, attachable = true, minRows = 3, maxRows = 14 } = props
  const { t } = useStrings()
  const ownRef = useRef<HTMLTextAreaElement>(null)
  const areaRef = props.textareaRef ?? ownRef
  const pickerRef = useRef<HTMLInputElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const fieldId = useId()
  const pane = variant === 'pane'
  const { sideBySide, wordsOnBar, setRoot } = useRoom(variant)
  const { view, setWanted } = useView({ pane, disabled, canPreview: Boolean(renderPreview), sideBySide })
  const [active, setActive] = useState(false)
  const [showPictures, setShowPictures] = useState(false)
  const [caret, setCaret] = useState(0)

  const apply = useCallback((edit: Edit) => {
    const area = areaRef.current
    if (area) applyEdit(area, edit, onChange)
  }, [areaRef, onChange])
  const selection = useCallback((): Selected | undefined => {
    const area = areaRef.current
    return area ? { text: area.value, start: area.selectionStart, end: area.selectionEnd } : undefined
  }, [areaRef])
  const put = (snippet: string) => { const state = selection(); if (state) apply(insertBlock(state, snippet)) }

  const files = useFilesComing({ apply, areaRef, onAddImage, attachable })
  const canAttach = Boolean(files.attachments)
  const pickFile = useMemo(() => (canAttach ? () => pickerRef.current?.click() : undefined), [canAttach])
  const onPictures = useCallback(() => setShowPictures(true), [])
  const blocks = useSlashBlocks({ apply, template, value, hasPictures: Boolean(images), onPictures, pickFile })
  const completion = useReferenceCompletion(areaRef, apply, disabled ? NO_BLOCKS : blocks)
  useGrowing(areaRef, value, !pane && view !== 'preview', minRows, maxRows)
  const onKeyDown = useKeys({ completion, selection, apply, onSubmit: props.onSubmit, toolbarRef })
  const taking = useTaking({ files, selection, apply, canTake: Boolean(onAddImage) || canAttach })

  const headings = useMemo(() => (pane ? headingsAt(value) : []), [pane, value])
  const words = useMemo(() => wordCount(value), [value])
  const moveTo = (heading: HeadingAt) => {
    goToHeading(view === 'preview' ? null : areaRef.current, previewRef.current, heading)
    setCaret(heading.at)
  }
  const leaving = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setActive(false)
  }

  const canWrite = !disabled && view !== 'preview'
  const switcher = renderPreview && !disabled && <ViewSwitch view={view} onView={setWanted} sideBySide={sideBySide} words={wordsOnBar} single={!pane} />
  const tools = canWrite && (
    <MarkdownToolbar
      toolbarRef={toolbarRef}
      onTool={(tool) => { const state = selection(); if (state) apply(tool.edit(state, t('md.linkWords'))) }}
      onAttach={pickFile}
    />
  )

  return (
    <div
      ref={setRoot} className="md-editor" data-variant={variant} data-active={pane || active} data-error={props.error === true}
      data-dropping={taking.dropping} data-testid={pane ? 'document-source' : 'markdown-field'}
      onFocus={() => setActive(true)} onBlur={leaving}
    >
      {pane ? (
        <PaneBar
          tools={tools} switcher={switcher} canWrite={canWrite} editor={props} images={images}
          showPictures={showPictures} onPictures={setShowPictures} pickFile={pickFile} insert={completion.insert} put={put}
          headings={headings} caret={caret} moveTo={moveTo}
        />
      ) : (
        <FieldBar fieldId={fieldId} label={props.label} required={props.required} note={props.note} tools={tools} switcher={switcher} />
      )}

      {images && showPictures && canWrite && (
        <PictureList images={images} value={value} onInsert={(image) => put(pictureMarkdown(image.name, image.name.replace(/\.[^.]+$/, '')))} />
      )}

      <div className="md-editor__body" data-view={view}>
        {view !== 'preview' && (
          <SourceColumn
            editor={props} fieldId={fieldId} areaRef={areaRef} pane={pane} minRows={minRows} completion={completion}
            onCaret={setCaret} onKeyDown={onKeyDown} taking={taking} words={words} files={files}
          />
        )}
        {view !== 'write' && renderPreview && <PreviewColumn boxRef={previewRef} editor={props} pane={pane} minRows={minRows} />}
      </div>
      {props.helper && <div className="md-editor__helper">{props.helper}</div>}
      {canAttach && (
        <input
          ref={pickerRef} type="file" multiple hidden aria-hidden tabIndex={-1} data-testid="md-attach-input"
          onChange={(event) => { files.take(Array.from(event.target.files ?? [])); event.target.value = '' }}
        />
      )}
      {completion.popper}
    </div>
  )
}

const NO_BLOCKS: readonly SlashBlock[] = []

/** The text, and what is said under it. */
function SourceColumn({ editor, fieldId, areaRef, pane, minRows, completion, onCaret, onKeyDown, taking, words, files }: {
  editor: MarkdownEditorProps
  fieldId: string
  areaRef: RefObject<HTMLTextAreaElement | null>
  pane: boolean
  minRows: number
  completion: Completion
  onCaret(at: number): void
  onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void
  taking: ReturnType<typeof useTaking>
  words: number
  files: ReturnType<typeof useFilesComing>
}) {
  const [helpOpen, setHelpOpen] = useState(false)
  const canAttach = Boolean(files.attachments)
  const canPicture = Boolean(editor.onAddImage)
  return (
    <div className="md-editor__source">
      {pane && editor.above}
      <textarea
        id={fieldId}
        ref={areaRef}
        className="md-editor__text"
        aria-label={editor.label}
        aria-required={editor.required}
        aria-invalid={editor.error}
        value={editor.value}
        placeholder={editor.placeholder}
        disabled={editor.disabled}
        autoFocus={editor.autoFocus}
        rows={pane ? undefined : minRows}
        spellCheck
        data-testid={editor.testId}
        onChange={(event) => { editor.onChange(event.target.value); completion.onInput() }}
        onSelect={(event) => { onCaret(event.currentTarget.selectionStart); completion.onInput() }}
        onBlur={editor.onBlur}
        onKeyDown={onKeyDown}
        onPaste={taking.onPaste}
        onDrop={taking.onDrop}
        onDragOver={taking.onDragOver}
        onDragLeave={taking.onDragLeave}
      />
      {!editor.disabled && (
        <EditorFoot
          words={words} helpOpen={helpOpen} onHelp={() => setHelpOpen((open) => !open)}
          said={files.said} canAttach={canAttach} canPicture={canPicture}
        />
      )}
      {helpOpen && !editor.disabled && <MarkdownGuide images={canPicture} attachments={canAttach} />}
    </div>
  )
}

function EditorFoot({ words, helpOpen, onHelp, said, canAttach, canPicture }: {
  words: number
  helpOpen: boolean
  onHelp(): void
  said: { words: string; refused: boolean } | undefined
  canAttach: boolean
  canPicture: boolean
}) {
  const { t } = useStrings()
  const hint = canAttach ? t('md.hintFiles') : canPicture ? t('md.hintPictures') : t('md.hint')
  return (
    <>
      <div className="md-editor__said" role={said?.refused ? 'alert' : 'status'} data-refused={said?.refused === true} hidden={!said}>{said?.words}</div>
      <div className="md-editor__foot">
        <span className="md-editor__hint" title={hint}>{hint}</span>
        <button type="button" className="md-editor__more" aria-expanded={helpOpen} onMouseDown={(event) => event.preventDefault()} onClick={onHelp}>
          {t('docHelp.markdown')}
        </button>
        <span className="md-editor__count" data-testid="md-word-count">
          {words === 1 ? t('md.oneWord') : t('md.words', { count: words })}
        </span>
      </div>
    </>
  )
}

/** The blocks `/` offers, in the writer's language, with what this record and this source add to them. */
function useSlashBlocks({ apply, template, value, hasPictures, onPictures, pickFile }: {
  apply: (edit: Edit) => void
  template: MarkdownTemplate | undefined
  value: string
  hasPictures: boolean
  onPictures: () => void
  pickFile: (() => void) | undefined
}): readonly SlashBlock[] {
  const { t } = useStrings()
  return useMemo(() => {
    const rid = (typed: Selected): Selected => ({ text: typed.text.slice(0, typed.start) + typed.text.slice(typed.end), start: typed.start, end: typed.start })
    // What this record has of its own comes first: it is what somebody writing this record came for.
    const made: SlashBlock[] = []
    if (template) {
      if (!value.replace(/^\s*\/\S*\s*$/, '').trim()) made.push({ key: 'template', label: template.label, run: (typed) => apply(insertBlock(typed, template.text.trimEnd())) })
      for (const section of missingSections(template.text, value)) {
        made.push({ key: `section ${section.title}`, label: t('md.section', { name: section.title }), run: (typed) => apply(insertBlock(typed, section.body)) })
      }
    }
    for (const one of BLOCK_SNIPPETS) {
      made.push({
        key: one.key,
        label: t(`md.block.${one.key}` as Parameters<typeof t>[0]),
        run: (typed) => apply(one.block ? insertBlock(typed, one.snippet) : insertInline(typed, one.snippet)),
      })
    }
    made.push({ key: 'business-case', label: t('doc.insertBusinessCase'), run: (typed) => apply(insertBlock(typed, businessCaseTemplate())) })
    if (hasPictures) made.push({ key: 'picture', label: t('doc.insertPictureMenu'), run: (typed) => { apply(rid(typed)); onPictures() } })
    if (pickFile) made.push({ key: 'attachment', label: t('md.attachMenu'), run: (typed) => { apply(rid(typed)); pickFile() } })
    return made
  }, [t, apply, template, value, hasPictures, onPictures, pickFile])
}

/** The scope's pictures, beside the text: one can be put in again or taken out. Deleting is the one thing ⌘Z cannot take back, so it asks. */
function PictureList({ images, value, onInsert }: { images: DocumentImages; value: string; onInsert(image: ImageEntry): void }) {
  const { t } = useStrings()
  const [deleting, setDeleting] = useState<string | undefined>(undefined)
  const usedHere = useMemo(() => new Set(imagesUsedIn(value)), [value])
  const usedBy = deleting ? images.usedBy(deleting) : []
  return (
    <div className="md-editor__pictures" data-testid="doc-pictures">
      {images.library.length === 0 && <span className="md-editor__nothing">{t('doc.picturesNone')}</span>}
      {images.library.map((image) => (
        <div className="md-editor__picture" key={image.name}>
          <PictureThumbnail entry={image} />
          <div className="md-editor__picture-name">
            <span>{image.name}</span>
            {usedHere.has(image.name) && <small>{t('doc.pictureUsedHere')}</small>}
          </div>
          <Button size="small" onClick={() => onInsert(image)}>{t('doc.insertPicture')}</Button>
          <button type="button" className="md-editor__tool" title={t('doc.deletePicture')} aria-label={`${t('doc.deletePicture')} ${image.name}`} onClick={() => setDeleting(image.name)}>
            <TrashIcon size={16} />
          </button>
        </div>
      ))}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('doc.deletePictureTitle', { file: deleting ?? '' })}
        body={usedBy.length ? t('doc.deletePictureUsedBy', { labels: usedBy.join(', ') }) : t('doc.deletePictureUnused')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) images.onRemove(deleting)
          setDeleting(undefined)
        }}
      />
    </div>
  )
}


/**
 * A page's document, or the source beside it while it is being written. The
 * page says what its document looks like once, as the children, and the same
 * element is the preview: what is drawn beside the text is what will be read.
 */
export function WritingPane({ writing, children, ...editor }: Omit<MarkdownEditorProps, 'variant' | 'renderPreview'> & {
  writing: boolean
  children: ReactNode
}) {
  if (!writing) return <>{children}</>
  return <MarkdownEditor {...editor} variant="pane" renderPreview={() => children} />
}
