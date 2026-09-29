// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { ShellError } from '../../platform/errors'
import { crossedFromMain } from './crossedFromMain'

describe('a failure from the desktop’s main process', () => {
  const wrapped = (said: string) => new Error(`Error invoking remote method 'git:commitPaths': Error: ${said}`)

  it('is the key main said, out of the channel’s wrapping of it', () => {
    const crossed = crossedFromMain(wrapped('shell.gitMissing'))
    expect(crossed).toBeInstanceOf(ShellError)
    expect((crossed as ShellError).key).toBe('shell.gitMissing')
    expect((crossed as ShellError).params).toBeUndefined()
  })

  it('carries a git refused in the folder with its own words as the reason', () => {
    const crossed = crossedFromMain(wrapped('shell.gitRefused: its configuration sets http.cookiefile, which this app does not run git with'))
    expect((crossed as ShellError).key).toBe('shell.gitRefused')
    expect((crossed as ShellError).params).toEqual({ reason: 'its configuration sets http.cookiefile, which this app does not run git with' })
  })

  it('hands anything without a key back as it came', () => {
    const other = new Error('Error invoking remote method \'git:log\': Error: something else')
    expect(crossedFromMain(other)).toBe(other)
    expect(crossedFromMain('not an error')).toBe('not an error')
  })
})
