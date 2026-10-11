# ADR-0036 — An operating model, units as typed actors, and a register of people outside the history

* Status: accepted, 11 October 2026; as built, 11 October 2026, in eight
  parts — the register of people, the operating model, units and
  assignments, change over time, names as references, the two views and the
  `interacts` row, the calls a review left open, and a managing role's right
  on the screens (*As built*, below); implemented, 11 October 2026. What a
  build with accounts adds (§14) is that build's own. Amended, 11 October
  2026: the structure drawn, libraries brought in as a choice, links from
  either end, and a large organisation (*Amended*, below); not yet built
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
step long, and merges no forgotten entry, either way. The register
remembers each id it removed — the id alone, random and naming nobody — and
a bring-in takes, of two entries under one id, whichever is further gone:
removed, forgotten, merged, left, active. So a file never gives back a name,
an address, an active state or an entry removed here, and a forgetting or a
removal carried in is made here too: forgetting travels, un-forgetting does
not. A name is never replaced by none short of forgetting, every redirect
stays one step long after a bring-in, and none is let in that would loop.

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
keeps in its data folder and a browser keeps beside a folder's handle. The app applies the policy when the organisation
is opened and when the day turns while it is open, where the source may be
written (`app/organisation/usePeopleRegister.ts`).

**A source that knows more says so** (`ProviderParts.people`,
`SourcePeople`), for a build with accounts and a schedule of its own:
`appliesPolicy`, and the app forgets and removes nobody when the
organisation is opened or the day turns; `me`, the entry its account is
linked to, which marks *you* and takes *This is me* off the page; and
`changes`, which reads the register again when it changed elsewhere. All
three absent for the core registers, which keep the policy and *This is me*
as above. A build that grants rights by person says three more: `may`,
whether the person using the app may make one kind of change
(`PEOPLE_ACTIONS`), of one entry where the answer is the entry's, and the
page offers only those; `withheld`, an entry whose address is kept from
them, which the page says rather than *no address*; and `held`, why its own
schedule did not forget an entry that was due (`PolicyHold`), said beside
its state. And a register that does what leaving does itself — ending a
leaver's assignments as it marks them — says so beforehand
(`PeopleRepository.endsAssignments`) and how much in the answer
(`PersonWritten.ended`), and `people/leave.ts` then runs no consequence of
its own, before or after, so nothing is ended twice and nothing is tried
with less authority than the register's own.

**Leaving is a seam**: `people/leave.ts` marks the register, then runs each
`LeaveConsequence` composed in `app/organisation/leaving.ts` — none yet;
ending a person's assignments is the step that brings them.

**Where it is kept.** The folder keeps `.lionsville-architecture/people.json`;
`OUT_OF_HISTORY` lists it beside `local.json`, so no commit the app makes
holds it, `.git/info/exclude` keeps it out of one typed in a terminal — listed
there whenever the desktop opens a folder that keeps a history, however that
history was started — and no
scope's history answers for it. Browser storage keeps it on shelves of its
own (`people`, `peopleLog`, and `peopleRemoved` for the ids it removed; the
database is at version 5), and the folder's file lists them under `removed`. The working file
carries it at the same path from the zip's root, outside the manifest, so a
build from before reads past it and no format moved; the whole organisation
carries all of it, part of the tree the entries it names. The sealing
dialog asks *Without names*; a file opened into a new folder takes the
register there with its scopes (`SourceDestination.place`), as one opened
here does. A copy made without names carries no name a signature
kept either: its decisions keep the ids and drop `signedAs` and `proposedAs`
(`model/adr.withoutSignedNames`). Work brought from this browser into a folder
brings the entries the folder does not hold, and every forgetting and
removal.

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

## As built, 11 October 2026: units and assignments

The third part: §1's `_assignments/`, §3 and §4, what leaving ends (§10),
who manages a unit (§12), and §13's three tools for assignments. Change over
time, the two views and the name fields follow.

**A unit** is an actor with `unitTypeId`; `scopes` and `extraSlots` (each a
role with `min` and an optional `max`) sit beside it on the element, and all
three are the owner's detail, so a stand-in of a unit carries none. A unit's
dates are the actor's: it is there while its lifecycle on the day is live or
retiring, and has ended once it is retired. **An assignment**
(`model/units.ts`) is `unitId`, `roleId`, `person` as `{ person: id }`,
`share` as a fraction above 0 and at most 1 (absent is all of the time),
`from` and `until`, both inclusive, and `acting`. It is a list on the scope's
model, with `assignment.add`, `assignment.update` and `assignment.remove`,
inverses and write keys (`model/commands/assignments.ts`); ending one is an
update that sets `until`, and its days running backwards is the one thing the
writer refuses (`command.datesOutOfOrder`). The Activity list, the diff and a
thing's history name an assignment by its unit, never by its person.

