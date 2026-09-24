# ADR-0026 — Solutions, and whether they held

* Status: accepted
* Date: 2026-09-24
* Deciders: Wouter Simons
* Extends: ADR-0021 (observations, and what lies behind them)

## Context and Problem Statement

ADR-0021 takes a team from what it saw to why: observations, causes, root
causes, one picture. It stops there. What the team then does about a root
cause lives in a slide deck again, with the problems the spreadsheet had.
Nothing links an idea to the cause it is for. Nobody can see which root
causes have nobody working on them. Why an idea was dropped two years ago is
gone with the person who dropped it. And when something is built, nobody
checks whether the sightings stopped.

What a good improvement process asks is not new: what an idea costs and
brings, who has looked at it, whether it has been tried before, what an
experiment showed, and — before anything is built — whether it fixes the
cause or only the symptom, and whether it removes something as well as adding
something. The tool should ask those questions where the idea is written
down, and remember the answers, rather than offer a free-text box where they
might be.

## Decision Drivers

* A solution is a record like the others: numbered, one markdown file, in
  git, in the diff, in the Activity list, at the agent.
* The vetting questions are **fields**, so that a rule can read them, a
  node test can hold them and the agent sees what a person sees.
* Nothing may reach the structural column unvetted, and the one way past a
  step that cannot be taken must say why.
* Deciding and building already have records: the decision record, with its
  signers and its lock, and the plan, with its business case and dates.
  Neither is built twice.
* The loop closes on what was seen. A solution is finished when the
  sightings stop, not when the plan says done.

## Considered Options

1. **A status on the cause** — "being addressed", "addressed". *Rejected*:
   one cause can have several candidate solutions, one solution can address
   several causes, and the rejected candidates are worth keeping.
2. **Solutions as plans** — a plan that names the causes it addresses.
   *Rejected*: a plan is work that has been agreed. Most ideas never get
   there, and the vetting before a plan is exactly what is missing.
3. **One record per stage** — a direction, then a structural solution
   written from it. *Rejected*: in practice it is the same idea getting
   firmer. Two directions that turn into one structural solution are one
   solution plus a dropped alternative whose note says where it went.
4. **One record that matures, gated, with experiments as records of their
   own.** *Chosen.*

## Decision Outcome

Option 4.

### 1. Two records on the model

