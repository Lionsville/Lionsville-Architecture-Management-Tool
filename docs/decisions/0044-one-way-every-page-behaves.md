# ADR-0044 — One way every page behaves: under the bar, closed the same way, columns that widen, cards that open

* Status: accepted, 25 October 2026; implemented, 25 October 2026 (3.8.0)
* Date: 2026-10-25
* Deciders: Wouter Simons
* Extends: ADR-0005 (a top bar that says where you are), ADR-0033 (back goes
  to the place before)

## Context and Problem Statement

The pages of the app were written one at a time, and each settled its own
chrome. Trying the pages of 3.8.0 side by side with the rest made the
differences plain:

* some pages cover the shell's bar and some open under it, so the breadcrumb
  is there on one page and gone on the next;
* some have ‹, some ×, some both, and on a page written over its whole
  width — observations, an element's documentation, a plan — either one
  closed the page with the editor still open;
* a crumb in the bar did nothing while a page was up over the same home;
* some columns beside another can be dragged wider and most cannot;
* the home cards grew as their descriptions grew, and the ways into a page
  were links that wrapped;
* on the enterprise map, rows scrolled up over the column names.

None of these is a feature. Each is a rule a page should not have to decide.

## Decision Drivers

* **One behaviour, learnt once**, on every page.
* **Nothing written is lost by a close**: a page being written goes back to
  reading first.
* **The bar always says where you are** (ADR-0005), and its crumbs always
  work.
* **Width is the reader's**: a column beside another is as wide as they
  drag it, and stays so.
* Reachable by the keyboard, as every main control is.

## Considered Options

1. **Fix each page as it is found.** The next page written makes its own
   choice again.
2. **Rules, written once, with a widget or a hook for each**, and a test per
   rule. *Chosen.*

## Decision Outcome

Option 2. Seven rules.

1. **Every page opens under the shell's bar.** No page covers it; a page
   measures the bar and starts below it.
2. **‹ at the start and × at the end of every page's bar** (`PageClose`).
   On a page written over its whole width — observations, an element's
   documentation, a plan — ‹, × and Escape go **back to reading** first, and
   the next press closes the page; the buttons say which.
3. **A crumb in the shell's bar closes whatever page is up**, the crumb of
   the home under it included, and then goes where the crumb says.
4. **Every column beside another can be dragged wider** (`SeamResizer` with
   `useSeamWidth`): by pointer or by arrow keys on the seam, its width kept
   per seam in the browser, a double-click resetting it. On History,
   Decisions (both columns), the operating model, the roadmap's names,
   People, Principles, Topics and Observations, and on every page that has
   one after.
5. **Home cards are low**: the title, one short line of what the page is —
   two lines at most in every language at the narrowest card — and the
   counts. The ways in come up over the card, under its title, on hover and
   on keyboard focus: one button filling it, or one per way in, stacked.
   Focus handed back by a page that closed does not raise them.
6. **Menus**: *Website* under Help in ⋯ opens the product's site; *Connect
   an agent* links to where the desktop app is downloaded, where the desktop
   is needed.
7. **A table that scrolls keeps its headings on top**: on the enterprise
   map, the owners' band and the column names under it.

Each control a rule adds carries a name in `CONTROL_NAMES`.

## Consequences

* Good: a page is learnt once; a crumb and × do what they say everywhere.
* Good: a new page gets the rules from the widgets it is made of, not from
  remembering them.
* Bad: a full-width editor takes two presses to leave. The first says that
  it goes back to reading, so the second is not a surprise.
* Neutral: a column's width is the browser's, not the scope's: two people
  sharing a scope keep their own.

## As built, 25 October 2026

**The widgets.** `widgets/PageClose.tsx` holds the bar's two ends: `PageClose`
(×), `PageBack` (‹) and `useBackToReading`, which says what both do on a page
written over its whole width and what Escape does there. `PageDialog` keeps
Escape from a field that picks from a list: the list closes first, then the
field is left, and only the next press closes the page. `useSeamWidth` keeps a
column's width per seam with the shell's other preferences, and
`useSeamWidthsOf` one per screen of a page that switches between them (the
observations' reader, per tab). `app/organisation/OnePage.tsx` is the home
card, with its ways in over it; they come up on hover and on `Mui-focusVisible`
inside the card, so the focus a closed page hands back after a press of the
mouse leaves them down.

**Where the rules are held.** `build/pageRules.test.ts` reads every file that
draws a `PageDialog`: each opens under the host's bar and has its ×, and each
page with a column beside another — History, Decisions (two), the operating
model, the roadmap's names, People, Principles, Topics, Observations and an
element's documentation — has its seam and keeps its width. A page added
later is held to the same, or the test names it.

**§3.** A crumb on a home closes the home's page before it goes; over an open
scope, the pages close as the scope is left, and it opens again without them.

**Where a page closes to.** A building block's page opened from another
screen — an element's inspector, a reference in a document, a topic — closes
back to that screen, the place before (ADR-0033); one opened from the
register closes onto the register.

**§6.** *Website* is under Help in ⋯ and in the desktop's own Help menu, which
has no ⋯.

**Met on the walks, and built with the rules**: the scope pickers of topics
and building blocks list the tree as a tree — indented by depth, and the
topics under a heading of their own where a list holds both — and a building
block's page opened before the tree has been read shows the page arriving,
not the home bare.

**Names**: `page.close`, `page.seam`, `shell.website`, `agent.download`.

