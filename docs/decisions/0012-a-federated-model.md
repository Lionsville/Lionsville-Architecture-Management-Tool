# ADR-0012 — A federated model: scopes, one identity, and views apart from geometry

* Status: accepted
* Date: 2026-09-10
* Deciders: Wouter Simons

*This is the 2.0.0 record. It decides what the model is built towards, not the
order it is reached in; the last section sketches that order and is the least
settled part of the document.*

## Context and Problem Statement

This tool has two scopes above a diagram — a project, and the group it is
filed under — and the landscapes it is now used on need three, with the top
one able to own things. A business architecture of the kind an organisation
draws on one page (a customer journey across the top, responsibility areas
beneath, capabilities inside them, stakeholders down the side) belongs to the
organisation; each domain details its part of it; and the applications the
domains run are one namespace across the whole organisation, owned per domain,
drawn on each other's boards.

Four things in the current model stand in the way, and the first attempt at
this record — the organisation as a bigger group profile, with a register
record beside it — found only the first.

**There is no organisation.** A group is derived from the projects under it and
a `GroupProfile` decorates it; the level above has no record, so its name
rides on every project as `model.customerName`, its decisions are filed as
some group's, and the shared settings file at the root
(`.lionsville-architecture/folder.json`, ADR-0005) had no key until this
record's first commit gave it one.

**Everything editable is a project's.** One session, one command stack,
`apply(model, command)`, activity, dirty/conflict, a history scope, an agent
with `ifRevision` — all of it belongs to the project that is open. The only
content outside a project is the group profile, edited as a form and saved
whole. A business sheet with two hundred functions cannot be edited that way,
and a record that lives outside a project inherits none of what ADR-0002,
ADR-0008 and ADR-0011 built. Whatever holds the organisation's content has
to be a *model under the same machinery*.

**Identity stops at the file.** An element id is unique within one project,
minted from the name (`model/keys.ts`). The same application drawn on two
domains' boards is two unrelated elements; an interface arriving from another
domain is an `externalSystem` with a name and no link; and "external" is one
kind asked to mean two facts — *not the subject of this board* and *not part
of this organisation*.

**A placement file holds meaning, and a definition file holds geometry.**
`diagrams/<id>.placements.json` carries coordinates *and* which zone an element
sits in *and* which dashed group it belongs to, by name; the definition file
carries the named group rectangles, the canvas size and the zone widths. A
rename touches the geometry file, a drag touches a file with semantics in it,
and neither is what its name says.

## Decision Drivers

* An organisation's name, decisions, functions and register belong to the
  organisation, under the same session, undo, history and agent as everything
  else — not to a form.
* A domain may **add detail**; it may not redefine what the organisation
  named. A rename in a domain must not become a rename at the top.
* Applications are **uniquely named across the organisation**, owned per
  domain, drawn wherever they are used; the referencing scope may say what
  the thing means from where it stands.
* A system that belongs to nobody inside the organisation is an ordinary
  thing, not an error, and "we have not yet said whose it is" is a gap the
  tool shows rather than a state it stores.
* The tree has to stay git-shaped: small readable files, one thing per file,
  no materialised list that every domain edits.
* A single landscape with none of this must stay exactly as cheap as it is.
* The interchange format is a contract with other tools and does not change.

## Considered Options

**The organisation as a bigger group profile, and a register record beside
it.** What the first draft of this record proposed: root identity in
`folder.json`, a fourth ADR list, a register file of applications with an
owner field, elements carrying an optional `registerKey`. Rejected on the
second driver's own ground: everything it adds is edited as a form and saved
whole, outside the session — no undo, no activity, no `ifRevision`, no history
scope — and the register's `owner` field stores the very gap the fourth driver
says must be derived.

**A repository.** One organisation-wide store of elements and relations; a
diagram is a view over it (Archi, Sparx, the EA tools). The correct answer in
the abstract, and the migration that ends tools: every closed-model function
here — `equality`, `diff`, `restore`, `clipboard`, `textSearch`, `fromArrays`,
the agent's `answer`, the interchange export — assumes a document that resolves
within itself, and a scope's `model.json` stops being readable on its own,
which is the property ADR-0003 exists for.

