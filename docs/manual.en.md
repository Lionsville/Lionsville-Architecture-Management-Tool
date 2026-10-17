# User manual

Lionsville Architect draws an application landscape in Layer-7 bands and the
C4 container diagrams underneath it. This is the manual for using it. What it is and why it exists is in the [README](../README.md);
this manual is also in [Dutch](manual.nl.md) and [German](manual.de.md).

## Starting

**Desktop.** Download the app for your platform from
[architecture.lionsville.nl/download](https://architecture.lionsville.nl/download).
It checks for a newer version in the background and asks before it does
anything about one — **Download and Install** fetches it while you work,
**Skip This Version** says not this one, and the checkbox in that dialog turns
the automatic check off. When the download is done it asks you to restart;
**Later** installs it the next time you quit. Where the app cannot replace
itself — run straight from the disk image, or from Downloads without being
moved to Applications — it says so and opens the download page instead.
**Check for Updates…** in the Help menu asks on request.

**The menus** on the desktop are in English for now. **File** holds the
folder, the working file, snapshots and history; its items about the open
scope — Save — is greyed out while nothing is open; Open… and Save a Copy of
the Working File… are about the whole organisation and work from every
screen. **Edit** holds Undo, Redo, Delete and Select All, which act on
the app's own undo stack and on the canvas, beside Cut, Copy and Paste.
**Help** holds this manual, in the app's language, the keyboard shortcuts and
the update check.

**Browser.** [app.architecture.lionsville.nl](https://app.architecture.lionsville.nl/)
is the newest release, with nothing installed. You can also run it from a
clone of the repository: `npm run setup` once, then `npm run dev`, and open
<http://127.0.0.1:5200>. Where the browser offers it (Chromium does), a tab
can work in a folder just as the desktop does. Otherwise your work is kept in
that browser; a private window keeps it only as
long as the browser does. *Where your work is kept* says more.

Nothing leaves your machine either way. There is no account, no backend and no
telemetry.

## The organisation screen

The app opens on the **organisation**: a scope like any other, and the one
everything else you keep is filed under. A **scope** is
one document: a name, a landscape, the container diagrams under it, the
decisions, the plans, the business architecture, and everything placed on them.
Scopes **nest**, and every one of them is the same document — the organisation
at the top, a **domain** or a **team** under it, a **landscape scope** under
that, as deep as your work needs. A landscape scope is a scope; a landscape is
also a kind of board, which is a drawing inside a scope.

The screen is the organisation's home rather than a list of documents. A line
under the name says what it is and where things live: as files in the folder,
in this browser, or nowhere yet. Then it has five parts.

![The organisation screen: the name and links at the top, the organisation's own pages as cards, the scopes within it, and the examples last](screenshot-organisation.png)

**Its identity**, at the top: the name, the client if the drawings are made out
to somebody else, how many scopes are filed under it by what each says it is
(*2 domains · 1 team*, in the words of the badges on their rows), when
anything in it last changed, the description, and its links. An organisation
nobody has named yet asks for a name here instead of showing a heading; a
folder goes by its own name until you give it one.

**Its own pages**, as cards. Each says in a sentence what is behind its
**Open**, then counts: **Business architecture** the journeys, areas, functions
and stakeholders the organisation itself holds, and how many functions nobody
has handed to a domain yet; **Decisions** its records by status, naming the
newest; **Roadmap** its plans, and the first thing their dates disagree about;
**Register** every application in the whole folder, how many a domain answers
for and how many are somebody else's; **Technology** every platform service and
platform, and how many are shared; **Operating model** its unit types, roles
and responsibilities, and whether each responsibility has its one accountable
role. A scope that draws has a **Documentation**
card too. Each card opens what it counts; closing the page brings you back
here.

**Served by**, under the cards, wherever the organisation has units — but not
on the organisation's own home, since the organisation is no domain and no
unit serves it: the units that serve this scope, in the order of their types,
each with who holds its managing role today and where it is filed when that
is somewhere else. A unit serves the domains its **Serves** names, or the
scope it is filed in where it names none — unless that is the organisation,
where a unit serves nothing until it is given a domain — and a unit under one
that serves a scope serves it through that one — those are counted rather
than listed. **+ Unit** picks one
from the whole organisation: the list is grouped by unit type, says where each
unit is filed, and narrows as you type; a unit whose type serves one domain,
or that is kept where you may only read, is listed and says why it cannot be
picked. Adding a unit, or **✕** beside one, changes what that unit serves: one
step in the scope that keeps the unit, which is why it is only yours to make
where you may change that scope — a role that manages people does not reach
it. Under the units, the **domain owner**: whoever holds the role the
organisation's *domain owner* rule names, in the serving unit filed highest in
this scope. It is worked out on the day and never kept. Pressing a unit's
name opens it where it is kept — on that scope's organisation chart, picked,
where it has one — and its inspector says the same thing from the other end,
each domain there opening that domain's home again.

**Checks**, a card on every home, opens the **Checks page**: every check the
app makes, by what it is about, with why each matters, how to fix it and
where it finds something at or under this home (*The Checks page*, below).

**Needs attention**, above the cards, when the checks find anything: how much,
by weight — so many **to fix**, so many **to review**, so many **notes** —
each a link to the Checks page, on the first check of that weight that finds
something. A finding marked as intended is not counted. What the checks find
is what the organisation contradicts about itself — a name two scopes both
define, a copy gone stale, an application nobody has said whose it is, a
service used across a team boundary without being marked shared, a service no
platform delivers, a capability a domain proposes, a unit short of people or
over its type's limit, a plan past its end, an interface between two teams
that declared nothing, and on the organisation's own home a unit type that
sits nowhere or a responsibility without its one accountable role. The rest
of *One name across the organisation* below says what each means.

**Scopes within** the organisation, beneath: one row per scope, the children
indented, with a chevron to fold a domain shut, and a badge saying what the
scope says it is. A row says how much is inside it — scopes with boards and
diagrams over the whole subtree for a domain, diagrams for a scope with nothing
under it — and when it last changed. **Order** lists by name or by what you
changed most recently. An organisation with nothing filed under it yet says so
in a sentence. A scope that draws lists its **Boards** above the tree instead,
one row each, and **New board…** offers the same kinds the editor's `+` tab
does: a landscape, a business architecture, an enterprise map or a technology
landscape.

- **Open** on a row goes to that scope's home: its own cards, its boards, and
  the scopes within it, each with a row of its own. A board is opened from its
  row under **Boards**.
- **New domain or team…**, once, at the head of the section, asks for a name
  and files the new scope under the scope whose home you are on; **Filed
  under** in the dialog puts it somewhere else. Where the organisation has
  units, **Served by** in the dialog picks the one that serves it, from the
  same list **+ Unit** offers; it is written when the scope is made, as one
  step in the scope that keeps the unit. Where that is refused — you may only
  read there — the scope is made all the same and a notice says the unit was
  not linked; **Served by** on the new scope's home is where it is set.
- **Settings…** on any row holds its name, what it is (organisation, domain,
  programme, team, landscape scope — a word for the screen, nothing behaves
  differently),
  a client, a description, links, and **Filed under**, which moves it. Its
  **Served by** is the home's, and each change to it is written as you make
  it, not with **Save**; a unit's name there opens it as it does on the
  home, closing the dialog.
- **Delete** removes the scope and everything filed under it, and the
  confirmation says so: its folder on disk, or, in a browser without a folder,
  its records from this browser. A working file you saved elsewhere is not
  touched. The organisation itself cannot be deleted: it is the root
  everything else is filed under.

The chip at the right of the bar says where your work is kept: the folder your
projects are files in, **In this browser**, or **Not kept anywhere**.
**Work from another folder…** beside it points the app at a different folder,
and a browser that has no folder offers **Open folder…** instead.

**Examples**, last. Copying one into an organisation that is empty and unnamed
makes the example *the* organisation. An organisation that is already something
files it under a new scope of its own. That covers anything with a name, a
scope under it, a board or records, and every folder, which goes by its own
name. Either way the copy is yours from that moment, and nothing you do runs
against the example itself.

Renaming a scope relabels it and nothing else — where it is filed is its
address, and renaming is not moving. Moving one changes the address of the
scope and of everything under it, and leaves the content untouched: every
stand-in elsewhere in the folder that pointed into it is carried over to the
new address in the same step, so a move never leaves a trail of stale copies
behind it. So is every cause that explains one of its causes, and every
observation that absorbed one of its observations: they name it by its
address, and follow it. On boot the app reopens the scope you had open.

Seven names are refused, because a scope's own folders use them already:
`diagrams`, `docs`, `decisions`, `transitions`, `observations`, `images` and `logos`.

## One name across the organisation

A name means the same thing everywhere in your folder. The warehouse system is
one system whichever domain draws it, and a capability the organisation names
is that capability wherever a landscape refines it — so each thing is written
down **once**, in one scope, and every other scope that uses it points at the
same one.

**The scope that writes it down answers for it.** That record carries the
detail: what phase it is in and on which dates, who owns it, which vendor sells
it, what it is built on, its operational aspects. Change any of it there and everywhere
that draws it says the new thing.

**Everywhere else holds a stand-in** — a card that draws the thing without
answering for it. A stand-in shows its name with a small **from …** line
underneath saying where it is really defined, and its inspector says the same
with a button to go there. Its name and that line are copies, so they are shown
read-only, and so is everything in the owner's detail; what a stand-in *can*
carry is **its own description** — what the ERP means to the warehouse is a
different page from what the ERP is, and both are worth writing. So are the
colour, the shape and the icon you give it, and where you put it on your own
boards.

Which scope answers for a thing is decided by **depth**: the deepest scope that
writes it down. That one rule works in both directions, which is the point.
Capabilities are written at the organisation and refined downwards, so the
organisation keeps them. Applications are written in the landscape that runs
them, so a domain keeps its own — and an organisation that lists an application
by name before anybody has detailed it is naming a placeholder that steps aside
the moment somebody deeper writes the real record.

### What a finding means

The app never refuses a save over any of this. It reads the whole folder when
it opens — and again whenever the folder changes under it — and reports what it
finds. Each row of the tree on the organisation screen carries its own line.

- **Conflict** — two scopes at the same level both write down the same name.
  Somebody is mid-migration, or two teams named the same thing on the same
  afternoon. Both rows say so, because neither of them is the wrong one. Turn
  one into a stand-in of the other.
- **Drifting** — a stand-in's copy of the name is not what the owning scope
  calls it any more, or the scope it points at has moved. **Refresh** writes the
  copies back in one step, which you can undo like anything else.
- **Undefined** — a stand-in of something nothing in the folder writes down. The
  card is drawn and the line is kept; what it needs is a record somewhere to
  point at.
- **A loose row** — a line that ends on something nothing in the folder holds.
  Kept and drawn as a stub, never dropped by a save.
- **A proposal** — a capability a domain named that no scope above it has. Not a
  fault: it is a conversation with the level above.
- **Without an owner** — a system marked as somebody else's that nobody has said
  whose it is.

One thing on the list is **information rather than a fault**: a record nothing
in its own scope draws — no board holds it, and no drawing there points at it.
A thing can be real, owned and documented without being on anybody's picture
yet, so it is a note, as a proposal is, and never coloured like a fault.

### Reading a list of findings

Every list of findings is the same list: a unit's **Checks**, the
organisation chart's summary, the Conway map's findings, a plan's **Still
open** and the roadmap's **Where the dates disagree**. A home counts its
findings under **Needs attention** and lists them on the Checks page.

- **One row per check**: its weight's mark, its name and how many, folded
  shut. Press the row to see each finding under it, in its own sentence.
- **Three weights**, in this order. **Fix** (a red dot): the model contradicts
  itself or cannot be true, and the fix is in the model. **Review** (an amber
  triangle): probably a gap or a risk, worth a look. **Note** (an *i*):
  information that may well be intended. The line under the list says which
  mark is which.
- **The notes are hidden** behind **Show notes (N)**. What a list has
  unfolded, and whether its notes are shown, lasts while the app is open and
  is never saved.
- **Press a finding to read it**: its sentence, its weight and what it is
  about, **Why it matters**, **How to fix it**, and the actions that fix it
  or open where it is fixed — open the record, the drawing, the unit or the
  two units, the unit type, the plan, the person in People; **Link…**,
  **Accept**, **Assign…**, **End the assignment…**, **Remove the
  assignment**, **Declare an interaction…**, **Remove the declaration**. A list offers the actions it can
  do where it is drawn, and the screen it opens does the rest. **All
  findings** goes back to the finding you came from.
- A finding put right leaves the list, and its explanation with it.
- **Mark as intended…**, under a review's or a note's explanation, says that
  it is meant to be so: it asks why, and the reason may stay empty. The
  finding leaves the list and is listed under **Accepted (N)**, under the
  checks, with its reason and the day it was marked. **Take back** there
  brings it back. A mark is a step in the model, kept in the scope the
  finding is about, so everybody sees it and the Activity list names it;
  marked where that scope is open, ⌘Z takes it back like any other step. A
  mark is about the finding as it is: change what it is about — another unit
  on the interaction, another role accountable — and the finding comes back.
  A **fix** cannot be marked: the model contradicts itself, and the answer is
  in the model. Where you may only read the scope that keeps it, nothing is
  offered. An agent reads the marks and never makes one.

### The Checks page

**Checks** on a home's card, or a count under **Needs attention**, opens the
Checks page over that home: what the checks find at or under it, and on the
organisation's home in the whole tree.

- **Every check, by category** — the landscape, plans and dates, the
  organisation, teams and systems, analysis — with its weight's mark, its
  name and how many it finds, none included: a check that finds nothing is
  still worth knowing about. Fix before review before note within each.
- **Show** on the bar picks the weights shown. The notes are hidden until you
  show them, as in every list, and what you choose lasts while the app is
  open.
- **Pick a check** to read it: its weight and category, **Why it matters**,
  **How to fix it**, and **Found (N)** — every finding of it, each in its
  scope. Pressing one opens it where it is fixed: the record, the drawing,
  the plan, the operating model's page, a person in People. **Mark as
  intended…** beside a review's or a note's finding marks it from here, in
  the scope that keeps it, and **Accepted (N)** lists what was marked, each
  with **Take back**. An assignment in a unit that is not there offers
  **Remove the assignment** beside it, written the same way: no unit is left
  to fix it from. A mark made here, with nothing open, is that scope's
  step and is not on an undo stack: **Take back** is how it is undone.
- What the page counts comes from what the app already holds about the whole
  tree: the findings between scopes, the organisation's units and people,
  every scope's dates, and the Conway map over the home. A few checks read a
  scope's whole document — a record on no view, the owner's detail on a
  stand-in, a line to nothing, a drawing's link, the business layer's two, a
  cause explaining an observation below — and are found where that scope is
  open: the page lists them with their explanation and says *Not counted
  here* rather than a number.

### The register

**Register** on the organisation screen is every application in the whole
folder, on one page. Nothing writes it: it is read from the scopes themselves
every time the folder is read, so it cannot drift from what the folders say and
there is no list for two domains to edit at once.

Each row says what the application is called, **which scope answers for it**,
whether it is somebody else's and whose, **how many scopes draw it** (hover the
count for their names), and the findings about it as small chips. The filter box
searches the name, the key and the scope; **By name** and **By scope** are the
two orders. **Open** enters the scope that answers for the application with the
card selected, which is where its detail can be changed.

A row that says two scopes both write the name down offers **Link…**: it opens
the scope whose record should give way and asks there, because a record is only
ever changed by the scope that holds it.

### Moving a record between scopes

Where a thing is written down is a decision you can change afterwards. Select
the card and press **Move…** in the inspector; the dialog offers whichever of
the four apply.

- **Link** — give up this scope's record and stand in for one another scope
  already holds. This is what settles a conflict, and what a card drawn before
  anybody wrote the real record needs. This scope keeps its own description,
  its colours and where the card sits on its boards; it gives up the detail,
  which the other scope answers for from then on.
- **Promote** — move the record up to a scope this one is filed under, and
  leave a stand-in here. What an application drawn in a landscape needs when the
  domain above should be the one answering for it.
- **Demote** — the reverse: move it down to a scope filed under this one.
- **Transfer** — move it to any other scope. **Keep a stand-in here** is ticked
  by default; untick it and this scope stops drawing the thing altogether.

**A unit takes its people with it.** Promoting, demoting or transferring a unit
moves every assignment kept for it, in the same step — the ones that have ended
too, because who held its roles belongs with the unit — under the ids they had,
so each person's past stays theirs. A stand-in left behind holds none. The
confirmation says how many go.

The last three write **two scopes**, so they ask first. The scope it is going to
is written before this one changes, which is deliberate: if something goes wrong
halfway you are left with the record in *both* places — a conflict you can see
and settle with **Link** — rather than in neither.

That is also why **undo stops there**. ⌘Z takes back everything you have done
since, and then refuses that step with a line saying why: only half of it is on
this window's stack, and the other half is a file in a scope nothing here speaks
for. To put it back, move the record again the other way.

A move is refused, with the reason, when the scope it would go to already
answers for the name, when a promotion names a scope this one is not filed
under, and when removing the record would leave things filed under it with
nothing to sit in.

## People

**People** on the organisation's home is the organisation's register of
people: one entry for each person, with a name, a work address where you know
one, and whether they are of the organisation or from outside it. Nothing
else is kept — no notes, no photo.

The register is kept **outside the history**. A change here is not a step:
there is no ⌘Z for it and no line in Activity, and the page says so under
**About the register**, at the end of its one line of introduction. That is
what lets a name be forgotten. The history keeps a person's id, never their
name, and every screen asks the register for the name when it draws one —
so when a name goes from the register, it goes from every screen at once.

- **Everyone** is listed with their kind, their state and the **roles
  today** they hold — on one line, the first role in its unit and how many
  more (the person's **Holds today** has them all), and *none* for whoever
  holds nothing, so they stand out — and searched by
  name, address, or a role or unit they hold; **Show** narrows the list to who
  is active, who has left, or who is forgotten. The column reads the day the
  page is looked at (**Look at**, below).
- **Add person** asks for a name, an address and the kind. Before anyone is
  added it looks for somebody who may be the same person: the same address,
  the same name (whatever the case, accents or spacing), a name within two
  letters — *Pia Schultz* finds *Pia Schulz* — or the same family name and
  first initial. **Use this one** takes the entry that is there; **Add
  anyway** makes a second, which you can merge later.
- **Possible duplicates** are the pairs already in the register that may be
  one person. They are folded every time the page opens, as one line: how
  many, how many by each sign, and **Review**. Open, each pair is one row,
  strongest sign first — the same address, the same name, nearly the same
  name, the same family name and initial — with the two people side by side
  and what tells them apart: the first role they hold today and how many
  more, the work address, *External*, and *account* where a source that
  knows who signs in says the entry is linked to one. The fold is gone when
  no pair is left.
- **Not the same person** answers that the two are two people. The pair is
  no longer offered, and correcting either no longer warns of the other;
  adding somebody new still checks against both. The answer is kept in the
  register, outside the history like the rest of it — the two ids and the
  day — and travels with the register in a working file, one made without
  names too. **N answered as not the same person**, under the list, shows
  the answers, each with **Take back**, after which the pair is a possible
  duplicate again. Forgetting or removing either person drops the answer;
  merging either into a third entry carries it to the entry kept, unless
  that entry is the other of the two. No agent answers it, as none merges.
- **Merge…** asks first which entry is kept — the one linked to an account,
  then the one with more assignments, is chosen to start with, and you can
  choose the other — and is final: one entry is kept, and the
  other becomes a redirect with no name, so everything that pointed at it
  shows the one kept. Merging somebody active into an entry that has left
  asks which is true. **Still here** clears the leaving: the entry kept is
  active again, and the policy stops counting down to forgetting the name.
  **Left** ends the roles of the entry merged away on the leaving day, as
  **Mark as left** would — one that began after that day is taken away,
  because a role never ends before it began — and the question says how
  many of each first. *Still here* is chosen to start with where any of those
  roles began after the leaving day.
- **Import CSV…** takes a list — pasted, or a file — with a name, an address
  and *internal* or *external* on each row, separated by commas or
  semicolons. Every row goes through the same check: one that is plainly
  somebody already there adds nobody, one that only may be is flagged and
  added only where you tick **Add anyway**, and the rest are added.
- **A person** shows who they are and where they are in leaving, and what
  they hold across the organisation: **Holds today**, **Will hold** and
  **Held before**, each a role in a unit (see *Units and the people in them*).
  **Look at** says the same on another day — after a reorganisation, say —
  and **Back to today** returns; looking writes nothing.
  **This is me** tells this install which entry is you, so you are marked
  wherever you appear; it is kept with the install — for a folder opened in
  a browser, in that browser — never in your folder or in anything you
  export.
  **Find me**, on the bar, then shows the whole list with your entry chosen.
  **Correct…** changes the name, the address or the kind, and says who the
  corrected entry may then be the same person as — never somebody it was
  answered as not being.
- **Mark as left** takes their last day. Their name is still shown until the
  policy forgets it.
- **Forget now** asks first, then takes the name and the address away for
  good: from then on every screen shows a pseudonym, *Former colleague 7KQM*.
  The register keeps no history of a name, so nothing brings it back. A
  signed decision keeps the name it was signed with, shown there alone:
  nothing links it to the forgotten entry.
- **Remove now**, on an entry already forgotten, takes it out of the register;
  whatever pointed at it reads *a former colleague*.
- **Points at them** lists every record whose fields name the person by id —
  an element or a plan they own, an observation they saw, an experiment they
  run, a decision they proposed or signed — with the scope that keeps it, and
  what the operating model's rules make them own today (see *Fields that name
  a person*). A signature that kept their name says the name it was signed
  with — except on a forgotten entry, which says only that the signature
  exists, so the name as signed is never shown beside the pseudonym. **What
  we hold** does the same.
- **What we hold** shows everything the register holds about a person, and
  what points at them, as one document to copy: the answer to a request for
  access. A request to erase it is answered with **Forget now**. It also says
  how many records name the person in their text — words typed into a field
  rather than a person picked, which a forget cannot reach and a search
  finds.

**The policy**, at the foot of the page, is a setting of the organisation's,
not a step: how long a leaver's name is kept (90 days unless you change it),
how long the forgotten entry is kept after that (730 days), and whether an
agent sees names or pseudonyms. Whoever may change the organisation's
settings sets it — on the desktop, whoever keeps the folder. The app applies
it when the organisation is opened and again each day it stays open: a name
kept past its period is forgotten, an entry kept past the next is removed.

Where the organisation is kept by a source that knows who signs in to it, the
source may do two of these itself: it applies the policy on its own schedule,
and the app then forgets nobody when the organisation is opened; and it knows
which entry is you, by your account, so you are marked without **This is me**,
which is then not offered.

Such a source may also know who may do what. The page then offers each
change only to whoever may make it: **Add person**, **Correct…** and **Mark
as left** perhaps for the people of your own units only, and **Merge…**,
**Forget now**, **Remove now** and the policy only to the organisation's
administrators. **Not the same person** and **Take back** are offered to
whoever may merge the two, and, where the source gives a managing role the
right to change its people, to a manager whose units hold both of them
today. Where it keeps a work address from you, the page says *an
address not shown to you* rather than that there is none. Marking somebody as
left may end their assignments there and then; the page says how many. And
where its schedule did not forget somebody whose day had come, because their
account signed in after their last day, the page says so beside their state,
and whoever may forget them decides.

On the desktop the register is the file `.lionsville-architecture/people.json`
in your folder. **It is never in the folder's history**: no snapshot takes it,
and a `git add` typed in a terminal leaves it out too, because a name in a
commit is a name nothing can forget. A copy of the folder taken through git
therefore carries ids and no names; the working file carries the register.
The answers *not the same person* are in the same file. A version of the app
from before them reads the people and leaves the answers out, and when it
next changes the register it writes the file without them: the pairs are
possible duplicates again, and nothing else is lost.

### Fields that name a person

Six fields name a person: an element's **Owner**, a plan's **Owner**, who saw
an observation (**Observed by**), who runs an experiment (**By**), and who
proposed a decision (**Proposed by**) and who signed it (**Reviewers and
signatures**). Each takes a person from the register, or text as it always
did — a name, initials, a team.

- **From the register…** beside the field opens the register's picker:
  search by name, pick someone, or **New person…**, which looks for somebody
  who may be the same person before anyone is added, as **Add person** does.
  While you type a name, the field offers the entries it may be under **In
  the register:**; pick one to point at them rather than write the name. A
  name like one in the register is written only when you leave the field,
  so a name typed to find somebody never lands in the history.
- **A person picked** is kept as their id. The field shows what the register
  says: their name, or *Former colleague 7KQM* once they are forgotten, or *a
  former colleague* once the entry is removed. A merged entry shows the one it
  went into. The cross takes the person off the field.
- **Text** stays text. Text written before the register existed is still
  there, still shown as typed, and still found by a search; a forget does not
  reach it, and **What we hold** counts it.
- **A signature keeps its name.** When a person picked as a signer gives a
  verdict, the name they had that day is written beside their id, and the
  proposer's name is fixed the same way once anybody has signed. That name is
  part of the decision record: the decision shows it after the person is
  forgotten, where every other screen shows the pseudonym. An agent the
  policy gives pseudonyms is told the pseudonym here too, and that the name
  as signed is withheld from it. Once the signer is forgotten or removed,
  the signature links to nobody: the decision shows the name as signed alone,
  even while the record is still being written; no screen shows it beside
  the pseudonym; a search for the pseudonym no longer finds the decision; and
  an agent is told the name as signed with no id.
- **An application's owner can follow a role.** Where the operating model
  has the rule *an application's owner is a role of its team* (see *The
  operating model*), an application nobody wrote an owner on shows the
  people who hold that role, today, in the unit it **Belongs to** — worked out
  on the day and never stored, so it changes when the person in the role
  does. A name written in **Owner** wins. **Belongs to** is asked of every
  application: for one of the organisation's own, it is the unit it belongs
  to.
- **A stand-in** carries no owner of its own; it shows the owner its master
  names, by the same id.
- **Search** finds a person through the register: a name finds the records
  that point at the person, and a forgotten person is found by their
  pseudonym and no longer by their name.

## Where your work is kept

Your work is kept in one of three places, and the organisation's home says
which in the line under its name:

- **a folder**: the desktop's, or a browser tab's where the browser offers one;
- **this browser**: a tab with no folder;
- **nowhere**: a tab where the browser's storage will not open.

The working file (see *Saving, exporting, sharing*) carries your whole
organisation from any one of them to any other.

### A folder

The first time the desktop app runs it asks for a **folder to work in**, and
everything you make lives there as files you can read:

```
<your folder>/
  scope.json                          the organisation: its name, client, links
  acme-logistics/                     a scope under it
    scope.json                        the same file again, one level down
    warehouse-landscape/              and again
      scope.json                      what it is called, and what it holds
      model.json                      the elements and the lines between them
      diagrams/landscape.json         what a diagram is
      diagrams/landscape.geometry.json     where its elements sit
      docs/warehouse.md               an element's description, as prose
      decisions/0007-one-writer.md    a decision record
      images/floor-plan.png           a picture a description shows
      logos/own.svg                   a logo you uploaded
```

A folder holding a `scope.json` is a scope, and the folders inside it that hold
one are the scopes under it. Move a folder in your file manager and the scope is
at its new address. A folder you have not named yet goes by the folder's own
name.

**A folder from an older version opens.** The first time this version sees one
it converts the whole tree (`project.json` and `group.json` become
`scope.json`). On the desktop, where the folder is a git repository, it
records what the folder looked like first. Running it again does nothing.

Nothing is hidden inside the app. Put the folder in OneDrive, in Dropbox, on a
network share or in a git repository and it behaves the way anything else there
does. **Work from another folder…** on the organisation screen moves you to a
different folder; the folders you have used before are in **File ▸ Open Recent
Folder**, each under the name its organisation gives itself.

**Everything is written as it changes**: three seconds after you stop editing,
when you leave the window, and when you close it. Only the files that actually
changed are rewritten, so moving one element rewrites one small file and
nothing else. Closing a window with unsaved work saves it first, in every
window; the app asks only if that save did not work.

**Bringing your browser's work along.** If this browser kept work before you
chose a folder, choosing one asks **Bring your work into this folder?**:
- **Copy my work in** copies every scope the browser kept into the folder. The
  dialog stays open until the copy is done, then says how many scopes were
  copied, which could not be, and which it left alone because somebody changed
  them meanwhile. Scopes that could not be written are offered again with
  **Try again**, and again the next time you choose that folder.
- **Open the folder as it is** leaves both where they are.

Nothing is deleted either way; the browser keeps its copy.

**A folder with a remote.** Where the folder is a git repository with a remote,
*Preferences* has two switches for this folder on this machine: **Pull from the
remote when this folder is opened** and **Push after every snapshot**. When the
folder and its remote have both moved on, a strip offers:
- **Take theirs**: the remote's version stands, and ours is kept on a branch
  of its own;
- **Keep ours**: ours stands, recorded as a merge on the branch you are on.

Either way, what is open is written first.

**The folder's own git settings.** The app runs git with your own git
configuration. A folder's `.git/config` may set what a repository needs, such as
its remotes, its branches and who commits. A program it names, such as an
editor, a pager, a signing program or a filter, is replaced by your own value or
git's default, and settings only for commands the app never runs, such as a
merge or diff tool, are left alone. A few settings cannot be replaced and are
refused: git's own proxy command, the upload-pack and receive-pack programs, a
pager for one command, an address rewrite and a cookie file. In a folder that
sets one, a snapshot, a label, a pull or a push is refused, and the notice names
the setting, quoted in English as git reports it, as in *The snapshot could not
be taken: git was not run in this folder: its configuration sets
http.cookiefile, …*. The same goes for git-lfs set up for that folder alone
(`git lfs install` sets it up for you, and then it runs), and for a remote that
is a folder inside the working folder.

A browser tab can work in a folder too, where the browser offers it (Chromium
does). The permission rarely survives a restart, and asking for it needs a
click. So a tab only picks a remembered folder back up when the permission is
still granted, and otherwise starts in this browser without a word. The
desktop is the one that is made to choose.

### This browser

A tab with no folder keeps your work in this browser, for this site. The chip
on the organisation's home says **In this browser**, and your work stays there
across restarts until you or the browser clear the site's data. After the
first save, the app asks the browser to keep it through a clear-out; some
browsers, Firefox among them, put that question to you. Browser storage is
small, so the app says once when
it is about four fifths full: a browser stops saving without asking. If
another tab still has an older version of the app open, or the app was
updated in another tab, a strip says what to close or reload before saving
works again.

**Work an older version kept.** Earlier versions kept a browser's work
somewhere else in it. That work is brought over at every start: copied, never
moved, and never over work done here since. Where a scope changed in both
places, a strip asks about that scope: **Bring the older copy over** (what is
here goes into the history first) or **Keep what is here**.

**A private window** keeps your work only as long as the browser does. Most
browsers open their storage there too, so the chip says **In this browser**,
and everything goes when the window closes. The app cannot tell that the
window is private: save a working file to keep your work.

**Where the browser's storage will not open**, the app works from memory and
nothing you change is kept. A strip on every screen says so. The chip on the
organisation's home says **Not kept anywhere**, in the warning colour. The line
under the name says *Everything here is kept nowhere yet — save a working file
to keep it.*, and the first snapshot says *Snapshots are kept for as long as
this tab is open, and go with it.* Work an older version kept in this browser
is shown. Save a working file before you close the tab.

If the browser's storage has not answered within a few seconds, the page is
drawn anyway. A strip says so, and your work appears when the storage answers.

### When it changed elsewhere

A scope can change while you have it open: a colleague's checkout, a sync
client, you on another machine or in another tab. The bar then says **Changed
elsewhere**, or **Changed here and elsewhere** when you have unsaved changes
too. A strip above the canvas asks which version stands:
- **Take theirs** reads their version and puts it on screen.
- **Keep mine** replays your changes onto their version, so their edits to
  things you did not touch survive. Only where that is refused does it write
  the whole scope as it is on your screen over theirs.
- **Save a copy of the working file…**, with unsaved changes here, puts yours in a working file
  first and leaves the decision for later.

Nothing is overwritten without asking.

### When a scope cannot be read whole

If part of a scope cannot be read, because a file of it is damaged or was
changed by hand, the scope opens to be looked at and not changed, and a notice
names what could not be read. Where you may write where the scope is kept, it
offers **Bring in a working file…**, and **Put back from the history…** where a
history is kept; in a folder it also says you can mend the file and open the
scope again.
- **Put back from the history…** opens the History page, where **Put back the
  whole scope…** makes all of it what it was at the snapshot you chose. What
  could not be read is kept first, as an entry of the history or set aside
  beside the scope, and where it cannot be kept, nothing is put back.
- **Bring in a working file…**, or opening one onto the scope, puts it back
  from the file the same way, and the question before it says so.

An entry that kept what could not be read offers **Save what could not be
read…**, which saves it as a file of your own. A scope that a later version of
the app wrote opens to be looked at only: the notice says to update the app,
and nothing here puts it back.

## History

Every place keeps a history of your work. **Snapshot…** in the File menu (on
the web, the **⋯** menu) offers a message already written from what you did,
such as "Changed Warehouse Management, Moved 3 elements", which you can edit
before it is recorded. The first snapshot asks you to **Start keeping
history**, and says where it will be kept:
- in the folder itself, using git;
- in this browser, for a tab's folder (nothing is written into the folder for
  it) and for a tab with no folder;
