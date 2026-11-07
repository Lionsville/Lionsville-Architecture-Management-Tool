// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Reduce, the size it is at, increase. The size opens the steps and the way back
 * to the default. At an end the button stays in the tab order and says why it
 * does nothing, as every refused button does.
 *
 * It knows no preference: the steps and where it is at are handed in. The same
 * words as a menu's entries are in {@link textSizeEntries}, for a row where it
 * has folded away.
 */
import { useStrings } from '../../i18n/LanguageContext'
import { IconButton } from './Button'
import { MenuButton } from './Menu'
import type { MenuEntry } from './Menu'
import './TextSizeControl.css'

export type TextSizeProps<S extends number> = {
  size: S
  steps: readonly S[]
  /** The step that is nobody's choice: the way back goes there. */
  normal: S
  onChoose: (next: S) => void
}

type Say = ReturnType<typeof useStrings>['t']

function neighbours<S extends number>({ size, steps }: Pick<TextSizeProps<S>, 'size' | 'steps'>) {
  const at = steps.indexOf(size)
  return { smaller: steps[at - 1], larger: steps[at + 1] }
}

function stepEntries<S extends number>({ size, steps, normal, onChoose }: TextSizeProps<S>, t: Say): MenuEntry[] {
  return [
    ...steps.map((step): MenuEntry => ({ label: t('kit.textSize.percent', { size: step }), checked: step === size, onSelect: () => onChoose(step) })),
    { line: true },
    {
      label: t('kit.textSize.back'), 'data-guide': 'frame.textSizeReset', 'data-testid': 'text-size-reset', onSelect: () => onChoose(normal),
      ...(size === normal ? { refused: t('kit.textSize.atDefault') } : {}),
    },
  ]
}

/** What the control offers, as one entry with the steps under it. */
export function textSizeEntries<S extends number>(props: TextSizeProps<S>, t: Say): MenuEntry[] {
  const { smaller, larger } = neighbours(props)
  return [{
    label: `${t('kit.textSize.group')}: ${t('kit.textSize.percent', { size: props.size })}`,
    items: [
      { label: t('kit.textSize.larger'), onSelect: () => { if (larger !== undefined) props.onChoose(larger) }, ...(larger === undefined ? { refused: t('kit.textSize.atLargest') } : {}) },
      { label: t('kit.textSize.smaller'), onSelect: () => { if (smaller !== undefined) props.onChoose(smaller) }, ...(smaller === undefined ? { refused: t('kit.textSize.atSmallest') } : {}) },
      { line: true },
      ...stepEntries(props, t).filter((entry): entry is Exclude<MenuEntry, { items: unknown }> => !('items' in entry)),
    ],
  }]
}

export function TextSizeControl<S extends number>(props: TextSizeProps<S>) {
  const { t } = useStrings()
  const { size, onChoose } = props
  const { smaller, larger } = neighbours(props)
  return (
    <span className="kit-textsize" role="group" aria-label={t('kit.textSize.group')} data-guide="frame.textSize">
      <IconButton
        label={t('kit.textSize.smaller')} size="small" data-guide="frame.textSmaller" data-testid="text-smaller"
        reason={smaller === undefined ? t('kit.textSize.atSmallest') : undefined}
        onClick={() => { if (smaller !== undefined) onChoose(smaller) }}
      >
        <span className="kit-textsize__a" data-small aria-hidden>A</span>
      </IconButton>
      <MenuButton
        label={t('kit.textSize.percent', { size })} menuLabel={t('kit.textSize.group')} aria-label={`${t('kit.textSize.group')}: ${t('kit.textSize.percent', { size })}`}
        variant="quiet" size="small" items={stepEntries(props, t)} data-guide="frame.textSizeNow" data-testid="text-size-now"
      />
      <IconButton
        label={t('kit.textSize.larger')} size="small" data-guide="frame.textLarger" data-testid="text-larger"
        reason={larger === undefined ? t('kit.textSize.atLargest') : undefined}
        onClick={() => { if (larger !== undefined) onChoose(larger) }}
      >
        <span className="kit-textsize__a" aria-hidden>A</span>
      </IconButton>
    </span>
  )
}
