# ADR-0027 — Looking at another day is not an edit

* Status: accepted; amended, 7 November 2026: a look is read-only, and a lens is
  the reader's until it is kept (*Amended*, below), as built the same day in the
  editor and on the screens; implemented, 7 November 2026 (4.0.0, not yet
  released); amended again, 8 November 2026: a board's first layout is nobody's
  step (*Amended, 8 November 2026*, below), implemented the same day, awaiting
  the owner's confirmation
* Date: 2026-09-26
* Deciders: Wouter Simons
* Supersedes: ADR-0009 (time on the facts), its *A diagram carries `asOf` and
  changing it is a command* and its accepted cost *`asOf` dirties the document*

## Context and Problem Statement

ADR-0009 put a day on a diagram, `asOf`, and made changing it an ordinary
undoable command with a coalesce key. It refused a second, temporary "peek"
mechanism on purpose: two ways to change what a diagram shows are two things
that can disagree. It accepted the price in writing — looking at next year and
looking away leaves an undo step behind — and named ⌘Z as the remedy.

That price was set for one person with one file. Since ADR-0022 a scope can
have more than one author, and every step goes to all of them. Looked at
there, the price is different:

* **Looking is a write everybody receives.** Moving the date control a few
  days is a step per day. Dragging the roadmap's scrubber across a year is a
  step for every day it passes — the slider answers each value it moves
  through, and the reducer answers a new model even for the same day, so each
  one is sent.
* **It moves everybody else's board.** `asOf` is the board's, so a colleague
  who had the same board open is now looking at 2028 because somebody else was
  curious about it.
* **It reads as work.** Each step is a line in everybody's Activity list and
  something the bar counts until it has been sent and answered — "changes" that
  nobody made on purpose, reported as if somebody had.
* **Readers could not look at all.** Changing the day was a write, so a reader
  was refused the control, although looking at a landscape on another day is
  the most read-only thing the tool offers.

The need ADR-0009 started from has not moved. A board that is *for* a day —
the landscape after a cutover, for a report that will be re-exported — has to
keep that day for everybody who opens it. What changed is that setting the day
a board is for and looking at a board on some day are two different acts, and
the tool treated them as one.

## Decision Drivers

* Looking around must never be a step: not on the stack, not in Activity, not
  on the wire.
* A board that is for a day still keeps it, for everybody, as content.
* A person must never mistake a day they are only looking at for the board's
  day, or the other way round.
* The bar's date control and the roadmap's scrubber must still be one
  mechanism, so they cannot disagree.

## Considered Options

1. **Keep ADR-0009.** Every look is an edit. Rejected for the reasons above.
2. **Make `asOf` a view state only.** No saved day at all; a board always
   opens on today. Rejected: it removes the future board ADR-0009 was written
   for, and *Duplicate as of…* with it.
3. **A look beside the saved day.** The board keeps `asOf` as content. What a
   person is looking at is held per board by the window, and the control says
   when the two differ. Saving is its own action.

## Decision Outcome

Option 3.

**A look, per board, held by the window.** `editor/useShownDays` holds, per
diagram id, the day a person is looking at where it is not the board's own. It
is never a command. The shell holds it where the roadmap's scrubber has to
move it too; an editor with no host holds its own. A look that arrives back at
the board's own day forgets itself. It lasts as long as the window, and a
reload opens every board on its saved day.

**What draws, draws the look.** The editor hands the canvas, the laid-out
pages, the colour overlay and the export title block the diagram with the
looked-at day on it. Every write is still built from the model's diagram, so a
look cannot leak into one. An exported PNG says the day on the screen, saved or
not, because the picture is of what was on the screen.

**Save is the write.** Under the date field, *Save {day} as this board's day*
— or *Save: this board shows today*, which clears a saved day — is the one
command, `diagram.update` with `asOf`, as before: undoable, one Activity line.
It is not offered to a reader. Looking is.

