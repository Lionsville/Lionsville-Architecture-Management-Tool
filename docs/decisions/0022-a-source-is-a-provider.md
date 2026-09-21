# ADR-0022 — A source is a provider, and a step can come from another author

* Status: accepted
* Date: 2026-09-21
* Deciders: Wouter Simons
* Extends: ADR-0002 (every change is a command through one reducer), ADR-0005
  (what you are working from, and the document session)

## Context and Problem Statement

Where work is kept was a closed question. `WorkingSource` was a union of
three — a folder, this browser's storage, memory — `composition.ts` had a
branch per case, the bar had a sentence per case, and `documentSession` knew
that *dirty* meant a file not yet written. Adding a fourth place to keep work
meant editing the union, the composition, the bar, the workspace and the
document session: five files above the seam, for something that is supposed
to sit below it. The icon packs had already solved the same shape once
(`registerLogoPack`), and nothing in the way work is kept was harder.

The second half of the question is worse, because it is not about where a
document lives but about who is editing it. Everything in this app assumes one
author at a time. The stack is this keyboard's, `revision()` counts this
session's changes, an id is minted against what this session knows is taken,
and a file changed underneath us is *external-changed* — a whole document to
re-read, which is the right answer for a colleague who saved once an hour and
a poor one for anything finer. Nothing in the tree could take a single change
made by somebody else and put it on the model beside our own.

Both are questions about a **seam**, and neither is a question about what
goes through it. What this codebase can usefully carry is the place a filling
plugs into, the vocabulary it plugs in with, and the proof that it fits.

## Decision Drivers

* **ADR-0002 is why this is small.** Every change is a `Command`, one pure
  reducer applies it, and the inverse is computed from the state the reducer
  saw. Two sides that apply the same commands in the same order hold the same
  model — so what a second author needs is somebody to put steps in one order
  and one place to hand them over. Not a rewrite: a port and three functions.
* **The seam, and nothing that goes through it.** A seam in this tree must
  stand on its own: readable, testable and useful to whoever fills it,
  without this tree learning anything about who fills it or why.
* **Three fillings must fit, and a fourth must not be needed.** The shape is
  taken from the three sources that ship. If the folder, the browser's storage
  and memory do not all fit on it, it is the wrong shape.
* **Nothing visible changes.** The bar, the organisation screen, the dialogs
  and every existing test read exactly as before for all three built-ins.
* **A refusal is a key, never a sentence** — including the new one.

## Considered Options

1. Leave the union closed; add the fourth case when something needs it.
2. A registry for the source, and nothing about a second author: a provider
   that keeps documents somewhere else, read and written whole.
3. **A registry for the source, a port for the steps, three functions on the
   session, and one hook on the desktop side.**
4. Multi-author editing in this tree: presence, a resolution UI, a transport.

## Decision Outcome

**Option 3.** Four pieces, each of which is a place something else attaches.

### A source is a provider

`platform/sourceProvider.ts` says what a kind of place work is kept has to
answer for: its `kind`, an `open` that builds the parts of a shell from
whatever that kind needs to be given, an optional way in for a person as a
label rather than a screen, and `statusOf` — what this source means by the
five words the bar says (`clean`, `dirty`, `saving`, `external-changed`,
`conflict`). `SourceStatus` moves here and `DocumentStatus` becomes it plus
`no-file`, which is the one state that is genuinely about a file.

`registerSourceProvider` and `sourceProvider(kind)` live in `composition.ts`,
because that is the one file allowed to name both a seam and a filling, and
the three that ship register themselves there at module load. `composeShell`'s
switch became a lookup. `WorkingSource` keeps its three literals and gains one
open case, `registered`, carrying the provider that answers for it, what it is
called on the bar, the key that tells two of them apart, and `readOnly` —
which is the fact the workspace now reads instead of the constant it passed
while a folder was the only thing a source could be. An agent reads the same
fact: a source nobody may write to answers `agent.readOnly` (ADR-0011).

