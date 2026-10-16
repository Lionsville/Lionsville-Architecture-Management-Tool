# ADR-0038 — An observation moves to another scope, and a bright spot is analysed as a problem is

* Status: accepted, 16 October 2026; not yet built (3.7.0)
* Date: 2026-10-16
* Deciders: Wouter Simons
* Extends: ADR-0021 §4 (a record that leaves the analysis stays as history,
  and its number is never reused), ADR-0032 §1 and §4 (every scope's
  observations are its own; a cause explains observations of its own scope
  only), ADR-0035 §1, §3 and §5 (the merge screen, what may move with a
  merge, and one write over every scope it touches, all or none), ADR-0026
  (a solution, its gates, and whether it held), ADR-0037 (a comment travels
  with its record)

## Context and Problem Statement

Two things an analysis cannot say today.

**An observation cannot change scope.** It is recorded where the person
recording it stood, and it stays there. Three ordinary situations make that
wrong:

* the scope it belongs to did not exist yet when it was written down, and was
  made later;
* the tree was reorganised, and what the scope covered is now covered
  elsewhere;
* it turns out, on analysis, to be about another part of the organisation
  than the one it was recorded in.

The only way across is to record it again in the other scope and archive or
delete the first, which loses its number's history, its sightings, the
merges it absorbed and, since ADR-0037, its comments, and leaves every link
and deep link to it pointing at something that says nothing about where it
went.

**Only problems can be analysed.** Observations are written as things that
go wrong, and the method — why, and why again, to a root cause, and a
solution with gates and an experiment — is applied to them alone. But what
works is as worth understanding: a team that never misses a release, a
process nobody complains about. Asking why it works finds causes that can
be spread, and spreading them is a solution with the same questions to
answer. Today such a thing can only be written as a problem, which says the
opposite of what was seen.

## Decision Drivers

* **A record is edited where it lives** (ADR-0012 §7, ADR-0035), and a
  change over two scopes is written in both, all or none.
* **Nothing is renumbered and nothing disappears.** A number is never reused
  (ADR-0021); a link and a deep link to the old place still lead somewhere
  that says where the record went.
* **A link the tree forbids is never made**, by a move any more than by a
  merge (ADR-0032 §4, ADR-0035 §3), and what cannot come along is said
  before anything is written.
* **The same method for what works.** A bright spot is an observation, its
  causes are causes and spreading it is a solution, with the same gates.
* **The two are never confused.** A problem and a bright spot are not the
  same thing seen twice, and a bright spot seen again is not a solution
  failing.
* An agent can do what a person can (ADR-0011).

## Considered Options

### Q1: How an observation moves

1. **Copy and archive.** A new record in the target, the old one archived.
   Simple, and it is what people do today by hand: the history, the
   sightings and the comments stay behind, and the old record says nothing
   about the new.
2. **Relabel in place.** Change which scope the record says it is in. Breaks
   the rule that a record is kept by the scope it lives in, and every
   number, link and history path with it.
3. **The record moves, keeping its id, with the target's next number; the
   source keeps a tombstone that says where it went; both written as one
   change over the two scopes.** *Chosen.*

### Q2: How what works is recorded

1. **A record of its own kind, beside observations.** A second register,
   form, picture and set of tools, and a cause shared between the two could
   not be.
2. **A tag in the title or the body.** Nothing could filter on it, and the
   rules that must tell the two apart could not.
3. **A flag on the observation, `bright`.** *Chosen.*

## Decision Outcome

Q1 option 3 and Q2 option 3.

### 1. An observation moves

An observation moves from the scope that keeps it to any other scope in the
tree — above, below or beside — that the person may write.

* **In the target** it is the same record under the **same id**, with the
  **target's next number**: `OB-0007` of one scope may become `OB-0012` of
  another. Its title, place, observer, impact, day, body, sightings and
  history come with it, and its history gains a **`movedIn`** event naming
  the scope it came from and the number it had there.
* **In the source** it stays as a **tombstone**: the record under its own
  number, with a **`moved`** event naming the target scope. It is read as a
  merged record is (ADR-0035 §4): left out of the picture, the register, the
  counts, the link pickers and the merge screen's search, and shown under
  *Show merged* with *Moved to OB-0012 in <scope>*, which goes there. A link,
  a deep link or a merge event that names it still resolves, and follows the
  `moved` event to where it is now. Nothing that names it is rewritten.
* **Its comments go with it** (ADR-0037 §6), in the same change.
* **An observation it absorbed** keeps its `merged` event naming the source;
  reading follows the tombstone.
* **Moving it back** to a scope that holds its tombstone brings the
  tombstone back to life, under the number it had there, with a `movedIn`
  event, and the links §2 cut when it left, which still name it, explain it
  again. The scope it leaves keeps a tombstone of its own. One id is never
  two live records, and no scope holds two records of one id.

**Refused**: a move to the scope it is in (`move.sameScope`), of a record
merged or moved already (`move.merged`, `move.moved`), of an archived record
(`move.archived`: restore it first, as a merge says), to a scope that is not
there (`move.unknownScope`), and of a record the source no longer holds.

### 2. What cannot come along

A cause explains observations of its own scope only (ADR-0032 §4), so no
link that explains the observation can follow it to another scope. Those
links are **cut**: they stay on their causes, naming the tombstone, as
history, and analyse nothing from then on — as a link to a merged record
does. A cause whose every link was cut so becomes one that explains nothing
here; it is not removed. The same holds for a link from a cause above that
ADR-0021 allowed and ADR-0032 §9 reports.

