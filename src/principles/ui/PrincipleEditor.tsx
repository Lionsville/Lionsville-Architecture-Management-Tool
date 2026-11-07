// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A principle written or changed (ADR-0041), in a focused window: what most people
 * fill in stands open, and why, implications and keywords are folded until there is
 * something in them. A change to an accepted principle's statement or aspects asks
 * for a note first and lands as a sharpening, so older citations can say they
 * predate it. The groups made here land with the principle, in one step.
 */
import { useState } from 'react'
import type { Translate } from '../../i18n'
import { useStrings } from '../../i18n/LanguageContext'
import { barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { MarkdownEditor } from '../../documentation/ui/MarkdownEditor'
import { renderMarkdown } from '../../documentation/ui/renderMarkdown'
import { formatPrincipleNumber, PRINCIPLE_REGIMES, PRINCIPLE_STATUSES } from '../../model/principle'
import type { Principle } from '../../model/principle'
import { Button } from '../../widgets/kit/Button'
import { Dialog, DialogChoices } from '../../widgets/kit/Dialog'
import { TextField } from '../../widgets/kit/Field'
import { FocusedWindow } from '../../widgets/kit/FocusedWindow'
import { PanelSection } from '../../widgets/kit/Panel'
import { draftOf, draftReady, draftSharpens, withNewAspect } from '../draft'
import type { PrincipleDraft } from '../draft'
import { AspectList, GroupPicker } from './editorParts'
import { usePrinciples } from './PrinciplesContext'
import { REGIME_EFFECT, REGIME_WORD, STATUS_SENTENCE, STATUS_WORD } from './words'

let made = 0

/** A principle's words read as the reader will read them. */
const preview = (text: string) => renderMarkdown(text)

export function PrincipleEditor({ open, scope, principle, title, onClose, windowChrome }: {
  open: boolean
  scope: string
  principle?: Principle
  /** What a new one starts out called: what was searched for, and not found. */
  title?: string
  /** Closed: with the id of the principle made or changed, or nothing on cancel. */
  onClose: (id?: string) => void
  windowChrome: WindowChrome
}) {
  const access = usePrinciples()
  const { t } = useStrings()
  const [draft, setDraft] = useState<PrincipleDraft>(() => (title ? { ...draftOf(principle), title } : draftOf(principle)))
  const [start] = useState(() => JSON.stringify(draft))
  const [note, setNote] = useState('')
  const [askingNote, setAskingNote] = useState(false)
  const [refusal, setRefusal] = useState<string>()
  if (!access) return null
  const change = (patch: Partial<PrincipleDraft>) => setDraft((held) => ({ ...held, ...patch }))
  const sharpening = draftSharpens(draft, principle, access.today())
  const keep = () => {
    const saved = access.save(scope, draft, principle, sharpening ? note.trim() : undefined)
    if ('refused' in saved) { setRefusal(saved.refused); setAskingNote(false); return }
    onClose(saved.id)
  }
  return (
    <>
      <FocusedWindow
        open={open} windowChrome={barChromeFor(windowChrome)}
        title={principle ? t('principles.editWord') : t('principles.newTitle')}
        {...(principle ? { number: formatPrincipleNumber(principle.number) } : {})}
        changed={JSON.stringify(draft) !== start}
        saveLabel={principle ? t('principles.save') : t('principles.propose')}
        onSave={() => { if (sharpening) setAskingNote(true); else keep() }}
        {...(draftReady(draft) ? {} : { saveRefused: t('principles.saveNeeds') })}
        onCancel={() => onClose()}
        {...(refusal ? { error: t(refusal as Parameters<Translate>[0]) } : {})}
      >
        <DraftFields draft={draft} change={change} scope={scope} number={principle?.number} />
      </FocusedWindow>
      <Dialog
        open={askingNote} title={t('principles.sharpenTitle')} onClose={() => setAskingNote(false)}
        actions={(
          <>
            <Button variant="plain" onClick={() => setAskingNote(false)}>{t('principles.back')}</Button>
            <Button variant="primary" onClick={keep} reason={note.trim() ? undefined : t('principles.sharpenNeeds')}>{t('principles.sharpenSave')}</Button>
          </>
        )}
      >
        <p>{t('principles.sharpenIntro')}</p>
        <TextField autoFocus required rows={2} label={t('principles.sharpenNote')} value={note} onChange={setNote} data-testid="principle-sharpen-note" />
      </Dialog>
    </>
  )
}

/** Everything the draft says, as fields: the words, how strictly and where it stands, the groups, the aspects, and the rest folded. */
function DraftFields({ draft, change, scope, number }: {
  draft: PrincipleDraft
  change: (patch: Partial<PrincipleDraft>) => void
  scope: string
  number: number | undefined
}) {
  const access = usePrinciples()
  const { t } = useStrings()
  const groups = access?.own(scope).groups ?? []
  const setAspect = (id: string, patch: Partial<PrincipleDraft['aspects'][number]>) => change({ aspects: draft.aspects.map((one) => (one.id === id ? { ...one, ...patch } : one)) })
  const written = draft.rationale.trim() !== '' || draft.implications.trim() !== '' || draft.keywords.trim() !== ''
  return (
    <div className="guidance-form">
      <TextField autoFocus required label={t('principles.titleField')} value={draft.title} onChange={(title) => change({ title })} data-testid="principle-title" />
      <div data-testid="principle-statement"><MarkdownEditor label={t('principles.statementField')} value={draft.statement} onChange={(statement) => change({ statement })} minRows={2} required helper={t('principles.statementHelp')} renderPreview={preview} /></div>
      <PanelSection title={t('principles.regimeField')}>
        <DialogChoices
          label={t('principles.regimeField')} value={draft.regime} onChange={(regime) => change({ regime })}
          options={PRINCIPLE_REGIMES.map((one) => ({ value: one, label: t(REGIME_WORD[one]), effect: t(REGIME_EFFECT[one]) }))}
        />
      </PanelSection>
      <PanelSection title={t('principles.statusField')}>
        <DialogChoices
          label={t('principles.statusField')} value={draft.status} onChange={(status) => change({ status })}
          options={PRINCIPLE_STATUSES.map((one) => ({ value: one, label: t(STATUS_WORD[one]), effect: t(STATUS_SENTENCE[one]) }))}
        />
      </PanelSection>
      {draft.status === 'candidate' && <TextField label={t('principles.questionField')} hint={t('principles.questionHelp')} value={draft.question} onChange={(question) => change({ question })} />}
      <GroupPicker groups={groups} picked={draft.groups} made={draft.newGroups} onChange={(picked, names) => change({ groups: picked, newGroups: names })} t={t} />
      <AspectList
        number={number} aspects={draft.aspects} t={t}
        onAdd={() => { made += 1; change(withNewAspect(draft, `as-${Date.now().toString(36)}-${made}`)) }}
        onChange={setAspect}
        onRemove={(id) => change({ aspects: draft.aspects.filter((one) => one.id !== id) })}
      />
      <details className="guidance-form__fold" open={written}>
        <summary>{t('principles.folded')}</summary>
        <div>
          <MarkdownEditor label={t('principles.rationale')} value={draft.rationale} onChange={(rationale) => change({ rationale })} minRows={2} renderPreview={preview} />
          <MarkdownEditor label={t('principles.implications')} value={draft.implications} onChange={(implications) => change({ implications })} minRows={2} renderPreview={preview} />
          <TextField label={t('principles.keywords')} hint={t('principles.keywordsHelp')} value={draft.keywords} onChange={(keywords) => change({ keywords })} />
        </div>
      </details>
    </div>
  )
}
