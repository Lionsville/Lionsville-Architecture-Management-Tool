# ADR-0007 — An agent as a peer of the menu: an MCP server that speaks commands

* Status: proposed
* Date: 2026-09-07
* Deciders: Wouter Simons

**This record is a proposal, not a decision.** Nothing in it is built and
nothing in it has been agreed. It is written so the decision can be made
against something concrete: a module, a seam, a tool list and an order to
build in. *Open questions* at the end is what a reader has to answer before
anything in *What this takes* starts.

It takes number 0007 because ADR-0005 already refers to the update work as
ADR-0006.

## Context and Problem Statement

An agent working beside the app has two ways to reach a project today, and
both of them were built for something else. The folder (ADR-0003) is text:
every decision and every description is a markdown file, the model is JSON,
and git holds the history. An agent can read all of it without the app
running, and it should keep doing so. What it cannot do is anything that
involves the app being open:

* change something the person can **watch land** on the canvas and undo with
  ⌘Z;
* ask the app to **draw** a diagram, **tidy** it or **route** it, which only
  the renderer can do;
* **point** at an element so the person sees which one it means, or be pointed
  at.

Writing files behind a running app is also the one thing the watcher is built
to notice. A change the app did not make arrives as *changed on disk*, it
bypasses the reducer, the id policy and the activity log, and the person is
asked to reconcile a conflict with a colleague who turns out to be a script.

So the question is not "how do we add MCP". It is **what an agent is,
architecturally**: a second process editing files behind the app's back, or a
second user at the same session. This record argues for the second, and
everything else follows from that.

## Decision Drivers

* **One writer.** ADR-0002 made `apply(model, command)` the only thing that
  changes a model, and it is why ⌘Z undoes a decision's status as readily as a
  node move. An agent's change goes through it or the app has two brains
  again.
* **Two processes.** The model, the reducer and the session live in the
  renderer. Only main can listen on a socket. The file channel already solved
  this exact split, and the solution should look like it.
* **A person is watching.** The value of an agent in a design tool is
  collaboration, not batch editing. Its change has to be visible, undoable and
  attributed, or it is indistinguishable from a bug.
* **Semantic over structural.** The Activity list names steps in the
  landscape's own terms because a person reads them. An agent should speak the
  same terms: *add an application*, not *here is a `DesignElement` literal*.
* **A desktop app that listens is new surface.** *Nothing sensitive in the
  tree* applies to a token too. The server binds to the loopback only, wants a
  bearer token, and is off until a person turns it on.
* **The desktop has a main process and a tab does not.** The File menu, the
  file channel and history are desktop-only, and the tab stays honest about
  it. The server follows the same rule.
* **A feature nobody can find is not shipped.** ADR-0005 made the point about
  the theme: a cycle button is a fine way to change it and a poor way to
  discover it can be changed. A server that is turned on in a preferences tab
  is discoverable by its author. The way in for a person is part of the
  design, not a follow-up.

## Considered Options

1. No server. The agent edits the folder; the app's watcher picks it up.
2. A separate headless MCP server over the folder format, with no app running.
3. **An MCP server in the Electron main process that relays every tool call
   to the live session as a command.**
4. An MCP server inside the renderer, over a WebSocket.
5. The agent drives the app through the DOM, the way the smoke run does.

## Decision Outcome

**Option 3**, with option 1 kept for what it already is: the way to *read* a
project when the app is closed. The server is one more host channel beside the
menu bar and the OS. What it carries is commands, never files. An agent's
transaction is one undo step, it shows in Activity under the agent's name,
autosave writes it, the reducer refuses it under the same rules, and the
person sees it land.

```
 OUTSIDE THE APP        ELECTRON MAIN (Node)              RENDERER (React)

 ┌─────────────┐  HTTP  ┌────────────────────────┐  IPC  ┌──────────────────────┐
 │ Claude Code │ ─────▶ │ electron/main/mcp.ts   │ ────▶ │ useAgentGateway      │
 │ any client  │ 127.0. │ registers, relays,     │       │ port filled by       │
 └─────────────┘  0.1   │ knows no model         │       │ adapters/desktop     │
                        └───────────┬────────────┘       └──────────┬───────────┘
                                    │ imports                       │ dispatches
                        ┌───────────┴────────────┐       ┌──────────┴───────────┐
                        │ src/agent/tools.ts     │ ═════ │ ModelSession         │
                        │ one file, both ends    │ same  │ apply · undo ·       │
                        │ compile against it     │ types │ Activity · autosave  │
                        └────────────────────────┘       └──────────────────────┘
```