`model.solutions` and `model.experiments`, beside the observations and the
causes and absent when empty, as those are. A **solution** (`SO-0003`) has a
title; a state; `addresses`, the causes of this scope it addresses, each with
a strength; a rough `benefit` and `cost` (`small` · `medium` · `large`); who it
was `validatedWith` (free text, as an observation's `by`); `attempts`, what
was tried before and why it did not stick, or `noneKnown`; `whyNow`; a
`waived` reason; the `decision` and `plan` it rests on; a markdown body; and a
dated history (`proposed`, `moved`, `waived`, `linked`, `dropped`,
`restored`). An **experiment** (`EX-0002`) has the solutions it `tests`, a
`hypothesis` that is never blank, a `measure`, `where`, `by`, a window and an
`outcome`: `planned` · `running` · `confirmed` · `refuted` · `inconclusive`,
with a `result`.

The link runs from the solution to the cause, the direction the work goes,
as a cause's runs to what it explains. The cause is unchanged.

### 2. One record that matures, through gates

`idea → shaped → testing → proven → adopted`, one step at a time, each
forward step behind a gate that `solutionGate` reads off the fields:

* **shaped**: it addresses a cause; benefit and cost are said; it was checked
  with somebody; earlier attempts are listed or none are known; and if there
  were any, why it works now.
* **testing**: an experiment that tests it is planned or running.
* **proven**: an experiment confirmed it, or it was **waived** with a reason.
  Some things cannot be trialled, and saying why is the vetting.
* **adopted**: its decision record is accepted.

The move is refused while anything is open, and the refusal names what is. A
step back is always one step and never gated, except out of `adopted` while
its decision record stands accepted: the record is locked, and the solution
would contradict it. A solution may be **dropped** from any state short of
adopted, with a reason, and **restored** to where it was. A dropped solution
is kept: it is the record of an alternative that was considered.

### 3. Decided and built by the records that exist

A proven solution proposes its decision record on the Decisions page, its
context written from what the solution addresses and what else was
considered; the signers, the status and the lock are that page's. An adopted
solution starts its plan, resting on that record. Each is written together
with the link, as one step. **Implemented** is not a state: it is read off
the plan being `done`, the way a root cause is read off the links.

### 4. Two questions, and one finding

The method asks two things of a structural solution, and the record asks
them without stopping it: `worksAround`, proven or later and addressing no
root cause, so it treats a symptom; and `addsOnly`, its plan introduces and
retires nothing. A third, `adoptedUnplanned`, says no plan builds it yet.

Once implemented, the observations under what it addresses —
`underneath`, following `explains` however deep, a merged or absorbed one
read as its survivor — should stop being seen. A `seen` event after the plan's
end, or after the day it was adopted where the plan has no end, is the
finding that asks whether it worked. It is shown on the solution, flagged in
the picture and answered by `solution.read`. It is not in `checks.list` or
`roadmap.check`: those modules may not read the observation rules, and the
roadmap's checks are about dates on the landscape. Whether it should join
them is left for when a team asks for it there.

### 5. On disk: format 8

`observations/solutions/NNNN-<slug>.md` and
`observations/experiments/NNNN-<slug>.md`, the shape `causes/` has, lists as
front-matter rows. A build that reads 7 walks into `causes/` and no further,
so it would open an 8 and write it back without them: the format turns to 8.
No reserved name is added.

### 6. The page and the picture

A third tab on the observations page, **Solutions**. The picture runs causes
(the roots and whatever a live solution addresses), then **directions**
(`idea`, `shaped`, `testing`), **experiments**, and **structural** (`proven`,
`adopted`, implemented). A solution's lane is read off its state; its width is
its benefit and its fill how far it has got. **Whole chain** puts the analysis
on the left, so one picture runs from what was seen to what was built. Laid
out by the analysis's own sweep, which `solutionGraph.ts` shares with
`graph.ts`: deterministic, for ADR-0021 §5's reason. A cause's reader offers
*Propose a solution*; the home card says how many root causes have a live
solution.

### 7. At the agent

Read: `solutions.list` (with what the next gate still needs and the
questions), `solution.read`, `experiments.list`, `experiment.read`. Write:
`solution.propose`, `.update`, `.address`, `.unaddress`, `.move`, `.waive`,
`.drop`, `.restore`, `.decide`, `.plan`, `.remove`; `experiment.plan`,
`.update`, `.conclude`, `.remove`. A refused move names the open gate items.
The descriptions say that a gate is answered from what people said, and that
a waiver is a reason a person gave.

## Consequences

* New: `observations/solution.ts`, `observations/solutionGraph.ts`, the
  tab's picture, readers and dialogs, the `solution.*` strings in four
  languages, twenty agent tools, the codecs in `projects/observationFile.ts`.
* Changed: `HostExtras`, `ModelOrder`, the reducer, `diff.ts`, `restore.ts`,
  `activity.ts`, the history's change lines, `folderFormat.ts`, the folder
  store's walk, `SCOPE_FORMAT_VERSION` 7 → 8, `graph.ts` (the sweep is
  shared), the observations page's `onChange` (four lists), the shipped
  example (its first analysis, three solutions, two experiments).
* Removing a cause removes it from every solution that addressed it, on the
  page and at the agent, in the same step.
* Open: solutions are not shared upward; a domain's solution that needs the
  scopes above makes its plan an initiative, which is already read upward.
  A solution addresses causes of its own scope only. Solutions are not in ⌘K
  or the history page, which ADR-0021 also left open for observations. There
  is no scoring beyond benefit and cost: the money is the plan's business
  case.
