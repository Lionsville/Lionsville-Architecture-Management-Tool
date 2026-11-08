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
 */
import type { Language } from '../i18n/languages'

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
