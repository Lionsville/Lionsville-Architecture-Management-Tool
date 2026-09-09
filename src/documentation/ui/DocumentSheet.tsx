/**
 * The surface a document is read on: a sheet of paper on the page's ground.
 *
 * Three pages read markdown — an element's, a decision's, a plan's — and
 * each used to centre it in a fixed column on the dialog's own background,
 * so on a wide window a table scrolled inside a strip of grey with a third of
 * the screen empty on either side. The sheet takes the room the page has and
 * says the measure instead: a paragraph is held to `--doc-measure`, and the
 * renderer lets a table, a picture or a business case run wider
 * (`MarkdownView`). Everything a page puts above the document — the title,
 * the front matter, the contents — is held to the same measure, so the sheet
 * reads as one column that the wide things break out of.
 */
import type { ReactNode, Ref } from 'react'
import Box from '@mui/material/Box'

/** How wide a line of prose is comfortable, in px. */
export const DOCUMENT_MEASURE = 860

export type DocumentSheetProps = {
  children: ReactNode
  /** Beside a source pane there is less room; the margins give some of theirs. */
  dense?: boolean
  testId?: string
  ref?: Ref<HTMLDivElement>
}

export function DocumentSheet({ children, dense = false, testId, ref }: DocumentSheetProps) {
  return (
    <Box sx={{ overflow: 'auto', minHeight: 0, minWidth: 0, p: dense ? 1.5 : 3 }}>
      <Box
        ref={ref}
        data-testid={testId}
        sx={{
          '--doc-measure': `${DOCUMENT_MEASURE}px`,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          px: dense ? 3 : 5,
          py: 3.5,
          minHeight: '100%',
          boxSizing: 'border-box',
          // The document box carries no attribute of its own; the renderer
          // inside it decides what is wide. Everything else keeps the measure.
          '& > *:not([data-document])': { maxWidth: 'var(--doc-measure)', mx: 'auto' },
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
