// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Choose the scope to file something under.
 *
 * The one control shared by "new scope" and a scope's settings, because both
 * ask the same question: where in the tree does this go. A select of what
 * exists makes the common case a click, and there is no "new one…" escape from
 * it any more — creating the scope above is the same gesture as creating this
 * one, so offering it inside would be offering the dialog inside itself.
 *
 * The value is a {@link ScopePath}, which is the address and not a name: the
 * root is the empty string, and it is always in the list, because the
 * organisation is where a first scope goes.
 *
 * The value is always in the list too. A folder made by hand between two
 * scopes is no scope of its own, so the listing hangs what is under it off the
 * nearest one that is (`scopeTree`) — but the address still says where the
 * thing lives, and a select that could not show that would show nothing and
 * read as "nowhere". So the address gets an option of its own, by its path,
 * under its nearest listed ancestor, and leaving the field alone is still not
 * a move.
 */
import { SelectField } from '../widgets/kit/Field'
import type { Translate } from '../i18n'
import { flattenScopes } from '../projects/scope'
import type { ScopeSummary } from '../projects/scope'
import { ancestorScopes, scopeSegments } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'

export type ScopeFieldProps = {
  /** The whole tree, root included. */
  tree: ScopeSummary
  value: ScopePath
  onChange: (next: ScopePath) => void
  label: string
  helperText?: string
  /** A scope that may not be chosen, and neither may anything under it. */
  excluding?: ScopePath
  s: Translate
}

/** An indented name, so the shape of the tree survives a flat select. */
function optionLabel(scope: ScopeSummary, s: Translate): string {
  const depth = scopeSegments(scope.path).length
  const name = scope.name.trim() || (depth === 0 ? s('picker.organisation') : scope.path)
  return `${'  '.repeat(depth)}${name}`
}

/** The options, with a stand-in for a value the listing does not hold, after its nearest listed ancestor. */
function withValue(options: ScopeSummary[], value: ScopePath): ScopeSummary[] {
  if (options.some((scope) => scope.path === value)) return options
  const above = ancestorScopes(value)
    .map((path) => options.findIndex((scope) => scope.path === path))
    .find((index) => index >= 0) ?? -1
  const standIn: ScopeSummary = { path: value, name: '', diagrams: 0, children: [] }
  return [...options.slice(0, above + 1), standIn, ...options.slice(above + 1)]
}

export function ScopeField({
  tree, value, onChange, label, helperText, excluding, s,
}: ScopeFieldProps) {
  const options = withValue(flattenScopes(tree).filter((scope) => (
    excluding === undefined
    || !(scope.path === excluding || scope.path.startsWith(`${excluding}/`))
  )), value)
  return (
    <SelectField
      label={label} value={value} onChange={onChange} {...(helperText ? { hint: helperText } : {})}
      options={options.map((scope) => ({ value: scope.path, label: optionLabel(scope, s) }))}
    />
  )
}
