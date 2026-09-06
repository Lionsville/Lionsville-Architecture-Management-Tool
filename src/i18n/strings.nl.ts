/**
 * The Dutch table, composed the same way as the English one.
 *
 * Each slice is typed from its English sibling, so a missing translation is a
 * compile error in the module that owns the word rather than a surprise here.
 */
import { NL as adapters } from '../adapters/strings/nl'
import { NL as app } from '../app/strings/nl'
import { NL as decisions } from '../decisions/strings/nl'
import { NL as documentation } from '../documentation/strings/nl'
import { NL as editor } from '../editor/strings/nl'
import { NL as common } from './strings/nl'
import { NL as model } from '../model/strings/nl'
import { NL as projects } from '../projects/strings/nl'
import { NL as search } from '../search/strings/nl'

export const NL = {
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
