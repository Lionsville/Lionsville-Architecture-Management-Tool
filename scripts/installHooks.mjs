#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Install the hooks this checkout is entitled to, as part of `npm run setup`.
 *
 * There is exactly one, and it is conditional: `scripts/hooks/pre-push` reads
 * a list of words that must not be published, and that list lives outside this
 * public tree. A clone that does not sit beside one gets no hook, says nothing
 * about it, and loses nothing — see scripts/hooks/pre-push.
 *
 * Never fails a setup. A missing hook is a checkout without the list; a hook
 * that could not be written is worth one line on the way past, not a broken
 * install of everything else.
 */
import { execFileSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const list = resolve(root, '..', 'docs', 'boundary', 'words.txt')
if (!existsSync(list)) process.exit(0)

try {
  // `git rev-parse` rather than `.git/hooks`: in a worktree and in a submodule
  // `.git` is a file pointing elsewhere, and both are how this tree is used.
  const hooks = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], {
    cwd: root,
    encoding: 'utf8',
  }).trim()
  const target = resolve(root, hooks)
  mkdirSync(target, { recursive: true })
  copyFileSync(join(here, 'hooks', 'pre-push'), join(target, 'pre-push'))
  chmodSync(join(target, 'pre-push'), 0o755)
  console.log('setup: pre-push hook installed.')
} catch (error) {
  console.warn(`setup: could not install the pre-push hook (${error.message}).`)
}
