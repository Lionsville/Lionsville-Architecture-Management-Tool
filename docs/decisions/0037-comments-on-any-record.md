# ADR-0037 — Comments on any record, through one interface

* Status: accepted, 16 October 2026; not yet built (3.7.0)
* Date: 2026-10-16
* Deciders: Wouter Simons
* Extends: ADR-0031 §1 (a record named by its kind and its id: a comment is
  a record, and names the record it is about the same way), ADR-0036 §8 (a
  person named by the register's id, never by a name the history keeps),
  ADR-0029 (every record says what it is to a search), ADR-0028 (a command
  says what it may carry), ADR-0035 (what a merge takes with it), ADR-0011 (an
  agent can do what a person can)

## Context and Problem Statement

A record says what it says: an observation its evidence, a cause its
reasoning, a decision its outcome. There is nowhere to say something *about*
it without changing it. People who read an analysis or review a decision
have a question, a doubt or a pointer to more evidence, and today they have
two places to put it, both wrong:

* **In the record's own text.** The description gains a paragraph that is
  nobody's in particular, with no day, which the next edit can drop without
  anybody noticing, and which a person who may only read cannot write at all.
* **Outside the tool**, in a chat or a mail, where it does not travel with
  the record: not in the export, not in git, not after a merge, and not to
  whoever opens the record next year.

What is needed is one way to comment that works the same on every kind of
record, that a kind takes on with one line rather than a feature of its own,
and that keeps the comment with the record wherever the record goes.

## Decision Drivers

* **One interface.** Observations first, then causes, solutions,
  experiments, elements, decisions and plans: every kind with the same
  thread, the same commands and the same tools, and a kind that is added
  later costs one line.
* **A comment never changes its record.** The record's history stays the
  record's; a remark is not an edit.
* **It travels with the record**: in the export, the working file, git, a
  merge and a move. A comment that stays behind when its record goes is lost
  in all but name.
* **Its author is a person in the register** (ADR-0036 §8), by id, so
  forgetting the person reaches the comment as it reaches everything else.
* **Nothing vanishes silently.** Editing is the author's; removing is the
  author's or an administrator's, and leaves a mark where the comment stood.
* **Who may comment is the source's to say.** A host with accounts may let a
  person who only reads comment; core has no accounts and grants nothing.
* An agent can do what a person can (ADR-0011).

## Considered Options

1. **A list of comments on each record.** Every remark would be an edit of
   the record, in its history and its diff, and every kind would carry its
   own field, codec and screen. Two people commenting at once would be two
   edits of one record.
2. **Comments beside the history, as the register of people is kept**
   (ADR-0036 §8). Cheap to write, but nothing about them would travel: not in
   git, not in the export, not with a merge or a move.
3. **A record of the scope of its own, about another record by its key, in
   the history; a kind takes it on by one line in one registry.** *Chosen.*

## Decision Outcome

Option 3.

### 1. A comment is a record

A comment is a record of the scope that keeps the record it is about:

| Field | What it says |
|---|---|
| `id` | its own id, drawn at random, never derived and never reused |
| `about` | the record it is about, as a `RecordKey` (`model/recordKey.ts`): a kind and an id in this scope |
| `by` | its author, a `PersonRef` that always holds `{ person: id }`, never text |
| `at` | when it was written, an ISO date and time |
| `body` | what it says: text, with the Markdown a description takes |
| `replyTo` | the comment it answers, where it is a reply (§4) |
| `edited` | when its body was last changed, where it was |
| `removed` | `{ at, by }`, where it was removed (§5) |
| `via` | the agent's name, where an agent wrote it for its person (§8) |
| `from` | the record it was written about and that record's scope where another, where a merge or a move brought it here (§6) |

`RecordKind` gains `comment`, so a comment has a history of its own and a
step that touches one says so in the words every other record uses.

### 2. Where it is kept

A scope keeps its comments in `_comments/`, one file per record commented on,
`_comments/<kind>-<id>.json`, holding that record's thread oldest first. A
record nobody has commented on has no file. The underscore is the reason
`_operating/`, `_assignments/` and `_checks/` have one: a scope's name is a
slug and never holds one, so no child scope can collide with the folder.

The model keeps the comments as one list of the scope, beside its other
lists (`ModelOrder`), so the diff, the history, search and every repository
read them as they read any list. The working file and the sealed file carry
them because they carry the scope. A repository that does not keep a folder
keeps them as records of its own kind.

### 3. One interface, opted into by one line

**`model/commentable.ts`** is the registry: one line per record kind that may
be commented on. A comment about a kind that is not in it is refused
(`comment.notCommentable`), and one about a record the scope does not hold is
refused (`comment.unknownRecord`), whoever sends it.

**`src/comments/`** is the module: the pure rules at its root (a thread, its
order, its counts, what travels with a merge and a move) and `ui/CommentThread`,
the one thread every reader mounts, handed the record's key. A kind that opts
in mounts it in its reader and nothing else.

In this release, in this order: **observations, causes, solutions and
experiments** (the analysis readers); then **elements** (and with them units),
**decisions** and **plans**. Views, relations, the operating model and
assignments are not commented on in this release; each is one line and one
mount when it is wanted.

A record with comments says how many where it is listed and on its reader's
heading, and the reader opens the thread.

### 4. A thread, with one level of replies

A thread is the comments about one record, oldest first. A comment may answer
another (`replyTo`); a reply is shown under the comment it answers, and
answering a reply answers the comment that reply is under, so a thread is
never more than one level deep. A `replyTo` that names a reply, or a comment
about another record, is refused (`comment.badReply`).

No mentions and no notifications in this release: a comment is read where it
is written.

### 5. Three commands, and who may

`comment.add`, `comment.update` and `comment.remove`, each with its inverse,
its write key and its descriptor (ADR-0028), so each is a step, in the
Activity list, undone by ⌘Z where the scope is open.

* **Update** changes the body and sets `edited`. Nothing else of a comment
  changes: not `about`, `by`, `at` or `replyTo`.
* **Remove** empties the body and sets `removed`. The comment stays where it
  stood, as a tombstone the thread shows as *Comment removed*, so the replies
  under it keep their place and nobody wonders what they answer.
* A removed comment is not updated or removed again.

**Who may is not the reducer's to say.** The reducer checks the shape: the
record is there, the kind is commentable, the fields that may not change do
not. It knows no accounts, so it never checks that the author is the person
sending the step. Who may comment, and whose comments they may change, is the
source's to say, and its doors decide (hosted's in hosted ADR-0012). The
screens offer what the source says:

