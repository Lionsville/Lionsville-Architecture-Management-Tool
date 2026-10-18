# ADR-0036 — An operating model, units as typed actors, and a register of people outside the history

* Status: accepted, 11 October 2026; as built, 11 October 2026, in eight
  parts — the register of people, the operating model, units and
  assignments, change over time, names as references, the two views and the
  `interacts` row, the calls a review left open, and a managing role's right
  on the screens (*As built*, below); implemented, 11 October 2026. What a
  build with accounts adds (§14) is that build's own. Amended, 11 October
  2026: the structure drawn, libraries brought in as a choice, links from
  either end, and a large organisation (*Amended*, below); as built and
  implemented, 11 October 2026, with the screens brought to what this
  record's design drew (*As built, 3.6.1*, below). Amended again, 11 October
  2026: findings you can act on (*Amended*, below); its catalogue as built
  (*As built, 3.6.1: a catalogue of checks*, below), a finding marked as
  intended with the scope format at 12 (*As built, 3.6.1: marked as
  intended*, below), and every list of findings grouped, folded and explained
  (*As built, 3.6.1: one list of findings*, below), with marking and the
  Checks page on the screens (*As built, 3.6.1: marked as intended on
  screen, and the Checks page*, below); implemented, 12 October 2026.
  Amended, 12 October 2026: a unit deleted takes its assignments with it,
  and one left behind is a finding (*Amended, 12 October 2026*, below); as
  built and implemented, 12 October 2026, with units made on the chart, the
  sheet's rail drawing the units it uses, a unit pressed on the chart landing
  on its inspector, and deleting a unit saying what goes with it (*As built,
  3.6.2*, below). Amended, 13 October 2026: the organisation is not a
  domain, and a unit and what it serves link to each other (*Amended, 13
  October 2026*, below); as built and implemented, 13 October 2026. Amended,
  17 October 2026: a scope's type is a unit type of the operating model,
  offered before the built-in kinds, following the unit linked to it, and
  checked against the units that serve it (*Amended, 17 October 2026*,
  below); as built and implemented, 17 October 2026. Amended again, 17
  October 2026: a unit moves to another place in the organisation, its
  parent found anywhere in the tree, as the correction §6 says a move
  outside a plan is (*Amended, 17 October 2026 — a unit moves*, below); as
  built and implemented, 17 October 2026. Amended, 17 October 2026 (3.7.3):
  the chart opens two levels deep whatever its size, the outline leads the
  chart's unfolding and is as wide as it is dragged, and a unit type's long
  words are cut on the chart (*Amended, 17 October 2026 — the chart made
  easier to read*, below); as built and implemented, 17 October 2026
* Date: 2026-10-11
* Deciders: Wouter Simons
* Superseded-by: ADR-0039, in part, 2026-10-16 — §12's *the holders of a
  managing role in it, or in a unit above it*: for the holders of a role a
  solid reporting line is drawn from, the line says who manages them
* Supersedes: ADR-0011, in part (Q1's *everything a person can do on a page
  is a tool*: forgetting, removing and merging a person are a person's
  alone, and no tool does them)
* Extends: ADR-0009 Q2 (a plan moves units), ADR-0012 §1, §3 and §5 (two
  folders no scope can collide with, an actor with a type and the scopes it
  serves, and one more row), ADR-0016 (two more laid-out kinds), ADR-0023 §3
  (*This is me* is kept with the install), ADR-0031 §1 (a sixth repository,
  for people)

*Extended by ADR-0040, 18 October 2026 (§13 and its amendment of 17 October):
the open item a `scope.describe` tool is closed by `scope.update`, on every
host; a unit's and a function's `scopes` are checked against the tree, and
`""` is dropped for a function as for a unit.*

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

*Amended, 16 October 2026, by ADR-0039 (implemented, 16 October 2026): a
reporting line runs from a role in a unit to a role in another unit, solid
or dotted, said on the unit type's slot and overridden on a unit. A solid
line replaces the nesting below as who manages the holders of its role, and
a host's right follows it; a dotted line is shown and carries no right.*

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

## As built, 3.6.1: what each person holds, and a role taken out of a unit type

**The People page says what each person holds** on the page's day, in a
column of its own — *Roles today*, or *Roles on* the day the page is looked
at: each role in its unit once, the first two and how many more, and *none*
said as such, so whoever holds nothing stands out (`people/hold.rolesOn`). It
reads what the person's *Holds today* reads, `PeopleRegisterAccess.assignmentsOf`,
once per day and register; the search finds a person by a role or a unit they
hold; and where the shell has no tree to read there is no column. An account
is a build's own (§14), not a column of core's.

**A role taken out of a unit type** is §6's *when the model itself changes*.
Where anybody holds the role in a unit of the type through the type alone
(`model/units.heldThroughType`; a unit's own extra slot for it keeps its
people), the slot does not go at once: the page asks the host
(`OperatingModelPageProps.slotTakeOut`), since it knows nobody's name, and
draws what the host says under the slots — *Move the people*
(`app/units/EndedHolders.SlotHolders`, `model/reorganisation.slotEnding`),
each row with the role's first successor the unit still holds as the
suggestion. A slot has no days, so it goes today, and today is the people's
last day in it. *Write as one step* lands the type's step at the organisation
with their ends and beginnings in every scope that keeps one, through
`landPeopleMoves`: all of it or none, so nobody is left in a role their unit's
type does not hold. A slot nobody holds that way goes at once, as before.

## Amended, 11 October 2026 — the structure drawn, libraries brought in as a choice, links from either end, a large organisation, and findings you can act on

*Accepted 11 October 2026, and built the same day: the As built, 3.6.1
sections below.* A look at the screens of what was built found the model
right and the pages short of it: the unit types sat in
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
* **Findings you can act on (§2, §3, §7).** A finding was one sentence, said
  wherever it was listed: nothing told a contradiction from a fact that may
  well be intended, nor said why it mattered or what would settle it, and the
  Conway map's interactions that no interface needs read like faults when
  they are mostly meant. Every kind of finding has one entry in a catalogue,
  a record over every key, so a kind without one does not compile: a name a
  person recognises; a category — the landscape, plans and dates, the
  organisation, teams and systems, analysis; a weight; why it matters; how to
  fix it; and the actions that fix it, or open where it is fixed, as ids a
  screen turns into buttons. The Conway map's findings are keys like the
  rest — `check.interfaceUndeclared`, `check.interactionUnused`,
  `check.applicationUnowned` — and its over-limit is the organisation's own
  `check.unitOverLimit`. A weight is one of three. **Fix**: the model
  contradicts itself or cannot be true, and it is never waived. **Review**:
  probably a gap or a risk, worth a person's look. **Note**: information that
  may well be intended. The wording follows the weight: a fix states the
  contradiction, a review asks, a note states a fact and is never worded
  like a fault. A list of findings is grouped by check, fix first, then
  review, then note. Every kind is weighed so (each key is `check.` and the
  name):

  | Weight | Category | Checks |
  |---|---|---|
  | fix | the landscape | `conflict`, `dangling`, `danglingEnd`, `drawingLinkMissing` |
  | fix | plans and dates | `successorTooLate`, `lineOutlivesEnd`, `platformRetiresFirst` |
  | fix | the organisation | `unitTypeNowhere`, `unitMisplaced`, `assignmentEnded`, `unitTypeEnded` |
  | review | the landscape | `drift`, `ownedElsewhere`, `unattributed`, `unmapped`, `uncovered`, `offeredNotShared`, `impliedInterface`, `unrealised` |
  | review | plans and dates | `retiresWithDependants`, `successorMissing`, `planOverdue` |
  | review | the organisation | `accountability`, `roleVacant`, `roleOverMax`, `unitSpans`, `unitOverLimit`, `personOverloaded`, `unitNotServing` |
  | review | teams and systems | `interfaceUndeclared`, `applicationUnowned` |
  | review | analysis | `causeExplainsObservationBelow` |
  | note | the landscape | `notDrawn`, `proposal` |
  | note | teams and systems | `interactionUnused` |
