# ADR-0051 — An agent writes a script: read in one call, tried before it lands

* Status: accepted, 22 November 2026; implemented, 22 November 2026 (4.1.0, not yet released), but for what *Not built* lists
* Date: 2026-11-22
* Deciders: Wouter Simons
* Extends: ADR-0007 (an agent as a peer of the menu), ADR-0011 (an agent can do what a person can)

ADR-0007 and ADR-0011 stand: the vocabulary, the handler, one command a
write, one step a batch. This record adds a second way to use the same
vocabulary and takes nothing away. It amends both where they say how a
client is offered the tools.

## Context and Problem Statement

A client of the agent's door is handed every tool's definition, and carries
them on every turn of a conversation. The vocabulary is about 170 tools.
After its descriptions were cut to what a tool does and takes (ADR-0007,
amended 22 November 2026), `tools/list` is still about 200,000 characters: a
price paid whether or not a tool is ever called.

And an answer that needs several reads joined is made of round trips. *Which
applications have no owner, and what was observed about them* is a list of
scopes, a list of elements and a list of observations in each, joined by the
model at the other end: every row of every list crosses the door, most of
them to be thrown away, and each call is a turn.

A change made of several writes has `batch`, with a dry run. A batch cannot
read, decide and then write, so a change that depends on what is there is
still calls one by one, each landing as it goes.

## Decision Drivers

* A client may carry a handful of definitions instead of the vocabulary.
* A join, a filter and a count happen where the work is kept, in one call.
* **No second vocabulary.** What a script calls is what a tool is: one table,
  one handler, one set of refusals, one way a person is named.
* A script is somebody else's code. It reaches nothing but the vocabulary,
  and every way it can cost too much has a number that is enforced.
* A change is shown to the person before it lands, and what lands is what
  was shown.
* The app ships no native module and loads nothing it does not use.

## Considered Options

1. **A script in a sandbox, over an API generated from the tool table; a
   write tried on a copy and landed by a token.**
2. **Search over the tools instead of the tools** (a tool that finds tools,
   and one that calls one by name). Rejected as the whole answer: it lightens
   what is carried and leaves every join a string of round trips. Its second
   half is here as `call`.
3. **A query language of our own** over the model. Rejected: a language to
   design, document and keep, which a model has never seen, for what a model
   already writes well.
4. **The host's own engine as the sandbox** (a context, a worker). Rejected:
   neither holds a memory limit, and a deadline on one does not stop a chain
   of promises; an isolate of the engine is a native module with a build per
   platform, and cannot load in a page.

## Decision Outcome

Option 1.

### 1. One object, generated: `lv`

A script is the body of an async function with one thing in scope:

```js
const { elements } = await lv.elements.list({ kind: 'application', fields: ['name', 'owner'] })
return elements.filter((one) => one.owner === undefined).length
```

`lv` is generated from the tool table (`agent/code/api.ts`), over the tools
the host has — the predicate that decides what `tools/list` offers decides
what `lv` holds. **No tool is renamed.** `noun.verb` is `lv.<area>.<verb>`,
the area being the plural the noun's list tool already uses, so
`element.describe` and `elements.list` are neighbours on `lv.elements`. What
the rule cannot place is one typed table:

| Tool | In a script |
|---|---|
| `connect` | `connections.add` |
| `connections.update`, `connections.remove` | `connections.updateMany`, `connections.removeMany` |
| `merge.plan`, `move.plan` | `preview.merge`, `preview.move` |
| `principleGroups.set` | `principles.setGroups` |
| `platform.report`, `service.report` | `reports.platform`, `reports.service` |
| `search` | `lv.search` |
| `focus`, `moveBy`, `placeNextTo`, `group`, `ungroup`, `align`, `distribute` | `canvas.*` |
| `technology.*`, `project.*`, `activity.list`, `register.list`, `roadmap.check`, `app.*`, `session.*` | the area stays singular |
| `batch`, `undo` | none: a script is the batch, and lands nothing to take back |

