# ADR-0034 — A drawing is a view, drawn in draw.io, and points at the model

* Status: accepted, 8 October 2026; amended 10 October 2026 (what the code
  already does, settled before the build); as built, 11 October 2026, in this
  repository: the view kind, the editor on the desktop, the links, the
  anchors and the documents — a provider's own drawing origin is not built
  here (see *As built*)
* Date: 2026-10-08
* Deciders: Wouter Simons
* Extends: ADR-0009 (a document that computes: a document can show a view),
  ADR-0012 §6 (views apart from geometry: a view whose content is a drawing),
  ADR-0016 (a view is a tab: a drawing is one more)

## Context and Problem Statement

Every view the app has is drawn from the model. A board places elements that
exist; a sheet, a map and a technology landscape are laid out from them. That
is the point of them, and it is also their limit. An architect who wants a
picture the model does not hold — a context diagram with the people around a
system, a deployment sketch, a flow with annotations, a C4 component view
inside one application — draws it somewhere else, pastes a screenshot into a
document, and from then on the picture and the model drift apart. Nothing in
the app knows the picture shows the application it shows.

Three places want such a picture:

* **A scope**, under a name the person gives it — the organisation, a domain,
  a programme. A scope's tabs are its views, and a drawing would be one more.
* **An application.** A container view already hangs from an application
  (`applicationElementId`, `model/containerDiagram.ts`); there is no view for
  the level below it, nor for the context around it.
* **A document.** A document can show a picture from the library
  (`image:`) and a block it computes (`mermaid`, `bpmn`), but no view of the
  model and no drawing that stays editable.

draw.io is a general diagram editor, Apache-2.0, that runs entirely in a page
and can be embedded in a frame and driven by messages: the host loads a
diagram's XML, the editor answers with the XML when it is saved, and it can
export the diagram as an SVG with the XML inside it. It ships the C4 shapes.

## Decision Drivers

* The model stays the one place where things are said. A drawing may point at
  an element; it never creates, renames or removes one.
* One way to make a change (ADR-0002): saving a drawing is a command with an
  inverse, in the Activity list and the history like any other.
* No code from somewhere else runs in the app's window, and no frame is
  allowed in it from anywhere else (`electron/main/csp.ts`). The desktop
  works offline.
* A drawing is read far more often than it is edited. Reading one must not
  load an editor of several megabytes.
* An agent can do what a person can (ADR-0011), as far as a screen is not
  needed.
* Text files a person can read (ADR-0003): a drawing is kept as text, not as
  an opaque blob.

## Considered Options

1. **Embed `embed.diagrams.net`** in a frame. Nothing to ship. But it is a
   frame from somewhere else, it needs the network, and the desktop's policy
   forbids it on purpose.
2. **Draw such pictures on a board** by adding free shapes and text to the
   board's canvas. One editor. But it is a second diagram editor to build,
   and a board's shapes are the model's elements: free shapes on it blur the
   line the boards keep.
3. **Ship draw.io with the app, on an origin of its own, as the editor of a
   new view kind; keep the drawing's XML as the view's content and an SVG made
   at each save as its picture; let a shape point at an element.** The editor
   is loaded only to edit. Reading is the picture.
4. **As 3, with a drawing that edits the model**: a shape for an element is
   the element, and drawing one adds one. Two editors of one model, and every
   difference between them a conflict to resolve.

## Decision Outcome

**Option 3.**

### 1. A drawing is a view

**A new view kind, `drawing`**, beside `layer7`, `container`, `sheet`, `map`
and `technology`. It is neither a board nor laid out: its content is draw.io's
XML, and it has no geometry file. Like every view it has a name the person
gives it, a place among its scope's tabs, and an id from the shared namespace
(ADR-0002).

A drawing may be **anchored to an element** (`elementId`), as a container
view is to its application, and may say which **C4 level** it shows
(`c4Level`: `context`, `container`, `component` or nothing). An anchored
drawing is listed with its element: in the element's documentation and in
what a double-click on it offers. Nothing branches on the level; it is a
label, as a scope's kind is.

*Amended 10 October 2026.* Adding the kind makes every switch on a view's
kind exhaustive, or the place records why a drawing is not one of its cases.
The amendment below says which.

### 2. What is kept

* **The XML**, uncompressed, in `diagrams/<id>.drawio` beside
  `diagrams/<id>.json`. It is text, and a diff of it is readable.
* **The picture**: an SVG exported by the editor at each save, kept by its
  content address the way a picture in the library is (ADR-0031 §3), and
  named in the view's definition (`picture`).
* **The links' places** (§4), computed from the XML at each save and kept in
  the view's definition.

