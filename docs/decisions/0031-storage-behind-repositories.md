# ADR-0031 — Storage behind repositories: the domain speaks no storage language

* Status: accepted, 29 September 2026; implemented, 29 September 2026
* Date: 2026-09-29
* Deciders: Wouter Simons
* Supersedes:
  * ADR-0003, in part. *The seam does not move*: `DirectoryHandleLike` is no
    longer the abstraction the app reads through. *History is layer two* as
    git inside the seam goes too. The folder stays the desktop's own
    implementation.
  * ADR-0008, in part.
    * Q1: filtering history by file path in the adapter.
    * Q2: the revert as a new commit. The *command* that makes the present
      equal a past state stays.
    * Q3: labels as git tags.
  * ADR-0009, in part. Q4 "images are files in the folder", and the
    `../images/` reference inside the model.
  * ADR-0012, in part.
    * Principle 1, "a scope is a folder": a scope has an address and an
      identity.
    * §1's layout as a rule of the domain.
    * §7's history as a union of files.
  * ADR-0022, in part. The amendments that made `ports/DirectoryHandle.ts` and
    the folder store the base other providers fill, `FolderSettings` as a
    port, and the "file channel" for work across scopes.
* Pointers only: ADR-0005, 0007, 0011, 0018, 0021, 0023, 0025 and 0028 each
  describe the folder or git as where things are kept. That stays true of the
  desktop's implementation. Each carries a pointer here.
* Builds on: ADR-0002 (commands as the unit of change), ADR-0022 (a source is
  a provider), ADR-0028 (a command says what it writes)

## Context and Problem Statement

Core's storage seam is a file system:
- **`ScopeStore` runs over `DirectoryHandleLike`,** with `model.json`, `docs/`,
  `images/`, listings and paths.
- **`ProjectHistory`** is git: entries are commits, "what a thing is" is a list
  of file-path patterns, and the port carries pull, push and a remote.
- **`FolderSettings`** reads a folder.
- **The domain holds the folder format.** `projects/folderFormat.ts` sits in
  `projects/`, and the working file, the revision and history subjects are
  built from `FolderFile`s.
- **Images are named by path** inside documents (`../images/x.png`).
- **The React tree carries folder concepts** (`AppFolder`, `WorkingSource`
  `{ kind: 'folder' }`), and the entry point calls folder-specific functions
  of the composition root by name.

That was natural while the only places work was kept were a folder, this
browser's storage and memory. It stops being natural once a provider keeps
work somewhere that is not a file system (ADR-0022). Such a provider has two
choices. It can pretend to be a directory, so that every read the app makes
arrives as listings and file reads it must answer. Or it can bypass the
seam, and then it is no longer a seam. Either way the domain decides how
storage works, because its seam is written in one storage's words.

## Decision Drivers

* **The domain speaks no storage language.** Model, projects, documentation,
  agent, app and UI code name no file, folder, path inside a scope, commit,
  table, URL or query.
* **The domain never knows an adapter.** Implementations are chosen in the
  composition root and handed in. Nothing else names one, and a lint rule and
  an architecture test fail the build if anything does.
* **Contracts fit the richest store, not the simplest.** A repository's
  contract is written for a store that can index, page and answer at the
  level of a record. The folder implementation meets it by doing more work
  itself: walking, parsing, scanning its history. It does not narrow the
  contract to what a folder does easily.
* **The desktop keeps its behaviour.** A folder a person can open, read and
  version with git stays the desktop's way of keeping work, and the working
  file stays a zip of that folder.
* **Every contract has a suite,** as every port does today (ADR-0022), and
  every implementation runs it.

## Considered Options

1. Keep the file-system seam and let other providers emulate a directory.
2. Add record-level members to the existing ports beside the file-level ones.
3. **Repositories in the domain's words**, with the folder, browser storage
   and memory as implementations behind them, and the folder format moved
   into the folder implementation.

## Decision Outcome

Option 3.

**Why not the others.**
- **Option 1** makes every provider pay for the folder's shape and keeps the
  domain deciding storage.
- **Option 2** keeps both languages in the seam. The file-level members
  would keep being used, because they are already there.

### 1. The repositories

Each is a port in `src/ports/`, with a contract suite, and speaks in the
model's types only:

| Repository | What it answers | What it takes |
|---|---|---|
| `ScopeRepository` | The tree of scopes (address, identity, name, kind, parent). A scope's state (its records, documents and image library) with its revision. | Steps to apply, one scope or several together. Create, move and remove a scope. |
| `OrganisationIndex` | The index over every scope, with its revision. What changed since a revision. | — (it follows the steps) |
| `HistoryRepository` | Entries of a scope or of one thing (by record kind and id), paged. The state at an entry. Labels. | A label. A way back is a step through `ScopeRepository`. |
| `ImageRepository` | A scope's image library (file name, media type, size, dimensions, content address). An image's bytes by name, asked for when the image is shown. | An image's bytes and file name, answered with its content address. The step that adds it to the library goes through `ScopeRepository`. |
| `SettingsRepository` | The organisation's and a scope's settings, and the person's own on this install. | Settings to keep. |

A scope has an **address**: its path in the tree, which is how people and
links name it. It also has an **identity**: an id a move does not change. A
**revision** is opaque to the domain. It is only compared for equality.

The existing ports that speak no storage language stay as they are:
`CommandChannel`, `PreferencesStore`, `UpdateSettings`, `HostControls`,
`Diagnostics` and `AgentGateway`. `DirectoryHandle`, `ProjectHistory`,
`FolderSettings` and `ScopeStore` are replaced.

### 2. The folder is an implementation, and so is its format

`folderFormat.ts`, the revision by file fingerprint and the history subjects
by path move into the folder implementation (`adapters/folder/`), with the
File System Access and IPC directory handles under it. The working file
(ADR-0018, 0023) is an **interchange format**: the folder format, zipped.
Its codec lives with the folder implementation, and any source can export
to it and import from it through the repositories.

The folder implementation meets each contract in its own way:
- **State.** It reads and writes `model.json`, `docs/` and `images/` as
  today.
- **History.** It keeps using git: entries are commits, and a thing's history
  is the adapter mapping a record to the paths that hold it. It works harder
  than a store with an index, and that is its cost to carry.
- **Labels** are tags.
- **Pull, push and a remote** are the folder implementation's own capability,
  offered through its provider's chrome (ADR-0022). They are not a member of
  any repository.

Browser storage and memory are implementations too. Each runs the same
suites.

### 3. Images are named by their file name and loaded when shown

**An image is named by its file name,** unique in its scope's image library.
A document refers to it as `![alt](image:diagram.png)`: a name, not a path.
The library may have folders, carried in the name
(`image:diagrams/context.png`). An implementation must list a folder and
find a name without scanning the whole library.

**The library is part of the scope's state.** For each image it holds the
file name, media type, size, width and height, and a content address.
`DocumentImage` keeps no data URL, and the model holds no bytes.

**Loaded when shown.** Rendering lays out every image from the library's
dimensions at once. It asks `ImageRepository` for an image's bytes only when
the image comes into view: on a board, in a document or in a report. So:
- reading a scope never reads a picture;
- scanning a long document loads only the pictures looked at;
- nothing on the page moves when they arrive.

A smaller rendition for a preview is an optimisation an implementation may
offer. It is not part of the contract.

**On disk,** the folder implementation keeps `images/<file name>`, and writes
`../images/<file name>` into the document, so a folder still reads well in
any markdown viewer. It translates both ways, and the domain never sees a
path.

### 4. The composition root is the only place that chooses

`app/composition.ts` builds each source's repositories and hands them to the
app as one value. Folder-specific entry points leave the app's props and
`main.tsx`. Choosing a folder, recent folders and watching a folder become
the folder provider's chrome and "way in" (ADR-0022). `WorkingSource`
names a source and its display name, not a kind of storage.

**The rule, enforced:**
- **No imports across the line.** Nothing outside `adapters/`,
  `platform/node/`, `electron/`, the providers built on them (`providers/`,
  *As built: the app on the repositories*) and the composition root imports
  an implementation, or the folder format.
- **No storage words in logic.** A test fails when app, domain or UI code
  names a storage mechanism in code, and a list of known exceptions only
  shrinks.
- **Strings stay free of storage too.** A person may still be told about
  *their folder* where the folder provider's own chrome speaks.

## Consequences

* **A provider that keeps work in a database, a service or anything else
  implements the repositories directly.** It no longer emulates a directory.
* **The desktop's behaviour does not change.** Its code moves, from `projects/`
  and `app/` into the folder implementation, and it runs the new suites.
* **Every existing folder stays readable as it is.** Documents with
  `../images/` references are read through the folder implementation's
  translation, and written back the same way. No migration touches a
  person's folder.
* **The history contract is answered by git on the desktop.** A thing's
  history on a large folder costs a scan. That is accepted.
* **Scopes gain identities.** The folder implementation keeps a scope's id in
  its `scope.json`, adding one where a folder has none.

## As built, 29 September 2026: the repository contracts

**What was built.** The five repositories of §1 are ports, with nothing
implementing them yet, and the ports they replace are still there:
- `src/ports/ScopeRepository.ts`, `OrganisationIndex.ts`,
  `HistoryRepository.ts`, `ImageRepository.ts` and `SettingsRepository.ts`,
  and `Repositories.ts`, the one value a source hands the app (§4).
