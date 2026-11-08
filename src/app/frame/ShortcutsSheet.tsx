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
import { FRAME_KEYS, keyCap } from './commandsTable'
import type { CommandRow } from './commandsTable'

/**
 * The canvas's keys a row per thing done: a second key for the same thing (⌘Y
 * beside ⇧⌘Z, the Menu key beside ⇧F10) is said on the row it belongs to, and
 * the sheet's own key is said once, under Everywhere.
 */
function canvasRows(platform: ReturnType<typeof detectPlatform>): { label: StringKey; keys: string[] }[] {
  const rows: { label: StringKey; keys: string[] }[] = []
  for (const def of CANVAS_SHORTCUTS) {
    if (def.id === 'help') continue
    const chord = formatChord(def, platform)
    const row = rows.find((one) => one.label === def.labelKey)
    if (row) { if (!row.keys.includes(chord)) row.keys.push(chord) } else rows.push({ label: def.labelKey as StringKey, keys: [chord] })
  }
  return rows
}

export function ShortcutsSheet({ open, onClose, rows, mac, s }: {
  open: boolean; onClose: () => void; rows: readonly CommandRow[]; mac: boolean; s: Translate
}) {
  const withKeys = rows.filter((row) => row.keys !== undefined)
  const group = (name: CommandRow['group']) => withKeys.filter((row) => row.group === name)
  const platform = detectPlatform()
  return (
    <Dialog open={open} onClose={onClose} size="l" title={s('frame.shortcutsTitle')} actions={<Button onClick={onClose}>{s('frame.close')}</Button>}>
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
          {canvasRows(platform).map((row) => (
            <div key={row.label} className="kit-sheet__row">
              <span>{s(row.label)}</span>
              <span>{row.keys.map((key, index) => <span key={key}>{index > 0 && ` ${s('frame.keysOr')} `}<span className="kit-frame__kbd">{key}</span></span>)}</span>
            </div>
          ))}
        </section>
      </div>
    </Dialog>
  )
}
