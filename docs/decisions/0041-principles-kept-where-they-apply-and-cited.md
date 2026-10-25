# ADR-0041 — Architecture principles, kept where they apply, and cited by what follows or departs from them

* Status: accepted, 25 October 2026; as built, 25 October 2026 (3.8.0):
  the principle, its groups and its page (§1–§6, §8, §12, §14); citing,
  suggestions and the checks (§7, §9, §10); the agent's first tools (§13, in
  part; the rest scheduled after 3.8.0)
* Date: 2026-10-25
* Deciders: Wouter Simons
* Extends: ADR-0012 §7 (a scope's records are read up the tree, *From
  <ancestor>*, and edited where they live), ADR-0031 §1 (a record named by
  its kind and its id), ADR-0037 (comments on any record, through one
  interface — citing follows its shape), ADR-0029 (every record says what it
  is to a search), ADR-0028 (a command says what it may carry), ADR-0035
  (what a merge takes with it), ADR-0038 §1 (what a move carries), ADR-0011
  (an agent can do what a person can)

## Context and Problem Statement

Architecture work is steered by principles: short statements an organisation
has agreed on — *reuse before buy before build*, *data is owned where it is
created*, *every integration is asynchronous unless a person waits* — that a
design is expected to follow and a decision is expected to weigh. Today they
live outside the tool, in a slide or a wiki page, and the tool can say
nothing about them:

* **A decision cannot say which principle it follows**, or that it departs
  from one and why. A reviewer reads the outcome and has to remember the
  principles to judge it.
* **A design cannot say what it was built to.** The element is there; the
  reason it is shaped so is not.
* **What happens in practice is not fed back.** An observation that a
  principle chafes — that people work around it, or that it was missing
  where it would have helped — is a remark in a description that nobody
  counts.
* **A principle is written once and never sharpened.** Without a record of
  who uses it, nobody knows whether a principle is read, whether it is
  followed, or which part of it is in dispute.

Principles are also not one list. An organisation has its own; a domain adds
some that hold for it alone; a theme that runs across the tree (security,
data, a regulation) has some that hold wherever the theme does (ADR-0042).

## Decision Drivers

* **Kept where they apply.** A principle is the scope's that agreed on it,
  and is read by every scope below, as a decision is (ADR-0012 §7).
* **One idea is one principle.** Its separate claims are its parts, numbered,
  so a citation can name the one it means.
* **Cited, never copied.** A decision, a design or an observation points at
  a principle; nobody pastes its text.
* **A departure is explicit**: a decision with its reason, and only from a
  principle that allows it.
* **Use is visible**: how often a principle is cited, departed from, held
  and chafed, so the principles that matter and the ones in dispute show.
* **Nothing vanishes silently.** A principle something cites is retired, not
  removed; a change to an agreed one says so, and older citations know they
  predate it.
* **One interface for citing**, as ADR-0037 is for comments: a kind takes
  it on by one line.
* An agent can do what a person can (ADR-0011): write principles from a
  source, suggest them, cite them.

## Considered Options

### Q1: What a principle is

1. **A document**, one page per scope, in markdown. Easy to write; nothing
   can point into it, count its use or say which part is meant.
2. **An element kind**, drawn on a board. A principle is not part of a
   landscape and has no place on one.
3. **A record of the scope**, with numbered parts and groups, read below as
   decisions are. *Chosen.*

### Q2: Where a citation is kept

1. **On the principle**, as a list of who cites it. Every citation would be
   an edit of the principle, in a scope the citing person may not write.
2. **On the citing record**, as a field. Every kind would carry its own
   field, codec and screen.
3. **A record of its own in the citing record's scope**, about that record by
   its key, as a comment is (ADR-0037 §1, §2). *Chosen.*

## Decision Outcome

Q1 option 3 and Q2 option 3.

### 1. A principle is a record

A principle is a record of any scope (`RecordKind` gains `principle`):

