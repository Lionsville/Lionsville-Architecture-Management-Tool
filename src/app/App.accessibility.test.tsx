// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The whole app, checked by axe on the screens a person meets first: the
 * organisation's home, a landscape open in the editor with its palette and
 * inspector, the overflow menu, and the dialogs the menu opens. The shipped
 * example is the landscape, because it is the one with every zone, groups,
 * aspects, a system on its way out and a container view — the most of the
 * editor one fixture puts on screen.
 *
 * What axe checks is WCAG 2.1 A and AA as far as a machine can tell
 * (`testing/axe.ts`); the keyboard half is `App.keyboard.test.tsx`.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { act, cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { HostCommand } from '../platform/hostCommands'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'
import { EXAMPLES, exampleScopes } from './examples'
import { renderApp } from './testing/renderShell'
import { axeFindings } from './testing/axe'

// The whole app over the whole example, under coverage beside every other
// file: a board takes longer than a component to measure and draw.
configure({ asyncUtilTimeout: 5_000 })
beforeAll(() => installReactFlowMocks())
afterEach(() => cleanup())

// The example as the organisation itself, the way copying it into an empty
// root files it: its top scope at the root, the rest beneath.
const top = EXAMPLES[0].path
const example = exampleScopes(EXAMPLES[0]).map((scope) => ({
  ...scope, path: scope.path === top ? '' : scope.path.slice(top.length + 1),
}))
const landscape = example.find((scope) => scope.model.diagrams.some((diagram) => diagram.kind === 'layer7'))!

/** The app over the example, with the command stream a menu bar would send. */
function show(opened: boolean) {
  const listeners: ((command: HostCommand) => void)[] = []
  const rendered = renderApp({
    scopes: new InMemoryScopeStore(example),
    boot: { initialProject: opened ? landscape : undefined },
    host: {
      commands: (listener) => {
        listeners.push(listener)
        return () => { listeners.splice(listeners.indexOf(listener), 1) }
      },
    },
  })
  const send = (command: HostCommand) => act(() => { for (const one of [...listeners]) one(command) })
  return { ...rendered, send }
}

describe('the app, as axe reads it', { timeout: 20_000 }, () => {
  it('finds nothing on the organisation’s home', async () => {
    show(false)
    await screen.findByTestId('organisation-name')
    expect(await axeFindings()).toEqual([])
  })

  // Every page the organisation's cards open, over the whole example tree:
  // the register and the technology register, the sheet and the map, the
  // decisions, the observations and the roadmap.
  // The sheet and the map are views, drawn in their tab over the editor
  // rather than in a page of their own.
  it.each<[string, () => Promise<HTMLElement>]>([
    ['open-register', () => screen.findByTestId('register-table')],
    ['open-technology', () => screen.findByTestId('technology-register-table')],
    ['open-business', () => screen.findByRole('tab', { name: /Business architecture/, selected: true })],
    ['open-map', () => screen.findByRole('tab', { name: /Enterprise map/, selected: true })],
    ['open-decisions', () => screen.findByRole('dialog')],
    ['open-observations', () => screen.findByRole('dialog')],
    ['open-roadmap', () => screen.findByRole('dialog')],
  ])('finds nothing on the page %s opens', async (card, drawn) => {
    show(false)
    fireEvent.click(await screen.findByTestId(card))
    await drawn()
    expect(await axeFindings()).toEqual([])
  })

  it('finds nothing on a landscape open in the editor: the bar, the tabs, the palette and the board', async () => {
    show(true)
    await screen.findByRole('tab', { name: /Application landscape/ })
    await waitFor(() => expect(document.querySelectorAll('.react-flow__node').length).toBeGreaterThan(0))
    expect(await axeFindings()).toEqual([])
  })

  it('finds nothing with an element in the inspector', async () => {
    show(true)
    await waitFor(() => expect(document.querySelectorAll('.react-flow__node').length).toBeGreaterThan(0))
    const node = document.querySelector<HTMLElement>('.react-flow__node')!
    node.focus()
    fireEvent.keyDown(node, { key: 'Enter' })
    // The record of what was chosen: its name is a field to edit.
    await screen.findByRole('textbox', { name: 'Name' })
    expect(await axeFindings()).toEqual([])
  })

  it('finds nothing in the overflow menu', async () => {
    show(true)
    fireEvent.click(await screen.findByRole('button', { name: /More/ }))
    await screen.findByRole('menu')
    expect(await axeFindings()).toEqual([])
  })

  it.each<[string, HostCommand]>([
    ['preferences', { type: 'preferences' }],
    ['connect an agent', { type: 'connectAgent' }],
    ['the shortcuts', { type: 'shortcuts' }],
  ])('finds nothing in the %s dialog', async (_name, command) => {
    const { send } = show(true)
    await screen.findByRole('tab', { name: /Application landscape/ })
    send(command)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getAllByRole('button').length).toBeGreaterThan(0)
    expect(await axeFindings()).toEqual([])
  })
})
