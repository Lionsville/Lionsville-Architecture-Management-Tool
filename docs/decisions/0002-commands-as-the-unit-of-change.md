# ADR-0002 — Commands as the unit of change

* Status: accepted
* Date: 2026-09-06
* Deciders: Wouter Simons

## Context and Problem Statement

Every mutation of a project takes one of two roads, and they do not meet.

The editor keeps an **overlay** of everything the session has touched
(`model/overlay.ts`), merges it over the model it was handed
(`model/merge.ts`), reconciles it once the shell has minted permanent ids
(`model/reconcile.ts`), and keeps its own undo stack. What it emits is a
`DiagramContentBatch` — element and connection upserts, deletes, the **full**
placement set of one diagram, route upserts, an optional layout config. The
comment on it says it mirrors `PUT diagrams/{id}/content`. That backend is not
in this repository and never was.

The shell keeps the other half. `useModelSession` buffers batches for 250 ms,
turns temp ids into permanent keys (`rekeyBatch`), applies them (`applyBatch`),
hands the aliases back so the editor can rewrite its overlay, and decides
whether the editor has to remount. Seven shell-level mutations — diagram
rename, diagram settings, duplicate, delete, new diagram, project settings,
decisions — bypass the editor entirely and call `session.commit` with a whole
new model.

The consequences are not subtle:

* **Undo is partial.** ⌘Z undoes a node move. It does not undo a diagram
  rename, a decision's status change or a project setting, because the editor's
  stack never hears about them. `historyResetToken` exists to empty that stack
  when the shell swaps the document out from under it.
* **Undo is expensive.** `HISTORY_CAP = 50` full-model snapshots, each pushed
  by merging the overlay over the model — Maps over every element, connection,
  placement and route of every diagram. A new alias remaps every entry of both
  stacks.
* **A commit per keystroke.** The element inspector and the markdown field
  commit on every character, and each commit runs three to four full-model
  merges.
* **Every operation touches every diagram**, because a batch names one diagram
  and the merge has to reconcile the rest.
* **Ids are invented twice.** The editor mints `tmp-…`, the shell mints the
  real key on the first flush, and the alias map that connects them leaks into
  the editor's props, its overlay and both undo stacks.

None of this is a bug to be found. It is the shape of a change: a REST payload
for one diagram, applied by one side and reconciled by the other.

## Decision Drivers

* **One undo stack, covering everything a user can do.** This is the
  user-visible reason and the only one that needs no explanation.
* **One brain.** Two mechanisms that must agree is the reason for the alias
  map, the reconcile pass, the reset token and the remount key.
* **Cost proportional to the change**, not to the model. A keystroke should not
  walk every diagram.
* **A history that means something.** A log of named commands is what makes an
  activity list, an audit trail, a semantic diff and (ADR-0003) a git commit
  message with real content fall out of one mechanism instead of four.
* **Ids that exist when the thing exists.** No temp ids means no aliasing, no
  reconciliation, and no window in which a saved file could name something that
  is about to be renamed.

## Considered Options

* Keep the batch, add a second undo stack in the shell
* Event sourcing: the log is the document
* Commands in, a reducer, snapshots out

## Decision Outcome

Chosen option: **commands in, a reducer, snapshots out**.

Every mutation of a project is a `Command`. One reducer applies it to one
normalised model and returns the command that undoes it:

```ts
apply(model, command): { model: Model; inverse: Command }
```

Undo is `apply(model, inverse)`; redo re-applies the original. The session owns
the model, the undo stack and the command log. The editor is a view: it
dispatches commands and holds nothing but ephemeral state — selection,
viewport, panel state, drag previews, the tidy spinner.

The model becomes normalised — records by id, with the order the file carried
kept explicitly — so a command touches the path it names and nothing else, and
an untouched diagram keeps its object identity.

This is deliberately **not** event sourcing. The snapshot is the document and
the log is the history. Opening a file never replays a log, so a command's
meaning is free to change between versions of this tool without breaking
anything anybody has saved.

### Consequences

* Good, because ⌘Z undoes everything: a node move, a diagram rename, a
  decision's status change, a project setting, in one stack in one order.
