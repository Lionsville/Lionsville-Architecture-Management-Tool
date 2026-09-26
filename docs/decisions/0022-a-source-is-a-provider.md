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

`statusOf` is asked again whenever the document's own machine moves, which is
every answer a file has and half of one for anywhere else: work that has not
left this machine yet moves nothing the machine can see. So a provider may also
say *ask me again* — `Shell.onSourceWork`, a listener that carries nothing,
because `statusOf` is where the answer is given. It reaches only the last word
on what a status is CALLED; when to write, whether anything is outstanding and
whether closing the window would lose something are still the document
session's, and nothing a provider says can reach them.

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

It carries one thing the other way too. `alsoHere(names)` is who else has this
scope open, which is the shape `CommandChannel.presence` answers in and the one
thing about a scope this tree cannot work out for itself; the bar says *Also
here: A. Author, B. Bee* in the four languages, and nothing at all when the list
is empty, because a bar that says a scope is yours alone answers a question
nobody asked. Names only — where a colleague's pointer is would be a second
model of the canvas.

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
and core registers none, so the loop runs over an empty list.

A main side nothing can call is not a seam either, and the page has no
`ipcRenderer` of its own — that is the sandbox ADR-0007 reasons from. So the
preload gains one door, `invokeHook(channel, ...args)`, which opens for the
`hook:` prefix and nothing else. That prefix is the one check in this app that
is genuinely not a check the caller can skip: main, answering a `handle`, cannot
tell who called, and the page has no second way to ask, so without it one
generic door is a way to call `files:remove` with a path of the caller's
choosing. The payload is not looked at, exactly as before: a hook checks its own
arguments in main, where it knows what they are supposed to be. `mcpProtocol.ts`
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
* **No resolution screen, and no queue.** A strip for settling two changes that
  disagree, and somewhere to keep work while there is nowhere to send it, are
  the filling's. Presence is the one screen here, and it is one sentence on the
  bar: the shell is told the names and never works them out, there are no
  cursors, and nothing polls.
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
  an agent refused `agent.readOnly` where a person is offered nothing, and the
  bar saying what the provider now says without the document's machine moving.
* `useDocumentSession.test.tsx` and `ShellToolbar.test.tsx`: asked again when
  the source says so and let go of on unmount, while everything the machine
  decides stays where it was; the other authors named in one sentence, in the
  language the app is in, and nothing at all when there are none.
* `App.channel.test.tsx`: two whole workspaces over one in-memory channel,
  composed from outside with nothing that is not public — a step made in one
  arriving in the other's model and Activity list under its author's name, an
  undo crossing as a new step, a step of ours that has not been sequenced yet
  coming off the model while theirs lands underneath it, and each bar naming
  the other author and never itself.
* `desktopHook.test.ts`, `secrets.test.ts` and `electron/preload/index.test.ts`:
  the registry, what counts as a hook's channel, a secret kept at mode 0600 and
  read back, and the door passing a hook's channel through while refusing every
  channel of ours. The smoke run is unchanged, which is the point.

## Amended — the five the first build composed from this one needed

*21 September 2026.* A build composed from core registered a provider through
`registerSourceProvider` and found five places where the seam stopped short of
being one. Each is added as the smallest public thing that closes it, and
nothing above them changed for any of them.

* **A way in that is reached.** `SourceConnect` said how a person gets to a
  source and the boot never read it, so a registered provider could be composed
  and never opened. It now carries `open()` — the provider's own dialog, the
  shell's own button — and `fromLocation`, which the boot reads before the first
  render so a link can carry the address; the two screens that ask where work
  should live draw one button per registered provider. The folder's way in is
  the button that was already there, because choosing a folder is remembered,
  adopted into and upgraded, which is more than opening a source.
* **`openSource(kind, opening)` is exported.** The parts a provider builds and
  its word about the five words travel together, and a composer that restated
  that for itself would be one field short the day a third thing joins them.
* **`ports/DirectoryHandle.ts`.** `DirectoryHandleLike` is the shape a filling
  has to show and could only be read out of `adapters/fileSystem/`, which is the
  one folder nothing but the composition root may name. The store re-exports all
  four names.
* **`i18n`'s `registerStrings(language, table)`.** `SourceConnect` always said a
  provider brings its own table and there was nowhere to put one, so its label
  rendered as its key. Additive only: a key this app owns is refused, loudly
  while the build is being developed and quietly in the one that ships.
