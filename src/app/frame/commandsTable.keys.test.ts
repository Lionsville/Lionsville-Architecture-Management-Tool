// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every shortcut the help names is a key the app answers. A chord — a key
 * held with ⌘, Ctrl, ⌥ or ⇧ — an F-key and `?` are read out of every
 * section's keys, in every language, and each must be in the commands table
 * (the menus' accelerators), the frame's own keys (`FRAME_KEYS`), the canvas's
 * keymap, or the short list below of keys one surface answers for itself, each
 * with the file that answers it and what in that file shows it does. A key the
 * help promises and nothing answers fails here by its section.
 *
 * Plain keys in a focused list — Enter, Esc, the arrows, Space — are how a
 * control is worked, not shortcuts, and the components' own tests hold them.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CANVAS_SHORTCUTS } from '../../editor/keymap'
import { TEXT as EN } from '../../help/text/en'
import { TEXT as NL } from '../../help/text/nl'
import { TEXT as DE } from '../../help/text/de'
import { FRAME_KEYS, commandsTable } from './commandsTable'

type Chord = string

const KEY_NAMES: Record<string, string> = {
  '←': 'left', '→': 'right', '↑': 'up', '↓': 'down', Left: 'left', Right: 'right', Up: 'up', Down: 'down',
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  '+': 'plus', Plus: 'plus', '=': 'plus', '−': 'minus', '-': 'minus', Enter: 'enter', Return: 'enter',
}

/** One spelling for a chord: `mod+shift+alt+key`, whatever the platform's glyphs. */
function chord(mod: boolean, shift: boolean, alt: boolean, key: string): Chord {
  const name = KEY_NAMES[key] ?? key.toLowerCase()
  // ⇧ with a digit or a sign is how ? and the zoom keys are typed: the key is what counts.
  return [mod && 'mod', shift && 'shift', alt && 'alt', name].filter(Boolean).join('+')
}

const MODIFIER = /^(⌘|⇧|⌥|Ctrl|Cmd|Shift|Alt|Strg|Umschalt|Mod|CmdOrCtrl)$/

/** The chords a line of the help names: anything held with a modifier, an F-key, and `?`. */
export function chordsIn(written: string): Chord[] {
  const found: Chord[] = []
  // ⌘/Ctrl is one modifier said for both platforms, and a spaced + joins a modifier to its key.
  const said = written.replace(/⌘\s?\/\s?Ctrl/g, '⌘').replace(/\s\+\s/g, '+')
  // ⌘K, ⇧⌘Z, ⌘ +, Ctrl+Shift+Z, Shift+F10, Alt+←, ⇧1
  // A glyph may be joined by a spaced + (⇧ + arrows), and a sign that runs into a word is a hyphen (⇧-press).
  const pattern = /((?:(?:⌘|⇧|⌥)(?:\s|\+(?=[^\s,;.)·/]))?|(?:Ctrl|Cmd|Shift|Alt|Strg|Umschalt)\s?\+\s?)+)(F\d{1,2}|Enter|Return|[A-Za-z0-9]\b|[[\]\\,./?=+\-−←→↑↓](?![A-Za-zäöüß]))/g
  for (const match of said.matchAll(pattern)) {
    const mods = match[1]
    const mod = /⌘|Ctrl|Cmd|Strg/.test(mods)
    const shift = /⇧|Shift|Umschalt/.test(mods)
    const alt = /⌥|Alt/.test(mods)
    const key = match[2]
    if (key === '?' || key === '/') found.push(chord(mod, false, alt, '?'))
    else found.push(chord(mod, shift, alt, key))
  }
  const bare = said.replace(pattern, ' ')
  for (const match of bare.matchAll(/(?<![\w⌘])F(\d{1,2})\b/g)) found.push(chord(false, false, false, `F${match[1]}`))
  if (/(^|[\s;,(])\?($|[\s;,).])/.test(bare)) found.push('?')
  return found
}

function fromAccelerator(accelerator: string): Chord {
  const parts = accelerator.split('+')
  const key = parts.pop() === '' ? '+' : accelerator.split('+').at(-1)!
  const mods = parts.filter((part) => MODIFIER.test(part))
  return chord(mods.some((one) => /Cmd|Ctrl|CmdOrCtrl/.test(one)), mods.includes('Shift'), mods.includes('Alt'), key)
}

const everything = { history: true, connect: true, scope: true, picture: true }
const ANSWERED = new Set<Chord>([
  ...['darwin', 'linux'].flatMap((platform) => commandsTable(everything, platform).flatMap((row) => (row.keys ? [fromAccelerator(row.keys)] : []))),
  ...[true, false].flatMap((mac) => FRAME_KEYS(mac).flatMap(([, keys]) => chordsIn(keys))),
  ...CANVAS_SHORTCUTS.flatMap((def) => {
    const key = def.keys.find((one) => !MODIFIER.test(one)) ?? ''
    const mod = def.keys.includes('Mod')
    const shift = def.keys.includes('Shift') && key !== '?'
    if (key === 'Arrow') return ['left', 'right', 'up', 'down'].map((name) => chord(mod, shift, false, name))
    return [chord(mod, shift, def.keys.includes('Alt'), key)]
  }),
])

