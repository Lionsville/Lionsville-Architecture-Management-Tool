// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Preferences, as a place with an address (`#/-/preferences`): what is this
 * person's on this computer (ADR-0005). Where a setting is *found*, not the only
 * place it is changed: the grid is still switched on the canvas and the list
 * order on the list, and what they remember silently can be seen and reset here.
 *
 * A section for what does not exist here is **absent, not disabled** — a disabled
 * control implies one is coming. So Updates is absent on the web, and what this
 * machine does about the source that is open is its provider's own section,
 * absent where it has nothing to say.
 *
 * It writes on change. There is nothing to cancel: every one of these is reversible
 * by setting it back.
 */
import type { ReactNode } from 'react'
import { DEFAULT_EDITOR_PREFERENCES, mergePreferences } from '../../editor/preferences'
import type { EditorPreferences } from '../../editor/preferences'
import { LANGUAGES, LANGUAGE_NAME } from '../../i18n'
import type { Language, Translate } from '../../i18n'
import { THEME_ITEMS } from '../../platform/menu'
import type { ThemeMode } from '../../platform/theme'
import { TEXT_SIZES } from '../../platform/textSize'
import type { TextSize } from '../../platform/textSize'
import type { UpdateChannel, UpdateSettingsPatch } from '../../platform/updateSettings'
import type { ProjectOrder } from '../../projects/scope'
import { PageClose } from '../../widgets/PageClose'
import { PageDialog } from '../../widgets/PageDialog'
import { Button } from '../../widgets/kit/Button'
import { Segmented } from '../../widgets/kit/Segmented'
import { PreferenceRow, SettingsPage, SettingsSection, SettingSwitch } from '../../widgets/kit/SettingsPage'
import { DENSITIES, DENSITY_LABEL, DENSITY_NAME } from '../../widgets/kit/density'
import type { Density } from '../../widgets/kit/density'

export type PreferencesPageProps = {
  open: boolean
  onClose: () => void

  language: Language
  onLanguageChange: (next: Language) => void
  themeMode: ThemeMode
  onThemeChange: (next: ThemeMode) => void
  order: ProjectOrder
  onOrderChange: (next: ProjectOrder) => void
  density: Density
  onDensityChange: (next: Density) => void
  textSize: TextSize
  onTextSizeChange: (next: TextSize) => void
  /** What the canvas remembers, and how a change reaches it. */
  editor: unknown
  onEditorChange: (next: EditorPreferences) => void

  /** The desktop's own settings. Absent on the web, and the section with it. */
  updates?: {
    checkAutomatically: boolean
    channel: UpdateChannel
    onChange: (patch: UpdateSettingsPatch) => void
  }

  /**
   * What the open source's provider draws here about its own source, already
   * inside its boundary: under the app's own sections, and absent where it
   * draws nothing.
   */
  sourcePanel?: ReactNode
  /** Kept by this browser for this site, rather than by this computer for the app. */
  inBrowser?: boolean
  s: Translate
}

