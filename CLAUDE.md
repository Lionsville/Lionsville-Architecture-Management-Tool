# CLAUDE.md — working in this repo

**Lionsville Architect**: a general-purpose architecture modelling tool — a
Layer-7 application landscape and the C4 container diagrams under it. **There is no customer in this codebase.** An organisation is a
*scope*, which is data a user creates. Never write a customer's name into an
identifier, a storage key, a file extension or a shipped example; *Names,
decided* below holds the settled ones (the working file is `.lvarch`).

One codebase, in modules, with **4544 tests** and one of every config. The
editor was a separate package under `vendor/` until September 2026; that
boundary is gone and `docs/decisions/0001` says why.

## This repository is public

Everything here is world-readable the moment it is pushed, and a force-push is
not an unpublish — GitHub keeps unreachable objects, clones and caches exist,
and search engines are faster than you are. **Nothing sensitive may enter this
tree in any scenario**, including "just for a minute", "it is a test value" and
"I will squash it out before pushing".

Two categories, both absolute:

- **Credentials.** Tokens, API keys, certificates, `.p12`/`.p8`/`.pem`/`.pfx`,
  connection strings, `.env` files, anything from a password manager. They live
  in GitHub Actions secrets and variables and are referenced **by name only** —
  `docs/release.md` lists all thirteen and carries not one value. If a
  credential ever does land here, it is burned: **rotate it first**, then clean
  the history. Cleaning history alone is not a remedy, it is a tidy-up.
- **Customer data.** A real organisation's landscape, its application names,
  hostnames, internal URLs, staff names, ticket numbers, org chart. Examples and
  fixtures are **fictional** (`src/examples/acme-logistics.json`). If you need a
  real landscape to test against, open it as a working file — that is what the
  working file is for. Do not commit it.

The second one is easy to get wrong, because a customer is identifiable without
being named. Their vocabulary, their systems' names and their domain terms
identify them as well as their logo does. When you add data you did not invent,
ask who it came from before you `git add` it — and if you did not write a file
yourself, read it before committing it.

Some of this is checked rather than remembered. `npm run setup` installs a
**pre-push hook** (`scripts/hooks/pre-push`) when — and only when — the
checkout sits beside a file of words that must not be published; the file is
kept outside this tree, because a list of words nobody may publish is itself
unpublishable. The hook reads the diff and the messages of the commits a push
would send, and refuses the push naming the file and the line that matched, so
the refusal says where to look without repeating the word. A clone that has no
such file gets no hook and loses nothing: everything the hook would catch is
something that clone never had. It is a seatbelt, not the rule — the rule is
the two categories above.

## The fast loop

```bash
npm run check
```

A few seconds: typecheck and lint of everything, plus all 4544 tests. Run it
after every change.
That is the whole feedback loop — there is no gate to pass, no ceremony, no
reviewer step. It is fast on purpose so you run it constantly instead of
batching up and discovering three problems at once.

```bash
npm run check:all
```

Adds a production build. Run it once before you hand work back, not during.

```bash
npm run verify
```

~2 minutes: everything `check:all` does, plus the **perf budgets**, the desktop
build and the desktop smoke run — every step run to the end, one table, one exit
code. This is the gate before a push, and it is written so an agent can run it
without deciding anything: no flags, no reading of scrollback. `npm run smoke` is
the last two steps on their own; `npm run test:perf` is the perf step alone.

The perf step times a generated landscape of a few thousand elements against a
written-down budget per operation (`model/testing/`, ADR-0004). It is
deliberately not in `npm run check`: building those landscapes and timing work
over them is tens of seconds, and a fast loop you batch up is not a fast loop. A
red budget is a regression to investigate, never a threshold to raise.

The timings are for an ordinary laptop; a fast desktop-class Mac does all three
in about a third of that.

Other commands: `npm run test:watch` · `npm run setup` (fresh clone; installs
both trees) · dev server on :5200 via `.claude/launch.json` (`editor-dev`).
**Do not start a dev server with Bash** — use the preview tooling.

## Committing

**Trunk-based. Commit to `main` and push.** No branch, no PR, no review gate for
ordinary work — that is the same reasoning as the fast loop above: the cost of
being wrong here is one revert, and the cost of ceremony is paid on every change
whether it needed it or not.

```bash
npm run check && git add -A && git commit && git push
```

`npm run check` before you commit is the whole discipline. Run `verify` before
a push that changes the build, touches the desktop, or ends a stretch of work.

Prefer **several small commits over one large one**, each with a message that
says why rather than what. A commit that has to explain four unrelated things is
four commits.

A branch and a PR are still the right call when the change is genuinely risky,
when you want a second pair of eyes before it lands, or when it is going to sit
half-finished for a while. That is a judgement call, not a default — reach for
it deliberately, not out of habit.

## Releasing

A release is a GitHub release created from `main` with a `vX.Y.Z` tag; the
workflow builds, signs and uploads the installers from it (`docs/release.md`).
Run `npm run verify`, make sure everything is pushed, then create the release
with `gh release create vX.Y.Z --target main`, titled `Version X.Y.Z - <what it
brings>`, with notes covering everything since the previous stable release.

**Never edit the README's download links by hand.** They name the installers
by file, and those files exist only once the workflow has built and uploaded
them. The workflow's last job points the README at the new version *after*
the assets are published, and commits that to `main` itself. A hand edit made
before then is not redundant, it is a README whose download buttons 404 for
everyone who visits during the build — and the README is the first thing a
visitor to a public repository sees. The same holds for any other document
that names a release asset by version.

## The module map

Read this before adding a file; it answers "where does this go" in one pass.
Every module has pure files at its root, a `ui/` folder for its React side
where it has one, and an `index.ts` that says what it is for. `editor/` is the
exception: React through and through, so it keeps its subfolders. The `index`
is a reading aid, not a fence: cross-module imports name the file they want,
and the boundary that is enforced is the matrix below, not the barrel.

