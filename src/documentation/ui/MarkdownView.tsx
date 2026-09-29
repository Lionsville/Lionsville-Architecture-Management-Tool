// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Markdown, rendered the way the rest of the shell looks.
 *
 * The editor package deliberately carries no markdown dependency: it takes a
 * renderer as a prop and falls back to a `<pre>` without one. This is that
 * renderer. It renders to React elements rather than to an HTML string, which
 * is what makes it safe by construction: HTML written into a description comes
 * out as text, so nothing needs sanitising and the desktop's Content Security
 * Policy has nothing to object to.
 *
 * Two kinds of link leave here. An `element:` href is one the package wrote,
 * pointing at another element of the model; the id is handed back through
 * `onElementLink` and the page decides what that means. Every other link opens
 * outside the app: a new tab in a browser, and on the desktop the main process
 * already routes a window-open request to the system browser.
 *
 * Sizes are in `em`, on purpose. The same component sits in a 13px inspector
 * preview and on a full page at reading size, and it should scale with the
 * container rather than fight it.
 */
import { isValidElement, memo, useMemo, useState } from 'react'
import type { ComponentProps, MouseEvent, ReactNode } from 'react'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import Link from '@mui/material/Link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import Markdown, { defaultUrlTransform } from 'react-markdown'
import type { Components, ExtraProps } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useStrings } from '../../i18n/LanguageContext'
import { imageNameOfSource } from '../images'
import { IMAGE_REFERENCE } from '../../model/imageName'
import { blockFor } from './blocks'
import type { BlockContext } from './blocks'
import type { MermaidRenderer } from './MermaidBlock'
import { LibraryPicture, usePictureEntry } from './Pictures'

export const ELEMENT_LINK_SCHEME = 'element:'

export type MarkdownViewProps = {
  markdown: string
  /** A link to another element was followed; the argument is its id. */
  onElementLink?: (elementId: string) => void
  /** How a ```mermaid fence is drawn. The default loads mermaid on first use; a test hands in a fake. */
  renderMermaid?: MermaidRenderer
}

/**
 * Whether a `pre` holds nothing but a fence that draws itself, in which case
 * the `pre` gets out of the way — a drawn block brings its own frame, and a
 * code block's grey box around a diagram is not what anybody meant.
 */
function isDrawnFence(children: ReactNode): boolean {
  return isValidElement<{ className?: unknown }>(children)
    && typeof children.props.className === 'string'
    && blockFor(children.props.className) !== undefined
}

/**
 * The default transform drops every scheme it does not know, which is the
 * right instinct — a `javascript:` href must never survive — but it would also
 * drop the two schemes the model writes: a link to an element, and a picture
 * by its name in the library. Let those through untouched and leave
 * everything else to the default. A picture's name passes as a picture's
 * source and nowhere else: a link to `image:…` is nothing this app opens.
 */
function urlTransform(url: string, key: string): string {
  if (url.startsWith(ELEMENT_LINK_SCHEME)) return url
  if (key === 'src' && url.startsWith(IMAGE_REFERENCE)) return url
  return defaultUrlTransform(url)
}

/**
 * A page sets `--doc-measure` — the width a line of prose is comfortable at —
 * and this view keeps every top-level block to it, centred, except the ones
 * marked wide: a table, a business case, a code block, a diagram, a picture on
 * a line of its own. Those take the room the page has. A wide block never
 * starts narrower than the measure, so a small table still lines up with the
 * paragraph above it rather than floating in the middle of a wide sheet.
 * Without the variable — the inspector's preview — nothing is capped and
 * nothing is wide, which is what a 300px column wants.
 */
const MEASURE = 'var(--doc-measure, none)'
const WIDE = { 'data-wide': '' } as const

type HastNode = { type: string; tagName?: string; value?: string }

/** A paragraph that is nothing but pictures: markdown wraps a lone image in one. */
function isPictureParagraph(node: ExtraProps['node']): boolean {
  const children = (node?.children ?? []) as HastNode[]
  return children.some((child) => child.type === 'element' && child.tagName === 'img')
    && children.every((child) =>
      (child.type === 'element' && child.tagName === 'img')
      || (child.type === 'text' && !(child.value ?? '').trim()))
}

/** A head row tinted with the accent rather than the hover grey, in both modes. */
const HEAD_TINT = (theme: Theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.14 : 0.07)

/** What a document draws where a picture it names is not one it can show: its alt text. */
function MissingPicture({ src, alt }: { src: string | undefined; alt: string }) {
  return (
    <Box component="span" data-testid="image-missing" data-src={src} sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
      {alt}
    </Box>
  )
}

