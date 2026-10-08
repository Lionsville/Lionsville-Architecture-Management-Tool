# ADR-0033 — Back goes to the place before

* Status: accepted, 1 October 2026; as built, 1 October 2026; amended 1 October
  2026 (a place on the observations page carries its tab); implemented,
  1 October 2026; amended 8 October 2026 (a link to a place, shared from the
  menu), accepted and built
* Date: 2026-10-01
* Deciders: Wouter Simons
* Extends: ADR-0019 (the screen an agent reads and the destination it opens:
  a place in the history is that screen, and the address is written from that
  destination, as its vocabulary was made for)

## Context and Problem Statement

The app moves a lot: from a home to a scope, from a view to its decisions,
from a finding to a platform's report, from a record in the register to the
scope that answers for it, and since ADR-0019 wherever an agent takes it.
None of those moves can be undone. Going back to where you were means
remembering where that was and walking there again through the tree and the
tabs.

The two builds fail in different ways:

* **In a browser, Back leaves the app.** The page never tells the browser it
  moved, so the history holds one entry, and Back goes to whatever page was
  open before the app. A person who uses Back the way every other web page
  taught them loses the app.
* **On the desktop there is no Back at all.** The window has no browser bar.
  There is no button and no shortcut, and the mouse's back button and the
  trackpad's swipe do nothing.

There is one thing that looks like Back and is not. *Restore this version…*
on the history page puts back an earlier version of a scope. It is a write,
and it stays what it is.

## Decision Drivers

* Back must go where the person was, and to nothing else. It does not undo.
  ⌘Z undoes a step in the model, Back moves the screen, and the two never
  share a stack.
* One history and one set of rules for both builds, so Back cannot mean one
  thing in a browser and another on the desktop.
* No control the browser already gives. A web page that draws its own Back
  beside the browser's has two, and they disagree as soon as one of them is
  wrong.
* A place is something the app already knows how to say and how to open.
  The history must not invent a third vocabulary beside the screen and the
  destination (ADR-0019).
* A move made by an agent is a move the person may want to go back from.

## Considered Options

1. **A history of the app's own, held in memory, with a button in both
   builds.** It works the same everywhere. But in a browser it leaves the
   browser's Back leaving the app, and puts a second Back on the page.
2. **The window's own history, a place in each entry's state and the address
   left alone.** The browser's Back works, and the desktop's button is
   `history.back()`. But a reload forgets the place, and an address copied
   from the bar says nothing about where it was copied.
3. **The window's own history, with the place in each entry's state and in
   the address's fragment.** As option 2, and a reload lands where the person
   was. The fragment never leaves the browser: it is not sent to the server,
   so the names of scopes do not reach any log on the way.

## Decision Outcome

**Option 3.**

### A place

**A place is what `app.current` says** (`agent/screen.ts`, `Screen`): the
scope that is open and its view, or the page over it; or, with nothing open,
whose home is up and the page on it. Nothing else is part of one:

* not the element selected on a canvas,
* not the day a board is being looked at on (ADR-0027),
* not an open dialog,
* not a filter, a scroll position or a panel's width.

A place is written as a `Destination`, the three words `app.open` takes:
a scope, a page and an id. One function pair beside `Destination` writes a
place into an address and reads it back, and a round trip through it is a
test.

### What is a step

**Every move to a different place is a step.** The shell already looks at
the screen after every move, whoever made it (`useShellAgent`'s
`lookAgain`). Where that look finds a different place, the place is pushed
onto the window's history (`history.pushState`), with the place in the
entry's state and in the address's fragment.

* **Another record on the same record page replaces the entry.** A step is
  not pushed for it. On the decisions page and the observations page, moving
  from one record to the next in the list is choosing, not going somewhere,
  and a Back that walks through every record looked at would be useless. The
  address still names the record on screen, so a reload stays on it. Opening
  a record page on a record from anywhere else is a step.
* **A move made by Back, by Forward or by a reload is not a step.** It is the
  history moving, and pushing it again would undo the move. The shell marks
  such a move before it makes it, the way it marks a move by an agent.
* **An agent's move is a step**, like a person's. A person who watched an
  agent open a scope can press Back to return to their own work. Pressing
  Back while an agent is driving is the person's move. It does not stop the
  agent, and the agent's next `app.current` reports it.

### Going back

**The window's `popstate` opens the place in the entry**, through the shell's
own way of opening a destination (`openFor`), the way `app.open` is answered.
Back leaves a scope exactly as clicking another one in the tree does, and asks
nothing that move does not ask.

**A place that is not there any more lands as near to it as there is.** The
history cannot skip an entry, so the app does not try:

* a view that was removed opens its scope on the scope's first view,
* a record that was removed opens its page without one,
* a scope that was removed opens the home of the nearest scope above it that
  is still there.

**A dialog belongs to the page it was opened on.** Back with a dialog open
moves the page beneath it, and the dialog closes as it does when the page is
left by any other way. On the desktop, the Back and Forward controls are
behind the dialog, and their keys are not taken while one is open.

### The address

