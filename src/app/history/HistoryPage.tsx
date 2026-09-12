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
 *
 * **Or of one thing** (ADR-0008). The subject picker narrows the page to a
 * diagram, a description or a decision: the list is then the snapshots that
 * touched it, and the changes are the rows about it. The diff is still the
 * model's — nothing here knows a path — the page only chooses which rows to
 * speak.
 */
import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import NativeSelect from '@mui/material/NativeSelect'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { countChanges, diffModels } from '../../model/diff'
import type { ModelChange } from '../../model/diff'
import type { HostModel } from '../../model/fromInterchange'
import { LOCALE } from '../../i18n'
import type { Language, Translate } from '../../i18n'
import { PageDialog } from '../../widgets/PageDialog'
import { NO_WINDOW_CHROME, barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import type { HistoryEntry } from '../../ports/ProjectHistory'
import type { HistorySubject } from '../../projects/historyPath'
import { changeLine } from './changeLine'
import { changesFor } from './changesFor'
import { LabelDialog } from './LabelDialog'
import { RestoreDialog } from './RestoreDialog'

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
  /** Whose history this is; absent is the whole project's. */
  subject?: HistorySubject
  onSubjectChange: (subject: HistorySubject | undefined) => void
  /**
   * Every scope the subject is filed in, this one first (ADR-0012 §7).
   *
   * An element's page is filed in the scope that answers for it and in every
   * scope that draws it, so the list below is the union of those files'
   * commits — and a person looking at it should be able to see that. One entry
   * or none is the ordinary case and says nothing.
   */
  scopes?: readonly string[]
  /** Make the subject, or the whole project, what the chosen snapshot held (ADR-0008). */
  onRestore: () => void
  /** Call the chosen snapshot something (ADR-0008). */
  onLabel: (name: string) => void
  language: Language
  s: Translate
  windowChrome?: WindowChrome
}

/** The picker's value: one string per subject, and the empty one for everything. */
const encode = (subject: HistorySubject | undefined): string => (subject ? `${subject.what}:${subject.id}` : '')
function decode(value: string): HistorySubject | undefined {
  const at = value.indexOf(':')
  if (at < 0) return undefined
  const what = value.slice(0, at)
  if (what !== 'diagram' && what !== 'description' && what !== 'decision') return undefined
  return { what, id: value.slice(at + 1) }
}