- **Their words**, where the domain's pure code can share them:
  - `projects/scopeState.ts`: address, identity, revision, a scope's state,
    the step, and `applySteps`, the one writer every implementation shares.
  - `model/recordKey.ts`: a record by kind and id, and the records that
    differ between two models.
  - `model/imageName.ts`: an image's name, its image folder, the `image:`
    reference, a library entry, and the content address.
  - `projects/settings.ts`: settings, and the patch that changes them.
- **A contract suite per repository**, `src/ports/*Repository.contract.ts` and
  `OrganisationIndex.contract.ts`, all taking one maker
  (`Repositories.contract.ts`). They ran against in-memory repositories
  written for them as test support, which the next record replaced with the
  memory implementation (*As built: browser storage and memory*).
- **The rule** of §4 is `build/storageLine.test.ts`, over the data in
  `build/storageLine.ts`:
  - no imports across the line;
  - no storage words in identifiers, nor in the strings of code: the words,
    and the folder format's own spellings (`.json`, `.md`, `../`, `images/`,
    `docs/`, `.git`). A comment, the words tables, a module name imported, the
    marks' strings, the manual's web address, and *database* and *SQL* in a
    string, which are what a landscape holds, are not read.

  The tree's violations when the rule arrived are its exceptions, each held
  to exactly what its file does: 22 files importing the folder format (32
  imports), 52 naming storage (83 words and spellings), and the 14 files of the
  folder format still in `projects/`, `ports/` and `platform/`. Each list has a
  ceiling held to exactly its length, so it can only shrink, and grows only by
  a ceiling raised where the change shows it. The new seams and their words
  are held to the stricter list of the decision drivers, comments included,
  with no exceptions.

**Where the build departed from the text.**
- **The domain types live in `projects/` and `model/`, not in `ports/`.**
  `applySteps` needs them, and the pure modules may not import a port.
- **Two kinds of step the model does not hold yet.** Adding a picture to the
  library, or taking one out (`image.add`, `image.remove`), and changing what
  a scope says about itself (`scope.describe`: its kind, client, links, first
  view and marks) are steps. They are shaped as the model's commands are,
  with the model's refusals (`command.taken`, `command.gone`,
  `command.notAField`), so they can join the command vocabulary unchanged.
- **What a step touched is read off the state**, before and after, not off
  what its command says it writes (ADR-0028): a delete reaches relations,
  views and children its command does not name, and a relation's history
  ends with the step that removed it.
