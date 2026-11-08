// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The first screen where work has nowhere to be kept yet: where should it
 * live?
 *
 * It exists because of what it replaces. A desktop app that keeps documents
 * where a browser tab would keeps them somewhere invisible in a file manager,
 * outside every backup, and gone with the app (ADR-0003). So where a way in
 * says it is needed (`SourceConnect.required`) there is no "somewhere in the
 * app": either the person has chosen where work lives or the app asks, and
 * this is the asking — in the words of the way in it asks for, and with the
 * places this machine worked from lately one click away.
 *
 * Not a dialog over the picker. There is nothing behind it to look at, and a
 * dialog would imply there is something to dismiss it back to.
 */
import { TextSizeControl } from '../../widgets/kit/TextSizeControl'
import { DEFAULT_TEXT_SIZE, TEXT_SIZES } from '../../platform/textSize'
import type { TextSize } from '../../platform/textSize'
import { LANGUAGES, LANGUAGE_NAME } from '../../i18n'
import type { Language, StringKey, Translate } from '../../i18n'
import type { SourceWayIn } from '../../platform/sourceProvider'
import { Button } from '../../widgets/kit/Button'
import { Select } from '../../widgets/kit/Field'
import { FirstRunPage, FirstRunWay } from '../../widgets/kit/FirstRunPage'

export type FirstRunProps = {
  /**
   * Every way in this build offers, in the order they registered: the one the
   * screen asks for first and filled, the rest beside it — a build that
   * registered a provider of its own asks the same question here as it does
   * on the organisation screen.
   */
  waysIn: readonly SourceWayIn[]
  /** The language, on the first screen, because nothing else can be read until it is right. */
  language?: Language
  onLanguageChange?: (next: Language) => void
  /** How large this person reads, on a screen with no frame around it. */
  textSize?: TextSize
  onTextSizeChange?: (next: TextSize) => void
  s: Translate
}

export function FirstRun({ waysIn, language, onLanguageChange, textSize, onTextSizeChange, s }: FirstRunProps) {
  const asked = waysIn.find((way) => way.required)
  const others = waysIn.filter((way) => way !== asked)
  const recent = asked?.recent ?? []
  const said = (key: StringKey | (string & {})) => s(key as StringKey)
  return (
    <FirstRunPage
      brand={s('first.brand')}
      title={s('source.firstTitle')}
      data-testid="first-run"
      {...(asked?.introKey ? { intro: said(asked.introKey) } : {})}
      {...(language && onLanguageChange ? {
        tools: (
          <>
          {textSize !== undefined && onTextSizeChange && <TextSizeControl size={textSize} steps={TEXT_SIZES} normal={DEFAULT_TEXT_SIZE} onChoose={onTextSizeChange} />}
          <Select
            aria-label={s('prefs.language')} value={language} onChange={(event) => onLanguageChange(event.target.value as Language)}
            options={LANGUAGES.map((held) => ({ value: held, label: s(LANGUAGE_NAME[held]) }))} data-guide="first.language"
          />
          </>
        ),
      } : {})}
      foot={<p>{s('first.emptyFine')}</p>}
    >
      <FirstRunWay title={s('first.whereWorkLives')}>
        {asked && (
          <Button variant="primary" data-testid={`connect-source-${asked.kind}`} onClick={asked.onConnect}>
            {said(asked.firstLabelKey ?? asked.labelKey)}
          </Button>
        )}
        {/* A provider's key, from its own table or from this one's (`i18n/registerStrings`); the shell only renders it. */}
        {others.map((way) => (
          <Button key={way.kind} data-testid={`connect-source-${way.kind}`} onClick={way.onConnect}>{said(way.labelKey)}</Button>
        ))}
      </FirstRunWay>
      {recent.length > 0 && asked?.onReopen && (
        <FirstRunWay title={s('source.recent')}>
          {recent.map((held) => (
            <Button key={held.key} size="small" variant="quiet" onClick={() => asked.onReopen?.(held.key)}>{held.label}</Button>
          ))}
        </FirstRunWay>
      )}
    </FirstRunPage>
  )
}
