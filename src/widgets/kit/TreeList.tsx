// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A short tree to choose a part of something by: nodes that fold and that can
 * themselves be picked, each with a note and a count at its end. A `List`'s group
 * heads only fold, and here picking the heading is the point. One focus to tab
 * to; ↑ ↓ walk what is showing, → opens or goes in, ← closes or goes out, Enter or
 * a press picks, and a press on the caret only folds.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { CaretIcon } from '../icons'
import './TreeList.css'

export type TreeNode = {
  readonly id: string
  readonly label: string
  /** Quiet, at the end of the row: what needs doing under it, say. */
  readonly note?: ReactNode
  readonly count?: number
  readonly children?: readonly TreeNode[]
  /** Heavier than the rest, as a node that heads others is. */
  readonly strong?: boolean
}

export type TreeListProps = {
  readonly label: string
  readonly nodes: readonly TreeNode[]
  readonly selectedId?: string | null
  readonly onSelect?: (id: string) => void
  /** Which nodes are open. */
  readonly open: ReadonlySet<string>
  readonly onOpen: (id: string, open: boolean) => void
  readonly dataGuide?: string
}

type Shown = { readonly node: TreeNode; readonly depth: number; readonly parent: string | undefined }

function shownOf(nodes: readonly TreeNode[], open: ReadonlySet<string>, depth = 0, parent?: string): Shown[] {
  return nodes.flatMap((node) => [
    { node, depth, parent },
    ...(node.children?.length && open.has(node.id) ? shownOf(node.children, open, depth + 1, node.id) : []),
  ])
}

export function TreeList({ label, nodes, selectedId, onSelect, open, onOpen, dataGuide }: TreeListProps) {
  const shown = useMemo(() => shownOf(nodes, open), [nodes, open])
  const root = useRef<HTMLUListElement>(null)
  const [focused, setFocused] = useState<string>()
  const wantFocus = useRef(false)
  const at = shown.find(({ node }) => node.id === focused) ?? shown.find(({ node }) => node.id === selectedId) ?? shown[0]
  useLayoutEffect(() => {
    if (!wantFocus.current || !at) return
    wantFocus.current = false
    root.current?.querySelector<HTMLElement>(`[data-kit-tree="${CSS.escape(at.node.id)}"]`)?.focus()
  }, [at])
  const go = (id: string | undefined) => {
    if (id === undefined) return
    wantFocus.current = true
    setFocused(id)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (!at) return
    const index = shown.indexOf(at)
    const hasChildren = (at.node.children?.length ?? 0) > 0
    const keys: Record<string, () => void> = {
      ArrowDown: () => go(shown[index + 1]?.node.id),
      ArrowUp: () => go(shown[index - 1]?.node.id),
      Home: () => go(shown[0]?.node.id),
      End: () => go(shown[shown.length - 1]?.node.id),
      ArrowRight: () => { if (hasChildren && !open.has(at.node.id)) onOpen(at.node.id, true); else if (hasChildren) go(shown[index + 1]?.node.id) },
      ArrowLeft: () => { if (hasChildren && open.has(at.node.id)) onOpen(at.node.id, false); else go(at.parent) },
      Enter: () => onSelect?.(at.node.id),
      ' ': () => onSelect?.(at.node.id),
    }
    const act = keys[event.key]
    if (act) {
      event.preventDefault()
      act()
    }
  }
  const row = (node: TreeNode, depth: number): ReactNode => {
    const folds = (node.children?.length ?? 0) > 0
    const isOpen = open.has(node.id)
    return (
      <li key={node.id} role="none" className="kit-tree__item">
        <div
          role="treeitem" className="kit-tree__row" data-kit-tree={node.id} tabIndex={at?.node.id === node.id ? 0 : -1}
          aria-selected={selectedId === node.id} aria-expanded={folds ? isOpen : undefined}
          data-selected={selectedId === node.id || undefined} data-strong={node.strong || undefined}
          style={{ '--kit-tree-depth': depth } as CSSProperties}
          onClick={() => { setFocused(node.id); onSelect?.(node.id) }}
        >
          <span
            className="kit-tree__caret" aria-hidden="true" data-folded={(folds && !isOpen) || undefined}
            onClick={folds ? (event) => { event.stopPropagation(); onOpen(node.id, !isOpen) } : undefined}
          >
            {folds && <CaretIcon />}
          </span>
          <span className="kit-tree__label" title={node.label}>{node.label}</span>
          {node.note !== undefined && <span className="kit-tree__note">{node.note}</span>}
          {node.count !== undefined && <span className="kit-tree__count">{node.count}</span>}
        </div>
        {folds && isOpen && <ul role="group" className="kit-tree__group">{node.children?.map((child) => row(child, depth + 1))}</ul>}
      </li>
    )
  }
  return (
    <ul ref={root} role="tree" aria-label={label} className="kit-tree" onKeyDown={onKeyDown} data-guide={dataGuide}>
      {nodes.map((node) => row(node, 0))}
    </ul>
  )
}
