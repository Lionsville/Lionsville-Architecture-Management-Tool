# ADR-0040 — The agent keeps the tree of scopes, and the sheet's functions are mapped to domains

* Status: accepted 18 October 2026; as built, 18 October 2026, the tree's
  tools (§1–§3), the paths checked (§4, the agent's half) and the links made
  findable (§7) — *As built, 18 October 2026: the tree's tools*, below; the
  sheet's editor, the claim and the band (§4–§6) not yet built
* Date: 2026-10-18
* Deciders: Wouter Simons
* Extends: ADR-0011 Q1 (the tree's four gestures are tools; a removal that
  takes work with it needs the person's own words), ADR-0012 §1 (a scope made,
  described, moved and removed by an agent), §3 (a claim is made by a gesture,
  and the two answers are read together) and §9 (*not yet mapped* reads
  both), ADR-0019 (the tree's tools drive, from a home as from a workspace),
  ADR-0036 §13 and its amendments of 13 and 17 October 2026 (a unit's and a
  function's domains checked against the tree; the `scope.describe` tool its
  *Open here* named)

## Context and Problem Statement

ADR-0011 settled what an agent may do: everything a person can do on a page,
through the same command. Two pages were left out of that sentence without
anyone deciding it.

**The tree of scopes.** The organisation screen makes a scope under another,
with a first board or without and served by a unit from the start; its
settings rename it, describe it, give it a kind or a unit type, a client and
links, and file it somewhere else; its tree removes one. The agent has
`scopes.list` and nothing else. An agent asked to set up the domains an
organisation has named, or to put a landscape under the domain it belongs to,
hands the whole job back. ADR-0036's amendment of 17 October said the same of
one field: a host with no screen cannot give a scope its type, and *a
`scope.describe` tool closes that*.

**The organisation's business sheet.** Three facts link the sheet to the
tree, and ADR-0012 §3 and ADR-0036 name all three:

1. **A unit answers for a function**: an `assigned` row from the unit to the
   area, grouping or capability. The sheet's *Assigned to* writes it, and so
   does the agent's `relation.add`; nothing tells an agent that this is the
   row it is looking for.
2. **A function is handed to a domain**: the function's `scopes`, the
   organisation's intent, top-down. The agent writes it with `element.update`
   and nothing checks the paths; the sheet shows it — the area's domain on its
   card, the *not yet mapped* band, the count on the organisation's card — and
   has no editor for it at all. A person cannot hand an area to a domain.
3. **A domain takes a function up**: a stand-in of the function in the
   domain's own sheet, bottom-up, *claimed* in ADR-0012's word. The record
   shape has had it since 2.0.0, and a refinement is that stand-in with
   children of the domain's own. Nothing makes one: the library offers
   applications and technology, `element.add` takes no `ref`, and the only
   tool that writes a stand-in is `technology.use`. And *not yet mapped*
   reads only the second fact, so a function every domain has taken up is
   still waiting for one.

Finally, the paths a unit's or a function's `scopes` name are written as
given. A unit said to serve a scope that is not there, or a function handed
to one, is a link to nothing that the screens draw as a domain nobody can
open, and the checks then reason about it.

## Decision Drivers

* **An agent can do what a person can** (ADR-0011), and a person decides
  what cannot be taken back. Removing a scope with work in it is the one
  gesture on these pages with no ⌘Z.
* **One gesture, one step, under that scope's rights.** A scope's header is
  that scope's step; a unit's `scopes` is the step of the scope that keeps
  the unit (`units/writeIn.ts`); a claim is the claiming scope's.
* **A refusal is a key**, and says what is in the way.
* **Two hosts, one vocabulary.** The desktop has a screen, a banner and an
  open session; the server has grants, an audit log and no screen. The tools
  are core's, the seam each fills is one shape.
* **No format turn in a point release** where the record shape already holds
  what is said.
* **The tree is changed one way.** The organisation screen and the agent
  make, describe, move and remove a scope through the same operations.

## Considered Options

### Q1: How does an agent change the tree?

* **A.** One tool per field of the settings dialog.
* **B.** Four tools, one per gesture the organisation screen has: make,
  describe, move, remove. *Chosen.*
* **C.** A `scope.describe` tool for the header alone, as ADR-0036's open item
  named it, and the rest left to a person.

### Q2: How is removing a scope with work in it kept a person's decision?

* **A.** Never: an agent removes only an empty scope.
* **B.** A flag that removes whatever is there.
* **C.** Refused by default, saying what is in the way; allowed only with
  the person's own words quoted in the call, one scope per call. *Chosen.*
* **D.** A confirmation dialog on the person's screen.

### Q3: Where is a function claimed?

* **A.** At the scope above: the function's inspector offers *taken up by…*
  and writes a stand-in in the scope below.
* **B.** In the scope that claims it: its sheet offers the functions of the
  sheets above, and taking one is a stand-in in its own session. *Chosen.*
* **C.** Both ends, as a unit and what it serves link from either end.

### Q4: Does claiming also hand the function to the domain?

* **A.** Yes: one gesture writes the stand-in below and `scopes` above.
* **B.** No: two facts, two gestures, read together. *Chosen.*

## Decision Outcome

Q1 B, Q2 C, Q3 B with the claim shown at the other end, Q4 B. Option A of
Q1 is fifteen tools for one dialog. C closes the open item and leaves the
job it came from — set up the domains — undone. Q2 A refuses the owner's
case outright, a tree somebody has decided to clear; B makes the one
irreversible gesture the cheapest; D has no screen to stand on in an
environment, and on the desktop it would be a second way of asking what
the person has just been asked in chat. Q3 A writes into a scope from
above, which is the direction a claim is not: a claim says the domain took
the thing up, and only the domain can say that. Q4 A would let a domain
write the organisation's intent by taking a function, which is the
difference ADR-0012 §3 draws the two answers to keep.

### 1. The tree's tools

Four tools, about the tree rather than about the scope open, answered with
or without a scope open (ADR-0019) and listed with the people register's as
taking no `scope` and no `ifRevision` (`ON_THE_TREE`, beside
`ON_THE_REGISTER`). Each names the scope it is about by `path`. Every one
is a write: it drives, starts the banner on the desktop, is refused
`agent.stopped` after a Stop, and lands as a step attributable to the person
via the agent. No `batch` holds one, as none holds `person.add`.

* **`scope.create`** — `parent` (a path, `""` the organisation), `name`, and
  optionally `withBoard` and `servedBy`, the four things the new-scope
  dialog asks. The address is the one the dialog would give it: the name's
  slug under the parent, a reserved word or a taken one suffixed, and said in
  the answer. With `withBoard` it is a landscape scope with one board; without,
  a domain. `servedBy` is a unit: once the scope is there, the unit's
  `scopes` is written in the scope that keeps the unit, and the new scope
  takes the unit's type in the same apply, as *Served by* does. A link
  refused leaves the scope made and says where the link is made instead.
  Refused: a `parent` that is not there (`agent.unknownScope`), an empty
  name (`agent.badArguments`), a unit that is not one (`agent.unknownId`).
  Answers the path, the name, the kind, the board's id and what the link
  came to.
* **`scope.update`** — `path`, and any of `name`, `description`, `kind`,
  `unitTypeId`, `client`, `links`; null clears an optional field. What the
  settings dialog writes, as the two steps it writes them as: `project.settings`
  for the name and the description, `scope.describe` for the rest, one
  change. A kind and a unit type are never both said: one given clears the
  other, both given is `agent.badArguments`, and a unit type the operating
  model does not hold is `agent.unknownId`. The organisation is described
  like any scope. This is the `scope.describe` tool ADR-0036's open item
  asked for, under the vocabulary's own verb.
* **`scope.move`** — `path` and `parent`: the scope and everything filed under
  it to a new address under `parent`, its last segment kept, suffixed where
  taken. Every identity, state and history goes with it (the port's
  `move`), and every stand-in elsewhere that named an address in the
  subtree is re-addressed as that scope's step, as the settings dialog does
  (`moveScope`). A stand-in kept in a scope the person may not write is not
  re-addressed: the move stands, the answer lists it under `notCarried`, and
  `check.drift` says it until somebody who may write there refreshes it.
  Refused: the organisation (`scope.organisation`), a parent under the scope
  itself (`shell.scopeIntoItself`), a parent that is not there
  (`agent.unknownScope`). The same parent is an answer that nothing moved.
* **`scope.remove`** — `path`, and two arguments that are only ever set
  together, `removeContents` and `personSaid` (§2). One scope per call.

The repository's own refusals arrive as the agent's keys: `shell.scopeMoved`
as `agent.stale`, `shell.scopeReadOnly` as `agent.readOnly`,
`shell.scopeGone` as `agent.unknownScope`; `shell.scopeTaken` and
`shell.badScopePath` pass through.

### 2. Removing a scope

**An empty scope goes on request.** Empty is said once
(`projects/scopeHolds.ts`): no views, no elements, no relations, no
decisions, no plans, no observations, causes, solutions or experiments, no
assignments, no comments, no marks, nothing of the operating model and no
pictures — and **no scope filed under it**. What a scope says about itself,
its name, description, kind, client and links, is not work and is not in the
way.

**A scope with scopes under it is never removed in one call**, whatever
else the call says: `scope.scopesBelow`, with the paths below that the
person may read and how many they may not. The scopes below are removed
first, deepest first, each its own call, each meeting this rule itself. The
port's `remove` takes a subtree; the tool never asks it to, so a person never
finds a tree gone that they agreed to one branch of. On a host that hides
scopes from a person, the count is of the whole tree, not of what they see:
a removal that took a scope they cannot see would be the worst way to learn
it was there.

**A scope that holds work is refused** `scope.notEmpty`, the detail counting
what it holds by kind and naming the views. The sentence tells the agent what
to do: tell the person what is in it, and only if they then say in their own
words that it is to go with all of it, call again with `removeContents: true`
and those words in `personSaid`. Never on its own judgement, never because a
call was refused, never with words it wrote itself.

**The override is the person's words, carried.** `removeContents` without a
`personSaid` of a few words is `agent.badArguments`. The words are not
checked — nothing can check that a person said them — but they are carried:
in the answer, in what the host records of the removal, and in what the
person is shown. That is what keeps *a person decides what cannot be taken
back* honest without a screen to ask on: the decision is the person's in
chat, and the record says whose words it rested on. The answer says what
went, by kind, the same counts the refusal named.

The removal itself reads the scope and removes it expecting what was read,
so a scope somebody added to between the count and the removal is
`agent.stale`, and nothing goes that was not counted.

### 3. Where each host differs

**The desktop** fills the seam over its repositories, as the organisation
screen does (`ShellView.scopes`, beside `people`). A change to the tree is
each scope's own step under that scope's rights, never a step on the open
session's stack (the rule `units/writeIn.ts` keeps), and the tree and the
index are read again after it. Because it is never the session's, **the
scope open in the workspace is the session's to change**: describing it,
moving it, removing it, and moving or removing a scope above it, is refused
`scope.isOpen`, whose sentence says to open the home of the scope, or of the
one above, first (`app.open` with `page: home`) — where a person changes the
tree too. Making a scope anywhere, and describing a scope above, need nothing
moved. A removal that took work with it is said on the person's screen as
well, naming what went and that it was at their word, because there is no
⌘Z for it.

**A host with no screen** fills it over the person's own repositories: the
steps are by the person, via the client's name, through the agents' door, so
they are in everybody's Activity list and the scopes' histories as every
agent write there is. Who may write is the person's rights at each address,
asked before anything is built and asked again where the steps land: both
ends for a move, the parent for a create. A host that grants rights by
address takes them off the path a removal took, as its own removal of a scope
does, and the answer says how many people's rights went; a host that keeps a
record of what was done there records the path, what the scope held and the
person's words. Nothing is open there, so `scope.isOpen` is never said.

### 4. A function handed to a domain

**The sheet gets the editor.** The function inspector on any function a
scope defines gains *Domains*: a chip for each scope in its `scopes`, taken
off with its ×, and a picker offering the scopes below the one that defines
it, by name and type. Each change is one `element.update` of `scopes`, one
step, through the sheet's own `updateElement`. A stand-in shows no editor:
its domains are the definition's, as ADR-0012 §10 has it for every owner's
field.

**The agent's `element.update` and `element.add` check the paths**, for a
unit's `scopes` and a function's alike, and so does every `batch` that holds
them: a path the tree does not hold is `agent.unknownScope` with the index of
the offending entry, `""` is dropped for both — the organisation is no
domain, for a function as for a unit (ADR-0036, amended 13 October) — and a
function's domain must lie below the scope that defines it, because handing a
function to a domain is said by the scope above it
(`agent.badArguments`). A unit's domains may be any scope but the
organisation, as before. Where no tree is lent the paths are taken as given,
as an id is.

*Owner's default, open to overturning*: a function's domains lie below the
scope that defines it. Handing an organisation's function to a scope beside
the one that would define it has no reading in ADR-0012, and refusing it now
is cheaper than finding it in a sheet later.

### 5. A function claimed by the scope below

**A claim is a stand-in**, made in the claiming scope's own session as one
step: the definition's caches and nothing of the owner's detail
(`projects/library.standInOf`, the record `technology.use` already writes),
filed under its parent where this scope holds that parent, and otherwise a
root of this scope's sheet — added to the sheet's areas where the sheet
lists them, so it is drawn and not lost. What the domain does with it then
is a refinement, which needs nothing new: its own capabilities under it, its
units on its rows, its applications supporting it.

**Only a function of a scope above.** The definition's master must be a
scope strictly above the claiming one: `claim.notAbove` otherwise, naming
where it is defined, and `claim.definedHere` for a function this scope
defines. A function this scope holds already is an answer, not a refusal.
Taking it back is `element.remove` of the stand-in, refused while the domain
has filed its own under it, as any removal with children is.

**On the screens**: the claiming scope's sheet offers *From above…* beside
*+ area*, the functions of every sheet above it grouped by the scope that
defines them, each with the areas it sits under; a function already held is
not offered. At the other end, the function's inspector says *Taken up by*
under *Domains*: every scope that holds a stand-in of it, each a way to that
scope's home, a scope that took it up without being handed it marked in the
warning colour, and a domain it was handed to that has not taken it up shown
as not started. Read off the index, never written there.

**The agent**: **`function.claim`** — `id`, the function above, and
`diagramId` where the scope has several sheets — in the claiming scope's
`scope`, as every scoped write. On the desktop that scope must be open, as for
any write there. `element.describe` of a function answers its `domains`
(its `scopes`) and `claimedBy` (the scopes that hold it as a stand-in).

**Q4, said once more**: a claim writes nothing at the scope above, and
handing a function to a domain writes nothing below. They are two statements
by two scopes and are read together, as ADR-0012 §3 drew them.

### 6. What *not yet mapped* reads

A function root is **not yet mapped** while neither it nor anything filed
under it has been handed to a domain or taken up by one: no `scopes` on any
of them, and no scope below the one that defines the root holding a stand-in
of any of them. A stand-in is never itself waiting: it is the claim. The
rule stays `business/sheetDiagram.unmappedFunctions`, handed what was taken
up below by the host, because `business` reads no tree; the band, the count
on the organisation's card and `check.unmapped` read it alike. Anything filed
under the root counts because the band is of roots and a capability handed
on its own has been handed to somebody; counting a capability's domain as
not the root's was the old reading's silence about where the editor would be.

A function handed to a domain that has not taken it up, and one taken up
without being handed, are drawn in the inspector and not yet findings. They
are ADR-0012 §3's *both findings, neither an error*, and are left open below.

### 7. Who answers for a function, found

The `assigned` row needs no tool: `relation.add` with `type: assigned` from
the unit to the function, written in the scope that defines the function,
the unit kept anywhere (ADR-0036, amended 11 October). It is made findable:
`scopes.list`'s description names the four tree tools and the three links,
`relation.add`'s and `element.update`'s say which link each writes, and the
instructions both hosts hand over at connect gain two paragraphs, one on the
tree and one on mapping the sheet: who answers for a function, which domain it
is handed to, which domain took it up, and that the three are told apart.

### 8. The scope format

**The format stays at 14.** A stand-in of a function is an element with
`ref`, kept in the claiming scope's model as every stand-in has been since
format 5; a function's domains are its `scopes`, which format 5 carries; and
nothing in a scope's header is new. A build before this one reads a claim as
the stand-in it is, draws it, and refreshes it.

## Consequences

* Good: the tree can be set up and tidied by an agent, from the
  organisation's home or a workspace, on the desktop and in an environment.
* Good: a scope with work in it goes only at the person's word, and the word
  is kept; a subtree never goes in one call.
* Good: all three links between the business sheet and the tree have a page
  and a tool, and the band reads two of them.
* Good: a path a unit or a function names is a scope that is there.
* Bad, accepted: on the desktop the agent leaves the open scope's place in
  the tree alone, and renaming the scope on screen is three calls — the home,
  the change, and back. The other reading, landing it through the session,
  would put a tree change on an undo stack that cannot take it back whole.
* Bad, accepted: `personSaid` is the agent's report of what the person said.
  Nothing can prove it, and the record says so by keeping it as their words,
  not as a confirmation.
* Good: the organisation screen's own making, describing, moving and
  removing go through the same operations as the agent's, so the two cannot
  drift apart.
* Neutral: *not yet mapped* counts fewer roots in an organisation whose
  domains already hold stand-ins or whose capabilities were handed one by
  one.

### Confirmation

* `agent/scopeTree.test.ts`: each tool over a fake seam — every refusal of
  §1 and §2, the override without words, a removal that met a scope changed
  since it was counted, scopes below counted beyond what the person sees.
* `handle.shell.test.ts`: the four answered with nothing open, driving, and
  refused after Stop; `batch` refuses them.
* `projects/scopeTree.test.ts` and `scopeHolds.test.ts` over the memory
  repositories: made with and without a board, served from the start with the
  type following, described, moved with the stand-ins carried and one not,
  removed.
* `agent/write` and `handle.test.ts`: `scopes` paths refused, `""` dropped
  for a function, a domain outside the defining scope refused; `function.claim`
  as root and under a held parent, drawn on a sheet that lists its areas,
  each refusal; every write still marked the agent's.
* `business/sheetDiagram.test.ts`: the band's four cases. The inspector's and
  the sheet's tests: *Domains*, *Taken up by*, *From above…*.
* A host with no screen runs the same tools over its own seam, through the
  agents' door as the person, with a reader refused, a claim landing, and the
  tree read again after a change.

## Amendments this implies

* **ADR-0011 Q1** — the tree's four gestures are tools; removing a scope that
  holds work is refused unless the call carries the person's own words, one
  scope per call.
* **ADR-0012 §1** — a scope is made, described, moved and removed by an agent
  as by the organisation screen; §3 — a claim is made by a gesture in the
  claiming scope, and the two answers are read together; §9 — *not yet
  mapped* reads both, over a root and what is filed under it.
* **ADR-0019** — the tree's tools drive with nothing open, as the register's
  do; with a scope open, the desktop refuses changing that scope's place in
  the tree (`scope.isOpen`).
* **ADR-0036 §13 and its amendment of 17 October** — the open item *a
  `scope.describe` tool* is closed by `scope.update`, on every host; a unit's
  and a function's `scopes` are checked against the tree, and `""` is dropped
  for a function as for a unit.

## Open

* **Two findings ADR-0012 §3 promised**: handed and not taken up, taken up
  and not handed. Drawn in the inspector now; a check each when the catalogue
  is next opened.
* **A move and rights by address**: whether a host that grants rights by
  address takes them off the addresses a moved scope left, as a removal
  does, is the host's to decide and is not changed here.

## As built, 18 October 2026: the tree's tools

**The seam** is `agent/scopeTree.ts`: `ScopesView` on `ShellView.scopes`,
beside `people`, and `answerTree`, which the handler calls for the four with
or without a scope open (`handle.ts`'s `aboutTheApp`; a tree tool drives with
nothing open, as the register's do). The shapes are as this record's build
plan drew them. What every host gets for nothing is checked there: the
arguments, a `parent` or a `path` that is not there — asked of `read`, which
is fresh, rather than of the tree's listing, which a host may read again a
moment after its own write — the organisation neither moved nor removed, a
kind and a unit type said together, a unit type or a unit the organisation
does not have, a parent under the scope, a move to where it is filed already,
the subtree rule and the emptiness rule — and a scope not read whole, part
of it unreadable, written by a later version or with no document, or read
with no revision to expect, which is never removed from here
(`scope.unreadable`, `ScopeRead.unreadable`): what could not be read is not
known to be empty. A `path`, a `parent` or a `name` that is not text — null
passes the schema check — is `agent.badArguments`. `withBoard` defaults to false: the
agent names a landscape when it wants one, and a scope it makes without is a
domain. `personSaid` is at least three words, trimmed, and only ever with
`removeContents`. `ON_THE_TREE` in `tools.ts` takes `scope` and `ifRevision`
off the four; `write/handlers.ts` lists them as answered by the session, so
no `batch` holds one.

**The operations** are `projects/scopeTree.ts` — `createScopeAt` (the
dialog's address; `ancestors: 'make'` for the screen, which makes missing
scopes above as domains, `'required'` for the agent), `serveScopeBy`,
`writeSettings` and `settingsCommands` (the dialog's whole form),
`describeScopeAt` (a patch of only the fields that differ), `moveScopeUnder`
(the dialog's destination; `strict` for the screen, which still fails a save
whose carry was refused, the agent's otherwise, with `notCarried`) and
`removeScopeAt` — and `projects/scopeHolds.ts` for what a scope holds,
what empty is and whether a scope was read whole (`readWhole`).
`scopesAMoveWrites` says which scopes outside a subtree a move of it would
write, before anything moves.

**A removal takes one scope alone**: `ScopeRepository.remove` gains a third
argument, `{ leafOnly: true }`, under which the repository removes the scope
only while nothing is filed under it — a scope, or a folder of one it could
not read — and refuses `shell.scopeHasChildren` otherwise, decided inside its
own serial section, so a child filed between the agent's look and the
removal is never taken with it. The contract suite holds every repository to
it (*removes one scope alone where asked to, and refuses it while anything is
filed under it (leafOnly)*); the memory, browser and folder repositories keep
it, `removeScopeAt` looks again just before the call, and the screen's
delete of a subtree is unchanged. `scopeAccess.moveScope` takes a `Carrying` to be told each
carry rather than throw one, and `typeFollowingUnit` moved to
`projects/scopeType.ts`. **The organisation screen's create, settings save
and delete go through them** (`useOrganisation.ts`), its tests unchanged.

**The desktop** fills the seam in `app/agentScopes.ts` (`useAgentScopes`,
wired in `App.tsx`): `scope.isOpen` for describing the open scope and for
moving or removing it or a scope above it, and — because nothing is written
behind the open session — for linking a unit kept in the scope open (the
answer says to write its `scopes` there with `element.update`; a
`scope.create` with `servedBy` makes the scope and says so of the link) and
for a move that would re-address a stand-in, a cause or a line kept in the
scope open; `agent.readOnly` before anything is
built where the person may not write the scope, the parent or, for a move,
either end; the repository's `shell.scopeReadOnly`, `shell.scopeMoved` and
`shell.scopeGone` as `agent.readOnly`, `agent.stale` and
`agent.unknownScope`, and a scope nobody can read in the way as
`shell.scopeTaken`. `hiddenBelow` counts the addresses under the scope the
tree could not read. After a write the tree and the index are read again,
and the answer waits — at most three seconds — until the listing the next
call reads says what landed: the path made or moved, the name, kind or type
described, the unit's `scopes` and the type it gave. A removal always
expects the revision it read, and is `leafOnly`; `shell.scopeHasChildren`
arrives as `scope.scopesBelow`. A removal at the person's word is a warning on
screen (`agent.scopeRemoved`), in three languages.

**Paths checked** (§4, the agent's half): `write/elements.ts` refuses a
`scopes` path the tree does not hold (`agent.unknownScope`, `scopes[i]`) and a
function's domain not below the scope defining it (`agent.badArguments`), for
`element.add`, `element.update` and inside `batch`; `""` is dropped for a
function as for a unit. Only a path the element does not name already is
checked, so a list holding a scope hidden from the person, or removed since,
is written back as it stands. A tree says whether its listing has been read
(`TreeView.listed`, false before the first read — `projects/scope.NOT_LISTED`
— and after a failed one), and until it has, the paths are taken as given.
**Findable** (§7): `TREE_TOOLS_PARAGRAPH` in `agent/method.ts`, appended to
the desktop's instructions after `STRUCTURE_DEFAULTS`; `scopes.list`,
`relation.add` and a function's `scopes` say which link each writes.

Tests: `agent/scopeTree.test.ts`, `projects/scopeTree.test.ts`,
`projects/scopeHolds.test.ts`, `app/agentScopes.test.ts`,
`app/App.scopeTree.test.tsx`, and the path checks in
`agent/assignments.test.ts`.

