// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The question a folder pick asks when there is work kept in this browser to
 * bring along.
 *
 * Choosing a folder used to copy whatever browser storage held into it, once
 * per folder and without a word. That is right exactly once — the first time
 * somebody moves their work out of the app and into files — and wrong every
 * time after it: a folder made to start something new arrived with somebody
 * else's landscape already in it.
 *
 * So the copy is an answer rather than a side effect, and asked only when it
 * can mean something: the folder was just chosen, nothing has been rescued
 * anywhere yet, this folder has not been asked already, and there is work to
 * bring. A dialog nothing but its two answers closes — a question clicked away
 * would be asked again at the next pick, and answered by nobody.
 *
 * Both answers are safe, and the text says so: nothing is deleted either way,
 * and the work stays in this browser until somebody moves it on purpose. A no
 * is remembered per folder, because a browser hands out a folder permission
 * that rarely survives a restart: the same folder is picked again on the next
 * boot, and a question already answered must not be asked twice. A copy that
 * did not finish is recorded as neither, and asked again — and so is one where
 * a scope could not be written or that was stopped: the outcome offers to go on
 * at once, and the next pick of the folder asks again, when a second copy writes
 * only what is not there yet. A scope this browser could not read is said, and
 * not asked about again in this folder: no second try reads it.
 *
 * A yes stays on screen until the copy is done, saying how far it has got and
 * able to stop — a copy of a large landscape takes a while, and a dialog that
 * closed at once said it was done before it was — and then says what came of
 * it: what is in the folder, by kind, read back and found the same, and each
 * thing that did not come along, by name and with why (`adoptionWords`). Only a
 * copy that is whole is said as done and ends the offer. What the open scope
 * held unwritten is written first, so the copy never writes over an edit. A
 * folder that already holds other work is said before anybody answers: that
 * work stays as it is, and those scopes are not brought.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../widgets/kit/Button'
import { Dialog, DialogFacts } from '../../widgets/kit/Dialog'
import { Progress } from '../../widgets/kit/Progress'
import { useStrings } from '../../i18n'
import { copyScopes, holdsWork, isWhole, surveyCopy } from '../../projects/copyScopes'
import type { CopyProgress, CopyTally } from '../../projects/copyScopes'
import type { SourceChromeProps } from '../../ports/ProviderParts'
import { adoptionOutcome, pathsOf, reasonIn } from './adoptionWords'
import type { FolderAdoption, FolderOwn } from './folderOwn'
import { mayOfferAdoption, readAdoptedFolders, readDeclinedFolders, readMigratedFolders } from './remembered'

type AdoptionProps = Pick<SourceChromeProps<FolderOwn>, 'preferences' | 'reread' | 'flush' | 'back'> & {
  own: FolderOwn
  adoption: FolderAdoption
}

/** Where the question stands: not up, asked, copying, or saying what came of the copy. */
type Stage =
  | { at: 'closed' }
  | { at: 'asking'; differs: readonly string[] }
  | { at: 'copying'; progress?: CopyProgress; stopping?: true }
  | { at: 'said'; alert?: true; title: string; lines: readonly string[]; again?: true; staying?: true }

