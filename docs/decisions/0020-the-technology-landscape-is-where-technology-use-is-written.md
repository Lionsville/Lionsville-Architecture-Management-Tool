# ADR-0020 — The technology landscape is where technology use is written

* Status: accepted
* Date: 2026-09-20
* Deciders: Wouter Simons
* Amends: ADR-0015 §2 (hosting was a line only on request; the landscape
  drew and was not written on; the offerings drawn were this scope's own)
  and ADR-0017 §4 (the *Uses* picker it left open)

## Context and Problem Statement

ADR-0014 gave an application three sentences about technology: *hosted on*
a place, *uses* an offering, *uses* a platform where a team binds to one
instance. ADR-0015 drew the layer: three bands, every line a row, no lines
at rest. ADR-0017 let *Hosted on* name a platform another scope defines,
and derived the offering a hosting implies.

Tried on a real landscape with platforms and no offerings, two things were
wrong at once.

**The picture was empty for the commonest sentence.** An application that
only says where it runs — a spreadsheet on a hosted office suite, a portal
on a cluster — drew nothing: the hosting line hid behind a checkbox that
was off, and the design had assumed an implied offering would carry the
line. On a scope that authors no offerings there is no offering to imply,
so the layer's one view showed a row of cards and a row of platforms with
nothing between them.

**A person could not write a `uses` row at all.** The board's connect
gesture writes a flow, and only a flow, which is right (ADR-0013). The
inspector had a picker for *Hosted on* and none for *Uses*. The landscape
had no write gesture beyond its plus buttons. The only writer of the row
the whole layer turns on was the agent, through `relation.add`. And a
scope could not lean on an offering another scope marks *shared* until
somebody had dropped a stand-in of it onto a board by hand — the library
lists the tree's technology, but a service chosen from a picker was never
offered the *Elsewhere* list the platform picker had, which ADR-0017
noted and left open.

## Decision Drivers

* The board's rule stands. **Only a flow is a line on a canvas.** Eleven
  applications on one cluster are eleven rows and no lines, and a `uses`
  drawn as a canvas line would be the second thing on a board that means
  something other than an interface.
* The sentence an application has must be visible where the layer is
  drawn — on a scope with no offerings as much as on the platform scope.
* One write, one step, one undo, wherever it starts. What the inspector's
  picker writes, what a drop on the page writes and what the agent writes
  must be the same transaction, so there is one behaviour to learn and one
  Activity line to read.
* A shared offering is offered in order to be used. Using it must not
  need a board, and must not need a person to know what a stand-in is.

## Considered Options

1. **Draw `uses` and `hostedOn` on the boards**, as typed lines beside the
   flows. Rejected, again: it breaks the one rule the boards have, and it
   does not scale on a landscape where every application stands on the same
   three things.
2. **Put `platformService` on the board palettes** and connect to it on the
   canvas. Rejected for the same reason: the row would be a line.
3. **Make the technology landscape the place where technology use is
   written.** Its lines are rows already. Chosen.

## Decision Outcome

Option 3.

### 1. Hosting is a line at rest, folded on request

A `hostedOn` row is drawn like every other row. The view's option inverts
its meaning and is renamed so no caller keeps the old reading by accident:
*Fold hosting into service lines*, off by default, drops a hosting line
only where a `uses`, an implied use or a leverage from the same
application already reaches the same platform. An application that says
only where it runs has its one line; an application that says more has
the option of one line fewer. What a card touches follows, because it is
read from the edges.

### 2. The shared row

Every offering the index marks *shared* that this scope does not answer
for joins the landscape's services after this scope's own, with the scope
that answers for it and what realises it there — handed to the pure model
the way the rows from elsewhere are, off one index read and never a load
per scope. The page draws them as a row inside the services band, on by
default, dimmed until something in this scope uses one, and marked once a
stand-in is held here. A scope that authors no offerings and shows no
shared ones folds the band to a strip, and the layer degrades honestly to
one level.

### 3. One write gesture, and the same picker everywhere

The inspector gains **Uses** beside *Hosted on*: the rows as removable
pills, and a searchable multi-select over this scope's offerings and
service platforms first, then *Elsewhere in the organisation* — every
shared offering and every service platform the index knows, each with its
scope. Ticking several and closing writes one step; a tick on something
from elsewhere writes its stand-in in that step, as *Hosted on* does. The
action is `setUses`: an application's or a container's rows made equal to
a list, rows written and taken off, a kept row left as it was, refusals
answered as a value. The same inspector is docked on the landscape
(ADR-0016), so selecting an application there edits it with no second
panel.

The landscape has one gesture of its own: an application card dragged onto
a card in the lower bands. The row follows the target — a place takes
`hostedOn`, a service platform or an offering takes `uses`, a shared
offering brings its stand-in — and while an application is selected every
target shows the matching small button, which is the keyboard and touch
path. The page calls the editor's own actions through the page slot and
builds no command itself; a drop that would say what is already said is
said in a toast rather than written twice.

### 4. The door, and the reverse question

The record's derived *Leverages* line gains a door: *Show on technology
landscape* opens the scope's landscape — the first, made where there is
none — with the card selected and its lines up. The board keeps drawing
flows only; the picture of what an application stands on is one click
away rather than drawn where it does not belong.

The board's overlay gains a third question, the one ADR-0015 listed and
deferred: **one platform or offering**. Every application that uses it, is
hosted on it or on anything filed under it, binds to it, or leverages it
through a service it uses is coloured, and the rest fade. Not *what does
this card stand on* but *who stands on this*, which is how a migration
opens. The view keeps one string for it, `one:<id>`.

### 5. The agent

`technology.use` is `setUses` said to an agent: the targets as one list,
the same transaction, the same stand-in for a target another scope
defines, refused with the writer's own key for a wrong end. `element.
describe` answers `uses` — the rows as written — apart from `leverages`,
so a client can tell what was said from what was computed.
`diagram.inspect` on a landscape reports the shared row and the edges at
the page's new rest.

### 6. Why the landscape is the exception

A canvas line is geometry: a person places it, routes it, pins it, and it
is stored. A landscape line is a fact: nothing on the page is dragged or
stored, every line is read from the rows each time and is gone with the
row. Drawing `uses` on a board would make a row look like a placed thing;
drawing it on the landscape makes it look like what it is. So the board
keeps *only a flow is a line*, and the landscape draws four kinds of row —
and is now where three of them are written.

## Consequences

* `LandscapeView.hosting` is `foldHosting`; `TechnologyLandscapeOptions.
  sharedElsewhere`; `where` and `standIn` on a landscape service;
  `counts.shared`. `EditorActions.setUses`; `PageView.onHost` and
  `onUse`; `EditorDiagrams.onOpenTechnologyFor`; `shared` and
  `realisedBy` on the ownership seam's technology entries; `focus` on the
  page and `showOn` on its hook. `ColourBy` takes `one:<id>`, and a band
  may be `faded`. `technology.use`; `uses` on `element.describe`; `where`
  and `standIn` on the landscape report's services. One Activity line,
  `activity.usesSet`, for the step wherever it starts.
* On a scope with places and no offerings the landscape draws what its
  applications say. On any scope the platform team's offerings can be
  leaned on without a board.
* `platformService` left the board palettes and the *Change kind* menu: an
  offering is authored where the layer is drawn. A board that already
  holds one keeps drawing it, and the library still draws a stand-in of
  one from the register.
* Open, carried from ADR-0017: whether the service report should count
  implied consumers. Open from ADR-0015: multi-select of two services for
  the migration question, and a matrix report behind the view.
