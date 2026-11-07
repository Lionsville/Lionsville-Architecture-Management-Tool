# ADR-0048 — A sheet can be placed, and read as a poster

* Status: accepted, 7 November 2026; not yet built; as built, 7 November 2026, the
  model, the format and the agent's tools (4.0.0, not yet released)
* Date: 2026-11-07
* Deciders: Wouter Simons
* Supersedes: ADR-0012 §6, in part (a sheet is computed unless it has a geometry;
  *nothing drags* no longer holds for one)
* Extends: ADR-0036 (a unit named on a tile), ADR-0040 (placing and labelling tools),
  ADR-0019 (a sheet's placing is no see-tier call there) and ADR-0045 (the zoom floor
  is per canvas, and new tokens)

ADR-0016 and ADR-0015 §5 stand: a laid-out view is still a tab, now drawn on a
zoomable canvas for a sheet. So does ADR-0027: placing is a write, refused while
looking at another day. And ADR-0046: a poster is one more place a scale colours.

## Context and Problem Statement

A business sheet is laid out by the tree each time, in reading order and in a list
of names. That is right for finding a function and wrong for the one thing a sheet
is also for: a single page, on a wall or a screen, that a room can take in at once
and that somebody arranged so it says what they mean. To arrange one today a person
leaves the product. And a page laid out afresh every time cannot be made to mean
anything by where things are on it.

## Decision Drivers

* A person arranges the page; the model's facts stay where they are.
* An existing sheet reads as it did, and opening one writes nothing.
* What an agent can do with a sheet does not depend on a screen.
* Every tile stays in the document, or Find, the keyboard, a print and a screen
  reader lose what is off screen.
* A place is a view's, and a fact is the model's. Neither may turn into the other.

## Considered Options

1. **Places per view, kept in the view's geometry, with a layout that is arithmetic
   until somebody places a block.**
2. **A new kind of view beside the sheet.** Rejected: two views over one tree with
   two sets of tools, and every sheet would have to be made again to be arranged.
3. **Members on a sheet, as on a board.** Rejected: a member row is a second place
   to keep what the trees say, and a board would draw it (ADR-0012 §6).
4. **Each tile a node on the board's canvas.** Rejected: it has no lines to route,
   and it virtualises large views, which is the loss the fourth driver names.

## Decision Outcome

Option 1. The view stays `kind: 'sheet'`. On screen and in the code the words are
*sheet*, the view, and *poster*, this reading of it. `isLaidOutKind` and
`canPlaceKind` do not change: a sheet has no members.

### 1. Places

`Geometry.nodes` on a sheet are its blocks, an area and the journey, by element id,
each `x y width height`. The stakeholder column has no element, so it keeps its place
in `Geometry.groups` under the id `rail`. `Geometry.cells` are the tiles placed by hand
inside their block, the exceptions only; the rest flow. All in units, which are CSS
pixels at 100%, at every zoom and in no relation to the window.

A sheet with no geometry is drawn by its first layout, computed each time, so it goes
on following the model. Nothing settles it on open, and `needsLayout` is never set on
one: a reader would make a step in everybody's Activity. The first block placed writes
every block as one step, and from then on the places are the view's. *First layout*
takes them all back as one step, and *Reset tiles* only the cells. An area added
later lands in the first free place on the page; with none it waits on a shelf under
the page, and that is said. Nothing fixes an overlap by itself: it is counted.

### 2. The first layout is arithmetic

`business/posterLayout.ts` has no DOM and no tree. Tiles have a fixed height and
clamped names, so a block's height is a sum, and a browser and a server get one
answer. Blocks fill shelves in sheet order, widen to fill the row and stand as tall
as its tallest, with stand-ins kept together after a scope's own areas. A test holds
the sum to what a browser measures.

A journey takes two rows where one would put its step text under 11 px on screen at
90%: readable text and whole words beat one journey line. A person may set one row.

### 3. What a poster says of its own

`DesignDiagram.poster` holds its tile size, its band rows, the free line of its foot
and its free items. `DesignDiagram.labels` lists the functions whose answering unit
is shown at reading distance: a display choice, per view, and the fact stays the
`assigned` row. Taking a label off ends no assignment, and they are two acts.
`DesignElement.icon` is a step's or an actor's picture, a shipped icon's name or a
content address in the scope's images. `paper` gains `wide`, what a new sheet starts
on; a sheet that says nothing keeps the A2 that means, and a Names reading and a
picture take `wide` as the default, as they take a value they do not know.

### 4. A free item is no fact

A note or a picture, placed and resized anywhere, in `poster.items` and
`Geometry.items`. It belongs to this view alone, and a picture says in words what it
shows. A tile moved to another area is the opposite: `parentId`, a fact on every view,
through the same action a panel's parent field writes, and it leaves its cell behind
in the same step.

### 5. Reading

A zoomable canvas with one transform over plain DOM. A zoom renders no tile: the
distances are the kit's attribute and CSS. The range is 20% to 300% on this canvas
alone; the 60% floor of the others stays where it is. It opens at `max(fit, 0.9)`, so
that a name reads, with the whole picture one press away. Canvas type stays in px. A
person's last place and zoom are theirs, per view, and not in the model. Pan, zoom,
Colour, Day, Find and a selection write nothing.

### 6. Designing

Read and Design are two postures. A drag in Read pans. A drag in Design moves a block
or a tile, as one step per drop. Nothing is written while looking at another day
(ADR-0027).

### 7. An agent

The tools that place a card place a block: `element.place`, `moveBy`, `placeNextTo`,
`align` and `distribute`, with the column as `rail` and a free item by its id, and
`element.place` puts a tile in a `cell`. `diagram.tidy` on a sheet is First layout,
arithmetic rather than the layout engine, and with `tiles` Reset tiles.
`diagram.inspect` says the places, the overlaps, the tiles in hand-placed cells, what
waits under the page and the names a clamp would likely cut. `posterItem.add`,
`.update` and `.remove` keep the free items. `diagram.update` takes `labels` and
`poster`, and `element.update` an `icon`.

All of that is arithmetic on fixed sizes, so a host with no screen offers it, as a
write on a sheet and refused for a board, in a batch as well. That changes what
"nothing can be laid out there" means, for sheets only.

### 8. The format

The fields move with format 17 and generation 14, once. A file that says none of them
reads as it did. A build of the previous generation is refused at the handshake and
reads no folder at 17, whatever a sheet holds. That refusal is what protects a place:
that build's reader and writer keep `labels`, `poster`, `paper` and `icon`, and would
drop `nodes`, `groups`, `cells` and `items` from a sheet on its way back.

## Consequences

* A poster is only as good as its last placing: when functions double in an area,
  somebody places again. The overlap count says so.
* Two people placing at once: the last step wins per block, as on a board. Somebody
  looking sees a block jump, so it settles rather than animates.
* Names are cut where a tile is small, and more in German. The count says how many,
  and the whole name stays in the title, the panel and Find.

## As built, 7 November 2026: the model, the format and the agent's tools

On the way to the screens, and not released: §1's records and commands (`node.set` and
`box.set` accepted on a sheet, `cell.set`, `cell.remove`, `poster.item.add`, `.update`,
`.place` and `.remove`, each with its inverse), §2's arithmetic with its check in a
browser, §3's and §4's fields, §7's tools other than a picture at a paper or a
distance, §8. The first layout is drawn read-only, by address. §5's reading is in part,
and §6 is not built.