What a solution addressed through those causes is no longer reached through
them: its *seen since implemented* stops counting the moved observation's
sightings in the source.

**Bringing causes along** — a cause that explains only this observation
moving with it — is not in this decision: a cause is analysis of a scope,
and whether it holds in another is the analysts' to say. It may follow later.

### 3. Said first: `move.plan`

Every link a move would cut is listed before anything is written, with the
cause it lives on and, where a solution addresses a root it leads to, that
solution, together with how many comments move and the scopes it writes.
The screen shows it; the agent reads it with `move.plan`, a read as
`merge.plan` is (ADR-0035, *the agent's tools*), answered where nothing may
be changed.

### 4. Written over both scopes, all or none

A move is one change over the source and the target, each scope's part as
that scope's step, written through the merge's machinery: the one apply
over several scopes, expecting the revisions the plan read
(`projects/scopeAccess.changeScopes`), the open scope's part through its
session and a barrier on its undo stack (ADR-0035, *as built: the rules and
the one apply*), and the page's `onChangeAcross` and the agent's
`SessionView.changeAcross`, which read every scope fresh and plan again
before they write. A plan that no longer holds is refused and nothing is
written. Where a host cannot write two scopes as one, a move is refused
`agent.scopeNotOpen`, as a merge across scopes is.

A move is offered only where the person may write **both** scopes; the
source says which they may (`writable`), and the storage refuses it anyway
where it must.

### 5. On the screen

*Move to scope…* is one of the reader's occasional actions, beside merge,
archive and delete (ADR-0032 §7). It opens a screen over the observations
page, as the merge screen is, with the target picked by its path — the
picker that shows a scope from the organisation down (`projects/scopeLabel`,
`scopeTrail`), nearest first, with the scopes that may not be written listed
and not pickable — and, below it, what `move.plan` says: the number the
record will have, the links cut and the solutions they reach, the comments
that move. **Move** says what it does (*Move OB-0007 to <scope>*) and lands
as one change. The screen closes on the record in its new scope, or stays up
and says why nothing moved.

### 6. A bright spot

**`bright: true`** on an observation marks it as something that works,
rather than something that goes wrong. Absent is a problem, as every
observation recorded before is.

* **The method is the same.** The causes behind a bright spot are what makes
  it work; asking why again and saying which is the root is unchanged. A
  solution on such a root **spreads** it: it is the same record, with the
  same gates — benefit, cost, who it was checked with, earlier attempts —
  and the same experiment before it is proven. Nothing about a cause or a
  solution is bright; they are known by what they lead to.
* **The form** asks first: *Problem | Bright spot*, problem chosen. It may be
  changed later, as a step.
* **The register and the picture** draw a bright spot with its own chip and
  colour, and the observations page, the picture and the Solutions page gain
  a **`tone`** filter: problems, bright spots, or both, which is the default.
* **A merge refuses to mix the two** (`merge.mixedTone`): a problem and a
  bright spot are not one thing seen twice. The merge screen offers records
  of the survivor's tone only.
* **`seenSinceImplemented` ignores bright spots** (ADR-0026): a bright spot
  seen again after a solution was implemented is the solution working, not
  failing to hold.
* **The words**: *Bright spot* in English, *Lichtpunt* in Dutch, *Lichtblick*
  in German.

### 7. The agent

* **`observation.move`** — `id` (or label), `to` (the target scope's path),
  in the scope the call is for; it answers the new number and the links cut.
  It lands only through a host that writes several scopes as one (§4).
  `solution.move`, which moves a solution's state, is unrelated.
* **`move.plan`** — the same arguments, a read (§3).
* **`observation.record`** and **`observation.update`** take `bright`;
  **`observations.list`** takes `tone`, and every read says `bright` where it
  is set.
* **`observation.merge`** and `merge.plan` refuse a mixed set with
  `merge.mixedTone`.
* The method text sent on connect says what a bright spot is, that its causes
  are what make it work and a solution on its root spreads it with the same
  gates, and that a move cuts the links that explain the observation and says
  which first.

### 8. The scope format

`bright`, `moved` and `movedIn` are new on an observation, and a build that
reads 12 would read a tombstone as a live record — the same observation
twice, in two scopes — and drop `bright` on the way back. **The scope format
turns to 13**, the one turn of this release with ADR-0037 and ADR-0039. A
scope written before has no bright spots and nothing moved.

## Consequences

* Good: an observation goes where it belongs with its number's history, its
  sightings, its merges and its comments, and the old place says where.
* Good: what works is analysed with the method that analyses what fails, and
  its spreading is held to the same gates.
* Good: the move reuses the merge's all-or-none write, so nothing new decides
  how two scopes are written as one.
* Bad: a move cuts the cause links that explained the observation, and the
  analysis in the target starts again. It is said before the move, never
  after.
* Bad: a move across scopes is not taken back with ⌘Z, as a merge across
  scopes is not (ADR-0035 §5): taking it back is moving it back (§1), and
  the links cut, which still name it, explain it again; anything linked in
  the other scope meanwhile is cut in its turn.
* Neutral: the number changes with the scope. People who said `OB-0007` find
  it by the tombstone, which says the new one.
