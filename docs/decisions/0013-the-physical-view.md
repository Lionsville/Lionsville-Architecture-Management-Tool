# ADR-0013 — The physical view: a platform, what stands on it, and what it carries

* Status: accepted
* Date: 2026-09-15
* Deciders: Wouter Simons

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
* **A `via` that names an application.** A domain with a bespoke
  integration service it owns and has not promoted to the platform scope
  cannot name it here. Platforms only, for now, which is the stricter and
  more honest reading; the promote gesture is the way out.
* **The management band's residents.** The forge and the monitoring an
  organisation draws there today are applications with flows on them; the
  example keeps them so. Whether a refresh should offer to make them
  platforms is a question for the first tree that has fifty of them.
