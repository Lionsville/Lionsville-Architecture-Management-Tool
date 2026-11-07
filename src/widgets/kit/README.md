# The kit

One design system, and the components every screen is composed from
(ADR-0045). A screen says what it shows; how a list, a panel or a status looks
and behaves is said here, once.

## What is here

| File | What it is |
|---|---|
| `tokens.ts` | every colour, type size and frame measure, in both modes. The only place a colour is written |
| `oklch.ts` | OKLCH and sRGB both ways, and the WCAG ratio |
| `accent.ts` | an accent somebody chose, as the shades each mode draws it in, or why it is refused |
| `fonts/` | Source Sans 3 and Source Code Pro as woff2, with their licence |
| `Button.tsx` | **Button** (primary, plain, quiet, danger; working; refused with its reason) and `IconButton`, for a glyph with a required name |
| `Tabs.tsx` | **Tabs**, on by edge, with a count, and `TabPanel` |
| `Menu.tsx` | **Menu** from a list of entries (final acts last, refused with a reason, one level of submenu), `MenuButton`, `MoreMenu` |
| `Tooltip.tsx` | **Tooltip**: describes a control and does not rename it |
| `Dialog.tsx` | **Dialog** in S, M, L; `DialogChoices`, `DialogFacts`, `DialogDanger` |
| `FocusedWindow.tsx` | the dialog family's full-window member: window chrome, Cancel that asks, Save |
| `Toast.tsx` | **Toast**: one, six seconds, Undo or Put back; goes when any dialog opens |
| `Field.tsx` | **Field** with the label above (`TextField`, `SelectField`, `TextInput`, `TextArea`, `Select`) and **PropertyRow** in `PropertyRows`: 24 px, press to edit, one at a time, a date as a kind of edit, `help` said while edited (`onHelp`), `startOpen` for a row just asked for |
| `Picker.tsx` | **Picker**, in a panel or a form, `PickerAt` where a canvas landed and `PickerMany` for several in a row; `matching` is its search |
| `Segmented.tsx` | **Segmented switch**: a radio group, a menu when it runs out of room below 1024 px |
| `Mark.tsx` | **Mark**: the closed set of sixteen, `MARK_KINDS` |
| `roving.ts` | the arrows of a row of choices, shared by tabs and the switch |
| `listView.ts` | what a list shows as data: find, filters, group, sort, columns, selection; read from and written to the address; the rows a view keeps; *Did you mean* |
| `List.tsx` | **List**: a row is the item and nothing else, one line or wrapped; groups that fold; columns only when asked for; ticks and bulk; the keyboard; focus handed back to the row |
| `listDensity.ts` | how close a person likes every list's rows: one choice for the product, which the app keeps |
| `FilterWords.tsx` | **Filter words**: Find, Filter, Group and View in one bar; what is on said in words, each with its × |
| `Preview.tsx` | the large **Preview** over a list, opened only by selecting a row: ‹ ›, arrows, Esc back to the row, carried by the address |
| `TreeList.tsx` | **Tree list**: a short tree to choose a part by: nodes that fold and can be picked, a note and a count, one tab stop |
| `Panel.tsx` | **Panel**: the one reader and inspector: identity, tabs, body, a foot that helps or undoes. `PanelDockProvider`: the column holding it says its width and its fold, so a screen hands a panel in without knowing it is docked. `PanelName`, a name pressed to edit, for a record's title too; `PanelLink`, a word that goes somewhere |
| `Matrix.tsx` | **Matrix**: fixed headings, a press selects, a key writes, a crosshair and a line in words, rows and columns that fold |
| `NextStep.tsx` | **Next step**: the stepper in words, one question and its verb, what holds it; a sentence once ended |
| `SettleRow.tsx` | **Settle row**: one value two people left differently, a pair of choices in words, neither the default |
| `PageState.tsx` | **Truthful page state**: loading, held, empty, offline, unreadable, told apart by type; `pageStateOf` says which is true |
| `RecordPage.tsx` | **Record page**: one head, one scroll, an outline for a long one; edited in a `FocusedWindow` |
| `Section.tsx` | **Section**: a heading over part of a page, and **LinkLine**: what a place does not hold, folded into one line of names |
| `FirstRun.tsx` | **First-run page**: what this is, a small picture (`StructurePicture`), the real choices side by side |
| `Frame.tsx`, `placeHost.ts` | **Frame**: two rows, the band, the tree, the main column and the panel, knowing no scope; where a page and a view's tabs are drawn. The rows' contents are `app/frame/` |
| `FirstRunPage.tsx` | **First-run page**: one way forward per intent, and where work is kept, before any exists |
| `SettingsPage.tsx`, `density.css` | **Settings page**: whose they are in its first line, a side list where it has sections, `PreferenceRow`, `SettingSwitch`; the density switch's measures |
| `Band.tsx` | **Band**: a state of the window in words with one way out; `BandStack` never shows two |
| `zoom.ts` | how far a canvas zooms and what each input means; `canvasZoomProps`, the seam for the three reading distances |
| `useCanvasZoom.ts` | one zoom behaviour for every canvas: ⌘ or Ctrl with + − 0, the wheel, a pinch, ⇧ 1, a board's = − and ⇧ 2 |
| `ViewBar.tsx` | the View bar and its two kinds of word; the order is here and not in the screens |
| `ColourMenu.tsx`, `KeyStrip.tsx` | the one Colour menu, and the key strip made from what is drawn |
| `DayControl.tsx` | the one Day control |
| `CanvasDock.tsx` | − n% + Fit 100% Grid Map, bottom left on every zoomable canvas |
| `Card.tsx`, `Zone.tsx`, `Line.tsx` | Card; Zone and boundary; Line and label. Each holds its size on screen through `--canvas-zoom` |
| `TimeAxis.tsx`, `timeScale.ts` | the ruler, its rows, bars and milestones; the sums, with the window as plain data |
| `TimeStrip.tsx` | one record's own time, under its head: its milestones named and dated, today marked |
| `PressName.tsx` | a record's name: a heading that a press makes a field, where it may be written |

