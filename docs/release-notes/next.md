# Release notes, next version — draft

*What has landed on `main` since 3.3.4 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

**The operating model has a page of its own.** The **Operating model** card on
the organisation's home opens the organisation's own design of how it is
organised, in its own words: its kinds of unit — **unit types** — the roles
each holds and how many of each, and what each role is responsible for. A unit
type says where a unit of it may sit, whether it may serve more than one
domain, and how many applications it should own at most. A role has a purpose,
a short name and **Manages its unit**, and the rules say whose role answers
for an application or a domain. The **Responsibilities** tab is a matrix of
responsibilities against roles, where a press takes a cell through R, A, C and
I; a responsibility with no A, or with several, says so and is a finding.
Every change is a step, with ⌘Z, a line in Activity and a history of its own.
Opened over any other scope, the page only reads.

**Four libraries to start from.** The **Libraries** tab offers **Scrum**,
**SAFe**, the **IT4IT** value streams (the seven of its version 3.0) and
**Team Topologies**, each with a version, in English, Dutch and German and in
this app's own words. Tick what you want and press **Bring in**: what an entry
needs comes with it and the tab says so first, nothing comes in twice, and it
is one step that ⌘Z takes out again. What comes in is the organisation's to
rename, rewrite or cut. **Compare with the libraries** says how it differs
from the library as it ships now, and when a library has moved on to a later
version; nothing is ever merged in. The frameworks' names are their owners',
and none of them endorses the libraries.

**A unit is an actor with a unit type.** Choose a type under **Unit** in an
actor's inspector and it is a unit; **Not a unit** makes it a party again. Its
section says where it is filed and which domains it serves, what it owns and
is responsible for, each role with who holds it today — by name, with their
share, *acting* and *you* — and **+ vacant** where a role is short of people,
who manages it, its first and last day with every plan's move of it, and what
the checks find about it. **Assign** is one step in the scope that keeps the
unit: the role, the person, their share, the first day and whether they are
acting. The person picker searches the register and marks you, and its **New
person…** looks for somebody who may be the same person before anyone is
added. Press a holder to correct the assignment, end it with **End on**, or
remove one made by mistake. Promoting, demoting or transferring a unit takes
its assignments with it, in the same step.

**The checks read the organisation.** What the organisation contradicts about
itself is listed with the rest: a role short of people or over its maximum, a
unit filed where its type may not sit, one serving more domains than its type
allows or owning more applications than its limit, someone still in a unit or
a role that has ended, a unit still of a type that has ended, and anyone whose
shares add up to more than all of their time. A unit's section shows those
about the unit, a chart those about the units it draws, and the organisation's
home all of them, for every scope.

**A correction is an edit; a change has a day.** A reorganisation is a plan.
On a plan's page, *Units it moves* puts a unit under a new parent on a day,
and **Move by…** shifts those days with the rest of the plan. The page says
what the plan does to the organisation, shows the units the day before and on
its day, and lists under **Move the people** every assignment in a unit or a
role that ends, each with a suggestion — where the unit went, or the role's
successor — which you accept or change. Nobody's new place is guessed. **Write
as one step** ends each old assignment on its last day and begins each new one
the day after, in every scope that keeps one, together. Unit types and roles
have **From**, **Until** and **Followed by**, and the operating model page
lists what an ending leaves to decide. Looking at another day shows the
organisation on that day: a unit's section reads the day its board is looked
at, and **Look at** on the People page says what a person holds then.

**The organisation chart and the Conway map.** Two new views, made from **+**
in the diagram tabs. An **organisation chart** lays the units out as nested
boxes on its day, a plan's moves included, each role with who holds it: a
dashed **+ vacant** assigns at a press, a red edge marks anybody over all of
their time, and a unit that has ended is still drawn while somebody is
assigned to it. A **Conway map** puts the units over the applications they own
and draws the interfaces between them, solid where the two units have declared
that they work together and dashed where they have not, with a table that
counts them. Its findings are an interface that crosses units with nothing
declared between them, an interaction no interface needs, an application
nobody owns, and a unit that owns more than its type allows. Both are drawn on
a day, look at another with the day control, and have **Find me**, which goes
to your unit. **Works with**, in a unit's inspector, declares an interaction
in one of three ways — **Collaboration**, **As a service** or **Facilitating**
— for the days it holds. A draw.io box that points at a unit opens it on the
scope's chart.

