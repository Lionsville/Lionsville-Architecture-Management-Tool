// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import {
  appliedStepsText, pictureStampsText, readAppliedSteps, readPictureStamps, readScopePlaces, scopePlacesText,
} from './appliedSteps'

describe('applied step ids, kept by the app', () => {
  it('answers nothing for a folder nobody wrote steps for, and one folder’s steps back', () => {
    expect(readAppliedSteps(undefined, '/work/acme')).toBeUndefined()
    const text = appliedStepsText(undefined, '/work/acme', { 'step-1': ['scope-1', 1000] })
    expect(readAppliedSteps(text, '/work/acme')).toEqual({ 'step-1': ['scope-1', 1000] })
    expect(readAppliedSteps(text, '/work/globex')).toBeUndefined()
  })

  it('carries every other folder through, and lets a row that says no step go', () => {
    const one = appliedStepsText(undefined, '/work/acme', { a: ['s', 1] })
    const two = appliedStepsText(one, '/work/globex', { b: ['t', 2], c: ['bad'] as unknown as [string, number] })
    expect(readAppliedSteps(two, '/work/acme')).toEqual({ a: ['s', 1] })
    expect(readAppliedSteps(two, '/work/globex')).toEqual({ b: ['t', 2] })
    expect(readAppliedSteps('{ not json', '/work/acme')).toBeUndefined()
    const pending = appliedStepsText(undefined, '/work/acme', { a: ['s', 1, 'expected'] })
    expect(readAppliedSteps(pending, '/work/acme')).toEqual({ a: ['s', 1, 'expected'] })
  })

  it('keeps where each folder’s scopes were found beside the steps, neither writing over the other', () => {
    const steps = appliedStepsText(undefined, '/work/acme', { a: ['s', 1] })
    const both = scopePlacesText(steps, '/work/acme', { 's-1': 'acme', bad: 1 as unknown as string })
    expect(readScopePlaces(both, '/work/acme')).toEqual({ 's-1': 'acme' })
    expect(readAppliedSteps(both, '/work/acme')).toEqual({ a: ['s', 1] })
    expect(readScopePlaces(both, '/work/globex')).toBeUndefined()
    expect(readAppliedSteps(appliedStepsText(both, '/work/acme', {}), '/work/acme')).toEqual({})
    expect(readScopePlaces(appliedStepsText(both, '/work/acme', {}), '/work/acme')).toEqual({ 's-1': 'acme' })
  })

  it('keeps what was found of each folder’s pictures beside the rest, and lets a row that says nothing go', () => {
    const found = { size: 3, lastModified: 5, inode: 7, contentAddress: 'sha256:ab', width: 1, height: 2 }
    const text = pictureStampsText(appliedStepsText(undefined, '/work/acme', { a: ['s', 1] }), '/work/acme', {
      'acme\u0000map.png': found, broken: { size: 'x' } as never,
    })
    expect(readPictureStamps(text, '/work/acme')).toEqual({ 'acme\u0000map.png': found })
    expect(readAppliedSteps(text, '/work/acme')).toEqual({ a: ['s', 1] })
    expect(readPictureStamps(text, '/work/globex')).toBeUndefined()
  })
})