* **Edit** on your own comments only.
* **Remove** on your own, and on anybody's where the source says you may
  moderate the scope.
* **Comment** wherever the scope may be written, and where the source says you
  may comment on a scope you otherwise read.

`ProviderParts` gains that answer beside `readOnlyAt`: whether this person
may comment on a scope they may only read, and whether they may remove other
people's comments there. Absent, a person comments wherever they may write,
and may remove any comment there: on the desktop, and in every source without
accounts, whoever keeps the organisation's work is its administrator
(ADR-0036 §10).

**The author is *you***: the person the source says is using the app
(`SourcePeople.me`), or else this install's *This is me* (`people.me`). Where
neither says anybody, the first comment asks once — the register's picker,
with *New person…* and its duplicate check — and keeps the answer as *This is
me*. A comment is never written by a name typed in.

### 6. What travels with it

* **The history.** Every comment is a step of the scope, in its history and
  its Activity list (*Commented on OB-0007*), and a record's history shows the
  steps of its thread beside its own.
* **Export, the working file, git.** The comments are the scope's files.
* **A merge** (ADR-0035). The thread of an absorbed record moves to the
  survivor, written where the survivor lives, as part of the same step on
  every scope the merge writes: each comment keeps its id, author, time, body
  and replies, is about the survivor from then on, and gains `from`, the
  record it was written about. The merge writes that, not `comment.update`,
  which never changes `about`. The thread
  shows those under the record they came from. `merge.plan` and the merge
  screen say how many comments move.
* **A move** of an observation to another scope (ADR-0038). The thread moves
  with it, in the same step, and keeps its `about`, since the observation
  keeps its id.
* **A record deleted** takes its thread with it, in the same step, and undo
  brings both back. A record that is merged or archived rather than deleted
  keeps its thread.
* **A scope moved or renamed** readdresses `from`'s scope as it readdresses a
  link's (`projects/readdress.ts`).
* **A person forgotten** reads as their pseudonym on every comment they
  wrote, because the comment holds the id. A name written in a comment's body
  is text, which the register cannot reach (ADR-0036 §10): search finds it.
  A removed comment's body stays in the history, as any edited text does: the
  tombstone takes it out of the thread, not out of what was recorded.

### 7. Search and the Activity list

A comment is something a search finds (ADR-0029: one line in `searchable`).
A hit names the record it is about and opens that record's reader with the
thread open and the comment marked. The Activity list says each step in
words: commented, edited a comment, removed a comment, with the record's
label.

### 8. The agent

Four tools, generic over every commentable kind:

* `comments.list` — the thread of one record (`about: { kind, id }`), or the
  scope's newest comments where no record is named; removed comments as
  tombstones, each with its author's name or pseudonym as every agent is
  told one (ADR-0036 §13).
* `comment.add` — `about`, `body`, `replyTo`.
* `comment.update` — `id`, `body`.
* `comment.remove` — `id`.

An agent's comment is by the person it acts for, with `via` the client's
name, as its steps are; the thread says so. It edits and removes its person's
comments, and others' only where the source says its person may. The reads of
a commentable record answer how many comments it has. The method an agent is
handed on connect says that a comment is about a record and never changes it:
what the record should say is changed in the record.

### 9. The scope format

**The scope format turns to 13**, one turn for this release with ADR-0038 and
ADR-0039. A build that reads 12 knows nothing of `_comments/` and would show a
scope without its threads and keep none of them current; a scope written at 13
is not opened by it. A scope written before reads as one with no comments.

## Consequences

* Good: one thread, one set of commands and one set of tools for every kind
  that takes it, and the next kind is one line and one mount.
* Good: a remark is never an edit; the record's history stays its own.
* Good: comments travel with export, git, merges and moves, because they are
  records of the scope.
* Good: a forgotten author reads as a pseudonym everywhere at once.
* Bad: a removed comment's text stays in the history. Removing hides it; it
  does not erase it, as no edit of any record does.
* Bad: core cannot check who wrote a comment. On the desktop the author is
  whoever the install says it is; a host with accounts checks it at its doors.
* Neutral: a reply to a reply answers the comment above it, so a long
  exchange reads as one flat thread under its first comment.

## Open

* Mentions and notifications.
* Comments on views, relations, the operating model and assignments.
* A thread marked as resolved.
