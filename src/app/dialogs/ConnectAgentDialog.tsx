/**
 * Connect an agent (ADR-0007): what this is, the switch, and the instructions.
 *
 * Three parts, top to bottom, in the order a person needs them. The
 * explanation comes first because this dialog is how most people find out the
 * feature exists; the switch is the preference; and the recipes are what the
 * person does next, which is why turning the switch on does not close the
 * dialog.
 *
 * A browser tab has no host to listen on its behalf, so it gets the
 * explanation and, in place of the switch, the sentence saying so. That is
 * the honest fallback the rest of the shell uses, and it beats the feature
 * being invisible on the web.
 *
 * The recipes are strings with placeholders (`app/strings/`), filled here
 * with the port and the token main reported. `readOnly` hides the switch and
 * the token, not the explanation. An ordinary dialog, not fullscreen, so it
 * needs no `windowChrome`.
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import type { StringKey, Translate } from '../../i18n'
import type { AgentServerStatus } from '../../platform/agentServer'
import { agentEndpoint } from '../../platform/agentServer'

/** The clients the app carries a recipe for, and the one line for the rest. */
const RECIPES: readonly { readonly id: string; readonly tab: StringKey; readonly recipe: StringKey }[] = [
  { id: 'claude', tab: 'agent.tabClaude', recipe: 'agent.recipeClaude' },
  { id: 'codex', tab: 'agent.tabCodex', recipe: 'agent.recipeCodex' },
  { id: 'cursor', tab: 'agent.tabCursor', recipe: 'agent.recipeCursor' },
  { id: 'other', tab: 'agent.tabOther', recipe: 'agent.recipeOther' },
]

/** How long "Copied" stands in for "Copy". */
const COPIED_MS = 2000

export type ConnectAgentDialogProps = {
  open: boolean
  onClose: () => void
  /**
   * The server's three facts. Absent in a browser tab, where there is no
   * server to have facts about, and the switch is replaced by the explanation.
   */
  status?: AgentServerStatus
  readOnly?: boolean
  onEnabledChange: (enabled: boolean) => void
  onNewToken: () => void
  /** Through the `HostControls` seam, so a test can see what was copied. */
  copyText: (text: string) => Promise<void>
  s: Translate
}

export function ConnectAgentDialog({
  open, onClose, status, readOnly = false, onEnabledChange, onNewToken, copyText, s,
}: ConnectAgentDialogProps) {
  const [tab, setTab] = useState(RECIPES[0].id)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  const on = status !== undefined && status.kind !== 'off'
  const recipe = on
    ? s(RECIPES.find((held) => held.id === tab)!.recipe, {
        endpoint: agentEndpoint(status.port), token: status.token,
      })
    : ''

  const copy = () => {
    // A refusal here is the host's, and the button simply does not say
    // "Copied" — the text is on the screen to select by hand.
    void copyText(recipe).then(() => setCopied(true), () => undefined)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-testid="connect-agent-dialog">
      <DialogTitle sx={{ fontSize: 15 }}>{s('agent.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography sx={{ fontSize: 13 }}>{s('agent.what')}</Typography>

          {status === undefined ? (
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }} data-testid="agent-desktop-only">
              {s('agent.desktopOnly')}
            </Typography>
          ) : !readOnly && (
            <>
              <Divider />
              <FormControlLabel
                control={(
                  <Switch
                    size="small"
                    checked={on}
                    onChange={(event) => onEnabledChange(event.target.checked)}
                    inputProps={{ 'aria-label': s('agent.enable') }}
                  />
                )}
                label={<Typography sx={{ fontSize: 13 }}>{s('agent.enable')}</Typography>}
              />
              {on && (
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }} data-testid="agent-state">
                  {status.kind === 'connected'
                    ? s('agent.connected', { name: status.client.name })
                    : s('agent.listening', { port: status.port })}
                  {status.movedFrom !== undefined && ` ${s('agent.moved', { from: status.movedFrom, port: status.port })}`}
                </Typography>
              )}
            </>
          )}

          {on && !readOnly && (
            <>
              <Divider />
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'text.secondary' }}>
                {s('agent.recipes')}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('agent.recipesNote')}</Typography>
              <Tabs
                value={tab}
                onChange={(_event, next: string) => setTab(next)}
                variant="scrollable"
                sx={{ minHeight: 32, '& .MuiTab-root': { minHeight: 32, fontSize: 12, py: 0 } }}
              >
                {RECIPES.map((held) => <Tab key={held.id} value={held.id} label={s(held.tab)} />)}
              </Tabs>
              <Box
                component="pre"
                data-testid="agent-recipe"
                sx={{
                  m: 0, p: 1.25, fontSize: 11.5, lineHeight: 1.5, borderRadius: 1,
                  bgcolor: 'action.hover', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              >
                {recipe}
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button size="small" variant="outlined" onClick={copy}>
                  {copied ? s('agent.copied') : s('agent.copy')}
                </Button>
                <Button size="small" onClick={onNewToken}>{s('agent.newToken')}</Button>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{s('agent.newTokenNote')}</Typography>
              </Stack>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose}>{s('common.close')}</Button>
      </DialogActions>
    </Dialog>
  )
}
