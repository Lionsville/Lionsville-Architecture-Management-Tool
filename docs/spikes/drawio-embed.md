# Spike — draw.io embedded, closed off

*10 October 2026. A throwaway branch for ADR-0034. Nothing here is the build.*

Pinned release: **draw.io v32.4.1** (8 October 2026), asset `draw.war`.

```
sha256  b83663313ccdecef6581476a7eaa96750bccf1bfdc3768981eb5d95e94be7820
```

Licence: Apache-2.0, the `LICENSE` at that tag. The unpacked war has no
top-level licence file; the bundles carry their own notices (DOMPurify names
Apache-2.0 and MPL-2.0). A hand entry in `THIRD-PARTY-NOTICES.md` has to
follow the tag, not the war alone.

The war unpacks to **110 MB** and 3318 files. Chromium, framing
`index.html` with

```
embed=1&proto=json&configure=1&stealth=1&suppressNewWindows=1
```

and no `dev=1`, asked for **16 files**. With English, Dutch and German that
set is **19.6 MB**:

| File | MB |
|---|---|
| `js/app.min.js` | 9.65 |
| `js/extensions.min.js` | 4.37 |
| `js/stencils.min.js` | 3.69 |
| `js/shapes-14-6-5.min.js` | 1.42 |
| `resources/dia.txt`, `dia_nl.txt`, `dia_de.txt` | 0.30 |
| `js/bootstrap.js`, `PreConfig.js`, `PostConfig.js`, `main.js` | 0.01 |
| `styles/grapheditor.css`, `high-contrast.css`, `mxgraph/css/common.css` | 0.09 |
| `images/github-logo.svg`, `images/logo-flat-small.png`, `favicon.ico`, `mxgraph/images/maximize.gif`, `index.html` | 0.02 |

`dia.txt` is the English bundle. There is no `dia_en.txt`. Dutch and German
were not in the first load; they are named here because the frame's `lang`
fetches `resources/dia_<lang>.txt` when it is not English.

The other 90 MB is the image libraries, the templates, `WEB-INF`, the other
languages, and the viewers. None of it was requested for load, save, export
or inserting a shape. C4 is in the stencil and shape bundles, not a separate
fetch.

## What was driven

A page on `127.0.0.1` framed the unpacked editor. The host spoke the JSON
protocol: `configure`, then `load` of an `mxGraphModel` whose only cell is
labelled Quay, then `export` with `format: "xmlsvg"`, then the Save button.

- `configure`, `init`, `load`, `export` and `save` all arrived.
- The save is an `mxfile` whose model contains Quay.
- The export is an SVG data URI. Decoded, the SVG contains Quay and an
  `mxfile` in its `content` attribute.
- `lang=nl` paints **Opslaan**, **Vormen**, **Pagina-1**. `lang=de` paints
  **Speichern**. `lang=en` paints **Save**. The language is the frame's
  `lang`, which is the app's to set.

Chromium's request log for each of those passes listed no host but
`127.0.0.1`.

## Stealth holds for the session, and the base URL has to be pinned

`stealth=1` is what turns the external integrations off. In `app.min.js` it
sets the picker, Google, Dropbox, OneDrive, GitHub, GitLab, Trello and
Microsoft 365 parameters to `0`. With it, the session above made no request
off the origin.

It does **not** retarget the three URLs the editor keeps for itself. The
war's `js/PreConfig.js` sets `DRAWIO_BASE_URL` and `DRAWIO_LIGHTBOX_URL` to
`null` and `EXPORT_URL` to `null`. `null` is falsy, so the app then sets:

- `DRAWIO_BASE_URL` to `https://app.diagrams.net`
- `DRAWIO_LIGHTBOX_URL` to `https://viewer.diagrams.net`
- `EXPORT_URL` stays `null`, because the test is `typeof … === 'undefined'`
  and `null` is not undefined. Client-side `xmlsvg` does not use it.

Neither diagrams.net host was contacted while loading, saving, exporting or
inserting a shape. They are still the addresses a later action builds an
embed or a lightbox from (`EditorUi.drawHost`, `EditorUi.lightboxHost`).
draw.io's own desktop sets `DRAWIO_BASE_URL = '.'` so the online site cannot
be reached (`js/diagramly/ElectronApp.js`).

The copy we ship does the same in `PreConfig.js`, before `app.min.js` reads
it: `DRAWIO_BASE_URL` and `DRAWIO_LIGHTBOX_URL` are the drawing origin, and
`EXPORT_URL` stays `null`. With that pin the same session again made no
request off the origin, and the two fields read back as the origin itself.
`PostConfig.js` already sets `ICONSEARCH_PATH` and `ICON_SERVICE_PATH` to
`null`.

This does not overturn ADR-0034. "Without its own network use" is
`stealth=1` plus that pin. The pin is part of shipping the files, not a
second origin and not a hook.

## The palette holds, through `configure`

`configure` can hand the editor a library of the scope's elements. The
configuration that did it:

```json
{
  "defaultLibraries": "elements;c4",
  "enabledLibraries": ["elements", "c4"],
  "expandLibraries": true,
  "libraries": [{
    "title": { "main": "Scope" },
    "entries": [{
      "id": "elements",
      "title": { "main": "Elements", "nl": "Elementen", "de": "Elemente" },
      "libs": [{
        "title": { "main": "Elements", "nl": "Elementen", "de": "Elemente" },
        "expand": true,
        "data": [{ "xml": "<mxGraphModel>…</mxGraphModel>", "w": 120, "h": 60, "title": "Harbour" }]
      }]
    }]
  }]
}
```

The shape's XML is uncompressed and starts with `<`. A `UserObject` carries
`label` and `link="element:harbour"`. After `configure`, the sidebar's
visible palettes were **Elementen** (Dutch, from `lang`) with a shape
**Harbour**, and **C4**. Clicking Harbour inserted that object. The save
that followed contains:

```xml
<UserObject label="Harbour" link="element:harbour" id="…">
  <mxCell style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">
    <mxGeometry height="60" width="120" x="370" y="370" as="geometry" />
  </mxCell>
</UserObject>
```

So a shape dragged in from the scope's elements can point at its element
from the start, which is ADR-0034 §4. No picker is required for that.

One override to leave off the frame URL. `libs=` replaces
`defaultLibraries` when the editor's service name is `draw.io`, which this
build reports even on another host (`Sidebar.prototype.showEntries`). A
frame opened with `libs=c4` showed C4 and not the elements. The frame's
query is `embed`, `proto`, `configure`, `stealth`, `suppressNewWindows`,
`ui` and `lang`, and not `libs`.

`ui=min` and `ui=atlas` both loaded. `min` is the smaller chrome. `atlas`
also fetched `images/logo-flat-small.png`. Both fetches were on the origin.

## Where the files ride

**`extraResources`, not the asar.**

`electron-builder.cjs` packs `out/**` into the asar, and the renderer's
budget (`build/bundleBudget.ts`) fails a file over 5.6 MB. `app.min.js` is
9.7 MB. It must not be a Vite input, which ADR-0034 already says, and it
must not land in `out/**` either: that glob is the asar, and a later check
that reads `out/` would be reading the editor as if it were the app.

`extraResources` is a directory at `process.resourcesPath`. The drawing
scheme's handler reads it with ordinary `fs`, the way a war is a directory
of files. The installer grows by these 19.6 MB uncompressed wherever they
sit; this spike did not run electron-builder, so it does not report a
compressed installer delta. Notarization hashes the app either way. The
choice is that the asar stays the app.

The fetch-and-prune is a build step that downloads this war, checks the
sha256 above, and copies the file list in the table. It does not run inside
Vite.
