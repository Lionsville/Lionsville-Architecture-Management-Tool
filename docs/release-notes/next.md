# Release notes, next version — draft

*What has landed on `main` since 3.2.1 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

**Security: the desktop app no longer lets a folder decide what git runs.**
Until this release, the desktop's file channel would read and write inside a
working folder's `.git`, and the app runs git in that folder, so a page could
plant a setting there that git would act on. Two things are now true:
- **Nothing is written into a folder's history.** Every path into a `.git` is
  refused, the folder's own or one at any depth under it, in every spelling:
  upper or lower case, with the trailing dots or spaces Windows drops, by its
  short name, as a Windows stream, with the characters macOS leaves out of a
  name, or through a link. A folder with a history somewhere under it is
  neither moved nor removed.
- **Only your own git configuration names a program.** Git runs with your
  configuration for signing, proxies and credential helpers. A folder's own
  `.git/config` may set what a repository needs, such as its remotes,
  branches and who commits, and display and housekeeping settings. A program
  it names (an editor, a pager, a signing program, a filter, an askpass) is
  replaced by your own value or git's default. Settings only for commands the
  app never runs, such as a merge or diff tool, mail or svn, are left alone.
  Git always runs with no hooks and no file-system monitor.

**What this can refuse, and why.** A few settings cannot be replaced, only
refused: git's own proxy command, the upload-pack and receive-pack programs, a
pager for one command, an address rewrite and a cookie file. In a folder that
sets one, a snapshot, a label, a pull or a push is refused, and the message
names that setting: remove it, or use git yourself in that folder.
The app pulls from and pushes to only a remote named in the folder's
configuration. A remote that is a folder inside the working folder is refused,
however it is reached: named as a remote, given as a branch's remote or push
remote, arrived at through an address rewrite, reached over ssh to this machine
(by any of its names or addresses, an alias in your ssh configuration
included), or named the old
way in `.git/remotes` or `.git/branches`. A remote elsewhere on your machine,
such as a shared drive, works, and its own hooks run as git runs them.

**Large files kept with git-lfs are now uploaded when you push.** Git-lfs
uploads them from a hook, and the app runs no hooks, so earlier versions,
3.2.1 included, pushed the pointers without the files. Where your own
configuration sets git-lfs up (`git lfs install`), the app now runs
`git lfs push` before each push, to the address your git-lfs names for the
remote. Where it does not, the push is refused with a sentence saying large
files would not be uploaded. A push is also refused where the folder's
`.lfsconfig` says where large files go, how to sign in or by which protocol,
or where they would
go to a repository inside the working folder. Git-lfs set up for one
folder only (`git lfs install --local`) is refused, naming the filter, rather
than committing large files whole; `git lfs install` sets it up for you and it
runs again.

The desktop now needs **git 2.26 or newer**, to tell a folder's settings from
yours; an older git is told so, in the one sentence the history has for it.

The hole predates this release. **Update the desktop app**, and check
`.git/config` in every folder you opened with the previous version: a setting
written through the old hole could name a filter, a signing program, a
credential helper or a remote that git would use.

**Every place your work is kept now keeps a history.** Snapshot…, History…,
restoring and labels used to be the desktop's, and only where git was
installed. They now work in a browser too:
- a folder on the desktop keeps its history in git, as before;
- a browser keeps it in the browser, including for a folder a tab has open,
  where nothing is written into the folder for it;
- where the browser's storage will not open, it is kept for as long as the tab
  is open.

The first snapshot says where its history will be kept. On a desktop without
git, a snapshot is refused with a sentence saying to install it, instead of
the menu items quietly disappearing.

**Browser work is kept in the browser's own database.** It is sturdier and
larger than the storage it replaces. It keeps a scope's history compactly and
clears away pictures nothing uses any more. Work an earlier version kept in the
browser is copied over at every start, never moved and never over work done
since. Where a scope changed in both places, a strip asks about that one
scope: **Bring the older copy over** or **Keep what is here**. Where the
browser's database will not open, a strip on every screen now says that
nothing is kept, the chip on the organisation's home says **Not kept
anywhere** in the warning colour, and that earlier work is shown so you can
save a working file of it. A private window usually does open the database,
and keeps your work only as long as the browser does; the app cannot tell the
window is private, so save a working file there. If the browser's storage is
slow to answer, the page is drawn after a few seconds anyway and your work
appears when it does, instead of a blank page.