**The control says which it is.** The button still reads the day and still
highlights a dated board (ADR-0009's reason is unchanged). A day that is only
being looked at also gets a dashed outline, a tooltip that names both days,
and a line in the popover: *Only you see this day. Nothing is saved until you
save it.* *Back to {saved day}* returns to the board's own.

**The scrubber looks too.** `RoadmapActions.setAsOf` moves the same look as the
bar's control, and never writes. One mechanism, as ADR-0009 wanted — it is just
no longer the model.

**What stays.** `Diagram.asOf`, its command, *Duplicate as of…*, the agent's
`diagram.update` with `asOf`, the title block and every reader of a saved day
(the organisation page, the board chooser) are unchanged. The agent has no
window, so what it sets is always the saved day, as before.

### Consequences

* Good: moving through time costs nothing — no step, no line in anybody's
  Activity, nothing to send, nothing for a colleague to receive.
* Good: nobody's board moves because somebody else looked at another day.
* Good: a reader can look at any day.
* Bad, accepted: two days per board where there was one. The dashed outline,
  the tooltip and *Back to…* are what keep that from being two things that
  disagree without saying so.
* Bad, accepted: a look is lost on reload. That is what makes it a look.
* Neutral: boards whose `asOf` was set by looking around before this change
  keep that day, because it was saved. *Show today* and *Save* puts one back on
  the calendar.

## Amended, 7 November 2026 — reading changes nothing

The record left one thing open: *every write is still built from the model's
diagram*, so a look could not leak into a write, but a person could still edit while
looking. Picking a card on a board showing next year and renaming it renamed it
today, with nothing but a dashed outline to say so. That is the mistake the first
driver says a person must never make. And a *Colour by* wrote the view, so a person
reading a shared board marked it changed.

**A look is read-only.** While a board is shown on a day that is not its own
(`isLookingAway`), the editor's `readOnly` is true: the palette, the inspector's
fields, dragging, deleting, Tidy and routing are put away. One press, *Back to…*, is
the way back. **A view saved on its day stays editable**, because a look that
reaches the board's own day forgets itself: the way to work on a future is still a
board for that day (*Duplicate as of…*).

**What takes the day stays.** *Save*, undo and redo are about the look or about work
already done. Who holds a role is written on the day being looked at (*End on this
day*, an assignment's first and last day, a plan's move), so a unit's section and
the chart are handed whether the source may be written (`EditorParts.writable`),
and not `readOnly`. The agent has no window, so nothing here changes for it.

**A lens is the reader's.** `chooseColourBy` writes nothing: it is held per board by
the window, as a look is, and a reader may use it as before. *Keep with the view*,
offered to whoever may write while the lens differs from what the view keeps, is the
one write, as `diagram.update` with `colourBy`. A lens back on what the view keeps
stops being the reader's. The agent's `diagram.update` still sets it directly.

As built on the screens, the same day: the band names the day and says who sees it,
with **Back to today** or back to the view's own day and **Make this the view's day**,
which is the one write and has moved there from the control. Undo is off during a look,
and the band says so. An edge runs round the canvas (`data-look-edge`). The look is in
the address as `?day=` (`Destination.day`, a date or `today`), so a link and `app.open`
reach it; changing it replaces the entry, so Back does not walk through the days looked
at. A container diagram opened from a board takes that board's day along, and its way
back goes to that board (`useCarriedDay`).

### Consequences of the amendment

* Good: *read-only* now means it, and the band a screen draws for a look is true.
* Bad, accepted: to correct a typo seen while looking, a person goes back first.
* Bad, accepted: a lens is lost on reload unless kept, as a look is. One that used to
  stick by being chosen now has to be kept.
* As built, 7 November 2026: going down to a container diagram takes the board's day and remembers the board, also sideways to a neighbour's diagram, and Back returns to that board on its day with its selection. What it came from is held for as long as the window is open; the day is in the address.
* As built, 8 November 2026: only a move asked from the board carries the day (`useBoardDoors`). A container diagram reached another way, from its scope's home, an address or an agent, opens on its own day, and a day carried onto it earlier goes; a look the person took on it stays. A saved view's day is that view's alone.
* Neutral: the container view's deployment boxes still write when toggled. They are
  a setting of the view rather than a colouring of it, and have no *Keep* yet.

## Amended, 8 November 2026 — a board's first layout is nobody's step

A board a machine wrote — the example's, an import, a new container diagram — says
so with `needsLayout` and lays itself out the first time somebody who may write it
opens it (`editor/useAutoLayout`). That pass landed as the opener's step: ⌘Z took the
board back to a pile, the document said *Unsaved changes* and then *Saved*, and the
list said *Moved 33 elements* under the person's window. Opening a board is reading
it, and the amendment above says reading changes nothing a person did.

A sheet answers the same question the other way (ADR-0048 §1): it has no geometry
until somebody places a block, and its first layout is computed every time. A board
cannot: its places are its members' geometry, so the first card a person moved would
write one place on a board with none, and everybody else would read every other
card as unplaced. So **the first layout of a board is still written, and is nobody's
step**:

* **Never on the undo stack as the person's.** It stays on the stack, because it
  happened and the list says so, and ⌘Z passes over it as it passes over another
  author's step (`app/rebase.newestOwn`). It clears no redo.
* **Never the person's in Activity.** The line says *Laid out automatically* where
  an author would be, and a source that keeps a log of its own files it as nobody's
  (`SessionChange.unattended`).
* **Written quietly, and only that board.** Where the session's changes are written
  as steps, a change that is nothing but such a layout is written at once without the
  status moving: no *Unsaved changes*, no *Saving…*, no new *Saved* time. What is
  written is that board's step and nothing the scope says about itself; the view it
  opens on rides with the next save, as it did. A quiet write that is refused stops
  being quiet: the change becomes the person's to save, and the status says so.
* **Published where steps are published**, marked, so a server lays a board out
  once rather than at every open.

A reader still makes no step (`useReadingLayout`).

### Consequences of the second amendment

* Good: opening a board leaves the status, the undo stack and the list of the
  person's own work as they were.
* Bad, accepted: a board still changes on disk the first time it is opened, once,
  in its own files. Holding the layout in memory until the first real edit would
  avoid that and was set aside: the edit would have to carry every place with it,
  from wherever it came — a drag, a tool, an agent.
* Neutral: Tidy pressed by a person is a person's step, undone with ⌘Z, as before.