* Good, because `DiagramContentBatch`, `overlay.ts`, `merge.ts`,
  `reconcile.ts`, `diffToOverlay.ts`, `batch.ts`, `rekeyBatch`, `applyBatch`,
  `needsRemount`, `historyResetToken`, `editorKey`, `idAliases`, `createTempId`
  and `isTempId` all go. Several thousand lines.
* Good, because the editor's props fall from 32 to about a dozen, and what is
  left is the model, `dispatch`, `undo`, `redo` and genuinely ephemeral inputs.
* Good, because validation — the kind-change rules, "cannot delete an
  application with components", the over-cap refusals — lives in the reducer,
  so every caller gets the same answer with the same `ShellError` key.
* Good, because an inverse computed from the state the reducer saw is cheap and
  exact, where a snapshot is expensive and a diff is a guess.
* Bad, because it is the largest single change this tool has had, and the
  editor's tests assert on overlay internals. Rewriting them as reducer tests
  is half the work, and is budgeted as such rather than treated as collateral.
* Bad, because there is a middle of the phase in which both mechanisms coexist
  and performance may be worse than either. Accepted, and measured only at the
  end.
* Neutral: the on-disk format does not change. The working file stays at
  version 2 — arrays, `customerName` and all — with `toArrays`/`fromArrays` at
  the file boundary, pinned by a byte-for-byte round-trip test. Persisting the
  command log is ADR-0003's business.

### Confirmation

* `grep -rn "DiagramContentBatch\|idAliases\|historyResetToken\|isTempId\|createTempId" src`
  returns nothing.
* A test walks a mixed sequence of twenty commands, undoes all of them, redoes
  all of them, and compares snapshots at each step.
* Property tests: for every command type over generated models,
  `apply(apply(m, c).model, inverse)` deep-equals `m`; untouched diagrams keep
  object identity; refusals carry keys.
* The working file written for the shipped example is byte-identical before and
  after the phase.
* The editor's prop count is at most a dozen, listed in `editor/index.ts`.
* `npm run verify` is green, and the smoke run's routing and export checks pass
  unchanged.

## Pros and Cons of the Options

### Keep the batch, add a second undo stack in the shell

* Good, because it is the smallest change and the editor is untouched.
* Bad, because two stacks have to be kept in one order, which is the same
  problem as two brains with an extra sequencer bolted on.
* Bad, because it keeps the alias map, the reconcile pass, the reset token and
  the remount key — everything that exists to make the two halves agree.
* Bad, because the cost per keystroke is unchanged: the snapshot is still a
  full-model merge.

### Event sourcing: the log is the document

* Good, because the history is complete by construction and a document is
  reproducible from nothing.
* Bad, because every command becomes a format with a compatibility promise. A
  tool still finding its shape would be pinned by the meaning of every command
  it has ever emitted.
* Bad, because opening a document turns into a replay across versions, which is
  slow, and which fails in a way the user cannot act on.
* Bad, because the file stops being readable as data. A working file you can
  open in an editor and understand is worth keeping.

### Commands in, a reducer, snapshots out

* Good, because it gives the whole-app undo, the log and the cheap change
  without promising anything about a command's meaning after the session ends.
* Good, because the reducer is pure and testable in node, ahead of any UI move.
* Bad, because the migration is long and has a middle. Mitigated by an
  incremental path where the session speaks commands while the editor still
  speaks batches, so undo becomes whole-app before the editor is touched.

## More Information

**Coalescing.** A command may carry a coalesce key. A run of keystrokes into
one field collapses into one undo step, and the live-routing follow-up lands in
the same step as the drag that caused it — which is what the editor's "amend
the last history entry" hack does today, made explicit and given a name.

**Transactions.** `{ type: 'transaction', label, commands }` is one undo step
made of several commands. Its inverse is the inverses in reverse order. This is
how a paste, a kind change or a delete-with-dependants stays one ⌘Z.

**Ids.** The session owns an `IdPolicy`: `next('element', name)` returns the
slug the file would have had, synchronously, against the model's taken set.
Connections keep their `c#N-…` shape. The editor asks for the id when it
creates the thing, and the command carries it.

**Scope of this ADR.** The model shape, the command vocabulary, the reducer and
the id policy. It does not change the file format (ADR-0003), and it does not
promise the performance work that the new shape makes possible but does not by
itself deliver — the router cap, the virtualised canvas and the layout worker
budget are a later phase.