A tool call crosses two seams the app already has: loopback HTTP into main,
and IPC into the renderer. Main is a relay; the renderer answers by
dispatching at the session. The tool vocabulary is one file, so the two ends
cannot drift, which is the trick `channel.ts` already plays for files.

### The vocabulary lives in a module of its own

A new module, `src/agent/`, with a row in the import matrix and a sentence of
its own. It is pure: tool names, input schemas, descriptions, and the two
functions that do the work. `answer(tool, args, model)` reads;
`commandFor(tool, args, model, ids)` turns a request into one `Command`,
usually a `transaction`. It takes the id policy as an argument because the
session's model is the truth about what is taken, and stays reproducible for
it.

| Row | May import | Why |
|---|---|---|
| `agent` | `model` `layout` `i18n` `platform` `documentation` `decisions` `search` | An agent asks about the landscape in the landscape's own terms. It does not know how the model is drawn or where it is saved. |

It may not import `editor`, `projects`, `ports` or `app`. Not the editor
because a vocabulary that knows about React Flow cannot be tested in node; not
projects because the agent never touches a file; not ports because the seam is
declared in `ports/` and points at the vocabulary, not the other way round.

### The seam, and who fills it

The traffic runs the other way from `HostCommands`: there, main tells and the
app listens; here, main *asks* and the app *answers*. The port mirrors the
existing shape so a reader recognises it:

```ts
// src/ports/AgentGateway.ts — the seam, types only
export type AgentGateway = {
  /** Every request, until the returned function is called. Answer each one. */
  on(handler: (request: AgentRequest) => Promise<AgentAnswer>): () => void
}
```

`AgentRequest` and `AgentAnswer` are typed from `src/agent/tools.ts`. The
desktop fills the port in `src/adapters/desktop/` over two IPC messages,
`agent:request` from main and `agent:answer` back, correlated by an id, with a
row on `DesktopBridge` and on `channel.ts`. One line in `composition.ts`. A tab
has no filling and the port is absent on `Shell`, the way `history?` is, rather
than a null object that answers "no" to everything.

### The binding to the live session

`src/app/useAgentGateway.ts` is a few lines: subscribe to the port, hand each
request to the handler in `src/agent/` together with a *narrow* view of the
session. The handler declares what it needs, not the widest thing available:

```ts
type SessionView = {
  indexed(): Model
  dispatch(command: Command): Model | undefined
  ids: IdPolicy
  activeDiagramId: string
  setActiveDiagramId(id: string): void
}
```

Every one of those is already on `ModelSession`. Because the handler takes a
plain object, it is tested in node over the real reducer, with the generated
landscape from ADR-0004 and no window, which is the same arrangement
`editor/testing/editorHost` uses for the editor.

### The server itself

`electron/main/mcp.ts`, on `@modelcontextprotocol/sdk` with its streamable
HTTP transport over Node's own `http`. It binds to `127.0.0.1`, registers the
tool list from `src/agent/tools.ts`, the way main already imports
`platform/theme`, and relays each call to the focused window. It knows nothing
about the model and decides nothing, which is the same discipline `appMenu.ts`
keeps.

Off by default. On is a preference in the application scope of ADR-0005, this
person on this machine. **The port and the bearer token are generated when the
feature is turned on and kept**, in `mcp.json` in `userData` with mode 0600,
until it is turned off or a person asks for a new token. A person configures
their agent once; a token that changed on every launch would mean doing it
again every morning. If the kept port is busy at start, main takes another,
keeps that one, and the dialog says so. Turning the feature off closes the
listener and forgets both.

Main reports three facts about the server to the renderer, the way it reports
nothing else: *off*, *listening* on which port, and *connected* by which
client. The last one is free: MCP's `initialize` handshake carries the client's
own name and version, so the app can say *Claude Code* rather than *an agent*.

Streamable HTTP rather than stdio, because the app is already running and an
agent attaches to it; stdio would mean a second process that has to find the
first one anyway.

### The way in for a person: a glyph, a dialog, the instructions

