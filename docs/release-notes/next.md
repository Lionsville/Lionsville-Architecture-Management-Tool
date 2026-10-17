# Release notes, next version — draft

*What has landed on `main` since 3.7.0 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

**A unit moves to its right place in the organisation.** A unit filed in the
wrong place no longer has to be deleted and made again: **Move to…** on its
name row on the organisation chart, beside **Move up** and **Move down** under
the outline, or **Sits under** in its inspector, puts it under any unit in the
organisation — whatever scope keeps it, found by its name or the units it sits
in — or at the top. The units beside it under the same parent can be ticked to
move along, so a whole row moves in one go. The places its type may sit come
first; a place it may not is offered below, and the unit then shows as
misplaced in the checks. Before anything is written the dialog says who
manages the unit from above now and after the move, by nesting or by a
reporting line, and names a plan that moves it later. The unit keeps its
people, its reporting lines, the scopes it serves and its comments, and the
units inside it come along; a move that would put a unit under itself is
refused. It is one step, undone with ⌘Z where only this scope is written. An
agent does the same with `element.update` and `parentId`, the parent found
anywhere in the organisation.
