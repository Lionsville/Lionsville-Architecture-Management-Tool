# ADR-0001 — Dissolve the editor package into modules

* Status: accepted
* Date: 2026-09-06
* Deciders: Wouter Simons

## Context and Problem Statement

The tool is two trees. `src/` is the shell — state, dialogs, storage, files,
preferences — with a lint-enforced layering. `vendor/solution-design/` is the
editor: the canvas, the model, the layout engines, the string table. It looks
like a dependency and is not one. It has no upstream, no build step, no version
that means anything, and an alias in three configs resolving it straight to raw
TypeScript.

The seam between them is where the workarounds have collected:

* `src/core` — the layer that "knows nobody" — imports the package in ten
  files, for types *and* for functions (`isTempId`, `hasRouteContent`, `fold`,
  `matchesQuery`, `queryTokens`, `isLanguage`, `isBuiltInLogoKey`).
  `HostModel = DesignModel & HostExtras` is one model declared across two
  packages.
* 177 of the 684 string keys in the package's table describe screens the
  package cannot render — the picker, the settings dialog, the decisions page,
  the shell's own errors. The table is where they live because the table is
  where `t` lives.
* The package's own documented layering is not enforced by anything. A runtime
  import of React Flow's `Position` enum in `edges/floatingEdgeMath.ts` taints
  thirteen otherwise-pure files in `model/` and `layout/`, although the package
  defines the identical `AttachSide` itself.
* Two toolchains: a second `package.json`, `tsconfig.json`, `eslint.config.js`,
  `vitest.config.ts` and `node_modules`, with a `dedupe` list repeated in three
  configs to stop React loading twice.

A package boundary earns its keep when it is a real distribution unit: a
published artefact, a separate release cadence, a consumer who is not us. This
one is none of those. What it costs is paid on every change that crosses it,
and every interesting change crosses it.

## Decision Drivers

* One model. `HostModel` splitting across a package boundary is the source of
  the type gymnastics in `src/core/model/`.
* One toolchain, so a single `npm run check` is the whole feedback loop and
  cannot pass while the other half is broken.
* Enforceable boundaries. A layering that lives in a readme is gone by the
  third hurried patch; the shell's rules are ESLint rules, and the editor's
  should be too.
* Strings belong to the screen that says them.
* Later phases — commands as the unit of change, a working directory, plugins —
  all cross this seam. Each one is cheaper once it is gone.

## Considered Options

* Keep the package and harden the seam
* Publish the package for real
* Dissolve it into modules of one codebase

## Decision Outcome

Chosen option: **dissolve it into modules**. `vendor/solution-design/` ceases
to exist. Its contents become `model/`, `layout/`, `editor/`,
`documentation/`, `i18n/` and part of `search/` under `src/`, alongside the
shell's own code folded into the same module set. One `package.json`, one
`node_modules`, one `tsconfig.json`, one `eslint.config.js`, one
`vitest.config.ts`.

Each module has an `index.ts` that is its public surface, pure files at its
root and a `ui/` folder for its React side. ESLint enforces an import matrix
across the whole tree, so `model/` and `layout/` may not see React, MUI,
Emotion or React Flow, and nobody may import `app/`.

This is a **move, not a rewrite**. The tests come along unchanged, behaviour on
screen does not change, and the file formats do not change. The model's shape
and `DiagramContentBatch` are explicitly out of scope (ADR-0002 owns those);
so is renaming any persisted field (ADR-0003 owns the format version).

### Consequences

* Good, because there is one model, one string table composed from slices each
  module owns, and one gate that covers everything.
* Good, because the editor's internal layering finally has the same kind of
  enforcement the shell's has had, in the same file, with a message per rule.
* Good, because the ~360 lines of surface left over from the original host —
  the parameter editor, the scope cost chip, the currency formatter, the drag
  shims — have an obvious moment to go, and the props the shell passes only to
  keep them quiet go with them.
