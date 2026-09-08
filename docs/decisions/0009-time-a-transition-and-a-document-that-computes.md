# ADR-0009 — Time on the facts, a transition as a record, and a document that computes

* Status: accepted
* Date: 2026-09-08
* Deciders: Wouter Simons

**Built, 8 September 2026**, in the order the last section gives, with four
departures from the text below that are worth knowing before reading it:

* **There is no `src/transitions/`.** A plan and a timeline turned out to be
  the same view — a plan IS a band on the axis, and reading one always means
  asking what else is happening that month — so the transitions page and the
  roadmap page are one page, and a plan's rules are small and pure enough to
  live in `model/transition.ts`. The module map grew by one row, not two.
* **`checks.ts` is in `model/`, not in `roadmap/`.** The import matrix refused
  `agent → roadmap` when `roadmap.check` was written, and it was right: the
  checks have two consumers and are arithmetic over a landscape. Moved rather
  than routed around.
* **Plans are not in ⌘K.** The roadmap lists every plan directly and a project
  has a handful of them, so the search hit is a small follow-up rather than a
  gap. Nothing else in step 6's list was dropped.
* **The inspector fields were missed and then found.** Steps 4 and 5 put dates
  on the model and drew them, and nothing edited them — the feature was
  unreachable until running the app in a browser showed it. The three lifecycle
  dates, the successor, the owner and a connection's window landed with step 7.

The open questions were answered as their recommendations said, with one
exception noted there: the scorecard **is** in the block, exactly as specified —
two columns, an explicit 1–5 scale, a maximum that is derived.

## Context and Problem Statement

This tool draws a landscape as it is on the day you look at it, and it has no
way to say anything else. A landscape is a document about an organisation that
a team argues over for years (ADR-0003), and most of what that team argues
about is *change*: this application is being replaced, there is a year where
both of them run and the routing is a mess, and somebody has to pay for it.

What exists today is one field. `Lifecycle` is `planned | live | retiring |
retired` (`model/types.ts:57`), it is a single value with no date on it, and
nothing else in the model has ever carried a date. The only dates in the whole
tree are a diagram's `documentDate` for its title block, a decision's `date`,
a signer's `signedAt` and a project's `updatedAt` from the file system. A
connection knows nothing about time at all.

So the three questions a person actually has cannot be asked:

1. **What will this look like?** A future landscape can only be made by
   copying the project and editing the copy, which drifts from the real one
   the same afternoon and has no way of saying *when* it is.
2. **What is the plan?** The hybrid phase — old system live, new system live,
   a sync line and a routing façade between them, then the old one gone — is
   three states of one landscape and there is nowhere to write down that they
   are three states of one thing, in what order, by when, or who owns it.
3. **What does it cost, and is it worth it?** There is no answer at all. Two
   fields survive from the application this editor was carved out of —
   `DesignParameters` on every element (complexity, maturity, `pricePerItem`)
   and `estimatedMonthlyCost` on every diagram — and **nothing reads or writes
   either of them**. They are reachable only through `DiagramPatch`; no
   inspector, no interchange field, no folder file. They are not an ingredient,
   they are debris.

