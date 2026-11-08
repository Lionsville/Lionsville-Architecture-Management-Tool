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
| `Surface.tsx` | what floats over the page (`SurfaceMenu`, `SurfacePopover`, `SurfacePopper`, `pressStaysHere`): a press inside never reaches what lies beneath, a press outside only closes it, the second press of a double press is dropped |
| `Tooltip.tsx` | **Tooltip**: describes a control and does not rename it |
| `Dialog.tsx` | **Dialog** in S, M, L; `DialogChoices`, `DialogFacts`, `DialogDanger` |
| `Progress.tsx` | **Progress**: how far a long piece of work has got, by a number; the browser's own bar, so it is said as one |
| `windowArea.ts` | the window's corner, the one seam with the host: `WINDOW_BAR` on a top bar that stands at the top of the window (clear of the macOS traffic lights, the window's drag handle, its controls presses; nothing in full screen, on Windows, Linux or in a tab), `WINDOW_COVER` on a surface of ours fixed over the whole window, and `showWindowArea`, what the host says on the root. Dialogs, menus and poppers are never drag regions. `build/windowArea.test.ts` holds every full-window surface to it |
| `FocusedWindow.tsx` | the dialog family's full-window member: the window's bar, Cancel that asks, Save; the writing takes the width and height the column of facts leaves, each scrolls on its own, and the facts fold under it on a narrow window (`useInFocusedWindow` for a field that grows) |
| `Toast.tsx` | **Toast**: one, six seconds, Undo or Put back; goes when any dialog opens |
| `Field.tsx` | **Field** with the label above (`TextField`, `SelectField`, `DateField`, `TextInput`, `TextArea`, `Select`, `DateInput`) and **PropertyRow** in `PropertyRows`: 24 px, press to edit, one at a time, a date as a kind of edit, `help` said while edited (`onHelp`), `startOpen` for a row just asked for |
| | `GrowingTextArea`, a box as tall as its text with no scroll of its own, and `TitleField` and `TitleRead`, a record's title written and read in one place and size, for a form that reads as a page |
| `FindField.tsx` | **FindField**, the one field that narrows a page by what is typed: *Find …* as its name and its words, a width its words fit in, Escape to empty it; `fill` where it heads a column |
| `Select.tsx` | **Select**: a short closed list drawn by the kit, a button and a list of choices under it, with a select's keys; never the browser's own (`build/nativeControls.test.ts`) |
| `DateInput.tsx` | **DateInput**: a day typed or chosen from the kit's calendar, `YYYY-MM-DD` or nothing; never the browser's own date field |
| `Switch.tsx` | **Switch**: on or off with its words beside it, a checkbox drawn as a track |
| `FieldBox.tsx` | **FieldBox**: MUI's text field with the kit's label above, for what only MUI's field does (an Autocomplete's input, a select of MUI items); the one place MUI's text field is imported |
| `Picker.tsx` | **Picker**, in a panel or a form, `PickerAt` where a canvas landed and `PickerMany` for several in a row; `matching` is its search |
| `Segmented.tsx` | **Segmented switch**: a radio group, a menu when it runs out of room below 1024 px |
| `Mark.tsx` | **Mark**: the closed set of sixteen, `MARK_KINDS` |
| `roving.ts` | the arrows of a row of choices, shared by tabs and the switch |
| `keys.ts` | the two rules every key handler keeps: the command key is the platform's (`commandKey`: ⌘ on a Mac, Ctrl elsewhere, never either; `chordHeld` where any chord means stand aside; `build/platformModifier.test.ts` holds the tree to it), and one Escape does one thing, innermost first (`claimKey`, `keyClaimed`; the outer listeners hear it in the bubble phase) |
| `listView.ts` | what a list shows as data: find, filters, group, sort, columns, selection; read from and written to the address; the rows a view keeps; *Did you mean* |
| `List.tsx` | **List**: a row is the item and nothing else, one line or wrapped; groups that fold; columns only when asked for; ticks and bulk; the keyboard; focus handed back to the row; `doors`, for rows that are ways on, as on a home: pressable at rest; a row's `rail`, a thin mark at its start in a tone (`--rail-good`, `--rail-bad`, `--rail-neutral`), named in words unless the row says its kind |
| `ListMore.tsx` | **List more**: the end of a list that is not all there, how many are kept back and the button that brings them; `List`'s `more`, or under a map |
| `density.ts` | how much a screen holds: the person's one choice, Comfortable or Compact, named once and offered by Preferences and a list's View alike; the app keeps it and sets it on the root (`density.css`) |
| `FilterWords.tsx` | **Filter words**: Find, Filter, Group and View in one bar; what is on said in words, each with its × |
| `Preview.tsx` | the large **Preview** over a list, opened only by selecting a row: ‹ ›, arrows, Esc back to the row, carried by the address |
| `TreeList.tsx` | **Tree list**: a short tree to choose a part by: nodes that fold and can be picked, a note and a count, one tab stop |
| `Panel.tsx` | **Panel**: the one reader and inspector: identity, tabs, body, a foot that helps or undoes. `PanelDockProvider`: the column holding it says its width and its fold, so a screen hands a panel in without knowing it is docked. `PanelName`, a name pressed to edit, for a record's title too; `PanelLink`, a word that goes somewhere |
| `Matrix.tsx` | **Matrix**: fixed headings, a press selects, a key writes, a crosshair and a line in words, rows and columns that fold |
| `NextStep.tsx` | **Next step**: the stepper in words, one question and its verb, what holds it; a sentence once ended |
| `SettleRow.tsx` | **Settle row**: one value two people left differently, a pair of choices in words, neither the default |
| `PageState.tsx` | **Truthful page state**: loading, held, empty, offline, unreadable, told apart by type; `pageStateOf` says which is true. Offline may name what did not answer and offer somewhere else to go |
| `RecordPage.tsx` | **Record page**: one head, one scroll, an outline for a long one; edited in a `FocusedWindow` |
| `Section.tsx` | **Section**: a heading over part of a page, and **LinkLine**: what a place does not hold, folded into one line of names |
| `FirstRun.tsx` | **First-run page**: what this is, a small picture (`StructurePicture`), the real choices side by side |
| `Frame.tsx`, `placeHost.ts` | **Frame**: two rows, the band, the tree, the main column and the panel, knowing no scope; where a page and a view's tabs are drawn. The rows' contents are `app/frame/` |
| `FirstRunPage.tsx` | **First-run page**: one way forward per intent, and where work is kept, before any exists |
| `SettingsPage.tsx`, `density.css` | **Settings page**: whose they are in its first line, a side list where it has sections, `PreferenceRow`, `SettingSwitch`, `SettingsField` and `focusSettingsField` for a way in that lands on one field; the density switch's measures |
| `Band.tsx` | **Band**: a state of the window in words with one way out; `BandStack` never shows two |
| `zoom.ts` | how far a canvas zooms and what each input means; `canvasZoomProps`, the seam for the three reading distances |
| `useCanvasZoom.ts` | one zoom behaviour for every canvas: ⌘ or Ctrl with + − 0, the wheel, a pinch, ⇧ 1, a board's = − and ⇧ 2 |
| `ViewBar.tsx` | the View bar and its words: one that opens a menu, one that acts, one that opens a panel of acts and settings (`ViewBarPanel`, with `ViewBarAct`, `ViewBarCheck`, `ViewBarHeading`); the order is here and not in the screens |
| `ColourMenu.tsx`, `KeyStrip.tsx` | the one Colour menu, its questions under headings with a long list one level down, and the key strip made from what is drawn, saying what it is of, with Keep and the way to take it down; `all` for a notation, which gathers nothing up |
| `DayControl.tsx` | the one Day control |
| `CanvasDock.tsx` | − n% + Fit 100% Grid Map, bottom left on every zoomable canvas; Grid may open what goes with it, and a note says what the canvas has to say |
| `canvasRoom.ts` | the room a canvas's floating controls leave: the dock marks itself and a key says `data-canvas-float`; `canvasInsets` measures them, `frameInRoom` (`zoom.ts`) frames a drawing in what is left, centred where it fits and from its start where even the floor does not |
| `Card.tsx`, `Zone.tsx`, `Line.tsx` | Card; Zone and boundary; Line and label, with a budget of two lines and a number where the words have no room (`data-labels`). Each holds its size on screen through `--canvas-zoom` |
| `labelSpread.ts` | labels that keep clear of each other and of what they would cover, moving as little as they can |
| `GuideDock.tsx`, `guidePlace.ts` | **Guide dock**: one card in one place, why, what to do, *Tell me more*, Back, Skip, Pause, Next; `GuideRing`, one ring on one target, with no scrim |
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
place in this scope, its views only once one is open or a page is up: on a home
the views are the page's own rows. Nothing below it draws a bar of its own.

