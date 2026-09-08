# ADR-0010 — A replacement as one gesture, and the interfaces as the plan

* Status: proposed
* Date: 2026-09-08
* Deciders: Wouter Simons

## Context and Problem Statement

ADR-0009 gave the landscape time and gave a plan a record, and the first
attempt to use it for the thing it was written for — replacing one
application with another — took a person through this:

1. Draw the new application on the canvas, by hand, beside the old one.
2. Open the old one's inspector. Set *Retiring from*, *Gone on*, *Replaced by*.
3. Open the new one's. Set *Live from*.
4. Open the roadmap, press *New plan*, type a name, set a window and an owner.
5. Discover that the plan names no elements and has no milestones, and that
   the page offers nowhere to add either. The file under `transitions/` is the
   only editor for what a plan touches, for its milestones, for the decisions
   it rests on, and for its body — which is where ADR-0009 put the business
   case.
6. For each of the fourteen lines on the old application, draw a twin to the
   new one, give the twin a *valid from*, and give the original a *valid
   until*. Twenty-eight date edits and fourteen new lines, one inspector at a
   time.

The model can say everything the person meant. Nothing helps them say it, and
the part that carries the actual work — *which interface moves when* — has no
representation at all beyond the lines themselves. The roadmap draws two
tracks and one empty band and reports that the old application retires with
fourteen connections still live, which is true, unhelpful, and the whole plan
in one sentence.

Three shapes of the same work turned up as soon as one was tried:

* **One for one.** An application replaced by a new one.
* **A split.** Part of an application becomes a new one; the rest stays. Over
  time some of its interfaces move to the new part and some do not.
* **A merge.** Several applications become one. Every interface of each of
  them moves to the one new one, on its own day.

All three have a **shadow run** — a period where old and new are both live
and data streams to both — and a **cutover**, the day the last interface has
moved and the old one can go. The shape ADR-0009 built for one for one,
`successorId` as a single field, says nothing about the other two.

## Decision Drivers

* **The interfaces are the plan.** A migration is not two dates on two boxes;
  it is a list of lines, each moving to a named new end on a day. Everything
  else — the shadow window, the cutover, whether the old one can retire — is
  derived from that list.
* **Dates stay on the facts** (ADR-0009, Q1). A plan names things; it does not
  own their dates. Whatever this record adds must leave the canvas able to
  draw a day without knowing plans exist.
* **One gesture, one undo step** (ADR-0002). Starting a replacement touches a
  dozen things. It is one thing that happened and must be one ⌘Z.
* **Start where the person is.** The old application's datasheet is where the
  question "what happens to this" is asked. The roadmap is where the answer
  is read. Neither is where it should be typed in the file.
* **Additive.** A project with no plans, and an element with a bare
  `successorId` set by hand, behave exactly as they do today.

## Considered Options

**Q1 — How does the model say "this interface moves to that new end on that day"?**

* A. **Twin lines, windowed.** A ported interface is a second connection to
  the new end with `validFrom`, and the original gets `validUntil` the day
  before. Nothing new in the model; the plan *derives* the port list by
  matching a line of a retiring element to a line of an introduced one with
  the same counterpart, direction and protocol.
* B. A `movesTo: { elementId, on }` field on the connection: one line, whose
  end changes on a day.
* C. The plan owns a port table: `{ connectionId, toElementId, on }` rows in
  the record, and the canvas consults it.

**Q2 — What names the replacement, so a split and a merge can be said?**

* A. Keep `successorId` as it is and add `successorIds`.
* B. **The plan's `introduces` and `retires` lists are the mapping**, and
  `successorId` stays as the one-for-one shorthand the checks already read,
  now satisfied either way.
* C. A `replaces` relation as a connection kind.

**Q3 — Where does a person start?**

* A. The roadmap's *New plan*, grown a wizard.
* B. **A *Replace…* action on the application** — in its inspector under
  *Replaced by*, and so on its datasheet, which renders the same inspector —
  that creates the new element(s), the plan and the dates in one transaction.
* C. Drag the new box onto the old one on the canvas.

**Q4 — Where is a plan edited?**

* A. The right-hand panel of the roadmap, grown fields.
* B. **A page of its own**, the sibling of the decision page: fields, the
  interface table, milestones, the decisions it rests on, and the body in the
  markdown editor with the business case rendering beside it. The roadmap's
  band opens it; the datasheet's *Plans* section opens it.

