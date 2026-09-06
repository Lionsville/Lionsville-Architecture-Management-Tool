# ADR-0004 — What a large landscape costs

* Status: accepted
* Date: 2026-09-06
* Deciders: Wouter Simons

## Context and Problem Statement

Everything this repository said about its own speed was a recollection. There
was no performance test of any kind, no `performance.now` anywhere, and no
fixture larger than two hundred rows — a size at which every quadratic loop in
the tree looks linear. The one number written down, the router's cost table in
`layout/libavoidRouter.ts`, came from a one-off measurement recorded in a doc
comment.

Meanwhile the shipped example is thirty-three elements and the tool is for
landscapes of a few thousand. The gap between those two is where every
assumption lives, and the only honest way to find out which of them were wrong
was to build the landscape and time it.

## Decision Drivers

* **A cost you cannot measure is a cost you will argue about.** The point of
  this phase is a number in a file, not a faster feeling.
* **Proportional to the change, not to the model.** ADR-0002 said a command
  touches the path it names. Either that survives the trip to the screen or it
  is a claim about a data structure nobody looks at.
* **A refusal beats a freeze.** Where an algorithm's cost grows faster than the
  board does, the answer is a limit said out loud and a way to stop, not a
  spinner on a window that has stopped answering.
* **The gate stays fast.** `npm run check` is a few seconds on purpose. Anything
  that takes tens of seconds belongs in `verify`, which is the gate before a
  push and already costs a minute.
* **No customer data, ever.** A fixture is one of the easiest places to leak a
  real landscape into a public tree (`CLAUDE.md`).

## Considered Options

1. **Profile by hand when something feels slow.** What the repository did.
2. **Budgets in the fast loop.** Every `npm run check` proves the numbers.
3. **Budgets in the gate before a push**, over a generated landscape, with the
   fast loop left alone.
4. **A benchmark suite outside the gate**, run when somebody remembers.

## Decision Outcome

**Option 3.** A deterministic landscape generator (`model/testing/synthetic.ts`)
in three sizes, a budget per operation (`model/testing/measure.ts`), and a
`perf` step in `npm run verify`. Not in `npm run check`: building landscapes of
thousands of elements and timing work over them is tens of seconds, and a fast
loop you batch up is not a fast loop.

The fixture is generated rather than collected. It has to be big, it has to be
the same on every machine so a red budget means a regression rather than an
unlucky draw, and it must not be anybody's real landscape. Its connections are
drawn by preferential attachment, so a handful of elements carry the degree of
an integration bus and most carry two or three — the shape a real landscape has,
and the shape the router's and the derive's cost actually depend on.

The budgets are absolute figures for an ordinary laptop rather than a multiple
of whatever machine ran them last. The measuring machine here is several times
quicker than that, so the headroom in the table below is not the margin a slower
machine will see. A red budget is something to investigate; raising it is the
one response that makes the whole arrangement worthless.

### What was measured, and what it cost

On the `large` fixture — 2,000 elements, 5,000 connections, 30 diagrams, 2 KB of
markdown on each element — median of seven runs, September 2026:

| Operation | Measured | Budget |
|---|---|---|
| open: parse the folder, index it, derive the landscape | 16 ms | 1500 ms |
| one inspector keystroke to model update | 0.25 ms | 5 ms |
| drag-stop of ten nodes | 2.0 ms | 30 ms |
| undo or redo of one step | 1.6 ms | 5 ms |
| 500 undo steps, heap growth | 0.02 MB | 50 MB |
| serialise one diagram file | 1.5 ms | 20 ms |
| serialise the whole project | 9.3 ms | — |
| search, one keystroke, warm index | 0.14–0.33 ms | 20 ms |
| build the search index, first time | 6.8 ms | — |
| re-index after a command | 1.2 ms | — |
| read 600 element descriptions | 0.07 ms | — |
| derive a 600-node board after one move | 2.5 ms | 30 ms |

Two of those were something else before this phase: a keystroke in a search
field cost 4.7–6.2 ms, and reading six hundred descriptions cost 8.7 ms on
every render of the board.

The first five needed no work: they are ADR-0002 and ADR-0003 paying out, and
this is the first time either has been measured rather than asserted. A
keystroke costs a quarter of a millisecond on two thousand elements because a
command touches the path it names; five hundred undo steps cost nothing because
a step is a pair of commands rather than a snapshot of everything, where the
fifty full-model snapshots this replaced were hundreds of megabytes.

### The four things that were wrong

**Folding the haystack per keystroke.** Both searches lowercased and stripped
accents from every element's fields — and, for the wide search, from every
description and every decision body — once per element, per character typed. The
folding moved into an index built once per model. The rule of "found" did not
change and is asserted against a plain reimplementation of the filter and sort
it replaced.

