# ADR-0032 — Local and global analysis, and a root cause that is said

* Status: accepted, 30 September 2026; not yet built
* Date: 2026-09-30
* Deciders: Wouter Simons
* Supersedes:
  * ADR-0021, in part.
    * §1: a root cause is no longer derived. It is a cause that says it is
      one, `RC-`, and becomes one by a step.
    * §3: nothing is shared upward. The `shared` bit and its two events go,
      and a scope reads the analysis of every scope below it.
    * §4's second paragraph: an observation *from a scope below* is absorbed
      as a shared one was, and it no longer needs sharing first.
    * §5: the register's *Shared from* sections and the picture that mixed
      them in. The picture draws each scope below in a boundary of its own.
    * §6: `observation.update`'s `shared`, and `observations.list`'s
      `fromBelow`.
    * The 28 September amendment's last point: the reader moves only the
      occasional actions into `⋯`, and they are no longer the ones it names.
  * ADR-0026, in part. The 25 September amendment's *a link that exists is
    kept when its cause later gains a deeper one*: a root cause gains no
    deeper cause while a solution addresses it (§3 below).
* Extends: ADR-0012 §7 (a record is edited where it lives; what a scope
  above reads from the scopes below it)

## Context and Problem Statement

ADR-0021 gave every scope its own observations and causes, and a scope above
read those a scope below had marked `shared`. ADR-0026 put solutions on the
root causes. Ten days of use found five things that do not hold.

**Sharing is a step nobody takes at the right moment.** A team records what
it saw and moves on, and the scope above sees nothing until somebody
remembers the tick-box. The analysis above is then built on whatever
happened to be ticked. The scope above needs to be able to look, and
needs no permission slip for it. Who may read a scope is already the
source's business, not a record's.

**A cause above can only reach an observation below, so the analysis above
restates the one below.** An organisation-wide reason for three teams'
causes is written as three links to three teams' observations. The causes
those teams already wrote are skipped. The link the analysis needs runs
from a cause above to a cause below.

**A derived root cause is a root by accident.** A cause becomes a root the
moment it is written, because nothing explains it yet. It stops being one
the moment a deeper cause is linked, and it becomes one again when that link
goes. The shipped example shows it: two of its three *root causes* sit in
the causes lane, because they are roots only for want of a deeper cause, and
one sits in the root lane. A solution that addresses a root can find it is
addressing a symptom the next morning, and nobody said so.

**The form records less than an observation is.** Only the title is asked
for. The day is taken as today without being shown. Where and who are
optional, and the page gives an example for the title alone. Causes can be
added only after the observation is recorded, from the reader, through a
dialog per cause. So an observation is often recorded without the three
facts that make it one. A repeat is recorded as a new observation and has
to be merged later. And a title that is really a cause (*because*,
*should*) is not caught when it is typed.

**The picture fills up.** It has no filter, no zoom and one drawing for
each kind. A scope with forty observations is a wall. The actions on the
reader are uppercase text links that take a line each, and at an
ordinary width the reader hides the important ones behind `⋯`.

## Decision Drivers

* The method is unchanged. An observation is a fact, a cause is why, a
  solution addresses a root cause. This record changes where the records
  live and how a person reaches them.
* **A record is edited where it lives** (ADR-0012 §7). A change to a scope
  below, made from the page above, is that scope's step.
* **A root cause is a claim, and a claim is made by somebody.** Being a
  root is a step with a name in the Activity list. Undoing it is another
  step, and both are refused when the chain says otherwise.
* **One submit is one step.** An observation, the new causes it names and
  the links to existing causes are one transaction, so ⌘Z takes them all
  back (ADR-0002).
* **The picture still lands in the same place every time** (ADR-0021 §5).
  Filters and sizes change what is drawn, never how it is placed.

## Considered Options

1. **Keep sharing, and add *share by default*.** *Rejected*: a default
   nobody chose is a sharing step taken for everybody, and it keeps the bit
   and the events that exist only to say what a scope above may read.
2. **Keep the root derived, and draw it more clearly.** *Rejected*: the
   drawing was never the problem. A root that changes when a link changes
   cannot be relied on by the solution that addresses it.
