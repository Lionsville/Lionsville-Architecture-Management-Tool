/**
 * The transition table, case by case.
 *
 * Every awkward sync bug is one row here: changed while saving, changed while
 * dirty, changed twice before anyone answered, changed by us. The point of the
 * reducer is that these can be written down at all — none of them needs a file,
 * a watcher or a clock to check.
 */
import { describe, expect, it } from 'vitest'
import {
  AUTOSAVE_IDLE_MS, documentSession, emptySession, hasUnsavedWork, sameFile, shouldSaveNow,
} from './documentSession'
import type { DocumentEvent, DocumentSession, SaveFingerprint } from './documentSession'

const print = (over: Partial<SaveFingerprint> = {}): SaveFingerprint => ({
  path: '/work/acme.lvarch', mtimeMs: 1_000, size: 42, sha256: 'aaa', ...over,
})

/** Run a session forward through events, from a fresh one. */
function play(...events: DocumentEvent[]): DocumentSession {
  return events.reduce(documentSession, emptySession({ group: 'acme', project: 'landscape' }))
}

const attached = { type: 'attached', fingerprint: print() } as const

describe('attaching and detaching', () => {
  it('starts with no file', () => {
    expect(emptySession().status).toBe('no-file')
  })

  it('is clean the moment a file is bound', () => {
    const state = play(attached)
    expect(state.status).toBe('clean')
    expect(state.fingerprint).toEqual(print())
  })

  it('keeps editing possible before there is a file, without pretending to be dirty', () => {
    // There is nowhere to write yet, so "unsaved changes" is not a useful thing
    // to say: the shell's answer to saving from here is to ask for a file.
    const state = play({ type: 'edited' })
    expect(state.status).toBe('no-file')
  })

  it('forgets the file it was bound to when detached', () => {
    const state = play(attached, { type: 'edited' }, { type: 'detached' })
    expect(state.status).toBe('no-file')
    expect(state.fingerprint).toBeUndefined()
  })

  it('keeps the ref across a detach — the project outlives the file', () => {
    const state = play(attached, { type: 'detached' })
    expect(state.ref).toEqual({ group: 'acme', project: 'landscape' })
  })
})

describe('editing and saving', () => {
  it('goes dirty on an edit', () => {
    expect(play(attached, { type: 'edited' }).status).toBe('dirty')
  })

  it('stays dirty however many edits arrive', () => {
    expect(play(attached, { type: 'edited' }, { type: 'edited' }).status).toBe('dirty')
  })

  it('is saving while a write is in flight', () => {
    expect(play(attached, { type: 'edited' }, { type: 'saveRequested' }).status).toBe('saving')
  })

  it('is clean again when the write lands, and records what is on disk', () => {
    const landed = print({ mtimeMs: 2_000, sha256: 'bbb' })
    const state = play(attached, { type: 'edited' }, { type: 'saveRequested' },
      { type: 'saveSucceeded', fingerprint: landed })

    expect(state.status).toBe('clean')
    expect(state.fingerprint).toEqual(landed)
  })

  it('goes back to DIRTY when a write fails, never to clean', () => {
    // The edits exist only in this window until a write lands. Reporting clean
    // here is how an app loses work while telling the user it did not.
    const state = play(attached, { type: 'edited' }, { type: 'saveRequested' },
      { type: 'saveFailed', reason: 'EACCES' })

    expect(state.status).toBe('dirty')
    expect(state.lastError).toBe('EACCES')
  })

  it('clears the last error when the next save starts', () => {
    const state = play(attached, { type: 'edited' }, { type: 'saveRequested' },
      { type: 'saveFailed', reason: 'EACCES' }, { type: 'saveRequested' })

    expect(state.lastError).toBeUndefined()
  })

  it('does not start a second write on top of one in flight', () => {
    // Two overlapping writes to one file is how half a document ends up on disk.
    const state = play(attached, { type: 'edited' }, { type: 'saveRequested' },
      { type: 'edited' }, { type: 'saveRequested' })

    expect(state.status).toBe('saving')
    expect(state.editedWhileSaving).toBe(true)
  })
})

