# Release notes, next version — draft

*What has landed on `main` since 3.6.4 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

**A scope is picked by its path.** Two scopes may have the same name under
different parents, and a list of bare names showed them as one row twice.
Wherever you pick a scope — the **Scope** of a new observation, the records a
merge finds in other scopes, the domains a unit **Serves**, where a new unit
is filed, and the scope a unit is filed in when you pick a unit — each scope
is now said by its path from the organisation down, such as *Platforms ›
Cameras*, and typing part of the path finds it.

**Bright spots: what works, analysed the way a problem is.** An observation
is now a **problem** or a **bright spot** — something that works, such as a
team that never misses a release. *New observation* asks which first, with
problem chosen, and *Edit* changes it later. Ask why it works as you would ask
why something fails: its causes are what make it work, the team says which is
the root cause, and a solution on that root spreads it, with the same
questions and the same experiment before it is proven. A bright spot has its
own chip in the register and is drawn in green in the picture, together with
the chain behind it; the counts over the picture and on the scope's home
count bright spots apart. A new filter shows **problems, bright spots or
both**, on the register, the picture and the Solutions tab. A problem and a
bright spot are never merged, and a bright spot seen again after a solution
was built counts as that solution working. The assistant can record, change
and list bright spots too. In Dutch it is a *lichtpunt*, in German a
*Lichtblick*.

**Reporting lines.** A role in a unit can report somewhere other than up the
way the units are nested — a business unit's technology lead to the head of
technology, say, while the rest of the business unit reports to its own head.
Say it once on the unit type: under each role on the **Operating model** page,
**Reports to** names the role, **Line manager** or **Functional**, and the days
it runs; every unit of the type then reports to the nearest unit above that
has that role, or to the one unit that has it. A unit that differs says so in
its inspector, under **Reporting lines**: **Override…**, **Report by nesting
here** and **Use the type's**. A line manager's line decides who manages the
people in the role — **Who manages it** says *by line* — and a functional one
is shown and decides nothing. **Reporting lines** on the organisation chart's
bar draws them over the boxes. A line that would make a chain of managers
loop back is refused when you write it, and the checks name a loop a plan
makes later, a line that lands nowhere or in more than one place, and one to a
role nobody holds. An agent sets them with `reportingLine.set` and reads them
with `reportingLines.list`.

**Comments on any record.** Every observation, cause, solution and
experiment, every element, decision record and plan now ends in its
**Comments**: say something about a record — a question, a doubt, more
evidence — without changing it. Reply under a comment, edit your own, and
remove one to leave *Comment removed* in its place. A comment is signed by
you, picked once from the people register, and is a step like any other: in
Activity, in the history and the export, and undone with ⌘Z. Deleting a
record takes its comments along; merging observations or causes brings the
absorbed records' comments to the one that stays. The observations register
shows how many comments each has, search finds what they say, and an agent
can read and write them too.

**An observation moves to the scope it belongs in.** When an observation was
written down before its scope existed, the tree was reorganised, or it turns
out to be about another part of the organisation, **Move to scope…** on the
observation opens a screen over the page. Pick the scope by its path; the
screen says the number it will have there, how many comments go with it, and
— before anything is written — every cause link that will be cut, since a
cause explains observations of its own scope only, with the solutions those
links lead to. **Move** takes the observation there with its sightings,
history and comments, as one change over both scopes. Where it was, it stays
as history saying *Moved to OB-0012 in <scope>*, so a link to it still leads
somewhere. ⌘Z does not take a move back: move it back, and it returns under
its old number with the cut links explaining it again. An agent can do the
same with `move.plan` and `observation.move`.