## Decision Outcome

### Q1: A, twin lines — with one derived table over them

A moved interface is two lines with windows that meet. That is the truth the
canvas already draws and the interchange already carries, and it needs no new
field. The cost is that the *list* — which interfaces have moved, which have
not, and to which new end — is not stored anywhere, so it is computed:

```ts
// model/porting.ts — pure, node-tested
export type Port = {
  /** The line on the retiring end. */
  from: DesignConnection
  /** Its twin on an introduced end, when there is one. */
  to?: DesignConnection
  /** The day the twin starts; absent means not yet planned. */
  on?: string
}
export function portsOf(model, plan): Port[]
```

A line of a retiring element is matched to a line of an introduced element by
**counterpart, direction and protocol**. That is deliberately loose about the
label, because a label is prose, and deliberately strict about the protocol,
because a line that changes protocol when it moves is a new interface and
should read as one.

Writing a port is one transaction: add the twin with `validFrom: on`, set
`validUntil` on the original to the day before, and — when the original was
drawn on a diagram — place the twin on the same diagram, routed from the same
end. Un-porting is the inverse. Both are commands the plan page and the agent
dispatch; neither is a new command type.

B was seriously considered and is the better model in the abstract: one line,
one end that moves. It fails at the file boundary: the interchange has no
concept of an end that moves, so every other tool would read the line as
attached to one end forever, and a diagram *as of* last year would have to
be drawn from a field the format cannot carry. Two windowed lines say the
same thing in vocabulary every reader already has. C puts the
truth in the plan, which is where ADR-0009 said the truth must not be: delete
the plan and the landscape would change.

### Q2: B, the plan is the mapping

`elements: [{ elementId, role }]` with `introduces` and `retires` already
says "these go, these arrive". A one-for-one plan retires one and introduces
one; a split retires none and introduces one while listing the source as
`changes`; a merge retires several and introduces one. The port table says
which line goes where, so no `successorIds` array is needed and none is added.

`successorId` stays: it is the cheap way to say "replaced by" without a plan,
the checks read it, and the *Replace…* gesture sets it when there is exactly
one introduced element. `successorMissing` is satisfied by either — a
`successorId`, or a plan that retires the element and introduces at least one
other — so a merge does not raise it three times.

### Q3: B, *Replace…* on the application

Under *Replaced by* in the inspector, and therefore on the datasheet:

> **Replace…**
> Replaced by: ○ a new application, named ____ · ○ an existing one: [pick]
> Shape: ○ this one goes · ○ part of it moves (this one stays)
> Shadow run from: [date] · Cutover: [date]
> Also retiring into it: [pick more, for a merge]

One transaction:

* The new element, if new — same kind, same zone, same domain group, drawn
  beside the original on every diagram the original is on (`placeNextTo`,
  which exists), `lifecycle: planned`, `lifecycleDates.live` = shadow start.
* On each retiring element: `retiring` = shadow start, `retired` = cutover,
  `successorId` when there is exactly one introduced element.
* The **tap**: one line from each retiring element to the new one, labelled
  from a string key, `validFrom` = shadow start, `validUntil` = cutover. During
  the shadow run the interfaces still terminate on the old application; the
  new one sees the same data by tapping the old, not by being connected to
  anything itself. That is why the tap runs old → new, why it is one line
  rather than a twin per interface, and why it ends on cutover whatever the
  port table says: by then the last interface has moved and there is nothing
  left to tap. This is the one temporary line ADR-0009 described.
