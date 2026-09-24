# ADR-0025 — Where a working file lands is asked

* Status: accepted; amended 24 September 2026 (a snapshot before a replace)
* Date: 2026-09-22
* Deciders: Wouter Simons
* Closes: the question ADR-0018 and ADR-0023 left open — whether opening a
  working set should ask before writing over scopes that are already there

## Context and Problem Statement

Opening a working file wrote it over whatever the app had open, without a
word. ADR-0018 named that as the open question — "it does it to scopes the
person is not looking at, and that is a different thing" — and ADR-0023 made
the file openable from every home, which put the organisation's root within
reach of the same silence. On the evening 3.0.0 shipped, a person's working
folder became the shipped example: the root's model, its two boards and its
name replaced, the example's scopes written beside the person's own. The
folder had a snapshot from the day before, and everything since it was gone.

A working file is a whole organisation. Landing one is not a small act, and
the two things a person may mean by opening one are different in kind: *look
at this, as a folder of its own* and *put this over what I have*. The app
guessed the second, every time.

## Decision Drivers

* Nothing writes over a person's work without asking, anywhere.
* The safe answer has to be the easy one: a file that becomes a folder of its
  own touches nothing that was there.
* The dangerous answer stays possible, said out loud, because replacing is
  sometimes exactly what is meant — a colleague's newer copy of the same
  organisation.
* One dialog, one flow, for the workspace and every home.

## Decision Outcome

**Every working file is asked where it goes**, after it has been read and
before anything is written (`app/workingFileFlows.ts`, `landWorkingFile`;
the dialog is `app/dialogs/OpenIntoDialog.tsx`):

* **A new folder…** — the person picks a folder with the same picker as
  *Open Folder…*. The file's top scope becomes that folder's root and the
  scopes under it are written under that, and the app moves there the way it
  moves for *Open Folder…*. What was open is left exactly as it was. A
  chosen folder that already holds a name, a scope or a board is *occupied*,
  and is written over only after a second, separate yes that names what it
  holds (`composition.ts`, `chooseFolderDestination`).
* **Replace “<scope>” here** — what opening always did: the top scope lands
  on the open scope, or on the scope the home is about, and the rest under
  it. The button carries the name of what it writes over, the warning under
  it says every scope filed beneath goes too, and that what is there now is
  kept only where the folder has a snapshot.
* **Cancel** — nothing, silently.

Where no folder can be chosen — a browser tab without a directory picker —
the folder button is absent and the dialog is the confirmation before an
overwrite, which is the least it has to be. A file that is not a working
file is refused before anybody is asked.

The boot provides the folder half (`onChooseFolderForWorkingFile`): the
composition chooses and writes, because only it may name the store; the boot
moves the shell, because only it owns one. The shell draws the two dialogs
once (`useOpenIntoPrompt`) and lends them to the workspace and the home, the
way it lends the password dialog.

## Consequences

* `landWorkingFile`, `LandingPrompts`, `WorkingFileDestination`,
  `ChooseFolderForWorkingFile`; `useProjectFiles`, `useHomeFiles` and
  `ProjectWorkspace` take `landing` and an optional `chooseFolder`.
* A file that becomes a folder is re-read against a bare root, so its scopes
  are addressed from that root and their stand-ins point where they should.
* Opening a working file is never one gesture any more; it is two. That is
  the trade, and the evening it is written for is why.
* ~~Still open: the app cannot take a snapshot on the person's behalf from
  inside this dialog.~~ It does now (amendment 1, below). *Replace here* on a
  folder without history is still a loss the warning names and the app cannot
  undo.

## Amendment 1 — 24 September 2026: a snapshot before a replace

**Where the folder keeps a history, *Replace here* takes a snapshot first**,
and replaces only once it has landed (`useProjectHistory`'s `safeguard`,
handed to `landWorkingFile` as `beforeReplace` by the workspace and by the
home). The folder is written out, then recorded under *Before a working file
replaced this*, and the person is told a snapshot was taken and that what was
there can be restored from the history. If the snapshot was due and failed,
**nothing is replaced** and the person is told why: the dialog's warning
promised a snapshot, and a replace without one is the loss this decision exists
to prevent.

A folder that keeps no history is not given one: starting a history is the
person's opt-in (ADR-0008), and the warning under the button still says what
*Replace here* costs there. A file that becomes a folder of its own takes no
snapshot, because it writes over nothing that was open.

The evening this decision was written for had a history, and a snapshot from
the day before; with this amendment the snapshot would have been from the
minute before.
