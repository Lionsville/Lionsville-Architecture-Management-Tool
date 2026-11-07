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
| `Field.tsx` | **Field** with the label above (`TextField`, `SelectField`, `TextInput`, `TextArea`, `Select`) and **PropertyRow** in `PropertyRows`: 24 px, press to edit, one at a time |
| `Picker.tsx` | **Picker**, in a panel or a form, and `PickerAt` where a canvas landed; `matching` is its search |
| `Segmented.tsx` | **Segmented switch**: a radio group, a menu when it runs out of room below 1024 px |
| `Mark.tsx` | **Mark**: the closed set of sixteen, `MARK_KINDS` |
| `roving.ts` | the arrows of a row of choices, shared by tabs and the switch |
| `listView.ts` | what a list shows as data: find, filters, group, sort, columns, selection; read from and written to the address; the rows a view keeps; *Did you mean* |
| `List.tsx` | **List**: a row is the item and nothing else, one line or wrapped; groups that fold; columns only when asked for; ticks and bulk; the keyboard; focus handed back to the row |
| `FilterWords.tsx` | **Filter words**: Find, Filter, Group and View in one bar; what is on said in words, each with its × |
| `Preview.tsx` | the large **Preview** over a list, opened only by selecting a row: ‹ ›, arrows, Esc back to the row, carried by the address |
| `Panel.tsx` | **Panel**: the one reader and inspector: identity, tabs, body, a foot that helps or undoes |
| `Matrix.tsx` | **Matrix**: fixed headings, a press selects, a key writes, a crosshair and a line in words, rows and columns that fold |
| `NextStep.tsx` | **Next step**: the stepper in words, one question and its verb, what holds it; a sentence once ended |
| `PageState.tsx` | **Truthful page state**: loading, held, empty, offline, unreadable, told apart by type; `pageStateOf` says which is true |
| `RecordPage.tsx` | **Record page**: one head, one scroll, an outline for a long one; edited in a `FocusedWindow` |
| `Band.tsx` | **Band**: a state of the window in words with one way out; `BandStack` never shows two |

What a control always says is in `widgets/strings/`, under `kit.*`.

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

## How a screen composes it

- Imports from the kit by file. A kit component takes data and callbacks, and
  knows no model, no scope and no store: `widgets` may import `i18n` and nothing
  else, so a screen hands the kit what it has already worked out.
- Words come from the screen's module, or from the kit's own strings for what a
  control always says.
- A main control still carries its `data-guide` name, passed in by the screen.
- `readOnly` hides what writes: the screen decides, and the kit draws what it is
  given.

A list is composed the same way every time: `readListView` from the address,
`listed` for the rows, `FilterWords` and `List` over them, `Preview` over those
with `ids` in the order drawn, and `writeListView` on every change.

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
