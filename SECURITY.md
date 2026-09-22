# Security

## Supported versions

The latest stable release, and only that one. It is the release the README's
download links point at and the one the web build at the hosted address runs.
A fix ships as a new release; older releases are not patched.

## Reporting a vulnerability

Do not open an issue. Either:

- mail **security@lionsville.nl**, or
- open a private security advisory on GitHub: the repository's *Security*
  tab, *Report a vulnerability*.

Say what you found, how to reproduce it, and which version and platform. If
you have a fix, say so; a patch is welcome under the terms in
`CONTRIBUTING.md`, but a report on its own is enough.

## What to expect

- An acknowledgement within five working days.
- A fix, or a written statement of why there will not be one, within ninety
  days of the report. If it takes longer, you hear why before the ninety days
  are up.
- Credit in the release notes if you want it; none if you do not. Say which.

Please give us that window before publishing. We will not take action against
anyone who reports in good faith and does not access, change or keep data that
is not theirs.

## Scope

- The desktop app for macOS, Windows and Linux, as released.
- The web build, as released and as deployed from a release.
- The MCP server the desktop app runs on the loopback interface for a local
  agent, and its token and port handling.

A problem in a dependency installed through npm is best reported to that
project; tell us as well if it reaches this tool through a path of ours. The
source of this repository run from a checkout is in scope where the released
builds would be.
