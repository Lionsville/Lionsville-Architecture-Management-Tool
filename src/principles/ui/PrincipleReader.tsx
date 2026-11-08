// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One principle, read in the large preview over its list (ADR-0041). What is
 * written is shown and what is empty is not, and what cites it is listed
 * directly, because that is what a principle is for. Rare and final acts wait in
 * one More, where a refusal says why before the press. A principle kept elsewhere
 * says where, with the way there one press away: it is changed and discussed
 * where it is kept.
 */
import { useMemo, useState } from 'react'
import type { Translate } from '../../i18n'
import { plural } from '../../i18n/strings'
import { useStrings } from '../../i18n/LanguageContext'
import { formatDay } from '../../i18n/dates'
import { MarkdownView } from '../../documentation/ui/MarkdownView'
import { CommentThread } from '../../comments/ui/threadPart'
import { RecordChanges } from '../../comments/ui/RecordChanges'
import { Band } from '../../widgets/kit/Band'
import { useLeaveSurface, useLeaveThrough } from '../../widgets/kit/drafts'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { SelectField } from '../../widgets/kit/Field'
import { RecordActions } from '../../widgets/kit/RecordActions'
import type { MenuEntry } from '../../widgets/kit/Menu'
import { PanelSection } from '../../widgets/kit/Panel'
import { Picker } from '../../widgets/kit/Picker'
import { Preview, PreviewFact } from '../../widgets/kit/Preview'
import { formatAspectNumber, formatPrincipleNumber, mayRemove, principleUse } from '../principle'
import type { Citation, PrincipleRef, PrincipleRelationKind } from '../principle'
import type { PrincipleInForce } from '../suggest'
import { MergeDialog } from './MergeDialog'
import { usePrinciples } from './PrinciplesContext'
import type { PrincipleSource } from './PrinciplesContext'
import { NATURE_WORD, REGIME_SENTENCE, STANCE_WORD, STATUS_WORD } from './words'

export function PrincipleReader({ found, here, ids, currentId, onSelect, onEdit, onPick }: {
  found: PrincipleInForce
  here: string
  /** The list's rows as drawn, for walking it. */
  ids: readonly string[]
  currentId: string
  onSelect: (id: string | null) => void
  onEdit: () => void
  onPick: (ref: PrincipleRef) => void
}) {
  const access = usePrinciples()
  const { t, language } = useStrings()
  const [merging, setMerging] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [talking, setTalking] = useState(false)
  const { principle, scope } = found
  const version = access?.version ?? 0
  const citations = useMemo(() => access?.citationsTo({ scope, id: principle.id }) ?? [], [access, scope, principle.id, version])
  if (!access) return null
  const from = access.sourceOf(here, scope)
  const may = access.mayWrite(scope)
  const number = formatPrincipleNumber(principle.number)
  const setStatus = (status: 'candidate' | 'accepted' | 'retired') => access.setStatus(scope, principle.id, status)
  const status = principle.status === 'accepted' && principle.acceptedOn
    ? t('principles.acceptedOn', { date: formatDay(principle.acceptedOn, language) })
    : t(STATUS_WORD[principle.status])
  // Copy link reads too, so it stands where nothing else of the ⋯ may: a reader sends a principle on as well.
  const copy: MenuEntry[] = access.copyLink ? [{ label: t('common.copyLink'), onSelect: () => access.copyLink?.({ scope, id: principle.id }), 'data-testid': 'principle-copy-link' }] : []
  const more: MenuEntry[] = [
    ...copy,
    ...(principle.status === 'accepted' ? [{ label: t('principles.retire'), onSelect: () => setStatus('retired') }] : []),
    ...(principle.status === 'retired' ? [{ label: t('principles.restore'), onSelect: () => setStatus('accepted') }] : []),
    { label: t('principles.merge'), onSelect: () => setMerging(true) },
    { label: `${t('principles.remove')}…`, final: true, onSelect: () => setRemoving(true), ...removalRefused(mayRemove(principle, scope, citations), citations.length, t) },
  ]
  return (
    <>
      <Preview
        ids={ids} currentId={currentId} onSelect={onSelect} title={principle.title} listWord={t('principles.listWord')}
        code={from.kind === 'here' ? number : t('principles.numberIn', { number, scope: access.scopeLabel(scope) })}
        facts={<Facts found={found} />}
        {...(may ? { actions: <RecordActions edit={{ onPress: onEdit, testId: 'principle-edit' }} more={more} /> } : copy.length > 0 ? { actions: <RecordActions more={copy} /> } : {})}
        {...(may && principle.status === 'candidate' ? {
          next: <Button variant="primary" onClick={() => setStatus('accepted')} data-testid="principle-accept">{t('principles.accept')}</Button>,
        } : {})}
      >
        <div className="guidance-read" data-testid="principle-reader">
          <KeptElsewhere from={from} scope={scope} open={access.open ? () => access.open?.({ scope, id: principle.id }) : undefined} label={access.scopeLabel} />
          <p className="guidance-read__status" data-testid="principle-status">{status}. {t(REGIME_SENTENCE[principle.regime])}</p>
          {principle.status === 'candidate' && principle.question && <Band tone="info" title={t('principles.question', { question: principle.question })} />}
          <div className="guidance-read__statement" data-document><MarkdownView markdown={principle.statement} /></div>
          <Written found={found} />
          <Use found={found} citations={citations} />
          <Relations found={found} onPick={onPick} />
          {/* Its thread where it is kept; a principle from elsewhere is commented on there (ADR-0037). */}
          {from.kind === 'here' && (talking
            ? <CommentThread about={{ kind: 'principle', id: principle.id }} focusNew />
            : <div><Button variant="quiet" onClick={() => setTalking(true)}>{t('principles.writeComment')}</Button></div>)}
          <RecordChanges about={{ kind: 'principle', id: principle.id }} scope={scope} first="proposed" />
        </div>
      </Preview>
      {merging && <MergeDialog open scope={scope} into={principle} onClose={() => setMerging(false)} />}
      <Dialog
        open={removing} title={t('principles.removeTitle', { number })} onClose={() => setRemoving(false)}
        actions={{
          cancel: { onClick: () => setRemoving(false), label: t('common.cancel') },
          outcome: { onClick: () => { setRemoving(false); access.remove(scope, principle.id); onSelect(null) }, label: t('common.delete'), danger: true },
        }}
      >
        <p>{t('principles.removeBody')}</p>
      </Dialog>
    </>
  )
}

