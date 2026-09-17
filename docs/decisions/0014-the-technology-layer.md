# ADR-0014 — The technology layer: services offered, platforms that deliver them

* Status: accepted
* Date: 2026-09-15
* Deciders: Wouter Simons
* Supersedes: ADR-0013 §1 (the category), §2 (the relation ends), and the
  parts of its *Redone* preamble that describe the report's shape

## Context and Problem Statement

ADR-0013 gave the model its physical view: a `platform` kind, a closed
`platformCategory`, and two rows — `uses` and `hostedOn` — from an
application or a container to a platform. Tried on a real landscape run by
a platform organisation, it was found to be missing the half such an
organisation actually needs.

**The layer had instances and no offerings.** `platform` was one kind asked
to be four things: a place something runs, a service something consumes, a
containment tree, and a stack. *OpenShift* existed; *Container platform* —
the thing a team asks for, that a platform team offers, that could be
delivered by something else next year — did not. In TOGAF's terms the layer
had solution building blocks and no architecture building blocks; in
ArchiMate's, nodes and no technology service. The closed category was a
hard-coded taxonomy standing in for the catalogue the enterprise should
author, and `tooling` was what a cluster made in the app silently became.

**Nothing said a technology was offered for re-use.** A platform team was a
free-text `owner`. The model could not answer *what does the platform team
offer*, *what can my team leverage*, *who else uses this*, or *this team
built something three other teams now depend on and nobody has said so*.
The line that matters is not infrastructure against application kit; it is
who maintains a thing against who consumes it. A team that self-manages a
database for its own use is running its own kit. The moment another team
builds on it, the same thing is a service offered, and it needs an owner, a
lifecycle somebody is accountable for, and a place in an enterprise list.

**There was no technology index.** The register is every application in
the organisation, derived from the index. There was no equivalent for
technology, so the platform scope's own element list was the only list
there was — and only if every platform happened to be mastered there.

**The platform tree was drawn and never read.** Exactly one reader walked
`parentId` on a platform, the deployment boxes. The platform report
gathered its rows from those ending on the platform itself, so a cluster's
report omitted the containers in its namespaces and every interface landing
on them; the retiring-platform finding walked the rows only, so retiring a
cluster flagged nothing in its namespaces; and the overlay coloured by the
namespace rather than the cluster. There were also two ways to say one
thing: `parentId` between platforms was drawn and never checked, `hostedOn`
between platforms was checked and never drawn, and ADR-0013 §2's own table
never sanctioned the second.

## Decision Drivers

* A business function is what the enterprise *does*; a technology service
  is what a platform team *offers*. ArchiMate, TOGAF and this model keep
  those on different layers, and nothing here may blur them: the business
  layer, the sheet and the map are not touched.
* An application must say one thing per question. Where a container runs
  and what an application consumes are two questions with two rows; which
  platforms it depends on must be derived, never stored twice.
* Organisations draw the line between "own kit" and "offered" differently.
  A model that guessed would be wrong in a way nobody could correct; one
  that never noticed would miss the finding that matters most.
* The tree has to stay git-shaped: nothing organisation-wide is
  materialised, for the reason ADR-0012 §2 gives.
* Every reader that answers a question about a platform must answer it
  about everything filed under it, or the tree is decoration.

## Considered Options

1. **Technology offerings as business functions**, in root areas of their
   own, reusing the sheet and the map. Rejected: it puts what a platform
   team offers on the layer of what the enterprise does, which no model in
   the market does and which the map would then roll up as coverage. It is
   recorded here so nobody proposes it again.
2. **Keep one `platform` kind and widen the closed category** to name the
   offering. Rejected: the offering is the enterprise's to author, and
   whichever list the model shipped would be wrong for the next
   organisation; and the offering and the product that delivers it have
   different lifecycles.
3. **A second kind, `platformService`, on the technology layer**, realised
   by platforms, consumed by applications, maintained by actors — and a
   three-value archetype for what a platform is. Chosen.

## Decision Outcome

Option 3.

### 1. An eighth kind

