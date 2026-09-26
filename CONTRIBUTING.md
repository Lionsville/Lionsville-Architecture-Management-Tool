# Contributing

Lionsville Architect is developed in the open, in this repository. This page
says how to set it up, how the repository works, how to report a bug or
propose a change, what a pull request needs, and who holds the copyright and
what that means for a contribution. If you intend to send code, read the last
section first: it says why pull requests are reviewed but not yet merged.

## Setting up

Node 26, the version CI builds with (22.12 or newer works). Internet is needed
once, for `npm install`; everything after that is local.

```bash
npm run setup
npm run dev
```

Then open http://127.0.0.1:5200. `npm run setup` is `npm install`; it exists
so the instruction does not have to change. For the desktop app,
`npm run dev:desktop` runs it against the dev server.

The feedback loop is three commands, in order of cost:

- `npm run check` — a few seconds: typecheck, lint and every unit test. Run
  it after every change.
- `npm run check:all` — adds a production build. Once before handing work
  back.
- `npm run verify` — about two minutes: everything `check:all` does, plus the
  perf budgets, the desktop build and the desktop smoke run, in one table with
  one exit code. Run it before a push that changes the build or touches the
  desktop.

`CLAUDE.md` is the working guide: the layer map, the conventions, the settled
names, what has gone wrong before. It is written so an agent can work from it,
and the rules are the same for a person. Read it before changing anything.

## How the repository works

- **Trunk-based.** `main` is the only long-lived branch and it is always
  releasable. Maintainers commit to it directly after a green `check`. A
  change from outside arrives as a pull request against `main`.
- **Small commits that say why.** The subject is one line with a prefix
  naming the area (`docs:`, `editor:`, `tests:`, `chrome:`). The body says why
  the change is right, not what it does — the diff already says that. A commit
  that has to explain four unrelated things is four commits.
- **Every UI string in four languages.** English, Dutch, Frisian and German.
  Each module owns `strings/en.ts`, which is the schema for its keys, and the
  `nl`, `fy` and `de` twins typed from it, so a missing translation is a
  compile error where the word lives. A string is never inline.
- **Every pure function gets a unit test.** Tests sit beside the code they
  test, and `npm run check` runs them all.
- **Every port has a contract.** `src/ports/*.contract.ts` states the
  behaviour every adapter of that port must show; a new adapter passes the
  existing contract before it does anything else.
- **Decisions are written down.** `docs/decisions/` holds the architecture
  decision records. A change that alters behaviour, adds a seam or settles a
  name gets a record, or amends the one it extends: the next number, the same
  headings as the last one. What is not built has no record.
- **This tree is public.** No credentials, ever, not even for a minute. No
  real organisation's landscape, names, hostnames or vocabulary. Fixtures are
  fictional; Acme Logistics and Globex are the house names.

## Reporting a bug

Open an issue with the bug report form. Say which version (the About dialog
in the desktop app, or `version.json` beside the web build), which platform,
what you did, what you expected and what happened. A landscape that reproduces
it helps, but only attach one you invented: a real organisation's data does not
belong in a public issue.

A security problem is not an issue. `SECURITY.md` says where it goes.

## Proposing a change

For anything bigger than a typo, start a discussion before writing code. Say
the problem before the solution: what you were trying to do and where the tool
got in the way. A maintainer will say whether it fits, and where in the tree it
belongs. The answer may be no, and it will say why. A pull request that arrives
after that conversation is easy to review; one that arrives instead of it may
be closed with a pointer back here.

## Pull requests

- One change per pull request. Two changes are two pull requests.
- `npm run check` is green. If the change touches the build or the desktop,
  `npm run verify` is too.
- New or changed strings exist in all four languages.
- New pure functions have tests; a new adapter passes its port's contract.
- A behaviour that changed has a decision record, or an amendment to one.
- Commits are in the style above, and the description says why.
- Nothing in it comes from a real organisation.

Every pull request is read. Until the agreement in the next section exists,
none is merged.

## Intellectual property

Lionsville Group BV holds the copyright of everything in this repository. It
publishes the whole tree under the GNU Affero General Public License,
version 3 only (`AGPL-3.0-only`, `LICENSE`), and it also offers the same
software under a commercial licence. Both can stay true only while one holder
owns every line. So a contribution is
accepted only under a contributor licence agreement in which you assign the
copyright of your contribution to Lionsville Group BV. The text of that
agreement will be in [`CLA.md`](CLA.md) once counsel has written it; a check on
every pull request will ask for it to be signed. Until the agreement and that
check are in place, pull requests are reviewed but not merged.

What this does and does not change:

- Everything in this repository is AGPL-3.0-only and stays that way, including
  every contribution merged into it. Assigning the copyright moves the holder;
  it does not move the licence you and everyone else receive the code under.
- A commercial edition exists. It is a plugin that composes over this tree
  through the seams described in `docs/decisions/` (ADR-0022 is the main one),
  and it lives outside this repository. Nothing in it is needed to build, run,
  test or extend what is here.
- Your copyright in a contribution is assigned, not licensed: after the
  assignment, Lionsville Group BV is the holder and may license the
  contribution as it licenses the rest of the program. You keep every right
  the AGPL gives you, the same as anyone else.

If that is not a deal you want, the AGPL still lets you fork this repository
and carry your change there, and the discussion board is still the place to
tell us what you found.
