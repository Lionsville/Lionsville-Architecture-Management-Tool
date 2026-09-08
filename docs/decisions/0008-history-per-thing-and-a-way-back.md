# ADR-0008 — History per thing, and a way back that is itself history

* Status: accepted
* Date: 2026-09-08
* Deciders: Wouter Simons

**Accepted 8 September 2026, not yet built.** The last section is the
order it is to be built in; the *Open questions* stand with their
recommendations, which the implementer takes unless told otherwise.

## Context and Problem Statement

Layer two of ADR-0003 gave a working directory a history, kept on the git that
is already on the machine. What it offers today is exactly two things:

* **Snapshot**, from the File menu, of the whole folder under a message drafted
  from the Activity log (`projects/commitMessage.ts`).
* **History**, a page that lists the snapshots and says what has happened to
  *the architecture* since the one you choose — a semantic diff
  (`model/diff.ts`), compared with what is on screen now, never the raw lines.

The seam is `ports/ProjectHistory.ts`: is there a history, is this folder
keeping one, start one, take one, list them, and read **one whole project** as
it was at one snapshot. The desktop binds it over `electron/main/git.ts`; a
browser tab has no adapter and is offered nothing. Everything in the seam may
say no and none of it may interrupt a save; that rule is older than this record
and is not reopened here.

What a person cannot do with that history:

1. **Ask about one thing.** The page answers "what changed since Tuesday"; it
   cannot answer "when did this diagram last change, and what did it look like
   then". The folder format was built so that a diagram, a description and a
   decision are each one file precisely so that question would be cheap to
   ask — and nothing asks it.
2. **Go back.** The history is read-only. A person who watched a tidy pass make
   a mess of a diagram can see what the diagram used to be, in a list of
   sentences, and cannot have it back short of a terminal.
