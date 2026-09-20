# Release notes, next version — draft

*What has landed on `main` since 2.2.1 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

**Say what an application uses.** An application's record has a *Uses*
picker beside *Hosted on*: this scope's offerings and service platforms
first, then everything the rest of the organisation marks shared, each with
its scope. Tick several and close — one step, one ⌘Z — and a tick on an
offering from another scope brings its stand-in with the row. *Leverages*
under it is the derived line it always was, and now a door: *Show on
technology landscape* opens the landscape on that card.

**The technology landscape shows what an application says, and takes a
drop.** Hosting lines are drawn: on a scope with places and no offerings
that is the only line an application has, and it was hidden. *Fold hosting
into service lines* folds one away where a use already reaches the same
platform. A *Shared in the organisation* row inside the services band lists
every offering other scopes mark shared, dimmed until something here uses
one; a scope with no offerings shows the band as a strip. And you can drag an
application card onto a platform or an offering: a place takes *Hosted on*,
a service platform or an offering takes *Uses*, the same row the picker
writes. With an application selected, the targets show the two verbs as
buttons.

**Colour the board by one platform or offering.** *Colour by* gains a third
question: pick a platform or an offering, and every application that uses
it, is hosted on it or leverages it is coloured while the rest fade — who
stands on this, rather than what does this stand on.

**For an agent:** `technology.use` sets what an application uses as one
step, stand-in included; `element.describe` says the `uses` rows as written
apart from what they amount to; `diagram.inspect` on a landscape reports the
shared row.
