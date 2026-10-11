// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The roadmap opened for the first time, with none of its scripts fetched
 * before — as in a window that never opened it, not as in every other suite,
 * whose setup has every part before its first test (`testing/lazyParts.ts`).
 * So nothing of the app is imported at the top of this file: what the test
 * imports, it imports inside the test, after that setup has run, and the
 * parts it makes are new.
 *
 * A plan named in *What is the plan called?* opens its page as the name's
 * dialog closes. The page must be up in that same moment, holding the focus,
 * as when it came in the first download: a page arriving a moment later left
 * the focus on *New plan* meanwhile, where the browser's press of the same
 * Enter opened the dialog again behind the plan — and a guide waiting for the
 * last step's dialog to close before its recap waited for ever.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, configure, fireEvent, screen, waitFor } from '@testing-library/react'

configure({ asyncUtilTimeout: 5_000 })
afterEach(() => cleanup())

describe('a plan made on a roadmap opened for the first time', { timeout: 20_000 }, () => {
  it('is up, holding the focus, in the same moment as the Enter that named it', async () => {
    const { heldRepositories } = await import('./testing/heldRepositories')
    const { installReactFlowMocks } = await import('../editor/reactFlowTestSetup')
    const { EXAMPLES, exampleScopes } = await import('./testing/examples')
    const { renderApp } = await import('./testing/renderShell')
    const { controlSelector } = await import('../platform/controlNames')
    installReactFlowMocks()
    const top = EXAMPLES[0].path
    const example = exampleScopes(EXAMPLES[0]).map((scope) => ({
      ...scope, path: scope.path === top ? '' : scope.path.slice(top.length + 1),
    }))
    renderApp({ repositories: heldRepositories(example) })

    fireEvent.click(await screen.findByTestId('open-roadmap'))
    // Not here at the press: its script is on the way, which is what this file is about.
    expect(document.querySelector(controlSelector('roadmap.newPlan'))).toBeNull()
    await waitFor(() => expect(document.querySelector(controlSelector('roadmap.newPlan'))).not.toBeNull())

    const newPlan = document.querySelector<HTMLElement>(controlSelector('roadmap.newPlan'))!
    fireEvent.click(newPlan)
    const name = screen.getByRole('textbox', { name: 'What is the plan called?' })
    fireEvent.change(name, { target: { value: 'Bring dock booking into the yard system' } })
    fireEvent.keyDown(name, { key: 'Enter' })

    // No waiting: the plan's page is drawn by the press itself, and has the focus the dialog gave back.
    const page = screen.getByTestId('plan-topbar').closest<HTMLElement>('[role="dialog"]')!
    expect(page.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(newPlan)
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'What is the plan called?' })).toBeNull())
  })
})