* **`ScopeSession` can read its model.** `current()` and `indexed()`, the two the
  session's own actions use. Minting an id against what is taken and telling a
  conflict from a change that fits are both questions about the model at the
  instant a step is made, which is one render before anything is drawn.

## Amended — the four the first build with no Electron needed

*21 September 2026.* A build composed from core ran the reducer and the folder
format in a node process with no Electron and filled the channel over a network.
Four more seams stopped short, and each is added as the smallest public thing
that closes it.

* **`src/platform/node/git.ts`.** Keeping a folder's history was under
  `electron/`, with a header saying it had no Electron in it. It now sits in the
  one row of the import matrix for code that may say `node:` — imported by no
  module, `app` included, and on no barrel, for the reason `mcpProtocol.ts` is on
  none.
* **A contract a network filling can pass.** The channel suite settles after
  every subscribe and every publish before it asserts (`ChannelUnderTest.settled`),
  and the channel, scope-store and folder-settings makers may be async. A second
  run over the same in-memory channel with every answer put off a turn is what
  keeps the settles from quietly disappearing again.
* **Which refusal wins.** A step whose `base` is behind the head and whose
  command the reducer refuses is answered with the reducer's key, so
  `command.taken` always means *mint another id and send it again*. A channel that
  decides such a step overlaps one sequenced since refuses with a key of its own,
  which is still deliberately not defined here.
* **A commit message without the registry.** `translateFrom(table)` and
  `draftCommitMessageInEnglish` draft from the model's and `projects`' English
  slices, which import nothing; a walk of the static imports pins that
  `commitMessage.ts` reaches neither the registry nor `app/`. The registry is
  right for a screen and wrong for a process that has none.

## Amended — the four the first build with a screen of its own needed

*21 September 2026.* The same build registered its provider, gave it a screen of
its own beside this shell's, and opened a source that cannot say what it is until
it has asked somebody. Four more seams stopped short, and each is added as the
smallest public thing that closes it. Nothing above them is edited for any of
them, and all three built-ins are written exactly as they were.

* **A slot for a provider's own chrome.** `Shell.chrome` is a component this app
  renders inside its own theme and inside the language that is on, beside its own
  notices and on every screen — the first-run screen included, because a source
  that will not open is exactly when its provider has something to say. It is
  handed the `ScopeSession` of the scope that is open, which a component could
  not otherwise reach: the session is handed out as a subscription, so the shell
  holds it for the chrome beside handing it on and never instead of. Without this
  the only place a strip or a connect dialog could go was a container on
  `document.body`, which is a second app in the same window, in the wrong colours
  and in English. It renders in a boundary of its own, for the reason the canvas
  has one: a strip somebody else wrote falling over costs the strip, not the
  window.
* **A provider is handed `Diagnostics`.** The trail the app already keeps, at
  `open`. A provider had the console, which is the one place "Copy diagnostics"
  cannot reach — so a source that would not open left nothing in the thing the
  user is invited to hand over.
* **A provider can reach the shell whose parts it replaces.** The `Shell` as it
  stands *before* its own parts are spread over it, which is what makes it safe
  to read: nothing in it is the provider's own answer coming back. A provider
  that replaces the store was otherwise left composing a second preferences
  store, a second document gateway and a second browser store — three decisions
  `composition.ts` exists to make once, made twice in one window, and the
  language, the theme and *Save as…* quietly stop being the app's. Both travel
  as `SourceBase`, the second argument to `open` and the required third to
  `openSource`; it carries no shell in exactly one place, the first compose,
  whose shell is the one that source is bringing the stores for.
* **`open` may answer a promise.** `open(opening, base): Parts | Promise<Parts>`,
  awaited by the boot before the first render. What a source is called, which
  scopes it holds and whether this person may write to it at all can be answers
  over a wire, and `readOnly` decides what the workspace draws and what an agent
  is refused: a shell mounted over a guess and corrected a moment later is a
  mount thrown away and a *New plan* offered to somebody who may not write. A
  rejection is a source that could not be opened, and the two ways in answer it
  where they are — the address the page was opened at goes to the boot's own
  failure screen with the provider's own sentence on it, while a button that
  came to nothing says so on the bar as it already did. Reading the address stays
  caught, because that is a guess and the next provider may recognise it.
  `composition.ts` keeps one tripwire of its own: the two shells it composes
  itself are built where a shell is the answer rather than a promise of one, and
  a provider that answered a promise to those is named rather than spread.

