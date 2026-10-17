// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *From a library*: a library brought in as a choice (ADR-0036, amended 11
 * October 2026), in a dialog over the operating model's page.
 *
 * The libraries are listed on the left. The one picked is drawn in the middle
 * as its own structure, read-only (`LibraryStructure`), where unit types and
 * roles are ticked; on the right, *What will come in* (`ComingInPane`) is the
 * step itself before it is written, where every name, every type's place and
 * every role's reuse is settled. *Bring in* writes it as one step: the rows
 * handed back as `bringIn`'s choices (`choicesOf`), so what was shown is what
 * is written, and one undo takes it all out.
 *
 * Not the whole window: it sits below the shell's toolbar where the host
 * keeps one, and its paper is never a handle that moves the window, so the
 * operating model's own bar under it cannot swallow its clicks
 * (`platform/windowChrome`).
 */
import { useId, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import { FieldsDialog } from '../../widgets/CompactForms'
import IconButton from '@mui/material/IconButton'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Command } from '../../model/commands'
import type { MakeId } from '../../model/keys'
import { useStrings } from '../../i18n'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { CloseIcon } from '../../widgets/icons'
import { bringIn } from '../bringIn'
import type { OperatingLists } from '../bringIn'
import { choicesOf, whatWillComeIn } from '../comingIn'
import type { ComingInEdits } from '../comingIn'
import type { Library, LibraryLanguage } from '../library'
import { ComingInPane } from './ComingInPane'
import { countsLine } from './countsLine'
import { LibraryStructure } from './LibraryStructure'

/** A step a library brought in: what to dispatch, and what to say of it. */
export type Brought = {
  readonly step: Command
  readonly library: Library
  /** How many items it makes, and how many of the organisation's it uses instead. */
  readonly made: number
  readonly reused: number
}

export type LibraryDialogProps = {
  open: boolean
  lists: OperatingLists
  libraries: readonly Library[]
  /** The library open first; the first listed where absent. */
  libraryId?: string
  language: LibraryLanguage
  makeId: MakeId
  windowChrome?: WindowChrome
  onClose(): void
  /** The step settled, to be dispatched; the dialog is done with it. */
  onBring(brought: Brought): void
}

export function LibraryDialog(props: LibraryDialogProps) {
  const { t } = useStrings()
  const titleId = useId()
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  return (
    <FieldsDialog
      open={props.open} onClose={props.onClose} aria-labelledby={titleId} maxWidth={false} fullWidth
      sx={{ top: chrome.topInset ?? 0 }}
      slotProps={{
        paper: {
          'data-testid': 'library-dialog',
          sx: { width: 'calc(100% - 32px)', maxWidth: 1480, height: 'calc(100% - 32px)', m: 2, display: 'flex', flexDirection: 'column', WebkitAppRegion: 'no-drag' },
        } as object,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, minHeight: 48, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Typography component="h2" id={titleId} sx={{ fontWeight: 700, fontSize: 15 }}>{t('operating.libraryDialog')}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>{t('operating.libraryDialogHint')}</Typography>
        <Tooltip title={t('operating.libraryDialogClose')}>
          <IconButton size="small" aria-label={t('operating.libraryDialogClose')} onClick={props.onClose}><CloseIcon /></IconButton>
        </Tooltip>
      </Box>
      <Body {...props} />
    </FieldsDialog>
  )
}

/** The three columns, holding what is ticked and edited: fresh each time the dialog opens, and each time another library is picked. */
function Body({ lists, libraries, libraryId, language, makeId, onBring }: LibraryDialogProps) {
  const { t } = useStrings()
  const [picked, setPicked] = useState(() => libraries.find((one) => one.id === libraryId)?.id ?? libraries[0]?.id)
  const [ticked, setTicked] = useState<readonly string[]>([])
  const [edits, setEdits] = useState<ComingInEdits>({})
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(new Set())
  const library = libraries.find((one) => one.id === picked)
  const coming = useMemo(
    () => (library ? whatWillComeIn({ lists, library, entries: ticked, language, edits }) : undefined),
    [lists, library, ticked, language, edits],
  )
  const rows = useMemo(() => new Map((coming?.rows ?? []).map((row) => [row.entry, row])), [coming])
  const pick = (id: string) => { setPicked(id); setTicked([]); setEdits({}); setUnfolded(new Set()) }
  const tick = (entry: string, on: boolean) => setTicked((held) => (on ? [...held.filter((one) => one !== entry), entry] : held.filter((one) => one !== entry)))
  const fold = (entry: string) => setUnfolded((held) => {
    const next = new Set(held)
    if (!next.delete(entry)) next.add(entry)
    return next
  })
  const bring = () => {
    if (!library || !coming) return
    const step = bringIn({ lists, library, entries: ticked, language, makeId, ...choicesOf(coming.rows) })
    if (step) onBring({ step, library, made: coming.made, reused: coming.rows.filter((row) => row.fate === 'reused').length })
  }
  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '180px minmax(0, 1fr) 340px' }, overflow: { xs: 'auto', md: 'hidden' } }}>
      <Tabs
        orientation="vertical" value={picked ?? false} onChange={(_event, id: string) => pick(id)} aria-label={t('operating.libraryList')}
        data-guide="operating.libraryList" variant="scrollable"
        sx={{ borderRight: { md: 1 }, borderBottom: { xs: 1, md: 0 }, borderColor: 'divider', '& .MuiTabs-indicator': { left: 0 } }}
      >
        {libraries.map((one) => (
          <Tab
            key={one.id} value={one.id} data-testid={`library-tab-${one.id}`}
            sx={{ alignItems: 'flex-start', textAlign: 'left', textTransform: 'none', minHeight: 56, py: 1 }}
            label={(
              <Box>
                <Box component="span" sx={{ display: 'block', fontWeight: 700, color: 'text.primary' }}>{one.name}</Box>
                <Box component="span" sx={{ display: 'block', fontSize: 11, color: 'text.secondary' }}>
                  {countsLine(t, one.unitTypes.length, one.roles.length, one.responsibilities.length)}
                </Box>
              </Box>
            )}
          />
        ))}
      </Tabs>
      <Box sx={{ overflow: 'auto', p: 2, minWidth: 0 }} data-testid="library-middle">
        {library && (
          <LibraryStructure
            library={library} language={language} lists={lists} rows={rows}
            ticked={new Set(ticked)} onTick={tick} unfolded={unfolded} onFold={fold}
          />
        )}
      </Box>
      <Box sx={{ overflow: 'auto', p: 2, borderLeft: { md: 1 }, borderTop: { xs: 1, md: 0 }, borderColor: 'divider', bgcolor: 'background.default' }}>
        {library && coming && <ComingInPane library={library} lists={lists} coming={coming} edits={edits} onEdit={setEdits} onBring={bring} />}
      </Box>
    </Box>
  )
}
