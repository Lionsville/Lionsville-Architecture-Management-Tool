# User manual

Lionsville Architect draws an application landscape in Layer-7 bands and the
C4 container diagrams underneath it. This is the manual for using it. What it is and why it exists is in the [README](../README.md);
this manual is also in [Dutch](manual.nl.md) and [German](manual.de.md).

## Starting

**Desktop.** Download the app for your platform from
[architecture.lionsville.nl/download](https://architecture.lionsville.nl/download).
It checks for a newer version in the background and asks before it does
anything about one — **Download and Install** fetches it while you work,
**Skip This Version** says not this one, and the checkbox in that dialog turns
the automatic check off. When the download is done it asks you to restart;
**Later** installs it the next time you quit. Where the app cannot replace
itself — run straight from the disk image, or from Downloads without being
moved to Applications — it says so and opens the download page instead.
**Check for Updates…** in the Help menu asks on request.

**The menus** on the desktop are in English for now. **File** holds the
folder, the working file, snapshots and history; its items about the open
scope — Save — is greyed out while nothing is open; Open… and Save a Copy of
the Working File… are about the whole organisation and work from every
screen. **Edit** holds Undo, Redo, Delete and Select All, which act on
the app's own undo stack and on the canvas, beside Cut, Copy and Paste.
**Help** holds this manual, in the app's language, the keyboard shortcuts and
the update check.

**Browser.** [app.architecture.lionsville.nl](https://app.architecture.lionsville.nl/)
is the newest release, with nothing installed. You can also run it from a
clone of the repository: `npm run setup` once, then `npm run dev`, and open
<http://127.0.0.1:5200>. Where the browser offers it (Chromium does), a tab
can work in a folder just as the desktop does. Otherwise your work is kept in
that browser; a private window keeps it only as
long as the browser does. *Where your work is kept* says more.

Nothing leaves your machine either way. There is no account, no backend and no
telemetry.

## The organisation screen

The app opens on the **organisation**: a scope like any other, and the one
everything else you keep is filed under. A **scope** is
one document: a name, a landscape, the container diagrams under it, the
decisions, the plans, the business architecture, and everything placed on them.
Scopes **nest**, and every one of them is the same document — the organisation
at the top, a **domain** or a **team** under it, a **landscape scope** under
that, as deep as your work needs. A landscape scope is a scope; a landscape is
also a kind of board, which is a drawing inside a scope.

The screen is the organisation's home rather than a list of documents. A line
under the name says what it is and where things live: as files in the folder,
in this browser, or nowhere yet. Then it has five parts.

![The organisation screen: the name and links at the top, the organisation's own pages as cards, the scopes within it, and the examples last](screenshot-organisation.png)

**Its identity**, at the top: the name, the client if the drawings are made out
to somebody else, how many scopes are filed under it by what each says it is
(*2 domains · 1 team*, in the words of the badges on their rows), when
anything in it last changed, the description, and its links. An organisation
nobody has named yet asks for a name here instead of showing a heading; a
folder goes by its own name until you give it one.

**Its own pages**, as cards. Each says in a sentence what is behind its
**Open**, then counts: **Business architecture** the journeys, areas, functions
and stakeholders the organisation itself holds, and how many functions nobody
has handed to a domain yet; **Decisions** its records by status, naming the
newest; **Roadmap** its plans, and the first thing their dates disagree about;
**Register** every application in the whole folder, how many a domain answers
for and how many are somebody else's; **Technology** every platform service and
platform, and how many are shared. A scope that draws has a **Documentation**
card too. Each card opens what it counts; closing the page brings you back
here.

**Needs attention**, under the cards, when there is anything to attend to:
one sentence per thing the organisation contradicts about itself — a name two
scopes both define, a copy gone stale, an application nobody has said whose it
is, a service used across a team boundary without being marked shared, a
service no platform delivers. Each sentence is a button that opens the scope it
is about with the record selected, so the place to fix it is one click away.
The rest of *One name across the organisation* below says what each means.

**Scopes within** the organisation, beneath: one row per scope, the children
indented, with a chevron to fold a domain shut, and a badge saying what the
scope says it is. A row says how much is inside it — scopes with boards and
diagrams over the whole subtree for a domain, diagrams for a scope with nothing
under it — and when it last changed. **Order** lists by name or by what you
changed most recently. An organisation with nothing filed under it yet says so
in a sentence. A scope that draws lists its **Boards** above the tree instead,
one row each, and **New board…** offers the same kinds the editor's `+` tab
does: a landscape, a business architecture, an enterprise map or a technology
landscape.

- **Open** on a row goes to that scope's home: its own cards, its boards, and
  the scopes within it, each with a row of its own. A board is opened from its
  row under **Boards**.
- **New domain or team…**, once, at the head of the section, asks for a name
  and files the new scope under the scope whose home you are on; **Filed
  under** in the dialog puts it somewhere else.
- **Settings…** on any row holds its name, what it is (organisation, domain,
  programme, team, landscape scope — a word for the screen, nothing behaves
  differently),
  a client, a description, links, and **Filed under**, which moves it.
- **Delete** removes the scope and everything filed under it, and the
  confirmation says so: its folder on disk, or, in a browser without a folder,
  its records from this browser. A working file you saved elsewhere is not
  touched. The organisation itself cannot be deleted: it is the root
  everything else is filed under.

The chip at the right of the bar says where your work is kept: the folder your
projects are files in, **In this browser**, or **Not kept anywhere**.
**Work from another folder…** beside it points the app at a different folder,
and a browser that has no folder offers **Choose folder…** instead.

**Examples**, last. Copying one into an organisation that is empty and unnamed
makes the example *the* organisation. An organisation that is already something
files it under a new scope of its own. That covers anything with a name, a
scope under it, a board or records, and every folder, which goes by its own
name. Either way the copy is yours from that moment, and nothing you do runs
against the example itself.

Renaming a scope relabels it and nothing else — where it is filed is its
address, and renaming is not moving. Moving one changes the address of the
scope and of everything under it, and leaves the content untouched: every
stand-in elsewhere in the folder that pointed into it is carried over to the
new address in the same step, so a move never leaves a trail of stale copies
behind it. So is every cause that explains one of its causes, and every
observation that absorbed one of its observations: they name it by its
address, and follow it. On boot the app reopens the scope you had open.

Seven names are refused, because a scope's own folders use them already:
`diagrams`, `docs`, `decisions`, `transitions`, `observations`, `images` and `logos`.

## One name across the organisation

A name means the same thing everywhere in your folder. The warehouse system is
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

### The register

**Register** on the organisation screen is every application in the whole
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
ever changed by the scope that holds it.

### Moving a record between scopes

Where a thing is written down is a decision you can change afterwards. Select
the card and press **Move…** in the inspector; the dialog offers whichever of
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

The last three write **two scopes**, so they ask first. The scope it is going to
is written before this one changes, which is deliberate: if something goes wrong
halfway you are left with the record in *both* places — a conflict you can see
and settle with **Link** — rather than in neither.

That is also why **undo stops there**. ⌘Z takes back everything you have done
since, and then refuses that step with a line saying why: only half of it is on
this window's stack, and the other half is a file in a scope nothing here speaks
for. To put it back, move the record again the other way.

A move is refused, with the reason, when the scope it would go to already
answers for the name, when a promotion names a scope this one is not filed
under, and when removing the record would leave things filed under it with
nothing to sit in.

## Where your work is kept

Your work is kept in one of three places, and the organisation's home says
which in the line under its name:

- **a folder**: the desktop's, or a browser tab's where the browser offers one;
- **this browser**: a tab with no folder;
- **nowhere**: a tab where the browser's storage will not open.

The working file (see *Saving, exporting, sharing*) carries your whole
organisation from any one of them to any other.

### A folder

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
      images/floor-plan.png           a picture a description shows
      logos/own.svg                   a logo you uploaded
```

A folder holding a `scope.json` is a scope, and the folders inside it that hold
one are the scopes under it. Move a folder in your file manager and the scope is
at its new address. A folder you have not named yet goes by the folder's own
name.

**A folder from an older version opens.** The first time this version sees one
it converts the whole tree (`project.json` and `group.json` become
`scope.json`). On the desktop, where the folder is a git repository, it
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
- **Copy my work in** copies every scope the browser kept into the folder. The
  dialog stays open until the copy is done, then says how many scopes were
  copied, which could not be, and which it left alone because somebody changed
  them meanwhile. Scopes that could not be written are offered again with
  **Try again**, and again the next time you choose that folder.
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
configuration. A folder's `.git/config` may set what a repository needs, such as
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
(`git lfs install` sets it up for you, and then it runs), and for a remote that
is a folder inside the working folder.

A browser tab can work in a folder too, where the browser offers it (Chromium
does). The permission rarely survives a restart, and asking for it needs a
click. So a tab only picks a remembered folder back up when the permission is
still granted, and otherwise starts in this browser without a word. The
desktop is the one that is made to choose.

### This browser

A tab with no folder keeps your work in this browser, for this site. The chip
on the organisation's home says **In this browser**, and your work stays there
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
window is private: save a working file to keep your work.

**Where the browser's storage will not open**, the app works from memory and
nothing you change is kept. A strip on every screen says so. The chip on the
organisation's home says **Not kept anywhere**, in the warning colour. The line
under the name says *Everything here is kept nowhere yet — save a working file
to keep it.*, and the first snapshot says *Snapshots are kept for as long as
this tab is open, and go with it.* Work an older version kept in this browser
is shown. Save a working file before you close the tab.

If the browser's storage has not answered within a few seconds, the page is
drawn anyway. A strip says so, and your work appears when the storage answers.

### When it changed elsewhere

A scope can change while you have it open: a colleague's checkout, a sync
client, you on another machine or in another tab. The bar then says **Changed
elsewhere**, or **Changed here and elsewhere** when you have unsaved changes
too. A strip above the canvas asks which version stands:
- **Take theirs** reads their version and puts it on screen.
- **Keep mine** replays your changes onto their version, so their edits to
  things you did not touch survive. Only where that is refused does it write
  the whole scope as it is on your screen over theirs.
- **Save a copy…**, with unsaved changes here, puts yours in a working file
  first and leaves the decision for later.

Nothing is overwritten without asking.

### When a scope cannot be read whole

If part of a scope cannot be read, because a file of it is damaged or was
changed by hand, the scope opens to be looked at and not changed, and a notice
names what could not be read. Where you may write where the scope is kept, it
offers **Bring in a working file…**, and **Put back from the history…** where a
history is kept; in a folder it also says you can mend the file and open the
scope again.
- **Put back from the history…** opens the History page, where **Put back the
  whole scope…** makes all of it what it was at the snapshot you chose. What
  could not be read is kept first, as an entry of the history or set aside
  beside the scope, and where it cannot be kept, nothing is put back.
- **Bring in a working file…**, or opening one onto the scope, puts it back
  from the file the same way, and the question before it says so.

An entry that kept what could not be read offers **Save what could not be
read…**, which saves it as a file of your own. A scope that a later version of
the app wrote opens to be looked at only: the notice says to update the app,
and nothing here puts it back.

## History

Every place keeps a history of your work. **Snapshot…** in the File menu (on
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
travels with the history, so a colleague sees the same mark in the same place;
in the desktop's folder it is a git tag, which any git client shows. Two labels
with the same name are refused, anywhere in a folder and within one scope in
a browser; pick another word.

**Snapshots the app takes itself**, where a history is kept: before a working
file replaces what is here, before a scope is put back from the history, and, on
the desktop, before a folder is pulled from its remote and before a folder from
an older version is converted. Each is named for what it came before, so what
was there can be restored.

## The workspace

One open project: a bar at the top, the editor below it.

| In the bar | What it does |
|---|---|
| **The crumbs** | The organisation, each scope between, and the open one in bold; each is a way to that scope's home, and the organisation's name is the way back to the first screen |
| **Settings…** | This scope's name and where it is filed, and its defaults: the author named on an exported diagram, and the operational aspects a new landscape starts with. Moving a scope files it under another one and leaves its content untouched |
| **⋯** | In a browser, the menu: **Open Folder…** where the browser offers one, **Open…**, **Save**, **Save a Copy of the Working File…**, **Share with a Link…**, **Snapshot…**, **History…**, **Connect an Agent…**, the theme, **Preferences…**, and under Help **User Manual**, **Keyboard Shortcuts…** and **Get the Desktop App**. On the desktop the same items, but the last, are in the menu bar, with **Preferences…** as **Settings…** in the app menu on macOS |
| **Activity** | What has changed in this project since you opened it — a list of named steps with the time each was taken, and the moves, *Moved from X to Y*, with who moved it, read from the history, so they include moves from before you opened it. It stays with the scope wherever it moves. Read-only: ⌘Z is how you go back |
| **Saved · hh:mm** | Where the project stands: the time it was last written, or **Unsaved changes**, **Saving…**, **Changed elsewhere**, **Changed here and elsewhere**, **Not saved — storage refused** |

Everything is saved automatically as you work: three seconds after you stop, on
leaving the window, and on closing it. Closing with unsaved work saves it
first: the desktop asks only if that save did not work, and a browser tab asks
before it closes. In a browser without a folder, the app says once when its
storage is
about four fifths full. That is the only warning you get, because a browser
stops saving without asking. If a save is refused, the bar says **Not saved —
storage refused** and the editor keeps working. Where the browser's storage will
not open, a strip says so from the start. In either case, save a working file,
because
otherwise the work is gone when the tab closes.
Every notice (saved, loaded, failed) appears in that bottom bar.

**Language.** The language button at the right of the editor's toolbar
(it shows the code of the language you are in: NL, DE or EN) opens a
menu of the three: Nederlands, Deutsch and English. Choosing one switches
the whole interface: menus, dialogs, tooltips, band names, error messages and
the title block of a PNG export. The first time, the browser's language
decides. The design itself does not change; element names are content, not
interface. Frysk was offered until 26 September 2026; if you had chosen it,
the app now opens in Dutch.

### Back and Forward

**Back goes to the place you were before**, and Forward goes to the place you
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
⌘Z is still how a change is taken back.

**In a browser** the browser's own Back and Forward do this, with their keys
and gestures. The address names the place you are on, after a `#`, so a reload
stays there, and an address copied from the bar opens the same place for anyone
who may read it. The rest of the address is left as it was.

**In the desktop app** the bar starts with a **‹** and a **›** button (after
the window's buttons on macOS), greyed out when there is nowhere to go. The
same moves are in the **Go** menu as **Back** and **Forward**, on **⌘[** and
**⌘]** on macOS and **Alt+←** and **Alt+→** on Windows and Linux. The mouse's
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
nearest scope above it. The Activity list says what was removed.

### Share with a link

**File → Share with a Link…** (in a browser, in the **⋯** menu) makes a link
to the place you are on, copies it, and shows it in a small dialog, where it
can be selected and copied again with **Copy link**. *Link copied* is said once
the copy has been made. The link is the address of where the work is kept with
the place after a `#`, the same way the browser's address names it: a scope's
home, or an open scope on its view or on a page over it. On the decisions and
the observations page it names the record that is selected, and on the
observations page the tab that is up, so the person who opens it lands on
that record — choosing another record is still not a step for Back. Anyone who
may read the work opens the same place with it; somebody who is not signed in
yet signs in first and lands there after.

**A link needs an address somebody else can reach.** Work kept in a folder, in
this browser or nowhere at all has none, so there the dialog says why there is
no link, and nothing is copied. The menu item works from every screen, the
organisation's home included.

## Drawing

**The landscape** has five bands: actors, input channels, external systems,
the application landscape and the management layer. Drag an element from the
palette on the left into a band, or right-click the canvas and **Add here**.
Bands resize by dragging their edge.

**Domain groups** box the applications that belong together. Add one from the
palette or from the canvas menu, give it a colour, drag applications in, tidy it
on its own. Removing a group leaves its elements where they are.

**Container diagrams.** An application can have a container diagram
underneath it: the application becomes the boundary of that diagram and its
components sit inside. You make one on purpose — right-click the application
and choose **Create container diagram**, or press the button of that name on
the inspector's General tab — and it is a step in Activity like any other, so
⌘Z takes it back. A card that has one carries a small mark; double-click the
card to open it. Double-clicking never creates one. A landscape tab lists its
container diagrams under a chevron: right-click an entry there, or press the
chevron after the name once the diagram is open, to rename it, open its
**diagram settings** or delete it. Deleting one takes its components with it
and keeps the application. Right-click a landscape tab for the same menu, with
duplicate as well. **Back to landscape** returns to the view exactly as you
left it.

Where those containers run is drawn around them: dashed **deployment boxes**,
one per platform, nested the way the platforms nest — the namespace inside the
cluster inside the account — with a container that runs on nothing outside
every box. They are worked out from the rows and cannot be moved: a box is
where its members are. The **deployment** button in the toolbar takes them
away for a reader who wants the plain C4 picture, and the view remembers.

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

Lines and the names of domain groups are in the same walk, and Enter selects
them too; Shift+F10 opens the menu of whatever is selected, and Enter on the
element that is already selected opens its documentation. To draw a line
without the mouse, choose **Start connection to…** from an element's menu, Tab
to the other end and press Enter. On a landscape tab, ↓ lists its container
diagrams and Shift+F10 opens the tab's menu. Resizing an element, a band or a
group, moving a group and bending a line still need a pointer.

## Elements

Seven kinds: application, component, external system, input channel,
management tool, actor, and the domain group that holds them — and, since
the physical view, a **platform**: a cluster, a broker, a bus, the tooling,
what the applications run on and what they use. Select one and the
**inspector** on the right shows its fields in three tabs.

- **General.** Name, category, vendor, technology, lifecycle (planned, live,
  retiring, retired; shown as a badge, retired elements dim), whether you
  manage it, the description (see *Documentation*), and where it sits.
- **Appearance.** Accent colour, shape, icon, icon size.
- **Data.** The **operational aspects** of an application: for each column of this
  diagram, managed, partial, none or at risk, with a note. The columns are set
  per diagram in its settings.

**Icons.** Around a hundred built-in marks, searchable by name, category and
keyword in both languages, in two sizes: small in the header, large leading the
card for a diagram read from a distance. **Upload a logo** in the picker adds
your own SVG or PNG (up to 200 kB). Uploaded logos travel in the working file.

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
block marked `mermaid` in any page is drawn as a diagram. A block marked
`bpmn` is drawn as a process: BPMN 2.0 XML as the common modellers save it,
with its own diagram section saying where everything goes — pools and lanes,
tasks, events, gateways, flows and messages, read-only. A process element's
page is where one belongs (its `realises` line says which capability it is how
of), and a file without a diagram section is shown as text under a line saying
why.

**Pictures.** Paste or drop a picture into the text to add it: PNG, JPEG,
SVG or WebP. **Pictures** beside the source lists every picture the scope
holds, with **Insert** to put one on this page and **Delete picture** to remove
one. The text names a picture by its name, `![caption](image:floor-plan.png)`,
wherever the scope is kept. A page lays every picture out at once, at its own
size, and fetches it only when it scrolls into view, so a long page opens
quickly and nothing on it moves when the pictures arrive. A picture that cannot
be shown shows its caption. Only pictures kept with the scope are drawn: a web
address shows as its caption, and the app never fetches anything.

## Decisions

**Decisions** in the top bar opens the architecture decision records: a tree
down the left, the records of the selected node in the middle, and the record
you are reading on the right.

This scope's records are **one list**. A record either belongs to the scope as
a whole, or it is about one thing in it — an application, a capability, a
journey step — and the tree has a node for each thing that has records, with
every application listed whether or not it has any yet. Something that has left
the model keeps its records under *Removed applications*.

Under that come the scopes **above** this one, as a section each: *From Acme
Logistics*, *From Retail*. Their records are read here and **changed where they
live** — the reader shows them without an Edit button and offers to open that
scope instead. Numbering is per scope, so ADR-0001 of the domain and ADR-0001 of
the landscape are two records and always were.

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
title, body and reviewers, this scope's and the ones above. Bodies are markdown,
with the same `[[Name]]` links as documentation; **Formatting help** beside the
source shows the syntax, mermaid diagrams included. Changes are saved with this
scope.

## Observations

**Observations** in the top bar opens what the team saw in this scope — and,
analysed as a team, what lies behind it. The page has three tabs. The
**register** is a table read off the records: number, title, the day it was
first seen, where, its impact, how often it has been seen, and the causes it
was analysed into; under it the causes, the solutions and the experiments;
the record you pick opens beside it. The **analysis** is a picture: the
observations on the left, the causes they were analysed into in the lanes to
the right, then the root causes, and the solutions that address them last.
The third tab, **Solutions**, is below.

**Local and global.** Every scope's observations, causes, solutions and
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
rather than this page's: a note after it says where it went, and ⌘Z on this
page does not reach it — to take it back, change it back. Where that scope
may not be changed from here, or its own rules refuse the change, the note
says nothing was made. A solution or an experiment of a scope below
is read here and not changed.

An observation is a numbered record (`OB-0007`) with a title, a place, who
saw it — free text: a name, initials, a team — the day it was first seen, an
impact — *minor*, *major* or *critical* — and a markdown body for what was
seen, the evidence and who or what it affected. **Seen again** counts one
more and writes the day into the record's **history**, which is the dated
ledger at the end of every observation: recorded, seen again, merged,
archived. On a large card the impact is a stripe down the left and the count
is in the corner; on a small one the impact is the size of the circle.

**New observation** asks for the four facts that make one: the title,
**where it was seen**, **observed by** and **when seen**. When seen starts at
today and may not be in the future; the impact starts at minor. On the right
the description asks its three questions a field each — **what we saw**,
**evidence** and **who or what it affected** — and the last is required too:
an observation always says whom or what it touched. Recorded, the three are
one markdown description under those headings, and an observation's
description is edited as one text from then on. **Preview** shows it as it
will read, and **Edit** goes back to the fields. Every field has an example
under it, and a field left empty says what is missing in its place. Under the title, two
hints that never stop you: **Seen before?** lists observations of the chosen
scope whose titles share words with yours, each with **Seen again**, which
records a sighting on that one and nothing new; and a title that uses a word
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
step — ⌘Z takes the observation, the new causes and the links back together.
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
greyed, why it cannot. A merge inside this scope is one step, and ⌘Z takes it
back. One that changes another scope — a record of it merged, or a link kept
there moved — writes every scope it changes as that scope's own step, all or
nothing, and a note says which scopes it changed; ⌘Z here does not take that
back, so change it back. The screen closes on the survivor. Every merged
record stays — it is where the original wording is — and is read as merged
rather than deleted, saying where it went, also when that is another scope;
*Show merged* brings merged observations and causes back into the register.

An observation that was fixed, addressed or has stopped mattering is
**archived**: *Archive* asks why, optionally, and writes the day and the
note into the history. The record stays where it is, for the history, and
leaves the analysis — not drawn, not queued, not offered as a merge target —
until *Restore* brings it back. *Show archived* lists the closed ones.
Nothing is deleted to close an observation; *Delete* is for a record that
should never have been one.

A **cause** (`CA-0003`) is what the team says lies behind one or more
observations, or behind other causes. It starts **assumed** and is marked
**verified** once checked. A **root cause** is a cause the team says is one,
and it is labelled **RC** on the cause's own number: `CA-0004` made a root
cause is `RC-0004`, and made a cause again it is `CA-0004` once more. A root
cause ends the chain: nothing explains it, and a solution addresses it. It
may explain causes and observations. A cause that is not a root cause and
that nothing explains is an **open end** — the analysis is not finished
there — marked `?` in the picture and counted over it.

**An analysis from an earlier version** said no root causes: a root cause was
then any cause nothing explained. It opens with a root cause wherever a
solution that was not dropped addresses a cause, and nowhere else, so a cause
that was a root only because nothing explained it yet opens as an open end.
The same holds wherever the work is kept.

**Make root** and **Make cause** are steps with a name in the Activity list,
and each asks first. Make root is refused while a cause explains this one:
the reader names each cause that does, and says to unlink it or to make that
one the root cause instead. Make cause is refused while a solution addresses
it: the reader names each solution, and says to move it to another root cause
or unlink it first. A new cause can be made a root cause as it is written.

**Every action on a reader is a small button** with an icon and a word or
two, and hovering it, or reaching it with Tab, says in full what it does and
what it is refused for. An observation offers *Seen again*, *Cause*, *Edit*,
*Merge*, *Archive* and *Delete*; a cause *Deeper cause*, *Root cause*,
*Make root*, *Verify* and *Merge*; a root cause *Solution* and *Make cause*,
and never a deeper cause. *Cause*, *Deeper cause* and *Root cause* open one dialog with
two tabs: **New cause**, the cause's own fields, and **Existing cause**,
offering only what the rules allow. Where the reader is narrow, *Merge*,
*Archive* and *Delete* move into `⋯`.

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
*12 of 40 shown*, and × beside *Filters* clears them all. **Saved filters**
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
zoom; the zoom buttons, and ⌘ or Ctrl with the scroll wheel, zoom it, and dragging the
background pans it. **Hovering a record** — or reaching it with Tab — traces
its chain both ways: everything linked to it stays and the rest dims, and its
full title, its label and its scope show under it. Enter or a click reads
it. The same records under the same filters land in the same place every
time.

### Solutions

The third tab, **Solutions**, starts where the analysis ends: what the team
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
the form: a title with an example under it, an optional body with **Edit**
and **Preview**, and a table of the root causes of this scope it addresses,
linked when you propose — the button says *Propose solution for 1 root
cause*. It writes a numbered record (`SO-0003`) and nothing else. A solution
addresses root causes only: a cause that something deeper explains is a
symptom of that deeper one, so its reader offers no *Solution* and points at
the root cause instead, and a root cause a solution addresses cannot be made
a cause again until the solution is moved or unlinked. Before it counts as
**shaped** it needs what the team would ask anyway: the benefit it is expected
to bring and a rough cost, who it was checked with, and whether something like
it was tried before — and if so, why it would work now. The reader lists what is still open under *To move on to…*,
each line with its control beside it, and the button stays disabled until the
list is clear. **Back to…** moves it one step back at any time.

From shaped to **testing** it needs an **experiment** (`EX-0002`): a
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
markdown files, under `observations/solutions/` and `observations/experiments/`.

A solution's reader has the same small buttons as the analysis: *Root
cause* to address another while it is an idea or shaped, *Experiment* to plan
one while it is shaped or testing, *Edit*, and *Drop* and *Delete*, which
move into `⋯` where the reader is narrow. A solution of a scope below, drawn
in its boundary with View local on, is read here and worked on in its own
scope.

**Right-click** anything in the analysis or the solutions picture for what can
be done with it — the same actions its reader offers, Edit among them — and a
line — the analysis's links, a solution's causes, the lines into and out of an
experiment — for how strong the link is, or to unlink it. **Edit** gives the
record the whole width: the text on the left, what it will look like on the
right, and the picture back when you switch to Read.

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
Picking a day only changes what your window shows: nothing is saved, nobody else
sees it, and a dashed outline round the button says so. To make the board open on
that day for everybody, choose **Save** under the date — that one is an edit, one
entry in Activity, and ⌘Z takes it back. **Show today** and then **Save** puts a
dated board back on the calendar.

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
page is showing. Relations with a window of their own are listed under the
applications, folded shut with a count on the heading, because a plan that
moves every interface dates every line.

The slider along the top moves that board. Drag it and the canvas behind follows,
so the picture and the axis cannot disagree about which day is under discussion.
Like the date control, it only looks: **Save** on the board's bar keeps a day.

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

**Initiatives.** A plan lives in the scope that writes it, and a domain's
roadmap is the domain's. When a plan is the organisation's business as well —
a migration the whole company follows — switch on **Initiative** on its page.
It then appears on the roadmap of every scope above, under *Initiatives from
the scopes below*, with the scope it belongs to on a chip; it is read there
and edited where it lives, and the chip opens it there. The organisation
screen's roadmap card counts them. The switch is not offered at the
organisation itself, which has no roadmap above it.

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
after one of its ends has retired, an application still standing on a platform
that has been retired, and a plan past the day it was due to finish.

One entry is not a contradiction but a picture that is missing: container
interfaces running between two applications with no application interface drawn
for them. **Accept** draws it and lands every one of them on it, as one step —
or leave it, and nothing happens.

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
it. The eye in the top bar hides the stakeholder rail, and the magnifying glass beside it finds anything on the page by name — pick a hit, or press Enter for the first, and the page scrolls to it, selects it and rings it for a moment.

Opening an application from a capability's coverage takes you to a board that
actually draws it, switching boards if the one you are on does not — and to the
application's own page when no board draws it at all.

### The enterprise map

**+** in the diagram tabs, then **Enterprise map**, makes the second laid-out
view — or **Map** on the business architecture card of the organisation screen
opens the root's. It is the same layer read the other way: every function down
the side, in the order the sheet draws them and indented by depth; a column per
application the rows name; a mark where one supports the other. On a section —
an area, a grouping — the mark is hollow and means *something under this*: the
roll-up, so the top of an area says what the whole area leans on before you
read its capabilities. Applications another scope owns are grouped under that
scope's name across the top, because the systems supporting the organisation's
capabilities are usually a landscape's, and a column that does not say whose it
is has said half.

Two columns come last. **People** is marked where somebody is assigned — one
column rather than one per stakeholder, because "done by hand" is one answer.
**Coverage** is the gap: *uncovered* on a capability nothing and nobody covers,
*people* on one done by hand without a system, and on a section how many of the
capabilities under it are uncovered. The top bar adds the three up. A map with
an *as of* day counts the rows live on that day, so a system that starts
supporting something in March is a gap on February's map.

Pick a row and it opens on the right, as on the sheet — *Supported by…*
included, so a gap can be closed from the page that shows it. Pick a column
heading to open the application, where this scope holds it.

### Technology

What the applications stand on is a **platform** — a cluster, a namespace, a
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

**The technology landscape** is the picture of all of it: who uses what,
what is offered, and what delivers it, in three bands on one page. *Landscape*
on the technology card makes one in the scope whose services and platforms
it should draw — the platform scope, usually — and it is listed among the
tabs like the sheet and the map, and among the boards on that scope's home.
Choosing the tab shows it in place of the canvas, like every other tab; a
platform scope needs no board at all. It is **authored on**: the palette
beside it offers a platform and a platform service, a `+` on either band
adds one, a `+` inside a group files it under that group, and the inspector
on the right edits the one you choose — name, description, lifecycle,
*shared*, what it is, what it is part of, what it realises, who maintains it. The top band is every application the
rows connect to those services and platforms, from every landscape in the
organisation, in a box per domain; the middle band is the services, nested
where they nest; the bottom band is the platforms, nested where the tree
nests, an outside one dashed. Nothing is drawn or dragged: every card and
every line is read from the rows each time. **There are no lines at rest** —
the cards carry the counts — and hovering a card previews its lines, clicking
pins them, dims everything they do not touch and opens the record on the
right, from which the reports open. *Hide services* folds the middle band to
a strip and draws what each application actually leverages straight to the
platforms, the way the record's *Leverages* line reads it; *All lines* is the
escape hatch. Above forty applications the domains start folded into one box
each with a count, and filtering by name opens the matches; a domain title
folds and unfolds by hand.

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

**Writing what an application uses.** An application's record has a
**Uses** picker beside *Hosted on*: the rows it has as pills, and a
searchable list over this scope's offerings and service platforms first,
then — under *Elsewhere in the organisation* — every offering another scope
marks shared and every service platform the tree knows, each with its
scope. Tick several and close: one step, one undo, and a tick on something
from elsewhere writes its stand-in with the row. The same panel is docked
on the technology landscape, and the landscape has one gesture of its own:
**drag an application card onto a card in the lower bands**. A place takes
*Hosted on*, a service platform or an offering takes *Uses*, a shared
offering brings its stand-in; while an application is selected the targets
show the same two verbs as small buttons. Hosting lines are drawn now,
because on a scope with no offerings that is the only line an application
has; *Fold hosting into service lines* hides one where a use already
reaches the same platform. A **Shared in the organisation** row inside the
services band lists every offering other scopes mark shared, dimmed until
something here uses one; a scope with no offerings at all shows the band
as a strip and the platforms move up. Under *Leverages* on a board's
record, *Show on technology landscape* opens the landscape on that card.
The board itself still draws flows only.

**Colour by** in the landscape's toolbar tints the cards by platform — the
cluster, not the namespace — or by technology lifecycle, so the cards
standing on something retiring go amber, the whole chain counted — or by
**one platform or offering**: every application that uses it, is hosted on
it or leverages it is coloured and the rest fade, which is the reverse
question, who stands on this. The
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
own team's things other teams have quietly come to depend on.

## A drawing

A **drawing** is a view. **+** in the diagram tabs, then **Drawing**, makes one,
and a scope's home offers the same under **New board…**. It has a tab of its
own, like a landscape or a sheet.

A drawing is shown as its picture. A drawing that has no picture says **Not
drawn yet**.

## Search

**Search** in the top bar, or ⌘K, searches everything at once: elements by
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
another scope opens that scope there, read-only where your source is. ⌘F inside the editor remains the quick
finder when all you want is a box on the canvas.

## Diagram settings

Right-click a diagram tab, **Diagram settings…**.

- **On the drawing.** Author, client and date for the title block of a PNG
  export, each falling back to the project's default or the day of export when
  left empty, and whether to draw the title block at all.
- **Operational aspects.** The aspect columns applications on this diagram carry:
  add a standard one (platform, CI/CD, DR, security, monitoring, backup,
  compliance, cost), add your own, rename, reorder, or switch the badges off
  altogether. Renaming a column keeps every status already recorded against
  it.

## Saving, exporting, sharing

Two ways out, for two purposes.

- **The working file** (`.lvarch`, **File › Save a Copy of the Working
  File…**) is everything and is what you hand to someone who will edit
  further. It is your **whole organisation** in one file, **sealed under a
  password**: you are asked for one when you save the copy — twice, because
  a lost password cannot be recovered — and whoever opens the file is asked
  for it again. Nothing about what is inside can be read without it. It holds
  every scope, whichever screen you are on when you export — the
  organisation's home, a scope's home or an open board: a landscape on its
  own refers to applications defined a level up, and a file with only the
  landscape in it would open on someone else's machine full of names pointing
  at nothing. The file is named after your organisation. Working files from
  earlier versions still open, sealed or not, and one holding a single scope
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

## Working with an agent

Your coding agent — Claude Code, Codex, Cursor or any other MCP client — can
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
with ⌘Z, as before.

## Preferences

Grid, snapping, lifecycle badges, collapsed panels and their widths, the
minimap, the tidy settings, the language and the theme are remembered per
browser or per desktop install. They belong to you, not to the project: they
do not travel in a file. The same goes for what this machine does about a
folder — pull on open, push after a snapshot: the desktop keeps that with the
install, and writes nothing of its own into your folder.

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
| ⌘[ ⌘] on macOS, Alt+← Alt+→ elsewhere | Back, Forward, in the desktop app; in a browser, the browser's own |

On Windows and Linux, read Ctrl for ⌘.
