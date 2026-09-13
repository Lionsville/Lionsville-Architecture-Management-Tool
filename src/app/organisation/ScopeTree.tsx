/**
 * The scopes filed under the organisation, as the shape of the folder.
 *
 * Depth-first with the children indented, because the folder layout IS the
 * structure (ADR-0012 §1) and a flat list grouped by a heading is how two
 * orderings come to disagree. **The root is not a row**: it is the screen this
 * sits on, and a row for it would be an organisation listed inside itself.
 *
 * A scope with children can be folded shut. That is per session and not a
 * preference — a fold is what you are doing this minute, and a tool that
 * remembered it would open next week with half the tree hidden for a reason
 * nobody can reconstruct.
 *
 * **Every row carries its finding line**, and the whole tree's findings are
 * worked out ONCE and handed in as a map (ADR-0012 §9). A row that asked for
 * its own would be a fold over the organisation per row, which is the shape
 * ADR-0004 keeps catching — and a row that said something reassuring without
 * an index behind it would be saying it without looking, which is why a tree
 * handed nothing says nothing rather than "no problems".
 */
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
import { CHECK_SHORT, tally } from '../../projects/checks'
import type { CheckKey, Finding } from '../../projects/checks'
import { flattenScopes, subtreeTotals } from '../../projects/scope'
import type { ScopeSummary } from '../../projects/scope'
import { ROOT_SCOPE, scopeSegments } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { CaretIcon } from '../../widgets/icons'
import { SCOPE_KIND_LABEL } from './ScopeSettingsDialog'

export type ScopeTreeProps = {
  /**
   * The tree, already in the order the person chose. Its top is not drawn: it
   * is the scope whose home this sits on — the root, or a domain beneath it.
   */
  tree: ScopeSummary
  collapsed: ReadonlySet<ScopePath>
  onToggleCollapsed: (path: ScopePath) => void
  /** Onto the scope's canvas. Offered only where there is one. */
  onOpen: (path: ScopePath) => void
  /**
   * To the scope's home: its own pages, and the tree under it. Every row has
   * one, which is what its name does.
   */
  onHome: (path: ScopePath) => void
  onAddUnder: (path: ScopePath) => void
  onSettings: (scope: ScopeSummary) => void
  onDelete: (scope: ScopeSummary) => void
  /**
   * What the tree contradicts about itself, by the scope it is about
   * (ADR-0012 §9) — `projects/checks.findingsByScope`.
   *
   * Worked out once for the whole organisation by whoever holds the index, so
   * a row is a map lookup. Absent means nothing has been read yet, and a row
   * then says nothing at all about findings rather than saying there are none.
   */
  findings?: ReadonlyMap<ScopePath, readonly Finding[]>
  language: Language
  s: Translate
}

/**
 * The finding line for one row: how many of each, faults only.
 *
 * Information (`check.notDrawn`) is deliberately left out: a row saying "and
 * four things are on no board" would be four things nobody has to do anything
 * about, printed beside two that somebody does. The register page is where
 * that belongs, and it is step 10's.
 */
export function findingLine(
  findings: readonly Finding[] | undefined, s: Translate,
): string | undefined {
  const counts = tally((findings ?? []).filter((finding) => !finding.information))
  const parts = (Object.keys(counts) as CheckKey[])
    .sort()
    .map((key) => plural(s, CHECK_SHORT[key], counts[key] ?? 0))
  return parts.length ? parts.join(' · ') : undefined
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
    plural(s, { one: 'org.landscapesOne', other: 'org.landscapesOther' }, totals.landscapes),
    plural(s, { one: 'org.diagramsOne', other: 'org.diagramsOther' }, totals.diagrams),
  ].join(' · ')
}

/** The rows to draw: depth first, minus anything inside a folded scope. */
function visibleRows(tree: ScopeSummary, collapsed: ReadonlySet<ScopePath>): ScopeSummary[] {
  return tree.children.flatMap((child) => (
    collapsed.has(child.path)
      ? [child]
      : flattenScopes(child).filter((scope) => (
        // A scope inside a folded one stays hidden however deep it is.
        ![...collapsed].some((shut) => scope.path !== shut && scope.path.startsWith(`${shut}/`))
      ))
  ))
}