**Documents with references.** Chosen. Every scope keeps a document that is
complete and readable on its own; identity is organisation-wide so a
reference is *the same id*, not a join; and every organisation-wide fact —
the register, ownership, the gaps — is derived from the tree, the way groups
are derived from projects today.

## Decision Outcome

Three sentences carry the whole thing:

1. **A scope is a folder, and every scope is the same kind of document.** The
   root is the organisation; a domain is a scope under it; a landscape is a
   scope under that. The ref is the path.
2. **Identity is organisation-wide and thin.** An id names one thing everywhere
   in the tree. The deepest scope that defines it holds its **master record**
   — the name and the detail; a definition above that is a declaration that
   yields to it; every other scope that draws it holds a stand-in, which may
   carry that scope's own account of it. A master is always created; it is
   not always drawn.
3. **A view says what is on it and what that means; geometry is numbers.** A
   diagram definition holds membership and semantics; its geometry file holds
   coordinates and nothing else, and may be deleted, regenerated, or ignored
   in a diff.

The rest of this section is those three, worked out.

### 1. Scopes

```
<root>/                               the organisation — a scope
  .lionsville-architecture/           settings only (ADR-0005): folder.json, local.json
  scope.json                          what this scope is called and what it holds
  model.json                          elements and relations this scope defines or draws
  diagrams/<id>.json                  a view: what is on it, and what that means
  diagrams/<id>.geometry.json         where it ended up — numbers only
  docs/<elementId>.md                 this scope's account of an element, as prose
  decisions/NNNN-<slug>.md            this scope's decision records
  transitions/NNNN-<slug>.md          this scope's plans
  images/  logos/                     pictures and marks, as files
  retail/                             a domain — the same shape, one level down
    scope.json  model.json  diagrams/  docs/  decisions/  transitions/
    warehouse/                        a landscape — the same shape again
      scope.json  model.json  diagrams/  ...
  finance/
    ...
```

**One document shape, nested.** There is no `group.json`, no `project.json`,
no organisation record kept as a setting: a folder holding `scope.json` is a
scope, and what it *is* — organisation, domain, programme, landscape — is a
label in that file for the picker to show, not a type the code switches on.
The root is the organisation by position. A scope with no children is what
today is called a project; nothing else distinguishes it.

