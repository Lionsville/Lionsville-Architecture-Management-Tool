// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one Colour menu: None, then the questions this view can answer. Colouring
 * belongs to the reader and writes nothing until *Keep with the view*, which is
 * on the key strip beside what it keeps.
 */
import { useStrings } from '../../i18n/LanguageContext'
import type { MenuEntry } from './Menu'
import { ViewBarMenu } from './ViewBar'

export type ColourQuestion = {
  id: string
  label: string
  /** A heading the menu lists it under. */
  group?: string
}

/** Questions too many to list: one line that opens them. */
export type ColourQuestionsMore = { label: string; questions: readonly ColourQuestion[] }

export function ColourMenu({ questions, more, value, upLabel, onChange, 'data-guide': guide }: {
  questions: readonly ColourQuestion[]
  more?: ColourQuestionsMore
  /** The question up, or nothing for None. */
  value: string | undefined
  /** How the question up is called, where it is not among those listed. */
  upLabel?: string
  onChange: (question: string | undefined) => void
  'data-guide'?: string
}) {
  const { t } = useStrings()
  const up = [...questions, ...(more?.questions ?? [])].find((question) => question.id === value)
  const said = up?.label ?? (value !== undefined ? upLabel : undefined)
  const entry = (question: ColourQuestion) => ({
    label: question.label,
    checked: question.id === value,
    onSelect: () => onChange(question.id),
  })
  let group: string | undefined
  const listed = questions.flatMap((question): MenuEntry[] => {
    const heading = question.group !== undefined && question.group !== group
    group = question.group
    return heading ? [{ heading: question.group as string }, entry(question)] : [entry(question)]
  })
  return (
    <ViewBarMenu
      label={said ? t('kit.colour.on', { question: said }) : t('kit.colour')}
      menuLabel={t('kit.colour')}
      on={said !== undefined}
      data-guide={guide}
      items={[
        { label: t('kit.colour.none'), checked: value === undefined, onSelect: () => onChange(undefined) },
        { line: true },
        ...listed,
        ...(more && more.questions.length > 0 ? [{ line: true } as const, { label: more.label, items: more.questions.map(entry) }] : []),
      ]}
    />
  )
}
