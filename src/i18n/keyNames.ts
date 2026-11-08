// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a key is called on screen, said once for every place that shows one:
 * the sheet of keys, ⌘K, the ⋯ menu, a board's context menus.
 *
 * A key's name follows the platform first and the language second. On a Mac it
 * is the glyph on the key cap — ⌘ ⇧ ⌥ ⌃, ⌫ for Delete, ↩ for Return, ⎋ for
 * Escape — in every language, and a chord is written as macOS writes it:
 * ⌃⌥⇧⌘ in that order, then the key, nothing between them (⇧⌘Z). Elsewhere it
 * is the word on the key cap, which a German keyboard prints in German — Strg,
 * Umschalt, Entf — joined with + (Strg+Umschalt+Z).
 *
 * The tokens are Electron's accelerator words (`CmdOrCtrl`, `Shift`, `Alt`) and
 * the keymap's (`Mod`), and a key as `KeyboardEvent.key` names it.
 *
 * Here, among the words, because a sentence names a key too: a string says
 * `{key:Mod+Z}` and `t` fills it for the platform and the language (`fillKeys`),
 * so no sentence carries a ⌘ to a Windows screen. `platform/keyNames.ts` is
 * where everything else has always imported it from.
 */
import type { Language } from './languages'

const MAC_MODIFIER: Readonly<Record<string, string>> = {
  Ctrl: '⌃', Control: '⌃', Alt: '⌥', Option: '⌥', Shift: '⇧', Mod: '⌘', CmdOrCtrl: '⌘', CommandOrControl: '⌘', Cmd: '⌘', Command: '⌘', Meta: '⌘',
}

/** macOS's order for the modifiers of a chord. */
const MAC_ORDER = ['⌃', '⌥', '⇧', '⌘']

const OTHER_MODIFIER: Readonly<Record<Language, Readonly<Record<string, string>>>> = {
  en: { Ctrl: 'Ctrl', Control: 'Ctrl', Mod: 'Ctrl', CmdOrCtrl: 'Ctrl', CommandOrControl: 'Ctrl', Cmd: 'Ctrl', Command: 'Ctrl', Meta: 'Ctrl', Alt: 'Alt', Option: 'Alt', Shift: 'Shift' },
  nl: { Ctrl: 'Ctrl', Control: 'Ctrl', Mod: 'Ctrl', CmdOrCtrl: 'Ctrl', CommandOrControl: 'Ctrl', Cmd: 'Ctrl', Command: 'Ctrl', Meta: 'Ctrl', Alt: 'Alt', Option: 'Alt', Shift: 'Shift' },
  de: { Ctrl: 'Strg', Control: 'Strg', Mod: 'Strg', CmdOrCtrl: 'Strg', CommandOrControl: 'Strg', Cmd: 'Strg', Command: 'Strg', Meta: 'Strg', Alt: 'Alt', Option: 'Alt', Shift: 'Umschalt' },
}

/** The keys that are the same picture everywhere. */
const ANYWHERE: Readonly<Record<string, string>> = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Up: '↑', Down: '↓', Left: '←', Right: '→',
  Arrow: '↑ ↓ ← →', Plus: '+', '=': '+', '-': '−', Minus: '−',
}

const MAC_KEY: Readonly<Record<string, string>> = {
  Delete: '⌫', Backspace: '⌫', Enter: '↩', Return: '↩', Escape: '⎋', Esc: '⎋', Tab: '⇥', Space: 'Space', ' ': 'Space',
  // A Mac keyboard has no Menu key; ⇧F10 beside it is what reaches the menu there.
  ContextMenu: 'Menu',
}

