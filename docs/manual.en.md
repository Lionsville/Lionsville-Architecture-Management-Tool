# User manual

The Lionsville Architecture Management Tool draws an application landscape in
Layer-7 bands and the C4 container diagrams underneath it. This is the manual
for using it. What it is and why it exists is in the [README](../README.md);
the Dutch version of this manual is [manual.nl.md](manual.nl.md).

## Starting

**Desktop.** Download the installer for your platform from the
[releases page](https://github.com/Lionsville/Lionsville-Architecture-Management-Tool/releases/latest).
The app checks that page for a newer version in the background and tells you
when there is one — **Download…** opens the installer in your browser, **Skip
This Version** says not this one, and the checkbox in that dialog turns the
automatic check off. Nothing installs itself. **Check for Updates…** in the app
menu asks on request.

**Browser.** From a clone of the repository, `npm run setup` once and then
`npm run dev`; open <http://127.0.0.1:5200>. Where the browser offers it —
Chromium does — a tab can work in a folder just as the desktop does. Where it
does not, everything you make lives in that browser's storage until you save a
file.

Nothing leaves your machine either way. There is no account, no backend and no
telemetry.

## The organisation screen

The app opens on the **organisation** — the working folder itself, which is a
scope like any other and the one everything else is filed under. A **scope** is
one document: a name, a landscape, the container diagrams under it, the
decisions, the plans, the business architecture, and everything placed on them.
Scopes **nest**, and every one of them is the same document — the organisation
at the top, a **domain** under it, a **landscape** under that, as deep as your
work needs.

The screen is the organisation's home rather than a list of documents, and it
has four parts.

![The organisation screen: the name and links at the top, the organisation's own pages as cards, the tree of domains and landscapes, and the examples last](screenshot-organisation.png)

**Its identity**, at the top: the name, the client if the drawings are made out
to somebody else, how many domains and landscapes are filed under it, when
anything in it last changed, the description, and its links. A folder nobody has
named yet asks for a name here instead of showing a heading.

**Its own pages**, as four cards. **Business architecture** counts the journeys,
areas, functions and stakeholders the organisation itself holds and says how
many functions nobody has handed to a domain yet; **Decisions** counts its
records by status and names the newest; **Roadmap** counts its plans and shows
the first thing their dates disagree about. **Register** — every application
across the whole organisation — is not built yet, and its card says so rather
than showing a number nothing derived. Each of the first three opens the
organisation on that page; closing the page brings you back here.

**The tree**, beneath: one row per scope, the children indented, with a chevron
to fold a domain shut. A row says how much is inside it — landscapes and
diagrams over the whole subtree for a domain, diagrams for a landscape — and
when it last changed. Under that, where there is anything to say, it carries
its **findings**: how many names two scopes both claim, how many copies have
gone stale, and the rest of *One name across the organisation* below.
**Order** lists by name or by what you changed most recently.

- **Open** enters a scope that draws something. A scope that draws nothing is a
  domain: everything filed under it is listed, and there is no canvas to show.
- **New scope…** asks for a name and which scope to file it under. Every row has
  one of its own, which is the quick way to add under that scope.
- **Settings…** on any row holds its name, what it is (organisation, domain,
  programme, landscape — a word for the screen, nothing behaves differently),
  a client, a description, links, and **Filed under**, which moves it.
- **Delete** removes the scope and everything filed under it: its folder on the
  desktop, its records in the browser. A working file you saved elsewhere is not
  touched. The organisation itself cannot be deleted — it is the folder you
  opened.

**Examples**, last. Copying one into an empty, unnamed folder makes the example
*the* organisation; copying it into a folder that is already something files it
under a new scope of its own. Either way it is yours from that moment, and
nothing you do runs against the example itself.

Renaming a scope relabels it and nothing else — where it is filed is its
address, and renaming is not moving. Moving one changes the address of the scope
and of everything under it, and leaves the content untouched. On boot the app
reopens the scope you had open.

Six names are refused, because a scope's own folders use them already:
`diagrams`, `docs`, `decisions`, `transitions`, `images` and `logos`.

## One name across the organisation

A name means the same thing everywhere in your folder. The warehouse system is
one system whichever domain draws it, and a capability the organisation names
is that capability wherever a landscape refines it — so each thing is written
down **once**, in one scope, and every other scope that uses it points at the
same one.

**The scope that writes it down answers for it.** That record carries the
detail: what phase it is in and on which dates, who owns it, which vendor sells
it, what it is built on, its maturity. Change any of it there and everywhere
that draws it says the new thing.

**Everywhere else holds a stand-in** — a card that draws the thing without
answering for it. A stand-in shows its name with a small **from …** line
underneath saying where it is really defined, and its inspector says the same
with a button to go there. Its name and that line are copies, so they are shown
read-only, and so is everything in the owner's detail; what a stand-in *can*
carry is **its own description** — what the ERP means to the warehouse is a
different page from what the ERP is, and both are worth writing. So are the
colour, the shape and the icon you give it, and where you put it on your own
boards.

Which scope answers for a thing is decided by **depth**: the deepest scope that
writes it down. That one rule works in both directions, which is the point.
Capabilities are written at the organisation and refined downwards, so the
organisation keeps them. Applications are written in the landscape that runs
them, so a domain keeps its own — and an organisation that lists an application
by name before anybody has detailed it is naming a placeholder that steps aside
the moment somebody deeper writes the real record.

### What a finding means

The app never refuses a save over any of this. It reads the whole folder when
it opens — and again whenever the folder changes under it — and reports what it
finds. Each row of the tree on the organisation screen carries its own line.

- **Conflict** — two scopes at the same level both write down the same name.
  Somebody is mid-migration, or two teams named the same thing on the same
  afternoon. Both rows say so, because neither of them is the wrong one. Turn
  one into a stand-in of the other.
- **Drifting** — a stand-in's copy of the name is not what the owning scope
  calls it any more, or the scope it points at has moved. **Refresh** writes the
  copies back in one step, which you can undo like anything else.
- **Undefined** — a stand-in of something nothing in the folder writes down. The
  card is drawn and the line is kept; what it needs is a record somewhere to
  point at.
- **A loose row** — a line that ends on something nothing in the folder holds.
  Kept and drawn as a stub, never dropped by a save.
- **A proposal** — a capability a domain named that no scope above it has. Not a
  fault: it is a conversation with the level above.
- **Without an owner** — a system marked as somebody else's that nobody has said
  whose it is.

One thing on the list is **information rather than a fault**: a record no board
in its own scope draws. A thing can be real, owned and documented without being
on anybody's picture yet, so it is counted apart and never coloured like a
finding.

## Your working folder (desktop)

The first time the desktop app runs it asks for a **folder to work in**, and
everything you make lives there as files you can read:

```
<your folder>/
  scope.json                          the organisation: its name, client, links
  acme-logistics/                     a scope under it
    scope.json                        the same file again, one level down
    warehouse-landscape/              and again
      scope.json                      what it is called, and what it holds
      model.json                      the elements and the lines between them
      diagrams/landscape.json         what a diagram is
      diagrams/landscape.geometry.json     where its elements sit
      docs/warehouse.md               an element's description, as prose
      decisions/0007-one-writer.md    a decision record
      logos/own.svg                   a logo you uploaded
```

A folder holding a `scope.json` is a scope, and the folders inside it that hold
one are the scopes under it. Move a folder in your file manager and the scope is
at its new address; nothing inside it says where it lives.

**A folder from an older version opens.** The first time this version sees one
it converts the whole tree — `project.json` and `group.json` become `scope.json`
— and, where the folder is a git repository, it records what the folder looked
like first. Running it again does nothing.

Nothing is hidden inside the app. Put the folder in OneDrive, in Dropbox, on a
network share or in a git repository and it behaves the way anything else there
does. **Change…** on the organisation screen moves you to a different folder; the folders you
have used before are in **File ▸ Open Recent Folder**, each under the name its
organisation gives itself.

Two things follow from your work being files.

- **Somebody else can change them.** If a file changes underneath you — a
  colleague's checkout, a sync client, you on another machine — a strip appears
  above the canvas. With nothing unsaved it offers to take their version; with
  unsaved work it says both sides changed and asks which one survives. It never
  overwrites their version without asking.
- **Everything is written as it changes.** Three seconds after you stop
  editing, when you leave the window, and when you close it. Only the files
  that actually changed are rewritten, so moving one element rewrites one small
  file and nothing else.

A browser tab can work in a folder too, where the browser offers it — but the
permission rarely survives a restart and asking for it needs a click, so a tab
only picks a remembered folder back up when the permission is still granted and
otherwise starts in browser storage without a word. The desktop is the one that
is made to choose.

## History (desktop)

If the machine has **git**, the app can keep a history of your folder.
**Save… ▸ Snapshot…** offers a message already written from what you did —
"Changed Warehouse Management, Moved 3 elements" — which you can edit before it
is recorded. The first snapshot asks whether to start keeping history at all;
nothing leaves the machine either way.

**Save… ▸ History…** lists every snapshot. Choosing one shows what has changed
since it — applications added, removed and altered, connections drawn and cut,
decisions taken — with the geometry as a count rather than a list, because a
tidy pass is one sentence and four hundred changed lines.

**The history of one thing.** The picker at the top of the History page
narrows it to a diagram, a description or a decision: the list becomes the
snapshots that touched it, and the changes the rows about it. The same page
opens already narrowed from **History…** on a diagram's tab menu, on the
documentation page, and on a decision's page.

**Restore.** With a snapshot chosen, **Restore this version…** makes the
diagram, description or decision what it was then; with the whole project
shown, **Restore the whole project…** does the same for everything. A restore
is a new change on top of everything that happened since, not a step back: the
history keeps growing, the Activity list says *Restored the diagram Warehouse
as of 3 Sep*, ⌘Z undoes it, and the next snapshot records it. The app offers
that snapshot on the spot. A decision that has been accepted, rejected or
superseded stays as it is — write a new one that supersedes it — and a
restored diagram leaves out elements that no longer exist, and says how many.

**Labels.** **Label…** on a chosen snapshot gives it a word of your own —
"Shown to the board" — shown beside its message, never instead of it. A label
travels with the history, so a colleague sees the same mark in the same place,
in this app or in any git client. Two labels with the same name in one folder
are refused; pick another word.

Without git the app simply does not offer any of this, and everything else
works as before.

## The workspace

One open project: a bar at the top, the editor below it.

| In the bar | What it does |
|---|---|
| **Projects…** | Back to the organisation screen |
| **Settings…** | This scope's name and where it is filed, and its defaults: the author named on an exported diagram, and the maturity columns a new landscape starts with. Moving a scope files it under another one and leaves its content untouched |
| **Save…** | **Working file** (`.lvarch`) is everything: geometry, styling, your own logos, pinned routes — your scope's folder in one file. **Interchange document** is topology and semantics only, the form for review and version control. On the desktop the menu also offers **Snapshot…** and **History…** |
| **Open…** | Loads either, and recognises which by what is in the file rather than by its name |
| **Activity** | What has changed in this project since you opened it — a list of named steps with the time each was taken. Read-only: ⌘Z is how you go back |
| **Theme** | Light, dark or system. System follows your computer and switches with it |
| **Saved · hh:mm** | Where the project stands: the time it was last written, or **Unsaved changes**, **Saving…**, **Changed on disk**, **Changed here and on disk** |

Everything is saved automatically as you work: three seconds after you stop, on
leaving the window, and on closing it — and closing with unsaved work asks
first. In a browser without a folder, the app says once when its storage is
about four fifths full — that is the only warning you get, because a browser
stops saving without asking. If storage refuses outright (full, or blocked in a
private window) the bar at the bottom says so once and the editor keeps working;
save a working file then, because without storage the project is gone when the
tab closes.
Every notice (saved, loaded, failed) appears in that bottom bar.

**Language.** The language button at the right of the editor's toolbar
(it shows the code of the language you are in: NL, FY, DE or EN) opens a
menu of the four: Nederlands, Frysk, Deutsch and English. Choosing one switches
the whole interface: menus, dialogs, tooltips, band names, error messages and
the title block of a PNG export. The first time, the browser's language
decides. The design itself does not change; element names are content, not
interface.

## Drawing

**The landscape** has five bands: actors, input channels, external systems,
the application landscape and the management layer. Drag an element from the
palette on the left into a band, or right-click the canvas and **Add here**.
Bands resize by dragging their edge.

**Domain groups** box the applications that belong together. Add one from the
palette or from the canvas menu, give it a colour, drag applications in, tidy it
on its own. Removing a group leaves its elements where they are.

**Container diagrams.** Double-click an application to open the container
diagram underneath it, or to create one. The application becomes the boundary
of that diagram and its components sit inside. The tabs at the top list the
landscape and the container diagrams under it; right-click a tab to rename,
duplicate, delete or open the **diagram settings**.

**Finding things.** ⌘F / Ctrl+F opens the finder: type a name, category,
vendor or technology, Enter or a click selects the element and the canvas
scrolls to it, switching diagram first if it has to. The palette has its own
search, in both languages.

**Panels.** Drag the edge between a panel and the canvas to resize it,
double-click the edge for the default width, use the chevrons to collapse a
panel to a rail. The minimap button in the toolbar shows or hides the corner
map.

**Keyboard.** Tab walks the elements on the canvas, Enter selects the focused
one and Shift+Enter adds it to the selection. The arrow keys nudge the
selection by a grid step, Shift by one pixel. `?` shows every shortcut.

## Elements

Seven kinds: application, component, external system, input channel,
management tool, actor, and the domain group that holds them. Select one and
the **inspector** on the right shows its fields in three tabs.

- **General.** Name, category, vendor, technology, lifecycle (planned, live,
  retiring, retired; shown as a badge, retired elements dim), whether you
  manage it, the description (see *Documentation*), and where it sits.
- **Appearance.** Accent colour, shape, icon, icon size.
- **Data.** The **maturity aspects** of an application: for each column of this
  diagram, managed, partial, none or at risk, with a note. The columns are set
  per diagram in its settings.

**Icons.** Around a hundred built-in marks, searchable by name, category and
keyword in both languages, in two sizes: small in the header, large leading the
card for a diagram read from a distance. **Upload a logo** in the picker adds
your own SVG or PNG (up to 200 kB). Uploaded logos travel in the working file,
never in the interchange document.

**More than one at a time.** Select several elements and the inspector offers
lifecycle, colour, icon and domain group for all of them, one undo step each.

**Change kind.** Right-click an element, **Change kind ▸**, and pick what it
should have been; connections, description and place stay. Two cases are
refused with the reason: an application that has a container diagram, and a
component still attached to an application.

Elements belong to the model, not to a diagram: one element can be on several
diagrams, and **Remove from diagram** is a different action from **Delete from
model**. Deleting asks first, and says how many connections go with it.

## Connections

Drag from one element's handle to another, or right-click and **Start
connection to…**. A connection carries a label, a protocol (whatever you type:
REST, EDI, Kafka), a direction that sets the arrowheads, a colour and a line
style. Double-click the label to edit it in place.

Lines are routed around elements by a real router and re-route when something
moves. When automatic is not what you want:

- Drag a **pill** in the middle of a segment to shift that segment, drag a
  **square** to move a bend; the route becomes hand-drawn and the router leaves
  it alone.
- **Add bend**, **Remove bend**, **Reset to automatic route** in the line menu.
- **Pin route** keeps a line exactly as it is, even one with no bends.
- **Attach at ▸** chooses which side of an element each end leaves from or
  arrives at, or hold Alt while dragging a connection from a specific side
  handle. A chosen side is a constraint the router honours, not a hand-drawn
  route.
- Drag the label off its default position; **Reset label position** puts it
  back.

On a very crowded board — more than about a hundred and fifty lines competing
for one channel — automatic routing declines rather than spending minutes on it,
and says so in the bottom bar. Nothing is lost: the lines keep the routes they
had, and everything you drew by hand stays exactly as you left it.

## Layout

**Tidy** runs an automatic layout over the diagram, with a direction (across,
down, or groups across and their applications down), a density, and pins for
what you placed by hand. **Route connections** redraws only the lines and
leaves every element where it is; **Re-route everything** ignores pins. A
domain group can be tidied on its own from its menu.

Tidy works beside the app rather than inside it, so the window stays alive while
it runs and the Tidy button becomes a **Cancel** while it does. On a diagram of
more than four hundred boxes it declines and says so, rather than thinking for
several minutes: split the board across diagrams, or tidy one domain group at a
time.

By hand: **align** and **distribute** a selection from the floating toolbar or
the selection menu, a **grid** with optional snapping, nudge with the arrows,
**fit view** (Shift+1) and 100 % (Shift+2).

## Documentation

Every element has a markdown description, and it can be a whole page. Open it
as a page with **Open documentation** in the element's menu, the expand button
beside the description field in the inspector, Enter on the selected element,
or a double-click on anything that is not an application.

The page opens to **read**: the document with a table of contents, the
diagram's other elements down the left to move between (a page mark shows who
has documentation already), and the element's own fields down the right.
**Edit** puts the source on the left and the result beside it, and makes the
fields on the right editable too. ⌘B and ⌘I wrap the selection; Escape leaves
Edit first, then the page. Changes are saved after a short pause and when you
leave, one undo step per pause.

An empty page can **start from the template**: a header table and the usual
sections. The **Short description** row of that table is what the element
shows on the canvas; without it, the first paragraph is. `[[Name]]` in the
text becomes a link to that element. Ordinary links open outside the app.

**Documentation** in the top bar opens the page for the selected element, or
for the first element on the diagram when nothing is selected. A fenced code
block marked `mermaid` in any page is drawn as a diagram.

## Decisions

**Decisions** in the top bar opens the architecture decision records: a tree
down the left, the records of the selected node in the middle, and the record
you are reading on the right. There are three levels. The **group's** decisions
are the records of the scope above this one — they hold for everything filed
under it, and are kept with it. The **landscapes'** decisions belong to this
scope as a whole. Each **application** has a list of its own. An application that has left the model
keeps its records under *Removed applications*.

A record follows the MADR format: context and problem statement, decision
drivers, the options considered, the outcome and its consequences, the pros and
cons of each option, more information. **New decision** asks for the title and
starts the body from that template. Title, status, date and decision-makers are
fields above the body; the **reviewers and signatures** table at the end lists
who the decision was put to, each with a verdict and the day it was given.

The status is a workflow, not a label. A record starts **proposed**, moves to
**under review**, and is then **accepted** or **rejected**. Those two are the
end of the road: from there the record can no longer be edited or deleted,
because a decision that can be rewritten afterwards is not a record of one. An
accepted record can later be **superseded**, which asks for the record that
replaces it and shows the link both ways. Review can be sent back to proposed.

The search field above the list searches every record in the tree at once —
title, body and reviewers. Bodies are markdown, with the same `[[Name]]` links
as documentation; **Formatting help** beside the source shows the syntax,
mermaid diagrams included. Changes are saved with this scope, or with the scope
above it for its records.

## Time, and the day a board shows

Every application can carry **lifecycle dates** beside its lifecycle: the day it
goes live, the day it starts retiring, the day it is gone. All three are
optional, and an application with none of them behaves exactly as it always
did. Where a date has passed it wins over the stored lifecycle, because a
landscape that still says "planned" three years after go-live is one nobody
updated.

A connection can carry a **window** of its own, *valid from* and *valid until*.
Almost none need one: a line with no window is there as long as both the things
it joins are there. The lines that do need one are the temporary ones — a sync,
a routing façade, a double write — which is exactly the hybrid phase of a
replacement.

**Showing** on the diagram bar says which day the board is drawing. It reads
*Today* until you name a day, and then reads that day and highlights itself, so
a board showing 2028 does not look like a board showing now. Every card draws
the phase it is in on that day, and a line with a window appears only inside it.
Changing the day is an ordinary edit: it is one entry in Activity and ⌘Z takes
it back.

That is how a future diagram is made. Right-click a tab and choose **Duplicate
as of…**, pick a day, and you have a second board of the same landscape as it
will stand then. There is only ever one model, so the two cannot drift apart.
An exported PNG of a dated board says the day in its title.

**Replaced by** on an application names its successor, and **Owner** says who
answers for it. Owner used to be a row in the documentation template; it is a
field now, so the roadmap's checks can name a person.

## The roadmap

**Roadmap** in the top bar opens the landscape on a time axis. Only what has a
date gets a row, so a landscape of four thousand applications with nine dates in
it is a roadmap of a few lines — the rest is on the canvas, where it belongs.
Each row is a run of coloured stretches: planned, live, retiring, gone. A line
down every row marks today, and a second one marks the day the board behind the
page is showing.

The slider along the top moves that board. Drag it and the canvas behind follows,
so the picture and the axis cannot disagree about which day is under discussion.

### Plans

A **plan** is how a change to the landscape gets written down: a title, a status,
the window it runs over, who owns it, the applications it introduces, retires or
changes, the decisions it rests on, its milestones, and a body in markdown. Plans
appear as bands under the applications on the axis, with a mark per milestone.
Pick one and it opens on the right.

A plan runs **draft → agreed → running → done**, and can be abandoned from any of
those. Unlike a decision record, every step can be taken back and a finished plan
can still be edited: a decision records a moment, and a plan describes work. What
the plan said last month is in the folder's history.

**Move by…** shifts a plan by a number of days — its window, every milestone, and
the lifecycle dates on the applications it introduces and retires — in a single
step, because a plan slipping is one thing that happened.

Each plan is one markdown file in `transitions/` in your project folder, numbered
`TR-0001` upwards.

### The business case

A plan's body can hold a **business case**: a fenced block whose input is a
cash-flow table you can read, with the figures worked out underneath it.

````markdown
```business-case
currency: EUR
discount rate: 10%

| Line       | Year 0   | Year 1 | Year 2  |
| ---------- | -------- | ------ | ------- |
| Investment | -415 000 |        |         |
| Savings    |          | 25 000 | 125 000 |
```
````

A negative number is money out, a positive one is money in, and a blank cell is
zero. Underneath, the app computes the net and cumulative cash flow, the net
present value at the rate you gave, the internal rate of return, the payback in
periods, the return on investment and the benefit-cost ratio. Your table is never
rewritten.

A second table, `Criterion | Weight | Score`, adds a weighted score for the part
that is not money — scored one to five, out of a maximum the app works out rather
than one you type. Everything beyond that belongs in a decision record, with its
drivers and the options you weighed.

**Add a business case** in the edit pane drops an empty block in at the cursor.

### What the dates disagree about

Under the axis is a list of contradictions: an application retiring with
connections still live, a successor that does not arrive until after the thing it
replaces is gone, a retirement with no successor named, a connection still valid
after one of its ends has retired, and a plan past the day it was due to finish.

It says where the dates contradict each other. It cannot tell you that a landscape
is out of date — nothing can — and the page says so under the list.

## The business architecture

**+** in the diagram tabs, then **Business architecture**, makes a **sheet**: the
layer above the applications, on one page. A landscape says what runs and what
talks to what. A sheet says what the organisation does, who it does it for, and
how much of it any software covers at all.

A sheet is *laid out*, not drawn. There is nothing to drag and no router: what it
shows is four trees — a journey, the areas of responsibility under it, the
capabilities inside those, and the stakeholders down the side — and the page is
computed from their order and their depth. It gets a tab beside the boards, and
opening it leaves the canvas where it was, so the picture you were working on is
still there when you come back.

![The business architecture sheet: stakeholders down the side, the journey across the top with one row per lane, and the areas with their capabilities and how each is covered](screenshot-sheet.png)

### The journey, and the paths through it

Across the top runs one **journey**: the thing the organisation does, end to end.
Its phases are the columns, read left to right, and under each phase are the
steps taken in it.

One journey is rarely one path. A step can name a **lane** — the stakeholder
whose own path it is — and the sheet draws a row per lane under the same phases,
the common path first. Where a lane forks and where it rejoins is not written
down anywhere: it is the first and last phase the lane has a step of its own in.
A phase inside that span where it has none is drawn as *as the row above*;
outside the span the lane is not drawn at all. Nothing can disagree with where a
path leaves and returns, because nothing but its steps says so.

A step somebody outside the organisation takes — a partner fulfilling an order —
is marked as done outside, so the page can say a phase is covered by nobody
inside.

### Areas, and what covers them

Under the journey are the **areas** of responsibility, each with its groupings
and the capabilities inside those. Depth is what is drawn, and the model does not
know the words: a top-level entry is an area, one inside it is a grouping, one
inside that is a capability.

Every capability says who covers it:

- **an app**, or several — the applications that support it. A capability with
  two of them and one of those retiring is a migration you can see.
- **people** — nobody's software, somebody's job. A complete answer and not a
  gap: a page that drew this as a problem would be telling you to buy software
  for the thing you do by hand.
- **nothing yet** — neither, which *is* the gap, and the reason to draw the page.

Those are read from the model rather than kept on the card: a capability is
covered because something in the landscape supports it. **Supported by…** in the
inspector is how that row gets written, and support can carry a window like
anything else with a date on it, so a capability covered from March is covered
from March.

At the end is a band for what is **not yet mapped to a domain** — the areas
nobody has been given. It is a finding, not an error: a list of what the
organisation has said it does and has not yet said who does it.

### Making one

A sheet on a project with nothing above its applications is empty, and the empty
page offers the two places to start: **New journey** and **New area**.
Everything else is a **+** where the thing would go, and they all work the same
way — what you made appears, it is selected, and the cursor is in its name, so
you type over what it was called and press Enter.

- **New journey** makes the journey and its first phase, *Start*, and points
  this sheet at it, because a band that is a header with nothing under it is not
  what you asked for.
- **+ phase**, at the end of the phase row, puts a column at the end.
- **+ step**, in any cell, adds a step to that phase on that row's path.
- **+ lane…**, under the last row, asks whose path it is — one of your
  stakeholders, or a name you type, marked as outside the organisation if they
  are — and which phase it forks at, since a lane is drawn where its steps are
  and one with no steps is not drawn at all.
- **+ area**, after the last area, adds one and draws it on this sheet from the
  moment it exists.
- **+ grouping** and **+ capability** inside an area, and **+ capability**
  inside a grouping. A capability made straight in an area is a card in the
  column, and becomes a grouping the moment something is put inside it.
- **+ stakeholder**, beside a rail entry, adds one under it; **+ group**, at the
  foot of the rail, starts a branch of its own.

**Supported by…** and **Done by…** in the inspector are how a capability gets
covered: tick an application and it supports this capability, tick a team and it
is theirs. Each tick is a step of its own, and the line under the capability's
name changes as you go.

**Delete**, at the foot of the inspector, removes what is selected and every row
that ended on it. It is refused while anything is inside it, and says how much:
nothing cascades, so an area you delete is an area you emptied first.

**What this sheet draws**, the sliders in the top bar, is about the sheet rather
than the model — which journey runs across the top (a project with two journeys
starts with neither), which areas are drawn and in which order, the order of the
lanes, and whether the rail is there at all.

### Editing one

Pick anything on the page and it opens on the right: its name, its description,
what it sits under, where it is among its neighbours, whose path a step is,
whether a stakeholder is from outside the organisation, and the lifecycle a
capability is in — a capability being built is in the same phase as an
application being built. Moving one thing under another is refused if it would
put a thing inside itself; the refusal is offered in the list, not hidden from
it. The eye in the top bar hides the stakeholder rail.

Opening an application from a capability's coverage takes you to a board that
actually draws it, switching boards if the one you are on does not — and to the
application's own page when no board draws it at all.

## Search

**Search** in the top bar, or ⌘K, searches the whole project at once: elements
by name, category, vendor and technology; documentation by what is written in
it; and decisions at all three levels, the group's included. Choosing an
element selects it and pans to it, a documentation hit opens that element's
page, and a decision opens its record. ⌘F inside the editor remains the quick
finder when all you want is a box on the canvas.

## Diagram settings

Right-click a diagram tab, **Diagram settings…**.

- **On the drawing.** Author, client and date for the title block of a PNG
  export, each falling back to the project's default or the day of export when
  left empty, and whether to draw the title block at all.
- **Maturity columns.** The aspect columns applications on this diagram carry:
  add a standard one (platform, CI/CD, DR, security, monitoring, backup,
  compliance, cost), add your own, rename, reorder, or switch the badges off
  altogether. Renaming a column keeps every status already recorded against
  it.

## Saving, exporting, sharing

Three ways out, for three purposes.

- **The working file** (`.lvarch`) is everything and is what you hand to
  someone who will edit further. It is your project folder in one file — a zip
  — so anybody can unpack it and read what is inside without this tool.
  Working files from earlier versions still open.
- **The interchange document** carries topology and semantics and no geometry
  or styling: a diff of it shows what changed about the architecture, not what
  moved on the canvas. A built-in icon travels as `iconType`; an uploaded logo
  does not. What this tool does not understand in a document survives a round
  trip untouched, and a document that uses no icons comes back word for word.
- **PNG export** (the download button) opens a dialog with a preview of the
  picture as it will leave: in the light or the dark theme regardless of the
  one on screen, with every line's label or only the bare lines, with or
  without the title block along the bottom — client, author and date — and
  with or without the legend under it, which says what the badge and lifecycle
  colours mean. A container diagram's export carries its C4 corner in the
  strip: the level, the application, a sentence and the date. Lifecycle badges
  can be switched off first for a clean picture. If a logo could not be
  embedded, the bottom bar says which. A very large board is tens of megapixels
  and takes a while to draw, so the dialog says how big the image will be and
  its button asks before it starts.

## Preferences

Grid, snapping, lifecycle badges, collapsed panels and their widths, the
minimap, the tidy settings, the language and the theme are remembered per
browser or per desktop install. They belong to you, not to the project: they
do not travel in a file.

## Undo

**⌘Z** covers everything, in the order you did it: a box moved, a diagram
renamed, a decision accepted, a project setting cleared. Typing a name is one
step rather than one per letter, and a drag and the lines that re-route after it
are one step — so going back once gives you what you had rather than what you
had a keystroke ago.

**Activity** in the top bar lists those steps with their names and times. It is
a record, not a way back: stepping to an entry would raise a question ("and
everything after it?") that ⌘Z already answers.

## Shortcuts worth knowing

| Keys | Does |
|---|---|
| `?` | Every shortcut |
| ⌘F / Ctrl+F | Find an element |
| Enter | Open the selected element's documentation |
| F2 | Rename the selection |
| Delete | Remove the selection, after asking |
| ⌘Z, ⌘⇧Z | Undo, redo — one stack over everything |
| ⌘C ⌘X ⌘V, ⌘D | Copy, cut, paste, duplicate |
| Arrows, ⇧Arrows | Nudge by a grid step, by a pixel |
| Shift+1, Shift+2, `=`, `-` | Fit view, 100 %, zoom in, zoom out |
| Shift+F10 | The menu for the selection |
| ⌘S / Ctrl+S | Save now |

On Windows and Linux, read Ctrl for ⌘.
