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

  it("leaves a library's advice and the app's own lines alone", () => {
    for (const said of [
      'The pseudo class ":first-child" is potentially unsafe when doing server-side rendering.',
      'MUI: The `value` provided to the Tabs component is invalid.',
      '[lvarch] ERROR save: the folder is gone',
    ]) expect(isReactComplaint(said), said).toBe(false)
  })
})
