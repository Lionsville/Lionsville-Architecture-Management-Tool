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
import { WORKING_FILE_EXTENSION } from '../model/hostModel'
import { toInterchange } from '../model/toInterchange'
import { openProjectDocument, toWorkingFile } from '../projects/project'
import { refPath } from '../projects/projectRef'
import type { TextDocument } from '../ports/DocumentGateway'
import { messageFor } from './messageFor'
import type { ModelSession } from './useModelSession'
import type { Notify } from './useToasts'

/**
 * What this hook needs from a document channel.
 *
 * Exactly three lines, and not the `DocumentGateway` itself. The difference is
 * not cosmetic: it lets this hook be tested with three functions instead of a
 * rebuilt gateway, and it lets the signature show that nothing leaves the
 * building except what the user asked for.
 */
export type ProjectFileChannel = {
  save(doc: TextDocument): Promise<void>
  readText(blob: Blob): Promise<string>
  readDataUrl(blob: Blob): Promise<string>
}

export type ProjectFiles = {
  saveWorkingFile: () => void
  saveInterchange: () => void
  openFile: (file: File) => void
  addLogo: (file: File) => void
}

/**
 * A filename from the project itself rather than a constant.
 *
 * One fixed name was fine while there was one project and one customer. With
 * several, two exports in a row would overwrite each other in the download
 * folder and nobody could tell which landscape they were looking at.
 */
function fileNameFor(ref: { group: string; project: string }, suffix: string): string {
  return `${refPath(ref).replace(/\//g, '-')}${suffix}`
}

export function useProjectFiles(deps: {
  session: ModelSession
  documents: ProjectFileChannel
  notify: Notify
  s: Translate
}): ProjectFiles {
  const { session, documents, notify, s } = deps

  /**
   * Hand a document over, and say what happened — after it happened.
   *
   * Both of these used to fire the gateway and toast success in the next
   * statement, without waiting. A refused save (no permission, a full disk, a
   * cancelled picker) then showed "saved" and the user had every reason to
   * believe it. The promise decides now, and both branches say so.
   */
  const handOver = useCallback((doc: TextDocument, success: 'shell.savedWorkingFile' | 'shell.savedInterchange') => {
    documents.save(doc).then(
      () => notify(s(success), 'success'),
      (err: unknown) => notify(s('shell.saveFileFailed', { message: reasonOf(err) }), 'error'),
    )
  }, [documents, notify, s])

  const saveWorkingFile = useCallback(() => {
    const project = session.snapshot()
    handOver({
      name: fileNameFor(project.ref, WORKING_FILE_EXTENSION),
      text: JSON.stringify(toWorkingFile(project), null, 2) + '\n',
      mediaType: 'application/json',
    }, 'shell.savedWorkingFile')
  }, [session, handOver])

  const saveInterchange = useCallback(() => {
    const project = session.snapshot()
    handOver({
      name: fileNameFor(project.ref, '.json'),
      text: JSON.stringify(toInterchange(project.model), null, 2) + '\n',
      mediaType: 'application/json',
    }, 'shell.savedInterchange')
  }, [session, handOver])

  /**
   * Open a chosen file into the project you are in.
   *
   * The file supplies the content; the open project supplies where it is filed
   * and — for an interchange document, which carries no marks — the mark
   * library. Recognising the file and deciding whether to lay out again sit in
   * `openProjectDocument`, testable without a browser.
   */
  const openFile = useCallback((file: File) => {
    documents.readText(file).then(
      (text) => {
        let parsed: unknown
        try { parsed = JSON.parse(text) }
        catch (err) {
          notify(s('shell.invalidJson', { message: (err as Error).message }), 'error')
          return
        }
        try {
          const result = openProjectDocument(parsed, session.snapshot())
          if (!result.ok) { notify(s(result.messageKey), 'error'); return }
          session.adopt(result.project, result.relayout)
          notify(s(
            result.kind === 'workingFile' ? 'shell.workingFileLoaded' : 'shell.interchangeLoaded',
            { name: file.name },
          ), 'success')
        } catch (err) {
          notify(s('shell.processFailed', { message: (err as Error).message }), 'error')
        }
      },
      (err: unknown) => notify(messageFor(err, s), 'error'),
    )
  }, [documents, session, notify, s])

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

  return { saveWorkingFile, saveInterchange, openFile, addLogo }
}
