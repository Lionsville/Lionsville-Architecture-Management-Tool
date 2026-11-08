// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every dialog ends in the kit's one footer (`DialogFooter`): what else can be
 * done with its subject at the start, then a quiet Cancel, another answer, and
 * the outcome last, the one primary or a danger. Before it, Connect an agent ended in
 * a teal text Close, New scope in a text Cancel and a filled Create, New view in
 * an outlined Cancel: each dialog had laid out its own row of buttons.
 *
 * The kit's `Dialog` takes its answers as `DialogAnswers`, so a row of buttons
 * cannot be handed to it; the compiler holds that. What is held here is the rest:
 * MUI's `DialogActions` is used nowhere, the footer's row is drawn only by the
 * footer, and a dialog with a frame of its own either ends in the footer or is
 * named below with why it has no answers to give.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = fileURLToPath(new URL('../src', import.meta.url))

/** A dialog drawn by other means than the kit's `Dialog`, with no answers at its foot, and why. */
const NO_ANSWERS: Record<string, string> = {
  'widgets/PageDialog.tsx': 'a page over the work, closed by its own ×; not a question',
  'widgets/Arriving.tsx': 'says the app is on its way; nothing to answer',
  'widgets/CompactForms.tsx': 'the frame FieldsDialog lends; its users end in the footer',
  'search/ui/GlobalSearchDialog.tsx': 'the palette: a pick is the answer, Escape is no',
  'search/ui/ElementSearchDialog.tsx': 'a picker: a pick is the answer, Escape is no',
  'editor/InsideChoice.tsx': 'a choice answered by pressing one of its rows',
  'documentation/ui/Pictures.tsx': 'a picture shown large, closed by Escape or a press',
  'operating/ui/LibraryDialog.tsx': 'a library to browse, closed by its own ×',
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'testing' ? [] : sources(path)
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec|contract)\./.test(entry.name) ? [path] : []
  })
}

const every = sources(src).map((path) => ({ file: relative(src, path), text: readFileSync(path, 'utf8') }))
const inKit = (file: string) => file.startsWith('widgets/kit/')

describe('one dialog footer', () => {
  it('uses MUI\'s DialogActions nowhere', () => {
    const found = every.filter(({ text }) => /from '@mui\/material\/DialogActions'|import \{[^}]*\bDialogActions\b[^}]*\} from '@mui\/material'/.test(text))
    expect(found.map(({ file }) => file)).toEqual([])
  })

  it('draws the footer\'s row only in the footer', () => {
    const found = every.filter(({ file, text }) => file !== 'widgets/kit/Dialog.tsx' && /kit-dialog__(actions|start)\b/.test(text))
    expect(found.map(({ file }) => file)).toEqual([])
  })

  it('ends every dialog with a frame of its own in the footer, or says why it has no answers', () => {
    const framed = every.filter(({ file, text }) => !inKit(file) && /from '@mui\/material\/Dialog'|\bFieldsDialog\b/.test(text))
    const bare = framed.filter(({ file, text }) => !/<DialogFooter\b/.test(text) && NO_ANSWERS[file] === undefined)
    expect(bare.map(({ file }) => file)).toEqual([])
    // A file named here that has since grown a footer, or gone, leaves the list.
    const stale = Object.keys(NO_ANSWERS).filter((file) => !framed.some((one) => one.file === file && !/<DialogFooter\b/.test(one.text)))
    expect(stale).toEqual([])
  })
})