`lv.in('acme/retail')` is the same API with `scope` set on every call made
through it; the script tool's own `scope` is where `lv` starts.

**A signature is written from the schema the tool is checked against**
(`signature.ts`), as TypeScript: an enum is a union of literals, a row an
inline object, what is required loses its `?`, and the shapes many tools
share are said once by name (`PersonRef`, `PrincipleRef`, `PrinciplesCited`,
`ListArgs`). `scope` and `ifRevision`, which the table adds to every tool,
are in no signature. Every method answers `Promise<unknown>`: the table says
what goes in and not what comes out. The whole generated API is a file beside
its test (`api.snapshot.txt`), so a change to a schema shows as the change to
a script's API that it is; a test holds that every tool has one method or a
sentence for why not, and that no two share one.

### 2. The tools of code mode

Beside the vocabulary and not in it (`codeTools.ts`):

| Tool | What it does |
|---|---|
| `api.describe` | The API on demand. With nothing asked, a map: how a script is written, the host's limits, every area and its methods. With `area`, each method's signature and what it does; with `method`, or an area and `detail: 'full'`, every argument and the method's rules; with `topic`, a rule every method shares. Nothing is written for it: the sentences are the tool table's and the rules are `rules.ts`'s |
| `query` | Runs a script that reads. A call that would change something is refused inside it |
| `simulate` | Runs a script that changes things, on a copy, and lands nothing (§5) |
| `run` | Lands what a simulation tried, by its token (§6) |
| `discard` | Lets a simulation go |
| `call` | Runs one tool by its plain name with its plain arguments, through the host's own path for a plain call: what a script may not do (§5) is a call away, so a client that carries only these six lacks nothing |

A client is offered the vocabulary as tools, these in its place, or both
(`RespondOptions.mode` in `mcpProtocol.ts`: `tools`, which is what the
protocol offers when a host says nothing; `code`; `both`). One decision for
the list and the call, as a host's `tools` predicate is: a tool a mode leaves
out is answered `agent.unknownTool` when called, with where it is instead. A
host's own tools are listed in every mode. On connect a client in `code` or
`both` is told so in a sentence after what the host says of itself.

**The app offers both unless the person chooses** (`AgentMode`,
`DEFAULT_AGENT_MODE` in `platform/agentServer.ts`): *Connect an agent…* has
the choice under its switch — *Tools*, *Scripts*, *Both* — with what the
difference is behind a press; it is kept in `mcp.json` beside the switch,
through the server being turned off, and holds from a client's next request.
A client may also name a mode in its own address, `…/mcp?mode=code`, which
is offered whatever the choice. `both` takes nothing a client had away, which
is why it is where the app starts; it saves nothing either.

### 3. The sandbox

A port (`sandbox.ts`) that names no interpreter: a script, the names of the
methods `lv` holds, the limits, and one function its calls go out through.
**Only strings cross it**, in both directions — a method's name, its
argument as JSON, a scope; what the script returned, as JSON, serialised
inside. `lv` is built inside, out of that one function. No object of the
host's is ever handed in.

The filling that ships is QuickJS compiled to WebAssembly
(`quickjs.ts`, the only file that imports it: `quickjs-emscripten-core` and
one release build of the interpreter, both MIT). A second engine with nothing
of the host's in it: the language, and what is put into it. No module, no
network, no file, no timer. It is loaded when the first script is run and
never before, and that file imports nothing else of this tree but types, so a
host that runs scripts on a thread of its own loads it there alone.

A host says where the sandbox runs. The app runs it in its page. A host many
callers share runs it on a thread of its own, with what it keeps on another,
so a call out of a script is a message and a script that spins holds up
nothing else.

### 4. The limits

Each is enforced where it cannot be argued with (`limits.ts`).