There is a fourth question, and it is the one that arrived first in practice:
**a plan is not made of paragraphs.** A cutover is a picture, a timeline is a
picture, and a business case is a table with arithmetic under it. Documents
here render markdown to React elements (`documentation/ui/MarkdownView.tsx`)
with exactly one thing in them that is more than prose: a ```mermaid fence,
loaded on first use and drawn by `MermaidBlock`. There is no way to put a
picture in a document — no image storage, no reference form, and the renderer
would not resolve one if there were. Uploaded *logos* have all of that
(`logos/<key>.svg`, a library on the project, a 200 KB cap) and they can only
ever be an icon on a card.

### What a spreadsheet costs, measured on a real one

The business case that prompted this record is a five-sheet workbook: a
weighted dashboard over twenty-two indicators, a financial sheet (NPV, IRR,
payback, ROI, cost-benefit ratio over five years), and three sheets of
baseline-versus-improved pairs turned into percentages — operational,
strategic, and long-term qualitative.

It is a good spreadsheet, and two of the numbers on its dashboard are wrong.

* **NPV is discounted one period too far.** `=NPV(C4,C9:H9)` includes the
  year-0 investment inside the discounted range, and Excel's `NPV` discounts
  its *first* argument by one period. The investment is therefore counted as
  −415,000 / 1.1 and every benefit shifts a year with it. The sheet reports
  **288,681**; the same cash flows discounted from year 0 are **317,549**.
* **Efficiency gain is an operator-precedence bug.** `=C6-C7/C6` on a baseline
  of 1.5 and an improved figure of 1.2 evaluates as 1.5 − (1.2/1.5) = **0.70**
  and is presented as a 70% gain. The improvement is (1.5 − 1.2)/1.5 = **20%**.

Neither is visible. You cannot see a formula in a spreadsheet without clicking
the cell, a reviewer reads the number, and the number carries no evidence. That
is the argument for computing this inside a document rather than linking one:
not that spreadsheets are bad, but that **a business case is read far more often
than it is opened**, and every reader of a linked file gets the number without
the arithmetic.

The third thing that sheet shows is structural rather than a bug. Twenty-two
indicators are each derived to a percentage, and beside each one a human types
a **score from 1 to 5** that the percentage does not feed. The maximum is
`SUM(weights)*5` = 1425 while the label above it says "Weighted score (1-10)".
The derived half and the judged half never meet. That is not a defect of the
workbook; it is what happens when judgement is dressed as arithmetic — and it
is the half of it this record deliberately does not copy.

## Decision Drivers

* **One model, one truth.** ADR-0002 made `apply(model, command)` the only
  writer and one undo stack the only history. A second copy of a landscape for
  "the future" would be a second brain, which is the exact mistake that record
  removed several thousand lines to undo.
* **Lighter than the alternative, on purpose.** The tool this is measured
  against inventories, surveys and scores an application portfolio. What this
  tool has that such a tool does not is a *drawn* landscape and a decision
  record beside it. Time and a plan make those two worth more; twenty-two
  scored indicators would make them worth less.
* **A change should read as a change** (ADR-0003). Everything added here is a
  file or a field in a file that already diffs, and nothing new is written into
  a JSON string that a reviewer has to unescape.
* **The document is the artefact.** A plan, its picture and its business case
  are one thing a person reads top to bottom. Splitting them across a page, an
  attachment and a spreadsheet is how two of them go stale.
* **Additive and optional, everywhere.** An element with no dates, a project
  with no transitions and a document with no blocks must behave *exactly* as
  they do today, at every date. That is the property that keeps this from
  being a migration.
* **Arithmetic is testable; judgement is prose.** Anything this computes must
  be a pure function with a node test. Anything it cannot compute goes in an
  ADR, with its drivers and its options, which is a facility this tool already
  has and that tool does not.
* **The app does not fetch.** `model/logo.ts` says it out loud: the package
  never fetches anything itself. A tool that promises no account, no backend
  and no telemetry cannot start loading images off the network because a
  markdown file asked it to.

## Considered Options

Four questions. Each is decided below, and each could have been decided the
other way without disturbing the other three.

**Q1 — How does a landscape acquire time?**

* A. **Dates on the facts.** Optional dates on the existing lifecycle, a
  validity window on a connection, and a date on a diagram saying when it is.
* B. **Scenario branches.** A named copy of the model per scenario, diffed
  against the base.
* C. **A version per date.** Snapshots of the whole model, one per milestone,
  with the future ones authored by hand.

**Q2 — What is a plan, and where does it live?**

* A. A markdown document with no structure, filed like any description.
* B. **A record of its own**, numbered per project, with a status, a window,
  the elements it touches, the decisions it rests on, and a markdown body.
* C. A field on the ADR: decisions grow a plan section.
* D. A task list synchronised with an external tracker.

**Q3 — How is a business case expressed, and what does it compute?**

* A. Fields on the plan record: investment, benefit, currency.
* B. A link to a spreadsheet.
* C. **A fenced block inside the plan's own document**, parsed and computed
  where it is rendered.
* D. A dedicated calculator screen with its own stored data.

**Q4 — What may a document hold besides prose?**

* A. Nothing more; mermaid stays the exception it is.
* B. **Images kept in the project folder, referenced as ordinary markdown**,
  plus one registry that says which fence names render as something.
* C. Images as `data:` URLs inline in the markdown.
* D. Arbitrary HTML in descriptions.

## Decision Outcome

### Q1: A. Dates on the facts, and a diagram that says when it is

Time is a property of the things that already exist, not a copy of them.

```ts
// model/types.ts — every field optional; absent means what it means today
export interface DesignElement {
  lifecycle: Lifecycle                    // unchanged; the phase until a date says otherwise
  lifecycleDates?: { live?: string; retiring?: string; retired?: string }
  successorId?: ElementId                 // what replaces it
  owner?: string                          // see the note below
}
export interface DesignConnection {
  validFrom?: string
  validUntil?: string
}
export interface DesignDiagram {
  asOf?: string                           // absent: today, and it moves with the calendar
}
```

Dates are `yyyy-mm-dd`, the form every other date in this model already takes.
One pure function — `phaseAt(element, date)` in `model/lifecycle.ts` — answers
where an element is on a given day: the stored `lifecycle` until the first date
it has passed, then the phase that date names. An element with no dates
therefore answers the same thing on every day of its life, which is today's
behaviour, unchanged, and is the property the tests pin.

A **connection defaults to the life of its ends**: a line is drawn on a date if
both the elements it joins are drawn on that date. Only the lines that are
genuinely temporary need a window of their own — the sync, the façade, the
double-write — and that is exactly the hybrid phase, said in the model rather
than in a paragraph.

The reducer refuses dates that go backwards (`retiring` after `retired`), and
refuses with a key like every other refusal in it (`platform/errors.ts`), so
every caller — inspector, agent, paste — gets the same answer.

**A diagram carries `asOf` and changing it is a command.** With no date it
shows today. With one it shows the same single model as it stood on that day:
elements not yet live drawn as planned, retiring ones badged, retired ones
dimmed or hidden by the view setting that already exists for badges. Making
the future diagram this record started from is therefore *Duplicate as of…* on
the diagram tab — a copy of the placements, a date, and a tidy pass — and it
cannot drift, because there is nothing in it to drift.

Setting the date is an ordinary undoable step with a coalesce key, so dragging
a date control is one entry in Activity and one ⌘Z, exactly as typing a name
is. There is deliberately no second, temporary "peek" mechanism: two ways to
change what a diagram shows is two things that can disagree, and the one we
have is already cheap and reversible.

B was the first instinct and is the one to refuse hardest. A scenario branch is
a copy, a copy needs a merge, and a merge over a landscape is the reconcile
pass that ADR-0002 deleted. It also has no answer to "when" — a scenario named
*Target* is true on no particular day, so nothing can be checked against it. C
is B with worse ergonomics: the future versions are authored by hand and go
stale the first time an element is renamed, and ADR-0008 has just spent a whole
record establishing that versions come from git and only ever look backwards.

**One field here is not about time,** and it is included because it is the
cheapest thing in this record. `owner` becomes a field because the document
template already asks for it as a free-text table row
(`documentation/documentation.ts`, the **Owner** row) where nothing can query
it. That file's own comment sets the rule: vendor, technology and lifecycle are
fields *because* writing them into the table as well would give one question
two answers. Owner is the same question and gets the same treatment: it becomes
a field, the row leaves the template, and the roadmap's checks can name a
person. Criticality and last-reviewed stay prose; nothing computes over them.

### Q2: B. A transition is a record, numbered, beside the decisions

```ts
// model/transition.ts — the record; src/transitions/ owns the rules
export type TransitionStatus = 'draft' | 'agreed' | 'running' | 'done' | 'abandoned'
export type TransitionRole = { elementId: ElementId; role: 'introduces' | 'retires' | 'changes' }