- for as long as the tab is open, where the browser's storage will not open.

Nothing leaves your machine, unless you turned on **Push after every snapshot**
for a folder with a remote. On the desktop the history needs **git** 2.26 or
newer on the machine: without it, a snapshot is refused with a sentence saying
so, and everything else works as before.

**History…** lists every snapshot. Choosing one shows what has changed since it
— applications added, removed and altered, connections drawn and cut, decisions
taken — with the geometry as a count rather than a list, because a tidy pass is
one sentence and four hundred changed lines. A move is an entry too, *Moved from
X to Y*, in the history of every scope it moved.

**The history of one thing.** The picker at the top of the History page narrows
it to a diagram, a description or a decision: the list becomes the snapshots
that touched it, and the changes the rows about it. The same page opens already
narrowed from **History…** on a diagram's tab menu, on the documentation page,
and on a decision's page.

A description is the one subject that is not one scope's business: a name means
the same thing everywhere in the organisation, so an element's page is written
where it is defined *and* wherever a scope draws it and says what it means
there. The history of that element is the union of those pages, and a line
under the picker names the scopes it is reading. Restoring one stays this
scope's: it puts back what this scope's page said, and the others are theirs to
restore.

**Restore.** With a snapshot chosen, **Restore this version…** makes the
diagram, description or decision what it was then; with the whole scope
shown, **Restore the whole scope…** does the same for everything. A restore
is a new change on top of everything that happened since, not a step back: the
history keeps growing, the Activity list says *Restored the diagram Warehouse
as of 3 Sep*, ⌘Z undoes it, and the next snapshot records it. The app offers
that snapshot on the spot. A decision that has been accepted, rejected or
superseded stays as it is — write a new one that supersedes it — and a
restored diagram leaves out elements that no longer exist, and says how many.