What that dissolves: `GroupProfile` (a domain's name, client, links and
decisions are its own `scope.json` and `decisions/`); the three ADR lists
(every scope has one, and an application's records are its scope's records
with a `subjectId`); `model.customerName` (the root's name); and the
organisation section in `folder.json` that this record's first commit added.
That section stays until the format turns — it is small, and it is what the
desktop reads the window title from today — and goes when `scope.json` at
the root exists to read instead. An organisation's identity is content, not a
setting.

What it keeps: the rule that a thing is where its folder is. A moved folder is
the scope at its new address. Nothing inside a scope names its own path.

**Reserved names.** A child scope may not be called `diagrams`, `docs`,
`decisions`, `transitions`, `images` or `logos`. Refused at creation.

```ts
// scope.json
type ScopeFile = {
  type: 'lionsville-architecture'
  version: 4
  name: string                       // "Acme Logistics", "Retail", "Warehouse landscape"
  kind?: 'organisation' | 'domain' | 'programme' | 'landscape'   // a label
  client?: string                    // who a drawing is made out to; absent = the nearest ancestor's
  description?: string
  links?: { label: string; url: string }[]
  diagrams: string[]                 // tab order — the one order that is a decision
  defaultAuthor?: string
  defaultAspectConfig?: AspectConfigEntry[]
  logos?: { key: string; label: string; file?: string; url?: string }[]
}
```

### 2. Identity: one id, one name, everywhere

An element id is a slug, minted from the name where the thing is first named
(`model/keys.ts`, unchanged), and it is **unique across the organisation**,
not across a document. That one change is what makes federation cheap:

* A domain drawing another domain's ERP writes a record with **the same id**.
  No join table, no alias, no `{project, id}` pair to resolve.
* Turning a local box into a reference to the real thing changes *no other
  line in the file* — every relation that named it still names it.
* A plan at the organisation can list `erp` and `wms` from two domains, and a
  decision at the root can be about `erp`, by id, with nothing to look up.

Uniqueness is a **check, not a refusal**. Two scopes that each define `erp`
are a *conflict finding* — somebody is mid-migration, or two teams named the
same thing on the same afternoon — resolved by making one of them a stand-in.
A tool that refused the second definition would refuse the state every real
merge goes through.

**The master is the deepest definition.** For any id, look at every scope
in the tree that holds a *definition* of it (a record without `ref`, §3):

| question | answer | derived from |
|---|---|---|
| what is it called, and whose account is the account | the **deepest** definition — the master | tree depth |
| what is a definition above the master | a **declaration**: a placeholder that yields | tree depth |
| who else draws it | every scope holding a stand-in | `ref` |
| is it in conflict | two definitions at the same depth | depth ties |
| is it stale | a stand-in's or a declaration's cached `name` ≠ the master's | drift check |
| is it dangling | a stand-in with no definition anywhere | drift check |

One rule serves two opposite directions of authority, which is the point:

* **Business functions are top-down.** The organisation defines
  `fulfilment` and nobody below defines it — a domain refines it by holding a
  *stand-in* and putting children under it — so the organisation's record
  stays the deepest, and the name is the organisation's. A domain that
  defines a function of its own that the organisation never named has made a
  *proposal*: a master of a new id, shown on the organisation sheet as not
  yet modelled at that level.
* **Applications are bottom-up.** Retail defines `erp`; that is the master,
  and a rename there is retail's to make. The organisation *may* hold a thin
  record — `{ id, kind, name }` — as a declaration: it names the thing until
  someone deeper takes it, and after that it is a cached copy the drift check
  watches and a refresh rewrites. If the organisation holds nothing, the
  register lists `erp` anyway, derived. That is *first layer, just id and
  name; second layer, the owner's detail* — without the first layer having to
  be written before the second, and without the first layer ever overruling
  the second.

A function's name and an application's name have nothing to do with each
other. A function is *covered by* 0..n applications (`supports`, §5), and by
people (`assigned`); a function that is only people doing things is a
complete answer, not a gap.

The rules do not force which scope holds a master. Where one lands, and how
it moves, is §10.

**The register is derived.** There is no register file. The register is
*every definition of an application in the tree, keyed by id*, computed once
per open from every scope's `model.json` and refreshed by the watcher. The
organisation's register page reads it; `register.list` answers from it;
nothing commits it. That is the same choice as groups derived from projects,
for the same reason: a materialised list is a merge conflict every domain
touches, and a derived one is right by construction.

The cost is an index: `(id → name, kind, owner path, declaring path)` for
every definition, and `(id → drawing paths)` for every stand-in. Built from
`model.json` files only — never descriptions, never diagrams — so twenty
scopes of a few thousand elements is tens of milliseconds, and ADR-0004's
budget table gets a line for it.

### 3. Records: definition, stand-in, perspective

Every scope's `model.json` holds one record per element it *knows about*, and
one record shape serves every case:

```ts
type Element = {
  id: ElementId                 // organisation-wide
  kind: Kind                    // §4
  name: string                  // authoritative on the master; a cache on a declaration or a stand-in

  /**
   * Present = this record is a STAND-IN: the thing is defined elsewhere, and this
   * scope only draws it and says what it means from here. The value is where the
   * owning definition was last seen — a cache, checked for drift, like `name`.
   * Absent = this record is a DEFINITION, and this scope answers for it.
   */
  ref?: ScopePath

  // Structure — model, not geometry (§6)
  parentId?: ElementId          // one parent: a function's area, a step's phase, a component's application, an actor's group
  order?: number                // among siblings, only where order is a decision (a journey reads left to right)
  lane?: ElementId              // a step only: the actor whose own path this is; absent = the common row (§4)

  // The account — on a definition, the owner's; on a stand-in, THIS scope's perspective
  description?: string          // filed as docs/<id>.md in this scope

  // The owner's detail — meaningful on a definition only; a stand-in never carries these
  lifecycle?: Lifecycle
  lifecycleDates?: LifecycleDates
  successorId?: ElementId
  owner?: string                // a person or team; which SCOPE owns it is the folder
  outside?: true                // belongs to someone outside the organisation
  partyId?: ElementId           // which actor it belongs to, when that is known
  category?: string
  vendor?: string
  technology?: string
  aspects?: Record<string, AspectEntry>
  isManaged?: boolean

  // The organisation's intent about a function — on the highest definition
  scopes?: ScopePath[]          // which domains this function is assigned to

  // Presentation, absent-means-inherit, on any record
  iconKey?: string; iconSize?: NodeIconSize; accentColor?: string; shapeVariant?: NodeShapeVariant
}
```

**Three things one record can be**, told apart by what it carries, not by a
`type` field:

* A **definition**: no `ref`. The deepest one in the tree is the **master
  record** — this scope answers for it. A definition above the master is a
  *declaration*: the thin first layer, `id`, `kind`, `name`, standing in for
  a master that is expected deeper down and yielding to it when it arrives.
* A **stand-in**: `ref` present. Drawn here, defined there. Its `name` and
  `ref` are caches; its `description` is **this scope's perspective** — what
  the ERP means to the warehouse, which is a different page from what the
  ERP is, and is allowed to be. That is the one field a stand-in may carry
  that is not a cache or presentation; everything in "the owner's detail" is
  ignored on a stand-in and reported if present.
* A **refinement** is a stand-in with children: a domain's stand-in of the
  organisation's `fulfilment` with domain-local functions whose `parentId` is
  `fulfilment`. Nothing new — a stand-in, and the containment field.

**Which domain owns which function.** Two answers, both rendered, checked
against each other:

* **Assigned**: the organisation's definition says `scopes: ['retail']`.
  Top-down; the organisation's intent; can be said before retail has done
  anything.
* **Claimed**: retail's sheet holds a stand-in of it. Bottom-up; derived from
  the tree; what has actually been picked up.

A function assigned to nobody and claimed by nobody is **unmapped**, and the
organisation sheet draws it in a band of its own. Assigned but unclaimed is
"retail has not started"; claimed but unassigned is "retail took this without
being asked" — both findings, neither an error.

### 4. Kinds: a business layer, and fewer application kinds

```ts
type Kind =
  | 'actor'          // a party, stakeholder, role, team, or a group of them — a tree
  | 'step'           // a journey, its phases and its steps — a tree, ordered
  | 'function'       // a responsibility area, a grouping, a capability — a tree; depth is drawing
  | 'process'        // a business process; its page holds the ```bpmn fence
  | 'application'
  | 'component'      // a container inside an application (C4)
```

**The stakeholder rail needs no kind.** The parties down the side of a
business sheet are the organisation's `actor`s, in a tree (*Partners and
resellers* → *Retailers*, *Other carriers*, …), with `outside` on the ones
that are. A landscape's actor is a stand-in of one of them, or a local actor
nobody has promoted yet. An external application's `partyId` points at one.

**`externalSystem`, `inputChannel` and `managementTool` stop being kinds.**
Each was a drawing decision or a category wearing a kind's clothes, and each
had a second meaning it could not carry:

| today | tomorrow | why |
|---|---|---|
| `externalSystem` | `application` with `outside: true`, or a stand-in from another domain | "external" was two facts. *Outside the organisation* is a fact about the world, stored once on the definition; *not the subject of this board* is derived from `ref` and drawn accordingly |
| `inputChannel` | `application` placed in the `inputChannels` zone of a landscape view | the same portal is a channel on one board and a system on another; the zone is the view's |
| `managementTool` | `application` in the `management` zone | as above |
| `component` | `component` | unchanged |
| `actor` | `actor`, now a tree, with `outside` | unchanged in a landscape; gains the rail |

So an application record has three ways of being "external", and they are
three different facts: `ref` (someone else in this organisation defines it),
`outside` (nobody in this organisation does), and `outside` with no `partyId`
(and we have not yet said who does). Only the last is a gap, and it is a
derived one.

**Depth is drawing.** A `function` at depth 0 is an area and gets the title
band; at depth 1 a grouping, the white box; at depth 2 a capability, the leaf.
A `step` at depth 0 is the journey itself; 1 a phase; 2 a step. The sheet
renders by depth and the model does not know the words.

**A lane is who travels it.** One journey is rarely one path: a key account
on a project runs differently from a customer who orders directly, and a
marketplace partner that handles fulfilment runs differently again. A step
may therefore name a `lane` — the `actor` whose own path it is — and the
sheet draws one row per lane under the same phases, the common row first.
Everything else is derived: a lane's *fork* and *join* are the first and last
phase in which it has a step; a phase inside that span with no step of its
own is *as the row above*, drawn as a pass-through; outside the span nothing
is drawn. A step somebody outside does — *partner fulfils* — is a step
`assigned` to an outside actor, not a hole, so the map can say that phase is
covered by nobody inside. What a lane is not is a decision inside one path;
that is a process, and lives in its ```bpmn fence. *(Added 10 September
2026, after the record was accepted; the only change to it.)*

### 5. Relations: typed, dated, and few

Today's `connection` is one relation type — a flow between two applications.
The business layer needs four more, and they are rows in the same list:

```ts
type Relation = {
  id: string
  type: 'flow' | 'supports' | 'serves' | 'realises' | 'assigned'
  sourceId: ElementId
  targetId: ElementId
  label?: string
  protocol?: string             // flow only
  isBidirectional?: boolean     // flow only
  validFrom?: string            // any type — an application supports a function FROM a date
  validUntil?: string
  color?, lineStyle?, routing?, sourceArrowhead?, targetArrowhead?   // presentation, absent = inherit
}
```

| type | from → to | reads as |
|---|---|---|
| `flow` | application → application | an interface; today's connection, unchanged |
| `supports` | application → function \| step \| process | "covered by" — 0..n per function; the line the enterprise map is made of |
| `serves` | function → step | which capabilities a journey step draws on |
| `realises` | process → function | this process is how that capability is done |
| `assigned` | actor → function \| step | who is responsible — and, with no `supports` beside it, that the function is people doing things |

Containment is **not** a relation: `parentId` is one parent, always, and a
field is what a tree wants. Replacement stays a field (`successorId`) for the
reasons ADR-0010 gives — it is one gesture over dated elements, and porting is
derived from flows.

**Every relation may carry a window.** ADR-0009 gave flows one; here it is on
the row, not the type, so the roadmap can hatch "the WMS supports fulfilment
from March" exactly as it hatches a shadow-run interface. That is what makes
the business map a thing with time rather than a poster.

A relation may name an id this scope holds only as a stand-in, or does not
hold at all. The first is ordinary. The second is a dangling end — kept,
reported, drawn as a stub, never dropped by a save.

### 6. Views: what is on it, and where it ended up

Two files, two questions:

```ts
// diagrams/<id>.json — WHAT is on it, and what that means. Hand-writable.
type Diagram = {
  id: string
  kind: 'landscape' | 'container' | 'sheet' | 'map'
  name: string
  asOf?: string                 // the day this view shows (ADR-0009)
  author?: string; client?: string; documentDate?: string; showTitleBlock?: boolean

  members: { id: ElementId; zone?: Zone; group?: string }[]   // present = on this view
  groups?: { id: string; name: string; color?: string }[]     // a dashed group: a name and a colour
  lines?: { relationId: string; sourceSide?: Side; targetSide?: Side }[]   // a CONSTRAINT the router honours

  subjectId?: ElementId         // container: the application opened up
  journeyId?: ElementId         // sheet: the step tree drawn across the top
  lanes?: ElementId[]           // sheet: which actors get a row of their own, in which order (§4)
  areas?: ElementId[]           // sheet: which function roots, in which order
  showActors?: boolean          // sheet: the rail

  aspectConfig?: AspectConfigEntry[]; showAspects?: boolean; autoRoute?: boolean
}

// diagrams/<id>.geometry.json — WHERE. Numbers. Regenerable. Deletable.
type Geometry = {
  needsLayout?: true            // a machine wrote this and nobody has looked yet
  canvas?: { width: number; height: number }
  zones?: Partial<Record<Zone, { size: number }>>
  nodes: { id: ElementId; x: number; y: number; width?: number; height?: number }[]
  groups: { id: string; x: number; y: number; width: number; height: number }[]
  routes: { relationId: string; waypoints: Point[]; labelPosition?: Point }[]
}
```

Consequences that fall out:

* **Membership moves to the definition.** An element is on a view because
  `members` says so, not because a coordinate exists for it. A view whose
  geometry file is deleted is laid out again from a complete list — today's
  rule, and now it is literally true.
* **A group is a thing with an id.** Rename it: one line in the definition.
  Resize it: one line in the geometry. Nothing else moves.
* **The geometry file can be left out of a review.** A diff of the definition
  says what changed on the drawing; the diff of the geometry says how much
  moved, which `model/diff.ts` already reduces to a count.
* **Two kinds never have geometry.** A `sheet` and a `map` are *laid out*:
  trees, order and depth are model, and the page is computed from them. No
  drag, no router, no worker, no cap — and `diagram.render` for an agent
  is the same computed page.
* **A zone is the view's, not the element's** — which is the whole reason two
  kinds could be retired in §4.

The four view kinds:

| kind | over | drawn | what it is for |
|---|---|---|---|
| `landscape` | applications, actors, flows | canvas, zones, routed | what runs and what talks to what, on one day |
| `container` | one application's components | canvas, routed | C4 level 2 |
| `sheet` | a journey, areas, actors | laid out | the business architecture, one page — the example that started this |
| `map` | functions × applications (`supports`) | laid out | the enterprise map: which capability is supported by what, across domains, with the gaps |

### 7. Documents, decisions, plans: at every scope

Nothing changes in what they are. What changes is that they exist at every
level, because every level is a scope:

* **A page per element per scope** — `docs/<id>.md` — is the owner's account
  in the owning scope and a *perspective* everywhere the element is a
  stand-in. "The history of `erp`" is the union of those files across the
  tree, which `historyPath` can say because ids are global.
* **Decisions** keep their record, their status machine and their per-list
  numbering. `applicationId` becomes `subjectId`: a record may be about any
  element the scope knows — an application, a function, a journey step — or
  about the scope itself. The organisation's decisions are the root's list.
  There is no fourth mechanism.
* **Plans** may sit at any scope and name any id in the tree; a plan at the
  organisation that retires retail's `legacy-erp` into finance's `erp` is one
  record, and the two domains' roadmaps both show its shadow run, because
  plans are read up the tree as well as at the scope.
* **A process's page holds its BPMN**, as a ```bpmn fence, the way a plan's
  page holds its business case. Drawing it is a later renderer; storing it is
  markdown today.

### 8. Time, everywhere it can be

Unchanged from ADR-0009 where it exists, and extended where it did not:

* elements: `lifecycle` and `lifecycleDates` — now on functions and actors too
  (a capability being built, a partner being onboarded);
* relations: `validFrom` / `validUntil` on every type (§5);
* views: `asOf`;
* plans: a window and milestones;
* decisions: a date.

The roadmap therefore reads the business layer with the arithmetic it already
has. "Fulfilment is supported by the WMS from March, and by nothing before" is
the same shape as a shadow-run interface, and the same check reports the gap.

### 9. What is derived, and what is checked

Nothing in this section is stored. Each is computed from the tree at open and
refreshed by the watcher, and each has a place it is drawn.

| derived | from | drawn where |
|---|---|---|
| the register | every application definition, by id | the organisation's register page; `register.list` |
| who names it / who owns it | definition depth (§2) | the element's page header |
| who draws it | stand-ins | the element's page: "also on …" |
| conflict — two definitions, same depth | the index | a finding on both scopes, and the register |
| drift — a stand-in's `name` or `ref` disagrees with the tree | the index | a finding on the scope; a *refresh* command rewrites the caches as one undo step |
| dangling — a stand-in nobody defines, or a relation end nobody holds | the index | a finding; drawn as a stub |
| unmapped function — no `scopes`, no stand-in below | §3 | the organisation sheet, in its own band |
| uncovered function — no `supports` and no `assigned` | relations | the map; a function with `assigned` only is *manual*, which is an answer and not a finding |
| a master drawn nowhere | views | the register page, as information; a thing can be real and not yet on a board |
| proposal — a domain function with no definition above | §2 | the organisation sheet, marked |
| unattributed — `outside` with no `partyId` | the record | the register, the landscape |
| the enterprise map — `supports` rolled up under each function across domains | relations, the index | the `map` view |

A finding is a value with a key (`platform/errors.ts` style), never a refusal,
and never a reason a save fails.

### 10. Sessions and editing

**A master record and a drawing are two acts.** *New application* creates
the master in the open scope's model, and may — or may not — put it on the
active view; placing an existing thing on a view creates a member, never a
record. A master with no view is ordinary (§9). A drawing with no master
anywhere is a dangling stand-in, and *link* is how it gets one. The record is
never a by-product of the picture.

**A session opens one scope.** It holds that scope's model on its command
stack, and it holds the index read-only. Everything a keystroke or an agent
does is a `Command` against the open scope, exactly as now. Three rules
decide what a command may touch:

* A **definition** this scope holds: everything.
* A **stand-in** this scope holds: its `description` (the perspective), its
  presentation, its membership on views, its children. Its `name` and `ref`
  are caches — a refresh command rewrites them; a person does not.
* Anything the owner's detail says about a stand-in — lifecycle, dates,
  aspects, vendor: **refused as a value**, with the owning scope's path in the
  refusal, so the UI can offer to open it. `mayEdit(id, scope)` is the one
  function that says so.

Git has no permissions; ownership is the folder plus this check plus, where a
team wants it enforced upstream, `CODEOWNERS`.

**Four gestures cross scopes**, and they are the only ones:

| gesture | what it writes | undo |
|---|---|---|
| *link* — a local definition becomes a stand-in of an existing id | this scope only (drop the detail, set `ref`) | ordinary |
| *promote* — move a definition up to an ancestor, leave a stand-in here | the ancestor, then this scope | two-scope; confirmed, and the stack refuses to undo past it |
| *demote* — the reverse | this scope, then the ancestor | as above |
| *transfer* — move a definition to a sibling | the sibling, then this scope | as above |

Write the *other* scope first, then this one — the same ordering as a group
move today, for the same reason: failing halfway must leave a duplicate, never
a hole.

### 11. From today's folder to this one

The folder format goes from 3 to 4 and the working file with it. **Opening
an old folder transforms it**, the way versions 1 and 2 of the working file
open today and version 3 is what gets written — except that this one is a
whole tree rather than a file, so it is an explicit pass rather than a quiet
rewrite on save: a snapshot first where the folder has git (ADR-0008 keeps
what it looked like), every scope rewritten, the superseded files —
`project.json`, `group.json`, `.placements.json` — removed by the migration
itself, because the store's own rule is to remove only what the format
writes and the format no longer writes these. A browser tab does the same
pass over its keys. An older build opening a migrated folder sees no projects
in it, which is the honest answer and the same one `isWorkingFile` gives a
file it does not know. Every step is mechanical and has a clear inverse:

| today | tomorrow |
|---|---|
| `project.json` | `scope.json` (`kind: 'landscape'`) |
| `group.json` + its `decisions/` | the domain's `scope.json` and `decisions/` |
| `.lionsville-architecture/folder.json` → `organisation` | the root's `scope.json` |
| `model.customerName` | the root scope's `name`; dropped from the model |
| `connections` | `relations`, every row `type: 'flow'` |
| `externalSystem` | `application` + `outside: true` |
| `inputChannel` / `managementTool` | `application`; the element's zone on each view it was on |
| `parentApplicationId` | `parentId` |
| `placements[].zone`, `.domainGroup` | `members[]` on the definition; groups get ids |
| `layoutConfig.domainGroups` rects, `canvas`, `zones` | the geometry file |
| `<id>.placements.json` | `<id>.geometry.json` |
| `Adr.applicationId` | `subjectId` |
| ids unique per project | ids unique per tree — a collision on migration is a *conflict finding*, not a stop |

**The interchange format does not change.** It is a contract with other
tools and an export of *one scope*: stand-ins go out as elements with their
cached names, relations of type `flow` go out as connections, and everything
else is a new optional field an older reader ignores. `solution-design/v1`
keeps its name, and the round trip that pins a byte-for-byte v1 import →
export keeps passing, because a landscape with no stand-ins and only flows
is the format it always was.

## Consequences

* **One document shape** replaces three records (project, group profile,
  organisation setting) and three ADR lists. The picker becomes a tree; the
  store becomes one `ScopeStore` over paths, and `describeProjectStore`
  becomes its contract with two more clauses: a scope's children, and a
  reserved name refused.
* **Ids become organisation-wide.** `idPolicy` takes the index's set of taken
  ids, not the document's. Every closed-model function — `equality`, `diff`,
  `restore`, `clipboard`, `textSearch`, porting, the agent's `answer` — gains
  one case: an id it holds only as a stand-in, or not at all, which it must
  tolerate and never drop.
* **Loading gains a context.** Opening any scope also builds the index. The
  watcher invalidates it. It is the first thing in the app that reads more
  than one folder, and ADR-0004 gives it a budget.
* **Two kinds of "external" become three facts** (`ref`, `outside`,
  `partyId`), and three element kinds become one kind and a zone. Every
  switch over `ElementKind` shrinks; the palette offers *application* and the
  view offers *where*.
* **A drag writes a file with no meaning in it**, and a review can skip it.
* **The interchange format does not change.** It is an export of one scope:
  stand-ins go out as elements with their cached names, `flow` relations go
  out as connections, and everything else is an optional field an older
  reader ignores. `solution-design/v1` keeps its name, and the byte-for-byte
  round trip keeps passing, because a landscape with no stand-ins and only
  flows is the format it always was.
* **Findings, not refusals**, for every organisation-wide fact: conflict,
  drift, dangling, unmapped, unattributed. A save never fails on any of them.
* **The `folder.json` organisation section is transitional.** It stays until
  the root has a `scope.json`, then goes.

## What this takes, in order

A sketch, and the least settled part of this record; each line is a stretch
of work with its own tests, and most of them can land behind the current
format before the format turns.

1. **Relations with a type.** `connections` → `relations`, every row `flow`,
   a window on every row. Format-neutral: the file keeps its shape until the
   version bump.
2. **Views apart from geometry.** `members`, `groups` with ids, `lines`;
   `.placements.json` → `.geometry.json` with numbers only. The migration is
   one pass and the round trip pins it.
3. **The business kinds and the sheet.** `actor` as a tree, `step`,
   `function`, `process`; the laid-out `sheet` view; the fictional example
   gets a journey and areas. Still one scope; nothing federated yet.
4. **Scopes.** `scope.json` at every level, the root included; `ScopeStore`
   and its contract; the picker as a tree; `GroupProfile` and
   `customerName` dissolved. **Format 4.**
5. **One identity.** Organisation-wide ids, `ref`, the index, the checks, the
   register page, `mayEdit`, the four gestures.
6. **The map**, and `supports` / `serves` / `realises` / `assigned` drawn
   and rolled up.
7. **The agent**: `scope` on every tool, `register.list`, URIs with a path.
8. **BPMN**, as a renderer for a fence that already stores.

## Open questions

* **Which scope a new master lands in.** The open scope, by the rules — and
  that is right when a domain draws its own boards and wrong when a landscape
  three levels down sketches an application the domain should hold. *Promote*
  fixes it after the fact; a folder-wide setting naming the scope masters go
  to (`folder.json`, the shared scope of ADR-0005) would fix it before, at
  the cost of *New application* writing two scopes. Not decided; the check
  that says "a master below its domain" is enough to start with.
* **Nested domains and the sheet chain.** `acme/rail/rolling-stock` gives
  `rail` a sheet refining `acme`'s and `rolling-stock` refining `rail`'s. The
  rules generalise; whether the pages should draw three levels or two is a
  question for the second real organisation.
* **Two-scope undo.** Confirm-and-forbid is the honest first answer. A stack
  that spans scopes is possible and is not worth building until the fourth
  gesture is used in anger.
* **A `.lvarch` of a subtree.** The working file is a scope zipped; a domain
  exported alone carries stand-ins whose definitions are not in the zip. They
  open as dangling — which is true — and the question is whether the export
  should offer to inline them.
