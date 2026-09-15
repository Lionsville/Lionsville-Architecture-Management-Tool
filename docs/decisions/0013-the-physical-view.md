# ADR-0013 — The physical view: a platform, what stands on it, and what it carries

* Status: accepted
* Date: 2026-09-15
* Deciders: Wouter Simons
* Superseded in part, 15 September 2026, by ADR-0014: §1's closed category
  is replaced by a three-value archetype and the offering becomes a kind of
  its own; §2's relation ends gain three rows and `hostedOn` is held to
  application | component → platform; and the report's shape described in
  the preamble below now gathers over the platform and everything filed
  under it.

**Redone, 15 September 2026.** The kind, the category, the two relations and
the platform scope were built as written below, and the rest was tried on a
real landscape and found wrong at the first look. What follows is what changed;
where a section below disagrees with this, this is the record.

* **`via` is withdrawn.** A flow carried the platforms it travelled over,
  beside `protocol`. Two fields for one fact, and the one asked at the level
  where nobody knows the answer: a person drawing an interface between two
  applications is not asked which bus it crosses, because the interface has
  not been built yet and the pair could disagree on the same line. §3 goes
  with it — the transport pattern, its four names, and the dangling end a bus
  could be. A file that still carries the field reads, and the field is
  dropped on the next save.
* **What carries an interface is where it lands.** A container-level flow may
  say which application-level flow it is part of (`refines`, the one new
  field), and only when its ends sit under that line's ends — source under
  source, target under target, one level deep. The landscape keeps one
  functional line per interface, with the label, the direction and the window;
  the container diagram draws where it arrives, one line per landing and no
  line to the boundary for an interface that has landed. Protocol and
  technology move down to the landing, because that is the level at which
  anybody knows them, and the interface shows the set its landings carry.
  Nobody is asked twice: a landing on a container hosted on a broker is the
  fact, and the platform's report reads it off the rows.
* **Container lines imply an interface** where nobody has drawn one. Derived,
  never written and never drawn — a line nobody agreed to is the clutter this
  decision set out to remove — and offered as a finding with an *Accept* that
  writes the application line and lands every one of them on it as one step.
* **Hosting is a container-level fact.** An application is not deployed
  anywhere; the things it is made of are, and usually in more than one place.
  So the row is written from the container and the application's answer is the
  roll-up over them, which the badge, the finding and the record all read. An
  application with no containers — an outside system, a SaaS service, a bought
  package — still says where it runs itself, because that is the only sentence
  anybody can write about it, and the writer refuses the row from one that has
  containers.
* **The technology view is not a view.** §4 made a platform's page the fourth
  laid-out view kind, which promised a picture and gave a table of text, and
  made a person create one before they could read one. Three things replace
  it. The deployment boxes: the platforms a container diagram's containers run
  on, drawn around them as derived dashed groups nested the way the platforms
  nest — Structurizr's deployment diagram over the canvas that exists. The
  overlay: the landscape's cards tinted by the platform of their roll-up or by
  the worst lifecycle among the platforms they stand on, with no new geometry
  and no lines. And the report: one platform, what would be left standing if
  it went, and the container interfaces that cross it each with the
  application interface it is part of — reached from the platform's own card
  and from the finding that names it, with nothing to create, because every
  mark on it is derived from the rows.

## Context and Problem Statement

Of the four views of 4+1, the model had the logical view and the scenarios
— the landscape, the container diagram, the business layer — and nothing of
the physical view: no element that is a cluster, a broker, a bus or a
firewall, and no relation that says *runs on* or *goes over*. A shared
platform was an `application` in the management band, and an interface
that crossed the bus was either two flows, which loses the interface, or
one flow that did not say how it travelled. The `platform` aspect could say
whether an application's platform was under control, and not which.

The line that matters is the one between the development view and the
physical view: the application team owns the code, and the platforms it
runs on and the services it uses are somebody else's and are *used*. The
management band was where that line leaked: the forge and the monitoring
belong to the development view, the broker and the cluster are the physical
view itself, and the model drew all of them as applications in a band.

## Decision Drivers