const OTHER_KEY: Readonly<Record<Language, Readonly<Record<string, string>>>> = {
  en: { Delete: 'Del', Backspace: 'Backspace', Enter: 'Enter', Return: 'Enter', Escape: 'Esc', Esc: 'Esc', Tab: 'Tab', ContextMenu: 'Menu', Space: 'Space', ' ': 'Space' },
  nl: { Delete: 'Del', Backspace: 'Backspace', Enter: 'Enter', Return: 'Enter', Escape: 'Esc', Esc: 'Esc', Tab: 'Tab', ContextMenu: 'Menutoets', Space: 'Spatie', ' ': 'Spatie' },
  de: { Delete: 'Entf', Backspace: 'Rücktaste', Enter: 'Eingabe', Return: 'Eingabe', Escape: 'Esc', Esc: 'Esc', Tab: 'Tab', ContextMenu: 'Menütaste', Space: 'Leertaste', ' ': 'Leertaste' },
}

/** Is this token a modifier rather than the key a chord ends in? */
const isModifier = (token: string) => token in MAC_MODIFIER

/** One key's name: a modifier or the key itself. */
export function keyName(token: string, mac: boolean, language: Language = 'en'): string {
  if (isModifier(token)) return mac ? MAC_MODIFIER[token]! : OTHER_MODIFIER[language][token]!
  const named = ANYWHERE[token] ?? (mac ? MAC_KEY[token] : OTHER_KEY[language][token])
  if (named !== undefined) return named
  return token.length === 1 ? token.toUpperCase() : token
}

/** A chord's name, from its tokens in any order: ⇧⌘Z on a Mac, Strg+Umschalt+Z on a German keyboard elsewhere. */
export function chordName(tokens: readonly string[], mac: boolean, language: Language = 'en'): string {
  const modifiers = tokens.filter(isModifier).map((token) => keyName(token, mac, language))
  const keys = tokens.filter((token) => !isModifier(token)).map((token) => keyName(token, mac, language))
  if (!mac) return [...new Set(modifiers), ...keys].join('+')
  const ordered = MAC_ORDER.filter((glyph) => modifiers.includes(glyph))
  return [...ordered, ...keys].join('')
}

/** An Electron accelerator (`CmdOrCtrl+Shift+E`) as its chord's name. */
export function acceleratorName(accelerator: string, mac: boolean, language: Language = 'en'): string {
  // `+` is a key too (`CmdOrCtrl+Plus`, or a bare trailing `+`).
  const tokens = accelerator.endsWith('++') ? [...accelerator.slice(0, -2).split('+'), '+'] : accelerator.split('+')
  return chordName(tokens.filter((token) => token !== ''), mac, language)
}

/**
 * Is this a Mac? The renderer asks the browser; the desktop's main process,
 * which has no browser, asks Node — and only Electron's, so a test in node
 * says Ctrl on every machine it runs on rather than ⌘ on a Mac and Ctrl on
 * the runner.
 */
export function onMac(): boolean {
  if (typeof navigator !== 'undefined') {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
    return /mac|iphone|ipad/i.test(nav.userAgentData?.platform || navigator.platform || '')
  }
  const host = (globalThis as { process?: { platform?: string; versions?: { electron?: string } } }).process
  return host?.versions?.electron !== undefined && host.platform === 'darwin'
}

/**
 * A key a sentence names: `{key:Mod+Shift+Z}`, an accelerator between the
 * braces, or two of them, `{key:Cmd+[|Alt+Left}`, where a Mac's chord is
 * another chord elsewhere rather than the same one with Ctrl.
 */
const KEY_PLACEHOLDER = /\{key:([^}\s|]+)(?:\|([^}\s]+))?\}/g

/** A sentence with every key it names said for this platform and language: "undone with ⌘Z", "undone with Strg+Z". */
export function fillKeys(text: string, language: Language = 'en', mac: boolean = onMac()): string {
  if (!text.includes('{key:')) return text
  return text.replace(KEY_PLACEHOLDER, (_, onAMac: string, elsewhere?: string) =>
    acceleratorName(mac ? onAMac : elsewhere ?? onAMac, mac, language))
}

/** The modifier glyphs a sentence may not carry itself: it names the key, and `fillKeys` draws it. */
export const MODIFIER_GLYPHS = /[⌘⇧⌥⌃]/
