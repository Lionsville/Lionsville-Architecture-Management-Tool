# ADR-0035 — Merging on a screen of its own, across the tree

* Status: accepted, 8 October 2026; not yet built
* Date: 2026-10-08
* Deciders: Wouter Simons
* Supersedes: ADR-0021 §4 in part (*only the survivor is written*: a merge
  now writes every scope it touches, in one step) and ADR-0032 §5 in part
  (merging is no longer only from a scope below)
* Extends: ADR-0021 §4 (merging is history, not deletion), ADR-0032 §4 (what
  a cause may explain), ADR-0031 §1 (one apply over several scopes, all or
  nothing), ADR-0011 (what a person can do, an agent can)

## Context and Problem Statement

Merging two observations is a select in a small dialog. It offers the live
observations of the scope that is open, and an observation of a scope below
can be folded into one of them from its own reader. That is all:

* **Only this scope's observations are offered.** Somebody working on the
  organisation who finds that an observation of a team below says the same
  thing as one of the organisation's can merge only from below into here,
  never the other way, and never between two scopes beside each other.
* **Nothing can be searched.** A register of a few hundred observations is a
  select of a few hundred titles.
* **Nothing can be adjusted.** The survivor keeps its own title, place,
  observer, impact, day and description. The better title, the earlier day
  and the absorbed record's evidence stay behind on a record nobody reads.
* **One at a time.** Five sightings of the same thing written down by five
  people are four merges, each its own dialog.
* **Causes cannot be merged at all.** Two people analysing the same chain
  write the same cause twice, and the only way back to one is to relink
  everything by hand and delete the other, which loses that it was there.

ADR-0021 §4 rejected writing into the scope below when it was absorbed
above, because a record is edited where it lives and the scope below could
read the absorption off the tree. Both still hold. What changed is that the
storage behind the app can now apply steps to several scopes as one
(ADR-0031 §1, `ScopeRepository.apply`): every scope's records can be edited
where they live, in one step, all or nothing. A merge across the tree can
keep the rule instead of working around it.

## Decision Drivers

* A merge is history, never deletion (ADR-0021 §4). That holds for causes as
  much as for observations.
* A record is edited where it lives. A merge that touches three scopes is a
  step on each of the three, and the person who makes it may change all
  three or the merge is not made.
* All or nothing. Half a merge — the survivor counting sightings that are
  still standing on their own somewhere else — is worse than none.
* A link the tree forbids is never made by a merge. What a cause may explain
  is ADR-0032 §4's rule, and a merge asks the same rule as a link does.
* The screen says what will happen before it happens: which records, which
  values, which links move and which cannot.
* An agent can do what a person can (ADR-0011).

## Considered Options

1. **A bigger dialog.** Search and multi-select in the existing dialog. It
   leaves no room for choosing values, combining descriptions or showing the
   links, which are most of what was asked.
2. **A merge screen, this scope only.** Everything asked, inside one scope.
   Leaves the organisation unable to merge what its scopes saw twice.
3. **A merge screen, across the tree, behind a choice, one step over every
   scope it writes.** *Chosen.*

## Decision Outcome

Option 3.

### 1. A screen of its own

**Merge…** on an observation or a cause opens the merge screen, full
window, over the observations page, with that record in the set. The screen
has three parts, top to bottom:

* **What to merge.** A search over the records of the same kind — live
  observations, or causes that are not merged — with the set picked so far
  above it. Any number may be picked. One of the set is the **survivor**,
  the one that keeps standing; the record the screen was opened from is the
  survivor until another is chosen.
* **What the survivor says.** One row per value the survivor has, with the
  value of every record in the set beside it to pick from, or a value of its
  own typed in. For an observation: the title, where, observed by, the
  impact, and the day first seen — which starts at the earliest of the set,
  since they are one thing and it was first seen then. For a cause: the
  title, assumed or verified, and whether it is a root cause. The sightings
  are not a choice: the survivor's count is the sum.
* **What moves with it.** Every link that names a record being absorbed,
  one row each, ticked when it may move (§3).

The description is the survivor's, in a text field that can be edited
before the merge. **Add the others' descriptions** appends each absorbed
record's description under a heading of its own — *Merged from OB-0007*,
with its scope where that is not the survivor's — and they can be edited
there too. The absorbed records keep their own descriptions either way.

**Merge** says what it will make (*Merge 3 observations into OB-0002*) and
is one step. The screen closes on the survivor, selected.