**Labels.** **Label…** on a chosen snapshot gives it a word of your own —
"Shown to the board" — shown beside its message, never instead of it. A label
travels with the history, so a colleague sees the same mark in the same place;
in the desktop's folder it is a git tag, which any git client shows. Two labels
with the same name are refused, anywhere in a folder and within one scope in
a browser; pick another word.

**Snapshots the app takes itself**, where a history is kept: before a working
file replaces what is here, before a scope is put back from the history, and, on
the desktop, before a folder is pulled from its remote and before a folder from
an older version is converted. Each is named for what it came before, so what
was there can be restored.

## The workspace

One open scope: a bar at the top, the editor below it.

| In the bar | What it does |
|---|---|
| **The crumbs** | The organisation, each scope between, and the open one in bold; each is a way to that scope's home, and the organisation's name is the way back to the first screen |
| **Settings…** | This scope's name and where it is filed, and its defaults: the author named on an exported diagram, and the operational aspects a new landscape starts with. Moving a scope files it under another one and leaves its content untouched |
| **⋯** | In a browser, the menu: **Open folder…** where the browser offers one, **Open…**, **Save**, **Save a copy of the working file…**, **Share with a link…**, **Snapshot…**, **History…**, **Connect an agent…**, the theme, **Preferences…**, and under Help **User manual**, **Keyboard shortcuts…** and **Get the desktop app**. On the desktop the same items, but the last, are in the menu bar — in Title Case, as a menu bar has them — with **Preferences…** as **Settings…** in the app menu on macOS |
| **Activity** | What has changed in this scope since you opened it — a list of named steps with the time each was taken, and the moves, *Moved from X to Y*, with who moved it, read from the history, so they include moves from before you opened it. It stays with the scope wherever it moves. Read-only: ⌘Z is how you go back |
| **Saved · hh:mm** | Where the scope stands: the time it was last written, or **Unsaved changes**, **Saving…**, **Changed elsewhere**, **Changed here and elsewhere**, **Not saved — storage refused** |

Everything is saved automatically as you work: three seconds after you stop, on
leaving the window, and on closing it. Closing with unsaved work saves it
first: the desktop asks only if that save did not work, and a browser tab asks
before it closes. In a browser without a folder, the app says once when its
storage is
about four fifths full. That is the only warning you get, because a browser
stops saving without asking. If a save is refused, the bar says **Not saved —
storage refused** and the editor keeps working. Where the browser's storage will
not open, a strip says so from the start. In either case, save a working file,
because
otherwise the work is gone when the tab closes.
Every notice (saved, loaded, failed) appears in that bottom bar.

**Language.** The language button at the right of the editor's toolbar
(it shows the code of the language you are in: NL, DE or EN) opens a
menu of the three: Nederlands, Deutsch and English. Choosing one switches
the whole interface: menus, dialogs, tooltips, band names, error messages and
the title block of a PNG export. The first time, the browser's language
decides. The design itself does not change; element names are content, not
interface. Frysk was offered until 26 September 2026; if you had chosen it,
the app now opens in Dutch.

### Back and Forward

**Back goes to the place you were before**, and Forward goes to the place you
came back from. A place is a scope's home and the page on it, or an open scope
on its view or on the page over it: its decisions, its observations, its
roadmap, a plan, a platform's or a service's report. Every move to another
place is a step, whether you made it with the tree, a crumb, a card, a search
hit or a link on a page, or an agent made it for you. So after an agent has
opened a scope, Back takes you to where you were. What is selected, the day a
board is shown on, a filter and an open dialog are not part of a place, and
choosing another record on the decisions or the observations page, or another
tab of the observations page, is not a step either: the address names the tab
that is up, so a reload stays on it. Back is not undo: it moves the screen and changes nothing, and
⌘Z is still how a change is taken back.

**In a browser** the browser's own Back and Forward do this, with their keys
and gestures. The address names the place you are on, after a `#`, so a reload
stays there, and an address copied from the bar opens the same place for anyone
who may read it. The rest of the address is left as it was.

**In the desktop app** the bar starts with a **‹** and a **›** button (after
the window's buttons on macOS), greyed out when there is nowhere to go. The
same moves are in the **Go** menu as **Back** and **Forward**, on **⌘[** and
**⌘]** on macOS and **Alt+←** and **Alt+→** on Windows and Linux. The mouse's
back and forward buttons work too, and so does swiping between pages on a Mac
trackpad when it is set to *Swipe with two or three fingers* (System
Settings → Trackpad → More Gestures → Swipe between pages). They all work from
the organisation's home as well as with a scope open. While a dialog is open
the buttons are behind it, and the keys, the menu items and the mouse buttons
do nothing. The history belongs to the window: it is gone when the window
closes.

**A dialog is closed by Back** when the page it was opened on is left, as when
you leave that page any other way. Text typed into it is not kept.

**A place that is no longer there** is replaced by the nearest one that is: a
removed view opens its scope on the first view it has left, a removed record
opens its page without a record, and a removed scope opens the home of the
nearest scope above it. The Activity list says what was removed.

### Share with a link

**File → Share with a Link…** (in a browser, **Share with a link…** in the **⋯** menu) makes a link
to the place you are on, copies it, and shows it in a small dialog, where it
can be selected and copied again with **Copy link**. *Link copied* is said once
the copy has been made. The link is the address of where the work is kept with
the place after a `#`, the same way the browser's address names it: a scope's
home, or an open scope on its view or on a page over it. On the decisions and
the observations page it names the record that is selected, and on the
observations page the tab that is up, so the person who opens it lands on
that record — choosing another record is still not a step for Back. Anyone who
may read the work opens the same place with it; somebody who is not signed in
yet signs in first and lands there after.

**On a view, the link selects what you selected.** Share from a board, a
sheet, an enterprise map or the technology landscape with one element
selected, and the link opens that view with the element selected again; on a
sheet and a map it is also outlined for a moment. A record a link opens on — a
decision, an observation, a cause, a solution or an experiment — is brought
into view and outlined the same way, in the list or in the picture.

**Copy link on one record.** A decision's reader, a plan's page, the
readers of an observation, a cause, a solution and an experiment, and the
right-click menu on a node of the observations picture each have **Copy
link**: a link to that record, whatever else is on screen, made, copied and
shown the same way. It is there when the work is read-only too, since reading
is what a link is for. A record of a scope below links to that scope's own
page.

**A link needs an address somebody else can reach.** Work kept in a folder, in
this browser or nowhere at all has none, so there the dialog says why there is
no link, and nothing is copied. The menu item works from every screen, the
organisation's home included.

## Drawing

**The landscape** has five bands: actors, input channels, external systems,
the application landscape and the management layer. Drag an element from the
palette on the left into a band, or right-click the canvas and **Add here**.
Bands resize by dragging their edge.

**Domain groups** box the applications that belong together. Add one from the
palette or from the canvas menu, give it a colour, drag applications in, tidy it
on its own. Removing a group leaves its elements where they are.

**Container diagrams.** An application can have a container diagram
underneath it: the application becomes the boundary of that diagram and its
components sit inside. You make one on purpose — right-click the application
and choose **Create container diagram**, or press the button of that name on
the inspector's General tab — and it is a step in Activity like any other, so
⌘Z takes it back. A card that has one carries a small mark; double-click the
card to open it. Double-clicking never creates one. A landscape tab lists its
container diagrams under a chevron: right-click an entry there, or press the
chevron after the name once the diagram is open, to rename it, open its
**diagram settings** or delete it. Deleting one takes its components with it
and keeps the application. Right-click a landscape tab for the same menu, with
duplicate as well. **Back to landscape** returns to the view exactly as you
left it.

Where those containers run is drawn around them: dashed **deployment boxes**,
one per platform, nested the way the platforms nest — the namespace inside the
cluster inside the account — with a container that runs on nothing outside
every box. They are worked out from the rows and cannot be moved: a box is
where its members are. The **deployment** button in the toolbar takes them
away for a reader who wants the plain C4 picture, and the view remembers.

**Finding things.** ⌘F / Ctrl+F opens the finder: type a name, category,
vendor or technology, Enter or a click selects the element and the canvas
scrolls to it, switching diagram first if it has to. The palette has its own
search, in both languages.

**Panels.** Drag the edge between a panel and the canvas to resize it,
double-click the edge for the default width, use the chevrons to collapse a
panel to a rail. The minimap button in the toolbar shows or hides the corner
map.

**Keyboard.** Tab walks the elements on the canvas, Enter selects the focused
one and Shift+Enter adds it to the selection. The arrow keys nudge the
selection by a grid step, Shift by one pixel. `?` shows every shortcut.

Lines and the names of domain groups are in the same walk, and Enter selects
them too; Shift+F10 opens the menu of whatever is selected, and Enter on the
element that is already selected opens its documentation. To draw a line
without the mouse, choose **Start connection to…** from an element's menu, Tab
to the other end and press Enter. On a landscape tab, ↓ lists its container
diagrams and Shift+F10 opens the tab's menu. Resizing an element, a band or a
group, moving a group and bending a line still need a pointer.

## Elements

Seven kinds: application, component, external system, input channel,
management tool, actor, and the domain group that holds them — and, since
the physical view, a **platform**: a cluster, a broker, a bus, the tooling,
what the applications run on and what they use. Select one and the
**inspector** on the right shows its fields in three tabs.

- **General.** Name, category, vendor, technology, lifecycle (planned, live,
  retiring, retired; shown as a badge, retired elements dim), whether you
  manage it, the description (see *Documentation*), and where it sits.
- **Appearance.** Accent colour, shape, icon, icon size.
- **Data.** The **operational aspects** of an application: for each column of this
  diagram, managed, partial, none or at risk, with a note. The columns are set
  per diagram in its settings.

**Icons.** Around a hundred built-in marks, searchable by name, category and
keyword in both languages, in two sizes: small in the header, large leading the
card for a diagram read from a distance. **Upload a logo** in the picker adds
your own SVG or PNG (up to 200 kB). Uploaded logos travel in the working file.

**More than one at a time.** Select several elements and the inspector offers
lifecycle, colour, icon and domain group for all of them, one undo step each.

**Change kind.** Right-click an element, **Change kind ▸**, and pick what it
should have been; connections, description and place stay. Two cases are
refused with the reason: an application that has a container diagram, and a
component still attached to an application.

Elements belong to the model, not to a diagram: one element can be on several
diagrams, and **Remove from diagram** is a different action from **Delete from
model**. Deleting asks first, and says how many connections go with it.
Deleting a unit takes every assignment in it along, ended ones included, as
if they had never been made: the question names who stops being what —
*Ada Lovelace stops being Product owner in Webshop.* — and one undo puts the
unit and its people back. To keep who held what, end the unit on a day
instead: its lifecycle, or a plan (*Change over time*).

The question about a unit starts there: *Ending it is usually what is
meant*, with **End on a day…**, which asks for its last day and ends it
without deleting anything. Under **Delete** it says what goes with it, in
short lines. **Inside it** names the units filed under it, here or in another
scope, and where they go: up into its parent where their type may sit there,
with **Other choices** folded beneath; where it may not, into another unit of
its type, picked from a list, with **Move them up** marked *would show as
misplaced* and **Delete them too**, which takes everything under them and
their people's assignments as well. Applications that name it as their team
are cleared and show as owned by nobody, and its links to the domains it
serves and the capabilities it is responsible for go with it, wherever they
are kept. It is one change: where another scope is changed too, that scope's
part is its own step, and the step here cannot be taken back with undo.
Deleting any actor moves what sits in it up into its parent.

## Connections

Drag from one element's handle to another, or right-click and **Start
connection to…**. A connection carries a label, a protocol (whatever you type:
REST, EDI, Kafka), a technology, a direction that sets the arrowheads, a colour
and a line style. Double-click the label to edit it in place.

**Where an interface lands.** The landscape draws one line per interface, and
where it arrives is a level down. Open the application's container diagram and
grab the end of the line where it meets the boundary box: drop it on a
container and the interface lands there, taking its protocol with it. Grab it
again to move it to another container, or drop it back on the boundary to take
the landing away; **Lands on ▸** on the line's menu does the same without
dragging. A second landing is a second line — draw one from a context box to a
container, and the inspector asks at the top which interface it is part of,
with the one running that way already ticked.

Once an interface has landed it shows *Detail: 2 interfaces on the container
diagram · REST, AMQP* in place of its own protocol field, because the
protocols are the landings' — and **Open**, or a double-click on the line
itself, goes there. Container lines you draw without saying what they are part
of are interfaces of their own; the roadmap's findings offer to draw the
application line for them (see *What the dates disagree about*).

Lines are routed around elements by a real router and re-route when something
moves. When automatic is not what you want:

- Drag a **pill** in the middle of a segment to shift that segment, drag a
  **square** to move a bend; the route becomes hand-drawn and the router leaves
  it alone.
- **Add bend**, **Remove bend**, **Reset to automatic route** in the line menu.
- **Pin route** keeps a line exactly as it is, even one with no bends.
- **Attach at ▸** chooses which side of an element each end leaves from or
  arrives at, or hold Alt while dragging a connection from a specific side
  handle. A chosen side is a constraint the router honours, not a hand-drawn
  route.
- Drag the label off its default position; **Reset label position** puts it
  back.

On a very crowded board — more than about a hundred and fifty lines competing
for one channel — automatic routing declines rather than spending minutes on it,
and says so in the bottom bar. Nothing is lost: the lines keep the routes they
had, and everything you drew by hand stays exactly as you left it.

## Layout

**Tidy** runs an automatic layout over the diagram, with a direction (across,
down, or groups across and their applications down), a density, and pins for
what you placed by hand. **Route connections** redraws only the lines and
leaves every element where it is; **Re-route everything** ignores pins. A
domain group can be tidied on its own from its menu.

Tidy works beside the app rather than inside it, so the window stays alive while
it runs and the Tidy button becomes a **Cancel** while it does. On a diagram of
more than four hundred boxes it declines and says so, rather than thinking for
several minutes: split the board across diagrams, or tidy one domain group at a
time.

By hand: **align** and **distribute** a selection from the floating toolbar or
the selection menu, a **grid** with optional snapping, nudge with the arrows,
**fit view** (Shift+1) and 100 % (Shift+2).

## Documentation

Every element has a markdown description, and it can be a whole page. Open it
as a page with **Open documentation** in the element's menu, the expand button
beside the description field in the inspector, Enter on the selected element,
or a double-click on anything that is not an application.

The page opens to **read**: the document with a table of contents, the
diagram's other elements down the left to move between (a page mark shows who
has documentation already), and the element's own fields down the right.
**Edit** puts the source on the left and the result beside it, and makes the
fields on the right editable too. ⌘B and ⌘I wrap the selection; Escape leaves
Edit first, then the page. Changes are saved after a short pause and when you
leave, one undo step per pause.