3. **A root cause as a record of its own, apart from causes.** *Rejected*:
   a cause becomes a root and back as the analysis learns. Two lists would
   make that a move between lists and a new number each time.
4. **Local and global scopes, a root cause said on the cause, links down
   the tree between causes, and a page that guides.** *Chosen.*

## Decision Outcome

Option 4.

### 1. Local and global

Every scope's observations, causes, solutions and experiments are its own,
as they were. Those of a scope below the one being read are **local** to that
scope, and the ones of the scope being read are its own. Read from the
organisation, its own are the **global** analysis and everything below is
local. Nothing is shared.
- `Observation.shared` goes, with the `shared` and `unshared` events.
- A file that carries them is read, and they are written no more. The
  events already in a history stay there, as history.

The tree index answers `analysisBelow(path)`: the observations, causes,
solutions and experiments of every scope strictly below `path`. It replaces
`observationsBelow`, which answered the shared observations only.
- Which of those scopes a session may read is the **source's answer**
  (ADR-0022), never a field on a record.
- A source that answers for one reader reads them all.

### 2. The page reads the scopes below on request

The Observations page has **View local**, a switch beside the picture's
other controls. It is on where the scope has scopes below and off where it
has none. With it on:
- **The picture draws each scope below in a boundary of its own**, to the
  left of this scope's analysis. The boundaries nest as the tree nests.
  Inside each, the scope's own lanes run left to right as this scope's do.
  The lines that cross a boundary are the links of §4.
- **The register lists the scopes below after this scope's own**, under a
  heading each.
- **Anything added to a record of a scope below is made in that scope**,
  as a step on that scope: a new cause, a deeper cause, a link between its
  own records, a sighting. The reader says so before the step is taken, and
  the toast after it says where it went. It lands in that scope's Activity
  list and is undone there. ⌘Z on the page above does not reach it,
  because the step is not on this scope's stack.
- **A new observation can be made in a scope below** from here. The form
  asks which scope, and says that the observation becomes local there.

### 3. A root cause is said

A cause gains `root`. A root cause is labelled **`RC-0004`** and shares the
cause's number, so the kind is a prefix and never a renumbering:
- `CA-0004` made a root cause is `RC-0004`.
- `RC-0004` made a cause again is `CA-0004`.
- Numbers stay per scope and are never reused (ADR-0021).
- On disk a root cause stays in `observations/causes/`, with `root: true`
  in its front matter.

**A root cause ends the chain.** Nothing explains it: `cause.link` refuses
a root as the thing explained, and names the rule. A root cause may explain
causes, and it may explain an observation directly.

**Becoming one, and going back, are steps with a guard each:**
- **Make root cause** is refused while a cause explains this one. The
  refusal names each cause that does, and says to unlink it or to make
  that one the root cause instead.
- **Make cause** is refused while a solution addresses this one. The
  refusal names each solution, and says to move it to another root cause
  or unlink it first.

Both guards are refusals the reducer gives, not the page. A command that
would break either rule is refused with its key, whoever sent it.

A new cause may be made a root cause as it is made. A cause that is not a
root and that nothing explains is an **open end**: the analysis is not
finished there.
- The picture marks it with `?`, and the page counts it.
- It is not a finding: a chain that is still being asked about is not a
  contradiction.

ADR-0026's rule stands and reads the field: **a solution addresses root
causes only**. `isRootCause` reads `root`, and `causeDepth` no longer
decides who is a root.

### 4. A cause above explains a cause below, never the other way

A cause may explain a cause of a scope below its own.
- The link lives on the explaining cause, as every cause link does. It
  carries the path of the scope below, as a link to a shared observation
  did. So the link is written in the scope above, where the cause above
  lives.
- The cause below says what explains it on its reader. That is read off
  the tree, as `absorbedFrom` is (ADR-0021 §4), and the scope below is
  never written.
- The cause explained must not be a root cause (§3). To say an
  organisation-wide reason lies behind a local root cause, make that root
  a cause first.

**Refused:**
- a cause below explaining a cause above;
- a cause explaining a cause of a sibling scope;
- a cause above explaining an **observation** below.