**A fresh object per box per commit.** The derive is a projection, so it built a
new node, a new edge and a new `data` literal for every row every time.
`React.memo` on the seven node components had nothing to compare and the whole
board re-rendered for a change that was nowhere near it. Worse, React Flow keeps
a node's measurements and handle bounds only when handed the object it already
had, so every commit also re-measured every box in the DOM. The projection is
now reconciled against what the canvas last drew.

That reconciliation only works because `fromDiagram` keeps its answer against
the indexed diagram it converted. Without that, `toArrays` rebuilt all thirty
diagram objects on every keystroke, and ADR-0002's "an untouched diagram keeps
its identity" stopped being true the moment it crossed into the shape the file
has — which is the shape the canvas is handed.

**Re-reading every description on every render.** Each card asks what its
element's page says — the one line it draws, and whether there is more behind it
— and both walked the whole markdown, twice per card. A bounded reader remembers
the last two thousand.

**No virtualisation.** Every box stayed in the DOM at every zoom. It is now on
above two hundred boxes, and off below, because it is not free either way: a
visibility test per node on every viewport change and a mount as boxes cross the
window edge is more work than drawing thirty boxes and leaving them alone.

### The two caps

Two algorithms have a cost that grows far faster than the board does, and for
both the decision is the same: a limit said out loud, and a way to stop.

**Tidy** now runs in a worker and refuses a board over 400 boxes. Measured on
the generated landscape: 100 boxes in 0.15 s, 200 in 0.44 s, 300 in 4.9 s, 400
in 6.1 s, and 600 had not finished after six minutes. On the main thread all of
that was a window that stopped answering behind a spinner that could not turn.
The cap is not the whole protection, because the cost depends on the connections
at least as much as on the boxes; that is what the cancel is for, and it is why
the button only offers a cancel where there is a thread to terminate.

**Routing** keeps the 150-connector-per-tier cap it had, and this is where the
investigation this phase was asked for landed somewhere other than expected.

### The routing investigation, and why nothing was optimised

The brief was to try keeping a persistent libavoid `Router` in the worker and
feeding it deltas rather than rebuilding per pass, and separately to route only
the tier whose geometry changed. Both were dropped, on the strength of what the
fixture says a pass actually does:

| Board | nodes | lines | groups | routed | declined | one pass |
|---|---|---|---|---|---|---|
| `small` | 164 | 332 | 5 | 24 | 308 in 1 tier | 5.2 ms |
| `large` | 1,652 | 4,333 | 43 | 39 | 4,294 in 1 tier | 180 ms |

A whole-board pass on a landscape of two thousand elements costs 180
milliseconds. Making it faster is optimising something nobody is waiting for.
What the pass does *not* do is the finding: the inter-group tier is over the cap
on both boards, so it is declined whole, and the router lays out 39 of 4,333
lines. Automatic routing is effectively unavailable on a large landscape, and
what a user meets is the over-cap notice rather than a slow pass.

So the honest conclusion is that the interesting work is making the cap
unnecessary — routing a crowded tier in pieces, or a different strategy for
inter-group traffic — and not making an accepted pass quicker. That is product
work with a visual outcome, it belongs in a plan of its own, and it would have
been hidden by a successful micro-optimisation here.

One caveat on those numbers, stated so nobody quotes them too confidently: the
generator draws connections without regard to domain groups, so it almost
certainly overstates inter-group traffic. A real landscape has more locality,
and its inter-group tier is smaller. The direction of the finding is safe — the
cap is what people meet, not the clock — but the exact ratio is the fixture's.

## Consequences

* `npm run verify` gains a step and about two seconds. `npm run check` is
  unchanged, which was the point.
* Three caches now exist that did not: the search index, the description reader,
  and the converted diagrams. Two are keyed on object identity and bounded by
  the collector — what the model drops, the collector takes — and the third is a
  bounded reader with an eviction rule that is invisible by construction, pinned
  by a test that reads past the bound and asks the first one again.
* Two features now refuse work rather than attempting it. Both refusals carry a
  reason rather than a sentence, worded by the editor, the way `SkippedTier`
  already was.
* The PNG export had to learn that the canvas does not draw everything: it mounts
  the whole board and waits for a paint before capturing. Everything else on the
  canvas reads React Flow's store and never noticed.
* A fixture that is wrong in a way nobody spots would make every budget a
  statement about the generator. It is tested for the properties the budgets
  lean on — determinism, the counts, a long-tailed degree distribution, a round
  trip through the indexed model — and its link density and hub ratio are held
  against the shipped example's, which is the only hand-written landscape in the
  tree. Size cannot be checked that way; shape can, and shape is what the
  router's and the derive's cost depend on.
* The `xl` fixture exists to be usable rather than fast. It is where the caps and
  the refusals are exercised, and it is deliberately not in any budget.