A glyph in the shell toolbar, beside what is there after ADR-0005, that does
two jobs. It is the one place the server's state is visible, and it is how a
person finds out the feature exists. Three states, encoded in the glyph and
named in its tooltip:

| State | Glyph | Tooltip |
|---|---|---|
| Off | outline, dimmed | Connect an agent… |
| Listening | outline | Waiting for an agent on port 51733 |
| Connected | filled, accent | Claude Code connected |

Clicking it in any state opens **Connect an agent**, a dialog with three
parts, top to bottom:

1. **What this is.** Four sentences in a person's language: your coding agent,
   Claude Code, Codex, Cursor or any other MCP client, can read this
   landscape, propose changes, and look at diagrams while you work. Everything
   it does shows in Activity under its name and is undone with ⌘Z. It connects
   over the standard Model Context Protocol, on this machine only. Nothing
   leaves the computer.
2. **The switch.** One toggle, the preference. Turning it on generates the port
   and token and starts listening; the dialog does not close, because the next
   thing the person needs is below it.
3. **The instructions, per client.** A row of tabs, one per client the app
   knows the recipe for, each showing the command or the configuration snippet
   with the real port and token already in it, and a *Copy* button that goes
   through `HostControls.copyText`. A last tab, *Other*, shows the endpoint and
   the header for a client not listed. Below the tabs, *New token* regenerates
   and shows the new snippet, with a line saying every configured agent now
   needs it again.

```bash
# Claude Code, as the dialog would show it with the real values filled in
claude mcp add --transport http lvarch http://127.0.0.1:51733/mcp \
  --header "Authorization: Bearer 3f9c…"
```

The recipes are strings in `src/app/strings/`, English and Dutch, because a
person reads them, and they drift with the clients: a recipe is the kind of
thing that is wrong six months later, so each is one string with placeholders
for port and token, and `strings.test.ts` already checks that placeholders
survive translation. The dialog is a normal dialog, not a fullscreen one, so it
does not take `windowChrome`.

The same dialog is reachable from the menu, said once in the menu data so the
web overflow carries it too: `{ type: 'connectAgent' }` joins `HostCommand`. In
a browser tab the glyph and the item exist and the dialog says the first part
and then, in place of the switch, that connecting an agent needs the desktop
app and where to get it. That is the honest fallback the rest of the shell
uses, and it is better than the feature being invisible on the web.

`readOnly` hides the switch and the token, not the explanation.

### What the tools are

Three tiers, in the order they earn their keep. Names are provisional; the
shape is the point.

| Tier | Tools | What crosses the seam |
|---|---|---|
| Read | `project.current` `elements.list` `element.describe` `connections.list` `diagrams.list` `decisions.list` `decision.read` `search` | Answers built by `answer()` over the indexed model. Descriptions and decisions are also MCP *resources*, so an agent can read them without a call. |
| Write | `application.add` `connect` `element.update` `element.remove` `decision.propose` `decision.transition` `diagram.create` | One `Command` each, from `commandFor()`. A new element gets the key the file would have given it, from the session's id policy. Refusals come back as keys. |
| See | `diagram.inspect` `diagram.render` `diagram.tidy` `diagram.route` `focus` `placeNextTo` `align` `distribute` `moveBy` | The four things only the renderer can do, and relational placement so an agent never has to invent an absolute coordinate. |

### Helping the agent see

Structure first, pixels second. Most "does this look right" questions have a
geometric answer, and an agent reasons far better over *A overlaps B by 40 px*
than over a bitmap.

* **`diagram.inspect`** is a layout report from placements and routes: bounds,
  boxes that overlap, an edge that crosses a box, an element outside its zone,
  unrouted connections, orphans, density per band. It is arithmetic over
  `placement`, `routes` and `floatingEdgeMath`, so it lives in `src/agent/`,
  is node-tested against the generated landscape, and gets a line in the perf
  budget.
* **`diagram.render`** returns a PNG as an MCP image block. The path exists:
  the renderer switches to the diagram, waits for settle, runs the PNG export
  the toolbar uses, and answers with the bytes *and the transform it drew
  with*, so a pixel maps back to a flow coordinate. The export already takes
  `bounds`, so `elementIds` or a region is the agent's zoom. Two caveats the
  smoke run documents: the window must be visible for the capture to fire, and
  a 6000 px landscape is useless to a model, so the size is capped and a crop
  is the default.
