# ADR-0042 — A topic is a scope that is relevant to other scopes, by dated links

* Status: accepted, 25 October 2026; as built, 25 October 2026 (3.8.0):
  the topic, its links, the catalogue, the homes and the checks (§1, §3–§5,
  §7); the topics place's setting (§2) and the agent's tools (§6) not yet built
* Date: 2026-10-25
* Deciders: Wouter Simons
* Extends: ADR-0012 §1 (every scope is the same document, nested; the label
  is a label), ADR-0039 (a line holds from a day and ends on one, and an
  ended one is kept), ADR-0040 (the agent keeps the tree of scopes), ADR-0041
  (principles, kept where they apply)

## Context and Problem Statement

The tree of scopes says where a piece of work lives: an organisation, its
domains, the landscapes under them. Some subjects do not live in one place.
Security, data, integration, a regulation or a programme of change runs
across the tree: it has its own principles, its own building blocks
(ADR-0043), its own people and decisions, and it matters to some scopes and
not to others.

Today such a subject is a scope somewhere in the tree, and nothing says to
whom it matters:

* a domain cannot see that a theme's principles hold for it;
* the theme cannot list the scopes it concerns;
* when a theme starts or stops mattering to a scope, nothing records when.

## Decision Drivers

* **A topic is a scope**, with everything a scope has. Nothing branches on
  a label (ADR-0012 §1): what makes a scope a topic is that it says where it
  is relevant, not what it is called.
* **One link, written from either end.** The topic says where it matters;
  a scope may say a topic matters to it. Either writer needs rights on the
  scope that keeps the link.
* **Over time.** A link holds from a day and ends on one, as a reporting
  line does (ADR-0039); an ended link is history, not deleted.
* **Its principles hold where it is relevant** (ADR-0041 §1), today.
* **Found.** A catalogue lists the topics, and a scope's home lists the ones
  relevant to it.

## Considered Options

1. **A label, `topic`**, and a list of scopes on it. Something would branch
   on the label, and a scope labelled otherwise could not be relevant.
2. **Tags on scopes**, a word each scope carries. A tag has no principles,
   no blocks and no home of its own.
3. **A scope that says where it is relevant**, by dated links kept in its
   own record, with a place in the tree where new topics are filed. *Chosen.*

## Decision Outcome

Option 3.

### 1. A topic, and its links

A scope is a **topic** when it is filed under the organisation's **topics
place** or says it is relevant somewhere. Its scope record gains
`relevantTo: { path, from?, until? }[]`:

* a link **holds** on a day between `from` and `until`, both included, each
  open where absent;
* **ending** a link sets `until` and keeps it: an ended link is history, as
  an ended reporting line is (ADR-0039);
* **removing** a link takes it out: for a link made by mistake only;
* a link is written **from either end** — the topic's page or the scope's
  home — under the writer's rights on the topic, which keeps it.

A **subtopic** is a scope under a topic. It is relevant wherever its topic
is, today, plus wherever it says so itself.

### 2. The topics place

New topics are filed under the organisation's **topics place**, a setting
(`topics.place`). Its default is a scope *Topics* at the organisation, made on
first use. The label `topic` is a label: the screen may show it, and nothing
reads it.

### 3. The catalogue

The **catalogue** lists the scopes under the topics place, nested, and any
scope anywhere with `relevantTo`. It never branches on the label. Its page,
from a *Topics* card on the organisation's home, has the catalogue on the
left and the picked topic on the right, resizable: its links with their
days (*End…*, *Days…*, *Remove*), its ended links folded, its subtopics,
its principles and its building blocks; *Edit* (name, description, the scope
it is under) and *Remove* — refused while it keeps a principle, a building
block or a subtopic.

### 4. What a link does

* **Principles in force** at a scope include those of every topic relevant
  to it or to a scope above it, today (ADR-0041 §1).
* **Every scope's home** shows *Relevant topics* with *+ Topic…*; the × on a
  topic's chip ends its link today.
* **The tree** shows a labelled ↗ row under each scope a topic is relevant
  to today, opening the topic where it lives. A subtopic whose topic is listed
  there is implied and left out.

### 5. Moves and checks

* A move of either end carries the links (`readdress`): a topic's
  `relevantTo` follows the scope it names, and a moved topic's links go with
  it.
* `check.relevantGone` (fix): a link to a scope the tree no longer holds.

### 6. Commands and the agent