/**
 * A picture named by its name in the library (ADR-0031 §3): laid out from its
 * entry at once, its bytes asked for when it comes into view (`Pictures.tsx`).
 * Keyed by the name, so a document that names another picture in the same
 * place — switching from one document to the next — gets a new `img`, never
 * the last one's with its source still on it.
 */
function NamedPicture({ name, src, alt }: { name: string; src: string; alt: string }) {
  const entry = usePictureEntry(name)
  if (entry) return <LibraryPicture key={`${entry.name}\u0000${entry.contentAddress}`} entry={entry} alt={alt} />
  return <MissingPicture src={src} alt={alt} />
}

type HeadingProps = ComponentProps<'h1'>

function heading(level: number, size: string, weight = 600) {
  return function Heading({ children }: HeadingProps) {
    return (
      <Typography
        component="div"
        role="heading"
        aria-level={level}
        // Room above only after a sibling, which is "not the first child"
        // without `:first-child` (Emotion warns about it, for server
        // rendering). Not `first-of-type` either: headings are divs and
        // paragraphs are not, so the first heading after a paragraph is still
        // the first div, and would lose the room it needs above it.
        sx={{ fontSize: size, fontWeight: weight, lineHeight: 1.3, mt: 0, mb: '0.5em', '* + &': { mt: '1.8em' } }}
      >
        {children}
      </Typography>
    )
  }
}

/**
 * A GFM task item's box. Named, because a checkbox with no name is announced
 * as nothing but its state; the item's own text follows it in the list.
 */
function TaskBox({ checked }: { checked: boolean }) {
  const { t } = useStrings()
  return (
    <Checkbox
      checked={checked}
      disabled
      size="small"
      slotProps={{ input: { 'aria-label': t('doc.task') } }}
      sx={{ p: 0, mr: 0.75, verticalAlign: 'text-bottom' }}
    />
  )
}

const CODE_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