The scope below explains its own observations. The scope above explains
the scope below's causes.

A solution addresses root causes of its own scope, as before (ADR-0026).

### 5. Merging from below

ADR-0021 §4 stands, with *shared from below* read as *from a scope below*.
An observation of this scope may absorb an observation of a scope below.
Only the survivor is written, and the scope below reads what happened off
the tree.

### 6. The form that records an observation

One dialog, laid out as two columns over a table.

**The facts, on the left:**
- **Title**, **where it was seen**, **observed by** and **when seen** are
  required. When seen starts at today and is shown. It may not be in the
  future.
- **Impact** keeps its default of minor.
- The scope comes first when View local is on.
- **Every field shows an example** under it, such as
  *e.g. The nightly claims batch runs into office hours*. A refusal
  replaces the example with what is missing.

**The description, on the right:**
- It is optional. It is the markdown body, seeded with the headings it
  has now.
- An **Edit / Preview** switch flips between the source and the rendered
  text, in the same place.

**Two hints under the title, neither of which blocks:**
- **Seen before?** lists up to three observations of the chosen scope
  whose titles share words with this one. Each has *Seen again*, which
  records a sighting on that observation and closes the form without
  recording anything new. The word match is a pure function over the
  titles, the same in every language.
- **A wording hint** appears when the title uses a word that reads as a
  cause, a fix or blame: *because*, *should*, *fix*, *fault* and their
  equivalents. It says to keep the title to what was seen and put the
  why below. The words are a list per language in the module's strings.

**Causes, in a table below:**
- **New cause** opens the cause's own fields in place: title, *why we
  think so*, *it is a root cause* and a strength. They get the same
  examples and the same *already written down?* list over this scope's
  causes.
- **Existing cause** opens a picker over this scope's causes.
- Each row says whether it is new or existing, and can be taken off
  again. Nothing is made until the form is recorded.
- Then the observation, the new causes and the links are **one
  transaction**, and the button says so: *Record observation with 1 new
  cause and 1 link*.
- Changing the scope takes off the links to causes of the old scope,
  and says so.

**The cause and solution forms take the same pattern:**
- the facts on the left;
- an optional body with Edit / Preview on the right;
- an example on every field;
- a table of what they link to, made on submit:
  - a new cause lists what it explains and the deeper cause or root
    cause behind it;
  - a new solution lists the root causes it addresses.

### 7. Actions are buttons

Every action on a reader is a small outlined button:
- an icon from `widgets/icons.tsx`;
- a label of one or two words, such as *Seen again*, *Cause*, *Deeper
  cause*, *Root cause*, *Make root*, *Make cause*, *Verify*, *Solution*;
- a tooltip that says in full what it does and what it will be refused
  for.

The primary actions stay visible at every width the reader has. Below 560
pixels only the occasional ones move into `⋯`: merge, archive and delete.

### 8. The picture

**Filters.** A row under the picture's controls, shown and hidden from a
*Filters* button that counts the filters that are on. Each filter keeps
what matches it and what is linked to that, and hides the rest:

| Filter | What it matches | What it keeps with a match |
|---|---|---|
| **Scopes** | a list with a box per scope, and a text field that narrows the list | — |
| **Observations** | text in observations | the chain behind a match: its causes, their root causes, their solutions |
| **Causes** | text in causes | what a match explains, and what lies behind it |
| **RC** | text in root causes | the same |
| **Search** | text in every record, solutions included | the same |

Filters combine, and a record is drawn when it holds for every one. A
match is outlined, and what came with it is drawn plainly.
- The one filter model serves the register and the solutions tab as well
  (`observations/filter.ts`, pure).
- While any filter is on, a clear button (×, *Clear filters* on hover)
  stands in the controls, and the count reads *12 of 40 shown*.

**Saved filters.** The filters that are on can be saved under a name the
person gives, and recalled from a list.
- They are a person's setting, kept where settings that follow the person
  are kept (ADR-0005), and offered in every scope.
- A saved filter names scopes by path. One whose scope is gone is
  recalled without it.