export function PreferencesPage({
  open, onClose, language, onLanguageChange, themeMode, onThemeChange, order, onOrderChange, density, onDensityChange, textSize, onTextSizeChange, editor, onEditorChange,
  updates, sourcePanel, inBrowser = false, s,
}: PreferencesPageProps) {
  const canvas = mergePreferences(editor)
  const change = (patch: Partial<EditorPreferences>) => onEditorChange({ ...canvas, ...patch })
  const tidy = canvas.tidyOptions
  const tidyChange = (patch: Partial<EditorPreferences['tidyOptions']>) => change({ tidyOptions: { ...tidy, ...patch } })
  return (
    <PageDialog open={open} onClose={onClose} topInset={0} aria-label={s('prefs.title')} data-testid="preferences-page">
      <PageClose onClose={onClose} />
      <SettingsPage title={s('prefs.title')} owner={s(inBrowser ? 'prefs.ownerBrowser' : 'prefs.owner')} data-guide="prefs.page">
        <SettingsSection title={s('prefs.general')}>
          <PreferenceRow label={s('prefs.language')}>
            <Segmented
              label={s('prefs.language')} value={language} onChange={onLanguageChange}
              options={LANGUAGES.map((held) => ({ value: held, label: s(LANGUAGE_NAME[held]) }))}
            />
          </PreferenceRow>
          <PreferenceRow label={s('prefs.theme')}>
            <Segmented
              label={s('prefs.theme')} value={themeMode} onChange={onThemeChange}
              options={THEME_ITEMS.map((held) => ({ value: held.mode, label: s(held.label) }))}
            />
          </PreferenceRow>
          <PreferenceRow label={s('prefs.textSize')} hint={s('prefs.textSizeHint')}>
            <Segmented
              label={s('prefs.textSize')} value={String(textSize)} onChange={(next) => onTextSizeChange(Number(next) as TextSize)} data-guide="prefs.textSize"
              options={TEXT_SIZES.map((size) => ({ value: String(size), label: `${size}%` }))}
            />
          </PreferenceRow>
          <PreferenceRow label={s(DENSITY_NAME)} hint={s('prefs.densityHint')}>
            <Segmented
              label={s(DENSITY_NAME)} value={density} onChange={onDensityChange} data-guide="prefs.density"
              options={DENSITIES.map((one) => ({ value: one, label: s(DENSITY_LABEL[one]) }))}
            />
          </PreferenceRow>
          <PreferenceRow label={s('prefs.projectOrder')}>
            <Segmented
              label={s('prefs.projectOrder')} value={order} onChange={onOrderChange}
              options={[{ value: 'name', label: s('picker.orderName') }, { value: 'updated', label: s('picker.orderUpdated') }]}
            />
          </PreferenceRow>
        </SettingsSection>

        <SettingsSection title={s('prefs.canvas')} note={s('prefs.canvasNote')}>
          <SettingSwitch label={s('prefs.grid')} checked={canvas.showGrid} onChange={(showGrid) => change({ showGrid })} />
          <SettingSwitch label={s('prefs.snap')} checked={canvas.snapToGrid} onChange={(snapToGrid) => change({ snapToGrid })} />
          <SettingSwitch label={s('prefs.minimap')} checked={canvas.showMinimap} onChange={(showMinimap) => change({ showMinimap })} />
          <SettingSwitch label={s('prefs.badges')} checked={canvas.showLifecycle} onChange={(showLifecycle) => change({ showLifecycle })} />
          <SettingSwitch label={s('prefs.lineLabels')} checked={canvas.showEdgeLabels} onChange={(showEdgeLabels) => change({ showEdgeLabels })} />
          <PreferenceRow label={s('prefs.tidyDirection')}>
            <Segmented
              label={s('prefs.tidyDirection')} value={tidy.direction} onChange={(direction) => tidyChange({ direction })}
              options={[
                { value: 'hybrid', label: s('prefs.tidyHybrid') }, { value: 'horizontal', label: s('prefs.tidyHorizontal') },
                { value: 'vertical', label: s('prefs.tidyVertical') }, { value: 'auto', label: s('prefs.tidyAuto') },
              ]}
            />
          </PreferenceRow>
          <PreferenceRow label={s('prefs.tidyDensity')}>
            <Segmented
              label={s('prefs.tidyDensity')} value={tidy.density} onChange={(next) => tidyChange({ density: next })}
              options={[{ value: 'compact', label: s('prefs.tidyCompact') }, { value: 'normal', label: s('prefs.tidyNormal') }, { value: 'spacious', label: s('prefs.tidySpacious') }]}
            />
          </PreferenceRow>
          <div className="kit-settings__flush">
            <Button size="small" variant="quiet" onClick={() => onEditorChange({ ...DEFAULT_EDITOR_PREFERENCES })} data-testid="prefs-canvas-reset">{s('prefs.canvasReset')}</Button>
          </div>
        </SettingsSection>

        {updates && (
          <SettingsSection title={s('prefs.updates')} note={s('prefs.updatesNote')}>
            <SettingSwitch label={s('prefs.checkAutomatically')} checked={updates.checkAutomatically} onChange={(checkAutomatically) => updates.onChange({ checkAutomatically })} />
            <PreferenceRow label={s('prefs.channel')} hint={s('prefs.channelNote')}>
              <Segmented
                label={s('prefs.channel')} value={updates.channel} onChange={(channel) => updates.onChange({ channel })}
                options={[{ value: 'stable', label: s('prefs.channelStable') }, { value: 'beta', label: s('prefs.channelBeta') }]}
              />
            </PreferenceRow>
          </SettingsSection>
        )}

        {sourcePanel}
      </SettingsPage>
    </PageDialog>
  )
}
