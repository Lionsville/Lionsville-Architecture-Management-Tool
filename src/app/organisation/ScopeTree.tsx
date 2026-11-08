// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The scopes filed under the organisation, as the shape of the folder.
 *
 * Depth-first with the children indented, because the folder layout IS the
 * structure (ADR-0012 §1) and a flat list grouped by a heading is how two
 * orderings come to disagree. A scope with children can be folded shut, and
 * starts so. What is opened is per session and not a preference: a fold is what
 * you are doing this minute, and a tool that remembered it would open next week
 * with half the tree hidden for a reason nobody can reconstruct.
 *
 * A row is one line and says one thing beyond its name: how much is kept there,
 * here and below, in one number with the words on hover. Most scopes hold
 * nothing, which is ordinary, so they keep their place in a quieter ink and the
 * structure stays true. What a scope's type disagrees about is the one thing a
 * row marks; relevance to a topic is said on the scope's home, because an arrow
 * row among the children reads as filing, and filing is what this tree is.
 */
import { Fragment } from 'react'
import { LOCALE } from '../../i18n'
import type { Language, Translate } from '../../i18n'
import { plural } from '../../i18n/strings'
import { fold } from '../../model/textSearch'
import { flattenScopes } from '../../projects/scope'
import type { ScopeSummary } from '../../projects/scope'
import { parentScope, ROOT_SCOPE, scopeSegments } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { CaretIcon, LockIcon } from '../../widgets/icons'
import { Mark } from '../../widgets/kit/Mark'
import { MoreMenu } from '../../widgets/kit/Menu'
import type { MenuEntry } from '../../widgets/kit/Menu'
import type { TypeLink } from '../../projects/scopeType'
import type { ScopeFolds } from './useScopeFolds'
import type { Held, Holdings } from './holdings'

/** Whether the row marks its type: the scope's type and its serving units disagree, or its type is gone. */
function typeWarns(link: TypeLink | undefined): boolean {
  return link === 'disagrees' || link === 'gone'
}

/** What may be done with a row, for a person who may write it. */
export type RowActs = {
  onHome: (path: ScopePath) => void
  /** The acts under a scope's ⋯: empty for somebody who may only read it. */
  menuOf: (scope: ScopeSummary) => readonly MenuEntry[]
}

export type ScopeTreeProps = RowActs & {
  /**
   * The tree, already in the order the person chose. Its top is not drawn here:
   * the panel draws it as a row of its own, the organisation over what is filed in it.
   */
  tree: ScopeSummary
  /** What is folded shut, and the press that turns one (`useScopeFolds`). */
  folds: Pick<ScopeFolds, 'collapsed' | 'toggleCollapsed'>
  holdings: Holdings
  /** How a scope's type stands to the units that serve it, for the mark; absent: not said. */
  typeLink?: ((path: ScopePath) => TypeLink | undefined) | undefined
  language: Language
  s: Translate
  /** The scope you are in: its row says so. */
  current?: ScopePath
  /** *With work*: only what holds something and the path down to it, all of it open. */
  onlyWork?: boolean
  /** While something is typed in the find box: only these, flat, each with its path. */
  matching?: readonly ScopePath[]
  /** Paths the listing could not read: a row that says so, and has nothing to press. */
  unread?: ReadonlySet<ScopePath>
  /** The topics relevant to a scope today, for the rows its open branch shows; absent: none. */
  topicRows?: ((path: ScopePath) => readonly TopicRow[]) | undefined
  /** What was typed in the find box, marked where a name holds it. */
  asked?: string
}

/** A topic as a row under a scope it is relevant to: where it lives, and what it is called. */
export type TopicRow = { path: ScopePath; name: string }

/** When a scope last changed, in the person's own locale. */
export function whenChanged(
  updatedAt: string | undefined, language: Language, s: Translate,
): string {
  if (!updatedAt) return s('picker.never')
  const at = new Date(updatedAt)
  if (Number.isNaN(at.getTime())) return s('picker.never')
  return s('picker.changed', {
    when: at.toLocaleString(LOCALE[language], {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }),
  })
}

