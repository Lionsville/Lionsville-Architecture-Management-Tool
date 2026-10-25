// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The scopes filed under the organisation, as the shape of the folder.
 *
 * Depth-first with the children indented, because the folder layout IS the
 * structure (ADR-0012 §1) and a flat list grouped by a heading is how two
 * orderings come to disagree. **The root is not a row**: it is the screen this
 * sits on, and a row for it would be an organisation listed inside itself.
 *
 * A scope with children can be folded shut, and starts so: a home lists its
 * first column, and a person opens what they came for. What is opened is per
 * session and not a preference — a fold is what you are doing this minute,
 * and a tool that remembered it would open next week with half the tree
 * hidden for a reason nobody can reconstruct.
 *
 * A row says how much is in it and when it changed, and nothing about what
 * the tree contradicts: the findings used to be counted here in the warning
 * colour, which said that something was wrong and nothing about what, and
 * could not be pressed. They are sentences under the cards now
 * (`NeedsAttention`), each a way to the thing it is about.
 */
import { Fragment } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { LOCALE } from '../../i18n'
import type { Language, Translate } from '../../i18n'
import { plural } from '../../i18n/strings'
import { flattenScopes, subtreeTotals } from '../../projects/scope'
import type { ScopeSummary } from '../../projects/scope'
import { ROOT_SCOPE, scopeSegments } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { CaretIcon } from '../../widgets/icons'
import { scopeTypeLabel } from './ScopeSettingsDialog'
import type { TypeLink } from '../../projects/scopeType'
import { TopicRows } from './TopicRows'
import { foldsBelow } from './useScopeFolds'
import type { ScopeFolds } from './useScopeFolds'

/** Whether the badge warns: the scope's type and its serving units disagree, or its type is gone. */
function typeWarns(link: TypeLink | undefined): boolean {
  return link === 'disagrees' || link === 'gone'
}

export type ScopeTreeProps = {
  /**
   * The tree, already in the order the person chose. Its top is not drawn: it
   * is the scope whose home this sits on — the root, or a domain beneath it.
   */
  tree: ScopeSummary
  /** What the top of the tree is called, for the sentence an empty one shows. */
  name: string
  /** What is folded shut, and the press that turns one (`useScopeFolds`). */
  folds: Pick<ScopeFolds, 'collapsed' | 'toggleCollapsed'>
  /**
   * To the scope's home: its own pages, its boards and the tree under it.
   * Every row has one, and **the whole row is it** — opening a scope is
   * arriving at its home, and a board is opened from the home's list of
   * boards, where it is named. The row used to carry its name as one way there
   * and an *Open* as a second way to the same place, which read as two things
   * to choose between. Creating a scope under this one is on its home too,
   * once, rather than on every row of its parent's tree.
   */
  onHome: (path: ScopePath) => void
  onSettings: (scope: ScopeSummary) => void
  onDelete: (scope: ScopeSummary) => void
  /**
   * May this person change the scope at this path? Asked per row, because a
   * source can let somebody write one domain and only read the next. A row
   * they may only read offers neither its settings nor its removal: both
   * would be refused, and a refusal is a worse way to learn that than a
   * button that is not there. Every row may be written where absent.
   */
  writable?: (path: ScopePath) => boolean
  /**
   * The top of the tree is a landscape — a scope that draws — so the empty
   * tree says what a scope under a landscape is for, rather than asking for
   * one the way an empty domain does.
   */
  landscape?: boolean
  /**
   * What a scope typed from the operating model is called, by unit type id
   * (ADR-0036, amended 17 October 2026); nothing for a type the model no
   * longer holds, and the badge then says so. Absent: the kind alone is shown.
   */
  typeName?: (unitTypeId: string) => string | undefined
  /** How a scope's type stands to the units that serve it, for the badge's tone; absent: not said. */
  typeLink?: (path: ScopePath) => TypeLink | undefined
  language: Language
  s: Translate
}

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

