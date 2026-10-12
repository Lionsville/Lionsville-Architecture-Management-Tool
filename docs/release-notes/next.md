# Release notes, next version — draft

*What has landed on `main` since 3.6.1 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

**Units are made on the organisation chart.** *+ Unit at the top* sits in the
chart's bar, in the outline's header and, on an empty chart, as its main
action; a quiet *+* on each unit's name row — shown on hover, on focus and on
the unit picked — makes one inside it. A small dialog asks the type, offering
only the types that may sit there, the name, the domains it serves where it
may serve one at the top or more than one, and where it is kept, by default
with the unit it sits in. Where no type may sit there, the *+* says why and
leads to the operating model, or to *Start from a library* where there are no
unit types yet. The new unit is picked at once, its roles shown as
**+ vacant**, so assigning people follows on. Typing an actor in its
inspector still makes a unit, as before.

**A business sheet's rail draws the stakeholders, and the units the sheet
uses.** A sheet at the organisation drew every unit filed there among its
stakeholders. The rail now draws the actors without a type as it did, and a
unit only where the sheet uses it — responsible for an area, grouping,
capability or step on the page, or with a lane in its journey — under
*Units on this sheet*, each saying why. *All units*, at the foot of the rail,
draws the rest for the session. A stakeholder typed as a unit while the sheet
is up stays where it was for the session, with a note that it is now on the
organisation chart. A picture of the sheet and `diagram.inspect` read the same
rail.

**Pressing a unit on the chart opens its inspector.** A unit kept in another
scope than the chart's opened the multi-selection panel; it now opens that
scope's chart with the unit picked and its roles, managers and links in the
inspector.

**Deleting a unit takes its people's roles in it with it.** Deleting a unit
used to leave everyone's assignment in it behind, so they still counted as
holding a role in a unit nobody could see: in their load, on the People page
and in who manages whom. Now the assignments go in the same step, ended ones
included, from the board, the sheet, the inspector, a move between scopes and
the agent alike, and one ⌘Z brings back the unit and its people. Before it
goes, the question names who stops being what — *Ada Lovelace stops being
Product owner in Webshop* — and says that ending the unit on a day, by its
lifecycle or a plan, keeps who held what. An assignment a unit deleted before
left behind is a new finding to fix, *An assignment in a unit that is not
there*, whatever its days; on the Checks page it opens the person, and
**Remove the assignment** takes it away. The agent's `element.remove` lists the
assignments that went with a unit.

**Deleting a unit says what goes with it, and suggests ending it first.**
The question leads with *End on a day…*, which ends the unit and keeps its
history, and keeps *Delete* for a unit made by mistake. It says what goes:
the people whose roles end; the units inside — moved up into its parent where
their type may sit there, otherwise into another unit of its type under the
same parent, picked from a list, with *Move them up* (shown as misplaced) and
*Delete them too* offered; the applications that named it as their team,
which then belong to no unit; and what it served and was responsible for,
rows kept in other scopes included. Everything is one change and one ⌘Z. An
actor deleted with others filed under it no longer leaves them under nothing:
they move up into its parent. The agent's `element.remove` on a unit moves its
units inside up where their type may sit there, and otherwise refuses with
`agent.unitsInside` and the choices, taken as `units: 'into:<id>' | 'up' |
'delete'` — an agent never picks a new parent for somebody's units on its own;
its answer says what moved, went and was cleared.