`composition.test.tsx` covers the three below the screen — the trail reported
into, the shell reused, the first compose with none, a promise waited for with
what travels alongside it intact, and a rejection carrying the provider's
sentence — and `App.storage.test.tsx` the chrome: drawn with nothing open,
handed the session while a scope is and told when it closes, in the language the
app is in, the provider's own subscription untouched beside it, nothing at all
where a source brought none, and the window still standing when the strip falls
over.

## Amended — the four the first build that pressed its own way in needed

*21 September 2026.* The same build pressed the button its provider had
registered, reached its source from the desktop, and put a step somebody else had
made on the model. Four more seams stopped short, and each is added as the
smallest public thing that closes it. All three built-ins are written exactly as
they were, and nothing above any of them is edited.

* **A chrome belongs to the registration, not to an opened source.** `Shell.chrome`
  arrived with the parts of a source that had been opened, so the one provider
  that could not draw was the one with something to ask: the first press of a way
  in happens while that provider answers for nothing, and its connect dialog had
  nowhere to go but a container on `document.body` — which is the thing the slot
  was added to stop. So it is declared where `connect` is, the boot reads the list
  (`registeredChrome()`), and the shell draws every one of them on every screen,
  in a boundary each so one strip falling over does not cost the next. Which
  provider answers for the open source decides what it is HANDED and never
  whether it is drawn: the session goes to the registration whose kind
  `sourceProviderKind` names, and to nobody else. A chrome is therefore mounted
  while its provider is nobody's source and mounted again when a source opens,
  because `App` is keyed on the working source — so the type says what that asks
  in return: be idempotent about your own state, and keep what has to outlive a
  mount where the provider keeps it.
* **A hook may name where the page is allowed to reach.** `connect-src 'self'
  data: blob:` is ADR-0007's sandbox written as a header, and it is also a page
  that cannot reach a registered source at all — which it does not report, it
  fails every request and leaves the network to be blamed. Widening it for
  everybody is the other wrong answer, so `DesktopHook.origins()` names this
  hook's own, folded into `connect-src` and into `img-src` where that hook said
  pictures load from there. Asked where the header is built rather than read once
  at startup: a CSP travels with the document, so *it changed* can only ever mean
  the next load. The assembly left `index.ts` for `electron/main/csp.ts`, as
  arithmetic — a list of names in, one string out — because what a hook may widen
  is a suite and not a smoke run: nothing reaches `script-src`, `style-src` or
  `worker-src`, an origin is `scheme://host[:port]` and nothing more, and what is
  not one is dropped and logged rather than folded in as written. A hook is code
  this tree never saw, and one unchecked string in this header is the sandbox
  gone. Core registers no hook, so the header this build sends is character for
  character the one it always sent, which is the suite's first clause.
* **`via` on a step another author made.** The Activity list named the author and
  stopped there, and one author working from two clients is not the same thing to
  read about as two authors — nor is a step a person made through something that
  speaks for them. `ExternalStep` and `HistoryStep` carry `via` beside `by`, the
  line says *by NAME via CLIENT* in the four languages and falls back to the
  author nobody named exactly as it did, and `activity.list` answers it as a
  field of its own, absent where nothing said one. Nothing is inferred: this tree
  cannot tell what somebody else was working in, and a guess in a log is worse
  than a gap. The session reads neither — `undo` still goes by `origin`.
* **The sentence for where work is kept is the provider's.** The chip on the
  organisation's home says what a source costs you, and for a registered one it
  said a sentence this tree made up: that work is kept where the source keeps it,
  and that a working file will keep a copy of your own. Neither is ours to
  promise about a place we have never heard of, and one of them is false the
  moment a source is read-only. `SourceProvider.describeKey` sits beside
  `connect.labelKey` and is read the same way — the provider's key, from the table
  it registered — and where a provider gives none the chip says nothing at all.
  The generic sentence is gone from the four tables rather than kept as a
  fallback, because a fallback is the guess under another name. The home's
  **subtitle** is the second place that says it, and it reads `describeKey` the
  same way: it chose its clause by kind and fell through to *in this browser*
  for a source that is not the browser, and where a provider gives no sentence
  the clause is dropped rather than guessed at.

