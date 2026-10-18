// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * ⌘K on a home: the workspace's wider search, with nothing open.
 *
 * The same dialog the workspace's *Search* opens (`GlobalSearchDialog`), over
 * the same sources, nearest first: this home's scope as its own document has
 * it, then every other scope as the shell's tree read has it. What is missing
 * is only what the workspace adds for the scope it has open — and on a home
 * nothing is open, so the scope whose home this is stands in that place.
 *
 * A hit opens where it lives, in the scope that holds it, on the page the
 * workspace's hit would land on (`initialPageFor`), so a search from the home
 * and one from a board arrive at the same place.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import type { Translate } from '../../i18n'
import { usePersonNames } from '../../people/ui/names'
import { flattenScopes } from '../../projects/scope'
import type { ScopeSnapshot, ScopeSummary } from '../../projects/scope'
import { scopeDisplayName } from '../../projects/scopeLabel'
import type { ScopePath } from '../../projects/scopePath'
import { treeSources } from '../../search/search'
import type { SearchHit } from '../../search/search'
import { GlobalSearchDialog } from '../../search/ui/GlobalSearchDialog'
import type { InitialPage } from '../App'
import { initialPageFor } from '../bootLanding'
import { QUIET } from '../ShellToolbar'
import type { TreeRead } from './useHomeChecks'

export type HomeSearchProps = {
  /** Whose home this is, and its own document where it has been read. */
  at: ScopePath
  root: ScopeSnapshot | undefined
  /** The listing, for what a row calls its scope. */
  tree: ScopeSummary
  /** Every scope as the shell's tree read has it. Absent: the home's own scope alone. */
  treeRead?: TreeRead
  onOpen: (path: ScopePath, page?: InitialPage) => void
  s: Translate
}

export function HomeSearch({ at, root, tree, treeRead, onOpen, s }: HomeSearchProps) {
  const [open, setOpen] = useState(false)
  const people = usePersonNames()

  // ⌘K / Ctrl+K, as in the workspace. The home is only mounted while no scope
  // is open, so the two never listen at once.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const sources = useMemo(() => treeSources({
    scope: at,
    model: root?.model ?? {},
    above: [],
    ...(treeRead ? { tree: treeRead.models } : {}),
    ...(treeRead ? { masterOf: (id: string) => treeRead.index.lookup(id)?.master } : {}),
  }), [at, root, treeRead])

  const rootName = tree.name.trim() || s('common.organisation')
  const scopeLabel = useMemo(() => {
    const every = flattenScopes(tree)
    return (path: string) => scopeDisplayName(path, every, rootName)
  }, [tree, rootName])

  const choose = useCallback((hit: SearchHit) => {
    setOpen(false)
    onOpen(hit.scope ?? at, initialPageFor({ page: hit.opens.page, id: hit.opens.id }))
  }, [onOpen, at])

  return (
    <>
      <Tooltip title={s('shell.searchTip')}>
        <Button size="small" color="inherit" onClick={() => setOpen(true)} sx={QUIET} data-testid="home-search">
          {s('shell.search')}
        </Button>
      </Tooltip>
      <GlobalSearchDialog
        open={open}
        sources={sources}
        scopeLabel={scopeLabel}
        onClose={() => setOpen(false)}
        onChoose={choose}
        people={people.match}
        s={s}
      />
    </>
  )
}