```
src/model/        What a landscape is made of, and the arithmetic over it.
                    types             the domain half; imports nothing at all
                    kinds · zones · placement · aspects · kindChange · deletion
                    words             the model's own slice, in English, as the
                                      default every label table here falls back
                                      on — so importing the model does not import
                                      the registry, and through it every screen's
                                      words
                    lifecycle · transition · checks   dates on the facts, a plan,
                                      and what the dates contradict (ADR-0009)
                    relations         what a row between two elements MEANS, and
                                      the one type a canvas draws (ADR-0012 §5)
                    standIn           what a stand-in may carry, and the record a
                                      *link* leaves behind (ADR-0012 §3, §10)
                    porting · replacement   which interface moved where, derived
                                      from the lines; a replacement as one
                                      transaction (ADR-0010)
                    keys              addressing, slugs, where a new id comes from
                    normalised        the model indexed by id; fromArrays/toArrays
                    commands · reducer  what a change IS, and the one writer
                    commands/         one entry per kind of command, by family,
                                      and the table `apply` looks it up in —
                                      typed over `Command['type']`, so a command
                                      with no entry does not compile
                    activity          what a step is called, for a list to read
                    routes · floatingEdgeMath   where a line leaves a box
                    hostModel · fromInterchange · toInterchange · containerDiagram
                    platformReport · serviceReport   one platform, and what
                                      would be left standing if it went
                                      (ADR-0013); one service, and what would
                                      be stranded if it were withdrawn (ADR-0014)
                    leverage          what an application leverages: the
                                      services it uses and the platforms behind
                                      them, derived (ADR-0014); narrowed by where
                                      it runs when a service is delivered twice
                    technologyLandscape   the three bands, the lines between
                                      them and what a card touches (ADR-0015)
                    tree              one parent, always, and the loop refused
                    refines · implied   which application interface a container
                                      line is part of, and the one nobody drew
                    hosting · deployment · overlay   the roll-up over an
                                      application's containers, the platform
                                      tree every reader walks (ADR-0014), the
                                      boxes a container diagram draws around
                                      them, and what the landscape is coloured by
                    logo · logoRegistry · marks/    uploads, the icon registry
                    documentImage     a picture a document may hold, and its limits
                    clipboard · equality   what copies, and what counts as the same
                    diff              what changed, in the landscape's own terms
                    restore           going back as one command (ADR-0008)
                    textSearch        the one rule for "found"
                    adr               what a decision record IS (rules: decisions/)
                    testing/          the generated landscape, and the budgets
src/layout/       Where things end up: tidy, ELK, libavoid, the router worker.
src/editor/       The canvas and everything docked to it. React.
                    canvas/ · nodes/ · edges/ · theme/ · export/
                    props.ts          what the editor is handed (13 groups); `pages`
                                      is the slot a laid-out view is drawn through
                                      in place of the canvas (ADR-0016)
                    useEditorState    the selection, and gestures said as commands
                    useShownDays      the day a board is looked at, which is a
                                      window's and never a command (ADR-0027)
                    testing/          editorHost: the editor over a real reducer
src/documentation/  Descriptions as documents.
                    documentation     outline, element links, the template
                    remember          caches with a bound and an eviction rule
                    images · businessCase   pictures a document holds, and the
                                      block that computes (ADR-0009)
                    bpmn              a process's notation, read into a drawing
                                      from its own coordinates; never laid out
                    ui/               DocumentationPage, MarkdownField, blocks/
src/decisions/    Decision records: the status machine, the numbering, the page.
src/observations/ What was seen, what lies behind it (ADR-0021), and what is
                  done about it (ADR-0026).
                    observation       numbering, seen again, sharing upward, merging
                                      with history, links from a cause to what it
                                      explains, root causes derived
                    solution          a solution's gates, one step at a time, the
                                      waiver, dropping, implemented read off the
                                      plan, the two questions, seen since
                    graph             lanes and rows for the picture, no force; the
                                      sweep is shared with solutionGraph
                    ui/ObservationsPage  the register, the analysis, the solutions,
                                      the readers
src/roadmap/      The landscape on a time axis, and the plans over it (ADR-0009).
                    timeline          rows and spans, in days rather than pixels;
                                      a window, and a plan's shadow run
                    planTemplate      what a new plan's body starts as
                    ui/RoadmapPage    the axis, the bands, the findings
                    ui/PlanPage       one plan: its facts, its interfaces, its
                                      document (ADR-0010)
                    ui/ReplaceDialog  the three inputs a replacement needs
src/business/     The business layer, and the arithmetic over its four trees
                  (ADR-0012 §4). Laid out, never dragged — so it is pure.
                    tree              children, depth, siblings in order, and the
                                      parent that would make a loop, refused
                    coverage          per function: supported, manual, uncovered
                    lanes             a journey's phases, and per lane the fork,
                                      the join and the phases it passes through
                    sheet · sheetDiagram   the laid-out page — rail, journey,
                                      areas, unmapped — and what a new one
                                      starts out showing
                    map               the enterprise map: functions against
                                      the applications the rows name, rolled
                                      up on the sections, the gap on the leaves
                    ui/               SheetPage, MapPage, FunctionInspector,
                                      captureSheet
src/technology/   The physical view (ADR-0013, ADR-0014): a platform's report
                  and a service's. Read, never drawn; the arithmetic is the
                  model's, because the agent asks for it too.
                    ui/ReportPage     one page drawn twice, a configuration
                                      each: PlatformReportPage — what runs on
                                      it, what uses it, and the container
                                      interfaces that cross it — and
                                      ServiceReportPage — who maintains it,
                                      what realises it, who leans on it, and
                                      what would be stranded
                    ui/TechnologyLandscapePage   the layer's one view (ADR-0015):
                                      applications, services, platforms, no lines
                                      at rest
src/search/       One search over elements, documentation and decisions; ⌘K, ⌘F.
                    searchIndex       the haystack, folded once per model
src/agent/        An agent as a peer of the menu (ADR-0007). Pure; the first
                  module that exists for a client that is not a person.
                    tools             the vocabulary: names, schemas, refusals — a
                                      protocol contract, English, outside i18n
                    answer · commandFor   the read tier over the model, and a write
                                      as one Command through the session
                    write/            one builder per tool, by family, and the
                                      table commandFor looks a tool up in —
                                      typed, so a tool without one does not compile
                    inspect           the layout report, in geometry not pixels
                    handle · renderer   one request in, one answer out; the four
                                      things only the canvas can do, as a view
                    mcpProtocol       the streamable-HTTP protocol the agent's
                                      server speaks, by hand: a request in, the
                                      framing out. No Electron, so it is tested
                                      in node beside the tools it carries
                    screen · shell · driving   the app as a screen and a
                                      destination, moving it, and the session
                                      the person can stop (ADR-0019)
src/i18n/         The registry. Each module owns `strings/en.ts` + `strings/nl.ts`;
                  `strings.en.ts` composes them and is the schema.
                    registerStrings   words a build composed from this one brought,
                                      kept beside the schema and never merged into
                                      it: keys added, none replaced (ADR-0022)
                    interpolate       `{placeholders}` and `translateFrom`: the
                                      pieces of this that need no table — so a
                                      caller with a slice of its own reads it
                                      without importing every module's words
                    languages         which languages there are, with no words in
                                      them, for a caller that only has to
                                      recognise a code; `strings.ts` holds the
                                      list and the tables together
src/projects/     A scope: open, save, order, summarise, address, remember.
                    technologyRegister   every service and platform in the tree,
                                      derived from the index (ADR-0014 §2.6) —
                                      here rather than beside the page it draws,
                                      so a process with no screen answers
                                      `technology.list` from the same fold
                    scope             the document every level is (ADR-0012 §1),
                                      and the arithmetic over a tree of them
                    scopeIndex        who owns an id and who else draws it, over
                                      the whole tree (ADR-0012 §2). `index.ts` is
                                      the barrel, so the index is named for what
                                      it is
                    checks            what the tree contradicts about itself, as
                                      values with keys — never a refusal (§9)
                    mayEdit           what one scope may change about one record;
                                      the owner's detail refused as a value (§10)
                    gestures          link · promote · demote · transfer, as an
                                      ordered plan and a refusal with a key (§10)
                    readdress         a ref is an address, and a move carries the
                                      ones pointing into it (§3)
                    library           the register used as a library: drawing an
                                      application another scope defines is a
                                      stand-in, never a claim; one nobody defines
                                      is a question (§2, §3)
                    scopePath · scopeLabel   the address, and what to call the
                                      organisation a scope sits in
                    links             the one rule about what may become an anchor
                    folderFormat      a scope as files (ADR-0003); adrFile ·
                                      transitionFile · fileText
                    migrate3to4 · migrate4to5   the last readers of the two
                                      formats before this one (ADR-0012 §11)
                    workingFile       the .lvarch container: v5 is the folder, zipped
                    historyPath       where one thing is filed, for its history —
                                      and, for an element's page, everywhere in
                                      the tree it is filed (§7)
                    documentSession   dirty / saving / changed on disk / conflict
                    commitMessage     what a snapshot is called, drafted from the
                                      log — `translateFrom(table)` and an English
                                      drafter beside it, so a process with no
                                      screen drafts without the registry
                    migration         out of browser storage into the folder, and
                                      out of an older format into this one
src/platform/     What the app runs inside, and what a failure looks like.
                    errors            ShellError: a refusal as a key, never a sentence
                    diagnostics       what a failure entry is, and how a trail reads
                    logFile           what the desktop log is called, and when it rolls
                    windowChrome      how much of the top bar is the window's
                    hostCommands · menu   what a menu or an OS may ask for, and
                                      the File and View items said once as data
                    theme · workingSource · updateSettings · sync   facts two
                                      processes share (ADR-0005)
                    scopeHeader · windowTitle   what a scope's header file is
                                      called and what it is called on screen —
                                      the two things main reads about a folder
                    updates           is this newer, which file is mine — the
                                      desktop's update check, without its fetch
                    agentServer       the server's three states, and mcp.json's shape
                    sourceProvider    a kind of place work is kept, as something
                                      that can be registered: what it opens to
                                      — from its own opening and from what the
                                      shell hands over, and it may take its
                                      time about it — its way in (a label, the
                                      provider's own dialog, and an address a
                                      link may carry), the sentence it gives for
                                      where work is kept, and what it means by
                                      the five words the bar says (ADR-0022)
                    desktopHook       what a build composed from this one may ask
                                      of the main process: somewhere to answer the
                                      renderer, somewhere to keep a small secret,
                                      the origins the page may reach, and the
                                      `hook:` prefix both sides name
                    node/             the one folder in `src/` that may say
                                      `node:`, its own row in the matrix and on
                                      no barrel, imported by no module at all
                      node/git        a folder's history through the machine's
                                      own git (ADR-0003 layer two, ADR-0005's
                                      remote): snapshots, the log, a label, the
                                      files at one, and `.git/info/exclude` —
                                      `electron/main` was its first caller and
                                      is no longer its only one
src/widgets/      Presentation with no opinions: icons, one confirm dialog, and
                  a laid-out page rasterised (`capturePage`).
src/ports/        The seams. Interfaces only, no implementations.
                    DirectoryHandle   as little of a folder as the folder store
                                      asks for — the shape a browser's handle,
                                      the desktop's over IPC and the suites'
                                      fake are all held to (re-exported by
                                      `adapters/fileSystem/`, so nothing moved)
                    ScopeStore        …and `models?()`, the tree's `model.json`
                                      files and nothing else — what the index is
                                      built from, one file per scope
                    PreferencesStore · DocumentGateway
                    ProjectHistory · Diagnostics · HostControls
                    FolderSettings · UpdateSettings   the two other scopes
                    AgentGateway      where an agent's calls arrive, and the switch
                    CommandChannel    where a step goes when this session is not
                                      the only author of a scope (ADR-0022): one
                                      scope, one order, a sequenced step back
                    ScopeStore.contract.ts · CommandChannel.contract.ts —
                                      behaviour every filling must show. Makers
                                      may be async and the channel suite settles
                                      after every subscribe and publish, so a
                                      filling that answers over a network passes
                                      the same clauses an in-memory one does
src/adapters/     The outside world, one folder per flavour.
                    webStorage/ · memory/ · browser/ · fileSystem/ · desktop/
                    memory/           …and InMemoryCommandChannel: a head model, a
                                      bounded log and the subscribers, for two
                                      sessions put in one order without a process
                    desktop/          the Electron file channel, as a folder handle
src/app/          The shell around the editor.
                    main.tsx          composition root. Read its header first.
                    composition.ts    which adapter, which icon packs, and which
                                      source providers (ADR-0022) — with
                                      `openSource`, `SourceBase`,
                                      `registeredConnects`, `registeredMenus`
                                      and `sourceChip` for whoever composes
                                      over this one
                    rebase            a run off the model and back on, pure —
                                      no React, no stack, no policy; the unit
                                      is the **fold**, one announcement's worth
                                      of a step, because a step that coalesces
                                      is answered for one fold at a time
                    App · ProjectWorkspace · ShellToolbar · SaveMenu · ToastBar
                    organisation/     the first screen: the root scope's home.
                                      OrganisationScreen · OrganisationCards ·
                                      ScopeTree · useOrganisation · the four
                                      dialogs every screen asks a scope about
                                      register · RegisterPage   every application
                                      in the tree, derived (ADR-0012 §2); a page
                                      here rather than under `projects/ui/`,
                                      which may not import React
                                      and TechnologyPage beside it, one page
                                      drawn with a configuration each: every
                                      service and platform in the tree, the
                                      same fold over the same index
                                      (ADR-0014) — the fold itself is
                                      `projects/technologyRegister`
                    useGestures · dialogs/MoveRecordDialog   the four gestures
                                      applied: the other scope first, the
                                      confirm, and the barrier on the stack (§10)
                    carryRefs         the pass a move makes over the refs
                                      pointing into it (§3)
                    useLibrary · dialogs/AddFromLibraryDialog   the palette's
                                      *Existing application…*: the picker over
                                      the register, and the one question it asks
                    dialogs/ · examples/ · iconPacks/ · history/
                    OverflowMenu      the menu, on a host that has no menu bar —
                                      and the section a source provider's own
                                      lines are drawn in, after all of ours
                    SyncNotice · useSync   the folder and its remote disagree
                    useAgentGateway · dialogs/ConnectAgentDialog   the seam bound
                                      to the session, and the way in for a person
                    testing/          renderShell / renderApp: the shared harness
                    use*              the hooks: session, files, document, toasts
                    usePlans          the roadmap, a plan and Replace…, wired
electron/         The desktop main process and preload.
                    files.ts · fileStore.ts · watch.ts   the file channel — and
                                      the caller of `platform/node/git`, which
                                      had no Electron in it and is not here
                    appMenu.ts        the File menu; every item sends a command
                    preload/index.ts  the doorway: the typed channels, and the one
                                      generic door for a hook's own (`invokeHook`)
                    mcp.ts · mcpServer.ts   the agent server: the kept port and
                                      token, the loopback listener; the protocol
                                      itself is `src/agent/mcpProtocol.ts`
                    desktopHooks.ts · secrets.ts   the hooks a build composed from
                                      this one registered, run where main
                                      registers its own channels; a secret in
                                      `userData` at mode 0600
                    csp.ts            the renderer's Content-Security-Policy,
                                      assembled per document: a list of origins
                                      in, one header out, and everything that is
                                      not an origin dropped
```

**Components declare the interface they need**, not the widest one available.
`useDocumentSession` asks for `{ save(scope), load?(path) }`, not for a
`ScopeStore`, so it cannot reach `list()` or `remove()` and a reader does not
have to check whether it did. `DocumentationPage` asks for one `updateElement`, not the editor's whole
action set. The concrete implementations satisfy those shapes structurally, so
narrowing costs nothing: no wrappers, just a smaller type.

**Who may import whom is a matrix**, declared as data at the top of
`eslint.config.js` and generated into one rule per module, each with its own
sentence. `model` is the bottom and knows nobody; `app` is the top and knows
everyone; nobody imports `app`, and nobody but `app/composition.ts` imports
`adapters`. `model`, `layout`, `platform`, `ports`, `projects`, `i18n` and
`agent` may not import React, MUI, Emotion or React Flow at all — nor a `ui/`
file, nor the barrel of a module that re-exports one, which is the same rule one
step out: `agent/commandFor.ts` said `from '../business'` for six pure functions
and got three dialogs with them. Those modules name the file they want.
`src/agent/pure.test.ts` walks the chain that has to stay loadable by node, and
is what catches a barrel that grows a page after the list in the config was
written. If a rule blocks you, the design is telling you something; move the
code, don't route around the rule.

