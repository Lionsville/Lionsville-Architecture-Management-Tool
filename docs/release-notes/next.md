# Release notes, next version — draft

*What has landed on `main` since 3.7.5 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

## Principles

- **Architecture principles, kept where they apply.** A scope keeps its own
  principles, numbered, each with a statement, its aspects (what it means in
  practice), its rationale and implications, in groups the scope names. They
  hold in every scope under it, and the *Principles* page of a scope shows
  those kept there and those *from above* apart. A principle is a candidate
  until it is accepted, may be sharpened with a note that says why, merged
  into another, and retired.
- **Citing.** A decision, an observation, a solution, a plan, an element or a
  building block says which principles it follows, departs from or supports —
  a whole principle or one aspect — and a departure says why. *May apply*
  suggests the principles in force that fit. The Checks page finds a citation
  of a principle that is gone, principles nothing cites, and principles that
  chafe.

## Topics

- **A topic is a subject across the organisation** — security, integration,
  data — kept as a scope of its own under the organisation's *Topics*, with
  subtopics, and typed **Topic**. It is linked to the scopes it is relevant
  to from a day, and a link can end and is kept as history. Its principles are
  in force wherever it is relevant today.
- **The catalogue**, from the *Topics* card, lists every topic nested, where
  each is relevant and what it keeps. A scope's home shows its *Relevant
  topics*; **+ Topic…** opens a chooser made for many topics — search by name
  or description, nested as the catalogue, several at once, *New topic…*
  where nothing matches. The tree shows a topic as a row ↗ under each scope it
  is relevant to.
- **A scope becomes a topic** by choosing *Topic* under *What this is* in its
  settings: saving files it under *Topics*.

## Building blocks

- **A building block** says what many solutions must provide: its
  capabilities (a *must* fails any solution that does not cover it fully), its
  usage contexts with what each needs, and its catalogue of solutions —
  products, services, or built in house. The *Building blocks* card opens the
  register of all of them.
- **Each scope evaluates for itself**: the contexts that apply there, the
  options it weighs rated against each capability, and the fit worked out,
  best first. **Propose a decision…** drafts the decision from the
  evaluation; accepting it marks the choice in the evaluation.

## Observations

- **A tone**: an observation is a bright spot, neutral or a problem, and the
  register and its filters say so.
- **Recorded by**: an observation says who recorded it — your account, where
  the source has accounts, or *This is me* — and *Mine* finds yours.
- **Changes**: a record says who changed it, when and via which client.

## Documents that refer rather than copy

- In a description or a decision, `[[` or `@` while typing, or **Insert ▾**,
  refer to a view, an element, a principle or one of its aspects, a building
  block's requirements, a scope's evaluation, a decision or an observation.
  What is referred to is drawn live each time it is read; a view is drawn at
  its own size with a caption that opens it.

## Pages and the agent

- Every page sits under the bar with its ×, closes back to what was under it,
  and keeps the width you gave its columns; cards show their ways in on hover.
- An agent reads principles, topics and building blocks, writes principles
  and citations, makes topics and links them, keeps a block's requirements and
  catalogue, evaluates it and proposes the decision, and refers to records with
  the same words *Insert ▾* writes (`references.list`).

## Compatibility

- The folder format is **15** (a tone and who recorded an observation,
  principles, citations and evaluations); a folder of 14 is read and written
  as 15. Hosted environments speak protocol generation **12**.