| Field | What it says |
|---|---|
| `id` | its own id, never derived and never reused |
| `number` | sequential within the scope, `PR-0001` on screen, never reused |
| `title` | a short name |
| `statement` | what it says, markdown |
| `rationale`, `implications` | why, and what follows from it; optional |
| `keywords` | words it is found by besides its own; optional |
| `aspects` | its claims, one or more (§2) |
| `groups` | the groups it sits in, by id (§3) |
| `regime` | `fixed` or `flexible` (§4) |
| `status` | `candidate`, `accepted` or `retired` (§4) |
| `question` | what a candidate asks |
| `sharpened` | `{ on, note }` per change to an accepted one (§4) |
| `relations` | `{ kind: tension \| refines, to: { scope, id } }` (§5) |
| `mergedInto` | the principle that absorbed it (§6) |

It is read by its own scope and **every scope below**, as a section *From
<scope>* per scope above, read-only there: a principle is edited where it
lives. It is also read by every scope a topic is relevant to (ADR-0042 §4).

### 2. Aspects

One idea is one principle, and its separate claims are its **aspects**:
`{ id, number, text, nature: design | behaviour, signal?, steering? }`. A
design aspect is about what is built; a behaviour aspect about how people
work. `signal` says what would show it holds, `steering` who or what keeps it
true. Numbers are per principle and never reused — a removed aspect's number
stays taken — and are written `PR-0001.2`. A principle has at least one.

### 3. Groups

A scope keeps an ordered list of **groups** (`{ id, name, description? }`),
its own, and a principle sits in one or more. A group is made in advance
(*Manage groups…*) or on the spot from the principle's picker (*New group
"…"*). Removing a group takes it off its principles and removes none of them.
The groups are part of the scope's record of principles, not a kind of their
own.

### 4. Regime, status, and sharpening

* **Regime** is `fixed` or `flexible`, on every principle, said in words on
  the page. A decision may depart only from a flexible one (§7).
* **Status** is `candidate → accepted → retired`. A candidate carries its
  `question`. Accepted is not locked: a principle is sharpened as it is
  used. A **change to an accepted principle's statement or aspects** asks
  for a note and records `{ on, note }` in `sharpened`, so a citation older
  than the sharpening says it predates it.
* A retired principle keeps its citations; new ones are refused (§7).

### 5. Relations

A principle may be in `tension` with another, or `refine` one, here or in a
scope above. A relation is said on the principle that makes it and shown on
both.

### 6. Merge

One principle absorbs others: their aspects (renumbered after its own, the
old numbers said in the note), their groups, their citations and their
comments come to the survivor, and each absorbed one is kept as history with
`mergedInto`, as a merged observation is (ADR-0035). Only principles of one
scope merge.

### 7. Citing

A **citation** is a record of the scope that keeps the citing record
(`RecordKind` gains `citation`):

| Field | What it says |
|---|---|
| `id` | its own id |
| `about` | the citing record, a `RecordKey` in this scope |
| `principle` | `{ scope, id }`: here, above, or in a topic relevant here |
| `aspect` | the aspect's number, where one is meant |
| `stance` | how the record stands to it (the table) |
| `reason` | why; required on `deviates` |
| `on` | the day it was cited |

Which kinds cite, and with which stances, is **one table**,
`model/citable.ts`, as `commentable.ts` is for comments:

| Kind | Stances |
|---|---|
| decision | supports · deviates |
| element (any kind) | supports |
| plan · solution | supports |
| observation | holds · chafes · missing |

Refusals, whoever sends the citation:
* a kind or a stance not in the table (`command.notCitable`);
* `deviates` on a fixed principle (`command.principleFixed`);
* `deviates` with no reason (`command.reasonMissing`);
* a retired or merged principle (`command.principleRetired`);
* a principle that does not read here — sideways or below
  (`command.principleNotHere`).

A scope keeps its citations in `_citations/<kind>-<id>.json`, one file per
citing record. A citation travels with its record as a comment does: deleted
with it in the same step and brought back by undo; carried by a move
(ADR-0038 §1) and a merge (ADR-0035); and readdressed when the cited
principle's scope moves.

### 8. Removal

A principle is **removed only while nothing cites it**; otherwise it is
retired. Removing one removes its comments with it.

### 9. Suggestions