`platformService` joins the seven: the offering — *Container platform*,
*Message brokering*, *Managed Postgres*, *Delivery pipeline*, *Cloud
environment*, *Observability*, *Identity*. What a team asks for and a
platform team is accountable for, independent of the product that delivers
it this year. It maps to ArchiMate's technology service; the name is the
owner's word, and if the ArchiMate mapping carries better under the
ArchiMate word that is a rename and nothing more.

A tree, like every other kind, by `parentId`: *Data services* over *Managed
Postgres* and *Object storage*; depth is all the model knows, as with
`function` and `step`. It carries `lifecycle` and `lifecycleDates`, so an
offering can be piloted, live or being withdrawn, and the roadmap hatches a
withdrawal exactly as it hatches anything else. It is drawn as a chip in the
management band, with a mark of its own so what is offered and what
delivers it are told apart at a glance. The interchange leaves it out, as it
leaves out the platform and the business layer.

`platform` stays exactly what it is: the concrete thing — a cluster, a
namespace, a broker, an account, a machine.

### 2. What a platform is: `platformArchetype`

The closed `platformCategory` goes. After §1 the only distinction left for
the model to make about a platform is what it *is*, and exactly two readers
branch on it:

* `place` — a cluster, a namespace, a machine, an account: something a
  container is `hostedOn`, and what the deployment boxes draw.
* `service` — a broker, a bus, a gateway, a vault: something consumed.
* `network` — a segment, a firewall, a link.

`service` is what a platform with nothing said reads as: a wrong `place`
puts a spurious box on a deployment diagram, a wrong `service` puts nothing
anywhere. What sort of technology a platform is, in the sense the old enum
reached for, is now the service it realises — which the enterprise authored.
A file carrying the old field reads: `runtime` and `network` map by name,
everything else to `service`; the field is dropped on the next save, and
the folder reader is the last place its name survives.

### 3. Three rows, and one held to its ends

In the table of ADR-0012 §5:

| type | from → to | reads as |
|---|---|---|
| `realises` | platform → platformService | this is how that offering is delivered |
| `uses` | application \| component → platform \| platformService | a service consumed |
| `assigned` | actor → function \| step \| platformService \| platform | who maintains it |

`hostedOn` stays `application | component → platform` and is now
**enforced**: a `hostedOn` whose source or target is anything else is
refused by the reducer with `command.technologyEnds`, and by the agent with
the same key. Platform-to-platform `hostedOn` goes; `parentId` is the only
containment. The other three are held to their ends by the agent, since a
person's inspector cannot draw them wrong.

### 4. Shared: said out loud, and checked against the rows

`platformService.shared?: true` — offered for use beyond the team that
maintains it. Explicit, because organisations draw this line differently and
a model that guesses will be wrong in a way nobody can correct.

And derived where nobody has said, in the pattern the platform badge already
uses — a value somebody typed wins and is left as typed. A service assigned
to one actor and used by an application whose own team is another actor is
being offered, whether or not anybody ticked the box. That is a **finding**,
`check.offeredNotShared`, on the service in the scope that answers for it,
naming the consumers — a finding rather than a value, because it is a
conversation the maintainer has to have and not a fact the tool may write
into their record. A service marked shared that nobody outside its
maintainer consumes is not a fault and not a finding: an offering with no
takers yet is an ordinary thing. Whose an application is comes from
`partyId`, which already means which actor it belongs to; a container's team
is its application's.

### 5. One thing per question, and the rest computed

* `hostedOn` a **platform** — where a container runs. Unchanged.
* `uses` a **platformService** — what it consumes. The consumer's statement,
  about the offering and not the product: a team asks for message brokering,
  and which cluster delivers it is the platform team's business, said once
  as `realises`.
* `uses` a **platform** stays legal for the case where a team genuinely binds
  to one instance. It is not the normal answer and the inspector offers
  services first.

Which platforms an application actually depends on is **derived** through
the services it uses and what realises them — `model/leverage.ts`, pure and
tested, over this scope's rows and the tree's — and shown on the record as
one read-only line. Nothing about this is stored.

