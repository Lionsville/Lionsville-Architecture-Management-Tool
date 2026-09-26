// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { consoleText, isReactComplaint } from './reactComplaints'

describe('what counts as React complaining', () => {
  it('fills the sentence the way the console would', () => {
    expect(consoleText(['Encountered two children with the same key, `%s`. Keys should be unique.', 'e2']))
      .toBe('Encountered two children with the same key, `e2`. Keys should be unique.')
    expect(consoleText(['%o\n\n%s', new Error('boom'), 'The above error occurred in the <Pane> component.']))
      .toBe('Error: boom\n\nThe above error occurred in the <Pane> component.')
  })

  it('holds keys, act(), DOM props and a caught error to account', () => {
    for (const said of [
      'Each child in a list should have a unique "key" prop. Check the render method of `List`.',
      'Encountered two children with the same key, `e2`.',
      'An update to Board inside a test was not wrapped in act(...).',
      'React does not recognize the `isOpen` prop on a DOM element.',
      'Invalid DOM property `class`. Did you mean `className`?',
      'Received `true` for a non-boolean attribute `dense`.',
      'Unknown event handler property `onHover`.',
      'In HTML, <div> cannot be a descendant of <p>.',
      'Error: boom\n\nThe above error occurred in the <ZoomPane> component.',
    ]) expect(isReactComplaint(said), said).toBe(true)
  })

  // Flipped: these were let through as a library's advice until the suite was
  // cleared of them, and a new one is now a regression.
  it("holds MUI's and Emotion's warnings and an invalid style to account", () => {
    for (const said of [
      'The pseudo class ":first-child" is potentially unsafe when doing server-side rendering. Try changing it to ":first-of-type".',
      'The pseudo class ":nth-child" is potentially unsafe when doing server-side rendering. Try changing it to ":nth-of-type".',
      'MUI: The `value` provided to the Tabs component is invalid.\nNone of the Tabs\' children match with "tl".',
      'MUI: You have provided an out-of-range value `acme` for the select component.\nThe available values are ``.',
      '`NaN` is an invalid value for the `left` css style property.',
    ]) expect(isReactComplaint(said), said).toBe(true)
  })

  it("leaves the app's own lines alone, and MUI mentioned anywhere but first", () => {
    for (const said of [
      '[lvarch] ERROR save: the folder is gone',
      '[lvarch] ERROR render: MUI: said something',
    ]) expect(isReactComplaint(said), said).toBe(false)
  })
})
