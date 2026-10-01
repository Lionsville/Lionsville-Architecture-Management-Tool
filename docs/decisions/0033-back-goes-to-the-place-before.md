# ADR-0033 — Back goes to the place before

* Status: accepted, 1 October 2026; not yet built
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
