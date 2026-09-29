// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import { reasonOf, ShellError } from '../platform/errors'
import type { CarriedOut, Interchange } from '../ports/Interchange'
import type { ScopeSnapshot } from '../projects/scope'
import { messageFor } from './messageFor'
import type { ProjectFileChannel } from './useProjectFiles'
import type { AskPassword } from './usePasswordPrompt'
import type { Notify } from './useToasts'
import { landWorkingFile, savedWithout, sealedWorkingFile, unsealedBytes } from './workingFileFlows'
import type { ChooseDestination, LandingPrompts, OpenedWorkingFile, ReadScope } from './workingFileFlows'

export type HomeFiles = {
  exportWorkingFile: () => void
  openFile: (file: File) => void
  openDocument: (name: string, bytes: Uint8Array) => void
}

export function useHomeFiles(deps: {
  documents: ProjectFileChannel
  /** Every scope in the store, read on the gesture and carried out as one file. */
  carryOut: () => Promise<CarriedOut>
  /** What reads a working file, and holds a landing to it (`ports/Interchange.ts`). */
  interchange: Pick<Interchange, 'open' | 'check'>
  /** The scope this home is about, as it stands — bare where nothing is written yet. */
  into: () => ScopeSnapshot
  /**
   * Write what a file brought, shallowest first, and tell the tree — as one,
   * where the store can, held to what the file says it holds.
   */
  adopt: (opened: OpenedWorkingFile) => Promise<void>
  /** One scope as the store now holds it, to check a landing against the file (ADR-0023, amended). */
  readScope?: ReadScope
  askPassword: AskPassword
  /** Where a working file goes, asked before it lands (ADR-0025). */
  landing: LandingPrompts
  /** A folder it may become; absent where none can be chosen. */
  chooseDestination?: ChooseDestination
  /** A snapshot of what is here before *Replace here* writes over it (ADR-0025, amended). */
  beforeReplace?: () => Promise<boolean>
  notify: Notify
  s: Translate
}): HomeFiles {
  const { documents, carryOut, interchange, into, adopt, readScope, askPassword, landing, chooseDestination, beforeReplace, notify, s } = deps

  const exportWorkingFile = useCallback(() => {
    void carryOut().then(async (carried) => {
      const doc = await sealedWorkingFile(carried, askPassword)
      if (!doc) return
      await documents.save(doc)
      const without = savedWithout(carried.without, s)
      notify(without ?? s('shell.savedWorkingFile'), without ? 'warning' : 'success')
    }).catch((err: unknown) => notify(err instanceof ShellError
      ? messageFor(err, s)
      : s('shell.saveFileFailed', { message: reasonOf(err) }), 'error'))
  }, [carryOut, askPassword, documents, notify, s])

  const openDocument = useCallback((name: string, held: Uint8Array) => {
    void unsealedBytes(held, askPassword, s('seal.wrong')).then(async (bytes) => {
      if (!bytes) return
      await landWorkingFile({
        name, bytes, into: into(), interchange, prompts: landing, chooseDestination,
        here: adopt,
        ...(readScope ? { read: readScope } : {}),
        ...(beforeReplace ? { beforeReplace } : {}),
        notify, s,
      })
    }).catch((err: unknown) => notify(err instanceof ShellError
      ? messageFor(err, s)
      : s('shell.processFailed', { message: reasonOf(err) }), 'error'))
  }, [askPassword, interchange, landing, chooseDestination, beforeReplace, into, adopt, readScope, notify, s])

  const openFile = useCallback((file: File) => {
    documents.readBytes(file).then(
      (bytes) => openDocument(file.name, bytes),
      (err: unknown) => notify(messageFor(err, s), 'error'),
    )
  }, [documents, openDocument, notify, s])

  return { exportWorkingFile, openFile, openDocument }
}