An empty page can **start from the template**: a header table and the usual
sections. The **Short description** row of that table is what the element
shows on the canvas; without it, the first paragraph is. `[[Name]]` in the
text becomes a link to that element. Ordinary links open outside the app.

**Documentation** in the top bar opens the page for the selected element, or
for the first element on the diagram when nothing is selected. A fenced code
block marked `mermaid` in any page is drawn as a diagram. A block marked
`bpmn` is drawn as a process: BPMN 2.0 XML as the common modellers save it,
with its own diagram section saying where everything goes — pools and lanes,
tasks, events, gateways, flows and messages, read-only. A process element's
page is where one belongs (its `realises` line says which capability it is how
of), and a file without a diagram section is shown as text under a line saying
why.

**Pictures.** Paste or drop a picture into the text to add it: PNG, JPEG,
SVG or WebP. **Pictures** beside the source lists every picture the scope
holds, with **Insert** to put one on this page and **Delete picture** to remove
one. The text names a picture by its name, `![caption](image:floor-plan.png)`,
wherever the scope is kept. A page lays every picture out at once, at its own
size, and fetches it only when it scrolls into view, so a long page opens
quickly and nothing on it moves when the pictures arrive. A picture that cannot
be shown shows its caption. Only pictures kept with the scope are drawn: a web
address shows as its caption, and the app never fetches anything.

## Decisions

**Decisions** in the top bar opens the architecture decision records: a tree
down the left, the records of the selected node in the middle, and the record
you are reading on the right.

This scope's records are **one list**. A record either belongs to the scope as
a whole, or it is about one thing in it — an application, a capability, a
journey step — and the tree has a node for each thing that has records, with
every application listed whether or not it has any yet. Something that has left
the model keeps its records under *Removed applications*.

Under that come the scopes **above** this one, as a section each: *From Acme
Logistics*, *From Retail*. Their records are read here and **changed where they
live** — the reader shows them without an Edit button and offers to open that
scope instead. Numbering is per scope, so ADR-0001 of the domain and ADR-0001 of
the landscape are two records and always were.

A record follows the MADR format: context and problem statement, decision
drivers, the options considered, the outcome and its consequences, the pros and
cons of each option, more information. **New decision** asks for the title and
starts the body from that template. Title, status, date and decision-makers are
fields above the body; the **reviewers and signatures** table at the end lists
who the decision was put to, each with a verdict and the day it was given.

The status is a workflow, not a label. A record starts **proposed**, moves to
**under review**, and is then **accepted** or **rejected**. Those two are the
end of the road: from there the record can no longer be edited or deleted,
because a decision that can be rewritten afterwards is not a record of one. An
accepted record can later be **superseded**, which asks for the record that
replaces it and shows the link both ways. Review can be sent back to proposed.

The search field above the list searches every record in the tree at once —
title, body and reviewers, this scope's and the ones above. Bodies are markdown,
with the same `[[Name]]` links as documentation; **Formatting help** beside the
source shows the syntax, mermaid diagrams included. Changes are saved with this
scope.

## Observations

**Observations** in the top bar opens what the team saw in this scope — and,
analysed as a team, what lies behind it. The page has three tabs. The
**register** is a table read off the records: number, title, the day it was
first seen, where, its impact, how often it has been seen, and the causes it
was analysed into; under it the causes, the solutions and the experiments;
the record you pick opens beside it. The **analysis** is a picture: the
observations on the left, the causes they were analysed into in the lanes to
the right, then the root causes, and the solutions that address them last.
The third tab, **Solutions**, is below.

**Local and global.** Every scope's observations, causes, solutions and
experiments are its own. Read from a scope, those of the scopes below it are
**local** to those scopes; read from the organisation, the organisation's own
are the **global** analysis. Nothing is shared to get there: a scope reads
the analysis of every scope below it, and who may read a scope is decided
where the work is kept, never on a record. **View local**, beside the
picture's other controls, is on where the scope has scopes below and off,
saying why, where it has none. On, the picture draws each scope below in a
boundary of its own to the left of this scope's lanes, nested as the tree
nests, and the register, the causes, the solutions and the experiments list
the records of each scope below after this scope's own, under *Local to …*.
The counts over the picture — observed, analysed, assumed, verified, root
causes, open ends — count what the picture draws, the scopes below included.
Off, the page shows this scope alone, and says how many local records it
hides.

A record of a scope below is **changed where it lives**. Its reader says so
in a strip — *Local to Application landscape* — with a button under it that
opens that scope's page. What you add to it from here — a sighting, a cause,
a deeper cause, a link between its own records, making one of its causes a
root cause — is made in that scope and saved there at once, as that scope's change
rather than this page's: a note after it says where it went, and ⌘Z on this
page does not reach it — to take it back, change it back. Where that scope
may not be changed from here, or its own rules refuse the change, the note
says nothing was made. A solution or an experiment of a scope below
is read here and not changed.

An observation is a numbered record (`OB-0007`) with a title, a place, who
saw it — free text: a name, initials, a team — the day it was first seen, an
impact — *minor*, *major* or *critical* — and a markdown body for what was
seen, the evidence and who or what it affected. **Seen again** counts one
more and writes the day into the record's **history**, which is the dated
ledger at the end of every observation: recorded, seen again, merged,
archived. On a large card the impact is a stripe down the left and the count
is in the corner; on a small one the impact is the size of the circle.

**Bright spots.** Not everything worth understanding goes wrong: a team that
never misses a release is worth asking why, too. An observation is either a
**problem** or a **bright spot** — something that works — and *New
observation* asks which first, problem chosen; *Edit* on its reader changes
it later. A bright spot is analysed as a problem is: its causes are what make
it work, the team says which is the root cause, and a solution on that root
**spreads** it, with the same questions to answer and the same experiment
before it is proven. A bright spot has its own chip in the register and on
its reader, and is drawn in green in the picture, with the lines of the chain
behind bright spots only. The counts over the picture and on the scope's
home count bright spots apart. A problem and a bright spot are never merged:
the merge screen offers records of the survivor's kind only. And a bright
spot seen again after a solution was built is that solution working, so it
is not flagged against it.

**New observation** — in the top bar, and in a register with nothing in it
yet — asks for the four facts that make one: the title,
**where seen**, **observed by** and **date seen** — the same words as when it
is edited. Date seen starts at
today and may not be in the future; the impact starts at minor. On the right
the description asks its three questions a field each — **what we saw**,
**evidence** and **who or what it affected** — and the last is required too:
an observation always says whom or what it touched. Recorded, the three are
one markdown description under those headings, and an observation's
description is edited as one text from then on. **Preview** shows it as it
will read, and **Edit** goes back to the fields. Every field has an example
under it, and a field left empty says what is missing in its place, and the
count beside the button. Every dialog on the page keeps what is written in
it: a click beside it does not close it, Escape does not once something is
written, and Enter in a one-line field does what the button does. Under the title, two
hints that never stop you: **Seen before?** lists observations of the chosen
scope whose titles share words with yours, each with **Seen again**, which
asks the day and a note, as on the reader, and records a sighting on that one
and nothing new — Cancel goes back to the form as you left it; and a title that uses a word
that reads like a cause, a fix or blame — *because*, *should*, *fix*,
*fault* — is told to keep to what was seen and put the why in a cause. With
View local on, the form asks first which scope the observation belongs to;
one below makes it local there.

The **causes** can be written with the observation. **New cause** opens a
cause's fields in the form — its title, *why we think so*, whether it is a
root cause, and how strongly it explains the observation — with *Already
written down?* over the causes of the scope. **Existing cause** picks one
already written down. Each row says whether it is new or existing and can be
taken off again, and nothing is made until you record: the button says what
it will make, *Record observation with 1 new cause and 1 link*, and it is one
step — ⌘Z takes the observation, the new causes and the links back together.
Changing the scope takes off the links to causes of the scope chosen before,
and says so.

Observations that turn out to be the same thing are **merged**, and so are
causes written down twice. **Merge…** on an observation or a cause — on its
reader, on a right-click, or on one of a scope below — opens the **merge
screen** over the page, with that record picked. It has three parts:

- **What to merge.** A search over the live observations, or the causes that
  are not merged, of this scope; tick **Across scopes** to search every scope
  you can read, nearest first, each hit naming its scope. Tick as many as are
  the same thing. One of those picked **keeps standing** — the survivor; it is
  the record you started from until you choose another. A record of a scope
  you may read and not change is listed and cannot be ticked, and says why.
- **What the survivor says.** One row per value — for an observation the
  title, where, observed by, the impact and the day first seen, which starts
  at the earliest of those picked; for a cause the title, assumed or
  verified, and whether it is a root cause. Beside each, every picked
  record's value is a button that puts it in the field, or type your own. The
  sightings are added up, not chosen. The description is the survivor's,
  editable; **Add the others' descriptions** appends each one's under
  *Merged from OB-0007* (with its scope where that is another). The others
  keep their own descriptions either way.
- **What moves with it.** Every link that names a record being merged, one
  row each, ticked where it may move to the survivor. Untick one to leave it
  where it is. A link the tree does not allow — a loop, a link up or sideways,
  a cause explaining an observation of another scope, a solution and a cause
  that will not be a root cause — cannot be ticked, and says why. Where both
  records had the same link, choose its strength; the stronger is offered.

**Merge** says what it will make — *Merge 2 observations into OB-0002* — or,
greyed, why it cannot. A merge inside this scope is one step, and ⌘Z takes it
back. One that changes another scope — a record of it merged, or a link kept
there moved — writes every scope it changes as that scope's own step, all or
nothing, and a note says which scopes it changed; ⌘Z here does not take that
back, so change it back. The screen closes on the survivor. Every merged
record stays — it is where the original wording is — and is read as merged
rather than deleted, saying where it went, also when that is another scope;
*Show merged* brings merged observations and causes back into the register.

**An observation moves to the scope it belongs in.** Its scope did not exist
yet when it was written down, the tree was reorganised, or the analysis
shows it is about another part of the organisation: **Move to scope…**,
among the reader's occasional actions on an observation of this scope,
opens the **move screen** over the page. It has three parts:

- **What moves.** The observation, how often it was seen, and how many
  comments go with it.
- **Where to.** Every other scope you can read, nearest first, each by its
  path from the organisation down; type part of a path to find one. A scope
  you may read and not change is listed and cannot be picked, and says why.
  Once one is picked, the screen says what the observation will be there:
  that scope's next number, *It will be OB-0012 in Platforms › Cameras*.
- **Links cut.** A cause explains observations of its own scope only, so
  every cause that explains this one loses that link. Each is listed, with
  the solutions on a root cause the link leads to, before anything is
  written. The links stay on their causes as history, and the analysis
  starts again in the scope it goes to.

**Move OB-0007 to <scope>** moves it as one change over both scopes, all or
nothing. It keeps its title, place, observer, impact, day, description,
sightings, history and comments, and its history says where it came from.
Where it was, it stays as history: read as a merged record is, left out of
the register, the picture and the counts, and shown under *Show merged* as
*Moved to OB-0012 in <scope>*, which goes there — so a link to it still
leads somewhere. The screen closes on the observation where it went. ⌘Z does
not take a move back: move it back, and where its old place still holds it,
it comes back under its old number and the links cut when it left explain it
again. An archived observation is restored before it moves, and a merged one
does not move. An agent moves one the same way: `move.plan` says what it
would cut, and `observation.move` moves it.

An observation that was fixed, addressed or has stopped mattering is
**archived**: *Archive* asks why, optionally, and writes the day and the
note into the history. The record stays where it is, for the history, and
leaves the analysis — not drawn, not queued, not offered as a merge target —
until *Restore* brings it back. *Show archived* lists the closed ones.
Nothing is deleted to close an observation; *Delete* is for a record that
should never have been one.

A **cause** (`CA-0003`) is what the team says lies behind one or more
observations, or behind other causes. It starts **assumed** and is marked
**verified** once checked. A **root cause** is a cause the team says is one,
and it is labelled **RC** on the cause's own number: `CA-0004` made a root
cause is `RC-0004`, and made a cause again it is `CA-0004` once more. A root
cause ends the chain: nothing explains it, and a solution addresses it. It
may explain causes and observations. A cause that is not a root cause and
that nothing explains is an **open end** — the analysis is not finished
there — marked `?` in the picture and counted over it.

**An analysis from an earlier version** said no root causes: a root cause was
then any cause nothing explained. It opens with a root cause wherever a
solution that was not dropped addresses a cause, and nowhere else, so a cause
that was a root only because nothing explained it yet opens as an open end.
The same holds wherever the work is kept.

**Make root cause** and **Make cause** are steps with a name in the Activity
list, and each asks first, in the reader — also when it is chosen on a
right-click. Make root cause is refused while a cause explains this one:
the reader names each cause that does, and says to unlink it or to make that
one the root cause instead. Make cause is refused while a solution addresses
it: the reader names each solution, and says to move it to another root cause
or unlink it first. A new cause can be made a root cause as it is written.

