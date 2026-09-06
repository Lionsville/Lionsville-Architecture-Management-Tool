/**
 * The English table — and, because it is `as const`, the SCHEMA.
 *
 * Composed, not written. Each module owns the words for the screens it draws and
 * keeps them beside them; this file is the one place that says which modules
 * there are and puts their slices together. `StringKey` is `keyof typeof EN`
 * (see `table.ts`), so the composition decides which keys exist, and
 * `strings.test.ts` refuses two slices that define the same one.
 *
 * English is also the fallback: `t()` reaches for this table when a key is
 * missing elsewhere, and `DEFAULT_TRANSLATE` is bound to it. So a value in any
 * slice is never allowed to be a placeholder or a TODO — it is what somebody
 * will actually read.
 */
import { EN as adapters } from '../adapters/strings/en'
import { EN as app } from '../app/strings/en'
import { EN as decisions } from '../decisions/strings/en'
import { EN as documentation } from '../documentation/strings/en'
import { EN as editor } from '../editor/strings/en'
import { EN as common } from './strings/en'
import { EN as model } from '../model/strings/en'
import { EN as projects } from '../projects/strings/en'
import { EN as search } from '../search/strings/en'

export const EN = {
  ...adapters,
  ...app,
  ...decisions,
  ...documentation,
  ...editor,
  ...common,
  ...model,
  ...projects,
  ...search,
} as const