### 6. Every reader walks the tree

`parentId` is the one containment, and every reader walks it:

* the platform report gathers what is hosted on, uses and crosses the
  platform and everything filed under it, each row naming the descendant it
  actually sits on, and *stands on* is the chain above;
* a platform's effective retirement is the earliest date in its chain, so
  retiring a cluster flags everything under it, naming the platform that
  actually goes;
* the overlay colours by the **root** — the outermost platform the
  organisation runs, since the cloud account above the cluster is somebody
  else's and the landscape is coloured by ours — and takes the worst phase of
  the whole chain; the record and the deployment boxes keep the precise
  place;
* deleting a platform or a service takes its children out from under it in
  the same step, the way a landing on a deleted interface becomes an
  interface of its own.

A stand-in carries no `parentId` of its own, so each reader is told the tree
by the host, off the index, the way the deployment boxes already were.

### 7. A technology index, at enterprise level

The same fold over the same index as the application register, beside it:
every service and every platform defined anywhere in the tree, keyed by id,
with the scope that answers for it, the scopes that draw it, and what the
rows say — who maintains a service, whether it is shared, how many
applications consume it and from how many scopes, what realises it; what a
platform is, what it realises, what it hosts with everything under it, and
the service it belongs to — with the findings that concern it. Nothing is
materialised, for the reason the register gives: a materialised list is a
merge conflict every domain touches. It is a card on the organisation screen
and a page behind it, and the agent reads it as `technology.list`.

### 8. Authoring, and the service's report

The platform inspector gains *Part of* — the platform this sits in, over
the platforms in scope, a loop shown and refused — and *Realises*, the
services it delivers. *Part of* is what makes a namespace creatable in the
app at all. The service inspector gains *Part of*, *Maintained by* and the
*Shared* tick with the derived answer beside it where nobody has ticked.
The application record gains a read-only *Leverages* line. And the service
has a report of its own, reached from its chip the way the platform's is:
who maintains it, what realises it, who consumes it and from which scopes,
and what would be stranded if it were withdrawn — every consumer still on it
on the day it goes, or all of them where no day is set. The agent reads it
as `service.report`.

### 9. What stays exactly as it is

`platform` as a kind and the chip in the management band; only a flow is a
line; `refines` and everything about how an interface lands; the deployment
boxes; the *Colour by* overlay; the platform report as a report rather than a
view kind; the federated model in every respect; the interchange leaving
technology out. The business layer is not touched.

*Amended by ADR-0017:* what an application is hosted on implies the
services that platform realises, derived beside the ones it uses.

*Amended by ADR-0015:* the layer has one view kind after all — the
technology landscape, laid out over the whole layer rather than a page per
platform. The two reports stay reports.

## Consequences

* The agent's vocabulary gains `platformService` in the kinds, `shared` and
  `platformArchetype` on an element, the three rows on `relation.add` with
  their ends, `technology.list` beside `register.list`, and
  `service.report` beside `platform.report`; `element.describe` says
  `leverages` beside `runsOn` for an application, `maintainedBy`, `shared`,
  `realisedBy` and `consumers` for a service, `realises` and `partOf` for a
  platform.
* The format did not turn: the fields are additive and ride through
  format 5, and the one field withdrawn is mapped on read.
* The shipped example shows all of it: seven offerings in the platform
  scope, each maintained and shared, six realised and one a real gap; the
  applications consuming services rather than products; a team's own
  service beside one offered across a team boundary without anybody saying
  so, which is the one finding the example ships on purpose.

## Open questions

* **Environments** — *this container, in production, on that node* — still
  open from ADR-0013.
* **A service realised by a platform in another organisation's scope**,
  once a tree spans more than one enterprise.
* **Versions of an offering** — *Managed Postgres 14* and *15* as one
  service or two — which the first organisation running two decides.
* **What ArchiMate's technology layer maps to now** (step 16): the
  archetype gives node, technology service and network, and
  `platformService` gives the technology service. Decide it there, against
  a real file.
