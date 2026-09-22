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
import { reasonOf } from '../platform/errors'
import { readLogoFile, takenLogoKeys } from '../model/logo'
import { readImageFile, takenImageFiles } from '../model/documentImage'
import { openDocumentBytes } from '../projects/workingFile'
import type { SavedDocument } from '../ports/DocumentGateway'
import { messageFor } from './messageFor'
import type { ScopeSnapshot } from '../projects/scope'
import type { ModelSession } from './useModelSession'
import type { AskPassword } from './usePasswordPrompt'
import type { Notify } from './useToasts'
import { landWorkingFile, sealedWorkingFile, unsealedBytes } from './workingFileFlows'
import type { ChooseFolderForWorkingFile, LandingPrompts, OpenedWorkingFile } from './workingFileFlows'

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
   * A picture out of the project. The file goes on the next save, because the
   * store removes what the format no longer writes; the references to it stay
   * where they are and render as their captions. Not undoable, like adding one.
   */
  removeImage: (file: string) => void
}

export function useProjectFiles(deps: {
  session: ModelSession
  documents: ProjectFileChannel
  /**
   * Every scope in the working set, read when an export asks for it
   * (ADR-0018).
   *
   * Read on the gesture rather than held, like `models` beside it: the whole
   * tree in memory is what ADR-0004 keeps catching, and an export is a decision
   * rather than a keystroke. Absent in a test and where there is no store, and
   * the file then holds the open scope alone — which is what it held before.
   */
  workingSet?: () => Promise<ScopeSnapshot[]>
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
  adoptWorkingSet?: (scopes: readonly ScopeSnapshot[]) => Promise<void>
  /**
   * The password a working file leaves under, and the one a sealed file is
   * opened with (ADR-0023). A dialog behind a promise; `undefined` is a cancel.
   */
  askPassword: AskPassword
  /** Where a working file goes, asked before it lands (ADR-0025). */
  landing: LandingPrompts
  /** A folder it may become; absent where none can be chosen. */
  chooseFolder?: ChooseFolderForWorkingFile
  notify: Notify
  s: Translate
}): ProjectFiles {
  const { session, documents, workingSet, adoptWorkingSet, askPassword, landing, chooseFolder, notify, s } = deps

  /**
   * Hand a document over, and say what happened — after it happened.
   *
   * Both of these used to fire the gateway and toast success in the next
   * statement, without waiting. A refused save (no permission, a full disk, a
   * cancelled picker) then showed "saved" and the user had every reason to
   * believe it. The promise decides now, and both branches say so.
   */
  const handOver = useCallback((doc: SavedDocument, success: string) => {
    documents.save(doc).then(
      () => notify(success, 'success'),
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
    const live = session.snapshot()
    const set = workingSet ? workingSet() : Promise.resolve([])
    void set.then(
      async (stored) => {
        const scopes = stored.some((scope) => scope.path === live.path)
          ? stored.map((scope) => (scope.path === live.path ? live : scope))
          : [live, ...stored]
        const doc = await sealedWorkingFile(scopes, askPassword)
        if (doc) handOver(doc, s('shell.savedWorkingFile'))
      },
    ).catch((err: unknown) => notify(s('shell.saveFileFailed', { message: reasonOf(err) }), 'error'))
  }, [session, workingSet, askPassword, handOver, notify, s])

  /**
   * Open a chosen file into the project you are in.
   *
   * The file supplies the content; the open project supplies where it is filed.
   * Recognising the file and deciding whether to lay out again sit in
   * `openProjectDocument`, testable without a browser.
   */
  const landHere = useCallback((name: string, result: OpenedWorkingFile) => {
    try {
      const rest = result.rest ?? []
      if (rest.length && !adoptWorkingSet) {
        notify(s('shell.workingSetNotHere'), 'error')
        return
      }
      if (!rest.length) {
        session.adopt(result.scope, result.relayout)
        notify(s('shell.workingFileLoaded', { name }), 'success')
        return
      }
      // The scopes under it first. The open one is adopted last, because that
      // is the one the screen is about to redraw from and it should not do so
      // over a tree that is still half written.
      void adoptWorkingSet!(rest).then(
        () => {
          session.adopt(result.scope, result.relayout)
          notify(s('shell.workingSetLoaded', { name, count: String(rest.length) }), 'success')
        },
        (err: unknown) => notify(s('shell.processFailed', { message: reasonOf(err) }), 'error'),
      )
    } catch (err) {
      notify(s('shell.processFailed', { message: (err as Error).message }), 'error')
    }
  }, [session, adoptWorkingSet, notify, s])

  const openDocument = useCallback((name: string, held: Uint8Array) => {
    // A sealed file asks for its password first (ADR-0023), and everything
    // written before there was a seal opens as it did. Then where it goes
    // (ADR-0025): bytes and not text throughout, because what a file IS is a
    // question about its content, and a renamed file is still what it is.
    void unsealedBytes(held, askPassword, s('seal.wrong')).then(async (bytes) => {
      if (!bytes) return
      await landWorkingFile({
        name, bytes, into: session.snapshot(), prompts: landing, chooseFolder,
        here: (opened) => landHere(name, opened), notify, s,
      })
    }).catch((err: unknown) => notify(s('shell.processFailed', { message: reasonOf(err) }), 'error'))
  }, [session, landHere, askPassword, landing, chooseFolder, notify, s])

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
  const addImage = useCallback((file: File): Promise<string | undefined> =>
    readImageFile(file, takenImageFiles(session.currentImages()), () => documents.readDataUrl(file))
      .then((image) => {
        session.setImageLibrary((library) => [...library, image])
        return image.file
      })
      .catch((err: unknown) => {
        notify(messageFor(err, s), 'error')
        return undefined
      }), [documents, session, notify, s])

  const removeImage = useCallback((file: string) => {
    session.setImageLibrary((library) => library.filter((image) => image.file !== file))
  }, [session])

  const savePicture = useCallback((doc: { name: string; bytes: Uint8Array; mediaType: 'image/png' }) => {
    handOver(doc, s('shell.savedPicture'))
  }, [handOver, s])

  return { saveWorkingFile, savePicture, openFile, openDocument, addLogo, addImage, removeImage }
}
