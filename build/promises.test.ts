// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The promise rules in `eslint.config.js`, asked about code that breaks them.
 *
 * They need the types, and a config that lost its parser options would not
 * fail: the rules would stop running and every file would lint clean. So the
 * linter is handed a promise nobody waits for, in the renderer's program and
 * in main's, and asked what it thinks.
 */
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const eslint = new ESLint({ cwd: root })

const HEADER = '// SPDX-License-Identifier: AGPL-3.0-only\n// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV\n\n'

/** The rules that fired on `source`, were it the text of the file at `path`. */
async function firedAt(path: string, source: string): Promise<string[]> {
  const [result] = await eslint.lintText(`${HEADER}${source}`, { filePath: path })
  return result.messages.map((message) => message.ruleId ?? message.message)
}

const FLOATING = 'async function later(): Promise<void> {}\nexport function now(): void { later() }\n'

// A program is built for the first file asked about, which on a machine
// running the rest of the suite beside it is seconds rather than milliseconds.
describe('a promise, checked with the types', { timeout: 60_000 }, () => {
  it('fails one nobody awaits or catches, in the renderer and in main', async () => {
    expect(await firedAt('src/platform/errors.ts', FLOATING)).toContain('@typescript-eslint/no-floating-promises')
    expect(await firedAt('electron/main/log.ts', FLOATING)).toContain('@typescript-eslint/no-floating-promises')
  })

  it('passes one left running on purpose, said with `void`', async () => {
    const said = 'async function later(): Promise<void> {}\nexport function now(): void { void later().catch(() => {}) }\n'
    expect(await firedAt('src/platform/errors.ts', said)).toEqual([])
  })

  it('fails an async handler where nothing will wait for it', async () => {
    const handler = "export function arm(target: EventTarget): void { target.addEventListener('blur', async () => {}) }\n"
    expect(await firedAt('src/platform/errors.ts', handler)).toContain('@typescript-eslint/no-misused-promises')
  })

  it('fails an await of something that is not a promise', async () => {
    const plain = 'export async function one(): Promise<number> { return await 1 }\n'
    expect(await firedAt('src/platform/errors.ts', plain)).toContain('@typescript-eslint/await-thenable')
  })
})
