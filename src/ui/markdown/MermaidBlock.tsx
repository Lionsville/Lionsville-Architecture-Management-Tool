/**
 * A ```mermaid fence, drawn.
 *
 * Mermaid is the one heavy dependency in the shell, and most pages never use
 * it, so it is loaded the first time a diagram is actually on screen rather
 * than with the app. Until it has drawn, and whenever it cannot, the source is
 * shown as an ordinary code block — a diagram that fails to render must never
 * take its text with it.
 *
 * The renderer is a prop with a default, which is what lets a test hand in a
 * fake and check the wiring without a real mermaid in jsdom. The output is
 * mermaid's own SVG, produced under `securityLevel: 'strict'`, which is what
 * makes writing it into the DOM acceptable: mermaid sanitises text and refuses
 * click handlers in that mode, and the page's Content Security Policy already
 * forbids inline script.
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { useStrings } from '@lionsville/solution-design'

export type MermaidTheme = 'default' | 'dark'
export type MermaidRenderer = (code: string, theme: MermaidTheme) => Promise<string>

let sequence = 0

/**
 * What was last drawn for a given source and theme. A block that remounts —
 * the page re-rendered around it — starts from the picture it already had
 * instead of flashing back to its source while mermaid runs again.
 */
const drawn = new Map<string, string>()

export const renderWithMermaid: MermaidRenderer = async (code, theme) => {
  const mermaid = (await import('mermaid')).default
  mermaid.initialize({ startOnLoad: false, theme, securityLevel: 'strict', fontFamily: 'inherit' })
  sequence += 1
  const { svg } = await mermaid.render(`lv-mermaid-${sequence}`, code)
  return svg
}

const CODE_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

export type MermaidBlockProps = {
  code: string
  render?: MermaidRenderer
}

export function MermaidBlock({ code, render = renderWithMermaid }: MermaidBlockProps) {
  const mode = useTheme().palette.mode
  const { t } = useStrings()
  const theme: MermaidTheme = mode === 'dark' ? 'dark' : 'default'
  const cacheKey = `${theme}\n${code}`
  const [result, setResult] = useState<{ svg?: string; error?: string }>(() => ({ svg: drawn.get(cacheKey) }))

  useEffect(() => {
    let live = true
    const known = drawn.get(cacheKey)
    setResult({ svg: known })
    if (known) return
    render(code, theme).then(
      (svg) => {
        drawn.set(cacheKey, svg)
        if (live) setResult({ svg })
      },
      (error: unknown) => { if (live) setResult({ error: error instanceof Error ? error.message : String(error) }) },
    )
    return () => { live = false }
  }, [code, theme, cacheKey, render])

  if (result.svg) {
    return (
      <Box
        data-testid="mermaid-block"
        data-state="drawn"
        sx={{ my: '0.7em', overflowX: 'auto', '& svg': { maxWidth: '100%', height: 'auto' } }}
        dangerouslySetInnerHTML={{ __html: result.svg }}
      />
    )
  }
  return (
    <Box data-testid="mermaid-block" data-state={result.error ? 'failed' : 'pending'} sx={{ my: '0.7em' }}>
      {result.error && (
        <Typography variant="caption" color="error" component="div" sx={{ mb: 0.5 }}>
          {t('adr.mermaidFailed')} {result.error}
        </Typography>
      )}
      <Box
        component="pre"
        sx={{
          m: 0, p: '0.8em', overflowX: 'auto', borderRadius: 1, bgcolor: 'action.hover',
          fontFamily: CODE_FONT, fontSize: '0.9em', lineHeight: 1.5,
        }}
      >
        <code>{code}</code>
      </Box>
    </Box>
  )
}
