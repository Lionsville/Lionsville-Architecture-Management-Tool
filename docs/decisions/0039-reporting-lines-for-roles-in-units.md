# ADR-0039 — Reporting lines for roles in units: solid or dotted, said on the unit type, overridden on a unit

* Status: accepted, 16 October 2026; not yet built (3.7.0)
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
