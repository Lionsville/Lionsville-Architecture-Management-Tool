# ADR-0021 — Observations, and what lies behind them

* Status: accepted
* Date: 2026-09-20
* Deciders: Wouter Simons
* Extends: ADR-0012 §7 (a record is edited where it lives; what a scope
  above reads from the scopes below it)

## Context and Problem Statement

A landscape holds what is; a decision holds what was chosen; a plan holds
what will change. None of them holds what a team **saw**: the nightly batch
that runs into office hours, the customer who exists three times, the change
that shipped twice in a week. Those sightings are the raw material of an
assessment, and today they live in a spreadsheet beside the tool, where
nothing links them to the landscape, nothing counts how often the same thing
was seen, and the analysis of *why* is a diagram somebody draws once and
never keeps current.

Two more things a spreadsheet cannot do. Observations are made in a domain
and matter to the enterprise: the same duplicate-customer problem is seen at
the claims desk and at the policy desk, and the cause is above both of
them. And observations are seen more than once under different titles by
different people, so the register fills with near-duplicates that have to be
folded together without losing who saw what, when.

## Decision Drivers

* An observation is a record like a decision and a plan: numbered, one
  markdown file, in git, in the diff, in the Activity list, at the agent.
* The analysis is a graph — observations, causes, causes of causes — and
  the picture of it is the thing a team stands in front of.
* Sharing upward must be explicit. A domain says which of its observations
  are the enterprise's business; the enterprise does not go and pick them.
* Merging must keep the history: the fact that two observations were judged
  the same is itself something that happened on a day.
* A record is edited where it lives (ADR-0012 §7). Nothing here may make a
  scope write into another scope's folder.

## Considered Options

1. **Observations as documentation** — a template in the description of an
   element, with a header table to index. *Rejected*: an observation is
   about a landscape or a domain more often than about one element, and a
   graph of causes has no place in a description.
2. **Observations as a kind of decision record** — a status machine from
   observed to root cause. *Rejected*: a decision is one record with one
   status; an analysis is many records linked to each other, and the thing
   that changes state is the cause, not the observation.
3. **Two records and a graph on the model, one folder on disk.** *Chosen.*
4. **Store the merge on both records, and write into the scope below when a
   shared observation is absorbed above.** *Rejected*: it breaks the one rule
   every cross-scope feature keeps, and it is not needed — the scope below
   can read what happened to its observation off the tree.

## Decision Outcome

Option 3, with the merge kept where the rule allows it.

### 1. Two records on the model

`model.observations` and `model.causes` are two arrays on a scope's model,
absent when empty exactly as `decisions` is. An **observation** has a
number (`OB-0007`), a title, the day it was first seen, where, an impact
(`minor` · `major` · `critical`), a count of how often it was seen, an
optional `shared` flag, a markdown body and a **history**: dated events,
oldest first — `recorded`, `seen`, `shared`, `unshared`, `absorbed`,
`merged`. A **cause** has a number (`CA-0003`), a title, a state
(`assumed` · `verified`), a markdown body and `explains`: the links to what
it explains — observations of this scope, observations shared from a scope
below (the link carries that scope's path), and shallower causes of this
scope — each with a strength (`strong` · `normal` · `weak`).

The link lives on the cause because that is the direction analysis runs: a
cause is written to explain something; an observation knows nothing about
why. A **root cause** is derived, never stored: a cause that explains
something and that no cause explains. Finding what lies behind a root is one
link, and it stops being a root that moment.

### 2. One folder on disk

`observations/NNNN-<slug>.md` for each observation and
`observations/causes/NNNN-<slug>.md` for each cause, front matter for the
fields and the history, a heading with the label, markdown below — the
shape `decisions/` and `transitions/` have. `observations` is the seventh
reserved folder name, and the folder format turns to **7**: a build that
reads 6 and no more would open a 7 and write it back without the
observations, which is the loss the number exists to refuse.

### 3. Sharing goes up, and only when said

`shared` is the one bit a scope sets. The tree index (`scopeIndex.ts`)
answers `observationsBelow(path)`: every shared observation in a scope
strictly below, the way `initiativesBelow` answers the flagged plans. The
page of a scope shows them under *Shared from <scope>*, may link them to a
cause of its own, and may fold them into an observation of its own. They
are otherwise read-only there, with the same *Open <scope>* door a
decision from above has. Nothing flows down.

### 4. Merging is history, and only the survivor is written

Two observations judged to be the same thing become one by the second being
**absorbed** into the first: the survivor's count goes up by the absorbed
one's, the links to the absorbed one move over (a cause that had both keeps
the stronger link), and both records get a dated event — `absorbed` on the
survivor naming what it took in, `merged` on the absorbed one naming where
it went. The absorbed record stays in the list: it is where the original
wording and evidence are, and it is *read as* merged because the survivor
says so (`absorbedBy`). It is left out of the picture and of the register
unless asked for.

An observation shared from below is absorbed the same way, except that only
the survivor is written: its `absorbed` event carries the scope of the
observation it stands for now. The scope below is not touched; its page
reads off the tree (`absorbedFrom(path)`) that its observation went into
one above, and says so on the row.

### 5. The page and the picture

One page, *Observations*, beside *Decisions* on the bar and as a card on
every scope's home. Two tabs: the **register** — a table read off the
fields, this scope's own first, then the shared ones from below under their
scope, then the causes — with the record beside it; and the **analysis** — a
picture with observations on the left as circles (size: impact; tint: times
seen), causes in the lanes to the right as boxes (dashed while assumed,
solid once verified), root causes last with the heavier outline, and the
links between as lines (thick, ordinary or dotted for strong, normal or
weak). Laid out in lanes and rows by a pure function (`graph.ts`): the
lane is the cause's depth, the row keeps a node near the mean row of what
it explains. No force simulation, on purpose: the picture must land in the
same place every time the page opens.

The page hands both lists back whole; the workspace turns the difference
into one transaction, so ⌘Z puts back one record.

### 6. At the agent

Read: `observations.list` (with `fromBelow`), `observation.read`,
`causes.list`, `cause.read`. Write: `observation.record`,
`observation.update` (fields, and `shared`), `observation.seen`,
`observation.merge` (with `fromScope` for one shared from below),
`observation.remove`, `cause.add` (with `explains`), `cause.update`,
`cause.link`, `cause.unlink`, `cause.remove`. `app.open` takes
`observations` as a page.

## Consequences

* New: `model/observation.ts`, `projects/observationFile.ts`,
  `observations/` (rules, `graph.ts`, `observationScope.ts`, the page and
  its readers), six commands (`observation.*`, `cause.*`), the strings
  slice `observation.*` in four languages, the `ObservationIcon`.
* Changed: `HostExtras`, `ModelOrder`, the reducer, `diff.ts`,
  `restore.ts`, `activity.ts`, `folderFormat.ts` (write, read,
  `isFormatPath`, `SCOPE_FOLDERS`), `scopePath.ts` (reserved names),
  `scopeIndex.ts` (`observationsBelow`, `absorbedFrom`),
  `FileSystemScopeStore.models()` (reads the folder per scope, as it reads
  the plans), `SCOPE_FORMAT_VERSION` 6 → 7, the shipped example's headers.
* A record is edited where it lives, still: no scope writes into another.
* Open: the observations are not yet in ⌘K search, not yet a history
  subject (ADR-0008), and not yet an agent resource URI. A cause's
  verification carries no signers table; the body is where the evidence
  goes. The picture has no export of its own beyond the window.
