# ADR-0019 — An agent drives the app, and the person can stop it

* Status: accepted; amended 1 October 2026 (a move a provider says is its
  own, a tab and a selection in a destination, and an open that never makes
  a view), as built the same day
* Date: 2026-09-19
* Deciders: Wouter Simons

## Context and Problem Statement

ADR-0007 made an agent a peer of the menu: it reads the landscape on screen,
lands changes as commands, and asks the renderer for pictures. ADR-0012 then
turned the one project into an organisation of scopes, each with its own
home, views, registers, reports and pages — and the agent stayed where it
was. It could read another scope's document from disk, but every write, every
picture and every `focus` needed **the** scope open in the workspace, and
with nothing open every call was refused `agent.noProject`. The person had to
click the right landscape open, and often the right board, before the agent
could do anything; an agent asked to *tidy the retail board* while the
organisation screen was up was stuck, and said so in a sentence that gave no
way out.

Two things were missing. The agent had no picture of the app as a **screen**
— which scope is open, on which tab, with which page over it, or whose home
is up — and no way to move it. And once it could move it, a second problem
became a first one: a person who does not know an agent is about to switch
scopes, open pages and select elements will click into the middle of it, and
each of them then sees a screen the other did not expect.

## Decision Drivers

* **A peer of the menu goes where a person goes.** The tree, the tabs, the
  cards and the breadcrumb are the person's navigation; the agent needs the
  same map and the same moves, in the landscape's own words.
* **Structure over pixels, again.** *Which scope, which page, which view* is
  a small structured answer. It is what `app.current` says and what
  `app.open` takes, and a picture is never needed to know where the app is.
* **The person is watching, and now has to know.** ADR-0007's glyph says an
  agent is connected; it does not say the agent is about to move the app.
  Driving has to be announced, and announced with a way to say *stop*.
* **Stop has to mean something to the agent.** A server that never pushes
  cannot interrupt a client; what it can do is answer the next call with a
  refusal it will read. And a call in flight when Stop is pressed must be
  answered the same way at once, not left to finish and report success.
* **One address.** A place in the app is a scope path, a page and an id. The
  agent's destination should be that triple, not a second grammar.

## Considered Options

1. Leave it: the person opens the scope; the agent reads elsewhere from disk.
2. Let a write with `scope` set open that scope silently, as a side effect.
3. **A drive tier: `app.current`, `app.open`, `views.list`, and a driving
   session with a banner and a Stop button.**
4. A modal lock: while the agent works, the person's clicks are blocked.

## Decision Outcome

**Option 3.** The agent gets the app as a screen and the moves a person has;
the person gets a banner that names who is driving and a button that ends it.

### The vocabulary

A fourth tier, **drive**, beside read, write and see. `agent/screen.ts` is
the vocabulary: a `Screen` — the scope open in the workspace with the view on
its tab and the page over it, or the home that is up — and a `Destination`,
which is *scope, page, id*. The pages are the ones a person reaches from the
cards and the bar: `home`, `board` / `sheet` / `map` / `technology`,
`decisions`, `roadmap`, `plan`, `element`, `document` / `documentation`,
`platform` / `service`, `register` / `technologyRegister`.

| Tool | Tier | What it does |
|---|---|---|
| `app.current` | drive | Where the app is: the `Screen`, the revision when a scope is open, who is connected, and the driving session or the Stop. Its sentence tells an agent refused `agent.noProject` what to do. |
| `views.list` | read | Every view in every scope, with its kind and which is on the tab — the overview the organisation screen and the tabs give a person. The index carries no views by design, so it is one read per scope that holds one, once, because the agent asked for the whole map. |
| `app.open` | drive | Move the app. The destination is checked against the scope's own document before the shell is asked — a view of the right kind, an element, a plan, a record; an id with no page infers the page; a scope with no views and no page opens on its home. Answers with `app.current` once the screen says it has arrived. |
| `session.start` | drive | Start a driving session on purpose and put a reason on the banner. After a Stop, the only driving call that is not refused. |
| `session.end` | drive | The banner goes; the next driving call starts a new session. |

`agent.noProject` keeps its key and changes its sentence: it now says what to
call. `agent.stopped` is new.

### Nothing open is a state, not a fault