**Every action on a reader is a small button** with an icon and a word or
two, and hovering it, or reaching it with Tab, says in full what it does and
what it is refused for. An observation offers *Seen again*, *Cause*, *Edit*,
*Merge*, *Move to scope*, *Archive* and *Delete*; a cause *Deeper cause*, *Root cause*,
*Make root cause*, *Verify* — *Unverify* once it is verified — and *Merge*;
a root cause *Solution* and *Make cause*, and never a deeper cause. *Cause*, *Deeper cause* and *Root cause* open one dialog with
two tabs: **New cause**, the cause's own fields, and **Existing cause**,
offering only what the rules allow. *Use this one* beside a cause already
written down picks it under Existing cause, where its strength is chosen
before **Link**. Where the reader is narrow, *Merge*, *Move to scope*,
*Archive* and *Delete* move into `⋯`.

**Across the tree, a cause explains down and never up.** A cause may explain
a cause of a scope below its own — an organisation-wide reason behind a
landscape's cause — and the link is kept on the cause above, in the scope
above. The cause below says what explains it on its reader, and the picture
draws the line across the boundary, dashed. On a cause of this scope,
**Local cause** links a cause of a scope below that it explains; on a cause
below, **Org cause** links a cause of this scope that explains it. Refused:
a cause below explaining a cause above, a cause explaining one of a
sibling scope, a cause above explaining an **observation** below — the scope
below explains its own observations — and anything explaining a root cause:
to say an organisation-wide reason lies behind a local root cause, make that
root cause a cause first, in its own scope.

**The filters.** *Filters* shows or hides a row under the picture's controls
and counts the filters that are on. **Scopes** is a list with a box per
scope, which a field narrows. **Obs** keeps the observations whose text
matches and the chain behind them — their causes, root causes and solutions.
**Cause** and **RC** keep the causes, or the root causes, whose text matches,
with everything they explain and everything behind them. **Search** looks in
every record, solutions included, and keeps what is found and what is linked
to it. Filters narrow each other, and they narrow all three tabs. What
matched is outlined and what came with it is drawn plainly; the count says
*12 of 40 shown*, and × beside *Filters* clears them all. **Problems,
bright spots or both** — both is the default — leaves out the observations of
the other kind, and what lies behind them alone: a root cause behind a
problem and a bright spot stays. **Saved filters**
keeps the filters that are on under a short name you give: one saved again
under the same name replaces it, a saved one is put back on from the list,
and one is deleted from it. They are yours — kept with your preferences and
offered in every scope — and a saved scope that is gone is left out when it
is recalled.

**Looking at the picture.** **Large** draws every record as a card with its
label and title; **Small** as a circle with the label under it — an
observation sized by its impact, a cause hollow, a root cause with a double
ring, a solution as a square. Dashed is assumed and solid verified, in both,
and the legend under the picture follows the size. The picture starts
**fitted** to the window, and fits again when what it draws changes until you
zoom; the zoom buttons, and ⌘ or Ctrl with the scroll wheel, zoom it, and dragging the
background pans it. **Hovering a record** — or reaching it with Tab — traces
its chain both ways: everything linked to it stays and the rest dims, and its
full title, its label and its scope show under it. Enter or a click reads
it. The same records under the same filters land in the same place every
time.

### Solutions

The third tab, **Solutions**, starts where the analysis ends: what the team
does about a cause, how an idea earns its way to a decision, and whether what
was built made the sightings stop. The picture has the causes on the left —
the root causes, and any other cause a solution addresses — then the
**directions** (ideas being shaped or tested), the **experiments**, and the
**structural** solutions (proven, adopted, implemented). A solution moves
right as it matures; its width is the benefit it promises and its fill how far
it has got. Once it is structural it keeps a faded box in the directions lane
for the direction it was, so the line runs from the cause through that box and
the experiment that confirmed it into the solution. **Whole chain** puts the
observations and the whole analysis back on the left, so one picture runs from
what was seen to what was built. A mark (!) says where to look: a root cause
nobody is working on, or a solution with a question.

**Solution** on a root cause's reader, or **New solution** on the bar, opens
the form: a title with an example under it, an optional description with **Edit**
and **Preview**, and a table of the root causes of this scope it addresses,
linked when you propose — the button says *Propose solution for 1 root
cause*. It writes a numbered record (`SO-0003`) and nothing else. A solution
addresses root causes only: a cause that something deeper explains is a
symptom of that deeper one, so its reader offers no *Solution* and points at
the root cause instead, and a root cause a solution addresses cannot be made
a cause again until the solution is moved or unlinked. Before it counts as
**shaped** it needs what the team would ask anyway: the benefit it is expected
to bring and a rough cost, who it was checked with, and whether something like
it was tried before — and if so, why it would work now. The reader lists what is still open under *To move on to…*,
each line with its control beside it, and the button stays disabled until the
list is clear. **Back to…** moves it one step back at any time.

From shaped to **testing** it needs an **experiment** (`EX-0002`): a
hypothesis, how it is measured, where, by whom and when. Planning one from the
solution moves it to testing in the same step, and one that is already
confirmed counts too. Once one is **confirmed**, the solution may move to
**proven**. Some things cannot be trialled; *Waive* takes a reason instead,
and the reason is kept. A refuted experiment stays, as the evidence the next
person asks for.

A proven solution is decided on the **Decisions** page. **Propose the
decision record** writes a new record whose context names what the solution
addresses and what else was considered. Once that record is accepted, the
solution can move to **adopted**, and **Start a plan** writes the plan that
builds it. When the plan is **done** the solution reads as **implemented**,
and **Did it work?** lists the observations under it: each should stop being
seen, and one seen again is flagged against the solution.

Two questions are asked of a solution without stopping it: does it only work
around a symptom (it is proven but addresses no root cause), and does its
plan clear anything up, or only add? A solution that is not pursued is
**dropped** with the reason and stays as an alternative that was considered:
it is listed on every other solution for the same causes. Both records are
markdown files, under `observations/solutions/` and `observations/experiments/`.

A solution's reader has the same small buttons as the analysis: *Address*
to address another root cause while it is an idea or shaped, *Experiment* to plan
one while it is shaped or testing, *Edit*, and *Drop* and *Delete*, which
move into `⋯` where the reader is narrow. A solution of a scope below, drawn
in its boundary with View local on, is read here and worked on in its own
scope.

**Right-click** anything in the analysis or the solutions picture for what can
be done with it — the same actions its reader offers, in the same order and
the same words, Edit among them, and on a solution the steps its gate offers;
a menu item ends in “…” where a dialog or a question follows — and a
line — the analysis's links, a solution's causes, the lines into and out of an
experiment — for how strong the link is, or to unlink it. **Edit** gives the
record the whole width: the text on the left, what it will look like on the
right, and the picture back when you switch to Read.

## Time, and the day a board shows

Every application can carry **lifecycle dates** beside its lifecycle: the day it
goes live, the day it starts retiring, the day it is gone. All three are
optional, and an application with none of them behaves exactly as it always
did. Where a date has passed it wins over the stored lifecycle, because a
landscape that still says "planned" three years after go-live is one nobody
updated.

A connection can carry a **window** of its own, *valid from* and *valid until*.
Almost none need one: a line with no window is there as long as both the things
it joins are there. The lines that do need one are the temporary ones — a sync,
a routing façade, a double write — which is exactly the hybrid phase of a
replacement.

**Showing** on the diagram bar says which day the board is drawing. It reads
*Today* until you name a day, and then reads that day and highlights itself, so
a board showing 2028 does not look like a board showing now. Every card draws
the phase it is in on that day, and a line with a window appears only inside it.
Picking a day only changes what your window shows: nothing is saved, nobody else
sees it, and a dashed outline round the button says so. To make the board open on
that day for everybody, choose **Save** under the date — that one is an edit, one
entry in Activity, and ⌘Z takes it back. **Show today** and then **Save** puts a
dated board back on the calendar.

That is how a future diagram is made. Right-click a tab and choose **Duplicate
as of…**, pick a day, and you have a second board of the same landscape as it
will stand then. There is only ever one model, so the two cannot drift apart.
An exported PNG of a dated board says the day in its title.

**Replaced by** on an application names its successor, and **Owner** says who
answers for it. Owner used to be a row in the documentation template; it is a
field now, so the roadmap's checks can name a person.

## The roadmap

**Roadmap** in the top bar opens the landscape on a time axis. Only what has a
date gets a row, so a landscape of four thousand applications with nine dates in
it is a roadmap of a few lines — the rest is on the canvas, where it belongs.
Each row is a run of coloured stretches: planned, live, retiring, gone. A line
down every row marks today, and a second one marks the day the board behind the
page is showing. Relations with a window of their own are listed under the
applications, folded shut with a count on the heading, because a plan that
moves every interface dates every line.

The slider along the top moves that board. Drag it and the canvas behind follows,
so the picture and the axis cannot disagree about which day is under discussion.
Like the date control, it only looks: **Save** on the board's bar keeps a day.

### Plans

A **plan** is how a change to the landscape gets written down: a title, a status,
the window it runs over, who owns it, the applications it introduces, retires or
changes, the decisions it rests on, its milestones, and a body in markdown. Plans
appear as bands under the applications on the axis, with a mark per milestone.
Pick one and it opens on the right.

A plan runs **draft → agreed → running → done**, and can be abandoned from any of
those. Unlike a decision record, every step can be taken back and a finished plan
can still be edited: a decision records a moment, and a plan describes work. What
the plan said last month is in the folder's history.

**Move by…** shifts a plan by a number of days — its window, every milestone, the
day of every unit it moves, and the lifecycle dates on the applications it
introduces and retires — in a single step, because a plan slipping is one thing
that happened. A plan that reorganises units says what that does to the people
in them (see *Change over time*).

Each plan is one markdown file in `transitions/` in the scope's folder, numbered
`TR-0001` upwards.

**Initiatives.** A plan lives in the scope that writes it, and a domain's
roadmap is the domain's. When a plan is the organisation's business as well —
a migration the whole company follows — switch on **Initiative** on its page.
It then appears on the roadmap of every scope above, under *Initiatives from
the scopes below*, with the scope it belongs to on a chip; it is read there
and edited where it lives, and the chip opens it there. The organisation
screen's roadmap card counts them. The switch is not offered at the
organisation itself, which has no roadmap above it.

### The business case

A plan's body can hold a **business case**: a fenced block whose input is a
cash-flow table you can read, with the figures worked out underneath it.

````markdown
```business-case
currency: EUR
discount rate: 10%

| Line       | Year 0   | Year 1 | Year 2  |
| ---------- | -------- | ------ | ------- |
| Investment | -415 000 |        |         |
| Savings    |          | 25 000 | 125 000 |
```
````

A negative number is money out, a positive one is money in, and a blank cell is
zero. Underneath, the app computes the net and cumulative cash flow, the net
present value at the rate you gave, the internal rate of return, the payback in
periods, the return on investment and the benefit-cost ratio. Your table is never
rewritten.

A second table, `Criterion | Weight | Score`, adds a weighted score for the part
that is not money — scored one to five, out of a maximum the app works out rather
than one you type. Everything beyond that belongs in a decision record, with its
drivers and the options you weighed.

**Add a business case** in the edit pane drops an empty block in at the cursor.

### What the dates disagree about

Under the axis is a list of findings (see *Reading a list of findings*): an
application retiring with connections still live, a successor that does not
arrive until after the thing it replaces is gone, a retirement with no
successor named, a connection still valid
after one of its ends has retired, an application still standing on a platform
that has been retired, and a plan past the day it was due to finish.

One entry is not a contradiction but a picture that is missing: container
interfaces running between two applications with no application interface drawn
for them. **Accept**, in its explanation, draws it and lands every one of
them on it, as one step — or leave it, and nothing happens.

It says where the dates contradict each other. It cannot tell you that a landscape
is out of date — nothing can — and the page says so under the list.

## The business architecture

**+** in the diagram tabs, then **Business architecture**, makes a **sheet**: the
layer above the applications, on one page. A landscape says what runs and what
talks to what. A sheet says what the organisation does, who it does it for, and
how much of it any software covers at all.

A sheet is *laid out*, not drawn. There is nothing to drag and no router: what it
shows is four trees — a journey, the areas of responsibility under it, the
capabilities inside those, and the stakeholders down the side — and the page is
computed from their order and their depth. It gets a tab beside the boards, and
opening it leaves the canvas where it was, so the picture you were working on is
still there when you come back.

![The business architecture sheet: stakeholders down the side, the journey across the top with one row per lane, and the areas with their capabilities and how each is covered](screenshot-sheet.png)

### The journey, and the paths through it

Across the top runs one **journey**: the thing the organisation does, end to end.
Its phases are the columns, read left to right, and under each phase are the
steps taken in it.

One journey is rarely one path. A step can name a **lane** — the stakeholder
whose own path it is — and the sheet draws a row per lane under the same phases,
the common path first. Where a lane forks and where it rejoins is not written
down anywhere: it is the first and last phase the lane has a step of its own in.
A phase inside that span where it has none is drawn as *as the row above*;
outside the span the lane is not drawn at all. Nothing can disagree with where a
path leaves and returns, because nothing but its steps says so.

A step somebody outside the organisation takes — a partner fulfilling an order —
is marked as done outside, so the page can say a phase is covered by nobody
inside.

### Areas, and what covers them

Under the journey are the **areas** of responsibility, each with its groupings
and the capabilities inside those. Depth is what is drawn, and the model does not
know the words: a top-level entry is an area, one inside it is a grouping, one
inside that is a capability.

Every capability says who covers it:

- **an app**, or several — the applications that support it. A capability with
  two of them and one of those retiring is a migration you can see.
- **people** — nobody's software, somebody's job. A complete answer and not a
  gap: a page that drew this as a problem would be telling you to buy software
  for the thing you do by hand.
- **nothing yet** — neither, which *is* the gap, and the reason to draw the page.

Those are read from the model rather than kept on the card: a capability is
covered because something in the landscape supports it. **Supported by…** in the
inspector is how that row gets written, and support can carry a window like
anything else with a date on it, so a capability covered from March is covered
from March.

At the end is a band for what is **not yet mapped to a domain** — the areas
nobody has been given. It is a finding, not an error: a list of what the
organisation has said it does and has not yet said who does it.

### The stakeholders, and the units

Down the side are the **stakeholders**: the parties the organisation deals with,
in their own tree, the ones from outside marked. A unit — an actor with a unit
type, the organisation's own structure — is drawn there only where this sheet
uses it, under **Units on this sheet**: a unit responsible for something the
sheet draws (an area, a grouping, a capability or a step), or one with a lane in
its journey. Each says why in a line under its name. A party filed inside a unit
keeps its place, with that unit as its group.

The rest of the scope's units are counted under the list — *8 more units are
filed here* — and **All units** draws them too, under **All other units**. It is
yours and lasts for as long as the app is open, per sheet; it changes nothing in
the model. Units are made and arranged on the organisation chart, not here.

A stakeholder you type as a unit while the sheet is open stays where it was for
the rest of the session, and a note says it is now on the organisation chart.

### Making one

A sheet on a scope with nothing above its applications is empty, and the empty
page offers the two places to start: **New journey** and **New area**.
Everything else is a **+** where the thing would go, and they all work the same
way — what you made appears, it is selected, and the cursor is in its name, so
you type over what it was called and press Enter.

- **New journey** makes the journey and its first phase, *Start*, and points
  this sheet at it, because a band that is a header with nothing under it is not
  what you asked for.
- **+ phase**, at the end of the phase row, puts a column at the end.
- **+ step**, in any cell, adds a step to that phase on that row's path.
- **+ lane…**, under the last row, asks whose path it is — one of your
  stakeholders, or a name you type, marked as outside the organisation if they
  are — and which phase it forks at, since a lane is drawn where its steps are
  and one with no steps is not drawn at all.
- **+ area**, after the last area, adds one and draws it on this sheet from the
  moment it exists.
- **+ grouping** and **+ capability** inside an area, and **+ capability**
  inside a grouping. A capability made straight in an area is a card in the
  column, and becomes a grouping the moment something is put inside it.
- **+ stakeholder**, beside a rail entry, adds one under it; **+ group**, at the
  foot of the rail, starts a branch of its own.

