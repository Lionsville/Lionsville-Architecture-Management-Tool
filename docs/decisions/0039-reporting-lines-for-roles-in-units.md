# ADR-0039 — Reporting lines for roles in units: solid or dotted, said on the unit type, overridden on a unit

* Status: accepted, 16 October 2026; as built, 16 October 2026 (3.7.0);
  implemented, 16 October 2026 (3.7.0, not yet released); amended,
  17 October 2026 — a line is said on the role as well, a line may land in
  the same unit, and the screens draw them (as built the same day, below);
  amended, 17 October 2026 — a person's own line, a role held outside the
  slots, overrides drawn apart, and a line to one person (as built the same
  day, 3.7.3, below)
* Date: 2026-10-16
* Deciders: Wouter Simons
* Supersedes: ADR-0036 §12, in part — who manages a unit's people is no
  longer only whoever holds a managing role in it or in a unit above it: for
  the holders of a role a solid reporting line is drawn from, the line says
  who manages them, in place of the nesting
* Extends: ADR-0036 §2 (a unit type's role slots), §3 (what a unit carries),
  §6 (change over time), §7 (the organisation chart) and §13 (the agent);
  ADR-0027 (looking at another day is not an edit)

## Context and Problem Statement

ADR-0036 §12 works out who manages a unit's people from the tree: whoever
holds a role marked `manages` in the unit, or in a unit above it. Nesting is
the whole answer, and in many organisations it is the wrong one for some
roles.

A business unit has a technology lead. The lead works in the business unit,
for it, and is listed there on the chart; but the lead reports to the head of
technology in the technology unit, not to the business unit's own head. The
model can say only one of the two:

* filed in the business unit, the lead is managed by the business unit's
  head, which is not true — and where a host grants a right from a managing
  role (ADR-0036 §12), the wrong person may change the lead's assignment;
* filed in the technology unit, the lead is managed by the right person, but
  is no longer where they work, and the business unit's chart has a hole.

There is also the line that is not a line manager's: an architect in a team
who answers to the chief architect on how the work is done, and to the team's
manager for everything else. The chart has no way to show it.

## Decision Drivers

* **Said once, where it is true for every unit of a type**, and said again
  only for the unit that differs.
* **Dated**, as everything in the organisation is (ADR-0036 §6): a line starts
  and ends on a day, and the chart on another day shows that day's lines.
* **A line manager's line and a functional line are different things.** The
  first decides who manages; the second is shown and decides nothing.
* **Who manages says why**: by nesting, or by a line.
* **A loop is refused when it is written**, and one that time makes — a unit
  moved by a plan, a line that starts later — is a finding, never an answer
  that does not end.
* **The right follows the line manager.** A host's right from a managing role
  follows a solid line and no other.
* An agent can do what a person can (ADR-0011).

## Considered Options

1. **On each assignment**: the person's manager named per assignment. Precise,
   but said once per person, lost when somebody is reassigned, and silent
   about a vacancy.
2. **On the role, for the whole organisation**: a role reports to a role.
   One rule for every unit, where a lead in one kind of unit reports
   elsewhere than the same role in another.
3. **On a unit type's slot, overridden on a unit.** *Chosen.*
4. **A unit with two parents.** Changes the tree that serving, the findings,
   the Conway map and every fold read, to say something about a few roles.

## Decision Outcome

Option 3.

### 1. A reporting line

A reporting line runs **from the holders of one role in one unit to the
holders of one role in another unit**, and is one of two kinds:

* **`solid`**, a line manager's: the holders of the target role manage the
  holders of the source role, in place of whoever nesting says (§4).
* **`dotted`**, functional: shown on the chart and answered by the reads,
  with no right and no effect on who manages.

A line has `from` and `until`, as a unit, a role and an assignment do, and
runs on the days between.

### 2. Said on the unit type's slot

A role slot gains **`reportsTo: { role, kind, from?, until? }`**: every unit
of the type has a line from that role's holders to the holders of `role`. A
slot says one line; a role that reports two ways says the second on the
units (§3).

**Where it lands**, for one unit on one day, under the parents that day
gives it (`organisationOn`, the plans' moves included):

1. the **nearest unit above** it that has a slot for the target role — its
   type's or its own `extraSlots`;
2. where no unit above has one, the **one unit in the organisation** that
   has;
3. where none has, the line is **dangling**, and where several have and none
   is above, it is **ambiguous** (§6). Either way it says nothing about who
   manages that day, and nesting answers.

So a slot on the business unit type, *technology lead reports solid to head
of technology*, lands on the technology unit for every business unit, because
the technology unit is the one unit that has a head of technology.

A target found whose slot nobody holds that day is **vacant**: the line still
lands there, and the holders have no line manager of their own that day,
only whoever manages the target in turn (§4). That is a finding too.

### 3. Overridden on a unit

A unit gains **`reportingLines`**: lines of its own, each `{ role, to?, kind,
from?, until? }`, where `to` is the target as `{ scope, unit, role }` — the
path of the scope that keeps the target unit, the unit's id, and the role.

* A line of its own **replaces** its type's line for that role, on the days
  it runs.
* A line with no `to` says that in this unit the role **reports by nesting**:
  its type's line does not apply here.
* A unit may give a line to a role its type says nothing about, its own
  `extraSlots` included.

A target is addressed by path, so a scope moved or renamed readdresses it as
it readdresses a link (`projects/readdress.ts`).

### 4. Who manages, and why

For the holders of a role in a unit, on a day:

* **A solid line** running that day — the unit's own, else its type's —
  that lands on a role in a unit: they are managed by that role's holders
  there (`via: 'line'`), and then by whoever manages *those* holders, by the
  same rule.
* **No solid line**: by nesting, as ADR-0036 §12 says (`via: 'nesting'`).
* **Dotted lines** running that day are answered apart, never as managers.

`managersOf` answers for a role in a unit, as well as for a unit's people
with no line, and each manager it names says `via`, with the dotted lines
beside them. `managedBy` and `managedReach` answer what a person reaches by
unit and by role in a unit, each with `via`: the units their managing roles
reach by nesting, less the roles there whose holders report elsewhere by a
solid line, and the roles whose solid line lands on one they hold, with
everything those holders manage in turn. An assignment is reached where its
unit and its role are.

A solid line makes its target's holders the line managers whether or not
the target role is marked `manages`: the line says so. `manages` keeps
saying who manages a unit's people by nesting.

**No self-escalation** reads as before (ADR-0036 §12) with one addition: a
role reached by a line is never the person's own, so an assignment to it is
theirs to change even where that role manages. Their own assignment never
is.

### 5. A loop is refused when it is written

Solid lines chain: the holders of a target are managed in turn by whoever
their own line or the nesting says. A chain that comes back to where it
started is a **loop**. A command that sets or changes a line — a slot's
`reportsTo` or a unit's `reportingLines` — is refused (`reportingLine.loop`,
naming the chain) where, over the organisation as it stands, the solid lines
would loop on the day it is written or on the line's first day. A line from
a role in a unit to the same role in the same unit is refused
(`reportingLine.self`). Dotted lines do not chain, and are not asked.

A loop that time makes — a plan's move, a line that starts later, a unit
that ends — is not refused, because nothing written made it on its own day;
it is a finding (§6), and the arithmetic stops at the first role and unit it
meets twice, so who manages always answers.

### 6. Findings

Four new kinds in the catalogue (`model/checkCatalogue.ts`), each with its
subjects, a weight and how to fix it:

* **`check.reportingLoop`** (*fix*): solid lines that come back to where
  they started on some day; the chain and the day.
* **`check.reportingDangling`** (*fix*): a line whose target role no unit
  has.
* **`check.reportingAmbiguous`** (*fix*): several units have the target role
  and none is above; a line on the unit says which.
* **`check.reportingVacant`** (*review*): a line lands on a role nobody holds
  that day.

### 7. On the screens

* **The unit type's slot editor** sets a slot's line: the role, solid or
  dotted, and its days.
* **The unit's inspector** lists the lines of its roles, each saying whether
  it is the type's or the unit's own and where it lands that day, with
  *Override…*, *Report by nesting here* and *Use the type's*.
* **The organisation chart** gains a **Reporting lines** overlay, off until
  it is turned on: a solid or a dotted line from each role's holders, or its
  vacancy, to the target's, on the day the chart is looked at; a line to a
  unit folded away ends at the fold. A finding about a line is drawn on it.
* Who manages, wherever a screen says it, says *by line* where a line
  decides it.

The Conway map does not read reporting lines in this release.

### 8. The agent

* **`reportingLine.set`** — a unit, a role, and `to` (`{ scope, unit, role }`)
  or none (by nesting here), the kind and the days; refused with §5's keys.
* **`reportingLine.remove`** — a unit's own line for a role, so its type's
  applies again.
* **`reportingLines.list`** — the lines on a day, each role in each unit
  with its target, its kind, whether it is the type's or the unit's, and
  §6's findings.
* **`unitType.add`** and **`unitType.update`** take `reportsTo` on a slot.
* **`assignments.list`** answers, for each assignment, who manages its holder
  and `via`, and the dotted lines apart.

### 9. A host's right

Core grants nothing (ADR-0036 §12). A host that grants a right from managing
reads the reach of §4: the right follows a solid line, a dotted line carries
none, and whoever manages a unit by nesting no longer reaches a role whose
holders report elsewhere by a solid line.

### 10. The scope format

A slot's `reportsTo` is kept with the operating model in `_operating/`, and
a unit's `reportingLines` on the unit. A build that reads 12 would drop both
on its way back. **The scope format turns to 13**, the one turn of this
release with ADR-0037 and ADR-0038. An organisation written before has no
reporting lines, and nesting answers everywhere, as it did.

## Consequences

* Good: a role that works in one unit and reports to another is filed where
  it works and managed by whom it reports to.
* Good: said once on a type, the line holds for every unit of it, including
  the ones made later; one unit that differs says so on itself.
* Good: who manages says why, and the chart draws it.
* Good: the right a host grants follows the line manager, and only that.
* Bad: who manages is no longer read off the tree alone. A screen, a check
  or a door that answered it from nesting asks the arithmetic instead.
* Bad: a loop through time can only be found, not refused.
* Neutral: a line lands by role. Two people holding the target role in one
  unit both manage, as two holders of a managing role do.

## As built, 16 October 2026

Built in core in four steps — the model, the files, the screens, the agent —
as the record says, with what building it settled.

**The model** (`model/units.ts`, `model/reporting.ts`). A slot carries
`reportsTo`, a unit `reportingLines` (§2, §3). `reportingLinesOn` lands every
line on a day under the parents the day gives the units, and says how each
stands: `lands`, `nesting` (a unit's line with no `to`), `dangling` or
`ambiguous` (with the candidates), with the role it reports to as written. A
unit's own line replaces its type's **of the same kind**: the type's solid
line and a dotted one of the unit's own both run, which is how a role that
reports two ways says the second on the unit. A line by nesting counts as
solid. A type's line lands on the nearest unit above with the target role;
the "one unit in the organisation" may be the unit itself where the target is
another of its roles, never where it is the same role. A unit's own line to a
unit that is not there that day is dangling.

`managersOf(organisation, unitId, day, roleId?)` names each manager with
`via: 'nesting' | 'line'`. Asked for a role with a solid line, it names the
holders where the line lands, then whoever manages those; otherwise the
nesting, and on the way up each managing role with a solid line of its own is
followed where it lands. Each assignment once, and a role in a unit met twice
ends the chain. `dottedLinesOf` and `solidLineOf` answer the lines apart.
`managedBy` answers `held`, `units` (by nesting, the units a line brings in
included where the role it runs from manages), `below`, `elsewhere` (roles in
those units whose holders report elsewhere by a solid line) and `lines`
(roles reached by a solid line, in turn, never one the person holds). A line
reaches a role whoever holds it, a vacancy included.

**A loop** is found in a graph of roles in units: a role's solid line to
where it lands, and otherwise every managing role of its unit (unless it
manages itself) and of the units above. Nesting alone has no cycle, so every
loop holds a line. `reportingFindings` looks on the day asked and on every
later day a line starts or a plan moves a unit, and says each loop once with
the first day it is there. A write is refused where it makes a loop that was
not there before, on the day it is written or on the line's first day
(`loopMadeBy`, `refuseUnitLine`, `refuseSlotLine`) — a loop time made earlier
does not refuse an unrelated line. The refusal is the screen's and the
agent's: the reducer sees one scope and the organisation spans many, as for a
plan's move (ADR-0036 §6).

**The findings** are about the unit the line runs from, a loop's about the
first role of its chain a solid line runs from. `fields` are the role and,
where it lands, the unit and role; a loop's the chain; an ambiguous line's the
candidates, and its `count` how many.

**The files.** `_operating/unit-types.json` keeps a slot's `reportsTo` and
passes over one with no role or another kind; a unit's lines travel on the
element. A scope moved carries the path a unit's line names
(`readdressLines`, with the stand-ins and the analysis, one step per scope).
The format stayed 13.

**The screens.** The slot editor sets *Reports to*, *Line manager* or
*Functional*, *From* and *Until* under each slot's counts; a count changed
keeps the line. The unit's inspector has *Reporting lines* after *Who manages
it*, which says *by line*; its *Override…* sets the unit and role and the kind
— a unit's own line's days are the agent's to set for now. The chart's
*Reporting lines* switch (`chart.showLines`) is off by default and lasts while
the page is up.

**The agent.** As §8 says; `reportingLines.list` is tree-wide, and a line's
answer names the role it reports to (`reportsToRoleId`).

**What a host asks** for its right (§9): `managedReach(organisation, person,
day, canonical)` for the reach, `reachesAssignment(reach, assignment,
managingRoleIds(organisation))` for one assignment before and after a change,
`onlyPeopleIn` for a step, and `reachesPosition(reach, unitId, roleId)` for
whose people a person manages. `ManagedReach.units` alone is the nesting
half: a door that reads it as "whose people" would still let a business
unit's head reach a lead who reports elsewhere, and not reach the role a line
brings in. `elsewhere` and `lines` are optional on the type, so a reach built
before reads as one with no lines.


## Amended, 17 October 2026 — said on the role, landing in the same unit, and drawn where roles are

*Accepted and built the same day, before 3.7.0 is released; the scope format
stays 13.*

### Context

A walk of the first build found the lines where the model keeps them and
nowhere else. A line said on a unit type's slot was visible only in that
type's inspector, under the slot; the Operating model page drew the types'
structure and not a single reporting line, and the chart drew them only once
a switch was found. Somebody who thinks *a technology manager reports to the
head of technology* had to find the unit type that holds the technology
manager and say it there, once per type.

Two things the model could not say well: a line **within a unit** — a
developer to the team's own tech lead, a scrum master to its product owner —
landed, by §2, on the nearest unit above that holds the role or on the one
unit that holds it, so with several teams it was ambiguous; and a role with
**both** a line manager and a functional manager — a matrix organisation —
could say the second only on each unit, since a slot said one line.

### Decision

1. **A line is said at three places, the nearest winning kind by kind.** A
   **role** says where its holders report wherever the role is held
   (`Role.reportsTo`); a **unit type's slot** says otherwise for the units of
   that type (`RoleSlot.reportsTo`); a **unit** says otherwise for itself
   (`reportingLines`, as §3). Each place says at most one line of each kind,
   a line manager's and a functional one, so both stand side by side wherever
   each is said. A slot's line with no role says the holders report **by
   nesting** in units of that type, whatever the role says — as a unit's line
   with no target does for the unit.
2. **A line may land in the same unit** (`within: true`): the target is
   another role of the unit the holders are in, and the line lands there or
   nowhere. A line without it lands as §2 says: the nearest unit above that
   holds the role, else the one unit that does. A role does not report to
   itself in the same unit; that is refused where it is written
   (`reportingLine.self`), as a unit's line to itself is.
3. **The lines are drawn where roles are.** The Operating model page draws
   them between the role chips on its cards — on the card itself for a line
   within, to the types above it in the structure that hold the role, else to
   every type that holds it, in the warning colour where a unit would have to
   say which — and picking a role lights its lines, the roles it reports to
   and the roles that report to it; the role's inspector sets its lines and
   says who reports to it. The organisation chart's overlay is on from the
   start where the organisation says any line, draws a line within a unit as
   a hook beside its box, and lights the lines of the unit picked. A unit's
   inspector says whose each line is — the role's, the type's or the unit's
   own — and who reports into the unit; the People page says under each role
   held where it reports.
4. **Who manages, the reach and the right are unchanged in meaning** (§4,
   §9): a solid line decides who manages, wherever it was said; a dotted line
   decides nothing. Only where a line comes from grew.

### Consequences

* Good: the line is said once where it is thought of, and seen wherever the
  role is.
* Good: a team's internal lines and a matrix's two managers are each one
  line, said once.
* Neutral: a role's line lands nowhere in a unit that holds the role but not
  the target — a business unit with members and no team lead — and that is a
  finding there, as a type's dangling line was.
* Bad: a line's precedence has three places to look. Each screen that shows a
  line says where it was said.

## As built, 17 October 2026: the amendment

**The model.** `ReportsTo` gains `within` and an optional `role`; a role's
`reportsTo` and a slot's are `ReportsToSaid`, one line or a list, read with
`linesSaid` and set kind by kind with `linesWith`. `reportingLinesOn` reads,
for each kind, the unit's own line, else the slot's, else the role's, and
says `source: 'role' | 'type' | 'unit'` and `within` on each; `landing`
lands a line within on the unit itself where it holds the target role, and
nowhere otherwise. `linesHolding` answers what holds for a slot, and
`linesInto` who reports to a role across the model. `refuseRoleLines` asks of
a role's lines what `refuseSlotLine` asks of a slot's, and both refuse a line
to the role itself within. `daysFrom` reads a role's lines as it reads a
slot's, so a loop a role's later line makes is found on its day.

**The files.** `_operating/unit-types.json` reads a slot's `reportsTo` as one
object, as the first 13 folders wrote it, or as a list; `_operating/roles.json`
reads a role's the same way. Written as held. No format turn.

**The screens.** `LinesEditor` is the one editor, two rows — line manager,
functional — each a role, *Where* (in the same unit, or in the nearest unit
above else the one unit that has the role) and the days; the role's inspector
draws it under *Reports to* with *Reported to by* beneath, and each slot draws
it with the role's line as what holds until the slot says otherwise and *By
nesting in this type* as its way of taking that away. `roleLines` works out
the lines between the cards' chips and `StructureLanes` measures and draws
them over the cards; `pickLooks` lights them. `chartLines` keeps a line whose
two ends are rows of one box, and the overlay draws it as a hook and lights
the picked unit's lines; the switch starts on where `hasReportingLines`. The
unit's *Reporting lines* list says the role's, lists *Reported to by*, and its
*Override…* offers the unit itself first and leaves the role's own out. The
People page's held roles say *reports to* and *functionally to*.

**The agent.** `role.add` and `role.update` take `reportsTo`, a list of
lines; a slot's `reportsTo` is the same list, one line of each kind at most,
`within` where said, a line with no `roleId` on a slot saying by nesting.
`roles.list`, `unitTypes.list` and `reportingLines.list` answer them, the last
with `said` and `within`, filtered by `unitId`, `roleId` or `toUnitId`.

## As built, 17 October 2026: drawn on a pick

Every line at once crowded both screens, so each draws the lines of what is
picked, and nothing else. **The structure**: a role picked by its chip on a
card draws the lines from and into that chip, as resolved for that card's
type; a role picked anywhere else — the tray, the responsibilities — draws its
lines on every card that holds it; nothing picked, or a type, draws none.
`StructurePick` says the card (`inType`), and `pickLooks` answers the lines
to draw (`roleLines`) along with the looks, lighting the picked card and the
chips at the far ends. **The organisation chart**: a person picked draws the
lines of the role they hold in their unit — from their chip to the chips of
whoever holds the role they report to, and from the chips of the people who
report to them — measured from the chips themselves (`ChartLinesOverlay`), a
line within a unit joining two chips in its box; a far end nobody holds ends
at the role's name, and one folded away at the folded unit's name with a
tooltip that says so. A unit picked draws none; the bar's switch still turns
them off. `chartLines` says each line's two places unfolded (`at`, `lands`)
and `linesOf` keeps a place's.

On the chart a click picks and a double-click opens, as on a board: a person
in a unit kept in another scope is chosen like any other, and the inspector
reads the assignment there with the way to the scope that keeps it, where a
click used to leave the chart.


## Amended, 17 October 2026 — a person's own line, a role held outside the slots, overrides drawn apart

*Accepted and built the same day (3.7.3). The scope format turns to 14.*

### Context

The model says where a role sits and whom it reports to: a unit type's
slots, the role's and the slot's lines, a unit's own, and nesting. For most
people that is the truth; for some it is not — an agreement of their own, or
a line delegated differently for one person. Two exceptions could not be
said:

* **A person placed in a unit their role does not normally sit in** — an
  assignment to a role the unit's slots (its type's and its `extraSlots`) do
  not have. Nothing refused it, but nothing said it was an exception, and
  the role's own line did not apply to it, because the lines were read off
  the slots only; nesting answered.
* **A person reporting to a different manager** than their role does in
  that unit. Option 1 above (a manager per assignment) was rejected as *the*
  mechanism; as an exception on top of the model it is what was missing.

Both had to be visibly exceptions wherever they are shown. And on the chart
the line a person reports along must not look like the lines reporting into
them: a middle manager has one line up and the lines of their direct
reports coming in.

### Decision

1. **A person's own line.** An assignment gains `reportsTo`: lines of the
   holder's own, each `{ to: { scope, unit, role, person? }, kind, from?,
   until? }`, addressed as a unit's own line is. Kind by kind the nearest
   place wins, and the holder is the nearest of all: a solid line of their
   own running on a day replaces, for that holder only, whatever their role,
   their unit's type, their unit and nesting say; a dotted one replaces
   their role's dotted line. It runs only while the assignment does, and
   ends with it. A line to the holder's own role in their own unit is
   refused (`reportingLine.self`), and so is a solid one that would close a
   loop (`reportingLine.loop`), as §5 refuses them. The four findings of §6
   read it too. A scope moved carries the address it names, as it carries a
   unit's.
2. **A line may land on one person.** Any override — a unit's own line or a
   person's own — may name, in `to.person`, one holder of the target role in
   that unit, by register id. It then lands on that person's position alone:
   they manage by it, not every holder of the role, and who manages in turn
   goes on from them — along their own line where they have one, else as
   their role there is managed. Where that person no longer holds the role
   there on a day, the line is vacant that day, with its finding, and it
   decides nothing: for a unit's own line nesting answers, as for one that
   lands nowhere, and for a person's own the model's answer for their role
   there stands. The self refusal is asked per person: a holder may
   report to a colleague in their own role in their own unit, never to
   themselves; a loop is found per person-position.
3. **An exception placement.** An assignment to a role the unit's slots do
   not have stays allowed, is said as an exception wherever the holder is
   shown, and gives no finding. The role's own line applies to it (the role
   is held there), and its holders manage and are managed there, by nesting
   where the role manages. It does not make the unit a landing place for
   other lines, which still read the slots.
4. **What is an override.** A unit's own line, a person's own line and an
   exception placement. The type's and the role's lines and nesting are the
   model's defaults. Every line says `source` — `role`, `type`, `unit` or
   `person` — and `override`.
5. **Who manages.** A person's solid line wins over the unit's, the type's
   and the role's. `via` gains `override`, for a person's own line and for a
   unit's own line; `line` stays for the model's lines and `nesting` for
   nesting. The managing right of §9 follows a person's solid line exactly
   as it follows any solid line: whoever it lands on reaches that one
   assignment, and whoever reached it only by the default — nesting, or the
   line of the role there — no longer does.
6. **Three colours on the chart.** On a pick, the lines that apply to the
   holder picked are drawn: those they report along in one colour, those
   reporting into them in a second, and any override in a third whichever
   way it runs, its end dot saying where it lands. Solid and dotted keep
   their dash; vacant and loop keep their tones. A legend says which is
   which. An exception placement's chip wears the override colour and says
   why.
7. **The agent keeps to the model.** Every structure relationship is read by
   a tool and written by a tool (the audit below), and the tools, and the
   instructions handed over on connect, say: place people in the roles their
   unit's slots give and let lines follow the role, the type and nesting;
   write an override only when the person acted for explicitly asks for that
   exception, and say in the answer that it is one.

### Decisions taken by default, open to overturning

1. ~~A person's line points at a role in a unit (its holders), not at one
   named person.~~ **Overturned by the owner the same day**: a line may name
   one person (decision 2 above), on a unit's own line and on a person's own.
2. A person's line lives on the assignment and ends with it; a reassignment
   asks for it again.
3. An exception placement is allowed and marked, with no finding.
4. An override line takes the override colour whichever way it runs; its
   direction is read from its end dot and the legend.
5. A person's own line that lands nowhere, or on somebody who no longer
   holds the role, says nothing about who manages that day: the model's
   answer for their role there stands — not nesting, as for a unit's own
   line that dangles.
6. A manager who reaches an assignment may set or take away its holder's own
   line, as any other correction of it.

### Consequences

* Good: the exception is said where it is true — on the one person — and
  the model stays the rule for everybody else, including whoever holds the
  role next.
* Good: an exception is visible as one wherever it is shown, and an agent is
  told to treat it as one.
* Bad: who manages a person is no longer read off their role alone. A screen,
  a door or a check that asked it of a role in a unit asks it of the holder
  where it is about one (`managersOfHolder`, `reachesHolder`).
* Neutral: a line to one person needs that person to keep the role; when
  they leave it the line is a finding until somebody says another.

### The scope format

A person's lines are kept on the assignment in `_assignments/assignments.json`.
A build that reads 13 reads an assignment field by field and would drop them
on its way back, and would read a unit's line to one person as a line to all
of them. **The scope format turns to 14**: a 13 is a 14 in which nobody has a
line of their own, the pass that brings a folder up rewrites the headers and
nothing else, and a 3.7.2 build refuses a 14. Browser storage and memory keep
an assignment whole, so their content format does not turn.

### Every structure relationship, read and written by the agent

| Relationship | Read by | Written by |
|---|---|---|
| A unit's parent | `elements.list`, `element.describe`, `assignments.list` (unit) | `element.update` (`parentId`) |
| A unit's type | `elements.list`, `element.describe` | `element.update` (`unitTypeId`) |
| The domains a unit serves | `elements.list`, `element.describe` | `element.update` (`scopes`) |
| A unit's extra slots | `element.describe`, `assignments.list` (unit) | `element.update` (`extraSlots`) |
| A unit type's place (`top`, `within`) and slots | `unitTypes.list` | `unitType.add`, `unitType.update` |
| A slot's line | `unitTypes.list`, `reportingLines.list` | `unitType.update` (`slots[].reportsTo`) |
| A role's line, and whether it manages | `roles.list`, `reportingLines.list` | `role.add`, `role.update` |
| A unit's own line | `reportingLines.list`, `element.describe` | `reportingLine.set`, `reportingLine.remove` |
| A person's own line | `assignments.list`, `reportingLines.list` | `assignment.add`, `assignment.update` (`reportsTo`) |
| An assignment | `assignments.list` | `assignment.add`, `assignment.update`, `assignment.end` |
| An exception placement | `assignments.list` (`exception`), `reportingLines.list` (`exceptions`) | `assignment.add` |
| How two units interact | `connections.list`, `element.describe` | `relation.add`, `relation.update`, `relation.remove` |
| A plan's moves of a unit | `plans.list`, `plan.read` | `plan.move` |

The gaps the audit found and filled: a correction of an assignment had no
tool (`assignment.update`, new); a person's own line had neither a read nor a
write; `elements.list` did not say which actors are units (`unitTypeId` and
`scopes` now on each line). Taking an assignment away stays a person's, as
ADR-0036 §13 says.

## As built, 17 October 2026: the amendment of a person's own line

**The model** (`model/units.ts`, `model/reporting.ts`, `model/managing.ts`).
`Assignment.reportsTo` holds `AssignmentReportingLine`s; `UnitLineTarget` and
`LinePosition` gain `person`. `reportingLinesOn` keeps answering the roles in
units, the model's lines, now with `override` and with a role held outside
the slots given its own line; `personLinesOn` answers the holders' own;
`everyLineOn` both; `linesOfHolder` the lines that hold for one holder, kind
by kind; `isExceptionPlacement` says one. `lineDecides` says whether a solid
line decides who manages that day — landing, and on somebody who holds the
role where it names one — and `holdersAt` who it lands on. `managersOf` keeps
answering a role in a unit as the model says it, following each manager in
the chain by their own line first; `managersOfHolder` answers one holder.
`managedBy` adds `overrides`, `holders` (assignments reached by a holder's own
line) and `away` (those whose own line takes them out of a reach);
`ManagedReach` carries them, `reachViaHolder` and `reachesHolder` read them,
`reachesAssignment` reads them where the assignment has an id, and
`holdsAllIn` asks of each holder. The loop graph keeps one node per role in
a unit, with each holder's own solid line as one more way out of it, and one
node per person a line names, managed along that person's own line or else
as their role there; `refusePersonLines`, `withAssignmentLines`,
`personLinesWith` and `personLinesWithout` are the write's side. A holder's
dangling or vacant line is a finding of its own, its assignment among the
finding's fields.

**The files.** `_assignments/assignments.json` reads `reportsTo` line by line,
passing over one without a whole target or a kind; `readdressLines` carries
a person's line on a scope move as one `assignment.update`. Format 14.

**The screens.** The chart draws a picked holder's lines through
`holderLines` and colours them with `reportingLineColours` — the accent, teal
and magenta — under a legend (`ChartLinesLegend`); an exception placement's
chip wears a dashed magenta edge and says why in its tooltip and accessible
name. The assignment's inspector gains *Reports to* (`HolderLines`), with
*Override…* and *Use the model's*; `LineTargetForm` is the form both
overrides are said with — to a role in a unit, any unit by its place in the
tree, whoever holds it or one holder, or to one person who holds a role on
the day, their one role filled in or the one asked for. The unit's
*Reporting lines* mark its own lines *override* and use the same form. The
assign dialog offers the unit's slots first and *Another role (an
exception)* below. Who manages says *by override*; the People page says a
holder's own line, the person it names and an exception placement.

**The agent.** `assignment.update` is new; `assignment.add` takes
`reportsTo`; `reportingLine.set` and both take `to.person`. The answers say
`override` and `exception`; `assignments.list` and `reportingLines.list`
answer as the audit says; `STRUCTURE_DEFAULTS` (`agent/method.ts`) is handed
over on connect before the method.

**Not built.** The shipped example has units and lines but no people — an
example names nobody, and the register is kept outside the history — so it
shows neither a person's own line nor an exception placement. The People
page says a person's lines and exceptions and changes neither: they are set
from the person picked on the chart, and by the agent.

