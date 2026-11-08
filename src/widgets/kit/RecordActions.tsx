// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What can be done to a record, in one place and one order on every surface that
 * shows one: the large preview, the panel beside a map, the record's own page. At
 * the end of the head, in this order and nowhere else: the record's other verbs,
 * quiet; **✎ Edit**, outlined, with its pencil and always that one word; then ⋯,
 * with Delete last in it, red, behind a line (`final`). A surface that floats puts
 * its × after these; a page has none.
 *
 * The next step of a record is not here: it is one button in the Next band under
 * the head (`Preview`'s and `RecordPage`'s `next`), so a person finds the same verb
 * in the same place whichever record and whichever surface.
 */
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { PencilIcon } from '../icons'
import { Button } from './Button'
import { MoreMenu } from './Menu'
import type { MenuEntry } from './Menu'
import './RecordActions.css'

export type RecordEdit = {
  readonly onPress: () => void
  /** What the tooltip adds: *Edit the text and the facts*. */
  readonly tip?: string
  /** Why it cannot be pressed now; it is still shown. */
  readonly reason?: string
  readonly testId?: string
  readonly guide?: string
}

/** ✎ Edit: the one name and the one look of going to a record's editor. */
export function EditButton({ onPress, tip, reason, testId, guide }: RecordEdit) {
  const { t } = useStrings()
  return (
    <Button
      icon={<PencilIcon size={14} />} onClick={onPress} title={tip} data-testid={testId} data-guide={guide}
      {...(reason ? { reason } : {})}
    >
      {t('kit.record.edit')}
    </Button>
  )
}

export type RecordActionsProps = {
  /** The record's other verbs, quiet buttons: *Seen again*, *Verify*, *History…*. */
  readonly verbs?: ReactNode
  readonly edit?: RecordEdit
  /** What is under ⋯; a `final` entry (Delete…) is drawn last, behind a line. */
  readonly more?: readonly MenuEntry[]
  /** The ⋯'s name, where it says whose it is. */
  readonly moreLabel?: string
  readonly moreGuide?: string
}

export function RecordActions({ verbs, edit, more, moreLabel, moreGuide }: RecordActionsProps) {
  if (!verbs && !edit && !(more && more.length > 0)) return null
  return (
    <span className="kit-record-actions">
      {verbs}
      {edit && <EditButton {...edit} />}
      {more && more.length > 0 && <MoreMenu items={more} {...(moreLabel ? { label: moreLabel } : {})} {...(moreGuide ? { 'data-guide': moreGuide } : {})} />}
    </span>
  )
}