Three rows are worth knowing because they are not obvious. `editor` may not import
`decisions` or `projects` — a canvas that knows what a project is cannot be
mounted in a test with two plain objects. `documentation` may not import
`editor`, which is why the documentation page takes its inspector as a
`renderInspector` slot. And `agent` may not import `editor`, `projects`,
`ports` or `app`: the four things only the canvas can do reach it as a
`RendererView` the workspace fills over the editor's handle, so the whole
module is tested in node with a plain object in that slot.

And one row is a folder inside a module: **`platform/node/` is the only place in
`src/` that may say `node:`**, and no module may import it — not even `app`,
which may import everything else. It is where code moves when it turns out to be
pure node rather than Electron's (`platform/node/git.ts`, whose caller was
`electron/main` and is now also a build composed from this one that keeps a
folder in a node process). Nothing puts it on a barrel, the way
`agent/mcpProtocol.ts` is kept off one: a renderer bundle that reaches
`node:child_process` fails at its first import, and a barrel is what would take
it there.

### Where does my change go?

| It is… | Put it in | Test it in |
|---|---|---|
| what a landscape is, or arithmetic over it | `src/model/` | node, no mocks needed |
| where something ends up on the board | `src/layout/` | node |
| talking to a browser/OS/network API | `src/adapters/<flavour>/` | its own suite |
| a new kind of place to keep things | new adapter + a `registerSourceProvider` in `composition.ts` | the contract |
| inside the canvas/palette/inspector | `src/editor/` | jsdom (`// @vitest-environment jsdom`) |
| a screen that is not the canvas | that module's `ui/` | jsdom |
| the shell around it all | `src/app/` | jsdom |

If you find yourself writing `localStorage`, `fetch`, `FileReader` or
`document.` anywhere outside `src/adapters/`, stop: that belongs behind a port.

## Decisions (ADRs)

**One list, one shape** (`decisions/adr.ts` for the rules, `model/adr.ts` for
the record). A scope's records live on its own `model.decisions`, and each is
about whatever its **`subjectId`** names — any element the scope knows, or, with
none, the scope itself (ADR-0012 §7). That field was `applicationId` while an
application was the only thing a record could be about; `projects/adrFile.ts`
reads the old spelling and writes only the new one, and **format 6 drops the
alias**. The agent takes `subjectId` and accepts `applicationId` for one beta,
which `agent/tools.ts` says out loud.

The scopes **above** this one have lists of their own, read up the tree and
shown on the page as a *From <ancestor>* section each — **read-only there**,
because a record is edited where it lives, which is the same rule `mayEdit`
applies to an element. There is no "group" list and no `groupDecisions`.

