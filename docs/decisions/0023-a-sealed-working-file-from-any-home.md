# ADR-0023 — A sealed working file, from any home, and settings that stay with the install

* Status: accepted; amended 26 September 2026 (a manifest, and a landing that is checked; a landing is one write; a folder in a browser stages too)
* Date: 2026-09-21
* Deciders: Wouter Simons
* Extends: ADR-0018 (the working file is the working set)
* Supersedes: ADR-0005 — the machine's settings for a folder are no longer a file
  in the folder

## Context and Problem Statement

Three things were true of the working file at once, and together they were
a problem.

**It left in the clear.** ADR-0018 made the `.lvarch` the whole organisation
— every scope, every record, every picture — and ADR-0003 made it a zip a
person can unpack and read without this tool. Both were the point. But the
file leaves through a save dialog and then through whatever comes next: a
mail, a chat, a shared drive, a stick. A zip that anybody can read is exactly
as readable to whoever finds it, and what they find is a company's entire
application landscape with the names of everything in it.

**It could not be written from the screen it is named after.** Export and
Open needed an open scope, because the workspace was the only thing that
answered them; the organisation's home — the one screen that is about the
whole organisation — greyed both out. So did a scope's home. A person on the
root's screen, wanting the file the root gives its name to, had to open a
landscape first, and a `.lvarch` double-clicked while the app showed a home
went nowhere at all.

**The folder carried a settings file of ours.** ADR-0005 put what this
machine does about a folder — pull on open, push after a snapshot — in
`.lionsville-architecture/local.json` inside the folder, excluded from its
history by a line in `.git/info/exclude`. That is one dot-folder in every
working directory a person opens, one line of ours in every repository's
local exclude list, and one file that travels with every copy of the folder
that is not a clone. Configuration of the application was being kept in every
project instead of by the application.

## Decision Drivers

* What leaves the app as one file is the whole organisation; it should not be
  readable by whoever has the file.
* The people who hand a file over should not have to remember to encrypt it
  first, and the people who receive one should not need a second tool.
* A working file is a thing every home can write and every home can open.
* The application's configuration lives with the application. Nothing of ours
  goes into a person's folder that is not their work.
* Every file written before this still opens.

## Decision Outcome

### 1. The working file is sealed under a password

`workingFileBytes` still makes the zip, unchanged and reproducible. What is
written to disk is that zip **sealed** (`projects/sealedFile.ts`): one opaque
blob, AES-256-GCM under a key derived from a password by PBKDF2-HMAC-SHA256
at 600,000 rounds, with a fresh salt and nonce per file. The header —
magic, version, round count, salt, nonce — is the cipher's additional data,
so a header altered after the fact fails with the body; a round count above
ten million is refused before any key is derived, so a hand-made header
cannot hold the app.

Not a zip with encrypted entries. A zip's own password schemes leave every
entry name in the clear, and a listing of an organisation's scopes and boards
is already a fact about the organisation; the traditional scheme is broken
besides. Nothing about what is inside a sealed file can be read without the
password — not the names, not how many scopes there are.

**The person is asked on both ends.** Saving a copy asks for the password
twice, because a typo in a password nobody can recover is the file lost, and
the second field is the only check there is. Opening a sealed file asks once,
and a wrong answer is asked again with the verdict under the field, as many
times as the person cares to try. Cancelling either dialog is a decision and
not a failure: no file, no toast. A wrong password and a damaged file are one
answer from the cipher, and the sentence says so.

There is no unsealed export. An option would be a choice nobody can make
correctly at the moment they are asked to make it, and the person who wants
the zip has the password.

**Every file written before this opens as it did.** A `.lvarch` is
recognised by its bytes (ADR-0003): a sealed one by its magic, a zip by its
own, and a JSON document by being neither. `openDocumentBytes` is untouched;
`unsealedBytes` runs before it and hands it what it always got.

### 2. Export and Open work from a home

`menu.open` and `menu.exportWorkingFile` no longer need a scope; Save still
does, because with nothing open there is nothing it could write. The shell
answers `export`, `open` and `openDocument` while no scope is open
(`useHomeFiles`), and the workspace answers them while one is — the same ref
pattern the history commands already use, so the two never both answer.

From a home there is no session: the store is the whole truth about what is
on disk. An export reads every scope from it, in tree order, and seals the
set. A file opened on a home lands its top scope on the scope that home is
about — the root on the organisation's home, `acme/retail` on that scope's
— and the scopes filed under it under that, written shallowest first, and
then the tree is told. The desktop's `openDocument`, a double click on a
`.lvarch`, lands here too; it used to fall on the floor.

