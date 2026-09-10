# ADR-0012 — The organisation as the top scope, and what "external" means

* Status: proposed
* Date: 2026-09-10
* Deciders: Wouter Simons

## Context and Problem Statement

This tool has two scopes above a diagram and needs three.

A project is addressed by a `ProjectRef` — a group path and a key inside it —
and a group is derived from the projects filed under it. That was the right
shape when the question being answered was "where do I keep this landscape",
and ADR-0003 filed the answer as folders. It has since acquired a group record
(`GroupProfile`) carrying a name, a client name for drawing title blocks, links
and the group's own decisions.

What has no record at all is the thing above the group: the **organisation**.
It shows up three times as a workaround.

* **Its name rides on every project.** `model.customerName` is the group's
  display name, kept on the model because that is the only record that reaches
  every screen. `projects/group.ts` says out loud what that costs: a rename has
  to rewrite every project in the group rather than one file.
* **Its decisions have nowhere to go.** There are three ADR lists — the group's,
  the landscape's, and an application's — and the one people actually ask for
  first is the organisation's: the principles that hold across every domain and
  every project. Today that is a group's list, which is only correct in the
  common case where an organisation happens to have one group.
* **Its settings have a home but no keys.** `.lionsville-architecture/folder.json`
  exists at the working root, is read everywhere, tolerates absence, and is
  deliberately not written until it has a key (`projects/folderSettings.ts`).
  The organisation's identity is that first key.

Underneath all three is a naming problem the tool has been quiet about. A group
is described as "whatever the namespace is called in this environment: a
customer, a department, a programme". In practice, and in every real landscape
this has been used on, it is a **domain**: a slice of one organisation, owning a
part of the business and the applications that support it. The level above it is
not another namespace. It is the organisation, and it is where the things that
must not be renamed by a domain live.

The second problem arrives with the first. Once there is an organisation, the
word **external** stops having one meaning:

* An application owned by another domain, drawn as an incoming box on this
  domain's board. External to the *diagram*. Inside the organisation.
* A partner's system, a regulator's portal, a SaaS product. External to the
  *organisation*. Owned by nobody here.

Today `ElementKind` has one `externalSystem` and it is asked to mean both. The
consequence is that the most valuable question a landscape can answer — *this
interface comes in from somewhere, where does it come from?* — cannot be
answered, because a box named the same thing on two domains' boards is two
unrelated elements with two locally-minted ids (`model/keys.ts`).

## Decision Drivers

* An organisation's name, decisions and register belong to the organisation, not
  to whichever project last wrote them down.
* A domain may **add detail**; it may not silently redefine what the
  organisation named. A rename in a group must not become a rename at the top.
* "External" must distinguish *outside this diagram* from *outside this
  organisation*, because the second one is a fact about the world and the first
  is a drawing decision.
* Nothing above the seams changes shape for a landscape that does not use any of
  this. A single-domain project must stay exactly as cheap as it is now.
* The rule the picker is built on stands: **there is nowhere to keep an empty
  group.** Groups stay derived from their projects.

## Considered Options

**A group path segment.** Make the organisation the first segment of the group
path — `acme/retail/warehouse-landscape`. Nothing new to build; refs already
nest. Rejected: it puts the organisation in the same list as its domains, so the
picker cannot tell one from the other, and there is still no file at the top to
put the name, the decisions and the register in. It also means a root can hold
several organisations, which sounds like flexibility and is actually the reason
none of them can own anything.

**A project of a special kind.** One project per organisation, holding the
identity and the register in its model. Reuses history, snapshots, ADRs and the
agent for free. Rejected: an organisation is not filed *beside* its domains, it
is *above* them, and a project that must exist before any other project can be
opened is a project only in name.

**The working root is the organisation.** Chosen. The root already has a
settings folder that every store, adapter and smoke test knows how to reach; it
is already what a person points the app at; and it is already one git
repository, which makes "one organisation, one history" true without doing
anything.

## Decision Outcome

**The working directory is one organisation.** Its identity, its decisions and —
in a later step — its application register live in the dot-folder at the root
that ADR-0005 put there:

```
<root>/.lionsville-architecture/folder.json     the organisation: name, client, links
<root>/.lionsville-architecture/local.json      this machine (unchanged)
<root>/.lionsville-architecture/decisions/      the organisation's ADRs
<root>/retail/warehouse-landscape/project.json  a domain, and a project in it
<root>/retail/group.json                        the domain's record (unchanged)
```

A consultancy holding several customers holds several working directories, which
is what it already wants: one repository per customer, one history per customer,
and no path by which one customer's names reach another's tree.

**A group is a domain.** No file moves and no ref changes — this is a decision
about what the level *means*, and it is what lets the level above it own things.
`ref.group` stays a path, so a domain may nest.

**The organisation's name is read from the root, not from the model.**
`model.customerName` becomes derived: the shell reads the organisation's name
and passes it where the label is wanted. The field stays in the file — it is
part of the interchange format's contract and is not renamed (see *Names,
decided*) — but nothing in the app treats it as the source of truth any more, so
a rename is one file. A project whose `customerName` disagrees with the root is
not an error; the root wins, and the project is rewritten on its next save.

