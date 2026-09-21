/**
 * The working file, from a home (ADR-0023): the organisation's screen, or a
 * scope's beneath it, with nothing open.
 *
 * Export and Open used to need an open scope, because the workspace was the
 * only thing that answered them — and the organisation's home, the one screen
 * the file is named after, could not write it. There is no session here; the
 * store is the whole truth about what is on disk, so an export reads it and
 * an open writes it, scope by scope, and says the tree changed.
 *
 * `into` is the scope this home is about: a file opened here lands its top
 * scope there, the way a file opened in the workspace lands on the scope that
 * is open, and the ones filed under it under that.
 */
import { useCallback } from 'react'
import type { Translate } from '../i18n'
import { reasonOf } from '../platform/errors'
import type { ScopeSnapshot } from '../projects/scope'
import { messageFor } from './messageFor'
import type { ProjectFileChannel } from './useProjectFiles'
import type { AskPassword } from './usePasswordPrompt'
import type { Notify } from './useToasts'
import { landWorkingFile, sealedWorkingFile, unsealedBytes } from './workingFileFlows'
import type { ChooseFolderForWorkingFile, LandingPrompts } from './workingFileFlows'

export type HomeFiles = {
  exportWorkingFile: () => void
  openFile: (file: File) => void
  openDocument: (name: string, bytes: Uint8Array) => void
}

export function useHomeFiles(deps: {
  documents: ProjectFileChannel
  /** Every scope in the store, tree order, read on the gesture. */
  workingSet: () => Promise<ScopeSnapshot[]>
  /** The scope this home is about, as it stands — bare where nothing is written yet. */
  into: () => ScopeSnapshot
  /** Write what a file brought, shallowest first, and tell the tree. */
  adopt: (scopes: readonly ScopeSnapshot[]) => Promise<void>
  askPassword: AskPassword
  /** Where a working file goes, asked before it lands (ADR-0025). */
  landing: LandingPrompts
  /** A folder it may become; absent where none can be chosen. */
  chooseFolder?: ChooseFolderForWorkingFile
  notify: Notify
  s: Translate
}): HomeFiles {
  const { documents, workingSet, into, adopt, askPassword, landing, chooseFolder, notify, s } = deps

  const exportWorkingFile = useCallback(() => {
    void workingSet().then(async (stored) => {
      // A store with nothing in it yet is still an organisation with a name.
      const scopes = stored.length ? stored : [into()]
      const doc = await sealedWorkingFile(scopes, askPassword)
      if (!doc) return
      await documents.save(doc)
      notify(s('shell.savedWorkingFile'), 'success')
    }).catch((err: unknown) => notify(s('shell.saveFileFailed', { message: reasonOf(err) }), 'error'))
  }, [workingSet, into, askPassword, documents, notify, s])

  const openDocument = useCallback((name: string, held: Uint8Array) => {
    void unsealedBytes(held, askPassword, s('seal.wrong')).then(async (bytes) => {
      if (!bytes) return
      await landWorkingFile({
        name, bytes, into: into(), prompts: landing, chooseFolder,
        here: async (result) => {
          const rest = result.rest ?? []
          await adopt([result.scope, ...rest])
          notify(rest.length
            ? s('shell.workingSetLoaded', { name, count: String(rest.length) })
            : s('shell.workingFileLoaded', { name }), 'success')
        },
        notify, s,
      })
    }).catch((err: unknown) => notify(s('shell.processFailed', { message: reasonOf(err) }), 'error'))
  }, [askPassword, landing, chooseFolder, into, adopt, notify, s])

  const openFile = useCallback((file: File) => {
    documents.readBytes(file).then(
      (bytes) => openDocument(file.name, bytes),
      (err: unknown) => notify(messageFor(err, s), 'error'),
    )
  }, [documents, openDocument, notify, s])

  return { exportWorkingFile, openFile, openDocument }
}
