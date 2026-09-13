# ADR-0011 — An agent can do what a person can, and knows what stuck

* Status: accepted
* Date: 2026-09-08
* Deciders: Wouter Simons

**Built, 8 September 2026**, in the seven commits this record lists at the
end, from one piece of evidence: the report an agent wrote after trying to
bring a real landscape in line with a business-case deck through the tools of
ADR-0007, ADR-0009 and ADR-0010.

**Extended, 13 September 2026**, for the federated model (ADR-0012, step 13):
every tool takes `scope`, a path in the organisation's tree — a read over
another scope is answered from that scope's document, and a change, a picture
or `undo` addressed to a scope that is not open is refused with
`agent.scopeNotOpen`, because a change is one command at the session that
holds the scope. Three reads are about the whole tree: `scopes.list`,
`register.list` and `checks.list`. `element.describe` says who answers for an
id and who else draws it, and a resource URI carries the scope's path.

## Context and Problem Statement

ADR-0007 made an agent a peer of the menu and gave it a vocabulary of
twenty-seven tools. ADR-0009 and ADR-0010 gave the landscape time — dates on
the facts, a plan as a record, a replacement as one gesture — and added four
tools for it. The first real job then handed to an agent was the one those
records were written for: a deck says what the landscape will become, and the
project should say the same.

The agent could edit elements, draw lines, place cards, propose decisions and
start a replacement. It could not finish the job, and its report of what it
had to hand back to a person is the whole of this record's context:

1. **A plan was read-only.** `plans.list` said everything about a plan and
   nothing could change one except `plan.replace`, which creates, and
   `plan.port`, which dates one line. The window, the owner, the milestones,
   the elements it names, the decisions it rests on and the body with the
   business case in it were a person's, in a text editor.
2. **An element's dates were not.** `element.update` took the lifecycle enum
   and not the days behind it, so after every port of a plan had been dated
   the element still retired on the old day and `roadmap.check` said so.
3. **One plan's *port all* overwrote another's.** A line already moved by an
   earlier plan had no twin the later plan could see, so "every interface not
   yet planned" re-dated it.
4. **A line could not be dated**, and cleaning up twenty duplicate twins was
   twenty calls and twenty permission prompts.
5. **A decision could be proposed and moved and never corrected.**
6. **A card's coordinate and its filing disagreed.** `element.add` with a
   group put the card outside the group's box; `placeNextTo` below the last
   card in a side band put it outside the band and said it was in; the only
   moves were relative.
7. **A picture could not be added**, so a description could not show the
   slide the agent had produced.
8. **A call answered ok and was gone by the next.** Whatever took it — the
   window reloaded after a sixty-second hang, a conflict resolved the other
   way — the agent had no way to see what had stuck, to make it stick, or to
   land several changes as one.

Every one of these is a gap between what a person can do on the page and what
the vocabulary offered. None is a new capability of the model: the fields,
the commands and the reducer's refusals all existed. The question was only
whether to close the gap by adding tools one at a time as they were missed,
or to settle the rule that decides it.

## Decision Drivers

* **The tool list is published surface** (ADR-0007). A name chosen now is
  kept, so the shape of the additions matters more than their number.
* **One command, one undo step, one Activity line** is what makes an agent's
  step honest. Whatever is added must keep it.
* **A refusal is a key.** An agent reads a key and decides; a sentence it
  has to parse is a sentence it will parse wrongly.
* **Two writers.** A person is at the keyboard while an agent works. Nothing
  an agent does may undo, overwrite or hide a person's step without the
  person having said so.
* **The fast loop.** Every tool is pure over the reducer and tested in node,
  or it is not a tool.

## Considered Options

### Q1: What is the rule for what an agent may do?

* **A.** Add tools as they are missed.
* **B.** Everything a person can do on a page is a tool, and the page and
  the tool go through the same command.
* **C.** A generic `command` tool that takes the reducer's own vocabulary.

### Q2: How does an agent know what stuck?

* **A.** It does not; it reads the model again.
* **B.** A revision on every mutation, an `ifRevision` guard on every
  mutation, the Activity list as a read, and `project.save` as a write.
* **C.** Transactions with explicit begin and commit.

### Q3: Whose steps may an agent undo?

* **A.** Any: `undo` is ⌘Z.
* **B.** Its own, and only while they are the newest.
* **C.** None; undo is a person's key.

## Decision Outcome

### Q1: B — everything a person can do, through the same command