`composition.test.tsx` covers the two the registry answers for — every provider
that draws one listed and only those, a chrome held before that provider has
opened anything, and a provider's sentence answered for a registered source and
not for a built-in kind or a provider that gave none — `App.storage.test.tsx` the
two on screen: a strip drawn for a provider that answers for nothing here, the
session going to the provider whose source is open and to no other, the next
provider's strip standing when one falls over, and the chip saying the provider's
own sentence and nothing where there is none. `electron/main/csp.test.ts` pins the
header with no hook registered character for character, what one origin and a
picture origin widen, and every string that is not an origin dropped — including
the one with a `;` in it, which must not have added a directive;
`desktopHook.test.ts` pins that the origins are gathered per ask and that a hook
that throws costs the rest nothing. `ActivityMenu.test.tsx`,
`useModelSession.test.tsx` and `handle.test.ts` pin `via`: the line in four
languages, the fallback where the author is nameless, the field carried onto the
stack and never invented, and the answer with `via` present for the step that
said one and absent for the step that did not.

## Amended — the four a build that puts every announcement on the wire needed

*21 September 2026.* The same build carried each announcement to a second
author and read its own log back, and four seams stopped short at the one
thing this repository had said nothing about: a step that grows. Each is added
as the smallest public thing that closes it, and nothing above the session is
edited.

* **A name per announcement, not per step.** A coalescing step — a typed name,
  a drag and the routing after it — is one step on this stack and was announced
  every time it grew under the one `stepId`. Anywhere idempotent by that name
  answers the second announcement out of what it decided for the first and
  sequences nothing, so a name typed in five keystrokes left this session as
  one: the rest were on this screen, in this stack and in this `revision()`,
  and nowhere else, with an answer saying they had landed. `HistoryStep.folds`
  is the list of them now, each with a `changeId`, the commands that
  announcement applied and their inverses, and `SessionChange.changeId` is the
  name to publish under. `stepId` is what still says they are one step here,
  and the type says so out loud: one step on this stack, several on a channel,
  and undoing it is one new change carrying every fold's inverse — which gets a
  `changeId` of its own too, rather than the caller minting one.
* **A rebase is named by fold as well as by step.** A caller that publishes per
  announcement is answered per announcement, so it holds folds and not steps,
  and the earlier keystrokes of a step that is half answered for belong *under*
  what has just arrived and not over it. `RebaseRun.stepIds` reads either name:
  a `stepId` is every fold of that step, a `changeId` is one fold, and naming
  one unwinds that fold's commands and no more. The step stays one step on the
  stack whichever way it was named — the alternative, folds as separate steps
  whenever anything is listening, would make a typed name twelve presses of ⌘Z
  for the person, which is the thing coalescing exists to stop.
* **A rebase reaches work this stack has let go.** The log is capped, so a
  caller holding a run older than the cap could name it and be told `unknown`,
  and the run then stayed on the model unrebased with its `base` never
  corrected. `RebaseRun.steps` is the bodies, from the caller that still has
  them: they go under the stack's own run, are reapplied with it, and come back
  in `RebaseReport.supplied` with their inverses recomputed against the model
  they now undo. They are deliberately **not** put on the stack — they were not
  on it before, and an undo this session had let go stays let go.
* **The cap does not take a step out from under a listener.** The simplest
  honest rule, and it is the one: while anything is listening, the trim stops
  at the oldest fold nobody has called `steps.settled` on. A step trimmed while
  somebody outside still has to hand it back is one they can name and `rebase`
  cannot find, and that is the one question a rebase has no honest answer for.
  With no listener every step is settled the moment it is made and the cap is
  the two hundred it always was; with one, how far the log grows is the
  listener's own business and `settled` is how it says so. A step another
  author made is settled on arrival — it came from wherever it would have been
  sent — or a floor at one would never lift.

So `steps` is four functions rather than three. `rebase.test.ts` pins the
arithmetic pure: a whole step picked by its id, one fold picked by its
`changeId` and the step it belongs to named, an id that matches neither, and
`flatten` as the statement of what a step's two directions are.
`useModelSession.test.tsx` pins the rest: two announcements under two names and
one `stepId`, an undo under a third, one fold of a step unwound with the other
left where it was and ⌘Z still one press, a supplied run for an id the cap took
away, and the trim at the cap, at the floor, and with the floor lifted.
`App.channel.test.tsx` is the end of it, two workspaces over one channel: a
name typed in five keystrokes arrives whole and not as its first letter, it is
five sequenced steps over there and one here, and taking it back crosses as one.