**Saving is one command**, `diagram.update` with the XML, the picture's
address and the links, replacing the three together. Its inverse puts the
earlier three back. Two people saving one drawing at once write the same
keys; the second is refused as an overlap, and the editor then offers
draw.io's own merge of the newer drawing with theirs before saving again.
There is no merge below the drawing.

*Amended 10 October 2026.* The picture is read by its content address, and
the sweep keeps every address a drawing in the head names. The three are
written under one key, `diagram/<id>/drawing`; the refusal of a second save
is the channel's. An inverse that names bytes already swept shows *not drawn
yet*. The amendment below says each.

The scope format's version goes up by one, and an older scope reads with no
drawings.

### 3. Where draw.io runs

**draw.io is shipped with the app**, as a dependency with its line in
`build/dependencyPolicy.ts` and in `THIRD-PARTY-NOTICES.md`, and is outside
the bundle budget because it is not part of the bundle: it loads only when a
drawing is edited.

**It runs on an origin of its own**, never on the app's. A frame on the
app's origin with scripts allowed can reach everything the app can.

* **On the desktop**, a second scheme served by the main process from the
  shipped files, with its own policy. The app's window allows frames from
  that scheme and from nothing else (`frame-src`); no hook can widen it.
* **In the web build**, an origin named in the build's configuration, served
  with the same files. A build that names none offers no editor: drawings are
  still shown, and *Edit* says it is not available here.

*Amended 10 October 2026.* The drawing scheme joins the one
`registerSchemesAsPrivileged` call, beside `app`, and `frame-src` is written
by core. A frame's navigation is kept on the scheme. The web origin is a
provider part, `ProviderParts.drawingOrigin`, beside `shareAddress`. The
amendment below says each. The web build this repository releases names no
origin: drawings are shown there, and *Edit* says the editor is not
available.

**It is started closed off**: embedded, with the JSON protocol and its
configuration from the app, without its own network use, without opening
windows, in the app's language. The configuration gives it the app's colours,
the C4 shapes, and the scope's elements as shapes (§4).

### 4. A shape may point at an element

**A shape points at an element by its id**: the shape carries
`link="element:<id>"`, the same reference a document uses, and
`lvElement="<id>"`, which says the link is the app's own. A shape points at
an element of the drawing's own scope or at a stand-in it holds.

* **Dragged in from the scope's elements**, a shape points at its element
  from the start, labelled with its name and styled by its kind.
* **Any shape can be pointed** at an element by *Link to element…*, which
  sets both attributes.

**A drawing is read as its picture**, as an image, so nothing inside the SVG
runs. Over it lies one transparent area per pointing shape, at the place
worked out from the XML at save time; choosing one opens the element where it
is, through the destination `app.open` takes (ADR-0019). Inside the editor a
link opens nothing until the drawing is saved or left.

**The model stays the one place.** A shape that points at an element is not
the element: removing the shape removes nothing, and drawing one adds
nothing. When a drawing is opened in the editor, the labels of pointing
shapes are set to their elements' names as they are now. **A shape that
points at an element that is not there is a finding** of the checks, and an
element says which drawings point at it.

*Amended 10 October 2026.* The organisation index never reads views, so the
finding and the list are the drawing's own scope. A drawing in another scope
that pointed here is left open. The amendment below says so.

### 5. A document shows a view

**`![caption](view:<id>)`** in a document shows the view with that id from
the document's scope, the way `image:` shows a picture. For a drawing it is
the picture with its links; the other kinds follow when they can make a
picture of their own. A view that is not there shows its caption and says
so. A view is referred to, not copied: the document always shows the drawing
as it was last saved.

### 6. An agent

`diagram.create` takes `drawing`, with an optional anchor and level;
`diagram.update` takes the XML; `views.list` and `diagrams.list` report the
kind, the anchor and what the drawing points at; search finds a drawing by
the text of its labels. An agent writes XML only. A picture is made by the
editor, so a drawing an agent wrote, or changed, says *not drawn yet* until a
person next saves it in the editor; its links are worked out from the XML
straight away. `app.open` opens a drawing as it opens any view.

### Consequences

* Good: pictures the model cannot hold are made in the app, kept in the
  scope's history, and shown in documents without being copied.
* Good: a box in a picture leads to the element it shows, and the checks say
  when it no longer can.
* Good: a drawing anchored to an application gives the C4 levels the boards
  do not have.
* Good: reading a drawing costs one image; the editor is paid for only by
  someone editing.
* Bad, accepted: a large dependency to ship and to keep current, and a second
  origin to serve wherever the web build is served.