What a control always says is in `widgets/strings/`, under `kit.*`.

`Menu`'s `holds` lists what holds a refused choice under it, each line a way to what clears it. `RecordPage`'s sections may carry a `group`, a `count`, an `aside`, and be `folded` until asked for; `section` and `onSection` tie them to the address.

A component arrives with its own file, a test beside it, and a line in this
table.

## How a value reaches the screen

```
tokens.ts ─┬─ tokenVariables  → custom properties on the root, for static CSS   var(--ink)
           ├─ MUI's palette   → MUI's CSS variables, for a control MUI draws    --mui-palette-…
           └─ tokensOf(theme) → resolved values, for sums and for what is drawn
                                outside the page: the canvas's tokens, an export
```

`app/theme.ts` does all three. `app/theme.contrast.test.ts` measures the pairs,
in both modes: a token that carries words goes in that test.

A subtree drawn in the other mode, such as a picture exported from a dark window
in the light theme, sets `tokenVariables(mode)` on its own root.

## The names

These are the components the screens are composed from. A name stands for one
component: a screen that needs a variant asks for it here, and does not draw its
own.

- **Frame**: Frame (row one, row two), Scope tree and trail, Status word and Your
  work, Command palette and commands table, View bar, Segmented switch, Band
- **Reading and editing**: Panel, Field and property row, List, Filter words,
  Matrix, Next step, Record page, Comment thread, Settle row
- **Speaking**: Dialog, Toast, Truthful page state, First-run page, Mark
- **Canvas**: Colour menu and key strip, Day control, Canvas dock, Card, Zone and
  boundary, Line and label, Picker, Time axis
- **Helping**: Guide dock, Agent strip and steps
- **Controls**: Button, Tabs, Menu, Tooltip

Only what the table above lists is built. Each is added when a screen first needs
it, under this name, so that the second screen finds it.

## How a screen plugs into the frame

The frame (`app/frame/AppFrame.tsx`) stands above every screen and does not move:
row one says where you are and whether your work is safe, row two lists every
place in this scope. Nothing below it draws a bar of its own.

**A page is a `PageDialog`.** Keep `open` and `onClose`. In the frame it is a place
in the main column (`role="region"`, `[data-place-page]`), under the rows and over
the view, and with no frame above it, as in the page's own test, it is the dialog
it was. Do not pass `windowChrome` duties: row one keeps clear of the window's
controls and is what it is dragged by. `PageClose` and `PageBack` draw nothing in
the frame, except *back to reading* while a page is being written, since a page is
left by Esc, *Home*, a view's tab or Back. Do not add a ×.

**A page gets an address** in three lines, and that is what makes it reachable by
a person, a link and an agent alike:

