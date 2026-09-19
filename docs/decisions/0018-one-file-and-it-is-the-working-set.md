# ADR-0018 — One file out, and it is the working set

* Status: accepted
* Date: 2026-09-19
* Deciders: Wouter Simons
* Supersedes: ADR-0012 §11 and its Decision Drivers and Consequences — "the
  interchange format is a contract with other tools and does not change";
  ADR-0007's Consequences, where the tool vocabulary is called a published
  surface "like the interchange"
* Amends: ADR-0003, which kept the single file as the export container — it is
  the whole working directory now, not one scope out of it

## Context and Problem Statement

The File menu offered two ways to hand a project over, and both were broken
in the same place.

**Neither could be exported from the organisation.** Both named the file
after the open scope's *path*, and the organisation's path is the empty
string (ADR-0012 §1) — so both wrote a file called `.lvarch` or `.json`: on
macOS a hidden file with no name, which the save panel writes somewhere the
person does not find again. The app said *saved*, because the gateway
resolved, and nothing had been saved that anybody could see. It had been
this way since a scope's address became a path; nobody caught it because the
only exports anybody tested were from a landscape, which has a path.

**The interchange document was a contract nobody had asked to sign.** It was
kept as a published surface — "a contract with other tools and does not
change" — and the tools it was a contract with were never named, here or
anywhere: no exchange with one has ever been set up, and nothing in this
repository reads or writes the format except its own reader and writer. What
it cost was a
second shape for everything the model already said: its own element
vocabulary (`externalSystem`, `inputChannel`, `managementTool` against the
model's six kinds), its own keys rather than ids, its own reader and writer,
`HostExtras` to carry back what it could not represent, and `explicitFields`
to keep a round trip from inventing changes. It carried no business layer, no
platform, no technology, no decisions, no plans, no pictures and no marks —
so every feature since ADR-0009 had to note that the interchange leaves it
out, and the shipped example had to keep its plans and decisions beside the
document in TypeScript because the format had nowhere to put them.

**A working file of one scope is a drawing that points at nothing.** ADR-0012
left subtree export open, and said why: a domain exported alone carries
stand-ins whose definitions are in a scope that did not come with it. The
person who opens it finds a landscape referring to applications that are not
there. That is not a gap in the export, it is what exporting one scope means.

## Decision Drivers

* One way to hand work over, and it carries everything. Two formats where
  one is lossy is a choice nobody can make correctly at the moment they are
  asked to make it.
* A name is a thing every scope has; a path is not.
* The level at which stand-ins resolve is the organisation. Anything below
  it exports a question.
* A format that turns must refuse an older build rather than let it save
  half the tree back.

## Decision Outcome

### 1. The interchange format goes

`fromInterchange.ts`, `toInterchange.ts` and `interchangeNotice.ts` are
deleted, with the File menu's *Export Interchange Document…*, the
`interchange` kind of an `OpenResult`, and the strings for all of it in four
languages. `.lvarch` is the only thing this tool reads or writes.

`HostModel` and `HostExtras` move to `model/hostModel.ts`. They lived in the
interchange reader because the document was where a project came from; they
are simply what a scope holds.

What stays, and why: the six figure names and `FIGURE_MEANS`, because a
format-3 working file on somebody's disk still says them and
`projects/migrate3to4.ts` still has to read it. A fold is not allowed to
forget. The model's field names stay too — `connections`, `iconType` — for
the ordinary reason that a name in a file somebody has on disk does not get
renamed for tidiness.

### 2. The working file is the working set

`workingFileBytes` takes scopes rather than a scope and files each one where
it sits under the first, **relative to the first** — never the address it had
in the tree it came from, the same reason `toWorkingFile` never wrote the
path. A file written from a single scope is byte-for-byte what it was.

*Export Working File…* writes the whole set, whichever scope is open. The
open scope comes from the session and the rest from the store: the store has
what was last written and the session has what is on screen, and exporting is
not saving.

`workingFileName` names the file after the scope at its top — its own name,
slugged. That is the whole of the naming rule, and the end of `.lvarch`.

### 3. Format 6 is format 5 with children

A scope's own folder did not change by one file, so both versions read as
they stand and there is no fold between them: a 5 IS a 6 with nothing under
it. The number turns anyway, and this is the case a version number exists
for — a build that reads 5 and no more, handed a tree, would read the scope
at the top, see nothing it recognised beside it, and save that back over a
working directory, dropping every scope under it in silence. The version in
the root's `scope.json` is the only place such a build can learn to refuse.

### 4. Opening one brings its scopes with it

`openDocumentBytes` answers with the scope at the top and the rest on
`rest` — absent rather than empty, so a caller that can only replace one
scope knows when it would be dropping something. The shell writes them
through the store, shallowest first, and adopts the open one last.

Where there is no store to write into — the web with no folder chosen — such
a file is refused and says why. Opening the top scope and dropping the rest
would be the loss §3 exists to prevent, done deliberately.

## Consequences

* `SCOPE_FORMAT_VERSION` is 6; the shipped example is written at 6.
* `workingFileBytes(scopes)`, `workingFileName(top)`, `OpenResult.rest`,
  `treeScopes`, `joinScopePath`; `workingSet` and `onAdoptScopes` on the
  workspace.
* An export from the organisation is a file called after the organisation
  that holds every scope, opens on another machine, and unzips into the
  working directory it came from.
* Nothing this tool writes can be read by another tool, and nothing another
  tool writes can be opened by it. That is the trade: the format that
  promised otherwise never delivered it, and a `.lvarch` is a zip of text
  files that a person can read without any tool at all.
* Open: whether opening a working set should ask before writing over scopes
  that are already there. Today it writes them, which is what opening a
  working file into a scope has always done — but it does it to scopes the
  person is not looking at, and that is a different thing.