/** Why a principle cannot go, said in the menu before the press. */
function removalRefused(may: boolean, cited: number, t: Translate) {
  return may ? {} : { refused: plural(t, { one: 'principles.removeRefusedOne', other: 'principles.removeRefused' }, cited) }
}

/** The facts beside the text. */
function Facts({ found }: { found: PrincipleInForce }) {
  const access = usePrinciples()
  const { t } = useStrings()
  const { principle, scope, groups } = found
  const groupNames = groups.filter((group) => principle.groups.includes(group.id)).map((group) => group.name)
  return (
    <>
      <PreviewFact label={t('principles.factKept')}>{access?.scopeLabel(scope) ?? scope}</PreviewFact>
      {groupNames.length > 0 && <PreviewFact label={t('principles.factGroups')}>{groupNames.join(', ')}</PreviewFact>}
      {(principle.keywords ?? []).length > 0 && <PreviewFact label={t('principles.keywords')}>{principle.keywords!.join(', ')}</PreviewFact>}
    </>
  )
}

/** What is written about it, and only that: empty fields get no air in reading. */
function Written({ found }: { found: PrincipleInForce }) {
  const { t, language } = useStrings()
  const { principle } = found
  return (
    <>
      {principle.aspects.length > 0 && (
        <PanelSection title={t('principles.aspects')}>
          <div data-testid="principle-aspects">
            {principle.aspects.map((aspect) => (
              <div className="guidance-read__line" key={aspect.id}>
                <span className="guidance-read__code">{formatAspectNumber(principle.number, aspect.number)}</span>
                <span className="guidance-read__grow">{aspect.text}</span>
                <span className="guidance-read__quiet">
                  {[t(NATURE_WORD[aspect.nature]), aspect.signal && t('principles.signal', { signal: aspect.signal }), aspect.steering && t('principles.steering', { steering: aspect.steering })].filter(Boolean).join(' · ')}
                </span>
              </div>
            ))}
          </div>
        </PanelSection>
      )}
      {principle.rationale?.trim() && <PanelSection title={t('principles.rationale')}><MarkdownView markdown={principle.rationale} /></PanelSection>}
      {principle.implications?.trim() && <PanelSection title={t('principles.implications')}><MarkdownView markdown={principle.implications} /></PanelSection>}
      {(principle.sharpened ?? []).length > 0 && (
        <PanelSection title={t('principles.sharpenedHeading')}>
          {principle.sharpened!.map((one, index) => (
            <div className="guidance-read__line" key={index}>
              <span className="guidance-read__quiet">{formatDay(one.on, language)}</span>
              <span className="guidance-read__grow">{one.note}</span>
            </div>
          ))}
        </PanelSection>
      )}
    </>
  )
}

/** Where a principle from elsewhere is kept, and that it is changed and discussed there. */
function KeptElsewhere({ from, scope, open, label }: { from: PrincipleSource; scope: string; open: (() => void) | undefined; label: (scope: string) => string }) {
  const { t } = useStrings()
  if (from.kind === 'here') return null
  const name = label(scope)
  return (
    <Band
      tone="readOnly" title={t(from.kind === 'topic' ? 'principles.keptInTopic' : 'principles.keptAbove', { scope: name })}
      {...(open ? { action: <Button variant="quiet" onClick={open}>{t('principles.openIn', { scope: name })}</Button> } : {})}
    />
  )
}