* Bad, accepted: a drawing is saved whole. Two people editing one drawing
  merge by hand, in the editor.
* Bad, accepted: a drawing an agent writes has no picture until a person
  saves it.
* Neutral: a shape's label can differ from its element's name between two
  openings; the element's name wins at the next.

### Confirmation

* A round trip through the folder and the sealed file keeps a drawing's XML,
  picture and links byte for byte; an older scope reads without drawings.
* `diagram.update` on a drawing and its inverse restore the earlier three.
* The links' places worked out from an XML with nested groups land on the
  shapes in the exported SVG.
* The desktop's policy allows frames from the drawing scheme alone; the
  drawing scheme's own policy allows no network.
* A pointing shape at a removed element is a finding; `view:` to a removed
  view shows its caption.
* The desktop's smoke run: a drawing created, a shape dragged in from the
  elements, saved, and its area opens the element.

## Amended — what the code already does, settled before the build

*10 October 2026.* A read of the desktop policy, the picture seam, the write
keys, the organisation index, the web build and the switches on a view's kind
found six things this record had not yet said. Each is settled here, before
the build. How an environment serves the drawing origin — a second name on
its own app, the files alone, no session — is that environment's record, not
this one. This repository's web build names no such origin.

### The desktop's policy forbids frames, in writing

`electron/main/csp.ts` folds a hook's origins into `connect-src` and, where
the hook said so, `img-src`. The comment there says nothing reaches
`script-src`, `style-src`, `worker-src` or `frame-src`, and there is no seam
that would let it. The drawing scheme is this repository's own and fixed, so
`frame-src drawing://local` is written by `contentSecurityPolicy` itself, and
the comment says that the one frame it allows is that scheme and that a hook
cannot name another. A hook's origin still reaches neither `frame-src` nor
`script-src`.

Electron allows one `protocol.registerSchemesAsPrivileged` call, and it has
to precede `ready` (`electron/main/index.ts`). The drawing scheme is
registered in that same call, beside `app`, with the privileges a framed
page needs (`standard`, `secure`, `supportFetchAPI`). A second call would
replace the first and drop the app scheme.

Nothing watches a frame's navigation today. The main process handles
`will-frame-navigate` and keeps the frame on `drawing://`: a navigation to
any other scheme is cancelled. The scheme's own handler serves the shipped
files and answers anything else with a refusal, and the policy on those
files allows no `connect-src` and no frame of their own.

### A picture is found by name, and unnamed bytes are swept

`ImageRepository.bytes` answers one picture by its name in the library.
`sweepUnnamed` (`adapters/repositories/imageNames.ts`) lets go of bytes no
library entry names, a day after they were put. A drawing's picture has no
library name: the view holds the content address.

The seam therefore answers bytes by content address as well as by name, and
the contract beside it says so. The sweep keeps every address a drawing in
the head names, the way it keeps an address the history names. Bytes a
drawing no longer names, and that the library and the history do not name
either, are swept as unnamed bytes are.

An inverse puts the earlier address back and does not put the bytes back. An
address the sweep has already taken is not there, and the drawing shows
*not drawn yet* — the same words a drawing an agent wrote shows, until a
person next saves it in the editor. The editor puts the picture again then,
as it does for any save.

### The overlap refusal is a channel's

Core reports the keys a command writes (ADR-0028) and does not decide that
two steps overlap. That decision is the channel's, made from those keys
(`ports/CommandChannel.ts`).

A drawing's XML, its picture's address and its links are one fact saved
together, so `diagram.update` of a drawing writes them under **one key**,
`diagram/<id>/drawing`, rather than one key per field. A channel that
refuses an overlap then refuses the second save of that drawing whole. The
editor's answer to the refusal is unchanged: it fetches the newer drawing
and offers draw.io's own merge before saving again.

### The organisation index never reads views

`projects/scopeIndex.ts` indexes a scope's records and rows. A view is not
among them, and loading every view of the tree to answer one element's card
is the cost that index exists to avoid.

A shape points at an element of the drawing's own scope, or at a stand-in
that scope holds, which is already this record's rule. The check for a
pointing shape whose element is gone is therefore that scope's own check,
read from the scope's views. *Drawings that point at it* on an element lists
the drawings of the element's own scope. A drawing in another scope that
pointed at the element, and a document that embedded a view from another
scope, stay open until asked for.

### The drawing origin is a provider part

The web build has no `VITE_*` value and no `define` that names an origin.
Whoever serves a page already hands it what this repository does not know —
`ProviderParts.shareAddress` is that seam for a link (ADR-0033, amended).