`scope.relate`, `scope.endRelevance`, `scope.setRelevance` and
`scope.unrelate` change a scope record's `relevantTo`, each a step with its
inverse. The agent: `topics.list`, `topic.relate` (`from?`), `topic.end`
(`until`), `topic.unrelate` (a mistake only), `topic.update`,
`topic.remove`, and `topic: true` on `scope.create`, which files the new scope
under the topics place.

### 7. The scope format

`relevantTo` in `scope.json`, part of the turn to **format 15** (ADR-0041
§14). A scope written before relates to nothing.

## Consequences

* Good: a theme that runs across the tree is a scope with a home, and its
  principles reach the scopes it concerns without being copied.
* Good: when a theme started and stopped mattering to a scope is kept.
* Bad: a link kept on the topic is written under the topic's rights. A scope
  that may not write the topic cannot add itself; it asks, which is the
  topic's owners' call.
* Neutral: nothing about a topic is new storage: a scope, and one field on
  its record.

## As built, 25 October 2026: the topic, its links, the catalogue and the homes

**What makes a topic** (`projects/topics.ts`) is said once and read by
every screen: a scope filed under the topics place — the place itself is
not one — or one whose `relevantTo` says anything, and every scope under
one of those. A link holds from its first day to its last, both included.
Where a topic is relevant on a day is its own links that hold then and those
of every topic it is under; the topics in force at a scope are those
relevant to it or to a scope above it.

**One step, not four commands** (§6). A link added, ended, given other days
or removed is the topic's `scope.describe` with `relevantTo` as it is to be,
worked out again over the topic as it stands and written under the topic's
rights (`app/units/writeIn.ts`); the four names of §6 are the agent's, which
land this step. A second link to a scope that a link already holds, or will,
is not added; an ended one is history, and the scope may be linked again.
A link ended before it began never held, and goes instead.

**The × on a home's chip** stops the link from today: its last day is
yesterday, so the chip goes the moment it is pressed, and a link made today
never held and goes. It is offered only on a link the topic says itself —
not one a subtopic has through its topic — and only to a person who may
change the topic; *+ Topic…* offers only the topics they may change. A
topic's own home says it is one and opens it in the catalogue.

**The topics place** is its default so far, `topics` at the organisation,
made as a scope named *Topics* the first time a topic is made. Every rule
in `projects/topics.ts` takes the place as a parameter; the setting that
names another (§2) is not yet built, and is built with the agent's tools.

**The catalogue** is a page over the home it is opened from, by the
*Topics* card on the organisation's home, a chip, a check, or `app.open`
with `page: 'topics'` and the topic's path as `id`. A topic is named by its
path. *Edit* writes its name and description as the settings dialog does
and, where the topic it is under changes, moves it with the tree's own move,
which carries every link that names what moved (§5). *Remove* is refused
while the topic keeps a principle — any but one absorbed by another — a
building block or a subtopic, and otherwise removes that one scope, after
asking. The choices for a link are every scope that is not a topic and not
the place; the organisation is one of them.

**The tree's ↗ rows** open the topic's home, where it lives.

**Principles in force** (§4): a topic's principles are listed on a scope's
principles page under *From <topic> (a topic relevant here)*, apart from those
of the scopes above, and counted on the scope's *Principles* card; a
citation of one reads where the topic is in force on the day
(`principleReadsAt`), so `check.citationGone` does not find it.

**`check.relevantGone`** is a fix, found on the topic for each scope one of
its links names — ended or not — that the tree no longer holds, and opened
on the topic in the catalogue.

**On disk** (§7) `relevantTo` is in `scope.json` beside `links`, read back
where it is a list of links whose days are days, and as nothing otherwise;
the listing carries it, so the homes read every topic without reading a
scope's records.

**A topic's type is *Topic*** (`ScopeKind` `topic`), and so is the topics
place's: a label like every kind (ADR-0012 §1), said where a topic is made
— in the catalogue, by the agent's `scope.create` with `topic`, or as the
place is — and never read to decide what is a topic, which stays the place
and the links. Saying it of a scope that is not a topic yet, in the scope's
settings, files the scope under the place, or under the topic chosen as its
parent, with everything under it: a scope is made a topic by moving it.
The place is not counted among the topics on a home's line.

**Choosing topics on a home.** *+ Topic…* opens a chooser of its own, made
for an organisation with fifty topics or more: found by name or by what a
topic is about, browsed nested as the catalogue nests them, each row saying
where the topic applies today and what it keeps, the topic pointed at read
in full beside the list. Several are added at once, each the topic's own
step; a subtopic is shown as coming with its topic, picked or relevant, and
is not offered again. Where nothing matches, *New topic…* starts one named
as typed and relevant to the scope.