3. **Mark a version.** Snapshots are named by what happened in them ("Moved 12
   elements, renamed Billing"). Nobody ever needs that snapshot by that name.
   What they need is "the one we showed the board", and there is no way to say
   so afterwards.

The three are one feature to a user — *history I can use* — and three
decisions to us, because each of them can be done in a way that quietly
destroys the property that makes the history worth having. That property is
the subject of this record: **the history only ever grows, and every entry in
it keeps meaning what it meant.**

### Why that property is fragile here

The history is shared. ADR-0005 added push after a snapshot and pull on open,
with a strip that offers *take theirs* and *keep ours* when the sides disagree,
and it was written to never force-push and never combine a line. Every one of
its guarantees rests on commits not changing once made:

* A **push** succeeds only if the remote's branch is an ancestor of ours. Move
  the branch backwards, or rewrite a commit, and every push from then on is
  *rejected*, and the strip asks the person to choose sides over a
  disagreement they did not make.
* The **history page** hands out commit hashes as opaque entry ids. Rewriting
  a commit changes its hash and every hash above it; an id the page gave out a
  minute ago now names nothing.
* A **colleague's clone** holds the old hashes too, and their next pull is not
  a fast-forward either.

So "restore" cannot mean "put the branch back", and "rename" cannot mean
"reword the commit", however natural both readings are. The design below is
what remains once those two are ruled out — and it turns out to be simpler,
not more constrained.

## Decision Drivers

* **The history only grows.** Stated above. Anything that rewrites or moves a
  commit is out, not because git makes it hard but because sync, the page's
  ids and every other clone were all built on the assumption that it does not
  happen.
* **A change is a command** (ADR-0002). `apply(model, command)` is the only
  writer; the session holds one undo stack; the Activity list is drawn from
  the commands. A restore that wrote files would bypass all three, and would
  arrive at the running app as *changed on disk* — the watcher cannot tell
  our git from a colleague's, and would ask the person to reconcile with
  themselves.
* **What "changed" means is the model's question.** `projectAt` returns a
  whole project rather than a diff for this reason (the seam's own comment
  says so). Per-thing history must not move that decision into the adapter.
* **The seam is not git.** It happens to be git on the desktop. A label on a
  version and a path filter on a listing are things any history can offer; a
  reword, a rebase and a checkout are things only git offers, and naming them
  in the port would bind the port to the one adapter it has.
* **The app does not edit what it does not own.** A tag or a note we write is
  ours; a commit somebody else pushed is not. Same rule as `.gitignore` in
  ADR-0005.
* **A decision record is locked once it ends.** `updateAdr` and `removeAdr`
  refuse an accepted, rejected or superseded record. A restore is a change,
  and a change the model refuses stays refused.

## Considered Options

Three questions, each with the options that were actually weighed.

**Q1 — How is "the history of this diagram" answered?**

* A. Fold `projectAt` over every snapshot and diff each against the next.
* B. A path filter on `entries()`, answered by the adapter (`git log -- path`).
* C. A per-file read on the seam (`fileAt(path, entry)`), with the app
  reconstructing a project around it.

**Q2 — What is a restore?**

* A. Move the branch to the chosen snapshot (`reset --hard`).
* B. Check the chosen files out into the folder and let the watcher report it.
* C. A **command**: the chosen thing, lifted from the project at the snapshot,
  dispatched at the session like any other edit; then an ordinary snapshot.

**Q3 — How does a person name a version afterwards?**

* A. Reword the commit message (`--amend`, or a rebase for older ones).
* B. A **git note** on the commit, shown in place of the subject.
* C. An **annotated tag** on the commit — a label beside the subject, not
  instead of it.
* D. A label kept in `folder.json` keyed by hash.

## Decision Outcome

**Q1: B, with the diff still the model's.** `entries()` grows one optional
argument: the path of a thing, relative to the project. The adapter answers
with the snapshots that touched it. Which path a diagram, an element's
description or a decision lives at is a pure function in `projects/` — the
folder format already knows, it just does not say it out loud. What changed
*within* those snapshots is still `projectAt` and `diffModels`, filtered to
one subject and id, which `ModelChange` already carries.

A is correct and unaffordable: a project read at a snapshot is one `ls-tree`
plus one `show` per file, and a history of two hundred snapshots over a
project of sixty files is twelve thousand process spawns to answer a click.
C is affordable but wrong-shaped: a file on its own is not a diagram (a
diagram is a definition file and a placements file, and a decision's file
name carries its title), and reconstructing a project around one file would be
the app inventing a second reader for the format.

One subtlety the path function has to own: **a decision's file is named after
its number and its title**, so a retitled decision has moved. The filter is
therefore by the number prefix, `decisions/0007-*.md`, not by the current
name — and the same applies to a decision filed under an application. A
diagram and a description are keyed by id and do not move.

**Q2: C. A restore is a command, and going back is going forward.**

Restoring one thing:

1. `projectAt(ref, entry)` — the project as it was, already cached by the page
   for the entry the person has chosen.
2. Lift the diagram, the description or the decision out of it.
3. Dispatch one command that makes the current one equal to it. For a diagram
   that is a `transaction` of `diagram.update`, `placement.set` and
   `route.set`; for a description it is `element.update` with the one field;
   for a decision it is `decision.update`, or `decision.add` if it had been
   removed since.
4. The Activity list gets a line — *Restored diagram "Warehouse" as of 3 Sep* —
   and ⌘Z takes it back, because it was a command.
5. The next snapshot records it, under a message the drafter writes from that
   step. The person may take one at once; the page offers to.

Restoring a whole project is the same with a wider command: a transaction that
brings every element, connection, diagram and decision to what the snapshot
held. It is not a new kind of thing, only a bigger one, and it gets the same
undo step and the same line.

Nothing touches the folder except the save that follows, through the store
that always writes it. Nothing touches git except the snapshot that follows,
through the call that always takes it. **The result is a new commit whose
tree for that project equals the tree at the chosen one** — what a git user
calls a revert — and the history has grown by one entry that says exactly
what happened.

A is what "restore" first sounds like, and it is the one thing this record
exists to refuse; see *Why that property is fragile*. B writes files the app
did not save, and the app has one watcher whose whole job is to notice that.

**Q3: C, tags, and the subject is never edited.**

A person marks a snapshot with a label. The label becomes an annotated tag on
that commit, named from the label's slug, with the label as its message. The
history page shows it beside the drafted subject, and a tagged entry is what a
restore most often points at. Tags travel with sync, so a colleague sees the
same mark in the same place, in this app or in any git client.

A rewrites; refused. B keeps the commit and rewrites nothing, but a note is
kept on a ref no other tool shows and sync does not carry unless we push that
ref by hand — a second subject only this app can read. D is the same
invisibility with a worse home: `folder.json` is shared settings, and a list
of hashes is not a setting. C is the only one of the four where a mark made
here is a mark a colleague's git client already understands.

**The port, after this:** one optional argument on `entries`, one new
`label(entry, name)`, and a `labels` field on `HistoryEntry`. No `restore`
method — a restore is two things the port already does, a read and a
snapshot, with a command in between that is the session's business.

## Consequences

### Good

* **The history keeps every guarantee it has.** No commit is rewritten, no
  branch moves backwards, no push is refused because of anything this record
  adds. `resolve`, `pull` and `push` are untouched, and so are their tests.
* **A restore is an edit.** It is undone by ⌘Z, it appears in the Activity
  list, it dirties the document, it goes through `save` and it reaches git
  through `snapshot`. Nothing about the desktop's file channel, the watcher
  or the browser's folder handle changes. A restore on a tab without a
  history is simply not offered, as History is not offered there today.
* **A label is a real mark.** It survives a clone, it is visible to a
  colleague in a terminal, and it is what `git describe` would call the
  version. The app has added to a shared history in the one currency every
  other tool already reads.
* **The diff stays the model's.** Per-thing history is a filter on the
  listing and a filter on `ModelChange`; `diffModels` learns nothing about
  git and the adapter learns nothing about landscapes.
* **The module map does not grow.** `projects/` gains a path function,
  `model/` gains at most a command name, `app/history/` grows, and one adapter
  answers two more questions of git. No new import edge.

### Bad, and accepted

* **A restore is a new commit, so the timeline reads forwards.** "Restored
  diagram X as of 3 Sep" sits above the mess it undid, and the mess stays.
  That is the point, and it will surprise a person expecting a slider. The
  page's copy has to say what a restore does before the first one is taken.
* **Marks are not restored.** `filesAt` skips images, deliberately, and a
  project read at a snapshot has the marks the working copy has. A restored
  diagram therefore uses today's icons, and a mark deleted since a snapshot
  is not brought back by restoring what used it. Rarely what anybody wanted;
  written down so it is not a bug report.
* **A locked decision cannot be restored** to an earlier body, because
  `decision.update` refuses it, and this record keeps that refusal rather than
  making restore a back door. The page says why. The person's way round is the
  one that already exists: a new record that supersedes.
* **A restored diagram may place elements that no longer exist.** The command
  drops those placements and the line says how many. Restoring the elements
  too is a whole-project restore, offered separately, not something a diagram
  restore does on the quiet.
* **The subject line cannot be corrected.** A typo in a snapshot message stays.
  A label beside it is the remedy, and the only one. The narrow safe case —
  reword the newest snapshot before it has been pushed — is possible and
  left out: a feature that works until the first push is a feature that
  teaches the wrong thing.
* **A tag name is a slug, and slugs collide.** Two labels "Board review" in
  one folder are one tag; the second refuses, and the person picks another
  word. The port answers with a refusal key, not an exception, as everything
  in it does.
* **Restoring one file's worth of history is still one `projectAt`.** The
  page already caches the chosen snapshot, so per-thing browsing costs one
  whole-project read per snapshot looked at, not per thing. Acceptable;
  measured before it ships, under the perf step, on the generated landscape.

### What this does not do

* It does not give the browser a history. A tab over a File System Access
  folder still has no adapter, and this record does not change that.
* It does not add a snapshot or restore tool to the agent (ADR-0007 left
  `snapshot` out on purpose; nothing here reopens it).
* It does not show a line diff, ever. Per-thing history is the same sentences
  the page already speaks, filtered.

## What this takes, in order

Each step is one commit, checked in `npm run check`, and each leaves the app
working without the ones after it.

1. **`projects/historyPath.ts`**: the path, or path pattern, of a diagram, an
   element's description and a decision, from the constants `folderFormat`
   already exports. Pure; pinned against `projectFiles` so the two cannot
   drift.
2. **`git.history(root, limit, path?)`** and the `entries` argument through
   the channel and the adapter. `git.test.ts` gains the case; the memory
   adapter used by the shell tests filters its own list.
3. **The page, filtered**: a subject picker on the history page, and a
   "History…" entry on the diagram menu, the documentation page and the
   decision page that opens it prefiltered. The diff list shows only rows for
   that subject and id.
4. **The restore command**: `model/restore.ts`, a pure function from
   (snapshot model, current model, subject, id) to one `Command` or a refusal
   key; the transaction shapes above; the dropped-placement count. Tested in
   node against the reducer.
5. **Restore on the page**, one thing and whole project, with the copy that
   says what it will do, the Activity line, and the offer to snapshot.
6. **Labels**: `git.label(root, sha, name)`, `label` on the port, `labels` on
   the entry, the tag read back by `history` (`%D` in the format, filtered to
   tags). Push already carries them once `--follow-tags` is added to the one
   push call; `git.test.ts` pins that the label reaches the bare remote.
7. **Perf**: per-thing browsing timed on the generated landscape, under the
   budget file, before the feature is on by default.

## Open questions

* **Whole-project restore: in the first version, or after?** The command is
  the same shape; the risk is only that "restore everything" next to "restore
  this" invites the wrong click. Recommended: ship one-thing restore first,
  and add the project one behind its own confirm.
* **Should a restore snapshot at once, or leave the person to?** Today a save
  and a snapshot are separate acts on purpose. Recommended: offer, do not
  take — one toast with a *Snapshot* action — so a restore that was itself a
  mistake can be undone with ⌘Z before it is recorded.
* **Should labels push with the branch, or only with an explicit push?**
  `--follow-tags` pushes annotated tags reachable from what is pushed, which is
  every label this app makes. Recommended: yes, always; a label nobody else
  can see is the note-on-a-hidden-ref problem by another route.
* **Is a description's history the element's?** A description is a field on
  an element, filed at `docs/<id>.md`. The path filter answers with the
  snapshots that touched the file, and the diff row is the element's with
  `fields: ['description']`. Recommended: present it as the description's,
  since that is where the person is standing when they ask.

## More Information

* ADR-0002 — why a restore can be one command.
* ADR-0003 — the folder format, and why layer two is git.
* ADR-0005 — push, pull and the resolution strip, which this must not disturb.
* `ports/ProjectHistory.ts` — the seam, and its "everything may say no".
* `electron/main/git.ts` — `snapshot`, `history`, `filesAt`, `push`.
* `model/diff.ts` — `ModelChange`, already per subject and id.