export type Transition = {
  id: string
  number: number                          // per project, never reused
  title: string
  status: TransitionStatus
  from?: string                           // the window, yyyy-mm-dd
  to?: string
  owner?: string
  elements: TransitionRole[]              // what it does to the landscape
  decisions: string[]                     // the Adr ids it rests on
  milestones: { date: string; name: string }[]
  body: string                            // markdown, and where the business case is
}
```

Filed as `transitions/NNNN-<slug>.md`: front matter for the fields, markdown
for the body, which is the codec `projects/adrFile.ts` already writes and the
shape this repository's own `docs/decisions/` uses. Three commands —
`transition.add`, `transition.update`, `transition.remove` — so a plan is one
undo step, one Activity line and one row in `model/diff.ts` like everything
else. Its body starts from a template: goal, scope, approach and phases,
the business case, risks, rollback.

A transition is the missing link and nothing more: it names elements, it names
decisions, it has a window and milestones, and it holds the prose. It does not
own the dates on the elements — those are Q1's, on the elements, where the
canvas can read them without knowing plans exist. What it offers instead is a
**shift**: move this plan and everything it owns by N days, built as one
transaction of `transition.update` plus the `element.update`s for the dates it
introduced. One undo step, because a plan slipping is one thing that happened.

**It does not lock, and a decision does.** `updateAdr` refuses an accepted,
rejected or superseded record because a decision records a moment and a record
that can be rewritten is not a record of one. A plan describes work, and work
changes; `done` and `abandoned` end it for the roadmap's purposes and edit
freely. What a plan needed locking *for* — an audit trail of what it said last
week — is what ADR-0008 just built, and this gets it for free by being one file.

A is where this starts if nothing is decided: a description called "Warehouse
migration" that nothing can list, filter or check. C is worse than it looks — a
decision that grows a plan section becomes a record that changes after it is
accepted, which is the one thing the status machine exists to prevent. D is a
different product: this tool has no account and no backend, and a synchronised
tracker is both.

### Q3: C. The business case is a fenced block, and the fence is the input

````markdown
```business-case
currency: EUR
discount rate: 10%

