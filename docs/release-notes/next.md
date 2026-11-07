# Release notes, next version — draft

*What has landed on `main` since 3.8.1 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

## Fixed

- **Exporting a drawing from the editor saves a file.** *Export as* in the drawing
  editor did nothing, without a word, on the desktop and in a browser. PNG, JPEG,
  WebP, an animation as a GIF, SVG, XML and JSON now save a file named after the
  drawing, and the app says so once it has. PDF, URL, HTML and *Embed*, which
  could not produce anything usable from inside the editor, are no longer offered.
- **Who recorded an observation follows the register.** The *Recorded by* column
  and the reader kept showing a name after that person was forgotten or removed,
  an agent given pseudonyms was told it, and a copy made without names carried it.
  They now read as everything else does: the pseudonym once forgotten, *a former
  colleague* once removed, the kept person after a merge. An agent's export no
  longer carries the account, and neither does a working file. *Points at them*
  and *What we hold* now list what somebody recorded. New observations hold no name
  where a person of the register answers for it; those recorded by 3.8.0 and 3.8.1
  keep theirs in the history, where nothing shows it. The working file's format
  turns to 16, so a 3.8.1 app asks for an update rather than dropping who recorded
  an observation when it saves.
