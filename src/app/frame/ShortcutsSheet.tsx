// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The keys, on every screen: generated from the one table of commands, so a
 * key cannot be on a menu and not here. The canvas's own come from its keymap.
 */
import type { StringKey, Translate } from '../../i18n'
import { CANVAS_SHORTCUTS, detectPlatform, formatChord } from '../../editor/keymap'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { keyCap } from './commandsTable'
import type { CommandRow } from './commandsTable'

const FRAME_KEYS = (mac: boolean): readonly (readonly [StringKey, string])[] => [
  ['frame.find', mac ? '⌘K' : 'Ctrl K'],
  ['frame.treeToggle', mac ? '⌘\\' : 'Ctrl \\'],
  ['menu.shortcuts', '?'],
]

export function ShortcutsSheet({ open, onClose, rows, mac, s }: {
  open: boolean; onClose: () => void; rows: readonly CommandRow[]; mac: boolean; s: Translate
}) {
  const withKeys = rows.filter((row) => row.keys !== undefined)
  const group = (name: CommandRow['group']) => withKeys.filter((row) => row.group === name)
  const platform = detectPlatform()
  return (
    <Dialog open={open} onClose={onClose} size="l" title={s('menu.shortcuts')} actions={<Button onClick={onClose}>{s('frame.close')}</Button>}>
      <div className="kit-sheet" data-testid="shortcuts-sheet">
        <section>
          <h3>{s('frame.group.frame')}</h3>
          {FRAME_KEYS(mac).map(([label, key]) => <div key={label} className="kit-sheet__row"><span>{s(label)}</span><span className="kit-frame__kbd">{key}</span></div>)}
          {(['file', 'edit', 'go', 'view'] as const).flatMap((name) => group(name)).map((row) => (
            <div key={row.id} className="kit-sheet__row"><span>{s(row.label)}</span><span className="kit-frame__kbd">{keyCap(row.keys!, mac)}</span></div>
          ))}
        </section>
        <section>
          <h3>{s('frame.group.canvas')}</h3>
          {CANVAS_SHORTCUTS.map((def) => (
            <div key={def.id} className="kit-sheet__row"><span>{s(def.labelKey)}</span><span className="kit-frame__kbd">{formatChord(def, platform)}</span></div>
          ))}
        </section>
      </div>
    </Dialog>
  )
}
