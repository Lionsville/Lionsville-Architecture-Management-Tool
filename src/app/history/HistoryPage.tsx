/**
 * Every snapshot of this folder, and what changed since one of them.
 *
 * The diff is **semantic** and that is the whole reason this page exists rather
 * than a link to a git client. `git log -p` over a landscape folder is a
 * perfectly good answer to "which lines changed" and a useless answer to "what
 * happened to the architecture": a tidy pass is four hundred changed lines and
 * one sentence, and the sentence is what somebody comes here for
 * (`model/diff.ts`).
 *
 * Compared with **the project as it is now**, not with the snapshot before it.
 * The question people actually have in front of a history is "what has happened
 * since then", and answering the other one would need two selections to ask.
 */
import { useEffect, useMemo } from 'react'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { countChanges, diffModels } from '../../model/diff'
import type { ModelChange } from '../../model/diff'
import type { HostModel } from '../../model/fromInterchange'
import type { Language, Translate } from '../../i18n'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import type { HistoryEntry } from '../../ports/ProjectHistory'
import { changeLine } from './changeLine'

export type HistoryPageProps = {
  open: boolean
  onClose: () => void
  /** Newest first, as the seam hands them over. */
  entries: readonly HistoryEntry[]
  /** The model at the selected snapshot; `undefined` while it is being read. */
  chosen?: { id: string; model?: HostModel }
  onChoose: (id: string) => void
  /** What is on screen now — the other side of every comparison. */
  current: HostModel
  language: Language
  s: Translate
  windowChrome?: WindowChrome
}

function when(at: number, language: Language): string {
  return new Date(at).toLocaleString(language === 'nl' ? 'nl-NL' : 'en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function HistoryPage(props: HistoryPageProps) {
  const { open, onClose, entries, chosen, onChoose, current, language, s } = props
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME

  // The newest snapshot is what somebody is nearly always asking about.
  const first = entries[0]?.id
  useEffect(() => {
    if (open && first && !chosen) onChoose(first)
  }, [open, first, chosen, onChoose])

  const changes: ModelChange[] | undefined = useMemo(
    () => (chosen?.model ? diffModels(chosen.model, current) : undefined),
    [chosen, current],
  )
  const counts = changes && countChanges(changes)

  return (
    <Dialog
      open={open}
      fullScreen
      onClose={onClose}
      aria-label={s('history.title')}
      slotProps={{ paper: { sx: { bgcolor: 'background.default', display: 'flex', flexDirection: 'column' } } }}
    >
      {/* ---- top bar: the window's, while this page is up ---- */}
      <Box
        data-testid="history-topbar"
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5,
          pl: `${12 + chrome.controlsInset}px`,
          WebkitAppRegion: chrome.draggable ? 'drag' : undefined,
          '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
          minHeight: 48, borderBottom: 1, borderColor: 'divider',
          bgcolor: 'background.paper', flexShrink: 0,
        }}
      >
        <Tooltip title={s('common.close')}>
          <IconButton size="small" aria-label={s('common.close')} onClick={onClose}>
            <Box
              component="span"
              aria-hidden
              sx={{ display: 'inline-block', width: 18, textAlign: 'center', fontSize: 16, lineHeight: 1 }}
            >
              ‹
            </Box>
          </IconButton>
        </Tooltip>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{s('history.title')}</Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', flex: 1, minHeight: 0 }}>
        <Box sx={{ borderRight: 1, borderColor: 'divider', overflowY: 'auto' }}>
          {entries.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: 'text.secondary', p: 2 }}>
              {s('history.none')}
            </Typography>
          ) : (
            <List dense disablePadding data-testid="history-list">
              {entries.map((entry) => (
                <ListItemButton
                  key={entry.id}
                  selected={entry.id === chosen?.id}
                  onClick={() => onChoose(entry.id)}
                  sx={{ display: 'block', py: 1 }}
                >
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{entry.subject}</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                    {when(entry.at, language)} · {s('history.by', { author: entry.author })}
                  </Typography>
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>

        <Box sx={{ overflowY: 'auto', p: 3 }} data-testid="history-diff">
          {chosen && !chosen.model && (
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{s('history.gone')}</Typography>
          )}
          {changes && (
            <>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2 }}>
                {s('history.compare')}
              </Typography>
              {changes.length === 0 ? (
                <Typography sx={{ fontSize: 13 }}>{s('history.unchanged')}</Typography>
              ) : (
                <>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>
                    {counts && `+${counts.added} · −${counts.removed} · ~${counts.changed} · ⇢${counts.moved}`}
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                    {changes.map((change) => (
                      <Box
                        component="li"
                        key={`${change.what}-${change.kind}-${change.id}`}
                        sx={{ fontSize: 13, mb: 0.5 }}
                      >
                        {changeLine(change, s)}
                      </Box>
                    ))}
                  </Box>
                </>
              )}
            </>
          )}
        </Box>
      </Box>
    </Dialog>
  )
}