**At boot, a place in the fragment is where the app lands.** It is read once
the source is open, after a source's own reading of the address
(`SourceConnect.fromLocation`). It comes before the last place this machine
worked from (`resume`). A place in the fragment that the person may not read
lands where a refused open lands now. A fragment that is not a place is left
alone, since a source may have a use for it.

The address carries only a place. It never carries a dialog (`bootLanding`
already takes the one it may ask for out of the address), a selection or a
look at another day.

### On the desktop

**The bar draws Back and Forward**, at the start, after any space the window
controls take. They are greyed out when there is nowhere to go, as read from
the window's Navigation API (`navigation.canGoBack`,
`navigation.canGoForward`), and pressing one is `history.back()` or
`history.forward()`. The host says the bar should draw them, in
`WindowChrome`, beside the other things the window asks of the bar. The web
build's host never says so.

**The other ways in are the ones every desktop app has:**

* *Back* and *Forward* in a *Go* menu,
* ⌘[ and ⌘] on macOS,
* Alt+← and Alt+→ elsewhere,
* the mouse's back and forward buttons,
* the trackpad's swipe.

Each of them goes through the same history as the bar's buttons.

### In a browser

**Nothing is drawn.** The browser's Back and Forward, its keys and its
gestures do the whole job, because they move the same history.

### What is deliberately not done

* **No list of where you have been.** The browser keeps one behind a long
  press on its Back, and the desktop does without one until somebody misses
  it.
* **No Back for an agent.** An agent knows where it was and has `app.open`.
  A tool that moves a person's history behind their back would be a second
  way to move the screen for no gain.
* **No step for a look.** A place never holds a day being looked at, so
  moving through time stays free (ADR-0027).

### Consequences

* Good: the browser's Back stays in the app and goes where the person was.
* Good: the desktop gets a Back that people find, and the keys, buttons and
  gestures they already use for it.
* Good: one history and one set of rules for both builds. The desktop's
  button is the browser's Back, pressed from inside the page.
* Good: a reload in a browser stays where the person was, and an address
  copied from the bar opens the same place for anybody who may read it.
* Good: no new vocabulary. A place is the screen ADR-0019 gave the agent, and
  its address is written from the destination ADR-0019 gave `app.open`.
* Bad, accepted: two controls on a bar that is already full, on the desktop
  only.
* Bad, accepted: the history is the window's. It is gone when the window
  closes, as a browser tab's history is. A reload in a browser keeps it; on
  the desktop a reload starts it again.
* Bad, accepted: a dialog with typed text in it is closed by Back, as a form
  on any web page is left by Back.
* Neutral: Back lands near a place that was removed rather than on it, and
  says nothing about the difference. What was removed is in the Activity
  list.

### Confirmation

* The place function pair: every `Destination` written and read back is the
  same destination, and a fragment that is not a place reads as nothing.
* The shell: a move to another place pushes one entry; another record on the
  same record page replaces it; a move by `popstate` pushes nothing; an
  agent's move pushes one entry.
* Back to a removed view, record and scope lands as above.
* The bar: Back and Forward are drawn only when the host's `WindowChrome`
  asks for them, and are greyed out at either end of the history.
* The desktop's smoke run: Back after opening a scope from a home returns to
  that home.

## As built, 1 October 2026

Every part was built, in core, on one branch that has not been released.
What follows is where it was built, and where the build departed from the
text above and why.

### A place

`agent/place.ts`. A place is a `Destination` with its scope said, and its
address is a fixed prefix and a query string in the fragment:
`#place?scope=acme%2Frail&page=board&id=landscape`, the organisation's scope
written as the empty one. The prefix is what tells a place from a fragment a
source wrote, and `readPlace` is strict for the same reason: a key it does not
know, a key said twice, no scope or a page there is no such thing as is not a
place. `readPlace`, `writePlace` and `PLACE_PREFIX` are exported for a source
that reads the address too. In an entry's state the place is kept under
`lvarch.place`, beside whatever else the entry holds. `placeOf` is the place a
screen is; a scope whose workspace has not said what is on it yet is no place
at all.

### What is a step

As decided, in `app/placeHistory.ts`, with one addition: **a move is written
once it has settled**, 150 ms after the last look that found a different
place. One move is often several looks — a scope chosen and then its workspace
up, a home and then the register over it, a page and then the record it lands
on — and a Back that went to one of those in between would go nowhere anybody
was. The look is taken on every move whether or not a provider's chrome
watches the screen; what `watchScreen` still saves is the render.

A move made by Back or Forward is marked before it is made and stays marked
until the app has landed somewhere other than where Back was pressed, or ten
seconds have passed. The entry the window opened on is replaced, not pushed,
and keeps a fragment that is not a place: the place is then in its state
alone.

### Going back

As decided, through `openFor`. Where a place lands is worked out first
(`app/placeLanding.ts`, over `nearestPlace`), from the listing the shell holds
and the scope's own document — the open session's for the scope that is open —
and the entry is written over with where it landed, so a reload goes there
too. Departures:
- **A removed record on the decisions or the observations page** opens that
  page without one, and the page then shows what it shows when it is opened
  with no record asked for. The entry is written over with that.
