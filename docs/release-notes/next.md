# Release notes, next version — draft

*What has landed on `main` since 3.7.4 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

- **Moving a scope takes the units that serve it along.** A unit that serves
  the moved scope, or a scope under it, now names the new place, so the
  scopes stay served and keep their type; the agent's `scope.move` lists the
  units it rewrote under `units`. A unit that still serves a place where no
  scope is — after a removal, or a move made before this release — is a new
  finding on the Checks page, *A unit serving a scope that is not there*.
- **A unit and something else under one id.** Where one scope defines a unit
  and another scope defines something that is not a unit — an application,
  say — under the same id, the unit is still read as a unit: it serves
  scopes, sits in the organisation chart and can be picked to serve a new
  scope. The Checks page says the clash on both scopes, *A unit and
  something else share one id*, so a person can decide which keeps it.