- **A step id is the source's, not a scope's.** A step applied is not applied
  again, and one sent to a scope other than the one it was applied to is
  refused (`step.elsewhere`, a caller's fault with no sentence of its own). A
  repository remembers the ids it applied for at least 24 hours, and for good
  where it keeps a log of its steps. A run whose steps have all landed answers
  the revisions as they stand, whatever it expected; a refused apply counts no
  step as applied and moves no revision anywhere; a scope named twice in one
  apply is its runs as one change.
- **The history records an entry when asked.** Steps collect in each scope's
  open entry, and `HistoryRepository.record` closes it with a subject; an
  implementation may also close one when it judges a run has ended. When the
  app moves onto the repositories, the four places that take a snapshot today
  become:
  - *File › Snapshot* (`app/history/useProjectHistory.ts`, `take`): `record`
    over every scope, with the person's words;
  - the safeguard before a replace (`useProjectHistory.ts`, `safeguard`):
    `record` over the scope being replaced, before the replace's steps;
  - the snapshot before a pull on open (`app/bootReads.ts`, `pullOnOpen`):
    pulling is the folder implementation's own capability (§2), so the record
    before it moves with it into the folder provider's chrome;
  - the snapshot before a format upgrade (`bootReads.ts`, `upgradeFormat`):
    the upgrade is the folder implementation's own pass, and it records
    through its own history before it rewrites anything.
- **Labels are a scope's own.** Two scopes may each use one label.
- **An image's name is fixed as a rule**, the same wherever it is checked:
  - composed (Unicode NFC), and refused when it is not;
  - segments split on `/`, none empty and none `.` or `..`;
  - no white space, no control character (U+0000–U+001F, U+007F), and none of
    `\ < > ( ) ? # % : * " |`;
  - an extension, in any case, that is `png`, `jpg`, `jpeg`, `svg` or `webp`;
  - one picture per name in a scope's library, compared composed and in lower
    case.

  An entry's media type is its name's, its content address is `sha256:` and
  64 lower-case hex digits — the SHA-256 of the bytes, fixed so an address
  means one thing in every source — and its size, width and height are whole
  numbers of zero or more. `ImageRepository` answers a listing of one image
  folder and a lookup by name beside the bytes, and the bytes of a name come
  with its own entry's media type.
- **The library's folders are called image folders** in code, so the rule can
  read *folder* as the storage word everywhere else.
- **A settings patch takes a key out with `null`**, not `undefined`, because
  a patch may travel as text.
- **Revisions.** A scope's revision moves when its state changes, and only
  then; a move changes the moved scope's and every scope's under it, because
  an address is part of a state. The tree has a revision of its own, which
  moves when what a node says changes and not for `updatedAt`. The index's
  answer to *what changed since* names every scope something happened to and
  no other.
- **Refusals are values with keys.** Five are new: `shell.scopeGone`,
  `shell.scopeTaken`, `shell.scopeIntoItself`, and `shell.imageBadName` and
  `shell.imageBadEntry` for a picture. An address the repository refuses is
  one `isSafeScopePath` refuses today.

## As built, 29 September 2026: the folder implementation

**What was built.** The folder is an implementation of the five
repositories, in `src/adapters/folder/`:
- **What moved there**: the folder store, its settings file, its staged
  writes and the fake folder the suites run on (from `adapters/fileSystem/`);
  `DirectoryHandle` and its contract (from `ports/`); the browser's and the
  desktop's handles and the desktop's git history (from `adapters/browser/`
  and `adapters/desktop/`); and the fingerprint of a scope's files, out of
  `projects/revision.ts`, which keeps the refusal and the fingerprint every
  store shares.
- **`folderRepositories(opening)`** builds the five over a folder handle, its
  history (`FolderGit`) and a place for the person's own settings.
- **The history over git** is `platform/node/gitEntries.ts` — the changes, a
  commit of some paths, the commits with what each changed, the files at one,
  the tags — behind eight new channels of the desktop's history, and
  `DesktopFolderGit` over them. A history kept in memory (`memoryGit.ts`) is
  test support for the fake folder.
- **Every suite runs twice**: over the fake folder with the history in
  memory, and over a real temporary folder with the machine's own git,
  through the desktop's handle and history with each channel minus the wire.
- **The suites gained clauses for a move and a removal**, binding every
  implementation: the scopes under a moved one keep their history, pictures
  and settings; a scope made where a removed one was, or under its address,
  starts empty in all four.

**How the folder meets each contract.**
- **Identity.** `scope.json` carries `id`. A folder written before scopes had
  one reads as having one all the same, made from its address, so it is the
  same every time the folder is read; it is written into the header the first
  time anything writes that scope, a move included. Nothing writes a folder
  only to add identities. Two headers claiming one id — a scope's folder
  copied by hand — are read with it at the address it was last found at (the
  first by address, where it was found at neither), and the other as a folder
  with none; where each identity was last found is kept outside the folder
  (`PlaceStore`: the desktop's data folder, a browser's database), so a
  restart does not hand it back to the first address. An address is answered composed (NFC), and an identity made from
  it is made from it composed, whatever the disk spells; no folder is renamed. The folder format carries a header key it does not
  write through a save (`ScopeSnapshot.carried`), so the app's store keeps an
  identity, and the library below, where it finds them.
- **Revision.** A fingerprint of the scope's address, every file of the
  format it holds, and each picture of its library by name and bytes. Content, so two reads of an
  unchanged scope agree and a step that changes nothing moves nothing.
- **Steps, all or none.** Every scope's steps are applied and every refusal
  made before anything is written; then the folder store writes every scope's
  files together, staged before any is moved into place where the folder can
  (the desktop's main process; a browser's handles that can rename). What a
  stop part way leaves is what that write leaves: on the desktop some files
  in place and the rest staged beside them; over a handle that cannot rename,
  some scopes written and some not. The pictures are written after the
  scopes' files, so a stop between leaves an entry whose bytes answer
  nothing until they are put again. Before the write begins, each step is
  remembered with what its scope's files are to be fingerprinted as once it
  has landed, worked out with nothing written; a step sent again whose scope
  is now that counts as landed, and one whose scope is not is applied. So a
  run across several scopes that a stop cut short, sent again, lands on the
  scopes it had not reached and leaves the ones it had. A scope read at what
  its pending steps were to leave it at has them remembered as landed before
  anything writes it again, so a step sent again after a later run is never
  applied over it; a write refused wrote nothing, and its steps are forgotten.
- **Step ids** are remembered for two days, and never in the folder: a file
  of ours there is one a person sees and a copy carries, and `.git` is git's.
  Whoever composes the folder says where they are kept (`StepStore`): on the
  desktop, in its own data folder beside what it does about each folder
  (`folders/<hash of the path>.json`, one file per folder, which the main
  process reads and writes only for a folder the user granted, as it does
  the folder's files, and writes whole or not at all — to a file beside it,
  flushed and renamed over it, as every file of the app's own is, the rename
  tried again on Windows for up to ten seconds while something else holds
  the file, the directory flushed after it elsewhere, and a file linked
  there written where the link leads; a name of ours that a stopped write
  left beside a file, a minute old, is taken away when its folder is next
  written — the folder listed for it at most once every ten minutes, and
  again after a write in it failed; the names it writes now carry an
  `lvarch-` mark, and the older shape is taken only beside a file just
  written); in a browser, in the database
  its repositories keep their own work in, under a key of the folder's own —
  a handle has no identity storage can be keyed by, so each folder has a
  record holding its handle, found by asking each kept handle whether it is
  the same folder, and everything kept for it is under that record's key, one
  record per value, so two tabs never write over each other's. Both keep them
  through a restart.
- **No `.git` is a path the file channel takes** — the folder's own or one at
  any depth under it, in any spelling: in any case, with the trailing dots and
  spaces Windows drops, as Windows' short name, through a stream's name
  (`.git::$INDEX_ALLOCATION`), with the code points HFS+ leaves out of a name
  (as git's own check strips them), or through a link. A folder with a history
  somewhere under it is neither moved nor removed, and a segment that is
  empty, `.` or `..` once Windows has trimmed it is refused. So a page can
  neither write into a history nor give a folder one. No segment with a colon
  in it is taken either, since Windows reads `name:stream` as a way into the
  file itself: no name the app writes has one, and a file of a person's with
  one in its name is not read through the channel. The folder a write or a
  move lands in is checked again just before it lands, so a link put in the
  way after the path was resolved is refused.
- **A folder's own configuration is taken for what a folder needs, and for
  nothing else** (`platform/node/gitGuard.ts`). A folder arrives from anywhere
  — a zip, a shared drive, a clone — and git reads its `.git/config` on every
  command. So before every git the app runs with a folder, reads included,
  its whole configuration is read in one read that says of each key whose it
  is (`--show-scope`): the folder's are those of `.git/config` and a
  worktree's own, and of any file either includes, however it came to be
  included; the rest — the machine's, the person's global one, what the
  process was started with — is the person's. A read is kept for the next
  git with the folder, and read again the moment anything git reads the
  configuration by could have changed — every file it came from or names to
  include, the repository's configuration files found as git finds them (a
  `.git` that points elsewhere followed, a worktree's common directory), the
  branch by `HEAD` and a reftable's `tables.list`, the person's files and the
  environment git reads them by — all looked at before the read, each file by
  its whole contents as well as its times, which a disk that keeps them
  coarsely could leave as they were. A read that
  fails refuses the command, and git older than 2.26, which cannot say whose
  a key is, is asked to be updated. Keys are matched as git matches them, without
  regard to case. Each key the folder sets is one of three things.
  - **Allowed**, as the folder says it — what a repository needs to be one,
    and settings that start no program, send nothing anywhere and read no
    file outside it: `core.` format and disk keys (`repositoryformatversion`,
    `bare`, `filemode`, `ignorecase`, `precomposeunicode`, `symlinks`,
    `logallrefupdates`, `autocrlf`, `eol`, `safecrlf`, `sparsecheckout`,
    `sharedRepository` and the like), because a repository is not one
    without them and each only says how git sees the disk; `user.`,
    `author.` and `committer.` names and emails, because who commits is the
    folder's to say; `remote.<name>` addresses, refspecs and pruning,
    `remote.pushDefault`, `branch.<name>` tracking and `branch.sort`, because
    syncing needs them; `submodule.<name>` addresses and state, since nothing
    enters a submodule; `extensions.` git knows (`objectFormat`,
    `worktreeConfig`, `preciousObjects`, `refStorage`, `partialClone`,
    `noop`); `init.defaultBranch`; `include.path` and
    `includeIf.<condition>.path`, whose files are read and held to the same
    rules, and refused where they lie in the work tree, where a page can
    write them; `lfs.` settings but its custom transfers and extensions,
    since git-lfs's filter is the person's; `commit.` settings but signing
    and the template file; `http.postBuffer` and `credential.useHttpPath`;
    what only commands the app never runs read (`difftool.`, `mergetool.`,
    `diff.tool`, `merge.tool`, `sendemail.`, `svn-remote.`); a diff driver's
    `xfuncname`; and display, housekeeping and default settings (`color.`,
    `gc.`, `pack.`, `index.`, `status.`, `gui.`, `pull.`, `push.`, `fetch.`,
    `merge.` and `diff.` of one level, and the like) but those that name a
    program, sign or read a file (`diff.external`, `diff.orderFile`,
    `fetch.bundleUri`, `gc.recentObjectsHook`, `blame.ignoreRevsFile`,
    `tag.forceSignAnnotated`, `push.gpgSign`).
  - **Set again, after it**, to the person's own value, or where they have
    none to git's default or to no program: signing (`commit.gpgSign`,
    `tag.gpgSign`, `tag.forceSignAnnotated`, `push.gpgSign`, `gpg.format`,
    `gpg.program`, `gpg.<format>.program`, `gpg.ssh.defaultKeyCommand`, and
    `user.signingKey`, whose default for gpg and x509 is who commits; for
    ssh git's default is the person's own key command, which no named key
    can give way to, so where the person signs with ssh and names no key
    the command is refused rather than signed with a guess), `core.askPass`,
    `core.sshCommand`, `core.pager`, `core.editor`, `sequence.editor`,
    `diff.external`, `diff.<driver>.command` and `.textconv`,
    `merge.<driver>.driver`, a filter's `clean`, `smudge` and `process`,
    and its `required` — refused, naming the filter, where the folder
    requires one only it defines — `branch.<name>.mergeOptions`, `submodule.<name>.update`,
    `commit.template`, `core.attributesFile` and `core.excludesFile`. A proxy
    (`http.proxy`, `remote.<name>.proxy`) is the person's own or the one the
    process's environment names for the address the command talks to —
    `https_proxy` for a secure one, `http_proxy` for a plain one — never
    turned off. A list an empty value empties — a credential helper,
    `http.extraHeader`, each also for one address — is emptied, and the
    person's own are named again in their order.
  - **Refused**, the command not run and the key named: a key git takes from
    its first value, so nothing set after it wins (`core.gitProxy`,
    `remote.<name>.uploadPack` and `.receivePack`); an address rewrite
    (`url.<base>.insteadOf`, `.pushInsteadOf`), every value of which counts
    and which an empty value would make a rewrite of every address; a key
    named with an `=`, which `-c` cannot reach; an extension git may not
    know; a `core.worktree` other than the folder itself; and any other key
    the folder sets that is not allowed and has no value to set in its place
    — `http.sslCAInfo`, say, or `http.cookieFile`. A person can remove it, or
    use git themselves; a sync refused this way says so in the folder's
    strip, in the refusal's own words, which name the key.

  **Always**, whatever the folder says: no hook (`core.hooksPath` is an empty
  folder of the app's), no file-system monitor, no `ext::` transport, no
  command for alternate references, no signature shown in a log, no
  submodule entered (`submodule.recurse`, `fetch.recurseSubmodules`,
  `push.recurseSubmodules`), TLS checked as the person checks it (`true`
  where they say nothing), and this folder the work tree. The `GIT_DIR`,
  `GIT_CONFIG` and the like the process may have been started with are not
  passed on, a
  partial clone fetches nothing it lacks but on a fetch
  (`GIT_NO_LAZY_FETCH`), and the `ssh` git runs is the one the process
  names, which git takes before any configuration's.

  **A remote that is a path on this machine** is refused where it lies inside
  the folder: a page can write a repository there as plain files, and git
  runs the hooks of a repository it pushes to on this machine as that
  repository's own. One outside the folder — a shared drive, a disk — is the
  person's, and its hooks run as git runs them for any local remote.

  So a person who signs keeps signing with their own signer and key, their
  credential helpers and a filter they define — git-lfs as it installs
  itself — run as they always did, and a filter only the folder defines runs
  nothing: the file is taken as it is. Where the folder requires such a
  filter — an LFS set up for that folder alone (`git lfs install --local`) —
  the command is refused, naming the filter, rather than committing its
  files whole; installing it in the person's own configuration lets it run.
- **A move** takes the scope's folder and the scopes under it as they are —
  the format's files, the pictures, the settings, whatever a person keeps
  there, links and empty folders included. On the desktop it is one rename in
  the main process, and no byte passes through the page; where the handles
  cannot rename, every file is copied to the new address and the old folder
  removed only after, so a stop part way leaves two copies, which a person can
  see and settle, never none. Each scope's identity is written into its header
  where it was not yet.
- **History.** A `record` is one commit of the scopes it closes, each scope's
  own files — everything in its folder but the scopes filed under it, and
  never the machine's settings file an older build left — with a trailer per
  scope (`Lionsville-Scope: <id> <address>`), read from the trailer block
  alone; a subject is written as one line. A commit is an entry of each scope
  it names, and a commit without a trailer — an older build's snapshot, a
  person's own — is an entry of a scope whose own files it changed where the
  scope has been, while the header there said the scope's identity (or none,
  and the address makes it), so a scope made where a removed one was is not
  handed its past. Paths and addresses are compared composed, so a folder
  whose name git or a disk gives back decomposed still commits, and a
  trailer says its address composed. A page after a page is counted from the commit the first
  started at, so a history that grows or merges meanwhile neither repeats nor
  skips an entry; a merge is no entry of its own. A thing's history asks git
  only for the commits that changed where a record of its kind is kept; an
  element's or a relation's is answered from the ids of what each commit
  changed, its own file's changing being enough and the model they share
  read once per version; any other is read off the scope at the commit and at
  its parent. Each chunk of commits is read in as few looks at git as there
  are — the headers of the unmarked ones, every version of a model — and of a
  model only the row asked about is kept. Those versions are asked for by
  their sizes, which git answers without reading them (`sizes`), in batches
  of at most 32 MB, each let go of before the next is read: two hundred
  versions of a large model are more than one reply may carry. It stops at
  the entry after the page, and what it read is kept to a size; a perf budget
  holds it on ten thousand commits, half of them unmarked, with a model of
  fifteen hundred elements, an element whose page never fills and a page nine
  thousand commits down, and on a model of two megabytes that each of 220
  commits changes (`adapters/folder/history.perf.test.ts`). `record` starts a history where
  the folder keeps none, as a snapshot always has, and refuses, with a key a
  person can act on, part way through a merge, a rebase, a cherry-pick or a
  revert, with a file unmerged, or on no branch. The paths it commits go to
  git on its standard input; a machine with no git (`shell.gitMissing`) or
  one older than 2.26 (`shell.gitTooOld`) is refused with a sentence that
  says so, and looked at again on the next try, so installing git and trying
  again works; a failure crosses to the page as a key, never as git's words,
  which name paths.
- **Labels** are tags named `<scope id>/<slug>`, so two scopes may each use
  one label; a tag so named, its space shaped as a scope's identity (a UUID,
  or `f-` and base-36 digits), is that scope's wherever it is found, even once
  the scope is gone — and `release/final`, a tag a person made, is not. A tag named otherwise — every label an older build made,
  which was the whole folder's, and any tag a person made — stays the whole
  folder's: it is read as a label of every scope's entry at its commit, and
  its slug is taken in every scope. The older snapshot's label refuses a word
  a scope already holds. No tag is renamed. `LabelOutcome` and
  `labelSlug` moved to `projects/label.ts`: a label travels with its history
  from one source to another, so every source compares labels by one rule.
