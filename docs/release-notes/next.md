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

**The sheet names the unit responsible, and goes where it serves.** Every
area, grouping and capability a unit is responsible for now shows that unit
on the business sheet, without turning anything on — with **+1** where there
are more. Press it to go to the home of the domain it serves, or pick one
from a menu where there are several; a unit that serves no domain opens where
it is kept. **Show who is responsible** still adds the other actors, and
marks what nobody is responsible for.

**Say who serves a new domain as you make it.** **New domain or team…** has a
**Served by** field wherever the organisation has units. The unit picked is
linked once the scope is made; where you may not change the scope that keeps
the unit, the scope is made anyway and a notice says the unit was not linked.

**Order the roles from the Responsibilities matrix.** Press a role's heading
to pick it, then press **Move left** or **Move right** in the panel on the
right. Before, you had to pick the role on the **Units and roles** tab first.
