// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The `⋯` in row one: the menu bar, for a host that has none.
 *
 * Present on the web and absent on the desktop (ADR-0005). It renders the
 * same list the desktop's File menu renders — `platform/menu.ts` — and sends
 * the same commands through the same stream, so nothing that moved out of the
 * toolbar and into a menu is lost on the web. On the web this is load-bearing,
 * and `App.commands.test.tsx` walks every item to say so. The theme has moved to
 * the preferences, with the language beside it; the desktop's View menu keeps it.
 *
 * It decides nothing beyond what `offered` decides — but for *Save*, which stays
 * in the list with the reason it cannot run, because a person looks for it.
 *
 * A source provider's own lines are the one thing in here that is not this
 * tree's (`platform/sourceProvider.ts`'s `SourceMenuEntry`): they come last, in
 * a section of their own, and they are asked for when the menu opens rather than
 * held — what a provider offers moves with whether anybody is signed in to it.
 */
import { useEffect, useState } from 'react'
import type { Language, StringKey, Translate } from '../i18n'
import { useStrings } from '../i18n/LanguageContext'
import { acceleratorName } from '../platform/keyNames'
import type { HostCommand } from '../platform/hostCommands'
import type { SourceMenuEntry, SourceWorkChanged } from '../platform/sourceProvider'
import { FILE_MENU, HELP_MENU_ITEM, PREFERENCES_ITEM, offered } from '../platform/menu'
import type { MenuCapabilities } from '../platform/menu'
import { IconButton } from '../widgets/kit/Button'
import { Menu } from '../widgets/kit/Menu'
import type { MenuEntry } from '../widgets/kit/Menu'
import { MoreIcon } from '../widgets/icons'

export type OverflowMenuProps = {
  can: MenuCapabilities
  onCommand: (command: HostCommand) => void
  /**
   * What the source providers want in here, asked for on every open. Absent
   * where no provider registered a line, and then this menu is what it was.
   */
  sourceEntries?: () => readonly SourceMenuEntry[]
  /**
   * A provider says its own answer has moved. An open menu asks again, which is
   * how *Sign in…* becomes a name while the person is looking at it.
   */
  onSourceWork?: SourceWorkChanged
  /** What the row had no room for: first, above a line. */
  folded?: readonly MenuEntry[]
  /** The example is being visited: Save's refusal says nothing here is kept, not that work saves itself. */
  visiting?: boolean | undefined
  s: Translate
}

/** A key cap for what `menu.ts` says in Electron's words, named as the platform and the language name keys. */
function keyCap(accelerator: string | undefined, language: Language): string | undefined {
  if (!accelerator) return undefined
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return acceleratorName(accelerator, mac, language)
}

export function OverflowMenu({ can, onCommand, sourceEntries, onSourceWork, folded = [], visiting, s }: OverflowMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const { language } = useStrings()
  const choose = (command: HostCommand) => () => { setAnchor(null); onCommand(command) }

  /**
   * The providers' lines, read while the menu is open and not before.
   *
   * Asked on the open because a provider's answer is about this moment, and
   * asked again on *ask me again* because the moment can move while the list is
   * on screen — a handshake finishing behind an open menu is exactly the case
   * that would otherwise need the menu closed and opened again. Nothing is asked
   * and nothing is subscribed to while the menu is shut, which is almost always.
   */
  const [lines, setLines] = useState<readonly SourceMenuEntry[]>([])
  useEffect(() => {
    if (anchor === null || !sourceEntries) return
    setLines(sourceEntries())
    return onSourceWork?.(() => setLines(sourceEntries()))
  }, [anchor, sourceEntries, onSourceWork])

  const closing = (entry: MenuEntry): MenuEntry => ('onSelect' in entry ? { ...entry, onSelect: () => { setAnchor(null); entry.onSelect() } } : entry)
  const items: MenuEntry[] = folded.length > 0 ? [...folded.map(closing), { line: true }] : []
  // A file, then a place: the two ways to what you have, side by side. The menu bar's order is the File menu's.
  const listed = offered(FILE_MENU, 'web', { ...can, scope: true })
  const elsewhere = listed.find((entry) => entry.kind === 'item' && entry.label === 'menu.connect')
  const rest = listed.filter((entry, at) => entry !== elsewhere && !(elsewhere && at === 1 && entry.kind === 'separator'))
  const after = rest.findIndex((entry) => entry.kind === 'item' && entry.label === 'menu.open')
  const ordered = elsewhere ? [...rest.slice(0, after + 1), elsewhere, ...rest.slice(after + 1)] : rest
  for (const entry of ordered) {
    if (entry.kind === 'separator') { items.push({ line: true }); continue }
    if (entry.kind !== 'item') continue
    // In the example nothing is kept, inside a scope too: Save says so wherever it is asked.
    const needsScope = entry.needs?.includes('scope') && (!can.scope || visiting === true)
    const shortcut = keyCap(entry.accelerator, language)
    items.push({
      label: s(entry.label),
      onSelect: choose(entry.command),
      ...(shortcut ? { shortcut } : {}),
      ...(needsScope ? { refused: s(visiting ? 'menu.saveExample' : 'menu.saveNothingOpen') } : {}),
    })
  }
  items.push({ line: true }, { label: s(PREFERENCES_ITEM.label), onSelect: choose(PREFERENCES_ITEM.command), shortcut: keyCap(PREFERENCES_ITEM.accelerator, language) ?? '' })
  // The help, last of ours: a host with no menu bar has no Help menu, and the
  // ? in row one folds away first when the row runs out of room.
  items.push({ label: s(HELP_MENU_ITEM.label), onSelect: choose(HELP_MENU_ITEM.command), 'data-testid': 'overflow-help' })
  // The providers' own lines, last and under a rule. A rule and not a heading:
  // a heading would be a word of ours about somewhere this shell has never heard
  // of, and the lines say what they are. A key nobody registered renders as itself.
  if (lines.length > 0) items.push({ line: true })
  for (const line of lines) {
    if (line.divider) items.push({ line: true })
    items.push({
      label: s(line.labelKey as StringKey),
      'data-testid': `source-entry-${line.key}`,
      ...(line.disabled ? { refused: s('menu.notNow') } : {}),
      ...(line.href ? { href: line.href } : {}),
      onSelect: () => { setAnchor(null); line.onSelect() },
    })
  }

  return (
    <>
      <IconButton label={s('menu.more')} size="small" data-testid="overflow-button" aria-haspopup="menu" onClick={(event) => setAnchor(event.currentTarget)}>
        <MoreIcon size={16} />
      </IconButton>
      <Menu open={anchor !== null} anchorEl={anchor} label={s('menu.more')} items={items} onClose={() => setAnchor(null)} />
    </>
  )
}