export function FolderAdoptionQuestion({ own, adoption, preferences, reread, flush, back }: AdoptionProps) {
  const { t: s } = useStrings()
  const [stage, setStage] = useState<Stage>({ at: 'closed' })
  // Once, as the folder opens: whether to ask at all. An answer given while
  // the question is up is what closes it, and it is not decided again.
  const decided = useRef(false)
  const running = useRef<AbortController | undefined>(undefined)
  useEffect(() => {
    if (decided.current) return
    decided.current = true
    if (!mayOfferAdoption(preferences.read(), adoption.root)) return
    void holdsWork(adoption.from).then(async (holds) => {
      if (!holds) return
      // A folder that will not say what it holds is still asked about: the
      // copy looks again, scope by scope, and writes over nothing either way.
      const survey = await surveyCopy(adoption.from, adoption.into).catch((cause: unknown) => {
        own.report('migration', cause)
        return { differs: [] as string[] }
      })
      setStage({ at: 'asking', differs: survey.differs })
    })
  }, [own, adoption, preferences])
  // A copy nobody can see any more, the folder having gone from under it, stops.
  useEffect(() => () => running.current?.abort(), [])

  const copied = useCallback((tally: CopyTally) => {
    // What was left behind is said at the level a person looking for lost work
    // reads, and each failure on the trail with its own cause.
    const whole = isWhole(tally)
    own.note(whole ? 'info' : 'warn', 'migration',
      `copied ${tally.scopes} scopes, already ${tally.already}, kept ${tally.kept}, failed ${tally.failed}, unread ${tally.unread}, unlike ${tally.unlike.length}`)
    for (const failure of tally.failures) own.report('migration', failure.cause)
    const said = adoptionOutcome(tally, adoption.name, s)
    if (whole) {
      const held = preferences.read()
      preferences.write({
        adoptedFolders: [...new Set([...readAdoptedFolders(held), adoption.root])],
        // Beside it for a build before this one, which reads this list.
        migratedFolders: [...new Set([...readMigratedFolders(held), adoption.root])],
      })
    } else if (!said.again) {
      // Everything that could be done was: what is left is the folder's own
      // work or what this browser cannot read, and no second try changes that.
      // This folder has had its answer; the next is a fair question.
      preferences.write({ declinedFolders: [...new Set([...readDeclinedFolders(preferences.read()), adoption.root])] })
    }
    // A copy that left something behind is not where the work goes on: the
    // folder holds less than this browser does, so closing goes back to it.
    const staying = !whole && back !== undefined
    reread()
    setStage({
      at: 'said', title: said.title, lines: staying ? [...said.lines.filter((line) => line !== s('folder.adoptBrowserKept')), s('folder.adoptStaying')] : said.lines,
      ...(said.again ? { again: true as const } : {}), ...(staying ? { staying: true as const } : {}),
    })
  }, [own, adoption, preferences, reread, s, back])

  const copy = useCallback(() => {
    const controller = new AbortController()
    running.current = controller
    setStage({ at: 'copying' })
    void flush()
      .then(() => copyScopes(adoption.from, adoption.into, {
        signal: controller.signal,
        ...(adoption.check ? { check: adoption.check } : {}),
        onProgress: (progress) => setStage((was) => (was.at === 'copying' ? { ...was, progress } : was)),
      }))
      .then(copied, (cause: unknown) => {
        own.report('migration', cause)
        setStage({
          at: 'said', alert: true, title: s('folder.adoptFailedTitle'),
          lines: [s('folder.adoptFailed', { message: reasonIn(cause, s) }), s(back ? 'folder.adoptStaying' : 'folder.adoptBrowserKept')],
          ...(back ? { staying: true as const } : {}),
        })
      })
  }, [own, adoption, flush, copied, s, back])

  const stop = useCallback(() => {
    running.current?.abort()
    setStage((was) => (was.at === 'copying' ? { ...was, stopping: true } : was))
  }, [])

  const skip = useCallback(() => {
    setStage({ at: 'closed' })
    preferences.write({ declinedFolders: [...new Set([...readDeclinedFolders(preferences.read()), adoption.root])] })
  }, [adoption, preferences])

  const close = useCallback(() => {
    setStage({ at: 'closed' })
    if (stage.at === 'said' && stage.staying) back?.()
  }, [stage, back])

  const title = stage.at === 'said' ? stage.title : stage.at === 'copying' ? s('folder.adoptCopyingTitle') : s('folder.adoptTitle')
  return (
    <Dialog
      open={stage.at !== 'closed'} size="m" title={title} onClose={close} working={stage.at !== 'said' && stage.at !== 'closed'}
      actions={(
        <>
          {stage.at === 'asking' && (
            <>
              <Button size="small" onClick={skip} data-testid="adopt-skip">{s('folder.adoptSkip')}</Button>
              <Button size="small" variant="primary" onClick={copy} data-testid="adopt-copy">{s('folder.adoptCopy')}</Button>
            </>
          )}
          {stage.at === 'copying' && (
            <Button size="small" onClick={stop} disabled={stage.stopping} data-testid="adopt-stop">{s(stage.stopping ? 'folder.adoptStopping' : 'folder.adoptStop')}</Button>
          )}
          {stage.at === 'said' && stage.again && (
            <Button size="small" onClick={copy} data-testid="adopt-again">{s('folder.adoptAgain')}</Button>
          )}
          {stage.at === 'said' && (
            <Button size="small" variant="primary" onClick={close} data-testid="adopt-close">{s(stage.staying ? 'folder.adoptStay' : 'folder.adoptClose')}</Button>
          )}
        </>
      )}
    >
      <div data-testid="adopt-folder">
        {stage.at === 'asking' && <p>{s('folder.adoptBody', { name: adoption.name })}</p>}
        {stage.at === 'asking' && stage.differs.length > 0 && (
          <DialogFacts title={s('folder.adoptHolds', { count: stage.differs.length })}>
            <span data-testid="adopt-holds">{s('folder.adoptHoldsDetail', { paths: pathsOf(stage.differs) })}</span>
          </DialogFacts>
        )}
        {stage.at === 'copying' && (
          <>
            <p role="status">{s('folder.adoptCopying', { name: adoption.name })}</p>
            <Progress
              value={stage.progress && stage.progress.done + (stage.progress.phase === 'checking' ? stage.progress.total : 0)}
              max={stage.progress && stage.progress.total * 2} label={s('folder.adoptProgressLabel')} data-testid="adopt-busy"
            />
            {stage.progress && (
              <p data-testid="adopt-progress">{s(stage.progress.phase === 'checking' ? 'folder.adoptChecking' : 'folder.adoptProgress', {
                done: stage.progress.done, total: stage.progress.total, scope: stage.progress.name || '/',
              })}</p>
            )}
          </>
        )}
        {stage.at === 'said' && (
          <div role={stage.alert ? 'alert' : 'status'} data-testid="adopt-outcome">
            {stage.lines.map((line) => <p key={line}>{line}</p>)}
          </div>
        )}
      </div>
    </Dialog>
  )
}
