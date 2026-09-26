# ADR-0023 — A sealed working file, from any home, and settings that stay with the install

* Status: accepted; amended 26 September 2026 (a manifest, and a landing that is checked)
* Date: 2026-09-21
* Deciders: Wouter Simons
* Extends: ADR-0018 (the working file is the working set)
* Amends: ADR-0005 — the machine's settings for a folder are no longer a file
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