- **Pictures.** Each is `images/<file>` as before; the library's rows —
  name, media type, size, width, height, content address, and the file where
  it is not the name — are `images` in `scope.json`, so a scope is read
  without reading a picture. A file no row names is in the library too: its
  entry is made from its bytes, read once, and it is listed the next time
  the scope is written. Its name is its file's where that passes the domain's
  rule, composed (a decomposed name from an older macOS reads composed), and
  one made from it where it does not; the file is never renamed. A picture
  filed in an image folder whose name differs only in case from one there is
  kept in that folder, whatever the disk, so `A/x.png` and `a/y.png` never
  depend on whether the disk tells case apart. The same holds for a file's
  own name: a picture taken out and added in one run under a name that
  differs only in case keeps the file it had (its row says the file), and a
  file whose name differs only in case from one kept is removed only where
  the folder, listed after the write, holds both names: on a disk that does
  not tell case apart they are one file, and on one that does, two. Bytes put are held in memory
  until a step adds them, so bytes never added write nothing. **Bytes
  first**, as in every implementation: a step naming a content address the
  library does not already hold, whose bytes were not put for the scope, is
  refused (`shell.imageBytesGone`, with the step that named it), and the
  image suite holds each implementation to it. So no row ever waits for its
  bytes, and a row whose file has gone leaves the library, and its name is
  free again. **Bytes before rows**: a step's new pictures are written before
  the scope's files, and the pictures no entry keeps are removed after them,
  so a write that stops in between leaves a picture no row names — read as a
  file of its own, and adopted by the step sent again — and never a row whose
  file is not there, which would leave the library without a word; the step
  sent again adopts only a file of its very name and bytes. A new picture's
  file is made only where nothing is at its path (at once in the desktop's
  main process, which links a flushed file to the path, or opens it to be
  made on a disk that keeps no links, as a memory stick's does not; looked
  at and then written in a browser): a file somebody dropped there meanwhile
  is never written over — the same bytes are taken as the picture's, other
  bytes refuse the write as a scope changed meanwhile does. A picture is
  written over only once what it held is in hand, and one that cannot be
  read refuses the write, so a refused write puts back what it wrote and
  never takes a file away. A picture is looked at, not read: its size, when it was
  written and, on the desktop, its number on its disk (a stamp, which main
  takes where the file is). What this machine found each picture to be is
  kept on the machine by that stamp (`StampCache`: the desktop's data folder,
  a browser's database), never in the folder's header, so a picture whose
  stamp is unchanged is known without a read, one whose stamp changed —
  replaced by hand, at any size — is read and described afresh, and one never
  seen here is trusted where its size is its row's.
- **Documents** say `../images/<file>` on disk, as before, and `image:<name>`
  in the state; a document nobody changed is written back byte for byte, and
  a changed one at the depth its file is kept at (`imageLibrary.ts`, shared
  with browser storage, which keeps the same references).
- **Settings.** The organisation's are `.lionsville-architecture/organisation.json`
  at the root, and a scope's `.lionsville-architecture/settings.json` in its
  own folder, where they move and go with it and write no revision. The
  person's are wherever the composer says (`PersonSettings`), in memory where
  nobody does; the desktop's own data folder is wired when the app moves onto
  the repositories.
- **A folder opened in a browser** keeps its history in this browser: the
  folder's history seam over the browser's database (`browserFolderGit`), with
  file contents kept once each by their SHA-256, each commit as what it
  changed, from and to, and the whole tree at every 64th commit, so a
  commit's tree is the checkpoint before it with at most 63 commits' changes
  laid over it (`browserTrees.ts`), and the folder's own tree with each
  file's stamp kept once, as git's index is. A thousand commits of a folder
  of a thousand files, each changing one file, keep about 2.7 MB, of which
  about 1.5 MB are checkpoints; kept as one tree per commit they were about
  144 MB. A commit reads the head again in the transaction that writes it:
  where another tab moved it on, it writes nothing and is planned again on
  what that tab recorded, and it is given up (`shell.historyFailed`) after
  five tries. A folder's record is numbered in the transaction that writes
  it, and a tab takes the first record made whose handle is the folder,
  looking again after making its own: two tabs opening a folder new to the
  browser at once settle on one key whichever finishes first, and keep its
  steps and history under it. Its history is
  kept of what a desktop repository would hold (`workingSet.ts`): not the
  operating systems' litter (`.DS_Store`, `Thumbs.db`, `desktop.ini`), a
  `.git` or a `node_modules` folder, or what the top-level `.gitignore`'s
  simple lines name — a name, `*` and `?` inside a name, a `/` that anchors,
  a trailing `/` for folders. Not honoured, each the other way round from
  git: `!` is let go, so what it would take back stays out (`images/*` with
  `!images/keep.png` leaves `keep.png` out, where git keeps it); `**`, `\`
  escapes, character classes and a `.gitignore` below the top are let go, so
  what they would leave out is kept, where git leaves it out. A file the
  history holds, or a commit names, is kept whatever those say. The history
  repository over it is the folder's own, and every suite runs over it too.
  **That history is this browser's, not the folder's**: the folder holds none
  of it, and the desktop's git history of the same folder is another.
- **Pull, push and the remote** are in no repository. They stay on
  `ProjectHistory.sync` until the app moves onto the repositories and they
  become the folder provider's chrome.
- **No migration touches a person's folder**: reading a folder writes nothing
  to it, and a write writes only the files it changed, the identity and the
  library in the header among them.

**Where the build departed from the text.**
- **The folder format has not moved yet.** `projects/folderFormat.ts`, the
  readers it is made of, the history subjects by path, the working file and
  its manifest, the migrations and the settings file stay in `projects/` (and
  `platform/scopeHeader.ts` in `platform/`) until the app no longer imports
  them: the history and the examples first, then the working file's codec.
  Moved now, `app/` and `projects/` would import `adapters/`, which the
  import matrix refuses. The folder's repositories import them from
  `projects/` meanwhile, and the storage line still lists them: 13 files of
  the folder format (from 14), 21 files importing across the line (from 22)
  with 31 imports (from 32), and 51 files naming storage (from 52) with 82
  words (from 83).
- **A picture replaced by hand before this machine ever read its scope, at
  the size its row says, keeps its row's entry**, until its stamp changes
  again: a picture never seen here is trusted where its size is its row's,
  because reading every picture to be sure is what a scope's read must not do.
- **An entry's id is its commit and its scope together**, because one commit
  is an entry of every scope it records and each must be one of its own.
- **The index leaves out a scope whose `model.json` is missing or will not
  read**, as the folder store's reading for the index always has: unknown,
  not empty.
- **An observation with no history** is written `history: none`, so it reads
  back as none; a file that says nothing is still a hand-written one, given
  the recorded event it must have had.

## As built, 29 September 2026: browser storage and memory

**What was built.** Browser storage and memory implement the five
repositories, and both run every suite. The ports they replace
(`ScopeStore`, `ProjectHistory`, `FolderSettings`) and the stores behind
them are still what the app uses; nothing above the seam changed.
- **One set of repositories, two stores.** `adapters/repositories/` holds the
  five, written once over `KeyedStore`: a transactional key-value store, as
  little of one as they need. Memory is `MemoryStore`, and browser storage is
  `IndexedDbStore`; they differ only in where the values sit. Each store runs
  `KeyedStore.contract.ts`, the promises the repositories count on that the
  suites cannot see:
  - a transaction that fails lands nothing, and two writing transactions
    never interleave;
  - a range sees its own transaction's writes, and keys sort by UTF-16 code
    unit, as a browser's database sorts them;
  - a read transaction, a shelf it did not name, and a value that cannot be
    copied are refused;
  - a request after the work has answered, or after it waited on anything but
    the transaction's own answers, is refused, as a browser's database
    refuses it. Memory refuses it too, rather than taking what a database
    would not.
  The lint refuses `indexedDB` and `IDBKeyRange` outside `adapters/`, as it
  refuses the key-value storage.
- **Memory is a product adapter** (`adapters/memory/memoryRepositories.ts`).
  The suites' own in-memory repositories in `ports/testing/` are gone, because
  `ports/` may not import an adapter and a second copy would only drift.
- **A scope is kept in three parts:** what the tree says of it, its content,
  and its library one entry per picture. The tree reads no model. A picture is
  found by name, and an image folder listed, from the entries under that name
  alone.
- **An apply is one transaction** over every scope it names, their libraries,
  the step ids and the index's log. It lands whole or not at all, and a page
  closed half-way leaves the store as it was.
- **History** keeps each entry's list line apart from the state at it, both
  filed under the scope's identity, so a page of entries reads no state and a
  history follows its scope through a move. Entries are numbered across the
  source, so several scopes' entries merge newest first and no number is
  given twice. An entry closes only at `record`: no timer closes one.
- **Step ids are kept a week**, where the contract asks for a day, filed also
  by the day they landed so the old ones go without a scan.
- **The index's revision** is the source's own mark and the number of its
  log. Its log keeps the last thousand changes; a revision further back, or
  from another source, is answered with nothing.
- **Pictures' bytes** are kept under their scope and their content address. They
  go when the scope is removed, and not before, because an entry in the
  scope's history may name them. Bytes for a scope that is not there are
  refused, `shell.scopeGone`: a clause in the image suite, and a key the port
  now names.
- **A scope that cannot be read whole** is one whose content has a later
  format than this build writes. It is shown and refuses every step.

**Browser storage is IndexedDB.** The key-value storage the scopes were kept in
holds a few megabytes of text for the whole origin, one key at a time. A history
with the state at every entry, and pictures kept as bytes, do not fit it
without being cut to fit, and an apply to several scopes there would be several
writes. An IndexedDB transaction spans every object store it names and lands
whole or not at all. It keeps bytes as bytes, and its quota is a share of the
disk. The key-value storage stays what the preferences are kept in and how
`available.ts` asks whether this browser keeps anything at all. Node has no
IndexedDB, so its suites run over a fake of the part the store uses
(`webStorage/testing/fakeIndexedDb.ts`), which keeps the behaviours the store
is written around.

**What a person kept before is copied, never moved**
(`webStorage/earlierScopes.ts`, over `repositories/bring.ts`).
- **The copy.** When the database is new, every scope the key-value storage
  holds is read as its store reads it. It is turned into the repositories'
  shape with the folder's own translation: a document's `../images/<file>`
  becomes `image:<name>`, and each data URL becomes bytes and a library entry.
  A picture whose file name says nothing, or the wrong thing, about its bytes
  takes the extension its data URL says. Each scope keeps when it was last
  saved, and its first entry is the state it arrived in.
- **What will not read is left, and said.** Each scope and each picture is
  read on its own. A text, a scope or a picture that will not read stays
  where it was, the rest comes over, and the note kept with the repositories
  lists what was left, so a person can be told.
- **Every start looks again, and an older copy never lands over newer
  work.** The note keeps, per address, the revision and time of the text last
  looked at. The source keeps which scope each address was brought to, the
  revision it was left at, and a fingerprint of the content brought. A text
  only saved again with that same content — as an older build saves every
  scope it upgrades on opening — is no change, and is passed over. One an
  older page changed or added since is brought again only where that scope is
  still at that address and at that revision: nothing was done to it here
  since. Anywhere else — a
  step here, a move, a removal — it has changed in both places. Nothing is
  written, and the standing lists the address until a person answers it,
  one address at a time: `bringOver` writes the older copy after an entry
  that keeps what was here, `leave` keeps what is here and brings the older
  copy only once it changes again with nothing done here since. A scope here
  that cannot be read whole is not written over, and is named.
- **One key is written: a marker.** It sits outside every key a scope or a
  preference is kept under, so an older build ignores it, and it says a copy
  was made. Every other key stays byte for byte as it was. Where the marker is
  there and the database is new, the database was lost after a copy, and what
  the key-value storage holds may be long out of date. Nothing is brought:
  the standing says a person must choose (`Earlier`: `standing`, `bringOver`,
  `leave`), for the app to ask when it moves onto the repositories.

**Where the build departed from the text.**
- **Two implementations share one set of repositories.** §2 names browser
  storage and memory as implementations. They are one implementation over two
  stores, because what differs between them is where values sit, not how a
  step lands.
- **The suites' own in-memory repositories are gone**, where the contracts'
  record kept them as test support. Memory is now the product adapter every
  suite runs against first.
- **No entry closes by itself.** An implementation may close an entry when it
  judges a run has ended. Neither does: an entry closes at `record` and at
  nothing else, until the app says when a run has ended.
- **An entry's `by` is the source's word for itself**, *this browser* or *this
  session*: neither keeps a person's name.
- **The subject of an entry a scope arrived as is English.** A history keeps a
  sentence, not a key, and a sentence written once cannot follow the language
  a later reader picks.

**Left for when the app moves onto the repositories.** The database opens on
the first call, and every repository answers a promise anyway. Where IndexedDB
will not open, the first call rejects. Choosing browser storage, and what to do
then, is the composition's.

## As built, 29 September 2026: images loaded when shown

**What was built.** What rendering needs to lay a picture out from the
library and ask for its bytes only when it is shown, and the vocabulary that
goes with it. The workspace and the organisation's home hand their scope's
library down, with the source's image repository as the source.
- **The seam.** `documentation/pictureSource.ts` has `ImageSource`, which
  answers a picture's bytes by the scope's identity and its name. Its shape
  is the image repository's `bytes`, so the composition hands that in as it
  is. Rendering names no repository and no implementation. `NO_PICTURES` is
  what a page with no source asks. `memoryImageSource` is the default for
  tests and stories, and writes down every ask.
- **Handed down.** `documentation/ui/Pictures.tsx` has `PicturesProvider`: a
  source, the identity of the scope whose library the documents below name
  pictures from, and that library. Without a provider, a picture named by
  its name is drawn as its alt text, and nothing is asked.
- **Laid out at once.** `LibraryPicture` takes the entry's width and height
  as the `img`'s, and the ratio between them as its box's. The box is the size
  it will be before a byte arrives, and only its paint changes when they do.
  An entry of zeros — an SVG with neither a size nor a view box — is laid
  out 640 by 480. Such an SVG has no shape of its own: a browser draws it as
  300 by 150 of its own units and cuts off whatever it draws outside them,
  and that is what is fitted in the box. Fitting what it draws would need the
  extent of its drawing, which only drawing it tells, and laying it out from
  that would move the page when it arrived. `minHeight: 0` and `overflow:
  hidden` let a box yield to a flex column shorter than it, its picture
  fitted in the smaller box. `Pictures.browser.test.tsx` holds this in
  Chromium and WebKit: every picture and paragraph is where it was, to the
  pixel, once the bytes are decoded and painted, in a document and in a
  flex column.
- **Asked for when in view.** One `IntersectionObserver` per provider, a
  little ahead of the visible part. A picture far down a long document is
  never asked for. In a test the watch is handed in and driven by hand. The
  margin ahead is the window's: a document scrolling inside a sheet of its
  own has its pictures seen as they appear in the sheet, with none ahead.
- **Bytes that do not come.** Where the source answers nothing, or fails, the
  picture keeps its place and shows its alt text, and the failure goes where
  the composition says. It asks again once it has left the view and come
  back, never over and over while it sits there.
- **Kept, a little.** `PictureCache` asks once however many places want one
  picture. It keeps the bytes of the last 48 pictures nobody shows, oldest out
  first, and never drops bytes being shown, or bytes a place is waiting to
  show: asking and showing are one call, so a burst of more pictures than it
  keeps shows every one. The bound is a count of pictures, not of bytes: at
  most 48 pictures nobody shows. A picture added through the app, by a
  person or the agent, is at most two megabytes, so about a hundred megabytes
  beyond what is on screen where every picture came that way. A source may
  also hold pictures that came another way — a file put in a folder by hand,
  or one that arrived through its history — which may be of any size, and
  each counts as one picture all the same. What is on screen is bounded by
  the page, not the cache. One cache per provider, gone with it. A picture whose bytes are kept is drawn before the
  browser paints, asking nothing. The address a browser draws from is made
  when a place first shows a picture and let go when the last one stops. A
  picture is the scope, its name and its content address, so bytes changed
  under a name are another picture.
- **An SVG is drawn from a data address.** An object address belongs to the
  app's origin, and an SVG opened from one in a tab of its own would run its
  script as the app. A data address's origin is opaque. Raster pictures keep
  object addresses. `image:` passes the markdown view as a picture's source
  and never as a link.
- **Keyed.** Every picture in a document is keyed by its name, so a
  document that names another picture in the same place gets a new `img`,
  never the last one's with its source still on it.
- **A report asks when it is produced, for what it prints.** A report renders
  its documents with `MarkdownView` itself — not the one `renderMarkdown`
  loads on first use, which draws nothing until its script arrives — inside
  `CollectPictures` (`ui/PictureCollector.tsx`). Every picture the renderer
  draws from a library is written down as it is drawn, in the render itself,
  with the scope whose library it is: from the parse that prints it, so a
  picture named in a code block is not asked for, two spellings of one name
  are one picture, and one name in two scopes is two. The list is whole when
  the render returns — `renderToStaticMarkup`, or a root rendered inside
  `flushSync` — and may name more than is printed: a picture inside a
  Suspense boundary whose sibling suspends is written down while the
  boundary puts out its fallback, so a report renders with nothing that
  suspends, or accepts asking for a picture it will not print. Written down
  during the render, `onDrawn` only records and sets no React state. Once
  the render has returned, a report calls `picturesForReport`
  (`pictureReport.ts`). It asks for each once, four at a time and never
  fewer than one, waits for every answer, and answers the pictures whose
  bytes came in the order drawn, with a lookup by scope and name. A picture
  whose ask failed, or threw before it answered, is left out and said where
  the caller says; a report is never refused for one. A page with no
  collector above it writes nothing down. `pictureDataAddress` gives the
  self-contained form a report that draws without asking again takes.
- **Entries from bytes, by one rule.** The reader of what bytes say about
  themselves (media type, size, declared dimensions, content address) moved
  from the folder's implementation to `model/imageEntry.ts`. Everything that
  adds a picture describes it the same way, once, when it is added. A JPEG's
  dimensions are read the way up its Exif orientation says it is seen, as a
  browser draws it.
- **Names, not paths.** A document names a picture `image:<name>`.
  `imageNameOfSource` reads one, undoing the percent-encoding a markdown
  renderer applies to a source. The agent answers `image:<name>` from
  `image.upload` and `images.list`, and no longer names a path of the folder
  format.
- **A snapshot's pictures are its own type.** The working file and a scope's
  snapshot carry each picture whole, with its bytes (`CarriedImage`), apart
  from the model's picture. The working file's codec is untouched.
- **Through the whole app** (`app/App.pictures.test.tsx`): the shipped
  example with pictures, opened over the memory repositories. Opening the
  scope asks for no picture; a card's description on the board and a
  decision's page each ask for the picture scrolled into view, once; a
  picture seen before is shown without asking; a report of those documents
  asks for exactly what it drew, when it is produced.

**Where the build departed from the text.**
- **The report is a call, not a screen.** Core prints and exports no document
  with pictures in it yet. What a report must do is written down here, so a
  report written later cannot do otherwise: ask for every picture when it is
  produced, and not when the scope is opened. A page printed from the
  browser is not a report: it prints what is shown, and a picture whose
  bytes have not arrived prints as its alt text. A report goes through
  `picturesForReport` and `pictureDataAddress`.

The storage line lost one file and two words: 50 files naming storage, with
80 words.

## As built, 29 September 2026: browser storage, robust

**What was built.** Browser storage, made to hold up once people use it.

- **A connection is not forever** (`webStorage/IndexedDbStore.ts`).
  - A connection the browser closes under the page is forgotten, and the
    next transaction opens another.
  - A transaction lost with its connection landed nothing. That covers
    `UnknownError` (iOS Safari's lost database server), `InvalidStateError`,
    and an abort nobody asked for. The work runs once more on a new
    connection, so `KeyedStore` now says the work may run twice and must
    change nothing outside its transaction.
  - The store stands at `reload`, and refuses every transaction
    `shell.storageReload`, in three cases: a later build asks to upgrade
    (`versionchange`), the database is already past this build
    (`VersionError`), or a second loss comes in a row.
  - It stands at `blocked` while an upgrade waits on an older tab.
  - The standing is the app's to show: `BrowserSource.database` adds it to
    what `browserRepositories` answers.
- **Full is a refusal.** A write the browser has no room for is refused
  `shell.storageFull` and lands nothing. It is never a raw
  `QuotaExceededError`.
- **Landed means on disk.** Writes ask for `strict` durability.
- **Kept, and measured.** `keep()` asks the browser, once, to keep the
  site's storage through a clear-out (`persist`), and keeps the answer. The
  app calls it after the first save that landed, or from a person's gesture,
  and never at start-up, because Firefox puts the question to the person.
  `persisted()` says whether the storage is kept and asks nobody. How full the storage is comes from the browser's
  estimate, in the `used` and `budget` the nearly-full notice reads. It
  replaces the character count the key-value storage was measured by. Both
  come from the storage manager handed in beside the database
  (`IndexedDb.manager`), and answer nothing without one.
- **A transaction's writes are held until its work answers**
  (`webStorage/heldWrites.ts`). A browser commits a transaction as soon as
  it has nothing left to do. In WebKit a digest is such a wait, so the writes
  made before it landed and the rest were refused: half a transaction. The
  writes are now made, in the work's order, only once the work has answered.
  Reads are still asked of the database and read through what is held. The
  WebKit run of the tests below found the half-landing.
- **History is bounded by what changed, not by how long it is**
  (`repositories/entryStates.ts`).
  - Each entry kept its whole state before, marks' data URLs included.
  - Now an entry keeps the changes from the entry before it: parts set or
    gone, and for a list of records the records set, those gone, and the
    order where it is not implied.
  - Every 32nd entry is a checkpoint. A part unchanged since the last
    checkpoint is a pointer to the checkpoint that holds it, so marks nobody
    touched are kept once.
  - Changes are applied before they are kept and compared with the state
    they must reach. Where they differ, a checkpoint is kept instead, so
    every entry answers exactly the state read when it closed.
  - Measured: 1,000 entries of small edits to a scope of about 230 kB take
    4 MB, against 230 MB kept whole. The test holds them under 8 MB, and
    checks every entry's state.
- **Pictures' bytes nothing names are reclaimed**
  (`repositories/imageNames.ts`).
  - Bytes stay while the scope's library or any entry of its history names
    their content address.
  - Bytes named by neither go at the first record a day after they were last
    put.
  - What names each address is counted where the library is written and
    where an entry closes, in the same transaction: how many library names,
    whether an entry ever named it, and when the bytes were put. Addresses
    named by nothing wait on a shelf of their own, so the sweep reads only
    those.
  - The database moves to layout 2 for the two shelves.
- **Other work may keep shelves in the same database.** The repositories'
  transactions span their own shelves (`REPOSITORY_SHELVES`), not every
  shelf the database lays out (`SHELVES`), so such work never waits on them.
- **Real browsers.** `npm run test:browser` runs the keyed store's contract
  and the five repository suites over the real IndexedDB in Chromium and
  WebKit, in Vitest's browser mode over Playwright. It also covers what a
  fake cannot show:
  - a digest awaited in a transaction;
  - a tab closed half-way through a write;
  - a later build upgrading past an open tab;
  - an older tab blocking an upgrade;
  - a database already past this build;
  - a quota the browser enforces, met through a storage bucket where the
    browser has buckets.

  The run is not part of `npm run check`: it starts two browsers. The node
  suites also run over fake-indexeddb, beside the hand-written fake. The
  hand-written fake can now fail a transaction as it starts or commits, and
  close its connections under the page.

**Where the build departed from the text.**
- **Changes, not a pointer per unchanged part.** A small edit nearly always
  touches the elements or one view. A pointer per part would keep that whole
  list again at every entry.
- **Reclamation needs a count kept from the start.** A store made before the
  counting keeps counting but is never swept on it, because an entry kept
  then may name bytes nobody counted.
- **The keyed store's contract does not run over fake-indexeddb.** It keeps a
  transaction active until its next task finds nothing asked of it. So work
  that awaits a digest in between is not refused there, as a browser that
  ends the task refuses it. The repository suites run over it.
- **A digest is not a wait in Chromium.**
  - A small digest settles inside the task that asked for it. The
    transaction is still active, the work's writes are legal, and they land
    whole. In WebKit, memory and the node fakes the same work is refused and
    lands nothing.
  - So the contract's clause waits on a timer, which outlasts the task in
    every browser, and writes before it. It promises the work is refused
    after a real wait and nothing of it lands.
  - Each store's own tests say what a digest does: refused in memory, the
    node fakes and WebKit, and whole or nothing in both browsers.
  - The rule for code over a store stays strict: await nothing but the
    store's own requests. The stores in node refuse a breach, so the fast
    loop catches it whichever browser would have forgiven it. The
    repositories compute every digest before the transaction opens.

## As built, 29 September 2026: the app on the repositories

**A provider is a layer of its own.** §4 says choosing a folder, recent
folders and watching one become the folder provider's chrome and way in, and
that a person may be told about their folder where that chrome speaks. No
place in the tree could hold such a chrome: the app may name no storage, and
an adapter fills one seam and draws nothing. So `src/providers/` holds each
place work is kept, whole, in the shape a provider registered from outside
has (ADR-0022): the adapters it is built on, its way in, and the chrome it
draws.
- **What it may know.** The adapters, the ports, the model and the projects'
  words, the platform, the words and the widgets. It draws in the language
  that is on, as any provider's chrome does.
- **Who may know it.** The composition root registers the three that ship,
  and nothing else imports one: not the app, which reaches a provider through
  the registry, and not an adapter, which stays free of screens.
- **The line.** The storage line reads it as an implementation: its chrome is
  where the words about a folder are spoken. A provider is its way in, its
  chrome, and the orchestration of an opening — what is done before a source
  is read, and what is said while it is open: the folder's pull and format
  pass, its push after an entry, the fall to memory where this browser's
  database will not open. Reading and writing where work is kept is the
  adapter's, and what the domain computes stays the domain's.

**What a provider hands the app** is one type, `ports/ProviderParts.ts`,
for the three that ship and for any composed from outside: the source's
repositories, required, and the only way the app reaches where work is
kept; what the source is and what it is called; its word about the five
statuses and its sentence for a refusal; where its history is kept, as a
sentence of its own, and whether one is kept there already; what it hears
of a change made elsewhere; what the bar says of it, where it opened as less
than it is registered as; the parts it settles on, where it only learns what
it can keep by asking, which the boot asks before anything is drawn; and `own`,
typed by the provider, which the app hands back to that provider's chrome
and panels and to nobody else. A provider composed from outside implements
the same parts and runs core's five suites over its repositories; the three
that ship run them over what their own `open` answers
(`providers/builtIns.test.ts`). Nothing of the host's is among them: the
window, the documents a person saves and the agent's door are the host's,
whatever the source.

**What the app hands a chrome**: whether its provider answers for the
source that is open, the open scope's session and its own parts where it
does, the way about, the app's way of saying something, the preferences —
one blob, with the app as its one writer, which a chrome writes through —
`flush`, which writes what the open scope holds unwritten and is asked
before a provider replaces what its source keeps — another version taken in,
older work brought over, a copy made — so a moment-old edit is kept first
and not written over what arrived: it waits for a write already in flight,
writes what is left, and refuses while which version stands is a person's
to settle, when the provider replaces nothing; and `reread`, for a source that changed
as a whole: the tree, the index and the open scope are read again. A provider may also draw a section of
*Preferences* about its own source, as it may a panel in *Connect an agent*.

**The way in.** A provider's way in says whether it can be taken here at
all, whether the host needs it taken first, whether the host's own *Open…*
line and its Recent list are it, what the first screen says for it, and
what the app says where it did not open. It resumes the place this machine
worked from last, remembers a choice in the preferences, lists the places
worked from lately and opens one of them again. The boot opens every source
through the registry and nothing else; the host's commands say *connect*
and *reopen*, and the first screen asks in the words of the way in it asks
for.

**A working source is the same shape for every source**: which provider
answers for it, its name, its key, and whether it may be written and
outlives the tab. What the chip calls it, what the chip says on hover,
where the organisation's subtitle says everything is kept and what removing
a scope takes with it are its provider's sentences.

**The folder's provider** opens a folder the way the boot used to, and
before anything in it is read: pulled, where this person said to, and
brought up to its format, each with an entry first. What its remote
answered, the push after every entry — the folder's history, wrapped by
the provider — and the two answers to a folder and a remote that both moved
on are its chrome; *take theirs* has what is open read again. Pull when it
opens and push after an entry are its section of *Preferences*, kept by the
person's settings of its repositories. Its watcher is what the app hears of
a change made elsewhere.
- **Bringing the browser's work along** is its chrome's question, asked
  after a folder is picked, and never when the folder is merely reopened at
  a boot: the same answers, remembered in the same preferences, and the same
  copy — every scope the browser kept, into a folder that keeps what it
  holds, over the repositories (`projects/copyScopes.ts`). It is asked over
  the folder once it is open, where it used to be asked on a screen of its
  own just before, and where it used to close as soon as a person said yes:
  it stays open and busy until the copy is done, then says how many scopes
  were copied and which could not be, or why nothing was. Scopes that could
  not be written are offered again at once, and the folder is asked about
  again at its next pick until they are; one this browser could not read is
  said, and not asked about again. A copy has the folder read again, and
  never writes over a scope somebody worked in after it was found empty.
- **A folder in a browser tab keeps its history in this browser's
  database**, beside the folder's handle, and says so where a person starts
  one; only a tab with no database keeps it for as long as the tab is open,
  and that sentence is the history's own.
- **A desktop with no git** refuses a record with `shell.gitMissing`, said as
  any refusal is.

**This browser's provider** says whether its database can be written now —
another tab holds it at an older layout, or the page must be reloaded — and
that its storage is nearly full, asked after every write that landed; the
first write that landed asks the browser to keep this site. Where the
database will not open at all — a browser without one, a private window that
refuses the first open — memory answers in its place, and what the older
storage kept is shown there: read, never moved. The preferences are still
kept where they always were. Which it is is settled before anything is
drawn — the first frame waits on the database for a few seconds at most,
and where it has not answered by then, the page is drawn, the strip says so,
and the work appears when it does — so the bar says in the warning colour,
in memory's words, that nothing outlives the tab, as the subtitle and the history's note do, and the strip
says where the work shown came from. A first open refused with the names a
lost connection has is a database this page never had, not one it lost. The work its older
storage kept is asked about one scope at a time — bring the older copy
over, or keep what is here — and what was left behind is said once.
Memory's chrome says that nothing is kept.

**Every change is a step, and a whole content arrives as one.** The session
keeps every change, undo and redo included, for the writer, which lands them
as steps expecting what was read. `scope.replace` is for a content that
arrives whole — a working set landing, an example copied in, and *keep mine*
where a step of this session cannot land on another author's version, when
what is on screen lands whole over the state just read — and never for the
session's ordinary saving, which a test holds; going back in the history
stays the model's own restore. A content placed at an address makes the
scopes above it that are not there, named by their address, and expects what
its caller found there: a write that landed since, or a scope made there
since, refuses the whole rather than being replaced.

**History on every source.** A snapshot is `record` over every scope, and
the safeguard before a replace is `record` over the scope replaced and every
scope filed under it, all of which the replace writes — only where a history is
kept already (`ProviderParts.historyKept`): it never starts one nobody asked
for, and where none can be kept, the replace goes on as its question warned. Every
source keeps one — this browser's storage and memory as well as a folder —
and where it is kept is its provider's sentence. Who an entry says made it,
and what the entries of a bringing say, are in the person's language.

**What went.** The ports the app read through before the repositories —
`ScopeStore`, `ProjectHistory` and `FolderSettings` — are the folder's own
now, or gone with their last user: the history over the desktop's channel
and the folder's settings over the desktop's, the read-ahead and the store a
caller could fill with answers of its own (ADR-0022's ninth amendment). A
build composed from this one answers for its source through its provider's
repositories.

**The folder's format** moves into `adapters/folder/format/` as its users
leave the domain: the settings file, the pass that brings an older folder up
to date, the paths a history was asked by, and the examples as they ship,
which the app is now handed as the scopes they hold. The node side reads
that folder and nothing else of the implementations — one edge narrower than
a module, in the import matrix, with a test each way.

**What was left, at this part.** The working-file codec and the eight files
of the format it reads — the format itself, its text, a scope's header, the
decision, plan and observation files, and the two readers of the formats
before this one — were the last of the format in the domain, and the storage
line listed the codec's users and nothing else. They moved into
`adapters/folder/format/` together and `FOLDER_FORMAT` is at zero: *As built:
the working file as an interchange*, below.

## As built, 29 September 2026: the working file as an interchange

**What was built.** §2's interchange format: any source carries its work out
as a working file and takes one in, through the repositories, and the app
names no format.
- **The seam** is `ports/Interchange.ts`, in the stricter words of the other
  seams (it is on `SPEAKS_NO_STORAGE`):
  - `carryOut`: the organisation, or a scope and every scope under it, read
    out of the repositories with its pictures' bytes, as one parcel — bytes,
    a name and a media type — and what it was made without. The caller may
    hand in scopes that stand in for what is read at their addresses: the
    open scope, with the edits it has not written yet.
  - `open`: what bytes hold, placed at an address, or the key for bytes that
    are not a working file.
  - `bringIn`: what was opened, landed as one `scope.replace` step per scope in
    one apply, every scope or none, each picture's bytes put before the step
    that names it (`placeTogether`, *As built: the app on the repositories*).
    It may record an entry of the scopes about to be replaced first, and one
    of each landed scope after, each with a subject the caller gives.
  - `check`: what landed, read back, held to what the file says it holds
    (ADR-0023, amended), in the seam's words: which scopes and views are not
    there, and how many of a scope's parts are missing or changed.
  - `accepts`: what a picker offers.
- **The working file fills it** (`adapters/folder/format/interchange.ts`).
  The codec and the files of the format it reads moved there with their
  tests, history following: the format itself, its text, a scope's header,
  the decision, plan and observation files, the two readers of the formats
  before this one, the working file and its manifest. The reader of a version
  1 or 2 document moved with them out of `projects/scope.ts`, which keeps only
  why bytes did not open.
- **The composition root hands it to the app** (`AppProps.interchange`), as a
  script of its own, fetched once the first screen is up and the page is
  idle. Where it will not load — a tab left open over a deploy, a connection
  gone — the person is told, and nothing changed: a page is never reloaded
  for a script that is gone while it holds an edit not yet written, or works
  from a source nothing outlives the tab in. The password around a file
  stays the app's (ADR-0023).
- **A process with no screen** writes and reads one with repositories of its
  own through `platform/node/workingFile.ts`: `writeWorkingFile` for the
  organisation or a scope and those under it, and `readWorkingFile` to land one
  and read it back. It needs no browser, Electron, React or file system, and
  its suite runs in node over the memory repositories. It writes a file
  unsealed and reads only one that is not sealed; `projects/sealedFile.ts`
  seals and opens one.
- **One organisation is one file, whatever holds it.** The scopes are written
  the top first and then by address, so the order a source lists its tree in
  is not in the bytes. An organisation carried out of memory, into this
  browser, out again, into a folder, out again and into memory is the same
  file each time, byte for byte, pictures included, each source opened
  through its own provider (`providers/interchange.test.ts`).
- **Pictures in image folders travel.** A picture filed in an image folder is
  `images/<image folder>/<file>` in the working file, as the folder keeps it,
  and is read back from there; the format used to leave any name with a `/`
  in it out, without a word. A picture whose bytes do not come with a scope
  is named in what the file was made without.
- **A landing is read back with its pictures.** The scope a check reads now
  carries its pictures' bytes (`readWhole`), so a file with pictures in it is
  no longer said to have arrived without them.
- **The storage line holds no exceptions.** `FOLDER_FORMAT` is empty (from
  10 files), nothing in the domain imports across the line (from 9 files and
  10 imports), and nothing names storage (from 1 file and 1 spelling), each
  ceiling at 0.
- **The first download lost the format.** Besides the codec, the shipped
  examples' reader is fetched with the example it reads, and format 3's folds
  over a model are a file of their own (`model3to4.ts`), which this browser's
  older storage reads without the folder's fold over files. The web build's
  largest file went from 2,547 kB to 2,507 kB, and the desktop renderer's
  from 4,881 kB to 4,803 kB.
- **What went.** The copy out of browser storage into a folder that the
  repositories' copy replaced (`copyScopesInto`, `migrateInto`,
  `holdsScopes`), and the in-memory scope store only its tests used. The pass
  that brings an older folder up to date is tested through the folder's own
  store over the fake folder.

**Where the build departed from the text.**
- **The interchange is the composition's, not a provider's.** It works over
  any repositories, so every source gets the same one, and a provider composed
  from outside exports and imports with nothing of its own to write.
- **A document in a working file names a picture `image:<name>`**, as the
  state does, where the folder writes `../images/<file>` on disk. A file an
  older build wrote, with `../images/` in its documents, is read as the folder
  reads one (`format/imageLibrary.ts`, moved beside the codec): its documents
  name each picture by its name, and a file whose name the library refuses is
  given one that passes. So it lands the same in every source, and its
  manifest is held to the documents as read.
- **An organisation that holds nothing yet** is carried out as its root,
  named as the tree names it.

## As built, 29 September 2026: a scope put back whole

**What was built.** A scope a part of which does not read
(`ScopeState.unreadable`) is no longer stuck where nothing can be mended by
hand.
- **A rule of the port.** A step on such a scope is refused
  (`shell.unreadableNotSaved`), but a run whose first step is `scope.replace`
  is accepted: it says what the whole scope is to be, replaces it, the parts
  that did not read included, and the scope reads whole after it — even where
  what is put back is what could be read. `putsBackWhole` in
  `projects/scopeState.ts` is the rule, and the scope repository's suite has
  it as a clause, run by memory, browser storage and the folder, and by each
  through its own provider.
- **The folder** writes over and removes the format's files it could not read,
  and never touches a file that is not the format's: a person's notes beside
  the scope, a picture filed in a folder the format does not read.
- **The app offers it.** The notice over such a scope names the two ways every
  source has, as buttons where the source may be written: *Put back from the
  history* and *Bring in a working file*. The history's page puts the whole
  scope back as the chosen entry held it (`projects/putBack.ts`), the entry
  before it first where a history is kept, and never as a restore, which such
  a scope refuses. A working file landed there puts it back the same way.
  Either way the scope is opened again, reading whole. A picture whose bytes
  the source no longer keeps is left out, and said.
- **A source with more to say says it.** A provider may give the notice's
  sentence (`SourceProvider.unreadableKey`); the folder's names the file a
  person can mend.
- **Only when asked, never over newer work, and never losing what was
  there** (the same day, after review):
  - A put back is a replace that says a person asked for it
    (`scope.replace` with `putBack`). Any other replace — a working file
    landed, an example copied, *keep mine* — is refused on such a scope like
    any step, so nothing lands there that nobody asked to put there.
  - A scope a later version wrote (`ScopeState.later`) takes no step at all,
    a put back included (`shell.laterNotReplaced`): what this version cannot
    read is somebody's newer work. The notice says to update the app and
    offers no way back. The folder does not open such a scope at all.
  - Before a put back lands, the implementation keeps what was there, the
    parts it could not read included, or refuses. Memory and browser storage
    close an entry of the scope as it stood, its content kept beside the
    entry as it was stored. The folder sets every file of the format it would
    write over or remove that did not read aside beside itself
    (`<name>.unread`), with or without a history, and says where
    (`Applied.setAside`); a file whose bytes will not come refuses the write.
    So *Bring in a working file* on a folder with no history no longer loses
    the file the same notice says can be mended.
  - An example lands under a scope of its own where the root could not be
    read whole, or the listing could not read a scope: what could not be
    read may be anything.
  - What an entry kept that could not be read is had back: an entry says
    it kept some (`HistoryEntry.unread`), `HistoryRepository.unreadAt`
    answers it as text, and the history's page offers *Save what could not
    be read…*, a JSON file of the person's own. Memory and browser storage
    implement it; the folder sets its files aside where a person finds them.
  - Any working file opened onto such a scope puts it back, the notice's
    button or *File › Open* alike, and the question before it says so.
  - **Left as they are.** A folder's put back is not one write: the files set
    aside are copied before the scope is written, so a stop between leaves
    the copies and the scope as it was — harmless, and a person sees them.
    And a folder whose header a later format wrote is not opened at all, so
    it is never offered a put back; the listing says it could not read it.

## As built, 29 September 2026: the examples in the domain

**What was built.** What an example is called, where a copy lands and the
copy written are the domain's (`projects/examples/`): the catalogue, and
`copyExampleInto` with its rule — the organisation itself at a truly blank
root, a scope of its own under a root that holds work — beside the root read
as it is kept (`exampleCopyOver`) and the copy landed whole (`placeCopy`). The
organisation's page keeps only its hook. The examples stay in the folder's
format, read by its reader; a process with no screen reaches them through
`platform/node/examples.ts` — an example's scopes, the example as a working
file, and an example seeded into repositories of its own where the page would
copy it — over the one narrow edge that folder already had. Every JSON module
that folder reaches says it is one (`with { type: 'json' }`), which node
requires and a bundler accepts; `build/jsonImports.test.ts` walks what it
reaches, dynamic imports included, and names any that does not.

## As built, 29 September 2026: a move in a scope's history

**What was built.** A move is an entry in the history of every scope it
moved (`HistoryEntry.moved`): who moved it, when, and from which address to
which, read by the scope's identity with the rest of its entries. It closes
the scope's open entry, whatever steps were open going with it, and the state
at it is the scope's once moved. The history's suite has it as a clause, run by
every implementation.
- **Memory and browser storage** close a move's entry for each scope moved, in
  the transaction that moves it.
- **The folder** commits the move as one commit of everything under the old
  address and the new, with each scope's trailer at its new address and one
  more saying where it was (`Lionsville-Moved-From`). Only where a history is
  kept and can take a record; otherwise the move is in the next record, as it
  was.
- **Activity follows the identity.** The list asks the source's log by the
  scope's identity (`SourceRecentActivity`), and reads the moves off the
  history where one is kept: *Moved from X to Y*, with who moved it. The
  history's page calls a move's entry the same.

**Why an entry and not a step.** A move changes no record the model holds,
only where the scope is, so it is no command for the reducer and nothing
`summarise` can name from commands; a step with an activity key of its own
would have been a step no `apply` applies, kept in a log none of the three
implementations keeps. The history already follows the identity, every
implementation keeps one, and the entry needed one field. The Activity line
is `activity.scopeMoved` with `from` and `to` beside the keys a step's
summary already has, so a source that keeps a log of its own says a move the
same way.
