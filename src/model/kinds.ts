/**
 * What each element kind is called, in words.
 *
 * One table, because there were two: the inspector had `KIND_LABEL_KEYS` and
 * the palette had the same six keys inside `PALETTE_ITEMS`, and a seventh entry
 * for the domain group — which is a palette row, not an element kind. Anything
 * that names a kind reads this; the palette adds its own row on top.
 *
 * Only the key, never the sentence. `Translate` turns it into words at the call
 * site, in whatever language is on screen at that moment.
 */
import type { StringKey, Translate } from '../i18n/strings'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import type { ElementKind } from './types'

export const KIND_LABEL_KEYS: Record<ElementKind, StringKey> = {
  actor: 'kind.actor',
  application: 'kind.application',
  externalSystem: 'kind.externalSystem',
  inputChannel: 'kind.inputChannel',
  managementTool: 'kind.managementTool',
  component: 'kind.component',
}

/** An element kind's name, in the given language (English when none is given). */
export function kindLabel(kind: ElementKind, translate: Translate = DEFAULT_TRANSLATE): string {
  return translate(KIND_LABEL_KEYS[kind])
}