**On disk** a scope's assignments are one list,
`_assignments/assignments.json` (`adapters/folder/format/assignmentFile.ts`),
under format 11 as `_operating/` is: a 10 reads as an 11 with none, and no
scope moves. A file that is not a list opens the scope to be read and not
written. Browser storage keeps the list in the model.

**The arithmetic on a day** is `model/units.ts`, pure and with no words or
paths, so a server can import it by its path: a unit's slots (its type's,
then extra ones for roles the type does not hold), who holds a role on a day,
a person's load across assignments, the units above and below a unit through
`parentId`, whether a type may sit where its unit is (`top`, `within`), and
**who manages**: `managersOf(organisation, unitId, day)` — whoever holds a
running assignment in a role marked `manages`, in the unit or a unit above
it, the unit there on the day — and `managedBy(organisation, personId, day,
canonical?)`, the units a person holds a managing role in and every unit
below each. Core grants nothing from either.

**The index** reads each scope's assignments and the organisation's operating
model with its records (`ScopeModel['model']`, ids only), and lists
`units()` — each unit where its master is — `assignments()` with the scope
that keeps each, `operatingModel()` and `organisation()`. Search reads the
root's thin read, so a role is found from any scope.

**The checks** are `organisationFindings(index, day)` in `projects/checks.ts`,
off the index alone and today unless a day is given: `check.roleVacant`,
`check.roleOverMax`, `check.unitMisplaced`, `check.unitSpans` (several
domains under a type that does not span), `check.unitOverLimit`,
`check.assignmentEnded` (a running assignment in an ended unit, or in a role
whose `until` has passed, or in a unit or a role taken away since) and `check.personOverloaded`, about each scope that
keeps one of the person's running assignments. A finding about a person
carries their id in `person`; the organisation's home names them through the
register.

**The screens.** Under an actor's General tab, beside the canvas and on its
page, the host draws its unit section (`EditorOwnership.unitSection`,
`app/units/UnitSection.tsx`): type, filed in, serves, owns, responsible for,
each slot with today's holders — the register's names, shares, *acting*,
*you* — and its vacancies, a role beyond its type, who manages it today and
the checks about it, worked out over the index with the open scope's session
laid over it (`organisationHere`). **Assign** (`AssignDialog`) picks a person
with `people/ui/PersonPicker.tsx`, whose *New person…* is the People page's own
form, so the four signs are asked before anyone is added; correcting is a
patch, ending sets today, removing is for a mistake. The People page says
what each person holds today, will hold and held before, and *What we hold*
lists it.

**Leaving** (`app/organisation/leaving.ts`) ends every assignment of the
person's — under their id and every id merged into theirs — that runs past
the last day, and removes one that would begin after it: one step per scope
(`model/units.leavingStep`, pure, so a server that applies a leave itself
makes the same step), the others written together through the repositories,
the open scope's through its session, an agent's under its name. The ends are
made before the register marks the leave, and the open scope's part is asked
of its session first: where a scope will not take its part, nobody is marked
as left and the leave can be asked again. The open scope's step carries a
barrier, since the register does not take a leave back.

**The tools** are `agent/assignments.ts` and `agent/write/assignments.ts`:
`assignments.list` over the whole tree, the open scope as it is now, its
`scope` a filter, a person named or pseudonymised as the policy says, and —
asked about one unit — its slots and who manages it; `assignment.add` (a
person by register id, someone who has left refused, a merged id written as
the entry it went into) and `assignment.end`, in the scope that keeps the
unit. `element.add` and `element.update` take `unitTypeId`, `scopes` and
`extraSlots`. The share is in per cent at the agent, a fraction in the record.

## As built, 11 October 2026: change over time

The fourth part: §6, and §13's `plan.move`. The name fields follow.

**A plan moves units.** `Transition.moves` (`model/transition.ts`) is a list
of `{ unitId, parentId?, on }` — a unit under a new parent from a day, or at
the top where no parent is said — one per unit and plan (`movesWith`).
`shiftDays` moves their days with the window and the milestones, so the
page's *Move by…* moves them too, and `transitionDays` counts them. The plan's
file writes them as rows under `moves:` only where there are any, so a plan
from before reads and writes the same bytes. A move outside a plan is still
an edit of `parentId`. An abandoned plan moves nothing.

