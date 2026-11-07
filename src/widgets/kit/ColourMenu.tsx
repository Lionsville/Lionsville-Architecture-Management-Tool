// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one Colour menu: None, then the questions this view can answer. Colouring
 * belongs to the reader and writes nothing until *Keep with the view*, which is
 * on the key strip beside what it keeps.
 */
import { useStrings } from '../../i18n/LanguageContext'
import { ViewBarMenu } from './ViewBar'

export type ColourQuestion = { id: string; label: string }

export function ColourMenu({ questions, value, onChange, 'data-guide': guide }: {
  questions: readonly ColourQuestion[]
  /** The question up, or nothing for None. */
  value: string | undefined
  onChange: (question: string | undefined) => void
  'data-guide'?: string
}) {
  const { t } = useStrings()
  const up = questions.find((question) => question.id === value)
  return (
    <ViewBarMenu
      label={up ? t('kit.colour.on', { question: up.label }) : t('kit.colour')}
      menuLabel={t('kit.colour')}
      on={up !== undefined}
      data-guide={guide}
      items={[
        { label: t('kit.colour.none'), checked: up === undefined, onSelect: () => onChange(undefined) },
        { line: true },
        ...questions.map((question) => ({
          label: question.label,
          checked: question.id === value,
          onSelect: () => onChange(question.id),
        })),
      ]}
    />
  )
}
