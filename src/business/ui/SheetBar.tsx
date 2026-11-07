// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The bar over the sheet and over its Coverage reading: the reading, then what the
 * page shows and is coloured by, then find and the rest. In words, in the View
 * bar's order, so that a bar with German on it is short enough and nothing has to
 * be guessed from an icon.
 */
import type { ReactNode } from 'react'
import type { Translate } from '../../i18n'
import { Segmented } from '../../widgets/kit/Segmented'
import { ViewBar, ViewBarButton, ViewBarMenu } from '../../widgets/kit/ViewBar'
import { MoreMenu } from '../../widgets/kit/Menu'
import type { MenuEntry } from '../../widgets/kit/Menu'

/** The three readings of one layer, one switch: two levels of the sheet, and the crossing. */
export type SheetReading = 'overview' | 'names' | 'coverage'

/** Other views of the same kind in this scope, under the reading's menu. */
export type OtherView = { id: string; name: string; here: boolean }

export function ReadingSwitch({ value, onChange, canCover, others, t, guide }: {
  value: SheetReading
  onChange(reading: SheetReading): void
  /** False: no map yet and nobody here who may make one. */
  canCover: boolean
  others?: { views: readonly OtherView[]; onOpen(id: string): void }
  t: Translate
  guide: string
}) {
  const options: { value: SheetReading; label: string }[] = [
    { value: 'overview', label: t('sheet.reading.overview') },
    { value: 'names', label: t('sheet.reading.names') },
    ...(canCover ? [{ value: 'coverage' as const, label: t('sheet.reading.coverage') }] : []),
  ]
  return (
    <>
      <Segmented label={t('sheet.reading')} options={options} value={value} onChange={onChange} data-guide={guide} />
      {others && others.views.length > 1 && (
        <ViewBarMenu
          label={others.views.find((view) => view.here)?.name ?? t('sheet.reading.coverage')}
          menuLabel={t('sheet.reading.maps')}
          items={others.views.map((view) => ({ label: view.name, checked: view.here, onSelect: () => others.onOpen(view.id) }))}
        />
      )}
    </>
  )
}

export function SheetBar({ reading, colour, day, journey, stakeholders, finding, onFind, more, t }: {
  reading: ReactNode
  colour?: ReactNode
  day?: ReactNode
  journey?: { shown: boolean; onShown(shown: boolean): void }
  stakeholders?: { shown: boolean; onShown(shown: boolean): void }
  finding: boolean
  onFind(): void
  more: readonly MenuEntry[]
  t: Translate
}) {
  return (
    <div data-testid="sheet-topbar">
      <ViewBar
        label={t('sheet.page')}
        reading={reading}
        colour={colour}
        day={day}
        show={(
          <>
            {journey && <ViewBarButton on={journey.shown} aria-pressed={journey.shown} onClick={() => journey.onShown(!journey.shown)}>{t('sheet.journey')}</ViewBarButton>}
            {stakeholders && <ViewBarButton on={stakeholders.shown} aria-pressed={stakeholders.shown} onClick={() => stakeholders.onShown(!stakeholders.shown)}>{t('sheet.stakeholders')}</ViewBarButton>}
          </>
        )}
        find={<ViewBarButton on={finding} aria-pressed={finding} onClick={onFind}>{t('sheet.findWord')}</ViewBarButton>}
        more={more.length > 0 ? <MoreMenu items={more} label={t('sheet.more')} /> : undefined}
      />
    </div>
  )
}
