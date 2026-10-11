# ADR-0036 — An operating model, units as typed actors, and a register of people outside the history

* Status: accepted, 11 October 2026; built in part: the register of people
  (§8–§11, §13's three tools for it) and the operating model (§1's
  `_operating/`, §2, §5, §13's seven tools for it), 11 October 2026 — *As
  built*, below
* Date: 2026-10-11
* Deciders: Wouter Simons
* Supersedes: ADR-0011, in part (Q1's *everything a person can do on a page
  is a tool*: forgetting, removing and merging a person are a person's
  alone, and no tool does them)
* Extends: ADR-0009 Q2 (a plan moves units), ADR-0012 §1, §3 and §5 (two
  folders no scope can collide with, an actor with a type and the scopes it
  serves, and one more row), ADR-0016 (two more laid-out kinds), ADR-0023 §3
  (*This is me* is kept with the install), ADR-0031 §1 (a sixth repository,
  for people)

## Context and Problem Statement

The model already holds half of an organisation. An actor is "a party,
stakeholder, role, team, or a group of them" and forms a tree (`parentId`). An
application says which actor it belongs to (`partyId`), and an `assigned` row
says which actor answers for a function, a step, a platform or a service. Each
actor has lifecycle dates and a successor, as every element does.

What it cannot say:

* **What kinds of unit the organisation has**, which kinds may sit in which,
  and which roles each kind holds. Nothing gives an actor a type. Scope kinds
  are labels that no code branches on (ADR-0012 §1), and the words the UI
  uses for them — domain, team, area — are not the organisation's own.
* **What a role is for**: its purpose, and the responsibilities it carries.
* **Who holds a role**, in which unit, from when and until when.
* **How the organisation changes.** A reorganisation splits a unit, retires
  another and moves the people in them. Plans carry the timing of everything
  else (ADR-0009); they cannot carry this.

And every name the model holds is free text: `owner` on an element and on a
plan, `by` on an observation and an experiment, a decision's `proposedBy` and
`signers`, a solution's `validatedWith`, a view's `author`. Each lands in the
steps, the history, the index, search and stand-ins. Nothing can forget it.
On the desktop the history's author is git's identity, and git keeps an
e-mail address in every commit.

ADR-0012 rejected a register beside the scopes for applications, because a
register edited as a form and saved whole has no undo, no activity and no
history, and ownership is model. People are the opposite case. A person's name
has to be forgettable, and nothing written into a history can be forgotten
without rewriting it. The property ADR-0012 held against a register is the one
a register of people needs.

## Decision Drivers

* **Nothing entered twice.** The actor tree, `partyId` and `assigned` already
  say which team owns what and who answers for what. Whatever is added builds
  on them.
* **The organisation names its own kinds of unit and its own roles.** Core
  ships no unit type and no role. Its own word for an organisational unit is
  *unit*, and for a kind of unit, *unit type*.
* **A correction is an edit; a change has a day.** Fixing a name is an edit.
  A reorganisation happens on a date, and looking at another day shows it
  (ADR-0027).
* **A name lives in one place, and that place can forget it.** Forgetting a
  person changes every screen at once and rewrites nothing.
* **The history is never rewritten.** Not for a person, and not for a merge.
* **An agent can do what a person can** (ADR-0011), except what cannot be
  taken back.
* **Core has no accounts** (ADR-0008). It may hold what a build that knows
  who people are needs, as model data, and grants nothing itself.

## Considered Options

1. **The operating model as a drawing** (ADR-0034). A drawing cannot hold
   instances, dates, vacancies, checks or a move of people, and ADR-0034 keeps
   a drawing from editing the model. It stays the picture.
2. **Units as a new record family beside actors.** It would duplicate the
   actor tree, `partyId`, `assigned`, stand-ins, lifecycle dates and search,
   and leave two answers to "which team".
3. **Units as scopes.** The scope tree is the architecture's, not the
   organisation's. A unit that serves several domains has no single place in
   it, and scope kinds are labels by decision.
4. **People as elements, in the history.** Forgetting would then mean
   rewriting steps, records, the index, snapshots and backups.
5. **A dated parent on every unit.** It would change the one containment that
   every tree and layout reads. A dated move belongs on a plan, and a move
   outside a plan is a correction.
6. **A right to change a unit's people, given by hand.** One more list to
   keep in step with the organisation. A role that manages is already kept in
   step, because people are assigned to it.
7. **Three homes, chosen by what they hold** (below). *Chosen.*

Option 5 can still be added later, if plans prove too heavy for a move.

## Decision Outcome

**Option 7.**

### 1. Three homes

* **The operating model** is records at the organisation (the root scope),
  under `_operating/`: unit types, roles, responsibilities and rules (§2).
* **The organisation as it is** lives in the scopes. Units are actors (§3),
  and who holds which role is an assignment, a record under `_assignments/`
  in the unit's scope (§4).
* **The people** are a register outside the history (§8).

The first two are model: steps, history, undo, the agent, the folder and the
working file. The register is not. Every line from the model into the
register is an id, and the only names the register holds are its own
entries'.

**The scope format goes from 10 to 11.** A scope's name is a slug
(`^[a-z0-9-]+$`, `model/keys.ts`), which never holds an underscore, so no
child scope can collide with `_operating` or `_assignments`. The reserved
names do not grow, and the migration moves nobody's scope: a move would
change the addresses that links and history paths depend on. Should an
underscore prove impossible in some store or interchange, the plain names are
the fallback; a tree with a child scope by either name then stays at format
10, and writing a record of the operating model there is refused with a
message naming the scope to rename.

### 2. The operating model

Edited at the organisation only, in the organisation's own words.

* **A unit type** has a name and a purpose, the unit types it may sit in
  (or the organisation itself), whether a unit of it may serve several
  domains, its role slots — each a role with a minimum and a maximum — and an
  application limit for a check to read.
* **A role** has a name, a short name and a purpose, its duties — each a
  responsibility marked `R`, `A`, `C` or `I` — and `manages`: whether its
  holder manages the unit's people (§12).
* **A responsibility** has a name and a description, and a group, such as a
  value stream.
* **The rules** say what is worked out from roles: an application's owner is
  the holder of a named role in the unit it belongs to (`partyId`), and a
  domain's owner the holder of a named role in its unit. The owner is
  computed on the day it is looked at, so it follows the role and is never
  stored.

Each record is one command with an inverse and its own write key
(ADR-0028). A responsibility without exactly one `A` is a finding.

### 3. A unit is an actor with a type

An actor gains three optional fields:

* **`unitTypeId`**, the unit type. An actor with one is a unit; an actor
  without one stays a party, a stakeholder or a team, as now.
* **`scopes`**, the domains it serves, as a function's `scopes` already says
  which domains a function is assigned to.
* **`extraSlots`**, role slots beyond those its type holds.

Its existing `parentId`, lifecycle dates, successor, `partyId` and `assigned`
rows are its structure and its link to what it owns, so nothing is entered
twice. A unit is filed in the scope it belongs to. A unit that serves
several domains is filed in the scope above them and names each in `scopes`.

**A vacancy is not a record.** It is the type's minimum for a role, less the
people who hold that role in the unit on that day.

**The checks** gain five findings: a required role vacant; more holders than
the maximum; a person over 100% on a day; an assignment in a unit or a role
that has ended; and a unit under a type it may not sit in. The organisation
index lists units and assignments across the tree, as it lists the
application register.

### 4. An assignment

A record in the unit's scope: the unit, the role, the person (an id from the
register, never a name), a share of the person's time, `from` and `until`,
and whether the person is *acting* in the role. Adding, changing and ending
one are commands, with inverses, like every record's.

