// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { GitRefused } from '../../src/platform/node/gitGuard'
import { sayable } from './sayable'

describe('what a failure in main says to the page', () => {
  it('passes a key through as it is', () => {
    const said: string[] = []
    expect(sayable('git:tag', new Error('shell.pathRefused'), (one) => said.push(one)).message).toBe('shell.pathRefused')
    expect(said).toEqual([])
  })

  it('says anything else by its code on the trail, and crosses as a sentence of ours with no path in it', () => {
    const said: string[] = []
    const failure = Object.assign(new Error('fatal: not a git repository: /Users/someone/work/.git'), { code: 128 })
    const crossed = sayable('git:log', failure, (one) => said.push(one))
    expect(crossed.message).toBe('shell.historyFailed')
    expect(said).toEqual(['git:log failed: 128'])
    expect(sayable('files:move', Object.assign(new Error('EXDEV: /Users/someone'), { code: 'EXDEV' }), () => {}).message).toBe('shell.folderUnavailable')
    expect(sayable('git:changes', 'not an error', (one) => said.push(one)).message).toBe('shell.historyFailed')
    expect(said.at(-1)).toBe('git:changes failed: unknown')
  })

  it('crosses a git refused in the folder with its own words, which name the setting, and a keyed one as its key', () => {
    const said: string[] = []
    const refused = new GitRefused('its configuration sets http.cookiefile, which this app does not run git with')
    expect(sayable('git:commitPaths', refused, (one) => said.push(one)).message)
      .toBe('shell.gitRefused: its configuration sets http.cookiefile, which this app does not run git with')
    expect(sayable('git:tag', GitRefused.keyed('shell.gitTooOld'), (one) => said.push(one)).message).toBe('shell.gitTooOld')
    expect(said).toEqual([])
  })
})
