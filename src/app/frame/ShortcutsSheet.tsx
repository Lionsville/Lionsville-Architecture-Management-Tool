// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The keys, on every screen and over a board alike: generated from the one
 * table of commands and the frame's own keys, so a key cannot be on a menu and
 * not here, and the canvas's from its keymap, under a heading of their own.
 * `?` and Help › Keyboard Shortcuts… open this sheet everywhere (`AppFrame`).
 */
import type { StringKey, Translate } from '../../i18n'
import { canvasKeyRows, detectPlatform } from '../../editor/keymap'
import { KeySheet } from '../../widgets/kit/KeySheet'
import { FRAME_KEYS, keyCap } from './commandsTable'
import type { CommandRow } from './commandsTable'

export function ShortcutsSheet({ open, onClose, rows, mac, s }: {
  open: boolean; onClose: () => void; rows: readonly CommandRow[]; mac: boolean; s: Translate
}) {
  const everywhere = [
    ...FRAME_KEYS(mac).map(([label, key]) => ({ label: s(label), keys: [key] })),
    ...(['file', 'edit', 'go', 'view', 'help'] as const)
      .flatMap((name) => rows.filter((row) => row.group === name && row.keys !== undefined))
      .map((row) => ({ label: s(row.label), keys: [keyCap(row.keys!, mac)] })),
  ]
  const board = canvasKeyRows(detectPlatform()).map((row) => ({ label: s(row.labelKey as StringKey), keys: row.keys }))
  return (
    <KeySheet
      open={open} onClose={onClose} title={s('frame.shortcutsTitle')} closeLabel={s('frame.close')} orWord={s('frame.keysOr')}
      groups={[{ title: s('frame.group.frame'), rows: everywhere }, { title: s('frame.group.canvas'), rows: board }]}
    />
  )
}