**A register of people, kept outside the history.** **People** on the
organisation's home holds one entry per person: a name, a work address where
you know one, and whether they are of the organisation or from outside it. A
change there is not a step — no ⌘Z, no line in Activity — because the history
keeps a person's id and never their name, so a name that goes from the
register goes from every screen at once. **Add person**, a picker's **New
person…** and each row of **Import CSV…** look first for somebody who may be
the same person: the same address, the same name, a name within two letters,
or the same family name and first initial. **Possible duplicates** lists the
pairs already there, and **Merge** asks first and is final; merging somebody
active into an entry that has left asks which is true, **Still here** or
**Left**. A person's page says what they hold today, will hold and held
before, and **Points at them** lists every record that names them. **This is
me** tells this install which entry is you, so you are marked wherever you
appear, and **Find me** goes to your entry; it is kept with the install, or in
the browser for a folder opened in one, and never in your folder or an export.

**Leaving, forgetting and removing.** **Mark as left** ends a person's
assignments on their last day. After the period the organisation's policy sets
— 90 days unless you change it — their name and address are forgotten and
every screen shows a pseudonym, *Former colleague 7KQM*; after a second period
the entry is removed, and whatever pointed at it reads *a former colleague*.
**Forget now** does it at once, and **Remove now** on an entry already
forgotten; nothing brings a name back. **What we hold** gives everything held
about a person as one document to copy, the answer to a request for access,
and counts the records that name them in text, which a forget cannot reach.
The policy also says whether an agent sees names or pseudonyms, and the app
applies it when the organisation is opened and each day it stays open. A
source that knows who signs in may apply it on its own schedule, mark you by
your account, and offer each change only to whoever may make it. On the
desktop the register is `.lionsville-architecture/people.json` in your folder
and never in its history: no snapshot takes it, and a `git add` typed in a
terminal leaves it out too. The working file carries it, and **Without names**
makes a copy with every person as their pseudonym, no address, and signed
decisions without the names they were signed with. Forgetting travels with the
work: someone forgotten or removed where a file was made is forgotten or
removed where it is opened, and opening a file never gives a name back.

**A field that names a person takes one from the register.** Six fields — an
element's and a plan's **Owner**, **Observed by**, an experiment's **By**,
**Proposed by**, and **Reviewers and signatures** — take a person picked with
**From the register…**, or text as before. While you type a name the field
offers the entries it may be, and a name like one of them is written only when
you leave the field. A person picked is kept as their id and shown as the
register says; text written before stays text, shown as typed and found by a
search. A signature keeps the name it was signed with: it is part of the
decision record and stays when the person is forgotten, shown alone then and
linked to nobody. Where the operating model's rule says an application's owner
is a role of its unit, an application with no owner written shows whoever
holds that role today in the unit it **Belongs to**. Search finds a person
through the register: a name finds the records that point at them, and a
forgotten person is found by their pseudonym.

**An agent works with the organisation and its people.** It reads the
operating model with `unitTypes.list`, `roles.list` and
`responsibilities.list` and changes it with `unitType.add`, `unitType.update`,
`role.add` and `role.update`; makes an actor a unit with `element.update`;
lists who holds what with `assignments.list`, and assigns and ends with
`assignment.add` and `assignment.end`; puts a unit under a new parent on a
plan's day with `plan.move`; reads the organisation's findings of a day with
`checks.list`; makes and inspects an organisation chart or a Conway map; and
declares an interaction with `relation.add`, type `interacts`. Every argument
that names a person takes text or `{ "person": id }`. It lists the register
with `people.list`, adds someone with `person.add` — told first when somebody
similar is there — and marks someone as left with `person.leave`. It sees
names, or pseudonyms where the policy says so, is never told an address, and
cannot forget, remove or merge anyone, or change the policy.

**The folder format is 11.** The operating model is kept under `_operating/`
at the organisation, and each scope's assignments under `_assignments/`.
Opening an older folder brings it up to 11 and moves no scope, so every link
and every path in the history still points where it did; a scope from before
reads as one with no operating model and no assignments. An earlier version of
the app opens a scope written at 11 to be looked at and not changed, and says
to update.

