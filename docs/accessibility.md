# Accessibility

*Audited 26 September 2026, against WCAG 2.1 level AA, on the web build and
the desktop app — one renderer, so one audit — and followed up the same day
for contrast, MUI's own labels, reflow, text spacing and the focus ring. What
follows is what was checked, how, what was fixed, and what does not conform
yet. It is kept beside the code so that the next change to a screen can see
what it has to keep true.*

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
  ratio of every pair the theme and the board draw with, in both modes, each
  over the layers it actually sits on: the inks and every palette colour on
  the two grounds, every contained button and every alert as MUI paints them,
  a zone's and a domain group's label on its tint, a card's and every other
  node's text over each zone, a line's label, and every badge state. Text
  fails below 4.5:1; the focus ring, a field's outline, a card's focus and
  selection rings and a line on the board fail below 3:1 (1.4.11). The
  disabled ink (`text.disabled`) is for a control that is off, which 1.4.3
  exempts, and a test there holds the source to that: a new use of it fails
  until it is one of the listed kinds — a separator glyph, a chevron, a
  retired bar, a border beside a name.
- **Reflow, held in the source.** jsdom lays nothing out, so
  `src/app/reflow.test.ts` holds every bar that covers the window's width to
  wrapping rather than overlapping itself, and a shell bar's quiet buttons to
  keeping their width. What 400 % zoom looks like was checked by eye, in a
  320 × 256 frame (see *Reflow and zoom* below).
- **MUI's own words.** `src/app/theme.locale.test.tsx` renders an
  autocomplete and a toast in each language and reads the names MUI gave
  their buttons.
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

**Focus visible.** Every control MUI draws shows MUI's own focus ring — a
2px outline in the accent, at least 3:1 against both grounds in both modes,
drawn inside the control where a parent would clip it (a tab, a menu item).
Until the follow-up it showed MUI's default, a faint tint of the control's
own background, which on a quiet button in the bar was hard to find. A field's outline, which MUI draws at 1.6:1, is 3:1 now. A
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

## Fixed in the follow-up

- **Contrast.** The six badge states and the dark mode's red are above 4.5:1:
  the quiet badge states (*none*, *not set*, *retired*) in the secondary ink
  rather than the disabled one, MUI's orange and light blue a step darker in
  the light mode (they were 3.1 and 3.9 as text on paper) and its red a step
  lighter in the dark, with the lighter red of a badge on its tint. The zone
  labels on the board were 3.3 and 3.8 and are in the secondary ink too. MUI
  picks black or white for a button's label by whichever reaches 4.5:1 now,
  not 3:1. Words that were drawn in the disabled ink — an empty list's
  sentence, a name nobody defined, a menu's shortcut, the agent button when
  off — are in the secondary ink.
- **MUI's own labels.** An autocomplete's clear, open and close buttons,
  what its list says when it is empty, and a toast's close button were
  English on every screen. The theme carries MUI's locale for the language
  that is on (Dutch and German; English is MUI's default).
- **Reflow.** At 320 CSS pixels every bar across the top of a screen drew its
  labels over each other, and the editor's toolbar ran 280 pixels off the
  side of the window. Every such bar now takes a second row.

## Reflow and zoom

Checked at 320 × 256 CSS pixels — a 1280 × 1024 window at 400 % — by loading
the web build into a frame of that size, which lays out as a desktop window
does rather than as a phone.

- **The homes and the register pages reflow**: the organisation's and a
  scope's home and the technology register scroll down only, with nothing
  past the right edge once the bars wrap; the application register's rows
  are 20 pixels wider than the window and scroll sideways by that much. At
  256 pixels high, though, the bar over a home (three rows) and a page's own
  bar (two) leave the page a strip of about a third of the window.
- **The pages with a list beside a reader do not**: decisions, observations
  and the documentation page keep their two columns side by side, 646 to 660
  pixels wide, and the reader is reached by scrolling sideways. Stacking them
  below a width is the fix, one page at a time.
- **The board is the exception 1.4.10 makes** for content that needs two
  dimensions to mean anything: a landscape is a picture of where things sit
  relative to each other, and it pans and zooms on its own. What is around it
  wraps, but at 256 pixels high the bars, the palette and the inspector leave
  the board no height at all. At 200 % (640 × 512) the board is 350 pixels
  high and, with the palette and the inspector open, 76 wide; each folds away
  with its own button, and then the board has the window's width. Folding
  them by themselves below a width is the fix.

## Text spacing

Checked with the 1.4.12 values applied to every element — line height 1.5,
paragraph spacing 2em, letter spacing 0.12em, word spacing 0.16em.

- **The organisation's home, the bars and the palette** take them without
  losing anything: the bars wrap where they grew, and nothing is clipped.
  The other pages were not checked one by one.
- **The board's cards do not.** A card's size is a fact of the diagram, not of
  its text, so a longer line is cut: with the spacing applied, 35 names and
  descriptions on the example landscape end in an ellipsis where 9 did before,
  and a badge's letters can be cut by its box. Every one is said in full in
  the inspector, on the element's page and as the card's accessible name.

## Does not conform yet

- **Pointer only.** Resizing a card, a band, a group or the canvas; moving a
  group; bending a line, moving or removing one bend, and moving a line's end to
  another card. The keyboard's alternatives are partial: a group's members move
  with their cards, and a line can be deleted and drawn again.
- **Contrast, what is left (1.4.3, 1.4.11).** A retired element's card is
  drawn at 55 % opacity when the board shows the lifecycle, on purpose, and
  its text falls below 4.5:1 with it. A card's border and the dividers are
  not measured: a card is known by its name and its fill, and a divider
  separates rather than identifies. A picture exported in the other mode
  than the one on screen is drawn with MUI's default palette, not this one
  (`src/editor/useExport.ts`).
- **Text spacing (1.4.12)** on the board's cards, above.
- **Reflow (1.4.10)**: the editor at 400 %, and the three pages with a list
  beside a reader, above.
- **The board to a screen reader.** Cards and lines are named and selectable,
  but the board's structure — which band a card is in, what crosses what — is
  carried by names and the menus rather than by the reading order, and the
  order Tab walks is the drawing order, not the layout.
- **Not assessed.** Content on hover (1.4.13) beyond MUI's tooltips, and the
  desktop's native menu bar, whose keyboard access is the operating system's.
