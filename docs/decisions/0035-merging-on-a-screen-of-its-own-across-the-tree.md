# ADR-0035 — Merging on a screen of its own, across the tree

* Status: accepted, 8 October 2026; as built, 8 October 2026: the rules, the one
  apply and the screen (§1–§5); the agent's tools (§6) not yet built
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

## As built, 8 October 2026: the rules and the one apply

The first part of the build: what a merge does, and how it lands. The
screen (§1, §2) is the next section; the agent's tools (§6) are still to
come.

**A cause has a history** (§4). `Cause.history` holds `absorbed` and
`merged` events — the date, the other cause's id, and its scope where it is
not this one. It is written in a cause file's front matter only where
something happened to the cause, so a cause nothing happened to is written
as before, and a content kept without it reads as before; no format moved.
`isCauseMerged` reads a cause as merged where a survivor of its scope says
it absorbed it, or where its own history says it was merged — and
`isMerged` now reads an observation's own `merged` event the same way,
because a merge across the tree writes that event where the record lives
and the survivor is then in another scope. A merged cause is left out of
the picture and its counts (what it still explains analyses nothing), the
open ends, the register unless *Show merged*, the link pickers, the
findings, the organisation's counts and `rootCauses` — what a solution may
address — and `linkRefusal` answers `merged` for it, either way round. A
move of a scope carries the scope a cause's history names, as it carries a
link's.

**The merge is planned by one pure rule**, `observations/merge.ts`
(`planMerge`), over the analyses of the scopes it reads
(`scopesForMerge`: the records' scopes, every scope above them, and the
scopes below that an absorbed cause explains a record of). It answers the
rows of §3 — every link that names an absorbed record or lives on one, with
where it would land, whether it may move and why not, whether both records
had it and the strength offered — and what each scope's lists become, or a
refusal. A row that cannot move says so in the link form's words
(`LinkRefusal`: `self`, `loop`, `root`, `upward`, `sideways`,
`observationBelow`, `merged`, `unknown`) and in three more:
`observationElsewhere` (a cause explains observations of its own scope
only), `solutionElsewhere` (a solution addresses causes of its own scope)
and `notRoot` (a solution addresses a root cause, and the survivor will not
be one). The merge as a whole is refused as `nothing`, `missing`, `merged`,
`archived`, `survivorAbsorbed`, `notADay`, `unverified` (made verified with
a body that does not say why), or with the two root steps' keys where it
changes whether the survivor is a root. Inside one scope, with nothing
chosen, it writes exactly what `mergeObservations` writes. *Add the others'
descriptions* is `withMergedDescriptions`.

**The open scope's part goes through its session** (§5, decided in the
build). A merge that writes other scopes writes them in one
`ScopeRepository.apply`, each scope's part as its step and each expecting
the revision read (`projects/scopeAccess.changeScopes`), retried over a
scope that moved, all or nothing. The open scope is not in that apply: it
is read from its session, which may hold work not written yet, and its part
is dispatched there once the others have landed — asked of the reducer
before anything is applied, so a part the session would refuse refuses the
whole. A step written to the open scope through the repository would be
*changed elsewhere* to the session on its next write in every source, and
another author's step where the source carries steps; going through the
session is the one way that works the same for every source. So that step
is on the page's stack with a barrier (`observation.acrossBarrier`, as a
gesture across scopes has one, ADR-0012 §10): ⌘Z stops there and says why.
Where the source writes rather than carries steps, it is written at once,
and the answer says when that failed and the step waits for the next write.
The one gap left is a session that refuses its own part after the others
landed, which the reducer was asked about first, and which is answered as
`partial`. A merge inside the open scope alone is an ordinary step, undone
by ⌘Z. The page is handed this as `onChangeAcross`
(`app/useChangeAcross.ts`), which asks `writable` of every scope the change
writes — and of no scope it only reads — before it writes any.

## As built, 8 October 2026: the screen

**Merge…** on an observation or a cause — on its reader, on a right-click,
and on a record of a scope below — opens the merge screen
(`observations/ui/MergePage.tsx`) over the observations page, with that
record picked and surviving. The small dialog is gone. Its wiring is one
hook, `useMerge`, and what it reads off the tree is pure
(`observations/mergeScreen.ts`).

**What it searches across scopes is what the tree already read.** The
index each session builds holds every readable scope's analysis — its
observations, causes, solutions and experiments are read with its model in
every source that ships (`ScopeModel`), so nothing is loaded on demand.
`ScopeIndex.analyses()` hands all of it out, and the page is given it as
`tree`; the open scope is the page's own, as it stands. A search offers the
records that are live — observations neither merged nor archived, causes
not merged — and leaves out anything a survivor anywhere says it absorbed.
It matches every word typed against the label, the title and, for an
observation, where it was seen; scopes nearest first by steps through the
tree, a tie in path order, and newest first within a scope; fifty are
listed, and how many more there are is said.