## Amended — the two a build with actions and a person of its own needed

*22 September 2026.* The same build had things for a person to do that are not
this shell's — somewhere to sign in, pages of its own, something to do to the
scope that is open — and a person signed in to it whose name is not the name the
source was opened under. Both were drawable in the chrome a provider already
has, and both would have been in the wrong place. Each is added as the smallest
public thing that closes it, and the three built-ins are written exactly as they
were.

* **A provider's actions go in the menu, as lines.** A strip of the provider's
  own is where they would otherwise be, and then a person looking for what they
  can do here has two places to look — which is the thing one menu exists to
  stop; nothing about a floating strip says *this is a command, like the ones
  under the ⋯*. So a provider hands over lines and never a menu:
  `SourceMenuEntry` is a key from its own table, what a press means, and the
  three small facts a line can carry — disabled, a rule above it, somewhere it
  goes — and the shell renders them the way it renders its own, in a section
  after everything of ours, under a rule rather than a heading, because a
  heading would be a word of ours about somewhere this shell has never heard of.
  They are **asked for** and not registered: `menu(context)` runs when the menu
  opens and again on the provider's own *ask me again* (`onSourceWork`), so
  *Sign in…* becomes a name while the person is looking at the list. It sits on
  the registration beside `chrome`, for the same reason and one step further in:
  what a line IS carries no React and stays in `platform/`, but what a provider
  is TOLD before it decides — the session of the open scope, and whether work
  here may be written at all — is a word this shell owns. And it is asked of
  **every** registered provider, open or not, because *sign in…* is the line the
  provider that answers for nothing needs most; which one answers for the open
  source decides only what it is handed. A provider's own code runs at the
  moment the menu draws, so one that throws costs its own lines and the rest of
  the list stands, with the failure in the trail.
* **The chip is the provider's word about now, not about the handshake.**
  `WorkingSource.name` is decided when a source is opened, and for a source
  somebody has to be known to before it answers anything the interesting word
  moves after that: who is signed in, and whether anybody is. The chip said the
  opening name until the window was reloaded. `SourceProvider.chip` answers with
  the label, the key of its own sentence for the hover — falling through to
  `describeKey`, so a provider that only renamed the chip keeps the standing
  sentence it already gave — and, where it gave one, something the press
  reaches: a provider's own menu, its account page, whatever the name is a way
  into. Re-read on the same signal `statusOf` is, because a provider whose
  answer has moved says so once and everything reading it asks again. It is a
  **button** where it is pressable and a span where it is not, because that bar
  is the window's drag surface on the desktop and the rule that keeps a control
  clickable inside it names elements rather than handlers — a span that listens
  there is dead surface that drags the window.

`composition.test.tsx` covers what the registry answers for: every provider that
wants lines listed and only those, the lines held before that provider has opened
anything, and a provider's chip answered for a registered source and not for a
built-in kind or a provider that gave none. `App.storage.test.tsx` covers what is
on screen: two lines drawn after ours and each firing what it meant, nothing at
all added for the sources that ship, the list asked again behind an open menu, the
session handed to the provider whose source is open and to no other with
`readOnly` said to both, the rest of the menu standing when a provider's lines
throw, and the chip saying the provider's word, asking again when it moves,
pressing through to what the provider gave — and staying the name it was opened
under, as a fact and not a control, where no chip was given.
`ShellToolbar.test.tsx` pins the three that ship byte for byte, chip or no chip:
a word reaching this code from outside must not move what a folder is called.

## Amended — the three a build whose source has its own answers needed