/**
 * What a row counts.
 *
 * A scope with children sums its whole subtree, because what you want to know
 * about a domain is how much is inside it; a leaf counts only what it draws,
 * because "1 landscape · 3 diagrams" about itself is saying the same thing
 * twice.
 */
function metaOf(scope: ScopeSummary, s: Translate): string {
  if (scope.children.length === 0) {
    return plural(s, { one: 'org.diagramsOne', other: 'org.diagramsOther' }, scope.diagrams)
  }
  const totals = subtreeTotals(scope)
  return [
    // First, because a folded row is the only place left that says there is
    // anything to open.
    plural(s, { one: 'org.underOne', other: 'org.underOther' }, flattenScopes(scope).length - 1),
    plural(s, { one: 'org.landscapesOne', other: 'org.landscapesOther' }, totals.landscapes),
    plural(s, { one: 'org.diagramsOne', other: 'org.diagramsOther' }, totals.diagrams),
  ].join(' · ')
}

/**
 * The rows to draw: depth first, minus anything inside a folded scope. Only a
 * fold below the top counts — the top is the screen, and its own fold is the
 * one its parent's home would show.
 */
function visibleRows(tree: ScopeSummary, collapsed: ReadonlySet<ScopePath>): ScopeSummary[] {
  return tree.children.flatMap((child) => (
    [child, ...(collapsed.has(child.path) ? [] : visibleRows(child, collapsed))]
  ))
}

/** How wide the fold's press is: the whole height of a row, not the caret's. */
const FOLD = 32

const ANYWHERE = () => true

export function ScopeTree({
  tree, name, folds, onHome, onSettings, onDelete, writable = ANYWHERE, landscape = false,
  typeName, typeLink, language, s,
}: ScopeTreeProps) {
  const { collapsed, toggleCollapsed } = folds
  const rows = visibleRows(tree, collapsed)
  // The top of the tree is the screen, so its children are the first column.
  const base = scopeSegments(tree.path).length
  const rowProps = { onHome, onSettings, onDelete, typeName, typeLink, language, s, toggleCollapsed }

  if (rows.length === 0) {
    return (
      <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 2 }} data-testid="tree-empty">
        {landscape ? s('org.treeEmptyLandscape') : s('org.treeEmpty', { name })}
      </Typography>
    )
  }

  return (
    <Box data-guide="org.tree">
      {rows.map((scope) => {
        const depth = scopeSegments(scope.path).length - base - 1
        return (
          <Fragment key={scope.path}>
            <ScopeRow scope={scope} depth={depth} shut={collapsed.has(scope.path)} mayWrite={writable(scope.path)} {...rowProps} />
            <TopicRows at={scope.path} depth={depth} s={s} />
          </Fragment>
        )
      })}
    </Box>
  )
}

type RowProps = Pick<ScopeTreeProps, 'onHome' | 'onSettings' | 'onDelete' | 'typeName' | 'typeLink' | 'language' | 's'> & { toggleCollapsed: (path: ScopePath) => void }

