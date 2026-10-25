# ADR-0043 — Building blocks, evaluated by each scope that adopts them, and documents that refer rather than copy

* Status: accepted, 25 October 2026; as built, 25 October 2026 (3.8.0):
  building blocks, their evaluations, the decision and where the choice is
  seen (§1–§8, §13 but the `ref` fence); references in documents (§9–§11)
  and the agent's tools (§12) not yet built
* Date: 2026-10-25
* Deciders: Wouter Simons
* Extends: ADR-0009 §3 (a document that computes), ADR-0012 §7 (a decision
  kept in its scope, about a subject), ADR-0016 (a laid-out view is a tab),
  ADR-0034 (a drawing is a view), ADR-0041 (principles and citing), ADR-0042
  (topics)

## Context and Problem Statement

Two gaps, decided together because the second is how the first is read.

**Building blocks.** An organisation agrees on the things every solution
reuses rather than rebuilds: a message gateway, an identity service, a
document store. Such an *architecture building block* (ABB) says what is
required — the capabilities, and how much each matters in which kind of use
— without naming a product. What delivers it is a *solution building block*
(SBB): a product, a service or something built in house. The choice between
SBBs is made where the block is adopted, and two parts of an organisation
with different needs may rightly choose differently. Today none of this has
a place: the requirements are a spreadsheet, the options a slide, the
choice a decision with the reasoning pasted in, out of date the day the
spreadsheet changes.

**Documents.** A scope's and an element's documentation is markdown. It can
link an element (`[[Name]]`) and show a view as a picture, and nothing else:
a principle, an evaluation, a decision or an observation is copied in as
text, and a view's picture is a picture of what it was.

## Decision Drivers

* **Requirements are the block's; choices are the scope's.** What is needed
  is said once; each adopting scope says which uses apply to it, which
  solutions it weighs and how well each covers each capability, under its
  own rights.
* **Usage contexts in words**, not a scope or an application: *high-volume
  partner exchange*, *regulatory filings*. A context is a kind of use, and
  several scopes share one.
* **The arithmetic is plain and pure**: fit is a number anybody can redo.
* **The outcome is the input to a decision**, kept in the deciding scope.
* **A document says which thing; the thing's own editor says what it is.**
  A reference is drawn from the model each time it is read.
* **A view in a document is the view**, as it is now, in the reader's
  theme — not a stored picture.
* An agent writes documents with the references a person would.

## Considered Options

### Q1: Where a block's evaluation is kept

1. **On the block**, one evaluation for everyone. One scope's needs would
   decide for all, and a scope could not choose without the block's rights.
2. **Per usage context, on the block.** Contexts are shared, and so are the
   ratings; a scope that weighs other products has nowhere to say so.
3. **Per adopting scope, in that scope.** *Chosen.*

### Q2: How a document refers

1. **Copy the text in**, as today. Stale the day the source changes.
2. **A link per kind**, each with its own syntax. A new kind means a new
   syntax for writers and agents to learn.
3. **One fence, `ref`, and one catalogue** behind every way in. *Chosen.*

### Q3: How a view is shown in a document

1. **A stored picture**, regenerated on save. Stale, and in one theme.
2. **The app in a frame.** A second copy of the app per view.
3. **Drawn live, read-only, by the code that draws its tab.** *Chosen.*

## Decision Outcome

Q1 option 3, Q2 option 3, Q3 option 3.

### 1. A building block is an element

`buildingBlock` is a new element kind, on no technology layer: a concept,
drawn as a card of its own on a board, listed on its scope's home, in the
register of building blocks and on the topics catalogue (ADR-0042). It is in
every exhaustive switch over the kinds — palette, card, `mayEdit`, stand-ins,
index, search — and cites principles as any element does (ADR-0041 §7).

### 2. Requirements, on the block

* `capabilities: { id, text, must?, function?, aspect? }[]` — what it must
  provide; optionally a function on a business sheet that it serves and a
  principle aspect it delivers.
* `contexts: { id, name, description?, needs: { [capability]: 0..4 } }[]` —
  **usage contexts said in words**, each with how much it needs of each
  capability. Each context has a **chapter in the block's document**, `##
  <name>`, written when the context is added; the context's name in the grid
  opens its chapter.

### 3. Solutions, a catalogue on the block

`sbbs: { id, name, supplier?, sort: product | service | inHouse, status:
candidate | evaluated | inUse | retired, elements?: id[] }[]` — what could
deliver it, never how well. `elements` names the landscape elements that are
that solution.

### 4. Evaluations, one per adopting scope

An **evaluation** is a record of the scope that adopts the block
(`RecordKind` gains `evaluation`), kept under that scope's rights in
`_evaluations/<block-scope>~<block-id>.json`:

```
{ block: { scope, id }, contexts: contextId[], options: sbbId[],
  coverage: { [sbb]: { [capability]: { level: 0..4, how? } } },
  chosen?, decidedBy? }
