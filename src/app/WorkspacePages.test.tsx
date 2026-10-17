// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * *Replace…* on an application's record, through the workspace: the dialog
 * is a part of its own now (`widgets/lazyPart`), wanted only while there is a
 * subject, and the press on the record still opens it for that application.
 * The decisions page and the roadmap are reached the same way from the bar,
 * and `App.accessibility.test.tsx` walks those; this is the one of the four
 * nothing else opens through the app.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { heldRepositories } from './testing/heldRepositories'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'
import { controlSelector } from '../platform/controlNames'
import { EXAMPLES, exampleScopes } from './testing/examples'
import { renderApp } from './testing/renderShell'
import { axeFindings } from './testing/axe'

configure({ asyncUtilTimeout: 5_000 })
beforeAll(() => installReactFlowMocks())
afterEach(() => cleanup())

const top = EXAMPLES[0].path
const example = exampleScopes(EXAMPLES[0]).map((scope) => ({
  ...scope, path: scope.path === top ? '' : scope.path.slice(top.length + 1),
}))
const landscape = example.find((scope) => scope.model.diagrams.some((diagram) => diagram.kind === 'layer7'))!
const billing = landscape.model.elements.find((element) => element.id === 'billing')!

/** The landscape open, and an application's own page: Enter on its card, and Enter again. */
async function recordOf(id: string) {
  renderApp({ repositories: heldRepositories(example), boot: { initialProject: landscape } })
  await waitFor(() => expect(document.querySelectorAll('.react-flow__node').length).toBeGreaterThan(0))
  const card = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)!
  card.focus()
  fireEvent.keyDown(card, { key: 'Enter' })
  fireEvent.keyDown(card, { key: 'Enter' })
  await screen.findByTestId('element-record')
}

describe('Replace…, from the workspace', { timeout: 40_000 }, () => {
  it('opens the replacement for the application whose record it is on, and Cancel closes it', async () => {
    await recordOf('billing')
    expect(screen.queryByText(`Replace ${billing.name}`)).toBeNull()
    await waitFor(() => expect(document.querySelector(controlSelector('record.replace'))).not.toBeNull())
    fireEvent.click(document.querySelector<HTMLElement>(controlSelector('record.replace'))!)
    const dialog = (await screen.findByText(`Replace ${billing.name}`)).closest<HTMLElement>('[role="dialog"]')!
    // Its first question starts from the application it is about.
    expect(within(dialog).getByRole<HTMLInputElement>('textbox', { name: 'Name' }).value).toBe(`${billing.name} (new)`)
    expect(await axeFindings()).toEqual([])
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByText(`Replace ${billing.name}`)).toBeNull())
  })
})