*Since ADR-0031 the working file is the folder format's interchange, which any
source exports to and imports from through the repositories (ADR-0031 §2);
what is said here of the store and the disk is true of the folder
implementation.*

### 3. What this machine does about a folder is kept by the install

`.lionsville-architecture/local.json` is not written any more. What this
machine does about each folder lives in the desktop's own data folder,
`<userData>/folder-settings.json`, keyed by the folder's path, each entry
exactly what `local.json` held (`platform/node/machineFolderSettings.ts`).
Main keeps the file and answers two calls on the settings channel
(`readFolderLocal`, `writeFolderLocal`); the renderer's `DesktopFolderSettings`
speaks the same port the shell always used.

**Nothing to migrate by hand.** A folder this install has never written an
entry for reads through to the `local.json` an older build may have left
there, so a machine's choices survive the move; the first write lands in
`userData` with those choices folded in. The file in the folder is left
exactly as it was — it is a person's folder, and a build that reads it
forgives it. The one line an older build put in `.git/info/exclude` stays
useful for exactly that file and is still written when a repository is
started, so a legacy `local.json` never gets committed.

`folder.json` is read for the one key an older build wrote — the
organisation's name, before the root scope existed to hold it — and never
written. The 4 → 5 pass used to take the key out once the root had its
name; it no longer writes into the folder at all. `writeFolder` leaves the
port. A source that keeps its settings in the folder it serves — a browser
tab given a directory handle, the hosted plugin — still reads and writes the
machine file there through `FileSystemFolderSettings`, which is why the shape
of that file is still decided in `projects/folderSettings.ts`; on the
desktop that store is only read through.

## Consequences

* `projects/sealedFile.ts`: `isSealed`, `sealBytes`, `unsealBytes`,
  `SEAL_ITERATIONS`, `SEALED_FILE_MEDIA_TYPE`. `app/workingFileFlows.ts`:
  `sealedWorkingFile`, `unsealedBytes`. `app/usePasswordPrompt.tsx` and
  `app/dialogs/PasswordDialog.tsx`: the one dialog, behind a promise, lent to
  the workspace and the home. `app/useHomeFiles.ts`.
* A save dialog's file is `application/octet-stream`, not `application/zip`.
  Two exports of an unchanged organisation are not byte-for-byte the same;
  the zip inside them is.
* `useProjectFiles` and `ProjectWorkspace` take `askPassword`.
* `FolderSettingsStore` is `readFolder` · `readLocal` · `writeLocal`.
  `FolderSettingsPatch`, `WITHOUT_ORGANISATION`, `folderSettingsText` and
  `FOLDER_SETTINGS_VERSION` are gone. The contract's `textAt` answers for the
  machine file's path with the text the store holds for the folder, wherever
  it keeps it.
* `DesktopSettings` gains `readFolderLocal` and `writeFolderLocal`;
  `electron/main/folderSettings.ts` registers them. The desktop no longer
  calls `git:excludeLocal` after a write; the channel stays for the legacy
  file.
* The preferences dialog's machine section no longer names a path.
* Open: a sealed file's password is typed, not stored. A password manager is
  the person's; this tool keeps nothing.
* Open: whether opening a working set on a home should ask before writing
  over scopes that are already there — ADR-0018's open question, now with a
  second screen it applies to.

## Amendment 1 — 26 September 2026: a manifest, and a landing that is checked

A working file is a whole organisation, and landing one is a walk that writes
it one scope at a time into wherever it goes. Nothing looked at the result. A
file opened on an organisation's home and found, afterwards, to be short of a
scope and its largest view had been reported *loaded* exactly as a whole one
would have been — and nothing in the app could say whether the file had held
them, whether the walk had written them, or whether the store had kept them.
Several ways to lose part of a working set without a word were in the code:

* **Opening a file over the open scope wrote the file's top scope nowhere.**
  It was adopted by the session and left to the session's own save, and a
  source whose open scope's changes travel as steps does not write that save,
  because adopting a document is not a step. The scopes under it were written;
  the top one existed on one screen until it was closed.
* **An export left out, in silence, a scope the listing could not read and one
  it listed that then would not load** (`treeScopes`), and a file handed over
  without them was the organisation as far as anybody could tell.
* **A scope in a file whose folder would not open was dropped** by the reader
  (`openDocumentBytes`), and the rest opened as if it had never been there.

