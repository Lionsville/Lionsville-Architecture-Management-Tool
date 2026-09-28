# Decision records

What this repository decided, one record each, numbered in the order they were
written. A change that alters behaviour, adds a seam or settles a name gets a
record, or amends the one it extends (`CONTRIBUTING.md`). What is not built has
no record.

## The shape of a record

A title, `# ADR-NNNN — <what was decided>`, then the header, then *Context and
Problem Statement*, *Decision Drivers*, *Considered Options*, *Decision
Outcome* and *Consequences*: the same headings as the record before it. A
record is written **as built**: where the build departed from the text, the
record says so near the top, and a later change to its own decision is a dated
amendment in the record itself, never a silent edit.

The header is a list of fields, one per line, continued with two spaces:

| Field | On which record | What it says |
|---|---|---|
| `Status` | every one | `accepted`, and after a semicolon any dated amendment the record carries of its own |
| `Date` | every one | the day it was accepted, `YYYY-MM-DD` |
| `Deciders` | every one | who decided |
| `Supersedes` | the later record | the earlier record, or the part of it by section, that this one replaces |
| `Superseded-by` | the earlier record | the mirror: the later record, whether in part or in whole, its date, and what it replaced |
| `Extends` | the later record | an earlier record this one adds to without replacing anything of it |
| `Closes` | the later record | a question an earlier record left open, now answered |

## Superseded, in part or in whole

**A record that has been superseded says so in its header**, so a reader who
opens it is told before the first paragraph that part of it is no longer the
rule. The two ends are written together, in the commit that lands the later
record: `Supersedes:` on the new one, and on the old one

```
* Superseded-by: ADR-0014, in part, 2026-09-15 — §1's closed category is
  replaced by a three-value archetype …
```

— one line per superseding record, the number, *in part* or *in whole*, the
later record's date, and what it replaced in the old record's own terms. A
record superseded in part stays `accepted`: the rest of it still holds. A
record superseded in whole becomes `superseded` — the same status and the same
relation, `supersededBy`, that the app's own decision records carry — and none
is, yet. Inside the text, where a section no longer holds, a short italic note
at that section (*Superseded in part by ADR-0014: …*, *Amended by ADR-0028*)
says what replaced it; the header is the index of those notes, never a
substitute for them.

`Extends` and `Closes` are not supersessions and have no mirror field: a record
extended is still wholly true, and a question closed was never a decision. The
earlier record may say *Closed by ADR-NNNN* beside the open question, as
ADR-0009 does.

Until 27 September 2026 some records said `Amends:` where they replaced a
clause of another, and the earlier record carried the fact as prose under its
status (*Superseded in part, … by*, *Amended, … by*). Those are the fields above
now, with their words unchanged.

## The records

