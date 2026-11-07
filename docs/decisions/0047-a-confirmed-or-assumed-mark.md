# ADR-0047 — A confirmed or assumed mark on elements and lines

* Status: accepted, 7 November 2026; as built, 7 November 2026: the model, the
  folder format and the agent's tools, then the screens (*As built: the screens*,
  below); implemented, 7 November 2026 (4.0.0, not yet released)
* Date: 2026-11-07
* Deciders: Wouter Simons

## Context and Problem Statement

Part of what a landscape says has been checked and part of it is somebody's best
guess. Nothing can say which, so people write it where they can: `(assumed)` in a
name, `???` as a protocol. That dirties the name every other screen shows, and it
cannot be listed, filtered or drawn.

## Decision Drivers

* Saying a thing is assumed must be easier than typing it into the name.
* An existing landscape must not change its look because nobody has said anything.
* It has to work on a line, where the guess is often the protocol or the line itself.

## Considered Options

1. **A mark with two values, absent meaning nobody has said.**
2. **A mark with one value, `assumed`, absent meaning confirmed.** Rejected: every
   record before this one would then claim to have been checked.
3. **Leave it to names.** Rejected, for the reasons above.

## Decision Outcome

Option 1. `certainty` on an element and on any relation: `confirmed` or `assumed`.
Absent is neither, which is every record from before format 17.

It is a field of `element.update` and `relation.update`, part of an element's
owner's detail, so a stand-in shows what the defining scope says. The agent sets it
with `certainty` on `element.add`, `element.update`, `connect`, `connection.update`,
`relation.add` and `relation.update`, null taking it off, and reads it on every list
and describe. Its descriptions say to use it rather than writing the word into a name.

**Format 17.** Optional, so a 16 reads as nobody having said, and a 16 reader
refuses a 17 rather than drop it.

### Consequences

* Good: *assumed* can be drawn, as a word on the row and a dashed card, and counted.
* Bad, accepted: names that already carry `(assumed)` keep it until somebody moves
  it; nothing guesses at what a name meant.

## As built: the screens

The panel of an element and of a line says *Confirmed*, *Assumed* or *Nobody said*
as a row pressed to edit (`editor/inspector/elementRows`). An assumed card on a board
is drawn with a dashed edge (`editor/nodes/NodeShell`). The word stands on the
technology landscape's rows and in a container diagram's Lines list. The register's
rows do not say it.