* **Marked as intended (§1).** A review or a note can be marked as intended,
  with a reason that is asked for and not required; a fix cannot, because
  the model contradicts itself and the answer to that is in the model. A
  mark is a record in the model — it is about the model, and everybody sees
  it — kept in the scope of the finding's first subject as `{ check, key,
  reason?, on }`: a step with undo, in the Activity list and the history.
  `key` is the instance, made of its subjects' ids, so a subject changed so
  the key no longer matches brings the finding back. A mark is taken back
  from the check's list. An agent reads marks and never makes one, so an
  agent cannot silence a check. Marks are kept under `_checks/`, which no
  scope can collide with, so **the scope format goes from 11 to 12**: an 11
  reads as a 12 with nothing marked, and the pass that brings it up moves no
  scope. Format 11 is already public, so its meaning is not changed after the
  fact; the number is what makes a build that reads 11 refuse a 12, rather
  than save over `_checks/` without knowing it is there.

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

## As built, 3.6.1: an assignment on the chart, and badges that name

§7's chart now does what its design drew. **A person's chip opens their
assignment.** In a unit the open scope keeps, a chip chooses the assignment
(`app/units/useChartChoice`, held by the workspace, one for the window and on
the chart it was made on) and the inspector docked beside the chart shows it
(`app/units/AssignmentInspector`): who, *ext* where the register says they are
from outside, the role and the unit, the days, the share, a note where they
hold more than all of their time on the chart's day, *End on* a last day the
person chooses — the day before a later chart day or today, never before the
first — as one step, *Correct…* through `AssignDialog`, and *Open in People*.
An assignment is not an element, so the editor draws it through a seam of its
own: `EditorPages.inspector`, what the inspector beside a laid-out view shows
while nothing is selected; the editor selecting anything lets the choice go.
A chip in a unit kept elsewhere still opens that unit there. Where the scope
is only read, a manager of the unit may still end and correct it (§12).

*Open in People* leaves the scope for the organisation's home with the People
page up and the person picked (`WorkspaceNavigation.onOpenPeople`): the person
rides on the shell's page request as `select`, which is not part of the place,
so no register id enters the window's history.

**The badges say what they mean.** A unit serving several domains names them
by their scopes' names, the first two and how many more past three, on the
chart and on the Conway map (`app/units/chartWords`). A unit's first and last
day name the plan that introduces or retires it: the index lists every actor a
plan that was not abandoned names so (`ScopeIndex.unitPlans`), and
`unitViewsHere`'s `plansOf` lays the open scope's plans over it.

## As built, 3.6.1: a library brought in as a choice

The arithmetic under the amendment's second point: the choices a step takes,
the hints between libraries, and the rows a dialog shows before anything is
written. The dialog that shows them follows.

**`bringIn` takes the choices**, each by entry and each optional, so an ask
that says none brings the library as it is (`operating/bringIn.ts`):
`names`, what an item made is called here; `placements`, where a unit type
made sits — at the top, in the organisation's own types, in entries of the
ask, which then come with it; and `reuse`, a role or unit type of the
organisation's that stands for an entry. What an ask brings follows them
(`entriesReached`): a type placed elsewhere does not bring its library's
places, and an entry reused brings nothing — not a reused role's
responsibilities, nor a reused type's roles — while every slot and `within`
that named it names the item reused. A reuse of an id the organisation does
not hold, or of the other kind, is passed over. It is still one transaction,
undone whole; every item made keeps `basedOn`, and an item reused is left as
it is.

**`alike` hints** are said on both ends, as `library:entry`: Scrum's team,
product owner, scrum master and developer are alike SAFe's agile team,
product owner, team coach and team member, and SAFe's product management is
alike IT4IT's product manager. Team Topologies' four kinds carry none: they
are kinds of team by what a team is for, and a Scrum Team or an Agile Team
may be any of them.

**The rows** (`operating/comingIn.ts`) are every unit type and role the step
reaches: ticked, or come along and for which; made, reused, or brought in
before and used as it is; with its name, a type's place and the places
offered, and a role's reuse. `choicesOf` hands the rows back as `bringIn`'s
choices, so what the dialog shows is what is written. The defaults are
suggestions:

* A role is reused where something stands for it (`suggestedReuse`): the
  item brought in from an `alike` entry, or else one of the same name once
  case, accents, spaces and punctuation are set aside, in any of the
  library's languages. A unit type is offered the same, and is brought in
  unless the person takes it.
* A type at the top of its library that holds none of its library's types
  lands beside the organisation's deepest type that holds nothing — the same
  `top` and `within`, the lane's order breaking ties (`defaultPlacement`).
  Anything else, and an organisation with no such type, is placed as in the
  library.

**What a step records** beside what it makes. A name chosen that is not the
library's term in the language brought in is kept as `basedOn.name`, and
*compare* reads the item's name against it: a rename on the way in is no
difference, and a rename since is one, with the library's term and the name
chosen beside it. A reuse is recorded on the item reused, in `alsoBasedOn` —
the entries a bring-in matched it to — rather than on a type whose slot names
it, because a role ticked on its own has no such type. It is an update in the
same transaction, after the adds, so one undo takes it out with the rest, and
a step that only matches is a step of its own (*Matched 2 items of a library
to your own*). Both are records, so whatever asks what stands for an entry
reads them and guesses nothing: `broughtFrom` finds the item brought in from
an entry, else one matched to it, so a library opened again shows a matched
entry as in the model, *matched*, and neither offers nor suggests it again;
`suggestedReuse` reads a match as it reads what came in; and *compare* reads a
slot or a `within` naming a matched item as the entry it was matched to.
*What came in* (`operating/cameIn.ts`) is, per library, the items made from
it — the library's term, the name now, and what *compare* says has changed
since — and the organisation's items matched to it. The folder format stays
11: a 3.6.0 build passes both fields over and its next save drops them, after
which a name chosen on the way in reads as a rename and a matched entry is
offered again.

## As built, 3.6.1: the structure drawn

The amendment's first point, on the page. The *Units and roles* tab draws the
unit types in their lanes (`operating/ui/StructureLanes.tsx`): the
organisation's card in lane 0, each type once, in the lane `unitTypeLanes`
gives it and in the lane's order, and a line from every place it may sit. The
lines are measured from where the cards ended up after every layout, never
stored (`laneLines`): across the gap to the next lane; along a rail of its own,
in a band above the cards, where a line skips a lane; and dashed, back along a
rail, where a loop was cut. A line to or from a type that sits nowhere is not
drawn. The lanes draw nothing they are not handed — the cards, and how each
line stands to what is picked — so a library's own types can be drawn the same
way, read-only, with cards of their own.

A type's card (`TypeCard`) says its name; where it came from, its library's
name from `basedOn` or *own*; how many units of it there are today, which the
host counts across the tree with the open scope's session over it
(`app/units/operatingCounts.ts`), since the page knows nothing of units; its
slots, with their counts and the managing mark; *several domains*; the limit;
and its last day. Where it may sit is said aloud rather than drawn. Picking
(`structurePick`) lights, for a type, the types its `within` names, the
organisation where it may sit at the top, the types that may sit in it and its
roles, and for a role the types that hold it; everything else dims, and
pressing the pick again lets it go. The order in a lane is moved in the
inspector, *Move up* and *Move down*, each one step of `moveUnitType`; cards are
not dragged. Under the lanes, *Sits nowhere yet* and *Roles in no unit type
yet*.

Two things beside it. Removing a role that somebody holds today or later says
first how many people hold it and in which units, as the host counts them
(`model/units`' `holdingFrom`); the removal stays one step, and ending the role
on a day stays the way to move them first. And the operating model's two
findings, which no index holds, are said under *Needs attention* on the
organisation's home off its own document (`operatingModelFindings`), each
opening the operating model's page with the item picked rather than a board.

## As built, 3.6.1: a library brought in from its dialog

The amendment's second point, on the page; the rows under it are above.
*From a library…* stands beside *New unit type* and *New role*, an empty
model offers *Start from a library* first, and each library's card on the
*Libraries* tab opens the same dialog on itself
(`operating/ui/LibraryDialog.tsx`). The dialog lists the libraries on the
left and draws the one picked in the middle as its own structure, read-only,
in the lanes the page draws the organisation's own types with
(`LibraryStructure`): each type keyed by its entry, with its purpose, its
slots and a tick box, the organisation's lane narrower than the rest, and the
roles none of its types holds under the lanes. A type or a role that comes
along with a ticked one is drawn dashed; pressing a role folds out what it
answers for, since responsibilities come with their role and are never
ticked; an entry something stands for already says *in your model as …*, or
*(matched)*, and is ticked for good.

*What will come in* (`ComingInPane`) is the rows, each edited in place: a
name made, starting from the library's term in the screen's language; a unit
type's place, as `placementChoices` offers them; a role's reuse, the
suggestion first, and a unit type's where one is suggested. What the step
makes is counted on its button, and *Bring in* hands the rows back through
`choicesOf` to `bringIn`, so what was shown is the one step written. It is
not the whole window: it sits below the shell's toolbar where the host keeps
one, and its paper is never a handle that moves the window.

After the step the page marks what it made *new* until the page is left, and
draws its own toast, inside the page so the keyboard reaches it, with
*Undo*. The host answers, straight after the step is dispatched, what takes
that step back (`undoStep`): the session's undo, only while no step has come
since by the session's revision, so an *Undo* pressed late says it was not
undone rather than taking somebody else's step back. On the *Libraries* tab
the tick boxes are gone: each library's card says what it offers, opens the
dialog on itself, and lists *What came in* from `whatCameIn` — the library's
term, pressed to open the item on its tab, beside its name here, renamed in
place, and what has changed since in a few words; and the organisation's
items matched to it, *used your …*. The trademark notice stays. A place
chosen at bring-in is recorded the way a name is: one that is not where the
library puts the type is kept as `basedOn.placed` — `top`, and the types it
sat in by id — and *compare* reads the type's `top` and `within` against it
rather than the library, so a Scrum Team put beside the organisation's Team
is no difference and a move since is one (the format stays 11; a 3.6.0 build
drops the field on its next save).

## As built, 3.6.1: folds, the outline, and one order wherever units are listed

The amendment's fourth point, on the screens.

**The chart folds.** A unit with units under it folds by a caret beside its
name, and then says what it hides: its units, the people in them — each once —
and, where there are any, the vacancies and the findings about them
(`model/orgChart`'s `rollUp`, a finding about a person counted at the first
unit where they hold a role, as its line under the chart goes there). Its own
roles stay: a fold hides what is below a unit. The first open of a view with
more than thirty units folds every unit on the second level that has units
under it (`foldedOnFirstOpen`), and the page says so until a fold is changed;
*Fold all* and *Unfold all* are on the bar. A fold is the screen's and never
the model's: the shell holds one memory of folds for as long as the window is
open (`app/sessionFolds.ts`), each view's under a key of its scope and its id,
and the scope tree's toggle is the same toggle. Nothing of it is saved, so the
next session opens as a first open does. An agent reads the chart off the
model (`diagram.inspect`), unfolded; a picture of the page (`diagram.render`)
is of what is drawn, folds and all.

**The outline is a tree again**, beside the chart where the first build's
*Show* select was (`app/units/ChartOutline.tsx`): the chart's units in the
chart's order, folding on its own — the first open folds it the same way — so
it can be read without folding the chart. It no longer narrows the chart to
one unit. Picking a unit there, *Find a unit* (every word of its name, the
rule every finder reads), *Find me*, a finding and a request from outside all
go to the unit the same way: the units above it unfolded on the chart and in
the outline (`unitsAboveIn`), the chart scrolled to it and the unit ringed,
and chosen where the open scope keeps it. A unit kept elsewhere is gone to
without leaving the scope.

**Order among siblings is moved in the outline.** Under it, *Move up* and
*Move down* move the unit picked among the units of its type under the same
parent (`siblingsOfType`, `unitMovedTo`) — buttons, which is the keyboard's
way as much as the pointer's; there is no dragging. The rows renumber that
list from 1 in the actor's own `order`, and each is an `element.update` in the
scope that keeps its unit: they land as people's moves do
(`app/units/landPeopleMoves.ts`), the other scopes in one apply, all or none,
and the open scope's part as one step through its session. So a move is one
step in each scope that keeps one of the siblings. Where that is the open
scope alone, undo takes it back whole; where other scopes were written too,
the open scope's step carries a barrier of its own (`chart.orderBarrier`), and
the page says how many steps it was. A managing role's right never reaches
it: who stands where is structure. A scope only read offers no move.

**One order everywhere units are listed**: the chart and the outline, the
Conway map's columns (`model/conway`, whose input now carries the unit types
whole), a plan's moves and the units an interaction is declared with on the
Conway map, `diagram.inspect` of either view, and the units a unit's
inspector offers to declare it works with.

## As built, 3.6.1: each link edited from either end

The amendment's third point, on the screens. Neither field is new and nothing
is kept twice: who serves a scope is `unit.scopes`, and who answers for an
area, a grouping or a capability is its `assigned` row.

**A unit serves** the scopes its `scopes` names, or the scope it is filed in
where it names none; a unit under one that serves a scope serves it through
that one (`model/serving.ts`). Adding a scope keeps that reading — a unit that
said nothing goes on serving its own scope beside the new one — and taking
the last one away leaves it serving its own scope again, so a unit filed in
the scope it is taken off is not offered the ✕.

**A scope's *Served by*** — on its home and in its settings — lists the units
that name it, and those filed in it that say nothing and sit under no unit
that serves it, in the one order for units; the others are counted as
serving through them. Each says its type, who holds a managing role in it
today, and where it is filed when that is elsewhere. *+ Unit* picks from the
organisation's index, grouped by type in rank order, each unit saying where it
is filed; a unit whose type serves one domain and serves one already, or that
is kept where the person may only read, is shown and not offered. Adding or
taking a unit off is `unit.scopes` written as one step in the scope that keeps
the unit, through the source's repositories and under that scope's own right
(`app/units/writeIn.ts`): who serves a scope is structure, so a managing
role's right (§12) does not reach it. The **domain owner** is the rule applied
to one unit, the serving unit filed highest in the scope — one filed in it
before one filed elsewhere, then the one with fewest units above it, then the
one order (`owners.domainOwnerOn`).

**The sheet's *Assigned to*** picks from the same list, with the scope's
other actors after the units; the row is kept in the open scope, and a unit
filed elsewhere is its far end (ADR-0012 §5), drawn on no board for it.
*Show who is responsible*, in the sheet's bar, off by default and the page's
own, names the units on every area, grouping and capability from their rows
here and elsewhere, and marks those nobody answers for. A unit's inspector
keeps *Serves* and *Responsible for*, each with a *+*: a scope picked for
*Serves* is a step in the unit's session; a capability for *Responsible for*
is a row written where the capability is defined — the open scope's in its
session, another's as that scope's step.

**The check** is `check.unitNotServing`: an `assigned` row from a unit there
on the day to a function whose domain — the scope that defines it, or one
above or within it, since scopes nest — neither the unit nor a unit above it
serves. It is about the scope that keeps the row, names the unit and the
domain, and is read with the organisation's other findings, the open scope's
rows laid over the index's (`OrganisationAt.assigned`). The agent's tools
already write both fields — `element.update` with `scopes`, `relation.add`
with `assigned` — and `checks.list` names the finding; no tool was added.

## As built, 3.6.1: a unit's inspector, unit first

3.6.0 drew a unit's section under the actor's General tab, a screen below
the element's own fields: name, *Move…*, the record's line, the three
tabs, lifecycle, *Managed*, the description and *Create drawing*. For an actor
with a type the order is turned over. The name stays on top, with *Move…* and
*Create drawing* in a *⋯* beside it. Then come the type, with where the unit
is filed in a quiet line under it, and the unit's sections: roles today, every
role listed with *+ assign*, optional ones included; who manages it, one line
for each holder, with the reason and what a build with accounts grants from it
behind *why?*; serves, owns, responsible for, works with, over time and the
checks. Last is *Element*, folded, which holds the record's line and the three
tabs; it folds again for each unit picked. On the element's page the same
fields are laid out below the unit. An actor without a type, and every other
kind of element, keeps the element's order.

The editor still knows nothing of units. The host's slot says where its
section goes: `EditorOwnership.unitSection` answers `{ section, leads }`
(`UnitSlot`), with `leads` set when the actor has a type (`isUnit`), and the
editor's inspector lays itself out from that. No control name moved and none
was added: the inspector is `board.inspector` as before.

## As built, 3.6.1: the chart laid out to fit, and its summary beside it

§7's chart, made less crowded (the owner, 11 October 2026: "some views are
looking a little cluttered"). **The width is used.** A unit's units — and the
chart's top units — share a grid of columns at least 220 pixels wide
(`app/units/ChartUnitBox`'s `UnitGrid`), read across in the one order for
units; a unit drawn with units under it takes a whole row
(`model/orgChart`'s `drawsUnitsBelow`), so a cluster's teams fill its row
instead of wrapping at a third of it, and a folded one is a cell like a team.
**Only what needs attention is drawn.** A role whose slot asks for nobody and
that nobody holds (`emptyOptional`) is a choice, not a gap, and is not drawn;
a vacancy always is. *Show optional roles*, a switch on the bar, draws them,
each with *+ assign* where the person may assign; it is kept as the folds
are, for the session under the view's key (`useChartFolds`), never as a
preference. A unit's inspector lists every role whatever the switch says.

**What the chart says as a whole is said beside it.** While nothing is picked
— no element selected, no assignment chosen — the inspector docked beside the
chart shows the chart's summary (`app/units/ChartSummary`) through the same
seam as a chosen assignment (`EditorPages.inspector`), in place of the
editor's canvas hint: whose chart and on which day, its units, people and
vacancies (`vacanciesIn`); the findings, moved there from under the chart;
and *How to read it*, the legend moved there from the bar — the dashed
vacancy, the red edge, *manages*, the dashed unit that has ended with people
in it, and where the empty optional roles are. The page and the summary read
the chart and its findings through one hook (`app/units/chartReading`), so
the counts beside the chart are the boxes on it. A finding goes to its unit
as a request from outside the page does (`selectOn`): unfolded, scrolled to,
ringed, and selected where the open scope keeps it. The Conway map keeps its
findings under its columns: lighting a finding's lines and declaring an
interaction from it are the page's own, so they stay where the lines are.
`diagram.inspect` reads every role, drawn or not; a picture of the page
(`diagram.render`) is of what is drawn, so no longer of the findings.

## As built, 3.6.1: a catalogue of checks

The amendment's last point, in part: the catalogue, the keys under it and
what the agent reads of it. The lists that show findings grouped and
explained are built on it.

**In the model, not beside the tree's checks.** The catalogue is
`model/checkCatalogue.ts`: one list of every key (`CHECK_KEYS`), gathered
from the four places findings are worked out — the tree's
(`projects/checks.ts`, whose `Finding` is keyed by `TREE_CHECK_KEYS`), the
dates' (`model/checks.ts`, each kind through `DATE_CHECK`), the Conway map's
(`model/conway.ts`, through `CONWAY_CHECK`) and the one the organisation's
home reads off the technology rows — and a record over it. The model and not
`projects`, because the agent answers a finding's weight and the map's
findings carry a key, and neither may import `projects`. An entry holds keys
of the model's own slice, named after its kind, so an entry cannot carry
another kind's words. `groupByCheck` groups any list of findings by check,
fix before review before note, each weight in the order its first finding
came, and `countByWeight` counts them.

**The first pass, corrected where the code says otherwise.**
`check.offeredNotShared` is a review, not a note: ADR-0014 §4 calls it a
conversation the maintainer has to have, and the register draws it as a
warning beside a conflict. `check.causeExplainsObservationBelow` is a review,
not a note: ADR-0032 §9 names its repair, and no new link of its kind can be
made, so nobody intends one. The roadmap's *staleness* is no kind of finding:
it is the caption under the dates' findings, saying they cannot tell a
landscape is out of date. And one kind the first pass did not list is in it:
a service nothing delivers, which the organisation's home has said since
ADR-0014, is `check.unrealised`, a review of the landscape — its row on the
home keeps the word it carries on screen.

**Notes said as facts.** Of the notes' sentences, two read like faults and
were changed: the Conway map's unused interaction says *… declare As a
service, and no interface runs between them*, not that no interface needs
it; a proposal says the organisation *has not named it yet*, without telling
the domain what to do. A record on no view already said it may stay a record.
The map's over-limit is said in the organisation's words for it, as the
unit's inspector says it.

**The agent.** `checks.list` answers each finding's `weight` and `category`
beside its `key`, and `diagram.inspect` on a Conway map answers each of its
findings with its `key`, `weight` and `category` too, its `kind` as before.

## As built, 3.6.1: not the same person, and the possible duplicates folded

§9's four signs suggest; until 3.6.1 nothing could say *no*, so a pair that
were two people was offered for ever. Now a person answers it, and the answer
is kept.

**The record** is a list beside the entries, not a field on them
(`people/distinct.ts`): `{ a, b, on }`, an unordered pair of ids kept as
`a < b`, and the day it was answered. It names nobody, so it is kept in the
register and outside the history, as the entries are, and a file made without
names carries it as it is. **The port** gains it (`ports/PeopleRepository.ts`):
`PeopleRead.distinct`, every pair in id order — absent, none, which is what a
register from before says; `answerDistinct(a, b, on)`, in either order,
refused `people.badDistinct` for one entry twice and as a change to either
would be (unknown, a redirect, forgotten, a bad day), and answered again
keeping its first day; `takeBackDistinct(a, b)`, which refuses nothing and
says whether there was one (`taken`); `bringIn`'s third argument, the pairs
carried in; and `PeopleChanges.distinct`, every pair as it now is where any
moved since the revision. The contract suite pins each rule below, so a
server's register is held to them too.

**The rules are `changePeople`'s** (`people/register.ts`, its fifth argument
the pairs held, its answer `distinct` and `distinctChanged`): every change
carries the pairs through over the entries as they stand after it
(`tidyDistinct`). Forgetting or removing either entry drops the pair — a
pseudonym is nobody to compare. Merging either into a third carries it to the
entry kept, and drops it where that entry is its other half: one entry is not
two people. A bring-in joins the pairs carried in to those held, whichever
entry is further gone still winning, and drops a pair whose id was removed,
here or there.

**Where it is kept**: this browser on a shelf of its own, `peopleDistinct`,
under the two ids (the database at version 6), each change a line in the
register's log that says the pairs moved; the folder in `people.json`, as
`distinct`, written only where there is one, the file still at version 1. A
3.6.0 build reads past the key and writes the file without it on its next
change to the register: the pairs are possible duplicates again, and nothing
else is lost. The working file carries the file whole; a copy from an address
carries a pair only where both its entries go, and copying a browser's work
into a folder, or a working file into a new folder, takes the pairs along.

**What it silences** is that pair, wherever it is about the two of them:
`duplicatePairs`, the warning *Correct…* now gives of whom a corrected entry
may be (`possibleDuplicates` with the entry and the pairs), and `people.list`'s
`possibleDuplicates`. A new person is still checked against both. **No tool
answers or takes back**, as none merges (§13).

**Who may answer**, and take back: whoever may merge both entries
(`mayMerge`), and — where a source grants a managing role's right (§12) — a
manager whose units, and those below, hold both people today
(`model/managing.holdsAllIn`, pure, so a server's door asks the same; handed
to the page as `PeopleRegisterAccess.managesBoth`). An answer merges and
removes nothing and is taken back as easily, and a manager knows their own
people. The source's own door decides it again.

**On the People page** the possible duplicates are folded every time the
page opens and kept as nothing: one line with how many, a count by sign and
*Review*; open, a pair is one row, strongest sign first, the two people side
by side with what tells them apart — the first role today and how many more,
the work address, *External*, and *account* where a source with accounts says
an entry is linked to one (`SourcePeople.linked`, absent in core) — the sign
as a quiet tag, and *Merge…* and *Not the same person*. *Merge…* asks first
which entry is kept: the linked one, then the one with more assignments, is
chosen to start with, and the other can be. *N answered as not the same
person*, under the list, opens the answers, each with *Take back*. The fold
is not there when no pair is left. And the page's two paragraphs of
introduction are one muted line with *About the register*, and *Roles today*
one line: the first role and how many more, every one in the person's panel.

## As built, 3.6.1: marked as intended

The amendment's marks, in core, with no screen yet: the record, its two
commands, the folder and the index, and what the agent reads. The Checks page
and *Mark as intended…* are drawn on it.

**The record** is `CheckMark` (`model/checkMarks.ts`): `check`, `key`,
`reason` where one was given and `on`. Its id on the model is the check and
the key (`checkMarkId`), so a scope holds one mark of an instance at most; a
list on the scope's model, `checkMarks`, in the order the marks were made.
**`findingKey`** says each kind's key from its subjects' ids, one rule per
kind, for every shape a finding is worked out in — the tree's and the
technology rows' (said about a scope), the dates' and the Conway map's. The
key is the record the finding is about, then the records that make it this
instance: the unit and the role of a vacancy, the responsibility and the
roles accountable for it, the service and the applications using it from
outside, the cause, the scope below and its observation, the person over all
of their time. An interface and an interaction are the row and its two ends,
never the columns the map drew them in, so a mark holds whichever way the
map is grouped; the map's over-limit is the organisation's instance. A plan
overdue is the plan and the day it was due, so a plan given another end and
overdue again is asked again. A fix's key may be shared by two of its
instances, and is never marked.

**Two commands**, each the other's inverse (`model/commands/checkMarks.ts`):
`checkMark.add`, refused `command.markFix` for a fix or a check the catalogue
does not know, whoever sends it, and `command.taken` for an instance marked
already; and `checkMark.remove`, by id. A reason said again is a mark taken
back and made again, which is what a restore does. The Activity list names
the check, in the language on screen, and not the instance; the diff names
what the first subject is called. A mark is a record of its own in a thing's
history and in a restore, which makes no fix's mark again.

**On disk**: `_checks/marks.json` in each scope that keeps marks
(`adapters/folder/format/checkMarkFile.ts`), under format 12. A row of a fix,
of a check this build does not know, or without a key or a day is passed
over, so a model never holds a mark that cannot be made — which is also what
keeps taking one back undoable; a build that adds a check whose marks an
earlier one must keep turns the number again. A file that is not a list
opens the scope to be read and not written. A folder at 11 reads as a 12 with
nothing marked and the pass moves no scope, a scope called `checks` included;
a folder at 12 is one past what a 3.6.0 build reads, so that build refuses it,
lists it as unreadable and saves nothing over it. The working file carries
the folder; browser storage and memory keep the list in the model, so their
content format stays 2.

**The index** reads each scope's marks with its records and lists them,
`checkMarks()`, with the scope that keeps each — in every store, held by the
organisation index's contract. **`splitMarked`** splits any list of findings
into `shown` and `marked`, each in the order it came: a finding said about a
scope is silenced by its own scope's marks, one of the dates' by those of the
scope given, a Conway map's by a mark wherever it is kept, and a mark on a fix
by nothing. `projects/checkMarks.ts` lays the open scope's session over the
index (`checkMarksHere`) and says where a finding's mark is kept
(`checkMarkScope`): the scope the finding is about, the scope the dates were
checked in, or where the map's row is kept and its application or unit
defined.

**The agent.** `checks.list` answers what is still to look at in `total` and
`some`, and what a person marked apart, under `marked`, each finding with its
`mark` — the day and the reason. No tool makes a mark or takes one back, and
the tool's description says so; the refusal's sentence is there for a step
that reaches the writer from elsewhere.

## As built, 3.6.1: one list of findings

The amendment's lists: every place that lists findings draws one list,
grouped by check, folded and explained. *Mark as intended…* and the Checks
page are drawn on it, and each has its place in it.

**One component, knowing no model.** `widgets/FindingsList` sits below the
model in the import matrix, so it is handed what it draws: the groups
(`groupByCheck`), the words as keys in one table the catalogue publishes
(`CHECK_LIST_WORDS`: the weights, the categories, the actions, and the list's
own few), each instance's sentence as its screen said it before, and each
action as what that screen does for it — a press, a choice of several (a
menu: the two units, or the two units' applications), or nothing, and then no
button. It is drawn by the organisation's home (*Needs attention*), a unit's
**Checks**, the chart's summary, the Conway map, a plan's **Still open** and
the roadmap (`RoadmapFindings`), which `build/findingLinks.test.ts` holds to
that list. The operating model's card and page list no findings: the card
counts the responsibilities without their A, and the page draws a check on
each row of its matrix and a tray for the types that sit nowhere.

**Grouped, weighed and folded.** One row per check — its weight's mark, its
name and how many — folded, fix before review before note, with a line saying
how many there are to look at and how many notes, and one saying what each
mark means. The notes wait behind *Show notes (N)*. What a list has unfolded,
and whether its notes are shown, is kept for the session under the list's own
key in the shell's `SessionFolds`, handed down as a context
(`widgets/sessionMemory.ts`), and never saved. The marks are drawn in the
error, warning and secondary tokens, measured in both themes.

**An instance opens its explanation** in the list's place: the instance in its
sentence, the weight and the category, *Why it matters*, *How to fix it* and
the actions, the focus on its title; *All findings* goes back to the instance.
A finding the actions put right leaves the list, and the list comes back.

**What each screen does.** The home: the record, the drawing, the operating
model's page with the item picked, the other definition, and *Link…* for a
definition kept twice where the home may be written — where a row went
before. A unit's checks: *Assign…* for a role short of people and *End the
assignment…* for one that outlived its unit or role, where that role's people
may be changed. The chart's summary: *Open the unit* on the chart — for a
capability answered for outside the domains served, the unit that answers —
and *Open in People*. The Conway map: *Declare an interaction…* where a unit
of the two is kept here, *Open the interface* at the application it starts
from, *Remove the declaration* where this scope keeps the row, *Model the
missing interface…* — `modelInterface`, a new action, the two units'
applications to open — and *Open the two units*; opening an instance lights
what it is about, as a press did. A plan's **Still open**: the unit; a
responsibility that loses its A is said under `check.accountability` and an
interaction to declare under `check.interfaceUndeclared`, whose *Declare an
interaction…* opens the plan's unit. The roadmap: the element, the row's
element, the plan, and *Accept*.

**The home lists its notes** now that the list hides them: a record on no
board, left out before, and a domain's proposal, listed before as if it were a
fault. Its items carry the finding's `fields`, `scopes` and `person`, which a
mark's key is made of. *Show all* and its control name `org.attentionMore` are
gone with the folding past six; `findings.group`, `findings.instance`,
`findings.showNotes`, `findings.back` and `findings.action` are named.

**What was marked is not in the groups.** Each screen splits its findings
(`splitMarked`) — the home by the tree's marks, the unit, the chart, the map
and a plan by the tree's with the open scope's session over them, the roadmap
by the open scope's own — and hands in the shown. The list keeps two places
for the marks: under the groups for what was marked (`accepted`), and under an
explanation's actions (`more`).

**The agent.** `checks.list` leaves out the notes by their check's weight —
a proposal too, now — unless `notes` is asked, or `information`, its older
name, or the check by its key; and each finding answers its check's `why` and
`how` in English beside its weight and category.

## As built, 3.6.1: marked as intended on screen, and the Checks page

The amendment's last two screens, on the record and the list built before
them: a mark made and taken back wherever findings are listed, and a page of
every check over a home.

**Mark as intended… and Accepted (N).** Every list of findings fills its two
places (`widgets/FindingMarks`): under a review's or a note's explanation,
*Mark as intended…*, which asks why in one field that may stay empty and says
what a mark does before it is made; under the groups, *Accepted (N)*, folded
for the session, each mark with its reason, its day and *Take back*. A fix
offers no mark. Which scope keeps a mark is `checkMarkScope`'s answer, and a
Conway map's finding about something the open session holds is kept in the
open scope before the index has read it. **How it is written follows the
scope** (`app/checkMarking.tsx`): the open scope's mark is a command through
its session, one step with one undo; another scope's is that scope's own step
through the source's repositories, under that scope's rights
(`units/writeIn.ts`), as *Served by* writes — never a step on the open
session. A scope the person may only read offers neither a mark nor *Take
back*. The marking is handed down as a context from the workspace and from a
home, so a unit's checks, the chart's summary, the Conway map, a plan's *Still
open* and the Checks page reach it alike; the roadmap, which may not import
the app, marks the dates of the open scope through two actions of its own
(`RoadmapActions.markIntended`, `takeBackMark`). A mark is made on the day the
window reads off its clock.

**The Checks page** (`app/organisation/ChecksPage`, a part of its own, opened
from a card on every home, from the home's counts, and by `app.open` with
`page: 'checks'`, its `id` a check's key). Every check of the catalogue, by
category, fix before review before note, with its weight's mark, its name and
how many it finds — none included; the weights shown are chosen on the bar,
the notes hidden until shown, for the session. A check picked says its weight
and category, why it matters and how to fix it, every instance at or under
the home, each in its scope and opening where it is fixed, with *Mark as
intended…* where one may be made, and what was marked, with *Take back*; a fix
says why it cannot be marked. **What it lists** (`treeChecks.ts`) is worked
out from what the shell holds, nothing loaded for it: the tree's findings, the
register's and the technology rows' and, at the organisation, the operating
model's — what *Needs attention* listed; every scope's dates, over the
records, rows and plans the index read with it, as its roadmap checks them;
and the Conway map over the home, at the organisation over the whole of it,
its over-limit said once with the organisation's. The checks worked out from
a scope's whole document — a record on no view, the owner's detail on a
stand-in, a row's end nobody holds, a drawing's link, the business layer's
two, a cause explaining an observation below — are listed with their
explanation and *Not counted here*: only an open scope has the document.

**Needs attention counts.** On a home it is a line of counts by weight — so
many to fix, to review, notes — each opening the Checks page on the first
check of its weight that finds something, and nothing where nothing is found;
the findings, and the row ids and `data-finding` words something outside
pointed at, are on the page under their check. What a home's explanation
offered — *Link…* for a definition kept twice, the other definition — is
where the instance opens. `org.card.checks`, `org.attentionCount`,
`checks.weight`, `checks.row`, `checks.instance`, `findings.markIntended`,
`findings.accepted` and `findings.takeBack` are named.

**The agent.** `app.open` takes `page: 'checks'`, on a check by its key, and a
key the catalogue does not know is refused; `app.current` says the page is up.
`checks.list` answers each finding as the page says it — weight, category,
why, how, and the marked apart — over the tree's findings; the page lists the
dates' (`roadmap.check`) and the Conway map's (`diagram.inspect`) beside them,
which the tool's description says.

## Amended, 12 October 2026 — a unit deleted takes its assignments

*Accepted and built 12 October 2026: As built, below.* Deleting a unit left
every assignment that named it in place: nothing in the delete touched
assignments, and no check said so. The person kept counting as holding the
role — in their load, on the People page under what they hold, and in who
manages whom where a build grants a right from it — in a unit nobody could
see or open any more.

**Deleting a unit is a correction, so its assignments are removed with it.**
The rule of §6 decides it: a correction is an edit, a change has a day. A
unit that ends is retired on a day — its lifecycle, or a plan — and its
assignments then end on that day, which `check.assignmentEnded` and *Move the
people* already handle. A delete has no day: it says the unit was never
there, and nobody held a role in it, so its assignments go too, ended ones
included, as if never made. Ending them on the day of the delete instead
would keep a history of roles in a unit with no history of its own, every one
of them naming nothing. The confirmation says who stops being what, and that
retiring the unit is the way to keep who held what.

**An assignment left behind is a fix.** One whose unit is not there — deleted
before this amendment, deleted in another window whose step this one never
saw, or an actor that is no longer a unit — is `check.assignmentOrphaned`,
whatever its days: weight fix, in the organisation's category, about the
scope that keeps it and naming the person. What fixes it is taking it away,
as the delete would have.

## As built, 12 October 2026: a unit deleted takes its assignments

**The writer.** `element.delete` takes every assignment kept for the element
in the same step (`model/commands/elements.ts`), ended ones included, and
its inverse puts them back at the places they had, after the element — so a
delete from the inspector, the board, a selection, a sheet, the agent's
`element.remove` and a cross-scope gesture all do it, and one undo restores
the unit and its people. Its write key stays the element's, as a delete's
relations do. A gesture that moves a unit and keeps no stand-in now removes
the assignments it carries before it deletes the record
(`projects/gestures.ts`), since the delete would otherwise have taken them
first and the removal found them gone.

**The confirmation.** `deletionSummary` names each person in each role in
each unit a delete ends — an assignment still running or still to begin, on
the host's day — and counts the ones already over
(`model/units.rolesEndedBy`); `rolesEndedSentences` says them, five by name
and then how many more: *Ada Lovelace stops being Product owner in
Webshop.* The board's remove-or-delete question and its confirmation of a
selection list them (`widgets/RolesEnded`), the person by the register, the
role by the name the host hands in (`EditorOwnership.roles`), with *To keep
who held what, end the unit on a day instead*. A sheet's *Delete* on an
actor that ends a role now asks first, with the same lines, drawn by the host
(`SheetResponsible.rolesEnded`), since a sheet may not read the register; one
that ends none deletes as it did. `element.remove` answers
`assignmentsRemoved`, each with its role and person, and its description says
a unit's assignments go with it.

**The finding.** `unitFindings` reports `orphaned` for every assignment whose
unit the organisation does not hold, before it reads the day, and
`endedUnit` only for a unit that is there and has ended; the tree says it as
`check.assignmentOrphaned` (`projects/checks.ts`), about the scope that
keeps the assignment, its id the assignment's, naming the person and the
role. On the Checks page an instance opens the person on the People page —
there is no unit to open — and offers **Remove the assignment**
(`removeAssignment`, a new action of the catalogue), written as the page
writes a mark (`app/checkMarking.tsx`): through the session where the scope
is open, as that scope's step elsewhere, nothing where it is gone already or
the scope is only read. The agent has no tool that removes an assignment, as
before (§13): `checks.list` names the check, and a person removes it.

## As built, 3.6.2: the stakeholder rail draws the units a sheet uses

The sheet's rail drew every actor in the scope (ADR-0012 §3), and a unit is
an actor with a type, so a sheet at the organisation's root drew every unit
filed there among its stakeholders. The rail now draws the actors without a
type as it did, and a unit only where the sheet uses it, in a group of its
own under the parties, *Units on this sheet*: a unit at the far end of an
`assigned` row to an area, grouping, capability or step the page draws — the
rows *Show who is responsible* chips, a row another scope keeps included —
or one whose lane the journey draws. Each says why in a quiet line, the
first thing it answers for here (*and 2 more*) or *Has a lane*. The list is
flat and in the tree's order, a unit filed under one in another scope
included; the chart is where a unit's place is read.

A unit with a party under it stays in the parties' tree as that party's
group, so a party never leaves the rail for where it is filed. Lanes are
untouched: a lane whose actor is a unit is drawn as before.

*All units*, a switch at the foot of the rail with the count it would add,
draws the scope's other units too, under *All other units*. It is the
session's, kept in the shell's session memory under the view's key
(`foldKey(scope, view, 'rail')`), and never saved. A stakeholder typed as a
unit while the sheet is drawn and may be written stays where it was for the
session, in the render it changed in, with a note that it is now on the
organisation chart; the same memory keeps it. Nothing in the model changes.

`business/sheet.sheetPage` takes the session's options (`RailOptions`) and
works out what the page uses (`usedHere`); `railOf` groups the rows
(`SheetActor.group`, `uses`) and counts what it leaves out (`unitsNotDrawn`).
The capture draws the rail on screen without the switch, and
`diagram.inspect` on a sheet reports the rail a person first sees, with each
row's group, what a used unit answers for and the count left out. The
switch's control name is `sheet.allUnits`.

## As built, 3.6.2: a unit made on the chart

A unit is made where units are seen. **+ Unit at the top** is on the chart's
bar, in the outline's header and on an empty chart, and each unit's name row
has a quiet **+** — shown on hover, on focus and on the unit picked, always
reachable by the keyboard — for a unit inside it (`app/units/AddUnit.tsx`).
None of it is drawn on a chart that is only read. The old way stays: an actor
typed in its inspector, on a board or a sheet.

**The dialog** (`NewUnitDialog`) asks for the type, the name, the domains it
serves and the scope it is filed in (`app/units/newUnit.ts`). The types are
only those that may sit there — under a parent, those whose `within` holds the
parent's type; at the top, those with `top` — and that run on the chart's
day, in the one order of lanes (`unitTypeRank`), so a unit made here is never
`check.unitMisplaced`. *Serves* is asked only at the top or for a type that
`spans`; a non-spanning type takes one domain, and a unit inside another
serves through it. *Filed in* defaults to the parent's scope, which keeps a
subtree under the same rights; at the top, to the one domain it serves where
its type does not span, otherwise to the chart's scope. It offers only the
scopes the person may write (`WorkspaceSource.writable`), falling back to
the chart's scope and then to the first; where they may write none, nothing
is made.

**One step in the scope it is filed in**: an actor with `unitTypeId`,
`parentId` where it sits in a unit, and `scopes` only where domains were
picked, its id minted by the session's policy, which reads the whole tree's
ids. Filed in the open scope it is the session's step; filed in another it is
that scope's step, written as a link kept at the other end is (`writeIn`,
under that scope's rights), and a refusal is said in the dialog. It is
structure: a managing role's right (§12) does not cover it. Once the chart
draws the new unit it is gone to as a pick in the outline goes — the way to
it unfolded, scrolled to, and selected where the open scope keeps it — and
its type's required roles are vacancies on it (`useNewUnit`).

**Where nothing may sit**, the place says why: *+ Unit at the top* is
disabled with the reason and a link beside it, and a unit's **+** is marked
unavailable, its tooltip says why, and pressed it opens the dialog with the
reason — *No unit type may sit in a Team* — and the **Operating model**. With
no unit types at all the reason is that, and the link is *Start from a
library*, both opening the operating model at the organisation.

**Names.** `chart.addAtTop`, `chart.outlineAdd`, `chart.addFirst`,
`chart.addInside` and `chart.newUnit` are named. The agent's tools need
nothing new: `element.add` already takes `kind: 'actor'`, `unitTypeId`,
`parentId` and `scopes`.

## As built, 3.6.2: a unit pressed on the chart lands on its inspector

Pressing a unit another scope keeps, on a chart or a Conway map, opened the
scope already open on that unit's record page, and selected there an id that
scope does not hold: the inspector beside the chart showed the panel for
several things selected. It now opens the scope that keeps the unit
(`onOpenScope`, `page: 'element'`), and a unit that scope keeps lands on its
chart, chosen, with the unit's inspector beside it (`unitLanding`, read when
a scope opens on an element) — on its record where the scope has no chart.
An application kept elsewhere still opens there on its record. The docked
inspector shows the multi-selection panel only for more than one thing: a
sole selected id the model does not hold falls to the page's own inspector
(`EditorInspectorDock`). The *New unit* dialog no longer says what rights
decide; *Filed in* says *Kept with the unit it sits in*, and shows the
organisation by name where it is chosen.

## As built, 3.6.2: deleting a unit says what goes, and offers ending first

The repair of 12 October took a unit's assignments with it. What else named
the unit was left behind: the units filed under it kept a `parentId` nobody
could find — drawn nowhere on the chart, counted under nothing — every
application that named it as its team (`partyId`) pointed at nothing, and so
did every row kept in another scope, the `assigned` rows to capabilities
above all.

**What goes is worked out once, over the tree** (`model/unitDeletion.ts`),
from the open scope as its session has it and the rest as the tree was read,
as one list of commands per scope, for the screens and the agent alike:

* **The units inside it**, kept here or in another scope, move up into its
  parent by default where their type may sit there (`top`, `within`). Where
  it may not, the default is another unit of the deleted unit's own type,
  first by name; moving them up anyway is still a choice, and they then show
  as `check.unitMisplaced`; *delete them too* takes the whole subtree, from
  the bottom up in the scope that keeps each, with every assignment in it. An
  actor inside that is not a unit goes where they go. Another unit to move
  them into is offered only where one unit is deleted.
* **The applications that name it as their team** have `partyId` cleared in
  the scope that keeps each, and show as owned by nobody.
* **Every row that names it** and is kept where no delete of its ends takes
  it is deleted there. Its `scopes` go with the record.

**The confirmation.** The board's remove-or-delete question and its
confirmation of a selection, and a sheet's Delete, draw the host's part for a
unit (`EditorOwnership.unitDeletion`, `SheetResponsible.unitDeletion`;
`app/units/unitDeletionSlot`, `UnitDeletionParts`), because neither page may
read the tree. It leads with *Ending it is usually what is meant*, and **End
on a day…** opens a last day in place and ends the unit on its lifecycle —
one step, nothing deleted. Then who stops being what, as the repair said it;
*Inside it:* the first three units by name, then how many more, with where
they go — the default chosen, and where it is *up*, the other two choices
folded under **Other choices**; where it is not, all three shown and *Move
them up* marked as misplaced; and a line each, only where there is one, for
the applications whose team is cleared, the domains it serves and how many
areas, groupings and capabilities it answers for. The units inside no longer
hold a unit's delete back, on the board or on the sheet. The controls are
named `unitDelete.end` and `unitDelete.inside`.

**One change.** Delete hands the page's own commands for the selection to
the host (`deleteSelection`, `deleteFromModel` and the sheet's
`removeElement` take a `via`), which puts what the plan adds here before
them and lands the whole with `landPeopleMoves`: every other scope's part as
that scope's step, all or none, then the open scope's as one step through
its session, under `unitDelete.barrier` where another scope was written —
so one undo takes all of it back where only this scope was changed, and
undo says why it cannot where others were. It is structure, so a managing
role's right does not reach it. A row or a record gone since the question
was drawn is passed over (`stepIn`).

**Every other delete.** `element.delete` now does for an actor what it did
for a platform: what sits in it moves up into its parent in the same step,
and one undo puts it back. A delete that says nothing about the units inside
— a gesture, or a host that draws no question — leaves no parent
dangling in its own scope; one kept in another scope is the delete's from a
screen or the agent.

**The agent.** `element.remove` on a unit moves the units inside up where
their type may sit there; where it may not, it is refused
`agent.unitsInside` with the units inside and the choices named, and takes
`units: 'into:<id>' | 'up' | 'delete'` once the person has chosen — an agent
does not pick a new parent for someone's teams. Its answer adds
`unitsMoved` (with `misplaced` where they were moved up anyway),
`unitsRemoved`, `teamCleared` and `alsoChanged`. Where other scopes are
written it lands across them through `SessionView.landSteps`, its steps
marked its own, and the tree view lends `rowsOf`; inside a `batch` such a
removal is refused `agent.scopeNotOpen`.

**Not here.** A plan's moves and the units it introduces or retires that
name the unit deleted are left as they are, as they were for any element; a
stand-in of the unit in another scope stays a stand-in. The organisation
chart offers no Delete of its own: a unit is deleted from a board, a sheet or
its inspector.

## As built, 3.6.4: the organisation's own order of roles and responsibilities

The Responsibilities matrix showed its roles and responsibilities in the order
they were added; 3.6.3 put a filter and A–Z over it. A role and a
responsibility now carry an optional `order`, as a unit type does in its lane:
the organisation's own decision, absent until somebody moves one, so a library
has none and *compare* never reads it (`model/operatingModel.ts`,
`inOwnOrder`). One without stands after those that have one, in the order it
was added. It is written by `role.update` and `responsibility.update` and kept
in the folder's lists with the format unchanged at 12.

- **A role** moves up or down in its inspector (`moveRole`). Its place is the
  matrix's columns, left to right. Since 3.6.5, pressing a column's heading
  picks the role, and its buttons say *Move left* and *Move right*.
- **A responsibility** moves up or down among those of its own group
  (`moveResponsibility`), past whatever of other groups stands between.
- **A group** stands where its first responsibility does. The arrows on its
  heading in the matrix move it past the group beside it (`moveGroup`). The
  responsibilities in no group stand last, whatever is moved.
- Each move is one step that renumbers the list, and one undo takes it back.
- **The matrix opens in this order.** *A–Z* is still offered over it, and
  leaves the order as it is. *As added* is gone: the own order starts as
  added.

## Amended, 13 October 2026 — the organisation is not a domain, and a unit and what it serves link to each other

*Accepted and built 13 October 2026: As built, below.* §3 and the amendment
of 11 October say a unit serves its `scopes`, or the scope it is filed in
where it says nothing. The operating model lives at the organisation, so that
is where units are usually filed — and every one of them then served the
organisation. A unit of a type that serves one domain counted as serving one
already: a domain's *Served by* offered it as unable, and its own *Serves*
had no way to add a domain and a chip for the organisation that could not be
taken off. A unit filed at the organisation could be linked to its domain
from neither end.

**The organisation is not a domain.** No unit serves the root. A unit filed
there that says nothing serves nothing until it is given a domain, and a
`""` in `scopes` is read as nothing and dropped by the next write. Adding a
domain to such a unit writes that domain alone; a unit filed in a domain is
read as before. The organisation's home has no *Served by* and names no
domain owner, and a capability the organisation itself defines is in no
domain, so any unit may answer for it without a finding — while a unit that
serves nothing and answers for something a domain defines is
`check.unitNotServing`, as any unit outside the domain is.

**Each end leads to the other.** A domain in a unit's *Serves* opens that
domain's home; a unit's name in a scope's *Served by* — on the home and in
the scope's settings — opens the unit where it is kept, on that scope's
organisation chart where it has one, as a link to a unit lands (§7).

**A scope may be served from the start.** The dialog that makes a domain or a
team offers, where the organisation has units, the unit that serves it — the
choices *+ Unit* offers on a scope nobody serves yet. The link is the unit's
`scopes`, written as the step of the scope that keeps the unit once the new
scope is there; refused, the scope stays and the person is told where to set
it.

**The sheet leads to the scopes too.** An area, a grouping or a capability a
unit answers for carries the unit's name always, not only behind *Show who is
responsible*, and the name is a way out: to the home of the scope the unit
serves, a choice of them where there are several, and the unit where it is
kept where it serves none. The toggle keeps what it shows beyond that — the
actors that are not units, and the functions nobody answers for.

## As built, 13 October 2026: the organisation is not a domain, and the links

- **One rule.** `model/serving.scopesServed` never answers `""`
  (`isServable`), and `scopesWith`/`scopesWithout` drop it from what they
  write. Everything that read the rule reads it there: `owners.domainOwnersOn`
  (it kept a copy), the People page's domains by rule (`units/held.ts`), the
  *Serves* picker's scopes (`units/choices.scopeChoices`), and *Served by*
  (`servedByOf` answers nothing at the root). The spans finding and the
  chart's `serves` leave a stray `""` out by hand, since `model/units.ts` is
  below the rule. The agent drops `""` from a unit's `scopes` and says so in
  the tool's text.
- **The check.** `projects/checks.servesDomainOn` is what
  `check.unitNotServing` and the sheet's mark ask: true for anything the
  organisation defines, otherwise `servesOn` over `coversDomain`.
- **The links.** A *Serves* chip is a button that goes to the domain's home
  (`onGoHome`, handed down as `units.openHome`); a name in *Served by* is a
  link that opens the scope that keeps the unit on the `element` page, which
  `unitLanding` turns into its chart with the unit chosen. In the settings
  dialog it closes the dialog first.
- **The new-scope dialog.** *Served by* offers `servingChoicesOf` for a scope
  not made yet, with `pickableBy` marking units kept where the person may
  only read. The pick is held in the dialog's state; *Create* makes the scope,
  says so, and then writes the unit's `scopes` through `writeIn`, so a
  refusal's notice is the one left standing.
- **The sheet's label.** `business` knows no tree, so the host's
  `SheetResponsible` says what an actor is as a unit — its name and the
  scopes it serves by name (`unit`) — and how to leave: `openScope` and
  `openUnit`, which `app/units/sheetResponsible.ts` builds from the ways out
  the workspace hands it (`SheetWaysOut`: the shell's `onGoHome`, and the
  element page in the scope that keeps the unit, `unitLanding` where that is
  the open one). The ways out are read when pressed, so a fresh pair per
  render keeps the cached answer and the sheet is not laid out again.
  `UnitLabel` (`business/ui/Responsible.tsx`) is its own button beside the
  card's, never inside it — beside an area's name and a grouping's heading in
  their row, and over a capability's coverage line — so the sheet's heights
  and its picture do not change, and it stops the press so the card is not
  picked.

## Amended, 17 October 2026 — a scope's type is the operating model's

*Accepted and built 17 October 2026: As built, below.* A scope says what it
is with one of five built-in words — organisation, domain, programme, team,
landscape scope — "a label in its `scope.json` for a screen to show, not a
type anything switches on" (ADR-0012 §1). The operating model gives the
organisation its own kinds of unit, and since the amendments of 11 and 13
October a unit serves scopes. The two vocabularies then stood side by side:
a scope called *Domain* in the app's words, served by a *Business unit* in
the organisation's. The owner, after testing the local build: the scope
types are still a plain list; with an operating model the types for scopes
should come from it, the old ones still allowed lower on the list, so one
can see that scopes are linked properly to types; and linking a scope to a
unit should set the type.

**A scope's type is a unit type where the organisation has one.** The scope's
header gains `unitTypeId`, a unit type's id. Wherever a scope's type is
chosen — its settings, today the one place — the operating model's unit
types are offered first, under their own heading, and the five built-in
kinds below them under theirs, still allowed; an organisation without an
operating model sees the kinds alone, as before. **One of the two is said,
never both**: a unit type picked clears the kind and a kind picked clears
the unit type (`projects/scopeType.ts`). A unit type needs no built-in kind
behind it, because nothing branches on either: what a scope *does* is read
off its shape — it draws, or it files scopes — exactly as `ScopeKind`
promised, and the one screen that read the word *landscape* reads the shape
first. A scope's badge, the word beside its name on its home, the counts
under the organisation's name and `scopes.list` say the unit type's name
where there is one.

**The type follows the unit.** When a unit is linked to a scope — *+ Unit*
under *Served by* on the home or in the settings, a new scope's *Served by*,
a unit's *Serves* on the chart, a new unit's domains, or the agent's
`element.add` and `element.update` — the scope takes that unit's type in the
same change, unless the type it has still agrees with a unit that serves it:
a scope served by a division and given a team under it stays a division.
Overwriting rather than asking, by this reading: the owner asked for the
type to follow the link, every path that links has no room for a question
(the chart's picker, the agent), and the link is the stronger statement —
somebody who linked the wrong unit undoes the link, and a scope whose type
should stand apart from its units says so in its settings, where the check
then tells them they disagree. Where the link and the header are the same
scope's steps they land in one apply, all or none; where the link is the
open scope's step on the chart, the header is the served scope's own step,
written under its rights once the link has landed. **Taking a unit off
leaves the type as it is**, and undoing a link is taking the unit off: the
type says what the scope is, and a unit no longer serving it does not make
it something else.

**The link is shown and checked.** *Served by* says, on the home and in the
settings, how the scope's type stands to the units that serve it: typed as
one of them is; typed while they are of other types, in the warning colour;
typed and served by nobody; typed by a unit type the model no longer holds;
or not typed from the model, with the serving types named so the type can be
set. The tree's badge warns the same way. Three findings in the
organisation's category: `check.scopeTypeDisagrees` (review) for a scope
typed by a unit type no serving unit is of, `check.scopeTypeUnserved` (note)
for one typed and served by nobody, `check.scopeTypeGone` (fix) for one
typed by a unit type the operating model does not hold. Each is about the
scope and opens its home.

**The format stays at 13**, which this release introduces: `unitTypeId` is
one more optional key in `scope.json`, read as a label and never required. A
12 folder reads as before and says no unit type; a build before this one
reads a 13 header with the key and carries it through a save
(`ScopeSnapshot.carried`).

## As built, 17 October 2026: a scope's type from the operating model

- **The header.** `ScopeDescription`, `ScopeSnapshot`, `ScopeSummary`,
  `ScopeNode`, `IndexedScope` and `ScopeModel` carry `unitTypeId`; the
  folder format writes and reads it, the kept stores list it, and
  `scope.describe` takes it as it takes `kind`, refusing a blank one. A
  patch key set to `null` clears as `undefined` does, because a patch that
  crossed a wire as JSON has no `undefined` in it. The index answers
  `scopeTypes()`, and `OrganisationAt` carries them to the checks.
- **The rule**, `projects/scopeType.ts`: `typeLinkOf` (the five words),
  `typeToFollow` (the unit's type unless the scope's own still agrees),
  `typeChoiceOf`/`typeChosen` (the picker's one value, `unit:<id>` or
  `kind:<kind>`, read back as a patch that sets one field and clears the
  other).
- **The picker.** `ScopeSettingsDialog`'s *What this is* is one select with
  two headings — the operating model's types, then the built-in kinds — the
  headings as options that cannot be picked, since a Select makes every
  child one; the kinds alone without an operating model. The dialog hands
  `type` back in `ScopeSettingsPatch`, and `settingsCommands` writes both
  fields through one `scope.describe`.
- **The link followed.** `useServedBy.write` lands the unit's `scopes` and
  the scope's header in one apply through `writeInEach` (`units/writeIn.ts`,
  over `changeScopes`) and the notice says *… is now a …*; the chart's
  *Serves* and a new unit's domains write the header after the link through
  `units/followType.ts`; the agent's handler asks the host
  (`SessionView.followScopeTypes`, filled on the desktop over `writeIn`) and
  answers `scopeTypes` with `set` per scope, and a hint where a host writes
  only the scope open.
- **Shown.** `ServedBy`'s type line (`served-by-type`, `data-link`), the
  tree's badge (`scope-type`, warning where the link is off or the type
  gone), the bar's word, the counts line (`{count} × {type}` before the
  kinds), and `scopes.list`'s `unitTypeId`, `unitType`, `servedBy` and
  `typeLink`.
- **Checked.** `projects/checks.scopeTypeFindings`, the three catalogue
  entries with the `openScope` action, `ABOUT_A_SCOPE` routing the Checks
  page to the scope's home.
- **Open here**: a host with no screen writes only the scope a call names,
  so the agent's `element.update` there names the type to set and does not
  set it; a `followScopeTypes` filling on the server, or a `scope.describe`
  tool, closes that. The new-scope dialog asks no type: a scope served from
  the start takes its unit's type, and one served by nobody is typed in its
  settings.

## Amended, 17 October 2026 — a unit moves to another place in the organisation

*Accepted and built 17 October 2026: As built, below.* §6 says a move
outside a plan is a correction, an edit of `parentId`, and Considered
Options 5 kept the dated parent off the unit for that reason. Nothing
offered the correction across the tree. A business sheet's *Sits under*
reaches the actors of its own scope; a unit's inspector had no parent at
all; the chart moved a unit only among its siblings; and the agent's
`element.update` looked the parent up in the scope open. A chart whose units
were filed in the wrong places — a row of units under one unit where they
belong under another, a unit beside the one it belongs in — could be put
right only by deleting each unit and making it again, which loses its id
and, with the id, everything keyed by it.

**A move keeps the unit.** Its assignments, its own reporting lines, the
scopes it serves and its comments are keyed by its id and kept where it is
kept, so moving it is one `element.update` of `parentId` in the scope that
keeps it, and nothing is linked again. A line said on a role or a type
lands, as §2 of ADR-0039 says, on the nearest unit above that holds its
target, so it may land elsewhere after a move: that is the organisation as
it now is, and it is said before the move lands. The units inside a unit
moved keep their own parent, so they come with it.

**The parent is any unit in the organisation**, kept in any scope, or none —
the top. Ids are unique across the organisation (§3), so it is found by its
id like any parent; the screens offer it by its path through the units
above it.

**Its type's place is said, not enforced.** The places where its type may
sit (`top`, `within`) are offered first; the others are offered below,
marked, and a move there is made and leaves `check.unitMisplaced` standing,
as a delete may leave the units inside it where their type may not sit
(*Amended, 12 October 2026*). Refusing it would make a reorganisation that
passes through a misfit impossible to write. *Owner's default, open to
overturning.*

**A loop is refused**: a unit under itself or a unit inside it, on the day
the move is asked or on any later day a plan's move reaches — what
`plan.move` already refuses for a move on a day.

**The units beside it move along when asked.** The dialog lists the units
under the same parent, unticked, so a row of units moves in one go; there is
no multi-select on the chart. *Owner's default, open to overturning.*

**What changes is said before it lands**: who manages each unit from above,
today, before and after, by nesting or by a line, from `managersOf` on the
organisation as it would be — the holders of the unit's own roles and of the
units inside it left out, since a move changes neither — and every plan's
move of the unit, with its day, since from that day the unit sits where the
plan says whatever its own parent.

**One change, undated.** An `element.update {parentId, order: undefined}` in
each scope that keeps a unit moved, as that scope's one step, all or none;
the open scope's through its session, so ⌘Z takes it back where it is the
only one written, and with a barrier where others were written too. Its
`order` among its new siblings starts afresh. A move on a day stays a
plan's. *Owner's default, open to overturning.*

**The agent** corrects a unit's place with `element.update` and `parentId`,
the parent found anywhere in the organisation, a loop looked for over the
whole of it, and a place its type may not sit in answered `misplaced: true`.
A unit kept in another scope is changed in that scope.

## As built, 17 October 2026: a unit moved

- **The arithmetic**, `model/unitMove.ts`, pure: `unitMove` answers a
  refusal — `notAUnit`, `unknownParent`, `parentNotAUnit`, `itself`, `loop`
  with its day, `notKept` — or the commands per scope, the units that move
  (one already there is left out), `fits` per unit, the managers before and
  after, and the plans' moves of the units (`planned`, `reached` where the
  day has come). `withUnitsMoved` lays the move over an organisation,
  `unitFits` asks a type of a parent, and `unitsBeside` lists the units
  under the same parent on the day.
- **The dialog**, `app/units/MoveUnitDialog.tsx` (a `FieldsDialog`): where
  the unit sits now; *Sits under*, a `GroupedPicker` that now holds the
  option picked, over `choices.parentChoices` — *At the top* and every unit
  there today, the fitting ones under *Where its type may sit* and the
  others under *Where its type may not sit*, each saying the units it sits
  in, the unit's own place and the units inside it shown and not offered;
  *Move these too*; the misfit, a plan's move, *Who manages it* now and
  after; *Move*.
- **The ways in**: *Move to…* on a unit's name row on the chart, quiet as
  its *+* (`chart.moveTo`), and beside *Move up* and *Move down* under the
  outline (`chart.outlineMoveTo`), landed as a move among siblings is
  (`ChartPage.reorder`) and gone to afterwards; *Sits under* in a unit's
  inspector (`unit.sitsUnder`), landed through the structure's lander a
  delete uses. Both through `useMoveUnit`, its barrier `unitMove.barrier`;
  the dialog is `chart.moveUnit`. Nothing is offered where the chart or the
  section is only read, or for a stand-in.
- **The agent**: `element.update`'s `parentId` on a unit this scope keeps
  is asked of `unitMove` over `agent/write/organisation.organisationKnown`
  (the tree's units and plans' moves with this scope's own as the session
  holds them — what `plan.move` reads too, through `unitsKnown`), clears
  the unit's `order` unless the call says one, and answers `misplaced` with
  a hint; a unit another scope keeps is refused with `agent.scopeNotOpen`
  naming that scope. A parent that is no unit — an actor that is only a
  group here — is read as before.
- **Open here**: a stand-in's `parentId` is where this scope draws it, and
  stays an edit of the stand-in. The business sheet's own *Sits under*
  still offers its scope's actors only. Refiling a unit to another scope
  (*Move…*, `projects/gestures.travelling`) keeps its `parentId` only where
  the scope it arrives in holds that parent, so a unit whose parent is kept
  elsewhere arrives at the top; left as it was, and *Move to…* puts it back.

## Amended, 17 October 2026 — the chart made easier to read

*Accepted and built 17 October 2026 (3.7.3): As built, below. The defaults
marked as such are the owner's to overturn.* The amendment of 11 October
folded a first open of more than thirty units below the second level and
left a smaller chart whole, let the outline fold on its own, and gave the
outline a fixed width. A chart of twenty units five levels deep therefore
opened as a page to scroll through; opening a unit in the outline left the
chart folded where the reader was looking; a deep outline ran out of width;
and a type named *Organisational unit* took a line of every box.

**A first open shows two levels**, whatever the chart's size: the chart's
top units are the first level and the units directly under them the second
(a default), so every unit on the second level with units under it is
folded, in the chart and in the outline. After that the person's own folds
are what is kept, for the session, as before; nothing of a fold is saved.

**The outline leads the chart, one way.** The two still keep their folds
apart. Opening goes from the outline to the chart: a unit unfolded or picked
in the outline is unfolded on the chart, with every unit above it, scrolled
to, ringed and picked. Folding in the outline folds the outline alone, and a
fold on the chart never folds the outline — so the outline stays a way about
that does not hide what the chart shows, and the chart is never folded by a
reader looking for a way about.

**The outline's width is the person's**, between 180 and 480 pixels, on a
seam that is a separator with its value and limits, dragged by the pointer
or moved by the arrow keys, Home putting it back. It is kept with the
editor's panel widths, per person (`EditorPreferences.outlineWidth`), handed
to the page through `PageView.outline`; a page drawn without one keeps its
own while it is up.

**A long word of a type's name is cut** on the chart's boxes and in its
outline: a word longer than seven letters keeps its first six and a full
stop, word by word, not the label as a whole (a default) — *Organisational
unit* is *Organi. unit*. The whole name is shown on hover and is what
assistive technology reads, so a box is named by its whole type.

## As built, 17 October 2026: the chart made easier to read

- **Two levels**: `model/orgChart.foldedOnFirstOpen` has no size rule any
  more (`FOLD_OVER` is gone); `useChartFolds` opens with it as before, and
  the page's note no longer counts units.
- **The outline leads**: `useChartFolds.expand` unfolds a unit and the units
  above it on the chart and the way to it in the outline, and lets the
  first open's note go; `ChartOutline` calls it, through the page, for a
  pick and for a caret that opens, and the page then goes to the unit as
  *Find* does.
- **The width**: `editor/panels.OUTLINE_LIMITS` and `outlineWidth`, which
  clamps a stored width; `EditorPreferences.outlineWidth`;
  `PageView.outline`, passed by `UnitViewPages`; the seam is
  `widgets/SeamResizer` beside the outline, hidden on a narrow window where
  the outline sits over the chart at the window's width.
- **The labels**: `app/units/chartWords.shortTypeName`, counting letters as
  a reader does (graphemes), and `TypeLabel`, which draws the cut name
  hidden from assistive technology, the whole name for it alone, and the
  whole name as the hover title; a name with nothing to cut is drawn as it
  is.
- **Tests** that pinned the old rule are flipped: the chart's own tests of a
  small chart of three levels open it as left unfolded
  (`app/testing/chartFolds.leftUnfolded`), and `ChartReading.test` reads the
  four changes.

## Open

* **People from a directory**: a picker over an identity provider's people,
  signals that someone has left, and a feed from a personnel system. Each
  needs permissions in the organisation's own directory. Not in this record.
* **A rename on a day**, for a unit or a role. A rename is an edit.
* **A manager renaming their own unit.** Outside the reading in §12.
* **Roles of a domain's own**, beside the organisation's.
* **An organisation's own model as a library** for another organisation.
* **Capacity beyond a share**: planning time and demand.