*22 September 2026.* The same build watched its own source say no, offered a way
in to the place a person was already working from, and had an agent reach a
landscape that is on nobody's loopback; each is a sentence of ours that was
wrong rather than vague. A **refusal** where work is kept is the source's own
sentence now (`SourceFailure`, carried with a source's parts as
`sourceFailure`), because *this browser could not save the design (storage full
or blocked)* names the wrong place, blames a quota that did not run out and
recommends a working file to somebody whose copy that matters is elsewhere —
and `undefined` from it says nothing at all, for a provider that has already
said so in a chrome or a line of its own, ours included, since a refusal nobody
mentioned must not be followed by *saving works again*. A **way in** is asked
whether it is worth drawing where it is about to be drawn (`SourceConnect.offer`,
told the source and the address, `null` for not here and a label for something
else to say), because a standing *connect to…* offers the provider's own open
source the place it already is. And *Connect an agent* takes the open source's
own **panel** (`agentPanel` on the registration): in a tab it stands where the
sentence about the desktop stood, which is true about the loopback and beside
the point once an agent can arrive some other way, and on a host it stands under
that section rather than over it, because both ways in exist there. The three
built-ins define none of the three. And, from the same build and not a seam at
all: *Check for Updates…* and the switch behind it are drawn only where updates
are this build's to check (`offersUpdateCheck`, `updateSettingsFor`,
`helpMenuTail`) — a build composed from this one may keep its own updates, and
an item reaching a release page that is not its own answers a question nobody
asked.

`useStorageNotice.test.tsx` pins the sentence, the silence and the latch that
does not close over it; `useDocumentSession.test.tsx` pins the cause travelling
with the fact; `composition.test.tsx` pins what a provider's parts carry and what
the registry answers for the open source alone; `App.storage.test.tsx` pins a
way in hidden, relabelled, asked again and standing where its provider threw,
and a refusal said in the provider's words, in nobody's, and in ours;
`ConnectAgentDialog.test.tsx` pins the panel in place of the sentence and beside
the section; `menuLayout.test.ts` and `updates.test.ts` pin both states of a
build that offers a check and one that does not.

## Amended — the one a build whose notices name a scope needed

*22 September 2026.* The same build's chrome had something to say about work
kept somewhere else in the tree, and could name the scope it meant and not take
anybody there. Naming a path is the easy half: a person reading *the work is on
acme/rail/rolling-stock* still has to find that scope in the tree themselves,
and a provider that tried to help had nothing to help with — the whole of what
it was handed was the session of the scope that is already open, which is by
definition not the one the sentence is about. It is added as the smallest public
thing that closes it, and the three built-ins are written exactly as they were.

* **A provider's chrome is handed the open, and nothing that opens.**
  `SourceChrome` and `SourceMenuContext` take `open(to)`, where `to` is the
  `Destination` ADR-0019 already defines for the agent — a scope path, a page
  and an id — bound in `App` to the same `openFor` and `openScopeAt` that
  `app.open` moves the app with. The same three words and not a second grammar
  for them, because a shell with two ways to say *the roadmap of that scope* is
  a shell where one of them is a version behind. A scope left unsaid is the
  scope that is open, which is what it means to the agent and what a notice
  about the landscape in front of somebody means too. Nothing comes back: a path
  that names nothing is a refreshed tree, the same answer *Open …* gives a
  person, and an answer a provider could branch on would be this shell inviting
  it to draw a second failure screen for something already said here. It is
  deliberately **not** a second way to move the app — there is no *close*, no
  *save*, no history — because what a chrome asked for was a way to the place it
  had already named, and every other verb belongs to the person or to the agent
  they can see driving.

`App.storage.test.tsx` pins both sides of it: a chrome drawn through the
registered-chrome path pressing its own notice open and the named scope arriving
in the crumbs, a destination with no scope landing on the scope that is open,
and a menu line told the same call sending the person to the scope it names.

## Amended — the two a build that fills the folder store needed

*26 September 2026.* The same build keeps its scopes in this tree's folder store
over a `DirectoryHandleLike` of its own, and had to reach past the seam twice to
do it: once to put answers of its own on the store the folder source built, and
once to find out that its handle kept only the last of two writes — which
nothing here said was wrong. Each is added as the smallest public thing that
closes it, and the three built-ins are written exactly as they were.

