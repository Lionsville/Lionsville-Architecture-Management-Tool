# ADR-0042 — A topic is a scope that is relevant to other scopes, by dated links

* Status: accepted, 25 October 2026; not yet built (3.8.0)
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