The handler takes the session as optional. With none, it answers the tree,
a read with `scope` set from that scope's document, the resources whose URI
names a scope (and the organisation's, whose own URIs have no path), and the
drive tier — and refuses the rest with `agent.noProject`. The shell binds the
seam **once**, in `useAgentShell`, whatever is on screen; the workspace
registers its session view while a scope is open and takes it back on
unmount. This is what lets `app.open` switch scopes: the subscription
outlives the remount it causes.

Moving is the shell's: `useAgentShell` is handed a `screen()` and an
`open()`, and `App` fills them from what it already has — `openScopeAt` with
an `InitialPage` for another scope, the workspace's own page openers within
the open one, `goHome` and a page request for the organisation screen's two
pages. `InitialPage` gains `platform` and `service`, and an id on
`decisions`, so a destination maps onto it one for one.

### The driving session

`agent/driving.ts` is the machine, pure. A call **drives** when it moves the
screen or changes the model: every write, every see-tool but the layout
report, and `app.open`. The first driving call starts a session under the
client's name from its handshake; `session.start` adds the reason. Reads
never start one and are never refused by one: looking is not driving.

The banner is a strip along the bottom, like the sync and storage notices:
*Claude Code is driving the app: tidying the retail board. What you click
meanwhile can change what it does. Stop ends its session and tells it so.*
Stop ends the session and leaves a mark. Every driving call after it is
refused `agent.stopped`, whose sentence says: tell the person where you got
to, and call `session.start` only when they ask you to continue. A call in
flight when Stop is pressed is answered `agent.stopped` at once; what it was
doing finishes on its own and is undoable like anything else.

Stop is not a lock. `session.start` after a Stop is allowed, deliberately:
the alternative is a dead agent until the person finds a switch, and the
person is the agent's operator in chat anyway. The refusal's sentence carries
the rule, the way every refusal in this codebase carries its reason.

A session also ends when the client goes — the goodbye the SDK sends, or
main's idle rule — because a banner naming a client that is no longer there
would be a lie.

### What is deliberately not done

* No lock on the person's input (option 4). A person who wants the app back
  has it back the moment they click; what they lacked was knowing.
* No push to the agent. The transport never pushes; the next call is the
  channel, and the in-flight answer is the most that can be done now.
* No remembered Stop across a relaunch. A Stop is about a session, and a
  session does not survive the app.

### Consequences

* The agent's first call from the organisation screen is no longer a dead
  end. `app.current` → `views.list` → `app.open` is the loop, and the
  connect-time instructions say so.
* `views.list` is a read per scope with views. It is described as such and
  is the agent's to call once; a shell that wanted it cheaper would put view
  names into `ScopeModel`, which ADR-0012 kept thin on purpose.
* The banner is one more strip along the bottom. It appears only while an
  agent drives, and the glyph's *connected* state stays what it was.
* The person's Stop reaches the agent one call late. That is the honest
  latency of a server that never pushes, and the sentence tells the agent
  not to spend that call carrying on.

### Confirmation

* `driving.test.ts`: what drives, the session's start and count, Stop's mark,
  `session.start` clearing it, end by agent and by client.
* `handle.shell.test.ts`: with nothing open — the home said, the tree and a
  scoped read answered, `agent.noProject` for the rest with no session
  started, every view listed reading only scopes that hold one, a scope
  opened on its canvas or its home, the registers, every destination check
  before the shell is asked, the page inferred from an id; with a scope open
  — the screen with page and revision, a move within the scope, the session
  starting on the first write, `agent.stopped` until `session.start`, and a
  call in flight answered the moment Stop is pressed.
* `App.driving.test.tsx`, through the whole shell: the organisation screen
  answers `app.current` and `views.list`; `app.open` mounts the workspace
  and a write then lands there; the register page and a decisions page open
  on request; the banner names the client; Stop takes it down, toasts, the
  next write is refused, and `session.start` puts the banner back with the
  reason.
* The desktop smoke run still connects with the real client and reads the
  scope on screen; the tool list it reports grows by five.

## Amended — a destination a provider can use precisely

*1 October 2026.* A source's provider was handed the agent's way about —
`open(to)` and the `Screen` — so that a notice could send a person where it
names (ADR-0022, amended). A provider whose chrome sends a person from one
place to the next found four things it could not say, and one thing an open
did that nobody had asked for. Each is said here in the destination's own words,
and the agent's `app.open` takes the two new ones, because an agent can do
what a person can (ADR-0011).

* **A move a provider says is its own is the provider's.** `SourceOpen`
  takes `{ by: 'provider' }`, and `MovedBy` gains `provider`. Every screen
  such a move brings in the scope it was sent to is `provider`'s until the
  app has landed where it was sent (`landed`: on the kind of page asked for,
  whichever record or tab it then shows — and on the scope's home where a
  view was asked for and the scope has none of that kind) and the page there
  has settled: a record's page names the record asked for until it has
  picked what it shows — the newest observation, the first decision, the tab
  that is up — and that pick is the provider's too. A screen in another
  scope lets the mark go, because that move was somebody else's, and so does
  a screen off the destination once the app had landed on it. Whether the
  move moves the app at all is judged on where it will land — a view's page
  in the scope that is open on the view it resolves to, and a record's page
  asked for again as a move, because it picks again. A
  move to where the app already is leaves no mark on the next one, and an
  agent's move after it is the agent's. A move a person makes is never said
  to be a provider's. Under ADR-0033 a provider's move is a step in the
  window's history as an agent's is — that record counts every move to
  another place whoever made it — and a move made by Back is the history's,
  never the provider's: the mark is set by a provider's own open and by
  nothing else.
* **A destination may name a tab of the observations page.**
  `Destination.tab` is one of `register`, `analysis` and `solutions`
  (`observations/tabs.ts`); with an id as well, the tab named wins over the
  one the record would open on, and the record is selected there. The
  screen says which tab is up (`ScreenPage`'s `tab` on the observations
  page), once the page has said so, so a tab the person changes is seen,
  and `arrived` waits for a tab asked for. The tab is part of a place
  (ADR-0033): the address carries it, and a change of tab replaces the entry
  as another record on the same page does.
* **A destination may name an element to select.** `Destination.select` is
  an element selected on the board, sheet, map or technology landscape being
  opened, where that view draws it, and nothing is selected where it does
  not: on a board through the editor's own focus, and only where the board
  places it, because that request would otherwise switch to a board that
  does; on the technology landscape through the card it is drawn as; on a
  sheet or a map through a numbered request the page honours where it draws
  it. A selection is not part of a place (ADR-0033 leaves it out), so the
  address never carries it, though like every field of a destination it is
  a plain string.
* **An open never makes a view.** A view's page with no id — a board's as
  much as a sheet's, a map's or a technology landscape's — opens the one on
  the scope's tab where it is of that kind, and the first of that kind
  otherwise; where the scope has none of that kind it lands on the scope's
  home, and nothing is made. It used to make a sheet, a map or a landscape
  where there was none, and a board with no id opened whatever view was on
  the tab. The one way onto a view that writes one is the person's own
  *Make…* on a home's card and *New board…* over its boards, which ask for
  it by name (`InitialPage`'s `make`) and do what they did. A view an id
  names opens as before; where one that was removed lands is ADR-0033's rule. The one write
  an open made before this stays as it was: a page every scope has before
  anything is written in it — its decisions, observations, roadmap,
  documentation — asked for on a scope with no document writes that scope's
  bare document first, for somebody who may write there (`opensOnNothing`).
* **What is opened is what is seen.** Whatever a destination opens in the
  scope that is open, the documentation page over the board is closed first,
  but for a record's page, which takes its place
  (`EditorRequests.leaveDocumentation`).

`app.open` takes `tab` and `select`, held to the page the destination
resolves to before the shell is asked: a tab is the observations page's,
an element to select is one the scope knows, on a view's page. Its own rule
for a view's page with no id is unchanged — the only one of that kind, and a
refusal that says which where there are none or several — so an agent still
never meets the home it lands on for a provider.

**As built, 1 October 2026.** `agent/screen.ts` says the destination and
the screen (`Destination.tab`, `select`, `ScreenPage`'s `tab`,
`MovedBy`), and `landed` and `viewFor`; `agent/place.ts` carries the tab in a
place; `app/useShellAgent.ts` keeps a provider's mark and resolves a view's
page in the scope that is open, and `app/pageLanding.ts` resolves it in one
that is opened, for `useShellNavigation`'s `enter`; the boot's landing of a
place follows the same rule (`bootLanding.ts`). The tab is the page's
(`ObservationsPage`'s `initialTab`, said back with what is on show), the
selection `app/useViewSelect.ts` with `widgets/useSelectRequest.ts`, and
`agent/shell.ts` checks both for `app.open`. The workspace says whether a
record's page has settled (`WorkspaceAgentView.settled`), which the mark waits
for. `App.destination.test.tsx` pins a provider's move through the whole
shell — onto a record's page that picks an observation or a decision, from a
home and in the scope that is open, and again where that page is up; onto
another view, or the home, from a view's page with no id in the scope that
is open — a view asked for with none of
its kind landing on the home with nothing written, the one there is opened,
a board with no id the board on the tab, the observations page on a tab and
the screen saying so, a selection on a sheet and none where the sheet does
not draw it, and the documentation page closed by another page; `screen`,
`place`, `pageLanding`, `bootLanding`, `useViewSelect` and `handle.shell`
tests pin the rest, and `OrganisationScreen.test.tsx` the person's own
*Make…* and *New board…*, which still make a sheet.

## More Information

ADR-0007 for the agent as a peer of the menu and the three tiers this adds a
fourth to; ADR-0012 for the organisation of scopes the agent now moves
through; ADR-0016 for a laid-out view being a tab, which is why `app.open`
treats a sheet, a map and a landscape as views beside a board.
