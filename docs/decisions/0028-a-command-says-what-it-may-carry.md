# ADR-0028 — A command says what it may carry

* Status: accepted
* Date: 2026-09-26
* Deciders: Wouter Simons
* Amends: ADR-0002 (commands as the unit of change), its *one reducer applies
  it*: the reducer now holds a command to what the command says about itself
  before it applies it

## Context and Problem Statement

ADR-0002 made a command the unit of change and `apply` the one writer. It
trusted what it was handed, and for as long as every command was built by
this app's own code, one keystroke or one agent call at a time, that was
enough. Since ADR-0022 a command can arrive from another author over a channel,
and the trust turned out to be doing work nobody had written down:

* **A patch was spread over its record, whatever it named.** `patched` copied
  every key it was given, and `project.settings` cast its patch to a patch of
  the whole model — so a settings patch naming `elements` replaced the
  landscape with whatever came with it. One malformed or hostile step, and the
  scope was corrupt for everybody who received it.
* **The vocabulary was written down four times.** The reducer's table, a list
  of each command's fields at whatever door receives commands, a table of
  what each command writes for whoever decides whether two steps touch the
  same thing, and the agent's schemas. Each copy was correct when it was
  written and nothing kept it so.
* **The rule about a stand-in was asked by everybody but the writer.**
  `projects/mayEdit.ts` says what a scope may change about a record another
  scope defines, and the inspector, the sheet and the agent all ask it. A
  command that arrived from elsewhere had been asked by nobody the writer
  could vouch for.

And beside the commands, on the way into the writer rather than through it:
a `model.json` that did not parse was read as an empty model, and the next save
wrote that empty model over it and removed every description filed beside it.

## Decision Drivers

* A command nobody on this machine built must not be able to write what the
  model has no field for.
* One place says what a command is; everything else reads it.
* A command added without saying what it carries does not compile.
* Nothing that works today may stop working: a patch built as a whole row's
  replacement names every key the row holds, including one an older file left
  on it, and undoing a *link* writes a stand-in's fields back.
* A file that did not read is never mistaken for a file that says nothing.

## Considered Options

1. **A schema per command, validated at the door.** A second description of
   every shape, kept beside the types; the door refuses what does not match.
2. **A descriptor beside each entry, read by the writer and by every door.**
3. **Strip unknown keys in `patched`.** Drop what is not the record's own and
   apply the rest.

## Decision Outcome

Option 2.

**A descriptor beside `apply`.** Every entry in `model/commands/` carries, in
the family file where it is applied:

* `carries` — the fields the command must have, as the keys of an object typed
  from the command's own shape: every required field, nothing optional, so a
  field added to a command and not said here fails to compile;
* `patch` — for every command that carries one, the keys it may name, typed
  from the patch's type less `id` (so a field added to an element and not
  listed fails to compile), and the record the patch lands on;
* `writes` — the addresses the command writes, from the command alone:
  `element/<id>/<field>` where a patch names fields, one level into an
  object-valued field, the record where a command is coarse;
* `guard` — where a rule says who may write it: today `element.update`, which
  refuses the owner's detail, a stand-in's two caches and its description
  (`model/standIn.ts`, the list `mayEdit` reads too).

`CommandEntry` requires the first three, and the table is typed over
`Command['type']`, so a command without a descriptor does not compile.

**The writer holds a patch to its keys.** `apply` refuses a patch naming a key
outside the list with `command.notAField`, at every level of a transaction, and
in four languages where a person reads it. A key outside the list is let
through only where it says what the record already says — the id the command
names, or the value held — because that is not a write, and because a whole
row's replacement names every key the row has. `patched` no longer needs the
cast: the keys are the patch's own.

**The guard is asked by the writer that has nobody in front of it.**
`applyGuarded` is `apply` with every descriptor's guard asked first, against
the model as it stands when that command lands. `apply` does not ask it: on one
machine every caller has asked already, and an undo must be able to put back
what was there. A patch that takes a stand-in's `ref` off is judged as the
definition it leaves, which is what undoing a link is.

**Readers read the table.** `writesOf(command)` answers the addresses, or
nothing for a type this build has no entry for, which a caller comparing two
steps reads as *anything at all*; a door checking what arrived reads each
entry's `carries`.

**A `model.json` that does not parse opens to be read and not written.** The
snapshot says so (`ScopeSnapshot.unreadable`); the workspace opens read-only
with a sentence saying which file and what to do; the folder store refuses to
save over it, read from the disk rather than off the snapshot; and a reader of
the whole tree leaves such a scope out rather than counting it as defining
nothing — and a walk of the tree that fails rejects rather than answering an
empty tree.

> **Amended 26 September 2026: a save removes only what a read took in.** The
> rule above was one case of a wider one. A save writes what the snapshot
> holds and removes the format's files it no longer produces, so any file the
> read left out is one the next save removes as *no longer wanted*, with
> nobody having wanted that: a description held open by a sync client, a
> picture whose permission was withdrawn, a view that did not parse. So the
> reader says what it did not take in (`ScopeSnapshot.unread`: a file that was
> there and would not read, or read and said nothing the scope could hold),
> the session carries it into every save, and a save neither removes nor
> writes over any of them — one that would write over one is refused. A file
> that will not read at the moment of saving is treated the same, whoever made
> the snapshot. What the scope cannot be understood without is on
> `unreadable` as well and opens it read-only: `model.json`, without which
> the scope is written as an empty model, and a mark `scope.json` names, which
> the header written without it would drop. A move refuses a scope with anything on
> `unread`, because it removes the old folder. The desktop's main process
> answers a file that is there and will not read as a refusal rather than as
> absence, which is what it had been, and `describeScopeStore` holds every
> filling that keeps a scope in pieces to this.

### Consequences

* Good: one malformed step can no longer replace a list of the model, on
  any machine that runs this reducer.
* Good: the vocabulary is written once. What a door checks, what a channel
  compares and what the writer refuses are the same list, and adding a command
  or a field is a compile error until it is said.
* Good: the stand-in rule is enforced where commands arrive from elsewhere,
  not only where a screen was polite enough to ask.
* Good: *apply, then the inverse, is where you started* is now a property
  test over every kind of command on generated models, not only hand-written
  cases.
* Bad, accepted: a field added to a record is now two edits — the type and
  the list beside the entry. The compiler names the second.
* Bad, accepted: a key an older file left on a row can be restated but not
  changed. Nothing writes one; a hand edit that wants it changed edits the
  file.
* Neutral: a whole-project restore leaves a record that stands in then and now
  as the owner says it is today, rather than writing older copies of the
  owner's fields back.

## Pros and Cons of the Options

### A schema per command, validated at the door

* Good, because a door could refuse a malformed command before anything reads it.
* Bad, because it is a fifth copy of the vocabulary, and the one most likely to
  drift: a schema says what a shape looks like, the type already does.
* Bad, because only the door would be protected; the desktop's own writer
  would still spread whatever it was handed.

### A descriptor beside each entry

* Good, because the list sits under the same key as the code that applies it,
  and the compiler holds both to the type.
* Good, because every reader — the writer, a door, a channel — reads the same
  list.
* Bad, because the patch lists repeat the record types' keys. The mapped type
  makes the repetition exact, not absent.

### Strip unknown keys

* Good, because nothing would be refused.
* Bad, because a command that was not what its author meant would land as
  something else, silently — the inverse of what a refusal is for.
