// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Files: saving the open project out, opening one in, and adding a mark.
 *
 * Every action here touches the outside world, and every one of them does it
 * through a seam this hook describes itself (below). What actually sits behind
 * it — a download, a real "save as", a path on disk — comes from
 * `src/composition.ts` and appears nowhere in this file.
 *
 * Note what is NOT here any more: "back to the shipped document". There is no
 * shipped document. Examples are projects you copy, and leaving the one you are
 * in means going back to the picker — which is navigation, not a file operation.
 */
import { useCallback } from 'react'
import type { Translate } from '../i18n'
import { reasonOf, ShellError } from '../platform/errors'
import { readLogoFile, takenLogoKeys } from '../model/logo'
import { readImageFile } from '../model/documentImage'
import type { ImageEntry, ImageName } from '../model/imageName'
import { readDataUrl } from '../projects/dataUrl'
import type { SavedDocument } from '../ports/DocumentGateway'
import type { CarriedOut, Interchange } from '../ports/Interchange'
import { messageFor } from './messageFor'
import type { ScopeSnapshot } from '../projects/scope'
import type { ModelSession } from './useModelSession'
import type { AskPassword } from './usePasswordPrompt'
import type { Notify } from './useToasts'
import { landWorkingFile, savedWithout, sealedWorkingFile, unsealedBytes } from './workingFileFlows'
import type { AdoptScopes, ChooseDestination, LandingPrompts, OpenedWorkingFile, ReadScope } from './workingFileFlows'
import { putBackSaid } from './history/useProjectHistory'

/**
 * What this hook needs from a document channel.
 *
 * Exactly three lines, and not the `DocumentGateway` itself. The difference is
 * not cosmetic: it lets this hook be tested with three functions instead of a
 * rebuilt gateway, and it lets the signature show that nothing leaves the
 * building except what the user asked for.
 */
export type ProjectFileChannel = {
  save(doc: SavedDocument): Promise<void>
  readBytes(blob: Blob): Promise<Uint8Array>
  readDataUrl(blob: Blob): Promise<string>
}

export type ProjectFiles = {
  saveWorkingFile: () => void
  /** A picture of a page — the sheet at a paper size — through the same gateway, so the desktop gets a save dialog. */
  savePicture: (doc: { name: string; bytes: Uint8Array; mediaType: 'image/png' }) => void
  openFile: (file: File) => void
  /**
   * The same act, from bytes somebody else read.
   *
   * The desktop's `open-file` hands over the contents rather than a path: the
   * file is outside every folder the user granted, and main read it because the
   * double click was the grant.
   */
  openDocument: (name: string, bytes: Uint8Array) => void
  addLogo: (file: File) => void
  /**
   * A picture into the project, answering with the file name to refer to, or
   * `undefined` when it was refused — the refusal has already been shown.
   */
  addImage: (file: File) => Promise<string | undefined>
  /**
   * A picture out of the library. Its entry goes with the next write; the
   * references to it stay where they are and render as their captions. Not
   * undoable, like adding one.
   */
  removeImage: (name: string) => void
}

export type ProjectFilesDeps = {
  session: ModelSession
  /** Put a picture's bytes where the scope is kept, and answer its library entry. */
  putPicture: (name: ImageName, bytes: Uint8Array) => Promise<ImageEntry>
  documents: ProjectFileChannel
  /**
   * Every scope in the working set, read when an export asks for it
   * (ADR-0018), with the ones handed in standing in for what is read at
   * their addresses, and carried out as one file by the interchange.
   *
   * Read on the gesture rather than held, like `models` beside it: the whole
   * tree in memory is what ADR-0004 keeps catching, and an export is a decision
   * rather than a keystroke.
   */
  carryOut: (held: readonly ScopeSnapshot[]) => Promise<CarriedOut>
  /** What reads a working file, and holds a landing to it (`ports/Interchange.ts`). */
  interchange: Pick<Interchange, 'open' | 'check'>
  /**
   * Write the scopes a file brought with it, and say the tree changed
   * (ADR-0018).
   *
   * The session can only replace the scope it has open; the ones filed under it
   * are somebody else's to write, and that somebody is the shell, which owns
   * the store. Absent where there is nothing to write into — the web without a
   * folder, a test — and a file that carries a set is then **refused** rather
   * than opened for its top scope alone. Half a working set is the loss this
   * whole arrangement exists to prevent.
   */
  adoptWorkingSet?: AdoptScopes
  /**
   * One scope as the store now holds it: what a landing is read back through
   * and held to the file's manifest (ADR-0023, amended). Absent where there
   * is no store, and the landing is said as it always was.
   */
  readScope?: ReadScope
  /**
   * The password a working file leaves under, and the one a sealed file is
   * opened with (ADR-0023). A dialog behind a promise; `undefined` is a cancel.
   */
  askPassword: AskPassword
  /** Where a working file goes, asked before it lands (ADR-0025). */
  landing: LandingPrompts
  /** A folder it may become; absent where none can be chosen. */
  chooseDestination?: ChooseDestination
  /** A snapshot of what is here before *Replace here* writes over it (ADR-0025, amended). */
  beforeReplace?: () => Promise<boolean>
  /**
   * The open scope could not be read whole (`ScopeState.unreadable`), and
   * this opens it again. It takes no change, but a working file landed here
   * puts it back whole — which is the one thing it may be done to — and it is
   * then read again rather than adopted into a session that may not change.
   */
  onPutBack?: () => void
  notify: Notify
  s: Translate
}