### 5. Libraries

**Scrum, SAFe, the IT4IT value streams and Team Topologies** ship with the
app as read-only data, in English, Dutch and German. Each offers unit types,
roles and responsibilities to start from. The IT4IT library follows the value
streams of its 3.0 edition. A framework's name says where an item came from,
and the frameworks are named as they are.

**Every description is written in this project's own words**, and nothing is
copied from a framework's publications. That is a reading of the decision to
name them, which can be overturned: naming a framework does not extend to
copying its text, and copied text would bring its licence with it (the Scrum
Guide's is CC BY-SA).

Bringing items in is one step, and undo takes them out again. Each item
brought in keeps `basedOn`, the library entry and the library's version, so a
later version of the library can be compared against it. What was brought in
belongs to the organisation: it can be renamed, rewritten or cut, and nothing
is ever merged into it in silence.

### 6. Change over time

* **Unit types, roles and units carry `from` and `until`** and name their
  successors. A unit's are the actor's lifecycle dates and successor.
* **Assignments carry `from` and `until`.**
* **A reorganisation is a plan.** A plan gains **`moves`**: a unit put under a
  new parent on a day. A plan's shift moves its moves' days with the rest
  (ADR-0009 Q2). A move outside a plan is a correction: an edit of
  `parentId`.
* **Move the people.** The plan lists every assignment in a unit or a role
  that ends on its day, each with a suggestion — where the unit went, or the
  role's successor — which a person accepts or changes. Nobody's new place is
  guessed. Writing it is one step: every old assignment ends the day before,
  and every new one begins on the day.
* **Looking at another day** shows the organisation on that day, past or
  future, as it shows the landscape (ADR-0027).

A new name for a unit, a role or a unit type is an edit.

### 7. Two views, and a row between units

Two new laid-out kinds, and every switch on a view's kind is made exhaustive,
as ADR-0034 did for a drawing:

* **`chart`**, the organisation chart: on a day, with its vacancies, people
  over 100%, assignments left in units that have ended, and the person using
  the app marked (§11).
* **`conway`**, units over the applications they own and the interfaces
  between them. It flags an interface that crosses units with no interaction
  declared between them, an interaction no interface needs, an application
  nobody owns, and a unit over its type's limit. It only reads.

**`interacts` is a new row**, unit to unit, with Team Topologies' three
modes — `collaboration`, `service` (X-as-a-Service) and `facilitating` — and a
window, as every row has. It is filed in the scope of either unit.

A draw.io drawing stays the free-form picture of an organisation. Its boxes
point at units as they point at any element (ADR-0034 §4).

### 8. The register of people

**A person** has a random id that is never derived from the name, a name, an
optional work address, a kind (`internal` or `external`), a state (`active`,
`left` or `forgotten`), the days it moved between them, and `mergedInto` once
merged (§9). A build that knows who people are may link an entry to an
account. Nothing else is kept: no notes, no photo.

**A repository of its own**, `PeopleRepository`, with a contract suite: list,
read, add, change, leave, merge, forget, remove, and what changed since a
revision. Its entries are changed in place. It keeps no history, so there is
nothing to rewrite.

* **On the desktop**, the folder keeps it as
  `.lionsville-architecture/people.json`, listed in `.git/info/exclude` as
  `local.json` was (ADR-0023 §3). It is the organisation's work, not the
  application's configuration, so it stays with the folder. It never enters
  git.
* **The working file and the sealed file carry it.** A file exported
  *without names* carries each entry as its pseudonym instead.
* **Browser storage and memory** keep it as they keep everything else.

**`PersonRef`.** Where a name was free text, a field takes
`{ person: <id> }` when a person is picked from the register, or text as now.
In this release that is `owner` on elements and plans, `by` on observations
and experiments, and a decision's `proposedBy` and `signers`. `validatedWith`
and a view's `author` stay text. An assignment always holds an id.

**History, assignments and picked names hold the id only.** Screens, search
and exports ask the register for the name when they need it. Search matches
the register first and then the ids, so the index never stores a person's
name. A stand-in carries the id.

**A signature keeps its name.** Signing a decision writes the name as signed
beside the id, and the proposer's name is fixed the same way when the
decision is signed. That name is part of the decision record and stays after
the person is forgotten. It is the one place a register name enters the
history, and it is there on purpose.

### 9. One person, one entry

Four signs mark a possible duplicate:

* the same work address;
* the same name, ignoring case, accents and spacing;
* names within two letters of each other;
* the same family name and first initial.

Every way in checks them before anyone is added: the People page, a slot on
the chart, a person picker, and each row of a CSV import. A match is offered
first; adding anyway is allowed, and makes a second entry that can be merged
later.

**A merge keeps one entry** and turns the other into a redirect with no name
(`mergedInto`), so every id in the history still resolves. A merge asks first,
and it is final.

### 10. Leaving, forgetting and removing

* **Left.** Marking a person as left ends their assignments on the last day,
  in one step, and sets the day they left. The name is still shown, marked as
  having left.
* **Forgotten.** After the period the policy sets, the name and the address
  are replaced by a pseudonym drawn at random (*Former colleague 7KQM*), and
  every screen shows it at once. Nothing in the history changes, because it
  never held the name. A signature keeps the name it was signed with (§8).
* **Removed.** After a second period, the entry is removed. An assignment
  that held its id reads *a former colleague*, with nothing to connect one to
  another.

**The policy** is the organisation's setting (`SettingsRepository`, `of:
organisation`): how long a leaver's name is kept (90 days), how long the
forgotten entry is kept after that (730 days), and whether agents see names
or pseudonyms (§13). Administrators set it. Where there are no accounts,
whoever keeps the organisation's work is its administrator. It is a setting,
not a step. Where nothing runs on a schedule, the app applies it when the
organisation is opened and once a day while it stays open.

**A request.** *What we hold* answers a request for access: the entry, the
assignments, every record that points at the id, the signatures with the
names as signed, what is worked out from the person's roles, and a search for
the name across the tree. An erasure request is handled with the same
actions: forget now, then remove now. Forgetting is final: undo does not bring
a name back, because the register keeps no history of it.

**What the register cannot reach**, and says so:

* text: a name typed into a field that takes text, before this release or
  after it, and `validatedWith`, a view's `author`, and prose in descriptions
  and documents. Search finds them, so a request can be answered honestly.
  Changing them is an edit, and the history keeps what they said before;
* a signature, by decision (§8);
* on the desktop, git's own record of who made each commit;
* a copy made before the person was forgotten: a working file handed over, a
  backup.

### 11. *This is me*

A person who finds their own entry is marked wherever they appear: on the
chart, in every table and on the People page, with *Find me* to go there. On
the desktop, *This is me* is a preference kept with the install (ADR-0023 §3),
never in the folder. A build with accounts links an entry to an account
instead.

### 12. A role that manages

`manages` on a role says that whoever holds it manages the unit's people.
Core holds the flag and works out who manages a unit on a day — the holders
of a managing role in it, or in a unit above it — and shows it on the unit. It
grants nothing, because it has no accounts.

A build that knows who people are may grant a right from it: whoever holds a
managing role may change the people of that unit and of the units below it.
The right comes from being assigned the role, so it follows the assignment
and nobody grants it by hand. It holds only while the holder is in the
organisation, which means their entry is linked to an account; otherwise
scope rights decide, as they do today.

What the right covers is read this way, and each reading can be overturned:

* **The people of the unit and of the units below it**: adding a person,
  correcting a name or an address, assigning, ending an assignment, and
  marking someone as left. Not the unit's own name, its place in the tree or
  the operating model; scope rights decide those. Forgetting, removing,
  merging and the policy stay with administrators.
* **No self-escalation.** A manager cannot hand out a managing role. That
  needs a manager above, or scope rights.
* **The right follows the day.** It holds from the first day of the
  assignment to its last, today, not on a planned date.

### 13. The agent

Units are elements, so the element tools take them. New tools:
`unitTypes.list`, `unitType.add`, `unitType.update`; `roles.list`,
`role.add`, `role.update`; `responsibilities.list`; `assignments.list`,
`assignment.add`, `assignment.end`; `people.list`, with possible duplicates;
`person.add`, `person.leave`; and `plan.move`.

An agent sees names, or pseudonyms where the policy says so. It is told
whether an entry has an address, never the address. It may add a person,
assign and mark someone as left. **No tool forgets, removes or merges a
person**, and none changes the policy: each is final, or decides what every
screen shows, and is a person's to do on a screen.

### 14. What a build with accounts adds

Core holds the model, the register, the duplicate signs, merging, forgetting,
*This is me* and the libraries: they are the model and its file format. A
build that knows who people are may add, behind the same repositories:

* the register kept on its server, with a record of who changed what;
* the policy applied on a schedule;
* an entry linked to an account;
* a right from a managing role;
* who may see an address.

## Consequences

* Good: the organisation's own kinds of unit, roles and responsibilities are
  data, so the chart, the vacancies, the RACI checks and the people a
  reorganisation moves are computed rather than drawn.
* Good: nothing is entered twice. The actor tree, `partyId` and `assigned`
  are the structure and the Conway mapping both.
* Good: forgetting a person changes every screen at once and rewrites
  nothing, because the history never held the name.
* Good: a merge leaves every id in the history resolving.
* Good: an application's owner follows the role, on the day.
* Bad, accepted: a folder shared through a git remote carries ids and not
  names. The register travels in the working file, or on a server, and a
  clone without it shows no names until it has one.
* Bad, accepted: names written as text stay where they are. Search finds
  them; the register cannot forget them.
* Bad, accepted: a signed decision keeps a forgotten person's name, by
  decision.
* Bad, accepted: two folders in a scope whose names break the slug rule on
  purpose, so that nothing a person names can collide with them.
* Neutral: a library's later version is compared, never applied. What came in
  is the organisation's to keep in step.

### Confirmation

* A forget reaches every screen: the chart, the tables, the People page,
  search, a stand-in, a document and an export.
* A merged id resolves everywhere, and so does a chain of merges.
* No step, history entry or index row holds a register name, except a
  signature.
* A file exported without names holds no name and no address.
* The format turn: a tree at 10 opens at 11, and every scope keeps its
  address.
* No agent tool forgets, removes or merges, and none is told an address.
* The desktop's smoke run: a person assigned, and the chart changes.

## As built, 11 October 2026: the register of people

The first part of the build: §8, §9, §10 and §11, and §13's three tools for
people. Units, roles, assignments and the name fields follow.

**The port** is `ports/PeopleRepository.ts`, the sixth in `Repositories`:
`list`, `read`, `add`, `change`, `leave`, `merge`, `forget`, `remove`,
`since(revision)` — and `bringIn`, which the working file needs: entries
carried in under their own ids. Its contract suite,
`PeopleRepository.contract.ts`, runs over memory, this browser's IndexedDB,
the folder (over the fake, in a browser, and on the desktop with git) and
every provider that ships. A refusal is a value with a `people.` key; the
rules are written once, `people/register.ts` (`changePeople`), and every
implementation hands its entries to them.

**An entry** (`people/person.ts`) has an id that is `pe-` and 64 random
bits, a name, an optional work address, a kind, a state, `leftOn`,
`forgottenOn` and `mergedInto` — and a **pseudonym from the day it is
made**: four characters drawn from an alphabet with no vowel and no
look-alikes (`people/pseudonym.ts`), unique in the register. The code alone
is kept; the words around it are the reader's language: *Former colleague
7KQM* once forgotten, *Person 7KQM* where a name is withheld — from an
agent the policy gives pseudonyms, and in a file made without names. A
forgotten entry and a redirect hold no name and no address. Forgetting
someone still active is their leaving that day too. Only a forgotten entry
is removed, and its redirects go with it. A merge keeps every redirect one
step long.

**What a reference reads as** is said once, `people/shown.ts`
(`personText`, over `resolvePerson`): the name; the pseudonym once
forgotten; the entry a merge kept; *a former colleague* for an id the
register no longer holds. `model/person.ts` holds `PersonRef` (`{ person:
id }` or text) and `personIdsIn`, which finds every reference in a value by
its shape.

**The four signs** are `people/duplicates.ts`, used by the People page's
*Add person*, its list of possible duplicates, the CSV import
(`people/csv.ts`: matched, flagged, new) and `person.add`.

**The policy** is `people` in the organisation's settings
(`people/policy.ts`: `keepNameDays`, `removeAfterDays`, `agentsSee`), and
*This is me* is `people.me` in the person's own settings, which the desktop
keeps in its data folder. The app applies the policy when the organisation
is opened and when the day turns while it is open, where the source may be
written (`app/organisation/usePeopleRegister.ts`).

**Leaving is a seam**: `people/leave.ts` marks the register, then runs each
`LeaveConsequence` composed in `app/organisation/leaving.ts` — none yet;
ending a person's assignments is the step that brings them.

**Where it is kept.** The folder keeps `.lionsville-architecture/people.json`;
`OUT_OF_HISTORY` lists it beside `local.json`, so no commit the app makes
holds it, `.git/info/exclude` keeps it out of one typed in a terminal, and no
scope's history answers for it. Browser storage keeps it on shelves of its
own (`people`, `peopleLog`; the database is at version 4). The working file
carries it at the same path from the zip's root, outside the manifest, so a
build from before reads past it and no format moved; the whole organisation
carries all of it, part of the tree the entries it names. The sealing
dialog asks *Without names*. Work brought from this browser into a folder
brings the entries the folder does not hold.

**The page** is `people/ui/PeoplePage.tsx`, a card on the organisation's
home and `app.open`'s page `people`; it says that nothing on it is a step.
**The tools** are `agent/people.ts`: `people.list`, `person.add` and
`person.leave`, with no `scope` and no `ifRevision`.

## As built, 11 October 2026: the operating model

The second part: §1's `_operating/`, §2 and §5, and §13's seven tools for
the operating model. Units, assignments, the checks over them and change
over time follow.

**The records** are `model/operatingModel.ts`: a unit type (`top` and
`within` for where a unit of it may sit — the organisation itself, or under
the types named — `spans`, `slots` of a role with `min` and an optional
`max`, `limit`), a role (`short`, `purpose`, `duties`, `manages`), a
responsibility (`description`, `group`) and an operating rule, one per kind
(`applicationOwner`, `domainOwner`), whose kind is its id. `from`, `until`
and `successors` are declared and read by nothing yet. Each item brought
from a library keeps `basedOn`: the library, the entry, the version and the
language its words were taken in. They are four lists on the model
(`unitTypes`, `roles`, `responsibilities`, `operatingRules`), each with
`add`, `update` and `remove` commands, inverses and write keys
(`model/commands/operatingModel.ts`), in the diff, a thing's history, a
restore, the Activity list and search. The writer refuses nothing about
what one record says of another; taking a role out of the slots and rules
that name it is the page's transaction (`operating/edit.ts`).

**On disk** they are one JSON list per list under `_operating/` at the
organisation — `unit-types.json`, `roles.json`, `responsibilities.json`,
`rules.json` — in the organisation's own order
(`adapters/folder/format/operatingFile.ts`). The scope format is 11. A 10
reads as an 11 with no operating model, the format pass rewrites the header
and moves no scope, and a list file that is not a list opens the scope to be
read and not written. Browser storage keeps the lists inside the model, so
its content format stays 2.

**The check** is `check.accountability` among a document's findings
(`projects/checks.ts`): a responsibility that is not exactly one role's A,
naming the roles where there are several.

**The libraries** ship in `operating/libraries/`: Scrum (one team type,
three roles, four responsibilities), SAFe (portfolio, Agile Release Train
and Agile Team, nine roles, six responsibilities), the IT4IT value streams
(ten responsibilities grouped by the seven value streams of version 3.0,
three roles) and Team Topologies (its four kinds of team), each at version
1, in three languages, every word this project's own. Bringing entries in
(`operating/bringIn.ts`) is one transaction with what they need — a unit
type brings the roles of its slots and the types it may sit in, a role the
responsibilities of its duties — nothing twice, and every id made distinct
from what the organisation holds. *Compare* (`operating/compare.ts`) reads
each item against its library as it ships now, in the item's own language,
and says a later version, a field, a slot, a place or a duty that differs;
it merges nothing. The frameworks' names are in `NOTICE`.

**The page** is `operating/ui/OperatingModelPage.tsx`: a card on the
organisation's home, `app.open`'s page `operating` (at the organisation
only), a search hit and a link. Three tabs: the unit types as cards with the
roles and the rules, the matrix of responsibilities against roles — a press
takes a cell through R, A, C and I — and the libraries with *compare*.
Opened over any other scope it reads.

**The tools** are `agent/operatingModel.ts` and `agent/write/operatingModel.ts`:
`unitTypes.list`, `roles.list` and `responsibilities.list` answer from the
organisation whatever scope is open; `unitType.add`, `unitType.update`,
`role.add` and `role.update` are commands under the agent's name, refused
`agent.scopeNotOpen` unless the organisation is the scope open.

## Open

* **People from a directory**: a picker over an identity provider's people,
  signals that someone has left, and a feed from a personnel system. Each
  needs permissions in the organisation's own directory. Not in this record.
* **A rename on a day**, for a unit or a role. A rename is an edit.
* **A manager renaming their own unit.** Outside the reading in §12.
* **Roles of a domain's own**, beside the organisation's.
* **An organisation's own model as a library** for another organisation.
* **Capacity beyond a share**: planning time and demand.