* **`diagram.tidy` and `diagram.route`** trigger the same worker runs the
  buttons do, under the same cap and with the same cancel, and answer with the
  inspect report afterwards.
* **`focus`** selects and scrolls to an element through the focus hook the
  coverage view already uses. This is the collaboration affordance: the agent
  says *this one* and the person sees it. A later `selection.current` is how
  the person points back.

The loop an agent runs is then: inspect, render a crop of what inspect
flagged, move relationally, inspect again. The person watches it with undo
under their hand.

### Refusals, attribution and words

Everything about a call may say no, and each no is a key: `agent.off`,
`agent.noProject`, `agent.readOnly`, `agent.conflict` for a session that is
waiting on a person, `agent.unknownId`, `agent.tooLarge` for a board over the
tidy cap, plus the reducer's own `command.gone` and `command.lastLandscape`
passed through. The agent gets the key and one English sentence.

Tool descriptions and those sentences are English constants in `src/agent/`,
deliberately outside `i18n`. They are a protocol contract for a machine, like
the interchange format, not copy a person reads in their language. The record
says so because it is the first exception to *UI strings are never inline*,
and it should stay the only one of its kind.

One small model change: `origin?: 'agent'` on `CommandMeta`, so the Activity
list can say who took the step. It is the cheapest form of the attribution
driver and it makes the log honest when the person and the agent are both
editing.

### What is deliberately not exposed

* The file channel. An agent never reads or writes a file through the app.
* Snapshots, push and pull. Whether an agent may write to git history is an
  open question below, not a default.
* Preferences, folders, and anything on the `HostCommand` stream. The agent is
  a peer of the menu, not a hand on it.

### Consequences

* A twelfth module in the matrix, and the first one that exists for a client
  that is not a person. Its row is short and its tests are all node.
* The desktop can accept connections. Loopback only, a kept token, opt-in,
  every call logged through `Diagnostics` as a tool name and a key, never
  content.
* The tool vocabulary becomes a published surface, like the interchange
  format. Renaming a tool is a breaking change for somebody's agent
  configuration, so names should be chosen once, in *Names, decided*.
* The activity log and the undo stack acquire a second author. ⌘Z after an
  agent's step undoes the agent's step, which is the intended behaviour and
  needs a test that says so.
* The renderer gains a request it has to answer, on a schedule it does not
  control. A slow render or a tidy over the cap answers with a refusal or a
  cancellation, never a hung IPC.
* The toolbar, just slimmed by ADR-0005, gets one glyph back. It earns its
  place by carrying state, not only a door: it is the only way a person can
  see that something else is editing.
* The app shows a person their own token and copies it to their clipboard.
  That is what configuring an agent requires; the token is machine-local,
  loopback-only, and regenerable from the same dialog. It never lands in a
  folder, a project, or a log.
* Nothing changes for an agent that reads the folder with the app closed. A
  browser tab gains a dialog that explains, and nothing that listens.

### Confirmation

* The handler in `src/agent/` passes its suite over a real reducer: every
  write tool produces a command that the reducer accepts and can reverse, and
  the model after undo is byte-identical to the model before.
* `diagram.inspect` over the generated landscape reports the overlaps a test
  planted, and runs inside its budget.
* The smoke run turns the server on, connects with the real SDK client, lists
  tools, adds an application, sees it on the next `elements.list`, and presses
  undo through the window.
* With the preference off, nothing listens: the smoke run checks the port is
  closed.
* A request with a wrong token is refused before it reaches the renderer, and
  is logged.
* Through `renderShell`: the glyph shows the three states from the reported
  facts; the dialog's recipe contains the port and token it was given; *Copy*
  reaches the `HostControls` seam with that text; under `readOnly` the switch
  is absent; in a tab the switch is replaced by the explanation.
* Quit and relaunch with the feature on: the smoke run finds the same port and
  token, and an agent configured before the relaunch still connects.

## Pros and Cons of the Options

### No server; the agent edits the folder

What exists today, for reading. Already works, no new surface, and git is the
history. But every write bypasses the reducer, the id policy and Activity, and
arrives at the app as a change on disk to be reconciled. No render, no tidy,
no pointing.

### A headless MCP server over the folder format

Works with the app closed, and the folder format is pure and already tested.
But it is option 1 with a nicer vocabulary: two writers to one folder, and
still nothing visual. Worth building later as a *read-only* companion,
reusing `answer()`, once the vocabulary exists.