### A command channel, per scope

`ports/CommandChannel.ts` is the port: `publish` one `StepEnvelope` and be
answered the `seq` it was given or the refusal; `subscribe` to every
`SequencedStep` on a scope after a number, our own included; `presence`
optionally, names only. A step is what the session already records — one
command, usually a transaction, on one scope. `seq` starts at 1, so **0 is
nothing yet**. `by` is the channel's word about who made a step and never the
sender's claim about itself; above the port it is only ever compared or shown.

The port is **per scope**, because a session is per scope and a command is
built against one model. What crosses scopes — *link*, a stand-in refresh,
creating or moving a scope — does not come through it: those are barriers on
the undo stack already (ADR-0012 §10) and *changed on disk* is the right shape
for them.

`CommandChannel.contract.ts` is what a filling has to show, written before the
filling: two sessions converge on the same model after interleaved steps; a
subscriber from `after` sees exactly what it missed and nothing twice; a step
the reducer refuses at the head is answered with the refusal and sequenced
nothing; a step that changes nothing is answered with the current `seq` and
broadcast to nobody; a create on a taken id is refused `command.taken`; a
`stepId` already answered repeats its answer; a subscription from further back
than the log reaches calls `onGap`. `adapters/memory/InMemoryCommandChannel.ts`
passes it in `npm run check`, and is useful in its own right wherever two
sessions have to be put in one order.

### Three functions on the session, and a step that is not ours

`useModelSession` gains an id per step (`stepId`, a UUID the session never
reads itself), `origin: 'remote'` beside `'agent'`, and `by`. Then three
functions, on `steps`, carrying no policy at all:

* **`onChange`** — hear what this session just did to the model: the commands
  actually applied, whether they were a step, an undo or a redo, and whose.
  Without it, "publish what was just done" would mean polling the log.
* **`applyExternal`** — apply a command another author made, through the same
  reducer, onto the same stack, summarised by `model/activity.ts` like any
  other step and marked as theirs. The redo tail is deliberately **not**
  cleared: a colleague typing is no reason to take away this person's redo.
* **`rebase`** — take a named run of our own steps off the model by their
  inverses, let the caller land what it has underneath them, and put the run
  back on, dropping and reporting what the reducer now refuses. One React
  update. This is what the inverses were computed for, and the arithmetic is
  pure in `app/rebase.ts`.

⌘Z **steps over** a step that came from elsewhere and takes back the newest
that is ours: a colleague's change is not ours to take back, and it does not
make ours un-undoable either. `canUndo` is false on a stack of nothing but
theirs, and the agent's undo follows the same rule. The Activity list names
the author of a step it did not see made, in four languages, because a change
nobody at this keyboard made appearing unattributed is indistinguishable from
a fault.

`ScopeSession` is how those three are reached from outside: the workspace hands
the session over — narrowly: the seam, `dispatch`, the log, the revision —
through `Shell.onScopeSession`, once per mount, taken back on unmount. A seam
that cannot be reached from where its filling is composed is not a seam.

### `command.taken`, and an id policy that looks again

Two authors adding *Billing* in the same second both mint `billing`, and
`element.create` used to upsert through `put` — silently overwriting. The
reducer now refuses a create on an id the model already holds, with
`command.taken`, worded in the four string tables beside the other refusals.
Nothing in the tree turned out to rely on the upsert: putting a record back is
what the inverses do, and an inverse only ever runs where the id is free — the
reducer says so where it refuses. `idPolicy` gains
`refresh()`, because an id can be taken by an author this session never hears
of, and the session calls it after an external step lands.

### One hook on the desktop side

`platform/desktopHook.ts` declares what a build composed from this one may ask
of the main process: `ChannelHost`, as much of `ipcMain` as answering a call
takes and not one method more, and `SecretStore` — three verbs, no list — over
a file in `userData` at mode 0600, the way the agent's token is kept.
`electron/main` runs the registered hooks where it registers its own channels,
and core registers none, so the loop runs over an empty list. `mcpProtocol.ts`
moved out of `electron/main` to `src/agent/`, where it always belonged: it
speaks the agent's vocabulary and imports nothing of Electron's.