/** What each count is called, in the order a hover names them. */
const HELD_WORDS = [
  ['views', { one: 'org.heldViewOne', other: 'org.heldViewOther' }],
  ['observations', { one: 'org.heldObservationOne', other: 'org.heldObservationOther' }],
  ['causes', { one: 'org.heldCauseOne', other: 'org.heldCauseOther' }],
  ['solutions', { one: 'org.heldSolutionOne', other: 'org.heldSolutionOther' }],
  ['decisions', { one: 'org.heldDecisionOne', other: 'org.heldDecisionOther' }],
  ['plans', { one: 'org.heldPlanOne', other: 'org.heldPlanOther' }],
  ['principles', { one: 'org.heldPrincipleOne', other: 'org.heldPrincipleOther' }],
] as const

/** *3 views, 12 observations*: what a hover and a line about somewhere else say. */
export function heldInWords(held: Held, s: Translate): string {
  return HELD_WORDS.filter(([key]) => held[key] > 0).map(([key, words]) => plural(s, words, held[key])).join(', ')
}

/** The rows to draw: depth first, minus anything inside a folded scope. */
function visibleRows(tree: ScopeSummary, collapsed: ReadonlySet<ScopePath>): ScopeSummary[] {
  return tree.children.flatMap((child) => (
    [child, ...(collapsed.has(child.path) ? [] : visibleRows(child, collapsed))]
  ))
}

const NONE_FOLDED: ReadonlySet<ScopePath> = new Set()

function rowsOf({ tree, folds, onlyWork, matching, holdings }: Pick<ScopeTreeProps, 'tree' | 'folds' | 'onlyWork' | 'matching' | 'holdings'>): ScopeSummary[] {
  if (matching) {
    const found = new Set(matching)
    return flattenScopes(tree).filter((scope) => scope.path !== tree.path && found.has(scope.path))
  }
  if (onlyWork) return visibleRows(tree, NONE_FOLDED).filter((scope) => holdings.withWork.has(scope.path))
  return visibleRows(tree, folds.collapsed)
}

/** Whether a path is one of these scopes or filed under one. */
const within = (path: ScopePath, scopes: readonly ScopePath[]) => scopes.some((one) => path === one || path.startsWith(`${one}/`))

/** The names above a scope, for a match shown flat: where it is, since nothing around it says. */
function pathWords(tree: ScopeSummary, path: ScopePath): string {
  const nodes = new Map(flattenScopes(tree).map((one) => [one.path, one.name]))
  const segments = scopeSegments(path)
  return segments.slice(0, -1).map((_, at) => nodes.get(segments.slice(0, at + 1).join('/'))).filter(Boolean).join(' / ')
}

export function ScopeTree({
  tree, folds, onHome, menuOf, holdings, typeLink, language, s, current, onlyWork = false, matching, unread, topicRows, asked = '',
}: ScopeTreeProps) {
  const rows = rowsOf({ tree, folds, onlyWork, matching, holdings })
  const personal = flattenScopes(tree).filter((one) => one.personal).map((one) => one.path)
  // The top of the tree is its own row, so its children are the first column.
  const base = scopeSegments(tree.path).length

  if (rows.length === 0) {
    return <p className="kit-tree__empty" data-testid="tree-empty">{s(matching ? 'frame.findNothing' : onlyWork ? 'org.treeNoWork' : 'org.treeEmpty')}</p>
  }

  return (
    <div data-guide="org.tree">
      {rows.map((scope, at) => {
        const depth = matching ? 0 : scopeSegments(scope.path).length - base
        // Scopes only the reader sees come last (`sortScopes`), under a rule that keeps them apart from the organisation's.
        const before = rows[at - 1]
        const apart = !matching && scope.personal === true && before !== undefined && !within(before.path, personal) && parentScope(scope.path) !== before.path
        const shut = folds.collapsed.has(scope.path)
        const topics = matching || onlyWork ? [] : topicRows?.(scope.path) ?? []
        return (
          <Fragment key={scope.path}>
            {apart && <div className="kit-tree__apart" role="none" aria-hidden data-testid="tree-personal-rule" />}
            <ScopeRow
              scope={scope} depth={depth} shut={shut} hasBranch={scope.children.length > 0 || topics.length > 0}
              current={scope.path === current} foldable={!matching && !onlyWork} above={matching ? pathWords(tree, scope.path) : ''} unread={unread?.has(scope.path) === true}
              count={holdings.work(scope.path)} words={heldInWords(holdings.all(scope.path), s)} warns={typeWarns(typeLink?.(scope.path))}
              onHome={onHome} menuOf={menuOf} language={language} s={s} toggleCollapsed={folds.toggleCollapsed} asked={matching ? asked : ''} enters={matching?.[0] === scope.path}
            />
            {!shut && topics.map((topic) => <TopicTreeRow key={topic.path} at={scope.path} topic={topic} depth={depth + 1} onHome={onHome} s={s} />)}
          </Fragment>
        )
      })}
    </div>
  )
}

