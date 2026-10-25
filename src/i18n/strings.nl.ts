// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The Dutch table, composed the same way as the English one.
 *
 * Each slice is typed from its English sibling, so a missing translation is a
 * compile error in the module that owns the word rather than a surprise here.
 */
import { NL as adapters } from '../adapters/strings/nl'
import { NL as providers } from '../providers/strings/nl'
import { NL as app } from '../app/strings/nl'
import { NL as decisions } from '../decisions/strings/nl'
import { NL as observations } from '../observations/strings/nl'
import { NL as operating } from '../operating/strings/nl'
import { NL as roadmap } from '../roadmap/strings/nl'
import { NL as documentation } from '../documentation/strings/nl'
import { NL as editor } from '../editor/strings/nl'
import { NL as common } from './strings/nl'
import { NL as model } from '../model/strings/nl'
import { NL as platform } from '../platform/strings/nl'
import { NL as projects } from '../projects/strings/nl'
import { NL as search } from '../search/strings/nl'
import { NL as business } from '../business/strings/nl'
import { NL as technology } from '../technology/strings/nl'
import { NL as people } from '../people/strings/nl'
import { NL as comments } from '../comments/strings/nl'
import { NL as principles } from '../principles/strings/nl'
import { NL as blocks } from '../blocks/strings/nl'

export const NL = {
  ...adapters,
  ...providers,
  ...app,
  ...decisions,
  ...observations,
  ...operating,
  ...roadmap,
  ...documentation,
  ...editor,
  ...common,
  ...model,
  ...platform,
  ...projects,
  ...search,
  ...business,
  ...technology,
  ...people,
  ...comments,
  ...principles,
  ...blocks,
} as const
