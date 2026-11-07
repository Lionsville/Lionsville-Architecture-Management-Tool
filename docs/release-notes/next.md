# Release notes, next version — draft

*What has landed since 3.8.2 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

## Help

- The manual lives in the app now: one document in English, Dutch and German, with a section for every function the app offers, a worked example and a small picture of the screen per chapter, and a search over all of it (`/` to search, Enter to go). It follows light and dark and the language you read in, and needs no network.
- On the desktop, **Help › Open the help** opens it in a window of its own, also with nothing open; in a browser, **Help › Open the help** in the top row or **⋯ › Open the help** opens it beside the app. Places that explain more open it at their own section.
- It is at [app.architecture.lionsville.nl/help/](https://app.architecture.lionsville.nl/help/) for anyone, with nothing installed and nothing signed in. Every section has an address, `help/#frame.back` or `help/?lang=de#board`, for a link, a bookmark or an agent.
- The markdown manuals (`docs/manual.en.md`, `.nl.md`, `.de.md`) are gone; what they said is in the help. *User Manual* in the Help menu is **Open the help**.

## First run, files and settings

- An organisation nobody has started opens on a first page: name yours, look around the example, or carry on with what you have, with where work will be kept said before any exists. The language is on it. The desktop's first screen says an empty folder is fine, and has the language too.
- The example is a place you visit: nothing there is kept, your work is untouched, and **Keep this as my start** or **Leave the example** is on every screen of it. It is at `?example=<key>`. **Breaking for scripts:** the `copy-example` test id and *Copy into this folder…* are gone.
- *Working file* and *seal* are *a saved copy* and *password* on screen; `.lvarch` stays. Saving a copy says what it holds, and *People in the copy* is a choice with its effect.
- Opening a file says what is in it and what would happen here. Where no history is kept and nothing else can be chosen, the danger is said in full, with a way to save a copy first. Where nothing has been made, it just opens.
- The word in row one says the state and the place on every screen, and opens **Your work**: what can lose the work, when a copy was last saved, and what moves it, a folder's remote and a scope that changed elsewhere or could not be read among it.
- A scope's settings are one page at `#/<scope>/-/settings`; each change lands by itself and can be undone, and moving asks. Preferences are a page at `#/-/preferences`, with what the canvas remembers and a density switch. The theme left the web's ⋯ for them.
- Every question is one dialog family. Export picture is in the ⋯ with a board up, and fills in the title block beside its preview.

## One frame, one look

- Every screen sits in one frame of two rows. Row one says where you are and whether your work is safe, with **Find or run a command** (⌘K), Activity, the agent, the text size and Help; row two lists every place in the scope you are in. Pages are places with an address: Back, Forward, a link and an agent reach them, and none lies over the board any more.
- A new look, sheet and blueprint, with Source Sans 3 and Source Code Pro bundled. Light and dark both, and a text size from 90 to 150 percent in the top row that every screen follows.
- The tree of scopes is docked on a home, says how much each scope holds, folds to a chevron over your work, and can be dragged wider. A home is one-line rows: the views here, what is kept here, and what it does not hold in one line of names. A home's top row lists no views; *Views here* is the way in.
- *Continue* on the organisation's home goes back to the places you last worked in.
- One list everywhere: a row is the item and nothing else, a large preview opens on selecting one, and what narrows a list is said in words. One panel for whatever is picked, its rows pressed to edit. A record opens whole as a document and is edited in a full window.
- One markdown editor wherever you write, still plain text, with a toolbar, a guide to what it draws, and a preview one press away.

## Boards and canvases

- A board is neutral: the zone and domain tints are gone, an accent set by hand is a thin rail, and **Colour** answers one question at a time with a key along the foot. It reads at three distances: far off a name, closer what it does, close up what it is made of.
- The View bar says it in words: Add, Arrange, Show, Colour, Day, Find, Export. **Add** asks at the pointer: one field that finds what exists and names what is new. Picking a card lights its lines and lets the rest recede.
- One zoom on every canvas: ⌘ or Ctrl with + − 0, the wheel or a pinch, and the dock bottom left with − n% + Fit 100% Grid Map. A canvas opens readable.
- **Day** looks at another day read-only, with a band that says which day, and one press back. A Colour you choose is yours until *Keep with the view*.
- A container diagram says what it is, C4 labels on, its lines numbered where there is no room for words and listed whole under **Lines**; dense ones can be laid out in layers by category.
- **Confirmed or assumed** on an element and a line, in its panel; an assumed card is dashed.
- An application's owner is one field: pick a unit, or type a name, which is flagged as not a unit.

## The sheet, the map and the technology landscape

- The business architecture opens as a **poster**: every block in its place on one page, read from far off or close up. **Design** places blocks, tiles, free notes and pictures by hand, maps a team, an application or a subscope onto a tile by dragging it from a tray, and lays the poster out for a paper size. **Names** reads it as one-line rows, and **Coverage** is the enterprise map in the sheet's own tab. It prints on one page as a PDF or a PNG.
- Colour and Day reach the sheet and the technology landscape. An organisation can rate functions on a numeric scale per aspect (1 to 5 unless said, set by an agent), and the sheet colours a capability heat map from it, always with the number.
- The technology landscape is three columns of one-line rows with a matrix one press away and a reader beside it.

## Pages

- Observations are a chain: **Seen, Why, Solve, Did it work**, each a list with a large preview, a ladder that asks why, and maps that open readable. *Noted* takes an observation off the waiting list with an optional reason, kept in its history.
- Decisions are read by whether they are in force: Still open, In force, Ended. A record is written a section at a time in a full window.
- The roadmap is a ruler with Weeks, Months, Quarters and Years, opens three months back and nine ahead, and after that where you left it. A plan is one document; a slip says what will move before it does.
- The register is one page with Applications, Services and Platforms. Checks is a work list, and a finding carries you to its field and back.
- People is a directory, one line each, a person a page of their own. *Mark as left* can be taken back until the name is forgotten, and the roles it ended come back. ⌘K finds people for anyone who can read the register.
- The operating model is read by question: Structure, Roles, Responsibilities, Exceptions, Libraries. The RACI opens on one group of responsibilities, with the whole organisation an option.
- The organisation chart is a tree with connectors, Levels, Lines with an Exceptions view, Focus and one find. The Conway map opens on a verdict and a grid of pairs.
- Principles, topics and building blocks are one entry, **Guidance**.
- A drawing wears the app's clothes: the app's own Save and Done, the links a drawing points at listed beside it with any that broke, and Export and Print from the bar.
- An agent's whole session can be taken back as one step while its steps are the newest, from the band that named it.

## Fixes

- Copying work from the browser into a folder brings all of it, the organisation's top level and every drawing's picture included, or says by name what did not come along.
- A write that fails leaves no empty file behind, which had read as damage and refused every later write of that scope.
- Every save says *saved* only once it has, and nothing when you closed the save dialog. A save asked for in a browser opens at once.
- An organisation the app cannot read says so, rather than drawing as empty.

## For scripts and other builds

- **Folder format 17.** A folder or a saved copy written by this version does not open in 3.x; everything older opens here and is brought up to 17.
- **Breaking:** stable control names (`data-guide`) removed: `chart.outlineAdd` and `chart.unfoldAll` (the controls that carried them on the chart's outline are gone; Levels unfold the chart), and `page.close` (a page is a place in the frame, left by Esc, Home, a view's tab or Back). Many names were added; none was renamed.
- **Breaking:** a page is no longer a dialog over the board, so a script that waited for one, or pressed its ×, will not find it.