**A page is a `PageDialog`.** Keep `open` and `onClose`. In the frame it is a place
in the main column (`role="region"`, `[data-place-page]`), under the rows and over
the view, and with no frame above it, as in the page's own test, it is the dialog
it was. It wears no window bar: row one keeps clear of the window's controls and is
what it is dragged by. `PageClose` and `PageBack` draw nothing in
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

**A source with a far end** speaks on the frame through `SourceFrame` on its
registration (`ports/ProviderParts.ts`): its own status word, a band, what holds a
home it cannot read yet (`holding`, `Hold`), what opens *Your work* (`YourWork`), the
panel `settle`, and the page `agents`, which *Connect an agent* goes to instead of the
dialog. Each is optional: a source that says none of it gets the frame as it is for a
folder.

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
- **Holding still.** The same ref keeps what is drawn where it was on the screen when
  the canvas's left edge moves — the tree docked beside it or put away, its seam
  dragged (`holdOnScreen`). A canvas that scrolls needs nothing more; one with a
  viewport of its own gives its target a `pan(dx)`.
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

## Type

Five sizes and no others: `--t-small` (0.8125rem), `--t-body` (0.9375rem),
`--t-large` (1.0625rem), `--t-title` (1.25rem), `--t-page` (1.625rem), at 13, 15,
17, 20 and 26 px at a browser's default. Hints, captions, table heads, counts,
status lines and tips are small; what is read is body. Code takes the size of what
it stands in. They are in rem, and so is every measure that holds text, so a
browser's text size and `TextSizeControl` reach them: the row grows with its words.
`build/literalFontSizes.test.ts` fails a size written out anywhere else.

A canvas keeps its own type in px (`--canvas-t-*`, `--t-canvas-name`), because the
canvas's zoom is what makes it larger and a card's reading distances depend on it.

A row that runs out of room folds into its More (`useRowFold`), measured and not
at a breakpoint, since what a row needs moves with the language and the text size.
A layout that follows the text is a container query on the frame in rem: a media
query's rem is the browser's and knows nothing of the text size.