function components(
  onElementLink: ((elementId: string) => void) | undefined,
  context: BlockContext,
): Components {
  return {
    h1: heading(1, '1.6em'),
    h2: heading(2, '1.35em'),
    h3: heading(3, '1.15em'),
    h4: heading(4, '1em'),
    h5: heading(5, '0.95em'),
    h6: heading(6, '0.9em', 500),
    p: ({ children, node }) => (
      <Typography
        component="p"
        {...(isPictureParagraph(node) ? WIDE : {})}
        // As a heading's: room above only after a sibling.
        sx={{ fontSize: 'inherit', lineHeight: 1.6, mt: 0, mb: '0.7em', '* + &': { mt: '0.7em' }, '&:last-child': { mb: 0 } }}
      >
        {children}
      </Typography>
    ),
    a: ({ href, children }) => {
      if (href?.startsWith(ELEMENT_LINK_SCHEME)) {
        const id = decodeURIComponent(href.slice(ELEMENT_LINK_SCHEME.length))
        const follow = (event: MouseEvent) => {
          event.preventDefault()
          onElementLink?.(id)
        }
        return (
          <Link href={href} onClick={follow} data-element-link={id} sx={{ fontWeight: 500 }}>
            {children}
          </Link>
        )
      }
      return (
        <Link href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </Link>
      )
    },
    ul: ({ children, className }) => (
      <Box
        component="ul"
        className={className}
        sx={{
          my: '0.5em',
          pl: className === 'contains-task-list' ? 0.5 : '1.5em',
          listStyle: className === 'contains-task-list' ? 'none' : undefined,
        }}
      >
        {children}
      </Box>
    ),
    ol: ({ children }) => <Box component="ol" sx={{ my: '0.5em', pl: '1.5em' }}>{children}</Box>,
    li: ({ children }) => <Box component="li" sx={{ my: '0.15em' }}>{children}</Box>,
    // GFM task items arrive as disabled checkboxes; the document is not a form.
    input: ({ checked }) => <TaskBox checked={Boolean(checked)} />,
    blockquote: ({ children }) => (
      <Box component="blockquote" sx={{ my: '0.7em', mx: 0, pl: '1em', borderLeft: 3, borderColor: 'divider', color: 'text.secondary' }}>
        {children}
      </Box>
    ),
    hr: () => <Box component="hr" sx={{ border: 0, borderTop: 1, borderColor: 'divider', my: '1em' }} />,
    code: ({ children, className }) => {
      const Block = blockFor(className)
      // The parser leaves the fence's closing newline on the text; every block
      // is handed the source as it was written, without it.
      if (Block) return <Block code={String(children).replace(/\n$/, '')} context={context} />
      return (
        <Box
          component="code"
          className={className}
          sx={{ fontFamily: CODE_FONT, fontSize: '0.9em', bgcolor: 'action.hover', px: '0.35em', py: '0.1em', borderRadius: 1 }}
        >
          {children}
        </Box>
      )
    },
    pre: ({ children }) => isDrawnFence(children) ? <>{children}</> : (
      <Box
        component="pre"
        {...WIDE}
        sx={{
          my: '0.7em', p: '0.8em', overflowX: 'auto', borderRadius: 1, bgcolor: 'action.hover',
          fontFamily: CODE_FONT, fontSize: '0.9em', lineHeight: 1.5,
          '& code': { bgcolor: 'transparent', p: 0, fontSize: 'inherit' },
        }}
      >
        {children}
      </Box>
    ),
    /**
     * A picture, and only ever one this scope holds (ADR-0009, ADR-0031 §3).
     *
     * An `image:` name is looked up in the library the page was handed, and
     * any other source goes to the host's resolver. Both are the allowlist:
     * an `http(s)` source in a description — a tracking pixel, or a picture
     * that stops existing — is never fetched by a tool that promises no
     * network. What is left is the alt text, which is what a reader of the
     * markdown would have seen anyway.
     */
    img: ({ src, alt }) => {
      const name = imageNameOfSource(src)
      if (name !== undefined && src) {
        return <NamedPicture key={name} name={name} src={src} alt={alt ?? ''} />
      }
      return <MissingPicture src={src} alt={alt ?? ''} />
    },
    table: ({ children }) => (
      <TableContainer {...WIDE} sx={{ my: '0.7em', overflowX: 'auto', borderRadius: 1, border: 1, borderColor: 'divider' }}>
        <Table size="small" sx={{ width: '100%', '& td, & th': { fontSize: 'inherit', borderBottom: 1, borderColor: 'divider' }, '& tr:last-child td': { borderBottom: 0 } }}>
          {children}
        </Table>
      </TableContainer>
    ),
    thead: ({ children }) => <TableHead sx={{ '& th': { fontWeight: 600, bgcolor: HEAD_TINT } }}>{children}</TableHead>,
    tbody: ({ children }) => <TableBody>{children}</TableBody>,
    tr: ({ children }) => <TableRow>{children}</TableRow>,
    th: ({ children, style }) => <TableCell component="th" align={alignOf(style)}>{children}</TableCell>,
    td: ({ children, style }) => <TableCell align={alignOf(style)}>{children}</TableCell>,
  }
}

function alignOf(style: { textAlign?: string | number } | undefined): 'left' | 'center' | 'right' {
  const align = style?.textAlign
  return align === 'center' || align === 'right' ? align : 'left'
}

/**
 * Memoised on the text and the two callbacks, because parsing is the expensive
 * part and it is redone from scratch on every render: a page whose parent
 * re-renders for an unrelated reason — a keystroke elsewhere, a selection, a
 * theme change — re-parses every character of the document to arrive at the
 * same tree. The parsed tree is not something `react-markdown` hands back to be
 * kept, so what is kept is the element it renders to, which comes to the same
 * thing: React sees the identical element and leaves the subtree alone.
 */
export const MarkdownView = memo(function MarkdownView(
  { markdown, onElementLink, renderMermaid }: MarkdownViewProps,
) {
  // Memoised, because these are component TYPES: a fresh set on every render
  // would remount every block, and a mermaid block that remounts draws again.
  const context = useMemo<BlockContext>(() => ({ renderMermaid }), [renderMermaid])
  const comps = useMemo(
    () => components(onElementLink, context),
    [onElementLink, context],
  )
  const document = useMemo(() => (
    <Markdown remarkPlugins={[remarkGfm]} urlTransform={urlTransform} components={comps}>
      {markdown}
    </Markdown>
  ), [markdown, comps])
  return (
    <Box
      sx={{
        fontSize: 'inherit',
        wordBreak: 'break-word',
        // `:not(…)` rather than `*`: it carries the attribute's specificity,
        // which is what beats Typography's own `margin: 0` on a paragraph.
        '& > :not([data-wide])': { maxWidth: MEASURE, mx: 'auto' },
        '& > [data-wide]': { maxWidth: '100%', width: 'fit-content', minWidth: 'min(var(--doc-measure, 100%), 100%)', mx: 'auto' },
      }}
    >
      {document}
    </Box>
  )
})