| Line                        |   Year 0 |  Year 1 |  Year 2 |  Year 3 |  Year 4 |  Year 5 |
| --------------------------- | -------- | ------- | ------- | ------- | ------- | ------- |
| Licences and implementation | -180 000 | -35 000 | -35 000 | -35 000 | -35 000 | -35 000 |
| Migration and dual run      | -235 000 | -60 000 |         |         |         |         |
| Retired licences            |          |  25 000 | 125 000 | 125 000 | 125 000 | 125 000 |
| Faster order handling       |          |         |  50 000 | 150 000 | 150 000 | 150 000 |

| Criterion               | Weight | Score |
| ----------------------- | ------ | ----- |
| Alignment with strategy |      3 |     4 |
| Risk reduction          |      2 |     2 |
```
````

The first column names a line, the rest are periods, a negative number is money
out and a positive one is money in, and a blank cell is zero. Thousands
separators, spaces and a currency symbol are tolerated on the way in. **The
text is never rewritten** — this is the person's table, and the block is read,
not edited on their behalf.

Rendered under it, computed by `documentation/businessCase.ts`:

| It says | Which is |
|---|---|
| Net and cumulative cash flow per period | the two rows every reader adds up by hand |
| **NPV** at the stated rate | year 0 undiscounted, period *n* over (1+r)ⁿ |
| **IRR** | the rate where NPV is zero, by bisection; blank when the flows never cross |
| **Payback** | the period the cumulative flow turns positive, interpolated inside it |
| **ROI** | (total in − total out) / total out |
| **Benefit-cost ratio** | total in / total out |
| **Weighted score**, when the second table is there | Σ(weight × score) out of Σ(weight × 5), with the scale named |

That is the workbook's *Financial KPIs* sheet, minus the sheet, with the
period-shift bug it cannot have because year 0 is not in the discounted range —
and the two numbers above are the fixtures its unit test is written from.

**What is deliberately not copied:** the operational, strategic and long-term
sheets. Twenty-two baseline-versus-improved pairs, each derived to a percentage
that nothing consumes, each with a judged score beside it that the percentage
does not feed. The judgement in them is real and it is worth writing down —
in the record that already exists for writing judgement down, with its drivers,
its options and its pros and cons, linked from the transition. The scorecard
that survives is the two-column table above: a handful of criteria, an explicit
1–5 scale, and a maximum that is derived rather than typed, so two transitions
can be compared without anyone having to check which scale the label meant.

**Why a block and not fields.** The plan is a document and a reader reads it
downwards; a business case that lives in a form beside the prose is a second
place to look and a second thing to keep true. A block is also *free* in this
architecture: it is the mermaid mechanism with different arithmetic, it needs
no new screen, no new command and no new file, and it edits in the source pane
that already exists with the result rendering beside it. Where a number has to
leave the document — the roadmap totalling what a plan will cost — one pure
function reads the blocks out of the markdown, which is precisely how the
canvas already gets an element's short description out of its document's header
table.

A is the tempting small version and it fails on the second question anybody
asks: an investment is not one number, it is a number per year, and the moment
it is a row it wants a table. B is what the organisation does today, and the
measured cost of it is above. D is a screen, a store and a format for something
that is four lines of arithmetic over a table.

### Q4: B. Images are files in the folder, and a fence name is a registry entry

**Images.** `images/<key>.png|.jpg|.svg` in the project folder, and in the
group folder for a group's decisions — the same shape `logos/` already has, for
the same reasons, one directory up from the document that uses it. A document
refers to one as an ordinary relative markdown image:

```markdown
![Cutover routing, week 3](../images/cutover-routing.png)
```

Relative, and not a scheme of our own, because the folder is text a person can
read (ADR-0003) and `docs/warehouse.md` with that line in it renders correctly
on GitHub, in VS Code, and in every markdown tool the team already has. The app
writes the right number of `../` for wherever the document lives, and
`MarkdownView` takes a `resolveImage(src)` prop bound to that document — the
same shape `renderMermaid` already has, and the same reason: a test hands in a
fake, and the view stays a pure function of its props.

**Only the project's own images are drawn.** An `http(s)` source is rendered as
a link and never fetched. `model/logo.ts` already states the rule for marks —
the package never fetches anything itself — and a remote image in a document is
a network call and a tracking pixel in a tool that promises neither. This is
not negotiable and it is one branch in the resolver.

An SVG goes in an `<img>`, never inline as markup, which is the existing logo
rule and the reason it is safe: an `<img>` neuters script in an SVG, and
`MarkdownView` renders to React elements so authored HTML has never been a
question. The cap is 2 MB per image — a screenshot, not a photo library — and
in the browser-storage fallback the existing quota reporting is what says no.

Getting one in is paste, drag onto the edit pane, or a button: the file joins
the library, the file is written on the next save, and the markdown gains the
line at the cursor. Like a logo upload, and unlike everything else in the app,
this is **not** an undo step — the *text* insertion is, the bytes are not,
because the library sits on `ProjectSnapshot` beside `logoLibrary` rather than
in the model where the reducer could reach it. Undoing the insert leaves an
unreferenced file, which is harmless: the format already reads marks a person
dropped into `logos/` by hand and leaves them alone, and `images/` gets the
same treatment.

**Blocks.** The fence dispatch in `MarkdownView` becomes a small registry —
`mermaid` → `MermaidBlock`, `business-case` → `BusinessCaseBlock` — and an
unrecognised name falls through to a code block, which is both the current
behaviour and the safety property worth keeping: a block that cannot be drawn
must never take its source with it. Parses are held in the bounded LRU
`documentation/remember.ts` already provides, keyed on the fence text, for the
reason mermaid is: a page that re-renders should not recompute what it drew.

C puts base64 in the document, which is the thing ADR-0003 took *out* of it
when logos became files, and it would land a megabyte inside `element.description`
where it becomes an unreadable diff on every save. D is the one thing
`MarkdownView`'s design makes impossible on purpose, and reopening it would put
sanitising and a Content Security Policy argument back on the table for no gain.

## Consequences

### Good

* **A future diagram is the same landscape.** It cannot drift, it says which
  day it is, and it exports with that date in its title block. The three views
  of a hybrid phase are one model at three dates.
* **The hybrid phase is expressible.** Two applications live at once and the
  temporary lines between them disappear on the day they are meant to, because
  a date said so and not because somebody remembered to delete them.
* **A plan is a record with a number**, in the folder, in git, in search, in
  the diff, in Activity, and reachable by the agent — every one of those for
  free, because it is one file and three commands in a tool built around both.
* **The business case is visible arithmetic.** The inputs are a table a
  reviewer can read and the outputs are computed in front of them. Two of the
  numbers this record was handed were wrong and nobody could have known.
* **Documents can hold a picture**, which is what makes a plan a plan, and the
  picture is a file in the folder rather than a megabyte inside a JSON string.
* **Nothing existing changes.** Every field is optional; the format stays at
  version 3 (ADR-0003 reads unknown keys through untouched); a project with no
  dates, no transitions and no blocks round-trips byte for byte.
* **Two dead fields can go.** `DesignParameters` and `estimatedMonthlyCost`
  are removed in the same phase that gives the tool a real answer for cost,
  rather than being quietly revived into something they were never wired to.

### Bad, and accepted

* **Dates are typed, and typed dates are wrong.** Nothing here validates a plan
  against reality; a landscape whose dates nobody maintains says confident
  things about 2028 that are false. The roadmap's checks are the only defence
  and they only catch contradictions, never staleness.
* **`asOf` dirties the document.** Changing what a diagram shows is an edit,
  and looking at next year and looking away leaves an undo step behind. That is
  the price of having one mechanism instead of two, and ⌘Z is the remedy.
* **An image is not undoable.** Stated above; it is the logo wart inherited
  deliberately rather than fixed here, and the open questions say what fixing
  it would cost.
* **Images and business cases do not travel in the interchange document.** It
  carries topology and semantics and no styling, uploaded marks already do not
  travel, and an image reference that resolves to nothing renders as its alt
  text. A working file (the v3 zip) carries everything, as it does today.
* **The business case is text, so it can be malformed.** A block that does not
  parse renders as a code block with the reason above it. That is better than a
  refusal and worse than a form, and it is the same bargain mermaid already
  makes.
* **A scorecard invites false precision.** Two criteria weighted 3 and 2 make a
  number, and a number in a document gets quoted. The rendering names the scale
  and the maximum for exactly this reason, and the record is on the table that
  everything the sheet scored beyond this belongs in an ADR.
* **The module map grows by two.** `transitions/` and `roadmap/` are new rows
  in the matrix. Neither is optional if a plan is a record and a roadmap is a
  screen, and both have narrow rows.

### What this does not do

* **No business capability model.** Domain groups and `category` are the proxy;
  a capability map is a different product and it is the half of APM this tool
  is deliberately not.
* **No surveys, no fit scores, no cost feeds, no TCO per application.** One
  business case per transition. What an application costs to run is not asked
  for here and would be the next thing to weigh, not a thing to add quietly.
* **No conversion between currencies, ever.** A block names one currency and
  computes in it. A rate is a fact about a day and this tool does not fetch.
* **No agent write access to a business case beyond the document.** The block
  is text in a body an agent can already write; nothing gets a tool of its own.

## What this takes, in order

Each step is one commit, ends green on `npm run check`, and leaves the app
working without the ones after it. Steps 1–3 are the document half and are
worth having on their own; 4–7 are the landscape half and depend on nothing in
1–3 except step 3's block being somewhere to put a number.

1. **The fence registry.** `documentation/blocks.ts`, `MarkdownView`
   dispatching through it, mermaid moved in behind it unchanged. Invisible;
   the existing tests are the proof.
2. **Images.** `IMAGES_FOLDER` and its `isFormatPath` row in
   `projects/folderFormat.ts`, the library on `ProjectSnapshot`, the
   `resolveImage` prop and the http refusal, paste and drop in the edit pane,
   the cap and its refusal key. Round-trip and byte-stability tests on the
   writer, as ADR-0003 requires of every file it writes.
3. **The business case.** `documentation/businessCase.ts` — parse and compute,
   pure, node tests whose fixtures are the workbook's own cash flows and its
   two wrong answers. `BusinessCaseBlock.tsx`, and the template insert.
4. **Time on the facts.** `model/lifecycle.ts` and `phaseAt`, the optional
   fields, the reducer's ordering refusal, both directions of the interchange
   with `explicitFields` extended, the folder format. Property tests: a model
   with no dates is identical at every date.
5. **The canvas as of a date.** The date control, phase-driven drawing, the
   `asOf` command with its coalesce key, *Duplicate as of…*, and the export
   title block naming the date.
6. **Transitions.** `model/transition.ts`, `src/transitions/` with the status
   machine and the numbering, the file codec beside `adrFile.ts`, the three
   commands, the Activity wording, the `diff.ts` subject, the search index,
   and the page. The matrix row and its sentence in `eslint.config.js`.
7. **The roadmap.** `src/roadmap/`: the time axis, one row per element with a
   date or a transition, transitions as bands with their milestones, the
   scrubber that sets the open diagram's `asOf`, and the checks — a retirement
   with dependants still connected, a successor live after its predecessor
   retires, a line outliving one of its ends, a transition whose window has
   passed. Timed under the perf step on the generated landscape before it is
   on by default.
8. **Removals, agent, docs.** `DesignParameters` and `estimatedMonthlyCost`
   deleted; agent tools for transitions and the checks; the manual's chapters;
   the Acme example given dates, one transition and one business case;
   `CLAUDE.md` — the module map, *Names, decided*, the state of play.

## Open questions

Each has a recommendation, which the implementer takes unless told otherwise.

* **Does the scorecard belong in v1 at all?** It is the half of the workbook
  most likely to be misused and the half most likely to be asked for.
  *Recommended: yes, exactly as specified — two columns, an explicit 1–5 scale,
  a derived maximum — and no third column ever.*
* **A disposition field (tolerate, invest, migrate, eliminate)?** It is one
  optional enum and a badge. *Recommended: no. A transition with a business
  case says "invest" with evidence, and an application with a retirement date
  and no successor says "eliminate" more precisely than a label does. If the
  four-way label is wanted for a report, it is derivable from those two facts
  and should be derived, not typed.*
* **Should images and logos come under the reducer?** It would make an upload
  undoable and put the library in the model, and it touches `ProjectSnapshot`,
  the working file and both stores. *Recommended: not here. Ship images with
  the logo wart, and fix both in one record when there is a second reason to.*
* **Are milestones dates, or are element dates milestone references?** Today a
  slip means shifting both, which the shift transaction does. References would
  make the plan the single source. *Recommended: dates, and the transaction.
  References are the right answer only if slips turn out to be weekly.*
* **Does a connection's window default to its ends, or must it be stated?**
  *Recommended: default to its ends. A landscape where every line needs two
  dates is a landscape nobody dates.*
* **Where does a group-level transition live, if there is one?** A programme
  spanning projects has no home; `GroupProfile` carries decisions and could
  carry transitions. *Recommended: out of scope. Revisit when a real one
  exists, not before.*

## More Information

* ADR-0002 — commands as the unit of change: why a plan, a date and a restore
  are all one undo step and one Activity line.
* ADR-0003 — the folder of text files: why `images/` and `transitions/` are
  directories of readable files, and what `isFormatPath` protects.
* ADR-0004 — the budgets the roadmap and `phaseAt` are measured against.
* ADR-0007 — the agent as a peer of the menu, which gets transitions for free.
* ADR-0008 — history per thing, which is why a plan does not need locking.
* `documentation/documentation.ts` — the header table, the short-description
  precedent for reading a value out of a document, and the one-question-one-
  answer rule that moves `owner` to a field.
* `documentation/ui/MermaidBlock.tsx` and `remember.ts` — the block this
  generalises, and the bound its cache already has.
* `model/logo.ts` and `projects/folderFormat.ts` — the upload path `images/`
  copies, down to the strays it must not delete.
