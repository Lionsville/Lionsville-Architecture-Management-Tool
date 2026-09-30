# ADR-0032 — Local and global analysis, and a root cause that is said

* Status: accepted, 30 September 2026; as built, 30 September 2026, on a branch awaiting release
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

## As built, 30 September 2026, on a branch awaiting release

Every section was built, in core, on one branch that has not been released.
What follows is what was built, and where the build departed from the text
above and why. The branch was then carried onto the repositories of
ADR-0031 (release 3.3.0), where storage is an implementation of its own and
every write is a step; §2, §4 and §9 say what that changed. The hosted server's part — the scopes a person may read, and
a step below sent to that scope's channel — is not in this repository.

### §1 Local and global

As decided. `Observation.shared`, `setShared`, the tick-box and the reader's
button went; a file or a history that carries them is read and not written.
`scopeIndex.analysisBelow(path)` replaced `observationsBelow` and is read by
the page, the organisation's card, the tree's findings and the agent.

### §2 The page reads the scopes below

As decided, with these departures:
- **A change below is a step on that scope, through the source's
  repositories.** The page hands a change to a scope below to
  `useChangeBelow`, which turns the four lists into commands the way the
  page's whole-lists path does (`model/commands.ts`) and applies them as one
  step on that scope with `projects/scopeAccess.changeScope` (ADR-0031):
  expecting what was read, and worked out again over a scope somebody changed
  in between. So it is refused below as it would be there, with the writer's
  key, it is not on the page's undo stack, and it is in that scope's history,
  as every step applied to it is.
- **Its Activity list shows it where the source keeps a log of every step**
  (`SourceRecentActivity`). For the three sources that ship, a scope's
  Activity list is the open session's own steps, and no session holds the
  scope below, so it is not there, and nothing but another change takes it
  back; the text above assumed a session there. The note after it says it is
  a step of that scope, that undo on this page does not reach it, and to
  change it back to take it back.
- **A solution and an experiment of a scope below are read, not changed.**
  Their gates read the plans and decisions of their own scope, which the page
  above does not read, so a reader of one below draws no gate and offers
  only the way to its scope. The right-click on one offers the same.
- **The register lists more than the observations below.** With View local
  on, the causes, the solutions and the experiments of each scope below are
  listed after this scope's, under a heading each, and an observation below
  is said to be analysed by its own scope's causes.
- **The counts over the picture are the picture's**: what it draws of the
  scopes in view, less what the filters hid (`graph.pictureCounts`). Off,
  the toolbar says how many local records are hidden.
- **The new observation offers the scopes below only while View local is
  on.** Off, the page shows one scope, and a record made from it is made
  there.

### §3 A root cause is said

As decided. `Cause.root`, `RC-` on the cause's own number, and the two
steps with their refusal keys, `command.rootExplained` and
`command.rootAddressed`. Where the guards sit departed from the text:
- **Make root cause and make cause are refused in `apply`**, not in a guard
  (`model/commands/analysis.ts`): the rule is the one writer's whoever sent
  the step, and no step written before a cause could be a root names `root`,
  so a replayed log arrives where it did. What the reducer sees is one
  scope, so a cause *above* that explains the one being made a root is
  refused by the rules (`makeRootCause` with the causes above), the page and
  the agent, which read the tree; the reducer does not.