```

The scope says which usage contexts apply to it, which solutions it weighs,
and how far each covers each capability, with a note on *how*. What it
**needs** of a capability is the most any of its contexts needs. Two scopes
may rate one product differently. A scope that starts an evaluation where
another has one is offered *Copy the ratings from <scope>*; the copy is its
own from then on.

### 5. The arithmetic

`model/evaluation.ts`, pure. Over the capabilities the scope needs (need >
0):

**fit = Σ min(coverage, need) ÷ Σ need**, shown as a percentage, and a
capability marked `must` that is needed and not covered at 4 **fails** the
option whatever its fit. Options rank by failing last, then fit.

### 6. Two grids, one look

* **Requirements**: capabilities × usage contexts, the needs as Harvey
  balls.
* **A scope's evaluation**: the capabilities, *Needed here* (read, not set,
  with the contexts that drive it on hover), the options with their coverage,
  and *Fit here* with the sum on hover.

A ball moves a quarter per click and per arrow key; ⇧-click or N writes the
note. **Every ball says on hover what it means**: what it is between, the
level in words (*Not needed · Nice to have · Useful · Important ·
Essential*; *Not covered · Barely · Half · Mostly · Fully covered*) and how
to change it.

### 7. A decision from an evaluation

*Propose a decision…* from a scope's evaluation makes a decision **kept in
that scope** about the block, with the block and the scope in its title,
each option with its fit, the evaluation referred to as it stood (a `ref`
with `at:`, §10), and the block's citations copied as `supports`. **Accepting
it sets the evaluation's `chosen` and `decidedBy` in the same step.**

### 8. Where the choice is seen

* **The register of building blocks**, from a *Building blocks* card on the
  organisation's home and on any home that keeps or evaluates one: one row
  each — kept in, capabilities, usage contexts, evaluated in (✓ the chosen),
  solutions; a row opens the block.
* **An element that is a chosen solution says so** on its page and in the
  inspector — *is <SBB>, the <block> chosen for <scope>* — linked to the
  evaluation.
* **Where a scope picks an application, a platform or a service** (an
  existing application or platform, *Uses*, the technology landscape's
  palette), the solutions chosen for that scope come first, marked as such,
  and picking one links it as the solution's element.

The block's page: *About* (its document, a chapter per context, its cited
principles, its changes) · *Requirements* · *Solutions* (the catalogue,
where each is weighed and chosen) · *Where used* (each scope's evaluation,
and *Evaluate for a scope…*).

### 9. References in documents: one catalogue, three ways in

`documentation/references.ts`, pure, is **the catalogue** of what a document
may refer to in a scope: views, elements, principles and their aspects,
building blocks and each scope's evaluation, decisions, observations. Each
entry carries the markdown that refers to it. The ways in:

* **While typing**: `[[` or a lone `@` opens a list at the caret, narrowed
  by the words typed; ↑ ↓, Enter or Tab, Escape.
* **Insert ▾** in the document's bar: *Picture…*, *Business case*, and each
  kind by name.
* **The agent**: `references.list` (`scope`, `query?`, `kind?`) answers the
  same catalogue, so an agent writing a document embeds what a person would.

### 10. What goes in

An element as `[[Name]]`, a view as `![name](view:<id>)`, and anything else
as one fence on lines of its own:

```
ref
principle: <scope>/<id>   (the bare id at the organisation) · aspect: <n>
evaluation: <block id>    (the requirements) · scope: <path> (that scope's evaluation)
decision: <id>  ·  observation: <id>
at: <revision>            (optional: as it stood then)
```

A principle is drawn as a quote with its number linked; an evaluation as its
grid with *Open the evaluation*; a decision or an observation as a line. A
reference to something gone is a line that says so, never an error.

### 11. A view in a document is drawn live

Read-only, by the same code that draws it in its tab — a board by the
canvas, a sheet, a map, the technology landscape or a chart by its page — so
it is the view as it is now, in the reader's light or dark theme. Not a
stored picture and not a frame of the app. It keeps **its own size**, in a
frame the page's full width that **scrolls** through it, up to 600 px tall;
gestures stop at the frame, so nothing is selected or zoomed from the
document; its details pane, outline, seams and canvas controls are left out.
**Under every view**, a drawing included, a caption names it and opens it.

### 12. Commands and the agent

`buildingBlock.update` (capabilities, contexts — writing the chapter —, and
the catalogue), `evaluation.add`, `evaluation.update`, `evaluation.remove`;
accepting a decision about a block carries the evaluation's choice in its
step. The agent: `element.add` with `kind: "buildingBlock"`;
`buildingBlocks.list`; `buildingBlock.read` (requirements, catalogue, every
scope's evaluation with its fit and arithmetic); `capability.add`,
`capability.update`, `capability.remove`; `context.add`, `context.update`,
`context.remove`; `sbb.add`, `sbb.update`, `sbb.remove`; `evaluation.start`
(`scope`, `contexts`, `copyFrom?`), `evaluation.update`, `evaluation.remove`;
`buildingBlock.decide` (`block`, `scope`); `references.list`. The method sent
on connect: when writing a document, refer rather than copy — find with
`references.list` and put in what it answers.

### 13. The scope format

The block's fields on its element, `_evaluations/`, and the `ref` fence in
documents, part of the turn to **format 15** (ADR-0041 §14).

## Consequences

* Good: what is required is said once, and each scope's choice is its own,
  with the reasoning kept as an evaluation that a decision refers to rather
  than copies.
* Good: a document shows what the model holds now, and a view in it is the
  view.
* Bad: a scope's ratings are its own; two scopes weighing one product rate
  it twice. The copy offered when the second starts makes that one step.
* Bad: a live view costs its drawing every time the document is read; a
  document of many large views is slow where a page of pictures was not.
* Neutral: checking a landscape against its scope's chosen solution, and an
  ABB drawn as the technology service that delivers it, are later decisions.

## As built, 25 October 2026: building blocks, evaluations and the choice

**The block** is the element kind `buildingBlock`, in every table over the
kinds, on the landscape board's palette under *Architecture* and drawn as a
card with a mark of its own. Its requirements and catalogue are three fields
of the element — `capabilities`, `contexts`, `sbbs` — and its document is
its description. A solution's `elements` name landscape elements by id, ids
being the organisation's. **No command of its own**: the three fields are
written by `element.update` like any other, and the reducer refuses, whoever
sends the step, fields that do not hold together or on an element that is
no block (`command.badBlock`, `model/buildingBlock.ts`). A usage context
added writes its chapter, `## <name>`, in the same step.

**An evaluation** is a record of the evaluating scope (`evaluation`, in
`model/evaluation.ts` with the arithmetic), its id named by the block —
`<block scope>~<block id>`, the scope's slashes as dots and the organisation
as `-` — so a scope evaluates a block once and the file says which without
being opened: `_evaluations/<id>.json`. The reducer refuses one not named by
its block, a ball off the levels or a choice it does not weigh
(`command.badEvaluation`); the block, which may be kept anywhere, is asked
where it is read. A diff, the history and a restore know it.

**The decision** proposed from an evaluation is kept in the evaluating
scope and says the option it chooses — `chooses { evaluation, option }`, on
the record and as two fields of its file. Its body is the record's own
sections written from the evaluation (`decisions/adr.draftedBody`): the
context, what is needed here as its drivers, each option with its fit, the
chosen option as the outcome, and the evaluation referred to as it stood
under *More information* (the `ref` fence, drawn from step 7 on); its
consequences and its approval are left to the person, which is all the
acceptance gate then asks. It copies the block's citations as *supports*. Accepting it
writes the evaluation's `chosen` and `decidedBy` in the same step, from the
decisions page and the agent alike (`choicesAccepted`), not in the reducer,
which enforces no lifecycle (ADR-0008).

**The pages** are the organisation's and over its homes: the register, from
a *Building blocks* card on the organisation's home and on any home that
keeps or evaluates one, and a block's page over it, from a row, a topic in
the catalogue, the block's inspector on a board, or `app.open` with `page:
'blocks'` and the block's id. Every write is a step in the scope that keeps
the record, under its rights, whatever is open. *Evaluate for a scope…*
offers *Copy the ratings from <scope>* where another scope evaluated it: its
options and balls, never its choice. The principles a block cites are read
on its page and cited where the block is open, as an element's are.

**Where the choice is seen**: an element that is a chosen solution says *Is
<solution>, the <block> chosen for <scope>* in its inspector, linked to that
evaluation; the *Uses* picker and *Existing application…* offer the elements
chosen for the scope first — its own choice of a block, else the nearest
scope's above — under *Chosen for this scope* (`projects/chosenSolutions.ts`).
A chosen solution with no element yet is linked from the block's catalogue.

