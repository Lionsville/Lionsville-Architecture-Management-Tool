# ADR-0015 — The technology landscape: one view over the layer

* Status: accepted
* Date: 2026-09-16
* Deciders: Wouter Simons
* Amends: ADR-0013's *Redone* preamble (a `technology` view kind goes) and
  ADR-0014 §9 (the report rather than a view kind)

## Context and Problem Statement

ADR-0014 gave the technology layer its offerings: a `platformService` a
team asks for and a platform team is accountable for, realised by the
platform that delivers it this year, used by the applications that consume
it. It also demoted the platform's page to a report, on the grounds that "a
view that is not a picture is not a view" — the technology view of ADR-0013
had been a table of text per platform.

What the layer still had no picture of is the one a platform organisation
puts on the wall and the one a domain architect asks for before choosing
what to build on: **who uses what, what is offered, and what delivers it**,
at once. The technology register is a table over the whole tree; the two
reports answer for one service or one platform at a time; the platform
scope's own board is a row of chips with no lines, because only a flow is
ever a line on a canvas (ADR-0013). Tried on a real landscape with a few
dozen applications and a handful of cloud offerings, the questions people
asked were all of the shape *which domains lean on this*, *what does that
domain stand on*, *where does this offering actually run* — and each was
three clicks through three pages.

A first design drew the lines. Twenty applications using five services
each is a hundred lines; an enterprise with 250 applications across
domains and a large cloud platform's offerings is unusable that way,
whatever the routing.

## Decision Drivers

* The layer's model is right and is not touched: three kinds of thing, four
  rows, everything an application depends on derived and never stored. The
  view has to be a reading of those rows and add no fact.
* A view of this layer has to work at enterprise size — hundreds of
  applications, dozens of offerings — or it is a demo.
* Every mark on it must be something the model already says, so a person
  reading it and an agent reading it cannot disagree.
* A platform scope holds the services and the platforms and not one
  application. The view has to be made there and still show every consumer
  in the organisation.

## Considered Options

1. **Lines on the platform scope's board.** Rejected: a `uses` row as a
   canvas line breaks the one rule the boards have — only a flow is a line
   — and does not scale either.
2. **A matrix**, applications against services with a dot per use, like the
   enterprise map. Scales best, and is a table; it may yet be the report
   behind the view. Not the picture that was asked for.
3. **A colour-by-service overlay on the landscape.** One service at a
   time, on a board that is somebody else's; kept as a later gesture.
4. **A fifth view kind, `technology`, laid out like the sheet and the
   map**, three bands, no lines at rest. Chosen.

## Decision Outcome

Option 4.

### 1. A laid-out view, in three bands

`technology` joins `sheet` and `map` as a view kind that is **laid out**:
no geometry, nothing dragged, nothing stored, computed from the rows every
time (`model/technologyLandscape.ts`). Three bands, one question each:

* **Applications** — every application the rows connect to a service or a
  platform this scope holds, plus the scope's own, in a box per scope that
  answers for it, the way the map groups its columns. A card says the name,
  where it runs, and how many services it uses.
* **Technology services** — every `platformService` this scope holds,
  nested by `parentId`: a parent with children is a titled group. A card
  says the description's first line, the lifecycle where it is not live,
  *shared*, how many consumers, how many realisers — none being a real gap,
  said as one.
* **Platforms** — every `platform` this scope holds, nested where the tree
  nests, an `outside` platform dashed. A card says what it realises and how
  many applications stand on it; a place that realises nothing says so.

The view is made in the scope whose services and platforms it draws. The
applications come from the rows the rest of the tree wrote about them, the
way the two reports already take them, and are named off the index — so
the platform scope's view shows every consumer in the organisation without
holding one, and a landscape's view shows its own applications against the
stand-ins it draws.

### 2. No lines at rest

At rest the page draws no lines: the cards carry counts, so the resting
view is a catalogue. Hovering a card previews its lines; clicking pins
them, dims everything they do not touch, and opens the record on the
right. *All lines* is the escape hatch, kept so the comparison is one click
away and never the default. Every line is a row that exists:

| line | row | drawn |
|---|---|---|
| uses | application \| component → service | application band to service band |
| realises | platform → service | service band to platform band, dashed |
| leverages | *derived*: `uses` read through `realises` | application to platform, only while the service band is hidden |
| binds | `uses` application → platform | dotted, in both modes |
| hosted on | `hostedOn` | faint, off by default |

A container's row counts for its application, as everywhere else.

### 3. The middle band folds, and the leverage narrows

*Hide* on the service band collapses it to one strip and reroutes the
lines: what an application leverages is drawn straight to the platforms.
That exposed an ambiguity the record's *Leverages* line had been carrying
quietly: a service realised by two platforms — *Cloud environment* by an
Azure subscription and an AWS account — was answered with both. **The
application's hosting chain decides.** The realiser under the same root as
the place its containers run is the one it leverages; where the chain says
nothing, or no realiser shares the root, all of them are answered, which
is the honest ambiguity. The rule is `narrowRealisers` in
`model/leverage.ts`, so the record, the register, the agent and the view
say the same thing.

### 4. Scale

Above **forty** applications on the board every domain starts folded into
one box with a count, and a folded domain's lines merge into one per target
with the count on it. A name filter that brings the visible set under the
threshold unfolds the matches. Domain chips filter the top band; above
eight domains they sit behind one menu. Select a card and tick *only what
the selection touches* to see nothing else. The threshold is one constant,
to be tuned on a real landscape.

### 5. Where it lives

Made from the technology card on a scope's home (*Landscape* beside
*Open*), from the editor's `+`, and by the agent's `diagram.create` with
`kind: technology`; listed among the tabs like the other laid-out views,
where choosing it opens the page and never activates a canvas. Read by
the agent as `diagram.inspect` — the three bands and the lines, bounded —
and drawn by `diagram.render`. The page's capture moved to
`widgets/capturePage` on the way, because rasterising a laid-out page
knows nothing about what the page is of.

### 6. What stays exactly as it is

Only a flow is a line on a canvas; the platform report and the service
report as reports; the technology register; the four rows and the eighth
kind; the federated model in every respect. `diagram.update` takes nothing
for this kind, because everything on it is derived.

## Consequences

* `technology` is a fifth value of a view's `kind`. Additive; the format
  does not turn. An older build reading a folder with one sees a diagram it
  does not draw, which is what it does with a map it does not know.
* `LeverageOptions` gains `tree`; `leverageOf` narrows through it. A
  landscape whose containers are hosted answers one platform per service
  where it answered two.
* The shipped example's platform scope carries a *Technology landscape*.
* Not in this step: a colour-by-service overlay on the top band,
  multi-select of two services for the migration question, a matrix report
  behind the view, environments.