/** One scope's row: its fold, its name and type, what it holds, and — for a person who may write it — its settings and removal. */
function ScopeRow({ scope, depth, shut, mayWrite, onHome, onSettings, onDelete, typeName, typeLink, language, s, toggleCollapsed }: RowProps & {
  scope: ScopeSummary; depth: number; shut: boolean; mayWrite: boolean
}) {
  const quiet = { fontSize: 11, minWidth: 0, px: 1, color: 'text.secondary' } as const
  return (
    // The press anywhere on the row is the way home; the name is the
    // button that carries it for a keyboard and a screen reader, and
    // the controls at either end keep their press to themselves.
    <Stack
      direction="row"
      spacing={0.5}
      data-testid={`scope-${scope.path}`}
      data-guide="org.tree.row"
      data-depth={depth}
      onClick={() => onHome(scope.path)}
      sx={{
        alignItems: 'center',
        ml: depth * 3,
        py: 0.5,
        borderBottom: 1,
        borderColor: 'divider',
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      {scope.children.length > 0 ? (
        <Tooltip title={s(shut ? 'org.expand' : 'org.collapse', { name: scope.name })}>
          <IconButton
            size="small"
            aria-label={s(shut ? 'org.expand' : 'org.collapse', { name: scope.name })}
            onClick={(event) => { event.stopPropagation(); toggleCollapsed(scope.path) }}
            data-testid={`fold-${scope.path}`}
            sx={{
              width: FOLD, height: FOLD, flex: '0 0 auto', color: 'text.secondary',
              '&:hover': { color: 'text.primary', bgcolor: 'action.selected' },
            }}
          >
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                transform: shut ? 'rotate(-90deg)' : undefined,
                transition: 'transform 120ms',
              }}
            >
              <CaretIcon size={16} />
            </Box>
          </IconButton>
        </Tooltip>
      ) : (
        // The same width a fold takes, so the names of the leaves line
        // up with the names of the scopes that have one.
        <Box sx={{ width: FOLD, flex: '0 0 auto' }} />
      )}

      {/* `open-…` is the row's body, name and counts together: the id a
          script pressed *Open* by, on what now does what *Open* did. */}
      <Box sx={{ flex: 1, minWidth: 0 }} data-testid={`open-${scope.path}`}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          {/* No handler of its own: its press is the row's. */}
          <Button
            size="small"
            color="inherit"
            data-testid={`home-${scope.path}`}
            sx={{ fontSize: 13, fontWeight: 500, minWidth: 0, px: 0.5, py: 0, textTransform: 'none' }}
          >
            {scope.name}
          </Button>
          {(scope.unitTypeId !== undefined || scope.kind) && (
            <Chip
              size="small"
              label={scopeTypeLabel(scope, typeName, s)}
              color={typeWarns(typeLink?.(scope.path)) ? 'warning' : 'default'}
              variant={typeWarns(typeLink?.(scope.path)) ? 'outlined' : 'filled'}
              data-testid="scope-type" data-link={typeLink?.(scope.path)}
              sx={{ height: 16, fontSize: 10 }}
            />
          )}
        </Stack>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
          {metaOf(scope, s)} · {whenChanged(scope.updatedAt, language, s)}
        </Typography>
      </Box>

      {mayWrite && (
        <Tooltip title={s('group.openFor', { name: scope.name })}>
          <Button
            size="small"
            color="inherit"
            onClick={(event) => { event.stopPropagation(); onSettings(scope) }}
            sx={quiet}
            aria-label={s('group.openFor', { name: scope.name })}
          >
            {s('group.open')}
          </Button>
        </Tooltip>
      )}
      {/* Never the root, which is not a row here anyway — the guard is
          stated so a tree that one day drew one cannot offer it. */}
      {mayWrite && scope.path !== ROOT_SCOPE && (
        <Tooltip title={s('picker.delete')}>
          <IconButton
            size="small"
            aria-label={`${s('picker.delete')} ${scope.name}`}
            onClick={(event) => { event.stopPropagation(); onDelete(scope) }}
            sx={{ color: 'text.secondary' }}
          >
            ✕
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  )
}

/**
 * One press for the whole tree beneath a home: *Show all* while anything in it
 * is folded, *Fold all* once nothing is. Not offered on a tree one level deep,
 * which has nothing to fold.
 */
export function FoldAll({ tree, folds, s }: {
  tree: ScopeSummary
  folds: Pick<ScopeFolds, 'collapsed' | 'openAll' | 'foldAll'>
  s: Translate
}) {
  const below = foldsBelow(tree)
  if (below.length === 0) return null
  const anyShut = below.some((path) => folds.collapsed.has(path))
  return (
    <Button
      size="small" color="inherit" data-testid="tree-fold-all"
      onClick={anyShut ? folds.openAll : folds.foldAll}
      sx={{ fontSize: 11, textTransform: 'none', color: 'text.secondary' }}
    >
      {s(anyShut ? 'org.openAll' : 'org.foldAll')}
    </Button>
  )
}