/** A topic under a scope it is relevant to: said as that, and pressed to where it lives. */
export function TopicTreeRow({ at, topic, depth, onHome, s }: { at: ScopePath; topic: TopicRow; depth: number; onHome: RowActs['onHome']; s: Translate }) {
  return (
    <div
      className="kit-tree__row" data-testid={`topic-row-${at}-${topic.path}`} data-topic data-depth={depth}
      role="treeitem" tabIndex={-1} aria-level={depth + 1} aria-label={s('org.treeTopicRow', { name: topic.name })} data-name={topic.name}
      style={{ paddingInlineStart: `${depth * 14}px` }} onClick={() => onHome(topic.path)}
    >
      <span className="kit-tree__fold" aria-hidden />
      <button type="button" className="kit-tree__name" tabIndex={-1} aria-hidden title={s('org.treeTopicRow', { name: topic.name })}>
        <span aria-hidden>↗ </span>{topic.name}
      </button>
      <span className="kit-tree__menu" />
    </div>
  )
}

/** One scope's row: its fold, its name, what it holds, and its acts under ⋯. */
/** How many letters before a match a long name keeps. */
const MATCH_LEAD = 10

/** A name with what was typed marked in it, so a match shown flat says why it is there. */
function Marked({ text, asked }: { text: string; asked: string }) {
  const at = asked === '' ? -1 : fold(text).indexOf(fold(asked))
  // Folding keeps the length for the letters a name is made of; where it did not, the name is said plainly.
  if (at < 0 || fold(text).length !== text.length) return <>{text}</>
  // Deep in a long name, the words before the match give way to an ellipsis rather than the match itself.
  const from = at > MATCH_LEAD * 2 ? at - MATCH_LEAD : 0
  return <>{from > 0 ? '…' : ''}{text.slice(from, at)}<mark className="kit-tree__match">{text.slice(at, at + asked.length)}</mark>{text.slice(at + asked.length)}</>
}