export function useProjectFiles(deps: ProjectFilesDeps): ProjectFiles {
  const {
    session, putPicture, documents, carryOut, interchange, adoptWorkingSet, readScope, askPassword, landing, chooseDestination,
    beforeReplace, onPutBack, notify, s,
  } = deps

  /**
   * Hand a document over, and say what happened — after it happened.
   *
   * Both of these used to fire the gateway and toast success in the next
   * statement, without waiting. A refused save (no permission, a full disk, a
   * cancelled picker) then showed "saved" and the user had every reason to
   * believe it. The promise decides now, and both branches say so.
   */
  const handOver = useCallback((doc: SavedDocument, success: string, warning?: string) => {
    documents.save(doc).then(
      () => notify(warning ?? success, warning ? 'warning' : 'success'),
      (err: unknown) => notify(s('shell.saveFileFailed', { message: reasonOf(err) }), 'error'),
    )
  }, [documents, notify, s])

  /**
   * The working file: the working folder, zipped (ADR-0003, ADR-0018).
   *
   * The same bytes the folder holds, so an export is something a person can
   * unzip and read, and opening it somewhere else rebuilds the folder exactly —
   * marks and all, which the old single JSON document carried as base64 and the
   * folder does not have to.
   *
   * The whole set and not the open scope. A landscape exported alone carries
   * stand-ins whose definitions are in a scope that did not come with it, and
   * the person who opens it finds a drawing referring to things that are not
   * there. The organisation is the level at which that cannot happen, so it is
   * the level this writes.
   *
   * The open scope comes from the session rather than from the store, because
   * the store holds what was last written and the session holds what is on
   * screen. Exporting is not saving, and an export that quietly left out the
   * last ten minutes would be worse than one that refused.
   *
   * Sealed under a password the person is asked for first (ADR-0023); a
   * cancelled dialog is no file and no toast.
   */
  const saveWorkingFile = useCallback(() => {
    void carryOut([session.snapshot()]).then(
      async (carried) => {
        const doc = await sealedWorkingFile(carried, askPassword)
        if (doc) handOver(doc, s('shell.savedWorkingFile'), savedWithout(carried.without, s))
      },
    ).catch((err: unknown) => notify(err instanceof ShellError
      ? messageFor(err, s)
      : s('shell.saveFileFailed', { message: reasonOf(err) }), 'error'))
  }, [session, carryOut, askPassword, handOver, notify, s])

  /**
   * Open a chosen file into the project you are in.
   *
   * The file supplies the content; the open project supplies where it is filed.
   * Recognising the file and deciding whether to lay out again sit in
   * `openProjectDocument`, testable without a browser.
   *
   * **Every scope the file brings is written through the store, the open one
   * included**, shallowest first, and only then is the open one adopted on
   * screen. The open scope used to be adopted alone and left to the session's
   * own save — which a source whose open scope travels as steps does not do,
   * because adopting a document is not a step: the file's top scope was on
   * the screen and nowhere else. Written with the rest, it is in the store
   * the landing is read back from (ADR-0023, amended). `false` is *nothing
   * was landed*, with the reason already said.
   */
  const landHere = useCallback(async (result: OpenedWorkingFile): Promise<boolean> => {
    // Replacing the open scope is a change to it like any other, and the
    // scopes under it are written first, so it is asked before anything is —
    // but for one that could not be read whole, which a replace puts back.
    const puttingBack = onPutBack !== undefined && adoptWorkingSet !== undefined
    if (!puttingBack && !session.mayChange()) return false
    if (result.rest.length && !adoptWorkingSet) {
      notify(s('shell.workingSetNotHere'), 'error')
      return false
    }
    if (puttingBack) {
      // Asked for, from the notice over a scope that could not be read whole:
      // the one landing such a scope takes, and what it kept first said.
      const brought = await adoptWorkingSet(result, { putBack: { subject: s('history.beforeReplace') } })
      notify(putBackSaid(brought ?? { setAside: [] }, s).trim(), 'info')
      onPutBack()
      return true
    }
    if (adoptWorkingSet) await adoptWorkingSet(result)
    // What landed, as it is kept now: the file carries its pictures' bytes,
    // and the library's entries — which the session draws them from — are
    // made where they were put. A working file carries its own geometry, and
    // is left as it is.
    const landed = adoptWorkingSet && readScope ? await readScope(result.top.path).catch(() => undefined) : undefined
    session.adopt(landed ?? result.top, false)
    return true
  }, [session, adoptWorkingSet, readScope, onPutBack, notify, s])

  const openDocument = useCallback((name: string, held: Uint8Array) => {
    // A sealed file asks for its password first (ADR-0023), and everything
    // written before there was a seal opens as it did. Then where it goes
    // (ADR-0025): bytes and not text throughout, because what a file IS is a
    // question about its content, and a renamed file is still what it is.
    void unsealedBytes(held, askPassword, s('seal.wrong')).then(async (bytes) => {
      if (!bytes) return
      await landWorkingFile({
        name, bytes, into: session.snapshot(), interchange, prompts: landing, chooseDestination,
        here: landHere,
        ...(readScope ? { read: readScope } : {}),
        ...(beforeReplace ? { beforeReplace } : {}),
        notify, s,
      })
    }).catch((err: unknown) => notify(err instanceof ShellError
      ? messageFor(err, s)
      : s('shell.processFailed', { message: reasonOf(err) }), 'error'))
  }, [session, interchange, landHere, readScope, askPassword, landing, chooseDestination, beforeReplace, notify, s])

  const openFile = useCallback((file: File) => {
    documents.readBytes(file).then(
      (bytes) => openDocument(file.name, bytes),
      (err: unknown) => notify(messageFor(err, s), 'error'),
    )
  }, [documents, openDocument, notify, s])

  const addLogo = useCallback((file: File) => {
    readLogoFile(file, takenLogoKeys(session.currentLibrary()), () => documents.readDataUrl(file))
      .then((entry) => {
        // Newest first: what you just added is what you are about to use.
        session.setLogoLibrary((library) => [entry, ...library])
        notify(s('shell.logoAdded', { name: entry.label }), 'success')
      })
      // The reader refuses with a KEY; here, where the language is known, it
      // becomes a sentence.
      .catch((err: unknown) => notify(messageFor(err, s), 'error'))
  }, [documents, session, notify, s])

  /**
   * Take a pasted, dropped or chosen picture into the project, and answer with
   * the file name a document should refer to (ADR-0009).
   *
   * `undefined` on a refusal rather than a rejection: the caller is a caret in
   * a textarea, and it wants to know whether to write a line — the reason has
   * already been shown as a toast, here where the language is known.
   */
  const addImage = useCallback((file: File): Promise<string | undefined> => {
    const taken = new Set(session.currentImages().map((image) => image.name))
    return readImageFile(file, taken, () => documents.readDataUrl(file))
      .then(async (image) => {
        const read = readDataUrl(image.url)
        if (!read) throw new ShellError('shell.imageUnreadable')
        // The bytes first, where the scope is kept; the entry then joins the
        // library, and is written as the step that adds it.
        const entry = await putPicture(image.file, read.bytes)
        session.setImageLibrary((library) => [...library, entry])
        return entry.name
      })
      .catch((err: unknown) => {
        notify(messageFor(err, s), 'error')
        return undefined
      })
  }, [documents, session, putPicture, notify, s])

  const removeImage = useCallback((name: string) => {
    session.setImageLibrary((library) => library.filter((image) => image.name !== name))
  }, [session])

  const savePicture = useCallback((doc: { name: string; bytes: Uint8Array; mediaType: 'image/png' }) => {
    handOver(doc, s('shell.savedPicture'))
  }, [handOver, s])

  return { saveWorkingFile, savePicture, openFile, openDocument, addLogo, addImage, removeImage }
}