**The organisation on a day** is one pure function, `organisationOn`
(`model/units.ts`): every unit under the parent the latest move on or before
the day gives it (`parentOn`). It takes nothing else away — an ended unit, a
role past its day and an assignment that is over are read by the questions
themselves — so `managersOf`, `managedBy` and `unitFindings` each ask it of
their day, and a server that imports them by path answers the same. A unit
type's days count as a role's: one that does not run on the day asks for
nobody in its slots, and a unit still of a type that has ended is
`check.unitTypeEnded`. `unitsOn` lists the units there on a day. The index
gathers every plan's moves but an abandoned one's (`moves()`, each with its
plan and scope) into `organisation().moves`; the open scope's plans are laid
over it as its session holds them (`app/units/organisationHere`).

**Which day.** Looking at another day is ADR-0027's look and nothing else: the
workspace holds it per board (`useShownDays`), and `editor/dayShown` turns the
active board's look, its own day or today into the day a unit's section is
read on — its holders, who manages it, its checks and *Over time* (its first
and last day, and every plan's move of it). What the section writes starts on
that day where it is still to come. The People page has no board, so its look
is the same hook keyed for the page, whose own day is today; *Look at* says
what a person holds, will hold and held before on it. The organisation home's
findings stay today's.

**What a plan does to the organisation** is `model/reorganisation.ts`, pure:
`planReorganisation` reads the units the plan introduces (from their live
day) and retires (to their last day), its moves, and the roles whose last day
is the day before one of those days. `peopleToMove` lists every assignment
that runs past the last day of its unit or its role — not one in a unit that
only moves, which takes its people with it — each with a suggestion: the
unit's successor where its unit ends, the role's first successor that runs
the day after where its role does, and nothing where either ends with no
successor. `peopleMoveSteps` makes each scope's commands: an end on the last
day (or, for one not yet begun, its removal) where the old assignment is
kept, and a new assignment from the day after — the same person, share,
acting and later last day — where the new unit is kept.
`reorganisationRoots` and `unitTree` draw the organisation the day before the
plan's first day and on its last, under the smallest trees that hold the
change; `lostAccountability` finds a responsibility that loses its only A.

**The pages.** A plan's page holds a slot the host draws
(`PlanPageProps.organisation`, `app/units/PlanOrganisation.tsx`): *Units it
moves* among the facts, and above the interfaces what the plan does, before
and after, *Move the people* (`app/units/MovePeople.tsx`) and what is still
open on the day — the findings about a unit as links to it. *Write as one
step* lands every scope's part as that scope's one step together
(`app/units/landPeopleMoves.ts`): the other scopes in one `apply` through
`changeScopes`, the open scope's through its session after the reducer has
been asked. Where only the open scope is written it is one step that undo
takes back whole; where others were written too, its step carries a barrier,
since undoing one scope's part would leave the organisation half moved. The
operating model page edits a unit type's and a role's `from`, `until` and
`successors` (`operating/edit.setDay`, `setSuccessors`), and beside the item
the host draws what an ending leaves to decide (`OperatingModelPageProps.aside`,
`app/units/EndedHolders.tsx`): a role's people with *Move the people*, the
role's successor in the same unit suggested; a unit type's units still there
after it, listed, nothing guessed.

**The agent.** `plan.move` puts a unit under a new parent on a day on a plan,
changes the move when given again, takes it off with `remove`, and refuses a
parent below the unit on that day. `unitType.add`, `unitType.update`,
`role.add` and `role.update` take `from`, `until` and `successors`, and the
lists say them. `assignments.list` reads the organisation of its day — a
unit's parent on that day among what it says — and `checks.list` takes `on`
for the organisation's findings. `plans.list` and `plan.read` say a plan's
moves. Moving the people is the page's: an agent ends and assigns with
`assignment.end` and `assignment.add`, in one `batch` where it wants one step.
## As built, 11 October 2026: names become references

The part that turns §8's name fields into references: `PersonRef` on every
field of default 6, the signature that keeps its name, the owner worked out
from a rule, search through the register, and what points at a person.

**The fields.** An element's and a plan's `owner`, an observation's and an
experiment's `by`, a decision's `proposedBy` and each signer's `name` take a
`PersonRef` (`model/person.ts`): `{ person: id }` picked from the register,
or text as before, which stays valid with no migration. `personRefOf` is how
every writer keeps one — text trimmed, a blank removed — and `refText` the
only words of one a search or a filter folds. `validatedWith` and a view's
`author` stay text. A plan made by *Replace…* carries the replaced thing's
owner as it is, an id or text.

**A signature keeps its name** (`decisions/adr.ts`, `withSignedNames`): a
verdict given to a signer picked from the register writes `signedAs`, the
name the register has that day, beside the id; once anybody has signed, the
proposer's is fixed the same way as `proposedAs`. A name written stays while
the same person's verdict of the same day does, so a later change of the
register's name, or a forget, does not reach it; a verdict taken back, or
another person put in the row, takes it off. A person already forgotten
signs with nothing beside the id. The decisions page writes them through
`updateAdr`'s `nameOf`, the agent through `decision.propose` and
`decision.update`. A signed name is read where the record is shown — the
signer, the deciders, the proposer — and the register everywhere else.

**On disk**, at format 11 with no step in it: a picked person is written
under the field's key with `Person` after it — `ownerPerson:`, `byPerson:`,
`proposedByPerson:`, and a signer row's `person:` with its `signedAs:` — and
text under the key as before (`adapters/folder/format/fileText.ts`,
`personFrontMatter`, `personRow`), so a file from before reads as text and
holds no register name. Element records in `model.json` hold the reference
as JSON.

**Search matches the register first and then the ids**
(`model/searchable.ts`, `search/search.ts`): a record says the ids it names
in `people` and folds only text, so no index row holds a register name; a
search is handed `PeopleMatch` — for each word of the query, the ids whose
entry reads with it, the name or, once forgotten or withheld, the pseudonym
(`people/matching.ts`) — and a record matches a word through its text or
through one of its ids. The page's search and the agent's `search` both ask
the register; *What we hold*'s search for a name reads text alone, which is
what a forget cannot reach. A signature's kept name is the record's own text
and is found as such.

**The index carries the master's `owner`** as a reference, so a stand-in,
which carries no owner of its own (ADR-0012 §3), shows its master's by the
same id.

**Readers.** One object, `PersonNames` (`people/ui/names.tsx`), built from
the shell's register and provided once around the app
(`PersonNamesProvider`, `usePersonNames`): what a reference reads as, the
name a signature takes, the id a merge kept, *you*, and the search's match.
Every page with one of these fields reads through it — the element's record
and the panel's line, the plan, the observation, the experiment, the
decision, the merge screen and the picture's filters — so a forget reaches
them all at once. The modules that draw them (`editor`, `decisions`,
`observations`, `roadmap`) may import `people` for it. Every editor of these
fields is `PersonRefField`: a person picked, shown by the register with a
cross to take them off, or text, with *From the register…* — the picker, whose
*New person…* asks the four signs — and, while a name is typed, the entries
it may be.

**The owner worked out from a rule** (`model/owners.ts`): where the
organisation has the `applicationOwner` rule, an application with no owner
written is owned, on the day, by whoever holds the rule's role in the unit it
belongs to (`partyId`), the unit there and the role running; `domainOwner`
likewise for a scope, through the units that serve it. Never stored. The
host works it out for the record (`EditorOwnership.answeredBy`, over the
tree with the open scope's session laid over it, today) and the record says
it under its owner field and in the panel's line. *Belongs to* is now asked
of every application, as the unit it belongs to for one of the
organisation's own: the rule reads its owner from there.

**Points at them** (`model/pointers.ts`, `pointersIn`): every record across
the tree whose fields hold the person's id or one merged into it, by field,
with the names signatures kept; and what the rules make them own today
(`app/units/held.ownedByRule`). The People page lists them under *Points at
them*, and *What we hold* says them as `namedIn`, `signed` and `derived`.

**The agent** (`agent/persons.ts`): every argument that names a person takes
text or `{ "person": id }` (`personArgument`, an `anyOf` in the schema); an
id the register does not hold is refused, a merged one written as the entry
kept. The register asked is the one last read, not the one last drawn
(`PeopleRegisterAccess.current`), and a change to it answers only once it
has been read again (`usePeopleRegister`), so whom `person.add` added — or
`person.leave` marked — is known to the very next call; a read answered
after a later one is dropped. Every answer says a picked person as `{ person, name }`, the name or
the pseudonym the policy gives, done once as the answer leaves the handler
and only where an answer names somebody; `search` and `project.export` ask
the register before they answer. Where the policy gives agents pseudonyms,
a signature's kept name is withheld as well: the answer says the signer and
the proposer by pseudonym and `signedAsWithheld` or `proposedAsWithheld`
where a name was kept, and a search finds nothing by it. The record is
unchanged, and the screen shows it.

## As built, 11 October 2026: the two views, and a row between units

The sixth part: §7, and §11's *you* and *Find me* on them and on the People
page.

**`interacts`** is the eighth relation type (`model/types.ts`,
`model/relations.ts`): actor to actor, with `mode` — `collaboration`,
`service` or `facilitating`, `INTERACTION_MODES` — and the row's own
`validFrom`/`validUntil`. The relation commands write it with their inverses
and write keys; `relation.update` may name `mode`. The writer refuses a row
from an actor to itself, to anything that is not an actor, or in a mode that
is not one of the three, as `command.interactsEnds`, judged on the ends the
scope holds — an end another scope keeps is trusted, as every row's far end
is. Whether an end is a unit is not the writer's to hold it to: a type taken
off a unit leaves its rows, and the map reads only rows between units. The
folder keeps it in `model.json` as every row; nothing in the format moved.

**`chart` and `conway`** are laid-out kinds: `isLaidOutKind` is true for both,
`isBoardKind` false, and they hold no members and keep the empty geometry a
laid-out view keeps. Every switch on a view's kind names them, as ADR-0034's
amendment did for a drawing: placement, the editor's body, its docks
(`docksOf`: the inspector stays beside both, the palette does not), the
toolbar's tab lists and openers, its `+` (`NewViewMenu`), the day control a
dated laid-out view keeps (`isDated`), the pages a destination opens
(`agent/screen.ts`'s `PAGES`, `VIEW_PAGES` and `viewPage`; `App`'s
`ViewPageName`), the select a destination may carry, `useViewSelect`, the
board table's label and glyph, search's label, the documentation page's
kinds, and `diagram.inspect` (`agent/handle.ts`'s `inspectDiagram`). A
comparison about one kind and one fact stays a comparison.

**The arithmetic** is pure and has no words. Both read the organisation of
their day (`organisationOn`): every unit under the parent the plans' moves
give it then. `model/orgChart.ts` (`orgChart`) draws the units as a tree by
that parent, each under the nearest drawn unit above it, siblings by name: a
unit there on the day, or one that has ended with somebody still assigned to
it, flagged `ended`; each slot of a role running on the day — none where the
unit's type has ended — with its holders, the vacancy its minimum leaves and
whether there is room; the holders of a role the unit holds no slot for, and
whether that role has ended; and whether a holder is over all of their time
across the organisation, two ids of one person counted as one. A chart is of
the units its caller includes and every unit below them, or of one unit and
those below it. `model/conway.ts` (`conwayMap`, handed the moves) groups the applications by
their owner on the day — a unit not there owns nothing that day; a party that
is no unit still owns — or by the unit of a type above the owner; says how
each interface running on the day lies (`inside`, `declared`, `undeclared`,
`unowned`); counts an interaction between units above the owners as covering
them; and finds the four of §7. `laidOutView` is a new view of either kind.

**The pages** are `app/units/ChartPage.tsx` and `app/units/ConwayPage.tsx`,
drawn in the tab (`app/units/UnitViewPages.tsx`). What they are of is
`app/units/unitViewsHere.ts`: the organisation off the index with the open
scope's session laid over it (`organisationHere`), the units filed in the
view's scope or below or serving a scope there (at the organisation, every
unit), and for the map the applications filed there or below and those its
units and the units below them own, with the flows and the interacts rows off
the index and the session. The day is the view's (`asOf`), so the bar's day
control looks at another day and saves one as it does on a board (ADR-0027).
A unit or an application the open scope keeps is chosen, and the inspector
docked beside the page edits it; one another scope keeps opens there, on its
record. A vacancy in a unit kept here assigns at once (`AssignDialog`). The
chart's findings are `findingsOfOrganisation` over the units drawn and the
people in them, each a link to the unit on the chart; the map's are its own
sentences, and a crossing with nothing declared between two units, one of
which this scope keeps, offers the dialog that declares an interaction. The
map draws the crossing lines from where the cards ended up, measured and
never stored, and a table counts the interfaces between each pair. Both
pages hand the agent's renderer a picture of themselves.

**A unit's section** lists the rows it is an end of under *Works with*
(`app/units/Interactions.tsx`): this scope's open the dialog — the other unit,
the mode, the window, *Remove* — and another scope's say where they are kept.
A new row is minted by the scope's own id policy.

**You.** *You* is marked on the chart's holders and on the map's units where
you hold a role and every unit above them; *Find me* goes to the first, or
says to say who you are. The People page has *Find me* too. A draw.io box that
points at a unit this scope keeps opens it on the scope's chart, chosen, where
the scope has one (`unitLanding`); every other box opens as an element does.

**The agent.** `diagram.create` takes `chart` and `conway` by name;
`views.list`, `app.open` (with `select` on either) and the destinations take
them; `diagram.render` pictures either through its page; `diagram.inspect`
reads either off the tree with the open scope laid over it
(`agent/inspectUnits.ts`), people by register id. `relation.add` and
`relation.update` take `interacts` with `mode`.

**The smoke run** gains *the organisation chart*: at the organisation, a role
and a unit type holding one, a unit of it and a chart; the chart draws the
role vacant; a person added and assigned is a holder on the chart and the
vacancy is gone.

## As built, 11 October 2026: the calls a review left open

Five answers the design gave after the parts above were built, each where a
person sees it.

**A unit moved between scopes takes its people** (§4). *Promote*, *demote*
and *transfer* (`projects/gestures.ts`) carry every assignment the scope it
leaves keeps for the unit — ended ones included, since who held its roles
belongs with it — in the write to the scope it goes to, as one step with the
definition (`writeCommand`), under their own ids, so a person's past stays
linked; this scope's step takes them out with the link or the delete, so a
stand-in left behind holds none. The step carries the gesture's barrier as
before, and the confirmation says how many go. The index reads them where the
unit is now.

**A merge into an entry that has left asks** (§9). An active entry merged into
one that has left is told `MergeLeaving` (`people/person.ts`), and the
register's rules refuse it told nothing (`people.mergeAsks`): *still here*
makes the entry kept active again with no `leftOn`, so the policy stops
counting; *left* keeps the leaving, and `people/leave.mergePerson` ends the
absorbed entry's roles on the leaving day by leaving's own consequences —
first, then the merge — so one that ran past it ends on it and one that began
after it is taken away, never ended before it began. A register that
`endsAssignments` is told *left* and does it itself, answering `ended`. The
People page's question (`people/ui/MergeLeaving.tsx`) says how many of each,
and starts from *still here* where any of those roles began after the leaving
day, from *left* otherwise. `PeopleRepository.merge` takes the answer as its
third argument.

**A signature apart from a forgotten entry** (§8). Once the entry a signature
was signed by — the one a merge kept — is forgotten or gone
(`people/shown.signatureApart`), the name as signed links to nobody. The
decision shows it alone, even while the record is written (the row is no
picked person then); the forgotten entry's *Points at them* and *What we
hold* say only that a signature exists (`pointerLine(…, apart)`); a search
does not reach the record through it (`SearchRecord.signed`, matched only
while `PeopleMatch.apart` says the entry has its name); and an agent is told
the name as signed in place of the reference, with no id and no pseudonym —
or *a former colleague*, where names are withheld (`agent/persons.ts`).

**This is me in a browser's folder** (§11). A folder opened in a browser keeps
the person's own settings in that browser's database beside the folder's
handle (`browserPersonSettings`), as the desktop keeps them in its data
folder: they outlive a reload, and nothing of them is in the folder or an
export.

**The Conway map on its day** (§7, ADR-0009). An application is on the map
while it is live or retiring on the map's day (`model/conway.applicationOn`),
as a unit is: one not yet live, or gone, is not drawn, and neither are its
interfaces nor a finding about it; a unit's limit counts what it owns on that
day (`ownsOf`), on the page, in `diagram.inspect` and in the organisation's
`check.unitOverLimit` alike. The index carries each element's stored phase
and dated phases (`IndexEntry.lifecycle`, `lifecycleDates`) for it.

And *Move the people* writes each new assignment under the id a merge kept
(`peopleMoveSteps`'s `canonical`).

## As built, 11 October 2026: a managing role's right, on the screens

§12 grants nothing in core. A build that grants it — on its own doors — now
says so, and the screens offer what those doors will take.

**The arithmetic** is `model/managing.ts`, pure, for the screens and for a
server to import by path: `managedReach` (the units a person holds a running
managing role in on a day, every unit below each under that day's parents,
and those strictly below, where a managing role is theirs too),
`managesPeople` (the same with the roles that manage), `mayChangeIn` (a
screen's question of one unit and role) and `onlyPeopleIn` (whether a step's
commands are all assignments, each before and after in reach, the one after
in a unit the scope keeps, applied in order by the writer).

**The seam** is `SourcePeople.managingRight`: the source grants the right to
the person it says is using the app (`me`, an account's link — never *This is
me*). The shell works out what that person manages today off the tree's index,
one person under every merged id, and hands it as
`PeopleRegisterAccess.manages`. Where it is there:

* the register is not read-only for them, and the source's `may` says each
  change;
* a scope only read to them still takes a step `onlyPeopleIn` allows
  (`ModelSessionDeps.letThrough`), and nothing else; the source's door decides
  it again;
* a unit's section offers *Assign*, a holder's correction, end and removal on
  a unit they manage, a managing role's only strictly below one they hold, and
  nothing else of the unit; a chart's vacancy in such a unit assigns; *Move
  the people* moves their rows to places in their units, writes only those,
  and lands a part in a scope only read to them where every command of it is
  theirs (`landPeopleMoves`'s `manages`).

*New person…* in the picker is offered where the source's `may` says *add*,
not wherever the register may be written. And a unit's section says who
manages it may change its people, where the source grants the right
(`PeopleRegisterAccess.managingRight`), rather than that it grants nothing.

## Amended, 11 October 2026 — the structure drawn, libraries brought in as a choice, links from either end, and a large organisation

*Accepted 11 October 2026; not yet built.* A look at the screens of what was
built found the model right and the pages short of it: the unit types sat in
a grid in the order they arrived, with where each may sit said only in a
caption; a library was a list of tick boxes, with nothing to say what a type
holds or where it lands; a scope and a capability could be tied to a unit
only from the unit; and a chart of seventy units could neither fold nor keep
any order but the alphabet. None of this changes a record's meaning. It adds
one field, three inputs to one function and one check.

* **The structure is drawn in lanes (§2).** A unit type's lane is the longest
  path from the organisation, which is lane 0, through `within`; the
  arithmetic is `model/`'s, so a check and the agent read the same lanes the
  page draws. Each type is drawn once, with a line from every place it may
  sit, and a line that skips a lane runs along a rail above the cards, where
  no card hides it: a type that may sit at the top or inside another shows
  both. **`UnitType.order`** is the order within a lane — the organisation's
  own, moved on the page, never a difference *compare* reports — with the
  name breaking ties; arrival order goes. A type that sits nowhere — neither
  at the top nor within a type — is a finding, because no unit can be made of
  it.
* **A library is brought in as a choice (§5).** The library is drawn as its
  own structure, in the same lanes, read-only, and what a step will write is
  shown before it is written. `bringIn` takes three more inputs: **`names`**
  (an entry and what it is called here), **`placements`** (an entry and the
  unit types it sits in, or the top) and **`reuse`** (an entry and the
  organisation's own role or unit type that stands for it, which then brings
  nothing and is what the slots name). It is still one transaction and one
  undo; every item made keeps `basedOn`, and an item reused keeps its own.
  The libraries carry **`alike`** hints between their entries — a product
  owner in one and in another — which, with the same name once normalised,
  suggest a reuse; the suggestion is the page's and the choice the person's.
  A library type at the top that holds no type of its library is offered
  beside the model's deepest type that holds nothing (the same `within`).
* **Each link has one home and two ends (§3).** Which units serve a scope is
  `unit.scopes`, and who answers for an area, a grouping or a capability is
  the `assigned` row, kept in the function's scope — as before. What is new is
  that each is edited from the other end too: a scope's home and settings say
  *Served by*, and adding a unit there writes `unit.scopes` as a step in the
  scope that keeps the unit, under that scope's rights — who serves a scope is
  structure, so a managing role's right (§12) does not reach it; the sheet's
  *Assigned to* picks a unit from anywhere in the organisation, which is the
  row's far end like any other (ADR-0012 §5). A scope's domain owner is
  derived from `domainOwner` on the serving unit filed highest in it. A
  capability assigned to a unit that serves neither its domain nor sits under
  one that does is a finding.
* **One order for units, and folds (§7).** Wherever units are listed — the
  chart, its outline, the Conway map, a picker — they are in one order: the
  type's lane, then its `order`; then the actor's own `order` among siblings of
  that type, which is the field actors already have and is moved as one step;
  then the name. The chart's units fold, and a folded unit says what it hides.
  A fold is kept for the session and keyed by the view, by the rule the scope
  tree already keeps: a fold is what somebody is doing this minute, not a
  preference. The chart's outline is a foldable tree again, replacing the
  select of the first build.

## As built, 3.6.1: the Conway map's table, and what a plan leaves to declare

Two repairs to the build of §6 and §7, where the screens fell short of the
design.

**The table reads the interactions too.** A cell of the Conway map's table
(`app/units/ConwayTable.tsx`) is two columns: how many interfaces run between
them, and a letter for every interaction declared between them — one whose
ends sit each at, under or above one of the two columns' units, as an
interaction covers the units under its ends — whether or not an interface
runs there. The map holds the cells (`model/conway`, `pairs`), each with how
the two stand: an interface with nothing declared; no interface, and an
interaction the findings call unused; interfaces only to applications nobody
owns; or declared. The first two are shaded, each its own way, in tints
measured in both modes. A cell an interaction covers with no interface of its
own, where interfaces elsewhere need it, has its letter and no shade: whether
an interaction is needed is the findings' to say, and the cell agrees with
them.

**A plan's *Still open* says the interactions it leaves to declare.** The
Conway map of the plan's day is read around the units it introduces or moves
and those under them, across the whole organisation (`conwayInputAround`).
Every interface it finds crossing from one of them with nothing declared is
said as two units (`model/reorganisation`, `interactionsToDeclare`): the
plan's highest unit above that end — a new cluster rather than each team
moved into it — and the unit that the interaction covering the interface the
day before was declared with, where it is there on the day, so a cluster that
is split hands its partners on to the clusters it is split into; or else the
other end's own. Each two units once, each line a link to the plan's unit,
whose *Works with* declares it (`app/units/PlanStillOpen.tsx`).

## As built, 3.6.1: lanes, and one order for units

The arithmetic under the amendment's first and fourth points: the lanes the
structure is drawn in, said once for every screen that draws or lists them,
and the one order units are listed in, which the chart reads already. The
screens that draw the lanes, move a type along one and fold the chart follow.

**Lanes** are `model/unitOrder.ts`, pure. The organisation is lane 0, a type
that may sit at the top is in lane 1 at least, and a type's lane is the
longest path from the organisation through `within` (`unitTypeLanes`): a type
that may sit at the top and in a lane-1 type is in lane 2, below the deepest
place it may be put. A loop in `within` — which the writer refuses no more
than before — is cut where a walk from the organisation, in the lanes' own
order, meets a type it is still inside, so the same model has the same lanes
whatever order it was read in, and the lines cut are marked. Within a lane the
types stand by a new optional `order` on the unit type, then by name. A type
no walk reaches — not at the top, and in no type that is anywhere — sits
nowhere: every unit of it would be misplaced, so it is a finding of its own,
`check.unitTypeNowhere`, beside `check.accountability`. `order` is one more
optional field in `unit-types.json`, so the format stays 11 — a build from
before it passes the field over — and *compare* never reads it. Moving a type
along its lane is one step that renumbers the lane (`operating/edit.ts`'s
`moveUnitType`).

**The order of units**, wherever they are listed, is their type's rank —
lane, then `order`, then name, the types that sit nowhere last
(`unitTypeRank`) — then the actor's own `order` among its siblings, the field
the business tree already reads, then the name (`compareUnits`); a unit of no
type, or of one the model does not hold, comes last. The chart reads it where
it put siblings by name. Moving a unit among its siblings of the same type
renumbers their `order` (`unitMovedTo`), each row an `element.update` in the
scope that keeps that unit.

**The agent's** `unitTypes.list` answers in that order, with each type's lane
— or `sitsNowhere` — and its order; `unitType.add` and `unitType.update` take
`order`; `checks.list` names both of the operating model's findings.

## Open

* **People from a directory**: a picker over an identity provider's people,
  signals that someone has left, and a feed from a personnel system. Each
  needs permissions in the organisation's own directory. Not in this record.
* **A rename on a day**, for a unit or a role. A rename is an edit.
* **A manager renaming their own unit.** Outside the reading in §12.
* **Roles of a domain's own**, beside the organisation's.
* **An organisation's own model as a library** for another organisation.
* **Capacity beyond a share**: planning time and demand.
