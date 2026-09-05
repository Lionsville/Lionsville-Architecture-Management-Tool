# User manual

The Lionsville Architecture Management Tool draws an application landscape in
Layer-7 bands and the C4 container diagrams underneath it. This is the manual
for using it. What it is and why it exists is in the [README](../README.md);
the Dutch version of this manual is [manual.nl.md](manual.nl.md).

## Starting

**Desktop.** Download the installer for your platform from the
[releases page](https://github.com/Lionsville/Lionsville-Architecture-Management-Tool/releases/latest).
The app checks that page for a newer version in the background and installs it
the next time you quit; **Check for Updates…** in the app menu does it on
request.

**Browser.** From a clone of the repository, `npm run setup` once and then
`npm run dev`; open <http://127.0.0.1:5200>. Everything you make lives in that
browser's storage until you save a file.

Nothing leaves your machine either way. There is no account, no backend and no
telemetry.

## Projects and groups

The app opens on the **project list**. A project is one design: a landscape,
the container diagrams under it, and everything placed on them. Every project
is filed under a **group**: a customer, a department, a programme, whatever the
namespace is called where you work.

- **Examples** ship with the app. Opening one **copies** it into a project of
  your own; nothing you do runs against the example itself.
- **New group** asks for the group and its first project at once. A group only
  exists through the projects filed under it, so there is no empty group.
- **New project** offers the groups that exist. Each group header also has its
  own **Add a project**, which is the path that keeps `Acme` and
  `Acme Logistics` from becoming two groups.
- **Order** lists projects by name, or by what you changed most recently.
- **Delete** removes a project from this browser or this desktop app. A working
  file you saved elsewhere is not touched.

The **settings** of a group hold its name, a description and links: a wiki
space, a ticket queue, a dashboard. Renaming a group relabels every project in
it. On boot the app reopens the project you had open.

## The workspace

One open project: a bar at the top, the editor below it.

| In the bar | What it does |
|---|---|
| **Projects…** | Back to the project list |
| **Settings…** | This project's name and group, and its defaults: the author named on an exported diagram, and the maturity columns a new landscape starts with. Moving a project to another group leaves its content untouched |
| **Save…** | One menu, two forms. **Working file** (`.lvarch`) is everything: geometry, styling, your own logos, pinned routes. **Interchange document** is topology and semantics only, the form for review and version control |
| **Open…** | Loads either. An interchange document is laid out again; a working file comes back as it was. Files written under the tool's previous name keep opening |
| **Theme** | Light, dark or system. System follows your computer and switches with it |
| **Saved · hh:mm** | When this browser or desktop app last took the project |

Everything is saved automatically as you work. If storage refuses — full, or
blocked in a private window — the bar at the bottom says so once and the
editor keeps working; save a working file then, because without storage the
project is gone when the tab closes. Every notice (saved, loaded, failed)
appears in that bottom bar.

**Language.** The **NL/EN** button at the right of the editor's toolbar
switches the whole interface: menus, dialogs, tooltips, band names, error
messages and the title block of a PNG export. The first time, the browser's
language decides. The design itself does not change; element names are
content, not interface.

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

## Layout

**Tidy** runs an automatic layout over the diagram, with a direction (across,
down, or groups across and their applications down), a density, and pins for
what you placed by hand. **Route connections** redraws only the lines and
leaves every element where it is; **Re-route everything** ignores pins. A
domain group can be tidied on its own from its menu.

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
hold for every project filed under it and are kept with the group. The
**landscapes'** decisions belong to the project as a whole. Each
**application** has a list of its own. An application that has left the model
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
mermaid diagrams included. Changes are saved with the project, or with the
group for the group's records.

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

- **The working file** (`.lvarch`) is everything and is what you keep and hand
  to someone who will edit further.
- **The interchange document** carries topology and semantics and no geometry
  or styling: a diff of it shows what changed about the architecture, not what
  moved on the canvas. A built-in icon travels as `iconType`; an uploaded logo
  does not. What this tool does not understand in a document survives a round
  trip untouched, and a document that uses no icons comes back word for word.
- **PNG export** (the download button) renders the current diagram at print
  size with the title block and the aspect legend. Lifecycle badges can be
  switched off first for a clean picture. If a logo could not be embedded, the
  bottom bar says which.

## Preferences

Grid, snapping, lifecycle badges, collapsed panels and their widths, the
minimap, the tidy settings, the language and the theme are remembered per
browser or per desktop install. They belong to you, not to the project: they
do not travel in a file.

## Shortcuts worth knowing

| Keys | Does |
|---|---|
| `?` | Every shortcut |
| ⌘F / Ctrl+F | Find an element |
| Enter | Open the selected element's documentation |
| F2 | Rename the selection |
| Delete | Remove the selection, after asking |
| ⌘Z, ⌘⇧Z | Undo, redo |
| ⌘C ⌘X ⌘V, ⌘D | Copy, cut, paste, duplicate |
| Arrows, ⇧Arrows | Nudge by a grid step, by a pixel |
| Shift+1, Shift+2, `=`, `-` | Fit view, 100 %, zoom in, zoom out |
| Shift+F10 | The menu for the selection |
| ⌘S / Ctrl+S | Save now |

On Windows and Linux, read Ctrl for ⌘.