**The file says what it holds.** Beside the top scope's `scope.json` the zip
carries `lvarch-manifest.json` (`projects/workingFileManifest.ts`): every scope
by its path relative to the top, with its name; every file the format made of
it, with its size and a SHA-256 of its bytes; every view, with its kind and how
much is on it; and the counts a person would recognise. A file a scope was read
without — one that was there and would not read (ADR-0028, amended) — is not
in the file, and the manifest says so under `omitted`. The file is made from
the same scopes and in the same order as before; a build that knows nothing of
the manifest opens it exactly as it did, and a folder unzipped by hand holds one
file the folder store leaves alone. The format's version does not turn.

**A landing is read back and held to it.** After *Replace here*, and after *A
new folder…*, every scope the file lists is read again from the store it was
written to, at the address it was written at, and its files hashed as the
format makes them. A scope that is not there, a view whose files are not there,
and a file with other contents are named to the person in one sentence, as an
error: *did not arrive whole. Not there after loading: the scope “…” (…)*. A
landing that is whole says so with its totals. The landing never finishes on
*loaded* without having looked.

**A file with no manifest** — everything written before this — is held to
what it contains: the manifest is made from the scopes it opened to, a scope in
it whose folder would not open is named as missing (the reader now answers
`unopened` rather than leaving it out), and the sentence says the file carries
no manifest because an older version saved it.

**Every scope a file brings is written through the store, the open one
included**, shallowest first and each saying what it expects to write over —
the revision a read of it answers at that moment — before the open one is
adopted on screen. A whole write made on purpose from outside any session is
what `ScopeStore.save`'s `expects` exists to say, and a source that keeps the
open scope's changes as steps writes such a save rather than skipping it.

**An export refuses to be partial.** A scope the listing names as unreadable,
or one it lists that then does not load, refuses the save with a sentence
naming it (`shell.exportUnreadable`); the root of a store nothing was written
to yet is an organisation with no files, not a scope that would not read. A
scope read without some of its files is exported, the manifest says which, and
the person is told at the moment they have the file in hand.

### Consequences

* `projects/workingFileManifest.ts`: `manifestOf`, `readManifest`,
  `compareManifests`, `manifestTotals`, `MANIFEST_FILE`. `workingFileBytes`
  takes an optional manifest; `OpenResult` carries `manifest` and `unopened`.
* `app/workingFileFlows.ts`: `checkLanding`, `landingSentence`, `savedWithout`;
  `landWorkingFile` takes `read`, `here` may answer `false` for *nothing
  landed*, and a `WorkingFileDestination` may bring `read`.
* `useProjectFiles` and `useHomeFiles` take `readScope`; the shell hands them
  the store's `load`. The workspace hands the open scope to `adoptWorkingSet`
  with the rest.
* `treeScopes` throws `shell.exportUnreadable` rather than leaving a scope out.
* Hashing is asynchronous (`crypto.subtle`), which is why the caller makes the
  manifest and `workingFileBytes` stays synchronous.
* **Every picture but an SVG is read as bytes** (`isBinaryPath`), by the
  working file's reader and by the folder store. Both read `.png` alone as
  bytes, so a JPEG or a WebP — written as bytes — was read back as text and
  written out altered, and the manifest's hash of it was then a hash of the
  damage. A store of another build reading a scope's files follows the same
  rule.

## Amendment 2 — 26 September 2026: a landing is one write

Amendment 1 made a landing say what did not arrive. It did not make a landing
arrive whole, and the read-back can only speak if the page that started the
landing is still there when the writes end. They were a walk: every scope of
the file saved one after the other, each save one or several writes, from the
page. A landing of an organisation over a slow connection took long enough for
the page to go away in the middle of it — a reload, a window closed, a
renderer that crashed — and what was left was the first scopes of the file
written and the rest not, with nothing on screen any more to say so. The one
that was not written was the largest, because the walk writes the scopes
shallowest first and the largest is usually a team filed two deep.

**The store is asked to write the set as one** (`ScopeStore.saveTogether`).
Each entry is what `save` would be handed, `expects` included, and every
refusal `save` can make is made of every entry before anything is written: one
scope that moved since it was read, one path no scope may have, one scope that
would write over a file nobody could read, and nothing is written. Then the
writes are made so that the page going away cannot cut them short, as far as
the store can make them one. `held.manifest` hands the store what the file
says it holds, for a store that checks what it was handed against it before it
writes anything.

