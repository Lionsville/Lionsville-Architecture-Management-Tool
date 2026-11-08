// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { GettingStartedText } from '../../types'

/** Getting started: what the help opens on, read in two minutes. */
export const START: GettingStartedText = {
  title: 'Getting started',
  intro: 'Six steps, two minutes. Each says what to press; the chapters after it say the rest when you need it.',
  steps: [
    {
      title: 'What it is for',
      text: 'Lionsville Architect keeps your organisation\'s architecture in one place: the applications and the lines between them, the business they serve, the units and people who answer for them, and the decisions, observations and plans about all of it. Work is kept in **scopes**: the organisation, and the domains and teams filed under it.',
      picture: 'A scope\'s home: its name, the views it holds and what is kept there.',
    },
    {
      title: 'The frame',
      text: 'Every screen stands in the same frame. **Row one** says where you are, finds anything ({key:Mod+K}), undoes, and says whether your work is safe. **Row two** holds this scope\'s places: Home, its views, Decisions, Observations, Roadmap. The **tree** of scopes is on the left; the **panel** on the right shows whatever you select.',
      picture: 'The frame: row one, row two with the scope\'s places, the tree on the left and the panel on the right.',
    },
    {
      title: 'Open a scope and a view',
      text: 'Press a scope in the tree to read its home. Under **Views here**, press a view — the application landscape, the business architecture, the organisation chart — and it opens with a tab in row two. **‹** in row one goes back to where you were.',
      picture: 'A scope\'s home with its views listed under Views here.',
    },
    {
      title: 'Add and connect',
      text: 'On a board, press **Add** in the bar, or double-press an empty place, and type a name. To connect two cards, point at one and drag from the dot on its edge to the other. Select anything to read and change it in the panel. {key:Mod+Z} takes back any step.',
      picture: 'A board with two cards and the line between them, and the panel of the card that is selected.',
    },
    {
      title: 'Record an observation',
      text: 'Noticed something — two systems quoting different prices, a slow handover? Open **Observations** in row two and press **New observation**. Say what you saw in a few words. Later, **Ask why** to find its cause, and propose a solution for the root cause.',
      picture: 'The observations page: what was seen, the causes behind it and the solution proposed.',
    },
    {
      title: 'Where to go next',
      text: 'Press the **?** in row one, or F1, on any screen: the help opens at that screen. Press **?** on the keyboard, outside a text field, for the keyboard shortcuts. Every panel has a **?** in its head too. To read on, start with *Finding your way* and *Landscape boards and container diagrams*.',
      picture: 'Row one with the ? that opens the help at this screen, and Help beside it.',
    },
  ],
}