function ScopeRow({ scope, depth, shut, hasBranch, current, foldable, above, unread, count, words, warns, onHome, menuOf, s, language, toggleCollapsed, asked, enters }: RowActs & {
  scope: ScopeSummary; depth: number; shut: boolean; hasBranch: boolean; current: boolean; foldable: boolean; above: string; unread: boolean
  count: number; words: string; warns: boolean; asked: string
  /** The match Enter in the find box opens, marked as the one. */
  enters: boolean
  toggleCollapsed: (path: ScopePath) => void
  language: Language; s: Translate
}) {
  const foldName = s(shut ? 'org.expand' : 'org.collapse', { name: scope.name })
  const items = unread ? [] : menuOf(scope)
  const named = above ? `${above} / ${scope.name}` : scope.name
  const own = scope.personal ? s('org.treePersonal') : ''
  // The row's name says what it shows, its count or its mark too: a name short of the words on screen
  // is a name a speech user cannot say to press it (WCAG 2.5.3).
  // What only its reader sees is said last: the words on screen come first, in their order.
  const said = [named, warns ? s('org.typeMismatch') : '', unread ? s('org.notRead') : count > 0 ? String(count) : '', own].filter(Boolean).join(', ')
  return (
    // The press anywhere on the row is the way home; the name is the button
    // that carries it for a keyboard and a screen reader, and the controls at
    // either end keep their press to themselves.
    <div
      className="kit-tree__row"
      // One Tab stop for the whole tree: the panel moves it with the arrows (`useTreeKeys`).
      role="treeitem" tabIndex={-1} aria-level={depth + 1} aria-label={said} data-name={scope.name}
      data-enter={enters || undefined}
      aria-expanded={foldable && hasBranch ? !shut : undefined} aria-disabled={unread || undefined}
      data-testid={`scope-${scope.path}`}
      data-guide="org.tree.row"
      data-depth={depth}
      data-quiet={count === 0 || undefined}
      aria-current={current ? 'page' : undefined}
      style={{ paddingInlineStart: `${depth * 14}px` }}
      data-personal={scope.personal || undefined}
      title={[named, own, unread ? s('org.notReadTip') : [words, whenChanged(scope.updatedAt, language, s)].filter(Boolean).join(' · ')].filter(Boolean).join('\n')}
      onClick={unread ? undefined : () => onHome(scope.path)}
    >
      {foldable && hasBranch ? (
        <button
          type="button" className="kit-tree__fold" tabIndex={-1} aria-label={foldName} aria-expanded={!shut} data-testid={`fold-${scope.path}`}
          onClick={(event) => { event.stopPropagation(); toggleCollapsed(scope.path) }}
        >
          <CaretIcon size={14} />
        </button>
      ) : <span className="kit-tree__fold" aria-hidden />}
      {/* No handler of its own: its press is the row's. */}
      <button type="button" className="kit-tree__name" tabIndex={-1} aria-hidden data-testid={`home-${scope.path}`} disabled={unread}>
        {/* Where a match is gives way before what it is called: the path is cut, the name is kept. */}
        {above && <><span className="kit-tree__above">{above}</span><span className="kit-tree__sep" aria-hidden> / </span></>}
        <span className="kit-tree__own" data-testid={`open-${scope.path}`}><Marked text={scope.name} asked={asked} /></span>
      </button>
      {own && <span className="kit-tree__mine" role="img" aria-label={own} title={own} data-testid="scope-personal"><LockIcon size={12} /></span>}
      {/* A space between the words, which the flex row does not draw: read as text, the name and the count are two words, not one. */}
      {' '}
      {warns && <span className="kit-tree__warn" title={s('org.typeMismatchTip')}><Mark kind="review" size={12} />{s('org.typeMismatch')}</span>}
      {warns && ' '}
      {unread
        ? <span className="kit-tree__holds" data-testid="scope-not-read">{s('org.notRead')}</span>
        : count > 0 && <span className="kit-tree__holds" data-testid="scope-holds">{count}</span>}
      <span className="kit-tree__menu">
        {items.length > 0 && <MoreMenu size="small" tabIndex={-1} label={s('frame.scopeMenu', { name: scope.name })} items={items} />}
      </span>
    </div>
  )
}

/** The root's own row: a name, what the whole tree holds, and no way to fold or remove it. */
export function RootRow({ tree, name, current, count, words, onHome, menuOf, s }: RowActs & {
  tree: ScopeSummary; name: string; current: boolean; count: number; words: string; s: Translate
}) {
  const items = menuOf(tree)
  return (
    <div
      className="kit-tree__row" data-testid="scope-root" aria-current={current ? 'page' : undefined}
      role="treeitem" tabIndex={-1} aria-level={1} aria-label={count > 0 ? `${name}, ${count}` : name} data-name={name}
      data-quiet={count === 0 || undefined} title={[name, words].filter(Boolean).join('\n')}
      onClick={() => onHome(ROOT_SCOPE)}
    >
      <span className="kit-tree__fold" aria-hidden />
      {/* In a span of its own, as a scope's name is: a flex button cuts bare text without its ellipsis, hard against the count. */}
      <button type="button" className="kit-tree__name" tabIndex={-1} aria-hidden><span className="kit-tree__own">{name}</span></button>
      {' '}
      {count > 0 && <span className="kit-tree__holds">{count}</span>}
      <span className="kit-tree__menu">
        {items.length > 0 && <MoreMenu size="small" tabIndex={-1} label={s('frame.scopeMenu', { name })} items={items} />}
      </span>
    </div>
  )
}
