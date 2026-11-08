// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A topic relevant to a scope shows in the tree with that scope's own branch:
 * not until it is opened, and gone when it folds, whether or not the scope has
 * anything filed under it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { translateFrom } from '../../i18n/interpolate'
import type { Translate } from '../../i18n'
import type { ScopeSummary } from '../../projects/scope'
import { topicRowsOf } from '../frame/ScopeTreePanel'
import type { Holdings } from './holdings'
import { ScopeTree } from './ScopeTree'
import { useScopeFolds } from './useScopeFolds'

const scope = (path: string, name: string, over: Partial<ScopeSummary> = {}): ScopeSummary => ({ path, name, diagrams: 0, children: [], ...over })

const TREE = scope('', 'Org', {
  children: [
    scope('sales', 'Sales', { children: [scope('sales/retail', 'Retail')] }),
    scope('stock', 'Stock'),
    scope('empty', 'Empty'),
    scope('topics', 'Topics', {
      children: [
        scope('topics/security', 'Security', {
          relevantTo: [{ path: 'sales' }, { path: 'stock' }, { path: 'sales/retail' }, { path: 'empty', until: '2020-01-01' }],
          children: [scope('topics/security/keys', 'Keys', { relevantTo: [{ path: 'sales' }] })],
        }),
      ],
    }),
  ],
})

const HOLDINGS = {
  count: () => 0, all: () => ({ views: 0, observations: 0, causes: 0, solutions: 0, decisions: 0, plans: 0, principles: 0 }), withWork: new Set<string>(),
} as unknown as Holdings

const s = translateFrom({ 'org.treeTopicRow': 'Topic relevant here: {name}', 'org.expand': 'Show {name}', 'org.collapse': 'Hide {name}' }) as unknown as Translate

function Tree({ onHome, ...more }: { onHome: (path: string) => void; onlyWork?: boolean; matching?: readonly string[] }) {
  const folds = useScopeFolds(TREE)
  return (
    <ScopeTree
      tree={TREE} folds={folds} holdings={HOLDINGS} onHome={onHome} menuOf={() => []} language="en" s={s}
      topicRows={topicRowsOf(TREE, '2026-11-07')} {...more}
    />
  )
}

const row = (at: string, topic: string) => screen.queryByTestId(`topic-row-${at}-${topic}`)

afterEach(() => cleanup())

describe('a topic in the scope tree', () => {
  it('is not shown while the scope\'s branch is shut, and is once it is opened, and folds away with it', () => {
    render(<Tree onHome={() => {}} />)
    expect(row('sales', 'topics/security')).toBeNull()
    fireEvent.click(screen.getByTestId('fold-sales'))
    expect(row('sales', 'topics/security')).not.toBeNull()
    fireEvent.click(screen.getByTestId('fold-sales'))
    expect(row('sales', 'topics/security')).toBeNull()
  })

  it('gives a scope with nothing filed under it a fold of its own, and one with no topic none', () => {
    render(<Tree onHome={() => {}} />)
    expect(screen.queryByTestId('fold-stock')).not.toBeNull()
    expect(row('stock', 'topics/security')).toBeNull()
    fireEvent.click(screen.getByTestId('fold-stock'))
    expect(row('stock', 'topics/security')).not.toBeNull()
    // Its link ended years ago: nothing to fold.
    expect(screen.queryByTestId('fold-empty')).toBeNull()
  })

  it('goes with the branch above it too', () => {
    render(<Tree onHome={() => {}} />)
    fireEvent.click(screen.getByTestId('fold-sales'))
    fireEvent.click(screen.getByTestId('fold-sales/retail'))
    expect(row('sales/retail', 'topics/security')).not.toBeNull()
    fireEvent.click(screen.getByTestId('fold-sales'))
    expect(row('sales/retail', 'topics/security')).toBeNull()
  })

  it('leaves out a subtopic its topic already lists, says what it is, and opens the topic where it lives', () => {
    const onHome = vi.fn()
    render(<Tree onHome={onHome} />)
    fireEvent.click(screen.getByTestId('fold-sales'))
    expect(row('sales', 'topics/security/keys')).toBeNull()
    fireEvent.click(screen.getByRole('treeitem', { name: 'Topic relevant here: Security' }))
    expect(onHome).toHaveBeenCalledWith('topics/security')
  })

  it('is no part of a find or of With work, which read what is filed', () => {
    render(<Tree onHome={() => {}} matching={['sales']} />)
    expect(row('sales', 'topics/security')).toBeNull()
    cleanup()
    render(<Tree onHome={() => {}} onlyWork />)
    expect(row('sales', 'topics/security')).toBeNull()
  })
})