**Organisation decisions are the fourth list, and the same list.** Same record
(`model/adr.ts`), same status machine, same per-list numbering that never
reuses a number, same one-markdown-file-with-front-matter on disk
(`projects/adrFile.ts`). What is new is a scope with no model to hang off,
which is exactly the problem `GroupProfile.decisions` already solved one level
down — so the mechanism is proven and this is a second caller, not a second
design.

### Inside, outside, and nobody

The register that makes cross-domain links possible is ADR-0013's subject. What
this ADR settles is the vocabulary it will use, because it is the vocabulary the
whole scope question turns on. **Two independent axes, today conflated into
one:**

* **`kind`** — how a box is drawn *on this board*. `externalSystem` keeps
  meaning what it has always meant: not the subject of this diagram. It is a
  drawing decision, per element, and it stays exactly where it is.
* **`scope`** — whether the thing is inside this organisation at all. A fact
  about the world, recorded once, at the organisation.

The second axis has **three** states, not two, and the third is the one that is
easy to forget:

| scope | attributed to | what it is |
|---|---|---|
| `internal` | a domain | an application this organisation runs, owned by a domain |
| `internal` | — | an application this organisation runs that **nobody owns yet** |
| `external` | a party | a partner's, supplier's or regulator's system, attributed |
| `external` | — | outside the organisation, **not attributed to anyone** |

An internal application owned by domain A and drawn as an `externalSystem` on
domain B's board is one thing seen from two places, and the axes say so without
contradicting each other. An unowned internal application is not an error to
refuse — it is a finding to render, the same way the roadmap renders what the
dates contradict rather than forbidding it. And an external system attributed to
nobody is ordinary: most SaaS is, at first.

A **party** is a record at the organisation — a customer, a regulator, a
supplier, an outsourcing partner, a reseller. It is the same list a business
architecture draws down the side of the sheet as its stakeholders, which is why
the follow-up ADR builds that list rather than drawing decoration.

**Registering is opt-in, at every scope.** A one-off external box on one board
stays what it is today: a local element with a name and no record above it.
Registering earns its keep when the same thing appears on more than one domain's
board, or when who it belongs to matters. The tool must stay usable by someone
who has one landscape and no interest in any of this.

## Consequences

* An organisation gains a page: its name, its links, its decisions, and later
  its register and its parties. It is reachable from the picker, which is
  currently a list of groups with nothing above them.
* A group rename stops rewriting every project in the group. The group keeps its
  own name; what it stops carrying is the organisation's.
* `folder.json` gets its first keys and starts being written, which is what it
  was shaped and tolerated for. Its readers already survive absence, malformed
  content and a newer `version`, so an older build meeting a newer file is
  already handled.
* A build with no working directory — a browser tab in storage-only mode — has
  no organisation. That is the same absence `FolderSettingsStore` is already
  optional for: the section is not drawn rather than drawn empty.
* `ProjectStore`, `GroupStore` and every adapter are untouched. The new record
  is a fourth small seam over the same folder, following `FolderSettings`.
* The `externalSystem` element kind keeps its meaning and its behaviour. Nothing
  on any existing board changes, because `scope` is a record that does not yet
  exist and absent means "not registered".

## What this takes, in order

1. **`projects/organisation.ts`** — what an organisation record is: name,
   optional client name for title blocks, links, decisions. Pure, with the
   normalise/validate pair `group.ts` already models, and the same link protocol
   allowlist for the same reason.
2. **The first keys in `folder.json`** — `organisation` as a section, written
   through the existing patch-don't-replace writer so a colleague's newer build
   keeps its keys.
3. **`ports/Organisation.ts` and its contract suite**, over the folder, with the
   memory and filesystem adapters. Optional the way `history?` is.
4. **`customerName` derived** — one place in the shell resolves the label, every
   reader takes it from there, and a project's stale copy is corrected on save.
   The interchange format does not change, and the round-trip test says so.
5. **The organisation's ADR list** — `adrFile.ts` over
   `.lionsville-architecture/decisions/`, the existing page given a fourth
   scope, `SCOPE_LABEL` given a fourth entry.
6. **The organisation page**, and the picker's route to it.

Steps 1–4 are one commit each and none of them changes a screen. Step 5 is where
it becomes visible.

## Open questions

* **Does a domain get to propose an organisation decision?** The status machine
  has `proposed`, and the case is real — a domain hits a principle that should
  hold everywhere. Deferred: the answer probably belongs with the business
  sheet's *proposed function*, which is the same shape asked at a different
  level, and two mechanisms for one idea would be a mistake.
* **What happens to a project opened from outside the organisation's root** — a
  `.lvarch` double-clicked from a download. It has a `customerName` and no root
  above it. Working answer: it opens as its own organisation of one, named by
  the field it carries, which is exactly what that field was for.
* **Does the register live in the dot-folder or beside the domains?** Deferred
  to ADR-0013. The dot-folder is settings; a register is content people will
  want to read in a diff, which argues for the second.
