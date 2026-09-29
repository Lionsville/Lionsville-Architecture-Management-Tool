# Release notes, next version — draft

*What has landed on `main` since 3.2.0 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

**Security: the desktop app no longer lets a page reach a folder's `.git`, and
runs no program a folder's git names.** Until this release, the desktop's file
channel would read and write inside a working folder's `.git`. It runs git in
that folder. So something written there, such as a hook or a setting, could
become a program the app ran at the next snapshot. The channel now refuses
every path into `.git`, in any spelling: upper or lower case, with the
trailing dots or spaces Windows drops, by its short name, or through a link.
Every git the app runs is told to use an empty hooks folder of the app's own
and to start no file-system monitor. The hole predates this release. **Update
the desktop app.** Separately, a picture in SVG is now drawn from an address of
its own, so a script inside one never runs as the app, even when the picture
is opened in a tab of its own.

**Every place your work is kept now keeps a history.** Snapshot…, History…,
restoring and labels used to be the desktop's, and only where git was
installed. They now work in a browser too:
- a folder on the desktop keeps its history in git, as before;
- a browser keeps it in the browser, including for a folder a tab has open,
  where nothing is written into the folder for it;
- a private window keeps it for as long as the tab is open.

The first snapshot says where its history will be kept. On a desktop without
git, a snapshot is refused with a sentence saying to install it, instead of
the menu items quietly disappearing.

**Browser work is kept in the browser's own database.** It is sturdier and
larger than the storage it replaces. It keeps a scope's history compactly and
clears away pictures nothing uses any more. Work an earlier version kept in the
browser is copied over at every start, never moved and never over work done
since. Where a scope changed in both places, a strip asks about that one
scope: **Bring the older copy over** or **Keep what is here**. In a private
window, or anywhere the browser will keep nothing, the app now says so in the
bar in the warning colour, and shows that earlier work so you can save a
working file of it. If the browser's storage is slow to answer, the page is
drawn after a few seconds anyway and your work appears when it does, instead
of a blank page.

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

**Fixed**
- Selecting an element no longer counts as an edit. The category and group
  fields used to write themselves on every selection, marking the scope
  changed and adding a step.
- **Keep mine** lands what is on your screen, whole, even where one of your
  changes could not be laid over their version. It used to be refused.
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
  only if that save did not work. This used to hold for the first window only. A
  document opened from Finder with every window closed gets
  a window.
- Copying an example never takes over an organisation that holds work, such
  as an application or a decision with no board and no name. The example is
  filed under a scope of its own. In a folder the organisation goes by the
  folder's name, and an example copied into a new folder is filed under it.
- A move or a working file that is refused leaves everything as it was:
  references, new scopes and pictures included.
- A snapshot is never recorded over a save that was refused.
- On the roadmap, a plan's page and the service report, a name in a list opens
  what it names, by pointer and by keyboard.
- A lifecycle date typed out of order stays in its field, marked, with the
  reason under it, instead of vanishing.
- A plan's and a solution's gate lines say what they ask and which records
  hold them open.
- Porting an interface that had landed works, and *port all* never proposes
  a step it would then refuse.
- A board looked at on another day draws what is there that day, a stand-in
  is dated by the scope that defines it, and the service report counts who is
  stranded per row.
- A retirement finding counts only what still depends on what retires.
- A half-written answer in a dialog survives the page behind it saving, and
  the decisions page and the technology landscape stay on the record you moved
  to.
- Contrast: dark toasts, red buttons, chips and menus, tooltips, line labels,
  group names and the observations' seen count all read at the ratio the
  accessibility audit asks for.

**For an agent:** `image.upload` answers `![alt](image:<name>)`, and
`images.list` names each picture the same way: a picture is named, not given
a path, wherever the work is kept.

**On disk:** nothing about a folder changes; the format is still 8. A snapshot
is a commit with a `Lionsville-Scope:` trailer naming each scope it covers. A
scope's `scope.json` gains an `id` the first time the app writes it. What the
app remembers about a folder's steps is kept in its own data folder, never in
yours.

The reasoning is ADR-0031 in `docs/decisions/`.
