// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** Everything the help says in this language, fetched when the help opens in it. */
import type { HelpText } from '../../types'
import { BACKGROUND } from './background'
import { CHAPTERS } from './chapters'
import { SECTIONS as start } from './start.sections'
import { SECTIONS as frame } from './frame.sections'
import { SECTIONS as work } from './work.sections'
import { SECTIONS as board } from './board.sections'
import { SECTIONS as panel } from './panel.sections'
import { SECTIONS as technology } from './technology.sections'
import { SECTIONS as sheet } from './sheet.sections'
import { SECTIONS as poster } from './poster.sections'
import { SECTIONS as chart } from './chart.sections'
import { SECTIONS as drawing } from './drawing.sections'
import { SECTIONS as decisions } from './decisions.sections'
import { SECTIONS as observations } from './observations.sections'
import { SECTIONS as roadmap } from './roadmap.sections'
import { SECTIONS as registers } from './registers.sections'
import { SECTIONS as operating } from './operating.sections'
import { SECTIONS as people } from './people.sections'
import { SECTIONS as guidance } from './guidance.sections'

export const TEXT: HelpText = {
  chapters: CHAPTERS,
  sections: {
    ...start,
    ...frame,
    ...work,
    ...board,
    ...panel,
    ...technology,
    ...sheet,
    ...poster,
    ...chart,
    ...drawing,
    ...decisions,
    ...observations,
    ...roadmap,
    ...registers,
    ...operating,
    ...people,
    ...guidance,
  },
  background: BACKGROUND,
}
