# Release notes, next version — draft

*What has landed on `main` since 3.7.4 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

- **Moving a scope takes the units that serve it along.** A unit that serves
  the moved scope, or a scope under it, now names the new place, so the
  scopes stay served and keep their type; the agent's `scope.move` lists the
  units it rewrote under `units`. A unit that still serves a place where no
  scope is — after a removal, or a move made before this release — is a new
  finding on the Checks page, *A unit serving a scope that is not there*.
