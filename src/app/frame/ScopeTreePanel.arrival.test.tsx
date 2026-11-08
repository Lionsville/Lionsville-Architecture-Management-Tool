// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

/**
 * Arriving by an address, the place is known before the listing: the way down
 * to it opens once the tree holds it, not only when the place moves.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { translator } from '../../i18n/strings'
import type { ScopeSummary } from '../../projects/scope'
import { holdingsOf } from '../organisation/holdings'
import { useScopeFolds } from '../organisation/useScopeFolds'
import { renderShell } from '../testing/renderShell'
import { ScopeTreePanel } from './ScopeTreePanel'

afterEach(() => cleanup())

const s = translator('en')
const node = (path: string, children: ScopeSummary[] = []): ScopeSummary => ({ path, name: path || 'Org', diagrams: 0, children })
const NOT_LISTED = node('')
const LISTED = node('', [node('a', [node('a/b', [node('a/b/c')])]), node('d')])

function Tree({ tree }: { tree: ScopeSummary }) {
  const folds = useScopeFolds(tree)
  return (
    <ScopeTreePanel
      tree={tree} at="a/b/c" order="name" onOrderChange={() => {}} folds={folds} holdings={holdingsOf(tree, [])}
      onHome={() => {}} go={() => {}} writable={() => false} today="2026-11-08" language="en" s={s}
      onSettings={() => {}} onMove={() => {}} onDelete={() => {}} onNewScopeUnder={() => {}} newViewItems={() => []}
    />
  )
}

describe('the tree arrived at by an address', () => {
  it('opens the way down to the place once the listing holds it', () => {
    const view = renderShell(<Tree tree={NOT_LISTED} />)
    view.rerender(<Tree tree={LISTED} />)
    expect(screen.getByTestId('scope-a/b/c').getAttribute('aria-current')).toBe('page')
  })
})