1. `agent/screen.ts`: its name in `PAGES` (and `HOME_PAGES` where it is the
   organisation's), and its tabs in `PAGE_TABS`.
2. `app/frame/places.ts`: a line in `SCOPE_PLACES`, `ORGANISATION_PLACES` or
   `MORE_PLACES`. Row two, the foot of the tree, More and ⌘K all read that table.
3. Say it on the screen: `useWorkspacePages`'s `page()` for a scope's page,
   `useHomePages` for a home's. `app.open` and Back then arrive through `openFor`.

**Tabs.** `const [tab, setTab] = usePlaceTab('first')` from `widgets/placeTab.ts`
instead of a `useState`, with the tab named in `PAGE_TABS`. The address says
`?tab=`, an agent's `app.open` takes it, and a reload stays on it.

**To go somewhere** is one call: `parts.agent.openSomewhere({ scope, page, id, tab })`,
the way `app.open` goes (`navigation.onOpenScope` from inside a workspace). Never
close a page and open another by hand; opening one closes the others.

**What only a screen knows** it tells the frame with `useFrameFacts` from
`app/frame/frameStore.ts`: its undo and redo, its save state, the way into its
search and settings, its bands. A workspace and a home do this already, and a page
under them does not need to. A band that belongs to one screen goes in `bands`;
`BandStack` never shows two, and the agent's comes first.

**A view** is drawn in the editor's `pages` slot as before. Its tabs move into row
two by themselves (`usePlaceHost().views`). What is left in its own bar is the
View bar: never undo, never the save word, never search.

**A panel** beside the work is the one `Panel` and is either a screen's own, in its
column, or one of the frame's: `FRAME_PANELS`, `#/…?panel=work`, opened with
`parts.agent.setPanel`. A source says its own part of *Your work* with
`AppProvider.yourWork`, and whether it is connected with `connected()`, then
`onWork` when that moves: the status word is asked again and cannot say *sent*
while it is offline.

**A command** goes in `platform/menu.ts`, which is the desktop's menu bar, the ⋯,
the ? menu, ⌘K and the sheet of keys (`app/frame/commandsTable.ts`). It must have a
handler with nothing open (`useShellCommands`): an item that does nothing from the
organisation's home is a defect.

In a test of a whole app: `placePage()` from `app/testing/placePage.ts` is what
`findByRole('dialog')` was for a page.

## How a screen composes it

- Imports from the kit by file. A kit component takes data and callbacks, and
  knows no model, no scope and no store: `widgets` may import `i18n` and nothing
  else, so a screen hands the kit what it has already worked out.
- Words come from the screen's module, or from the kit's own strings for what a
  control always says.
- A main control still carries its `data-guide` name, passed in by the screen.
- `readOnly` hides what writes: the screen decides, and the kit draws what it is
  given.

A list is composed the same way every time: `usePlaceListView('<page>')` for what
it shows, which is in the address (`?q=`, `?group=`, `?sort=`, `?cols=`, `?f.<field>=`)
with the record picked as the place's id; `listed` for the rows, `FilterWords` and
`List` over them, `Preview` over those with `ids` in the order drawn. A page with
records to pick adds itself to `RECORD_PAGES` in `agent/place.ts`, so picking one
is not a step Back walks through.

## How a canvas uses it

- **Zoom.** `useCanvasZoom(target)` gives the callback ref for the canvas's element,
  and `steppedZoomTarget` makes the target from a zoom, a way to set it and a fit.
  A canvas that zooms on the wheel by itself says `wheel: false`, and one with a
  keymap `plainKeys: false`. On the desktop the menu bar owns ⌘ + − 0
  (`setHostOwnsZoomKeys`), because a menu accelerator fires even when the page
  handled the key; its items reach the canvas in use through `zoomCanvasInUse`,
  and the window's own zoom when there is none.
- **Distance.** The element round the drawing spreads `canvasZoomProps(zoom)`. That
  is all the Card, Zone, Line and label need: they hold their size on screen through
  `--canvas-zoom`, and `data-distance` says what each shows, in CSS, so a zoom
  renders nothing. Far is below 70%, near above 120%. What goes at which distance is
  in `Card.css` and `Line.css`.

## How a kit component is styled

**Static CSS on anything that repeats.** A row, a card or a cell is drawn hundreds
of times, and measured over 500 cards a plain element with a class costs a
fraction of a `Box` with `sx`. So a kit component keeps its own `Name.css` beside
it, classes named `kit-<name>` and `kit-<name>__<part>`, every value a `var(--…)`
from the tokens, and a state said as a data attribute. No `Box` or `Typography`
inside a card or a row.

**MUI behind the kit where it earns its place**: a dialog's focus trap, a menu's
keyboard, an autocomplete. A screen gets the kit's name for it, and the props do
not include `sx`.

## What a screen may not do

- Write a colour. `build/literalColours.test.ts` holds every file to the literals
  it has now, and a new file to none; the count only goes down.
- Draw a second list, panel, dialog, status text or empty state. Add what is
  missing to the kit, generically, with a test.
- Use `sx` for more than small layout: a gap, a margin, a flex.
- Say a status by hue alone. A mark's shape carries the meaning, and colour
  answers one question at a time.
- Use the accent for anything but the accent's job: where you are, what is
  picked, what the main action is. No status wears it, and no accent may look
  like a status (`accent.ts`).