* Bad, because `git log --follow` and `git blame` need help across the move.
  Mitigated by keeping the move a pure `git mv` in its own commit, with import
  paths rewritten by a codemod and nothing else touched.
* Bad, because the editor is no longer trivially extractable if it ever should
  be published. Accepted: nothing suggests it should, and the module indices
  keep the surface visible enough to reverse the decision deliberately.
* Neutral: the `editor/` ⇄ `canvas/` mutual imports (ten in each direction)
  survive the move. They are inside one module afterwards, so no rule is
  needed; the knot is recorded in that module's index header instead of being
  untied here.

### Confirmation

* `vendor/` does not exist; `grep -r "solution-design" src electron *.ts *.js`
  returns nothing.
* The test totals match the counts frozen at the start of the phase — 653
  shell + 1509 package = 2162 — minus the tests of the deleted dead surface.
* No file under `model/` or `layout/` imports React, MUI, Emotion or React
  Flow, enforced by ESLint rather than by review.
* `strings.test.ts` passes over the composed tables and asserts no two module
  slices define the same key.
* `npm run verify` is green.

## Pros and Cons of the Options

### Keep the package and harden the seam

* Good, because it is the smallest change and nothing moves.
* Bad, because the seam is exactly what is wrong. Hardening it means splitting
  `HostModel` for real, which means a shell model and an editor model with a
  mapping between them — more code, in the place that already has the most.
* Bad, because the string table cannot be hardened without either moving 177
  keys out (which is this ADR's work anyway) or accepting them permanently.
* Bad, because the second toolchain stays, and with it the possibility of a
  green `check` over a broken tree.

### Publish the package for real

* Good, because it would make the boundary honest: a version, a build, a
  changelog, an API you cannot casually widen.
* Bad, because there is no second consumer and no prospect of one. The cost is
  a release process, and the benefit is discipline we can get from an ESLint
  rule.
* Bad, because it makes every cross-cutting change a two-repository dance, in a
  tool that is still finding its shape.

### Dissolve it into modules

* Good, because the boundaries that remain are the ones worth having, and they
  are enforced by the tool that runs on every commit.
* Good, because it is mechanical: the pure half already runs under node, so the
  move is `git mv` plus import paths.
* Bad, because it is a large diff at once, and history needs `--follow`.

## More Information

**Provenance** (this replaces `vendor/solution-design/VENDOR.md`, deleted with
the move). The package was `@lionsville/solution-design` 0.1.0, originally a
workspace package in the Lionsville monorepo `hal_app`. It was copied here by
hand on **23 August 2026**; there was never a git remote, a submodule or a
version pin pointing back at the source, so no common commit exists to diff
against. From **2 September 2026** it was a fork maintained here, with no
upstream synchronisation in either direction — which is what makes dissolving
it a bookkeeping change rather than a divergence. The package's `README.md`
cited `docs/specs/…`, `docs/intent/…` and `docs/plans/…` paths that only ever
existed in `hal_app`; it is deleted with the move rather than corrected.

`VENDOR.md` also carried a licence grant to a named organisation for the
duration of a programme. That is superseded and has been since: the root
`LICENSE` is AGPL-3.0-only, and it governs. The one external licence that still
needs care is `libavoid-js` (LGPL-2.1-or-later), which is why `libavoid.wasm`
is published unhashed at the fixed path `/libavoid.wasm` so a self-built
libavoid can replace it.

**Old working files.** `CLAUDE.md` claimed that `.werkbestand.json` "keeps
opening, forever". It does not, and it has not since the rename: `isWorkingFile`
accepts only the `lionsville-architecture` tag, and `hostModel.test.ts` pins the
refusal with its reasoning. That was the deliberate decision — the working file
was redefined rather than extended, at a moment when nobody had one worth
keeping — and it stands. The claim in `CLAUDE.md` was the stale side and is
removed. Compatibility with files this tool itself wrote is unaffected:
versions 1 and 2 both open, and ADR-0003 will add version 3 with a reader for
both.