* **A caller hands its own answers to the open, rather than patching the store
  it got back.** `openSource(kind, opening, base, filling)` takes a
  `SourceFilling` — for now `scopes`, a function handed the store the source
  built and answering the members the caller answers for itself — and the parts
  come back with a store made by `projects/filledStore.ts`. That store answers
  each member of the port from the filling where it gave one and from the
  source's store otherwise, **called as that store**. The alternative a build
  had was a copy derived from the live store by its prototype, with the new
  methods set on the copy: it works until the store keeps anything private, and
  then every method called through the copy fails on the first line that reads
  a `#field`, which is a refactor inside this tree breaking a build outside it
  with no compile error on either side. The member list is checked against the
  port with `satisfies`, so a member the port grows is a compile error in the
  helper rather than a member a filled store silently lacks, and an optional
  member neither side has stays absent — absent is an answer the port gives a
  meaning to. `filledStore` is exported on its own too, for a caller holding a
  store it did not open (the shell's own, handed over as `SourceBase.shell`).
  A filling for a source that brought no store is refused as a wiring mistake,
  in the words a source with nowhere to keep a scope already gets.
* **The directory handle has a contract of its own.** `DirectoryHandleLike` had
  four fillings and no suite; the store's suite ran over each and was taken as
  the proof, which proved what the store asks and not what the port says. The
  store writes a file in one `write`, so a filling that kept only the last of
  two writes passed every clause. `ports/DirectoryHandle.contract.ts` is the
  port's promise — a file reads back as written; **two writes to one writable
  both land, in order**, as text and as bytes; the old contents stand until
  `close`; a second writable replaces rather than appends; a folder written
  into is listed with its file; a missing entry is refused without `create`; a
  file can be removed — and deliberately nothing the port leaves open, such as
  whether `create` makes an empty file or whether an empty folder is listed.

`filledStore.test.ts` pins the store with a private field still working through
its filling, the filling's answer winning and falling back on the store's, an
optional member left absent, and the folder store with an index of its own
passing `describeScopeStore` whole. `composition.test.tsx` pins the filling
through `openSource`: over the folder source, falling back on it, over a source
that answered a promise, refused for a source with no store, and nothing
changed where no filling is given. `describeDirectoryHandle` runs over the
in-memory double and over the desktop's handle on a real temporary folder.

## Amended — the three a build with a second writer on the same scope needed

*26 September 2026.* The same build has more than one writer on a scope at a
time — the steps of everybody who has it open, and the whole writes this shell
makes outside the open session — and found three places where a whole write
could land over a step without anybody being told. Each is added as the
smallest public thing that closes it, and the three built-ins are written the
way they were except that they now answer the first.

* **A save may say what it expects to overwrite.** `ScopeStore.load` stamps
  `ScopeSnapshot.revision`, the store's own opaque word for the state it read,
  and `save(scope, expects)` refuses with `shell.scopeMoved` and writes nothing
  when the store no longer holds that state. The three built-ins answer it with
  a fingerprint of what they keep (`projects/revision.ts`) — content, because
  it is the one thing every store can compare without keeping a counter beside
  it — and a store that serialises several writers checks where it serialises
  them. The callers that read a scope, change it and write it whole outside
  the open session pass what they read: the organisation screen's board and
  settings dialogs, the gestures' write of the other scope and the pass a move
  makes over the references into it read again and make their change again
  (`app/rewriteScope.ts`), because each change is a function of the scope as it
  stands; the home's restore says so instead, because a version worked out from
  what the page showed is not what a person chose once the scope has moved. A
  save that expects nothing overwrites as before, which is what the open
  scope's own document session and the creation of a scope mean.
* **A source may say its steps are the write.** `Shell.publishesSteps`: every
  change of the open scope travels as a step through whoever took its session,
  so the whole write of the open scope a gesture made after its command — a
  second copy of the step, taken of one window's model — is not made. Absent
  for the three that ship.
* **A session says what it was opened from.** `ScopeSession.openedFrom` is the
  revision of the read the model was opened on. A far end that numbers what
  happened to a scope can then resume from the number that read was at rather
  than from anything it was told before the read, which may be older and then
  replays what the model already holds.

`ScopeStore.contract.ts` pins the first for every store: a revision is stamped
and is the same for two reads of one state, a save expecting it lands and moves
it, a save expecting a revision somebody else saved over is refused and theirs
is kept, a save expecting a scope removed since is refused, and a save that
expects nothing overwrites. `rewriteScope.test.ts` pins reading again and giving
up; `useGestures.test.tsx` pins the other scope's write keeping a colleague's
save and the open scope not written whole where its steps are published.

## Amended — the one a build that moves a scope under a second writer needed

*26 September 2026.* The same build with more than one writer on a scope found
the one whole write the last amendment left blind. A move is a save at the new
address and then `ScopeStore.remove` at the old one, and the save expected
nothing because there was nothing at the new address to expect — but the
removal expected nothing either, so a step somebody landed on the old address
between the organisation screen's read and its removal went with the folder,
and the move said it had succeeded. It is added as the smallest public thing
that closes it, and the three built-ins answer it the way they answer a save.

* **A removal may say what it expects to remove.** `remove(path, expects)`
  refuses with `shell.scopeMoved` and removes nothing when the store holds the
  scope in another state than the one `expects` names; a scope that is not
  there any more has nothing to lose, and the call resolves as it always did.
  The revision is the named scope's own — what is filed under it goes with it
  as before, because a revision for every scope of a subtree is a list the
  caller would have to have read and the port has no word for. The
  organisation screen's move therefore removes the subtree deepest first, each
  scope expecting what it read of that scope, so a change made to the old
  address — or to any scope under it — in between leaves two copies and the
  warning the move already had for a removal that failed
  (`shell.moveLeftCopy`), which a person can see and settle, instead of one copy
  that has lost a change. A scope created under the old address after the
  move's listing is the one thing still taken unasked.

`ScopeStore.contract.ts` pins it for every store: a removal expecting what it
read removes the scope and what is filed under it, a removal expecting a
revision somebody else saved over is refused and theirs is kept, and a removal
expecting a scope somebody else removed already resolves. `useOrganisation.test.tsx`
pins the move keeping the old address where it, or a scope under it, was
changed while the move was being written.

## Amended — the two a build whose strip follows the person needed

*26 September 2026.* The same build had a chrome with something to say about the
place a person was looking at, and a chip that is a way into something of its
own. The chrome could send somebody to a scope (`open`) and could not see that
they had arrived, or where they went next; the chip could run a function and
was drawn on the organisation's home alone, so a person working on a board had
no way to it but going back. Each is added as the smallest public thing that
closes it, and the three built-ins are written exactly as they were.

* **A chrome is handed where the app is.** `SourceChrome` takes `screen`: the
  `Screen` ADR-0019 already defines, which `app.current` answers the agent
  with — the scope that is open, its view and the page over it, or the home
  that is up and its page. The same words and not a second description of the
  app, for the reason `open` takes a `Destination`: a shell with two ways to
  say *the roadmap of that scope* is a shell where one of them is a version
  behind. It is held as state in the shell (`useShellAgent`), looked at again
  when the scope, the home or the home's page moves and when the workspace
  hands its view over again, and kept as the same value while nothing moved,
  so a chrome may compare what it was handed. The shell looks only where a
  provider registered a chrome or a panel; a build with neither pays nothing.
  `app.current` itself is unchanged.
* **The chip may open a panel, and is wherever the person is.** A provider
  registers `chipPanel`, a component the shell draws under the chip when it is
  pressed — inside the theme and the language, in a boundary of its own, handed
  what a chrome is handed and `close` — because the alternative was a chrome
  drawing a popover of its own and hunting the page for the chip to hang it
  from. And where the open source's provider gave a `chip` or a `chipPanel`,
  the chip is drawn on every scope's home and on the workspace's bar, which
  every page opens beneath, rather than on the organisation's home alone. It is
  one component on both bars (`ShellToolbar`'s `SourceChipView`), so it reads
  and presses the same on each. Where a provider gave neither — the three that
  ship — the chip stays where it always was and says what it always said.
  `chip` itself stays a label: a word on a bar, with the panel as the thing
  behind it.

`App.storage.test.tsx` pins both: a chrome told the open scope and its view,
told again when a page opens over it and when the person goes home, and handed
the same value in between; a provider's chip on the workspace's bar and on a
domain's home, the chip absent from both where the provider gave none, and a
panel opened by pressing the chip, handed the open scope and the screen in the
app's language, and shut by the provider. `composition.test.tsx` pins the
registry answering the panel for the open source's provider and for nobody
else. `ShellToolbar.test.tsx` still pins the three that ship byte for byte.

## More Information

ADR-0002 for the command and its inverse, which is the whole reason this is a
seam and not a rewrite; ADR-0005 for what you are working from and the
document session whose five words a provider may now mean its own way;
ADR-0007 and ADR-0011 for the agent, whose `revision` and `ifRevision` keep
their meaning here — a counter that moves with every change to this model,
external ones included, and not a number two sides are expected to agree on;
ADR-0012 §10 for the barrier, which is why what crosses scopes stays off this
port.
