# ADR-0050 — Every kind of record is described once

* Status: accepted, 22 November 2026; implemented in part, 22 November 2026
  (4.1.0, not yet released): the model's own tables, *As built* below
* Date: 2026-11-22
* Deciders: Wouter Simons
* Extends: ADR-0028 (a command says what it may carry: the plain three
  commands of a list are built from its descriptor), ADR-0029 (every record
  says what it is to a search: that table is a facet over the same keys),
  ADR-0031 §1 (a record named by its kind and its id: the kinds are read off
  the descriptors), ADR-0037 (which kinds are commented on: named here as a
  table that stays its own)

## Context and Problem Statement

A kind of record is a list on the model: elements, decisions, observations,
assignments, evaluations, nineteen of them, each a key of `ModelOrder`. A kind
is wired in wherever something has a line per list, and there are many such
places. Traced for one plain kind, the evaluations, before this record:

* **the model**: its list and its place in the order, indexed from the file's
  array and written back; its three commands in the vocabulary, their three
  entries, the function that puts its list back on the model; its lines in a
  diff, in a whole restore, in the Activity list; its kind and its list in a
  record key's tables; its line in the search's table and in the map of which
  record each list holds;
* **where work is kept**: its file's codec, its paths in the folder's format
  and in the tables a history is asked by, its place in an index entry;
* **over the tree**: the index's spread, the counts of a copy, the addresses
  a move carries;
* **the agent**: its tools, their builders, what a read answers;
* **references**: what may be referred to in a document, and how.

That is 34 files of this tree that name a plain kind and would name the next
one. The tables in the model, the line a change is said with and the tables a
folder's history is asked by are typed over the model's lists or its kinds,
so each alone fails to compile when a list is added. The folder's format and
its store, an index entry and the folds over the tree are not: a list added
there is remembered by whoever adds it, and one the format does not write is
not kept. And **nothing says them together**. The same three facts — the
list, the word its records go by, how one says its id — are written again in
each, and most of what is written per kind is not a fact about the kind at
all:

* **the same for every plain kind**: the list indexed and written back, the
  function that puts it back, the three entries of add, update and remove
  with their inverses, the list said as commands, the loop in a diff and the
  loop in a restore, the three lines of the Activity list, the kind in a
  record key;
* **the kind's own**: the fields a patch may name and what the one writer
  refuses, a decision's locks, an observation's numbering and history, what a
  record says to a search, a tool's schema, a file's codec.

Fourteen of the nineteen lists are written by the same three commands.

## Decision Drivers

* Today's guarantee stays, and is the same one: a table is typed over the
  model's lists, so a list with no entry does not compile. A layer that gets
  a facet gets the guarantee with it.
* The domain speaks no storage (ADR-0031 §4), without exception: nothing in
  `model/` names a file or a folder, and nothing there names a word of the
  agent's vocabulary.
* No format, no wire and no generation changes; no exported name is removed.
  A table that becomes derived keeps its name and its type.
* What a kind has of its own stays written where it is read. A kind that is
  more than plain says so, and keeps its own lines.
* No loop between files: the descriptor imports the kinds' own files and is
  imported by what reads it.

## Considered Options

1. **One descriptor per list in `model/`, and a typed facet table per layer
   over the same keys.**
2. **One file that holds everything about a kind**, its codec and its tools
   with it. Rejected: the codec names files and folders, which the model may
   not, and the agent's vocabulary is a protocol contract of its own module.
   One file could only be written above every layer, where the model could
   not read it.
3. **Generate the tables** from a schema at build time. Rejected: the tables
   are code a reader follows and the compiler checks today, and a generator
   is a second language to keep true.
4. **Leave it**: each table is small and checked. Rejected for what a new
   kind costs, and because the repetition is where the differences hide: two
   lists restored by two different loops is a fact nobody chose.

## Decision Outcome

Option 1.

### 1. The descriptor

`model/recordKinds.ts` holds `KINDS`, one entry per list, typed as a mapped
type over `keyof ModelOrder`:

| It says | Which is |
|---|---|
| `list` | the list on the model, and the entry's key |
| `kind` | the word one record is named by: in a record key, and as the first word of its commands and of what they write |
| `idOf` | a record's id: its own for every list but the marks |
| `absentWhenEmpty` | whether the file may leave the list out, so that absent comes back absent and emptied means gone |
| `commands` | the plain three, with the word the `add` carries its record under, or `'own'` |
| `restore` | how a whole restore puts the list back: `rows`, `list`, `own` or `none` |
| `step` | the word a step on one is called by in the Activity list, or `'own'` |
| `diff`, `nameOf` | compared record by record and named by what `nameOf` answers, or `'own'` |

A descriptor names no field of a record. A field added to a kind changes its
type and nothing here.

### 2. A facet per layer

What only one layer knows is a table of that layer's, typed over the same
keys, so the guarantee holds in each:

* **the commands**: a family says the keys a patch may name and what the
  writer refuses, and `commands/plain.ts` builds the three entries;
* **the search**: `SEARCHABLE`, a line per list, each a declaration written
  beside the search;
* **where work is kept**: the folder format's files, readers and paths per
  list, in `adapters/folder/format/`;
* **the agent**: which lists are read by a generic list and read, in
  `agent/`;
* **over the tree**: what a move readdresses per list, in `projects/`.

### 3. What is derived

Behind the names they had: a record key's kinds and lists (`RecordKind`,
`RECORD_KINDS`, `RECORD_LISTS`); the subjects of a change and the order a
diff reads them in; the arrays of the file indexed and written back; a list
put back on the model; the plain three commands of a list, a list said as
commands, and the plain lists in a diff, a restore and the Activity list.
To follow: which kinds are commented on and cite, the keys of a change's
line, the format's paths, the index's spread.

### 4. What stays written by hand, on purpose

Each kind's type and its rules; each codec's body; what a record says to a
search; what a move readdresses; the agent's tool schemas; the words in
three languages; the help.

**A rich kind says `'own'`.** An element, a relation and a view are more
than a record added and removed. A decision locks, and a whole restore
leaves a locked one alone. A comment is taken and put, never patched. A
mark's id is worked out and it is never updated. Their descriptors say what
is plain about them — the list, the kind, the id — and the rest stays theirs.

### 5. The order of the build

One fold per commit, each proven by the suites as they stand:

1. the descriptor with `list`, `kind` and `idOf`; a record key's tables;
2. the file's arrays indexed and written back;
3. one function that puts a list back on the model;
4. the plain three built for evaluations, citations and assignments;
5. a list said as commands;
6. a diff for those three;
7. a whole restore for those three;
8. the remaining plain lists: the operating model, principles, causes,
   solutions, experiments;
9. the Activity list's keys;
10. the search's table as a facet;
11. which kinds are commented on, and which cite;
12. the keys of a change's line;
13. the folder format's facet for evaluations, citations, comments,
    assignments and marks;
14. the tables a folder's history is asked by;
15. an index entry, as it is kept and as it is read;
16. the index over the tree, the counts of a copy, the records read over the
    tree;
17. what a move readdresses;
18. what a document may refer to;
19. the agent's generic reads, and only where the tool list that results is
    byte for byte today's;
20. the tables a build composed from this one keeps per list, read through
    this tree's surface.

## Consequences

* A new plain kind is its type, an entry here, its three commands in the
  vocabulary, a family of a few lines, its line in the search's table and
  its words. It has no line in a diff, a restore, the Activity list, a
  record key or the function that puts a list back.
* The tables stay, and stay typed. A reader still imports `RECORD_LISTS` or
  `SEARCHABLE` by the name it had.
* The differences that were hidden in the repetition are written down: which
  lists a restore puts back record by record and which as a whole list, that
  a whole restore leaves the plans as they are.
* The plain three are built by one function with casts inside it. The table
  it fills is typed as before, and the vocabulary is held to the descriptors
  at compile time, so a list said to be plain whose commands are another
  shape does not compile.
* A descriptor is one more thing to read before a family file. It replaces
  a dozen places that said the same.

## As built, 22 November 2026

Folds 1 to 10, in `model/` alone. No format, no wire and no generation
changed; no test's expectation changed. Beside the suites, each fold was
compared with the tree before it over two scopes that hold one of everything
— a record the same in both, one changed, one in each alone, for every list:
the commands of a whole restore each way and where each lands, every entry's
answer and inverse, every refusal, each line of a diff and of the Activity
list, a list said as commands, and what the search is told. The two agree to
the byte.

**What is derived now.**