* **A folder on the desktop** stages the landing in main
  (`DirectoryHandleLike.writeTogether`, `files:writeTogether`): the folder store
  plans every scope first, and main writes every file under a temporary name
  beside its target, flushed, before it renames any of them into place, and
  makes the removals last. A failure while staging leaves the folder as it was,
  and a renderer that reloads or closes once the call has begun does not stop
  it — main finishes. What is left is the machine itself stopping during the
  renames, which is a moment rather than a load; each rename is atomic on its
  own, and a folder that keeps a history has the snapshot *Replace here* took
  just before (ADR-0025, amended).
* **A folder in a browser** has no rename to stage with, and its handle offers
  no `writeTogether`: it is planned whole — so a refusal still writes nothing —
  and then written a scope at a time, as before.
* **A store with nothing to stage** (one in memory) checks every entry and
  then keeps every entry.
* **A store that cannot promise the second half** leaves `saveTogether` out,
  and the landing saves a scope at a time as it always did. The read-back of
  amendment 1 is what says what did not arrive.

**A refusal is said as what it is.** Where the store took the set as one and
refused it, the person is told the working file was not loaded and nothing of
it was written, with the store's own reason — in English, Dutch and German
(`shell.workingFileNotLanded`) — rather than a sentence about the file.
Loading it again starts from the organisation as it was.

### Consequences

* `ScopeStore.saveTogether?(entries, held?)`, with three contract clauses: the
  set is written, each scope as a save would write it; a set with one scope
  that moved writes none of them; a set with one unusable path writes none of
  them. A store that offers none skips them.
* `DirectoryHandleLike.writeTogether?(writes, removals)`; `DesktopFiles.writeTogether`,
  answering each write's stamp so the watcher still knows the landing's own
  writes for its own (`rememberingWrites`).
* `FileSystemScopeStore.save` is a plan and then its writes; `saveTogether`
  plans every scope and hands the writes to `writeTogether` where the handle
  has it.
* The home's `adopt` and the workspace's `adoptWorkingSet` take the file's
  manifest beside its scopes; the shell's `adoptScopes` reads every scope's
  revision and then writes through `saveTogether` where the store has it.

## Amendment 3 — 26 September 2026: a folder in a browser stages too

Amendment 2 left one landing a walk: a browser tab that was given a folder
and has no server. Its handle has no `writeTogether`, so the folder store
planned the set whole — a refusal still wrote nothing — and then wrote it a
scope at a time from the page. Two things followed. The page going away part
way left the first scopes written and the rest not, which is the loss
amendment 2 closed everywhere else. And a failure part way was said as the
refusal of amendment 2 — *not loaded, and nothing of it was written* — over a
folder that held the first half of the file.

**Where the browser can rename a file the person chose, the page stages.** A
browser's file handle can rename itself within its folder, over a file of the
name it is given (`FileHandleLike.move`; Chromium since 111, the only engine
with a folder picker). The folder store then does in the page what main does
on the desktop (`adapters/fileSystem/stagedWrites.ts`): every file written
under a name of its own beside where it goes — its target's name, the
landing's mark, and `.landing`, so no reader of the format takes it for a
file — and only when all of them are there is any renamed into place; the
removals last. A failure while staging removes what was staged and writes
nothing. The page going away while it stages leaves the folder as it was but
for staged files nothing reads; going away during the renames is the moment
the desktop has too, each rename whole on its own.

**Where it cannot, the landing is checked, and a failure part way is said as
what it is.** A handle with no `move`, or a first rename the browser refuses,
removes what was staged and writes a scope at a time as before. A failure
after something was written — a scope in that walk, or a rename after another
went through — is `shell.workingFileLandedInPart` and not a refusal; the
landing goes on to the read-back of amendment 1, which names what did not
arrive: *did not arrive whole. Not there after loading: the scope “…” (…)*.
Where there is nothing to read back through, the store's own sentence says
that only part may have been written — in English, Dutch and German.

*A new folder…* lands through `saveTogether` too, where it was a walk on the
desktop as well as in a browser.

### Consequences

* `FileHandleLike.move?(name)`, with a clause in the handle contract, skipped
  where a handle has none.
* `FileSystemScopeStore.saveTogether` hands the writes to `writeTogether`
  where the folder has it, stages them where its handles can move, and walks
  where they cannot, answering `shell.workingFileLandedInPart` for a walk
  that stopped part way.
* The shell's `adoptScopes` passes that answer on rather than saying nothing
  was written, and `landWorkingFile` reads a landing written in part back,
  after *Replace here* and after *A new folder…* alike.
