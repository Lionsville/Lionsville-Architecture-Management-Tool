// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A building block's *About* (ADR-0043 §8): its document — the element's
 * description, a chapter per usage context — read or written, opened on a
 * context's chapter where one was asked for; and the principles it cites,
 * read here and cited where the block is open, as any element's are.
 */
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

export function BlockAbout({ row, chapter, onChapterShown }: { row: BlockRow; chapter: string | undefined; onChapterShown: () => void }) {
  const access = useBlocks()
  const { t } = useStrings()
  const { block, scope } = row
  const document = block.description ?? ''
  const [mode, setMode] = useState<'read' | 'edit'>('read')
  const [draft, setDraft] = useState(document)
  useEffect(() => { setDraft(document) }, [document])
  const read = useChapter(chapter, mode === 'read', onChapterShown)
  if (!access) return null
  const may = access.mayWrite(scope)
  const keep = () => { if (draft !== document) access.update(block.id, { description: draft }) }
  const cited = access.citationsOf(block.id)
  return (
    <Box sx={{ maxWidth: 860 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', flex: 1 }}>{t('blocks.documentIntro')}</Typography>
        {may && (
          <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_event, next: 'read' | 'edit' | null) => {
            if (!next) return
            if (next === 'read') keep()
            setMode(next)
          }}>
            <ToggleButton value="read">{t('blocks.read')}</ToggleButton>
            <ToggleButton value="edit" data-testid="block-document-edit">{t('blocks.edit')}</ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>
      {mode === 'edit' ? (
        <Box sx={{ height: 480, display: 'flex', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <DocumentSource value={draft} onChange={setDraft} onBlur={keep} label={t('blocks.document')} />
        </Box>
      ) : (
        <Box ref={read} sx={{ fontSize: 15, '& [data-lit]': { bgcolor: 'action.selected', transition: 'background-color 600ms' } }} data-testid="block-document">
          {document.trim() ? <MarkdownView markdown={document} /> : <Typography color="text.secondary">{t('blocks.documentEmpty')}</Typography>}
        </Box>
      )}
      <Typography component="h2" sx={{ mt: 4, mb: 1, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'text.secondary' }}>
        {t('blocks.principles')}
      </Typography>
      {cited.length === 0
        ? <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t('blocks.citesNone')}</Typography>
        : cited.map((one) => <Typography key={one.label} sx={{ fontSize: 14 }}>{one.label} <Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>· {one.stance}</Box></Typography>)}
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.75 }}>{t('blocks.citeWhereOpen')}</Typography>
    </Box>
  )
}