describe('an edit that arrives while the write is in flight', () => {
  it('leaves the session dirty when the write lands', () => {
    // The save wrote the model as it was when it started. The keystroke after
    // that is not in the file, so "clean" would be a lie — and the one nobody
    // would notice, because the app says everything is fine.
    const state = play(attached, { type: 'edited' }, { type: 'saveRequested' },
      { type: 'edited' }, { type: 'saveSucceeded', fingerprint: print({ mtimeMs: 2_000 }) })

    expect(state.status).toBe('dirty')
    expect(state.editedWhileSaving).toBe(false)
  })

  it('still records what landed on disk', () => {
    const landed = print({ mtimeMs: 2_000, sha256: 'bbb' })
    const state = play(attached, { type: 'edited' }, { type: 'saveRequested' },
      { type: 'edited' }, { type: 'saveSucceeded', fingerprint: landed })

    // Or the next watcher tick reports our own write as somebody else's.
    expect(state.fingerprint).toEqual(landed)
  })

  it('does not carry the flag into the next save', () => {
    const state = play(attached, { type: 'edited' }, { type: 'saveRequested' },
      { type: 'edited' }, { type: 'saveSucceeded', fingerprint: print({ mtimeMs: 2_000 }) },
      { type: 'saveRequested' }, { type: 'saveSucceeded', fingerprint: print({ mtimeMs: 3_000 }) })

    expect(state.status).toBe('clean')
  })
})

describe('a change that came from us', () => {
  it('is ignored — every save round-trips through the watcher', () => {
    const landed = print({ mtimeMs: 2_000, sha256: 'bbb' })
    const state = play(attached, { type: 'edited' }, { type: 'saveRequested' },
      { type: 'saveSucceeded', fingerprint: landed },
      { type: 'externalChangeDetected', fingerprint: landed })

    expect(state.status).toBe('clean')
  })

  it('is not confused with a real change that happens to share an mtime', () => {
    const landed = print({ mtimeMs: 2_000, sha256: 'bbb' })
    const theirs = print({ mtimeMs: 2_000, sha256: 'ccc' })
    const state = play(attached, { type: 'saveRequested' },
      { type: 'saveSucceeded', fingerprint: landed },
      { type: 'externalChangeDetected', fingerprint: theirs })

    expect(state.status).toBe('external-changed')
  })

  it('compares all four fields, because no one of them is enough alone', () => {
    expect(sameFile(print(), print())).toBe(true)
    expect(sameFile(print(), print({ path: '/elsewhere.lvarch' }))).toBe(false)
    expect(sameFile(print(), print({ mtimeMs: 2 }))).toBe(false)
    expect(sameFile(print(), print({ size: 43 }))).toBe(false)
    expect(sameFile(print(), print({ sha256: 'zzz' }))).toBe(false)
    expect(sameFile(undefined, print())).toBe(false)
    expect(sameFile(print(), undefined)).toBe(false)
  })
})

describe('a change that came from somebody else', () => {
  const theirs = { type: 'externalChangeDetected', fingerprint: print({ mtimeMs: 9_000, sha256: 'zzz' }) } as const

  it('is answerable by reloading when we have nothing unsaved', () => {
    expect(play(attached, theirs).status).toBe('external-changed')
  })

  it('is a conflict when we have unsaved edits', () => {
    expect(play(attached, { type: 'edited' }, theirs).status).toBe('conflict')
  })

  it('is a conflict when a write of ours is in flight', () => {
    // Whatever that write does, there are now two versions of the document.
    expect(play(attached, { type: 'edited' }, { type: 'saveRequested' }, theirs).status).toBe('conflict')
  })

  it('is ignored entirely when no file is attached', () => {
    expect(play(theirs).status).toBe('no-file')
  })

  it('does not escalate when reported twice before anyone answers', () => {
    const twice = play(attached, theirs, {
      type: 'externalChangeDetected', fingerprint: print({ mtimeMs: 10_000, sha256: 'yyy' }),
    })
    expect(twice.status).toBe('external-changed')
  })

  it('does not escalate when reported again during a conflict', () => {
    const state = play(attached, { type: 'edited' }, theirs, {
      type: 'externalChangeDetected', fingerprint: print({ mtimeMs: 11_000, sha256: 'xxx' }),
    })
    expect(state.status).toBe('conflict')
  })

  it('becomes a conflict as soon as we type after hearing about it', () => {
    expect(play(attached, theirs, { type: 'edited' }).status).toBe('conflict')
  })

  it('becomes a conflict rather than letting a save clobber theirs', () => {
    // Writing over a file we have been told is newer is the one way to destroy
    // somebody else's work without ever being asked about it.
    expect(play(attached, theirs, { type: 'saveRequested' }).status).toBe('conflict')
  })

  it('is settled by loading their version', () => {
    const reloaded = print({ mtimeMs: 9_000, sha256: 'zzz' })
    const state = play(attached, theirs, { type: 'reloadAccepted', fingerprint: reloaded })

    expect(state.status).toBe('clean')
    expect(state.fingerprint).toEqual(reloaded)
  })
})

