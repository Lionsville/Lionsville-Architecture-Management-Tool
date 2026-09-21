# ADR-0023 — The web build is a release, and it has an address

* Status: accepted
* Date: 2026-09-21
* Deciders: Wouter Simons

## Context and Problem Statement

The app has run in a browser since the beginning — `npm run build` is a
static bundle and `npm run dev` serves it — but only from source. Somebody
without Node, or without the patience, had the installers and nothing else,
and "in a browser from source" in the README was true and useless to them.
The bundle was also nowhere a release could point at: the release page
carried installers for three platforms and no fourth artefact for the one
platform everybody has.

## Decision Drivers

* A release should carry every form the app takes. The installers are built
  from the tag, stamped from the tag and signed; the web build was built by
  whoever ran the dev server, from whatever they had checked out.
* Trying the tool should cost nothing. No account, no backend, no telemetry
  is the promise; "install first" was the remaining cost.
* The public workflow deploys Lionsville's host; it must not be able to do
  anything else in that subscription, and it must not need a secret to do it.

## Decision Outcome

### 1. `web-<version>.zip` is on every release

The release workflow builds `dist/` on the tag, stamped like the installers,
after the same `verify`, and uploads it as `web-<version>.zip` with a
`version.json` inside saying which release it is. A beta carries it too — the
asset is the build, not a promise about where it runs.

### 2. app.architecture.lionsville.nl runs the newest stable release

A stable release ends with that zip deployed to a static host at that address
— after the README job, so the host never runs a release the README does not
offer, and never a beta, because the README never offers one. The host has no
server behind it: the page is the same bundle, keeping work in the browser's
storage or in a folder the browser hands it (ADR-0022's browser provider),
and nothing leaves the machine.

### 3. The deployment can do one thing

The workflow signs in with the OIDC token GitHub mints for the run, as an
identity that holds *Contributor* on that one Static Web App and nothing
else, reads the deployment token for the run, and uploads. No secret is
stored anywhere; `docs/release.md` lists the five variables. The host's own
rules — the SPA fallback, `application/wasm`, the cache headers — are
`.github/staticwebapp.config.json`, copied beside the build at deploy time
and deliberately not inside it, so the zip stays host-neutral.

## Consequences

* "Running from source" is for changing the tool; running it is a link.
* A release is not done until the host answers with its version; the job
  polls for it and fails the run if it does not.
* Whoever hosts the zip elsewhere needs only a static server with an SPA
  fallback; `version.json` says what they are serving.
