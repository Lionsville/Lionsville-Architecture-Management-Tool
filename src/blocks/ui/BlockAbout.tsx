// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A building block's *About* (ADR-0043 §8): its document — the element's
 * description, a chapter per usage context, read from the scope that keeps
 * the block — read or written, opened on a context's chapter where one was
 * asked for; and the principles it cites, read here and cited where the
 * block is open, as any element's are.
 */
import { RecordChanges } from '../../comments/ui/RecordChanges'
import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n/LanguageContext'
import { DocumentSource } from '../../documentation/ui/DocumentSource'
import { MarkdownView } from '../../documentation/ui/MarkdownView'
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
function useDocument(block: string): { text: string | undefined; wrote: (text: string) => void } {
  const access = useBlocks()
  const [text, setText] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (!access) return
    let current = true
    // `document` says its own failure and answers `undefined`; it does not reject.
    void access.document(block).then((read) => { if (current) setText(read) })
    return () => { current = false }
  }, [access, block])
  return { text, wrote: setText }
}

export function BlockAbout({ row, chapter, onChapterShown }: { row: BlockRow; chapter: string | undefined; onChapterShown: () => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const { block, scope } = row
  const document = useDocument(block.id)
  const [mode, setMode] = useState<'read' | 'edit'>('read')
  const [draft, setDraft] = useState('')
  const read = useChapter(chapter, mode === 'read' && document.text !== undefined, onChapterShown)
  if (!access) return null
  const may = access.mayWrite(scope)
  const keep = () => {
    if (draft === document.text) return
    access.update(block.id, { description: draft })
    // Shown at once, and the blur that comes before the press on *Read* keeps it once.
    document.wrote(draft)
  }
  const cited = access.citationsOf(block.id)
  return (
    <Box sx={{ maxWidth: 860 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', flex: 1 }}>{t('blocks.documentIntro')}</Typography>
        {may && (
          <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_event, next: 'read' | 'edit' | null) => {
            if (!next) return
            if (next === 'read') keep()
            else setDraft(document.text ?? '')
            setMode(next)
          }}>
            <ToggleButton value="read">{t('blocks.read')}</ToggleButton>
            {/* Not before the document is read: a draft started from nothing would be saved over it. */}
            <ToggleButton value="edit" disabled={document.text === undefined} data-testid="block-document-edit">{t('blocks.edit')}</ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>
      {mode === 'edit' ? (
        <Box sx={{ height: 480, display: 'flex', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <DocumentSource value={draft} onChange={setDraft} onBlur={keep} label={t('blocks.document')} />
        </Box>
      ) : (
        <Box ref={read} sx={{ fontSize: 15, '& [data-lit]': { bgcolor: 'action.selected', transition: 'background-color 600ms' } }} data-testid="block-document">
          {document.text === undefined ? null
            : document.text.trim() ? <MarkdownView markdown={document.text} /> : <Typography color="text.secondary">{t('blocks.documentEmpty')}</Typography>}
        </Box>
      )}
      <Typography component="h2" sx={{ mt: 4, mb: 1, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'text.secondary' }}>
        {t('blocks.principles')}
      </Typography>
      {cited.length === 0
        ? <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('blocks.citesNone')}</Typography>
        : cited.map((one) => <Typography key={one.label} sx={{ fontSize: 14 }}>{one.label} <Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>· {one.stance}</Box></Typography>)}
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.75 }}>{t('blocks.citeWhereOpen')}</Typography>
      {/* Who added it and who changed it since (ADR-0038, amended §11): a block is an element of the scope that keeps it. */}
      <RecordChanges about={{ kind: 'element', id: block.id }} scope={scope} first="added" />
    </Box>
  )
}
