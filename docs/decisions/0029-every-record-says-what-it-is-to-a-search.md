# ADR-0029 — Every record says what it is to a search

* Status: accepted
* Date: 2026-09-27
* Deciders: Wouter Simons
* Closes: the open items about search in ADR-0009 (*plans are not in ⌘K*),
  ADR-0011 (*should the app's own search index plans?*), ADR-0021 (*the
  observations are not yet in ⌘K*) and ADR-0026 (*solutions are not in ⌘K*)

## Context and Problem Statement

⌘K was written when a scope held elements, the pages written about them and
its decision records, and `search/` named those three itself: an index of
elements and decisions, three kinds of hit, and a dialog with a heading for
each. Every list the model gained afterwards — plans (ADR-0009), views that
are laid out rather than drawn (ADR-0016), observations and causes
(ADR-0021), solutions and experiments (ADR-0026) — arrived with its own page
and its own agent tools and was never told to the search. Four decision
records wrote the gap down as *open*, and nothing made it close: a new list
compiled and tested green without a line in `search/`.

The agent fared a little better, and worse in its own way: its `search`
added the plans by applying the rule for "found" beside ⌘K's answer, a second
list of kinds in a second place.

And the search stopped at the scope. An organisation is a tree of scopes
(ADR-0012), and a person looking for *the observation about the gate queue*
does not know which domain wrote it down.

## Decision Drivers

* A list the model gains is searched without anybody remembering to.
* A hit says what it is and which scope holds it, and opens where it lives.
* One answer for a person and for an agent (ADR-0011).
* Typing stays within the keystroke budget (ADR-0004) on a large
  organisation, and a step re-folds what it touched, not the scope.

## Decision

**Each list of the model declares what its records say to a search, beside
the kinds** (`model/searchable.ts`). The table is typed over the keys of
`ModelOrder` — every list a scope holds — so a list added to the model
without a line there does not compile, and `searchable.test.ts` says the
same at run time over the lists a model actually has. A declaration is a
function from one record to plain data: an id, a title, the fields matched
beside it, the prose (matched, and quoted around the match), a label such as
`OB-0007`, a status word, the element ids it is about, and the place it
opens — a page and a record, in the shell's own destination words. A list
may make two kinds of hit: an element is found by its name and its page by
its prose, a plan by its title and each milestone as itself.

**The search knows no kind by name.** `search/recordIndex.ts` folds what the
declarations say, once per record, and keeps it in a `WeakMap` on the
declaration and the record object, so a step re-folds the record it touched
(ADR-0002) and a run of keystrokes folds nothing. `searchAll` takes
*sources* — one scope's lists each, nearest first — and answers up to eight
hits per kind, a title that starts with the query first. Eleven kinds:
element, documentation, view, relation, decision, plan, milestone,
observation, cause, solution, experiment.

**⌘K reads the tree.** The open scope is read from the session; each scope
above with its decision records and whatever the tree's read carried of it;
then every other scope the read carried. That read is the one the index is
built from (ADR-0012 §2), kept beside the index instead of being made again,
so a keystroke loads nothing: records, rows, plans and observations. An
element is found once, in the scope that answers for it. A hit from another
scope opens that scope on the hit's page through the shell's own way of
opening a scope — read-only where the source is — and a hit here opens on
its page the way the agent's `app.open` does, which now also opens the
observations page on a record.

**The agent's `search` is the same search.** Over the named scope, the
records of the scopes above and what the scopes below share (their shared
observations and their initiatives); a scope elsewhere is searched by naming
it, as every tool takes `scope`. Every hit carries `kind`, `id`, `title` and,
where they apply, `label`, `status`, `variant`, `detail`, `about`, `snippet`
and `scopePath`; a decision stays kind `adr` with its `adrId` and `scope`
word, an element and its page keep `elementId` and `name`, a plan `planId`,
so an answer that was right stays right. `kinds` narrows the answer.

## Consequences

* The four open items above are closed, and the next list the model gains
  fails to compile until it says what it is to a search.
* A milestone is a hit of its own rather than a reason its plan matched: an
  agent that searched `pilot` and read a `plan` now reads a `milestone`
  whose place is that plan.
* Decision records gained the two bands elements always had, and their label
  is matched: `ADR-0003` finds ADR-0003.
* Measured on the `large` fixture with 400 observations, 200 causes, 150
  solutions, 100 experiments and 100 plans beside it: every kind indexed
  from cold 19 ms, re-indexed after one step 4.2 ms, a keystroke 0.3–0.4 ms.
  Over twenty such scopes as the tree's read has them, folding them all
  costs 116 ms on the first keystroke after the tree was read and a
  keystroke with no early exit 7.2 ms (`search.perf.test.ts`, the table in
  `model/testing/measure.ts`).
* Another scope's decision records, causes, solutions, experiments, views
  and element prose are not in the tree's read, so they are found once that
  scope is open, and the scopes above are searched for their decisions
  only. Putting them in the read is a cost on every open, not on the search,
  and is a decision about the read rather than about this.