### 2. Across scopes is a choice

By default the search offers this scope's records. **Across scopes** adds
every scope in the tree the person can read, nearest first, each hit naming
its scope. Picking a record of another scope adds that scope to the ones
the merge writes.

The merge is offered only when the person may change **every** scope it
writes: the survivor's and each absorbed record's. A record of a scope the
person can read and not change is listed and cannot be picked; the row says
why. Whether a scope may be changed is the source's to say
(`ProviderParts.readOnlyAt`, the app's `writable`), and the storage refuses
the step anyway where it may not (`shell.scopeReadOnly`), so the screen's
check is a courtesy and never the guard.

Any scope in the tree may be the survivor's or an absorbed record's: above,
below or beside. What may not cross is a link the tree forbids (§3).

### 3. What moves, and what cannot

A merge relinks with the rule a link is made by (`linkRefusal`, ADR-0032
§4) and never around it:

* **Observations.** A cause that explains an absorbed observation of the
  survivor's own scope now explains the survivor; a cause that had both
  keeps the stronger link (ADR-0021 §4). A cause explains observations of
  its own scope only, so a link from a cause of another scope cannot move:
  the row says so, and the link stays on the absorbed record as history.
* **Causes.** Three kinds of link name a cause, and each moves where the
  survivor may hold it:
  * what the absorbed cause **explains** — the survivor may explain a record
    of its own scope, or a cause strictly below it;
  * the causes that **explain** the absorbed one — a cause may explain the
    survivor where the survivor is in its scope or strictly below it, and
    never where the survivor is a root cause;
  * the solutions that **address** the absorbed one — a solution addresses
    causes of its own scope, and only a root cause.

  A link that would loop, point up, point sideways or name a cause that
  stops being a root is not moved; its row says which, in the words the
  link form uses. Every row that may move can be unticked, and where both
  records had a link to the same record the strength can be chosen (the
  stronger is offered).

A merge that would leave the survivor a root cause with something
explaining it, or a cause with a solution addressing it, is refused with
the keys the two root steps already have (ADR-0032 §3).

### 4. A merged cause is history

A cause gains a history, as an observation has one, and two kinds of event
for now: `absorbed` on the survivor, naming what it took in (and its scope
where that is not the survivor's), and `merged` on the absorbed cause,
naming where it went (and that scope). A merged cause stays in its list,
keeps its number, which is never reused, and is read as merged: left out of
the picture, the register, the link pickers, the root causes a solution may
address and the merge screen's search, and shown with **Show merged**, as a
merged observation is.

### 5. One step over every scope it writes

A merge inside one scope is a transaction on that scope's session, as it is
today, and ⌘Z takes it back.

A merge that writes another scope is one `apply` over every scope it
writes, each scope's changes as that scope's step, expecting the revision
the screen read: all are kept, or none is and the screen says nothing was
merged. The absorbed observation of another scope gets its `merged` event
written where it lives, with the survivor's scope on it, so it no longer
needs reading off the tree. An absorption written by an earlier build, with
only the survivor written, stays readable as it is (`absorbedFrom`).

A merge across scopes is not on this page's undo stack, as a change below
is not today (ADR-0032 §2): a note after it says which scopes it changed,
and taking it back is changing it back.

### 6. The agent

`observation.merge` takes several records to absorb, each with its scope
where it is not the survivor's, the values the survivor keeps, and its
description; what it leaves out stays as the survivor has it. `cause.merge`
is new, with the same shape. Both relink by §3, refuse a link the tree
forbids with the link tools' keys, and land as one step on every scope they
write. Where the host can write only the scope that is open, a merge naming
another scope is refused with `agent.scopeNotOpen`, as every other write to
another scope is.

The merge screen is a screen over the observations page, as the form that
records an observation is, and not a destination of its own: the agent
merges with the tools and reads the result off the page.

### Consequences

* Good: the same thing seen in two scopes becomes one, wherever it was
  written down, with the best of both kept.
* Good: causes written down twice become one without losing that they were
  two.
* Good: every record is still edited where it lives, and the step that does
  it is everybody's to read in the scope's history.
* Bad: a merge across scopes cannot be taken back with ⌘Z.
* Bad: a cause's content gains a field. A build before this one reads a
  merged cause as a cause standing on its own.
* Neutral: links the tree forbids stay on the absorbed record, which the
  screen says before the merge rather than after.
