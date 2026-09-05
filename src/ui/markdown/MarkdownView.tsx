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
import type { ComponentProps, MouseEvent } from 'react'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import Link from '@mui/material/Link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import Markdown, { defaultUrlTransform } from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

export const ELEMENT_LINK_SCHEME = 'element:'

export type MarkdownViewProps = {
  markdown: string
  /** A link to another element was followed; the argument is its id. */
  onElementLink?: (elementId: string) => void
}

/**
 * The default transform drops every scheme it does not know, which is the
 * right instinct — a `javascript:` href must never survive — but it would also
 * drop the one scheme the package writes. Let that one through untouched and
 * leave everything else to the default.
 */
function urlTransform(url: string): string {
  return url.startsWith(ELEMENT_LINK_SCHEME) ? url : defaultUrlTransform(url)
}

type HeadingProps = ComponentProps<'h1'>

function heading(size: string, weight = 600) {
  return function Heading({ children }: HeadingProps) {
    return (
      <Typography
        component="div"
        role="heading"
        sx={{ fontSize: size, fontWeight: weight, lineHeight: 1.3, mt: '1.2em', mb: '0.4em', '&:first-of-type': { mt: 0 } }}
      >
        {children}
      </Typography>
    )
  }
}

const CODE_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

function components(onElementLink?: (elementId: string) => void): Components {
  return {
    h1: heading('1.6em'),
    h2: heading('1.35em'),
    h3: heading('1.15em'),
    h4: heading('1em'),
    h5: heading('0.95em'),
    h6: heading('0.9em', 500),
    p: ({ children }) => (
      <Typography component="p" sx={{ fontSize: 'inherit', lineHeight: 1.6, my: 0, '& + &': { mt: '0.7em' } }}>
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
    input: ({ checked }) => (
      <Checkbox checked={Boolean(checked)} disabled size="small" sx={{ p: 0, mr: 0.75, verticalAlign: 'text-bottom' }} />
    ),
    blockquote: ({ children }) => (
      <Box component="blockquote" sx={{ my: '0.7em', mx: 0, pl: '1em', borderLeft: 3, borderColor: 'divider', color: 'text.secondary' }}>
        {children}
      </Box>
    ),
    hr: () => <Box component="hr" sx={{ border: 0, borderTop: 1, borderColor: 'divider', my: '1em' }} />,
    code: ({ children, className }) => (
      <Box
        component="code"
        className={className}
        sx={{ fontFamily: CODE_FONT, fontSize: '0.9em', bgcolor: 'action.hover', px: '0.35em', py: '0.1em', borderRadius: 1 }}
      >
        {children}
      </Box>
    ),
    pre: ({ children }) => (
      <Box
        component="pre"
        sx={{
          my: '0.7em', p: '0.8em', overflowX: 'auto', borderRadius: 1, bgcolor: 'action.hover',
          fontFamily: CODE_FONT, fontSize: '0.9em', lineHeight: 1.5,
          '& code': { bgcolor: 'transparent', p: 0, fontSize: 'inherit' },
        }}
      >
        {children}
      </Box>
    ),
    img: ({ src, alt }) => <Box component="img" src={src} alt={alt ?? ''} sx={{ maxWidth: '100%', borderRadius: 1 }} />,
    table: ({ children }) => (
      <TableContainer sx={{ my: '0.7em', overflowX: 'auto' }}>
        <Table size="small" sx={{ width: 'auto', minWidth: '50%', '& td, & th': { fontSize: 'inherit', border: 1, borderColor: 'divider' } }}>
          {children}
        </Table>
      </TableContainer>
    ),
    thead: ({ children }) => <TableHead sx={{ '& th': { fontWeight: 600, bgcolor: 'action.hover' } }}>{children}</TableHead>,
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

export function MarkdownView({ markdown, onElementLink }: MarkdownViewProps) {
  return (
    <Box sx={{ fontSize: 'inherit', wordBreak: 'break-word' }}>
      <Markdown remarkPlugins={[remarkGfm]} urlTransform={urlTransform} components={components(onElementLink)}>
        {markdown}
      </Markdown>
    </Box>
  )
}
