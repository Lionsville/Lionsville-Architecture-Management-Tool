// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the manual said that the sections do not: how things work, by topic,
 * carried into the help when the manual went (4.0.0). Markdown, read by
 * `help/markdown.ts`; each topic is headed by the manual's own heading.
 */
import type { Backgrounds } from '../../types'

export const BACKGROUND: Backgrounds = {
  start: [
    { title: `Starting`, text: `**Desktop.** Download the app for your platform from
[architecture.lionsville.nl/download](https://architecture.lionsville.nl/download).
It checks for a newer version in the background and asks before it does
anything about one — **Download and Install** fetches it while you work,
**Skip This Version** says not this one, and the checkbox in that dialog turns
the automatic check off. When the download is done it asks you to restart;
**Later** installs it the next time you quit. Where the app cannot replace
itself — run straight from the disk image, or from Downloads without being
moved to Applications — it says so and opens the download page instead.
**Check for Updates…** in the Help menu asks on request.

**Browser.** [app.architecture.lionsville.nl](https://app.architecture.lionsville.nl/)
is the newest release, with nothing installed. You can also run it from a
clone of the repository: \`npm run setup\` once, then \`npm run dev\`, and open
<http://127.0.0.1:5200>. Where the browser offers it (Chromium does), a tab
can work in a folder just as the desktop does. Otherwise your work is kept in
that browser; a private window keeps it only as
long as the browser does. *Where your work is kept* says more.

Nothing leaves your machine either way. There is no account, no backend and no
telemetry.` },
    { title: `The organisation screen`, text: `**The example.** An organisation nobody has started opens on a first page: name yours, look around the example, or carry on with a file or a folder you have. **Open the example** is a place you visit: a band on every screen says you are in it, you can try anything, nothing there is kept, and your own work is untouched. **Keep this as my start** makes what you see your organisation (filed under a scope of its own if yours has meanwhile become something); **Leave the example** goes back with nothing changed.` },
  ],
  frame: [
    { title: `The organisation screen`, text: `The app opens on the **organisation**: a scope like any other, and the one
everything else you keep is filed under. A **scope** is
one document: a name, a landscape, the container diagrams under it, the
decisions, the plans, the business architecture, and everything placed on them.
Scopes **nest**, and every one of them is the same document — the organisation
at the top, a **domain** or a **team** under it, a **landscape scope** under
that, as deep as your work needs. A landscape scope is a scope; a landscape is
also a kind of board, which is a drawing inside a scope.

**Served by**, under the head, wherever the organisation has units — but not
on the organisation's own home, since the organisation is no domain and no
unit serves it: the units that serve this scope, in the order of their types,
each with who holds its managing role today and where it is filed when that
is somewhere else. A unit serves the domains its **Serves** names, or the
scope it is filed in where it names none — unless that is the organisation,
where a unit serves nothing until it is given a domain — and a unit under one
that serves a scope serves it through that one — those are counted rather
than listed. **+ Unit** picks one
from the whole organisation: the list is grouped by unit type, says where each
unit is filed, and narrows as you type; a unit whose type serves one domain,
or that is kept where you may only read, is listed and says why it cannot be
picked. Adding a unit, or **✕** beside one, changes what that unit serves: one
step in the scope that keeps the unit, which is why it is only yours to make
where you may change that scope — a role that manages people does not reach
it. Under the units, the **domain owner**: whoever holds the role the
organisation's *domain owner* rule names, in the serving unit filed highest in
this scope. It is worked out on the day and never kept. Pressing a unit's
name opens it where it is kept — on that scope's organisation chart, picked,
where it has one — and its inspector says the same thing from the other end,
each domain there opening that domain's home again.

**The type follows the unit.** Linking a unit to a scope — **+ Unit** here or
in the settings, **Served by** in the new-scope dialog, **+ Domain** on a
unit's inspector on the chart, a new unit's domains, or the assistant —
gives the scope that unit's type in the same change, unless the type it
already has is still that of a unit serving it: a scope served by a division
keeps saying *Division* when a team under it is added. Taking a unit off
leaves the type as it is, and so does undoing the link. Under **Served by**
a line says how the two stand: *Typed Division, as a unit that serves it is*;
in the warning colour, *Typed Team, while the units that serve it are:
Division*; *Typed Team; no unit serves it yet*; or, where the scope says no
type from the operating model, which units of what types serve it, so the
type can be set. The badge on the scope's row in the tree warns the same
way, and the checks say the three cases that are off (*The Checks page*).

Renaming a scope relabels it and nothing else — where it is filed is its
address, and renaming is not moving. Moving one changes the address of the
scope and of everything under it, and leaves the content untouched: every
stand-in elsewhere in the folder that pointed into it is carried over to the
new address in the same step, so a move never leaves a trail of stale copies
behind it. So is every cause that explains one of its causes, and every
observation that absorbed one of its observations: they name it by its
address, and follow it. With no address the app opens on the organisation's home, with **Continue**.

Seven names are refused, because a scope's own folders use them already:
\`diagrams\`, \`docs\`, \`decisions\`, \`transitions\`, \`observations\`, \`images\` and \`logos\`.` },
    { title: `Back and Forward`, text: `**Back goes to the place you were before**, and Forward goes to the place you
came back from. A place is a scope's home and the page on it, or an open scope
on its view or on the page over it: its decisions, its observations, its
roadmap, a plan, a platform's or a service's report. Every move to another
place is a step, whether you made it with the tree, a crumb, a card, a search
hit or a link on a page, or an agent made it for you. So after an agent has
opened a scope, Back takes you to where you were. What is selected, the day a
board is shown on, a filter and an open dialog are not part of a place, and
choosing another record on the decisions or the observations page, or another
tab of the observations page, is not a step either: the address names the tab
that is up, so a reload stays on it. Back is not undo: it moves the screen and changes nothing, and
{key:Mod+Z} is still how a change is taken back.

**In a browser** the browser's own Back and Forward do this, with their keys
and gestures. The address names the place you are on, after a \`#\`, so a reload
stays there, and an address copied from the bar opens the same place for anyone
who may read it. The rest of the address is left as it was.

**In the desktop app** the bar starts with a **‹** and a **›** button (after
the window's buttons on macOS), greyed out when there is nowhere to go. The
same moves are in the **Go** menu as **Back** and **Forward**, on **{key:Cmd+[|Alt+Left}** and
**{key:Cmd+]|Alt+Right}**. The mouse's
back and forward buttons work too, and so does swiping between pages on a Mac
trackpad when it is set to *Swipe with two or three fingers* (System
Settings → Trackpad → More Gestures → Swipe between pages). They all work from
the organisation's home as well as with a scope open. While a dialog is open
the buttons are behind it, and the keys, the menu items and the mouse buttons
do nothing. The history belongs to the window: it is gone when the window
closes.

**A dialog is closed by Back** when the page it was opened on is left, as when
you leave that page any other way. Text typed into it is not kept.

**A place that is no longer there** is replaced by the nearest one that is: a
removed view opens its scope on the first view it has left, a removed record
opens its page without a record, and a removed scope opens the home of the
nearest scope above it. The Activity list says what was removed.` },
    { title: `Share with a link`, text: `**What a link says.** After the \`#\` comes the scope's path, a \`-\` that ends
it, then the page and the record: \`#/acme/rail/-/board/landscape\` is the board
*landscape* of the scope *acme/rail*, \`#/acme/-/document/billing\` the page of
the element *billing* in *acme*, and \`#/-/home\` the organisation's home. A tab
or a selection follows as \`?tab=analysis\` or \`?select=billing\`. A link made
before version 3.7.0, which starts with \`#place?\`, still opens the same place,
and the address is written again in the new form once it has. A link pasted
into the address bar of a window that is already open goes there too.

**A link to an element's page always opens it**, wherever the element is
kept: an element no view draws, a unit kept by a scope that draws nothing,
and an element kept in another scope, which opens in the scope that keeps it.
Closing the page in a scope that draws nothing goes to that scope's home. A
link to an element that is not there any more opens the scope and says so.

**On a view, the link selects what you selected.** Share from a board, a
sheet, an enterprise map, the technology landscape or an organisation chart
with one element or unit selected, and the link opens that view with it
selected again — on a chart, the unit gone to, wherever it is kept; on a
sheet and a map it is also outlined for a moment. A record a link opens on — a
decision, an observation, a cause, a solution or an experiment — is brought
into view and outlined the same way, in the list or in the picture.

**A link needs an address somebody else can reach.** Work kept in a folder, in
this browser or nowhere at all has none, so there the dialog says why there is
no link, and nothing is copied. The menu item works from every screen, the
organisation's home included.` },
    { title: `Search`, text: `**Search** in the top bar, or {key:Mod+K}, searches everything at once: elements by
name, category, vendor, technology and owner; documentation by what is written
in it; views by name; relations by label, protocol and technology; decision
records, plans and their milestones; and observations, causes, solutions and
experiments by their title and what is written in them. It reads the scope you
are in, the decision records of the scopes above it, and what the rest of the
organisation holds of elements, relations, plans and observations. Each hit
says what it is — a heading per kind, and the element's kind or the record's
status beside it — and which scope holds it. Choosing an element selects it
and pans to it, a documentation hit opens that element's page, a relation
opens the box it leaves, and a record opens on its own page; a hit from
another scope opens that scope there, read-only where your source is. {key:Mod+F} inside the editor remains the quick
finder when all you want is a box on the canvas.

The organisation's home and every domain's home have the same **Search** in
their bar, and {key:Mod+K} works there too, with nothing open: it reads that home's
scope first and then the rest of the organisation, and a hit opens the scope
that holds it, on the same page a hit from inside the scope would.` },
    { title: `Undo`, text: `**{key:Mod+Z}** covers everything, in the order you did it: a box moved, a diagram
renamed, a decision accepted, a scope setting cleared. Typing a name is one
step rather than one per letter, and a drag and the lines that re-route after it
are one step — so going back once gives you what you had rather than what you
had a keystroke ago.

**Activity** in the top bar lists those steps with their names and times. It is
a record, not a way back: stepping to an entry would raise a question ("and
everything after it?") that {key:Mod+Z} already answers.` },
    { title: `Shortcuts worth knowing`, text: `| Keys | Does |
|---|---|
| \`?\` | Every shortcut |
| F1 | The help, at the screen you are on |
| {key:Mod+F} | Find an element |
| Enter | Open the selected element's documentation |
| F2 | Rename the selection |
| Delete | Remove the selection, after asking |
| {key:Mod+Z}, {key:Mod+Shift+Z} | Undo, redo — one stack over everything |
| {key:Mod+C} {key:Mod+X} {key:Mod+V}, {key:Mod+D} | Copy, cut, paste, duplicate |
| Arrows, {key:Shift} Arrows | Nudge by a grid step, by a pixel |
| Shift+1, Shift+2, \`=\`, \`-\` | Fit view, 100 %, zoom in, zoom out |
| Shift+F10 | The menu for the selection |
| {key:Mod+S} | Save now |
| {key:Cmd+[|Alt+Left} {key:Cmd+]|Alt+Right} | Back, Forward, in the desktop app; in a browser, the browser's own |` },
  ],
  work: [
    { title: `Where your work is kept`, text: `Your work is kept in one of three places, and the organisation's home says
which in the line under its name:

- **a folder**: the desktop's, or a browser tab's where the browser offers one;
- **this browser**: a tab with no folder;
- **nowhere**: a tab where the browser's storage will not open.

The saved copy (see *Saving, exporting, sharing*) carries your whole
organisation from any one of them to any other.` },
    { title: `A folder`, text: `The first time the desktop app runs it asks for a **folder to work in**, and
everything you make lives there as files you can read:

\`\`\`
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
      images/floor-plan.png           a picture a description shows
      logos/own.svg                   a logo you uploaded
\`\`\`

A folder holding a \`scope.json\` is a scope, and the folders inside it that hold
one are the scopes under it. Move a folder in your file manager and the scope is
at its new address. A folder you have not named yet goes by the folder's own
name.

**A folder from an older version opens.** The first time this version sees one
it converts the whole tree (\`project.json\` and \`group.json\` become
\`scope.json\`). On the desktop, where the folder is a git repository, it
records what the folder looked like first. Running it again does nothing.

Nothing is hidden inside the app. Put the folder in OneDrive, in Dropbox, on a
network share or in a git repository and it behaves the way anything else there
does. **Work from another folder…** on the organisation screen moves you to a
different folder; the folders you have used before are in **File ▸ Open Recent
Folder**, each under the name its organisation gives itself.

**Everything is written as it changes**: three seconds after you stop editing,
when you leave the window, and when you close it. Only the files that actually
changed are rewritten, so moving one element rewrites one small file and
nothing else. Closing a window with unsaved work saves it first, in every
window; the app asks only if that save did not work.

**Bringing your browser's work along.** If this browser kept work before you
chose a folder, choosing one asks **Bring your work into this folder?**:
- **Copy my work in** copies every scope the browser kept into the folder, with
  the people register, the organisation's settings and every picture, then reads
  it all back and compares it. The dialog shows how far it has got, and **Stop**
  stops it between two scopes. It then says what the folder holds, by kind, and
  by name whatever it did not bring, with why: scopes that could not be written,
  scopes it left alone because the folder holds other work there or somebody
  changed them meanwhile. **Try again** goes on from there, and so does choosing
  the folder again: what arrived is found the same and left alone. A folder that
  already holds other work says so before you answer, and that work is never
  written over. The history of changes and the named versions stay in the browser.
- **Open the folder as it is** leaves both where they are.

Nothing is deleted either way; the browser keeps its copy.

**A folder with a remote.** Where the folder is a git repository with a remote,
*Preferences* has two switches for this folder on this machine: **Pull from the
remote when this folder is opened** and **Push after every snapshot**. When the
folder and its remote have both moved on, a strip offers:
- **Take theirs**: the remote's version stands, and ours is kept on a branch
  of its own;
- **Keep ours**: ours stands, recorded as a merge on the branch you are on.

Either way, what is open is written first.

**The folder's own git settings.** The app runs git with your own git
configuration. A folder's \`.git/config\` may set what a repository needs, such as
its remotes, its branches and who commits. A program it names, such as an
editor, a pager, a signing program or a filter, is replaced by your own value or
git's default, and settings only for commands the app never runs, such as a
merge or diff tool, are left alone. A few settings cannot be replaced and are
refused: git's own proxy command, the upload-pack and receive-pack programs, a
pager for one command, an address rewrite and a cookie file. In a folder that
sets one, a snapshot, a label, a pull or a push is refused, and the notice names
the setting, quoted in English as git reports it, as in *The snapshot could not
be taken: git was not run in this folder: its configuration sets
http.cookiefile, …*. The same goes for git-lfs set up for that folder alone
(\`git lfs install\` sets it up for you, and then it runs), and for a remote that
is a folder inside the working folder.

A browser tab can work in a folder too, where the browser offers it (Chromium
does). The permission rarely survives a restart, and asking for it needs a
click. So a tab only picks a remembered folder back up when the permission is
still granted, and otherwise starts in this browser without a word. The
desktop is the one that is made to choose.` },
    { title: `This browser`, text: `A tab with no folder keeps your work in this browser, for this site. The word
in row one says **In this browser**, and your work stays there
across restarts until you or the browser clear the site's data. After the
first save, the app asks the browser to keep it through a clear-out; some
browsers, Firefox among them, put that question to you. Browser storage is
small, so the app says once when
it is about four fifths full: a browser stops saving without asking. If
another tab still has an older version of the app open, or the app was
updated in another tab, a strip says what to close or reload before saving
works again.

**Work an older version kept.** Earlier versions kept a browser's work
somewhere else in it. That work is brought over at every start: copied, never
moved, and never over work done here since. Where a scope changed in both
places, a strip asks about that scope: **Bring the older copy over** (what is
here goes into the history first) or **Keep what is here**.

**A private window** keeps your work only as long as the browser does. Most
browsers open their storage there too, so the chip says **In this browser**,
and everything goes when the window closes. The app cannot tell that the
window is private: save a saved copy to keep your work.

**Where the browser's storage will not open**, the app works from memory and
nothing you change is kept. A strip on every screen says so. The chip on the
organisation's home says **Not kept anywhere**, in the warning colour. The line
under the name says *Everything here is kept nowhere yet — save a saved copy
to keep it.*, and the first snapshot says *Snapshots are kept for as long as
this tab is open, and go with it.* Work an older version kept in this browser
is shown. Save a saved copy before you close the tab.

If the browser's storage has not answered within a few seconds, the page is
drawn anyway. A strip says so, and your work appears when the storage answers.` },
    { title: `When it changed elsewhere`, text: `A scope can change while you have it open: a colleague's checkout, a sync
client, you on another machine or in another tab. The bar then says **Changed
elsewhere**, or **Changed here and elsewhere** when you have unsaved changes
too. A strip above the canvas asks which version stands:
- **Take theirs** reads their version and puts it on screen.
- **Keep mine** replays your changes onto their version, so their edits to
  things you did not touch survive. Only where that is refused does it write
  the whole scope as it is on your screen over theirs.
- **Save a copy…**, with unsaved changes here, puts yours in a saved copy
  first and leaves the decision for later.

Nothing is overwritten without asking.` },
    { title: `When a scope cannot be read whole`, text: `If part of a scope cannot be read, because a file of it is damaged or was
changed by hand, the scope opens to be looked at and not changed, and a notice
names what could not be read. Where you may write where the scope is kept, it
offers **Bring in a saved copy…**, and **Put back from the history…** where a
history is kept; in a folder it also says you can mend the file and open the
scope again.
- **Put back from the history…** opens the History page, where **Put back the
  whole scope…** makes all of it what it was at the snapshot you chose. What
  could not be read is kept first, as an entry of the history or set aside
  beside the scope, and where it cannot be kept, nothing is put back.
- **Bring in a saved copy…**, or opening one onto the scope, puts it back
  from the file the same way, and the question before it says so.

An entry that kept what could not be read offers **Save what could not be
read…**, which saves it as a file of your own. A scope that a later version of
the app wrote opens to be looked at only: the notice says to update the app,
and nothing here puts it back.` },
    { title: `The workspace`, text: `Everything is saved automatically as you work: three seconds after you stop, on
leaving the window, and on closing it. Closing with unsaved work saves it
first: the desktop asks only if that save did not work, and a browser tab asks
before it closes. In a browser without a folder, the app says once when its
storage is
about four fifths full. That is the only warning you get, because a browser
stops saving without asking. If a save is refused, the bar says **Not saved —
storage refused** and the editor keeps working. Where the browser's storage will
not open, a strip says so from the start. In either case, save a saved copy,
because
otherwise the work is gone when the tab closes.
Every notice (saved, loaded, failed) appears in that bottom bar.` },
    { title: `Saving, exporting, sharing`, text: `Two ways out, for two purposes.

- **The saved copy** (\`.lvarch\`, **File › Save a Copy…**) is everything and is what you hand to someone who will edit
  further. It is your **whole organisation** in one file, **under a password**: you are asked for one when you save the copy — twice, because
  a lost password cannot be recovered — and whoever opens the file is asked
  for it again. Nothing about what is inside can be read without it. It holds
  every scope, whichever screen you are on when you export — the
  organisation's home, a scope's home or an open board: a landscape on its
  own refers to applications defined a level up, and a file with only the
  landscape in it would open on someone else's machine full of names pointing
  at nothing. The file is named after your organisation. Saved copies from
  earlier versions still open, with a password or not, and one holding a single scope
  still opens as that scope. It is also how work moves **between places**: a
  file saved from the desktop's folder opens in this browser, or the other way
  round, the same byte for byte, pictures and all. **Opening one asks where it
  goes**:
  - **A new folder…**, where a folder can be chosen, makes it a working folder
    of its own and takes you there, leaving what you had open untouched. A
    folder that already holds something is only written over after a second
    yes.
  - **Replace … here** writes it over the scope you are on and everything
    filed under it, and says so before it does. Where a history is kept, a
    snapshot is taken first, so what was there can be restored. Where none is
    kept, it is gone.

  Every scope in the file lands, or none does. Once it has landed, the app
  checks what arrived against what the file says it holds, and says so.

  The file carries the **people register** too. Tick **Without names** when
  you set the password, and every person goes into the copy as their
  pseudonym, with no address, a signed decision without the names it was
  signed with, and an observation without the name of who recorded it — for a
  copy that leaves the organisation.
  Opening a file never gives a name back to someone forgotten here, never
  brings back anyone removed here, and a file made without names takes no
  name away. Someone forgotten or removed where the file was made is
  forgotten or removed here too: forgetting travels with the work.
- **PNG export** (the download button) opens a dialog with a preview of the
  picture as it will leave: in the light or the dark theme regardless of the
  one on screen, with every line's label or only the bare lines, with or
  without the title block along the bottom — client, author and date — and
  with or without the legend under it, which says what the badge and lifecycle
  colours mean. A container diagram's export carries its title in the
  strip, the application, a sentence and the date, its key always, and if asked every line in words. Lifecycle badges
  can be switched off first for a clean picture. If a logo could not be
  embedded, the bottom bar says which. A very large board is tens of megapixels
  and takes a while to draw, so the dialog says how big the image will be and
  its button asks before it starts.` },
    { title: `Preferences`, text: `Grid, snapping, lifecycle badges, collapsed panels and their widths, the
minimap, the tidy settings, the language and the theme are remembered per
browser or per desktop install. They belong to you, not to the scope: they
do not travel in a file. The same goes for what this machine does about a
folder — pull on open, push after a snapshot: the desktop keeps that with the
install, and writes nothing of its own into your folder.` },
  ],
  board: [
    { title: `Drawing`, text: `**Domain groups** box the applications that belong together. Add one from
**Add** or from the canvas menu, give it a colour, drag applications in, tidy it
on its own. Removing a group leaves its elements where they are.

**Container diagrams.** An application can have a container diagram
underneath it: the application becomes the boundary of that diagram and its
components sit inside. You make one on purpose — right-click the application
and choose **Create container diagram**, or press **Create** beside *Container view* in
the panel — and it is a step in Activity like any other, so
{key:Mod+Z} takes it back. A card that has one carries a small mark; double-click the
card to open it. Double-clicking never creates one. A landscape tab lists its
container diagrams under a chevron: right-click an entry there, or press the
chevron after the name once the diagram is open, to rename it, open its
**diagram settings** or delete it. Deleting one takes its components with it
and keeps the application. Right-click a landscape tab for the same menu, with
duplicate as well. **‹** with the name of the board you came from, or {key:Mod+Up}, returns to it
on its day, with its zoom and what was selected; a diagram opened from a board on
another day opens on that day. {key:Mod+Down} on an application goes in, as does a
double-click or **Open container diagram** in its panel; its card says how many
containers it holds.

**Where it runs** on the bar draws dashed boxes around the containers,
one per platform, nested the way the platforms nest — the namespace inside the
cluster inside the account — with a container that runs on nothing outside
every box. They are worked out from the rows and cannot be moved: a box is
where its members are. It is off until asked for, as the plain C4 picture
keeps to one level, and the view remembers.

**Keyboard.** Tab walks the elements on the canvas, Enter selects the focused
one and Shift+Enter adds it to the selection. The arrow keys nudge the
selection by a grid step, Shift by one pixel. \`?\` shows every shortcut.

Lines and the names of domain groups are in the same walk, and Enter selects
them too; Shift+F10 opens the menu of whatever is selected, and Enter on the
element that is already selected opens its documentation. To draw a line
without the mouse, choose **Start connection to…** from an element's menu, Tab
to the other end and press Enter. On a landscape tab, ↓ lists its container
diagrams and Shift+F10 opens the tab's menu. Resizing an element, a band or a
group, moving a group and bending a line still need a pointer.` },
    { title: `Elements`, text: `Seven kinds: application, component, external system, input channel,
management tool, actor, and the domain group that holds them — and, since
the physical view, a **platform**: a cluster, a broker, a bus, the tooling,
what the applications run on and what they use. Select one and the **panel**
on the right shows it: its kind, a name that wraps, one line of facts, and three
tabs. With nothing selected there is no panel and the board has the width; press
the name of the view that is up for **This view**, what it is and holds and its
tidy. Every fact is a row of label and value, and a press turns the value into a
field: Enter or leaving keeps it, Escape puts it back, and the foot says what the
field is for. A field with nothing in it stays out of the panel until **+ Owner,
vendor…** adds it. The element's page, its **record**, shows the same rows with
every field, an empty one as a dash: the two are built from one list, so they
cannot drift apart.

**Owner.** An application's owner is one field: pick the unit that answers for
it, or type a name, which is flagged as not a unit. Pressing the other clears the
first.

**Certainty.** An element or a line can say it is **confirmed** or **assumed**,
as a word on the row. An assumed card is drawn dashed. Saying nothing is nobody
having said.

**Icons.** Around a hundred built-in marks, searchable by name, category and
keyword in both languages, in two sizes: small in the header, large leading the
card for a diagram read from a distance. **Upload a logo** in the picker adds
your own SVG or PNG (up to 200 kB). Uploaded logos travel in the saved copy.

**More than one at a time.** Select several and the panel lists them and says what each field holds, *Live, all 3* or *Mixed*. Lifecycle, colour, icon and domain group for elements, and protocol, technology, window, direction, colour and line style for lines, one undo step each. Selecting both kinds heads each part with what it changes. **Arrange** and **Remove** are there too.

**Change kind.** Right-click an element, **Change kind ▸**, and pick what it
should have been; connections, description and place stay. Two cases are
refused with the reason: an application that has a container diagram, and a
component still attached to an application.

Elements belong to the model, not to a view: one element can be on several
views, and **Remove from view** is a different action from **Delete from
model**. Deleting asks first, and says how many connections go with it.
Deleting a unit takes every assignment in it along, ended ones included, as
if they had never been made: the question names who stops being what —
*Ada Lovelace stops being Product owner in Webshop.* — and one undo puts the
unit and its people back. To keep who held what, end the unit on a day
instead: its lifecycle, or a plan (*Change over time*).

The question about a unit starts there: *Ending it is usually what is
meant*, with **End on a day…**, which asks for its last day and ends it
without deleting anything. Under **Delete** it says what goes with it, in
short lines. **Inside it** names the units filed under it, here or in another
scope, and where they go: up into its parent where their type may sit there,
with **Other choices** folded beneath; where it may not, into another unit of
its type, picked from a list, with **Move them up** marked *would show as
misplaced* and **Delete them too**, which takes everything under them and
their people's assignments as well. Applications that name it as their team
are cleared and show as owned by nobody, and its links to the domains it
serves and the capabilities it is responsible for go with it, wherever they
are kept. It is one change: where another scope is changed too, that scope's
part is its own step, and the step here cannot be taken back with undo.
Deleting any actor moves what sits in it up into its parent.` },
    { title: `Connections`, text: `Point at an element and drag from the dot at its edge to another: the line shows
the route it will get, what it may land on is ringed, and it lands on the side you
let go by. Hold Alt to choose the side it leaves from too. Let go on open board and
the same field as a double-click asks what is to come, and what you choose arrives
connected. Without the mouse, right-click or Shift+F10 and **Start
connection to…**. A connection carries a label, a protocol (whatever you type:
REST, EDI, Kafka), a technology, a direction that sets the arrowheads, a colour
and a line style. Double-click the label to edit it in place.

**Where an interface lands.** The landscape draws one line per interface, and
where it arrives is a level down. Open the application's container diagram and
grab the end of the line where it meets the boundary box: drop it on a
container and the interface lands there, taking its protocol with it. Grab it
again to move it to another container, or drop it back on the boundary to take
the landing away; **Lands on ▸** on the line's menu does the same without
dragging. A second landing is a second line — draw one from a context box to a
container, and the inspector asks at the top which interface it is part of,
with the one running that way already ticked.

Once an interface has landed it shows *Detail: 2 interfaces on the container
diagram · REST, AMQP* in place of its own protocol field, because the
protocols are the landings' — and **Open**, or a double-click on the line
itself, goes there. Container lines you draw without saying what they are part
of are interfaces of their own; the roadmap's findings offer to draw the
application line for them (see *What the dates disagree about*).

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
had, and everything you drew by hand stays exactly as you left it.` },
    { title: `Layout`, text: `**Arrange** on the bar holds it all. **Tidy the board** runs an automatic layout
over the diagram, with a reading direction (across, down, or groups across and their
applications down), the spacing, and what to leave alone. **Route the lines** redraws
only the lines and leaves every element where it is; **Route all lines again**
ignores what you pinned; **Route after every move** keeps them routed. A
domain group can be tidied on its own from its menu.

Tidy works beside the app rather than inside it, so the window stays alive while
it runs and **Arrange** becomes a **Cancel** while it does. On a diagram of
more than four hundred boxes it declines and says so, rather than thinking for
several minutes: split the board across diagrams, or tidy one domain group at a
time.

By hand: **align** and **distribute** a selection from the panel or the
right-click menu, a **grid** with optional snapping, nudge with the arrows,
**fit view** (Shift+1) and 100 % (Shift+2).` },
    { title: `Diagram settings`, text: `Right-click a diagram tab, **Diagram settings…**.

- **On the drawing.** Author, client and date for the title block of a PNG
  export, each falling back to the scope's default or the day of export when
  left empty, and whether to draw the title block at all.
- **Operational aspects.** The aspect columns applications on this diagram carry:
  add a standard one (platform, CI/CD, DR, security, monitoring, backup,
  compliance, cost), add your own, rename, reorder, or switch the badges off
  altogether. Renaming a column keeps every status already recorded against
  it.` },
    { title: `Time, and the day a board shows`, text: `Every application can carry **lifecycle dates** beside its lifecycle: the day it
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

**Day** on the view's bar says which day the board is drawing. It says nothing
special on today, and offers the days worth looking at — what a plan has on a day,
when something goes live or goes away, where a board is saved — and any other
through *Choose a day…*. A day is drawn from today's model using its dates: every
card draws the phase it is in on that day, and a line with a window appears only
inside it. To see what was really saved on a day, open **History…**.

Looking at another day is a state of the whole window: a band names the day, an edge
runs round the canvas, and the board is read-only — the palette and the fields are put
away and undo is off. It is only on your screen, nobody else sees it, and the address
carries it (\`?day=2027-06-01\`), so a link opens the same look. **Back to today**, or
**Back to** the board's own day, is one press. **Make this the view's day** in the
band is the deliberate step: one edit, one entry in Activity, and {key:Mod+Z} takes it back. It
works for today as well, which puts a dated board back on the calendar. A board
saved on its day says that day on its tab and stays editable on it, and who holds a role
can still be changed on the day you are looking at. A container diagram opened from a
board takes that board's day along, and its way back goes to that board.

That is how a future diagram is made. Right-click a tab and choose **Duplicate
as of…**, pick a day, and you have a second board of the same landscape as it
will stand then. There is only ever one model, so the two cannot drift apart.
An exported PNG of a dated board says the day in its title.

**Replaced by** on an application names its successor, and **Owner** says who
answers for it. Owner used to be a row in the documentation template; it is a
field now, so the roadmap's checks can name a person.` },
  ],
  panel: [
    { title: `Elements`, text: `- **Properties.** Lifecycle (planned, live, retiring, retired; shown as a badge,
  retired elements dim) and category, the first lines of the description (see
  *Documentation*), where it runs, its record's filled fields, the **operational
  aspects** of an application, one row each with a note on a press, and what is
  inside it. The columns of the aspects are set per diagram in its settings.
- **Appearance.** Accent colour, shape, icon, icon size, and where it sits on this
  view.
- **Comments.** The thread, with its count on the tab.

**⋯** beside the name holds **Move…**, **Change kind** and **Remove from view or delete from model…**.` },
    { title: `Documentation`, text: `Every element has a markdown description, and it can be a whole page. Its first
lines stand in the panel; a press writes them there with the same editor, and
**Open the page** opens the same text on the element's **record**. So do
**Record ›** beside its name, **Open documentation** in the element's menu, Enter
on the selected element, and a double-click on anything that is not an
application.

The record reads as one page: the text with its contents, then the same rows as
the panel with every field shown, press to edit in any state, and what it is
connected to: its plans, every line in and out, the views that draw it, what is
inside it, the principles it follows, its changes and its comments. Down the left
are the view's other elements, with a filter (a mark shows who has a page
already). *Appearance* stays beside the board, where the card is.

**Edit** opens a window with nothing but the source and the result beside it;
**Fields** brings the rows back beside it. {key:Mod+B} and {key:Mod+I} wrap the selection. The text
is saved after a short pause, one undo step for the whole of it. **Done** ends the
writing, and **Cancel**, or Escape, takes it back to what it was, asking first if
anything changed.

An empty page can **start from the template**: a header table and the usual
sections. The **Short description** row of that table is what the element
shows on the canvas; without it, the first paragraph is. \`[[Name]]\` in the
text becomes a link to that element. Ordinary links open outside the app.

**Documentation** in the top bar opens the page for the selected element, or
for the first element on the diagram when nothing is selected. A fenced code
block marked \`mermaid\` in any page is drawn as a diagram. A block marked
\`bpmn\` is drawn as a process: BPMN 2.0 XML as the common modellers save it,
with its own diagram section saying where everything goes — pools and lanes,
tasks, events, gateways, flows and messages, read-only. A process element's
page is where one belongs (its \`realises\` line says which capability it is how
of), and a file without a diagram section is shown as text under a line saying
why.

**Pictures.** Paste or drop a picture into the text to add it: PNG, JPEG,
SVG or WebP. **Pictures** beside the source lists every picture the scope
holds, with **Insert** to put one on this page and **Delete picture** to remove
one. The text names a picture by its name, \`![caption](image:floor-plan.png)\`,
wherever the scope is kept. A page lays every picture out at once, at its own
size, and fetches it only when it scrolls into view, so a long page opens
quickly and nothing on it moves when the pictures arrive. A picture that cannot
be shown shows its caption. Only pictures kept with the scope are drawn: a web
address shows as its caption, and the app never fetches anything.` },
    { title: `References in a document`, text: `A document can show what it is about rather than copy it. Type \`[[\` or a
lone \`@\` where you are writing, or choose a kind from **Insert ▾**, and pick
a principle, a building block's requirements, a scope's evaluation, a
decision, an observation, a view or an element. The document keeps a
reference, and reading it draws the thing as it is now: a principle as a
quote, the requirements and the evaluation as their grids, a decision or an
observation as a line that opens it, and a view drawn live and read-only at
its own size, with its name under it opening it. An evaluation can be pinned
to how it stood when it was referred to; it then says when it has changed
since. Something that is no longer there says so.` },
    { title: `Comments`, text: `A record says what it says; a **comment** is what somebody says *about* it — a
question, a doubt, a pointer to more evidence — without changing it. Every
observation, cause, solution and experiment, every element (units too), every
decision record and every plan ends in its **Comments**: the thread about that
record, oldest first, each reply under the comment it answers. A heading says
how many there are, and an observation's row in the register shows the count
beside its title.

- **Comment.** Write in the field under the thread and press **Comment**
  ({key:Mod+Enter} does the same). The body takes the Markdown a description takes.
- **Reply.** Press **Reply** under a comment. A thread is one level deep:
  replying to a reply answers the comment it is under.
- **Edit.** Your own comments only. An edited comment says *edited*.
- **Remove.** Your own, or anybody's where you may change the scope. A
  removed comment reads *Comment removed* where it stood, so the replies under
  it keep their place. Its words stay in the history, as any edit does.

**Who wrote it** is a person in the register, never a name typed in. The first
time you comment and nobody is *This is me* on this install, the thread asks
once who is writing — pick yourself, or add yourself with **New person…** —
and remembers the answer as *This is me*. Forgetting a person on the People
page reaches every comment they wrote, which then reads as their pseudonym.

Each comment, edit and removal is one step: it is in the **Activity** list
(*Commented on Webshop*), in the history and in the export, and {key:Mod+Z} undoes it.
A comment never changes its record, so the record's own history stays its
own. Where a scope is only read here, nothing can be commented — unless the
place your work is kept lets a reader comment.

**What travels with a record.** Deleting a record takes its thread with it,
and undo brings both back. Merging observations or causes moves each absorbed
record's comments to the survivor, each saying which record it came with; the
merge screen says how many go. An observation moved to another scope takes
its thread along, each comment saying the scope it came from; the move screen
says how many go. A merged or archived record keeps its own.

Comments are kept with the scope, in \`_comments/\`, one file per record
commented on. **Search** finds what a comment says in the scope you are in,
opens the record it is about and marks the comment in its thread. A record
shown from another scope says its comments are kept there, with a link to
that scope.

An agent comments as you do (\`comments.list\`, \`comment.add\`,
\`comment.update\`, \`comment.remove\`): its comments are signed by *you*, say
which agent wrote them, and are edited and removed by the same rules.` },
  ],
  technology: [
    { title: `Technology`, text: `What the applications stand on is a **platform** — a cluster, a namespace, a
broker, a cloud account, a firewall — and what a platform team offers is a
**platform service**: *Container platform*, *Message brokering*, *Managed
database*, *Identity*. The two are different things on the same layer. A
service is what a team asks for and a platform team is accountable for; a
platform is what delivers it this year, and could be replaced next year
without the service changing its name. A platform comes from the palette's
last row and lands in the management band as a chip; a service is made on
the technology landscape, where the layer is drawn, and a board draws it as
a chip with a mark of its own so the two are told apart at a glance. A
platform says what it is
on the inspector — a *place* something runs in, a *service* something
consumes, or a *network*; a service when unsaid — and what it is **part
of**, which is how a namespace goes under its cluster in the app; a platform
**realises** the services it delivers. A shared platform or service is
usually defined in a scope of its own, drawn elsewhere as a stand-in, so the
team that runs it owns its record.

**An application says one thing per question.** Where a container runs is
*Hosted on*, on the component's record, and an application is told what its
containers say: *Runs on: OpenShift (3 containers)*. What an application
consumes is **Uses**, and it names the service, not the product: a team asks
for message brokering, and which broker delivers it is the platform team's
business, said once as *Realises*. Which platforms an application actually
depends on is worked out from the two — the record's *Leverages* line reads
*Container platform (OpenShift), Message brokering (Event broker)* with
nothing typed on the application. Using a platform directly is still
allowed for the team that genuinely binds to one instance; the inspector
offers services first.

**Shared** on a service says it is offered for use beyond the team that
maintains it — *Maintained by* names that team. Organisations draw this line
differently, so it is yours to tick; and where nobody has, the rows still
say. A service maintained by one team and used by an application belonging
to another is being offered whether anybody said so or not, and the roadmap
and the technology register show it as a finding naming the consumers — a
conversation to have, never a box the tool ticks for you. A shared service
nobody outside its team uses yet is an ordinary thing and no finding.

**The technology register**, a card on the organisation screen beside the
register of applications, is every service and platform across the whole
tree: who maintains each, which are shared, how many applications consume
them and from how many scopes, what realises each — nothing realising a
service is a real gap, shown as one — and, for a platform, what it hosts
with everything filed under it. Derived from the folders every time, so it
cannot disagree with them.

**Two reports, one from each side.** Double-click a platform's chip, or
**Platform report** on its menu, for what would be left standing if it went:
what it sits in, what is under it, what runs on it or anything under it —
each container named beside its application and the namespace it sits in —
what uses it, and the container interfaces that cross it, each with the
application interface it is part of. Double-click a service's chip, or
**Service report**, for what would be stranded if it were withdrawn: who
maintains it, what realises it, who leans on it and from which scopes, and
which consumers would still be on it on the day it goes. Neither is drawn
or created; both are worked out from the rows every time you open them.

**The technology landscape** answers one question: what stands on what, and what
falls if a piece goes. *Landscape* on the technology card makes one in the scope
whose services and platforms it should draw, and it is listed among the tabs.
It is three columns of one-line rows that read left to right: every application
the rows connect to those services and platforms, from every landscape in the
organisation; the services; and the platforms, nested where the tree nests, an
outside one dashed. Nothing is drawn or placed: every row and line is read from
the records. **There are no lines at rest.** Hovering a row previews its lines and
pressing it pins them, and nothing moves when you do. **Matrix** shows the same rows
as a table, a filled mark for a use and a hollow one for what comes with hosting;
a press there selects, Space changes a mark, and a heading says who stands on it.
**Show** holds the rest: the services, every line at once, hiding what the choice
does not touch, folding hosting into service lines, the shared row, one line per
scope, and grouping applications by scope or by category. Above forty applications
the groups start folded, and *Find by name* opens the matches. **Colour** asks one
question at a time (what it stands on, its own lifecycle, its category, who answers)
with a key made of what is drawn, and writes nothing until *Keep with the view*.
**Day** reads the whole page on another day: what has gone is not drawn, and the page
is read-only until you go back. The reader on the right says what a row is. *If it
went…* opens its report, as a double press does, and *Edit record* opens the record in
the same column. The number on a platform's row is the number in its report: every
application standing on it or on anything filed under it, each once.

**Hosted on a platform another scope defines.** *Hosted on* lists, under
*Elsewhere in the organisation*, every platform the rest of the tree
defines, places first and each with its scope; choosing one writes the
stand-in for you, in the same step as the row. The library beside the
palette lists the tree's platforms and services after its applications.
And **hosting implies the service**: a container on Azure Cloud leverages
the cloud service Azure Cloud realises, whether or not anybody wrote a
*Uses* row — the record says *(implied by hosting)*, the technology
landscape draws it dotted and counts it, and a *Uses* row written later is
the same fact said out loud.

**Writing what an application uses.** An application's record has a **Uses** picker
beside *Hosted on*, and the landscape's reader has the same two: *Runs on*, and *Uses*
with an ✕ on each and *Add a service or platform…*, which lists this scope's first and
then what the rest of the organisation offers; choosing from elsewhere writes its
stand-in. **Edit uses** puts a tick on every row, a box for a use, a round mark for where
it runs and a hollow ring for what hosting already brings, and a press writes or takes
back, one step each. You can also **drag an application row onto a row in the other
columns**, and the page says the verb before you drop: a place takes where it runs,
anything else takes a use. A change goes to the scope that keeps the application, the
reader says which, and it shows in that scope's Activity. **Fold hosting into service
lines**, under Show, hides a hosting line where a use already reaches the same platform.
The \`+\` on a column asks a name or offers what is elsewhere in the organisation; the icon
and the rest are in the record. Under *Leverages* on a board's record, *Show on
technology landscape* opens the landscape that shows the application on that row, in
whichever scope keeps it — often the one that keeps the platform it runs on. Where several
show it, a small menu names each with its scope; where none does, there is no link. The
board itself still draws flows only.

What you choose is yours and writes nothing; **Keep with the view**, in the same menu, makes it what everybody opens on.

**Colour** on the landscape's bar tints the cards by platform — the
cluster, not the namespace — or by technology lifecycle, so the cards
standing on something retiring go amber, the whole chain counted — or by
**one platform or offering**: every application that uses it, is hosted on
it or leverages it is coloured and the rest fade, which is the reverse
question, who stands on this. Since 3.7.0 it also colours by **what the
record says** — the card's own lifecycle, its category, owner, vendor or
technology — and by the status in **one operational aspect** column, so
*which of these does nobody own* and *which are still on the old vendor*
are answered by looking. Every card in a band wears the band's colour as a
wash, a rail down its left edge and a **number**, and while it is up nothing
else on the board is coloured; the **key** in the
corner of the board names each band with that number and how many cards it
holds, and stays while you read; pressing a band there keeps its cards and lets
the rest recede. The number is the point: two colours are
not apart to every eye, and a number is. The word on the bar says what
the board is coloured by, and ✕ on the key takes the colouring off. Colouring
belongs to the reader and writes nothing, until **Keep with the view** on the key,
for whoever may write. The
**platform** badge reads off the roll-up where nobody set it, and the
roadmap's findings flag an application still standing on a platform after it
or anything above it has retired, naming the platform that actually goes.

**What a platform team does with it.** Define the services you offer in a
scope of your own, each assigned to your team and marked shared; file the
clusters, brokers and accounts that deliver them under each other with
*Part of* and say what each realises. Every landscape then draws your
services as stand-ins and its applications say which they use; the register
tells you who leans on what, the service report tells you who would be
stranded before you withdraw one, and the finding tells you which of your
own team's things other teams have quietly come to depend on.` },
  ],
  sheet: [
    { title: `The business architecture`, text: `A sheet is *laid out*, not drawn. There is nothing to drag and no router: what it
shows is four trees — a journey, the areas of responsibility under it, the
capabilities inside those, and the stakeholders down the side — and the page is
computed from their order and their depth. It gets a tab beside the boards, and
opening it leaves the canvas where it was, so the picture you were working on is
still there when you come back.` },
    { title: `The journey, and the paths through it`, text: `Across the top runs one **journey**: the thing the organisation does, end to end.
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
inside.` },
    { title: `Areas, and what covers them`, text: `Under the journey are the **areas** of responsibility, each with its groupings
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

**Domains**, in the inspector of an area, a grouping or a capability, says
which domains it is handed to: a chip for each, taken off with its ×, and
**+ Domain**, which offers the scopes below the one whose sheet it is, by
their path and their type. Each one added or taken off is one step, undone
with {key:Mod+Z}. Under it, **Taken up by** names every scope below that took it up,
each a way to that scope's home: one that took it up without being handed it
is marked in the warning colour, and a domain it was handed to that has not
taken it up yet says *not started*. A capability whose area was handed on says
so under its chips — *With Finance: Retail* — and a domain that took the
capability up was handed it with the area. A path no scope has any more is
marked *no such scope*. A function another scope defines offers no editor: its
domains are said where it is defined.

A domain takes a function up from its own sheet: **From above…**, beside
**+ area**, lists the areas, groupings and capabilities of every sheet above
it, grouped by the scope that defines them and saying what each sits in. Pick
one and the domain's sheet holds it as a stand-in — under its area where the
domain holds the area, as an area of its own otherwise — one step, undone
with {key:Mod+Z}, and nothing is written in the scope above. An area taken up after one
of its capabilities takes that capability in under it, in the same step. A
pick that lands nothing — taken up already, or no longer above — says so. What
the domain files under it is its own refinement. Handing a function on and taking it up are two
statements by two scopes, read together: neither writes the other.

At the end is a band for what is **not yet mapped to a domain** — the areas
that neither have been handed to a domain nor taken up by one, counting what is
filed under them: an area whose one capability was handed on, or taken up
below, is mapped. It is a finding, not an error: a list of what the
organisation has said it does and has not yet said who does it. The count on
the organisation's business architecture card reads the same.` },
    { title: `The stakeholders, and the units`, text: `Down the side are the **stakeholders**: the parties the organisation deals with,
in their own tree, the ones from outside marked. A unit — an actor with a unit
type, the organisation's own structure — is drawn there only where this sheet
uses it, under **Units on this sheet**: a unit responsible for something the
sheet draws (an area, a grouping, a capability or a step), or one with a lane in
its journey. Each says why in a line under its name. A party filed inside a unit
keeps its place, with that unit as its group.

The rest of the scope's units are counted under the list — *8 more units are
filed here* — and **All units** draws them too, under **All other units**. It is
yours and lasts for as long as the app is open, per sheet; it changes nothing in
the model. Units are made and arranged on the organisation chart, not here.

A stakeholder you type as a unit while the sheet is open stays where it was for
the rest of the session, and a note says it is now on the organisation chart.` },
    { title: `Making one`, text: `A sheet on a scope with nothing above its applications is empty, and the empty
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

**Supported by…** and **Assigned to** in the inspector are how a capability
gets covered: tick an application and it supports this capability; **+ Unit**
under **Assigned to** makes a unit responsible for it, picked from the whole
organisation the way a scope's **Served by** picks one, with this scope's other
actors after the units. Each is a step of its own, and the line under the
capability's name changes as you go. The row is kept here; a unit filed in
another scope is its far end, and is not drawn on a board here for it. A unit
that serves neither this domain nor sits under a unit that does is marked, and
is a check (below). **✕** on a chip takes a row kept here off again.

**The unit responsible** is named on every area, grouping and capability a
unit is assigned to, always: a small label beside its name, or on a
capability's coverage line, with **+1**, **+2** where more units are, and
every name in its tooltip. A unit outside the domain is drawn as a warning.
The label is a button: it opens the home of the domain the unit serves, a
menu of domains where it serves several or several units are assigned, and
the unit where it is kept — on that scope's organisation chart — where it
serves none. Pressing it does not pick the card.

**Show who is responsible**, in the top bar, adds the other actors it is
assigned to, that are not units, and marks the ones nobody is assigned. It is
off until you turn it on, and only for as long as the page is open.

**Delete**, at the foot of the inspector, removes what is selected and every row
that ended on it. It is refused while anything is inside it, and says how much:
nothing cascades, so an area you delete is an area you emptied first. An actor
that is a unit asks first, the same question as on a board (*Elements*):
ending it offered first, who stops being what, and where the units inside it
go — which therefore do not hold its delete back.

**What this sheet draws**, the sliders in the top bar, is about the sheet rather
than the model — which journey runs across the top (a scope with two journeys
starts with neither), which areas are drawn and in which order, the order of the
lanes, and whether the rail is there at all.` },
    { title: `Editing one`, text: `Pick anything on the page and it opens on the right: its name, its description,
what it sits under, where it is among its neighbours, whose path a step is,
whether a stakeholder is from outside the organisation, and the lifecycle a
capability is in — a capability being built is in the same phase as an
application being built. Moving one thing under another is refused if it would
put a thing inside itself; the refusal is offered in the list, not hidden from
it. The eye in the top bar hides the stakeholder rail, and the magnifying glass beside it finds anything on the page by name — pick a hit, or press Enter for the first, and the page scrolls to it, selects it and rings it for a moment.

Opening an application from a capability's coverage takes you to a board that
actually draws it, switching boards if the one you are on does not — and to the
application's own page when no board draws it at all.` },
    { title: `Coverage`, text: `**Coverage**, on the switch beside **Poster** and **Names**, is the same layer
read the other way, in the sheet's own tab: every function down the side, a column
per application the rows name, and a mark where one supports the other. The first
press makes the map where the scope has none and you may write; **+** in the
diagram tabs makes one too, and **New map in this scope** under **⋯** a second,
listed beside the switch. It keeps its own address, and an agent reaches it there.

It opens at two levels, with **1 2 3** for more. Beside each name stand what it
comes to: **Covered**, in words (*2 systems*, *by people*, *nothing*, and *3 of 4* on
a section), and **People**, where somebody is assigned. On a section a number says
how many capabilities under it each application supports. Applications another
scope owns stand under that scope's name, whose heading folds them. **All**, **Gaps**
and **Overlaps** change the page to a plain list, and **Find** does the same for a
name. **Day** counts the rows live on the day chosen, and nothing can be changed
while you look at another day. **Export** saves the whole table as a picture, with
its title block. **What it draws…** under **⋯** chooses the areas.

A press selects, so reading cannot change anything: a row opens its panel, and a
column heading opens what that application supports, what it alone supports, and the
way to it wherever it is kept. **Space** on a cell links or unlinks, as one step with
its **Undo**; a link kept in another scope is said to be, and is changed there.` },
  ],
  poster: [
    { title: `The poster`, text: `**Poster**, first on the switch, draws the sheet as one page of fixed size: the journey,
the stakeholders and every area as a block, every capability as a tile. It is the first
reading where the sheet has an area and the window is at least 900 pixels wide. It opens at
the larger of Fit and 90%, so a name can be read, from the top left where the rest is a pan;
after that it opens where you left it. **Fit** in the dock shows the whole. Below 70% the
names go and each capability is a square under the Colour that is up, which is what
Overview used to be; above 120% each tile also says what covers it and who answers. The keys
are the other canvases': {key:Mod} with + − 0, the wheel, a pinch, {key:Shift+1}. An address that
still says \`tab=overview\` lands here.

Colour and Day are the sheet's, and nothing moves for them: a function not there yet on the
day is dashed, one gone is struck through. Tab goes block by block, the arrows go from
tile to tile across blocks with the page following, Enter opens the panel and Esc comes back
to the tile. **{key:Mod+F}** finds, and lights what it finds.

**Read** and **Design** are two postures. In Read a drag pans, and nothing on the page
moves. In **Design** (\`tab=design\`) you may:

- drag a block by its title or pull its corner; it snaps to a grid of 8 and to its
  neighbours' edges, Alt lets go. The first move writes every block, so the page stops
  following the first layout. Space lifts a block for the keyboard, the arrows move it, {key:Shift}
  resizes, Alt steps a unit, Space drops and Esc puts it back;
- drag a tile within its block to a cell, and the others flow round it; or onto another
  area or grouping, which moves it in the model, on every view, as *Move to…* in the panel
  does. What another scope keeps is refused, in the panel's words;
- drag a team, an application or a subscope from the tray onto a tile, a grouping or an
  area. They write what the panel writes. A team also shows as a label on this poster;
  taking the label off leaves the assignment. A name you type is an actor flagged as not a
  unit. An application goes on a tile, not on a block. Select several with {key:Shift} or a drawn box
  with {key:Shift}, and one drop or a press in the tray takes all of them as one step. **L** and **A** on
  a tile open the same lists there;
- add a **note** or a **picture**, which belong to this view only, print with the poster
  and are found by Find. Double press a note to write it;
- give a step or a stakeholder an **icon** or a logo from the panel or the ◇ on it.

**First layout** throws the places away as one undo, **Reset tiles** lets every tile flow,
**Lay out for this paper** places everything at paper's shape. Overlaps are allowed and said
in the strip; an area added to a placed page takes the first free place, or waits under the
page, and is counted there. Nothing can be placed while looking at another day. The tile
size and the journey's rows are in **What this sheet draws**: a journey too narrow for
whole words takes two rows until you say one.

**Export…** under ⋯ puts it on one page, A4 to A0, with a title, a foot and the key,
in a print look that ignores the theme. It says how large a name comes out and how many this
page cuts, with a way to select them. A PDF on the desktop is saved directly; in a browser it
is the browser's print dialog, where you choose **Save as PDF**. PNG is on both.` },
  ],
  chart: [
    { title: `The organisation chart`, text: `An **organisation chart** is a view: **+** in the diagram tabs, then
**Organisation chart**, makes one, with a tab of its own. It is a tree laid out
from the units — nothing on it is placed by hand: the organisation at the top,
its units across, and units with nothing under them hanging in a column from
their parent, with a thin connector showing where each sits on the chart's day,
a plan's moves included. It holds the units filed in this scope and below it and
the units that serve it from above, and at the organisation every unit there is.
Units beside each other stand in the order of their types and then in their own
order where one is set, otherwise by name; every list of units keeps that order.

**The bar** says, left to right: **Levels** 1, 2, 3 or **All**, how deep the whole
chart opens; **People**, who is drawn: the leaders, the required roles, or all
roles; **Lines**, which reporting lines are drawn; **+ Unit**; and the **Day**.
The first time a chart is opened it shows two levels. A caret on a box folds that
unit alone, and a folded unit says what it hides on one line, *3 units · 3
vacant*; pressing that line opens it. **−**, **+**, **Fit** and **100%** are in
the corner of the canvas, with {key:Mod} and + − 0 and the wheel, and Fit stops at
60%, where a box says its name and what it hides and no more. None of this is ever
saved.

**Focus** on a picked box draws that unit and what is under it, in a grid where it
holds several, with the way up on one line over it and **Back to the whole chart**.
A focus has an address (\`?focus=\` a unit's id, as \`?lines=\` holds the Lines menu),
so a link and an agent reach it, and Back comes out of it.

**The outline** beside the chart lists the same units as a tree, and leads the
chart. Picking a unit there, or unfolding it by its caret, unfolds it on the chart
too, with every unit above it, scrolls the chart to it and picks it. Folding in the
outline folds the outline alone. The arrow keys walk it, right opening and left
closing. Its width is yours: drag the seam on its right, or give the seam the focus
and use the arrow keys. At its foot, **Up** and **Down** move the unit picked among
the units of its type in the same unit: one step in each scope that keeps one of
them. Where they are all kept in this scope, undo takes the move back; where some
are kept in other scopes, each scope is put back on its own.

**Finding.** The box on top of the outline takes units and people, with results as
you type, and {key:Mod+F} comes to it. A person found has their unit gone to and their
assignment opened. **Me** goes to the unit where you hold a role; say who you are
first, with **This is me** on the People page. On the chart, the arrows walk the
boxes, Enter picks and goes down, Shift and Enter goes up, M moves the unit and F
focuses on it.

**A box** says the unit's type and name and one line per role: *Head: Anna de
Vries*, with their share where it is not all of their time, *acting*, *ext* for
someone from outside the organisation, and *you*, or **vacant** in words, which a
press assigns in a unit this scope keeps. Someone over all of their time has *200%
of their time* in words on the line; someone in a role outside the unit's has a row
of their own with *outside its roles*. Neither mark ever stands in for the other. A
line under the name names the domains a unit serves where it serves more than one
and says the day it starts or ends, with the plan that does it: *from 1 Jan 2027 ·
TR-0007*. A role the unit's type does not require and nobody holds is drawn only
under **People: All roles**, and the unit's inspector always lists every role.

**Lines** draws reporting lines four ways: **Off**; **Person picked**, the lines
that apply to the person you press and the lines into them; **Dotted**, every
functional line on the chart; and **Exceptions**, every departure from the model,
listed in a panel as well, each going to its unit when pressed. It opens on Person
picked where the organisation has any line. An arrowhead always says which way a
line runs: the accent runs up to whoever they report to, neutral ink runs in from
whoever reports to them, and an exception is magenta with its words on the line.
Solid is a line manager's and dotted a functional one. A line to a role nobody
holds, part of a loop, or ending in a folded unit says so on the line, and the key
is always in its corner, so a line appearing moves nothing.

**Moving a unit to another place.** A unit filed in the wrong place moves without
being linked again: **Move to…** on the picked box, at the foot of the outline,
**Sits under** in its inspector, M, or dragging it onto another. A panel opens
beside the chart, which stays in view with its places lit: any unit in the
organisation, whatever scope keeps it, chosen by pressing it on the chart or in the
list, or **At the top**. The places where its type may sit come first; the others
follow under their own heading, and a move there is allowed but leaves the unit
showing as misplaced in the checks, until it moves again or the operating model lets
its type sit there. The unit itself and the units inside it are not offered, and a
place a plan's later move would make into a loop is refused, with why. **Move these
too** lists the units beside it under the same parent, none ticked. Before anything
is written, **Who manages it** says who manages each unit from above, today and
after the move, and a plan's move of the unit is named with its day. Nothing is
written until **Move**, and Esc leaves it. The unit keeps its id, so its people, its
reporting lines, the scopes it serves and its comments stay with it, and the units
inside it come along. It is one step in each scope that keeps a unit moved, all of
them or none; where that is only this scope, {key:Mod+Z} takes it back, and where other
scopes were written too, each is put back on its own. A move is a correction, with
no day: a move from a day on is a plan's (*A reorganisation is a plan*). A chart
that is only read offers none of it.

**Making a unit on the chart.** **+ Unit** on the bar makes one inside the unit
picked, or at the top with none picked; **+ Unit inside** is on the picked box, and
an empty chart offers **+ Unit at the top**. A small dialog asks for four things.
**Type** offers only the types that may sit there. **Name**. **Serves**, asked only
at the top or for a type that serves several domains. **Filed in**, the scope that
keeps it: by default the scope of the unit it sits in, and at the top the domain it
serves, or else this chart's scope. **Create** is one step in that scope. The new
unit is picked and its required roles show as **vacant**, so assigning people follows
straight on. Where no type may sit, it says so and leads to the **Operating model**;
with no unit types at all, to **Start from a library**. A chart that is only read
offers none of it.

**Assigning** opens a popover beside the vacancy, with the chart still in view: the
role, with any other role of the organisation offered as an exception and said to be
one; each person with their share now; **New person…**; and the share, the first day
and *acting*. Where the choice takes someone over all of their time it says so before
**Assign**, with **Set a share**.

The chart is drawn on a day, as a board is: **Day** on the bar looks at any other
day, and **Always open this chart on this day** keeps it with the chart (see *Time,
and the day a board shows*). A band says so while another day is shown, with the way
back to today. On a later day the units a plan brings are there, and a unit that has
ended is still drawn — dashed, and saying so — while anybody is still assigned to it,
so the people a reorganisation left behind are seen where they were left.

**The line under the chart opens its summary** beside it: whose
chart and on which day, how many units and people are on it and how many
places are vacant; then **Findings**, what the organisation contradicts about
these units and the people in them, in the list of findings — **Open the
unit** goes to the unit it is about, and **Open in People** to a person over
all of their time;
and **How to read it** — **vacant** is a role the unit's type requires and
nobody holds, a share over 100% in words is someone over all of their time,
and a dashed box is a unit that has ended with people still in it.

A click picks and a double-click opens, as on a board. Clicking a unit this
scope keeps opens it in the inspector beside the chart — its people, its
roles, who manages it and the units it works with. Clicking a unit kept in
another scope goes to it on this chart; double-click it to open it there, on
that scope's chart, chosen, with the same inspector beside it — or on its
record where that scope has no chart. 

Clicking a person opens their assignment in the inspector instead: who holds
it, the role and the unit, its first and last day, the part of their time it
takes, and a note where they hold more than all of their time on the chart's
day, who reports to them and how much of their time it is. **End this
assignment…**, at the foot, asks for its last day and ends it as one step — the
day before the chart's day where you are looking ahead, today otherwise, and
never before its first. An ended assignment stays: it is what the person held.
**Correct…** opens the unit's dialog for everything else, and **Open in
People** goes to the People page with the person picked.` },
    { title: `The Conway map`, text: `A **Conway map** is a view too: **+**, then **Conway map**. It asks whether your
teams and your systems line up, and says the answer in a sentence over the map,
with one sum that adds up: of the interfaces that cross a unit, how many can be
judged and how many cannot, because an end has no owner. An application belongs
to the unit it names as its owner. Where half the applications or more have
none, the map says it cannot answer yet and the panel beside it asks for owners,
**Choose a unit** on each, one step each.

**Grid**, the first reading, shows each two units once. A triangle in a marked
cell is **systems connect, nothing said**, with the number of those interfaces;
a tick is **both agree**; a ring is **said, but no system connects**, with the
letter of how they said they work; a dash is **cannot judge, no owner**, in the
row of applications with no owner yet; and a dot is **marked as intended**.
**Lines**, the second reading, draws each unit as a column in the chart's order
with its applications under it, and the interfaces in the gutters and above the
columns, so no name is crossed out: heavy and dashed where nothing is said, thin
where both agree. **Show** leaves out what agrees, and **Show their lines** adds
those to applications with no owner. **Group by** rolls the columns up to a unit
type above the owners, and says so where there is nothing to roll up. The
reading, the grouping and the pair are in the address.

The panel beside the map says **What to look at**, by check: the pairs with
nothing said, applications with no owner, a unit that owns more than its type
allows, and behind **Show notes** what is said with no system between, and an
owner that is a name and not a unit. **Accepted** lists what was marked as
intended. Nothing on the page changes anything until a button in this panel is
pressed. Pressing a cell, a line or a row reads that pair, and draws its two
units and its interfaces under the grid. It says why it matters and offers the
answers: **Say how they work together…**, **They should not depend on each
other: plan it away…**, which puts the applications on a plan of this scope or
a new one, and **Fine as it is: mark as intended…**. Where two units cannot say
how they work together it says why: a party that is no unit yet can be given a
type there and then with **Make them units**, a party outside the organisation
can only be marked or planned away, and two units another scope keeps are
answered where they are kept. A pair that said how it works with no system
between them can **Delete what was said** or **Draw the missing interface…**.
Pressing a unit's name reads what it owns, who it works with and its open pairs,
with **Open on the organisation chart** for the rest; pressing an application
reads its owner and its interfaces. **Find me** goes to your unit, and says why
where you hold no role in a unit on the map. Like the chart it is drawn on a
day. An application is on the map while it is live or retiring on the map's day:
one not yet live, or gone, is not drawn, and neither are its interfaces nor
anything the map would find about it; a unit's limit counts what it owns on that
day.` },
    { title: `Who works with whom`, text: `A unit's inspector has **Works with**: every unit it has said it works with, in
one of three ways: **Side by side** (on one thing, for a while), **As a service**
(one provides what the other uses, with little to agree each time) and
**Helping** (one helps the other learn or take something up), and the days it
holds, where they are known. **+ Say how you work with a unit…** adds one, with
nothing chosen until you choose it, and a press on one corrects it or removes
it, each as one step in the scope that keeps the unit. One kept in another scope
is listed with where it is kept. A draw.io box that points at a unit opens it on
the scope's organisation chart, where there is one.` },
  ],
  drawing: [
    { title: `A drawing`, text: `A **drawing** is the one view you draw and the model does not. **+** in the
diagram tabs asks which kind of view to make, split by who draws it: under **You
draw this one**, **Drawing** asks for a name and, if you like, the element it is
about. A scope's home offers the same. It has a tab of its own, like a landscape
or a sheet.

A drawing is shown as its picture, with one bar like every other view: what it
is, how many of its shapes point at the model, and what you can do with it. A
later page of a file is drawn in the editor and not pictured; the bar says so.
With no picture it says why: **Not drawn yet**, with **Start drawing**; **Written,
but not pictured yet** for a drawing an agent wrote, listing what it points at;
or, where there is no editor, why not and where to get one.

On the picture, each shape that points at an element is outlined and named on
hover or focus. Pressing it opens the element in the panel beside the picture,
with **Open page**; the picture does not move. **n links** marks them all and
lists them: which are in step, which **need a look** (the element is no longer in
this scope, or the picture still says an old name), and which shapes are only
drawn. A shape pointing at an element this scope does not hold is also a finding
in Checks. **Fit**, the zoom and **Export…**, as SVG or PNG from the kept picture,
are there for anyone reading.

**Edit drawing** opens the editor, in the language the app is using; the address
says \`?edit\`, so a link or an agent can open it too. The palette holds the scope's
elements by name, grouped by kind, each a shape that points at that element, and
the C4 shapes. When the editor opens, each such shape is labelled with that
element's name as it is now. The bar above is the app's: what is being edited,
**Save** and **Done**. The status word says **Not saved yet**, **Saving**, **Saved**
with the time, or **Could not save**, and a failed save stays there with **Save
again**. Saving keeps the drawing as one: its XML, its picture, and the links the
shapes make. When somebody else saves the same drawing while the editor is open,
theirs is merged into what is open, and the bar says so once.

Selecting a shape says under the canvas what it points at, with **Open page**,
**Point at another…** and **Unlink**. The address form stays underneath for an
agent and for files.

Leaving with unsaved work asks first, whichever way you go: a tab, a page, the
tree, Back or the window. **Save and leave** keeps it, **Stay** goes back, and
**Leave without saving** drops it. The editor is a separate service; when it has
not answered for 15 seconds the page says so, with **Try now** and **Back to the
picture**, and **Done** is always there.

**Diagram › Export as** in the editor makes a file of the drawing: PNG, JPEG,
WebP, an animation as a GIF, SVG, XML or JSON. It is named after the drawing, and
the app says so once it is saved. The desktop asks where; a browser puts it with
its downloads. Exporting changes nothing in the drawing, and it is not a save.

The editor and the picture follow the app's theme: light, dark, or the
system's. Changing it while the editor is open keeps what is being drawn.

A view that may not be changed offers no **Edit drawing**, and says so once.
Deleting an element keeps the drawings anchored to it, without the anchor; undo
puts it back.

A drawing may be anchored to an element. The element's menu offers **Create
drawing** beside **Create container diagram** or **Open container diagram**,
and the inspector has the same button. Making one is one step, and undo takes
it away. A double-click on the element offers the drawings anchored to it,
beside its container view when it has one. A double-click never makes a
drawing.

The element's page lists those drawings. Choosing one opens it.

In a document, \`![caption](view:id)\` shows the view with that id from this
scope. A drawing is shown as its picture, with a transparent button for each
shape that points at an element; choosing the button opens that element. A
view of another kind shows the caption and **No picture yet**. A view that is
not in this scope shows the caption and says the view is missing.` },
  ],
  decisions: [
    { title: `Decisions`, text: `This scope's records are **one list**. A record either belongs to the scope as a
whole, or it is about one thing in it — an application, a capability, a journey
step. **Filter** narrows the list by what a record is about: this scope as a
whole, the applications with decisions, every other application, and under
*Removed applications* what has left the model and keeps its records.

At the foot of the list come the scopes **above** this one, a fold each: *From
Acme Logistics*, *From Retail*. Their records are read here and **changed where
they live**: the record offers no way to write it, and offers to open that scope
instead. Numbering is per scope, so ADR-0001 of the domain and ADR-0001 of the
landscape are two records and always were.

A record follows the MADR format: context and problem statement, decision
drivers, the options considered, the outcome and its consequences, the pros and
cons of each option, more information. **New decision** asks for the title and
what it is about, starts the body from that template, and opens ready to write.
**Edit** is a full window: a box per section, with markdown inside and its
help under it, and **Source** for the whole body at once, which is where a
heading is changed, and which fills the window. Beside the text stand what
acceptance still needs, who proposed it, what it supersedes, and the
**reviewers and signatures**, each with a verdict and the day it was given; on a
narrow window they stand under it, and **Details** folds them away. **Done** saves
it as one step, and **Cancel** asks first if anything changed. Sections nobody
has written yet are left out when the record is read.

The status is a workflow, not a label, and the record shows where it stands on a
line at the top, with one sentence under the title. A record starts **proposed**
and is sent for review; **under review** it is accepted or rejected. Those two
are the end of the road: from there the record can no longer be edited or
deleted, because a decision that can be rewritten afterwards is not a record of
one. An accepted record can later be **marked as superseded**, under ⋯, which
asks for the record that replaces it and shows the link both ways. Review can be
sent back to proposed, and a proposal withdrawn, both under ⋯ too.

**What acceptance needs** is beside the record from the first draft, with what
each line looks for written out. An open line goes to the place that answers it,
and the button says how many are still open.

The search field above the list searches every record at once — title, body and
reviewers, this scope's and the ones above. Bodies are markdown, with the same
\`[[Name]]\` links as documentation, and mermaid diagrams. Changes are saved with
this scope.` },
    { title: `History`, text: `Every place keeps a history of your work. **Snapshot…** in the File menu (on
the web, the **⋯** menu) offers a message already written from what you did,
such as "Changed Warehouse Management, Moved 3 elements", which you can edit
before it is recorded. The first snapshot asks you to **Start keeping
history**, and says where it will be kept:
- in the folder itself, using git;
- in this browser, for a tab's folder (nothing is written into the folder for
  it) and for a tab with no folder;
- for as long as the tab is open, where the browser's storage will not open.

Nothing leaves your machine, unless you turned on **Push after every snapshot**
for a folder with a remote. On the desktop the history needs **git** 2.26 or
newer on the machine: without it, a snapshot is refused with a sentence saying
so, and everything else works as before.

**History…** lists every snapshot. Choosing one shows what has changed since it
— applications added, removed and altered, connections drawn and cut, decisions
taken — with the geometry as a count rather than a list, because a tidy pass is
one sentence and four hundred changed lines. A move is an entry too, *Moved from
X to Y*, in the history of every scope it moved.

**The history of one thing.** The picker at the top of the History page narrows
it to a diagram, a description or a decision: the list becomes the snapshots
that touched it, and the changes the rows about it. The same page opens already
narrowed from **History…** on a diagram's tab menu, on the documentation page,
and on a decision's page.

A description is the one subject that is not one scope's business: a name means
the same thing everywhere in the organisation, so an element's page is written
where it is defined *and* wherever a scope draws it and says what it means
there. The history of that element is the union of those pages, and a line
under the picker names the scopes it is reading. Restoring one stays this
scope's: it puts back what this scope's page said, and the others are theirs to
restore.

**Restore.** With a snapshot chosen, **Restore this version…** makes the
diagram, description or decision what it was then; with the whole scope
shown, **Restore the whole scope…** does the same for everything. A restore
is a new change on top of everything that happened since, not a step back: the
history keeps growing, the Activity list says *Restored the view Warehouse
as of 3 Sep*, {key:Mod+Z} undoes it, and the next snapshot records it. The app offers
that snapshot on the spot. A decision that has been accepted, rejected or
superseded stays as it is — write a new one that supersedes it — and a
restored diagram leaves out elements that no longer exist, and says how many.

**Labels.** **Label…** on a chosen snapshot gives it a word of your own —
"Shown to the board" — shown beside its message, never instead of it. A label
travels with the history, so a colleague sees the same mark in the same place;
in the desktop's folder it is a git tag, which any git client shows. Two labels
with the same name are refused, anywhere in a folder and within one scope in
a browser; pick another word.

**Snapshots the app takes itself**, where a history is kept: before a working
file replaces what is here, before a scope is put back from the history, and, on
the desktop, before a folder is pulled from its remote and before a folder from
an older version is converted. Each is named for what it came before, so what
was there can be restored.` },
  ],
  observations: [
    { title: `Observations`, text: `**Local and global.** Every scope's observations, causes, solutions and
experiments are its own. Read from a scope, those of the scopes below it are
**local** to those scopes; read from the organisation, the organisation's own
are the **global** analysis. Nothing is shared to get there: a scope reads
the analysis of every scope below it, and who may read a scope is decided
where the work is kept, never on a record. **View local**, beside the
picture's other controls, is on where the scope has scopes below and off,
saying why, where it has none. On, the picture draws each scope below in a
boundary of its own to the left of this scope's lanes, nested as the tree
nests, and the register, the causes, the solutions and the experiments list
the records of each scope below after this scope's own, under *Local to …*.
The counts over the picture — observed, analysed, assumed, verified, root
causes, open ends — count what the picture draws, the scopes below included.
Off, the page shows this scope alone, and says how many local records it
hides.

A record of a scope below is **changed where it lives**. Its reader says so
in a strip — *Local to Application landscape* — with a button under it that
opens that scope's page. What you add to it from here — a sighting, a cause,
a deeper cause, a link between its own records, making one of its causes a
root cause — is made in that scope and saved there at once, as that scope's change
rather than this page's: a note after it says where it went, and {key:Mod+Z} on this
page does not reach it — to take it back, change it back. Where that scope
may not be changed from here, or its own rules refuse the change, the note
says nothing was made. A solution or an experiment of a scope below
is read here and not changed.

An observation is a numbered record (\`OB-0007\`) with a title, a place, who
saw it — free text: a name, initials, a team — the day it was first seen, an
impact — *minor*, *major* or *critical* — and a markdown body for what was
seen, the evidence and who or what it affected. **Seen again** counts one
more and writes the day into the record's **history**, which is the dated
ledger at the end of every observation: recorded, seen again, merged,
archived. On a large card the impact is a stripe down the left and the count
is in the corner; on a small one the impact is the size of the circle.

**Bright spots.** Not everything worth understanding goes wrong: a team that
never misses a release is worth asking why, too. An observation is either a
**problem** or a **bright spot** — something that works — and *New
observation* asks which first, problem chosen; *Edit* on its reader changes
it later. A bright spot is analysed as a problem is: its causes are what make
it work, the team says which is the root cause, and a solution on that root
**spreads** it, with the same questions to answer and the same experiment
before it is proven. A bright spot has its own chip in the register and on
its reader, and is drawn in green in the picture, with the lines of the chain
behind bright spots only. The counts over the picture and on the scope's
home count bright spots apart. A problem and a bright spot are never merged:
the merge screen offers records of the survivor's kind only. And a bright
spot seen again after a solution was built is that solution working, so it
is not flagged against it.

**New observation** — in the top bar, and in a register with nothing in it
yet — asks for the four facts that make one: the title,
**where seen**, **observed by** and **date seen** — the same words as when it
is edited. Date seen starts at
today and may not be in the future; the impact starts at minor. On the right
the description asks its three questions a field each — **what we saw**,
**evidence** and **who or what it affected** — and the last is required too:
an observation always says whom or what it touched. Recorded, the three are
one markdown description under those headings. **Preview** shows it as it
will read, and **Edit** goes back to the fields. **Edit** on a recorded
observation opens it in the whole window as the document it is: the title, each
heading with its text under it, one toolbar over them all, and its facts beside
it. There **Preview** shows that document as it will read, in the same place, and
on a wide window **Side by side** shows both, as it opens on the widest. Every field has an example
under it, and a field left empty says what is missing in its place, and the
count beside the button. Every dialog on the page keeps what is written in
it: a click beside it does not close it, Escape does not once something is
written, and Enter in a one-line field does what the button does. Under the title, two
hints that never stop you: **Seen before?** lists observations of the chosen
scope whose titles share words with yours, each with **Seen again**, which
asks the day and a note, as on the reader, and records a sighting on that one
and nothing new — Cancel goes back to the form as you left it; and a title that uses a word
that reads like a cause, a fix or blame — *because*, *should*, *fix*,
*fault* — is told to keep to what was seen and put the why in a cause. With
View local on, the form asks first which scope the observation belongs to;
one below makes it local there.

The **causes** can be written with the observation. **New cause** opens a
cause's fields in the form — its title, *why we think so*, whether it is a
root cause, and how strongly it explains the observation — with *Already
written down?* over the causes of the scope. **Existing cause** picks one
already written down. Each row says whether it is new or existing and can be
taken off again, and nothing is made until you record: the button says what
it will make, *Record observation with 1 new cause and 1 link*, and it is one
step — {key:Mod+Z} takes the observation, the new causes and the links back together.
Changing the scope takes off the links to causes of the scope chosen before,
and says so.

Observations that turn out to be the same thing are **merged**, and so are
causes written down twice. **Merge…** on an observation or a cause — on its
reader, on a right-click, or on one of a scope below — opens the **merge
screen** over the page, with that record picked. It has three parts:

- **What to merge.** A search over the live observations, or the causes that
  are not merged, of this scope; tick **Across scopes** to search every scope
  you can read, nearest first, each hit naming its scope. Tick as many as are
  the same thing. One of those picked **keeps standing** — the survivor; it is
  the record you started from until you choose another. A record of a scope
  you may read and not change is listed and cannot be ticked, and says why.
- **What the survivor says.** One row per value — for an observation the
  title, where, observed by, the impact and the day first seen, which starts
  at the earliest of those picked; for a cause the title, assumed or
  verified, and whether it is a root cause. Beside each, every picked
  record's value is a button that puts it in the field, or type your own. The
  sightings are added up, not chosen. The description is the survivor's,
  editable; **Add the others' descriptions** appends each one's under
  *Merged from OB-0007* (with its scope where that is another). The others
  keep their own descriptions either way.
- **What moves with it.** Every link that names a record being merged, one
  row each, ticked where it may move to the survivor. Untick one to leave it
  where it is. A link the tree does not allow — a loop, a link up or sideways,
  a cause explaining an observation of another scope, a solution and a cause
  that will not be a root cause — cannot be ticked, and says why. Where both
  records had the same link, choose its strength; the stronger is offered.

**Merge** says what it will make — *Merge 2 observations into OB-0002* — or,
greyed, why it cannot. A merge inside this scope is one step, and {key:Mod+Z} takes it
back. One that changes another scope — a record of it merged, or a link kept
there moved — writes every scope it changes as that scope's own step, all or
nothing, and a note says which scopes it changed; {key:Mod+Z} here does not take that
back, so change it back. The screen closes on the survivor. Every merged
record stays — it is where the original wording is — and is read as merged
rather than deleted, saying where it went, also when that is another scope;
*Show merged* brings merged observations and causes back into the register.

**An observation moves to the scope it belongs in.** Its scope did not exist
yet when it was written down, the tree was reorganised, or the analysis
shows it is about another part of the organisation: **Move to scope…**,
among the reader's occasional actions on an observation of this scope,
opens the **move screen** over the page. It has three parts:

- **What moves.** The observation, how often it was seen, and how many
  comments go with it.
- **Where to.** Every other scope you can read, nearest first, each by its
  path from the organisation down; type part of a path to find one. A scope
  you may read and not change is listed and cannot be picked, and says why.
  Once one is picked, the screen says what the observation will be there:
  that scope's next number, *It will be OB-0012 in Platforms › Cameras*.
- **Links cut.** A cause explains observations of its own scope only, so
  every cause that explains this one loses that link. Each is listed, with
  the solutions on a root cause the link leads to, before anything is
  written. The links stay on their causes as history, and the analysis
  starts again in the scope it goes to.

**Move OB-0007 to <scope>** moves it as one change over both scopes, all or
nothing. It keeps its title, place, observer, impact, day, description,
sightings, history and comments, and its history says where it came from.
Where it was, it stays as history: read as a merged record is, left out of
the register, the picture and the counts, and shown under *Show merged* as
*Moved to OB-0012 in <scope>*, which goes there — so a link to it still
leads somewhere. The screen closes on the observation where it went. {key:Mod+Z} does
not take a move back: move it back, and where its old place still holds it,
it comes back under its old number and the links cut when it left explain it
again. An archived observation is restored before it moves, and a merged one
does not move. An agent moves one the same way: \`move.plan\` says what it
would cut, and \`observation.move\` moves it.

An observation that was fixed, addressed or has stopped mattering is
**archived**: *Archive* asks why, optionally, and writes the day and the
note into the history. The record stays where it is, for the history, and
leaves the analysis — not drawn, not queued, not offered as a merge target —
until *Restore* brings it back. *Show archived* lists the closed ones.
Nothing is deleted to close an observation; *Delete* is for a record that
should never have been one.

A **cause** (\`CA-0003\`) is what the team says lies behind one or more
observations, or behind other causes. It starts **assumed** and is marked
**verified** once checked. A **root cause** is a cause the team says is one,
and it is labelled **RC** on the cause's own number: \`CA-0004\` made a root
cause is \`RC-0004\`, and made a cause again it is \`CA-0004\` once more. A root
cause ends the chain: nothing explains it, and a solution addresses it. It
may explain causes and observations. A cause that is not a root cause and
that nothing explains is an **open end** — the analysis is not finished
there — marked \`?\` in the picture and counted over it.

**An analysis from an earlier version** said no root causes: a root cause was
then any cause nothing explained. It opens with a root cause wherever a
solution that was not dropped addresses a cause, and nowhere else, so a cause
that was a root only because nothing explained it yet opens as an open end.
The same holds wherever the work is kept.

**Make root cause** and **Make cause** are steps with a name in the Activity
list, and each asks first, in the reader — also when it is chosen on a
right-click. Make root cause is refused while a cause explains this one:
the reader names each cause that does, and says to unlink it or to make that
one the root cause instead. Make cause is refused while a solution addresses
it: the reader names each solution, and says to move it to another root cause
or unlink it first. A new cause can be made a root cause as it is written.

**Every action on a reader is a small button** with an icon and a word or
two, and hovering it, or reaching it with Tab, says in full what it does and
what it is refused for. An observation offers *Seen again*, *Cause*, *Edit*,
*Merge*, *Move to scope*, *Archive* and *Delete*; a cause *Deeper cause*, *Root cause*,
*Make root cause*, *Verify* — *Unverify* once it is verified — and *Merge*;
a root cause *Solution* and *Make cause*, and never a deeper cause. *Cause*, *Deeper cause* and *Root cause* open one dialog with
two tabs: **New cause**, the cause's own fields, and **Existing cause**,
offering only what the rules allow. *Use this one* beside a cause already
written down picks it under Existing cause, where its strength is chosen
before **Link**. Where the reader is narrow, *Merge*, *Move to scope*,
*Archive* and *Delete* move into \`⋯\`.

**Across the tree, a cause explains down and never up.** A cause may explain
a cause of a scope below its own — an organisation-wide reason behind a
landscape's cause — and the link is kept on the cause above, in the scope
above. The cause below says what explains it on its reader, and the picture
draws the line across the boundary, dashed. On a cause of this scope,
**Local cause** links a cause of a scope below that it explains; on a cause
below, **Org cause** links a cause of this scope that explains it. Refused:
a cause below explaining a cause above, a cause explaining one of a
sibling scope, a cause above explaining an **observation** below — the scope
below explains its own observations — and anything explaining a root cause:
to say an organisation-wide reason lies behind a local root cause, make that
root cause a cause first, in its own scope.

**The filters.** *Filters* shows or hides a row under the picture's controls
and counts the filters that are on. **Scopes** is a list with a box per
scope, which a field narrows. **Obs** keeps the observations whose text
matches and the chain behind them — their causes, root causes and solutions.
**Cause** and **RC** keep the causes, or the root causes, whose text matches,
with everything they explain and everything behind them. **Search** looks in
every record, solutions included, and keeps what is found and what is linked
to it. Filters narrow each other, and they narrow all three tabs. What
matched is outlined and what came with it is drawn plainly; the count says
*12 of 40 shown*, and × beside *Filters* clears them all. **Problems,
bright spots or both** — both is the default — leaves out the observations of
the other kind, and what lies behind them alone: a root cause behind a
problem and a bright spot stays. **Saved filters**
keeps the filters that are on under a short name you give: one saved again
under the same name replaces it, a saved one is put back on from the list,
and one is deleted from it. They are yours — kept with your preferences and
offered in every scope — and a saved scope that is gone is left out when it
is recalled.

**Looking at the picture.** **Large** draws every record as a card with its
label and title; **Small** as a circle with the label under it — an
observation sized by its impact, a cause hollow, a root cause with a double
ring, a solution as a square. Dashed is assumed and solid verified, in both,
and the legend under the picture follows the size. The picture starts
**fitted** to the window, and fits again when what it draws changes until you
zoom; the zoom buttons, and {key:Mod} with the scroll wheel, zoom it, and dragging the
background pans it. **Hovering a record** — or reaching it with Tab — traces
its chain both ways: everything linked to it stays and the rest dims, and its
full title, its label and its scope show under it. Enter or a click reads
it. The same records under the same filters land in the same place every
time.` },
    { title: `Solutions`, text: `The third tab, **Solutions**, starts where the analysis ends: what the team
does about a cause, how an idea earns its way to a decision, and whether what
was built made the sightings stop. The picture has the causes on the left —
the root causes, and any other cause a solution addresses — then the
**directions** (ideas being shaped or tested), the **experiments**, and the
**structural** solutions (proven, adopted, implemented). A solution moves
right as it matures; its width is the benefit it promises and its fill how far
it has got. Once it is structural it keeps a faded box in the directions lane
for the direction it was, so the line runs from the cause through that box and
the experiment that confirmed it into the solution. **Whole chain** puts the
observations and the whole analysis back on the left, so one picture runs from
what was seen to what was built. A mark (!) says where to look: a root cause
nobody is working on, or a solution with a question.

**Solution** on a root cause's reader, or **New solution** on the bar, opens
the form: a title with an example under it, an optional description with **Edit**
and **Preview**, and a table of the root causes of this scope it addresses,
linked when you propose — the button says *Propose solution for 1 root
cause*. It writes a numbered record (\`SO-0003\`) and nothing else. A solution
addresses root causes only: a cause that something deeper explains is a
symptom of that deeper one, so its reader offers no *Solution* and points at
the root cause instead, and a root cause a solution addresses cannot be made
a cause again until the solution is moved or unlinked. Before it counts as
**shaped** it needs what the team would ask anyway: the benefit it is expected
to bring and a rough cost, who it was checked with, and whether something like
it was tried before — and if so, why it would work now. The reader lists what is still open under *To move on to…*,
each line with its control beside it, and the button stays disabled until the
list is clear. **Back to…** moves it one step back at any time.

From shaped to **testing** it needs an **experiment** (\`EX-0002\`): a
hypothesis, how it is measured, where, by whom and when. Planning one from the
solution moves it to testing in the same step, and one that is already
confirmed counts too. Once one is **confirmed**, the solution may move to
**proven**. Some things cannot be trialled; *Waive* takes a reason instead,
and the reason is kept. A refuted experiment stays, as the evidence the next
person asks for.

A proven solution is decided on the **Decisions** page. **Propose the
decision record** writes a new record whose context names what the solution
addresses and what else was considered. Once that record is accepted, the
solution can move to **adopted**, and **Start a plan** writes the plan that
builds it. When the plan is **done** the solution reads as **implemented**,
and **Did it work?** lists the observations under it: each should stop being
seen, and one seen again is flagged against the solution.

Two questions are asked of a solution without stopping it: does it only work
around a symptom (it is proven but addresses no root cause), and does its
plan clear anything up, or only add? A solution that is not pursued is
**dropped** with the reason and stays as an alternative that was considered:
it is listed on every other solution for the same causes. Both records are
markdown files, under \`observations/solutions/\` and \`observations/experiments/\`.

A solution's reader has the same small buttons as the analysis: *Address*
to address another root cause while it is an idea or shaped, *Experiment* to plan
one while it is shaped or testing, *Edit*, and *Drop* and *Delete*, which
move into \`⋯\` where the reader is narrow. A solution of a scope below, drawn
in its boundary with View local on, is read here and worked on in its own
scope.

**Right-click** anything in the analysis or the solutions picture for what can
be done with it — the same actions its reader offers, in the same order and
the same words, Edit among them, and on a solution the steps its gate offers;
a menu item ends in “…” where a dialog or a question follows — and a
line — the analysis's links, a solution's causes, the lines into and out of an
experiment — for how strong the link is, or to unlink it. **Edit** gives the
record the whole width: the text on the left, what it will look like on the
right, and the picture back when you switch to Read.` },
  ],
  roadmap: [
    { title: `The roadmap`, text: `**Roadmap** in the top bar opens the landscape on a time axis. Only what has a
date gets a row, so a landscape of four thousand applications with nine dates in
it is a roadmap of a few lines — the rest is on the canvas, where it belongs.
Plans come first, then applications, each row a run of stretches with its phase
named on it: planned, live, retiring, retired. Connections with a window of their
own come after those, folded shut with a count on the heading, by the plan that
moves them into old lines that end and new lines that start, because a plan that
moves every interface dates every line. Initiatives from the scopes below come last.` },
    { title: `Plans`, text: `A **plan** is how a change to the landscape gets written down: a title, a status,
the window it runs over, who owns it, the applications it introduces, retires or
changes, the decisions it rests on, its milestones, and a body in markdown. Plans
appear as bands on the axis, with their status on the band, dashed for a draft, and
a mark per milestone; milestones too close to tell apart merge and say how many.
A plan's page is one document with one scroll: its head, a strip of its milestones
that stays in view, what it changes one line each, then its text, then the boards it
changes, the principles it cites, its changes and its comments. An outline on the left
goes to any of them. A fact reads as words and a press makes that one row a form.
**Edit** is the text alone, in a window of its own with its preview, saved as one
step. **Interfaces** and **Units** wait to be asked for; **Give the rest a day…**
moves every line with no day on one day, and a row opens to read its whole label and
set its own day. A milestone outside the window is allowed, and says so.

**Boards** lists the boards that hold what the plan names. Opening one from there
only looks: the band on the board names the plan and the milestone, steps between
its milestones, and goes back to the plan. The status menu says what holds a move,
each line going to what clears it.

A plan runs **draft → agreed → running → done**, and can be abandoned from any of
those. Unlike a decision record, every step can be taken back and a finished plan
can still be edited: a decision records a moment, and a plan describes work. What
the plan said last month is in the folder's history.

**Move by…** shifts a plan by a number of days — its window, every milestone, the
day of every unit it moves, and the lifecycle dates on the applications it
introduces and retires — in a single step, because a plan slipping is one thing
that happened. It says what will move before it does; days already set on interfaces
stay on theirs. A plan that reorganises units says what that does to the people
in them (see *Change over time*).

Each plan is one markdown file in \`transitions/\` in the scope's folder, numbered
\`TR-0001\` upwards.

**Initiatives.** A plan lives in the scope that writes it, and a domain's
roadmap is the domain's. When a plan is the organisation's business as well —
a migration the whole company follows — choose **Follow on the roadmaps above**
under ⋯ on its page. It then appears on the roadmap of every scope above, under
*Initiatives from the scopes below*, saying which scope it belongs to; it is read
there and edited where it lives, and its reader opens it there. The organisation
screen's roadmap card counts them. The choice is not offered at the
organisation itself, which has no roadmap above it.` },
    { title: `The business case`, text: `A plan's body can hold a **business case**: a fenced block whose input is a
cash-flow table you can read, with the figures worked out underneath it.

\`\`\`\`markdown
\`\`\`business-case
currency: EUR
discount rate: 10%

| Line       | Year 0   | Year 1 | Year 2  |
| ---------- | -------- | ------ | ------- |
| Investment | -415 000 |        |         |
| Savings    |          | 25 000 | 125 000 |
\`\`\`
\`\`\`\`

A negative number is money out, a positive one is money in, and a blank cell is
zero. Underneath, the app computes the net and cumulative cash flow, the net
present value at the rate you gave, the internal rate of return, the payback in
periods, the return on investment and the benefit-cost ratio. Your table is never
rewritten.

A second table, \`Criterion | Weight | Score\`, adds a weighted score for the part
that is not money — scored one to five, out of a maximum the app works out rather
than one you type. Everything beyond that belongs in a decision record, with its
drivers and the options you weighed.

**Add a business case** in the edit pane drops an empty block in at the cursor.` },
    { title: `What the dates disagree about`, text: `Under the axis is a list of findings (see *Reading a list of findings*): an
application retiring with connections still live, a successor that does not
arrive until after the thing it replaces is gone, a retirement with no
successor named, a connection still valid
after one of its ends has retired, an application still standing on a platform
that has been retired, and a plan past the day it was due to finish.

One entry is not a contradiction but a picture that is missing: container
interfaces running between two applications with no application interface drawn
for them. **Accept**, in its explanation, draws it and lands every one of
them on it, as one step — or leave it, and nothing happens.

It says where the dates contradict each other. It cannot tell you that a landscape
is out of date — nothing can — and the page says so under the list.` },
  ],
  registers: [
    { title: `One name across the organisation`, text: `A name means the same thing everywhere in your folder. The warehouse system is
one system whichever domain draws it, and a capability the organisation names
is that capability wherever a landscape refines it — so each thing is written
down **once**, in one scope, and every other scope that uses it points at the
same one.

**The scope that writes it down answers for it.** That record carries the
detail: what phase it is in and on which dates, who owns it, which vendor sells
it, what it is built on, its operational aspects. Change any of it there and everywhere
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
the moment somebody deeper writes the real record.` },
    { title: `What a finding means`, text: `The app never refuses a save over any of this. It reads the whole folder when
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

One thing on the list is **information rather than a fault**: a record nothing
in its own scope draws — no board holds it, and no drawing there points at it.
A thing can be real, owned and documented without being on anybody's picture
yet, so it is a note, as a proposal is, and never coloured like a fault.` },
    { title: `Reading a list of findings`, text: `Every list of findings is the same list: a unit's **Checks**, the
organisation chart's summary, the Conway map's findings, a plan's **Still
open** and the roadmap's **Where the dates disagree**. A home counts its
findings on the **Checks** line and lists them on the Checks page.

- **One row per check**: its weight's mark, its name and how many, folded
  shut. Press the row to see each finding under it, in its own sentence.
- **Three weights**, in this order. **Fix** (a red dot): the model contradicts
  itself or cannot be true, and the fix is in the model. **Review** (an amber
  triangle): probably a gap or a risk, worth a look. **Note** (an *i*):
  information that may well be intended. The line under the list says which
  mark is which.
- **The notes are hidden** behind **Show notes (N)**. What a list has
  unfolded, and whether its notes are shown, lasts while the app is open and
  is never saved.
- **Press a finding to read it**: its sentence, its weight and what it is
  about, **Why it matters**, **How to fix it**, and the actions that fix it
  or open where it is fixed — open the record, the drawing, the unit or the
  two units, the unit type, the plan, the person in People; **Link…**,
  **Accept**, **Assign…**, **End the assignment…**, **Remove the
  assignment**, **Declare an interaction…**, **Remove the declaration**. A list offers the actions it can
  do where it is drawn, and the screen it opens does the rest. **All
  findings** goes back to the finding you came from.
- A finding put right leaves the list, and its explanation with it.
- **Mark as intended…**, under a review's or a note's explanation, says that
  it is meant to be so: it asks why, and the reason may stay empty. The
  finding leaves the list and is listed under **Accepted (N)**, under the
  checks, with its reason and the day it was marked. **Take back** there
  brings it back. A mark is a step in the model, kept in the scope the
  finding is about, so everybody sees it and the Activity list names it;
  marked where that scope is open, {key:Mod+Z} takes it back like any other step. A
  mark is about the finding as it is: change what it is about — another unit
  on the interaction, another role accountable — and the finding comes back.
  A **fix** cannot be marked: the model contradicts itself, and the answer is
  in the model. Where you may only read the scope that keeps it, nothing is
  offered. An agent reads the marks and never makes one.` },
    { title: `The Checks page`, text: `**Checks** on a home, or a count on the **Checks** line, opens the
Checks page over that home: what the checks find at or under it, and on the
organisation's home in the whole tree.

- **Every check, by category** — the landscape, plans and dates, the
  organisation, teams and systems, analysis — with its weight's mark, its
  name and how many it finds, none included: a check that finds nothing is
  still worth knowing about. Fix before review before note within each.
- **Show** on the bar picks the weights shown. The notes are hidden until you
  show them, as in every list, and what you choose lasts while the app is
  open.
- **Pick a check** to read it: its weight and category, **Why it matters**,
  **How to fix it**, and **Found (N)** — every finding of it, each in its
  scope. Pressing one opens it where it is fixed: the record, the drawing,
  the plan, the operating model's page, a person in People. **Mark as
  intended…** beside a review's or a note's finding marks it from here, in
  the scope that keeps it, and **Accepted (N)** lists what was marked, each
  with **Take back**. An assignment in a unit that is not there offers
  **Remove the assignment** beside it, written the same way: no unit is left
  to fix it from. A mark made here, with nothing open, is that scope's
  step and is not on an undo stack: **Take back** is how it is undone.
- What the page counts comes from what the app already holds about the whole
  tree: the findings between scopes, the organisation's units and people,
  every scope's dates, and the Conway map over the home. A few checks read a
  scope's whole document — a record on no view, the owner's detail on a
  stand-in, a line to nothing, a drawing's link, the business layer's two, a
  cause explaining an observation below — and are found where that scope is
  open: the page lists them with their explanation and says *Not counted
  here* rather than a number.` },
    { title: `The register`, text: `**Register** on the organisation screen is every application in the whole
folder, on one page. Nothing writes it: it is read from the scopes themselves
every time the folder is read, so it cannot drift from what the folders say and
there is no list for two domains to edit at once.

Each row says what the application is called, **which scope answers for it**,
whether it is somebody else's and whose, **how many scopes draw it** (hover the
count for their names), and the findings about it as small chips. The filter box
searches the name, the key and the scope; **By name** and **By scope** are the
two orders. **Open** enters the scope that answers for the application with the
card selected, which is where its detail can be changed.

A row that says two scopes both write the name down offers **Link…**: it opens
the scope whose record should give way and asks there, because a record is only
ever changed by the scope that holds it.` },
    { title: `Moving a record between scopes`, text: `Where a thing is written down is a decision you can change afterwards. Select
the card and press **Move…** in the **⋯** of the panel; the dialog offers whichever of
the four apply.

- **Link** — give up this scope's record and stand in for one another scope
  already holds. This is what settles a conflict, and what a card drawn before
  anybody wrote the real record needs. This scope keeps its own description,
  its colours and where the card sits on its boards; it gives up the detail,
  which the other scope answers for from then on.
- **Promote** — move the record up to a scope this one is filed under, and
  leave a stand-in here. What an application drawn in a landscape needs when the
  domain above should be the one answering for it.
- **Demote** — the reverse: move it down to a scope filed under this one.
- **Transfer** — move it to any other scope. **Keep a stand-in here** is ticked
  by default; untick it and this scope stops drawing the thing altogether.

**A unit takes its people with it.** Promoting, demoting or transferring a unit
moves every assignment kept for it, in the same step — the ones that have ended
too, because who held its roles belongs with the unit — under the ids they had,
so each person's past stays theirs. A stand-in left behind holds none. The
confirmation says how many go.

The last three write **two scopes**, so they ask first. The scope it is going to
is written before this one changes, which is deliberate: if something goes wrong
halfway you are left with the record in *both* places — a conflict you can see
and settle with **Link** — rather than in neither.

That is also why **undo stops there**. {key:Mod+Z} takes back everything you have done
since, and then refuses that step with a line saying why: only half of it is on
this window's stack, and the other half is a file in a scope nothing here speaks
for. To put it back, move the record again the other way.

A move is refused, with the reason, when the scope it would go to already
answers for the name, when a promotion names a scope this one is not filed
under, and when removing the record would leave things filed under it with
nothing to sit in.` },
  ],
  operating: [
    { title: `The operating model`, text: `The **Operating model** card on the organisation's home opens the
organisation's own design of how it is organised: the kinds of unit it has,
the roles each kind holds, and what each role is responsible for — in its own
words. It is kept at the organisation and edited there; opened over any other
scope it reads the organisation's model in full, says so once, and offers the way there. Every change is a step: it shows in
Activity, {key:Mod+Z} takes it back, and each unit type, role and responsibility has a
history of its own.` },
    { title: `Structure`, text: `The page has five tabs, by the question each answers: **Structure**, **Roles**,
**Responsibilities**, **Exceptions** and **Libraries**. Which tab, part and unit
are up is in the page's address, so a link and an agent reach the same screen.

A **unit type** is the organisation's word for a kind of unit. **Structure** draws
the unit types as the structure they make, by **level**: how deep a unit of the
type can sit. Each card names the type, how many units it has today, and its roles,
one line each, with *manages* on a managing one. A line runs from every place a unit
may sit; one that skips a level runs along a rail above the cards, and one back up
the levels is dashed. Under the levels, one line says what sits nowhere and which
roles are in no unit type, and names them.
A type that sits nowhere is also counted on the **Checks** line on the organisation's
home and listed on its Checks page.

Pressing a card picks the type: where it may sit, what may sit in it and its roles
light up, the rest dims, and its reader opens on the right. Pressing a role picks it
and draws its reporting lines, solid for a line manager's and dotted for a functional
one, in the warning colour where a unit would have to say which. Pressing the pick
again lets it go. An empty model shows the three things to say, in order, with
**Start from a library** first.

A type's reader says where it may sit, with **Change**, and each role it holds in one
line: how many, then where its holders report. A line this type changes is the only
one that speaks up, as *own line here*. **More** holds whether a unit may serve more
than one domain, how many applications a unit should own at most (a check warns above
it; nothing refuses it), its order in its level, and its days.

Pressing a role's line shows who its holders report to and **where that comes from**,
top rule first: one holder's own line, the unit's, this type's, the role's, then
nesting. **Change the line for** this type sets a line here, solid or dotted, in the
same unit or the nearest above, with days; **Back to what the role says** takes it
away; another choice is **By nesting in this type**. A line manager's line that would
make a chain come back to where it started, and a line from a role to itself in the
same unit, are refused there and then, and said why. A unit says otherwise for itself
in its inspector (*Units and the people in them*).` },
    { title: `Roles`, text: `**Roles** lists every role: where it is held, its line manager and its part. Selecting
one opens it large: its purpose, its holders and vacant places, its two lines, what it
answers for, who reports to it, each unit that holds it and who holds it there, and
whether it **manages** the people of its unit and the units below. Pressing a unit goes
to its place in the organisation. **More** holds the short name, its column's order and
its days.

The two owner rules stand above the list: an application's owner is the holder of a
chosen role in the unit it belongs to, and a domain's the holder of a chosen role in the
unit that serves it. It is worked out on the day it is looked at, so it follows whoever
holds the role and no name is stored; a rule not set says what follows from that.` },
    { title: `Responsibilities`, text: `**Responsibilities** opens on a part: a tree of the responsibility groups and their
responsibilities on the left, and a grid of the roles with a part in what is picked,
by their full name. The other roles fold into one **+N** column: pressing it shows
them, and **Add one as a column** adds one. **Whole organisation** shows every row under
its group's heading, by short name, for audits and export.

A press on a cell selects it and writes nothing. R, A, C, I or – on the keyboard, or the
buttons under the grid, set the letter as one step; the arrows walk the grid, whose
headings stay put, and the line under it names the row, the role and the letter. Pressing
a role's heading opens its reader, and a row's name opens the responsibility.` },
    { title: `Exceptions`, text: `**Exceptions** is the one list of every place that says otherwise than the model, with
the default it departs from: a unit type's line, a unit's own, one holder's own, and a
role held outside the unit's slots. Line managers' lines show unless the filter asks for
functional ones. Selecting a row reads it large, with **Back to default**, and a way to
the type, the unit and the role. Where several unit types say the same line, the page
says so and offers **Change the role**: it asks first, since it moves lines for many
units, and is one step.` },
    { title: `Libraries`, text: `Four starting points ship with the app: **Scrum**, **SAFe**, the **IT4IT**
value streams (the seven of its version 3.0) and **Team Topologies**. Each is
read-only, has a version, and is written in English, Dutch and German, in
this app's own words.

**Libraries** lists them, and selecting one reads it large with what came in from it. **From a library…** opens them in a dialog over the page. The libraries are
listed on the left; the one picked is drawn in the middle as the structure it
would make, in the same lanes as your own, read-only: each unit type with its
purpose and the roles it holds, and under the lanes the roles none of its
types holds. Press a role to see what it answers for. Tick a unit type, or a
role on its own: what it needs comes along and is drawn dashed — the roles a
type holds, the types it sits in in the library — and a role always brings
the responsibilities it has a part in. An entry your model has already says
**in your model as …**, or **(matched)** where an earlier step matched it to
one of your own, and is used as it is.

On the right, **What will come in** is the step before it is written. Every
name can be changed in place, starting from the library's word in the
language you work in. Each unit type says where it will sit: as in the
library, at the top, beside one of your types — in the same places — or
inside one. A library's type at the top that holds none of its own types
lands beside your deepest type that holds nothing, so Team Topologies' teams
sit beside your teams rather than loose at the top. Each role is brought in,
or one of yours is used for it — suggested where the library says the two are
alike, or where the names are the same — and then nothing is brought in for
it but its letters on what the step makes, so those rows arrive with their A. **Bring in** says how many items the step makes and writes them as one
step: the page then marks what is new until you leave it, and the message at
the bottom offers **Undo**, which takes back that step while nothing has
happened since. {key:Mod+Z} takes it back too.

What comes in belongs to the organisation: rename it, rewrite it, cut it. The
**Libraries** tab shows, for each library, **What came in**: the library's
word beside what it is called here — press the library's word to open the item,
which is where it is renamed — and what has changed since; and the ones that used one of yours, as **used your …**. A name or a
place chosen on the way in is not a change; a unit type moved since is one.
Each item remembers the library entry and the version it was based on, so
**Compare with the libraries** lists how it differs from the library as it
ships now — read in the language it was brought in — and says when a library
has moved on to a later version. Nothing is ever merged in. The frameworks'
names are their owners'; none of the libraries is endorsed by them.` },
    { title: `Units and the people in them`, text: `An actor becomes a **unit** when it has a unit type: choose one under **Unit**
in its inspector, on a board or on its page, and **Not a unit** makes it a
party again. Nothing else marks a unit. The unit it sits in is the actor it is
filed under, and the dates it starts and ends are its lifecycle dates — so a
unit that has retired has ended.

**The quickest way to make a unit is on its organisation chart**: **+ Unit
at the top**, or the **+** on the name row of the unit it is to sit in (see
*The organisation chart*). Typing an actor in its inspector, on a board or a
sheet, works as before.

**A unit's inspector puts the unit first.** On a board, a sheet, the chart
or its page, its name comes first, with **Move…** and **Create drawing** in
the **⋯** beside it. Under the name are its unit type, with the scope it is
filed in beneath it, and then the unit's own sections. Last comes
**Element**, folded: the actor's own fields, its lifecycle, description and
record. It is folded again
each time another unit is picked. On the page the same fields are laid out
below the unit. An actor without a type keeps the element's panel, with **Unit** after its
fields on Properties.

A unit's sections, in that order:

- **Sits under**: the unit it sits in on the day, or *At the top*. Where you
  may change the unit, it is a button that opens **Move to…** (see *Moving a
  unit to another place*, under *The organisation chart*).
- **Roles, today**: each role its type holds, with how many it wants, and who
  holds it today — by name from the register, with their share where it is not
  all of their time, *acting*, and *you*. Every role is listed, optional ones
  included, even where the chart leaves an empty optional role out. A role
  short of people shows **+ vacant**; a press assigns someone. **+ assign** on
  a role with room for one more does the same. **A role beyond its type…**
  adds an optional role to this unit only.
- **Who manages it**: one line for each person who holds a role that manages,
  in this unit or a unit above it, today, nearest first — and, where such a
  role reports elsewhere by a line manager's line, whoever it lands on,
  marked *by line* — or *by override* where it is this unit's own line or a
  person's own. **why?** says what that means: the app says it and grants
  nothing from it.
- **Reporting lines**: each role of the unit with a reporting line today,
  where it lands — the role and the unit, or *in this unit* — whether it is a
  line manager's or functional, whether it is the role's, the unit type's or
  this unit's own, and *nobody holds it* where nobody holds the role it lands
  on. A line of this unit's own is an exception to the model and is marked
  *override*. **Override…** points the role at a role in any unit — each unit
  named with the units above it, this unit first in the list, for a line
  within it — or at one person who holds it there (*Which holder*), or at one
  person anywhere (**Reports to: One person**, their role filled in where they
  hold one and asked where they hold several); line manager or functional,
  for this unit only, from a day and until one where it is not for good;
  **Report by nesting here** says the role reports up the way the unit is
  nested, whatever its type or the role says; **Take this unit's own line
  away** lets the type or the role say again. **A line for…** gives a role
  that has none one of its own. **Reported to by** lists the roles elsewhere
  whose line lands on one of this unit's, and the people whose own line
  does.
  The holders of a role with a line manager's line are managed by the holders
  of the role it lands on, and then by whoever manages those; the rest of the
  unit by nesting. A line from a role to itself in the same unit, and one that
  would close a loop, are refused and said why.
- **Serves**: the domains it serves, the scope it is filed in unless you say
  otherwise — but never the organisation: a unit filed there serves nothing
  until **+ Domain** gives it one, and says **No domain** where you may only
  read. A unit that serves several domains is filed in the scope above
  them, and its type must allow it. **+ Domain** picks another domain, where
  its type allows more than one. Pressing a domain opens its home, whose
  **Served by** says the same from the other end.
- **Owns**: every application that names it as the actor it belongs to.
- **Responsible for**: the areas, groupings and capabilities it is assigned,
  with the scope that keeps the row where it is another. **+ Area or
  capability** picks one from the whole organisation, and the row is written
  in the scope that defines it — this one's as a step here, another's as a
  step there, where you may change it. **✕** on a chip takes a row kept here
  off.
- **Works with**: the units it has declared it works with (see *The Conway
  map*).
- **Over time**: the day it is there from, its last day, and every move a plan
  makes of it (see *Change over time*).
- **Checks**: what the organisation contradicts about this unit today — a
  role short of people or over its maximum, a unit filed where its type may
  not sit, one serving more domains than its type allows or owning more
  applications than its limit, someone still in a unit or a role that has
  ended, anyone in it whose shares add up to more than all of their time, and
  an area, grouping or capability it is responsible for in a domain that
  neither it nor a unit above it serves; and of its reporting lines, one that
  lands nowhere because no unit has the role, one several units could take
  with none above — **Override…** says which — one on a role nobody holds,
  and lines that come back to where they started, today or on a later day a
  line starts or a plan moves a unit. A unit serves a domain when it serves
  that scope, a scope above it or one within it. In the list of findings, a
  role short of people offers **Assign…** and an assignment that has outlived
  its unit or role **End the assignment…**, where you may change that role's
  people. The organisation's home lists the same findings for every scope.

The sections read the day the board beside them is looked at. On a board that
shows another day — its own saved day, or a day picked under **Day** or
on the roadmap's slider — the inspector says *As on* that day, and its
holders, who manages it and its checks are that day's, a plan's moves of that
day included. Something assigned or ended from there starts on that day where
it is still to come.

**Assigning** someone is one step in the scope that keeps the unit: choose the
role, the person — searched in the register, *you* marked — their share, the
first day, and whether they are acting. The unit's own roles come first; under
**Another role (an exception)** are the organisation's others. Someone placed
in one of those is an exception to the model: it is allowed and no finding,
the dialog says so before you save, and wherever they are shown — their chip on
the chart, in a magenta dashed edge, their inspector, the People page — they
are marked as one. The role's own reporting line applies to them there. **New person…** is the People page's
own form, so someone who may already be in the register is offered before a
second entry is made. The assignment holds the person's id, never their name.
Press a holder to correct the assignment, **End on** today, or remove one made
by mistake; one that has ended stays, as what the person held.

**Mark as left**, on the People page, ends every assignment of the person's on
their last day — one step in each scope that keeps one — and takes away any
that would only have begun after it.

**Deleting a unit** is a correction: it says the unit was never there, so its
assignments go with it in the same step, ended ones included, and the
question before it names who stops being what. A unit that stops existing on
a day is ended on that day instead — its lifecycle, or a plan — and its
people's roles end then and stay in their history. **An assignment in a unit
that is not there** — left by a unit deleted before deleting took them along,
or by an actor that is no longer a unit — is a fix, *An assignment in a unit
that is not there*, whatever its days: the person still counts as holding the
role. On the Checks page it opens the person in People, and **Remove the
assignment** takes it away. The units inside a unit deleted move up into its
parent, or into another unit of its type where theirs may not sit there, or
go too; the applications it owned show as owned by nobody (*Elements*).

A unit kept in another scope is shown here and changed where it is kept.

**Where a role that manages gives a right.** The app grants nothing from who
manages a unit; a source that knows who signs in may, and says so. There, a
person linked to an entry who holds a managing role today changes the people
of that unit and of the units below it even in a scope they may only read:
**Assign**, a holder's correction, **End on** and removal — a role that
manages only in a unit below their own. Reporting lines move that right: a
role whose line manager's line lands on a role they hold is theirs to change,
in whatever unit it is, and the people in it in turn; a role in their units
whose holders report elsewhere by such a line is not. A person's own line
manager's line moves it the same way, for that one assignment: whoever it lands
on may change it, and whoever reached it only through the role there no longer
does. A functional line gives
no right. Nothing else of the unit changes. The
same goes for a vacancy on the organisation chart, for **New person…** and
**Mark as left** on the People page where the source says so, and for *Move
the people*, which then writes their rows and leaves the others as they are.` },
    { title: `Change over time`, text: `A correction is an edit; a change has a day. Renaming a unit, a role or a unit
type is an edit, and so is putting a unit under another parent outside a plan:
it was always so, and the history says when it was corrected. A unit that
starts or ends does so on its lifecycle dates; an assignment on its first and
last day; a unit type and a role on theirs.

**On the operating model page**, a unit type and a role have **From**,
**Until** and **Followed by** under *Over time*. A role that ends lists its
people after its last day — the role's successor in the same unit is the
suggestion for each — with *Move the people* below (see below). A unit type
that ends lists its units still there afterwards, with who holds a role in
each: what each is now is for you to decide, by giving it another type or
ending it. A unit still of a type that has ended is a finding.

**Taking a role out of a unit type** — the ✕ beside it under *Roles it holds*
— first lists who holds that role in a unit of the type, where the unit has no
slot of its own for it: *Move the people*, under the slots, each with the
role's successor the unit still holds as the suggestion, their last day in it
today. **Write as one step** takes the role out of the type together with
their ends and beginnings, all of it or none of it, so nobody is left in a
role their unit's type does not hold; **Keep**, with the role's name, leaves
the type as it is. A role nobody holds that way goes at once.

**A reorganisation is a plan.** On a plan's page, *Units it moves* puts a unit
under a new parent on a day — or at the top, under the organisation itself —
one step each. **Move by…** shifts those days with the rest of the plan. From
its day the move holds wherever the organisation is read: a unit's section,
the checks, who manages a unit. An abandoned plan moves nothing. Above the
plan's interfaces, where the plan touches units, the page says:

- **What it does to the organisation**: the units it introduces and retires,
  each with its day, the moves, and the roles that end the day before its
  day, with what follows them.
- **The day before** and **on** its day: the units under the smallest trees
  that hold the whole change, with who holds a role in each — *ends*, *new* and
  *moved* marked.
- **Move the people**: every assignment in a unit or a role that ends, each
  with a suggestion — where the unit went (its successor), or the role's
  successor — which you accept or change; a team that moves takes its people
  with it, so it is not listed. Nobody's new place is guessed: a row with no
  suggestion only ends. **Accept every suggestion** sets every row back to its
  suggestion, and **Write as one step** writes every end on its last day and
  every beginning the day after, in every scope that keeps one, together.
  Where the plan's scope is the only one written, {key:Mod+Z} takes the whole step
  back; where other scopes were written too, it is put back in each.
- **Still open on** its day, in the list of findings: what the checks find in
  those units then — one about a unit opens it — every responsibility that
  loses its A because the role accountable for it ends, and every interaction
  the plan's units are left to declare: *Declare how* a unit it introduces or
  moves *works with* another, where an interface crosses between their
  applications with nothing declared — as when the cluster it retires was the
  one that had declared it. **Declare an interaction…** opens the plan's unit,
  whose **Works with** declares it.` },
  ],
  people: [
    { title: `People`, text: `**People** on the organisation's home is the organisation's register of
people: one entry for each person, with a name, a work address where you know
one, and whether they are of the organisation or from outside it. Nothing
else is kept — no notes, no photo.

The register is kept **outside the history**. A change here is not a step:
there is no {key:Mod+Z} for it and no line in Activity, and the page says so under
**About the register**, at the end of its one line of introduction. That is
what lets a name be forgotten. The history keeps a person's id, never their
name, and every screen asks the register for the name when it draws one —
so when a name goes from the register, it goes from every screen at once.

- **Everyone** is listed with their kind, their state and the **roles
  today** they hold — on one line, the first role in its unit and how many
  more (the person's **Holds today** has them all), and *none* for whoever
  holds nothing, so they stand out — and searched by
  name, address, or a role or unit they hold; **Show** narrows the list to who
  is active, who has left, or who is forgotten. The column reads the day the
  page is looked at (**Look at**, below).
- **Add person** asks for a name, an address and the kind. Before anyone is
  added it looks for somebody who may be the same person: the same address,
  the same name (whatever the case, accents or spacing), a name within two
  letters — *Pia Schultz* finds *Pia Schulz* — or the same family name and
  first initial. **Use this one** takes the entry that is there; **Add
  anyway** makes a second, which you can merge later.
- **Possible duplicates** are the pairs already in the register that may be
  one person. They are folded every time the page opens, as one line: how
  many, how many by each sign, and **Review**. Open, each pair is one row,
  strongest sign first — the same address, the same name, nearly the same
  name, the same family name and initial — with the two people side by side
  and what tells them apart: the first role they hold today and how many
  more, the work address, *External*, and *account* where a source that
  knows who signs in says the entry is linked to one. The fold is gone when
  no pair is left.
- **Not the same person** answers that the two are two people. The pair is
  no longer offered, and correcting either no longer warns of the other;
  adding somebody new still checks against both. The answer is kept in the
  register, outside the history like the rest of it — the two ids and the
  day — and travels with the register in a saved copy, one made without
  names too. **N answered as not the same person**, under the list, shows
  the answers, each with **Take back**, after which the pair is a possible
  duplicate again. Forgetting or removing either person drops the answer;
  merging either into a third entry carries it to the entry kept, unless
  that entry is the other of the two. No agent answers it, as none merges.
- **Merge…** asks first which entry is kept — the one linked to an account,
  then the one with more assignments, is chosen to start with, and you can
  choose the other — and is final: one entry is kept, and the
  other becomes a redirect with no name, so everything that pointed at it
  shows the one kept. Merging somebody active into an entry that has left
  asks which is true. **Still here** clears the leaving: the entry kept is
  active again, and the policy stops counting down to forgetting the name.
  **Left** ends the roles of the entry merged away on the leaving day, as
  **Mark as left** would — one that began after that day is taken away,
  because a role never ends before it began — and the question says how
  many of each first. *Still here* is chosen to start with where any of those
  roles began after the leaving day.
- **Import CSV…** takes a list — pasted, or a file — with a name, an address
  and *internal* or *external* on each row, separated by commas or
  semicolons. Every row goes through the same check: one that is plainly
  somebody already there adds nobody, one that only may be is flagged and
  added only where you tick **Add anyway**, and the rest are added.
- **A person** shows who they are and where they are in leaving, and what
  they hold across the organisation: **Holds today**, **Will hold** and
  **Held before**, each a role in a unit (see *Units and the people in them*).
  **Look at** says the same on another day — after a reorganisation, say —
  and **Back to today** returns; looking writes nothing.
  **This is me** tells this install which entry is you, so you are marked
  wherever you appear; it is kept with the install — for a folder opened in
  a browser, in that browser — never in your folder or in anything you
  export.
  **Find me**, on the bar, then shows the whole list with your entry chosen.
  **Correct…** changes the name, the address or the kind, and says who the
  corrected entry may then be the same person as — never somebody it was
  answered as not being.
- **Mark as left** takes their last day. Their name is still shown until the
  policy forgets it.
- **Forget now** asks first, then takes the name and the address away for
  good: from then on every screen shows a pseudonym, *Former colleague 7KQM*.
  The register keeps no history of a name, so nothing brings it back. A
  signed decision keeps the name it was signed with, shown there alone:
  nothing links it to the forgotten entry.
- **Remove now**, on an entry already forgotten, takes it out of the register;
  whatever pointed at it reads *a former colleague*.
- **Points at them** lists every record whose fields name the person by id —
  an element or a plan they own, an observation they saw, an experiment they
  run, a decision they proposed or signed — with the scope that keeps it, and
  what the operating model's rules make them own today (see *Fields that name
  a person*). A signature that kept their name says the name it was signed
  with — except on a forgotten entry, which says only that the signature
  exists, so the name as signed is never shown beside the pseudonym. **What
  we hold** does the same.
- **What we hold** shows everything the register holds about a person, and
  what points at them, as one document to copy: the answer to a request for
  access. A request to erase it is answered with **Forget now**. It also says
  how many records name the person in their text — words typed into a field
  rather than a person picked, which a forget cannot reach and a search
  finds.

**The policy**, at the foot of the page, is a setting of the organisation's,
not a step: how long a leaver's name is kept (90 days unless you change it),
how long the forgotten entry is kept after that (730 days), and whether an
agent sees names or pseudonyms. Whoever may change the organisation's
settings sets it — on the desktop, whoever keeps the folder. The app applies
it when the organisation is opened and again each day it stays open: a name
kept past its period is forgotten, an entry kept past the next is removed.

Where the organisation is kept by a source that knows who signs in to it, the
source may do two of these itself: it applies the policy on its own schedule,
and the app then forgets nobody when the organisation is opened; and it knows
which entry is you, by your account, so you are marked without **This is me**,
which is then not offered.

Such a source may also know who may do what. The page then offers each
change only to whoever may make it: **Add person**, **Correct…** and **Mark
as left** perhaps for the people of your own units only, and **Merge…**,
**Forget now**, **Remove now** and the policy only to the organisation's
administrators. **Not the same person** and **Take back** are offered to
whoever may merge the two, and, where the source gives a managing role the
right to change its people, to a manager whose units hold both of them
today. Where it keeps a work address from you, the page says *an
address not shown to you* rather than that there is none. Marking somebody as
left may end their assignments there and then; the page says how many. And
where its schedule did not forget somebody whose day had come, because their
account signed in after their last day, the page says so beside their state,
and whoever may forget them decides.

On the desktop the register is the file \`.lionsville-architecture/people.json\`
in your folder. **It is never in the folder's history**: no snapshot takes it,
and a \`git add\` typed in a terminal leaves it out too, because a name in a
commit is a name nothing can forget. A copy of the folder taken through git
therefore carries ids and no names; the saved copy carries the register.
The answers *not the same person* are in the same file. A version of the app
from before them reads the people and leaves the answers out, and when it
next changes the register it writes the file without them: the pairs are
possible duplicates again, and nothing else is lost.` },
    { title: `Fields that name a person`, text: `Six fields name a person: an element's **Owner**, a plan's **Owner**, who saw
an observation (**Observed by**), who runs an experiment (**By**), and who
proposed a decision (**Proposed by**) and who signed it (**Reviewers and
signatures**). Each takes a person from the register, or text as it always
did — a name, initials, a team.

- **From the register…** beside the field opens the register's picker:
  search by name, pick someone, or **New person…**, which looks for somebody
  who may be the same person before anyone is added, as **Add person** does.
  While you type a name, the field offers the entries it may be under **In
  the register:**; pick one to point at them rather than write the name. A
  name like one in the register is written only when you leave the field,
  so a name typed to find somebody never lands in the history.
- **A person picked** is kept as their id. The field shows what the register
  says: their name, or *Former colleague 7KQM* once they are forgotten, or *a
  former colleague* once the entry is removed. A merged entry shows the one it
  went into. The cross takes the person off the field.
- **Text** stays text. Text written before the register existed is still
  there, still shown as typed, and still found by a search; a forget does not
  reach it, and **What we hold** counts it.
- **A signature keeps its name.** When a person picked as a signer gives a
  verdict, the name they had that day is written beside their id, and the
  proposer's name is fixed the same way once anybody has signed. That name is
  part of the decision record: the decision shows it after the person is
  forgotten, where every other screen shows the pseudonym. An agent the
  policy gives pseudonyms is told the pseudonym here too, and that the name
  as signed is withheld from it. Once the signer is forgotten or removed,
  the signature links to nobody: the decision shows the name as signed alone,
  even while the record is still being written; no screen shows it beside
  the pseudonym; a search for the pseudonym no longer finds the decision; and
  an agent is told the name as signed with no id.
- **An application's owner can follow a role.** Where the operating model
  has the rule *an application's owner is a role of its team* (see *The
  operating model*), an application nobody wrote an owner on shows the
  people who hold that role, today, in the unit it **Belongs to** — worked out
  on the day and never stored, so it changes when the person in the role
  does. A name written in **Owner** wins. **Belongs to** is asked of every
  application: for one of the organisation's own, it is the unit it belongs
  to.
- **A stand-in** carries no owner of its own; it shows the owner its master
  names, by the same id.
- **Search** finds a person through the register: a name finds the records
  that point at the person, and a forgotten person is found by their
  pseudonym and no longer by their name.` },
  ],
  guidance: [
    { title: `Guidance: principles, topics and building blocks`, text: `Principles, topics and building blocks answer one question, what should guide
this work, and sit under one entry, **Guidance**, with a tab each. Each tab has
its own address and one line that says what it is for; *Which one do I need?*
says when to use which. Each is a list with one line per item: selecting a line
opens the item large, and the arrows walk the list.` },
    { title: `Principles`, text: `A principle is what guides designs and decisions in a scope: *least
privilege*, *buy before build*. Every scope can keep its own, and a principle
holds in the scope that keeps it, in every scope under it, and wherever a
topic that keeps it is relevant (see *Topics*). The **Principles** card on a
home says how many are the scope's own and how many are in force there, and
opens the page. A line says only what stands out: no word is an accepted,
flexible principle; **Filter** narrows the list by status, regime and group. A
principle from elsewhere says where it is kept, which is where it is changed and
discussed.

**New principle** asks for a title and a statement, a regime — *fixed*, kept
to always, or *flexible*, to be weighed — and its status: a *candidate*
still being discussed, with the question it is about; *accepted*; or
*retired*. A principle is numbered in its scope, \`PR-0007\`, and its
**aspects** are numbered under it, \`PR-0007.2\`: the parts a record can follow
or depart from one by one. It is written in a window of its own; why,
implications and keywords are folded until there is something in them. Groups
sort the list; **Groups** names them and puts them in order. **More** on a
principle holds Retire, Merge and Delete, and says why a Delete is refused. Changing an accepted principle's statement or aspects
**sharpens** it: you are asked for a note, kept under the principle with the
day. Two principles that say the same are **merged** into one; one that a
record cites is retired rather than removed.

**Citing.** A decision, an observation, a solution, a plan, an element and a
building block each have a **Principles** section: the principles the record
follows, or departs from with a reason, or — on an observation — that a
principle holds, chafes or was missing. *May apply* suggests the ones in
force whose words match the record's. A citation that names a principle that
is gone is a finding on the Checks page, as are principles nothing uses and
principles that chafe.` },
    { title: `Topics`, text: `A topic is a subject that runs across the organisation — *security*,
*integration*, *data* — and is relevant to some of its scopes and not to
others. Topics are scopes of their own under the organisation's **Topics**
place, made the first time one is; a topic can have subtopics. The
**Topics** card on the organisation's home opens the catalogue: every topic,
nested, with how many scopes it reaches; selected, where it is relevant and the
building blocks and principles it keeps.

A topic is linked to a scope **from a day**, and the link can end on a day:
**+ Scope…** on the topic, or **+ Topic…** under *Relevant topics* on a
scope's home — the same link, from either end. **More** on a link holds **End
on a day…**, which keeps the link as history, **Change the days…**, and
**Remove**, for a link made by mistake. A topic's principles are in
force wherever it is relevant today, and the scope tree shows a topic as a
row ↗ under each scope it is relevant to. A topic can be renamed, described,
moved under another topic, and removed while it keeps nothing.

**+ Topic…** on a scope's home opens a chooser made for many topics: type to
find one by its name or by what it is about, or browse them nested as the
catalogue nests them. Each row says where the topic applies today and what it
keeps, and the topic pointed at is read in full beside the list. Tick as many
as apply and add them together; a subtopic comes with its topic. Where
nothing matches, **New topic…** makes one with the name typed, relevant to
that scope.

A topic's type is **Topic**, and so is the Topics place's. A scope that already
exists becomes a topic in its **Settings**: choose **Topic** under *What this
is*, and saving files it under Topics — or under the topic chosen under
*Filed under* — with everything under it.` },
    { title: `Building blocks`, text: `A building block is what many solutions reuse: a *message gateway*, an
*identity service*. It is kept in a topic or a scope, and the **Building
blocks** card opens the list of all of them, under where each is kept.
Selecting one reads it large; **Open full record** is its page, with the
list folded away, on four tabs:

- **About** — its document, with a chapter per usage context, and the
  principles it follows.
- **Requirements** — its **capabilities**, one sentence each and a *must*
  where a solution has to cover it fully, and its **usage contexts**, the
  situations it is used in, said in words, each saying how much it needs of
  every capability: a Harvey ball from empty to full, with a legend. A press
  selects a cell and writes nothing; Space moves it on a quarter, and 0 to 4 sets
  it. **More** on a row removes a capability, and a usage context's name opens
  its chapter.
- **Options** — the catalogue: products, services and what is built in
  house that could deliver it, each with its supplier and status, and the
  elements in the landscape that are it.
- **Where used** — every scope's **evaluation**. **Evaluate for…** starts
  one for a scope, with the contexts that apply there, optionally copying the
  ratings of another scope's. In the grid each option is rated against each
  capability, N writes a note on how, and a cell with one says *note*; the
  **fit** is how much of what this scope needs it covers, and
  an option that does not fully cover a must fails whatever its fit.

**Propose a decision…** on an evaluation drafts a decision in that scope
with the options, their fit and the drivers filled in. Once the decision is
accepted on its scope's decisions page, the evaluation records the chosen
option, and its elements' inspectors and the library say they were chosen
for that scope.` },
  ],
  agent: [
    { title: `Working with an agent`, text: `Your coding agent — Claude Code, Codex, Cursor or any other MCP client — can
connect to the desktop app (*Connect an agent…* on the bar, or the glyph
beside the menu) and work in the organisation while you watch. It reads
every scope, and it can move the app the way you do: open a scope, switch to
a board or a sheet, open the decisions or the roadmap, open the observations
on the Register, Analysis or Solutions tab, look at a report. It can open a
board, a sheet, a map or a technology landscape with one thing selected on
it, where that view draws it. It does not need you to open anything for it
first, and opening a view never makes one: where a scope has no view of the
kind it asks for, the agent is told so and the screen stays where it is —
making one is a change like any other. Whatever it opens is what you see, so
a record's page that was open over the board closes.

While it is moving the app or changing the model, a strip along the bottom
of the window says so, with the agent's name and — when it said — what it is
doing. Anything you click meanwhile can change what the agent sees next, so
the strip is there to tell you before you do. **Stop** on that strip ends the
agent's session: the strip goes, the agent is told on its next call, and it
is expected to report where it got to rather than carry on. It may ask you
to continue; when you say so, it starts a new session and the strip is back.

Everything an agent changes shows in Activity under its name and is undone
with {key:Mod+Z}, as before.

An agent can read the **people register**, add someone to it — it is told
when somebody similar is there already — and mark someone as left. It sees
names, or pseudonyms where the organisation's policy says so, and it is told
whether a person has an address, never the address. It cannot forget,
remove or merge anyone, or change the policy: those are yours, on the People
page. The register is no step, so what an agent does there is not in
Activity and is not undone with {key:Mod+Z}.

An agent can also keep the **tree of scopes**: make a scope under another — a
domain, or a landscape scope with its first board, served by a unit from the
start — rename and describe one, give it a type, file it somewhere else, and
remove one. It removes one scope at a time, and never one with scopes under
it. A scope that holds work goes only after the agent has told you what is in
it and you have said, in your own words, that it is to go with all of it: your
words go with the removal, and a notice on screen says what went. There is no
{key:Mod+Z} for that. Each change is that scope's own step, in its history, as a change
made from a home is — not one the workspace's {key:Mod+Z} takes back. The agent leaves
the scope open in the workspace where it is in the tree: to rename, move or
remove that one, or to move or remove a scope above it, it goes to that
scope's home first, as you would.

An agent reads the **principles** in force at a scope and how each comes to
hold there, the **topics** and where each applies, and the **building
blocks** with every scope's evaluation of them. It can propose and change a
principle and cite one from a record; make a topic and link it to the scopes
it is relevant to; change a block's capabilities, usage contexts and
catalogue; start a scope's evaluation of a block, rate its options and
propose the decision it becomes, as **Propose a decision…** on the block's page
does — accepting it is yours. When it writes a description or a decision, it
refers to a view, an element, a principle, an evaluation, a decision or an
observation in the same words *Insert ▾* writes.` },
    { title: `Libraries`, text: `An agent reads the operating model with \`unitTypes.list\`, \`roles.list\` and
\`responsibilities.list\`, from the organisation whatever scope is open, and
changes it with \`unitType.add\`, \`unitType.update\`, \`role.add\` and
\`role.update\` while the organisation is the scope open. \`unitTypes.list\`
gives each unit type its lane — 1 at the top, and below the deepest type it
may sit in — and lists them by lane, then by their \`order\` in it, then by
name, the ones that sit nowhere last.` },
    { title: `Units and the people in them`, text: `An agent makes an actor a unit with \`element.update\` (\`unitTypeId\`, \`scopes\`,
\`extraSlots\`), lists who holds what with \`assignments.list\` — across the tree,
and for one unit its roles and who manages it — and assigns and ends with
\`assignment.add\` and \`assignment.end\` in the scope that keeps the unit, and
corrects one — its share, acting, days and the person's own reporting lines
(\`reportsTo\`) — with \`assignment.update\`. \`reportingLine.set\` says a unit's
own line, to a role in a unit or to one person (\`to.person\`), and
\`reportingLines.list\` answers every line with where it was said and whether
it is an override, and lists the exception placements. The agent is told to
keep to the model's defaults and to write an exception only when you ask for
one, and to say that it did. It
never forgets, removes or merges anyone. \`element.remove\` on a unit takes its
assignments too and lists them in its answer (\`assignmentsRemoved\`), moves
the units inside it up where their type may sit there (\`unitsMoved\`), clears
the team of the applications that name it (\`teamCleared\`) and takes its rows
in other scopes along (\`alsoChanged\`). Where the units inside may not move up
it is refused, \`agent.unitsInside\`, with the choices named: the agent asks
you, and calls again with \`units\` — \`into:<id>\`, \`up\` or \`delete\`;
\`checks.list\` names one left behind as \`check.assignmentOrphaned\`, which a
person removes. Who serves a scope is the unit's
\`scopes\`, written with \`element.update\` in the scope that keeps the unit — the
organisation, \`""\`, is never one, and is dropped from what is written; who
is responsible for a capability is an \`assigned\` row, written with
\`relation.add\` in the scope that defines it; and \`checks.list\` names a
capability assigned outside its domain as \`check.unitNotServing\`.
\`assignments.list\` says who manages each holder, each with \`via\` — \`nesting\`
or \`line\` — and the functional lines apart. A slot's line is \`reportsTo\` in
\`unitType.add\` and \`unitType.update\`; a unit's own is \`reportingLine.set\` —
to a role in a unit anywhere, or by nesting here — and \`reportingLine.remove\`,
in the scope that keeps the unit; \`reportingLines.list\` lists every line on a
day, where it lands and what the lines contradict. A line to itself is
refused \`reportingLine.self\` and one that closes a loop \`reportingLine.loop\`,
with the chain.` },
    { title: `Change over time`, text: `An agent puts a unit under a new parent on a plan's day with \`plan.move\`,
dates a unit type or a role with \`unitType.update\` and \`role.update\` (\`from\`,
\`until\`, \`successors\`), and reads the organisation of a day with
\`assignments.list\` and \`checks.list\` (\`on\`).
It corrects where a unit sits, with no day, with \`element.update\` and
\`parentId\` — any unit in the organisation, found by its id, or none for the
top — in the scope that keeps the unit: a loop is refused, and a place its
type may not sit in is said (\`misplaced\`).` },
    { title: `Who works with whom`, text: `An agent makes either view with \`diagram.create\` (\`chart\`, \`conway\`), opens it
with \`app.open\`, on a Conway map with \`tab\` (\`grid\`, \`lines\`), \`group\` and \`pair\`,
and reads what it draws with \`diagram.inspect\`: the units with
each role's holders and vacancies on the view's day, in the order the chart
lists them and never folded, or the columns, the crossings and the findings,
each with its check's key, weight and category as \`checks.list\` gives them.
It declares an interaction with \`relation.add\`,
type \`interacts\` and a \`mode\`.` },
  ],
}
