/**
 * The German table, composed the same way as the English one.
 *
 * Each slice is typed from its English sibling, so a missing translation is a
 * compile error in the module that owns the word rather than a surprise here.
 */
import { DE as adapters } from '../adapters/strings/de'
import { DE as app } from '../app/strings/de'
import { DE as decisions } from '../decisions/strings/de'
import { DE as roadmap } from '../roadmap/strings/de'
import { DE as documentation } from '../documentation/strings/de'
import { DE as editor } from '../editor/strings/de'
import { DE as common } from './strings/de'
import { DE as model } from '../model/strings/de'
import { DE as platform } from '../platform/strings/de'
import { DE as projects } from '../projects/strings/de'
import { DE as search } from '../search/strings/de'

export const DE = {
  ...adapters,
  ...app,
  ...decisions,
  ...roadmap,
  ...documentation,
  ...editor,
  ...common,
  ...model,
  ...platform,
  ...projects,
  ...search,
} as const
