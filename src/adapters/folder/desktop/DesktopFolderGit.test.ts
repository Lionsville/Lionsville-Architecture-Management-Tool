// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The folder's history over the desktop's channel says a failure as the
 * refusal main sent, not as the channel's wrapping of it: a git refused in
 * the folder reaches the page with the setting named.
 */
import { describe, expect, it } from 'vitest'
import { translator } from '../../../i18n'
import { ShellError } from '../../../platform/errors'
import type { DesktopHistory } from '../../desktop/channel'
import { DesktopFolderGit } from './DesktopFolderGit'

/** The refusal as a person reads it: its key in words, with what it carries. */
const words = (refusal: unknown): string => translator('en')((refusal as ShellError).key, (refusal as ShellError).params)

const REFUSED = 'its configuration sets http.cookiefile, which this app does not run git with; remove it, or use git yourself in this folder'

function refusing(said: string): DesktopHistory {
  const fail = () => Promise.reject(new Error(`Error invoking remote method 'git:commitPaths': Error: ${said}`))
  return { commitPaths: fail, tag: fail, startHistory: fail } as unknown as DesktopHistory
}

describe('the folder’s history on the desktop, refused', () => {
  it('says a snapshot git was not run for with the setting named', async () => {
    const git = new DesktopFolderGit(refusing(`shell.gitRefused: ${REFUSED}`), '/work')
    const refusal = await git.commit(['model.json'], 'Monday').then(() => undefined, (cause: unknown) => cause)
    expect(refusal).toBeInstanceOf(ShellError)
    expect(words(refusal)).toBe(`git was not run in this folder: ${REFUSED}`)
  })

  it('says a label git was not run for the same way', async () => {
    const git = new DesktopFolderGit(refusing(`shell.gitRefused: ${REFUSED}`), '/work')
    const refusal = await git.tag('abc', 'shown', 'Shown').then(() => undefined, (cause: unknown) => cause)
    expect((refusal as ShellError).key).toBe('shell.gitRefused')
  })

  it('says a key main sent as that key', async () => {
    const git = new DesktopFolderGit(refusing('shell.gitTooOld'), '/work')
    const refusal = await git.start().then(() => undefined, (cause: unknown) => cause)
    expect(words(refusal)).toContain('git 2.26 or newer')
  })
})