**Large and small.** *Large* draws every record as a card with its label
and title: an observation with its impact as a stripe and its count. It is
the cause's box today, for every kind. *Small* draws every record as a
circle with the label under it:
- an observation sized by impact;
- a cause hollow;
- a root cause with a double ring;
- a solution as a square.

Dashed means assumed and solid means verified, in both.

**Moving about.**
- *Fit* sizes the picture to the window, and fitting is the start.
- Zoom has buttons, and ⌘ with the scroll wheel.
- A drag on the background pans.

Hovering a record **traces its chain**: everything linked to it, both ways,
stays and the rest dims. Its full title and scope show beside the pointer.
A title cut short on a card is always one hover from whole.

**Layout.** `graph.ts` stays one pure function with no force.
- It lays out a section per scope: this scope's lanes on the right, and
  each scope below in a boundary to the left, in tree order.
- A filter removes records before layout, so what is left closes up rather
  than leaving holes.
- The same records in the same filters land in the same place every time.

### 9. Files written before

A cause gains a field that a build reading format 8 would drop on the way
back: it would read `RC-0004` as `CA-0004` and write it without `root`.
That is the loss the number exists to refuse, so **the folder format turns
to 9**. Since ADR-0031, the folder is the desktop's implementation, and
the turn is that implementation's. A repository elsewhere reads the field
from the record.

Reading a scope written before:
- A cause that a live solution addresses reads as a root cause. Nothing
  else becomes one: a cause that was a root only for want of a deeper
  cause reads as an open end, which is what it was.
- `shared` and its events are read as history and not written.
- A link from a cause above to an observation below, which ADR-0021 §3
  allowed, is kept and drawn. It is reported as a finding,
  `check.causeExplainsObservationBelow`, which names the cause below that
  explains that observation where there is one. The repair is to link
  that cause instead. No new link of this kind can be made.

### 10. At the agent

- **`observation.record`** takes `where` and `by` as required, and `date`
  defaults to today as it does on the page. A call without `where` or `by`
  is refused, and the refusal names the field. It takes a `scope` below
  the one addressed, as every tool does.
- **`observation.update`** loses `shared`. It refuses to blank `title`,
  `where` or `by`, but a record written before without them may stay
  without them until somebody writes them.
- **`observations.list`** loses `fromBelow`. `below: true` answers the
  analysis of the scopes below, each record with its scope's path.
- **`cause.add`** takes `root`. **`cause.update`** takes `root`, for
  *make root cause* and *make cause*, with §3's refusals. **`cause.link`**
  takes the path of a cause below as the thing explained, with §4's
  refusals.
- **`causes.list`**'s `root` filter reads the field.
- **The method text sent on connect** (`agent/method.ts`) says what a root
  cause is now. It says that the agent never makes a root cause on its own
  judgement, as it never verifies one, and that local and global are
  places, not a permission.

## Consequences

* **Changed:**
  * `model/observation.ts`: `root` on a cause, `shared` gone.
  * `observations/observation.ts`: the rules of §3 and §4, their refusal
    keys, and `isRootCause` reading the field.
  * `projects/scopeIndex.ts`: `analysisBelow`, and what a cause below is
    explained by.
  * `projects/checks.ts`: the finding of §9.
  * The folder format (`observationFile.ts`) and `SCOPE_FORMAT_VERSION`,
    8 → 9.
  * `observations/graph.ts`: sections per scope, and two sizes.
  * The page, the readers and the dialogs.
  * `widgets/icons.tsx`, with the icons the buttons carry.
  * The strings, in three languages.
  * The agent's tools and method.
  * `platform/controlNames.ts`, for the filter row, the switch and the two
    sizes.
  * The shipped example's causes, which say their root causes.
  * The manual's chapter, once it is built.
* **New:** `observations/filter.ts` (the filter model), and the word lists
  of §6 per language.
* **A local observation is no longer hidden from the scopes above** by
  default, since nothing is shared any more. Who may read a scope is
  decided where it always was, by the source.
* **A record is edited where it lives, still.** A step on a scope below,
  made from the page above, is that scope's step, and a link from a cause
  above is the scope above's.
* **Open:** saved filters are a person's. A filter a team keeps together
  is not decided. Nor is a picture that can fold one scope's boundary
  into a single box with its counts.
