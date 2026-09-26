# ADR-0027 — Looking at another day is not an edit

* Status: accepted
* Date: 2026-09-26
* Deciders: Wouter Simons
* Amends: ADR-0009 (time on the facts), its *A diagram carries `asOf` and
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