**Share with a link.** *File → Share with a Link…*, and in a browser the same
item in the **⋯** menu, copies a link to the place you are on and shows it to
read or copy again: a scope's home, a view, or a page over it, with the
decision or observation that is selected. Whoever may read the work opens the
same place with it. Where work is kept in a folder, in this browser or nowhere,
there is no address another person could reach, and the dialog says so instead.
A link from a view with an element selected opens with that element selected
again, and a record a link opens on is brought into view and outlined for a
moment. A decision's reader, a plan's page, the readers of an observation,
a cause, a solution and an experiment, and the right-click menu on the
observations picture have **Copy link** for that one record, read-only too.

**A drawing is a view, drawn in draw.io.** **+** in the diagram tabs, then
**Drawing**, makes a view of a new kind, shown as its picture. **Edit** opens
draw.io inside the app — shipped with it and working offline, in the app's
language and following its theme, light, dark or the system's — with the
scope's elements in the palette beside the C4 shapes. A shape made from an
element points at it: on the picture it is an area that opens the element, the
element's inspector and page list the drawings that point at it, and a shape
that points at an element the scope does not hold is a finding. An element's
menu offers **Create drawing**, for a drawing anchored to it, and a
double-click on the element offers the drawings anchored to it. A document
shows a view with `![caption](view:id)`, a drawing as its picture with its
areas. Saving keeps the drawing's XML, its picture and its links as one, in
a working file, a sealed file and a folder alike; somebody else's save while
the editor is open is merged into what is open. An agent can make a drawing,
write its XML and open it.

**The observations page says the same thing the same way everywhere.** The
right-click on a record offers what its reader offers, in the same words and
the same order, with "…" where a question or a dialog follows. The forms name
a field as the reader does: *Where seen*, *Date seen*, *Description*. The
buttons of a question asked before a step are in sentence case, and reopening
a concluded experiment is no longer drawn as a danger. *New observation* and
*New solution* carry an icon instead of a typed "+". Every dialog on the page keeps what is
written in it — a click beside it no longer closes it, nor does Escape once
something is written — Enter in a one-line field answers it, and a button
pressed too early says what is missing instead of being greyed out. *Seen
again* from the new observation form asks the day and a note, *Use this one*
in the cause dialog lets you choose the strength before it links, and an
empty register offers *New observation*.

**A view nobody has laid out yet is laid out for a reader too.** A view the
app or another tool made with no positions in it — a new container view, an
import, an example — is laid out the first time somebody opens it, and that
layout is saved as their step. Somebody who may only read the view got there
first and saw every box on one point, and fitting the view only zoomed in on
the pile, until somebody who may change it had opened it. Now the reader's
screen lays it out the same way, and nothing is saved: the first person who
may change the view still lays it out for everyone, and once they have, the
reader sees their layout. A PNG the reader exports, or a picture an agent takes
of the view for them, shows it laid out as they see it.

**A new observation says who or what it affected.** The form that records a
new observation asks its three questions a field each — what we saw, the
evidence, and who or what it affected — in place of one description with
three headings in it, and the last is required beside the title, the place,
who saw it and the day. The three are recorded as one description under the
same headings, so an observation is read and edited as before.

**Merging has a screen of its own, across the tree, for causes too.**
*Merge…* on an observation or a cause opens a screen over the observations
page in place of the small dialog. Search for the others to merge, in this
scope or, with *Across scopes*, in every scope you can read; choose which
title, place, day and impact the one that stays keeps, and see every link
that moves with it — or why one cannot — before you press *Merge*. Causes
written down twice can now be merged as well, and a merged cause is kept as
history and says where it went. A merge that changes another scope changes it
there, as one step on each scope, all or none; merging from a scope below now
marks the record below as merged in its own scope too. An agent can do the
same: it can ask what a merge would do first, and merge observations or
causes of any scope.

**A new scope made without a board opens on its home.** Unticking *Start with
a landscape board* in the new-scope dialog made the scope, but then opened it
on a canvas with nothing to draw and an error about a missing diagram id. Now
the scope is filed empty and you land on its home, where a board can be added
when you want one.