The body is MADR markdown; title, status, date and signers are fields. The
status is a state machine — proposed → reviewing → accepted | rejected,
accepted → superseded (with the successor's id) — and the three end states lock
the record: `updateAdr` and `removeAdr` refuse them. Numbers are per scope's
list and never reused. A record is one markdown file with front matter
(`projects/adrFile.ts`), and a record about one element goes in a folder of its
own because numbers are per list.

## Scopes

There is no customer compiled into this app, and no "shipped document". **Every
scope is the same document, nested, and the ref is the path** (ADR-0012 §1). A
folder holding a `scope.json` is a scope; the folders inside it that hold one
are the scopes under it. The root is the organisation — by position, because it
is the root, and not by anything written in it:

```
<working directory>/            scope.json  model.json  diagrams/  docs/  …
  acme/                         a domain: the same files
    rail/                       a domain under that: the same files again
      rolling-stock/            a landscape: the same files again
  .lionsville-architecture/     settings only (ADR-0005); never a scope
```

In a browser tab, which has no folder, the same paths are keys — and the root's
key is the bare prefix, because a tab has one working tree:

```
lvarch.scope.
lvarch.scope.acme/rail/rolling-stock
```

What a scope IS — `organisation | domain | programme | team | landscape` — is a
**label** in its `scope.json` for a screen to show. Nothing branches on it and
nothing may start to: the moment code asks "is this a domain" instead of "does
this scope hold a view", a folder that says the wrong word about itself stops
working, and a folder saying the wrong word about itself is a person's business
and not a fault. A scope with no views is a domain; it reads, and the shell
declines to *enter* it because the canvas has nothing to show
(`isOpenableScope`).

**Reserved names.** A child scope may not be called `diagrams`, `docs`,
`decisions`, `transitions`, `observations`, `images` or `logos` — a folder cannot be both. The
rule is in `scopePath.ts` and is refused at the dialog, not suffixed quietly.

**A name has one home.** `model.name` is what the scope is called, and
`scope.json` holds it; the organisation's name used to ride on every project in
a group as `model.customerName`, which is why renaming a group was a sweep that
could half-finish. `projects/scopeLabel.ts` walks up the tree for the name the
bar shows and the client a title block prints — the nearest answer wins, and a
scope never shows its own name as its organisation.

A rename edits the model and leaves the path alone; a **move** changes the path,
so it is save-then-remove in that order — removing first and then failing to
save would lose the scope. **Creating a scope creates the ones above it** that
are not there: a folder with no `scope.json` is not a scope, and a child filed
under one would be filed under nothing.

On boot the app reopens the scope you had open (a preference, `lastScope`), or
shows the **organisation screen** (`src/app/organisation/`) — the root scope's
home, not a list of documents: its name, client, links and description; its own
four pages as cards with a count and a finding line each; the tree beneath it;
the examples last. The root is never a row in its own tree, because it is the
screen. Counts on the cards come from **one** `load(root)` — a listing carries a
view count and nothing else (`ScopeSummary`), and a load per card is the shape
ADR-0004 keeps catching.

**Every scope has this home**, not only the root: a domain's shows its own
cards and the tree filed under it, a landscape's shows its documentation, its
decisions and its plans as cards and **its boards as a table**, one row each
with its own *Open* (so a future version is a row beside the current one), and
which cards is decided by shape (`level` in `OrganisationScreen`) — never by
the label. The bar over an
open scope is a **breadcrumb** (`crumbsFor`, `Crumbs` in `ShellToolbar`):
every scope above, root first, each a way to that scope's home, and the open
one in bold; the *Projects…* button and the source chip left it — the source
is a fact about the folder and is said on the root's home only. Which home is
up is the shell's state (`home` in `App`), beside which scope is open.

A card opens the scope **on a page** (`InitialPage`), because the root usually
draws nothing at all; closing that page comes back to that scope's home rather
than landing on an empty canvas. The register card is drawn and deliberately empty: it is
derived over the whole tree and arrives in beta 3.

The tree lists **alphabetically by default**, with recency as a toggle
(`sortScopes`, persisted as `projectOrder`); a scope with children folds shut,
per session rather than as a preference. Examples live in `src/app/examples/`
and are **copied** into scopes of your own — into an unnamed, empty root the
example *becomes* the organisation; into a root that is already something it is
filed under a child of its own (`copyExampleInto`).

## Adding a storage backend (the worked example)

The point of the seams. Say you want to save to disk via the File System Access
API. You write one file, run one suite, change one line:

```ts
// src/adapters/fileSystem/FileSystemScopeStore.ts
export class FileSystemScopeStore implements ScopeStore { /* … */ }
```

```ts
// src/adapters/fileSystem/FileSystemScopeStore.test.ts
describeScopeStore('schijf', () => new FileSystemScopeStore(fakeHandle()))
```

`describeScopeStore` (in `src/ports/ScopeStore.contract.ts`) is the shared
behaviour suite: the root exists on an empty store and can be saved, a child is
listed under its parent, a nested scope is kept apart from it, a reserved name
is refused, a scope with no views still loads, a save-then-remove move keeps the
children, `updatedAt` is stamped, a path that could escape the folder is
refused, and a scope survives a round trip unchanged. Passing it is the whole
admission test. Then one `registerSourceProvider` in `composition.ts` — a kind,
what opening it gives the shell (from its own opening and from the `SourceBase`
the shell hands over, and it may answer a promise), and what it means by the
words on the bar (ADR-0022). **Nothing above the seam changes** — not `main.tsx`, not a
component, not a test.

The same holds for `PreferencesStore`, `DocumentGateway` and `CommandChannel`,
whose contract is `ports/CommandChannel.contract.ts`.

## Conventions

- **Comments, identifiers and test names are English**, everywhere, including
  the shell. Write in the register the rest of the code uses: say why a decision
  was made, not what the line does, and match the density of the file you are in.
  Dutch survives only where it is domain data (a design's own content, a
  diacritics fixture) or a value already written into saved files.
- **UI strings are never inline, and every module owns its own.** A module keeps
  `strings/en.ts` (`as const`, the schema for its keys) and `strings/nl.ts`
  (typed from it, so a missing translation is a compile error where the word
  lives). `i18n/strings.en.ts` composes the slices; that file and its Dutch twin
  are the only ones that name every module. Adding a language is a new
  `strings/<lang>.ts` per module plus one line in `TABLES`. `strings.test.ts`
  loops over every registered language for completeness, empty values,
  placeholders and "was it actually translated", and over the slices for keys
  lost, keys nobody owns, and two modules claiming the same key.
- **A module does not name another module's key.** `common.` is the exception —
  shared vocabulary — and so is a refusal key that is part of a published type
  (`KindChangeRefusal`). Anything else means publishing a table, the way
  `decisions` publishes `STATUS_LABEL` and `SCOPE_LABEL`.
- Every pure function gets a unit test. Every port gets a contract or a suite.
- `readOnly` must hide every mutating affordance you add.
- Anything that covers the whole window (a fullscreen dialog) must take
  `windowChrome` and apply it to its top bar — the inset for the macOS traffic
  lights, `-webkit-app-region: drag` on the bar and `no-drag` on its controls.
  Electron computes drag regions from geometry, not from what is painted on
  top, so the shell toolbar's drag strip stays live under a dialog and swallows
  every click on the controls placed there. `DocumentationPage` and `AdrPage`
  are the examples; both pin it in a test.
- Both MUI themes must keep working; no hard-coded hex outside `theme/`.
- Keep existing tests green. If a test pins behaviour you are deliberately
  changing, flip it in the same change and say so.
- Errors from the pure modules and the adapters carry a **key**
  (`shell.logoTooBig`), never a sentence — they are `ShellError`s
  (`platform/errors.ts`), and `app/messageFor.ts` is the one place that turns a
  key into words. A refusal that is part of a function's
  ordinary answer stays a returned value (`openProjectDocument`).
- **A failure has somewhere to go.** Report it through the `Diagnostics` seam
  before you draw anything about it; every `void promise` needs a rejection
  handler or a comment saying why not. Never toast a success you did not wait
  for. Log messages and keys, never model content — the desktop writes the
  trail to a file the user is invited to hand over.
- **A page's wiring is a hook, not a stretch of the workspace.** What a page
  may do, which of its screens is up, and where a person lands on leaving it
  live in one `use*` hook with a test of its own (`useProjectHistory`,
  `usePlans`); `ProjectWorkspace` composes them and renders. A page added as
  three `useState`s and two `useMemo`s in the workspace is the pattern this
  exists to stop.
- **The desktop main process reads `platform`, and little else.** Arithmetic
  main needs — the update check, a setting's shape — lives there so it is
  written once and tested in node. Main also names the IPC channel's types in
  `adapters/desktop/channel` and one path constant in `projects`; it never
  imports `app`, which the matrix cannot see from `electron/`, so this line
  has to.
- **Component tests go through `ui/testing/renderShell.tsx`.** It supplies the
  theme and the language, and checks on every render that the theme reached the
  tree — which is how a doubled Emotion gets caught by every test rather than by
  one.

## Names, decided

Settled 5 September 2026. Do not invent alternatives, and do not carry a name
forward from an older document — the customer-specific file extension, storage
prefix, example filename and window title are all dead, and are deliberately not
written down here. This repository is public; a list of a customer's old
identifiers is still a list of a customer's identifiers.

| Thing | Value |
|---|---|
| Product name | **Lionsville Architect** |
| Short name (menus, window title, tight spaces) | **Lionsville Architect** — one name, short enough for all of them |
| Desktop `userData` folder | `Lionsville Architecture Management Tool` — **frozen** at the name the product had when those folders were made, so a rename does not move everybody's preferences (`platform/userData.ts`, pinned in `electron/main/index.ts`) |
| Working-file extension | **`.lvarch`** — the working set (ADR-0018), **sealed** under a password (ADR-0023): `projects/sealedFile.ts`, `lvarch-sealed` magic, AES-256-GCM under PBKDF2-SHA256; asked twice on saving a copy, once on opening, from the workspace and from every home |
| Working-file discriminator (in `scope.json`) | `lionsville-architecture` |
| npm package name | `lionsville-architecture-management-tool` |
| Desktop bundle id | `nl.lionsville.architecture` |
| Working-directory layout | `<scope>/scope.json`, nested as deep as the work needs |
| Folder settings (ADR-0005, amended by ADR-0023) | what this machine does about a folder: `<userData>/folder-settings.json`, keyed by the folder's path (`platform/node/machineFolderSettings.ts`), over `DesktopSettings.readFolderLocal` · `writeFolderLocal`; `<root>/.lionsville-architecture/local.json` is read where an older build left it and never written by the desktop, `folder.json` beside it read for the legacy `organisation` key and never written by anybody. A browser tab or the hosted plugin still keeps the machine file in the folder it serves |
| Browser storage prefix (the fallback) | `lvarch.scope.<path>`; the root is the bare prefix |
| Preferences key | `lvarch.preferences`; the scope you had open is `lastScope` |
| Agent server settings (ADR-0007) | `mcp.json` in `userData`, mode 0600: `enabled`, the kept `port` and `token` |
| Agent endpoint | `http://127.0.0.1:<port>/mcp`, bearer token, streamable HTTP |
| Agent tools, read | `project.current` `elements.list` `element.describe` `connections.list` `diagrams.list` `decisions.list` `decision.read` `search` `activity.list` `images.list` `project.export` `platform.report` `service.report` — and, over the whole tree, `scopes.list` `views.list` `register.list` `technology.list` `checks.list` |
| Agent tools, drive (ADR-0019) | `app.current` `app.open` `session.start` `session.end` — where the app is (a **screen**: the open scope, its view, the page over it, or the home that is up), moving it to a **destination** (`scope` · `page` · `id`, the same three words an `InitialPage` says), and the **driving session** the banner shows and the person's Stop ends; a driving call after a Stop is refused `agent.stopped` until `session.start` |
| Every tool | takes `scope`, a path; a read over another scope is answered from its document, anything that needs a session is refused `agent.scopeNotOpen` — and with nothing open at all, `agent.noProject`, whose sentence says to call `app.open` |
| Agent tools, write | `element.add` `element.update` `element.remove` `connect` `connection.update` `connection.remove` `connections.update` `connections.remove` `interface.accept` `relation.add` `relation.update` `relation.remove` `technology.use` `decision.propose` `decision.update` `decision.transition` `decision.remove` `diagram.create` `diagram.update` `image.upload` `batch` `undo` `project.save` |
| What a row between two elements is (ADR-0012 §5, ADR-0013, ADR-0014) | a **relation**: `flow` · `supports` · `serves` · `realises` · `assigned` · `uses` · `hostedOn`; `connect` / `connection.*` are the `flow` ones. A platform `realises` a service, an application or a container `uses` a service (or binds to one platform), an actor is `assigned` a service or a platform; `hostedOn` is application \| component → platform and nothing else — a platform inside a platform is `parentId` |
| What a thing IS (ADR-0012 §4, ADR-0013, ADR-0014) | a **kind**: `actor` · `step` · `function` · `process` · `application` · `component` · `platform` · `platformService`; a platform carries a `platformArchetype` (`place` · `service` · `network`, `service` when unsaid), a service may be `shared` |
| Where an interface arrives (ADR-0013) | a container-level flow **`refines`** the application-level one it is part of — ends under ends, one level deep. The landscape draws the interface, the container diagram draws the landings and no line to the boundary for one that has landed; `protocol` and `technology` live on the landing |
| Where something runs (ADR-0013) | a **container** is `hostedOn` a platform; an application says so itself only when it has no containers, and its answer otherwise is the **roll-up** over them |
| What an application leverages (ADR-0014) | derived, never stored: the services it `uses`, itself or through its containers, and the platforms that `realise` each — `model/leverage.ts`; the record's *Leverages* line and `element.describe`'s `leverages` |
| Offered beyond its team (ADR-0014) | `shared` on a service, typed and left as typed; where nobody typed it, a service `assigned` to one actor and used by another team's application is `check.offeredNotShared`, a finding and never a value |
| What a decision is about (ADR-0012 §7) | `subjectId` — any element the scope knows, or the scope itself; `decisions.list` and `decision.propose` take it, and `applicationId` is accepted as an alias for one beta |
| The four gestures that cross scopes (ADR-0012 §10) | *link* · *promote* · *demote* · *transfer*; the other scope is written first, and three of them leave a **barrier** the stack will not undo past |
| Where work is kept, as something that can be registered (ADR-0022) | a **source provider**: a `kind`, an `open` that builds the parts of a shell from whatever that kind needs to be given, a way in for a person as a label rather than a screen, and what it means by the five words the bar says — with `onSourceWork` to say *ask me again*, for an answer that moved without the document's own machine moving. A folder, this browser's storage and memory are three registrations in `composition.ts`, made at module load |
| How a person, or a link, reaches one (ADR-0022, amended) | a **way in**: `connect.labelKey` for what the button says, `connect.open()` for the dialog behind it — the provider's, because what it has to ask for is its business — and `connect.fromLocation(location)` for an address a link carries, read before the first render. The boot draws one button per registered provider on the root's home and on the first-run screen (`registeredConnects`); `openSource(kind, opening, base)` is the one call that opens what a dialog answered. The folder's button is the one that was already there, because choosing a folder is also remembered, adopted into and upgraded |
| What the shell hands a provider at `open` (ADR-0022, amended) | **`SourceBase`**: the `Diagnostics` the app already keeps — the trail "Copy diagnostics" hands over, and never the console — and the `Shell` as it stands *before* this provider's parts are spread over it, so a provider reuses the preferences store, the document gateway and the browser store instead of composing a second set. Required on `openSource`; no shell in one place only, the first compose, whose shell is the one that source is bringing the stores for |
| When a source is only itself after it has asked (ADR-0022, amended) | `open` may answer **a promise**, and the boot waits for it before the first render, so `readOnly` is right at the first paint. A rejection is a source that could not be opened: from an address, the boot's own failure screen with the provider's sentence; from a button, the notice a way in already has. The three that ship answer without waiting, and the two shells `composition.ts` composes itself cannot wait |
| What a provider draws for itself (ADR-0022, amended) | a **chrome**, declared on the registration and listed by `registeredChrome()`: a component the app renders inside its theme and inside the language that is on, beside its own notices and on every screen, in a boundary each — for **every** registered provider and not only the open source's, because the press that opens a source happens while that provider answers for nothing. The one whose kind the working source names is handed that scope's `ScopeSession`, the rest nothing, and every one of them is handed `open(to)` — ADR-0019's `Destination`, bound to what the agent's `app.open` moves the app with, so the scope a notice names is the pressable part of it. A chrome is therefore mounted more than once over a session: it must be idempotent about its own state. For a strip, a badge, a connect dialog of the provider's own; core's three supply none |
| The sentence for where work is kept (ADR-0005, ADR-0022, amended) | `sourceTipKey`: one per built-in kind, and for a registered source the provider's own **`describeKey`** — its key, from its own table — or nothing at all. Nothing rather than a sentence of ours, for the reason the name on the bar is the provider's: a guess about somewhere this shell has never heard of could promise a copy that cannot be made |
| What a provider puts in this shell's own menu (ADR-0022, amended) | **menu lines**: `menu(context)` on the registration, answering `SourceMenuEntry`s — a `key`, a `labelKey` from the provider's own table, what a press means, and `disabled` · `divider` · `href`. Drawn by the `⋯` in a section after every entry of ours, under a rule and never a heading of ours; asked when the menu opens and again on `onSourceWork`, so *Sign in…* becomes a name while it is open. Asked of every registered provider, open or not; the one whose kind the working source names is told that scope's `ScopeSession`, both are told `readOnly` and `open(to)` — the same way to a scope a chrome is given — and a provider whose lines throw costs its own lines and nobody else's. A strip of the provider's own is the alternative, and a second place to look for a command is what one menu exists to stop. Core's three register none |
| What the chip that names a registered source says (ADR-0022, amended) | the provider's **`chip`**: the `label` it goes by now — not the `name` it was opened under, which is decided at the handshake and says nothing about who is signed in — with `tipKey` for the hover, falling through to `describeKey` where it gave none, and `onClick` where there is something to press, which makes it a `button` and not a span, because that bar is the window's drag surface. Re-read on `onSourceWork`, as `statusOf` is. Absent for the three that ship, whose chip is unchanged byte for byte |
| What a refusal where work is kept says (ADR-0022, amended) | the source's own **`sourceFailure`**: a sentence rather than a key, because what is worth saying depends on the cause — and carried with a source's parts rather than declared on the kind, since what a store said no for is a fact about this opening and not about the sort of place it is. `undefined` is *nothing from me about this one*, and then nothing of ours is said either and the latch stays open, because a refusal nobody mentioned must not be followed by *saving works again*. Core's three bring none |
| Whether a way in is drawn where it is about to be (ADR-0022, amended) | `connect.offer(context)`: told the source as it stands and the address the boot read, answering `null` for *not here* and a label for something else to say — so a standing *Connect to…* does not offer a person the place they are already working from. Asked again on `onSourceWork`, afresh per source, and a provider that throws costs its own button the label it asked for. Absent, or `undefined`, leaves `connect.labelKey` exactly as it is, which is what the folder's does |
| What a provider puts inside *Connect an agent* (ADR-0022, amended) | its **`agentPanel`**: a component handed the open scope's `ScopeSession` where there is one, drawn inside the theme and in a boundary of its own — in a tab in place of the sentence about the desktop, on a host under the loopback section rather than over it, because both ways in exist there and hiding one of two true answers is not this shell's call. Asked of the open source's provider alone, unlike a chrome and menu lines, because a panel from a provider answering for nothing is a way in to nowhere. Core's three register none |
| A source somebody else answers for (ADR-0022) | a **registered source**: `kind: 'registered'`, the `provider` that answers for it, the `name` it is called on the bar, the `key` that tells two of the same provider's apart, and `readOnly` where work there is only read — the fact the workspace and the agent both read |
| Where a step goes when a scope has more than one author (ADR-0022) | a **command channel**, per scope: `publish` a `StepEnvelope` (`stepId` · `base` · one command · `at`) and be answered its `seq` or the refusal; `subscribe` from a number for every **sequenced step** — `seq` counts from 1, so **0 is nothing yet**, and `by` is the channel's word about who made it and never the sender's claim; `presence` optional, names only — handed to the shell as `ScopeSession.alsoHere(names)` and said on the bar as *Also here: …*, with no cursors and nothing when the list is empty. What crosses scopes does not come through it. **A reducer refusal is answered first**: a step whose `base` is behind the head and whose command the reducer refuses is answered with the reducer's key, so `command.taken` always means *mint another id*; a channel that decides such a step overlaps a later one refuses with a key of its own, which this repository does not define |
| One scope, open, as whoever answers for its source sees it (ADR-0022) | a **`ScopeSession`**: the `scope`, `steps` (`onChange` · `applyExternal` · `rebase` · `settled`), `dispatch`, `current()` and `indexed()` for the model at this instant, `history()`, `revision()`, and `alsoHere(names)` the other way. Handed over once per mount through `Shell.onScopeSession` and taken back on unmount |
| A step this session did not make (ADR-0022, amended) | an **external step**: `origin: 'remote'`, `by`, and `via` — the client that author made it with, where whoever handed the step over said which, said on the Activity line as *by NAME via CLIENT* and answered by `activity.list` — on the stack, landed with `steps.applyExternal`, named in the Activity list, and stepped over by ⌘Z. `steps.rebase` lifts a run of ours off the model and puts it back around one — named by `stepId` or by `changeId`, and with `steps` for the bodies of what the cap has taken off this stack; `steps.onChange` is how anything outside hears what was done here, **once per announcement**, each under a `changeId` of its own, because a step that coalesces is one step here and one sequenced step per fold out there (`HistoryStep.folds`); `steps.settled` is how the far end says it is done with one, and the log's cap of 200 will not evict a fold nobody has said that about; `command.taken` is what a create on an id another author took is refused with |
| What a build composed from this one may ask of main (ADR-0022, amended) | a **desktop hook**: `registerDesktopHook` at composition, run where main registers its own channels. `ChannelHost` is as much of `ipcMain` as answering a call takes, `SecretStore` is read · write · remove over a file in `userData` at mode 0600, and `origins()` names where the page may reach — folded into `connect-src`, and into `img-src` where that hook said pictures load from there, asked again every time a document's header is built and dropped unless it is `scheme://host[:port]` and nothing more (`electron/main/csp.ts`). Its channels are named `hook:<hook>:<what>` (`HOOK_CHANNEL_PREFIX`) and the page reaches them through the preload's one generic door, `window.desktop.invokeHook` — which opens for that prefix and nothing else. Core registers none |
| Where a working file lands (ADR-0025) | **asked, every time**, after the file is read: *A new folder…* — chosen with the folder picker, written with the file's top scope as its root, occupied folders confirmed separately, and the app moves there — or *Replace “<scope>” here*, what opening always did, with the warning on the button. `landWorkingFile` in `app/workingFileFlows.ts`; `chooseFolderDestination` in the composition; the boot's `onChooseFolderForWorkingFile` |
| Working-folder format | **8** — `SCOPE_FORMAT_VERSION`, and the `.lvarch`'s version with it; 7 is 6 with `observations/` (ADR-0021); 8 is 7 with `observations/solutions/` and `observations/experiments/` (ADR-0026) |
| What one scope's folder holds | `scope.json` · `model.json` · the seven folders below · the scopes filed under it |
| A scope's own folders (and the names a child may not take) | `diagrams` `docs` `decisions` `transitions` `observations` `images` `logos` |
| What a scope says it is | a **label**: `organisation` · `domain` · `programme` · `team` · `landscape` — never a branch |
| What a view's two files are called | `diagrams/<id>.json` (what is on it) and `diagrams/<id>.geometry.json` (where it ended up) |
| The five view kinds (ADR-0012 §6, ADR-0015, ADR-0016) | `layer7` · `container` drawn on a canvas; `sheet` · `map` · `technology` **laid out**, no geometry — the technology landscape is three bands over the layer, no lines at rest. Any of the five is the active view while its tab is chosen: a laid-out one is drawn in the tab through the editor's `pages` slot, and the technology landscape keeps the palette and the inspector docked, so it is authored on. A platform still has a **report**, not a view: derived from the rows, reached from its card, with nothing to create |
| Agent tools, see | `diagram.inspect` `diagram.render` `diagram.tidy` `diagram.route` `focus` `moveBy` `placeNextTo` `element.place` `element.draw` `element.undraw` `group` `ungroup` `align` `distribute` |
| Agent tools, time (ADR-0009, ADR-0010, ADR-0011) | `plans.list` `plan.read` `roadmap.check` `plan.create` `plan.update` `plan.remove` `plan.replace` `plan.port` `plan.unport` `milestone.add` `milestone.update` `milestone.remove` |
| Every mutating tool | takes `ifRevision`; every mutation answers with `revision` (ADR-0011) |
| A plan for changing the landscape | a **transition**, `TR-0001` on screen; flagged `initiative`, it is drawn on the roadmap of every scope above it (ADR-0012 §7) |
| Plans on disk | `transitions/NNNN-<slug>.md`, flat, numbers per project |
| What was seen, and why (ADR-0021) | an **observation**, `OB-0001` on screen, `seen` times, `by` whom (free text), local unless `shared` — then read by every scope above; `archived` when fixed or no longer relevant — kept, out of the analysis, restored the same way; a **cause**, `CA-0001`, `assumed` → `verified`, `explains` observations and shallower causes with a `strength`; a **root cause** is derived: explains something, explained by nothing. Merging is an `absorbed` event on the survivor and a `merged` one on the other; a shared one absorbed above is written on the survivor only |
| What is done about a cause (ADR-0026) | a **solution**, `SO-0001`, `addresses` root causes of its scope with a `strength` — a non-root cause is refused; `idea` → `shaped` → `testing` → `proven` → `adopted`, one step at a time, each forward step behind a gate read off its fields (`solutionGate`), `waived` with a reason the one way past the testing gate; `dropped` with a note and kept as a considered alternative; **implemented** is derived from its plan being `done`. An **experiment**, `EX-0001`, `tests` solutions — each with a `strength` where it is not normal — with a `hypothesis` and ends `confirmed` · `refuted` · `inconclusive`. The questions a record asks without stopping it: `worksAround` · `addsOnly` · `adoptedUnplanned`; the finding: seen again since it was implemented |
| Observations on disk | `observations/NNNN-<slug>.md` and `observations/causes/NNNN-<slug>.md`, flat, numbers per scope; `observations/solutions/NNNN-<slug>.md` and `observations/experiments/NNNN-<slug>.md` beside the causes |
| Agent tools, observations (ADR-0021) | `observations.list` `observation.read` `causes.list` `cause.read` `observation.record` `observation.update` `observation.seen` `observation.archive` `observation.merge` `observation.remove` `cause.add` `cause.update` `cause.link` `cause.unlink` `cause.remove` |
| Agent tools, solutions (ADR-0026) | `solutions.list` `solution.read` `experiments.list` `experiment.read` `solution.propose` `solution.update` `solution.address` `solution.unaddress` `solution.move` `solution.waive` `solution.drop` `solution.restore` `solution.decide` `solution.plan` `solution.remove` `experiment.plan` `experiment.update` `experiment.conclude` `experiment.remove` |
| Pictures a document holds | `images/<file>.png\|.jpg\|.svg\|.webp`, referred to as `../images/<file>` |
| The business-case block | a ```business-case fence; its keys and column order are the format, and stay English |
| Agent resources | `lvarch://<scope path>/element/<id>/description`, `lvarch://<scope path>/decision/<id>`; the organisation's path is empty, and no path on read means the open scope |
| Vendor / copyright | Lionsville Group BV |
| A record that draws what another scope defines (ADR-0012 §3) | a **stand-in**: `ref` present, its `name` and `ref` caches, its `description` the owner's, read from there |
| The scope that answers for an id | the **master**: the deepest definition; one above it is a **declaration** and yields |
| What the tree contradicts about itself (§9) | a **finding**: a value with a `check.` key, never a refusal and never a reason a save fails |
| Shipped example | a fictional organisation, never a real customer's landscape |

One thing deliberately does **not** change:

- **The interchange format is not renamed.** It is an exchange format other
  tools read; its field names are a contract with them, not branding. The same
  goes for `solution-design/v1` inside it, and for `DesignModel`'s field names —
  with the one exception ADR-0012 §5 makes, because the list stopped being what
  it was called: `connections` became **`relations`**, holding a `Relation` per
  row with a `type` on it. The interchange document still says `connections` and
  still holds flows only, and says what it left out; the working format followed
  the model at version 4 and says `relations`.

And one thing deliberately broke, once. Files written under the tool's previous
name are **not** opened: `isWorkingFile` accepts only the
`lionsville-architecture` tag, and `model/hostModel.test.ts` pins the refusal
with its reasoning. The working file was redefined rather than extended, at a
moment when nobody had one worth keeping. Every version since opens: 1 and 2 are
a JSON document, 3, 4 and 5 are a scope's folder in a zip, and 5 is what is
written now. Since format 6 a `.lvarch` is the **working set** — the scope at
the top and every scope filed under it, relative to it (ADR-0018) — and since
ADR-0023 the zip leaves **sealed** under a password and opens with it; a file
from before either still opens as what it was. `docs/decisions/0001`, `0003`,
`0018` and `0023` have the long version.

**2.x may break the file format as often as the model needs**, as long as every
older version opens and migrates (`docs/plan-2.0.0.md`). A 1.x build meeting a
2.x file sees no project in it, which is the honest answer and the same one
`isWorkingFile` gives a file it does not know. No shim is kept for an older
build's sake: a shim exists only until the format that makes it unnecessary is
written, and then the read half of it moves into `projects/migrate3to4.ts` or
`projects/migrate4to5.ts` and the write half goes.

## State of play

`git log` is the ground truth for what is built and when.

The shell was restructured into the layers above and `main.tsx` was reduced to a
composition root (**805 → 137 lines**, most of it the pattern brief). The IO sits
behind ports, the preferences duplication is gone, the editing session and the
file actions are hooks, and the toolbar, menu, dialogs and toast bar are
presentational components with their own props.

Configuration then came out of the code: the hardcoded customer became a group
on a project, the landscape became an example, and the store became
`GROUP > PROJECT`.

Then the editor package was dissolved (`docs/decisions/0001`). 326 files moved
into the modules above in one mechanical commit; the second toolchain, the
alias, the `dedupe` lists and the 720-line half-domain-half-props contract file
went with it. The boundaries that remain are the import matrix, which is data at
the top of `eslint.config.js` rather than prose. Around 600 lines of surface
belonging to the application the editor was carved out of are gone, the string
table is nine slices each owned by the module that says the words, and the rail
icon set is a registered pack rather than a railway vocabulary in the model.

Then a change became a **command** (`docs/decisions/0002`), and that phase is
done. The model is indexed by id in memory with `fromArrays`/`toArrays` at the
file boundary (the file itself does not change, and a byte-for-byte round trip
pins that); `apply(model, command)` is the only writer and returns the command
that undoes what it just did; the session holds one stack over everything, so
⌘Z undoes a diagram rename, a decision's status and a project setting as
readily as a node move. A new element gets the key the file would have given it
at the moment it is drawn.

**The editor holds no copy of the document.** Every action builds a command and
dispatches it at the session, which applies it and hands the model back. What
that removed is the whole reason the machinery existed — two brains holding the
same landscape — so `DiagramContentBatch`, the overlay, the merge, the
reconcile, `applyBatch`, temporary ids, the alias map and the editor's own undo
stack are all gone, about 2,700 lines of them. A run of keystrokes into one
field is one undo step (`fieldEdit`, a `coalesce` key, rather than a draft: the
card on the canvas is drawn from the model, so holding the text back means
watching the name you are typing not appear). The toolbar's **Activity** list
is what the log buys that undo did not — names derived from the commands, at
the moment the step is made and against the model as it was, so a delete can
still say what it deleted.

Worth knowing: the last project is resolved at the edge of the app, before the
first render, so the workspace can start synchronously without a `null` case in
every `useState`. It uses `.then` rather than a top-level `await` because Vite's
target (chrome87/safari14) has none. Switching projects **remounts** the
workspace on purpose — the session's undo stack belongs to one project and must
not leak into another. The editor is remounted (`editorKey`) only when the
document has to be laid out again or its diagram ids change, which is the one
thing `needsRemount` is left deciding.

The desktop app ships: `electron/` holds the main process and preload, the
renderer runs under `app://`, and `.github/workflows/release.yml` builds and
signs all three platforms from a published GitHub release (`docs/release.md` is
the operator's page).

Then a project became **a folder of text files** (`docs/decisions/0003`). It
had been kept in localStorage, which on the desktop meant a leveldb inside
`userData`: invisible, unbacked-up, and a different store again under the dev
origin. Now `<group>/<project>/` holds `project.json`, `model.json`, a
definition and a placement file per diagram, a markdown file per description
and per decision, and the marks as images — so a moved node is one small diff
and a rewritten paragraph is a readable one. The single `.lvarch` stays as the
export container: that folder, zipped, reproducibly — version 3 then, and
version 4 now.

What that took, in the order it was built: the format as pure functions with
the round trip and the byte stability pinned; `FileSystemProjectStore` and
`FileSystemGroupStore` over it, writing only what changed and removing only
what the format itself writes; `documentSession` finally wired, so the toolbar
says dirty / saving / changed on disk / conflict and closing the window with
unsaved work is interrupted; a validated IPC file channel in main, with paths
resolved inside the chosen root and writes made atomic; a folder the user
chooses and the app remembers; the projects in browser storage copied in, once,
deleting nothing; and a watcher, with our own writes filtered out by content so
the app does not interrupt itself.

Then the desktop stopped behaving like a tab in a window. `.lvarch` is
associated with the app and a double click reaches the window that is already
open; there is a File menu whose every item sends a command and decides
nothing; saving a file is a save dialog rather than a download; and a build
with no working directory asks for one instead of listing projects kept inside
the app. The last-project preference is not followed there either — it can only
point somewhere that no longer keeps projects.

Layer two of ADR-0003 followed: **history**, on the git that is already on the
machine (`electron/main/git.ts`, through `execFile`, no library). Snapshot from
the File menu under a message drafted from the command log; History shows what
changed since one, as a **semantic** diff (`model/diff.ts`) — geometry as a
count, because a tidy pass is one sentence and four hundred changed lines.
Everything about it may say no (no git, no repository, no commits, no project at
that snapshot) and none of those may interrupt a save, so the menu offers
nothing rather than failing when pressed.

A browser tab can have a folder too, where Chromium's File System Access API
can give it one: the same store over a directory handle instead of over IPC.
Best effort, and the fallback stays honest — permission to a handle rarely
survives a restart and asking needs a click, so a remembered folder is used
only when the permission is *already* granted and the tab otherwise starts in
browser storage without a word. A tab is offered a folder; only the desktop is
made to choose one.

The smoke run now grants itself a folder and tells the renderer over the same
command the Recent menu uses, then writes a project through the real channel
and reads a file continuously while a large write is in flight — every read one
whole version or the other, which is what a renderer dying mid-save depends on.

Then the tool was measured for the first time (`docs/decisions/0004`). A
generated landscape of a few thousand elements, a budget per operation, and a
`perf` step in the gate — which is how four things that had never been timed
turned out to be wrong. Search folded every description on every keystroke; the
canvas handed every box a new object saying what the old one said, so
`React.memo` had nothing to compare and React Flow re-measured the whole board;
every card re-read its element's page twice per render; and nothing was
virtualised.

Two algorithms now refuse rather than freeze. Tidy runs in a worker, declines a
board over four hundred boxes, and can be cancelled from the button that started
it. Routing keeps the cap it had — and the investigation into making it faster
found that a whole-board pass costs 180 ms and declines all but 39 of 4,333
lines, so the cap, not the clock, is what a large landscape meets.

Then preferences got three scopes and the top bar said where you are
(`docs/decisions/0005`). A setting is written to whatever it is about: language,
theme, project order and the update check follow the person (the last one in
main's own file, over a small `DesktopSettings` channel); what everyone who
opens a folder agrees on was `.lionsville-architecture/folder.json`, not written
until it had a key; and what this machine does about the folder's remote was
`local.json` beside it, unstaged after every snapshot and listed in
`.git/info/exclude` rather than in the user's `.gitignore`. ADR-0023 took the
machine file out of the folder: it is `folder-settings.json` in `userData`
now, keyed by the folder's path, and the folder's own copy is read through
until this install has written and never touched. The File and View
vocabulary is data in `platform/menu.ts`, rendered by the menu bar on the
desktop and by one `⋯` on the web, both sending into one command bus; the Save
menu, Open and the theme glyph left the toolbar, and the bar now opens with
`WorkingSource` — a folder by name, this browser, or nowhere. Git sync runs the
user's own git with prompts disabled: push after a snapshot and pull on open
are per-machine flags, every answer is a value, and a disagreement is a strip
with *take theirs* (ours on a `before-sync/` branch) and *keep ours* (a merge
commit whose tree is ours). `git.test.ts` runs it against a bare remote and
the smoke run against a real local one.

The Updates section then took the release channel (`docs/decisions/0006`):
`stable` is GitHub's `latest`, `beta` is the newest release of any kind, so a
beta is a prerelease published like any release and a beta user still hears
about the stable that follows. One key in main's file, one toggle, one pure
reduction over the release list.

Then an agent became **a peer of the menu** (`docs/decisions/0007`). The
desktop can accept an MCP client on the loopback — off by default, a port and
a bearer token minted when a person turns it on and kept in `mcp.json` until
they turn it off — and every tool call is relayed into the window and
answered against the live session: a read over the indexed model, a write as
one `Command` through the same dispatch a keystroke takes, so it is one undo
step and one Activity line tagged AGENT, and the four things only the canvas
can do through a small handle the editor hands the workspace. `diagram.inspect`
is a layout report in geometry, budgeted; `diagram.render` is a PNG crop with
the transform beside it. The server is hand-written over Node's `http` because
the desktop ships nothing from `node_modules`; the SDK's own client is what
the tests and the smoke run connect with. The way in for a person is a glyph
on the bar with the server's three states and a dialog that explains, switches
and shows the recipe per client with the real port and token filled in.

Then the history became **history a person can use** (`docs/decisions/0008`),
on one property: it only ever grows, and every entry keeps meaning what it
meant. `entries()` takes a scope — a project and the paths one thing is filed
at, which `projects/historyPath.ts` says out loud from the format's own naming,
a decision by its number prefix because its title is in the file name — and
the desktop answers it with one `git log`. The page has a subject picker and
opens prefiltered from a diagram's tab, the documentation page and a decision's
page. A restore is one `Command` (`model/restore.ts`): the commands that make
the thing, or the whole project, what the snapshot held, wrapped in a
`restore` type so the Activity line names it, refused as a value for a locked
decision or an element gone since, and offered a snapshot rather than given
one — so the result is a new commit whose tree equals an old one, and ⌘Z still
works until it is recorded. A label is an annotated tag named from the label's
slug, beside the subject and never instead of it, pushed with `--follow-tags`.
Measuring it found `placement.set` quadratic in its own rows; it is one pass
now.

Then a landscape acquired **time** (`docs/decisions/0009`). Documents came
first: which fence names draw is a table rather than a class name compared
twice, a picture is a file in `images/` referred to the way every markdown file
refers to one (and the renderer draws only what the project holds — an `http`
source in a description is alt text, never a request), and a business case is a
```business-case fence whose input is a readable cash-flow table with the
figures worked out beneath it. That block was designed down from a five-sheet
workbook, two of whose headline numbers were wrong where nobody could see them,
and the tests are written against that workbook's own cash flows.

Then the landscape half. `lifecycle` is still one value, and it can now carry
the dates it passes through; a connection can carry a window; a diagram carries
`asOf` and draws the same single model as it stood on that day, which is how a
future board is made rather than by forking the project. A **transition** is a
plan as a numbered record — `transitions/NNNN-<slug>.md`, a window, milestones,
what it introduces and retires, the decisions it rests on — and unlike a
decision it does not lock when it ends, because work changes and ADR-0008
already keeps what it said last week. `src/roadmap/` draws the axis, the plans
over it and the four things the dates can contradict, with a scrubber that
moves the board behind the page. Two fields that had survived from the
application this editor was carved out of, `DesignParameters` and a diagram's
cost estimate, were read by nothing and went.

Then a replacement became **one gesture** (`docs/decisions/0010`). The
first use of ADR-0009 for the thing it was written for took six steps and a
text editor, so *Replace…* on an application now asks for three things — what
replaces it, whether it goes or only sheds part of itself, and the two days —
and writes the rest as one transaction: the new application beside the old on
every board, the dates on both, the successor, a tap from old to new for the
shadow run, and the plan with its milestones and a body to put the business
case in. A plan has a page of its own, and on it the **interfaces**: every
line on what it retires, with where it has moved and when, derived from the
lines themselves (`model/porting.ts`) rather than stored — a moved interface
is a twin on the new end and the original closed the day before, which the
model could already say. A split is the source staying; a merge is more
sources retiring into the same thing. The roadmap takes a window, hatches a
plan's shadow run, and counts its ports; the board draws a dotted *replaces*
arrow under the lifecycle toggle.

Then an agent was given **everything a person can do on a page**
(`docs/decisions/0011`), from the report an agent wrote after the first real
job: a plan is a record it may write, an element's dates and a line's window
are fields like any other, one plan's *port all* leaves what another plan
dated alone (`closedOn`, derived), a decision can be corrected while it is
still being written, a card told to be in a group lands inside the group's
box, and a picture can be added. What only the session knows is the agent's
too: every mutation answers with a `revision` and takes `ifRevision`, the
Activity list is a read, `undo` takes back the agent's own newest steps and
stops at a person's, `project.save` writes now, and `batch` lands several
changes as one step or none.

Then the format turned, for the first time since it existed
(`docs/plan-2.0.0.md`, step 4). The model had been able to say more than the
file could hold since the first step of 2.0.0 — a relation with a type, a view
whose membership is not its geometry, a capability that is not an application —
and each disagreement was a fold with a refusal behind it. **Format 4 is the
file saying what the model says**: `model.json` holds `elements` and
`relations`, `diagrams/<id>.json` holds `members`, `groups` and `lines`, and
`diagrams/<id>.geometry.json` holds numbers. The rule that made it cheap is
written at the top of the plan — 2.x breaks the format as often as the model
needs, as long as every older version opens and migrates — so the three folds
did not disappear, their read halves moved into `projects/migrate3to4.ts`, the
one file that still knows the old spelling. Opening an older folder transforms
it: a snapshot first where there is git, then every project rewritten, and the
superseded placement files leave under the store's own removal rule. Which
projects are old is a question only a store can answer, so `outdated()` joined
`pressure()` as an optional clause on `ProjectStore` — which is also why the
pass needs no preference to remember it has run. The shipped example stopped
being an interchange document and became the folder the format writes, because
the interchange is a contract with other tools and has nowhere to put a plan, a
decision or a business layer.

Older commit messages and code comments refer to numbered roadmap phases. That
file is gone; the numbering shifted once along the way, so read such a reference
as history, not as a plan.

Then the three records became **one** (`docs/plan-2.0.0.md`, step 6). A project
was a `project.json` and a model; a group was a `group.json` and whatever could
be derived from the projects filed under it; the organisation was a key in a
settings file. They differed in what they could hold and in nothing else worth
keeping, and the landscapes this is used on need more levels than two. **Format
5 is one document shape, nested**: a folder holding a `scope.json` is a scope,
the folders inside it that hold one are the scopes under it, and the root is the
organisation by position. `ScopeStore` replaces `ProjectStore` and `GroupStore`
over four adapters and one contract; the ref is a path; and `model.customerName`
— the organisation's name carried on every project in a group — is the root
scope's own name, walked up the tree by `projects/scopeLabel.ts`.

Two things moved as a result and are worth knowing. A folder with **no views
reads**, because it is a domain and refusing it would hide its decisions, its
documents and everything filed under it; whether the canvas can show one is the
shell's question. And a scope's **name is one write**, where a group's rename
was a sweep over its projects that could half-finish and had a message for when
it did.

`projects/migrate4to5.ts` is the last reader of format 4 and the one door every
folder comes through — a 1.x folder goes 3 → 4 → 5. The pass over a whole tree
(`upgradeProjects`) also gives a `scope.json` to the two folders format 4 had
that were not records: a group nobody wrote a `group.json` for, and the root,
whose name was the `organisation` key in `folder.json` — read, and since
ADR-0023 left where it is. A browser tab moves its keys from `lvarch.project.` to
`lvarch.scope.` through the same pass.

Then an id came to mean one thing across the whole organisation
(`docs/plan-2.0.0.md`, steps 8 and 9). Ids were unique per document, so the
same application drawn on two domains' boards was two unrelated elements and an
interface arriving from another domain was a box with a name and no link.
**`projects/scopeIndex.ts` is the price of federation**: every scope's
`model.json`, read at open and again when the watcher fires, indexed by id —
definitions by depth, from which the master, the declarations and a conflict
fall out, and stand-ins by path. `ScopeStore.models?()` is what reads it, one
file per scope and never a description, a view, a decision or a geometry; a
store without it is loaded scope by scope instead, which is slower and not
wrong. The register of §2 is that index filtered to applications — derived,
never committed. ADR-0004's table gained a line for it: twenty scopes of the
large fixture, 7.6 ms against 500.

`Element.ref` is the whole of what a stand-in is, and most of the model needed
nothing for it — the format writes it because the writer spreads the record, a
stand-in's `docs/<id>.md` is its perspective page because that is where a
description is already filed, and `restore` tolerates it because `differing` is
generic over keys. `projects/checks.ts` turns the index's truths into findings
with keys, and `projects/mayEdit.ts` is the one function that says what a scope
may write; the inspectors and the agent's `element.update` both read it, so a
field greyed out on a panel cannot be written from a tool call. Neither
`editor` nor `business` may know a scope tree exists, so each is handed the
fields and the words as props.

The shipped example is two documents now rather than one: the business layer —
the journey, the rail, the areas, the capabilities, the sheet — is the
organisation's, and the applications are the landscape's, which holds a
stand-in of every capability its applications support and of the four people it
draws. **The organisation owns every actor** (§4: "a landscape's actor is a
stand-in of one of them"), because the rail is one tree on the organisation's
own page. Counting what covers a capability therefore crosses scopes:
`coverageOf` and `sheetPage` take a second list of rows, handed in from the
index because `business` sits below `projects` and may not reach for it.

Then the tree became something a person can **change their mind about**
(`docs/plan-2.0.0.md`, steps 10 and 11). A ref is an address, so a move carries
every one pointing into the subtree it moves — the other scopes first, then the
subtree at its new addresses, then the old folder removed, because writing the
subtree first and failing would remove the folder before the rest of the tree
had heard where it went. The **register** is the index filtered to
applications, drawn on a page of its own and counted on the organisation
screen's fourth card; `outside` and `partyId` ride on the index's entry so the
page needs no second read.

The **four gestures** are one pure plan each (`projects/gestures.ts`): an
ordered list of writes and one `Command`, so the order that matters is pinned
by a node test rather than by a sequence of `await`s. *Link* is one scope and
undoes like anything else, which is what makes it the repair for a conflict;
the other three write two scopes, are confirmed first, and leave a **barrier**
on the session's stack — ⌘Z stops there with the reason, and the agent's `undo`
meets the same wall, because only half of such a step is on any stack. A
failure after the other scope was written leaves a duplicate, never a hole.

Two things came out of it that are worth knowing. What a stand-in may carry is
`model/standIn.ts` now, because three places need the same list — the checks
report those fields, `mayEdit` refuses them, and `element.link` drops them. And
the register's *Link…* cannot apply a gesture where it stands: a gesture ends in
a `Command` at the session that holds the scope, so it opens that scope and asks
there, which is what `InitialPage`'s last two variants are for.

The decisions became **one list** as well. `Adr.subjectId` says what a record is
about — any element the scope knows, or the scope itself — and the scopes above
appear as a *From …* section each, read here and edited where they live. The
history followed: an element's page is filed in every scope that holds the id,
so `historyPaths` gained `historyPlaces` beside it and `HistoryScope` became a
list of places, which the desktop adapter flattens into the one `git log` it ran
before.

Then the fourth beta (`docs/plan-2.0.0.md`, steps 12 to 14), cut an hour after
the third. The **enterprise map** is the second laid-out view: every function
against the applications the rows name, grouped under the scope that owns them,
a hollow mark on the sections for the roll-up, people as one column and the gap
as the last — `business/map.ts` is the arithmetic, `MapPage` the table, and the
inspector, the actions and the capture handle are the sheet's. The **agent
reads at every scope**: `scope` on every tool answers a read over another
scope's document, loaded for the call, while a change, a picture or `undo`
addressed elsewhere is refused with `agent.scopeNotOpen`; `scopes.list`,
`register.list` and `checks.list` answer from the index, and the tree reaches
`agent/` as a plain object (`agent/tree.ts`). And a ```bpmn fence is **drawn**,
from the file's own diagram interchange and with no library — `documentation/
bpmn.ts` carries a small XML reader so it is pure and tested in node. ADR-0012
has its *Built* preamble, and the manual is in Frisian and German since the
fifth beta. **2.0.0 is the stable cut of all this**, with the notes over
every beta in its release.

Then the register became a **library** (`projects/library.ts`). A landscape
rarely invents its applications, so the palette's last row on a landscape is
*Existing application…*: a picker over every application in the organisation
that is not on this board. Drawing one another scope defines — beneath, beside
or above — writes this scope a stand-in and nothing else, one command and one
undo step, because drawing is never a claim and taking ownership stays a
gesture with a confirmation. One nobody defines is asked about first: answer
for it here, which is a definition, or draw it only, which is one more
stand-in at the address the others carry (`IndexEntry.cachedRef`). Every
stand-in is then asked **which band**: an external reference, or an
application from another domain on the landscape itself — because **the band
decides the look** now, and a `ref` no longer does (`nodeFigure`): an overview
of the organisation's own applications is a row of application cards with a
*from* note each, not a wall of "external" boxes. A double-click on a stand-in
opens it **where it is defined**, selected (`editor/doubleClick.ts`), rather
than making a container diagram here about somebody else's application; and a
container diagram, which has no tab, is deleted from the boards table on its
scope's home. `seedPlacement` moved into `model/placement.ts` for all this, so
the shell and the palette agree on where a new card lands.

Then the model gained the **physical view** (`docs/decisions/0013`). A
`platform` is the seventh kind — a cluster, a broker, a bus, the tooling,
with a closed `platformCategory` — drawn on a board as the chip the
management band always drew; a container is `hostedOn` one and an application
or a container `uses` others. Only a flow is ever a line on a canvas: eleven
applications hosted on one cluster is eleven rows and no lines, and a
platform on a board is a card.

The first cut of that also carried a `via` on the flow and made a platform's
page a view kind, and both were wrong at the first look on a real landscape —
the preamble on ADR-0013 says why. **An interface lands** instead: a
container-level flow `refines` the application-level one it is part of, ends
under ends and one level deep, and that one field is the whole of it. The
landscape draws one functional line per interface with the label, the
direction and the window; the container diagram draws where it arrives, one
line per landing and none to the boundary for an interface that has landed;
`protocol` and `technology` live on the landing, because that is the level at
which anybody knows them. Container lines nobody has drawn an interface for
**imply** one, which is a finding with an *Accept* rather than a ghost line.
Hosting moved down with it: a container says where it runs and an
application's answer is the **roll-up** over its containers, which the badge,
the retiring-platform finding and the record all read; an application with no
containers still says it itself, because "hosted by the vendor" is the only
sentence anybody can write about a bought service.

The pictures are two, and neither is a new view kind. The **deployment
boxes** are the platforms a container diagram's containers run on, drawn
around them as derived dashed groups nested the way the platforms nest —
Structurizr's deployment diagram over the canvas that exists, never stored
and never dragged. The **overlay** colours the landscape's cards by the
platform of their roll-up or by the worst lifecycle among the platforms they
stand on — LeanIX's picture, with no new geometry and no lines. What is left
of the page is a **report**: one platform, what would be left standing if it
went, and the container interfaces that cross it each with the application
interface it is part of, reached from the platform's card and from the
finding that names it, with nothing to create. The format did not turn: the
fields are additive and ride through format 5; the number turns with the
decision-record change, once.

Then the technology layer gained its **offerings** (`docs/decisions/0014`).
The layer had instances and no offerings: OpenShift existed and *Container
platform* — what a team asks for, what a platform team is accountable for,
what could be delivered by something else next year — did not, and a closed
category was standing in for the catalogue the enterprise should author. So
`platformService` is the eighth kind, on the technology layer with the
platform and never a business function: a tree, dated, a chip in the
management band with a mark of its own. A platform `realises` a service, an
application or a container `uses` a service, an actor is `assigned` either;
`hostedOn` is held to application | component → platform, and a platform
inside a platform is `parentId` and nothing else. The category became a
three-value **archetype** — place, service, network, `service` when unsaid —
because after the offering exists that is the only distinction left for the
model to make, and exactly two readers branch on it.

An application says one thing per question and the rest is computed: which
platforms it depends on is read through the services it uses and what
realises them, never stored, and the record shows it as one line. A service
is **shared** when somebody says so, and where nobody has, the rows still
say: one assigned to one actor and used by another team's application is
`check.offeredNotShared`, a finding rather than a value, because it is a
conversation and not a fact the tool may write. Every reader walks the
platform tree now — the report over everything filed under a platform, the
retiring-platform finding up the chain, the overlay by the outermost platform
the organisation runs — and a stand-in, which carries no `parentId`, is told
the tree by the host off the index. The **technology register** is the same
fold over the same index as the application register, beside it on the
organisation screen and as `technology.list`; the service has a report of
its own, `service.report`, for the question a platform team owns: this is
being withdrawn, who leans on it.

Then the layer got its **picture** (`docs/decisions/0015`). `technology` is
the fifth view kind, laid out like the sheet and the map: three bands — the
applications in a box per scope that answers for them, the services nested
by parent, the platforms nested where the tree nests — read from the rows
every time, with the applications arriving from the rest of the tree's rows
the way the reports take them. It draws **no lines at rest**: the cards
carry counts, hovering previews, clicking pins and dims, *All lines* is the
escape hatch, and above forty applications the domains start folded. Hiding
the service band draws the leverage straight to the platforms, which is
where a service delivered by two platforms turned out to need the hosting
chain to say which — `narrowRealisers`, so the record's *Leverages* line says
the same. The page's capture moved to `widgets/capturePage` on the way,
because rasterising a laid-out page knows nothing about what the page is of.

Then a laid-out view became **a tab** (`docs/decisions/0016`). The sheet,
the map and the technology landscape had been pages over the editor — a
dialog with a back button, the canvas left on whatever board it was on —
and a scope with no board was not openable at all, which is why the
example's platform scope kept a chip board it had no use for. Any view can
be the active one now: the editor takes a `pages.render` slot the
workspace fills, draws what comes back where the canvas would be, and keeps
its palette and inspector docked beside the one view that authors — the
technology landscape, whose palette offers the layer's two kinds, made
with no placement and edited with the inspector every kind has. The three
hooks hold no state of their own any more; which view is up is the
session's. The platform scope's one view is its landscape.

Then the landscape became **where technology use is written**
(`docs/decisions/0020`). A look at a real scope with places and no
offerings found the picture empty for an application that only says where
it runs — hosting lines hid behind a checkbox that was off — and found
that a person could not write a `uses` row at all: the board's connect
gesture writes a flow, the inspector had no picker for it, and the only
writer was the agent. Hosting is a line at rest now, folded on request
into a line that already reaches the same platform; the offerings other
scopes mark shared join the services as a row of their own, dimmed until
something here uses one; and the row is written in three places that are
one step — the inspector's **Uses** picker (this scope first, then the
organisation, a stand-in brought with the tick), a **drop** of an
application card onto a platform or an offering on the landscape (the row
follows the target's archetype), and the agent's `technology.use`. The
board keeps *only a flow is a line*; it gains a door from the record to
the landscape focused on the card, and a third overlay that asks the
reverse question, who stands on this one platform or offering.

Then a source became **a provider**, and a step became something that can
arrive from another author (`docs/decisions/0022`). Where work is kept had been
a closed union with a branch per case in five files above the seam; it is a
registry now — a folder, this browser's storage and memory registered at module
load, `WorkingSource` open to one more case, and a provider saying for itself
what *dirty* means where it keeps things and whether work there may be written
at all, which the workspace and the agent both read instead of assuming.

Beside it, the seam for a second author, which ADR-0002 is the reason is small:
`ports/CommandChannel` and the contract a filling has to pass — one scope, one
order, a sequenced step back, a subscriber told what it missed, a create on an
id somebody else took refused `command.taken` — with an in-memory filling that
passes it and is useful on its own. The session gained three functions that
carry no policy at all: hear what was just done here, land a command another
author made, and lift a run of our own off the model by its inverses while
theirs goes underneath it. A step has a name, ⌘Z steps over what it did not
make, and the Activity list says whose a step was. The bar says *Also here: …*
when it is told who else has the scope open — names, never cursors — and asks
the source again when the source says its own answer has moved. `electron/main`
runs the hooks a build composed from this one registered, and the preload has
one door for their channels: `hook:` and nothing else, which is the one check
in this app that the caller cannot skip. Core registers no provider and fills
no channel: what is here is the place a filling plugs into, the words it plugs
in with, and two whole workspaces over one in-memory channel proving that it
fits.

Then a build composed from core registered a provider and found five places
where the seam stopped short of being one (ADR-0022, *Amended*). A provider's
way in is **reached** now: the boot draws a button per registered provider on
the two screens that ask where work should live, the dialog behind it is the
provider's own (`connect.open`), and `connect.fromLocation` is read before the
first render so a link can carry the address — the folder's button stays the one
that was always there, because choosing a folder is also remembered, adopted
into and upgraded. `openSource` is exported, so nobody restates what travels
with a provider's parts. `DirectoryHandleLike` moved to `ports/`, where the
shape a filling has to show can be read without naming an adapter. `i18n`'s
`registerStrings` makes a provider's own label real — additive, and a key this
app owns is refused. And the session handed over can be asked what the model
says (`current` · `indexed`), because minting an id against what is taken and
telling a conflict from a change that fits are both questions about the model at
the instant a step is made.

Then a build composed from core ran the reducer and the folder format in a node
process with no Electron, filled the command channel over a network, and found
four more (ADR-0022, *Amended* again). The **git module** is
`src/platform/node/git.ts` now: it never had any Electron in it, and
`platform/node/` is the one row in the import matrix for code that may say
`node:` — no module may import it, `app` included, and nothing puts it on a
barrel. The **channel contract** settles after every subscribe and every publish
before it asserts, and all three suites' makers may be async, because a
subscription that is a message in flight is not live when `subscribe` returns;
the in-memory filling passes unchanged, and a second run of the same clauses
over the same channel with every answer put off a turn is what keeps the suite
honest about a transport it cannot see. **Which refusal wins** is written down:
the reducer's, before any staleness a channel decides for itself. And a **commit
message can be drafted from two slices** rather than from the registry
(`translateFrom`, `draftCommitMessageInEnglish`), which a walk of the imports
pins — a process with no screen has no business loading `app/strings` to write
one subject line.

Then the same build drew a screen of its own beside this shell's and opened a
source that cannot say what it is until it has asked somebody, and four more
seams stopped short (ADR-0022, *Amended* a third time). A provider has
**somewhere to draw**: a chrome rendered inside the theme and the language,
beside the app's own notices, in a boundary of its own, and handed the session of
the scope that is open — the alternative was a container on `document.body`,
which is a second app in the same window wearing the wrong colours. `open` is
**handed the shell's own side** as `SourceBase`: the trail the app keeps, because
the console is the one place *Copy diagnostics* cannot reach, and the shell as it
stands before this provider's parts are spread over it, so nobody composes a
second preferences store to replace one store. And `open` **may answer a
promise**, which the boot waits for: `readOnly` decides what the workspace draws
and what an agent is refused, so it has to be right at the first paint rather
than a moment after it, and a handshake that fails says so on the failure screen
the boot already has.

Then that build pressed its own way in, reached its source from the desktop, and
took a step somebody else had made, and four more stopped short (ADR-0022,
*Amended* a fourth time). A chrome is **declared on the registration** and drawn
for every registered provider, open or not (`registeredChrome`), because the
press that opens a source happens while that provider answers for nothing — so
the session is what tells the open one from the rest, and a chrome must be
idempotent about its own state. A **desktop hook may name origins** the page is
allowed to reach, folded into `connect-src`, and into `img-src` where pictures
load from there; the header is assembled per document by `electron/main/csp.ts`,
which drops anything that is not an origin. A step may say **`via`**, the client
its author made it with, and the Activity list says *by NAME via CLIENT* in the
four languages while `activity.list` answers it as a field. And **where work is
kept** is the provider's own sentence for a registered source (`describeKey`) or
nothing at all, because a sentence of ours about somewhere this shell has never
heard of could promise a copy that cannot be made.

Then that build had things for a person to do that are not this shell's, and a
person signed in to it, and two more seams stopped short (ADR-0022, *Amended* a
sixth time). A provider's actions are **lines in the menu** now
(`SourceMenuEntry`): a key from its own table and what a press means, drawn by
the `⋯` in a section after every entry of ours, asked for when the menu opens
and again on the provider's own *ask me again* — because the alternative was a
strip of the provider's own floating over the app, and then a person looking for
what they can do here has two places to look. They are asked of every registered
provider, open or not, and the one whose source is open is the only one told the
session; a provider whose lines throw costs its own lines. And the **chip** that
names a registered source says what its provider calls it at this moment rather
than the name it was opened under — which is decided at the handshake, and says
nothing about who is signed in — with the provider's own sentence on hover and
something the press reaches where it gave one, as a real button, because that bar
is the window's drag surface and the rule that keeps a control clickable in it
names elements rather than handlers. Core's three register neither, and the three
chips this tree has always said are unchanged byte for byte.

Then that build watched its own source say no, offered a way in to the place a
person was already working from, and had an agent reach a landscape that is on
nobody's loopback, and three more seams stopped short (ADR-0022, *Amended* a
seventh time) — each of them a sentence of ours that was wrong rather than
vague. A **refusal** where work is kept is the source's own sentence now
(`sourceFailure`, carried with a source's parts): *this browser could not save
the design* names the wrong place, blames a quota that did not run out and
recommends a working file to somebody whose copy that matters is elsewhere — and
nothing from it says nothing of ours either, because a refusal nobody mentioned
must not be followed by *saving works again*. A **way in** is asked whether it is
worth drawing where it is about to be drawn (`connect.offer`), because a standing
*Connect to…* offers the provider's own open source the place it already is. And
*Connect an agent* takes the open source's own **panel** (`agentPanel`): in a tab
where the sentence about the desktop stood, which is true about the loopback and
beside the point once an agent can arrive some other way, and on a host under
that section rather than over it. Core's three define none of the three. Beside
them and not a seam at all: *Check for Updates…* and the switch behind it are
drawn only where updates are this build's to check (`offersUpdateCheck`), since
an item reaching a release page that is not its own answers a question nobody
asked.
