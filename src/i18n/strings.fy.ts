/**
 * The Frisian table, composed the same way as the English one.
 *
 * Each slice is typed from its English sibling, so a missing translation is a
 * compile error in the module that owns the word rather than a surprise here.
 */
import { FY as adapters } from '../adapters/strings/fy'
import { FY as app } from '../app/strings/fy'
import { FY as decisions } from '../decisions/strings/fy'
import { FY as roadmap } from '../roadmap/strings/fy'
import { FY as documentation } from '../documentation/strings/fy'
import { FY as editor } from '../editor/strings/fy'
import { FY as common } from './strings/fy'
import { FY as model } from '../model/strings/fy'
import { FY as platform } from '../platform/strings/fy'
import { FY as projects } from '../projects/strings/fy'
import { FY as search } from '../search/strings/fy'

export const FY = {
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