**Supported by…** and **Assigned to** in the inspector are how a capability
gets covered: tick an application and it supports this capability; **+ Unit**
under **Assigned to** makes a unit responsible for it, picked from the whole
organisation the way a scope's **Served by** picks one, with this scope's other
actors after the units. Each is a step of its own, and the line under the
capability's name changes as you go. The row is kept here; a unit filed in
another scope is its far end, and is not drawn on a board here for it. A unit
that serves neither this domain nor sits under a unit that does is marked, and
is a check (below). **✕** on a chip takes a row kept here off again.

**The unit responsible** is named on every area, grouping and capability a
unit is assigned to, always: a small label beside its name, or on a
capability's coverage line, with **+1**, **+2** where more units are, and
every name in its tooltip. A unit outside the domain is drawn as a warning.
The label is a button: it opens the home of the domain the unit serves, a
menu of domains where it serves several or several units are assigned, and
the unit where it is kept — on that scope's organisation chart — where it
serves none. Pressing it does not pick the card.

**Show who is responsible**, in the top bar, adds the other actors it is
assigned to, that are not units, and marks the ones nobody is assigned. It is
off until you turn it on, and only for as long as the page is open.

**Delete**, at the foot of the inspector, removes what is selected and every row
that ended on it. It is refused while anything is inside it, and says how much:
nothing cascades, so an area you delete is an area you emptied first. An actor
that is a unit asks first, the same question as on a board (*Elements*):
ending it offered first, who stops being what, and where the units inside it
go — which therefore do not hold its delete back.

**What this sheet draws**, the sliders in the top bar, is about the sheet rather
than the model — which journey runs across the top (a scope with two journeys
starts with neither), which areas are drawn and in which order, the order of the
lanes, and whether the rail is there at all.

### Editing one

Pick anything on the page and it opens on the right: its name, its description,
what it sits under, where it is among its neighbours, whose path a step is,
whether a stakeholder is from outside the organisation, and the lifecycle a
capability is in — a capability being built is in the same phase as an
application being built. Moving one thing under another is refused if it would
put a thing inside itself; the refusal is offered in the list, not hidden from
it. The eye in the top bar hides the stakeholder rail, and the magnifying glass beside it finds anything on the page by name — pick a hit, or press Enter for the first, and the page scrolls to it, selects it and rings it for a moment.

Opening an application from a capability's coverage takes you to a board that
actually draws it, switching boards if the one you are on does not — and to the
application's own page when no board draws it at all.

### The enterprise map

**+** in the diagram tabs, then **Enterprise map**, makes the second laid-out
view — or **Map** on the business architecture card of the organisation screen
opens the root's. It is the same layer read the other way: every function down
the side, in the order the sheet draws them and indented by depth; a column per
application the rows name; a mark where one supports the other. On a section —
an area, a grouping — the mark is hollow and means *something under this*: the
roll-up, so the top of an area says what the whole area leans on before you
read its capabilities. Applications another scope owns are grouped under that
scope's name across the top, because the systems supporting the organisation's
capabilities are usually a landscape's, and a column that does not say whose it
is has said half.

Two columns come last. **People** is marked where somebody is assigned — one
column rather than one per stakeholder, because "done by hand" is one answer.
**Coverage** is the gap: *uncovered* on a capability nothing and nobody covers,
*people* on one done by hand without a system, and on a section how many of the
capabilities under it are uncovered. The top bar adds the three up. A map with
an *as of* day counts the rows live on that day, so a system that starts
supporting something in March is a gap on February's map.

Pick a row and it opens on the right, as on the sheet — *Supported by…*
included, so a gap can be closed from the page that shows it. Pick a column
heading to open the application, where this scope holds it.

### Technology

What the applications stand on is a **platform** — a cluster, a namespace, a
broker, a cloud account, a firewall — and what a platform team offers is a
**platform service**: *Container platform*, *Message brokering*, *Managed
database*, *Identity*. The two are different things on the same layer. A
service is what a team asks for and a platform team is accountable for; a
platform is what delivers it this year, and could be replaced next year
without the service changing its name. A platform comes from the palette's
last row and lands in the management band as a chip; a service is made on
the technology landscape, where the layer is drawn, and a board draws it as
a chip with a mark of its own so the two are told apart at a glance. A
platform says what it is
on the inspector — a *place* something runs in, a *service* something
consumes, or a *network*; a service when unsaid — and what it is **part
of**, which is how a namespace goes under its cluster in the app; a platform
**realises** the services it delivers. A shared platform or service is
usually defined in a scope of its own, drawn elsewhere as a stand-in, so the
team that runs it owns its record.

**An application says one thing per question.** Where a container runs is
*Hosted on*, on the component's record, and an application is told what its
containers say: *Runs on: OpenShift (3 containers)*. What an application
consumes is **Uses**, and it names the service, not the product: a team asks
for message brokering, and which broker delivers it is the platform team's
business, said once as *Realises*. Which platforms an application actually
depends on is worked out from the two — the record's *Leverages* line reads
*Container platform (OpenShift), Message brokering (Event broker)* with
nothing typed on the application. Using a platform directly is still
allowed for the team that genuinely binds to one instance; the inspector
offers services first.

**Shared** on a service says it is offered for use beyond the team that
maintains it — *Maintained by* names that team. Organisations draw this line
differently, so it is yours to tick; and where nobody has, the rows still
say. A service maintained by one team and used by an application belonging
to another is being offered whether anybody said so or not, and the roadmap
and the technology register show it as a finding naming the consumers — a
conversation to have, never a box the tool ticks for you. A shared service
nobody outside its team uses yet is an ordinary thing and no finding.

**The technology register**, a card on the organisation screen beside the
register of applications, is every service and platform across the whole
tree: who maintains each, which are shared, how many applications consume
them and from how many scopes, what realises each — nothing realising a
service is a real gap, shown as one — and, for a platform, what it hosts
with everything filed under it. Derived from the folders every time, so it
cannot disagree with them.

**Two reports, one from each side.** Double-click a platform's chip, or
**Platform report** on its menu, for what would be left standing if it went:
what it sits in, what is under it, what runs on it or anything under it —
each container named beside its application and the namespace it sits in —
what uses it, and the container interfaces that cross it, each with the
application interface it is part of. Double-click a service's chip, or
**Service report**, for what would be stranded if it were withdrawn: who
maintains it, what realises it, who leans on it and from which scopes, and
which consumers would still be on it on the day it goes. Neither is drawn
or created; both are worked out from the rows every time you open them.

**The technology landscape** is the picture of all of it: who uses what,
what is offered, and what delivers it, in three bands on one page. *Landscape*
on the technology card makes one in the scope whose services and platforms
it should draw — the platform scope, usually — and it is listed among the
tabs like the sheet and the map, and among the boards on that scope's home.
Choosing the tab shows it in place of the canvas, like every other tab; a
platform scope needs no board at all. It is **authored on**: the palette
beside it offers a platform and a platform service, a `+` on either band
adds one, a `+` inside a group files it under that group, and the inspector
on the right edits the one you choose — name, description, lifecycle,
*shared*, what it is, what it is part of, what it realises, who maintains it. The top band is every application the
rows connect to those services and platforms, from every landscape in the
organisation, in a box per domain; the middle band is the services, nested
where they nest; the bottom band is the platforms, nested where the tree
nests, an outside one dashed. Nothing is drawn or dragged: every card and
every line is read from the rows each time. **There are no lines at rest** —
the cards carry the counts — and hovering a card previews its lines, clicking
pins them, dims everything they do not touch and opens the record on the
right, from which the reports open. *Hide services* folds the middle band to
a strip and draws what each application actually leverages straight to the
platforms, the way the record's *Leverages* line reads it; *All lines* is the
escape hatch. Above forty applications the domains start folded into one box
each with a count, and filtering by name opens the matches; a domain title
folds and unfolds by hand.

**Hosted on a platform another scope defines.** *Hosted on* lists, under
*Elsewhere in the organisation*, every platform the rest of the tree
defines, places first and each with its scope; choosing one writes the
stand-in for you, in the same step as the row. The library beside the
palette lists the tree's platforms and services after its applications.
And **hosting implies the service**: a container on Azure Cloud leverages
the cloud service Azure Cloud realises, whether or not anybody wrote a
*Uses* row — the record says *(implied by hosting)*, the technology
landscape draws it dotted and counts it, and a *Uses* row written later is
the same fact said out loud.

**Writing what an application uses.** An application's record has a
**Uses** picker beside *Hosted on*: the rows it has as pills, and a
searchable list over this scope's offerings and service platforms first,
then — under *Elsewhere in the organisation* — every offering another scope
marks shared and every service platform the tree knows, each with its
scope. Tick several and close: one step, one undo, and a tick on something
from elsewhere writes its stand-in with the row. The same panel is docked
on the technology landscape, and the landscape has one gesture of its own:
**drag an application card onto a card in the lower bands**. A place takes
*Hosted on*, a service platform or an offering takes *Uses*, a shared
offering brings its stand-in; while an application is selected the targets
show the same two verbs as small buttons. Hosting lines are drawn now,
because on a scope with no offerings that is the only line an application
has; *Fold hosting into service lines* hides one where a use already
reaches the same platform. A **Shared in the organisation** row inside the
services band lists every offering other scopes mark shared, dimmed until
something here uses one; a scope with no offerings at all shows the band
as a strip and the platforms move up. Under *Leverages* on a board's
record, *Show on technology landscape* opens the landscape on that card.
The board itself still draws flows only.

**Colour by** in the landscape's toolbar tints the cards by platform — the
cluster, not the namespace — or by technology lifecycle, so the cards
standing on something retiring go amber, the whole chain counted — or by
**one platform or offering**: every application that uses it, is hosted on
it or leverages it is coloured and the rest fade, which is the reverse
question, who stands on this. The
**platform** badge reads off the roll-up where nobody set it, and the
roadmap's findings flag an application still standing on a platform after it
or anything above it has retired, naming the platform that actually goes.

**What a platform team does with it.** Define the services you offer in a
scope of your own, each assigned to your team and marked shared; file the
clusters, brokers and accounts that deliver them under each other with
*Part of* and say what each realises. Every landscape then draws your
services as stand-ins and its applications say which they use; the register
tells you who leans on what, the service report tells you who would be
stranded before you withdraw one, and the finding tells you which of your
own team's things other teams have quietly come to depend on.

## The operating model

The **Operating model** card on the organisation's home opens the
organisation's own design of how it is organised: the kinds of unit it has,
the roles each kind holds, and what each role is responsible for — in its own
words. It is kept at the organisation and edited there; opened over any other
scope it only reads, and says so. Every change is a step: it shows in
Activity, ⌘Z takes it back, and each unit type, role and responsibility has a
history of its own.

### Units and roles

