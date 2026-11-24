# Release notes, next version — draft

*What has landed on `main` since 4.0.0 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

## Building blocks

- **A ball is picked before it is filled.** In the requirements and in a
  comparison the first press picks a ball and changes nothing; a press on the
  ball picked fills it a quarter more, with Shift a quarter less. A press
  beside the grid, or Escape, lets go of it. The ⋯ on the cell picked is gone
  for a mouse, where it covered what the cell says: the levels by name and
  *Note…* are a right press or Enter. On a touch screen the ⋯ stays.
- **A capability has a text of its own.** Its name opens a panel beside the
  grid: what is written about it, the aspect it delivers, how much each use
  needs it and, in a comparison, how far each option covers it, with the
  note. ✎ Edit there, or *Edit…* under ⋯ on its row, writes its words, its
  must, its aspect and its text in a full window, with pictures and
  references. The text is a chapter of the block's document, under the
  capability's words.
- **The comparisons are read where the block is.** Each scope's comparison is
  drawn under the block's text in its preview and on *About*, with *Open the
  comparison*, and the head of both has a button to it.
- **A building block moves to another topic or scope.** *Move to…* under ⋯ on
  its page and its preview: its document, pictures, the principles it cites
  and its comments go with it, and every comparison keeps pointing at it.
- **A cell is said in words right under its row.** Pointing at a ball, or at
  a name the row cuts short, shows the whole of it at once directly below
  that row — the level, the note, the shortfall — where it used to stand
  under the grid, out of sight in a block of many capabilities.
- The Find button reads to a screen reader as it reads on screen, off a Mac
  too.

## Operating model

- **A role has a description**, in markdown, beside its purpose: what it does
  and what it asks of a person, at length. Searching finds its words.
- **A responsibility's letter says more.** A role that is accountable and does
  the work too is `A/R` in one cell, and counts wherever the responsible are
  counted; the CSV export says it. A letter may be marked confirmed or assumed,
  and may say where it was read. Another letter keeps where it was read and
  takes the mark away (ADR-0052).
- **The folder format is 19.** Every older folder and working file opens as it
  did. An older app refuses one written by this version rather than drop what it
  does not know.

## Observations

- **A new solution's title is no longer emptied while it is typed.** The
  *New solution* form started afresh whenever its causes were read again,
  which on a server is whenever anybody's change arrives; *Propose* then said
  the title was missing.

## For a build composed from this one

- **A source may say what it cannot keep yet.** `ProviderParts.cannotKeep`
  (`SourceCannotKeep`, `UnkeptPart`, on `composed/process/provider`): asked
  about a part of a record, a provider answers the key of its own sentence, or
  nothing. Where it answers, the field that would have offered the part says
  the sentence instead — today the *About* field of an observation — and an
  agent that names the part is refused `agent.notKeptHere`, a new refusal. The
  three sources that ship say nothing, and nothing changes for them
  (ADR-0022, amended 22 November 2026).
- On the surface, `ProviderParts`, `SessionView` and `AgentRefusal` each
  gained what the line above names; nothing was renamed or removed.
- `UnkeptPart` also names `role.description`, `duty.alsoResponsible`,
  `duty.certainty` and `duty.source`, and `SourceCannotKeep` and `SessionView`
  with it. `Role` and `Duty` gained those fields, each optional, and
  `SCOPE_FORMAT_VERSION` is 19.