const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')

/** Keys one surface answers for itself, by the file that does and what in it shows it does. */
const LOCAL: Record<Chord, { file: string; shows: RegExp }> = {
  // Row one's redo by the other key, where no Edit menu hears it.
  'mod+y': { file: 'app/frame/AppFrame.tsx', shows: /key === 'y'/ },
  // The writer's toolbar keys (`toolOfKey`), its way to the toolbar, and ⌘Enter to finish.
  'mod+b': { file: 'documentation/ui/MarkdownToolbar.tsx', shows: /shortcut: 'B'/ },
  'mod+i': { file: 'documentation/ui/MarkdownToolbar.tsx', shows: /shortcut: 'I'/ },
  'mod+e': { file: 'documentation/ui/MarkdownToolbar.tsx', shows: /shortcut: 'E'/ },
  'mod+k': { file: 'documentation/ui/MarkdownToolbar.tsx', shows: /shortcut: 'K'/ },
  'mod+shift+8': { file: 'documentation/ui/MarkdownToolbar.tsx', shows: /shortcut: '⇧8'/ },
  'mod+shift+7': { file: 'documentation/ui/MarkdownToolbar.tsx', shows: /shortcut: '⇧7'/ },
  'mod+shift+9': { file: 'documentation/ui/MarkdownToolbar.tsx', shows: /shortcut: '⇧9'/ },
  // Up a level on the organisation chart.
  'shift+enter': { file: 'app/units/chartKeys.ts', shows: /case 'Enter': return event\.shiftKey \? 'up'/ },
  'alt+f10': { file: 'documentation/ui/MarkdownEditor.tsx', shows: /event\.altKey && event\.key === 'F10'/ },
  'mod+enter': { file: 'documentation/ui/MarkdownEditor.tsx', shows: /mod && event\.key === 'Enter'/ },
  // Every canvas's zoom (`widgets/kit/zoom`), over the poster, the maps and the roadmap's axis.
  'mod+plus': { file: 'widgets/kit/zoom.ts', shows: /event\.key === '\+'/ },
  'mod+minus': { file: 'widgets/kit/zoom.ts', shows: /event\.key === '-'/ },
  'mod+0': { file: 'widgets/kit/zoom.ts', shows: /event\.key === '0'/ },
  'shift+f10': { file: 'editor/keymap.ts', shows: /'F10'/ },
}

const tables = { en: EN, nl: NL, de: DE }

describe('the keys the help names', () => {
  it('reads chords the way the help writes them', () => {
    expect(chordsIn('⇧⌘Z or ⌘Y (Ctrl+Shift+Z or Ctrl+Y)')).toEqual(['mod+shift+z', 'mod+y', 'mod+shift+z', 'mod+y'])
    expect(chordsIn('Shift+F10')).toEqual(['shift+f10'])
    expect(chordsIn('F1, or ⌘? (Ctrl+?)')).toEqual(['mod+?', 'mod+?', 'f1'])
    expect(chordsIn('?')).toEqual(['?'])
    expect(chordsIn('⌘[ (macOS) · Alt+← (Windows, Linux)')).toEqual(['mod+[', 'alt+left'])
    expect(chordsIn('⌘/Ctrl + 0 over the axis')).toEqual(['mod+0'])
    expect(chordsIn('⌘+ and ⌘− (Ctrl on Windows and Linux)')).toEqual(['mod+plus', 'mod+minus'])
    expect(chordsIn('Space to lift, ⇧ + arrows to resize; ⇧-press')).toEqual([])
  })

  it.each(Object.keys(tables) as (keyof typeof tables)[])('in %s are all answered', (language) => {
    const unanswered: string[] = []
    for (const [id, said] of Object.entries(tables[language].sections)) {
      const keys = said[5]
      if (!keys) continue
      for (const one of chordsIn(keys)) {
        if (ANSWERED.has(one)) continue
        const local = LOCAL[one]
        if (local && local.shows.test(read(local.file))) continue
        unanswered.push(`${id}: ${one}`)
      }
    }
    expect(unanswered).toEqual([])
  })

  it('every key the frame lists is one the help says', () => {
    const said = Object.values(EN.sections).flatMap((one) => (one[5] ? chordsIn(one[5]) : []))
    for (const [, keys] of FRAME_KEYS(true)) for (const one of chordsIn(keys)) expect(said, one).toContain(one)
  })
})