A **unit type** is the organisation's word for a kind of unit — whatever it
calls its teams, trains or departments. The tab draws the unit types as the
structure they make. The organisation is lane 0, on the left, and each unit
type stands once, in the lane of the longest path to it from the
organisation, with a line from every place a unit of it may sit: from the
organisation for a type at the top, so a type that may sit at the top or
inside another shows both lines. A line that skips a lane runs along a rail
above the cards, where no card hides it; a line back up the lanes, where
types may sit in each other, is dashed. A type's card says where it came from
(the library's name, or *own*), how many units of it there are today, the
roles it holds with how many of each and **manages** on a managing one,
whether a unit of it may serve more than one domain, how many applications a
unit of it should own at most — a check reads that number; nothing refuses
it — and its last day where it has one.

Pressing a card picks the type: the places it may sit, the types that may sit
in it and its roles light up, and everything else dims. Pressing a role lights
the types that hold it, and pressing the pick again lets it go. What is picked
opens on the right to edit: **Where a unit of this type may sit** is ticked
there, and **Order in its lane** moves the type up or down its lane, one step —
the organisation chart lists units in that order. **New unit type** and **New
role** add one, and **From a library…** beside them brings in what a library
offers (below); a model with nothing in it yet offers **Start from a
library** first. Under the lanes, **Sits nowhere yet** holds a unit type that is
neither at the top nor in a unit type that sits anywhere: no unit of it can be
placed where its type allows, and it is counted under **Needs attention** on the
organisation's home and listed on its Checks page. **Roles in no unit type yet** holds the roles no type
holds.

A **role** has a name, a short name for the matrix, a purpose, and its part in
each responsibility. **Manages its unit** marks a role whose holder manages
the people of the unit and of the units below it. The app keeps the mark; a
build that knows who people are may grant a right from it.

**Reports to**, under each role a unit type holds, says where the holders of
that role report in every unit of the type: to the holders of another role in
the nearest unit above that has it, or — where no unit above has it — in the
one unit of the organisation that has it. So a business unit's technology
lead can report to the head of technology in the technology department, while
the rest of the business unit reports up the way it is nested. A line is a
**Line manager**'s — its holders manage them, in place of the nesting — or
**Functional**: shown, and deciding nothing. **From** and **Until** give it
days. **By nesting** takes the line away. A line manager's line that would
make a chain of managers come back to where it started is refused there and
then, and said why; a unit may say otherwise for itself (*Units and the
people in them*).

**Rules the model reads** say whose role answers for what: an application's
owner is the holder of a chosen role in the unit it belongs to, and a domain's
owner the holder of a chosen role in the unit that serves it. The owner is
worked out on the day it is looked at, so it follows whoever holds the role
and no name is stored.

Removing a role takes it out of the unit types that hold it and the rules that
name it, in one step. Where people hold it today or later, the question before
it goes says how many and in which units, since their assignments would name a
role that is gone; ending the role on a day instead lists them beside it with
**Move the people**. Removing a responsibility takes every role's part in it
with it.

### Responsibilities

The **Responsibilities** tab is a matrix: a row per responsibility, grouped as
the organisation groups them — by value stream, for example — and a column per
role. Press a cell to take that role's part through R (responsible), A
(accountable), C (consulted) and I (informed), and back to nothing. Each
responsibility wants exactly one A: a row with none, or with several, says so
in its last column, and it is listed among what the organisation contradicts
about itself. Nothing refuses it — a model being worked on passes through both.

Over the matrix, **Roles** keeps the columns of the roles picked and the
responsibilities any of them has a part in, and **Groups** keeps the groups
picked; with nothing picked, everything is shown. The last column still reads
every role, shown or not. Leaving the tab and coming back keeps what was
picked.

The matrix opens in the organisation's **own order**. Press a role's heading
in the matrix and press **Move left** or **Move right** in its inspector to
move its column; press a responsibility's name to move it among those of its group; press the
↑ and ↓ on a group's heading to move the whole group. Each move is one step
that ⌘Z takes back. Something new stands last until it is moved. **A–Z**
shows the roles, the groups and the responsibilities by name instead, and
leaves the own order as it is.

### Libraries

Four starting points ship with the app: **Scrum**, **SAFe**, the **IT4IT**
value streams (the seven of its version 3.0) and **Team Topologies**. Each is
read-only, has a version, and is written in English, Dutch and German, in
this app's own words.

**From a library…** opens them in a dialog over the page. The libraries are
listed on the left; the one picked is drawn in the middle as the structure it
would make, in the same lanes as your own, read-only: each unit type with its
purpose and the roles it holds, and under the lanes the roles none of its
types holds. Press a role to see what it answers for. Tick a unit type, or a
role on its own: what it needs comes along and is drawn dashed — the roles a
type holds, the types it sits in in the library — and a role always brings
the responsibilities it has a part in. An entry your model has already says
**in your model as …**, or **(matched)** where an earlier step matched it to
one of your own, and is used as it is.

On the right, **What will come in** is the step before it is written. Every
name can be changed in place, starting from the library's word in the
language you work in. Each unit type says where it will sit: as in the
library, at the top, beside one of your types — in the same places — or
inside one. A library's type at the top that holds none of its own types
lands beside your deepest type that holds nothing, so Team Topologies' teams
sit beside your teams rather than loose at the top. Each role is brought in,
or one of yours is used for it — suggested where the library says the two are
alike, or where the names are the same — and then nothing is brought in for
it. **Bring in** says how many items the step makes and writes them as one
step: the page then marks what is new until you leave it, and the message at
the bottom offers **Undo**, which takes back that step while nothing has
happened since. ⌘Z takes it back too.

What comes in belongs to the organisation: rename it, rewrite it, cut it. The
**Libraries** tab shows, for each library, **What came in**: the library's
word beside what it is called here, which you can rename in place — press the
library's word to open the item where it is edited — and what has changed
since; and the ones that used one of yours, as **used your …**. A name or a
place chosen on the way in is not a change; a unit type moved since is one.
Each item remembers the library entry and the version it was based on, so
**Compare with the libraries** lists how it differs from the library as it
ships now — read in the language it was brought in — and says when a library
has moved on to a later version. Nothing is ever merged in. The frameworks'
names are their owners'; none of the libraries is endorsed by them.

An agent reads the operating model with `unitTypes.list`, `roles.list` and
`responsibilities.list`, from the organisation whatever scope is open, and
changes it with `unitType.add`, `unitType.update`, `role.add` and
`role.update` while the organisation is the scope open. `unitTypes.list`
gives each unit type its lane — 1 at the top, and below the deepest type it
may sit in — and lists them by lane, then by their `order` in it, then by
name, the ones that sit nowhere last.

### Units and the people in them

An actor becomes a **unit** when it has a unit type: choose one under **Unit**
in its inspector, on a board or on its page, and **Not a unit** makes it a
party again. Nothing else marks a unit. The unit it sits in is the actor it is
filed under, and the dates it starts and ends are its lifecycle dates — so a
unit that has retired has ended.

**The quickest way to make a unit is on its organisation chart**: **+ Unit
at the top**, or the **+** on the name row of the unit it is to sit in (see
*The organisation chart*). Typing an actor in its inspector, on a board or a
sheet, works as before.

**A unit's inspector puts the unit first.** On a board, a sheet, the chart
or its page, its name comes first, with **Move…** and **Create drawing** in
the **⋯** beside it. Under the name are its unit type, with the scope it is
filed in beneath it, and then the unit's own sections. Last comes
**Element**, folded: the actor's own fields — its record, General with its
lifecycle, *Managed* and description, Appearance and Data. It is folded again
each time another unit is picked. On the page the same fields are laid out
below the unit. An actor without a type keeps the element's inspector as it
was, with **Unit** under its General tab.

A unit's sections, in that order:

- **Roles, today**: each role its type holds, with how many it wants, and who
  holds it today — by name from the register, with their share where it is not
  all of their time, *acting*, and *you*. Every role is listed, optional ones
  included, even where the chart leaves an empty optional role out. A role
  short of people shows **+ vacant**; a press assigns someone. **+ assign** on
  a role with room for one more does the same. **A role beyond its type…**
  adds an optional role to this unit only.
- **Who manages it**: one line for each person who holds a role that manages,
  in this unit or a unit above it, today, nearest first — and, where such a
  role reports elsewhere by a line manager's line, whoever it lands on,
  marked *by line*. **why?** says what that means: the app says it and grants
  nothing from it.
- **Reporting lines**: each role of the unit with a reporting line today,
  where it lands — the role and the unit — whether it is a line manager's or
  functional, whether it is the unit type's or this unit's own, and *nobody
  holds it* where nobody holds the role it lands on. **Override…** points the
  role at a role in any unit, line manager or functional, for this unit only;
  **Report by nesting here** says the role reports up the way the unit is
  nested, whatever its type says; **Use the type's** takes the unit's own
  line away again. **A line for…** gives a role that has none one of its own.
  The holders of a role with a line manager's line are managed by the holders
  of the role it lands on, and then by whoever manages those; the rest of the
  unit by nesting. A line from a role to itself in the same unit, and one that
  would close a loop, are refused and said why.
- **Serves**: the domains it serves, the scope it is filed in unless you say
  otherwise — but never the organisation: a unit filed there serves nothing
  until **+ Domain** gives it one, and says **No domain** where you may only
  read. A unit that serves several domains is filed in the scope above
  them, and its type must allow it. **+ Domain** picks another domain, where
  its type allows more than one. Pressing a domain opens its home, whose
  **Served by** says the same from the other end.
- **Owns**: every application that names it as the actor it belongs to.
- **Responsible for**: the areas, groupings and capabilities it is assigned,
  with the scope that keeps the row where it is another. **+ Area or
  capability** picks one from the whole organisation, and the row is written
  in the scope that defines it — this one's as a step here, another's as a
  step there, where you may change it. **✕** on a chip takes a row kept here
  off.
- **Works with**: the units it has declared it works with (see *The Conway
  map*).
- **Over time**: the day it is there from, its last day, and every move a plan
  makes of it (see *Change over time*).
- **Checks**: what the organisation contradicts about this unit today — a
  role short of people or over its maximum, a unit filed where its type may
  not sit, one serving more domains than its type allows or owning more
  applications than its limit, someone still in a unit or a role that has
  ended, anyone in it whose shares add up to more than all of their time, and
  an area, grouping or capability it is responsible for in a domain that
  neither it nor a unit above it serves; and of its reporting lines, one that
  lands nowhere because no unit has the role, one several units could take
  with none above — **Override…** says which — one on a role nobody holds,
  and lines that come back to where they started, today or on a later day a
  line starts or a plan moves a unit. A unit serves a domain when it serves
  that scope, a scope above it or one within it. In the list of findings, a
  role short of people offers **Assign…** and an assignment that has outlived
  its unit or role **End the assignment…**, where you may change that role's
  people. The organisation's home lists the same findings for every scope.

The sections read the day the board beside them is looked at. On a board that
shows another day — its own saved day, or a day picked under **Showing** or
on the roadmap's slider — the inspector says *As on* that day, and its
holders, who manages it and its checks are that day's, a plan's moves of that
day included. Something assigned or ended from there starts on that day where
it is still to come.

**Assigning** someone is one step in the scope that keeps the unit: choose the
role, the person — searched in the register, *you* marked — their share, the
first day, and whether they are acting. **New person…** is the People page's
own form, so someone who may already be in the register is offered before a
second entry is made. The assignment holds the person's id, never their name.
Press a holder to correct the assignment, **End on** today, or remove one made
by mistake; one that has ended stays, as what the person held.

**Mark as left**, on the People page, ends every assignment of the person's on
their last day — one step in each scope that keeps one — and takes away any
that would only have begun after it.

**Deleting a unit** is a correction: it says the unit was never there, so its
assignments go with it in the same step, ended ones included, and the
question before it names who stops being what. A unit that stops existing on
a day is ended on that day instead — its lifecycle, or a plan — and its
people's roles end then and stay in their history. **An assignment in a unit
that is not there** — left by a unit deleted before deleting took them along,
or by an actor that is no longer a unit — is a fix, *An assignment in a unit
that is not there*, whatever its days: the person still counts as holding the
role. On the Checks page it opens the person in People, and **Remove the
assignment** takes it away. The units inside a unit deleted move up into its
parent, or into another unit of its type where theirs may not sit there, or
go too; the applications it owned show as owned by nobody (*Elements*).

A unit kept in another scope is shown here and changed where it is kept.

**Where a role that manages gives a right.** The app grants nothing from who
manages a unit; a source that knows who signs in may, and says so. There, a
person linked to an entry who holds a managing role today changes the people
of that unit and of the units below it even in a scope they may only read:
**Assign**, a holder's correction, **End on** and removal — a role that
manages only in a unit below their own. Reporting lines move that right: a
role whose line manager's line lands on a role they hold is theirs to change,
in whatever unit it is, and the people in it in turn; a role in their units
whose holders report elsewhere by such a line is not. A functional line gives
no right. Nothing else of the unit changes. The
same goes for a vacancy on the organisation chart, for **New person…** and
**Mark as left** on the People page where the source says so, and for *Move
the people*, which then writes their rows and leaves the others as they are.

An agent makes an actor a unit with `element.update` (`unitTypeId`, `scopes`,
`extraSlots`), lists who holds what with `assignments.list` — across the tree,
and for one unit its roles and who manages it — and assigns and ends with
`assignment.add` and `assignment.end` in the scope that keeps the unit. It
never forgets, removes or merges anyone. `element.remove` on a unit takes its
assignments too and lists them in its answer (`assignmentsRemoved`), moves
the units inside it up where their type may sit there (`unitsMoved`), clears
the team of the applications that name it (`teamCleared`) and takes its rows
in other scopes along (`alsoChanged`). Where the units inside may not move up
it is refused, `agent.unitsInside`, with the choices named: the agent asks
you, and calls again with `units` — `into:<id>`, `up` or `delete`;
`checks.list` names one left behind as `check.assignmentOrphaned`, which a
person removes. Who serves a scope is the unit's
`scopes`, written with `element.update` in the scope that keeps the unit — the
organisation, `""`, is never one, and is dropped from what is written; who
is responsible for a capability is an `assigned` row, written with
`relation.add` in the scope that defines it; and `checks.list` names a
capability assigned outside its domain as `check.unitNotServing`.
`assignments.list` says who manages each holder, each with `via` — `nesting`
or `line` — and the functional lines apart. A slot's line is `reportsTo` in
`unitType.add` and `unitType.update`; a unit's own is `reportingLine.set` —
to a role in a unit anywhere, or by nesting here — and `reportingLine.remove`,
in the scope that keeps the unit; `reportingLines.list` lists every line on a
day, where it lands and what the lines contradict. A line to itself is
refused `reportingLine.self` and one that closes a loop `reportingLine.loop`,
with the chain.

### Change over time

A correction is an edit; a change has a day. Renaming a unit, a role or a unit
type is an edit, and so is putting a unit under another parent outside a plan:
it was always so, and the history says when it was corrected. A unit that
starts or ends does so on its lifecycle dates; an assignment on its first and
last day; a unit type and a role on theirs.

**On the operating model page**, a unit type and a role have **From**,
**Until** and **Followed by** under *Over time*. A role that ends lists its
people after its last day — the role's successor in the same unit is the
suggestion for each — with *Move the people* below (see below). A unit type
that ends lists its units still there afterwards, with who holds a role in
each: what each is now is for you to decide, by giving it another type or
ending it. A unit still of a type that has ended is a finding.

**Taking a role out of a unit type** — the ✕ beside it under *Roles it holds*
— first lists who holds that role in a unit of the type, where the unit has no
slot of its own for it: *Move the people*, under the slots, each with the
role's successor the unit still holds as the suggestion, their last day in it
today. **Write as one step** takes the role out of the type together with
their ends and beginnings, all of it or none of it, so nobody is left in a
role their unit's type does not hold; **Keep**, with the role's name, leaves
the type as it is. A role nobody holds that way goes at once.

**A reorganisation is a plan.** On a plan's page, *Units it moves* puts a unit
under a new parent on a day — or at the top, under the organisation itself —
one step each. **Move by…** shifts those days with the rest of the plan. From
its day the move holds wherever the organisation is read: a unit's section,
the checks, who manages a unit. An abandoned plan moves nothing. Above the
plan's interfaces, where the plan touches units, the page says:

- **What it does to the organisation**: the units it introduces and retires,
  each with its day, the moves, and the roles that end the day before its
  day, with what follows them.
- **The day before** and **on** its day: the units under the smallest trees
  that hold the whole change, with who holds a role in each — *ends*, *new* and
  *moved* marked.
- **Move the people**: every assignment in a unit or a role that ends, each
  with a suggestion — where the unit went (its successor), or the role's
  successor — which you accept or change; a team that moves takes its people
  with it, so it is not listed. Nobody's new place is guessed: a row with no
  suggestion only ends. **Accept every suggestion** sets every row back to its
  suggestion, and **Write as one step** writes every end on its last day and
  every beginning the day after, in every scope that keeps one, together.
  Where the plan's scope is the only one written, ⌘Z takes the whole step
  back; where other scopes were written too, it is put back in each.
- **Still open on** its day, in the list of findings: what the checks find in
  those units then — one about a unit opens it — every responsibility that
  loses its A because the role accountable for it ends, and every interaction
  the plan's units are left to declare: *Declare how* a unit it introduces or
  moves *works with* another, where an interface crosses between their
  applications with nothing declared — as when the cluster it retires was the
  one that had declared it. **Declare an interaction…** opens the plan's unit,
  whose **Works with** declares it.

An agent puts a unit under a new parent on a plan's day with `plan.move`,
dates a unit type or a role with `unitType.update` and `role.update` (`from`,
`until`, `successors`), and reads the organisation of a day with
`assignments.list` and `checks.list` (`on`).

### The organisation chart

An **organisation chart** is a view: **+** in the diagram tabs, then
**Organisation chart**, makes one, with a tab of its own. It is laid out from
the units — nothing on it is placed by hand — as nested boxes: each unit inside
the unit it sits in on the chart's day, a plan's moves included, the units filed in this scope and below it and the units
that serve it from above, and at the organisation every unit there is. Units
beside each other stand in the order of their types — a type at the top first,
then the types that sit in it — and units of one type in their own order where
one is set, otherwise by name. Every list of units keeps that order: the
outline, the Conway map's columns and every place a unit is picked.

**The outline** beside the chart lists the same units as a tree. Picking one
there goes to it on the chart — unfolded, scrolled to and ringed — and chooses
it where this scope keeps it. Under the outline, **Move up** and **Move down**
move the unit picked among the units of its type in the same unit: one step in
each scope that keeps one of them. Where they are all kept in this scope, undo
takes the move back; where some are kept in other scopes, each scope is put
back on its own.

**Making a unit on the chart.** **+ Unit at the top** is on the bar, in the
outline's header and on an empty chart; a unit's own **+**, on its name row,
shows when the row is pointed at, holds the focus or the unit is picked, and
makes a unit inside it. A small dialog asks for four things. **Type** offers
only the types that may sit there: inside a unit, the types that may sit in
its type; at the top, the types that may sit at the top. **Name**. **Serves**,
asked only at the top or for a type that serves several domains: the domains
it serves, which may be none yet — a unit inside another serves through it.
**Filed in**, the scope that keeps it: by default the scope of the unit it
sits in, so a subtree stays together under the same rights; at the top, the
domain it serves where it serves one and its type does not serve several, and
otherwise this chart's scope. Any scope you may change can be chosen.
**Create** is one step in that scope: undone here where it is this scope,
and in that scope where it is another. Making a unit is structure, so the
scope's rights decide, and a role that manages people does not give the
right. The new unit is picked — unfolded and scrolled to — and its type's
required roles show as **+ vacant**, so assigning people follows straight
on. Where no type may sit, **+** says so — *No unit type may sit in a Team* —
and leads to the **Operating model**; with no unit types at all, it leads to
**Start from a library**. A chart that is only read offers none of it.

**A large organisation folds.** The caret beside a unit's name folds the units
under it, and the unit then says what it hides: its units and people, and the
vacancies and findings among them. The first time a chart of more than 30
units is opened, everything below the second level is folded, and the page
says so. **Fold all** and **Unfold all** are on the bar; the outline folds on
its own. **Find a unit** goes to the first unit whose name holds every word
typed; it, **Find me** and **Open the unit** on a finding beside the chart
unfold the way to the unit they go to. A fold lasts while the app is open and is never saved.

Each box says the unit's type and name, and each row a role it holds, with who
holds it **on the chart's day**: by name from the register, their share where it
is not all of their time, *acting*, *ext* for someone from outside the
organisation, and *you*. A red edge marks someone whose shares add up to more
than all of their time across the organisation. A role short of people shows a
dashed **+ vacant**; in a unit this scope keeps, a press assigns someone at once,
as one step. A badge names the domains a unit serves where it serves more than
one — the first two and how many more, where there are many — and says the day
it starts, where that is after today, and the day it ends, each with the plan
that brings or ends it where a plan does: *from 1 Jan 2027 · TR-0007*.

The units under a unit stand side by side in as many columns as the width
holds; one with units of its own under it takes a whole row, so they have the
width in turn. A role the unit's type does not require and nobody holds — an
optional one — is not drawn: it is a choice, not a gap. **Show optional
roles** on the bar draws them, each with **+ assign** where you may assign
someone, and the unit's inspector always lists every role. Like a fold, the
switch lasts while the app is open and is never saved.

**Reporting lines** on the bar draws the lines over the boxes, on the chart's
day: from the row of each role with a line to the row of the role it lands
on, solid for a line manager's and dotted for a functional one. A line to a
role nobody holds is drawn in the warning colour, and one that is part of a
loop in the error colour. A line to or from a unit folded away ends at the
fold. It is off until it is turned on, for as long as the page is up.

The chart is drawn on a day, as a board is: the day control on the bar looks at
any other day, and **Save** keeps that day on the chart (see *Time, and the day
a board shows*). On a later day the units a plan brings are there, and a unit
that has ended is still drawn — dashed, and saying so — while anybody is still
assigned to it, so the people a reorganisation left behind are seen where they
were left.

**With nothing picked, the inspector beside the chart is its summary**: whose
chart and on which day, how many units and people are on it and how many
places are vacant; then **Findings**, what the organisation contradicts about
these units and the people in them, in the list of findings — **Open the
unit** goes to the unit it is about, and **Open in People** to a person over
all of their time;
and **How to read it** — a dashed **+ vacant** is a role the unit's type
requires and nobody holds, a red edge is someone over all of their time,
*manages* marks a role whose holder manages the unit's people, and a dashed
box is a unit that has ended with people still in it.

Choosing a unit this scope keeps opens it in the inspector beside the chart —
its people, its roles, who manages it and the units it works with. A unit kept
in another scope opens there, on that scope's chart, chosen, with the same
inspector beside it — or on its record where that scope has no chart. **Find
me** goes to the unit where you hold a role; say who you are first, with **This
is me** on the People page.

Pressing a person opens their assignment in the inspector instead: who holds
it, the role and the unit, its first and last day, the part of their time it
takes, and a note where they hold more than all of their time on the chart's
day. **End on this day** ends it, as one step, on the last day you choose — the
day before the chart's day where you are looking ahead, today otherwise, and
never before its first. An ended assignment stays: it is what the person held.
**Correct…** opens the unit's dialog for everything else, and **Open in
People** goes to the People page with the person picked. A person in a unit kept
in another scope opens that unit there.

### The Conway map

A **Conway map** is a view too: **+**, then **Conway map**. It puts the units
over the applications they own — an application belongs to the unit it names
as its owner — and draws the interfaces between them: a solid line where the
two units have declared that they work together, a dashed one where they have
not. The columns stand in the order the chart lists the units in. **Group
by** rolls the columns up to a unit type above the owners, a domain or a
cluster, say. A table under the map counts the interfaces between
each pair of units, with a letter for every way they declared they work
together — whether an interface runs between them or not. A cell is shaded
where an interface has nothing declared, and shaded another way where an
interaction is declared that no interface needs.

**Findings on** *day* says what the two disagree about: an interface that
crosses from one unit's applications to another's with nothing declared
between the units; an interaction declared with no interface between the
two, which is often meant and is said as a fact; an application nobody owns;
and a unit that owns more applications than its type allows. They are the
list of findings, and an interaction no interface needs is a note, behind
**Show notes**. A finding opened marks what it is about on the map. The map
only reads: where one of the two units is kept in this scope, **Declare an
interaction…** answers a crossing as one step; where this scope keeps an
interaction no interface needs, **Remove the declaration** takes it away as
one step, and **Model the missing interface…** offers the two units'
applications, to open the one to model it from; **Mark as intended…** says
the two work together without an interface, with a reason; **Open the two
units** opens either; and everything else is answered where it is kept — an owner on the
application, a limit on the unit type. Like the chart it
is drawn on a day, and **Find me** goes to your unit. An application is on the
map while it is live or retiring on the map's day: one not yet live, or gone,
is not drawn, and neither are its interfaces nor anything the map would find
about it; a unit's limit counts what it owns on that day.

### Who works with whom

A unit's inspector has **Works with**: every unit it has declared it works
with, in one of three ways — **Collaboration** (side by side on one thing, for a
while), **As a service** (one provides what the other uses, with little to
agree each time) and **Facilitating** (one helps the other learn or take
something up) — and the days it holds, where they are known. **+ Declare an
interaction…** adds one, a press on one corrects it or removes it, each as one
step in the scope that keeps the unit. One kept in another scope is listed with
where it is kept. A draw.io box that points at a unit opens it on the scope's
organisation chart, where there is one.

An agent makes either view with `diagram.create` (`chart`, `conway`), opens it
with `app.open`, and reads what it draws with `diagram.inspect`: the units with
each role's holders and vacancies on the view's day, in the order the chart
lists them and never folded, or the columns, the crossings and the findings,
each with its check's key, weight and category as `checks.list` gives them.
It declares an interaction with `relation.add`,
type `interacts` and a `mode`.

## A drawing

A **drawing** is a view. **+** in the diagram tabs, then **Drawing**, makes one,
and a scope's home offers the same under **New board…**. It has a tab of its
own, like a landscape or a sheet.

A drawing is shown as its picture. A drawing that has no picture says **Not
drawn yet**, and has no areas.

On the picture, each shape that points at an element is a transparent area.
Choosing the area opens that element. The element's inspector lists the
drawings in this scope that point at it; choosing one opens it. A shape that points at an element
this scope does not hold is a finding.

**Edit** opens the editor, in the language the app is using. The palette holds
the scope's elements — each a shape that points at that element — and the C4
shapes. When the editor opens, each shape that points at an element is
labelled with that element's name as it is now. Saving keeps the drawing as
one: its XML, its picture, and the links the shapes make. **Exit** leaves the
editor, and asks first when there are changes no save has kept; **Save &
Exit** leaves once the save has landed. When somebody else saves the same
drawing while the editor is open, theirs is merged into what is open.

The editor and the picture follow the app's theme: light, dark, or the
system's. Changing it while the editor is open keeps what is being drawn.

A view that may not be changed offers no **Edit**. Deleting an element keeps
the drawings anchored to it, without the anchor; undo puts it back.

Where no address for the editor was given, the drawing is still shown, and
**Edit** says the editor is not available.

A drawing may be anchored to an element. The element's menu offers **Create
drawing** beside **Create container diagram** or **Open container diagram**,
and the inspector has the same button. Making one is one step, and undo takes
it away. A double-click on the element offers the drawings anchored to it,
beside its container view when it has one. A double-click never makes a
drawing.

The element's page lists those drawings. Choosing one opens it.

In a document, `![caption](view:id)` shows the view with that id from this
scope. A drawing is shown as its picture, with a transparent button for each
shape that points at an element; choosing the button opens that element. A
view of another kind shows the caption and **No picture yet**. A view that is
not in this scope shows the caption and says the view is missing.

## Search

**Search** in the top bar, or ⌘K, searches everything at once: elements by
name, category, vendor, technology and owner; documentation by what is written
in it; views by name; relations by label, protocol and technology; decision
records, plans and their milestones; and observations, causes, solutions and
experiments by their title and what is written in them. It reads the scope you
are in, the decision records of the scopes above it, and what the rest of the
organisation holds of elements, relations, plans and observations. Each hit
says what it is — a heading per kind, and the element's kind or the record's
status beside it — and which scope holds it. Choosing an element selects it
and pans to it, a documentation hit opens that element's page, a relation
opens the box it leaves, and a record opens on its own page; a hit from
another scope opens that scope there, read-only where your source is. ⌘F inside the editor remains the quick
finder when all you want is a box on the canvas.

## Comments

A record says what it says; a **comment** is what somebody says *about* it — a
question, a doubt, a pointer to more evidence — without changing it. Every
observation, cause, solution and experiment, every element (units too), every
decision record and every plan ends in its **Comments**: the thread about that
record, oldest first, each reply under the comment it answers. A heading says
how many there are, and an observation's row in the register shows the count
beside its title.

- **Comment.** Write in the field under the thread and press **Comment**
  (⌘Enter does the same). The body takes the Markdown a description takes.
- **Reply.** Press **Reply** under a comment. A thread is one level deep:
  replying to a reply answers the comment it is under.
- **Edit.** Your own comments only. An edited comment says *edited*.
- **Remove.** Your own, or anybody's where you may change the scope. A
  removed comment reads *Comment removed* where it stood, so the replies under
  it keep their place. Its words stay in the history, as any edit does.

**Who wrote it** is a person in the register, never a name typed in. The first
time you comment and nobody is *This is me* on this install, the thread asks
once who is writing — pick yourself, or add yourself with **New person…** —
and remembers the answer as *This is me*. Forgetting a person on the People
page reaches every comment they wrote, which then reads as their pseudonym.

Each comment, edit and removal is one step: it is in the **Activity** list
(*Commented on Webshop*), in the history and in the export, and ⌘Z undoes it.
A comment never changes its record, so the record's own history stays its
own. Where a scope is only read here, nothing can be commented — unless the
place your work is kept lets a reader comment.

**What travels with a record.** Deleting a record takes its thread with it,
and undo brings both back. Merging observations or causes moves each absorbed
record's comments to the survivor, each saying which record it came with; the
merge screen says how many go. An observation moved to another scope takes
its thread along, each comment saying the scope it came from; the move screen
says how many go. A merged or archived record keeps its own.

Comments are kept with the scope, in `_comments/`, one file per record
commented on. **Search** finds what a comment says in the scope you are in,
and opens the record it is about.

An agent comments as you do (`comments.list`, `comment.add`,
`comment.update`, `comment.remove`): its comments are signed by *you*, say
which agent wrote them, and are edited and removed by the same rules.

## Diagram settings

Right-click a diagram tab, **Diagram settings…**.

- **On the drawing.** Author, client and date for the title block of a PNG
  export, each falling back to the scope's default or the day of export when
  left empty, and whether to draw the title block at all.
- **Operational aspects.** The aspect columns applications on this diagram carry:
  add a standard one (platform, CI/CD, DR, security, monitoring, backup,
  compliance, cost), add your own, rename, reorder, or switch the badges off
  altogether. Renaming a column keeps every status already recorded against
  it.

## Saving, exporting, sharing

Two ways out, for two purposes.

- **The working file** (`.lvarch`, **File › Save a Copy of the Working
  File…**) is everything and is what you hand to someone who will edit
  further. It is your **whole organisation** in one file, **sealed under a
  password**: you are asked for one when you save the copy — twice, because
  a lost password cannot be recovered — and whoever opens the file is asked
  for it again. Nothing about what is inside can be read without it. It holds
  every scope, whichever screen you are on when you export — the
  organisation's home, a scope's home or an open board: a landscape on its
  own refers to applications defined a level up, and a file with only the
  landscape in it would open on someone else's machine full of names pointing
  at nothing. The file is named after your organisation. Working files from
  earlier versions still open, sealed or not, and one holding a single scope
  still opens as that scope. It is also how work moves **between places**: a
  file saved from the desktop's folder opens in this browser, or the other way
  round, the same byte for byte, pictures and all. **Opening one asks where it
  goes**:
  - **A new folder…**, where a folder can be chosen, makes it a working folder
    of its own and takes you there, leaving what you had open untouched. A
    folder that already holds something is only written over after a second
    yes.
  - **Replace … here** writes it over the scope you are on and everything
    filed under it, and says so before it does. Where a history is kept, a
    snapshot is taken first, so what was there can be restored. Where none is
    kept, it is gone.

  Every scope in the file lands, or none does. Once it has landed, the app
  checks what arrived against what the file says it holds, and says so.

  The file carries the **people register** too. Tick **Without names** when
  you set the password, and every person goes into the copy as their
  pseudonym, with no address, and a signed decision without the names it was
  signed with — for a copy that leaves the organisation.
  Opening a file never gives a name back to someone forgotten here, never
  brings back anyone removed here, and a file made without names takes no
  name away. Someone forgotten or removed where the file was made is
  forgotten or removed here too: forgetting travels with the work.
- **PNG export** (the download button) opens a dialog with a preview of the
  picture as it will leave: in the light or the dark theme regardless of the
  one on screen, with every line's label or only the bare lines, with or
  without the title block along the bottom — client, author and date — and
  with or without the legend under it, which says what the badge and lifecycle
  colours mean. A container diagram's export carries its C4 corner in the
  strip: the level, the application, a sentence and the date. Lifecycle badges
  can be switched off first for a clean picture. If a logo could not be
  embedded, the bottom bar says which. A very large board is tens of megapixels
  and takes a while to draw, so the dialog says how big the image will be and
  its button asks before it starts.

## Working with an agent

Your coding agent — Claude Code, Codex, Cursor or any other MCP client — can
connect to the desktop app (*Connect an agent…* on the bar, or the glyph
beside the menu) and work in the organisation while you watch. It reads
every scope, and it can move the app the way you do: open a scope, switch to
a board or a sheet, open the decisions or the roadmap, open the observations
on the Register, Analysis or Solutions tab, look at a report. It can open a
board, a sheet, a map or a technology landscape with one thing selected on
it, where that view draws it. It does not need you to open anything for it
first, and opening a view never makes one: where a scope has no view of the
kind it asks for, the agent is told so and the screen stays where it is —
making one is a change like any other. Whatever it opens is what you see, so
a record's page that was open over the board closes.

While it is moving the app or changing the model, a strip along the bottom
of the window says so, with the agent's name and — when it said — what it is
doing. Anything you click meanwhile can change what the agent sees next, so
the strip is there to tell you before you do. **Stop** on that strip ends the
agent's session: the strip goes, the agent is told on its next call, and it
is expected to report where it got to rather than carry on. It may ask you
to continue; when you say so, it starts a new session and the strip is back.

Everything an agent changes shows in Activity under its name and is undone
with ⌘Z, as before.

An agent can read the **people register**, add someone to it — it is told
when somebody similar is there already — and mark someone as left. It sees
names, or pseudonyms where the organisation's policy says so, and it is told
whether a person has an address, never the address. It cannot forget,
remove or merge anyone, or change the policy: those are yours, on the People
page. The register is no step, so what an agent does there is not in
Activity and is not undone with ⌘Z.

## Preferences

Grid, snapping, lifecycle badges, collapsed panels and their widths, the
minimap, the tidy settings, the language and the theme are remembered per
browser or per desktop install. They belong to you, not to the scope: they
do not travel in a file. The same goes for what this machine does about a
folder — pull on open, push after a snapshot: the desktop keeps that with the
install, and writes nothing of its own into your folder.

## Undo

**⌘Z** covers everything, in the order you did it: a box moved, a diagram
renamed, a decision accepted, a scope setting cleared. Typing a name is one
step rather than one per letter, and a drag and the lines that re-route after it
are one step — so going back once gives you what you had rather than what you
had a keystroke ago.

**Activity** in the top bar lists those steps with their names and times. It is
a record, not a way back: stepping to an entry would raise a question ("and
everything after it?") that ⌘Z already answers.

## Shortcuts worth knowing

| Keys | Does |
|---|---|
| `?` | Every shortcut |
| ⌘F / Ctrl+F | Find an element |
| Enter | Open the selected element's documentation |
| F2 | Rename the selection |
| Delete | Remove the selection, after asking |
| ⌘Z, ⌘⇧Z | Undo, redo — one stack over everything |
| ⌘C ⌘X ⌘V, ⌘D | Copy, cut, paste, duplicate |
| Arrows, ⇧Arrows | Nudge by a grid step, by a pixel |
| Shift+1, Shift+2, `=`, `-` | Fit view, 100 %, zoom in, zoom out |
| Shift+F10 | The menu for the selection |
| ⌘S / Ctrl+S | Save now |
| ⌘[ ⌘] on macOS, Alt+← Alt+→ elsewhere | Back, Forward, in the desktop app; in a browser, the browser's own |

On Windows and Linux, read Ctrl for ⌘.
