# Accessibility

*Audited 26 September 2026, against WCAG 2.1 level AA, on the web build and
the desktop app — one renderer, so one audit. What follows is what was checked,
how, what was fixed, and what does not conform yet. It is kept beside the code
so that the next change to a screen can see what it has to keep true.*

## How it is checked

Three kinds of test, all in `npm run check`, so a regression fails the loop
rather than waiting for the next audit.

- **axe-core in the component tests.** `src/app/testing/axe.ts` runs axe over
  the document a jsdom test drew, against the WCAG 2.0 and 2.1 A and AA rules,
  and answers one sentence per failing element; a test asserts the list is
  empty. The main surfaces carry one: the organisation's home and every page
  its cards open (register, technology register, sheet, map, decisions,
  observations, roadmap), a landscape in the editor with its toolbar, tabs,
  palette and board, an element in the inspector on each of its tabs, the
  overflow menu, and the dialogs (preferences, connect an agent, shortcuts,
  password, open into, add from the register, scope settings, diagram
  settings, export, confirm delete, search) — `App.accessibility.test.tsx` and
  a block in each component's own test file. jsdom lays nothing out, so axe's
  colour-contrast and target-size rules are off there.
- **Contrast, measured.** `src/app/theme.contrast.test.ts` computes the WCAG
  ratio of the palette's own pairs in both modes: the inks on the two grounds,
  the accent, text on a contained button, a card's name and second line, the
  error red, and every badge state a card carries. The pairs below 4.5:1 are a
  list the test holds the measurement to, exactly — so fixing one fails the
  test until the list, and this page, say so.
- **The keyboard, pressed.** `SolutionDesignEditor.keyboard.test.tsx` (the
  board and the inspector), `App.keyboard.test.tsx` (the menu and a dialog),
  the tab tests in `SolutionDesignEditor.test.tsx`, and a test over the menu
  table in `canvas/useMenuActions.test.ts` that every action has a keyboard
  path or a declared reason.

No screen reader was run for this audit. The names and roles above are what
axe and the tests read; how NVDA, JAWS or VoiceOver announce the board has not
been heard.

## The keyboard audit

**Focus order.** Tab follows the document: the top bar, the tabs, the
toolbar, the palette, the board, the inspector. On the board, Tab walks the
cards, then the lines, then the names of the domain groups, in the order the
board draws them — not in reading order across the canvas. A card reached by
Tab that is off screen is scrolled into view.

**Every menu action.** The context menus are one table (`MENU_ACTIONS`), and a
menu is reached through what it is opened on: a card, a selection, a line, a
group, the empty board, or a tab. Each of those is reachable without a mouse —
Tab and Enter to select it, then Shift+F10 or the Menu key; with nothing
selected, Shift+F10 opens the board's own menu; on a focused landscape tab,
Shift+F10 opens the tab's menu. One action is not: *Remove bend*, offered on a
single bend of a line, which nothing can focus; the line's own menu has *Remove
all bends*. The test over the table fails when an action is added that no path
reaches and no reason is given for. The File and Help menus are the operating
system's menu bar on the desktop and the `⋯` button on the web, a native
button whose menu is walked with the arrows.

**The inspector without a mouse.** Every control in it is in the Tab order,
except where a pattern puts it elsewhere on purpose: its three tabs are one
stop and the arrows move between them, and an autocomplete's clear and open
buttons are the field's own keys. The arrow keys on the inspector's tabs used
to move the selected card as well; they no longer do.

**Focus visible.** Controls show the browser's or MUI's focus indicator. A
card draws its own ring. A line did not show that it had the focus at all —
its colour is set inline, which React Flow's focus rule cannot override — and
now turns the accent and heavier. A row in the sheet's finder showed focus by
a background too faint to see, and now has an outline.

**Dialogs.** Every dialog is MUI's modal: it takes the focus when it opens,
keeps it while it is open (focus sent elsewhere comes back), closes on Escape
and hands the focus back to where it was.

**The board.** Select: Tab to a card, Enter or Space; Shift+Enter adds it to
the selection; Enter on the card already selected opens its documentation.
Lines and group names are selected the same way. Move: the arrow keys move a
selection by a grid step, Shift+arrow by a pixel, each move a step on the undo
stack; *Move to zone* and *Domain group* in a card's menu move it between
zones and groups. Connect: *Start connection to…* in a card's menu, then Tab to
the other card and Enter. Every line is named by its two ends and its label,
and every card and line tells a screen reader which keys it answers to, in the
app's language.

## Fixed in this audit

- Controls without a name: the rows of the diagram settings' aspect columns
  after the first, the field a new plan is named in, the selects on a plan
  with no visible label and the lists they open, a task item's checkbox in a
  document, a BPMN drawing, the spinners inside buttons (now hidden, with
  `aria-busy` on the button) and the one outside.
- Structure: headings in a document had no level; lists of buttons were
  lists of things that are not list items; the search results, the sheet's
  finder and the inspector's *Uses* picker held text and headings inside a
  listbox; menus held headings and a submenu's frame as if they were items.
- ARIA a role does not allow: names on glyphs, badges, bars and resize grips
  that had no role to carry them.
- Buttons inside buttons: a landscape tab's two small controls. They are now
  the pointer's, out of the accessibility tree, and the tab itself answers ↓
  (its container diagrams) and Shift+F10 (its menu).
- The keyboard: lines and groups could be focused but not selected; a line
  could not be drawn without a mouse; Enter on a second card opened the first
  one's documentation as well as selecting the second; the arrows on the
  inspector's tabs moved the selection.

## Does not conform yet

- **Pointer only.** Resizing a card, a band, a group or the canvas; moving a
  group; bending a line, moving or removing one bend, and moving a line's end to
  another card. The keyboard's alternatives are partial: a group's members move
  with their cards, and a line can be deleted and drawn again.
- **Contrast (1.4.3).** Six badge states on a card are below 4.5:1 — in the
  light theme *partial* (3.3), *none* (2.7), *retiring* (3.3) and *retired*
  (2.6); in the dark theme *at risk* (3.9) and *retired* (3.6) — and the
  error red on a panel in the dark theme is 4.4:1. Badge text is 8 pixels. Each
  badge's state is also its accessible name and is written out in the
  inspector. The contrast of component outlines and dividers against their
  ground (1.4.11) has not been measured.
- **The board to a screen reader.** Cards and lines are named and selectable,
  but the board's structure — which band a card is in, what crosses what — is
  carried by names and the menus rather than by the reading order, and the
  order Tab walks is the drawing order, not the layout.
- **Not assessed.** Reflow at 320 CSS pixels and 400 % zoom (1.4.10), text
  spacing (1.4.12), content on hover (1.4.13) beyond MUI's tooltips, and the
  desktop's native menu bar, whose keyboard access is the operating system's.
