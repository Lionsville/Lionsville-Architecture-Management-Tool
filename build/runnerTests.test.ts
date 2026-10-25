// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The files the runner leaves out (`runnerTests.ts`) are files that are there:
 * a renamed one would otherwise run on the runner again unasked, and a removed
 * one would be a line nobody can read.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LOCAL_ONLY } from './runnerTests'

const root = fileURLToPath(new URL('..', import.meta.url))

describe('the tests the runner leaves out', () => {
  it('are files that are there, each once, in order', () => {
    expect(LOCAL_ONLY.filter((path) => !existsSync(`${root}${path}`))).toEqual([])
    expect([...new Set(LOCAL_ONLY)].sort()).toEqual(LOCAL_ONLY)
  })
})
