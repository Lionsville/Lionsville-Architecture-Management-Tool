# Release notes, next version — draft

*What has landed on `main` since 3.6.4 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

**The organisation is not a domain.** A unit kept at the organisation — where
most units are, since the operating model lives there — used to count as
serving the organisation, so a unit whose type serves one domain could not be
linked to its own. Now it serves nothing until you give it a domain: **+
Domain** in its inspector, or **+ Unit** under **Served by** on the domain's
home, both work, and the domain is written alone. The organisation's own home
no longer has a **Served by**. A unit that serves no domain and is responsible
for something a domain defines is now a check, as any unit outside its domain
is.

**A unit and what it serves lead to each other.** Press a domain under
**Serves** in a unit's inspector to go to that domain's home. Press a unit's
name under **Served by** — on a home or in a scope's **Settings…** — to open
it where it is kept, on that scope's organisation chart where it has one.

**Say who serves a new domain as you make it.** **New domain or team…** has a
**Served by** field wherever the organisation has units. The unit picked is
linked once the scope is made; where you may not change the scope that keeps
the unit, the scope is made anyway and a notice says the unit was not linked.