* Every model in the market has settled the same shape — ArchiMate's
  technology layer, C4's deployment nodes, LeanIX's IT component,
  Backstage's `Resource` — and the two mappings after this one need it as a
  target: ArchiMate's technology layer has nowhere to land, and a Backstage
  `Resource` would be flattened into an application.
* An interface must stay one row. The landscape draws the functional line,
  and a technology view must be derivable from the same row — a bus whose
  page had to be drawn by hand would be a poster.
* Ownership is already solved. ADR-0012 gives a platform scope that defines
  the masters; every domain draws stand-ins, and `mayEdit` refuses the
  domain a write to the platform's fields. *Used, not owned* is a stand-in
  with a relation to it, and nothing here may extend the federated model.
* The risk that a platform's dates carry must reach what stands on it,
  which is the feature the portfolio tools sell, over dates the model
  already has.

## Considered Options

1. **A kind, two relations, and a field on the flow.** Technology is a kind
   of its own; an application `uses` a service and is `hostedOn` a node;
   a flow names the platforms it travels over. The distinction ArchiMate
   makes between serving and assignment is the relation's to carry.
2. **Two kinds, node and service**, the way ArchiMate has them. Rejected:
   a person naming a cluster does not want to be asked whether it is a
   node or a service, and the relation already says which it is being used
   as.
3. **The bus as an application in the middle of two flows.** What people do
   today. Rejected: it destroys the interface, and the ESB's page becomes
   a container diagram of the bus rather than a list of what crosses it.
4. **Environments and container instances**, C4's *this container, in
   production, on that node*. Deferred: the deep end of every model, held
   by C4 and Structurizr and by neither LeanIX nor Backstage, and not what
   a first organisation needs to say. It is the open question below.

## Decision Outcome

Option 1.

### 1. A seventh kind

*Superseded in part by ADR-0014: the closed category below is replaced by
`platformArchetype` — place, service or network — and what sort of technology
a platform is became the service it realises.*

`platform` joins the six of ADR-0012 §4: a cluster, a broker, a bus, a
firewall, the tooling — what an application runs on and what it uses. A
tree like the others, so a namespace sits under a cluster under a cloud
account. It carries a `platformCategory` from a closed set — `runtime`,
`messaging`, `integration`, `network`, `data`, `identity`, `tooling`,
`observability` — because two readers branch on it and neither may guess
from a name: the ArchiMate mapping picks a node, a network or a technology
service by it, and the technology view groups by it. `tooling` is what a
platform that says nothing reads as. The lifecycle every element has is
the platform's too.

**It is drawn on a board**, as the chip the management band has always
drawn, wherever it sits — the forge and the monitoring in that band were
platforms wearing an application's kind, and a card there is how a
landscape says what it stands on. The band stays the view's and the kind
the thing's, which is §4 applied and not extended. A business kind still
never reaches a canvas. The interchange leaves the platform out, as it
leaves out the business layer, because a management tool read back is an
application and the format's vocabulary is a contract.

### 2. Two relations

*Superseded in part by ADR-0014: `uses` may end on a service, a platform
`realises` a service, an actor is `assigned` a service or a platform, and
`hostedOn` is held to application | component → platform — never a platform
on a platform, which is `parentId`.*

In the table of ADR-0012 §5:

| type | from → to | reads as |
|---|---|---|
| `uses` | application \| component → platform | a service consumed: the broker, the source forge, the firewall |
| `hostedOn` | application \| component → platform | where it runs: a namespace, a machine, a cloud account |

Both dated like every relation, so the roadmap hatches a platform
migration exactly as it hatches a shadow-run interface. Neither is drawn on
a canvas — the technology view lists them — so a platform on a board is a
card and never a line's end.

### 3. Transport, on the flow

*Superseded by the preamble: `via` is withdrawn, and what carries an interface
is answered by where it lands.*

A `flow` gains `via`: the platforms it travels over, in order — `[esb]`,
`[gateway, kafka]`, absent for point-to-point. The interface stays **one**
row from source to target and the landscape draws it as the functional
line it always was. `protocol` stays what it is: how the interface speaks,
not what carries it.