Option A is how the four ADR-0010 tools arrived and how the gap above was
made: each tool was written for the case in hand and the next case found the
edge. Option C is honest about the shape — the reducer's vocabulary is
complete by construction — but it hands an agent `placement.set` with
coordinates and `transition.update` with a whole record, which is exactly the
level ADR-0007 decided an agent should not work at. A tool says what a
person would say: *put this beside that*, *this retires on this day*, *this
plan rests on that decision*.

So the vocabulary grew by twenty-three tools, each one command, and the rule
that decided each is that a page already offered it. Where the page and the
agent had drifted, the page was fixed too: the plan page's *port all
remaining* now skips a line another plan closed, because `porting.ts` learned
to say `closedOn` and both callers read it.

Two things were deliberately not added. A decision does not take a list of
elements, because a record is about one application at most and that is its
scope. And a domain group is not a field on an element, because it is a fact
about one diagram's drawing; `element.place` sets it there, where it lives.

### Q2: B — a revision, a guard, the log, and a save

The disappearing `plan.replace` was never explained and does not need to be:
what the agent lacked was not the cause but the means. A counter that moves
with every change to the model is enough for an agent to say which state it
decided against, and a refusal keyed `agent.stale` is enough for it to read
again and decide again. The Activity list was already the answer to "what
have I done to this project" for a person; `activity.list` is the same
answer for an agent, with whose each step was. `batch` is the transaction
option C wanted, without a protocol for it: the steps arrive together, each
is built against the model as the steps before it left it, each is applied to
that trial model so the refusal a step would meet at the reducer is met
before the person sees anything, and one transaction lands or none does.

### Q3: B — its own, while they are the newest

⌘Z from a terminal the person is not looking at is what "a peer of the menu"
must not become. `undo` takes back the newest step while it is an agent's
and stops at a person's, saying so; the person's step is theirs, on their
keyboard.

## Consequences

### Good

* **The job can be finished.** Every item in the report has a tool, and the
  tool answers with what the page would show — a plan's answer carries what
  its business-case fence computes, with the same reader and the same
  arithmetic as the page.
* **The vocabulary is one shape.** Ids in, ids out, one undo step per call,
  null clears an optional field, a plan is named by its label as readily as
  by its id, a decision's answer carries the label its scope shows.
* **The model did not change.** No new field on element, connection, plan or
  decision; `closedOn` is derived and `revision` is the session's.
* **Two writers can coexist.** A write guarded with `ifRevision` cannot land
  on a project a person has changed since; an agent's undo cannot reach a
  person's step.

### Bad, and accepted

* **Fifty-four tools.** A client lists them all. The tiers and the naming
  keep the list readable, and the alternative — fewer, wider tools — is the
  `command` option this record declined.
* **The revision guard is optional.** A client that never sends it gets the
  behaviour of before: last writer wins. Making it required would break every
  configured agent, and the guard is there for the client that wants it.
* **A batch is checked twice.** Each step is applied to a trial model and
  then the transaction is applied at the session. A command touches the path
  it names and copies nothing else, so this costs little; the alternative is
  a batch that can half-land.
* **`undo` reads the log's origin, not the step's content.** A coalesced
  step that a person and an agent both wrote to is the person's. That is the
  safe reading, and it is rare: an agent's steps do not coalesce.

## What this took, in order

1. Plans as records an agent may write: `plan.create`, `plan.update`,
   `plan.remove`, `plan.read`, three milestone tools, labels as ids, the
   business case computed in every plan answer.
2. An element's dates, successor, owner, aspects, accent and icon on
   `element.update` and `element.add`; `plan.port` scoped to lines no other
   plan closed; `plan.unport`.
3. A line's window on `connect` and `connection.update`; `connections.list`
   saying which plan dated a line; `connections.update` and
   `connections.remove` in bulk.
4. `decision.update`, `decision.remove`, signers, plans linked on propose,
   labels.
5. `element.place`, `element.draw`, `element.undraw`, `ungroup`; the report's
   band and group rectangles; a card kept in its band and its group.
6. `revision` and `ifRevision`, `activity.list`, `undo`, `project.save`,
   `batch`, `image.upload`, `images.list`, `project.export`, search over plans.
7. This record, the names table, the server's instructions.

## Open questions

* **Should a write that is not guarded warn?** An agent that never sends
  `ifRevision` is the common case today. *Recommended: no; the instructions
  say when to send it, and a warning on every answer is noise.*
* **Should the app's own search index plans?** The agent's `search` covers
  them by applying the one rule for "found" itself; ⌘K does not yet.
  *Recommended: yes, when the search dialog has a row for a plan to open.*
* **Should an agent's save be a snapshot?** `project.save` writes the folder;
  ADR-0008's snapshot is a commit. *Recommended: not yet; a snapshot is a
  person's judgement about a moment, and the File menu is where it is made.*
