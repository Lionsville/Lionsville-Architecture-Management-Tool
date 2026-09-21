# Release notes, next version — draft

*What has landed on `main` since 3.0.0 that a user would notice, in the user's
words. Pasted into the GitHub release when it is cut, and emptied then.*

## 3.0.1

- **Opening a working file asks where it goes.** Before this, a `.lvarch`
  was written over whatever you had open without a word — on the evening
  3.0.0 shipped, that turned a working folder into the shipped example.
  Now every working file is asked: *A new folder…* makes it a working folder
  of its own and takes you there, leaving what you had open untouched;
  *Replace … here* does what opening used to do, with the name of what it
  writes over on the button and the warning under it. A folder that already
  holds something is written over only after a second yes. Cancel does
  nothing.
- **What this machine does about a folder** — pull on open, push after a
  snapshot — is kept by the desktop itself now, not as a file in your
  working folder. An older build's `local.json` is still read; nothing of the
  app's is written into your folder any more. (Landed just before 3.0.0 and
  not in its notes.)