| Limit | A shared host | The app | Enforced by |
|---|---|---|---|
| The script's text | 32 kB | 32 kB | measured before anything runs |
| Processing | 2 s | 1 s | the interpreter's interrupt, against the time spent inside it, added up over the first run and every round of continuations; inside a regular expression too; not catchable |
| On the clock | 15 s | 30 s | a timer outside the script, covering the time it waits on its calls |
| Memory | 32 MB | 64 MB | the interpreter's own limit |
| Stack | 256 kB | 64 kB | the interpreter's own limit; where the host's stack gives out first, the run ends at this limit all the same and the interpreter is made anew |
| Calls | 500 | 500 | counted where a call is answered |
| Changes | 200 | 200 | counted the same way: the cap one batch has |
| What it returns | 256 kB | 256 kB | measured as serialised |
| At once | one a caller | one | asked before anything is awaited |

A script stopped at a limit is refused `agent.scriptLimit` with a sentence
that names the limit and what to do instead; one that throws or will not
compile, `agent.scriptFailed`, with its own message cut to 2,000 characters.
A host that meters its door is asked to charge a round of calls for every
ten a script makes, and a refusal there ends the script (`rate`).

The app gets less processing because a second of it is a second the page
does not answer, and longer on the clock because its reads may wait on a
folder. Its stack is smaller because a page's own stack is the browser's and
not ours to size.

### 5. A call out of a script is a plain call

The host answers an inner call with the code that answers a plain one
(`CodeHost.ask`, `host.ts`). Who may read what, what is refused and how a
person is named are decided where they were already decided; a refusal is
thrown in the script as an error carrying its key, which the script may
catch. What a script returns passes the names once more on its way out.

**A write is tried on a trial** (`trialSession.ts`): one scope's model as it
was when the script first touched it, and every command the script's calls
make of it, applied through the one reducer by the handler itself. So a
write in a script is built, checked and refused by the code that builds,
checks and refuses a plain one, and a later read of that scope sees what the
script did. Reads over the whole tree answer from the tree as it stands, as
a batch's do.

Ids in a trial are its own and repeatable: a new element's is its name's key,
kept clear of what the model and the tree hold, and an id with no name behind
it is a fingerprint of the script, the scope, its revision and its place in
the run. Trying the same script twice on the same scope gives the same ids
and uses nothing up.

**A trial is one scope**, landed later as that scope's one step. What cannot
be tried that way keeps its method and is refused `agent.notInScript`, with
where to go instead:

* always: `observation.move` (two scopes, always); the tree's own tools; the
  register's writes (outside any scope's history); `image.upload`;
  `project.save`; `diagram.tidy`, `diagram.route`, `diagram.render` and
  `focus` (the screen); `app.*` and `session.*` (the app, not the model);
* by what it would do, decided by the handler (`SessionView.inScript`): a
  merge whose plan writes another scope; a unit removed with rows other
  scopes keep of it; a unit linked to domains whose types would follow, each
  written in its own scope.

A host that keeps one scope open tries writes on that scope and refuses one
addressed elsewhere `agent.scopeNotOpen`, as it refuses a plain write.

`simulate` answers, per scope written, the revision it was tried at, how
many calls changed it, and what would change in the landscape's own terms
(`model/diff.ts`, with its counts); each changing call with its answer;
every refusal the script met, caught or not; what the script returned; and a
token. A script that fails — an uncaught refusal, an error, a limit —
answers no token: half a script is not offered to be landed. One that
changed nothing answers none either.

### 6. What a run lands

**The commands, not the script** (`held.ts`). A token is 128 random bits,
good once, for fifteen minutes, for whoever was given it; a caller holds at
most twenty, and they are kept in memory, so a restart forgets them. Unknown,
used, discarded, expired or somebody else's is one answer,
`agent.unknownSimulation`: simulate again.

`run` hands the simulation to the host (`CodeHost.land`), which lands every
scope's commands as that scope's **one step**, each only where the scope is
still at the revision it was tried at, all of them or none. A scope that
moved is refused `agent.stale`, naming it, and nothing is rebased: the
person agreed to a change to a scope that no longer stands. The token is
spent whatever comes of the run.