export function ScopeTree({
  tree, collapsed, onToggleCollapsed, onOpen, onHome, onAddUnder, onSettings, onDelete, findings,
  language, s,
}: ScopeTreeProps) {
  const rows = visibleRows(tree, collapsed)
  // The top of the tree is the screen, so its children are the first column.
  const base = scopeSegments(tree.path).length
  const quiet = { fontSize: 11, minWidth: 0, px: 1, color: 'text.secondary' } as const

  if (rows.length === 0) {
    return (
      <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 2 }}>
        {s('org.treeEmpty')}
      </Typography>
    )
  }

  return (
    <Box>
      {rows.map((scope) => {
        const depth = scopeSegments(scope.path).length - base - 1
        const shut = collapsed.has(scope.path)
        return (
          <Stack
            key={scope.path}
            direction="row"
            alignItems="center"
            spacing={0.5}
            data-testid={`scope-${scope.path}`}
            data-depth={depth}
            sx={{
              ml: depth * 2.5,
              py: 0.75,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            {scope.children.length > 0 ? (
              <Tooltip title={s(shut ? 'org.expand' : 'org.collapse', { name: scope.name })}>
                <IconButton
                  size="small"
                  aria-label={s(shut ? 'org.expand' : 'org.collapse', { name: scope.name })}
                  onClick={() => onToggleCollapsed(scope.path)}
                  sx={{
                    width: 22, height: 22, color: 'text.secondary',
                    transform: shut ? 'rotate(-90deg)' : undefined,
                  }}
                >
                  <CaretIcon />
                </IconButton>
              </Tooltip>
            ) : (
              // The same 22px a chevron takes, so the names of the leaves line
              // up with the names of the scopes that have one.
              <Box sx={{ width: 22, flex: '0 0 auto' }} />
            )}

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => onHome(scope.path)}
                  data-testid={`home-${scope.path}`}
                  sx={{ fontSize: 13, fontWeight: 500, minWidth: 0, px: 0.5, py: 0, textTransform: 'none' }}
                >
                  {scope.name}
                </Button>
                {scope.kind && (
                  <Chip
                    size="small"
                    label={s(SCOPE_KIND_LABEL[scope.kind])}
                    sx={{ height: 16, fontSize: 10 }}
                  />
                )}
              </Stack>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                {metaOf(scope, s)} · {whenChanged(scope.updatedAt, language, s)}
              </Typography>
              {/* A line of its own, in the warning colour: it is about what
                  the tree contradicts, which is a different kind of fact from
                  how many boards are in it (ADR-0012 §9). */}
              {findingLine(findings?.get(scope.path), s) && (
                <Typography
                  data-testid={`findings-${scope.path}`}
                  sx={{ fontSize: 11, color: 'warning.main' }}
                >
                  {findingLine(findings?.get(scope.path), s)}
                </Typography>
              )}
            </Box>

            {scope.diagrams > 0 && (
              <Button size="small" onClick={() => onOpen(scope.path)} sx={{ fontSize: 11, minWidth: 0, px: 1 }}>
                {s('picker.open')}
              </Button>
            )}
            <Tooltip title={s('picker.addUnder', { name: scope.name })}>
              <Button
                size="small"
                color="inherit"
                onClick={() => onAddUnder(scope.path)}
                sx={quiet}
                aria-label={s('picker.addUnder', { name: scope.name })}
              >
                {s('picker.newScope')}
              </Button>
            </Tooltip>
            <Tooltip title={s('group.openFor', { name: scope.name })}>
              <Button
                size="small"
                color="inherit"
                onClick={() => onSettings(scope)}
                sx={quiet}
                aria-label={s('group.openFor', { name: scope.name })}
              >
                {s('group.open')}
              </Button>
            </Tooltip>
            {/* Never the root, which is not a row here anyway — the guard is
                stated so a tree that one day drew one cannot offer it. */}
            {scope.path !== ROOT_SCOPE && (
              <Tooltip title={s('picker.delete')}>
                <IconButton
                  size="small"
                  aria-label={`${s('picker.delete')} ${scope.name}`}
                  onClick={() => onDelete(scope)}
                  sx={{ color: 'text.secondary' }}
                >
                  ✕
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        )
      })}
    </Box>
  )
}