`principles/suggest.ts`, pure: a record's title, body and subject are
matched against every principle that reads here — its title, statement,
aspects, keywords and group names — with the one folding rule `textSearch`
has, plus **what other records about the same subject cite**. Each
suggestion carries its `matched` words and its `why`. The same function
answers the reader's *May apply* and the agent's `principles.suggest`.
*Deviates…* on an element opens a new decision about it with the principle
filled in.

### 10. Checks

* `check.principleUnused` (note): accepted, and never cited or tested.
* `check.principleChafes` (review): chafes in three or more observations.
* `check.citationGone` (fix): a citation of a principle that no longer reads
  here.

### 11. Commands

Each a step with its inverse, its write key and its descriptor (ADR-0028):
`principle.add`, `principle.update` (with `note` where it sharpens),
`principle.transition`, `principle.relate`, `principle.unrelate`,
`principle.merge`, `principle.remove`; `aspect.add`, `aspect.update`,
`aspect.remove`; `principleGroup.add`, `principleGroup.update`,
`principleGroup.remove`, `principleGroup.order`; `citation.add`,
`citation.update`, `citation.remove`.

### 12. On the screen

* **The principles page** of a scope: one quiet line per principle, grouped
  in the scope's order, the regime in words, a section per scope above and
  per relevant topic; a column beside it with the reader.
* **The reader**: the statement, the aspects as a plain numbered list, use
  (cited, departed from, tested: holds, chafes, missing), relations and,
  folded, the rest; comments and changes as on any record.
* **A *Principles* section on every citing reader** — decision, observation,
  solution, plan, element — with its citations, *Cite…* and *May apply*.
* **A card with a count** on every home that keeps or reads principles.
* Searchable by number, aspect number, words and keywords (ADR-0029);
  deep-linkable; commentable (ADR-0037).

### 13. The agent

`principles.list`, `principle.read`, `principles.suggest`;
`principle.propose`, `principle.update`, `principle.transition`,
`principle.relate`, `principle.unrelate`, `principle.merge`,
`principle.remove`; `aspect.add`, `aspect.update`, `aspect.remove`;
`principleGroups.set` (and an unknown group name in `principle.propose` makes
the group); `principle.cite`, `principle.uncite`, and `principles` on
`decision.propose` and `decision.update`, `observation.record` and
`observation.update`. The method sent on connect gains a paragraph: suggest
and cite before proposing a decision, recording an observation or changing a
design; a departure is a decision with its reason, and only from a flexible
principle; written from a source, one idea is one principle, its claims are
its aspects, and what says the same thing twice is merged.

### 14. The scope format

`_principles/NNNN-<slug>.md` (front matter and the statement, the aspects as
a list under their own heading) and `_principles/groups.json`;
`_citations/<kind>-<id>.json`. **The scope format turns to 15**, the one turn
of this release with ADR-0038 (amended), ADR-0042 and ADR-0043. A scope
written before has no principles and no citations.

## Consequences

* Good: a decision says which principles it follows and where it departs, and
  a reviewer reads it beside the principle.
* Good: use is counted, so a principle nobody cites and one that chafes show
  without a survey.
* Good: citing reuses the comment's shape — a record about a record, kept in
  the citing scope, travelling with it — so nothing new decides what a move
  or a merge carries.
* Bad: a principle above is read but not written below. A domain that wants
  to change an organisation's principle asks the organisation, which is the
  point, and costs a step.
* Bad: the suggestion is word matching and what neighbours cite, not
  understanding; it says why it suggests, so a wrong one is plain.
* Neutral: a principle's text is not versioned beyond `sharpened`; *History…*
  on the principle shows every step.

## As built, 25 October 2026: the principle, its groups and its page

**The model** (`model/principle.ts`): the fields of §1, and one more,
`lastAspect` — the highest aspect number ever given, so a removed aspect's
number is never given again, which a list of the aspects alone cannot say.
Two rules are the reducer's whoever sends the step (`commands/principleRecords.ts`):
a principle keeps at least one aspect, numbered once each and never past
`lastAspect` (`command.aspectsEmpty`, `command.aspectNumber`), and a change
that sharpens an accepted principle carries one more note in `sharpened`
than it had (`command.sharpenNote`); an undo that takes the note back takes
the change with it and is let through.