On a session (`landOnSession`): the scope open, one transaction of the
agent's, so one undo and one line in the list of what was done; counted as a
driving call, so the banner names who changed what and the session's
take-back covers it.

### 7. What a host is told

One line a script (`ScriptReport`): which of the tools, a SHA-256 of the
text, its length, the scopes its calls named and wrote, its calls, its
changes, its processing, the size of what it returned, the limit it met, and
how it ended. **Never the script's text, an argument, a value it was
answered or returned, or a message it threw**: a script carries somebody's
landscape, and a trail is read by other people. A test holds that none of
them reaches a line.

## Consequences

* `tools/list` as the app answers it is 203,480 characters as tools, 4,089
  in `code` and 207,558 in `both`; the instructions 9,850, 10,502 and
  10,216. Each is held to exactly that (`agent/door.test.ts`). The map
  `api.describe` answers with nothing asked is under 9,000 characters, and
  the whole vocabulary's signatures about 29,000. `both` saves nothing: the
  saving comes when a client takes `code`.
* The app's bundle is 82 kB larger on the web and 128 kB on the desktop,
  none of it in the first download, and inside both budgets as they stood:
  code mode, its host and the interpreter's glue are scripts fetched with
  the first script an agent sends.
* A join over the tree is one call and what crosses the door is what the
  script returned.
* Two packages on the dependency policy's list, and a WebAssembly file of
  503 kB that a build publishes beside its scripts as `quickjs.wasm`
  (`build/quickjsWasm.ts`), as the router's is, and that the bundle's budget
  does not count. The package's own reference to that file is taken out of
  its loader, so it ships once.
* The tool table is now also the source of an API: a schema changed is a
  signature changed, shown in `api.snapshot.txt`.
* The answers have no types yet, so a script reads an answer as a plain call
  does: by what it holds.
* Four refusals are new: `agent.scriptLimit`, `agent.scriptFailed`,
  `agent.notInScript`, `agent.unknownSimulation`.

### Confirmation

`agent/code/*.test.ts`: every tool mapped or said absent, no two alike, and
the generated API held whole; each limit tripped by a script written to trip
it — an endless loop, one that catches, a regular expression that backtracks
without end, a chain of promises, one nobody waits for, an allocation, a
recursion, a nesting the reader recurses on, a call never answered, a count
— and the interpreter running the next script as if nothing had happened;
nothing of the process in reach of a script; a join over the tree in one
query; a simulation, its run, a scope that moved, a token used, discarded
and somebody else's; the same ids from the same script; a host told nothing
a script said; a person under a pseudonym in what a script returns. The
handler's own suites hold the three writes a trial refuses. `pure.test.ts`
still loads the agent in a plain node process, and `quickjs.test.ts` loads
the interpreter's file alone in one. `app/useAgentGateway.test.tsx` runs a
script, a simulation, its run and its undo through the whole shell;
`electron/main/mcp.test.ts` holds the mode with the real client; and the
desktop's smoke run fetches the interpreter over the app's own scheme, runs
a script in the page under its content security policy, stops an endless
one, and lands and undoes a change.

## Not built

* **Types for what a method answers.** Every method answers
  `Promise<unknown>`.
* **A merge across the tree tried in a script.** It is refused; landing
  several scopes' trials as one is what a host with several writers does, and
  the plan of a merge is not yet one of them.
* **Making `code` what a client is offered when nobody chose**, and any day
  on which the plain tools stop being offered.
* **A trail of scripts in the app.** What the app logs of an agent's call is
  the tool's name and how it was answered, which for a script is `query` and
  its outcome.

## More Information

ADR-0007 for the vocabulary and the protocol; ADR-0011 for one command a
write and `batch`, whose dry run this goes beyond; ADR-0019 for the driving
session a run is counted in; ADR-0036 §13 for how a person is named to an
agent.