The drawing origin is the same kind of fact. `ProviderParts.drawingOrigin`,
beside `shareAddress`, answers the origin the frame loads, or `undefined`
for *not available*. It is asked when a drawing is edited, not baked into
the bundle. Absent, or answering `undefined`, the drawings are still shown
and *Edit* says the editor is not available. The web build this repository
releases supplies none. A provider that serves the files on an origin of its
own supplies the origin; the files, the host and the certificate are that
provider's.

### Every switch on a view's kind is exhaustive

A view's kind is a union, and a switch that ends in `never` fails to compile
when a member is added. Several places compare instead, so a new kind would
fall through with the compiler quiet. The ones a read found:

* `isBoardKind` and `isLaidOutKind` (`model/placement.ts`)
* `viewPage` (`agent/screen.ts`)
* `LAID_OUT_KINDS` (`documentation/documentation.ts`)
* `LAID_OUT_LABEL` (`app/organisation/BoardsTable.tsx`)
* `VIEW_LABEL` (`search/ui/GlobalSearchDialog.tsx`)
* `useViewSelect` (`app/useViewSelect.ts`)
* the toolbar's lists of sheets, maps and technology views
  (`editor/EditorToolbar.tsx`)
* the page a view opens on (`agent/shell.ts`, through `viewPage`)
* the sort that puts boards before laid-out views (`projects/scope.ts`)
* the editor's `laidOut` test (`editor/SolutionDesignEditor.tsx`,
  `editor/useEditorState.ts`)

Each of these becomes a switch the compiler checks, or the place records
why a drawing is not one of its cases — a drawing is not a board, not laid
out, and not a technology view, and the record of that is a case that says
so rather than a comparison the next kind falls out of. A comparison that
is about one kind and one fact (`diagram.kind === 'container'` beside
`applicationElementId`) stays a comparison: it is not a classification of
every kind.

## As built — 11 October 2026

What landed, and where the build departed from the text above and why.
Each part is checked by the suite and by the desktop's smoke run, which
drives the real, pinned draw.io on `drawing://local`.

### Shipping the editor

* **The pin, and the files.** `drawioPin` in `build/dependencyPolicy.ts`
  names draw.io 32.4.1, the asset `draw.war` and its sha256, beside the
  rest of what the app is built from. `build/fetchDrawio.ts` reads that pin
  and keeps no copy of it; the notices are written from the same pin, and a
  test holds the three together.
* **What is kept of the archive.** The war unpacks to 110 MB in 3318 files.
  The file list (`DRAWIO_FILES`) is what Chromium asked for when it framed
  the editor with the query below and loaded, saved, exported and inserted
  a shape — sixteen files — plus the Dutch and German languages the frame's
  `lang` asks for. About 20 MB. The image libraries, templates, other
  languages and viewers are not needed for any of that, and C4 is in the
  shape and stencil bundles.
* **`extraResources`, not the asar.** `app.min.js` alone is 9.7 MB, over the
  renderer's per-file budget, and it is not the app: the asar stays the
  renderer's bundle, and the editor is a directory beside it that the
  drawing scheme's handler reads with plain file reads. The web bundle never
  contains it, so no bundle budget was raised.
* **Fetched once, then offline.** The archive is kept in a cache outside the
  tree, checked against the sha256 each time it is read; the pruned tree
  carries a stamp of what it was made from and is left alone when it is the
  pin's. After one fetch the smoke run and a pack need no network. A pack
  is refused when the tree is missing or not the pin's.
* **`PreConfig.js` names the drawing origin.** `stealth=1` turns off the
  editor's integrations, but it does not retarget the addresses the editor
  keeps for itself: with `DRAWIO_BASE_URL` and `DRAWIO_LIGHTBOX_URL` left
  `null` the editor falls back to diagrams.net's own hosts, which a later
  action builds an embed or a lightbox from. The pruned copy sets both to a
  placeholder the server of the files writes its own origin over
  (`drawing://local` on the desktop), and `EXPORT_URL` stays `null`. The
  fetch refuses a release whose `PreConfig.js` no longer takes that
  rewrite.
* **No `libs=` in the frame's query.** In this build `libs=` replaces the
  configured default libraries, so a frame opened with it shows C4 and not
  the scope's elements. The query is `embed`, `proto=json`, `configure`,
  `stealth`, `suppressNewWindows`, `keepmodified`, `ui=min`, `lang` and
  `dark`.
* **The notices** carry the Apache licence's text, which §4(a) asks to go
  with every copy and which the archive does not ship at its top, and the
  libraries the pruned bundles carry, as their own headers name them.

### Where the editor runs