## What is deliberately not here

* **No transport, and no second adapter.** One filling ships, and it is in
  memory. The contract is what anything else is measured against.
* **No decision about two steps that disagree.** Putting steps in one order is
  what a channel owes; deciding that two of them overlap is a judgement about
  the landscape and belongs to whoever holds the other end. The contract does
  not test it, and the in-memory channel does not do it.
* **No policy in the session.** What a run is, what to do with a change that
  was made here, whether an undo is published, and who is told about a
  refusal are all the caller's. The session stays the one place a change
  enters and knows nothing about where a change can come from or go.
* **No presence, no resolution screen, no queue.** A bar that names who else
  is looking, and a strip for settling two changes that disagree, are screens
  about a filling. `presence` is optional on the port and nothing draws it.
* **Marks and pictures are not commands.** The mark and image libraries are
  shell state that travels in the working file; they do not go through a
  channel, and a source that keeps them elsewhere reports them changed the way
  a folder does.

## Consequences

* A build composed from this one adds a place to keep work by registering a
  provider and, where it needs the desktop, a hook. Nothing above the
  composition root is edited for it, and `git diff` on such a build touches
  its own files only.
* Every switch on `WorkingSource` has one more branch, and the compiler found
  them all. `readOnly` is now read rather than assumed in the two pages that
  passed `false`.
* A step carries a UUID for the life of the session. Two hundred of them is
  the log's cap, as before.
* A create on a taken id is a refusal rather than an overwrite, for elements,
  rows, views, records, plans, observations and causes alike. It is a
  behaviour change for anything outside this tree that leaned on the upsert,
  and it is the change that stops one author's work disappearing under
  another's.
* `undo` walks past steps it did not make, so a run of undos in a session that
  has taken external steps takes back more than the top of the stack. That is
  the intended reading of *mine*.

## Confirmation

* `CommandChannel.contract.ts` over `InMemoryCommandChannel`: convergence,
  exactly what was missed, refusals, `command.taken`, the idempotent retry,
  `onGap`, presence.
* `rebase.test.ts`: the stack arithmetic, pure — a run off and back on, the
  step the reducer now refuses dropped and reported, an id that names nothing.
* `useModelSession.test.tsx`: a name per step and one name over a coalescing
  run; an external step's origin, author and summary; the redo tail left
  standing; the id policy refreshed; undo stepping over theirs and `canUndo`
  false with only theirs; rebase, its refusal path and one undo step per step
  afterwards; what `onChange` says and what it deliberately does not.
* `composition.test.tsx`: the three registered at module load, a build's own
  provider with its way in and its own words, a kind registered twice ignored.
* `App.storage.test.tsx`: a registered source named on the bar by its
  provider, what it offers when it writes and what it hides when it does not,
  and an agent refused `agent.readOnly` where a person is offered nothing.
* `App.channel.test.tsx`: two whole workspaces over one in-memory channel,
  composed from outside with nothing that is not public — a step made in one
  arriving in the other's model and Activity list under its author's name, an
  undo crossing as a new step, and a step of ours that has not been sequenced
  yet coming off the model while theirs lands underneath it.
* `desktopHook.test.ts` and `secrets.test.ts`: the registry, and a secret kept
  at mode 0600 and read back. The smoke run is unchanged, which is the point.

## More Information

ADR-0002 for the command and its inverse, which is the whole reason this is a
seam and not a rewrite; ADR-0005 for what you are working from and the
document session whose five words a provider may now mean its own way;
ADR-0007 and ADR-0011 for the agent, whose `revision` and `ifRevision` keep
their meaning here — a counter that moves with every change to this model,
external ones included, and not a number two sides are expected to agree on;
ADR-0012 §10 for the barrier, which is why what crosses scopes stays off this
port.