describe('resolving a conflict', () => {
  const theirs = { type: 'externalChangeDetected', fingerprint: print({ mtimeMs: 9_000, sha256: 'zzz' }) } as const
  const conflicted = [attached, { type: 'edited' } as const, theirs]

  it('keeping mine leaves work still to be written', () => {
    // Not clean: ours is not on disk yet, and a session that says clean here
    // never saves, so their version quietly wins.
    const state = play(...conflicted, { type: 'conflictResolved', resolution: 'mine' })
    expect(state.status).toBe('dirty')
  })

  it('taking theirs is clean, against their file', () => {
    const reloaded = print({ mtimeMs: 9_000, sha256: 'zzz' })
    const state = play(...conflicted, { type: 'conflictResolved', resolution: 'theirs', fingerprint: reloaded })

    expect(state.status).toBe('clean')
    expect(state.fingerprint).toEqual(reloaded)
  })

  it('saving mine as a copy follows the copy once it exists', () => {
    const copy = print({ path: '/work/acme (copy).lvarch', sha256: 'ccc' })
    const state = play(...conflicted, { type: 'conflictResolved', resolution: 'copy', fingerprint: copy })

    expect(state.status).toBe('clean')
    expect(state.fingerprint).toEqual(copy)
  })

  it('stays dirty when the copy has not been written yet', () => {
    // The caller still has a file to choose; until it does, the work is unsaved.
    const state = play(...conflicted, { type: 'conflictResolved', resolution: 'copy' })
    expect(state.status).toBe('dirty')
  })

  it('ignores a resolution when there is no conflict to resolve', () => {
    const state = play(attached, { type: 'conflictResolved', resolution: 'theirs' })
    expect(state.status).toBe('clean')
  })
})

describe('late and out-of-order events', () => {
  it('accepts a save reply nobody is waiting for, without claiming to be clean', () => {
    // The watcher and the writer run on their own schedules; a reducer that
    // threw here would move the problem to the code least able to answer it.
    const landed = print({ mtimeMs: 5_000, sha256: 'ddd' })
    const state = play(attached, { type: 'edited' }, { type: 'saveSucceeded', fingerprint: landed })

    expect(state.status).toBe('dirty')
    expect(state.fingerprint).toEqual(landed)
  })

  it('ignores a failure for a write that is not in flight', () => {
    const state = play(attached, { type: 'saveFailed', reason: 'nope' })
    expect(state.status).toBe('clean')
    expect(state.lastError).toBeUndefined()
  })

  it('lets a reload settle things from any state at all', () => {
    const reloaded = print({ mtimeMs: 9_000 })
    for (const before of [play(), play(attached), play(attached, { type: 'edited' })]) {
      expect(documentSession(before, { type: 'reloadAccepted', fingerprint: reloaded }).status).toBe('clean')
    }
  })
})

describe('hasUnsavedWork', () => {
  it('is true exactly when something would be lost by closing', () => {
    expect(hasUnsavedWork(play())).toBe(false)
    expect(hasUnsavedWork(play(attached))).toBe(false)
    expect(hasUnsavedWork(play(attached, { type: 'edited' }))).toBe(true)
    expect(hasUnsavedWork(play(attached, { type: 'edited' }, { type: 'saveRequested' }))).toBe(false)
    // …but an edit during that write is unsaved work again.
    expect(hasUnsavedWork(play(attached, { type: 'edited' }, { type: 'saveRequested' }, { type: 'edited' })))
      .toBe(true)
  })
})

describe('when to write', () => {
  const dirty = play(attached, { type: 'edited' })

  it('waits for the editor to go quiet', () => {
    expect(shouldSaveNow(dirty, 'idle', AUTOSAVE_IDLE_MS - 1)).toBe(false)
    expect(shouldSaveNow(dirty, 'idle', AUTOSAVE_IDLE_MS)).toBe(true)
  })

  it('does not wait when the window is left or the app is quitting', () => {
    // Leaving is the moment a person believes they are done; quitting is the
    // last moment there is.
    expect(shouldSaveNow(dirty, 'blur', 0)).toBe(true)
    expect(shouldSaveNow(dirty, 'quit', 0)).toBe(true)
  })

  it('never writes when there is nothing to write', () => {
    expect(shouldSaveNow(play(attached), 'quit', 99_999)).toBe(false)
    expect(shouldSaveNow(play(), 'quit', 99_999)).toBe(false)
  })

  it('never writes on top of a write in flight, whatever the trigger', () => {
    const saving = play(attached, { type: 'edited' }, { type: 'saveRequested' })
    for (const trigger of ['idle', 'blur', 'quit'] as const) {
      expect(shouldSaveNow(saving, trigger, 99_999)).toBe(false)
    }
  })

  it('never writes while a conflict is open', () => {
    const conflicted = play(attached, { type: 'edited' },
      { type: 'externalChangeDetected', fingerprint: print({ sha256: 'zzz' }) })

    expect(shouldSaveNow(conflicted, 'quit', 99_999)).toBe(false)
  })
})
