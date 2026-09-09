/**
 * Preferences, in three scopes (ADR-0005).
 *
 * The dialog is where a setting is *found*, not the only place it is
 * changed: the theme also lives in the View menu and the project order stays
 * in the picker, where its effect is on screen. What this adds is one face
 * over the scattered places a setting used to be set, and a section per scope
 * so that where a setting is *kept* is on the screen beside it.
 *
 * A section for a scope that does not exist is **absent, not disabled** — a
 * disabled control implies one is coming. So Updates is absent on the web,
 * "this folder" is absent until `folder.json` has a key, and "this folder, on
 * this machine" is absent without a folder and a history.
 *
 * It writes on change, not on an OK button. There is no Cancel, because there
 * is nothing to cancel — every one of these is reversible by setting it back,
 * and a settings dialog with a transaction is a settings dialog people close
 * the wrong way. An ordinary MUI dialog, not fullscreen, so it needs no
 * `windowChrome`.
 */
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { LANGUAGES, LANGUAGE_NAME } from '../../i18n'
import type { Language, Translate } from '../../i18n'
import { THEME_ITEMS } from '../../platform/menu'
import type { ThemeMode } from '../../platform/theme'
import type { UpdateChannel, UpdateSettingsPatch } from '../../platform/updateSettings'
import type { LocalSettingsPatch } from '../../projects/folderSettings'
import type { ProjectOrder } from '../../projects/project'

export type PreferencesDialogProps = {
  open: boolean
  onClose: () => void

  language: Language
  onLanguageChange: (next: Language) => void
  themeMode: ThemeMode
  onThemeChange: (next: ThemeMode) => void
  order: ProjectOrder
  onOrderChange: (next: ProjectOrder) => void

  /** The desktop's own settings. Absent on the web, and the section with it. */
  updates?: {
    checkAutomatically: boolean
    channel: UpdateChannel
    onChange: (patch: UpdateSettingsPatch) => void
  }

  /**
   * What this machine does about the folder's remote. Present only where
   * there is a folder AND a history: a browser tab with a directory handle
   * has a folder and no git, and offering it sync settings would be offering
   * something that cannot happen.
   */
  machine?: {
    pullOnOpen: boolean
    pushAfterSnapshot: boolean
    /** Where it is kept, said on the screen so nobody expects it to travel. */
    path: string
    onChange: (patch: LocalSettingsPatch) => void
  }

  s: Translate
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <Stack spacing={1}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'text.secondary' }}>
        {title}
      </Typography>
      {note && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{note}</Typography>}
      {children}
    </Stack>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
      <Typography sx={{ fontSize: 13 }}>{label}</Typography>
      {children}
    </Stack>
  )
}

export function PreferencesDialog({
  open, onClose, language, onLanguageChange, themeMode, onThemeChange, order, onOrderChange,
  updates, machine, s,
}: PreferencesDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-testid="preferences-dialog">
      <DialogTitle sx={{ fontSize: 15 }}>{s('prefs.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Section title={s('prefs.general')}>
            <Row label={s('prefs.language')}>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={language}
                onChange={(_e, next: Language | null) => { if (next) onLanguageChange(next) }}
                aria-label={s('prefs.language')}
              >
                {LANGUAGES.map((held) => (
                  <ToggleButton key={held} value={held} sx={{ fontSize: 11, px: 1.5 }}>
                    {s(LANGUAGE_NAME[held])}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Row>
            <Row label={s('prefs.theme')}>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={themeMode}
                onChange={(_e, next: ThemeMode | null) => { if (next) onThemeChange(next) }}
                aria-label={s('prefs.theme')}
              >
                {THEME_ITEMS.map((held) => (
                  <ToggleButton key={held.mode} value={held.mode} sx={{ fontSize: 11, px: 1.5 }}>
                    {s(held.label)}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Row>
            <Row label={s('prefs.projectOrder')}>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={order}
                onChange={(_e, next: ProjectOrder | null) => { if (next) onOrderChange(next) }}
                aria-label={s('prefs.projectOrder')}
              >
                <ToggleButton value="name" sx={{ fontSize: 11, px: 1.5 }}>{s('picker.orderName')}</ToggleButton>
                <ToggleButton value="updated" sx={{ fontSize: 11, px: 1.5 }}>{s('picker.orderUpdated')}</ToggleButton>
              </ToggleButtonGroup>
            </Row>
          </Section>

          {updates && (
            <>
              <Divider />
              <Section title={s('prefs.updates')} note={s('prefs.updatesNote')}>
                <FormControlLabel
                  control={(
                    <Checkbox
                      size="small"
                      checked={updates.checkAutomatically}
                      onChange={(e) => updates.onChange({ checkAutomatically: e.target.checked })}
                    />
                  )}
                  label={<Typography sx={{ fontSize: 13 }}>{s('prefs.checkAutomatically')}</Typography>}
                />
                <Row label={s('prefs.channel')}>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={updates.channel}
                    onChange={(_e, next: UpdateChannel | null) => { if (next) updates.onChange({ channel: next }) }}
                    aria-label={s('prefs.channel')}
                  >
                    <ToggleButton value="stable" sx={{ fontSize: 11, px: 1.5 }}>{s('prefs.channelStable')}</ToggleButton>
                    <ToggleButton value="beta" sx={{ fontSize: 11, px: 1.5 }}>{s('prefs.channelBeta')}</ToggleButton>
                  </ToggleButtonGroup>
                </Row>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('prefs.channelNote')}</Typography>
              </Section>
            </>
          )}

          {machine && (
            <>
              <Divider />
              <Section
                title={s('prefs.thisMachine')}
                note={s('prefs.thisMachineNote', { path: machine.path })}
              >
                <FormControlLabel
                  control={(
                    <Checkbox
                      size="small"
                      checked={machine.pullOnOpen}
                      onChange={(e) => machine.onChange({ git: { pullOnOpen: e.target.checked } })}
                    />
                  )}
                  label={<Typography sx={{ fontSize: 13 }}>{s('prefs.pullOnOpen')}</Typography>}
                />
                <FormControlLabel
                  control={(
                    <Checkbox
                      size="small"
                      checked={machine.pushAfterSnapshot}
                      onChange={(e) => machine.onChange({ git: { pushAfterSnapshot: e.target.checked } })}
                    />
                  )}
                  label={<Typography sx={{ fontSize: 13 }}>{s('prefs.pushAfterSnapshot')}</Typography>}
                />
              </Section>
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
