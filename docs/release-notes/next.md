# Release notes, next version — draft

*What has landed on `main` since 3.7.2 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

**The organisation chart is easier to read.** A chart now opens two levels
deep — the units at the top and the units directly under them — whatever its
size, and from then on keeps your own folds for the session. The outline on
the left leads the chart: picking a unit there, or unfolding it, unfolds it on
the chart with every unit above it, scrolls to it and picks it; folding in the
outline leaves the chart as it is. The outline is as wide as you drag it, by
the pointer or the arrow keys on its seam, and keeps that width with your
other panel widths. A long word in a unit type's name is shortened on the
chart — *Organisational unit* reads *Organi. unit* — with the whole name on
hover and for screen readers.

**A person may report to somebody other than their role does.** Pick a person
on the organisation chart: their inspector now says where they report — by
their role's line, their unit type's, their unit's own, or by nesting — and
who manages them. **Override…** gives them a line of their own, to a role in
any unit, to one holder of it, or to one person anywhere, a line manager's or
a functional one, from a day; it holds for them alone, is marked as an
exception to the model, and **Use the model's** takes it away. Who manages
them, and a managing role's right where a source grants one, follow it.

**A line may point at one person.** A unit's own line can now name one holder
of the role it reports to, as a person's own line can; when that person no
longer holds the role, the line is a finding and the model answers again.

**A role outside a unit's roles is an exception, and says so.** The assign
dialog offers the unit's own roles first and the others under **Another role
(an exception)**. Someone placed in one is allowed and is no finding, but is
marked as an exception wherever they are shown, and their role's own
reporting line now applies to them there.

**Reporting lines in three colours.** For the person picked, the lines they
report along are drawn in the accent colour, the lines of the people
reporting to them in teal, and any exception to the model in magenta, with a
legend over the chart. A unit's own lines are marked *override* in its
inspector, and *by override* says who manages that way.

**The agent keeps to the model.** `assignment.update` corrects an
assignment — its share, acting, days and the person's own lines;
`assignment.add` and `reportingLine.set` take a line to one person;
`assignments.list` and `reportingLines.list` say every line's source,
whether it is an override, and the exception placements. The agent is told
to keep to the model's defaults and to write an exception only when asked,
saying so.

**The scope format is 14.** A person's own lines are kept with the
assignments. A folder saved by this version is refused by 3.7.2 and earlier,
which would drop them; an older folder is brought up when it is opened, with
nothing in it moved.