* The plan: `TR-n`, titled from a string key with the names filled in,
  `retires`/`introduces`/`changes` as chosen, window = shadow start to cutover,
  milestones *Shadow run starts* and *Cutover*, body from the template with an
  empty ```business-case fence.
* Nothing ported yet. The port table opens with every line of the retiring
  elements listed as *not yet planned*. That is correct: which interface moves
  when is the work, and this gesture does not pretend to know it.

The toast names the plan and offers to open it.

### Q4: B, a plan page

`roadmap/ui/PlanPage.tsx`, fullscreen, `windowChrome` like the others. Top to
bottom:

1. **Fields.** Number, title, status, window, owner. The window's two fields
   are labelled *From* and *To* — the roadmap panel currently labels them
   *to* and *no end date*, which is a bug in how the label is derived and is
   fixed with this.
2. **What it changes.** The elements, with their role, an element picker to
   add one, and — beside each retiring or introduced element — its three
   lifecycle dates, editable *here*, written to the element. This is what
   "help set the right dates on both blocks" means: the dates are the
   elements', but the plan page is where they are set together, and the shift
   transaction already treats them as the plan's to move.
3. **Interfaces.** The port table: one row per line on a retiring element —
   counterpart, direction, protocol — with *moves to* (an introduced element,
   preselected when there is one) and *on* (a date). *Port all remaining on
   cutover* fills the blanks in one step. A row whose date has passed reads as
   done; the table doubles as the status of the migration without a status
   field anywhere.
4. **Milestones.** Editable list; the two the gesture wrote and any added.
5. **Decisions it rests on.** A picker over the project's records.
6. **The body.** `MarkdownField`, the same editor the documentation page uses,
   with the business-case block rendering in the preview. The template's
   empty fence is where the money goes, as ADR-0009 decided.

The roadmap keeps its axis and loses its side panel: clicking a band opens
the page. The plan's band gains the shadow run as a hatched stretch between
its two milestones and a small count, *9 of 14 interfaces ported*, derived
from the table.

### What the canvas shows

Nothing new is stored for it. *As of* a day before the shadow run, the new
element is `planned` and the tap is not drawn. During it, both are
live, the tap is drawn old → new, and each interface is on whichever end its
port date says — on the old one until its day, so the early shadow run reads
as "everything still lands here, and the new one listens". After cutover, the old one is `retired` — dimmed or hidden by the
existing toggle — and every line is on the new one. The only addition is a
**replaces** mark: when both ends of a `successorId` are on the board, a
dashed arrow from old to new, under the lifecycle toggle with the badges, so
a board with the toggle off looks exactly as it does today.

### The datasheet

A **Plans** section under the header table: the plans that touch this element
(`transitionsForElement`, which exists), each a link to its page, and the
*Replace…* button when none retires it yet.

### The agent

`plan.replace` with the gesture's inputs, `plan.port` with a connection, a
target and a day, and `plans.list` gaining the port table per plan. Each is
the same transaction the buttons dispatch, so an agent asked to "plan the
move of these three interfaces to the new one in March" does three undoable
steps a person can read in Activity.

## Consequences

### Good

* **The scenario is three inputs.** Which application, what replaces it, and
  two dates. Everything the person would have typed fourteen times is derived
  or written for them, and the one thing that is genuinely their work — the
  port schedule — has a table.
* **Split and merge cost nothing extra.** They are counts on the same lists
  and the same table.
* **The plan page is the document ADR-0009 promised**, with the business case
  in it, edited where it is read.
* **The model does not change.** No new field on element, connection or plan;
  `porting.ts` is arithmetic over what is there. A project written before this
  record is read unchanged.

### Bad, and accepted

* **Deriving the port table is a heuristic.** Counterpart, direction and
  protocol identify a line well enough in practice and not perfectly; two
  lines to the same counterpart with the same protocol and different labels
  will be matched to each other's twins interchangeably. The table shows
  what it matched, and a wrong match is corrected by editing the twin.
* **Twins are two lines forever.** After cutover the original stays in the
  file with its `validUntil`, dimmed with its dead end. That is what history
  on the facts looks like, and deleting it is a normal delete when the
  landscape no longer needs to draw last year.
* **The gesture writes a lot.** One undo step, but a long Activity line and a
  large diff at the next snapshot. That is the honest size of starting a
  migration.

## What this takes, in order

1. **The plan page**, over the fields that exist, with the label fix and the
   body editor. Nothing derived yet. The roadmap's panel becomes a link.
2. **`porting.ts`** and its table on the page, with *port all remaining*.
3. **The *Replace…* gesture**, its transaction, its strings, and the datasheet
   section.
4. **The canvas mark** and the band's hatched shadow run and count.
5. **The agent tools**, the Acme example given one replacement, and the docs.

## Open questions

* **Should a port move the line's placement, or draw the twin fresh?** The twin
  on the same diagram from the same end is the recommendation; a route copied
  from the original would look right for a day and wrong after a tidy.
* **Does a split need the original's `changes` row at all?** It is what puts
  the original on the plan's band. *Recommended: yes, and the gesture writes
  it.*
* **Is the tap always wanted?** A merge of three into one may want three
  taps or none. *Recommended: written by default, deletable, and a
  checkbox on the gesture is a follow-up if people keep deleting it.*