/** Where it is used, listed: follows, departs, tested, each with its reason. None says so, once. */
function Use({ found, citations }: { found: PrincipleInForce; citations: readonly Citation[] }) {
  const access = usePrinciples()
  const { t } = useStrings()
  // A record that cites it is somewhere else: leaving for it asks about a draft first.
  const leave = useLeaveThrough()
  if (!access) return null
  const { principle, scope } = found
  const use = principleUse({ scope, id: principle.id }, citations)
  return (
    <PanelSection title={t('principles.use')} {...(use.tested > 0 ? { aside: t('principles.useTested', { holds: use.holds, chafes: use.chafes, missing: use.missing }) } : {})}>
      {citations.length === 0 ? <p className="guidance-read__empty" data-testid="principle-use">{t('principles.useNone')}</p> : (
        <div data-testid="principle-citations">
          {citations.map((citation) => (
            <div className="guidance-read__line" key={citation.id}>
              <span className="guidance-read__grow">
                {access.openRecord
                  ? <button type="button" className="guidance__link" onClick={() => leave(() => access.openRecord?.(citation))}>{access.recordLabel(citation)}</button>
                  : access.recordLabel(citation)}
                {citation.aspect !== undefined && <> <span className="guidance-read__code">{formatAspectNumber(principle.number, citation.aspect)}</span></>}
                {citation.reason && <span className="guidance-read__quiet">: {citation.reason}</span>}
              </span>
              <span className="guidance-read__quiet">{t(STANCE_WORD[citation.stance])}</span>
            </div>
          ))}
        </div>
      )}
    </PanelSection>
  )
}

/** *In tension with* and *Refines*: to a principle here or above, added and taken off here. */
function Relations({ found, onPick }: { found: PrincipleInForce; onPick: (ref: PrincipleRef) => void }) {
  const access = usePrinciples()
  const { t } = useStrings()
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<PrincipleRelationKind>('tension')
  // Another principle takes this one's place in the preview, and a comment being written on it with it: asked first.
  const leave = useLeaveSurface()
  if (!access) return null
  const { principle, scope } = found
  const relations = principle.relations ?? []
  const may = access.mayWrite(scope)
  if (relations.length === 0 && !may) return null
  const candidates = access.inForce(scope).filter((one) => !(one.scope === scope && one.principle.id === principle.id) && !one.principle.mergedInto)
  const word = (relation: PrincipleRelationKind) => (relation === 'tension' ? t('principles.inTensionWith') : t('principles.refines'))
  return (
    <PanelSection title={t('principles.related')} {...(may ? { aside: <Button variant="quiet" size="small" onClick={() => setAdding(true)}>{t('principles.relate')}</Button> } : {})}>
      {relations.map((relation, index) => {
        const other = access.find(relation.to)
        return (
          <div className="guidance-read__line" key={index}>
            <span className="guidance-read__quiet">{word(relation.kind)}</span>
            <span className="guidance-read__grow">
              {other
                ? <button type="button" className="guidance__link" onClick={() => leave(() => onPick(relation.to))}>{formatPrincipleNumber(other.principle.number)} {other.principle.title}</button>
                : t('principles.citationGone')}
            </span>
            {may && <Button variant="quiet" size="small" onClick={() => access.unrelate(scope, principle.id, relation)}>{t('principles.unrelate')}</Button>}
          </div>
        )
      })}
      <Dialog
        open={adding} size="m" title={t('principles.relate')} onClose={() => setAdding(false)}
        actions={{
          cancel: { onClick: () => setAdding(false), label: t('common.cancel') },
        }}
      >
        <SelectField
          label={t('principles.relationKind')} value={kind} onChange={(next) => setKind(next as PrincipleRelationKind)}
          options={[{ value: 'tension', label: t('principles.inTensionWith') }, { value: 'refines', label: t('principles.refines') }]}
        />
        <Picker
          label={t('principles.principleField')} autoFocus
          options={candidates.map((one) => ({
            id: `${one.scope}#${one.principle.id}`, label: `${formatPrincipleNumber(one.principle.number)} ${one.principle.title}`,
            ...(one.scope === scope ? {} : { detail: access.scopeLabel(one.scope) }),
          }))}
          recent={candidates.slice(0, 8).map((one) => ({ id: `${one.scope}#${one.principle.id}`, label: `${formatPrincipleNumber(one.principle.number)} ${one.principle.title}` }))}
          onPick={(option) => {
            const to = candidates.find((one) => `${one.scope}#${one.principle.id}` === option.id)
            if (to) access.relate(scope, principle.id, { kind, to: { scope: to.scope, id: to.principle.id } })
            setAdding(false)
          }}
        />
      </Dialog>
    </PanelSection>
  )
}