* **The drawing scheme reads its own files.** §3 said the drawing scheme's
  policy allows no `connect-src`. With `connect-src 'none'` the real editor
  never finishes loading: it reads its languages (`resources/dia*.txt`) with
  a request to its own origin. The policy is `connect-src 'self'`; the origin
  serves the pruned files and nothing else, so that reaches no network, and
  the smoke run hears no request leave the machine. `frame-ancestors
  app://local`: only the app frames the editor.
* **Frames the editor makes inside itself.** A navigation inside the drawing
  frame to `about:blank`, `about:srcdoc`, its own `blob:` or `data:` is
  allowed — documents that never leave the machine, which the editor builds
  for a preview or a measurement. The frame the app holds stays on the
  drawing scheme.
* **The frame is sandboxed** to `allow-scripts allow-same-origin`: no
  popups, no downloads, no navigation of the app. The editor loads, saves,
  exports and exits with these alone.
* **One drawing origin for many pages.** Nothing ties the drawing origin to
  one app origin: a provider may hand one drawing origin to every page it
  serves. A message is posted to the drawing origin, and one is heard only
  when it comes from the frame's own window and from the drawing origin. On
  the desktop the origin is always `drawing://local`, whatever a source
  names, because the window frames nothing else.

### The protocol

* **The XML kept is the save's.** draw.io compresses a page unless it is
  told not to, and its export's copy of the XML is compressed whatever it is
  told. The configuration sends `compressXml: false`, and a save keeps the
  XML the save event carried; a compressed one is not kept, because its
  links would read empty. An agent's compressed XML is refused. The links
  and the prose are read from the first page.
* **Saves in order.** Two saves export twice; one whose export is overtaken
  by a later one before its step is written is dropped.
* **Leaving.** The editor's *Exit* closes it, after draw.io's own question
  when there are changes no save kept; `keepmodified` holds that flag until
  this side says the save landed. *Save & Exit* closes once the save has
  landed.
* **Labels from the model.** As §4 says, the editor opens with every
  pointing shape labelled as its element is called now.

### A refusal, and a change from somewhere else

§2 and the amendment say the editor answers an overlap refusal by fetching
the newer drawing and offering draw.io's merge. A save's command does not
come back with a channel's refusal — that arrives later, as the model going
back to the newer drawing. So the editor watches the drawing the model holds
from the moment it opens, and whenever that becomes one it did not write —
somebody else saved, before or after its own first save, or a channel
refused its save — the newer drawing is handed to draw.io's `merge`. That is
the one path; there is no separate answer to the refusal.

### The picture

* **Where a shape is on the picture.** draw.io's `xmlsvg` export does not
  draw the page: it draws the shapes' bounding box, moved so its top left is
  the picture's origin. The areas are laid on a frame whose origin is where
  the shapes begin — every drawn vertex, ancestors summed, and every point an
  edge names — and whose size is the export's viewBox. A label drawn outside
  its shape, or a thick stroke, widens draw.io's own box a little further
  than that, and an area is then off by as much. Held to a real export of
  the pinned editor (`model/testing/drawio`), and in the smoke run to the
  rectangle draw.io drew.
* **The app's theme.** The editor opens in the app's resolved theme (`dark`)
  and, when the theme changes while it is open, is asked for the drawing as
  it is and loads it again in the new one, still unsaved where it was. The
  export draws in adaptive colours, and an SVG shown as an image resolves
  them by the image's own `color-scheme`, which is set from the app's
  resolved theme: one picture, right in both.
* **Kept by a folder.** A drawing's picture is
  `images/.drawings/<digest>.svg`, named by its content address, written
  with the step that names it and removed once no drawing in the head names
  it. A dot folder, so the library never lists it. A working file and a
  sealed file carry it the same way and a landing puts it before the step
  that names it. The image repository's contract says it: bytes put, a step
  naming the address in a drawing, and repositories made again over the same
  store answer them by address.

### The model

* **Deleting an element takes the anchor off a drawing anchored to it**, in
  the same step, and the inverse puts it back. The drawing stays: it is a
  picture somebody drew, not a view of the element's insides, which is why
  a container view goes and a drawing does not.
* **A finding about a shape says its drawing** (`Finding.view`), and opening
  it opens the drawing rather than an element that is not there.
* **A deleted diagram's history** names both a geometry file and a `.drawio`,
  because it may have been either.
* **A read-only view** offers no *Edit*.

### Not built here

A provider that serves the editor's files on an origin of its own supplies
that origin through `ProviderParts.drawingOrigin`; this repository's web
build supplies none. That provider's files, host, certificate and headers
are its own record.