**Pictures load when you look at them.** A description with many pictures
opens at once. Each picture is laid out at its own size straight away, and its
bytes are fetched only when it scrolls into view, so nothing on the page jumps
as they arrive. A report fetches what it prints, a few at a time. A picture
that cannot be shown shows its caption, and a portrait photo turned by the
camera is laid out the right way up.

**The working file moves work between any two places.** Save a copy from the
desktop's folder and open it in a browser, or the other way round: it lands
byte for byte the same, pictures included, and pictures filed in a sub-folder
now travel too. A replace takes a snapshot first wherever a history is kept,
so what was there can be restored. The part of the app that reads working
files now loads in the background; if a deploy made it unreachable, you are
told and nothing changes, and the page is never reloaded over unsaved work.

**A scope that cannot be read whole can be put back.** If part of a scope
cannot be read, the scope opens to be looked at. Where the scope may be
written, its notice now offers **Bring in a working file…**, and **Put back
from the history…** where a history is kept. **Put back the
whole scope…** on the History page makes all of it what a snapshot held; what
could not be read is kept first, as an entry of the history or set aside beside
the scope, and nothing is put back where it cannot be kept. An entry that kept
what could not be read offers **Save what could not be read…**. A scope a later
version of the app wrote is only shown, with a note to update the app.

**Moves are in the history and in Activity.** Moving a scope is an entry in the
history of every scope it moved, and Activity lists it as *Moved from X to Y*,
with who moved it. Activity stays with the scope wherever it moves.

**Fixed**
- Selecting an element no longer counts as an edit. The category and group
  fields used to write themselves on every selection, marking the scope
  changed and adding a step.
- **Keep mine** replays your changes onto their version, and where that is
  refused it now writes the scope as it is on your screen over theirs, instead
  of refusing.
- Taking theirs, keeping yours and bringing work along each write what you
  have open first. A moment-old edit is no longer lost under what arrives.
  Where their version changed and nothing here did, this no longer refuses.
- **Bring your work into this folder?** stays open until the copy is done,
  then says how many scopes were copied, which could not be, and which were
  left because they changed meanwhile. Scopes that failed are offered again,
  with **Try again** and the next time you choose the folder.
- A File-menu command sent while the desktop window was still starting (a
  recent folder, a document opened from Finder) was dropped. It is now held
  until the window is ready.
- Every desktop window now saves before it closes over unsaved work, and asks
  only if that save did not work. This used to hold for the first window
  only. A document opened from Finder with every window closed gets a window.
- **Close anyway** closes the window. It used to leave it open.
- A window whose page held a close waits for the page's own save before it
  closes.
- An example is filed under a scope of its own where the organisation could
  not be read whole, rather than landing over it.
- Opening a working file onto a scope that could not be read whole says that
  it puts the scope back, and keeps what could not be read.
- A pull or push that git was not run for says why, in its own words, instead
  of saying the folder has no remote.
- Copying an example never takes over an organisation that holds work. An
  organisation with no name and no board that still holds records, such as
  an application or a decision, now gets the example filed under a scope of
  its own. In a folder the organisation goes by the folder's name, and an
  example copied into a new folder is filed under it.
- A move or a working file that is refused leaves everything as it was:
  references and pictures stay where they were, and scopes made for it are
  removed only where nothing was done to them since.
- A snapshot is never recorded over a save that was refused.
- On the desktop, a history that could not be read or written, git missing
  or too old, and a git refused in the folder are said in a sentence of their
  own, instead of an error message from the app's internals.

**For an agent:** `image.upload` answers `![alt](image:<name>)`, and
`images.list` names each picture the same way: a picture is named, not given
a path, wherever the work is kept.

**On disk:** the format is still 8, and a 3.2.1 folder and its snapshots open
as they are. A snapshot is now a commit with a `Lionsville-Scope:` trailer
naming each scope it covers, and a scope's `scope.json` gains an `id` the first
time the app writes it. Where the folder keeps a history, a move is one commit
whose `Lionsville-Moved-From:` trailer names where each scope was, beside the
`Lionsville-Scope:` trailer that names where it is now. A file that could not
be read is set aside as `<name>.unread` beside it before a put back writes over
it. What the app
remembers about a folder's steps is kept in its own data folder, never in
yours.

The reasoning is ADR-0031 in `docs/decisions/`.
