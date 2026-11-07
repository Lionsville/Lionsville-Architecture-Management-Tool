# Release notes, next version — draft

*What has landed on `main` since 3.8.1 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

## Fixed

- **Exporting a drawing from the editor saves a file.** *Export as* in the drawing
  editor did nothing, without a word, on the desktop and in a browser. PNG, JPEG,
  WebP, an animation as a GIF, SVG, XML and JSON now save a file named after the
  drawing, and the app says so once it has. PDF, URL, HTML and *Embed*, which
  could not produce anything usable from inside the editor, are no longer offered.
