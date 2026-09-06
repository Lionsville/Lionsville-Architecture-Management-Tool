/**
 * What is on screen when a render throws.
 *
 * Without one of these, a throw below `App` unmounts the whole tree: a white
 * page, no message, nothing recorded, and a user whose only report is "it went
 * blank". A boundary turns that into a sentence, a Reload button and the
 * diagnostics trail — and, before it draws any of it, an entry in that trail.
 *
 * **Two of them, at different depths.** One around the app's children, one
 * around the editor. The inner one is why a canvas crash leaves the toolbar
 * standing: the fallback fills the canvas, and Save, Open and the pages beside
 * it still work, so the session can be got out of rather than lost.
 *
 * **In development it also shows the stack.** A boundary is a way of hiding
 * bugs, and that is precisely what it must not do while the bug is being
 * written. `import.meta.env.DEV` decides; the prop exists so a test can pin
 * either half.
 *
 * A class, because `getDerivedStateFromError` and `componentDidCatch` have no
 * hook equivalent — this is the one place React still requires one.
 */
import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import type { Translate } from '@lionsville/solution-design'
import { describeCause, formatDiagnostics } from '../core/diagnostics'
import type { Diagnostic, DiagnosticEntry } from '../core/diagnostics'

/**
 * What this boundary needs of the diagnostics seam: somewhere to report, and
 * the trail to hand over. Narrower than the port, as everything here is.
 */
export type CrashTrail = {
  report(entry: Diagnostic): void
  recent(): DiagnosticEntry[]
}

/** And of the host: start again, and put the trail on the clipboard. */
export type CrashControls = {
  reload(): void
  copyText(text: string): Promise<void>
}

export type ErrorBoundaryProps = {
  children: ReactNode
  /** Where this one sits, for the report: `app`, `editor`. */
  where: string
  diagnostics: CrashTrail
  controls: CrashControls
  s: Translate
  /** Show the stack under the message. Defaults to development builds. */
  showStack?: boolean
}

type CopyState = 'idle' | 'copied' | 'failed'
type ErrorBoundaryState = { error: Error | null; copied: CopyState }

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, copied: 'idle' }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // The component stack is the useful half — it names the component that
    // threw, in our own terms, and carries no model content.
    this.props.diagnostics.report({
      level: 'error',
      where: this.props.where,
      message: `render threw${info.componentStack ? ` in${firstFrame(info.componentStack)}` : ''}`,
      cause: error,
    })
  }

  private copy = (): void => {
    this.props.controls.copyText(formatDiagnostics(this.props.diagnostics.recent())).then(
      () => this.setState({ copied: 'copied' }),
      () => this.setState({ copied: 'failed' }),
    )
  }

  render(): ReactNode {
    const { children, s, showStack = import.meta.env.DEV } = this.props
    const { error, copied } = this.state
    if (!error) return children

    return (
      <Box sx={{
        flex: '1 1 auto', minHeight: 0, overflowY: 'auto',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        p: 4, bgcolor: 'background.default',
      }}>
        <Alert severity="error" sx={{ maxWidth: 720, width: '100%' }} data-testid="crash-fallback">
          <AlertTitle>{s('shell.crashed')}</AlertTitle>
          <Typography sx={{ fontSize: 13 }}>{s('shell.crashedNote')}</Typography>
          <Typography sx={{ fontSize: 12, mt: 1, color: 'text.secondary' }}>
            {describeCause(error)}
          </Typography>
          {showStack && error.stack && (
            <Box
              component="pre"
              data-testid="crash-stack"
              sx={{ fontSize: 11, mt: 1, maxHeight: 240, overflow: 'auto', whiteSpace: 'pre-wrap' }}
            >
              {error.stack}
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Button size="small" variant="contained" onClick={this.props.controls.reload}>
              {s('shell.reload')}
            </Button>
            <Button size="small" onClick={this.copy}>
              {s(copied === 'copied'
                ? 'shell.diagnosticsCopied'
                : copied === 'failed' ? 'shell.copyFailed' : 'shell.copyDiagnostics')}
            </Button>
          </Box>
        </Alert>
      </Box>
    )
  }
}

/**
 * The name at the top of React's component stack — the component that threw.
 *
 * The whole stack is dozens of lines of providers, and the log is meant to stay
 * short enough to send; the full one is on the screen in development, where it
 * is the thing being read. Just the name, so nothing from the bundle's paths
 * rides along into a file the user is invited to hand over.
 */
function firstFrame(componentStack: string): string {
  const line = componentStack.split('\n').map((l) => l.trim()).find(Boolean)
  const name = line?.replace(/^(at|in)\s+/, '').split(/[\s(]/)[0]
  return name ? ` ${name}` : ''
}
