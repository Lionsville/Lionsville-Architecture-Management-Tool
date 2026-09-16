# ADR-0016 — A laid-out view is a tab, and the technology landscape is authored on

* Status: accepted
* Date: 2026-09-16
* Deciders: Wouter Simons
* Amends: ADR-0012 §6 (a sheet is opened as a page over the canvas),
  ADR-0015 §5 (where the technology landscape lives)

## Context and Problem Statement

The three laid-out views — the business architecture sheet, the enterprise
map and, since ADR-0015, the technology landscape — were pages **over** the
editor. Each had a tab in the strip, because a view is a view, but choosing
the tab opened a fullscreen dialog with a back button, and the canvas
underneath stayed on whatever board it was on. That was the cheap way to
get the sheet in when the editor could only draw geometry, and it carried
two consequences that stopped being acceptable the moment the technology
landscape existed.

A scope with no board was not openable at all: `isOpenableScope` asked for
a `layer7` or a `container`, and the shipped example's platform scope kept a
board of chips it had no use for, just to be a scope the shell would enter.
A platform organisation does not have a landscape; it has a stack, and the
technology landscape is the picture of it.

And nothing could be made on the landscape. The view was read only, so a
platform team defining its offerings still went to the chip board, the
palette and the canvas inspector — the very board the view made redundant.
Tried on the example, the first question was "why does the tab open a
page?" and the second was "where do I add a service?".

## Decision Drivers

* A view is a view. If it is in the tab strip it should behave like the
  others in the strip: chosen, shown in place, left by choosing another.
* One editor, one inspector, one palette. A record edited on the landscape
  must be the same record with the same fields, the same ownership rule and
  the same gestures as on a board; a second inspector is a second answer.
* The import matrix stands: the editor may not import `business` or
  `technology`, and neither may import the editor.
* The platform scope should need no board.

## Considered Options

1. **Keep the pages, add authoring to the technology page.** A second
   inspector for platforms and services, duplicating the editor's. Rejected.
2. **A separate "laid-out workspace" beside the editor**, with its own tab
   strip. Rejected: two strips, and every view in the wrong one for somebody.
3. **The laid-out view takes the canvas's place in the editor**, through a
   slot the host fills, with the editor's palette and inspector kept beside
   the one view that authors. Chosen.

## Decision Outcome

Option 3.

### 1. A laid-out view can be the active view

`session.activeDiagramId` may name a sheet, a map or a technology
landscape. `resolveActive` answers a board first where there is one, the
asked-for view where it exists, and the first view otherwise;
`isOpenableScope` asks for any view at all. A scope whose only view is a
technology landscape opens on it. The hooks that wired the pages
(`useSheet`, `useMap`, `useTechnologyLandscape`) hold no state of their
own any more: which view is up is the session's, and *open* is
`setActiveDiagramId`. Making one makes it active, for a person and for the
agent alike.

### 2. The editor draws it through a slot

`SolutionDesignEditor` takes `pages.render(diagram, view)`. When the
active view is laid out, the editor renders what the slot returns where
the canvas would be and keeps the tab strip, undo and redo, search, help
and the language switch on the bar; the canvas's own controls — tidy,
route, fit, export, the overlays — are not offered, because they have
nothing to act on. The slot is how the drawing crosses the import matrix,
the way the documentation page takes its inspector.

The technology landscape is **docked**: the palette and the inspector stay
beside it. The sheet and the map carry their own inspectors and take the
whole body. The rule is the kind's, in the editor, and is not a prop.

### 3. The technology landscape is authored on

The palette on a technology tab offers the layer's two kinds
(`TECHNOLOGY_PALETTE`) and nothing else. Adding one makes the record and
no placement — the view lays it out — and selects it, so the inspector
opens on it with every field a platform or a service has: name,
description, lifecycle, *shared*, the archetype, *part of*, *realises*,
*maintained by*, and the gestures across scopes. A `+` on the service band
and on the platform band does the same, and a `+` inside a group files the
new record under the group's parent. Choosing a card the scope holds is the
editor's selection; an application or a domain, which the scope does not
hold, keeps the page's own read-only record. Under `readOnly` nothing is
offered.

### 4. What follows

* A scope's home lists every view among its boards, a laid-out one with
  its kind and no count; each row opens the scope on that view.
* `check.notDrawn` counts a technology landscape as drawing every service
  and platform the scope holds.
* The shipped example's platform scope drops its chip board: the
  technology landscape is its one view, and its active one.
* The agent's `diagram.create` switches to a laid-out view it made, as it
  switches to a board. `diagram.render` still reaches a laid-out view
  through the page's own handle.

### 5. What stays exactly as it is

The three laid-out views compute everything from the rows and store no
geometry; the sheet's own gestures; the two reports as pages reached from
a card; the platform report and the service report; the format.

## Consequences

* `pages` on the editor's props, `PageView` and `EditorPages` in its
  vocabulary; `TECHNOLOGY_PALETTE` and `allowedKindsOn('technology')` in
  the model; `isLaidOutKind` beside `isBoardKind`.
* A folder whose root held only a sheet and a map used to open on the
  organisation screen because the root was not openable; it opens on the
  sheet now, which is what the tab strip promised all along. The home is
  one crumb away.
* Not in this step: deleting a laid-out view from the home's boards table,
  and a *Colour by* overlay on the landscape's top band.
