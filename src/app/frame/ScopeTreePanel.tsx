// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one tree of scopes, in two postures (the integral review's first
 * conflict): docked where the tree is the content, on a home or pinned by ⌘\,
 * and over the work from the trail's chevron, with the width left to the work.
 * The same find, the same rows and the same foot either way.
 */
import { useEffect, useMemo, useState } from 'react'
import type { Language, Translate } from '../../i18n'
import type { Destination, Page } from '../../agent/screen'
import { flattenScopes, sortScopes } from '../../projects/scope'
import type { ProjectOrder, ScopeSummary } from '../../projects/scope'
import { ancestorScopes, ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { matchesQuery } from '../../model/textSearch'
import { MoreMenu } from '../../widgets/kit/Menu'
import { TextInput } from '../../widgets/kit/Field'
import { ScopeTree } from '../organisation/ScopeTree'
import type { ScopeFolds } from '../organisation/useScopeFolds'
import { ORGANISATION_PLACES } from './places'

export type ScopeTreePanelProps = {
  tree: ScopeSummary
  at: ScopePath
  /** The page that is up, for the foot to mark. */
  page?: Page | undefined
  order: ProjectOrder
  onOrderChange: (order: ProjectOrder) => void
  folds: ScopeFolds
  onHome: (path: ScopePath) => void
  go: (to: Destination & { scope: string }) => void
  onSettings: (scope: ScopeSummary) => void
  onDelete: (scope: ScopeSummary) => void
  onNewScope?: (() => void) | undefined
  writable: (path: ScopePath) => boolean
  typeLink?: Parameters<typeof ScopeTree>[0]['typeLink']
  language: Language
  s: Translate
}

export function ScopeTreePanel({ tree, at, page, order, onOrderChange, folds, onHome, go, onSettings, onDelete, onNewScope, writable, typeLink, language, s }: ScopeTreePanelProps) {
  const [find, setFind] = useState('')
  // The path to where you are, and what is filed under it, stands open, whichever way you arrived.
  const { collapsed, toggleCollapsed } = folds
  useEffect(() => {
    for (const above of ancestorScopes(at)) if (collapsed.has(above)) toggleCollapsed(above)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on arrival only: a person may fold what they like after it
  }, [at])
  const ordered = useMemo(() => sortTree(tree, order), [tree, order])
  const matching = useMemo(() => {
    const asked = find.trim()
    if (asked === '') return undefined
    return new Set(flattenScopes(tree).filter((scope) => matchesQuery(asked, [scope.name])).map((scope) => scope.path))
  }, [tree, find])
  const name = tree.name.trim() || s('common.organisation')
  return (
    <div className="kit-tree" data-testid="scope-tree-panel">
      <div className="kit-tree__find">
        <TextInput
          aria-label={s('frame.findScope')} placeholder={s('frame.findScope')} value={find} data-testid="tree-find"
          onChange={(event) => setFind(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Escape' && find !== '') { event.stopPropagation(); event.preventDefault(); setFind('') } }}
        />
        <MoreMenu
          size="small" label={s('frame.treeMenu')}
          items={[
            { label: s('org.openAll'), onSelect: folds.openAll },
            { label: s('org.foldAll'), onSelect: folds.foldAll },
            { line: true },
            { label: s('picker.orderName'), checked: order === 'name', onSelect: () => onOrderChange('name') },
            { label: s('picker.orderUpdated'), checked: order === 'updated', onSelect: () => onOrderChange('updated') },
            ...(onNewScope ? [{ line: true } as const, { label: s('picker.newScope'), onSelect: onNewScope, 'data-guide': 'org.newScope' }] : []),
          ]}
        />
      </div>
      <div className="kit-tree__rows">
        {matching === undefined && (
          <div
            className="kit-tree__row" data-testid="scope-root" aria-current={at === ROOT_SCOPE ? 'page' : undefined}
            onClick={() => onHome(ROOT_SCOPE)}
          >
            <span className="kit-tree__fold" aria-hidden />
            <button type="button" className="kit-tree__name">{name}</button>
            {writable(ROOT_SCOPE) && (
              <span className="kit-tree__menu" onClick={(event) => event.stopPropagation()}>
                <MoreMenu size="small" label={s('frame.scopeMenu', { name })} items={[{ label: s('group.openFor', { name }), onSelect: () => onSettings(tree) }]} />
              </span>
            )}
          </div>
        )}
        <ScopeTree
          tree={ordered} name={name} folds={folds} onHome={onHome} onSettings={onSettings} onDelete={onDelete} writable={writable}
          current={at} language={language} s={s}
          {...(matching ? { matching } : {})}
          {...(typeLink ? { typeLink } : {})}
        />
      </div>
      <div className="kit-tree__foot" data-testid="tree-foot">
        <div className="kit-tree__heading">{s('frame.acrossOrganisation')}</div>
        {ORGANISATION_PLACES.map((place) => (
          <button
            key={place.page} type="button" className="kit-tree__place" data-testid={`tree-place-${place.page}`}
            aria-current={page === place.page ? 'page' : undefined}
            onClick={() => go({ scope: ROOT_SCOPE, page: place.page })}
          >
            {s(place.label)}
          </button>
        ))}
      </div>
    </div>
  )
}

function sortTree(tree: ScopeSummary, order: ProjectOrder): ScopeSummary {
  return { ...tree, children: sortScopes(tree.children, order).map((child) => sortTree(child, order)) }
}