- **A link into a root cause is refused by the rules, the page and the agent
  only** (`linkRefusal`'s `root`), not by the reducer. A link is a patch of
  the explaining cause's `explains`, and the cause it names may live in
  another scope the reducer never sees.
- The Activity list says *made a root cause* and *made a cause again*. The
  page asks before either step and names the records in the way where it is
  refused. The shipped example says its three root causes.

### §4 A cause above explains a cause below

As decided. The link lives on the explaining cause with the scope's path,
and `scopeIndex.explainedFromAbove` tells the scope below. Refused: upward,
sideways, an observation below, and into a root cause. The agent names the
cause below by **`explainsScope`**, on `cause.link` and `cause.unlink`, and
not by `scope`: every tool's `scope` is the scope a call works in, so the
same word could not also name the record. A copy of the shipped example
carries the path to wherever the landscape lands, as it carries a stand-in's
`ref`.

**A move carries the links.** A scope moved in the tree carries a cause
link's path into it, and an `absorbed` event's, as it carries a stand-in's
`ref` (`projects/scopeAccess.moveScope`, `projects/readdress.ts`): every scope
the index says names an address in the moved subtree gets, once the move has
landed, one step patching those links and events, outside the subtree first,
each worked out from what the scope holds and expecting what was read. A move
that is refused carries nothing.

### §5 Merging from below

As decided.

### §6 The form

As decided, with the causes made in the form and the observation, the new
causes and the links one transaction. *Seen before?* lists up to three
(`wording.similarTitles`). The top bar's *New cause* went: a cause starts
from what it explains, and the form's *New cause* is where one is written.
The link dialog behind *Cause*, *Deeper cause*, *Root cause*, *Org cause* and
*Local cause* has a **New** tab — the cause's own fields, *it is a root
cause*, and the cause behind it — and an **Existing** tab offering only what
`linkRefusal` allows. The title takes the focus once the dialog has opened:
the page is a dialog too, and its focus trap took back a focus claimed as
the form mounted.

### §7 Actions are buttons

As decided. The labels are *Seen again*, *Cause*, *Edit*, *Merge*,
*Archive*, *Delete* on an observation; *Deeper cause*, *Root cause*, *Make
root*, *Verify* on a cause; *Solution* and *Make cause* on a root cause;
*Org cause* and *Local cause* across a boundary. Below 560 pixels a
solution's *Drop* moves into `⋯` with merge, archive and delete. The tooltip
describes the button rather than naming it and opens on keyboard focus.
The page's own buttons are in sentence case, the top bar's included; the tab
toggle keeps the theme's, and so does the shared dialog that confirms a
delete.

### §8 The picture

As decided, with these departures:
- **The picture draws the live solutions in a last lane** of each section,
  after the root causes. The text above placed solutions in the filters and
  in the two sizes without saying where they stand; a root cause without the
  solution that addresses it is half the answer to *what is being done*.
- **The register's own search went.** The filter row serves the register,
  the analysis and the solutions tab alike, so a second search over the
  register alone would have been a second rule for *found*.
- **A saved filter is replaced by name.** Saving under a name already in the
  list replaces that one where it stands, rather than keeping two of one
  name.
- The *Observations* filter reads **Obs** in its box, and the root-cause
  filter **RC** in every language, as the label on the card does.
- **Fit** fits both ways where that reads, and the height only where fitting
  both ways would go below 75 %, never below 40 %; it holds until the person
  zooms. A lane with nothing in it is only as wide as its heading, so this
  scope's four headings stand in view together.
- **Trace** follows the focus as well as the pointer, and Enter or Space
  selects. A cause whose link leads out of the picture — explained from a
  scope above that is not drawn, or explaining a scope below while View
  local is off — says so on its card.

### §9 Files written before

As decided, `check.causeExplainsObservationBelow` names the cause below to
link instead. What older data meant is said once, in the domain
(`observations/rootsFromSolutions.ts`): a cause a live solution addresses
reads as a root cause and nothing else does, and `shared` is dropped while
its events stay as history. Since ADR-0031 each place work is kept is an
implementation of its own, so there are three turns, each reading its own
older data through that one function:
- **The folder's format turns to 9** (`adapters/folder/format/scopeHeader.ts`,
  the observation file codec): a folder written at 8 or before reads its roots
  through the function, and a root cause is written with `root: true`.
- **Browser storage and memory keep a content format of their own**, and it
  turns from 1 to 2 (`adapters/repositories/kept.ts`): a content kept at 1 is
  read through the function and written at 2 by the next write, and one at 3
  or more is a later build's, read in part and never stepped on. The scopes
  this browser's earlier storage kept arrive through it too, and are still
  known by what was kept there, so a copy saved again as it was asks nothing.
- **A source elsewhere** applies the same function to whatever it kept before
  a root cause was said, by whatever tells it the data is older.

Their indexes carry a scope's whole analysis for the scopes above it — the
folder's and the keyed store's alike — and the index contract holds every
implementation to it (`ports/OrganisationIndex.contract.ts`).

### §10 At the agent

As decided, with one narrowing: **`observations.list` with `below: true`
answers the observations of the scopes below**, each with its scope and
explained by its own causes, rather than their whole analysis. The causes of
a scope below are read with `causes.list` addressed to that scope, as every
tool reads another scope.

### The example

The organisation has a global analysis of its own: one observation, and a
root cause that explains it and the landscape's *Two systems compute a
price*, so View local on the organisation draws a line across the boundary.