function when(at: number, language: Language): string {
  return new Date(at).toLocaleString(LOCALE[language], {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function HistoryPage(props: HistoryPageProps) {
  const {
    open, onClose, entries, chosen, onChoose, current, subject, onSubjectChange,
    scopes = [], onRestore, onLabel, language, s,
  } = props
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const bar = barChromeFor(chrome)
  const [confirming, setConfirming] = useState(false)
  const [labelling, setLabelling] = useState(false)

  // What can be asked about: every diagram, every described element, every
  // decision — of the project as it is now, which is where the person stands.
  const subjects = useMemo(() => ({
    diagrams: current.diagrams.map((diagram) => ({ id: diagram.id, name: diagram.name })),
    descriptions: current.elements
      .filter((element) => element.description !== undefined)
      .map((element) => ({ id: element.id, name: element.name })),
    decisions: (current.decisions ?? []).map((adr) => ({ id: adr.id, name: adr.title })),
  }), [current])

  // The newest snapshot is what somebody is nearly always asking about.
  const first = entries[0]?.id
  useEffect(() => {
    if (open && first && !chosen) onChoose(first)
  }, [open, first, chosen, onChoose])

  const changes: ModelChange[] | undefined = useMemo(
    () => (chosen?.model ? changesFor(diffModels(chosen.model, current), subject) : undefined),
    [chosen, current, subject],
  )
  const counts = changes && countChanges(changes)

  // What the restore would be called, from the project as it is now — or,
  // for a thing that is gone now, from the snapshot, which still has it.
  const subjectName = useMemo(() => {
    if (!subject) return undefined
    const from = (model: HostModel | undefined) => {
      if (!model) return undefined
      switch (subject.what) {
        case 'diagram': return model.diagrams.find((held) => held.id === subject.id)?.name
        case 'description': return model.elements.find((held) => held.id === subject.id)?.name
        case 'decision': return (model.decisions ?? []).find((held) => held.id === subject.id)?.title
      }
    }
    return from(current) ?? from(chosen?.model) ?? subject.id
  }, [subject, current, chosen])
  const chosenEntry = entries.find((entry) => entry.id === chosen?.id)

  return (
    <PageDialog
      open={open}
      topInset={chrome.topInset}
      onClose={onClose}
      aria-label={s('history.title')}
    >
      {/* ---- top bar: the window's, while this page is up ---- */}
      <Box
        data-testid="history-topbar"
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5,
          pl: `${12 + bar.controlsInset}px`,
          WebkitAppRegion: bar.draggable ? 'drag' : undefined,
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
        <Box sx={{ flex: 1 }} />
        <Typography component="label" htmlFor="history-subject" sx={{ fontSize: 12, color: 'text.secondary' }}>
          {s('history.subject')}
        </Typography>
        <NativeSelect
          id="history-subject"
          value={encode(subject)}
          onChange={(event) => onSubjectChange(decode(event.target.value))}
          sx={{ fontSize: 13, minWidth: 220 }}
        >
          <option value="">{s('history.everything')}</option>
          {subjects.diagrams.length > 0 && (
            <optgroup label={s('history.diagrams')}>
              {subjects.diagrams.map((held) => (
                <option key={held.id} value={encode({ what: 'diagram', id: held.id })}>{held.name}</option>
              ))}
            </optgroup>
          )}
          {subjects.descriptions.length > 0 && (
            <optgroup label={s('history.descriptions')}>
              {subjects.descriptions.map((held) => (
                <option key={held.id} value={encode({ what: 'description', id: held.id })}>{held.name}</option>
              ))}
            </optgroup>
          )}
          {subjects.decisions.length > 0 && (
            <optgroup label={s('history.decisions')}>
              {subjects.decisions.map((held) => (
                <option key={held.id} value={encode({ what: 'decision', id: held.id })}>{held.name}</option>
              ))}
            </optgroup>
          )}
        </NativeSelect>
      </Box>

      {/* Where the list is coming from, when it is coming from more than one
          scope (ADR-0012 §7) — and the half of that a person has to know: a
          restore is one command on one session, so it puts back what THIS
          scope holds. */}
      {subject && scopes.length > 1 && (
        <Box
          data-testid="history-everywhere"
          sx={{ px: 2, py: 0.75, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}
        >
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {s('history.everywhere', { scopes: scopes.join(' · ') })}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {s('history.restorePerScope')}
          </Typography>
        </Box>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', flex: 1, minHeight: 0 }}>
        <Box sx={{ borderRight: 1, borderColor: 'divider', overflowY: 'auto' }}>
          {entries.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: 'text.secondary', p: 2 }}>
              {s(subject ? 'history.noneFor' : 'history.none')}
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
                  {entry.labels.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, my: 0.5 }}>
                      {entry.labels.map((held) => (
                        <Chip key={held} size="small" color="primary" variant="outlined" label={held} sx={{ height: 20, fontSize: 11 }} />
                      ))}
                    </Box>
                  )}
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                    {when(entry.at, language)} · {s('history.by', { author: entry.author })}
                  </Typography>
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>

        <Box sx={{ overflowY: 'auto', p: 3 }} data-testid="history-diff">
          {chosenEntry && (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 2 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 600, minWidth: 0 }}>{chosenEntry.subject}</Typography>
              <Box sx={{ flex: 1 }} />
              <Button size="small" onClick={() => setLabelling(true)}>{s('history.label')}</Button>
            </Box>
          )}
          {chosen && !chosen.model && (
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{s('history.gone')}</Typography>
          )}
          {changes && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  {s('history.compare')}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Button
                  size="small"
                  variant="outlined"
                  color={subject ? 'primary' : 'warning'}
                  disabled={changes.length === 0}
                  onClick={() => setConfirming(true)}
                >
                  {s(subject ? 'history.restore' : 'history.restoreProject')}
                </Button>
              </Box>
              {changes.length === 0 ? (
                <Typography sx={{ fontSize: 13 }}>{s(subject ? 'history.unchangedFor' : 'history.unchanged')}</Typography>
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
      <LabelDialog
        open={labelling}
        onCancel={() => setLabelling(false)}
        onLabel={(name) => { setLabelling(false); onLabel(name) }}
        s={s}
      />
      <RestoreDialog
        open={confirming}
        name={subjectName}
        date={chosenEntry ? when(chosenEntry.at, language) : ''}
        onCancel={() => setConfirming(false)}
        onRestore={() => { setConfirming(false); onRestore() }}
        s={s}
      />
    </PageDialog>
  )
}
