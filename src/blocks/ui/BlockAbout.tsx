// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A building block's *About* (ADR-0043 §8), which it opens on, since this is what
 * tells a newcomer what the block is: its document — the element's description, a
 * chapter per usage context, read from the scope that keeps the block, opened on a
 * context's chapter where one was asked for, and written in a focused window — and
 * the principles it cites, read here and cited where its scope is open, one press
 * away.
 */
import { RecordChanges } from '../../comments/ui/RecordChanges'
import { useEffect, useRef, useState } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { MarkdownEditor } from '../../documentation/ui/MarkdownEditor'
import { MarkdownView } from '../../documentation/ui/MarkdownView'
import { FocusedWindow, useWritingView } from '../../widgets/kit/FocusedWindow'
import { PanelSection } from '../../widgets/kit/Panel'
import { useBlocks } from './BlocksContext'
import type { BlockRow } from './BlocksContext'

/** The heading a chapter has, scrolled to and lit for a moment. */
function useChapter(chapter: string | undefined, shown: boolean, onShown: () => void) {
  const read = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!chapter || !shown || !read.current) return
    const heading = [...read.current.querySelectorAll('h1, h2, h3')].find((one) => one.textContent?.trim() === chapter)
    if (heading instanceof HTMLElement) {
      heading.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
      heading.setAttribute('data-lit', '')
      setTimeout(() => heading.removeAttribute('data-lit'), 1400)
    }
    onShown()
  }, [chapter, shown, onShown])
  return read
}

/**
 * The block's document, read from the scope that keeps it — the row is the
 * index's, which carries no description — and read again whenever the tree
 * is, so a step landed is what it says; `undefined` until then.
 */
export function useBlockDocument(block: string): { text: string | undefined; wrote: (text: string) => void } {
  const access = useBlocks()
  const [text, setText] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (!access || !block) return
    let current = true
    // `document` says its own failure and answers `undefined`; it does not reject.
    void access.document(block).then((read) => { if (current) setText(read) })
    return () => { current = false }
  }, [access, block])
  return { text, wrote: setText }
}

export type BlockDocument = ReturnType<typeof useBlockDocument>

export function BlockAbout({ row, chapter, onChapterShown, document, writing }: {
  row: BlockRow; chapter: string | undefined; onChapterShown: () => void
  /** The block's text, read once by the page, which writes it from any tab (`BlockTextWindow`). */
  document: BlockDocument
  /** The text is being written over the page: a chapter waits until it is read again. */
  writing: boolean
}) {
  const access = useBlocks()
  const { t } = useStrings()
  const { block, scope } = row
  const read = useChapter(chapter, !writing && document.text !== undefined, onChapterShown)
  if (!access) return null
  const cited = access.citationsOf(block.id)
  const keeper = access.scopeLabel(scope)
  return (
    <div className="guidance-read">
      <p className="guidance-record__intro">{t('blocks.documentIntro')}</p>
      <div ref={read} className="guidance-record__doc" data-testid="block-document">
        {document.text === undefined ? null
          : document.text.trim() ? <MarkdownView markdown={document.text} /> : <p className="guidance-read__empty">{t('blocks.documentEmpty')}</p>}
      </div>
      <PanelSection title={t('blocks.principles')}>
        {cited.length === 0 && <p className="guidance-read__empty">{t('blocks.citesNone')}</p>}
        {cited.map((one) => (
          <div className="guidance-read__line" key={one.label}>
            <span className="guidance-read__grow">{one.label}</span>
            <span className="guidance-read__quiet">{one.stance}</span>
          </div>
        ))}
        <div className="guidance-record__line">
          <span className="guidance-read__quiet">{t('blocks.citeWhereOpen')}</span>
          <button type="button" className="guidance__link" onClick={() => access.openScope(scope)}>{t('blocks.openIn', { scope: keeper })}</button>
        </div>
      </PanelSection>
      {/* Who added it and who changed it since (ADR-0038, amended §11): a block is an element of the scope that keeps it. */}
      <RecordChanges about={{ kind: 'element', id: block.id }} scope={scope} first="added" />
    </div>
  )
}

/**
 * The block's text written in the full window, over whichever tab the page is on:
 * ✎ Edit, Save and Cancel leave the person on the tab they pressed it from.
 */
export function BlockTextWindow({ row, document, asked, onDone }: { row: BlockRow; document: BlockDocument; asked: boolean; onDone: () => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const { block } = row
  const [draft, setDraft] = useState<string | undefined>(undefined)
  const { view, views } = useWritingView()
  // Not before the document is read: a draft started from nothing would be saved over it.
  useEffect(() => {
    if (asked && document.text !== undefined) setDraft(document.text)
  }, [asked, document.text])
  const close = () => { setDraft(undefined); onDone() }
  const keep = () => {
    if (access && draft !== undefined && draft !== document.text) {
      access.update(block.id, { description: draft })
      // Shown at once: what is kept comes back when the tree is read again.
      document.wrote(draft)
    }
    close()
  }
  return (
    <FocusedWindow
      open={asked && draft !== undefined} title={t('blocks.editingDocument', { name: block.name })} views={views}
      changed={draft !== undefined && draft !== document.text} onSave={keep} onCancel={close}
    >
      <div className="guidance-form__edit">
        <MarkdownEditor variant="pane" autoFocus value={draft ?? ''} onChange={setDraft} label={t('blocks.document')} shownAs={view} renderPreview={(text) => <MarkdownView markdown={text} />} />
      </div>
    </FocusedWindow>
  )
}