| # | Decision | Date | Superseded by |
|---|---|---|---|
| [0001](0001-dissolve-the-editor-package.md) | Dissolve the editor package into modules | 2026-09-06 | — |
| [0002](0002-commands-as-the-unit-of-change.md) | Commands as the unit of change | 2026-09-06 | [0028](0028-a-command-says-what-it-may-carry.md) in part |
| [0003](0003-a-working-directory-of-text-files.md) | A working directory of text files | 2026-09-06 | [0018](0018-one-file-and-it-is-the-working-set.md) in part |
| [0004](0004-what-a-large-landscape-costs.md) | What a large landscape costs | 2026-09-06 | — |
| [0005](0005-preferences-and-what-you-are-working-from.md) | Preferences, in three scopes, and a top bar that says where you are | 2026-09-07 | [0023](0023-a-sealed-working-file-from-any-home.md) in part |
| [0006](0006-release-channels.md) | Release channels: stable, and beta | 2026-09-07 | [0030](0030-a-build-with-a-feed-updates-itself.md) in part |
| [0007](0007-an-agent-as-a-peer-of-the-menu.md) | An agent as a peer of the menu: an MCP server that speaks commands | 2026-09-07 | [0018](0018-one-file-and-it-is-the-working-set.md) in part |
| [0008](0008-history-per-thing-and-a-way-back.md) | History per thing, and a way back that is itself history | 2026-09-08 | — |
| [0009](0009-time-a-transition-and-a-document-that-computes.md) | Time on the facts, a transition as a record, and a document that computes | 2026-09-08 | [0027](0027-looking-at-another-day-is-not-an-edit.md) in part |
| [0010](0010-a-replacement-as-one-gesture.md) | A replacement as one gesture, and the interfaces as the plan | 2026-09-08 | — |
| [0011](0011-an-agent-can-do-what-a-person-can.md) | An agent can do what a person can, and knows what stuck | 2026-09-08 | — |
| [0012](0012-a-federated-model.md) | A federated model: scopes, one identity, and views apart from geometry | 2026-09-10 | [0016](0016-a-laid-out-view-is-a-tab.md) in part; [0018](0018-one-file-and-it-is-the-working-set.md) in part |
| [0013](0013-the-physical-view.md) | The physical view: a platform, what stands on it, and what it carries | 2026-09-15 | [0014](0014-the-technology-layer.md) in part; [0015](0015-the-technology-landscape.md) in part |
| [0014](0014-the-technology-layer.md) | The technology layer: services offered, platforms that deliver them | 2026-09-15 | [0015](0015-the-technology-landscape.md) in part; [0017](0017-what-hosting-implies.md) in part |
| [0015](0015-the-technology-landscape.md) | The technology landscape: one view over the layer | 2026-09-16 | [0016](0016-a-laid-out-view-is-a-tab.md) in part; [0020](0020-the-technology-landscape-is-where-technology-use-is-written.md) in part |
| [0016](0016-a-laid-out-view-is-a-tab.md) | A laid-out view is a tab, and the technology landscape is authored on | 2026-09-16 | — |
| [0017](0017-what-hosting-implies.md) | What hosting implies, and technology from the register | 2026-09-17 | [0020](0020-the-technology-landscape-is-where-technology-use-is-written.md) in part |
| [0018](0018-one-file-and-it-is-the-working-set.md) | One file out, and it is the working set | 2026-09-19 | — |
| [0019](0019-an-agent-drives-the-app.md) | An agent drives the app, and the person can stop it | 2026-09-19 | — |
| [0020](0020-the-technology-landscape-is-where-technology-use-is-written.md) | The technology landscape is where technology use is written | 2026-09-20 | — |
| [0021](0021-observations-and-what-lies-behind-them.md) | Observations, and what lies behind them | 2026-09-20 | — |
| [0022](0022-a-source-is-a-provider.md) | A source is a provider, and a step can come from another author | 2026-09-21 | — |
| [0023](0023-a-sealed-working-file-from-any-home.md) | A sealed working file, from any home, and settings that stay with the install | 2026-09-21 | — |
| [0024](0024-the-web-build-is-a-release.md) | The web build is a release, and it has an address | 2026-09-21 | [0030](0030-a-build-with-a-feed-updates-itself.md) in part |
| [0025](0025-where-a-working-file-lands-is-asked.md) | Where a working file lands is asked | 2026-09-22 | — |
| [0026](0026-solutions-and-whether-they-held.md) | Solutions, and whether they held | 2026-09-24 | — |
| [0027](0027-looking-at-another-day-is-not-an-edit.md) | Looking at another day is not an edit | 2026-09-26 | — |
| [0028](0028-a-command-says-what-it-may-carry.md) | A command says what it may carry | 2026-09-26 | — |
| [0029](0029-every-record-says-what-it-is-to-a-search.md) | Every record says what it is to a search | 2026-09-27 | — |
| [0030](0030-a-build-with-a-feed-updates-itself.md) | A build with a feed updates itself, and the releases here carry no installers | 2026-09-28 | — |