**Fewer commands than §11 names.** A principle is `principle.add`,
`principle.update` and `principle.remove`; a transition, a relation, an
aspect added or changed and a merge are each a patch of the principle, and a
merge is a transaction of the survivor's patch and each absorbed one's
`mergedInto`. The groups are part of the scope's own record (§3), so they are
set whole by `project.settings` with `principleGroups` (refused with
`command.badGroups` for a nameless group or an id said twice). A group made on
the spot lands with its principle as one step; a group removed is taken off its
principles in the same step. The agent's tools keep the names of §13 and land
these commands.

**On disk** the statement is the body, as §14 says, and everything else —
the aspects with their numbers, rationale and implications included — is
front matter, rows where there are several, so a heading in a statement is
never taken for one of its sections and a number is kept exactly.

**Read up the tree off the index.** Every store's index entry carries the
scope's principles and groups (`ScopeModel.model.principles`, the
`OrganisationIndex` contract), and `ScopeIndex.principlesAt` answers them, so
the page of a scope below and the *Principles* card on every home read the
principles above without a load.

**The page** is a page of the scope, opened on it as the decisions page is
(`InitialPage { page: 'principles', id? }`, `#/<scope>/-/principles/<id>`), from
the card on its home, a search hit or `app.open`. Its own principles are
written there, each change a step of the open scope's session; the
principles from above are read there and written where they live. Removal is
not yet refused for citations, which arrive with §7.

## As built, 25 October 2026: citing, suggestions and the checks

**The table** is `model/citable.ts`, as §7 says, with a plan as the model's
`transition`; each line names the command that deletes a record of the kind,
and `commands/table.ts` wraps it so a record removed takes its citations in
the same step and undo puts them back. A citation put back so — by an undo
— is not asked again whether it may be (`put`), as a comment put back is not.

**Who refuses what.** The reducer refuses what one scope can answer: a kind
or a stance not in the table (`command.notCitable`), a record the scope does
not hold (`command.unknownRecord`) and a departure with no reason
(`command.reasonMissing`). What the principle says — fixed, retired or
absorbed, kept where it does not read — is asked where the principle is read,
before the step: by the page (`citationRefusal`) and by the agent's tools.
A principle may be kept in another scope than the citing record's, and no
one scope's step can read it. Removing a principle any scope cites is
refused the same way, off the index's citations of the whole tree.

**Carried.** A merge and a move of an observation carry its citations as its
thread (`carryCitations`): to the survivor, once each where the survivor
already says the same, and to the scope it now lives in. A move of a scope
carries every citation's and every relation's principle scope that names the
subtree (`readdressPrinciples`), in the same writes as the other addresses a
move carries. A scope's restore puts its principles, groups and citations
back with the rest.

**On the screens**, the section is mounted on the decision's, the
observation's, the solution's and the plan's reader and on an element's
page; written only where the scope may be. *May apply* is
`principles/suggest.ts` with what decisions about the same element cite.
*Deviates…* on an element proposes a new decision about it, its departure
cited with the reason, as one step, and opens it. The three checks are
`projects/principleFindings.ts`, in a category of their own, opened on the
principles page or on the record that cites.

## As built, 25 October 2026: the agent's first tools (§13, in part)

An agent reads the principles with `principles.list` — at a scope, those in
force there, each with where it is kept and how it holds (kept there, from
above, or through a topic), or every scope's own — and writes with three
tools: `principle.add` (a candidate or an accepted principle, its aspects
numbered, its groups by name), `principle.update` (its title, statement,
regime, status and rationale), and `citation.add` (a record of the open scope
follows, deviates from or supports a principle, or a part of it, with its
reason). The method sent on connect says to cite rather than restate.

The rest of §13 — `principle.read` and `principles.suggest`, relating,
merging and removing principles, the aspects' own tools, the groups set
whole, `principle.uncite`, and `principles` on the decision and observation
tools — is scheduled after 3.8.0 (the roadmap, *Open*); until then those are
the principles page's.
