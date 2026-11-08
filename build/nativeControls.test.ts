// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A control on a screen is the kit's. The browser's select and date field open
 * the system's own list and calendar, in the system's colours and its light or
 * dark rather than the app's; MUI's switch wears MUI's blue; MUI's text field
 * puts its label in a notch of the outline where every other field has it above;
 * and MUI's Autocomplete stands taller than the kit's fields, with a filled ▼.
 * Each was one line to write and looked right on the machine it was written on.
 *
 * So a screen takes the kit's `Select`, `DateInput` or `DateField`, `Switch`, and
 * `FieldBox` where it needs what only MUI's text field does, and `AutocompleteBox`
 * for a list under a field. The kit's own files
 * are where those are built from, and `ALLOWED` names each with why. A file kept
 * out says why, and the list may only get shorter.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = fileURLToPath(new URL('../src', import.meta.url))

const RULES = {
  nativeSelect: /<select\b/,
  nativeDate: /\btype=(?:"date"|\{\s*'date'\s*\})|\btype:\s*'date'/,
  muiSwitch: /^import (?!type\b)[^\n]*from '@mui\/material\/Switch'|^import (?!type\b)\{[^}]*\bSwitch\b[^}]*\} from '@mui\/material'/m,
  muiTextField: /^import (?!type\b)[^\n]*from '@mui\/material\/TextField'|^import (?!type\b)\{[^}]*\bTextField\b[^}]*\} from '@mui\/material'/m,
  muiAutocomplete: /^import (?!type\b)[^\n]*from '@mui\/material\/Autocomplete'|^import (?!type\b)\{[^}]*\bAutocomplete\b[^}]*\} from '@mui\/material'/m,
} as const
type Rule = keyof typeof RULES

/** Where a rule does not hold, and why. */
const ALLOWED: Record<string, readonly Rule[]> = {
  // The one place MUI's text field is worn, with the kit's label above it, and
  // MUI's Autocomplete at the kit's size with the kit's chevron.
  'widgets/kit/FieldBox.tsx': ['muiTextField', 'muiAutocomplete'],
  // The help is its own page with its own budget (`HELP_BUDGET`): the kit's list
  // would bring MUI's popover into it for one choice of three languages.
  'help/ui/HelpApp.tsx': ['nativeSelect'],
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'testing' ? [] : sources(path)
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec|contract)\./.test(entry.name) ? [path] : []
  })
}

export function brokenRules(text: string): Rule[] {
  return (Object.keys(RULES) as Rule[]).filter((rule) => RULES[rule].test(text))
}

describe('native controls', () => {
  it('has no browser select or date field, MUI switch, text field or Autocomplete outside the kit', () => {
    const found = sources(src).flatMap((path) => {
      const file = relative(src, path)
      const allowed = ALLOWED[file] ?? []
      return brokenRules(readFileSync(path, 'utf8')).filter((rule) => !allowed.includes(rule)).map((rule) => `${file}: ${rule}`)
    })
    expect(found).toEqual([])
  })

  it('keeps no exception that is no longer needed', () => {
    const stale = Object.entries(ALLOWED).flatMap(([file, rules]) => {
      const broken = brokenRules(readFileSync(join(src, file), 'utf8'))
      return rules.filter((rule) => !broken.includes(rule)).map((rule) => `${file}: ${rule}`)
    })
    expect(stale).toEqual([])
  })

  it('reads each of them, and not their look-alikes', () => {
    expect(brokenRules('<select value={x}>')).toEqual(['nativeSelect'])
    expect(brokenRules('<input type="date" />')).toEqual(['nativeDate'])
    expect(brokenRules("inputProps={{ type: 'date' }}")).toEqual(['nativeDate'])
    expect(brokenRules("import Switch from '@mui/material/Switch'")).toEqual(['muiSwitch'])
    expect(brokenRules("import { Box, TextField } from '@mui/material'")).toEqual(['muiTextField'])
    expect(brokenRules("import TextField from '@mui/material/TextField'")).toEqual(['muiTextField'])
    expect(brokenRules("import type { TextFieldProps } from '@mui/material/TextField'")).toEqual([])
    expect(brokenRules("import Autocomplete from '@mui/material/Autocomplete'")).toEqual(['muiAutocomplete'])
    expect(brokenRules("import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'")).toEqual(['muiAutocomplete'])
    expect(brokenRules("import { Autocomplete, Box } from '@mui/material'")).toEqual(['muiAutocomplete'])
    expect(brokenRules("import type { AutocompleteProps } from '@mui/material/Autocomplete'")).toEqual([])
    expect(brokenRules("import { AutocompleteBox } from './kit/FieldBox'")).toEqual([])
    expect(brokenRules("import { Switch } from './kit/Switch'")).toEqual([])
    expect(brokenRules('<Selected /> selection')).toEqual([])
    expect(brokenRules("type: 'datetime'")).toEqual([])
  })
})
