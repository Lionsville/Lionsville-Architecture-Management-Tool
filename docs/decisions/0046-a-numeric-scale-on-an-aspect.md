# ADR-0046 — A numeric scale on an aspect, and a function rated on it

* Status: accepted, 7 November 2026; as built, 7 November 2026: the model, the
  folder format and the agent's tools (4.0.0, not yet released). The heat map on
  the sheet is the sheet's to draw.
* Date: 2026-11-07
* Deciders: Wouter Simons

## Context and Problem Statement

A capability map is most often read as a heat map: how mature is each capability,
how much does it matter. Elements have aspects, but an aspect's entry is a status
a badge shows (`managed`, `partial`, `atRisk`, `none`), with no number and no scale
to read one against, and the sheet has no way to colour by one.

## Decision Drivers

* One number means one thing on every sheet in an organisation.
* An organisation chooses what it rates. Maturity and importance are common, and
  neither is the tool's to impose.
* Narrowing a scale must not throw away what people rated.
* Two people rating one capability on two aspects are not writing the same thing.

## Considered Options

1. **Any aspect with a numeric scale, set per organisation, 1 to 5 by default.**
2. **A fixed set**, maturity and business importance. Rejected: it says what an
   organisation should care about.
3. **No ratings**, only what can be derived: coverage, who answers, lifecycle.
   Rejected: what is worth rating is exactly what cannot be derived.

## Decision Outcome

Option 1 (`model/aspectScale.ts`).

**A scale is the organisation's.** `aspectScales` on the root scope's model: each
with a stable `key`, a `label`, an optional `code`, and whole numbers `min` and
`max`, 1 and 5 where nobody said. It is a project setting, so it is a step with an
undo, written in the root's `scope.json`, and read from any scope through the
organisation's index (`IndexedOperatingModel.aspectScales`). The `key` may be an
existing aspect column's or a new one. A scope below holding some is read past.

**A value is on the function.** `ratings` on an element, by the scale's key, beside
`aspects` rather than in it: an aspect's entry is a status, and a rating is a number.
An area, a grouping and a capability are one kind told apart by where they sit, so
all three take a value, and no other kind does. `element.rate` writes one value or,
without `value`, takes it away, and addresses that aspect alone
(`element/<id>/ratings/<key>`), so two people rating two aspects do not meet.
`ratings` is part of the owner's detail: a stand-in is rated where it is defined.

**The reducer holds what it can see.** A rating is a whole number on a function, or
`command.badScale`. It cannot hold a value to its scale, which another scope may
keep. The agent's tool does; and a value outside its scale stands as written and
reads as unrated (`ratingOn`), which is also what narrowing a scale does, so widening
it again brings the value back. Removing a scale leaves the ratings the same way.

**The agent** reads with `aspectScales.list` and writes with `aspectScale.set`,
`aspectScale.remove`, at the organisation, and `element.rate`, in the scope that
defines the function. `elements.list` and `element.describe` answer `ratings`.

**Format 17.** All of it is optional, so a 16 reads as a 17 that says none of it,
and a 16 reader refuses a 17 rather than drop it on its way back.

### Consequences

* Good: a heat map has something to read, and `heatOf` says how far up its scale a
  value stands, with no colour in the model.
* Bad, accepted: an off-scale value is invisible until the scale changes back. The
  alternative, clipping or deleting it, would make narrowing a scale destructive.
* Neutral: an element's `aspects` and its badges are unchanged.
