// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The size of a unit, as `eslint.config.js` holds it: 25 for a function's
 * complexity, 150 lines for its length, and the files already over either
 * listed at their own measure.
 *
 * The list is a ratchet only if it is kept honest, and the linter alone would
 * keep it half-honest: it fails a unit that grows past its entry, and says
 * nothing about one that shrank below it — so the room left over would be
 * room to grow back into. Here each listed file is measured, and its entry has
 * to be exactly what it measures, and over the line, or the test says which
 * number to write instead.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

type Grown = { complexity?: number; lines?: number }
const config = await import(new URL('../eslint.config.js', import.meta.url).href) as {
  GROWN: Record<string, Grown>; MOST_COMPLEX: number; LONGEST_FUNCTION: number
}
const { GROWN, MOST_COMPLEX, LONGEST_FUNCTION } = config

const HEADER = '// SPDX-License-Identifier: AGPL-3.0-only\n// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV\n\n'

/** Without the types, which neither rule reads, so a file measures in milliseconds. */
const untyped = {
  languageOptions: { parserOptions: { projectService: false, project: null } },
  rules: {
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/no-misused-promises': 'off',
    '@typescript-eslint/await-thenable': 'off',
  },
} as const

/** Every function reported, so the largest of each measure can be read off the messages. */
const measuring = new ESLint({
  cwd: root,
  overrideConfig: {
    ...untyped,
    rules: {
      ...untyped.rules,
      complexity: ['error', 0],
      'max-lines-per-function': ['error', { max: 0, skipBlankLines: true, skipComments: true }],
    },
  },
})

async function measure(file: string): Promise<Required<Grown>> {
  const [result] = await measuring.lintFiles([file])
  let complexity = 0
  let lines = 0
  for (const message of result.messages) {
    if (message.ruleId === 'complexity') complexity = Math.max(complexity, Number(/complexity of (\d+)/.exec(message.message)?.[1]))
    if (message.ruleId === 'max-lines-per-function') lines = Math.max(lines, Number(/\((\d+)\)/.exec(message.message)?.[1]))
  }
  return { complexity, lines }
}

describe('the size of a unit', { timeout: 60_000 }, () => {
  it('holds every listed file at exactly what it measures, and only while it is over the line', async () => {
    const wrong: string[] = []
    for (const [file, grown] of Object.entries(GROWN)) {
      if (!existsSync(`${root}/${file}`)) { wrong.push(`${file} is gone: remove its entry`); continue }
      const measured = await measure(file)
      const lines = /\.test\.|\.contract\.|\/testing\//.test(file) ? 0 : measured.lines
      const complexity = measured.complexity > MOST_COMPLEX ? measured.complexity : undefined
      const long = lines > LONGEST_FUNCTION ? lines : undefined
      if (grown.complexity !== complexity) wrong.push(`${file}: complexity ${String(grown.complexity)} listed, ${complexity === undefined ? 'within the line: drop it' : `write ${complexity}`}`)
      if (grown.lines !== long) wrong.push(`${file}: lines ${String(grown.lines)} listed, ${long === undefined ? 'within the line: drop it' : `write ${long}`}`)
    }
    expect(wrong).toEqual([])
  })

  it('fails a new function over the line in a file nobody listed', async () => {
    const eslint = new ESLint({ cwd: root, overrideConfig: untyped })
    const branches = Array.from({ length: MOST_COMPLEX }, (_, i) => `  if (n === ${i}) return ${i}\n`).join('')
    const [result] = await eslint.lintText(`${HEADER}export function pick(n: number): number {\n${branches}  return -1\n}\n`, {
      filePath: 'src/model/pick.ts',
    })
    expect(result.messages.map((message) => message.ruleId)).toContain('complexity')
  })

  it('fails a function longer than the line, and not a test as long as its cases', async () => {
    const eslint = new ESLint({ cwd: root, overrideConfig: untyped })
    const body = Array.from({ length: LONGEST_FUNCTION }, (_, i) => `  const v${i} = ${i}\n`).join('')
    const source = `${HEADER}export function long(): number {\n${body}  return v0\n}\n`
    const [code] = await eslint.lintText(source, { filePath: 'src/model/long.ts' })
    expect(code.messages.map((message) => message.ruleId)).toContain('max-lines-per-function')
    const [test] = await eslint.lintText(source, { filePath: 'src/model/long.test.ts' })
    expect(test.messages.map((message) => message.ruleId)).not.toContain('max-lines-per-function')
  })
})