- **A removed plan** opens the roadmap; a removed platform's or service's
  report, which has no page without its record, opens the scope's first view.
- **A scope that cannot be read** while Back is worked out lands as a removed
  one does, on the nearest home above it, and is said on the trail.
- **Dialogs.** A dialog the workspace or a page opened goes with the page, as
  decided. The window's own two, *Preferences* and *Connect an agent*, belong
  to no page and stay open over a browser's Back.

### The address

As decided, in `app/bootLanding.ts` (`bootDecidedBy`, `placeLanding`,
`landedAt`) and the boot in `main.tsx`. A place in the fragment wins over a
source's own landing as well as over the last scope: the history leaves the
query alone, so after a move and a reload the address carries both, and the
query is only the link the person arrived by. A place that names a scope that
is not there, or that cannot be read, lands on the organisation's home — at
boot there is no listing yet to find the nearest scope above it.

### On the desktop

As decided. `WindowChrome.backForward`, set by `windowChromeFor` on every
desktop platform; `app/BackForward.tsx` draws the two at the start of the
workspace's bar and of every home's, greyed out as the Navigation API says and
both pressable where there is none. The *Go* menu is `platform/menu.ts`'s
`goMenu`, after View; its keys are its accelerators and nothing else, because
on macOS a menu accelerator fires whether or not the page handled the key. The
two commands are answered at the shell, so they work with nothing open. The
mouse's buttons are read in the page (buttons 3 and 4), on every platform,
rather than from Windows' `app-command`, which would have been a second Back
for the same press; the swipe is `BrowserWindow`'s, a swipe to the left being
Back. While a dialog is open — one with the `dialog` role that nothing has
hidden — none of these is taken. The smoke run presses Back after the
example's landscape was opened from a home, and Forward again.

## Amended — a place on the observations page carries its tab

*1 October 2026.* The screen says which tab of the observations page is up
(ADR-0019, amended), and a place is what the screen says, so a place on that
page carries it: `tab`, one of `register`, `analysis` and `solutions`, beside
the scope, the page and the id — in the address
(`#place?scope=acme&page=observations&tab=analysis`), in an entry's state, and
in what makes two places the same. A reload stays on the tab, and `readPlace`
refuses a tab that is not one of the three as it refuses a page there is no
such thing as. A change of tab on the page that is up replaces the entry, as
another record on the same page does: choosing where to look on a page is not
going somewhere. A removed record on the page keeps its tab. Nothing else is
part of a place: an element selected as a destination opens (`select`) is a
selection, and stays out of it. `place.test.ts` and `bootLanding.test.ts` pin
it.

## Amended — a link to a place, shared from the menu

*8 October 2026; accepted and built the same day.* The record said an address
copied from the bar opens the same place for anybody who may read it. That
holds in a browser, and nowhere else: the desktop has no bar to copy from, and
a person in a browser has to know that the bar is the thing to copy. So
sharing a place is a command.

**What it is.** *Share with a Link…* in the File menu, on both hosts — the
desktop's menu bar and the web's overflow — answered by the shell, so it works
on every home with nothing open as well as over a scope. It makes the link,
copies it through `HostControls.copyText`, and says *Link copied* only once
the copy has resolved; a refused copy is said as such and put on the trail.
The same press shows the link in a small dialog, in a read-only field, so it
can be read, selected and copied again. No accelerator: the chord a reader
would guess, ⌘⇧L, is a macOS service's, and a menu key fires on macOS whether
or not the page handled it.

**What a link is.** Two halves, each said by whoever knows it. *Where* is the
open source's: `ProviderParts.shareAddress()` (ADR-0022's parts), the address
somebody else who may read the same work reaches it at, or `undefined` for
*not now*. *What is there* is this record's: the place the screen is, written
as the fragment the boot already reads (`linkTo` beside `writePlace` in
`agent/place.ts`). So the receiver lands where a reload would have landed the
sender, through the same reading of the address, and nothing new is read at
the other end. A fragment the address had is dropped, and its path and query
are kept as the provider said them.

**The record is in the place already.** A shared link from a record page has
to open the record, and it does without a change here: the screen names the
record the decisions page and the observations page show — the one the person
moved to, once the page has landed on it — and the observations page's tab, so
the place does too. Choosing another record still replaces the entry rather
than pushing one, as decided above; the link is written from the place, not
from the history. `App.share.test.tsx` pins both: a record chosen by a click
is in the link, and the click pushed no entry.

**Where there is no address.** A folder, this browser's storage and memory
give none — nobody else reaches them at an address — and none of core's three
registrations says one. The item is not hidden or greyed out there: the dialog
says why there is no link and nothing is copied, as *Connect an Agent…* says in
a tab why there is no agent. A screen that is not a place yet — a scope whose
workspace has not said what is on it — is said the same way. The address is
asked first, so a folder is never told *try again in a moment*.

**What is deliberately not done.** No selection on a board, no day being
looked at and no dialog in a link: a link is a place, and a place holds none of
them. No link of the app's own making that a provider did not give an address
for: a guess at an address would be a link that opens somebody else's work, or
nothing.