The **transport pattern** is derived from `via` and the categories of what
it names, never stored: point-to-point with nothing in the way; *evented*
with a broker anywhere on the path; *mediated* over a bus without one;
*gated* by anything else — a gateway, a firewall, a network, or a platform
this scope cannot see. A flow `via` a platform this scope holds as a
stand-in is ordinary; `via` an id nobody in the tree defines is a dangling
end, kept and reported like any other.

### 4. The technology view

*Superseded by the preamble: a platform has a report, not a view kind, and the
pictures are the deployment boxes and the landscape overlay.*

The fourth laid-out view, beside the sheet and the map: one platform, with
what stands on it and what passes through it. Never drawn — every mark is
derived from the rows that name the platform, so the page is computed on
open and is never stale: what it stands on, what is filed under it, what is
hosted on it, what uses it, and every flow whose `via` passes it, each one
entry with both ends, split at the platform on the page into the half that
comes in and the half that goes out. *The ESB, with everything that comes
in and goes out.* A flow that runs both ways comes and goes on both sides.

The rows it draws are written where the interfaces are, which is a
landscape's model and not the platform scope's — so the view is made in
the scope that holds the rows, whoever defines the platform, and the rows
the rest of the tree wrote arrive through the index the way the map's do.
The index answers for a platform with every flow that passes through it.

### 5. The check, and the badge

*Superseded by the preamble in one respect: both read the roll-up over an
application's containers rather than its own rows, and the finding names the
container that is left standing on nothing.*

A platform that retires before what stands on it or travels over it is a
finding of the roadmap's — on the element for a `hostedOn` or `uses` row,
once on a flow for the first platform on its path to go. A row with its
own window that closes in time is, as everywhere in `checks.ts`, the
correct answer and not an instance.

The `platform` aspect stops being the only thing the model can say about
technology. Where nobody typed it, the badge reads off the `hostedOn` rows:
*managed* on a platform this organisation owns, *partial* on one outside
it, *none* on nothing — and only in a scope that holds a platform at all,
so a landscape that has not started modelling technology hears nothing. A
status somebody set by hand wins and is left as typed.

### 6. The format

The working folder carries `platform`, `platformCategory`, the two relation
types and `via` in format 5 as it stands: the reader spreads a record and a
row, so the fields ride through, and a build before this one meeting them
sees a chip in the management band and a row it does not draw. The number
turns at the decision-record change that drops the `applicationId` alias,
once, rather than here for fields that are additive.

## Consequences

* The two mappings that follow have their target: ArchiMate's node, device
  and system software map to a `platform` by category, its serving to
  `uses` and its assignment to `hostedOn`, and a flow's `via` exports as
  the association ArchiMate 3 allows from a relationship to an element; a
  Backstage `Resource` maps to a `platform` with its type as the category,
  and `dependsOn` to `uses`.
* The agent gains the vocabulary and nothing more: `platform` in
  `element.add`, the two types in `relation.add`, `via` in `connect` and
  `connection.update`, a technology view in `diagram.create`, and its
  report answered like the map's.
* The shipped example has a platform scope beside the landscape — the
  cluster, its namespace, the broker, the bus and the landing zone — and
  the bus's technology view beside the boards.

## Open questions

* **Environments and instances.** *This container, in production, on that
  node* is a `hostedOn` row per environment, or a view per environment
  with `asOf`-like scoping, or an instance record of its own. The first
  organisation that runs two environments through this decides which.
* **A landing three levels down.** `refines` is one level deep: a container
  line names an application line, and the ends have to sit directly under its
  ends. A component of a component has nowhere to say what it is part of
  without a chain, and a chain makes "which landscape line is this" a walk
  rather than a read. The first organisation that models two levels of
  container decides whether the answer is a chain or a roll-up.
* **A landing whose far end is another application's container**, where both
  applications have a container diagram. It is one row shown on both, each
  hoisting the far end to the other application's context box — which is
  right — but a person selecting it on one has selected a row the other also
  draws, and what *Lands on* means from the far side is not yet said.
* **The management band's residents.** The forge and the monitoring an
  organisation draws there today are applications with flows on them; the
  example keeps them so. Whether a refresh should offer to make them
  platforms is a question for the first tree that has fifty of them.
