# ADR-0052 — A role is described, and a duty says who does the work and where it was read

* Status: accepted, 24 November 2026; implemented in part, 24 November 2026
  (not yet released): the model, the folder format and the search, *As built*
  below; the screens and the agent's tools are not yet built
* Date: 2026-11-24
* Deciders: Wouter Simons
* Extends: ADR-0036 §2 (the operating model), ADR-0047 (the mark, now on a duty
  too), ADR-0022 (the parts a source may say it cannot keep)

## Context and Problem Statement

An organisation that has worked out its roles has a role book: for each role a
purpose, what it does, what it asks of a person, and a matrix of who is
responsible, accountable, consulted and informed. The operating model holds a
purpose of one sentence and one letter per responsibility. So:

* what a role does at length has nowhere to go but the purpose, which every
  list shows on one line;
* a role that is accountable and does the work too, `A/R` in many a matrix,
  must be written as one of the two, and the other is lost;
* a letter taken from a document and a letter somebody guessed look the same,
  and nothing says which page a letter came from.

## Decision Drivers

* One A per responsibility stays what the checks read, unchanged.
* Every matrix already kept reads as it did, and its file is written byte for
  byte as it was.
* A cell stays one thing a person presses and one thing a screen draws.
* What a role book says about grades and pay is not architecture, and is about
  people.

## Considered Options

**A and R in one cell:**

1. **One letter, and a flag beside an A.**
2. **A list of letters per duty.** Rejected: it allows `C/I`, `A/C` and an empty
   list, which mean nothing, every reader of the one letter has to choose, and
   every duty already kept changes shape.
3. **A fifth letter for the two together.** Rejected: everything that asks for
   an A would have to learn it, and one that does not would count a row with an
   A as having none.
4. **Two duties for one responsibility.** Rejected: a cell is found by its
   responsibility, and the first of two would win wherever one is read.

**A role at length:**

1. **A description beside the purpose.**
2. **A longer purpose.** Rejected: the purpose is the sentence a list, a reader
   and a library card show, and a page of markdown in it breaks all three.
3. **A document of its own per role**, as a building block has. Rejected: a role
   is read beside its duties, and its text is part of the same record.
4. **Records for what a role book holds** (activities, competences, job
   families). Rejected, below.

## Decision Outcome

### 1. `Role.description`

Markdown, beside `purpose`. The purpose stays the one-sentence summary. Blank is
absent. A search reads both.

### 2. `Duty.alsoResponsible`

`Duty.raci` stays one letter. `alsoResponsible: true` is said beside an `A` and
means nothing beside another letter, where it is dropped. A cell shows `A/R`.
Whatever asks who is responsible counts it; whatever asks who is accountable
reads the letter, as before.

### 3. `Duty.certainty` and `Duty.source`

`certainty` is ADR-0047's mark and its words: `confirmed`, `assumed`, or absent,
which is nobody having said. It is about the letter in that cell. `source` is
plain text, where the letter was read: a document and a page, an interview. It
is a sentence and not a reference, because what a matrix is taken from is mostly
not kept here.

### 4. What a change of letter does

Another letter keeps the source and takes the mark away, unless the same change
says one: somebody checked the letter that was there, not this one, and the
place it was read is still where to look. The same letter written again keeps
both. Adding or dropping *also responsible* is not another letter. Taking the
letter away takes the whole duty.

### 5. What is kept is settled at the writer

A flag beside a letter other than `A`, a mark that is neither word, a blank
source and a blank description are dropped where a role is added or patched and
where a folder is read, so no caller can leave one behind. An inverse puts back
what was there.

### 6. A library says none of it

A library gives a purpose and letters. Bringing one in makes no description and
says nothing beside a letter, and an item matched to an entry keeps what it
said. *Compare* reads a duty by its letter, and a description or a flag of the
organisation's own is never a difference, as an order never is.

### 7. Folder format 19

The four fields are optional, in `_operating/roles.json`. An 18 reads as a 19
that says none of them, and the pass that brings it up rewrites the headers and
nothing else. A build that reads 18 would drop them on its way back, so it
refuses a 19. A source that keeps less may say so of each
(`UnkeptPart`: `role.description`, `duty.alsoResponsible`, `duty.certainty`,
`duty.source`).

### 8. Job families, levels and pay are not records

A job family, a level, a grade and a pay scale say how people are employed. The
operating model says how work is divided: a unit has roles, a role has duties,
somebody holds a role. Nothing here would read such a record — no check, no
chart, no rule — and it would sit beside people's names. Where a role may be held
by certain job families, that is words in the role's description.

## Consequences

* Good: a role book can be kept whole, read beside the matrix, and searched.
* Good: a matrix says which letters were checked and where each was read.
* Good: one A per responsibility, its check and the owner rules are untouched.
* Bad, accepted: a role's duties are written as one list (ADR-0036 §2), so two
  people who change two cells of one role at once still change one thing, and
  the longer duty makes that list heavier.
* Bad, accepted: a caller that writes a whole list of letters must replace it
  with `dutiesReplaced`, or it takes the marks and sources with it.

## As built, 24 November 2026: the model and the format

The fields and their reading are in `model/operatingModel.ts`: `raciSaid`,
`isResponsible`, `responsibleFor`, `dutyOf`, `dutiesWith` (which takes what is
said beside the letter), `dutiesReplaced`, `settledDuty` and `settledRole`. A
family built by `plainFamily` may say how what it is given settles (`settles`),
and the roles do. The format's codec is `operatingFile.ts`; the working file and
every other serialisation read the same files. No entry of `KINDS` changed, as
ADR-0050 says of a field added. The count of a role's letters and the CSV
export read `A/R`.