**Whether a scope may be changed** is the source's `writable`, handed to
the page. A record of a scope that may only be read is listed with that
said and cannot be picked, and Merge says the same of any scope the plan
would write. The storage still refuses it where it must.

**Everything shown is planned.** `planMerge` is asked on every change, over
the scopes `scopesForMerge` names, read off the tree: the value rows (each
picked record's distinct value as a button, or one typed), the sightings
summed, the link rows with the link form's words for a row that cannot
move, a strength where both had the link, and the reason Merge cannot be
pressed. *Add the others' descriptions* is offered once per set picked.
Merge says what it makes — *Merge 2 observations into OB-0002*, causes by
their `CA-` or `RC-` label.

**Where it lands is what the plan writes.** A plan that writes only the open
scope is the page's own step, undone by ⌘Z. One that writes any other scope
— a record of it merged, or a link held there moved — goes to
`onChangeAcross`, which reads every scope fresh and plans again over what
it read, so the merge that lands is planned over what is there; a plan
that no longer holds is refused and nothing is written. A note after it
names the scopes changed, or why nothing was merged, and the screen stays
up where nothing was. A merge from below into this scope therefore now
writes both scopes, where the dialog wrote only this one (ADR-0021 §4); an
absorption written that way before reads as it did.

**A merged record says where it went**, wherever that is: a merged cause is
listed under *Show merged*, dimmed, and its reader says *Merged into
CA-0003* — with the scope where it is another — offers nothing to change,
and goes there; an observation merged into another scope reads its own
`merged` event the same way, and one of a scope below no longer stands in
this scope's register once it was merged anywhere.

The screen's main controls carry `merge.search`, `merge.across`,
`merge.survivor` (on each record picked), `merge.what`, `merge.values`,
`merge.links` and `merge.confirm`.

## As built, 8 October 2026: the agent's tools

§6, built over the plan above (`agent/merge.ts`, `agent/write/merge.ts`).

**Three tools.** `observation.merge` takes `into` (the survivor, by id or
label, in the scope the call is for or `intoScope`), `absorb` (`[{ id,
scope? }]`, each scope defaulting to the survivor's), `values` (`title`,
`where`, `by`, `impact`, `date`, `body`; a field left out stays as the
survivor has it, and title, place and observer are never blanked) and
`links` (`[{ key, move, strength }]`, keyed as `planMerge`'s rows are).
`cause.merge` is new, with the same shape and a cause's values (`title`,
`state`, `root`, `body`). `id` and `fromScope` are the old way to say an
observation merge and are accepted for one beta, as the schema says: `id`
is one record to absorb, and `id` with `fromScope` still folds in an
observation of a scope below by writing only this scope's survivor, as it
did before this record.

**The preview is a read, `merge.plan`** (decided in the build), rather than
a `dryRun` flag on the two writes. It takes the same arguments and a `kind`,
and answers every row — its key, the record it lives on and the one it
names, where it would land, whether it moves and, where it may not, the
refusal in the link form's words with a sentence — the scopes the merge
would write, and the refusal the merge would meet. A read answers while
nothing may be changed, for a scope that is not open and for a person who
may only read; a write with a flag would be refused in all three, and would
count as driving the app.

**Refusals have keys.** A merge refused as a whole answers `merge.nothing`,
`merge.merged`, `merge.archived`, `merge.survivorAbsorbed`,
`merge.notADay` or `merge.unverified`, a record that is not there
`agent.unknownId`, and the two root steps' keys pass through. A row of
`links` asked to move where the tree forbids it is `merge.linkForbidden`,
with the row's reason (`MERGE_LINK_SENTENCE`, one sentence per
`MergeLinkRefusal`); a key no row has is `agent.badArguments`.

**What the agent reads without waiting**: the scope the call is for, from
its session, and the others as the tree last read them. The organisation is
below nothing, so where it is not the scope open it is known only by the
causes it holds that explain a record of the merge — enough to say what a
merge does with them, never to write it.

**Where it lands.** A merge whose writes are all on the call's scope is one
transaction at the session, marked the agent's, which `undo` takes back,
and may be a step of a `batch`. One that writes another scope lands only
through a host that writes several scopes as one: `SessionView.changeAcross`,
a seam declared in `agent/merge.ts` in the shape of the page's
`onChangeAcross`, which reads every scope the merge reads, has the plan made
again over what it read, and writes each scope's part as that scope's step,
all or none. Where a host does not fill it — and inside a batch, which is
one transaction at one session — such a merge is refused
`agent.scopeNotOpen`, naming the scopes; `links` with `move: false` keeps a
row that reaches another scope where it is. No host fills the seam yet: the
desktop hands its agent no `changeAcross`, and a hosted environment's
server would compose one from its own several-scope write.

`causes.list` leaves a merged cause out unless `includeMerged`, and says
where a merged cause or observation went (`mergedInto`, and
`mergedIntoScope` where the survivor lives in another scope); `cause.read`
answers the cause's history. The method an agent is handed on connect says
that observations and causes are merged, that `merge.plan` says what a
merge would do, and that a merge may take records of any scope.