### A server in main that relays commands to the live session

One writer, undoable, attributed, visible; the four renderer-only things
become tools; the split mirrors the file channel. In exchange: needs the app
open and the window visible for render, a new listening surface, and one more
thing flowing renderer-to-main.

### A server inside the renderer over a WebSocket

No IPC hop. But a renderer cannot listen; it can only connect out. It would
need a broker in main anyway, and the CSP and the sandbox exist precisely to
keep the renderer from being a network endpoint.

### Driving the app through the DOM

Zero new code in the app; the smoke run proves it can be done. But an agent
that clicks buttons by their aria label knows nothing about the landscape,
breaks on every relabel, and cannot be tested except end to end. Right for a
smoke test, wrong for a peer.

## What this takes, in order

Each step ends green (`npm run check`); the desktop steps want `npm run
verify` before a push.

1. **The vocabulary as pure code.** `src/agent/tools.ts` with the read tier
   only, `answer()` over the indexed model, a matrix row and its sentence in
   `eslint.config.js`. Unit tests, node. Nothing listens yet.
2. **The seam and its filling.** `ports/AgentGateway.ts`, the two IPC messages
   on `channel.ts` and the preload, the desktop adapter, one line in
   `composition.ts`, and `useAgentGateway` with the narrow session view. A
   jsdom test through `renderShell` that a request is answered from the model
   on screen.
3. **The server, read-only, and the way in.** `electron/main/mcp.ts`, the kept
   port and token, the three reported facts on the channel, the preference,
   the `connectAgent` command in the menu data and the overflow, the glyph in
   `ShellToolbar` and `ConnectAgentDialog` with its recipes in
   `src/app/strings/`. A smoke step that connects with the real client and
   lists elements. This is the first point at which an agent can be attached
   to a running app by following the app's own instructions, and it is worth
   stopping here to use it for a day.
4. **The write tier.** `commandFor()` with the id policy, `origin: 'agent'` on
   `CommandMeta` and the Activity wording for it, refusal keys, and the undo
   test. `alignNodes` and `distributeNodes` move from `editor/canvas/` to
   `layout/` so the relational moves can use them.
5. **Inspect.** The layout report, its planted-overlap tests, and a line in
   the perf budget.
6. **Render, tidy, route, focus.** The renderer-side handlers over the
   existing export, the existing worker runs and the focus hook, each
   answering a refusal when the window or the board will not allow it. MCP
   resources for decisions and descriptions land here too.
7. **Update `CLAUDE.md`**: the module in the map, the row's sentence, the tool
   names and the token file in *Names, decided*, and the state of play.

Steps 1 and 2 touch nothing on the desktop and can land while ADR-0005's steps
are still in flight. Step 3 depends on the preferences dialog existing.

## Open questions

Nobody has decided these, and the agent picking this up should ask rather than
choose:

* **May an agent snapshot?** A `project.snapshot` tool means an agent writes
  to git history under a message it drafted. The commit-message drafting
  already exists for a person; whether a machine may press the button is a
  policy, not a mechanism.
* **Which window?** The relay targets the focused window. With two projects
  open, an agent that was talking to one may find itself talking to the other.
  A session id in every answer is the mechanism; whether the server should
  refuse when the window changed is the question.
* **Which clients get a recipe tab?** Claude Code has a one-line command.
  Others have a JSON or TOML file, a settings screen, or a deep link that
  installs a server in one click. Each recipe is a string that will be wrong
  eventually; the question is how many to carry and who notices when one
  breaks.
* **Render when the window is hidden.** A minimised window cannot capture.
  Refuse with a key, or bring the window forward? The second is what a person
  would want and also the kind of thing an app should not do on its own.
* **The module's name.** `agent` reads well in the matrix and in a sentence;
  it is also the word this repository uses for the person's coding assistant.
  `assistant` or `peer` are the alternatives, and whichever is chosen goes in
  *Names, decided*.

## More Information

ADR-0002 for the command as the unit of change, which is what makes an agent's
edit one undo step and one Activity line; ADR-0003 for the folder an agent can
already read with the app closed; ADR-0004 for the generated landscape the
inspect report is tested and budgeted against; ADR-0005 for the preference
scope the switch lives in, the menu said once, and the top bar this glyph sits
beside.
