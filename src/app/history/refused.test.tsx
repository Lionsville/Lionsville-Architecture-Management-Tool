// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

/**
 * A snapshot refused by the guard over a folder's git configuration says why
 * on screen, with the setting named, as a sync's refusal does — not that the
 * history could not be read or written.
 */
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { translator } from '../../i18n'
import { ShellError } from '../../platform/errors'
import type { ScopeSnapshot } from '../../projects/scope'
import { heldRepositories } from '../testing/heldRepositories'
import { fakeHistory } from '../testing/fakeHistory'
import { useProjectHistory } from './useProjectHistory'

const s = translator('en')
const project = (): ScopeSnapshot => ({
  path: 'acme', model: { name: 'Acme', elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [],
})
const REFUSED = 'its configuration sets http.cookiefile, which this app does not run git with; remove it, or use git yourself in this folder'

describe('a snapshot git was not run for', () => {
  it('says the refusal’s own words, which name the setting', async () => {
    const notify = vi.fn()
    const scopes = heldRepositories([project()])
    const history = fakeHistory(scopes.scopes, [], new ShellError('shell.gitRefused', { reason: REFUSED }))
    const { result } = renderHook(() => useProjectHistory({
      history, scopes: scopes.scopes, project, steps: () => [], save: () => Promise.resolve(), indexed: () => ({}) as never,
      dispatch: () => undefined, notify, s,
    }))
    act(() => { result.current.take('Monday') })
    await waitFor(() => expect(notify).toHaveBeenCalledWith(
      `The snapshot could not be taken: git was not run in this folder: ${REFUSED}`, 'error',
    ))
  })
})
