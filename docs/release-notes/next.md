# Release notes, next version — draft

*What has landed on `main` since 3.3.1 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

**Back goes to the place you were before.** In a browser, Back used to leave
the app. It now goes back through the places you visited in it: a scope's home,
a board, the decisions, the roadmap, a report. Forward goes the other way, and
the moves an agent makes count as well. The address names the place you are on,
so a reload stays there and an address copied from the bar opens the same
place for anyone who may read it. In the desktop app the bar starts with Back
and Forward buttons, greyed out when there is nowhere to go, and a new **Go**
menu has both, on ⌘[ and ⌘] on macOS and Alt+← and Alt+→ on Windows and
Linux. The mouse's back and forward buttons work, and so does swiping between
pages on a Mac trackpad. Choosing another record on the decisions or the
observations page is not a step, and a place that has been removed since is
replaced by the nearest one that is still there. Back moves the screen and
changes nothing: ⌘Z is still how a change is undone.

**An agent opens the observations on a tab, and a view with something
selected.** An agent can open the observations page on its Register, Analysis
or Solutions tab, and a board, a sheet, a map or a technology landscape with one
thing selected on it, where that view draws it. Opening a view never makes one:
where a scope has no view of the kind asked for, the agent is told so and the
screen stays where it is. Whatever it opens is what you see, so a record's page
that was open over the board closes. The address names the observations tab that is up, so a
reload stays on it, and changing the tab is not a step for Back. *Make…* on a
home's card and **New board…** over its boards still make a new sheet, map or
landscape, as before.

**An agent that opens a home shows the home.** When the register or the
technology register was open over a home's cards, an agent asking for that
home left the page up over them. It now closes, as it does when Back goes to
the home, and a register an agent opened no longer comes back over the home
when you return to it from a scope.

**A view nobody has laid out yet is laid out for a reader too.** A view the
app or another tool made with no positions in it — a new container view, an
import, an example — is laid out the first time somebody opens it, and that
layout is saved as their step. Somebody who may only read the view got there
first and saw every box on one point, and fitting the view only zoomed in on
the pile, until somebody who may change it had opened it. Now the reader's
screen lays it out the same way, and nothing is saved: the first person who
may change the view still lays it out for everyone, and once they have, the
reader sees their layout.

**For a build composed from this one.** A source's provider may draw a button
of its own at the right end of the bar while its source is open (`barButton`);
offer the person an action on a problem the app ran into, drawn on the crash
screen and on the notice of a failure, a refusal or an unexpected error, and
handed the problem only when it is pressed — the app sends nothing itself
(`problemAction`, whose `available` may say it cannot be taken when the
problem happens, and then no button is drawn); and move the app saying the move is its own
(`open(to, { by: 'provider' })`), which its chrome is then told as
`movedBy: 'provider'`. A destination takes `tab` and `select`, and the screen
says the observations tab that is up. A view's page with no id that a provider
opens lands on the one of its kind there is, and on the scope's home, with
nothing over its cards, where there is none — an open never makes a view. A host may answer agent tools of its own
beside the app's (`RespondOptions.hostTools`). Two control names are new:
`cause.root` and `solution.move`.