* `RecordKind`, `RECORD_KINDS` and `RECORD_LISTS` (`recordKey.ts`).
* `fromArrays` and `toArrays` loop over the sixteen lists the file may leave
  out. The three a landscape always has stay written out: a view is indexed
  inside too.
* `withRows(model, list, rows)` is the one function that puts a list back
  (`commands/rows.ts`), where there was one per list.
* `plainFamily(list, rules)` builds the add, update and remove of eleven
  lists (`commands/plain.ts`): unit types, roles, responsibilities,
  operating rules, assignments, principles, citations, evaluations, causes,
  solutions and experiments. A family says its `fields`, what it `refuses`
  — handed the command, and for a patch the record as held — and what an
  add that undoes a removal carries (`putBack`: a citation's `put`).
* `plainCommands(list)` says a list's three commands in its kind's words,
  and `listToCommands(model, list, next)` is the one function behind the
  seven that said a whole list as commands, which keep their names.
* A diff compares fifteen lists by one loop, named by `nameOf`, and reads
  `ChangeSubject` and the order of a list of changes off the descriptors. It
  keeps its own lines for an element, a relation, a view and a mark.
* A whole restore puts eleven lists back by one loop, in the order the model
  keeps them — ten record by record, the evaluations as a whole list — with
  the marks in their place among them.
* The Activity list says nine kinds' added, changed and removed by one
  function, its keys checked against the string table at compile time.
* The search's table and the model a search reads are typed over the
  descriptor's records; the map the search kept of its own is gone.

**Where the build departed from the text, and why.**

* **A restore has two plain shapes, not one.** The assignments and the rest
  were put back record by record, each patched by the fields that differ;
  the evaluations as a whole list, each replaced by its whole row, after the
  threads and the citations. Both are what a step that a source keeps
  already holds, so both stay, and the descriptor says which: `rows` or
  `list`. The citations stay the restore's own: those that go are written
  before the records they are about, the rest after.
* **A whole restore does not put a plan back**, and did not before. The
  descriptor says `none` for the plans, and a test says so. Whether it
  should is a question this record does not answer.
* **The search's lines are not in the descriptor.** A declaration is written
  beside the search, and the table that names them reads the descriptor's
  types; held in the descriptor, the descriptor would import the file that
  reads it. The search's table is the search's facet, as §2 says.
* **The decisions', the plans' and the observations' entries stay written
  out**, though the one writer applies no rule of a decision or a plan and
  one of an observation. They are plain in the vocabulary — `listToCommands`
  and a diff take them — and their entries are left for the fold that takes
  the rest of what those kinds have of their own.
* **A cause changed keeps a line of its own** before the plain three: made a
  root cause, or a cause again, says which.

**What is not built.**

* **Fold 11, which kinds are commented on and which cite.** The order those
  two tables list their kinds in is not the model's — the analysis first for
  comments, a decision first for citations — and it is pinned by two tests
  and read where a refusal names the kinds. Derived over the model's lists
  the order changes; kept, it is a list written by hand, which is the table.
  Left as it is.
* **Folds 12 to 20.** The keys of a change's line were not started once
  fold 11 was not clean. The rest are the facets of §2 beyond the model.

**What holds a new kind, tried with a throwaway list.** Added to
`ModelOrder` alone, it stops the build first at the descriptor. Carried
through the model as a plain kind, the compiler names in turn the commands'
table, the search's table, the three words of its step, the keys of a
change's line and the two tables a folder's history is asked by, and two
suites name the lists they keep of every command. Nothing names the folder's
format, its store, an index entry, a copy's counts or the index over the
tree: with those unwritten every suite passes, and the kind is not written
to a folder. Folds 13 to 16 are what close that.

**What a plain kind touches, counted as the trace above was.** The
evaluations are named in 30 files of this tree where they were named in 34:
`commands/rows.ts`, `activity.ts`, `diff.ts`, `restore.ts` and `recordKey.ts`
no longer name them, and `recordKinds.ts` does. In `model/` that is 10 files
and 49 lines where it was 14 files and 115 lines; outside `model/` nothing
changed, being folds 12 to 20. A new plain kind written today is, in
`model/`: its type; its field on the file's model; its list in `ModelOrder`
and on `Model`; its entry here; its three commands in the vocabulary; its
family; the family in the table; its line in the search's table; and its
words. The shipped source is 547 lines shorter, and the tests 449 longer.
