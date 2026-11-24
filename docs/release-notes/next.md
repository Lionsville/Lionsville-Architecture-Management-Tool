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
- The Find button reads to a screen reader as it reads on screen, off a Mac
  too.

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
